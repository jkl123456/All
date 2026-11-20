"""Inspect Doubao's file inputs and the composer so uploads can be aimed correctly."""
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
        pending: dict[str, asyncio.Future] = {}

        async def reader():
            async for raw in ws:
                m = json.loads(raw)
                if "id" in m and m["id"] in pending:
                    pending.pop(m["id"]).set_result(m.get("result") or {})

        task = asyncio.create_task(reader())

        async def js(expr):
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

        print(json.dumps(await js("""
        (() => {
          const out = [];
          document.querySelectorAll('input[type=file]').forEach((f, i) => {
            const box = f.getBoundingClientRect();
            let p = f, chain = [];
            for (let k = 0; k < 6 && p; k++) {
              chain.push((p.tagName || '') + '.' + (p.className || '').toString().slice(0, 40));
              p = p.parentElement;
            }
            out.push({i, accept: (f.accept || '').slice(0, 60), multiple: f.multiple,
                      visible: f.offsetParent !== null, w: box.width, h: box.height,
                      chain});
          });
          return out;
        })()
        """), ensure_ascii=False, indent=2))

        print("--- composer ---")
        print(await js("""
        (() => {
          const ed = [...document.querySelectorAll('textarea,[contenteditable="true"]')]
            .filter(e => e.offsetParent !== null).pop();
          if (!ed) return 'no editor';
          let node = ed;
          for (let i = 0; i < 4 && node.parentElement; i++) node = node.parentElement;
          return node.outerHTML.slice(0, 2500);
        })()
        """))
        task.cancel()


asyncio.run(main())
