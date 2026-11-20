"""一张图里写了 N 个名字：按行切开，一人一份。

为什么要"一批一张"：
豆包写一次要十几秒，而直播里观众是一个接一个进来的。一个人一张的话，
第 5 个人要等一分多钟，队列越排越长。所以改成：一次把最多 5 个名字交给它，
让它按模板风格竖着写成一列，回来再按行切开——一次生成，五个人分。

切分的几个约束（都是踩出来的）：
* 白底、深墨绿笔迹：alpha 直接用亮度算（复用 glyphcut.alpha_from_light），
  不用色键——飞白边缘会被色键啃掉。
* 行与行之间有空白，但 AI 偶尔会把两行挨得很近，甚至把某一笔伸到上一行。
  所以先按行投影找"墨带"，再把粘连的带按 n 等分兜底，宁可切偏一点也不能少人。
* 颜色要反预乘回纯墨色，否则边缘一圈发白，贴到深绿背景上像描了边。

坐标约定：
  返回的 box 已经是播放坐标系（1080 宽）里的字框，overlay 直接拿去用；
  `place_box` 决定"贴在背景的哪儿"——现在这张背景中间本来就留白，
  所有名字都按同一个中心、同一套最大宽高摆放，看起来是同一个字位。
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from .glyphcut import alpha_from_light

PAD = 6                 # 抠图时四周留一点，飞白才不会被切掉
ALPHA_KEEP = 0.02       # 低于这个 alpha 的像素直接透明

# 默认字位：1080x1920 画布里，背景中间那条留白带（实测 y 800~1180）
PLACE = {"cx": 540, "cy": 990, "max_w": 820, "max_h": 330}


def _imread(p: Path | str) -> np.ndarray | None:
    return cv2.imdecode(np.fromfile(str(p), np.uint8), cv2.IMREAD_COLOR)


def _imwrite(p: Path | str, img: np.ndarray) -> None:
    """cv2.imwrite 遇到中文路径会静默失败，必须走 imencode。"""
    p = Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    ok, buf = cv2.imencode(p.suffix or ".png", img)
    if not ok:
        raise RuntimeError(f"编码失败: {p}")
    p.write_bytes(buf.tobytes())


def _runs(mass: np.ndarray, thr: float, min_gap: int) -> list[tuple[int, int, float]]:
    """一维墨量 -> 连续的墨带 [(起, 止, 墨量)]，间隔小于 min_gap 的合并。"""
    on = mass > thr
    bands: list[tuple[int, int]] = []
    y = 0
    n = len(on)
    while y < n:
        if not on[y]:
            y += 1
            continue
        y0 = y
        while y < n and on[y]:
            y += 1
        bands.append((y0, y))
    merged: list[list[int]] = []
    for a, b in bands:
        if merged and a - merged[-1][1] < min_gap:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    return [(a, b, float(mass[a:b].sum())) for a, b in merged]


def _cut(occ: np.ndarray, n: int, thr: int = 1) -> list[tuple[int, int]]:
    """在一条轴线上切 n 段。

    不是"有空隙就切"那么简单：名字之间的缝宽、字与字之间的缝窄，两者都会出现；
    模型还常常把"竖着排"写成"横着一行"。所以先定墨迹范围，再按"期望位置附近
    最宽的那条缝"依次下刀——第 i 刀理想位置是 ink*n_i/n。

    关键是**单调**：每刀必须落在上一刀右边至少 min_sep 处。否则两刀的搜索窗口
    重叠，会把同一条缝挑两次，切出一段宽度为 0 的碎片（少一个人）。
    """
    idx = np.where(occ > thr)[0]
    if not len(idx):
        return []
    a0, a1 = int(idx.min()), int(idx.max()) + 1
    if n <= 1:
        return [(a0, a1)]

    span = a1 - a0
    step = span / n
    min_sep = max(4, int(step * 0.25))
    win = step * 0.7

    empty: list[tuple[int, int]] = []
    run = None
    for x in range(a0, a1):
        if occ[x] <= thr:
            run = x if run is None else run
        else:
            if run is not None:
                empty.append((run, x))
                run = None
    if run is not None:
        empty.append((run, a1))

    cuts: list[int] = []
    prev = a0
    for i in range(1, n):
        low = prev + min_sep
        high = a1 - min_sep * (n - i)
        want = a0 + step * i
        cand = [g for g in empty
                if low <= (g[0] + g[1]) / 2 <= high
                and abs((g[0] + g[1]) / 2 - want) <= win]
        if cand:
            # 先看缝的宽度，宽度差不多时取离理想位置近的
            g = max(cand, key=lambda g: ((g[1] - g[0]) / max(1.0, abs((g[0] + g[1]) / 2 - want) + 6)))
            c = (g[0] + g[1]) // 2
        else:
            c = int(round(min(max(want, low), high)))
        cuts.append(c)
        prev = c

    bounds = [a0] + cuts + [a1]
    return [(bounds[i], bounds[i + 1]) for i in range(n)]


def _rgba(crop: np.ndarray, ca: np.ndarray) -> np.ndarray:
    """白底裁片 + alpha -> 反预乘的 RGBA。"""
    f = np.maximum(ca[..., None], 1e-3)
    rgb = np.clip((crop.astype(np.float32) - 255 * (1 - f)) / f, 0, 255)
    rgba = np.dstack([rgb, (ca * 255)]).astype(np.uint8)
    rgba[ca < ALPHA_KEEP] = 0
    return rgba


def split(sheet: Path | str, names: list[str],
          out_dir: Path | str | None = None,
          stem: str = "", tag: str = "") -> list[dict]:
    """把一张"一列名字"的成图切成 len(names) 份透明笔迹。

    返回 [{"name", "glyph", "w", "h"}]，顺序和 names 对齐；
    切不出来（墨量不够 / 图坏了）返回 []，调用方退回本地笔画。
    """
    sheet = Path(sheet)
    img = _imread(sheet)
    if img is None or not names:
        return []
    a = alpha_from_light(img)
    if float(a.max()) < 0.25:
        return []
    H, W = a.shape[:2]
    n = len(names)

    # 1) 先看墨迹的整体形状：名字是一个个横排的，所以"n 个名字竖着排"应该是高高的
    #    一张图；如果回来的是横向的一大条，说明模型把所有名字写成了一行——
    #    那就按列切。两种排版都认，不跟模型的脾气较劲。
    ys, xs = np.where(a > 0.10)
    if not len(xs):
        return []
    iw = int(xs.max()) - int(xs.min()) + 1
    ih = int(ys.max()) - int(ys.min()) + 1
    # 阈值取 2：名字是横排的宽字块，所以"n 个名字竖着排"的图整体仍偏宽（约 2/n），
    # "n 个名字写成一行"则宽高比接近 2n。2 正好是这两种排版的几何中点，
    # 跟 n 无关，2 字名、5 字名都判得对。
    by_col = n > 1 and iw / max(1, ih) > 2.0

    occ = (a > 0.15).sum(axis=0 if by_col else 1)
    cuts = _cut(occ, n, 1)
    if not cuts:
        return []

    out_dir = Path(out_dir or sheet.parent)
    out_dir.mkdir(parents=True, exist_ok=True)
    got: list[dict] = []
    for i, (c0, c1) in enumerate(cuts):
        sub = a[:, c0:c1] if by_col else a[c0:c1, :]
        if not (sub > 0.06).any():
            continue
        cols = np.where((sub > 0.06).any(axis=0))[0]
        rows = np.where((sub > 0.06).any(axis=1))[0]
        if not len(cols) or not len(rows):
            continue
        if by_col:
            x0 = max(0, c0 + int(cols.min()) - PAD)
            x1 = min(W, c0 + int(cols.max()) + PAD + 1)
            y0 = max(0, int(rows.min()) - PAD)
            y1 = min(H, int(rows.max()) + PAD + 1)
        else:
            y0 = max(0, c0 + int(rows.min()) - PAD)
            y1 = min(H, c0 + int(rows.max()) + PAD + 1)
            x0 = max(0, int(cols.min()) - PAD)
            x1 = min(W, int(cols.max()) + PAD + 1)
        rgba = _rgba(img[y0:y1, x0:x1], a[y0:y1, x0:x1])
        name = names[i] if i < len(names) else f"n{i + 1}"
        safe = "".join(ch for ch in name if ch.isalnum())[:12] or "sig"
        base = stem or sheet.stem
        dst = out_dir / f"{base}_b{i + 1}_{safe}{tag}_glyph.png"
        _imwrite(dst, rgba)
        got.append({"name": name, "safe": safe, "glyph": dst,
                    "w": int(x1 - x0), "h": int(y1 - y0)})
    return got


def place_box(gw: int, gh: int, place: dict | None = None,
              stage: tuple[int, int] = (1080, 1920)) -> list[int]:
    """笔迹等比缩进"字位"，居中。不同字数、不同名字都落在同一块地方。"""
    p = {**PLACE, **(place or {})}
    sw, sh = stage
    if gw <= 0 or gh <= 0:
        return [0, 0, 0, 0]
    k = min(float(p["max_w"]) / gw, float(p["max_h"]) / gh)
    w = max(1, int(round(gw * k)))
    h = max(1, int(round(gh * k)))
    x0 = int(round(p["cx"] - w / 2))
    y0 = int(round(p["cy"] - h / 2))
    x0 = max(0, min(sw - w, x0))
    y0 = max(0, min(sh - h, y0))
    return [x0, y0, x0 + w, y0 + h]


def compose(plate: Path | str, glyph: Path | str, box: list[int],
            out: Path | str) -> Path | None:
    """底板 + 笔迹 = 一张"已经写好"的成图（overlay 收笔时淡入的那层）。"""
    plate, glyph, out = Path(plate), Path(glyph), Path(out)
    base = _imread(plate)
    g = cv2.imdecode(np.fromfile(str(glyph), np.uint8), cv2.IMREAD_UNCHANGED)
    if base is None or g is None or g.shape[2] != 4:
        return None
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    if w <= 0 or h <= 0:
        return None
    g = cv2.resize(g, (w, h), interpolation=cv2.INTER_AREA)
    roi = base[y0:y1, x0:x1].astype(np.float32)
    al = g[..., 3:4].astype(np.float32) / 255.0
    base[y0:y1, x0:x1] = (g[..., :3].astype(np.float32) * al
                          + roi * (1 - al)).astype(np.uint8)
    _imwrite(out, base)
    return out


if __name__ == "__main__":  # 手测：python -m app.pipeline.wordsheet 图.png 张三 李四
    import sys

    args = sys.argv[1:]
    if len(args) < 2:
        print("用法: wordsheet.py <sheet.png> <name1> [name2 ...]")
    else:
        for it in split(Path(args[0]), args[1:]):
            print(it)
