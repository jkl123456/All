"""真实笔顺：用 hanzi-writer 的标准中线校正"先写哪一笔、从哪头起笔"。

## 为什么需要它

现在骨架反推出来的笔顺只能靠几何猜（`brush._order_region`：切左右偏旁 + 就近落笔）。
猜不对是必然的：

    「田」会先画外框再填里面（真人最后才封口）
    「火」会先点左边的点再跳去右边（真人先中间长撇）
    「口」会绕一圈画完（真人三笔：竖、横折、横）

观众不一定说得出哪里不对，但"这笔怎么从这儿起"的违和感是看得见的。

## 怎么接进来

**不改轨迹，只改顺序。** 笔画仍然是原来那套从成图骨架上提的路径——
这样才能保证"笔走过的位置"和"最后渐显出来的字"完全对上。
这里只负责回答两个问题：

1. 这么多笔，谁先谁后？  → 和标准中线做匹配，按标准笔序输出
2. 这一笔从哪头起笔？    → 靠标准中线的起点端决定，比"横从左起"的规则准

匹配的代价 = 段与标准中线之间的双向平均距离（对方向不敏感，只看形状位置），
用贪心最小权配对。笔画数不等也能用：多出来的段按位置插在旁边，
落空的标准笔直接跳过。

## 数据从哪来

    https://unpkg.com/hanzi-writer-data@2.0.1/{字}.json
      strokes  笔画轮廓（按笔顺）
      medians  笔画中线点列（按笔顺），1024×1024，y 向下，基线约 y=900

字形数据来自 Make Me a Hanzi（Arphic Public License，可商用）。
第一次遇到某个字才联网（约 2KB），存进 `data/strokes/{字}.json`，之后永久本地。
拿不到就返回 None，调用方原样退回老算法——**这条路永远不允许拖住直播**。
"""
from __future__ import annotations

import json
import math
import time
from pathlib import Path

import httpx
import numpy as np

ROOT = Path(__file__).resolve().parent.parent.parent
CACHE = ROOT / "data" / "strokes"
API = "https://unpkg.com/hanzi-writer-data@2.0.1/{}.json"
MIRROR = "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/{}.json"

TIMEOUT = 2.5           # 单字下载最多等这么久，宁可这次用老算法
RETRY_AFTER = 300.0     # 下载失败的字，5 分钟内不再重试（否则每个名字都白等 2.5s）
SAMPLE = 24             # 匹配时每条线重采样成这么多点
MAX_COST = 0.30         # 归一化代价超过这个的配对不采信（按字宽的比例）

_mem: dict[str, list[list[tuple[float, float]]] | None] = {}
_failed: dict[str, float] = {}


# ------------------------------------------------------------------ 取数据
def _read_local(ch: str) -> list[list[tuple[float, float]]] | None:
    p = CACHE / f"{ch}.json"
    if not p.exists():
        return None
    try:
        d = json.loads(p.read_text("utf-8"))
    except Exception:
        return None
    return _medians_of(d)


def _medians_of(d: dict) -> list[list[tuple[float, float]]] | None:
    med = d.get("medians") or []
    out: list[list[tuple[float, float]]] = []
    for m in med:
        pts = [(float(p[0]), float(p[1])) for p in m if len(p) >= 2]
        if len(pts) >= 2:
            out.append(pts)
    return out or None


def _download(ch: str) -> list[list[tuple[float, float]]] | None:
    for tpl in (API, MIRROR):
        try:
            r = httpx.get(tpl.format(ch), timeout=TIMEOUT,
                          headers={"User-Agent": "zhibo-sign/1.0"})
            if r.status_code != 200:
                continue
            d = r.json()
            med = _medians_of(d)
            if not med:
                continue
            CACHE.mkdir(parents=True, exist_ok=True)
            (CACHE / f"{ch}.json").write_text(
                json.dumps(d, ensure_ascii=False), encoding="utf-8")
            return med
        except Exception:
            continue
    return None


def medians(ch: str) -> list[list[tuple[float, float]]] | None:
    """某个字的标准笔顺中线。拿不到返回 None（不抛异常）。"""
    if not ch or not ("\u4e00" <= ch <= "\u9fff"):
        return None                      # 英文/数字/符号没有笔顺数据，别去网上白问一遍
    if ch in _mem:
        return _mem[ch]
    got = _read_local(ch)
    if got is None:
        t = _failed.get(ch)
        if t is not None and time.time() - t < RETRY_AFTER:
            _mem[ch] = None
            return None
        got = _download(ch)
        if got is None:
            _failed[ch] = time.time()
    _mem[ch] = got
    return got


def prefetch(text: str) -> None:
    """把一串字里还没缓存的先抓下来（后台线程调，别在生成路径上调）。

    并发抓：一个字一次往返约 1.4 秒，名字两三个字串行就是四五秒，太久。
    这里开小线程池并行，两三个字同时抓，实际耗时约等于最慢的那个。
    """
    todo = [ch for ch in dict.fromkeys(text)
            if "\u4e00" <= ch <= "\u9fff" and ch not in _mem
            and not (CACHE / f"{ch}.json").exists()]
    if not todo:
        return
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=min(4, len(todo))) as ex:
        list(ex.map(medians, todo))


def available(text: str) -> bool:
    """这串字的标准笔顺是否全都拿得到（决定要不要走新算法）。"""
    return all(medians(ch) for ch in text if "\u4e00" <= ch <= "\u9fff")


def paths(ch: str, box: tuple[float, float, float, float]
          ) -> list[list[tuple[float, float]]] | None:
    """把某个字的标准中线摆到 `box` 这个字格里，可以直接当运笔轨迹用。

    只给**自己画字**的场景用（`signature.render`：成图就是这些笔画画出来的，
    所以轨迹和成图天然一致）。AI 成图那条路不能用这个——轨迹必须从成图提，
    否则笔写完渐显出来的字和笔走过的地方对不上。
    """
    ref = medians(ch)
    if not ref:
        return None
    return _fit(ref, box)


# ------------------------------------------------------------------ 几何工具
def _resample(pts: list[tuple[float, float]], n: int) -> list[tuple[float, float]]:
    if len(pts) == 1:
        return [pts[0]] * n
    cum = [0.0]
    for i in range(1, len(pts)):
        cum.append(cum[-1] + math.dist(pts[i - 1], pts[i]))
    total = cum[-1]
    if total <= 1e-9:
        return [pts[0]] * n
    out: list[tuple[float, float]] = []
    j = 0
    for i in range(n):
        target = total * i / (n - 1)
        while j < len(cum) - 2 and cum[j + 1] < target:
            j += 1
        span = cum[j + 1] - cum[j]
        t = 0.0 if span <= 1e-9 else (target - cum[j]) / span
        a, b = pts[j], pts[j + 1]
        out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out


def _bbox(paths: list[list[tuple[float, float]]]) -> tuple[float, float, float, float]:
    xs = [p[0] for s in paths for p in s]
    ys = [p[1] for s in paths for p in s]
    return min(xs), min(ys), max(xs), max(ys)


def _fit(ref: list[list[tuple[float, float]]],
         box: tuple[float, float, float, float],
         ) -> list[list[tuple[float, float]]]:
    """把标准中线等比缩放 + 平移到待匹配笔画的包围盒里。

    **y 要先翻转**：hanzi-writer 的数据是 y 向上为正（基线在 y=0 上方，
    数值越大越靠上），图像坐标是 y 向下。不翻的话整个字会上下镜像——
    「李」的底部横会被当成第一笔，写出来就是从下往上倒着写。
    """
    ref = [[(x, -y) for x, y in s] for s in ref]
    rx0, ry0, rx1, ry1 = _bbox(ref)
    bx0, by0, bx1, by1 = box
    rw, rh = max(1e-6, rx1 - rx0), max(1e-6, ry1 - ry0)
    bw, bh = max(1e-6, bx1 - bx0), max(1e-6, by1 - by0)
    k = min(bw / rw, bh / rh)
    ox = (bx0 + bx1) / 2 - (rx0 + rx1) / 2 * k
    oy = (by0 + by1) / 2 - (ry0 + ry1) / 2 * k
    return [[(x * k + ox, y * k + oy) for x, y in s] for s in ref]


def _cost(a: list[tuple[float, float]], b: list[tuple[float, float]]) -> float:
    """两条线的平均距离（方向不敏感：正反都试一遍）。已归一化到 [0,1] 尺度由调用方负责。"""
    pa = _resample(a, SAMPLE)
    pb = _resample(b, SAMPLE)
    d1 = sum(math.dist(pa[i], pb[i]) for i in range(SAMPLE)) / SAMPLE
    d2 = sum(math.dist(pa[i], pb[SAMPLE - 1 - i]) for i in range(SAMPLE)) / SAMPLE
    return min(d1, d2)


# ------------------------------------------------------------------ 主入口
def order(pieces: list[list[tuple[float, float]]], ch: str,
          box: tuple[float, float, float, float] | None = None
          ) -> list[list[tuple[float, float]]] | None:
    """按真实笔顺重排这一组笔画，并把每一笔的方向摆正。

    `pieces` 是同一个字里已经提取出来的笔画路径（顺序无所谓）。
    `box` 是这个字的字格 (x0, y0, x1, y1)，不传就用笔画的包围盒。

    为什么要传字格：书法字常有长撇长捺甩到字格外（「李」的一撇探出半个字），
    用笔画包围盒对齐，标准字形会被压扁、整体错位，配出来的顺序也就散了。
    字格是稳定的，对齐才靠得住。

    返回排好序、定好起笔端的路径；拿不到标准笔顺就返回 None。

    ## 为什么不用"一段配一笔"

    从艺术字/书法字上提笔画，骨架经常把一笔切成好几段（实测「李」被切成 8 段，
    真人只有 7 笔），笔画数对不上，一对一配对必然配错：一截「子」的横会被配到
    「木」的第一横上，顺序就全乱了。

    这里改用一个更稳的办法——**书写时间场**：

        标准中线上的每一个点都带一个时间 t（第几笔 + 这笔走到的位置，归一到 0~1）
        每一段笔画，取它上面各点"最近的标准点"的 t 的中位数
        按 t 排序 → 就是这个字真实的书写先后

    好处是碎段和多段并成一段都不影响：同一笔的两截 t 相近，自然挨在一起；
    跨两笔的长段取中位数，也落在合理位置。笔画数完全不必相等。
    """
    ref = medians(ch)
    if not ref or not pieces:
        return None

    if box is None:
        box = _bbox(pieces)
    fitted = _fit(ref, box)                     # 标准中线缩放到这个字的字格

    # 标准中线 -> 稠密点集，每个点带书写时间 t（第 j 笔 + 这笔走到哪 / 总笔数）
    weights = []
    for s in ref:
        weights.append(sum(math.dist(s[i], s[i + 1]) for i in range(len(s) - 1)) or 1.0)
    total_w = sum(weights) or 1.0

    pts_xy: list[tuple[float, float]] = []
    pts_t: list[float] = []
    for j, s in enumerate(fitted):
        n = max(8, min(60, int(weights[j] / total_w * 160)))
        for i, (x, y) in enumerate(_resample(s, n)):
            pts_xy.append((x, y))
            pts_t.append((j + (i / (n - 1) if n > 1 else 0.0)) / len(fitted))
    arr = np.array(pts_xy, dtype="float32")
    ts = np.array(pts_t, dtype="float32")

    def times_of(seg: list[tuple[float, float]]) -> tuple[float, float]:
        """这一段的书写时间（中位数）和平均最近距离（衡量配得准不准）。"""
        q = np.array(_resample(seg, max(6, min(28, len(seg)))), dtype="float32")
        d = np.linalg.norm(arr[None, :, :] - q[:, None, :], axis=2)
        idx = d.argmin(axis=1)
        return float(np.median(ts[idx])), float(d.min(axis=1).mean())

    scored = [(*times_of(p), p) for p in pieces]
    scored.sort(key=lambda x: x[0])

    # 起笔端：这一段起点/终点各自离哪个标准点最近，时间早的那头就是起笔。
    out: list[list[tuple[float, float]]] = []
    for t, dist, p in scored:
        head, _ = times_of(p[:max(2, len(p) // 5)])
        tail, _ = times_of(p[-max(2, len(p) // 5):])
        out.append(list(p) if head <= tail else list(reversed(p)))
    return out or None
