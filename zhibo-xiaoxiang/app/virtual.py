"""Keep the stream alive when nobody is asking for a drawing.

A live room at 3am has no viewers and an empty queue, and an empty canvas is
worse than an honest repeat: the overlay looks broken. So when the queue runs
dry we inject a stand-in viewer and draw one of a fixed set of pictures
(`data/virtual/`, 20 of them by default) in rotation, each with a different
nickname, as if a new person had just walked in.

These orders are marked `kind="virtual"` so the admin panel can tell them
apart and the overlay can avoid showing the artwork as its own avatar.
"""
from __future__ import annotations

import time
from pathlib import Path

EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

NAMES = [
    "橘子汽水", "晚安小羊", "路过的风", "第三颗纽扣", "柠檬不酸",
    "山间有雾", "一颗西柚", "夜航船", "温吞水", "半糖去冰",
    "南风知我意", "别叫我小张", "第七次晚安", "土豆成精了", "春风十里",
    "月亮邮差", "耳机没电", "阿枝", "光年之外", "小满",
]


class VirtualPool:
    def __init__(self, conf: dict | None, data_dir: Path):
        self.conf = conf or {}
        self.dir = Path(self.conf.get("dir") or "data/virtual")
        if not self.dir.is_absolute():
            self.dir = Path(data_dir).parent / self.dir
        self.names = [str(n) for n in (self.conf.get("names") or NAMES)] or NAMES
        self.value = float(self.conf.get("value", 1))
        self.i = 0
        self.n = 0

    @property
    def enabled(self) -> bool:
        return bool(self.conf.get("enabled", True))

    def files(self) -> list[Path]:
        if not self.dir.exists():
            return []
        # Re-scan every time: dropping a new picture into the folder should
        # take effect without restarting the service.
        return sorted(p for p in self.dir.iterdir()
                      if p.suffix.lower() in EXTS and p.is_file())

    def ready(self) -> bool:
        return self.enabled and bool(self.files())

    def next(self, qm) -> object | None:
        pics = self.files()
        if not self.enabled or not pics:
            return None
        pic = pics[self.i % len(pics)]
        self.i += 1
        nick = self.names[self.n % len(self.names)]
        self.n += 1
        # A repeat nickname would otherwise be blocked by the "already served"
        # filter, which is why virtual orders bypass `_accept` entirely.
        return qm.add_virtual(nick, str(pic), self.value)

    def status(self) -> dict:
        pics = self.files()
        return {"enabled": self.enabled, "pictures": len(pics),
                "dir": str(self.dir), "next": self.i % len(pics) if pics else 0,
                "names": len(self.names), "value": self.value,
                "ts": round(time.time(), 2)}
