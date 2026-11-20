"""打开豆包网页，扫码登录，登录态留在仓库里的 .chrome-doubao/。

和画画项目（zhibo/scripts/doubao_grab.py）同一套做法：
Chrome 起一个独立 profile 目录（--user-data-dir），不碰用户日常 Chrome。
登录一次，之后 app/pipeline/doubaoweb.py 直接复用这个目录，不用再扫。

用法：
    python scripts/doubao_login.py           # 打开窗口等扫码
    python scripts/doubao_login.py --check   # 只看登录态，不开窗
"""
from __future__ import annotations

import argparse
import asyncio
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402

from app.config import ROOT  # noqa: E402
from app.pipeline import doubaoweb as D  # noqa: E402


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=9222)
    ap.add_argument("--profile", default=str(ROOT / ".chrome-doubao"))
    ap.add_argument("--check", action="store_true", help="只检查登录态")
    ap.add_argument("--wait", action="store_true",
                    help="常驻：开窗后一直挂着进程，等扫码完成并打印登录结果。"
                         "（子进程会跟着父进程一起被回收，所以不能开完就退）")
    a = ap.parse_args()

    profile = Path(a.profile)
    if not profile.is_absolute():
        profile = ROOT / profile

    if a.check:
        tabs = await D._tabs(a.port)
        print(f"[doubao] 端口 {a.port} 标签页: {[t.get('url') for t in tabs] or '无'}")
        return

    profile.mkdir(parents=True, exist_ok=True)
    args = [D._find_chrome(), f"--remote-debugging-port={a.port}",
            f"--user-data-dir={profile}", "--no-first-run",
            "--no-default-browser-check",
            "--disable-blink-features=AutomationControlled",
            "--window-size=1280,900", D.DOUBAO]
    subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"[doubao] 已启动浏览器，登录态目录: {profile}")

    for _ in range(120):
        await asyncio.sleep(0.3)
        try:
            async with httpx.AsyncClient(timeout=2) as c:
                tabs = (await c.get(f"http://127.0.0.1:{a.port}/json")).json()
        except Exception:
            continue
        if tabs:
            print(f"[doubao] 窗口就绪，共 {len(tabs)} 个标签页。请扫码登录，登录完告我一声。",
                  flush=True)
            break
    else:
        print("[doubao] 浏览器没起来，检查 chrome.exe 路径")
        return

    if a.wait:
        await _watch(a.port)


async def _watch(port: int) -> None:
    """常驻观察：登录成功后打印一行，然后继续挂着（不占 CPU）。"""
    import websockets

    last = None
    while True:
        await asyncio.sleep(2)
        tabs = await D._tabs(port)
        if not tabs:
            print("[doubao] 浏览器已关闭，退出观察。", flush=True)
            return
        page = next((t for t in tabs if "doubao.com" in (t.get("url") or "")), None) \
            or next((t for t in tabs if t.get("type") == "page"), None)
        if not page:
            continue
        try:
            async with websockets.connect(page["webSocketDebuggerUrl"],
                                          max_size=8 << 20, ping_interval=None) as ws:
                cdp = D._CDP(ws)
                tk = asyncio.create_task(cdp.reader())
                try:
                    st = await cdp.js(D.EDITOR_READY_JS) or {}
                finally:
                    tk.cancel()
        except Exception:
            continue
        now = "out" if st.get("locked") else ("in" if st.get("ed") else "?")
        if now != last:
            print(f"[doubao] 登录态: {now}（ed={st.get('ed')} locked={st.get('locked')}）",
                  flush=True)
            last = now



if __name__ == "__main__":
    asyncio.run(main())
