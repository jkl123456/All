"""把豆包出的那张方图"收拾"成能直接上沙盘的样子。

三件事，都是针对"沙画签名"这类成图的：

1. **按墨迹裁切**。豆包很听话地画了一个居中的签名，但画布留白太多——直接铺到
   1000×420 的沙盘上，字只有中间一小块。所以先找出字的包围盒，向外留一点边，
   再把短边补到沙盘的比例。
2. **顺手丢掉水印**。水印固定在右下角，按墨迹裁切后基本就不在画面里了；万一
   裁进来了，就在原地做 inpaint（不能像画头像那个项目一样刷白——沙盘是米色的，
   刷白会留一块死板的白斑）。
3. **不放大不重采样**。裁切只是取子区域，颗粒质感原样保留。

识别墨迹用的是"背景减除"而不是全局阈值：沙盘四角有暗角，全局阈值会把暗角
当墨迹，包围盒一下子撑到整张图。
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np


def _ink_mask(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # 中值滤波取"本地背景"：沙子的明暗渐变被抹平，只剩笔画的凹陷
    bg = cv2.medianBlur(gray, 41)
    diff = bg.astype(np.int16) - gray.astype(np.int16)
    m = (diff > 24).astype(np.uint8)
    return cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))


def ink_bbox(img: np.ndarray, min_area: int = 500) -> tuple[int, int, int, int] | None:
    """字的包围盒；碎点（沙粒噪点）用连通域面积过滤掉。"""
    m = _ink_mask(img)
    n, _, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    boxes = [s for s in stats[1:] if s[4] >= min_area]
    if not boxes:
        return None
    x0 = min(int(s[0]) for s in boxes)
    y0 = min(int(s[1]) for s in boxes)
    x1 = max(int(s[0] + s[2]) for s in boxes)
    y1 = max(int(s[1] + s[3]) for s in boxes)
    return x0, y0, x1, y1


def _grow_to_aspect(x0: int, y0: int, x1: int, y1: int,
                    aspect: float, w: int, h: int) -> tuple[int, int, int, int]:
    """把框补到指定宽高比，优先补短边（画面多点留白，不切字）。"""
    bw, bh = x1 - x0, y1 - y0
    if bw / max(1, bh) < aspect:            # 太窄 -> 加宽
        want = int(round(bh * aspect))
        cx = (x0 + x1) // 2
        x0, x1 = cx - want // 2, cx + want // 2
    else:                                    # 太扁 -> 加高
        want = int(round(bw / aspect))
        cy = (y0 + y1) // 2
        y0, y1 = cy - want // 2, cy + want // 2
    # 超出画布就整体平移回来，别越界
    if x0 < 0:
        x1 -= x0; x0 = 0
    if y0 < 0:
        y1 -= y0; y0 = 0
    if x1 > w:
        x0 -= (x1 - w); x1 = w
    if y1 > h:
        y0 -= (y1 - h); y1 = h
    return max(0, x0), max(0, y0), min(w, x1), min(h, y1)


def _clear_stamp(img: np.ndarray) -> int:
    """右下角若有豆包水印（比周围亮一截的小字），原地 inpaint 掉。

    返回清掉的像素数。沙盘有纹理，用 TELEA 从四周长过来，比刷白自然。
    """
    h, w = img.shape[:2]
    zone = (int(w * 0.72), int(h * 0.88), w, h)
    x0, y0, x1, y1 = zone
    roi = img[y0:y1, x0:x1]
    if roi.size == 0:
        return 0

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    bg = cv2.medianBlur(gray, 31)
    bright = (gray.astype(np.int16) - bg.astype(np.int16)) > 10
    mask = bright.astype(np.uint8) * 255
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=2)
    if mask.sum() < 255 * 60:               # 这点面积不可能是那行字
        return 0

    img[y0:y1, x0:x1] = cv2.inpaint(roi, mask, 6, cv2.INPAINT_TELEA)
    return int((mask > 0).sum())


def trim_to_ink(path: Path, aspect: float = 1000 / 420, margin: float = 0.14) -> bool:
    """原地裁切 + 去水印。返回是否改动过文件。"""
    raw = np.fromfile(str(path), np.uint8)
    img = cv2.imdecode(raw, cv2.IMREAD_COLOR)
    if img is None:
        return False
    h, w = img.shape[:2]

    box = ink_bbox(img)
    if box is None:
        return False
    x0, y0, x1, y1 = box
    # 别把画布裁得太狠：太小说明识别到了噪点
    if (x1 - x0) * (y1 - y0) < 0.01 * w * h:
        return False

    mx, my = int((x1 - x0) * margin), int((y1 - y0) * margin)
    x0, y0 = max(0, x0 - mx), max(0, y0 - my)
    x1, y1 = min(w, x1 + mx), min(h, y1 + my)
    x0, y0, x1, y1 = _grow_to_aspect(x0, y0, x1, y1, aspect, w, h)

    out = img[y0:y1, x0:x1].copy()
    _clear_stamp(out)
    if out.shape[0] < 64 or out.shape[1] < 64:
        return False
    ok, buf = cv2.imencode(".png", out)
    if not ok:
        return False
    path.write_bytes(buf.tobytes())
    return True


if __name__ == "__main__":  # 手测：python -m app.pipeline.aicrop a.png [b.png ...]
    import sys

    for p in sys.argv[1:]:
        f = Path(p)
        before = cv2.imread(str(f)).shape
        hit = trim_to_ink(f)
        after = cv2.imread(str(f)).shape
        print(f"{f.name}: {before} -> {after}  {'裁剪' if hit else '未动'}")
