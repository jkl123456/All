"""Compare portrait-crop + smoothing variants."""
from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.pipeline.avatar import normalise           # noqa: E402
from app.pipeline.sketch import _clean              # noqa: E402
from app.pipeline.strokes import image_to_strokes   # noqa: E402


def portrait_crop(bgr: np.ndarray, keep: float = 0.76, up: int = 720) -> np.ndarray:
    """Avatars are centred heads: crop in tight, biased slightly upward."""
    h, w = bgr.shape[:2]
    side = int(min(h, w) * keep)
    cx, cy = w // 2, int(h * 0.46)
    x0 = max(0, min(w - side, cx - side // 2))
    y0 = max(0, min(h - side, cy - side // 2))
    crop = bgr[y0:y0 + side, x0:x0 + side]
    s = up / side
    return cv2.resize(crop, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC)


def vA(bgr):
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    g = cv2.bilateralFilter(g, 15, 150, 15)
    return _clean(cv2.Canny(g, 25, 70), 26, 14)


def vB(bgr):
    sm = cv2.pyrMeanShiftFiltering(bgr, 10, 26)
    g = cv2.cvtColor(sm, cv2.COLOR_BGR2GRAY)
    return _clean(cv2.Canny(g, 18, 55), 24, 14)


def vC(bgr):
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    g = cv2.bilateralFilter(g, 21, 190, 21)
    g = cv2.bilateralFilter(g, 15, 120, 15)
    return _clean(cv2.Canny(g, 38, 105), 40, 16)


def vD(bgr, k=6):
    """Flatten into k colour regions, then take the region boundaries.
    This is how cartoon line art is made: one clean line per shape edge,
    no Canny double edges, no texture noise."""
    sm = cv2.pyrMeanShiftFiltering(bgr, 12, 28)
    lab = cv2.cvtColor(sm, cv2.COLOR_BGR2LAB).astype(np.float32)
    h, w = lab.shape[:2]
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 12, 1.0)
    _, labels, _ = cv2.kmeans(lab.reshape(-1, 3), k, None, crit, 3,
                              cv2.KMEANS_PP_CENTERS)
    labels = labels.reshape(h, w)
    # absorb tiny regions into a neighbour so hair strands do not become lines
    for _ in range(2):
        for lb in np.unique(labels):
            m = labels == lb
            if m.sum() < 0.004 * h * w:
                ring = cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
                ring &= ~m
                if ring.any():
                    labels[m] = np.bincount(labels[ring]).argmax()
    edge = np.zeros((h, w), np.uint8)
    edge[:, :-1] |= (labels[:, :-1] != labels[:, 1:]).astype(np.uint8) * 255
    edge[:-1, :] |= (labels[:-1, :] != labels[1:, :]).astype(np.uint8) * 255
    edge = cv2.morphologyEx(edge, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    return edge > 0


VARIANTS = {"A_bilat": vA, "B_meanshift": vB, "C_strong": vC,
            "D_k6": lambda b: vD(b, 6), "E_k4": lambda b: vD(b, 4)}

if __name__ == "__main__":
    img = normalise(cv2.imread(sys.argv[1], cv2.IMREAD_COLOR))
    cropped = portrait_crop(img)
    out = Path("data/sketches")
    out.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out / "_t2_crop.png"), cropped)
    print("crop:", cropped.shape)
    for name, fn in VARIANTS.items():
        ink = fn(cropped)
        res = image_to_strokes(ink, canvas=900, min_len=12, simplify=2.2)
        cv2.imwrite(str(out / f"_t2_{name}.png"), (ink * 255).astype("uint8"))
        avg = res["total_len"] / max(1, res["stroke_count"])
        print(f"{name:14s} strokes={res['stroke_count']:3d} len={res['total_len']:7.0f} avg={avg:5.1f}")
