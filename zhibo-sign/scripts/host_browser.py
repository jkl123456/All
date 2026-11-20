"""常驻一个豆包浏览器窗口（Chrome 子进程会跟着父进程一起被回收，
所以必须有人挂着不放）。

用法：
    python scripts/host_browser.py            # 前台挂着，Ctrl+C 结束
    python scripts/host_browser.py --port 9222

它只做三件事：起 Chrome（独立 profile）、等 CDP 端口就绪、然后一直
活着直到浏览器被关掉。
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
    ap.add_argument("--url", default=D.DOUBAO)
    ap.add_argument("--headless", action="store_true")
    a = ap.parse_args()

    profile = Path(a.profile)
    if not profile.is_absolute():
        profile = ROOT / profile
    profile.mkdir(parents=True, exist_ok=True)

    # 已经有窗口在跑就直接复用
    tabs = await D._tabs(a.port)
    proc = None
    if not tabs:
        args = [D._find_chrome(), f"--remote-debugging-port={a.port}",
                f"--user-data-dir={profile}", "--no-first-run",
                "--no-default-browser-check",
                "--disable-blink-features=AutomationControlled",
                "--window-size=1280,900", a.url]
        if a.headless:
            args.insert(1, "--headless=new")
        proc = subprocess.Popen(args, stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL)
        for _ in range(120):
            await asyncio.sleep(0.3)
            tabs = await D._tabs(a.port)
            if tabs:
                break
        if not tabs:
            print("[host] 浏览器没起来", flush=True)
            return

    print(f"[host] 就绪 ws://127.0.0.1:{a.port} profile={profile}", flush=True)

    # 一直挂着：Chrome 是子进程，父进程一退就被回收
    while True:
        await asyncio.sleep(3)
        if not await D._tabs(a.port):
            print("[host] 浏览器已关闭，退出", flush=True)
            return


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
