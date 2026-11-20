"""名字 -> 逐笔签名字迹。

三个关键决定，都是踩过坑之后定下来的：

1. **排版整串一次画，提笔迹按字切开。**
   逐字单独渲染再拼起来，每个字的字模被裁到墨迹边界，"一"和"张"会被强行拉成一样高，
   基线就散了。所以先用一次 `draw.text()` 把整串画在正确的位置上（基线和字距由字体自己
   决定），再按每个字的 advance 宽度切竖条，一条一条提骨架。

2. **字体用楷体，不用行楷。**
   行楷好看，但它的粗笔触互相粘连、字怀（笔画间的空白）几乎被填满，
   骨架化之后每个字都变成一团乱线——实测"张"完全认不出来。
   楷体笔画细、字怀通透，骨架干净，认得出字；再由 overlay 的粗笔刷和笔宽变化
   把"楷"写回"手写"。

3. **笔画顺序复用 AI 笔迹那一套（brush._order_region）。**
   原来的实现只是"按最近端点贪心"，结果笔会在字里乱跳：写完左边一横直接飞到
   右边去、横画从右往左写、竖画从下往上写——一眼就是电脑在画。现在和豆包/AI
   那条路共用同一份笔顺逻辑：先按左右偏旁切开、左右结构先左后右、再就近落笔，
   每一笔按自己的走向定起笔端。字写对了，笔顺还像人。

4. **每笔带一条逐点宽度轮廓（wps），不是一条常数线宽。**
   真人落笔要"顿"一下、中段最实、收笔提起来收成尖。只给常数宽度的话，
   整幅字就是"印刷体的骨头 + 手抖的皮"。overlay 按 wps 逐点调笔宽，
   一笔之内自带粗细节奏。
"""
from __future__ import annotations

import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .brush import _order_region, _orient
from .strokes import _chaikin, _rdp_f, _resample
from .tracing import ink_to_strokes
from . import hanzi

# 楷体拓扑最干净；新魏更"艺术"但个别字会粘连，作为备选。
FONT_CANDIDATES = (
    r"C:\Windows\Fonts\simkai.ttf",       # 楷体
    r"C:\Windows\Fonts\STKAITI.TTF",      # 华文楷体
    r"C:\Windows\Fonts\STXINWEI.TTF",     # 华文新魏
    r"C:\Windows\Fonts\simsun.ttc",       # 宋体
)

MAX_CHARS = 10
# 这些不是名字，是直播间的客套话。写出来画面会很难看。
STOP_WORDS = {
    "主播好", "主播", "你好", "大家好", "加油", "好看", "厉害", "哈哈",
    "谢谢", "感谢", "关注", "点赞", "来了", "报到", "打卡", "路过",
}


def pick_font(cfg_path: str = "") -> str:
    if cfg_path and Path(cfg_path).exists():
        return cfg_path
    for p in FONT_CANDIDATES:
        if Path(p).exists():
            return p
    raise RuntimeError("找不到可用字体，请在 config.yaml 的 signature.font 里指定")


def clean_name(text: str, prefix: str = "") -> str:
    """弹幕内容 -> 要写的名字。返回空串表示"这条不是名字，忽略"。"""
    s = (text or "").strip()
    if prefix:
        if not s.startswith(prefix):
            return ""
        s = s[len(prefix):].strip()
    s = s.replace("@", "")
    s = "".join(ch for ch in s if not ch.isspace())
    if not s or len(s) > MAX_CHARS:
        return ""
    if s in STOP_WORDS:
        return ""
    if s.isdigit():
        return ""
    # 必须含文字或字母；纯符号 / 纯 emoji 不是名字
    if not any(ch.isalnum() or "\u4e00" <= ch <= "\u9fff" for ch in s):
        return ""
    return s


# ------------------------------------------------------------------ layout
def _layout(name: str, font_path: str, size: int) -> tuple[np.ndarray, list[int], int]:
    """整串画一张图，返回 (墨迹图, 每个字的 x 起点列表, 行高)。"""
    font = ImageFont.truetype(font_path, size)
    adv = [max(1, int(round(font.getlength(ch)))) for ch in name]
    pad_x = int(size * 0.18)
    w = sum(adv) + pad_x * 2
    # 行高留够，让"江"的三点水和"张"的长撇不会被裁掉
    asc, desc = font.getmetrics()
    h = asc + desc + int(size * 0.10)
    im = Image.new("L", (w, h), 0)
    ImageDraw.Draw(im).text((pad_x, int(size * 0.05)), name, font=font, fill=255)
    a = np.asarray(im)
    ys, xs = np.nonzero(a > 6)
    if not len(ys):
        return np.zeros((size, size), np.uint8), [], size
    # 只裁上下（保持基线关系），左右按排版宽度保留
    a = a[ys.min():ys.max() + 1, :]
    starts, x = [], pad_x
    for d in adv:
        starts.append(x)
        x += d
    return a, starts, h


# ------------------------------------------------------------------ strokes
def _paths_for_char(mask: np.ndarray, min_len: float) -> list[list[tuple[float, float]]]:
    """一个字的墨迹 -> 平滑后的折线（坐标已转成 (x, y)）。"""
    out = []
    for path in ink_to_strokes(mask, min_len=min_len):
        pts = [(float(x), float(y)) for y, x in path]
        pts = _resample(pts, 2.6)
        if len(pts) < 3:
            continue
        pts = _chaikin(pts, 2)
        pts = _rdp_f(pts, 1.1)
        if len(pts) < 2:
            continue
        out.append(pts)
    return out


def _remap(strokes: list, widths: list[float], dst_w: int, dst_h: int,
           pad: float) -> tuple[list, list[float]]:
    """等比缩放到纸面并居中。等比很重要——拉伸会立刻毁掉书法感。"""
    if not strokes:
        return [], []
    xs = [p[0] for s in strokes for p in s]
    ys = [p[1] for s in strokes for p in s]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    bw, bh = max(1e-6, x1 - x0), max(1e-6, y1 - y0)
    k = min((dst_w - 2 * pad) / bw, (dst_h - 2 * pad) / bh)
    ox = (dst_w - bw * k) / 2 - x0 * k
    oy = (dst_h - bh * k) / 2 - y0 * k
    out = [[[round(p[0] * k + ox, 1), round(p[1] * k + oy, 1)] for p in s] for s in strokes]
    return out, [round(w * k, 2) for w in widths]


def _flourish(strokes: list, dst_w: int, dst_h: int) -> list:
    """签名最后那一笔收尾弧线。没有它，画面像"写字"；有了它，才像"签名"。"""
    if not strokes:
        return []
    xs = [p[0] for s in strokes for p in s]
    ys = [p[1] for s in strokes for p in s]
    x0, x1 = min(xs), max(xs)
    y_bot = max(ys)
    span = x1 - x0
    n = 48
    pts = []
    for i in range(n + 1):
        t = i / n
        x = x0 + span * (0.01 + 1.05 * t)
        y = (y_bot + dst_h * 0.06 * math.sin(t * math.pi * 0.92)
             - dst_h * 0.034 * t * t
             + dst_h * 0.005 * math.sin(t * math.pi * 3.2))
        pts.append([round(min(dst_w, max(0.0, x)), 1), round(min(dst_h, max(0.0, y)), 1)])
    return [pts]


def _profile(pts, base_w: float, rng: random.Random,
             flourish: bool = False) -> list[float]:
    """一笔的逐点宽度：落笔顿一下 -> 行笔最实 -> 收笔收成尖。

    按弧长归一化后再套两段曲线：
        t < 0.18   0.80 -> 1.06    落笔按下去（顿笔）
        t >= 0.18  1.06 -> 0.40    行笔之后提笔，越走越细
    再叠一点随机抖动，同一幅字里每一笔的粗细就不会完全一样——
    「完全一样」正是印刷体的味道来源。

    单位跟 base_w 一致（也就是已经过 _remap 缩放），overlay 直接拿来当笔宽用。
    """
    n = len(pts)
    if n < 2:
        return [round(base_w, 1)] * max(1, n)
    cum = [0.0]
    for i in range(1, n):
        cum.append(cum[-1] + math.hypot(pts[i][0] - pts[i - 1][0],
                                        pts[i][1] - pts[i - 1][1]))
    total = cum[-1] or 1.0
    out: list[float] = []
    for i in range(n):
        t = cum[i] / total
        if flourish:
            k = 1.05 - 0.70 * t                     # 甩出去那条弧线一路收细
        elif t < 0.18:
            k = 0.80 + 0.26 * (t / 0.18)
        else:
            k = 1.06 * (1 - 0.62 * ((t - 0.18) / 0.82) ** 1.7)
        k *= 1 + rng.uniform(-0.035, 0.035)
        out.append(round(max(0.6, base_w * k), 1))
    return out


def render(name: str, conf: dict) -> dict:
    """主入口：名字 -> overlay 可直接播的 payload 片段。"""
    name = clean_name(name)
    if not name:
        raise ValueError("空名字")

    dst_w = int(conf.get("width", 1000))
    dst_h = int(conf.get("height", 420))
    pad = float(conf.get("pad", 24))
    font_path = pick_font(str(conf.get("font") or ""))
    base_size = int(conf.get("font_size", 300))
    min_len = float(conf.get("min_stroke_len", 12))

    # 长名字自动减小字号，直到宽度放得下
    ink, starts, cell = _layout(name, font_path, base_size)
    size = base_size
    while ink.shape[1] > dst_w * 0.98 and size > 60:
        size = int(size * 0.86)
        ink, starts, cell = _layout(name, font_path, size)

    rng = random.Random(abs(hash(name)) % 99991)
    all_paths: list[list[tuple[float, float]]] = []
    for i, ch in enumerate(name):
        x0 = starts[i]
        x1 = starts[i + 1] if i + 1 < len(starts) else ink.shape[1]
        col = ink[:, x0:x1]
        if not col.any():
            continue
        # 每字一点点上下浮动，避免像印刷体排队
        dy = rng.uniform(-0.008, 0.008) * ink.shape[0] if conf.get("jitter", True) else 0.0

        # 首选：直接拿标准笔顺的中线当轨迹。
        # 这条路（provider: local）的成图就是这些笔画画出来的，所以轨迹和成图
        # 天然一致；而且每一笔就是一笔——不会出现骨架把「王」的横切成两截、
        # 或者把横和竖粘成一条斜线那种事。
        if conf.get("order", True) and conf.get("stroke_order", True):
            rows = np.nonzero(col.any(axis=1))[0]
            std = None
            if len(rows):
                cell = (float(x0), float(rows.min()),
                        float(x0 + col.shape[1]), float(rows.max()))
                try:
                    std = hanzi.paths(ch, cell)
                except Exception:
                    std = None
            if std:
                for p in std:
                    q = _rdp_f(_chaikin(_resample(p, 2.6), 2), 1.1)
                    if len(q) >= 2:
                        all_paths.append([(x, y + dy) for x, y in q])
                continue

        raw = _paths_for_char(col, min_len)
        if not raw:
            continue
        # 笔顺：优先按真实笔顺（hanzi-writer 的标准中线，田先竖再横折、火先长撇），
        # 拿不到（生僻字 / 断网）才退回老算法——左右结构先左偏旁后右偏旁、就近落笔。
        items = [(_orient(p), min(q[0] for q in p), min(q[1] for q in p)) for p in raw]
        ordered = [it[0] for it in items]
        if conf.get("order", True):
            fixed = None
            if conf.get("stroke_order", True):
                rows = np.nonzero(col.any(axis=1))[0]
                cell = ((float(x0), float(rows.min()),
                         float(x0 + col.shape[1]), float(rows.max()))
                        if len(rows) else None)
                try:
                    fixed = hanzi.order([it[0] for it in items], ch, cell)
                except Exception:
                    fixed = None
            if fixed:
                ordered = fixed
            else:
                try:
                    mask = (col > 0).astype(np.uint8)
                    ordered = _order_region(mask, items, 0, mask.shape[1])
                except Exception:
                    ordered = [it[0] for it in items]
        for pts in ordered:
            all_paths.append([(x + x0, y + dy) for x, y in pts])

    if len(all_paths) < 3:
        raise ValueError(f"「{name}」提不出足够笔画（{len(all_paths)}）")

    base_w = float(conf.get("stroke_width", 5.0))
    widths = []
    for p in all_paths:
        seg = sum(math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1])
                  for i in range(len(p) - 1))
        # 长笔画用力重一点：统一的笔宽就是"印刷体"的味道来源
        widths.append(round(base_w * (0.72 + min(0.55, seg / 620.0)), 2))

    strokes, widths = _remap(all_paths, widths, dst_w, dst_h, pad)
    fl_n = 0
    if conf.get("flourish", True):
        fl = _flourish(strokes, dst_w, dst_h)
        if fl:
            strokes += fl
            widths += [round(float(conf.get("flourish_width", 2.6)), 2)]
            fl_n = len(fl)

    # 逐点轮廓：每一笔一条"顿笔 -> 最实 -> 收尖"的宽度曲线。
    # overlay 按它逐点改笔宽（overlay/draw.js 的 drawRange），一笔之内自带粗细节奏。
    if conf.get("taper", True):
        wps = [_profile(s, widths[i], rng,
                        flourish=(i >= len(strokes) - fl_n))
               for i, s in enumerate(strokes)]
    else:
        wps = [[round(widths[i], 1)] * len(s) for i, s in enumerate(strokes)]

    total = 0.0
    for s in strokes:
        for i in range(len(s) - 1):
            total += math.hypot(s[i + 1][0] - s[i][0], s[i + 1][1] - s[i][1])

    return {
        "name": name,
        "size": [dst_w, dst_h],
        "strokes": strokes,
        "widths": widths,
        # 逐点笔宽（和 strokes 一一对应）。老前端没有这个字段也能跑：缺了就退回 widths。
        "wps": wps,
        "stroke_count": len(strokes),
        "total_len": round(total, 1),
        "font": Path(font_path).name,
        "time_ms": 0,
    }


def preview(name: str, conf: dict, out_png: str | Path) -> dict:
    """把算出来的笔画自己画一遍存成图，用于肉眼验收（不依赖浏览器）。"""
    import cv2

    r = render(name, conf)
    w, h = r["size"]
    img = np.full((h, w, 3), 250, np.uint8)
    for i, s in enumerate(r["strokes"]):
        wp = r["wps"][i] if i < len(r.get("wps") or []) else None
        base = r["widths"][i] if i < len(r["widths"]) else 8
        for k in range(len(s) - 1):
            wd = wp[k] if (wp and k < len(wp)) else base
            cv2.line(img,
                     (int(round(s[k][0])), int(round(s[k][1]))),
                     (int(round(s[k + 1][0])), int(round(s[k + 1][1]))),
                     (35, 33, 40), max(1, int(round(wd * 2.2))), cv2.LINE_AA)
    cv2.imwrite(str(out_png), img)
    return r
