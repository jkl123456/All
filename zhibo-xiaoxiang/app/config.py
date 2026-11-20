from __future__ import annotations

from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent


class Cfg(dict):
    """dict with attribute access, nested."""

    def __getattr__(self, k):
        try:
            v = self[k]
        except KeyError as e:
            raise AttributeError(k) from e
        return Cfg(v) if isinstance(v, dict) else v


def load(path: str | Path | None = None) -> Cfg:
    p = Path(path) if path else ROOT / "config.yaml"
    with open(p, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    cfg = Cfg(data)
    cfg["_root"] = str(ROOT)
    return cfg
