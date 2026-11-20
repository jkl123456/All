"""Pull the finished image straight out of the DOM (most reliable path).

The <img> in the reply already points at the CDN original, and fetching it
inside the page carries the cookies/signature the CDN wants.
"""
from __future__ import annotations

import asyncio
import base64
import json
import sys
from pathlib import Path

import httpx
import websockets

PORT = 9222
ROOT = Path(__file__).resolve().parent.parent

GET_JS = """
(async () => {
  const ed = [...document.querySelectorAll('[contenteditable="true"]')]
    .filter(e => e.offsetParent !== null).pop();
  const edTop = ed ? ed.getBoundingClientRect().top : 1e9;
  const all = [...document.querySelectorAll('img')].filter(e => e.naturalWidth >= 300);
  const report = all.map(e => ({w: e.naturalWidth, h: e.naturalHeight,
                                y: Math.round(e.getBoundingClientRect().top),
                                src: e.src.slice(0, 90)}));
  const keep = all.filter(e => /rc_gen_image/.test(e.src));
  if (!keep.length) return {ok: false, reason: 'no rc_gen_image', report};
  keep.sort((a, b) => b.naturalWidth - a.naturalWidth);
  const last = keep[0];
  const src = last.src;
  try {
    const r = await fetch(src);
    const buf = new Uint8Array(await r.arrayBuffer());
    let s = '';
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      s += String.fromCharCode.apply(null, buf.subarray(i, i + chunk));
    }
    return {ok: true, src, size: buf.length, b64: btoa(s),
            w: last.naturalWidth, h: last.naturalHeight, report};
  } catch (e) {
    return {ok: false, reason: String(e), src, report};
  }
})()
"""


async def main() -> None:
    out = ROOT / "data" / "inbox" / "dom_pull.png"
    async with httpx.AsyncClient(timeout=3) as c:
        tabs = (await c.get(f"http://127.0.0.1:{PORT}/json")).json()
    page = next(t for t in tabs if t.get("type") == "page")
    ws = await websockets.connect(page["webSocketDebuggerUrl"], max_size=128 << 20)
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
        r = await asyncio.wait_for(fut, 90)
        res = r.get("result") or {}
        if res.get("subtype") == "error":
            print("JS ERR", res.get("description", "")[:300])
        return res.get("value")

    v = await js(GET_JS)
    for r in (v.get("report") or []):
        print("  img", r["w"], "x", r["h"], "y=", r["y"], r["src"][:80])
    print({k: v.get(k) for k in ("ok", "size", "w", "h", "reason", "src")})
    if v.get("ok"):
        raw = base64.b64decode(v["b64"])
        out.write_bytes(raw)
        print("saved", out, len(raw) // 1024, "KB")
    task.cancel()
    await ws.close()


asyncio.run(main())
