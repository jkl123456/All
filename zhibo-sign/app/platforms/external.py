"""External bridge source.

Plug any existing barrage/弹幕 tool (DouyinLiveWebFetcher, 弹幕助手, 自写脚本)
into this project by pushing JSON over one WebSocket:

    {"type":"chat","nickname":"小明","avatar":"https://...","content":"1"}
    {"type":"gift","nickname":"小明","avatar":"https://...","gift":"玫瑰"}

`type` may also be member / like. Missing `avatar` is tolerated: the order is
skipped instead of crashing the stream.
"""
from __future__ import annotations

import asyncio
import json

from ..netutil import ws_connect
from .base import EventSource

ALIASES = {
    "nickname": ("nickname", "nick_name", "user", "username", "name"),
    "avatar": ("avatar", "avatar_url", "avatar_thumb", "head_img", "headimgurl"),
    "content": ("content", "text", "msg", "message"),
    "gift": ("gift", "gift_name", "giftname"),
}


def _pick(d: dict, key: str) -> str:
    for k in ALIASES[key]:
        v = d.get(k)
        if isinstance(v, str) and v:
            return v
        if isinstance(v, dict):                       # douyin user object
            for kk in ("url_list", "url"):
                u = v.get(kk)
                if isinstance(u, list) and u:
                    return u[0]
                if isinstance(u, str) and u:
                    return u
            n = v.get("nickname")
            if n and key == "nickname":
                return n
    return ""


class ExternalSource(EventSource):
    name = "external"

    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.url = cfg.get("ws_url") or "ws://127.0.0.1:9000/events"

    async def run(self, emit) -> None:
        while True:
            try:
                # 连本机弹幕桥，要撇掉系统 HTTP_PROXY（见 app/netutil.py：
                # websockets 各版本对 proxy= 的处理不一样，用错会每 5 秒重连一次）
                conn = ws_connect(self.url, ping_interval=20)
                async with conn as ws:
                    print(f"[external] 已接入弹幕桥 {self.url}", flush=True)
                    async for raw in ws:
                        try:
                            d = json.loads(raw)
                        except Exception:
                            continue
                        ev = {
                            "type": str(d.get("type") or "chat").lower(),
                            "nickname": _pick(d, "nickname") or _pick(d, "content")[:0],
                            "avatar": _pick(d, "avatar"),
                            "content": _pick(d, "content"),
                            "gift": _pick(d, "gift"),
                        }
                        if ev["nickname"]:
                            await emit(ev)
            except Exception as e:
                print(f"[external] {e}; 5s 后重连", flush=True)
                await asyncio.sleep(5)
