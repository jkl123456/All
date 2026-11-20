"""Upload an image by faking a native paste inside the page.

Chrome's DOM.setFileInputFiles is ignored by Doubao's tiptap editor, and the
OS clipboard is fragile for an unattended bot. A synthetic ClipboardEvent with
a DataTransfer that carries a real File hits the same code path as Ctrl+V.
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


async def cdp_connect():
    async with httpx.AsyncClient(timeout=3) as c:
        tabs = (await c.get(f"http://127.0.0.1:{PORT}/json")).json()
    page = next(t for t in tabs if t.get("type") == "page")
    ws = await websockets.connect(page["webSocketDebuggerUrl"], max_size=64 << 20)
    state = {"mid": 0, "pending": {}}

    async def reader():
        async for raw in ws:
            m = json.loads(raw)
            if "id" in m and m["id"] in state["pending"]:
                state["pending"].pop(m["id"]).set_result(m.get("result") or {})

    task = asyncio.create_task(reader())

    async def call(method, **params):
        state["mid"] += 1
        mid = state["mid"]
        fut = asyncio.get_running_loop().create_future()
        state["pending"][mid] = fut
        await ws.send(json.dumps({"id": mid, "method": method, "params": params}))
        return await asyncio.wait_for(fut, 90)

    async def js(expr):
        r = await call("Runtime.evaluate", expression=expr,
                       returnByValue=True, awaitPromise=True)
        res = r.get("result") or {}
        if res.get("subtype") == "error":
            print("JS ERROR:", res.get("description", "")[:300])
        return res.get("value")

    return ws, call, js, task


PASTE_JS = """
(async () => {
  const ed = [...document.querySelectorAll('[contenteditable="true"]')]
    .filter(e => e.offsetParent !== null).pop();
  if (!ed) return 'no-editor';
  ed.focus();
  const bin = atob(B64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const file = new File([arr], NAME, {type: MIME});
  const dt = new DataTransfer();
  dt.items.add(file);
  const ev = new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true});
  ed.dispatchEvent(ev);
  return 'sent:' + file.size;
})()
"""

UPLOAD_JS = """
(async () => {
  const ed = [...document.querySelectorAll('[contenteditable="true"]')]
    .filter(e => e.offsetParent !== null).pop();
  if (!ed) return 'no-editor';
  ed.focus();
  const bin = atob(B64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const file = new File([arr], NAME, {type: MIME});
  const dt = new DataTransfer();
  dt.items.add(file);
  const ev = new DragEvent('drop', {dataTransfer: dt, bubbles: true, cancelable: true});
  ed.dispatchEvent(ev);
  return 'dropped:' + file.size;
})()
"""

SNAP = """
(() => {
  const ed = [...document.querySelectorAll('[contenteditable="true"]')]
    .filter(e => e.offsetParent !== null).pop();
  if (!ed) return {err: 'no editor'};
  let root = ed;
  for (let i = 0; i < 6 && root.parentElement; i++) root = root.parentElement;
  return {
    html: root.innerHTML.replace(/\\s+/g, ' ').slice(0, 1800),
    imgs: [...root.querySelectorAll('img')].map(e => e.src.slice(0, 60)),
    h: Math.round(root.getBoundingClientRect().height)
  };
})()
"""


async def main() -> None:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "data/samples/test01.jpg")
    mime = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    b64 = base64.b64encode(path.read_bytes()).decode()
    ws, call, js, task = await cdp_connect()
    before = await js(SNAP)
    print("composer height before:", before["h"], "imgs:", before["imgs"])

    for label, tpl in (("paste", PASTE_JS), ("drop", UPLOAD_JS)):
        expr = (tpl.replace("B64", json.dumps(b64))
                   .replace("NAME", json.dumps(path.name))
                   .replace("MIME", json.dumps(mime)))
        r = await js(expr)
        print(f"{label} -> {r}")
        for i in range(12):
            await asyncio.sleep(1.0)
            now = await js(SNAP)
            if now["h"] > before["h"] + 8 or now["imgs"]:
                print(f"  composer changed after {i+1}s: h={now['h']} imgs={now['imgs']}")
                print("  html:", now["html"][:900])
                task.cancel()
                return
        print("  no change")

    print("--- final ---")
    print((await js(SNAP))["html"][:900])
    task.cancel()


asyncio.run(main())
