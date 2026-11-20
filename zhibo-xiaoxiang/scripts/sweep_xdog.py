"""Parameter sweep for XDoG ink masks, tiled into one sheet for eyeballing."""
import sys
sys.path.insert(0, ".")
import cv2
import numpy as np
from app.pipeline.avatar import normalise, portrait_crop

crop = portrait_crop(normalise(cv2.imread("data/samples/test01.jpg")))
flat = cv2.bilateralFilter(crop, 9, 70, 9)
flat = cv2.bilateralFilter(flat, 9, 70, 9)
g0 = cv2.cvtColor(flat, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0


def xdog(g, sigma, k, p, eps, phi):
    g1 = cv2.GaussianBlur(g, (0, 0), sigma)
    g2 = cv2.GaussianBlur(g, (0, 0), sigma * k)
    d = g1 - p * g2
    e = np.where(d >= eps, 1.0, 1.0 + np.tanh(phi * (d - eps)))
    return np.clip(1.0 - e, 0, 1)


S = 260
cells = []
params = [
    # (sigma, k, p, eps, phi)
    (1.2, 1.8, 0.95, 0.010, 22),
    (1.2, 1.8, 0.95, 0.020, 30),
    (1.2, 1.8, 0.98, 0.015, 18),
    (1.6, 2.0, 0.96, 0.010, 12),
    (2.0, 1.7, 0.94, 0.020, 25),
    (2.4, 1.8, 0.95, 0.012, 16),
    (1.0, 1.6, 0.97, 0.030, 40),
    (2.0, 2.0, 0.93, 0.025, 20),
    (3.0, 1.8, 0.94, 0.015, 14),
]
for i, (sig, k, p, eps, phi) in enumerate(params):
    m = xdog(g0, sig, k, p, eps, phi)
    ink = (np.clip((m - 0.02) / 0.25, 0, 1) * 255).astype(np.uint8)
    ink = 255 - ink
    cell = cv2.resize(ink, (S, S), interpolation=cv2.INTER_AREA)
    cell = cv2.cvtColor(cell, cv2.COLOR_GRAY2BGR)
    cv2.putText(cell, f"{i}: s{sig} k{k} p{p} e{eps} f{phi}", (4, 18),
                cv2.FONT_HERSHEY_SIMPLEX, 0.34, (0, 0, 255), 1)
    cells.append(cell)

rows = []
for r in range(0, len(cells), 3):
    rows.append(np.hstack(cells[r:r + 3]))
sheet = np.vstack(rows)
cv2.imwrite("data/cmp/_xdog_grid.png", sheet)
print("grid", sheet.shape)
