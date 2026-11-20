"""Grab the Douyin webcast handshake params and write them into config.yaml.

    python scripts/grab_params.py --room YOUR_ROOM_ID
    python scripts/grab_params.py https://live.douyin.com/YOUR_ROOM_ID --show
    python scripts/grab_params.py --room YOUR_ROOM_ID --no-test

Why this exists: the `signature` in the handshake is produced by Douyin's
obfuscated front-end JS and expires within hours, so it cannot be computed
offline. The reliable way is to open the room once in a real browser, watch
the WebSocket URL it builds, and copy the query string out of it. This script
drives Chrome over CDP to do exactly that, so a new stream only needs one
command instead of digging through devtools.

It writes: room_id / cookie / ttwid / user_unique_id / device_id / signature,
then optionally opens a short test connection to prove the params work.
"""
from __future__ import annotations

import asyncio
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import httpx
import websockets

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9335

WANT = ("signature", "ttwid", "user_unique_id", "device_id")


def parse_args() -> tuple[str, bool, bool]:
    room, show, test = "", False, True
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--room" and i + 1 < len(args):
            room = args[i + 1]
            i += 2
            continue
        if a == "--show":
            show = False if show else True
        elif a == "--headless":
            show = False
        elif a == "--no-test":
            test = False
        elif not a.startswith("-") and not room:
            room = a
        i += 1
    if not room:
        print("用法: python scripts/grab_params.py --room YOUR_ROOM_ID [--show] [--no-test]")
        sys.exit(2)
    # Accept either the bare room number or a full live.douyin.com URL.
    m = re.search(r"live\.douyin\.com/(\d+)", room)
    if m:
        room = m.group(1)
    return room.strip().strip("/"), show, test


def find_chrome() -> str:
    for p in (CHROME,
              r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
              r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"):
        if Path(p).exists():
            return p
    raise SystemExit("找不到 Chrome，请手动把路径填到脚本顶部的 CHROME")


async def grab(room: str, show: bool) -> tuple[str, dict, dict]:
    """Return (ws_url, query params, cookies)."""
    url = f"https://live.douyin.com/{room}"
    headless = [] if show else ["--headless=new", "--disable-gpu"]
    proc = subprocess.Popen(
        [find_chrome(), *headless, "--mute-audio", "--hide-scrollbars",
         "--disable-blink-features=AutomationControlled",
         "--autoplay-policy=no-user-gesture-required",
         f"--remote-debugging-port={PORT}",
         "--user-data-dir=" + tempfile.mkdtemp(prefix="dy-"),
         "--window-size=1280,900", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        target = None
        for _ in range(80):
            try:
                async with httpx.AsyncClient() as c:
                    tabs = (await c.get(f"http://127.0.0.1:{PORT}/json", timeout=1)).json()
                target = next((t for t in tabs if t["type"] == "page"), None)
                if target:
                    break
            except Exception:
                pass
            await asyncio.sleep(0.3)
        if not target:
            raise SystemExit("Chrome 没起来（CDP 连不上）")

        async with websockets.connect(target["webSocketDebuggerUrl"],
                                      max_size=64 << 20) as ws:
            state = {"id": 0, "pending": {}}
            found: dict[str, str] = {}

            async def reader():
                async for raw in ws:
                    m = json.loads(raw)
                    if "id" in m:
                        fut = state["pending"].pop(m["id"], None)
                        if fut and not fut.done():
                            fut.set_result(m.get("result") or {})
                        continue
                    method = m.get("method", "")
                    p = m.get("params") or {}
                    # The handshake is a ws:// upgrade; both events can carry it
                    # depending on how Chrome reports the connection.
                    u = p.get("url") or (p.get("request") or {}).get("url") or ""
                    # Network.webSocketWillSendHandshakeRequest reports a
                    # root-relative URL, so stick the known IM host back on.
                    if u.startswith("/webcast/im/push/"):
                        u = "wss://webcast5-ws-web-lf.douyin.com" + u
                    # Must be the IM push endpoint, not just any URL with
                    # "webcast" in it -- douyinpic CDN hosts like
                    # p11-webcast-sign.douyinpic.com also match, and their
                    # query can contain "signature=", which used to win the race.
                    is_push = "/webcast/im/push/" in u
                    if u and "webcast" in u:
                        found.setdefault("seen", []).append(u[:150])
                    if is_push and "signature=" in u and "ws" not in found:
                        found["ws"] = u
                        print(f"  抓到握手: {urlparse(u).netloc}")

            task = asyncio.create_task(reader())

            async def call(method: str, **params):
                state["id"] += 1
                fut = asyncio.get_running_loop().create_future()
                state["pending"][state["id"]] = fut
                await ws.send(json.dumps({"id": state["id"], "method": method,
                                          "params": params}))
                return await asyncio.wait_for(fut, 60)

            await call("Network.enable")
            await call("Page.enable")
            await call("Page.navigate", url=url)

            for _ in range(120):                     # up to 60s
                if "ws" in found:
                    break
                await asyncio.sleep(0.5)
            if "ws" not in found:
                seen = found.get("seen") or []
                print(f"  看到的 webcast 请求 {len(seen)} 条:")
                for s in seen[:6]:
                    print("   ", s)
                # Say what the page actually shows -- "未开播" and "被反爬拦了"
                # look identical from the outside otherwise.
                try:
                    info = await call("Runtime.evaluate", returnByValue=True,
                                      expression="document.title + ' || ' + "
                                      "document.body.innerText.replace(/\\s+/g,' ').slice(0,240)")
                    print("  页面状态:", (info.get("result") or {}).get("value"))
                except Exception:
                    pass
                task.cancel()
                raise SystemExit(
                    "60 秒内没抓到握手连接。常见原因：直播间未开播、需要登录、"
                    "或反爬拦截。试试加 --show 用可见窗口跑一次，看页面提示什么。")

            cookies = await call("Network.getAllCookies")
            task.cancel()
    finally:
        proc.terminate()

    q = {k: v[0] for k, v in parse_qs(urlparse(found["ws"]).query).items() if v}
    jar = [c for c in cookies.get("cookies", [])
           if "douyin" in (c.get("domain") or "")]
    cookie = "; ".join(f"{c['name']}={c['value']}" for c in jar)
    return found["ws"], q, {"cookie": cookie, "ttwid": q.get("ttwid", "")}


def write_config(updates: dict[str, str]) -> None:
    """Rewrite only the values inside the `platform.douyin` block, so comments
    and every other setting stay untouched."""
    p = ROOT / "config.yaml"
    lines = p.read_text(encoding="utf-8").splitlines()
    out: list[str] = []
    inside = False
    hit: set[str] = set()
    for ln in lines:
        if ln.startswith("  douyin:"):
            inside = True
            out.append(ln)
            continue
        if inside:
            stripped = ln.strip()
            if stripped and not ln.startswith("    "):
                inside = False                      # left the block
            elif stripped:
                key = stripped.split(":", 1)[0].strip()
                if key in updates:
                    indent = ln[:len(ln) - len(ln.lstrip())]
                    tail = ""
                    if "#" in ln:
                        tail = "  " + ln[ln.index("#"):]
                    val = updates[key].replace('"', "")
                    out.append(f'{indent}{key}: "{val}"{tail}')
                    hit.add(key)
                    continue
        out.append(ln)
    if hit:
        out = ["  type: douyin" if ln.startswith("  type:") else ln for ln in out]
    p.write_text("\n".join(out) + "\n", encoding="utf-8")
    missing = set(updates) - hit
    print(f"  写入 config.yaml: {', '.join(sorted(hit))}"
          + (f"（缺字段 {', '.join(sorted(missing))}）" if missing else ""))


async def probe(cfg: dict) -> int:
    """Open one real handshake and count what comes back."""
    from app.platforms.douyin import DouyinSource

    src = DouyinSource(cfg)
    got: list[dict] = []

    async def emit(ev: dict) -> None:
        got.append(ev)
        if len(got) <= 5:
            print("  <-", json.dumps(ev, ensure_ascii=False)[:120])

    try:
        await asyncio.wait_for(src._session(emit), timeout=12)
    except asyncio.TimeoutError:
        pass
    except Exception as e:
        print(f"  试连失败: {type(e).__name__}: {e}")
        return 1
    kinds = {}
    for ev in got:
        kinds[ev.get("type")] = kinds.get(ev.get("type"), 0) + 1
    print(f"  12 秒收到 {len(got)} 条消息 {kinds or ''}")
    return 0 if got else 2


async def main() -> int:
    room, show, test = parse_args()
    print(f"房间 {room}，用 {'可见' if show else '无头'} Chrome 打开…")
    _, q, extra = await grab(room, show)

    updates = {"room_id": room, "cookie": extra["cookie"]}
    for k in WANT:
        if q.get(k):
            updates[k] = q[k]
    for k in WANT:
        print(f"  {k:16} {'✓' if updates.get(k) else '✗ 没抓到'}")
    if not updates.get("signature"):
        print("  ! signature 缺失，握手会失败")
    write_config(updates)

    cfg = {k: updates.get(k, "") for k in
           ("room_id", "cookie", "ttwid", "user_unique_id", "device_id", "signature")}
    if not test:
        return 0
    print("试连 12 秒…")
    return await probe(cfg)


sys.exit(asyncio.run(main()))
