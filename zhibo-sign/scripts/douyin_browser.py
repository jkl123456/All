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
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import httpx
import websockets

from app.config import load as load_cfg
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
  window.__imStat = {chunk: 0, load: 0, progress: 0};

  function b64(buf) {
    var b = new Uint8Array(buf), s = '', CH = 0x8000;
    for (var i = 0; i < b.length; i += CH) {
      s += String.fromCharCode.apply(null, b.subarray(i, i + CH));
    }
    return btoa(s);
  }
  function push(buf) {
    if (buf && buf.byteLength) { window.__imFrames.push(b64(buf)); return true; }
    return false;
  }

  /* ---- 流式 fetch：响应体是 ReadableStream，必须一段一段读。
     以前这里是 r.clone().arrayBuffer()，它会一直等到流关闭才返回，
     而直播间的 IM 流是长连接——等于永远拿不到第二帧。 */
  function pump(reader) {
    reader.read().then(function (res) {
      if (res.done) return;
      if (push(res.value)) window.__imStat.chunk++;
      pump(reader);
    }).catch(function (e) { window.__imErr = String(e); });
  }

  var of = window.fetch;
  window.fetch = function (input) {
    var url = (typeof input === 'string') ? input : ((input && input.url) || '');
    var p = of.apply(this, arguments);
    if (String(url).indexOf('/webcast/im/fetch/') >= 0) {
      p.then(function (r) {
        try {
          var c = r.clone();
          if (c.body && c.body.getReader) return pump(c.body.getReader());
          c.arrayBuffer().then(function (b) {
            if (push(b)) window.__imStat.load++;
          }).catch(function () {});
        } catch (e) { window.__imErr = String(e); }
      }).catch(function () {});
    }
    return p;
  };

  /* ---- XHR：老路子，仍然是"整包到达"语义，但补一个 progress 兜底
     （responseType=arraybuffer 时 progress 里能拿到已经收到的部分）。 */
  function take(xhr) {
    var seen = 0, got = 0;
    xhr.addEventListener('progress', function () {
      try {
        var r = xhr.response;
        if (r instanceof ArrayBuffer && r.byteLength > seen) {
          var fresh = r.slice(seen);
          seen = r.byteLength;
          if (push(fresh)) { got++; window.__imStat.progress++; }
        }
      } catch (e) { window.__imErr = String(e); }
    });
    xhr.addEventListener('load', function () {
      if (got) return;                      // progress 已经交过货，别重复
      try {
        var r = xhr.response;
        if (push(r instanceof ArrayBuffer ? r : (r && r.buffer ? r.buffer : null))) {
          window.__imStat.load++;
        } else if (typeof r === 'string' && r.length) {
          var b = new Uint8Array(r.length);
          for (var i = 0; i < r.length; i++) b[i] = r.charCodeAt(i) & 0xff;
          if (push(b)) window.__imStat.load++;
        }
      } catch (e) { window.__imErr = String(e); }
    });
  }
  var xo = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) {
    if (String(u).indexOf('/webcast/im/fetch/') >= 0) take(this);
    return xo.apply(this, arguments);
  };
})();
"""


# ------------------------------------------------------------------ args
def normalize_room(text: str) -> str:
    """把「直播间地址 / 带参数的链接 / 纯房间号」统一成房间号。

    后台那个输入框是给人贴的，所以什么形式都得认：
        https://live.douyin.com/YOUR_ROOM_ID?camera_id=0  -> YOUR_ROOM_ID
        live.douyin.com/YOUR_ROOM_ID/                     -> YOUR_ROOM_ID
        YOUR_ROOM_ID                                      -> YOUR_ROOM_ID
    """
    t = (text or "").strip()
    if not t:
        return ""
    m = re.search(r"live\.douyin\.com/([A-Za-z0-9_-]+)", t)
    if m:
        return m.group(1)
    m = re.search(r"(\d{5,})", t)
    if m:
        return m.group(1)
    return t.rstrip("/").split("?")[0].split("&")[0]


# 抖音的"长时间无操作，已暂停播放"遮罩。
# 一出现，视频停、IM 轮询也跟着停，弹幕就断了（表现：直播间明明有人说话，
# 采集器却一条都不来）。每几秒戳一次页面，见到就点"继续播放"。
#
# 几个必须守住的点：
# * **只认文字，不认 class**。遮罩的 class 是哈希过的（tp31AxZe / JL05k7eS 这种），
#   每次发版都变；"继续播放"四个字不会变。同理"已暂停播放"用来判断状态。
# * **绝不点"使用客户端免弹窗"**。那个会去唤起/下载抖音客户端，点了直播间就废了。
#   所以匹配用 innerText 全等，而不是"包含"。
# * 点不到按钮就退一步直接 `video.play()`——遮罩是 Vue 组件，偶尔点了没反应，
#   但浏览器的播放状态是实的。
# * 没暂停的时候也发一个合成 mousemove，把"无操作"的计时器按住，尽量不让它弹。
KEEPALIVE_JS = r"""
(() => {
  const out = {resumed: 0, why: ""};
  const body = document.body ? (document.body.innerText || "") : "";
  const paused = body.includes("长时间无操作") || body.includes("已暂停播放");

  if (!paused) {
    // 页面正常，轻轻动一下鼠标，别让计时器攒到阈值
    try { document.dispatchEvent(new MouseEvent("mousemove", {bubbles: true})); } catch (e) {}
    return out;
  }

  const nodes = document.querySelectorAll("div,span,button,a,p");
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    const t = (el.innerText || "").trim();          // innerText 对隐藏元素是空串
    if (t !== "继续播放") continue;                  // 全等：别误点"使用客户端免弹窗"
    const r = el.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) continue;
    try { el.click(); out.resumed = 1; out.why = "click"; break; } catch (e) {}
  }

  if (!out.resumed) {
    const v = document.querySelector("video");
    if (v) {
      try { v.muted = false; } catch (e) {}
      if (v.paused) {
        v.play().then(() => {}).catch(() => {});
        out.resumed++; out.why = "video.play";
      }
    }
  }
  return out;
})()
"""


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser()
    ap.add_argument("room", nargs="?", default="",
                    help="直播间地址或房间号，如 https://live.douyin.com/YOUR_ROOM_ID")
    ap.add_argument("--room", dest="room_opt", default="", help="同上（显式写法）")
    ap.add_argument("--port", type=int, default=9000, help="给 run.py --source external 的端口")
    ap.add_argument("--ctl-port", type=int, default=0,
                    help="后台换直播间的控制端口（默认 = --port + 1，即 9001）")
    ap.add_argument("--cdp-port", type=int, default=9223, help="Chrome 调试端口")
    ap.add_argument("--show", action="store_true",
                    help="显示浏览器窗口（现在是默认行为，保留只为兼容老命令）")
    ap.add_argument("--headless", action="store_true",
                    help="无头模式。抖音会给无头浏览器回空 IM（0 字节），抓不到弹幕，"
                         "只有排查页面问题时才用")
    ap.add_argument("--debug", action="store_true", help="打印每一帧和所有消息类型")
    ap.add_argument("--profile", default="", help="Chrome profile 目录（默认 <仓库>/.chrome-douyin）")
    ap.add_argument("--dump", default="", help="把每帧原始字节存到这个目录（排查解码用）")
    ap.add_argument("--login", action="store_true",
                    help="打开抖音让扫码登录，登录态存进 profile，之后不用再登")
    a = ap.parse_args()
    # 默认必须有窗口：无头 Chrome 拿到的 /webcast/im/fetch/ 全是 0 字节，
    # 页面看着在播（video.readyState=4），弹幕一条不来。
    a.show = not a.headless
    room = (a.room_opt or a.room).strip()
    if not room and not a.login:
        # 没给就吃 config.yaml 里的 platform.external.room，
        # 这样日常开播只要 `python scripts/douyin_browser.py` 一句。
        room = str(((load_cfg().get("platform") or {}).get("external") or {})
                   .get("room") or "").strip()
        if not room:
            ap.error("请给出直播间地址或房间号（或在 config.yaml 的 "
                     "platform.external.room 里填好）")
        print(f"[bridge] 房间号取自 config.yaml：{room}")
    if not room:
        a.room = ""
    else:
        a.room = normalize_room(room)
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
        # 直播间现在的弹幕走 WebSocket（/webcast/im/push/v2/），XHR 只给到
        # 进房那一次的历史包。所以主通道改成 CDP 的 webSocketFrameReceived，
        # payloadData 是 base64，解开就是一个 PushFrame/Response。
        self.ws_frames: asyncio.Queue = asyncio.Queue(maxsize=2000)
        self.ws_urls: dict[str, str] = {}
        self.ws_stats = {"frames": 0, "bytes": 0}

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
                async with httpx.AsyncClient(trust_env=False) as c:
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

        # proxy=None：CDP 在 127.0.0.1 上，走系统 HTTP_PROXY 会 502。
        # websockets<14 没有这个参数，老版本就按原样连。
        try:
            self.ws = await websockets.connect(target["webSocketDebuggerUrl"],
                                               max_size=128 << 20,
                                               ping_interval=None, proxy=None)
        except TypeError:
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
                continue
            meth = m.get("method")
            p = m.get("params") or {}
            if meth == "Network.webSocketCreated":
                self.ws_urls[p.get("requestId", "")] = p.get("url", "")
            elif meth == "Network.webSocketFrameReceived":
                fr = p.get("response") or {}
                data = fr.get("payloadData") or ""
                if not data:
                    continue
                url = self.ws_urls.get(p.get("requestId", ""), "")
                if "webcast/im/push" not in url and "frontier" not in url:
                    continue
                try:
                    buf = base64.b64decode(data)
                except Exception:
                    continue
                self.ws_stats["frames"] += 1
                self.ws_stats["bytes"] += len(buf)
                if self.ws_frames.full():
                    try:
                        self.ws_frames.get_nowait()
                    except Exception:
                        pass
                try:
                    self.ws_frames.put_nowait(buf)
                except Exception:
                    pass

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
        await self.call("Network.enable")
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

    async def js(self, expression: str):
        """在页面里求值，返回 JS 的值（取不到就 None）。"""
        r = await self.call("Runtime.evaluate", expression=expression,
                            returnByValue=True, awaitPromise=True)
        res = r.get("result") or {}
        if res.get("subtype") == "error":
            print(f"[bridge] 页面 JS 出错: {(res.get('description') or '')[:120]}",
                  flush=True)
        return res.get("value")

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


# ------------------------------------------------------------------ 控制口
async def _ctl_handle(reader, writer, state: dict, switch_room, cx: list,
                      stat: dict) -> None:
    """一个只跑在本机 127.0.0.1 上的迷你 HTTP 口，给后台换直播间用。

    为什么不开个大框架：这里只有两个动作（查当前房间 / 换房间），
    asyncio.start_server 手写几十行就够，少一个依赖、也少一个要维护的端口转发。

        GET  /room              -> {"ok":true,"room":"YOUR_ROOM_ID","frames":..}
        POST /room {"room":"…"} -> 切换，粘整条 https://live.douyin.com/… 也行
    """
    try:
        try:
            head = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), timeout=10)
        except Exception:
            return
        lines = head.decode("latin-1").split("\r\n")
        try:
            method, path, _ = lines[0].split(" ")[:3]
        except ValueError:
            return
        hdrs = {}
        for ln in lines[1:]:
            if ":" in ln:
                k, v = ln.split(":", 1)
                hdrs[k.strip().lower()] = v.strip()
        try:
            n = int(hdrs.get("content-length") or 0)
        except ValueError:
            n = 0
        body = await reader.readexactly(n) if n else b""

        path = path.split("?")[0].rstrip("/") or "/room"

        if path != "/room":
            out = {"ok": False, "error": "只有 /room"}
            code = 404
        elif method.upper() == "GET":
            try:
                alive = await cx[0].alive()
            except Exception:
                alive = False
            out = {"ok": True, "room": state.get("room"),
                   "browser": alive, "frames": stat.get("frames"),
                   "events": stat.get("events")}
            code = 200
        elif method.upper() == "POST":
            try:
                d = json.loads(body.decode("utf-8") or "{}")
            except Exception:
                d = {}
            raw = str(d.get("room") or d.get("url") or "").strip()
            if not raw:
                out, code = {"ok": False, "error": "没给房间号"}, 400
            else:
                out = await switch_room(raw)
                code = 200 if out.get("ok") else 400
        else:
            out = {"ok": False, "error": "不支持的方法"}, 405

        payload = json.dumps(out, ensure_ascii=False).encode("utf-8")
        writer.write(b"HTTP/1.1 %d %s\r\n" % (code,
                     b"OK" if code == 200 else b"ERR"))
        writer.write(b"content-type: application/json; charset=utf-8\r\n")
        writer.write(b"content-length: %d\r\n" % len(payload))
        writer.write(b"connection: close\r\n\r\n")
        writer.write(payload)
        await writer.drain()
    except Exception as e:
        print(f"[bridge] 控制口异常: {type(e).__name__}: {e}")
    finally:
        try:
            writer.close()
        except Exception:
            pass


# ------------------------------------------------------------------ main
async def main() -> int:
    a = parse_args()
    clients: set = set()
    # run.py 断开期间收到的弹幕先存着，重连后补发——不然观众打的字就这么丢了，
    # 后台看着"接了直播却没人排队"。
    backlog: deque = deque(maxlen=50)
    # 当前直播间放在可变容器里：后台（run.py 的 /api/live）会通过控制口改它，
    # bridge_loop 每次重开浏览器也要读最新的房间号。
    state = {"room": a.room}

    async def handler(ws, *_):
        # websockets 13 still passes (websocket, path) from the legacy server,
        # while the newer asyncio server passes only the websocket.
        clients.add(ws)
        peer = getattr(ws, "remote_address", None)
        print(f"[bridge] run.py 已接入 {peer}")
        if backlog:
            print(f"[bridge] 补发断开期间的 {len(backlog)} 条事件")
            for ev in list(backlog):
                try:
                    await ws.send(json.dumps(ev, ensure_ascii=False))
                except Exception:
                    break
            backlog.clear()
        try:
            await ws.wait_closed()
        finally:
            clients.discard(ws)
            print("[bridge] run.py 断开（这段时间的弹幕先存着）")

    async def broadcast(ev: dict) -> None:
        if not clients:
            backlog.append(ev)
            return
        msg = json.dumps(ev, ensure_ascii=False)
        for ws in list(clients):
            try:
                await ws.send(msg)
            except Exception:
                clients.discard(ws)

    chrome = Chrome(find_chrome(), a.cdp_port, a.show or a.login, a.profile)
    # 用 1 元素列表持有，bridge_loop 里换浏览器（崩了重开）时控制口也能拿到新的
    cx = [chrome]
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

    print(f"[bridge] 房间 {state['room']}，浏览器监听 ws://127.0.0.1:{a.port}")
    await chrome.open_room(state["room"])
    print("[bridge] 已打开直播间，等待 IM 流量…（Ctrl+C 结束）")

    stat = {"frames": 0, "events": 0}
    idle_polls = 0
    last_report = time.time()

    async def switch_room(raw: str) -> dict:
        """换直播间：改当前房间 + 让 Chrome 导航过去，不用重启本进程。

        后台那个输入框贴的就是完整地址，所以先归一化成房间号；
        和当前一样就什么都不做（避免重复刷新把弹幕流打断）。
        """
        nonlocal idle_polls
        room = normalize_room(raw)
        if not room:
            return {"ok": False, "error": "解析不出房间号"}
        if room == state["room"]:
            return {"ok": True, "room": room, "changed": False}
        if not await cx[0].alive():
            print("[bridge] 浏览器不在，重开后再切房间")
            cx[0].close()
            cx[0] = Chrome(find_chrome(), a.cdp_port, a.show, a.profile)
            await cx[0].start()
        state["room"] = room
        await cx[0].open_room(room)
        # 上一间的残留帧要丢掉，否则新房间刚开会把旧房间的弹幕当成新的播一遍
        while not cx[0].ws_frames.empty():
            try:
                cx[0].ws_frames.get_nowait()
            except Exception:
                break
        cx[0].ws_urls.clear()
        cx[0].ws_stats.update({"frames": 0, "bytes": 0})
        idle_polls = 0
        print(f"[bridge] 已切到直播间 {room}（由后台下发）")
        return {"ok": True, "room": room, "changed": True}

    async def bridge_loop() -> None:
        nonlocal idle_polls, last_report
        last_keep = 0.0
        keep_hits = 0
        while True:
            chrome = cx[0]
            await asyncio.sleep(0.35)

            # 每 ~4 秒戳一下页面：抖音弹"长时间无操作，已暂停播放"时，
            # 视频和 IM 轮询一起停，弹幕就断了。见 KEEPALIVE_JS。
            now = time.time()
            if now - last_keep > 4.0:
                last_keep = now
                try:
                    r = await chrome.js(KEEPALIVE_JS)
                    if isinstance(r, dict) and r.get("resumed"):
                        keep_hits += 1
                        print(f"[bridge] 检测到暂停，已自动续播"
                              f"（{r.get('why')}），累计 {keep_hits} 次", flush=True)
                except Exception as e:
                    # 页面正在跳转之类，下一轮再来，别让续播把主循环搞挂
                    if a.debug:
                        print(f"[bridge] 续播检查失败: {type(e).__name__}: {e}")

            batch: list[bytes] = []

            # 主通道：CDP 抓直播间自己的 WebSocket 帧（弹幕实时都在这里）。
            while not chrome.ws_frames.empty():
                try:
                    batch.append(chrome.ws_frames.get_nowait())
                except Exception:
                    break

            # 备用通道：页面里的 XHR 钩子，主要给"进房那一下的历史包"。
            try:
                batch += await chrome.drain()
            except Exception as e:
                if not await chrome.alive():
                    print(f"[bridge] 浏览器没了（{e}），重开…")
                    chrome.close()
                    chrome = Chrome(find_chrome(), a.cdp_port, a.show, a.profile)
                    cx[0] = chrome
                    await chrome.start()
                    await chrome.open_room(state["room"])
                    await asyncio.sleep(3)
                continue

            if not batch:
                idle_polls += 1
                if idle_polls % 150 == 0:
                    try:
                        await chrome.call("Page.addScriptToEvaluateOnNewDocument",
                                          source=HOOK)
                    except Exception:
                        pass
                    print(f"[bridge] 已持续 {idle_polls * 0.35:.0f}s 没收到帧，"
                          f"确认直播间是否在开播（WS {chrome.ws_stats['frames']} 帧）")
                continue

            idle_polls = 0
            for raw in batch:
                stat["frames"] += 1
                if a.dump:
                    Path(a.dump).mkdir(parents=True, exist_ok=True)
                    (Path(a.dump) / f"f{int(time.time()*1000)}_{len(raw)}.bin").write_bytes(raw)
                for ev in frames_to_events(raw, debug=a.debug):
                    stat["events"] += 1
                    kind = ev.get("type")
                    nick = ev.get("nickname", "")
                    extra = ev.get("content") or ev.get("gift") or ""
                    print(f"[bridge] {kind:6} {nick} {extra}"[:160])
                    await broadcast(ev)

            if a.debug and time.time() - last_report > 20:
                print(f"[bridge] 累计 {stat['frames']} 帧 / {stat['events']} 事件 / "
                      f"{len(clients)} 个下行连接 / WS {chrome.ws_stats['frames']} 帧")
                last_report = time.time()

    try:
        ctl_port = int(a.ctl_port or (a.port + 1))
        # 这里才是给 run.py --source external 用的服务端：它是"桥"，主程序是客户端。
        # 同机再开一个极小的 HTTP 控制口，给后台那个「直播间」输入框换房间用——
        # 换间只需要 Page.navigate，不必重启桥、也不打断 run.py 那条连接。
        ctl = await asyncio.start_server(
            lambda r, w: _ctl_handle(r, w, state, switch_room, cx, stat),
            "127.0.0.1", ctl_port)
        try:
            srv = websockets.serve(handler, "127.0.0.1", a.port)
        except Exception as e:
            ctl.close()
            print(f"[bridge] 起不来：{type(e).__name__}: {e}")
            return 1
        try:
            async with srv:
                print(f"[bridge] 已在 ws://127.0.0.1:{a.port} 等 run.py 接入")
                print(f"[bridge] 控制口 http://127.0.0.1:{ctl_port}/room （后台换直播间）")
                async with ctl:
                    await bridge_loop()
        except OSError as e:
            ctl.close()
            if getattr(e, "winerror", 0) == 10048 or "10048" in str(e):
                print(f"[bridge] 端口 {a.port} 已被占用——大概率已经有一个采集器在跑。"
                      f"先把那个关掉（任务管理器里 python 进程），再重新启动本脚本。")
                return 1
            raise
    except KeyboardInterrupt:
        pass
    finally:
        cx[0].close()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except KeyboardInterrupt:
        pass
