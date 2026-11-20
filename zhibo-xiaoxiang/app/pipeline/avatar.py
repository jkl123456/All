"""Avatar download + normalisation."""
from __future__ import annotations

import hashlib
import io
from pathlib import Path

import cv2
import httpx
import numpy as np

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
    "Referer": "https://live.douyin.com/",
}


def cache_path(data_dir: Path, key: str) -> Path:
    h = hashlib.md5(key.encode()).hexdigest()[:16]
    d = data_dir / "avatars"
    d.mkdir(parents=True, exist_ok=True)
    return d / f"{h}.jpg"


async def load_avatar(src: str, data_dir: Path) -> np.ndarray:
    """src: http(s) url or local path. Returns BGR image (square, 640px)."""
    if src.startswith("http"):
        dst = cache_path(data_dir, src)
        if dst.exists():
            raw = dst.read_bytes()
        else:
            async with httpx.AsyncClient(timeout=15, headers=HEADERS,
                                         follow_redirects=True) as c:
                r = await c.get(src)
                r.raise_for_status()
                raw = r.content
            dst.write_bytes(raw)
    else:
        raw = Path(src).read_bytes()

    img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("avatar decode failed")
    return normalise(img)


def normalise(img: np.ndarray, size: int = 640, pad_ratio: float = 0.0) -> np.ndarray:
    """Centre-square crop. Padding uses BORDER_REPLICATE on purpose: a hard white
    frame would show up as a fake rectangle in the extracted line art."""
    h, w = img.shape[:2]
    side = min(h, w)
    y0, x0 = (h - side) // 2, (w - side) // 2
    sq = cv2.resize(img[y0:y0 + side, x0:x0 + side], (size, size),
                    interpolation=cv2.INTER_AREA)
    if pad_ratio <= 0:
        return sq
    p = int(size * pad_ratio)
    return cv2.copyMakeBorder(sq, p, p, p, p, cv2.BORDER_REPLICATE)


def portrait_crop(img: np.ndarray, keep: float = 0.72, up: int = 640) -> np.ndarray:
    """Douyin avatars are centred head-and-shoulders shots. Crop in tight and
    bias slightly upward: this alone removes most background clutter, and a
    bigger face is what makes the sketch recognisable."""
    h, w = img.shape[:2]
    side = int(min(h, w) * keep)
    cx, cy = w // 2, int(h * 0.46)
    x0 = max(0, min(w - side, cx - side // 2))
    y0 = max(0, min(h - side, cy - side // 2))
    crop = img[y0:y0 + side, x0:x0 + side]
    return cv2.resize(crop, (up, up), interpolation=cv2.INTER_CUBIC)
