"""字形墨迹 -> 有序笔迹。

为什么要自己写一套追踪，而不是直接用 `strokes._trace`：

`_trace()` 只在度为 2 的骨架上行走，一遇到交叉点（度 > 2）就停。这对照片描边是对的
——照片线条本来就碎。但**字形骨架几乎每个笔画都交叉**（"张"里面就有好几处），
于是每条笔都被切碎，再靠 `stitch()` 按距离缝合，缝出来的线经常横跨整个字，
最后得到一团谁也认不出的乱线。

这里的 `trace_paths()` 在交叉点**不停**：按"和当前方向夹角最小"挑下一个点继续走，
也就是模拟人写字时笔锋顺着笔画走。配合笔迹修剪（去掉骨架末端的小毛刺），
一个字就能得到接近真实笔顺的几条连续长线。
"""
from __future__ import annotations

import math

import numpy as np

from .strokes import thin

_N8 = ((-1, -1), (-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1))


def _plen(path: list[tuple[int, int]]) -> float:
    return sum(math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1])
               for i in range(len(path) - 1))


def trace_paths(skel: np.ndarray) -> list[list[tuple[int, int]]]:
    """1px skeleton -> polylines, choosing the straightest continuation at
    every junction instead of stopping there."""
    ys, xs = np.nonzero(skel)
    pts = set(zip(ys.tolist(), xs.tolist()))
    if not pts:
        return []
    nb = {p: [(p[0] + dy, p[1] + dx) for dy, dx in _N8
              if (p[0] + dy, p[1] + dx) in pts] for p in pts}
    deg = {p: len(v) for p, v in nb.items()}
    used: set[tuple] = set()

    def ek(a, b):
        return (a, b) if a < b else (b, a)

    def walk(start, first):
        path = [start, first]
        used.add(ek(start, first))
        while True:
            prev, cur = path[-2], path[-1]
            cands = [q for q in nb[cur] if q != prev and ek(cur, q) not in used]
            if not cands:
                break
            if len(cands) > 1:
                vy, vx = cur[0] - prev[0], cur[1] - prev[1]
                n = math.hypot(vy, vx) or 1.0

                def straight(q):
                    wy, wx = q[0] - cur[0], q[1] - cur[1]
                    m = math.hypot(wy, wx) or 1.0
                    return (vy * wy + vx * wx) / (n * m)

                cands.sort(key=straight, reverse=True)
            q = cands[0]
            used.add(ek(cur, q))
            if q == path[0]:                       # closed loop
                path.append(q)
                break
            path.append(q)
        return path

    paths: list[list[tuple[int, int]]] = []
    # Endpoints first: that is where a pen stroke actually starts.
    for p in sorted(pts):
        if deg[p] != 1:
            continue
        for q in nb[p]:
            if ek(p, q) not in used:
                paths.append(walk(p, q))
    # Then whatever is left (pure loops, e.g. 口 的闭合).
    for p in sorted(pts):
        for q in nb[p]:
            if ek(p, q) not in used:
                paths.append(walk(p, q))
    return paths


def _dedupe(path: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """Collapse repeated points.

    (An earlier version tried to trim "spurs" here by measuring the first and
    last three points -- which are always ~1px apart on a pixel skeleton, so it
    chewed every stroke down to three points. Spurs are handled by the length
    filter instead: a 5px dead-end branch simply never becomes a stroke.)
    """
    out = [path[0]]
    for p in path[1:]:
        if p != out[-1]:
            out.append(p)
    return out


def _order(strokes: list[list[tuple[int, int]]]) -> list[list[tuple[int, int]]]:
    """Nearest-endpoint ordering, starting from the top-left stroke.

    Not true 笔顺 (that needs stroke-order data we do not have), but it keeps
    the pen from hopping back and forth across the character, which is what
    reads as "wrong" far more than a slightly off stroke order does.
    """
    if not strokes:
        return []
    rest = list(strokes)
    rest.sort(key=lambda p: (p[0][0] + p[0][1] * 0.35))
    first = rest.pop(0)
    out = [first]
    pen = first[-1]
    while rest:
        best, best_d, best_rev = None, 1e18, False
        for p in rest:
            d0 = math.hypot(p[0][0] - pen[0], p[0][1] - pen[1])
            d1 = math.hypot(p[-1][0] - pen[0], p[-1][1] - pen[1])
            if d0 < best_d:
                best, best_d, best_rev = p, d0, False
            if d1 < best_d:
                best, best_d, best_rev = p, d1, True
        rest = [p for p in rest if p is not best]
        if best_rev:
            best = list(reversed(best))
        out.append(best)
        pen = best[-1]
    return out


def ink_to_strokes(ink: np.ndarray, min_len: float = 9.0,
                   close_px: int = 3) -> list[list[tuple[int, int]]]:
    """Binary/greyscale ink -> ordered polylines in ink pixel coordinates."""
    import cv2

    b = (ink > 28).astype(np.uint8)
    if close_px > 1:
        # Anti-aliased edges leave pinholes that thinning turns into loops.
        b = cv2.morphologyEx(b, cv2.MORPH_CLOSE,
                             np.ones((close_px, close_px), np.uint8))
    skel = thin(b > 0)
    raw = [_dedupe(p) for p in trace_paths(skel) if _plen(p) >= min_len]
    raw = [p for p in raw if _plen(p) >= min_len]
    return _order(raw)
