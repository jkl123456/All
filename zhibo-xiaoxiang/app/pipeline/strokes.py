"""Bitmap line-art -> ordered pen strokes.

No scikit-image dependency: thinning is implemented in numpy (Zhang-Suen),
then the 1px skeleton is traced into polylines, ordered greedily so the pen
travels a short distance between strokes.
"""
from __future__ import annotations

import math
from typing import Iterable

import numpy as np

# ---------------------------------------------------------------- thinning
_N8 = ((-1, -1), (-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1))


def thin(binary: np.ndarray, max_iter: int = 60) -> np.ndarray:
    """Zhang-Suen thinning, fully vectorised."""
    img = (binary > 0).astype(np.uint8)
    for _ in range(max_iter):
        changed = False
        for step in (0, 1):
            p = np.pad(img, 1)
            P2, P3, P4 = p[0:-2, 1:-1], p[0:-2, 2:], p[1:-1, 2:]
            P5, P6, P7 = p[2:, 2:], p[2:, 1:-1], p[2:, 0:-2]
            P8, P9 = p[1:-1, 0:-2], p[0:-2, 0:-2]
            B = P2 + P3 + P4 + P5 + P6 + P7 + P8 + P9
            seq = (P2, P3, P4, P5, P6, P7, P8, P9, P2)
            A = np.zeros(img.shape, dtype=np.uint8)
            for i in range(8):
                A += ((seq[i] == 0) & (seq[i + 1] == 1)).astype(np.uint8)
            if step == 0:
                cond = (img == 1) & (B >= 2) & (B <= 6) & (A == 1) \
                       & (P2 * P4 * P6 == 0) & (P4 * P6 * P8 == 0)
            else:
                cond = (img == 1) & (B >= 2) & (B <= 6) & (A == 1) \
                       & (P2 * P4 * P8 == 0) & (P2 * P6 * P8 == 0)
            if cond.any():
                img[cond] = 0
                changed = True
        if not changed:
            break
    return img.astype(bool)


# ---------------------------------------------------------------- tracing
def _neighbours(y: int, x: int, pts: set) -> list[tuple[int, int]]:
    out = []
    for dy, dx in _N8:
        q = (y + dy, x + dx)
        if q in pts:
            out.append(q)
    return out


def _trace(skel: np.ndarray) -> list[list[tuple[int, int]]]:
    ys, xs = np.nonzero(skel)
    pts = set(zip(ys.tolist(), xs.tolist()))
    deg = {p: len(_neighbours(*p, pts)) for p in pts}
    used: set[frozenset] = set()
    paths: list[list[tuple[int, int]]] = []

    def edge(a, b):
        return frozenset((a, b))

    def walk(start, first):
        path = [start, first]
        used.add(edge(start, first))
        prev, cur = start, first
        while deg.get(cur, 0) == 2:
            nxt = [q for q in _neighbours(*cur, pts) if q != prev]
            if not nxt:
                break
            q = nxt[0]
            if edge(cur, q) in used:
                break
            used.add(edge(cur, q))
            path.append(q)
            prev, cur = cur, q
        return path

    # start from endpoints / junctions first
    for p in sorted(pts, key=lambda t: (t[0], t[1])):
        if deg[p] == 2:
            continue
        for nb in _neighbours(*p, pts):
            if edge(p, nb) not in used:
                paths.append(walk(p, nb))

    # remaining closed loops
    for p in pts:
        for nb in _neighbours(*p, pts):
            if edge(p, nb) not in used:
                paths.append(walk(p, nb))
    return paths


# ---------------------------------------------------------------- simplify
def _rdp(points: list[tuple[int, int]], eps: float) -> list[tuple[int, int]]:
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = math.hypot(dx, dy)
    best_i, best_d = -1, -1.0
    for i in range(1, len(points) - 1):
        x0, y0 = points[i]
        if norm == 0:
            d = math.hypot(x0 - x1, y0 - y1)
        else:
            d = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / norm
        if d > best_d:
            best_i, best_d = i, d
    if best_d > eps:
        return _rdp(points[:best_i + 1], eps)[:-1] + _rdp(points[best_i:], eps)
    return [points[0], points[-1]]


def _length(path: Iterable[tuple[int, int]]) -> float:
    p = list(path)
    return sum(math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1])
               for i in range(len(p) - 1))


# ---------------------------------------------------------------- smoothing
def _dedupe(pts: list[tuple[float, float]]) -> list[tuple[float, float]]:
    out = [pts[0]]
    for p in pts[1:]:
        if _dist(p, out[-1]) > 1e-6:
            out.append(p)
    return out


def _resample(pts: list[tuple[float, float]], step: float) -> list[tuple[float, float]]:
    """Constant-speed resampling: the 8-neighbourhood skeleton is quantised to
    whole pixels, so raw vertex spacing is irregular and any later smoothing
    would be biased toward the slow bits."""
    if len(pts) < 2:
        return pts
    out = [pts[0]]
    carry = 0.0
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        seg = _dist(a, b)
        if seg < 1e-9:
            continue
        pos = step - carry
        while pos <= seg:
            t = pos / seg
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
            pos += step
        carry = seg - (pos - step)
    if _dist(out[-1], pts[-1]) > step * 0.35:
        out.append(pts[-1])
    else:
        out[-1] = pts[-1]
    return out


def _chaikin(pts: list[tuple[float, float]], iters: int = 2) -> list[tuple[float, float]]:
    """Corner cutting. A skeleton is a staircase; a hand never draws stairs.
    Endpoints are preserved so the pen still starts and stops where it should."""
    for _ in range(iters):
        if len(pts) < 3:
            return pts
        out = [pts[0]]
        for i in range(len(pts) - 1):
            p, q = pts[i], pts[i + 1]
            out.append((0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]))
            out.append((0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]))
        out.append(pts[-1])
        pts = out
    return pts


def smooth_path(path: list[tuple[int, int]], scale: float, ox: float, oy: float,
                step: float = 3.2, iters: int = 2) -> list[tuple[float, float]]:
    """Skeleton polyline -> smooth curve in canvas coordinates."""
    pts = [(x * scale + ox, y * scale + oy) for y, x in path]
    pts = _dedupe(pts)
    if len(pts) < 3:
        return pts
    pts = _resample(pts, step)
    return _chaikin(pts, iters)


def _rdp_f(points: list[tuple[float, float]], eps: float) -> list[tuple[float, float]]:
    """Douglas-Peucker on float points (the int version above is kept for the
    legacy call sites)."""
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = math.hypot(dx, dy)
    best_i, best_d = -1, -1.0
    for i in range(1, len(points) - 1):
        x0, y0 = points[i]
        d = (math.hypot(x0 - x1, y0 - y1) if norm == 0
             else abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / norm)
        if d > best_d:
            best_i, best_d = i, d
    if best_d > eps:
        return (_rdp_f(points[:best_i + 1], eps)[:-1]
                + _rdp_f(points[best_i:], eps))
    return [points[0], points[-1]]


# ---------------------------------------------------------------- stitching
def _dist(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def stitch(strokes: list[list[tuple[int, int]]], max_gap: float = 14.0) -> list[list[tuple[int, int]]]:
    """Join strokes whose endpoints are close.

    Canny edges are fragmented, and a skeleton breaks at every junction, so the
    raw trace is a pile of short dashes. A real hand does not lift the pen that
    often: merging nearby pieces makes the drawing continuous and cuts the
    number of pen jumps.

    Endpoints are bucketed into max_gap-sized cells so each pass only compares
    neighbouring ends instead of every pair (O(n) instead of O(n^2)).
    """
    chains = [list(s) for s in strokes]
    n = len(chains)
    if n < 2:
        return chains
    fl = [False] * n          # front end locked
    bl = [False] * n          # back end locked

    while True:
        grid: dict[tuple[int, int], list] = {}
        for i, ch in enumerate(chains):
            if ch is None:
                continue
            for ei in (0, 1):
                if (ei == 0 and fl[i]) or (ei == 1 and bl[i]):
                    continue
                p = ch[0] if ei == 0 else ch[-1]
                grid.setdefault((int(p[0] // max_gap), int(p[1] // max_gap)),
                                []).append((i, ei, p))

        best: tuple[float, tuple | None] = (max_gap, None)
        for cell, items in grid.items():
            near: list = []
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    near.extend(grid.get((cell[0] + dx, cell[1] + dy), ()))
            for i, ei, p in items:
                for j, ej, q in near:
                    if i == j:
                        continue
                    d = _dist(p, q)
                    if d < best[0]:
                        best = (d, (i, ei, j, ej))
        if best[1] is None:
            break

        i, ei, j, ej = best[1]
        a, b = chains[i], chains[j]
        if ei == 0:
            a.reverse()
            fl[i], bl[i] = bl[i], fl[i]
        if ej == 1:
            b.reverse()
            fl[j], bl[j] = bl[j], fl[j]
        chains[i] = a + b
        chains[j] = None
        fl[i], bl[i] = fl[i], bl[j]

    return [c for c in chains if c]


# ---------------------------------------------------------------- main api
def image_to_strokes(ink: np.ndarray, canvas: int = 900, min_len: float = 8.0,
                     simplify: float = 1.6, margin: int = 24,
                     stitch_gap: float = 14.0, base_width: float = 0.0,
                     smooth_iters: int = 2) -> dict:
    """ink: 2D bool/uint8 array, True = ink. Returns drawing payload dict."""
    h, w = ink.shape[:2]
    scale = (canvas - 2 * margin) / max(h, w)
    # order strokes: start where the pen naturally starts (top-left region)
    skel = thin(ink)
    raw = [p for p in _trace(skel) if _length(p) >= min_len]
    if stitch_gap > 0:
        raw = stitch(raw, max_gap=stitch_gap / max(scale, 1e-6))
    raw.sort(key=lambda p: (p[0][0], p[0][1]))

    ordered: list[list[tuple[int, int]]] = []
    remaining = raw
    pen = (-1e9, -1e9)
    while remaining:
        best = min(remaining, key=lambda p: min(
            math.hypot(p[0][0] - pen[0], p[0][1] - pen[1]),
            math.hypot(p[-1][0] - pen[0], p[-1][1] - pen[1])))
        if math.hypot(best[-1][0] - pen[0], best[-1][1] - pen[1]) < \
           math.hypot(best[0][0] - pen[0], best[0][1] - pen[1]):
            best.reverse()
        ordered.append(best)
        pen = best[-1]
        remaining = [p for p in remaining if p is not best]

    ox = (canvas - w * scale) / 2
    oy = (canvas - h * scale) / 2
    strokes = []
    widths: list[float] = []
    total = 0.0
    for path in ordered:
        sm = smooth_path(path, scale, ox, oy, iters=smooth_iters)
        if len(sm) < 2:
            continue
        pts = _rdp_f(sm, max(0.4, simplify))
        if len(pts) < 2:
            continue
        seg = _length(pts)
        if seg < max(2.0, min_len * scale * 0.6):
            continue
        total += seg
        strokes.append([[round(p[0], 1), round(p[1], 1)] for p in pts])
        # Pressure: structural lines are drawn heavier than facial detail. A
        # uniform pen width is the main reason a plotter drawing looks printed.
        if base_width > 0:
            widths.append(round(max(1.2, base_width * (0.70 + min(0.60, seg / 520.0))), 2))

    out = {"size": [canvas, canvas], "strokes": strokes,
           "total_len": round(total, 1), "stroke_count": len(strokes)}
    if widths:
        out["widths"] = widths
    return out
