"""Doubao web -> line drawing -> trim the stamp -> push into the live queue.

Pieces that took trial and error to get right
---------------------------------------------
* Upload.  Doubao's composer is a tiptap editor; DOM.setFileInputFiles and
  synthetic drop events are both ignored. A synthetic ClipboardEvent carrying a
  real File does work, because it hits the same handler as Ctrl+V.
* Grab.  The finished picture is an <img> whose src contains `rc_gen_image`.
  Fetching it from inside the page keeps the cookies and signature the CDN
  wants, and the 1536px original is there rather than the 384px preview.
* Stamp.  Doubao burns "豆包 AI 生成" into the bottom-right. Our tracer turns
  every non-white pixel into pen strokes, so the stamp must go -- we paint the
  flat grey text out instead of cropping the frame.

Usage
-----
    python scripts/doubao_grab.py --login                 # once, keeps cookies
    python scripts/doubao_grab.py --prompt-file prompts/lineart.txt
    python scripts/doubao_grab.py --avatar data/samples/test01.jpg \
        --prompt-file prompts/lineart.txt --supply --nick 橘子汽水
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import json
import subprocess
import sys
import time
from pathlib import Path

import httpx
import websockets

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.pipeline.watermark import erase_watermark_file  # noqa: E402

_STYLES = None


def _styles():
    """config.yaml 的 styles 段，延迟加载一次就缓存。"""
    global _STYLES
    if _STYLES is None:
        from app.config import load
        from app.pipeline.styles import Styles
        _STYLES = Styles(load().get("styles"), ROOT)
    return _STYLES

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]
PROFILE = ROOT / ".chrome-doubao"
PORT = 9222
DOUBAO = "https://www.doubao.com/chat/"
INBOX = ROOT / "data" / "inbox"


# --------------------------------------------------------------- CDP plumbing
class CDP:
    def __init__(self, ws):
        self.ws = ws
        self._id = 0
        self._pending: dict[int, asyncio.Future] = {}

    async def reader(self):
        async for raw in self.ws:
            m = json.loads(raw)
            if "id" in m:
                fut = self._pending.pop(m["id"], None)
                if fut and not fut.done():
                    fut.set_result(m.get("result") or {})

    async def call(self, method: str, **params) -> dict:
        self._id += 1
        mid = self._id
        fut = asyncio.get_running_loop().create_future()
        self._pending[mid] = fut
        await self.ws.send(json.dumps({"id": mid, "method": method, "params": params}))
        return await asyncio.wait_for(fut, timeout=120)

    async def js(self, expression: str):
        r = await self.call("Runtime.evaluate", expression=expression,
                            returnByValue=True, awaitPromise=True)
        res = r.get("result") or {}
        if res.get("subtype") == "error":
            print("  ! JS:", (res.get("description") or "")[:200])
        return res.get("value")


def find_chrome() -> str:
    for p in CHROME_CANDIDATES:
        if Path(p).exists():
            return p
    raise SystemExit("找不到 Chrome，请改 CHROME_CANDIDATES")


async def list_tabs() -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=2) as c:
            return (await c.get(f"http://127.0.0.1:{PORT}/json")).json()
    except Exception:
        return []


async def ensure_browser(headless: bool = False) -> dict:
    tabs = await list_tabs()
    if tabs:
        print(f"复用已开的浏览器 (port {PORT})")
    else:
        PROFILE.mkdir(parents=True, exist_ok=True)
        args = [find_chrome(), f"--remote-debugging-port={PORT}",
                f"--user-data-dir={PROFILE}", "--no-first-run",
                "--no-default-browser-check",
                "--disable-blink-features=AutomationControlled", DOUBAO]
        if headless:
            args.insert(1, "--headless=new")
        subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"启动 Chrome (port {PORT}, profile {PROFILE.name})")
        for _ in range(100):
            await asyncio.sleep(0.3)
            tabs = await list_tabs()
            if tabs:
                break
    page = next((t for t in tabs if t.get("type") == "page"), None)
    if not page:
        raise SystemExit("浏览器里没有可用标签页")
    return page


# --------------------------------------------------------------- page scripts
NEW_CHAT_JS = """
(() => {
  const items = [...document.querySelectorAll('button,[role="button"],a,div')];
  for (const e of items) {
    const t = (e.innerText || '').trim();
    if (t.startsWith('新对话') && e.offsetParent !== null) { e.click(); return 'ok'; }
  }
  return 'none';
})()
"""

EDITOR_READY_JS = """
(() => {
  const ed = [...document.querySelectorAll('[contenteditable="true"]')]
    .filter(e => e.offsetParent !== null).length;
  return {ed, locked: document.body.innerText.includes('扫码登录')};
})()
"""

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
  ed.dispatchEvent(new ClipboardEvent('paste',
    {clipboardData: dt, bubbles: true, cancelable: true}));
  return 'pasted:' + file.size;
})()
"""

ATTACHED_JS = """
(() => {
  const imgs = [...document.querySelectorAll('img')]
    .filter(e => e.src.startsWith('blob:') && e.naturalWidth >= 80);
  return imgs.length;
})()
"""

SEND_BTN_JS = """
(() => {
  // The button only exists once the composer has content -- that is also the
  // only reliable "ready to send" signal we get.
  const b = document.querySelector('[data-testid="chat_input_send_button"]');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return null;
  return {x: r.x + r.width / 2, y: r.y + r.height / 2, disabled: !!b.disabled};
})()
"""

SENT_JS = """
(() => {
  const ed = [...document.querySelectorAll('[contenteditable="true"]')]
    .filter(e => e.offsetParent !== null).pop();
  const txt = ed ? ed.innerText.trim() : '';
  const imgs = [...document.querySelectorAll('img')]
    .filter(e => e.src.startsWith('blob:') && e.naturalWidth >= 80).length;
  return {len: txt.length, attached: imgs,
          btn: !!document.querySelector('[data-testid="chat_input_send_button"]')};
})()
"""

RESULT_JS = """
(() => {
  const imgs = [...document.querySelectorAll('img')].filter(e => /rc_gen_image/.test(e.src));
  if (!imgs.length) {
    const t = document.body ? document.body.innerText : '';
    const failed = t.includes('生成失败') || t.includes('无法生成');
    const busy = t.includes('正在生成');
    return {state: failed ? 'failed' : (busy ? 'busy' : 'waiting'), w: 0};
  }
  const best = imgs.reduce((a, b) => (b.naturalWidth > a.naturalWidth ? b : a));
  return {state: best.naturalWidth >= 500 ? 'done' : 'loading',
          w: best.naturalWidth, h: best.naturalHeight, n: imgs.length};
})()
"""

PULL_JS = """
(async () => {
  const imgs = [...document.querySelectorAll('img')].filter(e => /rc_gen_image/.test(e.src));
  if (!imgs.length) return {ok: false, reason: 'none'};
  const best = imgs.reduce((a, b) => (b.naturalWidth > a.naturalWidth ? b : a));
  try {
    const r = await fetch(best.src);
    const buf = new Uint8Array(await r.arrayBuffer());
    let s = '';
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      s += String.fromCharCode.apply(null, buf.subarray(i, i + chunk));
    }
    return {ok: true, b64: btoa(s), w: best.naturalWidth, h: best.naturalHeight,
            src: best.src};
  } catch (e) {
    return {ok: false, reason: String(e)};
  }
})()
"""


async def focus_editor(cdp: CDP) -> bool:
    box = await cdp.js("""
    (() => {
      const cands = [...document.querySelectorAll('textarea, [contenteditable="true"]')]
        .filter(e => e.offsetParent !== null);
      if (!cands.length) return null;
      const el = cands[cands.length - 1];
      el.focus();
      const r = el.getBoundingClientRect();
      return [r.x + r.width / 2, r.y + r.height / 2];
    })()
    """)
    if not box:
        return False
    await cdp.call("Input.dispatchMouseEvent", type="mousePressed", x=box[0],
                   y=box[1], button="left", clickCount=1)
    await cdp.call("Input.dispatchMouseEvent", type="mouseReleased", x=box[0],
                   y=box[1], button="left", clickCount=1)
    return True


async def fill_and_send(cdp: CDP, text: str, timeout: float = 25) -> bool:
    """Type the prompt, then press the send button.

    Enter is not enough: Doubao's tiptap composer ignores a synthetic Enter
    keydown, and the send button only appears once the composer has content,
    so the button is both the trigger and the readiness check.
    """
    if not await focus_editor(cdp):
        print("  ! 找不到输入框")
        return False
    await cdp.call("Input.insertText", text=text)

    btn = None
    t0 = time.time()
    while time.time() - t0 < timeout:
        await asyncio.sleep(0.4)
        btn = await cdp.js(SEND_BTN_JS)
        if btn:
            break
    if not btn:
        print("  ! 发送按钮一直没出现")
        return False

    await asyncio.sleep(0.4)
    await cdp.call("Input.dispatchMouseEvent", type="mousePressed", x=btn["x"],
                   y=btn["y"], button="left", clickCount=1)
    await cdp.call("Input.dispatchMouseEvent", type="mouseReleased", x=btn["x"],
                   y=btn["y"], button="left", clickCount=1)

    # Confirm it actually went out instead of assuming: the composer clears and
    # the attachment chip disappears.
    for _ in range(12):
        await asyncio.sleep(0.5)
        st = await cdp.js(SENT_JS) or {}
        if not st.get("btn") and st.get("len", 1) == 0 and not st.get("attached"):
            return True
    print("  ! 消息可能没有发出去")
    return False


async def paste_image(cdp: CDP, path: Path, timeout: float = 25) -> bool:
    mime = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    b64 = base64.b64encode(path.read_bytes()).decode()
    before = await cdp.js(ATTACHED_JS) or 0
    expr = (PASTE_JS.replace("B64", json.dumps(b64))
                    .replace("NAME", json.dumps(path.name))
                    .replace("MIME", json.dumps(mime)))
    r = await cdp.js(expr)
    if not isinstance(r, str) or not r.startswith("pasted"):
        print(f"  ! 粘贴失败: {r}")
        return False
    t0 = time.time()
    while time.time() - t0 < timeout:
        await asyncio.sleep(0.5)
        now = await cdp.js(ATTACHED_JS) or 0
        if now > before:
            print(f"  + 参考图就位 ({(time.time()-t0):.1f}s)")
            await asyncio.sleep(0.6)
            return True
    print("  ! 参考图未出现在输入框，继续尝试")
    return False


async def new_chat(cdp: CDP) -> None:
    """Fresh session so the previous answer's image cannot be mistaken for ours."""
    url = (await cdp.js("location.href") or "").split("?")[0].rstrip("/")
    fresh = url.endswith("/chat")
    if not fresh:
        await cdp.call("Page.navigate", url=DOUBAO)
    t0 = time.time()
    while time.time() - t0 < 40:
        await asyncio.sleep(0.5)
        st = await cdp.js(EDITOR_READY_JS) or {}
        if st.get("ed"):
            await asyncio.sleep(1.0)
            return
    print("  ! 新会话加载超时")


async def pull_image(cdp: CDP, out: Path, name: str) -> tuple[Path, float, int, int]:
    v = await cdp.js(PULL_JS)
    if not v or not v.get("ok"):
        raise RuntimeError(f"取图失败 {v}")
    raw = base64.b64decode(v["b64"])
    dst = out / name
    dst.write_bytes(raw)
    hit = erase_watermark_file(dst)
    return dst, len(raw) / 1024.0, v.get("w", 0), v.get("h", 0), hit


async def supply(path: Path, nickname: str, tier: str, api: str,
                 style: str = "", gift: str = "") -> None:
    params = {"nickname": nickname}
    if tier:
        params["tier"] = tier
    if style:
        params["style"] = style
    if gift:
        params["gift"] = gift
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{api}/api/supply", params=params,
                         content=path.read_bytes(),
                         headers={"content-type": "application/octet-stream"})
    print("  -> 入队:", r.status_code, r.text[:160])


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt", default="")
    ap.add_argument("--prompt-file", default="",
                    help="UTF-8 文件读提示词（命令行中文在 Windows 会乱码）")
    ap.add_argument("--avatar", default="")
    ap.add_argument("--count", type=int, default=1, help="连画几张")
    ap.add_argument("--out", default=str(INBOX))
    ap.add_argument("--timeout", type=float, default=240, help="单张等待上限（秒）")
    ap.add_argument("--login", action="store_true")
    ap.add_argument("--headless", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--supply", action="store_true")
    ap.add_argument("--nick", default="豆包测试")
    ap.add_argument("--tier", default="sketch",
                    help="simple|sketch|color|fine —— 只决定入队档位和时长")
    ap.add_argument("--style", default="",
                    help="画种：素描|动漫|沙画|水粉（也接受 sketch/anime/sand/gouache）。"
                         "优先级：--prompt > --prompt-file > --style > --gift > --tier")
    ap.add_argument("--gift", default="",
                    help="礼物名，用 config.yaml 的 gift_map 反查画种")
    ap.add_argument("--api", default="http://127.0.0.1:8848")
    ap.add_argument("--keep", action="store_true")
    args = ap.parse_args()

    out = Path(args.out)
    if not out.is_absolute():
        out = ROOT / out
    out.mkdir(parents=True, exist_ok=True)

    page = await ensure_browser(headless=args.headless and not args.login)
    ws = await websockets.connect(page["webSocketDebuggerUrl"], max_size=128 << 20)
    cdp = CDP(ws)
    reader = asyncio.create_task(cdp.reader())
    await cdp.call("Page.enable")
    await cdp.call("Runtime.enable")

    if args.login:
        print("\n浏览器已打开豆包。请在窗口里手动登录，完成后 Ctrl+C。")
        print(f"登录信息保存在 {PROFILE.name}\\ ，下次不用再登。\n")
        try:
            while True:
                await asyncio.sleep(5)
        except KeyboardInterrupt:
            pass
        reader.cancel()
        await ws.close()
        return 0

    st: dict = {}
    t0 = time.time()
    while time.time() - t0 < 45:
        st = await cdp.js(EDITOR_READY_JS) or {}
        if st.get("ed") or st.get("locked"):
            break
        await asyncio.sleep(0.5)
    if st.get("locked") or not st.get("ed"):
        print("!! 尚未登录。先跑：python scripts/doubao_grab.py --login")
        reader.cancel()
        await ws.close()
        return 3

    # 画种：--style / --gift 显式给了才用 prompts/style_*.txt；
    # 都没给就退回老的四档提示词（prompts/{tier}.txt），保持旧命令可用。
    style_raw = args.style or args.gift
    style_key = ""
    style_prompt = ""
    if style_raw:
        st = _styles()
        style_key = st.resolve(style_raw)
        style_prompt = st.prompt(style_key)

    prompt = args.prompt
    if args.prompt_file:
        pf = Path(args.prompt_file)
        if not pf.is_absolute():
            pf = ROOT / pf
        prompt = pf.read_text(encoding="utf-8").strip()
    if not prompt and style_prompt:
        prompt = style_prompt
    if not prompt:
        # Each gift tier gets its own art direction -- that is what makes a 1
        # yuan sketch look different from a 50 yuan one.
        pf = ROOT / "prompts" / f"{args.tier}.txt"
        if pf.exists():
            prompt = pf.read_text(encoding="utf-8").strip()
    prompt = prompt or ("把这张照片画成极简黑墨线稿：纯黑单线、纯白背景、"
                        "不要阴影、不要灰度、不要背景元素、保留发型和五官")
    label = f"{_styles().name(style_key)}/{style_key}" if style_key else args.tier
    print(f"画风: {label} ({len(prompt)} 字提示词)")

    avatar = None
    if args.avatar:
        avatar = Path(args.avatar)
        if not avatar.is_absolute():
            avatar = ROOT / avatar

    saved: list[Path] = []
    for round_no in range(1, args.count + 1):
        t_round = time.time()
        print(f"\n=== 第 {round_no}/{args.count} 张 ===")
        await new_chat(cdp)

        t0 = time.time()
        if avatar:
            await paste_image(cdp, avatar)
        t_up = time.time() - t0

        t0 = time.time()
        if not await fill_and_send(cdp, prompt):
            print("  ! 发送失败，跳过本轮")
            break
        print(f"  提示词已发送 (上传 {t_up:.1f}s)")
        t_send = time.time()

        state, waited = "waiting", 0.0
        while time.time() - t_send < args.timeout:
            await asyncio.sleep(1.0)
            st = await cdp.js(RESULT_JS) or {}
            waited = time.time() - t_send
            if args.verbose:
                print(f"    [{waited:5.1f}s] {st}")
            if st.get("state") == "done":
                state = "done"
                break
            if st.get("state") == "failed":
                state = "failed"
                break
        print(f"  生成 {'完成' if state == 'done' else state} 用时 {waited:.1f}s")

        if state != "done":
            continue

        stamp = time.strftime("%m%d_%H%M%S")
        name = f"{stamp}_{round_no}.png"
        t0 = time.time()
        try:
            dst, kb, w, h, hit = await pull_image(cdp, out, name)
            print(f"  ✓ {dst.name}  {kb:.0f}KB  {w}x{h}  去水印={hit}  "
                  f"总耗时 {time.time()-t_round:.1f}s")
            saved.append(dst)
        except Exception as e:
            print(f"  ! {e}")
            continue

        if args.supply:
            await supply(dst, args.nick, args.tier, args.api,
                         style=style_key, gift=args.gift)

    if saved:
        (out / "last.json").write_text(json.dumps(
            [{"file": str(p), "ts": time.time()} for p in saved],
            ensure_ascii=False, indent=2), encoding="utf-8")

    reader.cancel()
    if not args.keep and not args.login:
        try:
            await cdp.call("Browser.close")
        except Exception:
            pass
    await ws.close()
    return 0 if saved else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
