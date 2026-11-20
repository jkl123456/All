"""Try an upload and diff the composer DOM, so we can see whether the
attachment chip is a real <img> or something else."""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

import httpx
import websockets

PORT = 9222
ROOT = Path(__file__).resolve().parent.parent


async def main() -> None:
    img = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "data/samples/test01.jpg")
    print("file:", img, img.stat().st_size // 1024, "KB")
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

        SNAP = """
        (() => {
          const ed = [...document.querySelectorAll('[contenteditable="true"]')]
            .filter(e => e.offsetParent !== null).pop();
          if (!ed) return {err: 'no editor'};
          let root = ed;
          for (let i = 0; i < 5 && root.parentElement; i++) root = root.parentElement;
          const imgs = [...root.querySelectorAll('img')].map(e => e.src.slice(0, 70));
          return {html: root.innerHTML.replace(/\\s+/g, ' ').slice(0, 1600),
                  imgs, w: root.getBoundingClientRect().height};
        })()
        """

        await call("DOM.enable")
        before = await js(SNAP)
        print("--- before ---")
        print(before["html"][:600])

        doc = await call("DOM.getDocument", depth=-1, pierce=True)
        q = await call("DOM.querySelector", nodeId=doc["root"]["nodeId"],
                       selector='input[type="file"]')
        node = q.get("nodeId")
        print("file input node:", node)
        await call("DOM.setFileInputFiles", files=[str(img.resolve())], nodeId=node)

        for i in range(16):
            await asyncio.sleep(1.0)
            now = await js(SNAP)
            if now["html"] != before["html"]:
                print(f"--- changed after {i+1}s ---")
                print(now["html"][:1200])
                print("imgs:", now["imgs"])
                break
        else:
            print("--- no change in composer after 16s ---")
            print((await js(SNAP))["html"][:600])
        task.cancel()


asyncio.run(main())
