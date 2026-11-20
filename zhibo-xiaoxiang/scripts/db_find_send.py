"""Find the send button and check what Enter actually does in the composer."""
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
    ws = await websockets.connect(page["webSocketDebuggerUrl"], max_size=64 << 20)
    mid = 0
    pending: dict[int, asyncio.Future] = {}

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

    print("== editor text ==")
    print(await js("""
    (() => {
      const ed = [...document.querySelectorAll('[contenteditable="true"]')]
        .filter(e => e.offsetParent !== null).pop();
      if (!ed) return 'none';
      return {text: ed.innerText.slice(0, 120), cls: ed.className,
              html: ed.innerHTML.slice(0, 300)};
    })()
    """))

    print("\n== buttons near composer ==")
    print(json.dumps(await js("""
    (() => {
      const ed = [...document.querySelectorAll('[contenteditable="true"]')]
        .filter(e => e.offsetParent !== null).pop();
      if (!ed) return 'none';
      let root = ed;
      for (let i = 0; i < 8 && root.parentElement; i++) root = root.parentElement;
      const out = [];
      root.querySelectorAll('button,[role="button"],div[class*="send"],svg').forEach(e => {
        const r = e.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return;
        out.push({tag: e.tagName, aria: e.getAttribute('aria-label') || '',
                  testid: e.getAttribute('data-testid') || '',
                  cls: (e.className || '').toString().slice(0, 70),
                  txt: (e.innerText || '').trim().slice(0, 14),
                  x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2)});
      });
      return out.slice(0, 25);
    })()
    """), ensure_ascii=False, indent=1))
    task.cancel()
    await ws.close()


asyncio.run(main())
