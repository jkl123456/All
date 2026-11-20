"""笔迹材质：把透明笔迹做成"有立体感 / 烫金 / 发光"的字。

输入输出都是 RGBA PNG（就是 `*_glyph.png`），尺寸不变（除非加外投影要补边）。

## 为什么在抠图之后做，而不是让模型画

立体感、金属反射、发光这三件事本质上是 **alpha 通道上的光照模拟**：
知道哪里是墨（a=1）、哪里是纸（a=0），就能算出"左上受光、右下背光"的边。
用 numpy 算一张 30~80ms，而且**每个名字的质感完全一致**。

交给 SD 的后果是：同一个直播里，第一个人的字是浮雕、第二个变成水彩、
第三个糊了——观众会觉得设备坏了。模型负责"这笔墨像不像人写的"，
材质负责"这个字看着酷不酷"，两件事分开管。

## 预设

    ink     原样（抠图后那版，墨色 + 毛边）
    emboss  立体浮雕（打一盏左上的灯，边缘起高光/暗部 + 投影）
    extrude 立体挤出（往右下拖一个"块"，最像 3D 字）
    gold    烫金立体（金色渐变 + 斜面 + 高光带 + 外投影）
    chrome  镀铬（上下明暗条带模拟金属反射）
    neon    霓虹（字芯提亮 + 外发光，深色背景才好看）

在 `config.yaml` 里 `signature.sdcn.style: gold` 切换。
"""
from __future__ import annotations

import time
from pathlib import Path

import cv2
import numpy as np

# ------------------------------------------------------------------ 基础工具
def _read(p: Path) -> np.ndarray | None:
    """cv2.imread 遇到中文路径会静默失败，必须走 imdecode。"""
    return cv2.imdecode(np.fromfile(str(p), np.uint8), cv2.IMREAD_UNCHANGED)


def _write(p: Path, rgba: np.ndarray) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    ok, buf = cv2.imencode(".png", rgba)
    if ok:
        p.write_bytes(buf.tobytes())


def _shift(a: np.ndarray, dx: int, dy: int) -> np.ndarray:
    """把 alpha 整体平移 (dx,dy)，空出来的地方补 0。

    别用 np.roll —— 它会绕回到另一边，字的左上会莫名亮一条边。
    """
    h, w = a.shape[:2]
    out = np.zeros_like(a)
    if abs(dx) >= w or abs(dy) >= h:
        return out
    xs0, xs1 = max(0, dx), min(w, w + dx)
    ys0, ys1 = max(0, dy), min(h, h + dy)
    xd0, xd1 = max(0, -dx), min(w, w - dx)
    yd0, yd1 = max(0, -dy), min(h, h - dy)
    out[yd0:yd1, xd0:xd1] = a[ys0:ys1, xs0:xs1]
    return out


def _blur(a: np.ndarray, sigma: float) -> np.ndarray:
    if sigma <= 0:
        return a
    k = int(sigma * 4) | 1
    return cv2.GaussianBlur(a, (k, k), sigma)


def _bevel(a: np.ndarray, depth: int = 3, soft: float = 0.8):
    """算出受光边和背光边。光源固定在左上（和海报的光照一致）。

    受光边 = "我这块是墨、我左上方却不是" —— 也就是把 alpha 往右下平移后相减。
    背光边同理，往左上平移。
    再各自模糊一点，边缘才不会像描了一条硬线（那是 Photoshop 的斜面样式，
    不是字本身就是立体的）。
    """
    hi = np.clip(a - _shift(a, depth, depth), 0.0, 1.0)
    lo = np.clip(a - _shift(a, -depth, -depth), 0.0, 1.0)
    return _blur(hi, soft), _blur(lo, soft)


def _pad(rgba: np.ndarray, pad: int) -> tuple[np.ndarray, int]:
    h, w = rgba.shape[:2]
    out = np.zeros((h + pad * 2, w + pad * 2, 4), np.uint8)
    out[pad:pad + h, pad:pad + w] = rgba
    return out, pad


def _drop_shadow(rgba: np.ndarray, blur: float = 6.0, off: tuple[int, int] = (4, 6),
                 strength: float = 0.42, color=(20, 30, 26)) -> np.ndarray:
    """在外面加一层投影。立体字没有影子就是一张贴纸。"""
    h, w = rgba.shape[:2]
    pad = int(blur * 3) + max(abs(off[0]), abs(off[1])) + 2
    canvas, p = _pad(rgba, pad)
    a = canvas[..., 3].astype(np.float32) / 255.0
    sh_a = np.clip(_blur(a, blur) * strength * 255, 0, 255)
    sh = np.dstack([
        np.full_like(sh_a, color[0]), np.full_like(sh_a, color[1]),
        np.full_like(sh_a, color[2]), sh_a]).astype(np.uint8)
    sh = np.roll(sh, (off[1], off[0]), axis=(0, 1))
    if off[1] > 0:
        sh[:off[1]] = 0
    if off[0] > 0:
        sh[:, :off[0]] = 0
    al = sh[..., 3:4].astype(np.float32) / 255
    gl = canvas[..., 3:4].astype(np.float32) / 255
    out = canvas.copy()
    out[..., :3] = (canvas[..., :3] * gl + sh[..., :3] * al * (1 - gl)).astype(np.uint8)
    out[..., 3] = np.clip((gl + al * (1 - gl))[..., 0] * 255, 0, 255).astype(np.uint8)
    return out


def _grad_v(h: int, w: int, top, bottom) -> np.ndarray:
    """竖直渐变（BGR 浮点）。"""
    t = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None, None]
    a = np.array(top, np.float32)[None, None, :]
    b = np.array(bottom, np.float32)[None, None, :]
    return np.broadcast_to(a * (1 - t) + b * t, (h, w, 3))


# ------------------------------------------------------------------ 预设
def style_ink(rgba: np.ndarray, **kw) -> np.ndarray:
    return rgba


def style_emboss(rgba: np.ndarray, base=(80, 90, 26), hi=(255, 255, 235),
                 lo=(12, 18, 10), depth: int = 5, **kw) -> np.ndarray:
    """立体浮雕：字身是深墨色，左上边缘受光提亮、右下压暗。

    `base` 是 BGR —— 默认 (80,90,26) 就是海报那个墨绿 #1a5a50 稍亮一点，
    因为立体字比平涂字"吃光"，颜色要提亮一档才和旁边的平字一个感觉。
    """
    a = rgba[..., 3].astype(np.float32) / 255.0
    h, w = a.shape[:2]
    hb, sb = _bevel(a, depth=depth, soft=max(0.7, depth * 0.4))
    # 内部再压一道，字才有"厚度"而不是"描边"
    inner = np.clip(_blur(a, depth * 2.4) - _blur(a, depth * 0.9), 0, 1)
    rgb = np.broadcast_to(np.array(base, np.float32), (h, w, 3)).copy()
    rgb += hb[..., None] * (np.array(hi, np.float32) - rgb) * 0.95
    rgb -= sb[..., None] * (rgb - np.array(lo, np.float32)) * 0.85
    rgb -= inner[..., None] * 22.0
    out = np.dstack([np.clip(rgb, 0, 255), rgba[..., 3]]).astype(np.uint8)
    return _drop_shadow(out, blur=8.0, off=(5, 8), strength=0.50)


def style_extrude(rgba: np.ndarray, base=(84, 96, 30), side=(12, 20, 8),
                  hi=(255, 255, 240), rim=(120, 210, 190),
                  depth: int = 0, **kw) -> np.ndarray:
    """立体挤出：把字往后拉出一个"块" —— 最像真 3D 字的一招。

    做法是往右下方向一层层复制 alpha，越远越暗（侧面受光少），
    最后把最前面那层当正面盖上去。关键在最后那一步**切口高光**：
    正面和侧面交界的那一圈要亮一线，眼睛就是靠这条线判断"这是个有厚度的块"，
    少了它，画面看起来只是"字下面拖了个影子"。

    `depth=0` 表示按字高自动：厚度 ≈ 字高的 6%。细笔画的字（马善政）用固定
    16 像素会糊成一坨脏影子，粗字（站酷黄油）又不够厚——所以要跟尺寸走。
    """
    a = rgba[..., 3].astype(np.float32) / 255.0
    h, w = a.shape[:2]
    if not depth:
        depth = int(min(22, max(6, h * 0.06)))
    pad = depth + 12
    canvas, p = _pad(rgba, pad)
    aa = canvas[..., 3].astype(np.float32) / 255.0
    H, W = aa.shape

    out = np.zeros((H, W, 4), np.float32)
    # 由远到近铺侧面：远的先画，近的盖上去；靠正面的一侧稍亮（环境光反弹）
    for k in range(depth, 0, -1):
        t = k / depth                          # 1 = 最远
        near = 1.0 - t                          # 1 = 贴着正面
        col = np.array(side, np.float32) * (1.0 + 0.9 * near)
        layer = _shift(aa, int(round(k * 0.7)), k)
        m = layer > 0.02
        out[m, :3] = col
        out[m, 3] = np.maximum(out[m, 3], layer[m] * 255)

    # 正面：底色 + 左上受光 + 右下内侧压暗
    hb, sb = _bevel(aa, depth=3, soft=1.0)
    face = np.broadcast_to(np.array(base, np.float32), (H, W, 3)).copy()
    face += hb[..., None] * (np.array(hi, np.float32) - face) * 0.55
    face -= sb[..., None] * 14.0

    m = aa > 0.02
    out[m, :3] = face[m]
    out[m, 3] = np.maximum(out[m, 3], aa[m] * 255)

    # 切口高光：正面右下这一圈（和侧面的交界）提亮
    cut = np.clip(aa - _shift(aa, -2, -2), 0, 1)
    cut = _blur(cut, 0.7)[..., None]
    out[..., :3] = out[..., :3] * (1 - cut * 0.55) + np.array(rim, np.float32) * cut * 0.55
    return np.clip(out, 0, 255).astype(np.uint8)


def style_gold(rgba: np.ndarray, depth: int = 3, **kw) -> np.ndarray:
    """烫金立体：金色渐变 + 斜面 + 一道斜向高光带 + 外投影。

    金色别用一个纯色 —— 真正的烫金是"上黄下暗、中间一条反光"，
    纯色 #FFD700 一眼就是网页按钮。
    """
    a = rgba[..., 3].astype(np.float32) / 255.0
    h, w = a.shape[:2]
    hb, sb = _bevel(a, depth=depth, soft=max(0.6, depth * 0.45))

    grad = _grad_v(h, w, (120, 215, 255), (30, 130, 190))       # 上浅金 -> 下深金
    # 斜向高光带：sigmoid 一条斜线，让下半部分"擦"出一道光
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    t = (xx / max(1, w) * 0.6 + yy / max(1, h) * 0.4)
    band = np.exp(-((t - 0.45) ** 2) / (2 * 0.055 ** 2)).astype(np.float32)

    rgb = grad * (0.82 + 0.30 * band[..., None])
    rgb += hb[..., None] * (np.array((250, 255, 255), np.float32) - rgb) * 0.9
    rgb -= sb[..., None] * (rgb - np.array((20, 70, 110), np.float32)) * 0.8
    out = np.dstack([np.clip(rgb, 0, 255), rgba[..., 3]]).astype(np.uint8)
    return _drop_shadow(out, blur=7.0, off=(4, 7), strength=0.45)


def style_chrome(rgba: np.ndarray, depth: int = 2, **kw) -> np.ndarray:
    """镀铬：上下明暗条带模拟金属反射（镜子一样那种冷光）。"""
    a = rgba[..., 3].astype(np.float32) / 255.0
    h, w = a.shape[:2]
    hb, sb = _bevel(a, depth=depth, soft=0.7)
    yy = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    # 三条亮带：顶部天光、中部地平线、底部反光
    band = (0.55 + 0.45 * np.cos((yy - 0.15) * np.pi * 2.1)).clip(0, 1)
    band = np.broadcast_to(band, (h, w))[..., None]
    base = np.array((150, 165, 175), np.float32)
    rgb = base * (0.55 + 0.75 * band)
    rgb += hb[..., None] * 90.0 - sb[..., None] * 70.0
    out = np.dstack([np.clip(rgb, 0, 255), rgba[..., 3]]).astype(np.uint8)
    return _drop_shadow(out, blur=5.0, off=(3, 5), strength=0.30)


def style_neon(rgba: np.ndarray, color=(255, 90, 200), **kw) -> np.ndarray:
    """霓虹：字芯提亮 + 一圈外发光。**深色背景才好看**，浅底上会糊。"""
    a = rgba[..., 3].astype(np.float32) / 255.0
    h, w = a.shape[:2]
    pad = 26
    canvas, _ = _pad(rgba, pad)
    aa = canvas[..., 3].astype(np.float32) / 255.0

    glow1 = _blur(aa, 10.0)
    glow2 = _blur(aa, 3.0)
    core = np.clip(aa ** 1.3, 0, 1)

    rgb = (np.array(color, np.float32)[None, None, :] * (0.35 + 0.9 * glow1[..., None])
           + np.array((255, 235, 250), np.float32) * glow2[..., None] * 0.9
           + np.array((255, 255, 255), np.float32) * core[..., None] * 0.55)
    alpha = np.clip(core * 1.0 + glow1 * 0.85 + glow2 * 0.35, 0, 1)
    return np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)


STYLES = {
    "ink": style_ink,
    "emboss": style_emboss,
    "extrude": style_extrude,
    "gold": style_gold,
    "chrome": style_chrome,
    "neon": style_neon,
}


def apply(src: Path | str, dst: Path | str | None = None,
          style: str = "ink", **kw) -> Path | None:
    """给一张 glyph 上材质，写回 PNG。style 不认识就原样返回。"""
    src = Path(src)
    dst = Path(dst or src.with_name(src.stem + f"_{style}.png"))
    rgba = _read(src)
    if rgba is None:
        return None
    if rgba.ndim == 2:
        rgba = cv2.cvtColor(rgba, cv2.COLOR_GRAY2BGRA)
    elif rgba.shape[2] == 3:
        rgba = cv2.cvtColor(rgba, cv2.COLOR_BGR2BGRA)

    fn = STYLES.get((style or "ink").lower())
    if fn is None or fn is style_ink:
        if dst != src:
            _write(dst, rgba)
        return dst

    t0 = time.time()
    out = fn(rgba, **kw)
    _write(dst, out)
    print(f"[style] {style} {rgba.shape[1]}x{rgba.shape[0]} "
          f"{(time.time() - t0) * 1000:.0f}ms", flush=True)
    return dst


if __name__ == "__main__":  # 手测：python -m app.pipeline.glyphstyle 图.png gold
    import sys

    args = sys.argv[1:]
    if len(args) < 2:
        print("用法: glyphstyle.py <glyph.png> <ink|emboss|gold|chrome|neon>")
    else:
        print(apply(Path(args[0]), style=args[1]))
