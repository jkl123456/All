"""Platform adapters. Every source only has to yield four event kinds."""
from __future__ import annotations

import asyncio
from typing import Awaitable, Callable

Handler = Callable[[dict], Awaitable[None]]


class EventSource:
    name = "base"

    async def run(self, emit: Handler) -> None:  # pragma: no cover
        raise NotImplementedError

    async def close(self) -> None:
        pass


def build_source(cfg) -> EventSource:
    kind = (cfg.get("platform", {}) or {}).get("type", "mock")
    if kind == "mock":
        from .mock import MockSource
        return MockSource(cfg.get("platform", {}).get("mock") or {})
    if kind == "external":
        from .external import ExternalSource
        return ExternalSource(cfg.get("platform", {}).get("external") or {})
    if kind == "douyin":
        # 抖音 web 端已经不再建 webcast IM 的 WebSocket，`douyin.py` 那套
        # signature 握手连不上了（实测 Network.webSocketCreated 为 0）。
        # 现在的可行路线是：scripts/douyin_browser.py 用真浏览器截流，
        # 再以 external 协议喂进来。
        raise ValueError("抖音请用 external 源：先跑 scripts/douyin_browser.py，"
                         "再用 python run.py --source external")
    raise ValueError(f"unknown platform: {kind}")
