"""Screenshot the live Doubao tab and dump the last message text."""
from __future__ import annotations

import asyncio
import base64
import json
import sys
from pathlib import Path

import httpx
import websockets

PORT = 9222
OUT = Path(__file__).resolve().parent.parent / "data" / "inbox" / "page.png"


async def main() -> None:
    async with httpx.AsyncClient(timeout=3) as c:
        tabs = (await c.get(f"http://127.0.0.1:{PORT}/json")).json()
    page = next(t for t in tabs if t.get("type") == "page")
    async with websockets.connect(page["webSocketDebuggerUrl"], max_size=64 << 20) as ws:
        mid = 0
        pending: dict[int, asyncio.Future] = {}

        async def reader():
            async for raw in ws:
                m = json.loads(raw)
                if "id" in m and m["id"] in pending:
                    pending.pop(m["id"]).set_result(m.get("result") or {})

        task = asyncio.create_task(reader())

        async def call(method, **params):
            nonlocal mid
            mid += 1
            fut = asyncio.get_running_loop().create_future()
            pending[mid] = fut
            await ws.send(json.dumps({"id": mid, "method": method, "params": params}))
            return await asyncio.wait_for(fut, 60)

        async def js(expr):
            r = await call("Runtime.evaluate", expression=expr,
                           returnByValue=True, awaitPromise=True)
            return (r.get("result") or {}).get("value")

        txt = await js("""
        (() => {
          const imgs = [...document.querySelectorAll('img')]
            .filter(e => e.offsetParent !== null && e.naturalWidth > 100)
            .map(e => ({nw: e.naturalWidth, nh: e.naturalHeight,
                        src: e.src.slice(0, 120)}));
          const body = document.body.innerText;
          return {imgs: imgs.slice(-12), tail: body.slice(-700)};
        })()
        """)
        print("--- big images ---")
        for i in txt["imgs"]:
            print(i["nw"], "x", i["nh"], i["src"][:110])
        print("--- page text tail ---")
        print(txt["tail"])

        shot = await call("Page.captureScreenshot", format="png")
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_bytes(base64.b64decode(shot["data"]))
        print("screenshot:", OUT)
        task.cancel()


asyncio.run(main())
