"""空场名字池：只在"一张成图都还没有"时用一次，兜住第一次开播。

现在空场的主力是 `app/library.py`——直接播 `data/signatures` 里已经生成好的
成图，不联网、不花额度、不用等二十秒。这个池子退成了最后一道兜底：
素材库空着（全新环境、还没出过任何一张图）时，从下面取一个名字用**本地字体**
写一遍起头，画面不至于空着。

也就是说，这里的名字永远不会触发豆包。改 `virtual.names` 即可换成店名、
主推款名字之类。
"""
from __future__ import annotations

import time
from pathlib import Path

DEFAULT_NAMES = [
    "陈静", "林晚", "苏念", "周野", "何夕", "江阔", "顾清欢",
    "沈知遥", "陆一鸣", "唐心", "许愿", "叶知秋",
    "程诺", "白露", "温行", "宋辞", "南风",
]


class VirtualPool:
    def __init__(self, conf: dict | None, data_dir: Path):
        self.conf = conf or {}
        self.names = [str(n) for n in (self.conf.get("names") or DEFAULT_NAMES)]
        if not self.names:
            self.names = DEFAULT_NAMES
        self.i = 0

    @property
    def enabled(self) -> bool:
        return bool(self.conf.get("enabled", True))

    def ready(self) -> bool:
        return self.enabled and bool(self.names)

    def next(self, qm):
        if not self.ready():
            return None
        name = self.names[self.i % len(self.names)]
        self.i += 1
        # 昵称和名字一致：这就是一个"路人直接说了自己的名字"
        return qm.add_virtual(f"路人{self.i:02d}", name)

    def status(self) -> dict:
        return {"enabled": self.enabled, "names": len(self.names),
                "next": self.i % len(self.names) if self.names else 0,
                "sample": self.names[:3], "ts": round(time.time(), 2)}
