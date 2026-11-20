"""把豆包写的"白底毛笔字"抠成透明笔迹，好贴到海报上。

为什么不是让豆包直接改整张海报：那样它每次都会顺手重画海鸥、船、印章，
"只改中间的字"根本做不到。所以分工是——海报归模板，AI 只负责写字。

抠图不用色键（笔迹边缘有飞白，色键会啃掉笔画），而是用亮度当 alpha：
白底 -> 0，浓墨 -> 1，中间自然过渡。这样笔锋的干湿浓淡都留着。
最后补一层柔投影，和海报上原来那行字的阴影一致。
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

TARGET_ASPECT = 1000 / 420


def _imread(path: Path) -> np.ndarray | None:
    return cv2.imdecode(np.fromfile(str(path), np.uint8), cv2.IMREAD_COLOR)


def alpha_from_light(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    lo, hi = np.percentile(gray, 3), np.percentile(gray, 97)
    if hi - lo < 12:                       # 几乎纯色，不是字
        return np.zeros_like(gray, np.float32)
    a = (hi - gray) / (hi - lo)
    return np.clip(a, 0, 1)


def _pad_to_aspect(rgba: np.ndarray, aspect: float) -> np.ndarray:
    h, w = rgba.shape[:2]
    if w / h < aspect:                      # 太窄（高），补宽
        nw = int(round(h * aspect))
        left = (nw - w) // 2
        out = np.zeros((h, nw, 4), np.uint8)
        out[:, left:left + w] = rgba
    else:                                    # 太扁，补高
        nh = int(round(w / aspect))
        top = (nh - h) // 2
        out = np.zeros((nh, w, 4), np.uint8)
        out[top:top + h] = rgba
    return out


def cutout(src: Path, dst: Path | None = None, aspect: float = TARGET_ASPECT,
           margin: float = 0.05, shadow: bool = True) -> Path | None:
    img = _imread(src)
    if img is None:
        return None

    a = alpha_from_light(img)
    if a.max() < 0.3:
        return None

    solid = a > 0.12
    ys, xs = np.where(solid)
    if len(xs) < 50:
        return None

    # 裁到字上（留一点边），避免豆包给的画布里大片空白
    mx = int((xs.max() - xs.min()) * margin) + 4
    my = int((ys.max() - ys.min()) * margin) + 4
    x0, x1 = max(0, xs.min() - mx), min(img.shape[1], xs.max() + mx)
    y0, y1 = max(0, ys.min() - my), min(img.shape[0], ys.max() + my)

    crop = img[y0:y1, x0:x1]
    ca = a[y0:y1, x0:x1]

    # 颜色保留原样（豆包调出来的墨绿本来就和海报一个色系），只把 alpha 换掉
    rgba = np.dstack([crop, (ca * 255).astype(np.uint8)])
    # 反预乘：半透明像素的颜色被白底"提亮"过，按 alpha 拉回去，边缘才不会发白
    f = ca[..., None]
    rgb = np.clip((crop.astype(np.float32) - 255 * (1 - f)) / np.maximum(f, 1e-3), 0, 255)
    rgba[..., :3] = rgb.astype(np.uint8)
    rgba[ca < 0.02] = 0

    rgba = _pad_to_aspect(rgba, aspect)

    if shadow:
        h, w = rgba.shape[:2]
        pad = int(min(h, w) * 0.06) + 6
        canvas = np.zeros((h + pad * 2, w + pad * 2, 4), np.uint8)
        canvas[pad:pad + h, pad:pad + w] = rgba
        sh = cv2.GaussianBlur(canvas[..., 3], (0, 0), max(2.0, min(h, w) * 0.02))
        sh = (sh.astype(np.float32) * 0.30).astype(np.uint8)
        shadow_layer = np.zeros_like(canvas)
        shadow_layer[..., 0] = 24          # 阴影颜色：偏墨绿的深灰
        shadow_layer[..., 1] = 58
        shadow_layer[..., 2] = 50
        shadow_layer[..., 3] = sh
        # 阴影往右下偏一点，和海报原字一致
        dx, dy = int(pad * 0.5), int(pad * 0.6)
        moved = np.zeros_like(shadow_layer)
        moved[dy:, dx:] = shadow_layer[:h + pad * 2 - dy, :w + pad * 2 - dx]
        out = moved
        al = out[..., 3:4].astype(np.float32) / 255
        gl = canvas[..., 3:4].astype(np.float32) / 255
        out[..., :3] = (canvas[..., :3] * gl + out[..., :3] * al * (1 - gl)).astype(np.uint8)
        out[..., 3] = np.clip((gl + al * (1 - gl))[..., 0] * 255, 0, 255).astype(np.uint8)
        rgba = out

    dst = dst or src.with_name(src.stem + "_cut.png")
    ok, buf = cv2.imencode(".png", rgba)
    if not ok:
        return None
    dst.write_bytes(buf.tobytes())
    return dst


if __name__ == "__main__":
    import sys

    for p in sys.argv[1:]:
        r = cutout(Path(p))
        print(f"{p} -> {r}")
