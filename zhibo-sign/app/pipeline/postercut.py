"""把豆包改完字的整张海报，拆成「全透明笔迹」一份。

为什么不直接把 AI 那张图铺上去：
豆包虽然听话（实测海报区域外平均像素差只有 3/255，就是 JPEG 噪声级别），
但它是**重画**了一遍，不是像素级编辑。直播画面里海鸥少一只、印章换个位置
这种事不能接受。所以只取中间那块字，背景一律用我们自己重建的底板。

反过来，字必须用 AI 的：原海报那三个字是毛笔飞白，只有模型能写出同款质感。

输出 RGBA：
  * 颜色从 AI 图里反解（unpremultiply），不会带一圈白边；
  * alpha 由"比底板暗多少"算出来，笔画边缘自然羽化；
  * 抠出来的框跟着实际墨迹走，名字 2 个字、5 个字都不会偏。
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

# 模板里「智纪元」的位置（1279x2280），只用来限定"找字的范围"，
# 真正的框按实际墨迹算。
SEARCH = (60, 900, 1220, 1450)
PAD = 10                       # 抠图框比墨迹各边多留一点，飞白才不会被切
INK_L = 46.0                   # 墨色的亮度基准
CLEAN_MIN_ALPHA = 0.04


def _imread(p: Path | str) -> np.ndarray:
    return cv2.imdecode(np.fromfile(str(p), np.uint8), cv2.IMREAD_COLOR)


def _imwrite(p: Path | str, img: np.ndarray) -> None:
    """cv2.imwrite 遇到中文路径会静默失败，必须走 imencode。"""
    p = Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    ok, buf = cv2.imencode(p.suffix or ".png", img)
    if not ok:
        raise RuntimeError(f"编码失败: {p}")
    p.write_bytes(buf.tobytes())


def _ink_mask(rgb: np.ndarray, bg: np.ndarray) -> np.ndarray:
    """比底板暗多少 -> 墨迹。返回 float32 alpha（0~1）。"""
    g = cv2.cvtColor(rgb, cv2.COLOR_BGR2GRAY).astype(np.float32)
    bgl = cv2.cvtColor(bg, cv2.COLOR_BGR2GRAY).astype(np.float32)
    bgl = cv2.GaussianBlur(bgl, (0, 0), 9)      # 底板是渐变，抹平一点更稳
    a = (bgl - g) / np.maximum(bgl - INK_L, 24.0)
    return np.clip(a, 0.0, 1.0)


def extract(ai_path: Path | str, template: Path | str,
            plate: Path | str) -> dict | None:
    """从 AI 改字图里抠出笔迹。

    返回 {"glyph": Path, "full": Path, "box": [x0,y0,x1,y1], "w", "h"}，
    box 是模板坐标系里的框；调用方负责换算到播放坐标系。
    """
    ai_path, template, plate = Path(ai_path), Path(template), Path(plate)
    tpl = _imread(template)
    clean = _imread(plate)
    ai = _imread(ai_path)
    if tpl is None or clean is None or ai is None:
        return None
    h, w = tpl.shape[:2]
    if ai.shape[:2] != (h, w):
        ai = cv2.resize(ai, (w, h), interpolation=cv2.INTER_AREA)

    # 1) 找墨迹：只在文字带里找，别把下面那行标语也算进来
    sx0, sy0, sx1, sy1 = SEARCH
    sub_ai = ai[sy0:sy1, sx0:sx1]
    sub_cl = clean[sy0:sy1, sx0:sx1]
    alpha = _ink_mask(sub_ai, sub_cl)
    solid = (alpha > 0.30).astype(np.uint8)
    solid = cv2.morphologyEx(solid, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(solid, 8)
    comps = [(i, s) for i, s in enumerate(stats) if i and s[4] > 120]
    if not comps:
        return None

    # 光看"暗"不够：船舱、印章、远处栏杆都在这一带，也得剔掉。
    # 用面积最大那块（必然是名字的一笔）的墨色做基准，颜色不像的都丢掉。
    def mean_color(i, s):
        x, y, ww, hh, _ = s
        m = lab[y:y + hh, x:x + ww] == i
        return sub_ai[y:y + hh, x:x + ww][m].mean(axis=0)

    ref_i, ref_s = max(comps, key=lambda t: t[1][4])
    ref = mean_color(ref_i, ref_s)
    keep = [s for i, s in comps
            if float(np.linalg.norm(mean_color(i, s) - ref)) < 62]
    if not keep:
        return None
    x0 = min(s[0] for s in keep) + sx0
    y0 = min(s[1] for s in keep) + sy0
    x1 = max(s[0] + s[2] for s in keep) + sx0
    y1 = max(s[1] + s[3] for s in keep) + sy0
    x0, y0 = max(0, x0 - PAD), max(0, y0 - PAD)
    x1, y1 = min(w, x1 + PAD), min(h, y1 + PAD)

    # 2) 反解颜色：AI 的像素是"墨 + 白底"混出来的，除回去才是纯墨色
    px = ai[y0:y1, x0:x1].astype(np.float32)
    bgc = clean[y0:y1, x0:x1].astype(np.float32)
    a = _ink_mask(ai[y0:y1, x0:x1], clean[y0:y1, x0:x1])[..., None]
    a3 = np.maximum(a, CLEAN_MIN_ALPHA)
    ink = np.clip((px - bgc * (1 - a3)) / a3, 0, 255).astype(np.uint8)
    # 墨色偏一点点就好，别让它因为反解炸成纯黑
    ink = cv2.addWeighted(ink, 0.85, px.astype(np.uint8), 0.15, 0)

    rgba = np.dstack([ink, (a[..., 0] * 255).astype(np.uint8)])

    out_dir = ai_path.parent
    stem = ai_path.stem
    glyph_path = out_dir / f"{stem}_glyph.png"
    _imwrite(glyph_path, rgba)

    # 3) 一份"海报原图 + 新字"的合成图，给后台回看/截图用
    full = clean.copy()
    roi = full[y0:y1, x0:x1].astype(np.float32)
    al = a
    full[y0:y1, x0:x1] = (ink.astype(np.float32) * al + roi * (1 - al)).astype(np.uint8)
    full_path = out_dir / f"{stem}_full.jpg"
    _imwrite(full_path, full)

    # 4) 自检：框外到底改了多少（用于判断 AI 有没有乱动背景）
    outside = np.ones((h, w), bool)
    outside[y0:y1, x0:x1] = False
    diff = np.abs(ai.astype(np.int16) - tpl.astype(np.int16)).mean(axis=2)
    drift = float(diff[outside].mean())
    return {"glyph": glyph_path, "full": full_path,
            "box": [int(x0), int(y0), int(x1), int(y1)],
            "w": int(x1 - x0), "h": int(y1 - y0), "drift": round(drift, 2)}


if __name__ == "__main__":  # 手测
    import sys

    root = Path(__file__).resolve().parents[2]
    r = extract(sys.argv[1], root / "overlay/assets/poster.jpg",
                root / "overlay/assets/poster_clean.jpg")
    print(r)
