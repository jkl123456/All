"""画种：送什么礼物，就画成什么样。

The gift decides the art direction -- a beer means anime, a bouquet means sand
art, a duck means gouache -- while the price tier still decides how long the
pen works. Keeping the two apart means the price table can change without the
four prompt files moving.

Names are resolved leniently: a gift name (`啤酒`), a style name (`动漫`) or the
internal key (`anime`) all work, because they arrive from three different
places -- the弹幕 event, the admin form and the Doubao grabber's CLI.
"""
from __future__ import annotations

from pathlib import Path

# Keys stay ASCII so they are safe in URLs, CSS classes and file names.
ALIASES = {
    "sketch": "sketch", "素描": "sketch",
    "anime": "anime", "动漫": "anime", "二次元": "anime",
    "sand": "sand", "沙画": "sand",
    "gouache": "gouache", "水粉": "gouache", "水粉画": "gouache",
}
FALLBACK_NAMES = {"sketch": "素描", "anime": "动漫", "sand": "沙画",
                  "gouache": "水粉"}


class Styles:
    def __init__(self, conf: dict | None, root: Path):
        conf = conf or {}
        self.root = Path(root)
        self.items: dict = conf.get("items") or {}
        self.gift_map = {str(k): str(v)
                         for k, v in (conf.get("gift_map") or {}).items()}
        self.default = str(conf.get("default") or "sketch")

    # ---------------------------------------------------------------- lookups
    def resolve(self, raw: str | None) -> str:
        """Gift name, style name or key -> style key."""
        s = str(raw or "").strip()
        if not s:
            return self.default
        if s in self.gift_map:
            return self.key_of(self.gift_map[s])
        return self.key_of(s)

    def key_of(self, s: str) -> str:
        s = str(s or "").strip()
        if s in ALIASES:
            return ALIASES[s]
        low = s.lower()
        if low in ALIASES:
            return ALIASES[low]
        # A configured item may carry its own alias list.
        for key, item in self.items.items():
            if s and s in (item.get("aliases") or []):
                return key
        return self.default

    def name(self, key: str) -> str:
        item = self.items.get(key) or {}
        return str(item.get("name") or FALLBACK_NAMES.get(key, key))

    def prompt_path(self, key: str) -> Path | None:
        item = self.items.get(key) or {}
        rel = item.get("prompt") or f"prompts/style_{key}.txt"
        p = Path(rel)
        if not p.is_absolute():
            p = self.root / p
        return p if p.exists() else None

    def prompt(self, key: str) -> str:
        p = self.prompt_path(key)
        if p is None:
            return ""
        return p.read_text(encoding="utf-8").strip()

    def options(self) -> list[dict]:
        """Everything the admin panel needs to build a style picker."""
        keys = list(self.items) or list(FALLBACK_NAMES)
        return [{"key": k, "name": self.name(k),
                 "prompt": str(self.prompt_path(k) or "")} for k in keys]
