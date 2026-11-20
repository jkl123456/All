"""临时预览：跑起 overlay 页面但不接任何真实音源，方便手测版式。"""
from __future__ import annotations

import asyncio

import uvicorn

import app.config as c
import app.platforms.base as b

_orig = c.load
c.load = lambda path=None: _orig()          # 用真配置（端口/素材都对）

import app.main as m                        # noqa: E402


class Dummy(b.EventSource):
    name = "dummy"

    async def run(self, emit):
        await asyncio.Event().wait()


async def _idle():
    await asyncio.Event().wait()


m.source = Dummy()
m.producer = _idle          # 不排单、不叫豆包，只测版式
m.presenter = _idle
m.LOGS.append("preview 模式：不接音源，只测 overlay 版式")

uvicorn.run(m.app, host="127.0.0.1", port=8851, log_level="warning")
