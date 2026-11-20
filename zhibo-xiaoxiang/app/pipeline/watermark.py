"""Remove the light-grey "豆包 AI 生成" stamp that Doubao burns into the corner.

Two problems shaped this
-----------------------
1. Cropping the frame is not an option: Doubao fills a square frame edge to
   edge with hair, so losing the stamp by cropping also cuts the top of the head.
2. Finding the stamp by colour works for clean line art but not for pencil
   shading -- the stamp is drawn *under* the pencil strokes and the paper
   texture, so blob detection drowns in noise.

The stamp is always in the same place though: bottom-right, roughly 18%-3%
from the right edge and 6%-2% from the bottom. So we clear that corner, and
only fall back to colour-gated clearing when actual dark artwork occupies it.
"""
from __future__ import annotations

import cv2
import numpy as np

# Fractions of the frame that contain the stamp (measured on 1536px output,
# generous on every side).
X0, Y0 = 0.755, 0.905


def erase_watermark(
    img: np.ndarray,
    x0: float = X0,
    y0: float = Y0,
    dark: int = 110,
    dark_ratio: float = 0.02,
    lo: int = 172,
    hi: int = 244,
) -> tuple[np.ndarray, bool]:
    """Clear the corner stamp. Returns (image, whether the corner was touched).

    If the corner is basically empty paper (line art and pencil shading both
    leave it blank) we paint the whole corner white. If real artwork spills into
    it, we only lift the flat grey pixels so the drawing survives.
    """
    out = img.copy()
    h, w = out.shape[:2]
    yc, xc = int(h * y0), int(w * x0)
    roi = out[yc:, xc:]
    if roi.size == 0:
        return out, False

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    ink_ratio = float((gray < dark).mean())

    if ink_ratio < dark_ratio:
        roi[:] = 255                     # empty corner: just clear it
        return out, True

    # Artwork reaches the corner -- only remove the flat grey stamp pixels and
    # keep every dark pen stroke.
    b, g, r = cv2.split(roi.astype(np.int16))
    mx = np.maximum(np.maximum(b, g), r)
    mn = np.minimum(np.minimum(b, g), r)
    flat = (mx >= lo) & (mx <= hi) & ((mx - mn) <= 18)
    if flat.mean() < 0.002:
        return out, False
    roi[flat] = (255, 255, 255)
    ker = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
    joined = cv2.morphologyEx(flat.astype(np.uint8) * 255, cv2.MORPH_CLOSE, ker)
    roi[joined > 0] = (255, 255, 255)
    return out, True


def erase_watermark_file(src, dst=None) -> bool:
    from pathlib import Path

    src = Path(src)
    img = cv2.imdecode(np.frombuffer(src.read_bytes(), np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        return False
    out, hit = erase_watermark(img)
    if hit:
        cv2.imwrite(str(dst or src), out)
    return hit
