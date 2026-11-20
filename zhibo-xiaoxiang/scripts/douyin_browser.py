"""Read a Douyin live room's chat by tapping the browser's own IM traffic.

    python scripts/douyin_browser.py --room YOUR_ROOM_ID
    python run.py --source external          # in another terminal

Then close the browser window whenever you want it to stop.

Why this exists: `app/platforms/douyin.py` speaks the old webcast IM
WebSocket, which the current Douyin web client no longer opens. The page now
long-polls `GET /webcast/im/fetch/` instead, and every poll carries an
`a_bogus` anti-bot signature produced by obfuscated JS. Recomputing that
offline is a losing game, and it expires within hours.

So we don't. A real Chrome does the fetching (it signs and carries the
cookies), an XHR hook copies each protobuf response into `window.__imFrames`,
and this script drains that array over CDP, decodes it with the parsers that
already live in `app/platforms/douyin.py`, and re-broadcasts the events as
plain JSON on a local WebSocket. `--source external` then consumes them like
any other bridge -- Douyin protocol changes only ever touch this file.
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import httpx
import websockets

from app.platforms.douyin import decode_frame, field_dict, _s, parse_message

CHROME_CANDIDATES = (
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
)

# Runs before any page script. Both transports are hooked because Douyin has
# switched between fetch and XHR before; whichever it uses, we catch it.
HOOK = r"""
(() => {
  if (window.__imHooked) return;
  window.__imHooked = 1;
  window.__imFrames = [];
  window.__imErr = '';

  function b64(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  function take(xhr) {
    xhr.addEventListener('load', function () {
      try {
        var r = xhr.response;
        if (r instanceof ArrayBuffer) return window.__imFrames.push(b64(r));
        if (r && r.buffer instanceof ArrayBuffer) return window.__imFrames.push(b64(r.buffer));
        if (typeof r === 'string' && r.length) {
          var b = new Uint8Array(r.length);
          for (var i = 0; i < r.length; i++) b[i] = r.charCodeAt(i) & 0xff;
          window.__imFrames.push(b64(b));
        }
      } catch (e) { window.__imErr = String(e); }
    });
  }
  var xo = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) {
    if (String(u).indexOf('/webcast/im/fetch/') >= 0) take(this);
    return xo.apply(this, arguments);
  };

  var of = window.fetch;
  window.fetch = function (input) {
    var url = (typeof input === 'string') ? input : ((input && input.url) || '');
    var p = of.apply(this, arguments);
    if (url.indexOf('/webcast/im/fetch/') >= 0) {
      p.then(function (r) {
        r.clone().arrayBuffer().then(function (b) { window.__imFrames.push(b64(b)); })
                          .catch(function () {});
      }).catch(function () {});
    }
    return p;
  };
})();
"""


# ------------------------------------------------------------------ args
def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser()
    ap.add_argument("room", nargs="?", default="",
                    help="直播间地址或房间号，如 https://live.douyin.com/YOUR_ROOM_ID")
    ap.add_argument("--room", dest="room_opt", default="", help="同上（显式写法）")
    ap.add_argument("--port", type=int, default=9000, help="给 run.py --source external 的端口")
    ap.add_argument("--cdp-port", type=int, default=9223, help="Chrome 调试端口")
    ap.add_argument("--show", action="store_true", help="显示浏览器窗口（排查用）")
    ap.add_argument("--debug", action="store_true", help="打印每一帧和所有消息类型")
    ap.add_argument("--profile", default="", help="Chrome profile 目录（默认 <仓库>/.chrome-douyin）")
    ap.add_argument("--login", action="store_true",
                    help="打开抖音让扫码登录，登录态存进 profile，之后不用再登")
    a = ap.parse_args()
    room = (a.room_opt or a.room).strip()
    if not room and not a.login:
        ap.error("请给出直播间地址或房间号")
    if not room:
        a.room = ""
    else:
        m = re.search(r"live\.douyin\.com/(\d+)", room)
        a.room = m.group(1) if m else room.rstrip("/").split("?")[0]
    return a


def find_chrome() -> str:
    for p in CHROME_CANDIDATES:
        if Path(p).exists():
            return p
    raise SystemExit("找不到 Chrome，请用 --chrome 指定路径")


# ------------------------------------------------------------------ chrome
class Chrome:
    def __init__(self, exe: str, cdp_port: int, show: bool, profile: str = ""):
        self.exe, self.cdp_port, self.show = exe, cdp_port, show
        # A logged-in profile is the whole trick: Douyin only pushes chat to a
        # session that carries a real login cookie. Anonymous IM polls come
        # back 0 bytes, which looks exactly like "the room is empty".
        self.profile = profile
        self.proc: subprocess.Popen | None = None
        self.ws = None
        self._id = 0
        self._pending: dict[int, asyncio.Future] = {}
        self._reader_task = None

    async def start(self) -> None:
        if not self.profile:
            base = os.environ.get("DY_PROFILE_DIR") or str(ROOT)
            self.profile = str(Path(base) / ".chrome-douyin")
        Path(self.profile).mkdir(parents=True, exist_ok=True)
        args = [self.exe,
                *( [] if self.show else ["--headless=new", "--disable-gpu"] ),
                "--mute-audio", "--hide-scrollbars", "--no-first-run",
                "--no-default-browser-check",
                "--disable-blink-features=AutomationControlled",
                "--autoplay-policy=no-user-gesture-required",
                f"--remote-debugging-port={self.cdp_port}",
                f"--user-data-dir={self.profile}",
                "--window-size=1280,900", "about:blank"]
        self.proc = subprocess.Popen(args, stdout=subprocess.DEVNULL,
                                     stderr=subprocess.DEVNULL)

        target = None
        for _ in range(100):
            try:
                async with httpx.AsyncClient() as c:
                    tabs = (await c.get(f"http://127.0.0.1:{self.cdp_port}/json",
                                        timeout=1)).json()
                target = next((t for t in tabs if t["type"] == "page"), None)
                if target:
                    break
            except Exception:
                pass
            await asyncio.sleep(0.3)
        if not target:
            raise SystemExit("Chrome 没起来（CDP 连不上）")

        self.ws = await websockets.connect(target["webSocketDebuggerUrl"],
                                           max_size=128 << 20,
                                           ping_interval=None)
        self._reader_task = asyncio.create_task(self._read())

    async def _read(self) -> None:
        async for raw in self.ws:
            m = json.loads(raw)
            if "id" in m and not m.get("sessionId"):
                fut = self._pending.pop(m["id"], None)
                if fut and not fut.done():
                    fut.set_result(m.get("result") or {})

    async def call(self, method: str, **params):
        self._id += 1
        fut = asyncio.get_running_loop().create_future()
        self._pending[self._id] = fut
        await self.ws.send(json.dumps({"id": self._id, "method": method,
                                       "params": params}))
        return await asyncio.wait_for(fut, 60)

    async def open_room(self, room: str) -> None:
        await self.call("Page.enable")
        await self.call("Runtime.enable")
        await self.call("Page.addScriptToEvaluateOnNewDocument", source=HOOK)
        await self.call("Page.navigate", url=f"https://live.douyin.com/{room}")

    async def drain(self) -> list[bytes]:
        """Take every frame the hook has buffered since the last call."""
        r = await self.call("Runtime.evaluate", returnByValue=True,
                            expression="JSON.stringify((window.__imFrames||[]).splice(0))")
        val = (r.get("result") or {}).get("value") or "[]"
        # The page may have navigated away and lost our hook.
        if val == "null":
            return []
        try:
            b64s = json.loads(val)
        except Exception:
            return []
        out = []
        for s in b64s:
            try:
                out.append(base64.b64decode(s))
            except Exception:
                pass
        return out

    async def alive(self) -> bool:
        if self.proc is None or self.proc.poll() is not None:
            return False
        try:
            await self.call("Runtime.evaluate", expression="1")
            return True
        except Exception:
            return False

    def close(self) -> None:
        if self._reader_task:
            self._reader_task.cancel()
        if self.ws:
            try:
                asyncio.create_task(self.ws.close())
            except Exception:
                pass
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()


# ------------------------------------------------------------------ decode
def frames_to_events(raw: bytes, debug: bool = False) -> list[dict]:
    """PushFrame bytes -> list of normalised events (same shape as external.py)."""
    response, _ = decode_frame(raw)
    if not response:
        if debug:
            print(f"    frame {len(raw)}B -> 解不出 Response（空帧）")
        return []
    events = []
    if debug:
        top = field_dict(response)
        print(f"    frame {len(raw)}B -> Response {len(response)}B, "
              f"messages={len(top.get(1, []))}, fields={sorted(top)}")
    for msg in field_dict(response).get(1, []):
        md = field_dict(msg)
        method = _s(md.get(1, [b""])[0])
        payload = md.get(2, [b""])[0]
        if debug and method:
            print(f"    msg {method} {len(payload)}B")
        ev = parse_message(method, payload)
        if ev:
            events.append(ev)
    return events


# ------------------------------------------------------------------ main
async def main() -> int:
    a = parse_args()
    clients: set = set()

    async def handler(ws, *_):
        # websockets 13 still passes (websocket, path) from the legacy server,
        # while the newer asyncio server passes only the websocket.
        clients.add(ws)
        peer = getattr(ws, "remote_address", None)
        print(f"[bridge] run.py 已接入 {peer}")
        try:
            await ws.wait_closed()
        finally:
            clients.discard(ws)
            print("[bridge] run.py 断开")

    async def broadcast(ev: dict) -> None:
        if not clients:
            return
        msg = json.dumps(ev, ensure_ascii=False)
        for ws in list(clients):
            try:
                await ws.send(msg)
            except Exception:
                clients.discard(ws)

    chrome = Chrome(find_chrome(), a.cdp_port, a.show or a.login, a.profile)
    await chrome.start()

    if a.login:
        await chrome.call("Page.enable")
        await chrome.call("Page.navigate", url="https://www.douyin.com/")
        print(f"[login] 登录态目录: {chrome.profile}")
        print("[login] 在弹出的窗口里扫码/登录抖音，登录成功后直接 Ctrl+C 结束本进程。")
        print("[login] 之后跑采集器会复用这个 profile，不用再登。")
        try:
            while True:
                await asyncio.sleep(1)
                if chrome.proc.poll() is not None:
                    print("[login] 浏览器已关闭；若已登录，profile 已保存。")
                    return 0
        except KeyboardInterrupt:
            print("[login] 已结束，profile 保留。")
            return 0
        finally:
            chrome.close()

    print(f"[bridge] 房间 {a.room}，浏览器监听 ws://127.0.0.1:{a.port}")
    await chrome.open_room(a.room)
    print("[bridge] 已打开直播间，等待 IM 流量…（Ctrl+C 结束）")

    frames = events = 0
    idle_polls = 0
    last_report = time.time()

    try:
        while True:
            await asyncio.sleep(0.4)
            try:
                batch = await chrome.drain()
            except Exception as e:
                if not await chrome.alive():
                    print(f"[bridge] 浏览器没了（{e}），重开…")
                    chrome.close()
                    chrome = Chrome(find_chrome(), a.cdp_port, a.show)
                    await chrome.start()
                    await chrome.open_room(a.room)
                    await asyncio.sleep(3)
                continue

            if not batch:
                idle_polls += 1
                # Hook lost after an in-page navigation: put it back.
                if idle_polls % 150 == 0:
                    try:
                        await chrome.call("Page.addScriptToEvaluateOnNewDocument",
                                          source=HOOK)
                    except Exception:
                        pass
                    print(f"[bridge] 已持续 {idle_polls * 0.4:.0f}s 没收到帧，"
                          f"确认直播间是否在开播")
                continue

            idle_polls = 0
            for raw in batch:
                frames += 1
                for ev in frames_to_events(raw, debug=a.debug):
                    events += 1
                    kind = ev.get("type")
                    nick = ev.get("nickname", "")
                    extra = ev.get("content") or ev.get("gift") or ""
                    print(f"[bridge] {kind:6} {nick} {extra}"[:160])
                    await broadcast(ev)

            if a.debug and time.time() - last_report > 20:
                print(f"[bridge] 累计 {frames} 帧 / {events} 事件 / "
                      f"{len(clients)} 个下行连接")
                last_report = time.time()
    except KeyboardInterrupt:
        pass
    finally:
        chrome.close()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except KeyboardInterrupt:
        pass
