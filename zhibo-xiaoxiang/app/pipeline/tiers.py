"""Gift tiers: extra layers that make a drawing look more expensive.

  hatch  -> pencil shading strokes (素描)
  fills  -> flat colour regions painted under the line art (彩色)

Both work in canvas coordinates so the overlay can scale them like the ink
strokes, and neither needs any model download.
"""
from __future__ import annotations

import math

import cv2
import numpy as np


# ---------------------------------------------------------------- shading
def hatch_strokes(bgr: np.ndarray, canvas: int = 900, margin: int = 24,
                  cell: int = 13, angle: float = -38.0,
                  max_lines: int = 320) -> list[list[list[int]]]:
    """Diagonal pencil hatching over the dark parts of the photo.

    Density follows local darkness (3 / 2 / 1 lines per cell), so hair and
    shadow get texture while skin stays clean. Near-black cells are skipped:
    eyes and the mouth are already solid ink.
    """
    side = canvas - 2 * margin
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY) if bgr.ndim == 3 else bgr
    g = cv2.resize(g, (side, side), interpolation=cv2.INTER_AREA)
    g = cv2.GaussianBlur(g, (0, 0), 3)
    dark = 1.0 - g.astype(np.float32) / 255.0

    gh = side // cell
    if gh < 2:
        return []
    cells = []
    for cy in range(gh):
        for cx in range(gh):
            patch = dark[cy * cell:(cy + 1) * cell, cx * cell:(cx + 1) * cell]
            m = float(patch.mean())
            if m < 0.30 or m > 0.86:        # bright skin / already solid black
                continue
            n = 1 if m < 0.45 else (2 if m < 0.62 else 3)
            cells.append((m, cx, cy, n))
    if not cells:
        return []
    # keep the darkest cells, then put them back in reading order: sorting by
    # darkness alone makes the pencil jump all over the face.
    if len(cells) > max_lines // 3:
        cells.sort(key=lambda c: -c[0])
        cells = cells[:max_lines // 3]
    cells.sort(key=lambda c: (c[2], c[1]))

    ca, sa = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    px, py = -sa, ca                          # perpendicular spacing direction
    out: list[list[list[int]]] = []
    for _, cx, cy, n in cells:
        x0 = margin + cx * cell + cell / 2
        y0 = margin + cy * cell + cell / 2
        half = cell * 0.75
        for k in range(n):
            off = (k - (n - 1) / 2) * 3.6
            bx, by = x0 + px * off, y0 + py * off
            out.append([[int(bx - ca * half), int(by - sa * half)],
                        [int(bx + ca * half), int(by + sa * half)]])
    return out


# ---------------------------------------------------------------- colour
def _hex(b: int, g: int, r: int) -> str:
    return "#%02x%02x%02x" % (r, g, b)


def color_fills(bgr: np.ndarray, canvas: int = 900, margin: int = 24,
                k: int = 5, min_ratio: float = 0.006) -> list[dict]:
    """Segmented flat colours, ready to be painted under the line art.

    Each colour cluster is split into connected components and the ones that
    touch the frame border are dropped: that is the wall / background. Doing
    this per component (instead of per cluster) matters, because when k-means
    lumps the wall and the cheek into one cluster the whole face would
    otherwise be discarded as background.

    Colours are taken per component and slightly saturated, since a crayon
    fill looks washed out if it copies the photo's exact pixels.
    """
    side = canvas - 2 * margin
    if bgr.ndim == 2:
        bgr = cv2.cvtColor(bgr, cv2.COLOR_GRAY2BGR)
    sm = cv2.resize(bgr, (side, side), interpolation=cv2.INTER_AREA)
    sm = cv2.bilateralFilter(sm, 9, 90, 9)
    sm = cv2.bilateralFilter(sm, 9, 90, 9)

    lab = cv2.cvtColor(sm, cv2.COLOR_BGR2LAB).astype(np.float32)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 12, 1.0)
    # fixed seed: the same avatar must always produce the same drawing
    cv2.setRNGSeed(20240501)
    _, labels, _ = cv2.kmeans(lab.reshape(-1, 3), max(2, k), None, crit, 3,
                              cv2.KMEANS_PP_CENTERS)
    labels = labels.reshape(side, side)

    min_area = max(60, int(min_ratio * side * side))
    out: list[dict] = []
    for lb in range(max(2, k)):
        cluster = (labels == lb).astype(np.uint8)
        n, comp, stats, _ = cv2.connectedComponentsWithStats(cluster, 8)
        for i in range(1, n):
            area = int(stats[i, cv2.CC_STAT_AREA])
            if area < min_area:
                continue
            comp_i = (comp == i).astype(np.uint8)
            # Background is whatever owns the corners of the frame. A head can
            # be cropped by the border, but the corner pixels belong to the wall
            # / set behind it, so this separates subject from backdrop without
            # any model.
            p = 8
            corners = (comp_i[:p, :p].any() or comp_i[:p, -p:].any()
                       or comp_i[-p:, :p].any() or comp_i[-p:, -p:].any())
            sides = sum((bool(comp_i[0].any()), bool(comp_i[-1].any()),
                         bool(comp_i[:, 0].any()), bool(comp_i[:, -1].any())))
            if corners or sides >= 3:
                continue

            m = cv2.morphologyEx(comp_i, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
            cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for c in cnts:
                if cv2.contourArea(c) < min_area * 0.8:
                    continue
                poly = cv2.approxPolyDP(c, 2.0, True).reshape(-1, 2)
                if len(poly) < 3:
                    continue
                b, g, r = (int(v) for v in sm[comp_i > 0].mean(axis=0))
                h, s, v = cv2.cvtColor(np.uint8([[[b, g, r]]]), cv2.COLOR_BGR2HSV)[0, 0]
                s = int(min(255, s * 1.30))
                v = int(min(255, v * 1.05))
                b, g, r = (int(x) for x in cv2.cvtColor(np.uint8([[[h, s, v]]]),
                                                       cv2.COLOR_HSV2BGR)[0, 0])
                out.append({"points": [[int(x) + margin, int(y) + margin]
                                       for x, y in poly],
                            "color": _hex(b, g, r),
                            "area": area})

    out.sort(key=lambda f: -f["area"])                  # big blocks first
    return [{"points": f["points"], "color": f["color"]} for f in out]


# ---------------------------------------------------------------- misc
def shade_width(base: float) -> float:
    """Hatch lines are drawn thinner than the outline."""
    return round(max(1.0, base * 0.42), 2)
