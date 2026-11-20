"""Fill the composer (image + prompt), then dump what appears so we can find
the send button. Runs the whole thing in one process on purpose: the debug
Chrome dies when its parent python exits.
"""
from __future__ import annotations

import asyncio
import base64
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _cdp import ROOT, Session, close, open_session  # noqa: E402

PASTE_JS = """
(async () => {
  const ed = [...document.querySelectorAll('[contenteditable="true"]')]
    .filter(e => e.offsetParent !== null).pop();
  if (!ed) return 'no-editor';
  ed.focus();
  const bin = atob(B64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const dt = new DataTransfer();
  dt.items.add(new File([arr], NAME, {type: MIME}));
  ed.dispatchEvent(new ClipboardEvent('paste',
    {clipboardData: dt, bubbles: true, cancelable: true}));
  return 'ok';
})()
"""

SNAP_JS = """
(() => {
  const ed = [...document.querySelectorAll('[contenteditable="true"]')]
    .filter(e => e.offsetParent !== null).pop();
  if (!ed) return {err: 'no-editor'};
  const r = ed.getBoundingClientRect();
  let root = ed;
  for (let i = 0; i < 8 && root.parentElement; i++) root = root.parentElement;
  const rr = root.getBoundingClientRect();
  const items = [];
  root.querySelectorAll('button,[role="button"],div,svg').forEach(e => {
    const b = e.getBoundingClientRect();
    if (b.width < 16 || b.height < 16 || b.width > 400) return;
    items.push({
      tag: e.tagName,
      testid: (e.getAttribute && e.getAttribute('data-testid')) || '',
      aria: (e.getAttribute && e.getAttribute('aria-label')) || '',
      cls: ((e.className || '') + '').slice(0, 44),
      txt: (e.innerText || '').trim().slice(0, 10),
      x: Math.round(b.x), y: Math.round(b.y),
      w: Math.round(b.width), h: Math.round(b.height)
    });
  });
  return {editor: [Math.round(r.x), Math.round(r.y), Math.round(r.right), Math.round(r.bottom)],
          root: [Math.round(rr.x), Math.round(rr.y), Math.round(rr.right), Math.round(rr.bottom)],
          text: ed.innerText.slice(0, 80),
          items};
})()
"""


def report(snap: dict, tag: str) -> None:
    print(f"\n--- {tag} ---")
    print("editor rect:", snap.get("editor"), " root:", snap.get("root"))
    print("text in editor:", repr(snap.get("text"))[:90])
    items = snap.get("items") or []
    # right-bottom corner first: send button lives there
    items.sort(key=lambda o: (-(o["x"] + o["w"]), -(o["y"] + o["h"])))
    for o in items[:14]:
        print(f"  {o['tag']:<6} {o['x']:>4},{o['y']:>4} {o['w']:>3}x{o['h']:<3} "
              f"{o['testid'][:22]:<22} {o['aria'][:10]:<10} {o['txt'][:8]:<8} {o['cls'][:32]}")


async def main() -> None:
    avatar = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "data/samples/test01.jpg")
    prompt = (ROOT / "prompts/lineart.txt").read_text(encoding="utf-8").strip()
    s, task = await open_session()

    await asyncio.sleep(3)
    before = await s.js(SNAP_JS)
    report(before, "before fill")

    b64 = base64.b64encode(avatar.read_bytes()).decode()
    expr = (PASTE_JS.replace("B64", json.dumps(b64))
                    .replace("NAME", json.dumps(avatar.name))
                    .replace("MIME", '"image/jpeg"'))
    print("\npaste ->", await s.js(expr))
    await asyncio.sleep(3)
    report(await s.js(SNAP_JS), "after paste")

    # type via CDP so ProseMirror sees real input events
    await s.call("Input.insertText", text=prompt)
    await asyncio.sleep(1.5)
    after = await s.js(SNAP_JS)
    report(after, "after typing")
    await s.shot(ROOT / "data/inbox/send_probe.png")

    await close(s, task)


asyncio.run(main())
