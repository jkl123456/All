"""把笔顺画出来验收：每笔一条彩色线，起笔处标序号。

改了 `app/pipeline/hanzi.py` 或 `brush.py` 之后跑一下，肉眼确认顺序对不对。

用法：
    python scripts/check_stroke_order.py 李雷
    python scripts/check_stroke_order.py 李雷 --old          # 用旧的几何排序做对比
    python scripts/check_stroke_order.py --glyph data/signatures/xxx_glyph.png --name 李雷

输出在 data/_order_<名字>_<new|old>.png。
"""
from __future__ import annotations

import argparse
import glob
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from PIL import Image, ImageDraw, ImageFont  # noqa: E402

from app.pipeline import brush  # noqa: E402

COL = [(220, 30, 30), (30, 90, 220), (20, 150, 60), (170, 30, 170),
       (230, 120, 0), (0, 150, 160), (120, 60, 0), (90, 90, 90)]
SC = 2


def pick_glyph(name: str) -> str:
    hits = sorted(glob.glob(str(ROOT / "data" / "signatures" / f"*_{name}_glyph.png")))
    if not hits:
        raise SystemExit(f"data/signatures 里找不到「{name}」的 _glyph.png")
    return hits[-1]


def draw(glyph: str, name: str, old: bool, alpha: int = 90) -> Path:
    writes = brush.extract(glyph, len(name), alpha, "" if old else name)
    base = Image.open(glyph).convert("RGBA")
    W, H = base.size
    bg = Image.new("RGBA", (W * SC, H * SC), (255, 255, 255, 255))
    bg.alpha_composite(base.resize((W * SC, H * SC), Image.LANCZOS))
    W, H = bg.size

    try:
        font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", max(18, W // 40))
    except Exception:
        font = ImageFont.load_default()

    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for i, s in enumerate(writes):
        pts = [(p[0] * SC, p[1] * SC) for p in s["pts"]]
        c = COL[i % len(COL)]
        d.line(pts, fill=c + (210,), width=3)
        x, y = pts[0]
        r = max(10, W // 60)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 240),
                  outline=c + (255,), width=3)
        d.text((x, y), str(i + 1), fill=c + (255,), font=font, anchor="mm")

    out = ROOT / "data" / f"_order_{name}_{'old' if old else 'new'}.png"
    Image.alpha_composite(bg, ov).convert("RGB").save(out)
    print(f"{len(writes)} 笔 -> {out}")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("name", nargs="?", default="")
    ap.add_argument("--glyph", default="")
    ap.add_argument("--name", dest="name2", default="")
    ap.add_argument("--old", action="store_true", help="用旧的几何排序")
    ap.add_argument("--alpha", type=int, default=90,
                    help="多透明以下不算墨（默认 90；烫金/浮雕要 190，否则把投影当笔画）")
    a = ap.parse_args()

    name = a.name2 or a.name
    if not name:
        raise SystemExit("给个名字，例如： python scripts/check_stroke_order.py 李雷")
    glyph = a.glyph or pick_glyph(name)
    draw(glyph, name, a.old, a.alpha)


if __name__ == "__main__":
    main()
