"""书法笔迹 -> 一笔一划的运笔路径（给 overlay 那支毛笔用）。

overlay 原来是把整张笔迹图**从左往右揭开**——写是写出来了，但那是扫描仪在扫，
不是人握笔在写：笔尖在整列上下乱抖，笔画还是一条条"竖着长出来"的。

要像毛笔，得知道这一笔从哪儿起、往哪儿走、在哪儿收。这里从 AI 抠出来的
透明笔迹（`*_glyph.png`）反推运笔路径：

    alpha 阈值 → 开运算去掉飞白毛刺 → 闭运算把小缺口连上（只影响骨架，不动画面）
    → Zhang-Suen 细化成 1px 骨架 → trace_paths 顺着方向走过交叉点
    → 丢掉短碎片，按字切开后「先上后下、同层先左后右」排笔顺，
      每一笔再按自己的走向定起笔端（横从左起、竖撇捺点从上起）
    → 贴得近的相邻段接成一条（那是被交叉点切开的同一笔，不接会一直抬笔戳纸）
    → 重采样 + Chaikin 平滑 + RDP 精简（骨架锯齿必须磨掉，否则笔尖会抖）
    → 距离变换取每一笔的局部半径，笔锋粗细跟着走

实测「李雷」出 22 笔（真人 20 笔），「王小明」15 笔，够像了。

输出坐标就是 glyph 图的像素坐标，跟 overlay 里 `drawImage` 同一套坐标系，
前端乘个缩放就行。算一次 200~700ms，按文件名缓存在 `data/signatures/_writes.json`。
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import cv2
import numpy as np

from .strokes import _chaikin, _rdp_f, _resample, thin
from .tracing import trace_paths
from . import hanzi

ALPHA_MIN = 90          # 墨迹阈值。40 会把抠图时留的淡光晕也算进来，骨架就跑到字外面了
OPEN_K = 3              # 开运算：抹掉飞白碎点，不然骨架里全是小毛刺
CLOSE_K = 7             # 闭运算：把笔画里的小缺口连上，骨架才不会断成一节一节
MIN_LEN = 30.0          # 短于这个的骨架段当噪声丢掉
MERGE_GAP = 26.0        # 上一笔收笔离下一笔起笔这么近、方向又接得上，就算同一笔
STEP = 2.2              # 重采样步长（glyph 像素）
RDP_EPS = 0.55
MAX_POINTS = 1200       # 一张笔迹最多这么多点，防止长名字把 payload 撑爆
ORDER_VER = 4           # 笔顺算法改了就 +1，老缓存自动失效

_cache: dict[str, dict] = {}
_cache_path: Path | None = None


# ------------------------------------------------------------------ 缓存
def _store(glyph: Path) -> dict:
    global _cache_path
    if _cache_path is None:
        _cache_path = glyph.parent / "_writes.json"
        try:
            _cache.update(json.loads(_cache_path.read_text("utf-8")))
        except Exception:
            pass
    return _cache


def _flush() -> None:
    if _cache_path is None:
        return
    try:
        _cache_path.write_text(json.dumps(_cache, ensure_ascii=False), "utf-8")
    except Exception:
        pass


# ------------------------------------------------------------------ 提取
def _mask(glyph: Path, alpha_min: int = ALPHA_MIN) -> np.ndarray | None:
    rgba = cv2.imdecode(np.fromfile(str(glyph), np.uint8), cv2.IMREAD_UNCHANGED)
    if rgba is None:
        return None
    if rgba.ndim == 2:
        rgba = cv2.cvtColor(rgba, cv2.COLOR_GRAY2BGRA)
    elif rgba.shape[2] == 3:
        rgba = cv2.cvtColor(rgba, cv2.COLOR_BGR2BGRA)

    ink = (rgba[:, :, 3] > alpha_min).astype(np.uint8)
    if int(ink.sum()) < 40:
        return None
    ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN,
                           cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (OPEN_K, OPEN_K)))
    return cv2.morphologyEx(ink, cv2.MORPH_CLOSE,
                            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (CLOSE_K, CLOSE_K)))


def _columns(ink: np.ndarray, chars: int = 1) -> list[tuple[int, int]]:
    """把画面按字切开，返回 [(x0, x1), ...]。

    两个字之间的空白列就是天然分界；但书法字常常连得很近（「林晚」的撇都快蹭到
    下一个字了），整列全空的缝可能一条都没有。所以知道写的是几个字时，就按字数
    在最"墨少"的列上切——不切的话两个字会被当成一个字排笔顺，写的时候左边一撇
    右边一横同时冒出来，一眼就是瞎写。
    """
    w = int(ink.shape[1])
    if chars <= 1:
        return [(0, w)]
    col = ink.sum(axis=0).astype(np.float32)
    smooth = np.convolve(col, np.ones(5) / 5, mode="same")

    segs: list[tuple[int, int]] = [(0, w)]
    cuts: list[int] = []
    while len(cuts) < chars - 1:
        a, b = max(segs, key=lambda s: s[1] - s[0])
        lo, hi = a + (b - a) // 4, b - (b - a) // 4
        if hi <= lo:
            break
        x = lo + int(np.argmin(smooth[lo:hi]))
        if x <= a or x >= b:
            break
        cuts.append(x)
        segs.remove((a, b))
        segs += [(a, x), (x, b)]
    if not cuts:
        return [(0, w)]
    cuts.sort()
    bounds = [0] + cuts + [w]
    return [(bounds[i], bounds[i + 1]) for i in range(len(bounds) - 1)]


def _orient(pts: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """定起笔端——这一笔该从左起还是从上起。

    真人运笔的方向是有规矩的：横从左往右、竖/撇/捺/点都从上面起。
    原来按"离上一笔最近"来决定方向，结果横画从右往左写、竖画从下往上写，
    一眼就不像手写。这里只看这一笔自己的走向：

        竖直分量够大（撇、捺、竖、点）→ 从上面那个端点起笔
        几乎是横的（横、提）           → 从左面那个端点起笔
    """
    (x0, y0), (x1, y1) = pts[0], pts[-1]
    if abs(y1 - y0) >= abs(x1 - x0) * 0.7:
        return pts if y0 <= y1 else pts[::-1]
    return pts if x0 <= x1 else pts[::-1]


def _valley(ink: np.ndarray, a: int, b: int) -> int | None:
    """在一段里找"偏旁之间的缝"，返回那一列；不够空就返回 None。

    判断标准是这一列的墨量远低于平均——「林」的两半中间有这么一条缝，
    「李」上下两截之间没有（都压在中轴上），所以这个判断能自动区分左右结构
    和上下结构，不用给每个字写规则。
    """
    if b - a < 24:
        return None
    col = ink[:, a:b].sum(axis=0).astype(np.float32)
    sm = np.convolve(col, np.ones(3) / 3, mode="same")
    lo, hi = len(sm) // 4, len(sm) - len(sm) // 4
    if hi <= lo:
        return None
    i = lo + int(np.argmin(sm[lo:hi]))
    avg = float(sm.mean()) or 1.0
    if sm[i] > avg * 0.35:
        return None                                  # 不够空，整块当一个字
    if (sm[:i] > avg * 0.4).sum() < 2 or (sm[i:] > avg * 0.4).sum() < 2:
        return None                                  # 一边几乎没墨，切了也是错的
    return a + i


def _by_pen(items: list[tuple[list[tuple[float, float]], float, float]]):
    """从左上起笔，每次挑"最近的一笔"，往回爬要罚分。"""
    rest = list(items)
    pen = (min(g[1] for g in rest), min(g[2] for g in rest))
    out: list[list[tuple[float, float]]] = []
    while rest:
        def cost(g, pen=pen):
            start = g[0][0]
            up = max(0.0, pen[1] - start[1])          # 往回爬的幅度
            return math.dist(start, pen) + up * 4.0
        pick = min(rest, key=cost)
        out.append(pick[0])
        pen = pick[0][-1]
        rest.remove(pick)
    return out


def _order_region(ink: np.ndarray,
                  items: list[tuple[list[tuple[float, float]], float, float]],
                  a: int, b: int, depth: int = 0):
    """一段区域里的笔顺：能切成左右偏旁就先切左、再切右，否则就近落笔。

    「林」「晚」这种左右结构的字，只按距离排会写完左边一横就跳到右边去，
    看着像手在抖；切开以后就是老老实实先把左半边写完。
    """
    if depth < 2 and len(items) >= 5:
        v = _valley(ink, a, b)
        if v is not None:
            left = [g for g in items if (g[1] + max(q[0] for q in g[0])) / 2 < v]
            right = [g for g in items if g not in left]
            if len(left) >= 2 and len(right) >= 2:
                return (_order_region(ink, left, a, v, depth + 1)
                        + _order_region(ink, right, v, b, depth + 1))
    return _by_pen(items)


def _plan(raw: list[list[tuple[float, float]]],
          ink: np.ndarray, chars: int = 1,
          name: str = "") -> list[list[tuple[float, float]]]:
    """排笔顺：一个字一个字数过去，字内按真实笔顺（拿不到才退回几何猜测）。"""
    spans = _columns(ink, chars)
    groups: dict[int, list[tuple[list[tuple[float, float]], float, float]]] = {}
    for p in raw:
        xs = [q[0] for q in p]
        ys = [q[1] for q in p]
        cx = (min(xs) + max(xs)) / 2
        ci = next((i for i, (a, b) in enumerate(spans) if a <= cx <= b),
                  min(range(len(spans)),
                      key=lambda i: abs(cx - (spans[i][0] + spans[i][1]) / 2)))
        groups.setdefault(ci, []).append((_orient(p), min(xs), min(ys)))

    out: list[list[tuple[float, float]]] = []
    for ci in sorted(groups):
        a, b = spans[ci]
        items = groups[ci]
        # 有真实笔顺就照它排：田先竖再横折再横再竖再封口，火先中间长撇。
        # 拿不到（生僻字/网络断）就退回"切左右偏旁 + 就近落笔"，至少不停播。
        fixed = None
        if name and ci < len(name):
            try:
                # 字格：列范围 + 该范围里墨迹的上下界。
                # 不用笔画自己的包围盒——长撇甩出字格会把对齐整体拉偏。
                cell = ink[:, max(0, a):max(0, b)]
                rows = np.nonzero(cell.any(axis=1))[0]
                if len(rows):
                    fixed = hanzi.order([g[0] for g in items], name[ci],
                                        (float(a), float(rows.min()),
                                         float(b), float(rows.max())))
            except Exception:
                fixed = None
        out.extend(fixed if fixed else _order_region(ink, items, a, b))
    return out


def _dir(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.atan2(b[1] - a[1], b[0] - a[0])


def _tail_dir(pts: list[tuple[float, float]], k: int = 9) -> float:
    seg = pts[-k:] if len(pts) > k else pts
    return _dir(seg[0], seg[-1])


def _head_dir(pts: list[tuple[float, float]], k: int = 9) -> float:
    seg = pts[:k] if len(pts) > k else pts
    return _dir(seg[0], seg[-1])


def _angle_gap(a: float, b: float) -> float:
    d = abs((a - b + math.pi) % (2 * math.pi) - math.pi)
    return d


def _merge(paths: list[list[tuple[float, float]]]) -> list[list[tuple[float, float]]]:
    """收笔就在下一段起笔旁边、而且方向接得上，说明是一笔被交叉点/飞白切开了。

    只按距离接不够：木字的一横收笔和一竖起笔离得很近，硬接会把横和竖连成一笔，
    笔尖就会绕着拐角画一个直角。所以还要求"接过去的方向"跟这两段各自的走向都顺。
    """
    if not paths:
        return []
    out = [list(paths[0])]
    for p in paths[1:]:
        end, start = out[-1][-1], p[0]
        d = math.dist(end, start)
        if 0 < d <= MERGE_GAP:
            bridge = _dir(end, start)
            if max(_angle_gap(_tail_dir(out[-1]), bridge),
                   _angle_gap(_head_dir(p), bridge)) <= math.radians(62):
                out[-1].extend(p)
                continue
        elif d == 0:
            out[-1].extend(p)
            continue
        out.append(list(p))
    return out


def _dedupe(paths: list[list[tuple[float, float]]],
            tol: float = 5.0, cover: float = 0.8) -> list[list[tuple[float, float]]]:
    """去掉重复走过的路径。

    骨架上的环会让追踪器正着绕一圈、反着又绕一圈，同一段路走两遍，
    观众就会看到笔在原地重描。判定很简单：这一串点里有八成贴着另一串走过。
    """
    kept: list[list[tuple[float, float]]] = []
    for p in sorted(paths, key=lambda q: -len(q)):
        arr = np.array(p, dtype=np.float32)
        dup = False
        for k in kept:
            if abs(len(k) - len(p)) > max(6, int(len(p) * 0.6)):
                continue
            other = np.array(k, dtype=np.float32)
            d = np.linalg.norm(arr[:, None, :] - other[None, :, :], axis=2).min(axis=1)
            if float((d <= tol).mean()) >= cover:
                dup = True
                break
        if not dup:
            kept.append(p)
    return kept


def _fit_to_ink(med: list[list[tuple[float, float]]],
                box: tuple[float, float, float, float],
                out_dist: np.ndarray) -> tuple[float, float, float]:
    """把标准中线缩放+平移塞进这个字格，并用网格搜索微调。

    损失只用"墨外距离"（`out_dist`，落在墨里就是 0），再加一点位移罚分。
    不能用"越靠笔画中脊越好"当损失：粗笔画的脊很深，优化器会把整个字吸到最粗的
    那一块去（实测「田」的五笔全挤在左下角）。只在墨里这一条约束是够的——
    贴进墨里之后还有 `_snap` 逐点往脊上吸。
    """
    rx0, ry0, rx1, ry1 = hanzi._bbox(med)
    rw, rh = max(1e-6, rx1 - rx0), max(1e-6, ry1 - ry0)
    bx0, by0, bx1, by1 = box
    bw, bh = max(1e-6, bx1 - bx0), max(1e-6, by1 - by0)
    k0 = min(bw / rw, bh / rh)
    rcx, rcy = (rx0 + rx1) / 2, (ry0 + ry1) / 2
    bcx, bcy = (bx0 + bx1) / 2, (by0 + by1) / 2
    H, W = out_dist.shape

    flat = [(x, y) for st in med for x, y in st]
    scale = max(bw, bh)

    def cost(k: float, dx: float, dy: float) -> float:
        s = 0.0
        for x, y in flat:
            xi = int((x - rcx) * k + bcx + dx)
            yi = int((y - rcy) * k + bcy + dy)
            s += min(float(out_dist[yi, xi]), 18.0) if (0 <= yi < H and 0 <= xi < W) else 18.0
        # 位移/缩放都罚一点，避免为了多沾几滴墨把字整体拖走
        return s + 2.5 * math.hypot(dx, dy) + 40.0 * abs(k - k0) * scale

    best = (k0, 0.0, 0.0)
    bc = cost(*best)
    for k in (k0 * f for f in (0.72, 0.82, 0.92, 1.0, 1.08, 1.16, 1.26)):
        for dx in (-0.10 * bw, -0.05 * bw, 0.0, 0.05 * bw, 0.10 * bw):
            for dy in (-0.10 * bh, -0.05 * bh, 0.0, 0.05 * bh, 0.10 * bh):
                c = cost(k, dx, dy)
                if c < bc:
                    bc, best = c, (k, dx, dy)
    # 粗搜完在最优点附近再细搜一轮（±5% 缩放、±3% 位移）
    k, dx, dy = best
    for kk in (k * 0.96, k * 0.98, k, k * 1.02, k * 1.04):
        for ddx in (dx - 0.03 * bw, dx, dx + 0.03 * bw):
            for ddy in (dy - 0.03 * bh, dy, dy + 0.03 * bh):
                c = cost(kk, ddx, ddy)
                if c < bc:
                    bc, best = c, (kk, ddx, ddy)
    return best


def _snap(pts: list[tuple[float, float]], signed: np.ndarray,
          radius: int, pull: float = 1.1) -> list[tuple[float, float]]:
    """把每个点吸到附近的笔画脊上。

    等比缩放 + 平移只能对上大概位置（实测命中 50%~70%），剩下的差距是字形本身
    不一样（楷书的中线和书法成图的走向有出入）。所以在起点附近的小窗口里找一个
    "离墨脊最近、又别跑太远"的像素：`signed` 越小越靠脊，额外按位移罚一点分，
    免得一撇被吸到隔壁一横上去。
    """
    H, W = signed.shape
    out: list[tuple[float, float]] = []
    for x, y in pts:
        bx, by = int(round(x)), int(round(y))
        best, bx_best, by_best = 1e9, bx, by
        x0, x1 = max(0, bx - radius), min(W - 1, bx + radius)
        y0, y1 = max(0, by - radius), min(H - 1, by + radius)
        win = signed[y0:y1 + 1, x0:x1 + 1]
        yy, xx = np.mgrid[y0:y1 + 1, x0:x1 + 1]
        cost = win + pull * np.hypot(xx - x, yy - y)
        iy, ix = np.unravel_index(int(np.argmin(cost)), cost.shape)
        v = float(cost[iy, ix])
        if v < best:
            best, bx_best, by_best = v, x0 + ix, y0 + iy
        out.append((float(bx_best), float(by_best)))
    return out


def _med_writes(ink: np.ndarray, name: str, dist_in: np.ndarray
                ) -> list[dict] | None:
    """用「标准笔顺中线」直接当运笔路径。

    AI 成图（烫金/立体）笔画很粗，交汇处必然粘连，从骨架反推永远是"一笔绕一大圈"：
    实测「田火」被提成 8 段、「李雷」21 段，顺序怎么排都不可能对。
    但名字的每个字都有标准中线（`hanzi.medians`）——直接拿它当笔迹，
    **笔数和笔序 100% 正确**，只要把它贴合到这幅墨迹上（`_fit_to_ink`）。

    贴合度不够（落在墨里的点不到 80%）就返回 None，交回骨架那条路，不硬套。
    """
    n_char = len(name)
    spans = _columns(ink, n_char)
    if len(spans) < n_char:
        return None
    out_dist = cv2.distanceTransform((1 - ink).astype(np.uint8), cv2.DIST_L2, 5)
    signed = out_dist - dist_in

    writes: list[dict] = []
    total = hit = 0
    H, W = ink.shape
    for ci, (cx0, cx1) in enumerate(spans[:n_char]):
        med = hanzi.medians(name[ci])
        if not med:
            return None
        sub = ink[:, cx0:cx1 + 1]
        ys, xs = np.nonzero(sub)
        if not len(ys):
            return None
        box = (float(cx0 + xs.min()), float(ys.min()),
               float(cx0 + xs.max()), float(ys.max()))
        k, dx, dy = _fit_to_ink(med, box, out_dist)

        rx0, ry0, rx1, ry1 = hanzi._bbox(med)
        rcx, rcy = (rx0 + rx1) / 2, (ry0 + ry1) / 2
        bcx, bcy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        # 吸力窗口按字格大小给：字大能吸远一点，字小就贴着走
        rad = max(3, int(round(0.055 * max(box[2] - box[0], box[3] - box[1]))))

        for st in med:
            pts = [((x - rcx) * k + bcx + dx, (y - rcy) * k + bcy + dy)
                   for x, y in st]
            # 先抽稀到步长，再往墨脊上吸，然后平滑——顺序不能反：
            # 吸完再抽稀会把刚吸出来的形状又抹平。
            pts = _snap(_resample(pts, STEP), signed, rad)
            for x, y in pts:
                total += 1
                xi = min(W - 1, max(0, int(round(x))))
                yi = min(H - 1, max(0, int(round(y))))
                if signed[yi, xi] <= 6.0:
                    hit += 1
            sm = _rdp_f(_chaikin(pts, 2), RDP_EPS)
            if len(sm) < 2:
                continue
            ws = []
            for x, y in sm:
                xi = min(W - 1, max(0, int(round(x))))
                yi = min(H - 1, max(0, int(round(y))))
                ws.append(round(max(1.4, float(dist_in[yi, xi])), 2))
            writes.append({"pts": [[round(x, 1), round(y, 1)] for x, y in sm],
                           "ws": ws})

    if not total or hit / total < 0.92:
        return None
    # 点太多就按比例砍，别把 payload 撑爆（和骨架那条路的上限一致）
    while writes and sum(len(w["pts"]) for w in writes) > MAX_POINTS:
        writes.pop()
    return writes


def extract(glyph: Path | str, chars: int = 1,
            alpha_min: int = ALPHA_MIN, name: str = "",
            trace: str = "") -> list[dict]:
    """返回 [{"pts": [[x,y],...], "ws": [半径,...]}, ...]，坐标是 glyph 像素。

    `chars` 是要写的字有几个：知道字数才能正确地把画面切成一个个字来排笔顺。
    `name` 是名字本身——有了它才能按真实笔顺排（`app/pipeline/hanzi.py`），
    不给就只能几何猜。
    """
    glyph = Path(glyph)
    ink = _mask(glyph, alpha_min)
    if ink is None:
        return []
    # 笔画粗细直接量：到背景的距离就是这一点的半宽
    dist = cv2.distanceTransform(ink, cv2.DIST_L2, 5)

    # 知道名字、而且每个字都有标准笔顺：直接用中线当笔迹。
    # 这是唯一能保证"按真实笔顺写"的路——从骨架反推在粗笔画上必然粘连。
    # **默认不开**：中线得贴到成图的墨上，只有成图本身是楷书（笔画分开）时才贴得准；
    # 行书/连笔的成图贴不住，会画到空白处。要开就把 trace="medians" 传进来。
    if name and trace == "medians":
        try:
            fixed = _med_writes(ink, name, dist)
        except Exception:
            fixed = None
        if fixed:
            return fixed

    raw: list[list[tuple[float, float]]] = []
    for path in trace_paths(thin(ink)):
        pts = [(float(x), float(y)) for y, x in path]      # (row,col) -> (x,y)
        if len(pts) < 3:
            continue
        length = sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
        if length >= MIN_LEN:
            raw.append(pts)
    if not raw:
        return []
    raw = _dedupe(raw)

    writes: list[dict] = []
    total = 0
    for pts in _merge(_plan(raw, ink, chars, name)):
        sm = _rdp_f(_chaikin(_resample(pts, STEP), 2), RDP_EPS)
        if len(sm) < 2:
            continue
        if total + len(sm) > MAX_POINTS:
            break
        total += len(sm)
        ws = []
        for x, y in sm:
            xi = min(dist.shape[1] - 1, max(0, int(round(x))))
            yi = min(dist.shape[0] - 1, max(0, int(round(y))))
            ws.append(round(max(1.1, float(dist[yi, xi])), 2))
        writes.append({"pts": [[round(x, 1), round(y, 1)] for x, y in sm], "ws": ws})
    return writes


def writes_for(glyph: Path | str, chars: int = 1,
               alpha_min: int = ALPHA_MIN, name: str = "",
               trace: str = "") -> list[dict]:
    """带缓存：同一个 glyph 文件只算一次。

    `alpha_min` 是"多透明以下不算墨"。默认 90 适合抠图后的纯笔迹；
    烫金/浮雕那种带**投影**的图要抬到 190 左右，否则投影（alpha 约 115）
    会被当成笔画，笔会跑到字外面描影子。缓存键里带上它，避免两种门槛串味。

    `name` 只影响笔顺：换了排法缓存键就得变，否则拿到的还是旧顺序。
    """
    glyph = Path(glyph)
    if not glyph.exists():
        return []
    cache = _store(glyph)
    key = f"v{ORDER_VER}:{chars}:{alpha_min}:{name}:{trace}:{glyph.name}"
    try:
        mtime = glyph.stat().st_mtime
    except OSError:
        mtime = 0.0
    hit = cache.get(key)
    if hit and abs(float(hit.get("mtime") or 0) - mtime) < 1e-6:
        return hit.get("writes") or []
    writes = extract(glyph, chars, alpha_min, name, trace)
    if writes:
        cache[key] = {"mtime": mtime, "writes": writes}
        _flush()
    return writes
