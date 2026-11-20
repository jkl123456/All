"""Mock source: simulates a busy live room so the whole chain can be tested
without touching Douyin. Emits chat + gift events with real avatar files."""
from __future__ import annotations

import asyncio
import itertools
import random
from pathlib import Path

from .base import EventSource

NAMES = ["小鹿乱撞", "夜航船", "阿茶", "老张头", "橘子汽水", "南风知我意",
         "猫不吃鱼", "半糖去冰", "三月的风", "不吃香菜"]
# (gift, price in CNY) -> the price decides the drawing tier
GIFTS = [("小心心", 0.1), ("玫瑰", 1), ("墨镜", 9), ("跑车", 30), ("嘉年华", 300)]


class MockSource(EventSource):
    name = "mock"

    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.samples = self._collect_samples()
        self._ring = itertools.cycle(self.samples) if self.samples else None

    def _collect_samples(self) -> list[str]:
        root = Path(__file__).resolve().parent.parent.parent
        d = root / "data" / "samples"
        if not d.exists():
            return []
        return [str(p) for p in sorted(d.glob("*")) if p.suffix.lower() in
                {".jpg", ".jpeg", ".png", ".webp"}]

    def _avatar(self) -> str:
        if self._ring:
            return next(self._ring)
        return f"https://picsum.photos/seed/{random.randint(1, 999)}/300"

    async def run(self, emit) -> None:
        if not self.samples:
            print("[mock] no files in data/samples, falling back to picsum avatars")
        joined = 0
        while True:
            await asyncio.sleep(float(self.cfg.get("interval", 6)))
            name = NAMES[joined % len(NAMES)]
            joined += 1
            await emit({"type": "member", "nickname": name, "avatar": self._avatar()})
            await asyncio.sleep(0.8)
            if random.random() < 0.55:
                gift, value = random.choice(GIFTS)
                await emit({"type": "gift", "nickname": name, "avatar": self._avatar(),
                            "gift": gift, "value": value})
            else:
                await emit({"type": "chat", "nickname": name,
                            "avatar": self._avatar(), "content": "1"})
