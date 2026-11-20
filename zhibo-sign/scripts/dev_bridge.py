"""开发用假数据源：不开播也能验证整条链路。

它冒充 `douyin_browser.py` 的桥，在 9000 端口按脚本推事件，格式完全一样。

    python scripts/dev_bridge.py                 # 默认剧本：说名字 -> 送礼插队 -> 另一个人
    python scripts/dev_bridge.py --loop          # 循环播放，用来长时间看画面
    python scripts/dev_bridge.py --chat 王五 --gift 跑车

默认剧本刻意复刻真实观众的行为：
    1. 橘子汽水 发弹幕「张三」    -> 进队尾，服务端记住 橘子汽水 -> 张三
    2. 橘子汽水 送玫瑰            -> 插到队首，并且写的还是「张三」（不是昵称）
    3. 晚安小羊 发弹幕「李雷」    -> 正常排队

第 2 步就是本项目最核心的规则，用这个脚本可以一眼确认它有没有坏。
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys

import websockets


def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=9000)
    ap.add_argument("--chat", default="张三", help="第一个弹幕里的名字")
    ap.add_argument("--nick", default="橘子汽水", help="发言人的昵称")
    ap.add_argument("--gift", default="玫瑰", help="之后送的礼物名")
    ap.add_argument("--value", type=float, default=1.0, help="礼物价值（元）")
    ap.add_argument("--second", default="李雷", help="第二个观众说的名字")
    ap.add_argument("--loop", action="store_true", help="循环播放剧本")
    return ap.parse_args()


async def main() -> int:
    a = parse_args()
    clients: set = set()

    async def handler(ws, *_):
        clients.add(ws)
        print(f"[dev] run.py 已接入 ({len(clients)})")
        try:
            await ws.wait_closed()
        finally:
            clients.discard(ws)
            print("[dev] run.py 断开")

    async def push(ev: dict, delay: float):
        await asyncio.sleep(delay)
        if not clients:
            return
        msg = json.dumps(ev, ensure_ascii=False)
        for ws in list(clients):
            try:
                await ws.send(msg)
                print(f"[dev] -> {msg}")
            except Exception:
                clients.discard(ws)

    async def script():
        while True:
            await asyncio.sleep(3)
            await push({"type": "chat", "nickname": a.nick, "content": a.chat}, 0)
            await push({"type": "chat", "nickname": "晚安小羊", "content": a.second}, 3)
            await push({"type": "gift", "nickname": a.nick, "gift": a.gift,
                        "value": a.value}, 3)
            if not a.loop:
                print("[dev] 剧本已播完，保持监听（Ctrl+C 结束）")
                return
            await asyncio.sleep(20)

    async with websockets.serve(handler, "127.0.0.1", a.port):
        print(f"[dev] 假直播源已启动 ws://127.0.0.1:{a.port}/events")
        print(f"[dev] 剧本: {a.nick} 说「{a.chat}」-> 送{a.gift}（应插队并写「{a.chat}」）"
              f" -> 晚安小羊 说「{a.second}」")
        await script()
        while True:
            await asyncio.sleep(3600)


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except KeyboardInterrupt:
        pass
