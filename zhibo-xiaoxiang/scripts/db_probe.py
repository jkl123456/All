"""Quick look at the live Doubao page: logged in? input box? upload entry?

    python scripts/db_probe.py
"""
from __future__ import annotations

import asyncio
import json

import httpx
import websockets

PORT = 9222


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

        async def js(expr: str):
            nonlocal mid
            mid += 1
            fut = asyncio.get_running_loop().create_future()
            pending[mid] = fut
            await ws.send(json.dumps({"id": mid, "method": "Runtime.evaluate",
                                      "params": {"expression": expr,
                                                 "returnByValue": True,
                                                 "awaitPromise": True}}))
            r = await asyncio.wait_for(fut, 30)
            return (r.get("result") or {}).get("value")

        info = await js("""
        (() => {
          const box = [...document.querySelectorAll('textarea,[contenteditable="true"]')]
            .filter(e => e.offsetParent !== null);
          const files = document.querySelectorAll('input[type=file]');
          const btns = [...document.querySelectorAll('button,[role="button"],div[class*="btn"]')]
            .filter(e => e.offsetParent !== null)
            .map(e => ({
              t: ((e.innerText || e.getAttribute('aria-label') || e.getAttribute('title') || '') + '').trim().slice(0, 20),
              aria: e.getAttribute('aria-label') || '',
              cls: (e.className || '').toString().slice(0, 60)
            }))
            .filter(o => o.t || o.aria)
            .slice(0, 40);
          return {
            url: location.href,
            title: document.title,
            inputs: box.length,
            fileInputs: files.length,
            fileAccept: [...files].map(f => f.accept).join('|'),
            locked: document.body.innerText.includes('扫码登录'),
            bodyLen: document.body.innerText.length,
            btns
          };
        })()
        """)
        print(json.dumps(info, ensure_ascii=False, indent=2)[:4000])
        task.cancel()


asyncio.run(main())
