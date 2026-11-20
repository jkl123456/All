"""Order queue. Gifts jump the line; keyword or 1 joins the tail."""
from __future__ import annotations

import asyncio
import hashlib
import time
from dataclasses import dataclass, field


@dataclass
class Order:
    nickname: str
    avatar: str
    seq: int
    kind: str = "chat"          # chat | gift | manual
    gift: str = ""
    value: float = 0.0          # gift price in CNY -> decides the drawing tier
    created: float = field(default_factory=time.time)
    # True when `avatar` already holds the finished artwork (a Doubao line
    # drawing, or a stand-in picture from data/virtual/). Those skip the whole
    # local sketch pipeline and are painted in by the reveal animation.
    art: bool = False
    # Art direction: sketch | anime | sand | gouache. Empty means "work it out
    # from the gift", which is what the overlay label falls back to.
    style: str = ""

    @property
    def score(self) -> int:
        h = int(hashlib.md5(self.nickname.encode()).hexdigest()[:6], 16)
        return 88 + h % 12

    def brief(self) -> dict:
        return {"nickname": self.nickname, "avatar": self.avatar,
                "kind": self.kind, "gift": self.gift, "score": self.score,
                "value": self.value, "created": round(self.created, 1),
                "waited": int(time.time() - self.created), "seq": self.seq,
                "style": self.style}


class QueueManager:
    def __init__(self, cfg):
        self.cfg = cfg
        self.items: list[Order] = []
        self.current: Order | None = None
        self.done: list[str] = []
        self.paused = False
        self._seq = 0
        self._met: set[str] = set()          # already served nicks (this session)
        self._event = asyncio.Event()

    # ---------------------------------------------------------- intake
    @property
    def keyword_hit(self) -> set[str]:
        return set(self.cfg.get("keyword") or ["1", "画", "画画"])

    def _accept(self, nickname: str) -> bool:
        if not nickname:
            return False
        if nickname in self._met:
            return False
        if len(self.items) >= int(self.cfg.get("max", 20)):
            return False
        return True

    def add_chat(self, nickname: str, content: str, avatar: str) -> Order | None:
        if content.strip() not in self.keyword_hit:
            return None
        if not self._accept(nickname):
            return None
        return self._push(Order(nickname, avatar, self._next(), "chat"))

    def add_gift(self, nickname: str, avatar: str, gift: str = "",
                 jump: bool = True, value: float = 0.0) -> Order | None:
        if not self._accept(nickname):
            return None
        order = Order(nickname, avatar, self._next(), "gift", gift, value)
        if jump and int(self.cfg.get("gift_jump", 1)):
            self.items.insert(0, order)
            return order
        return self._push(order)

    def add_manual(self, nickname: str, avatar: str, value: float = 0.0,
                   kind: str = "manual", gift: str = "",
                   art: bool = False, style: str = "") -> Order:
        return self._push(Order(nickname, avatar, self._next(), kind, gift,
                                value, art=art, style=style))

    def add_virtual(self, nickname: str, avatar: str, value: float = 1.0) -> Order:
        """Fill-in order for an empty room.

        Skips the "already served" filter on purpose: the same twenty names
        have to come round again and again, which `_accept` would block.
        """
        order = Order(nickname, avatar, self._next(), "virtual", "", value,
                      art=True)
        self.items.append(order)
        self._event.set()
        return order

    def drop(self, seq: int) -> bool:
        """Remove one waiting order by seq (admin panel)."""
        for i, o in enumerate(self.items):
            if o.seq == seq:
                self.items.pop(i)
                return True
        return False

    def bump(self, seq: int) -> bool:
        """Move one waiting order to the front."""
        for i, o in enumerate(self.items):
            if o.seq == seq:
                self.items.insert(0, self.items.pop(i))
                return True
        return False

    def _next(self) -> int:
        self._seq += 1
        return self._seq

    def _push(self, order: Order) -> Order:
        # A stand-in must never make a real viewer wait, so genuine orders go
        # in front of every virtual one while keeping their arrival order.
        # (Checking only items[0] put the second real viewer behind the fakes,
        # because by then the head was another real order.)
        if order.kind != "virtual":
            for i, o in enumerate(self.items):
                if o.kind == "virtual":
                    self.items.insert(i, order)
                    break
            else:
                self.items.append(order)
        else:
            self.items.append(order)
        self._met.add(order.nickname)
        self._event.set()
        return order

    # ---------------------------------------------------------- consume
    def pop(self) -> Order | None:
        """Pop the next order without claiming `current` (producer side)."""
        if self.paused or not self.items:
            return None
        return self.items.pop(0)

    async def take(self) -> Order:
        while True:
            if not self.paused and self.items:
                self.current = self.items.pop(0)
                return self.current
            self._event.clear()
            try:
                await asyncio.wait_for(self._event.wait(), timeout=1.0)
            except asyncio.TimeoutError:
                pass

    def finish(self) -> None:
        if self.current:
            self.done.append(self.current.nickname)
            self.current = None

    def skip(self) -> None:
        if self.current:
            self.items.insert(0, self.current)
            self.current = None

    def snapshot(self) -> dict:
        return {
            "queue": [o.brief() for o in self.items],
            "current": self.current.brief() if self.current else None,
            "paused": self.paused,
            "done": len(self.done),
        }
