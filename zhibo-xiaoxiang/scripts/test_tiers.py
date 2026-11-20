"""Render all four gift tiers from one avatar and save a contact sheet."""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cv2
import numpy as np
import yaml

from app.pipeline.avatar import normalise, portrait_crop
from app.pipeline.sketch import to_ink
from app.pipeline.strokes import image_to_strokes
from app.pipeline.tiers import color_fills, hatch_strokes

ROOT = Path(__file__).resolve().parent.parent
cfg = yaml.safe_load((ROOT / "config.yaml").read_text(encoding="utf-8"))
CANVAS, MARGIN = 900, 24


def render(tier: dict, crop: np.ndarray) -> tuple[np.ndarray, dict]:
    t0 = time.time()
    ink = to_ink(crop, tier.get("mode", "detail"), 3, int(tier.get("k", 4)))
    res = image_to_strokes(ink, CANVAS, float(tier.get("min_stroke_len", 8)),
                          float(tier.get("simplify", 1.6)), MARGIN,
                          float(tier.get("stitch_gap", 14)))
    hatch = hatch_strokes(crop, CANVAS, MARGIN) if tier.get("hatch") else []
    fills = color_fills(crop, CANVAS, MARGIN, int(tier.get("fills_k", 5))) if tier.get("color") else []

    img = np.full((CANVAS, CANVAS, 3), 250, np.uint8)
    for f in fills:                                   # colour first, under the ink
        pts = np.array(f["points"], np.int32).reshape(-1, 1, 2)
        col = tuple(int(f["color"][i:i + 2], 16) for i in (5, 3, 1))  # hex -> BGR
        cv2.fillPoly(img, [pts], col, cv2.LINE_AA)
    for st in res["strokes"]:
        pts = np.array(st, np.int32).reshape(-1, 1, 2)
        cv2.polylines(img, [pts], False, (23, 19, 20),
                      int(tier.get("stroke_width", 4)), cv2.LINE_AA)
    for st in hatch:
        pts = np.array(st, np.int32).reshape(-1, 1, 2)
        cv2.polylines(img, [pts], False, (95, 80, 68), 1, cv2.LINE_AA)

    stats = {"tier": tier.get("name"), "strokes": res["stroke_count"],
             "hatch": len(hatch), "fills": len(fills),
             "len": round(res["total_len"]), "sec": round(time.time() - t0, 2)}
    return img, stats


def main() -> None:
    src = sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "data/samples/test01.jpg")
    crop = portrait_crop(normalise(cv2.imread(src)))
    out = ROOT / "data/sketches"
    for tier in cfg["tiers"]:
        img, s = render(tier, crop)
        cv2.imwrite(str(out / f"_tier_{tier['key']}.png"), img)
        print(f"{s['tier']:5s} 线{s['strokes']:4d} 阴影{s['hatch']:4d} "
              f"上色{s['fills']:3d} 长度{s['len']:5d} {s['sec']}s")


if __name__ == "__main__":
    main()
