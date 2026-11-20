"""启动器。

    python run.py                      # mock 源（用 config 里的 provider）
    python run.py --source external    # 接 scripts/douyin_browser.py 推来的真实弹幕
    python run.py --provider local     # 只用本地笔画（0.1~0.3s，永远可用）
    python run.py --provider sdcn      # 本地扩散上质感（要先起 scripts/sdcn_server.py）
    python run.py --provider ai        # 用火山方舟出"沙画成图"（要填 api_key）
"""
from __future__ import annotations

import argparse
import os
import subprocess
import webbrowser

import uvicorn

from app import main
from app.platforms.base import build_source

parser = argparse.ArgumentParser()
parser.add_argument("--source", help="mock | external")
parser.add_argument("--provider", help="local | sdcn | doubao | ai")
parser.add_argument("--port", type=int, help="覆盖 config.yaml 里的端口")
parser.add_argument("--no-browser", action="store_true")
args = parser.parse_args()

if args.source:
    main.cfg["platform"]["type"] = args.source
    main.source = build_source(main.cfg)
if args.provider:
    main.cfg["signature"]["provider"] = args.provider
    main.SIG["provider"] = args.provider
if args.port:
    main.cfg["server"]["port"] = args.port

host = main.cfg["server"]["host"]
port = int(main.cfg["server"]["port"])
url = f"http://{host}:{port}/"
provider = main.SIG.get("provider")
print(f"  直播画面:  {url}")
print(f"  后台管理:  {url}admin/")
print(f"  跑一单:    {url}api/simulate?nickname=小明&name=张三   （浏览器直接打开）")
print(f"  数据源:    {main.cfg['platform']['type']}   出图: {provider}")

# 用了本地扩散但服务没起：现在就说清楚，别等第一位观众打名字才发现退回了本地笔画
if provider == "sdcn":
    from app.pipeline import sdcn

    conf = dict(main.SIG.get("sdcn") or {})
    if sdcn.health(conf):
        print(f"  本地模型:  就绪 {conf.get('url')}")
    else:
        print(f"  本地模型:  ✗ 连不上 {conf.get('url')}")
        print("             先起服务：python scripts/sdcn_server.py")
        print("             现在开播也不会坏：所有单子自动退回本地笔画（local）")

def open_window(url: str) -> None:
    """开一个"能出声"的画面窗口。

    Chrome 默认按「用户没交互过就不许自动播放」办，`new Audio().play()` 直接
    reject——表现就是画面一切正常、一点声音都没有。必须带 --autoplay-policy
    才放行。另带一份独立的 --user-data-dir：不然它会挂到已经开着的 Chrome 上，
    这些启动参数全被忽略；顺带还能保证是个干净的 1080×1920 无边框窗口，
    OBS 浏览器源之外（比如直播伴侣的窗口捕获）直接就能用。
    """
    cands = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    exe = next((p for p in cands if os.path.exists(p)), None)
    if not exe:
        webbrowser.open(url)
        return
    profile = os.path.join(os.environ.get("TEMP", "."), "zhibo-sign-overlay")
    try:
        subprocess.Popen([
            exe, f"--app={url}", "--window-size=1080,1920", "--hide-scrollbars",
            "--autoplay-policy=no-user-gesture-required",
            f"--user-data-dir={profile}",
            "--no-first-run", "--no-default-browser-check",
            "--disable-session-crashed-bubble",
            # 1080×1920 的窗口在 1080p 屏上有一半在屏幕外，Chrome 的原生遮挡
            # 计算会把它判成"看不见的窗口"，直接把渲染进程冻结：websocket 还连着、
            # 服务端照常下发，但页面一个 JS 任务都不再执行——不画、不回报、不出声。
            # 表现就是日志里一直刷"overlay 未回报完成"。下面四个参数关掉判定链路。
            "--disable-features=CalculateNativeWinOcclusion",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
            "--disable-background-timer-throttling",
        ])
        print(f"  画面窗口:  {os.path.basename(exe)}（已放开自动播放）")
    except Exception:
        webbrowser.open(url)


if not args.no_browser:
    open_window(url)

uvicorn.run(main.app, host=host, port=port, log_level="warning")
