"""本地模拟源：不接直播间也能调 UI 和队列。

刻意模拟**真实的用户行为链**，否则测不出"礼物插队写对名字"这条主线：

    第 1 步：某个昵称发一条弹幕「张三」   -> 进队尾，并记住 昵称->张三
    第 2 步：同一个昵称送一个礼物          -> 插到队首，并且写的还是「张三」而不是昵称

这里发出的事件都带 `demo: True`。这是**假观众**，不是真的有人下单，
所以 `app.main` 会给这些单打上 `demo` 标记：只播素材库里现成的成图，
一次都不去叫豆包——不然开着 mock 挂机一晚，额度就没了。

`gift_ratio` 控制"说完名字多久后送礼"。
"""
from __future__ import annotations

import asyncio
import itertools
import random

from .base import EventSource

NICKS = ["橘子汽水", "晚安小羊", "路过的风", "柠檬不酸", "夜航船", "半糖去冰"]
NAMES = ["张三", "李雷", "王小明", "陈静", "林晚", "苏念", "周野", "何夕"]

GIFTS = [("小心心", 0.1), ("玫瑰", 1.0), ("墨镜", 9.0), ("跑车", 30.0)]


class MockSource(EventSource):
    name = "mock"

    def __init__(self, cfg: dict):
        self.cfg = cfg or {}
        self.interval = float(self.cfg.get("interval", 12))
        self._nicks = itertools.cycle(NICKS)
        self._names = itertools.cycle(NAMES)
        self._rng = random.Random(7)

    def use_names(self, names: list[str]) -> None:
        """换成素材库里已有的名字。

        演示时说的名字如果库里正好有同名的成图，队列里喊「张三」就真的写出
        「张三」那张；库里的名字用完了才会退回本地笔画，观感不跳。
        """
        names = [n for n in (names or []) if n]
        if names:
            self._names = itertools.cycle(names)

    async def run(self, emit) -> None:
        # 先攒几个"说过名字"的人，这样第一次送礼就能命中记忆
        said: list[tuple[str, str]] = []
        while True:
            await asyncio.sleep(self.interval)
            nick = next(self._nicks)
            name = next(self._names)
            await emit({"type": "chat", "nickname": nick, "content": name,
                        "avatar": "", "demo": True})
            said.append((nick, name))
            if len(said) > 6:
                said.pop(0)

            # 有 45% 概率，之前说过名字的人送个礼 -> 验证插队 + 写记忆中的名字
            if said and self._rng.random() < 0.45:
                await asyncio.sleep(2.5)
                g_nick, _ = self._rng.choice(said)
                gift, value = self._rng.choice(GIFTS)
                await emit({"type": "gift", "nickname": g_nick, "gift": gift,
                            "value": value, "avatar": "", "demo": True})
