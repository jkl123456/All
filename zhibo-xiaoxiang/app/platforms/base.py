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
        from .douyin import DouyinSource
        return DouyinSource(cfg.get("platform", {}).get("douyin") or {})
    raise ValueError(f"unknown platform: {kind}")
