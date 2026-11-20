"""End-to-end offline check: image -> line art -> ordered strokes -> proof PNG.

    python scripts/test_pipeline.py <image> [--provider local|openai]
"""
from __future__ import annotations

import argparse
import asyncio
import sys
import time
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import ROOT, load                      # noqa: E402
from app.pipeline import sketch as sketch_mod          # noqa: E402
from app.pipeline.avatar import load_avatar, normalise  # noqa: E402
from app.pipeline.strokes import image_to_strokes      # noqa: E402


def proof(strokes: list, size: int) -> np.ndarray:
    """Render the stroke order as a rainbow gradient so the pen path is visible."""
    img = np.full((size, size, 3), 255, np.uint8)
    n = max(1, len(strokes))
    for i, st in enumerate(strokes):
        hue = int(179 * i / n)
        color = cv2.cvtColor(np.uint8([[[hue, 190, 150]]]), cv2.COLOR_HSV2BGR)[0, 0]
        pts = np.array(st, np.int32).reshape(-1, 1, 2)
        cv2.polylines(img, [pts], False, tuple(int(c) for c in color), 2, cv2.LINE_AA)
        cv2.circle(img, tuple(st[0]), 3, (60, 60, 220), -1)
    return img


async def main(path: str, provider_name: str) -> None:
    cfg = load()
    cfg["sketch"]["provider"] = provider_name
    prov = sketch_mod.build_provider(cfg["sketch"])
    p = Path(path)
    t0 = time.time()
    img = await load_avatar(str(p), ROOT / "data") if p.suffix.lower() in \
        {".jpg", ".jpeg", ".png", ".webp"} else None
    if img is None:
        raw = cv2.imread(str(p), cv2.IMREAD_COLOR)
        img = normalise(raw)
    t1 = time.time()

    ink, who = await sketch_mod.render_with_fallback(prov, img)
    t2 = time.time()
    res = image_to_strokes(ink, canvas=int(cfg["draw"]["canvas"]),
                           min_len=float(cfg["draw"]["min_stroke_len"]),
                           simplify=float(cfg["draw"]["simplify"]))
    t3 = time.time()

    out = ROOT / "data" / "sketches"
    out.mkdir(parents=True, exist_ok=True)
    stem = p.stem[:20]
    cv2.imwrite(str(out / f"_test_{stem}_ink.png"), (ink * 255).astype("uint8"))
    cv2.imwrite(str(out / f"_test_{stem}_proof.png"),
                proof(res["strokes"], res["size"][0]))

    print(f"provider   : {who}")
    print(f"avatar     : {t1-t0:.2f}s")
    print(f"line art   : {t2-t1:.2f}s")
    print(f"strokes    : {t3-t2:.2f}s  ({res['stroke_count']} strokes, "
          f"len {res['total_len']}px)")
    print(f"avg stroke : {res['total_len']/max(1,res['stroke_count']):.1f}px")
    print(f"output     : {out}/_test_{stem}_ink.png / _proof.png")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--provider", default="local")
    a = ap.parse_args()
    asyncio.run(main(a.image, a.provider))
