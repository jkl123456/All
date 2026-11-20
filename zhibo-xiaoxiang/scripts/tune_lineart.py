"""Throwaway tuner: compare line-extraction variants on one photo."""
from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.pipeline.avatar import normalise           # noqa: E402
from app.pipeline.sketch import _clean              # noqa: E402
from app.pipeline.strokes import image_to_strokes   # noqa: E402


def v_bilateral_canny(g):
    s = cv2.bilateralFilter(g, 9, 75, 75)
    s = cv2.GaussianBlur(s, (3, 3), 0)
    return _clean(cv2.Canny(s, 28, 88), 30)


def v_median_canny(g):
    s = cv2.medianBlur(g, 5)
    s = cv2.bilateralFilter(s, 7, 60, 60)
    return _clean(cv2.Canny(s, 22, 70), 30)


def v_dog(g):
    s = cv2.bilateralFilter(g, 9, 80, 80).astype(np.float32)
    band = s - cv2.GaussianBlur(s, (0, 0), 6)
    band = cv2.normalize(band, None, 0, 255, cv2.NORM_MINMAX)
    _, m = cv2.threshold(band, 82, 255, cv2.THRESH_BINARY)
    return _clean(m, 25)


VARIANTS = {"bil_canny": v_bilateral_canny, "med_canny": v_median_canny, "dog": v_dog}

if __name__ == "__main__":
    img = normalise(cv2.imread(sys.argv[1], cv2.IMREAD_COLOR))
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    out = Path("data/sketches")
    for name, fn in VARIANTS.items():
        ink = fn(g)
        res = image_to_strokes(ink, canvas=900, min_len=6, simplify=1.4)
        cv2.imwrite(str(out / f"_tune_{name}_ink.png"), (ink * 255).astype("uint8"))
        print(f"{name:12s} strokes={res['stroke_count']:4d} len={res['total_len']:8.0f}")
