"""把模板上原本印着的名字擦掉，做一张"干净底板"。

模板（overlay/assets/poster.jpg）中间印着「智纪元」，那是样例，不是要写的内容。
直接在上面盖新名字是不行的——旧字会从背后透出来。所以先把这块区域用上下两行
背景做垂直渐变重建：这块区域本身是纯渐变（上白下浅绿），没有花纹，逐列插值出来
完全看不出接缝，比 inpaint 干净得多。

用法：
    python -m app.pipeline.plate                 # 用 config.yaml 里的 template 段
    python -m app.pipeline.plate --box 229,1008,1058,1363 --pad 26
"""
from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np

DEFAULT_BOX = (229, 1008, 1058, 1363)   # 模板像素坐标下「智纪元」的包围盒
DEFAULT_PAD = 40                         # 字有投影，左右下都要多吃一点
FEATHER = 28                             # 左右接缝羽化宽度（必须小于 pad，否则会把字边羽化回来）


def rebuild_region(img: np.ndarray, box: tuple[int, int, int, int],
                   pad: int = DEFAULT_PAD, feather: int = FEATHER) -> np.ndarray:
    """把 box（外扩 pad）区域用上下的背景插值填回去。"""
    out = img.copy()
    h, w = out.shape[:2]
    x0, y0, x1, y1 = box
    x0 = max(1, x0 - pad); y0 = max(2, y0 - pad)
    x1 = min(w - 1, x1 + pad); y1 = min(h - 1, y1 + pad)

    # 上边界往上、下边界往下各取一窄条的平均色，作为插值端点。
    # 只取一行的话，JPEG 噪点会让端点在横向上一格一格跳，填进去就是竖纹。
    band = 12
    top = out[max(0, y0 - band):y0].astype(np.float32).mean(axis=0, keepdims=True)
    bot = out[y1:min(h, y1 + band)].astype(np.float32).mean(axis=0, keepdims=True)
    rows = y1 - y0
    t = np.linspace(0, 1, rows, dtype=np.float32)[:, None, None]
    fill = (top * (1 - t) + bot * t)[:, x0:x1]   # (rows, w, 3)
    # 补一点噪点，否则这块比周围"太干净"，一眼能看出补丁
    rng = np.random.default_rng(7)
    fill += rng.normal(0, 2.2, fill.shape).astype(np.float32)

    patch = out[y0:y1, x0:x1].astype(np.float32)
    # 左右也羽化一下，避免竖向接缝
    mask = np.ones((rows, x1 - x0), np.float32)
    fx = max(0, min(feather, pad - 6, (x1 - x0) // 3))
    # 纵向不羽化：这块区域上下都是纯渐变，插值出来的像素在边界处本来就连续，
    # 硬切看不出接缝；一旦羽化，反而把本该被替换掉的字尾"半透明"地留了下来。
    fy = 0
    if fx > 0:
        ramp = np.linspace(0, 1, fx, dtype=np.float32)
        ramp = ramp * ramp * (3 - 2 * ramp)      # smoothstep，接缝更软
        mask[:, :fx] *= ramp[None, :]
        mask[:, -fx:] *= ramp[::-1][None, :]
    if fy > 0:
        ramp = np.linspace(0, 1, fy, dtype=np.float32)
        ramp = ramp * ramp * (3 - 2 * ramp)
        mask[:fy, :] *= ramp[:, None]
        mask[-fy:, :] *= ramp[::-1][:, None]
    mask = mask[:, :, None]

    blended = patch * (1 - mask) + fill * mask
    out[y0:y1, x0:x1] = np.clip(blended, 0, 255).astype(np.uint8)
    return out


def build(src: Path, dst: Path, box=DEFAULT_BOX, pad: int = DEFAULT_PAD) -> Path:
    img = cv2.imdecode(np.fromfile(str(src), np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(src)
    out = rebuild_region(img, box, pad)
    dst.parent.mkdir(parents=True, exist_ok=True)
    ok, buf = cv2.imencode(".jpg", out, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    if not ok:
        raise RuntimeError("编码失败")
    dst.write_bytes(buf.tobytes())
    return dst


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="")
    ap.add_argument("--dst", default="")
    ap.add_argument("--box", default="")
    ap.add_argument("--pad", type=int, default=DEFAULT_PAD)
    a = ap.parse_args()

    from app.config import ROOT

    src = Path(a.src) if a.src else ROOT / "overlay" / "assets" / "poster.jpg"
    dst = Path(a.dst) if a.dst else ROOT / "overlay" / "assets" / "poster_clean.jpg"
    box = DEFAULT_BOX
    if a.box:
        box = tuple(int(v) for v in a.box.split(","))  # type: ignore[assignment]
    p = build(src, dst, box, a.pad)
    im = cv2.imread(str(p))
    print(f"[plate] {src.name} -> {p.name}  {im.shape[1]}x{im.shape[0]}  box={box}")


if __name__ == "__main__":
    main()
