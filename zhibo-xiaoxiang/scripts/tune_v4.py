"""Compare real sketch algorithms (XDoG / dodge-pencil / cartoon) end to end."""
import sys, time
from pathlib import Path
sys.path.insert(0, ".")

import cv2
import numpy as np

from app.pipeline.avatar import normalise, portrait_crop
from app.pipeline.strokes import image_to_strokes

OUT = Path("data/cmp")
OUT.mkdir(parents=True, exist_ok=True)


# ------------------------------------------------------------------ algorithms
def prep(bgr, smooth=1.0):
    """Flatten texture but keep structure: this is what makes a drawing read as
    a drawing. Bilateral twice kills skin pores and fabric weave, the strong
    edge-aware blur keeps the jaw line and eyelashes."""
    s = cv2.bilateralFilter(bgr, 9, int(75 * smooth), 9)
    s = cv2.bilateralFilter(s, 9, int(75 * smooth), 9)
    return s


def xdog(bgr, sigma=0.9, k=1.6, p=0.97, eps=-0.02, phi=90.0):
    """Extended difference of Gaussians -- the standard operator for painterly
    line art. Unlike Canny it produces smooth, variable-width strokes that look
    like ink rather than a photo trace."""
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
    g1 = cv2.GaussianBlur(g, (0, 0), sigma)
    g2 = cv2.GaussianBlur(g, (0, 0), sigma * k)
    d = g1 - p * g2
    e = np.where(d >= eps, 1.0, 1.0 + np.tanh(phi * (d - eps)))
    ink = np.clip((1.0 - e) * 2.2, 0, 1)
    return (ink * 255).astype(np.uint8)


def dodge_sketch(bgr, sigma=32.0, contrast=1.0):
    """Classic pencil: divide the photo by its own blurred negative. Gives real
    graphite tone instead of outlines, which reads as 素描 not 描边."""
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    g = cv2.bilateralFilter(g, 9, 60, 60)
    inv = 255 - g
    bl = cv2.GaussianBlur(inv, (0, 0), sigma)
    out = cv2.divide(g, 255 - bl, scale=256)
    out = np.clip((out.astype(np.float32) - 128) * contrast + 128, 0, 255)
    return out.astype(np.uint8)


def soft_ink(gray_float, thresh=0.55, soft=0.35):
    """Soft threshold -> ink mask, keeps mid-grey values for variable width."""
    t = np.clip((thresh + soft - gray_float) / soft, 0, 1)
    return (t * 255).astype(np.uint8)


def bg_mask(bgr, tol=42, grow=2):
    """Background = the colour that owns the four corners, restricted to the
    component touching the frame. Anything else (a head cut by the border) is
    kept. Without this the wall behind the subject becomes hundreds of
    meaningless strokes, which is most of why the old output looked dirty."""
    h, w = bgr.shape[:2]
    p = max(4, int(min(h, w) * 0.06))
    patches = [bgr[:p, :p], bgr[:p, -p:], bgr[-p:, :p], bgr[-p:, -p:]]
    bg = np.median(np.vstack([q.reshape(-1, q.shape[-1]) for q in patches]), axis=0)
    d = np.linalg.norm(bgr.astype(np.float32) - bg, axis=2)
    cand = (d < tol).astype(np.uint8)
    n, lab = cv2.connectedComponents(cand, 8)
    keep = np.zeros_like(cand)
    for i in range(1, n):
        m = lab == i
        if m[0].any() or m[-1].any() or m[:, 0].any() or m[:, -1].any():
            keep[m] = 1
    if grow:
        keep = cv2.dilate(keep, np.ones((grow * 2 + 1,) * 2, np.uint8))
    return keep > 0


def kill_bg(ink, bgr, grow=2):
    m = bg_mask(bgr, grow=grow)
    out = ink.copy()
    out[m] = 0
    return out


def skin_mask(bgr, feather=5):
    """Rough skin detector in YCrCb. It does not need to be accurate: it only
    decides where the drawing should keep fine detail."""
    ycc = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    y, cr, cb = cv2.split(ycc)
    m = ((cr > 132) & (cr < 182) & (cb > 78) & (cb < 136) & (y > 55)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    if n > 1:
        keep = np.zeros_like(m)
        for i in range(1, n):
            if stats[i, cv2.CC_STAT_AREA] > 0.04 * m.size:
                keep[lab == i] = 1
        m = keep
    if feather:
        m = cv2.GaussianBlur(m.astype(np.float32), (0, 0), feather)
    return m


def dual_scale(crop, fine_sigma=1.5, coarse_sigma=3.0):
    """Fine detail on skin, coarse structure elsewhere.

    Hair and clothing are high-frequency texture: a small-sigma XDoG turns every
    strand into its own little scribble. Where there is skin we want eyelashes
    and lip lines, so the radius has to differ by region.
    """
    fine = xdog(prep(crop, 1.5), fine_sigma, 1.9, 0.955, 0.012, 26)
    coarse = xdog(prep(crop, 2.6), coarse_sigma, 2.0, 0.95, 0.012, 18)
    s = skin_mask(crop)[..., None]
    blend = (fine.astype(np.float32) * s + coarse.astype(np.float32) * (1 - s))
    return blend.astype(np.uint8)


def silhouette_ink(bgr, thick=2, border_skip=4):
    """The subject/background border -- in other words the face outline.

    An edge operator cannot find this: a cheek against a blurred wall has almost
    no local contrast, which is exactly why the autotrace face kept breaking
    apart at the jaw. A human starts with this line, so we produce it from the
    segmentation instead of from gradients.
    """
    m = (~bg_mask(bgr, grow=1)).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    if n < 2:
        return np.zeros_like(m)
    idx = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    sub = (lab == idx).astype(np.uint8) * 255
    cnts, _ = cv2.findContours(sub, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cnts = [c for c in cnts if cv2.contourArea(c) > 0.02 * sub.size]
    out = np.zeros_like(sub)
    cv2.drawContours(out, cnts, -1, 255, thick)
    b = border_skip                      # never trace the crop frame itself
    out[:b, :] = 0
    out[-b:, :] = 0
    out[:, :b] = 0
    out[:, -b:] = 0
    return out


# ------------------------------------------------------------------ render
PAPER = (238, 248, 253)      # BGR cream #fdf8ee


def render(strokes, widths, size=900, base_w=5.0):
    """Render with per-stroke pressure: long structural lines get heavier."""
    img = np.full((size, size, 3), PAPER, np.uint8)
    for i, st in enumerate(strokes):
        pts = np.array(st, np.float32).reshape(-1, 1, 2)
        w = widths[i] if i < len(widths) else base_w
        cv2.polylines(img, [np.round(pts).astype(np.int32)], False,
                      (28, 24, 26), max(1, int(round(w))), cv2.LINE_AA)
    return img


def run(name, ink, ml, sp, sg, bw=5.0):
    t = time.time()
    r = image_to_strokes(ink, 900, ml, sp, 24, sg, base_width=bw)
    dt = time.time() - t
    img = render(r["strokes"], r.get("widths", []), base_w=bw)
    cv2.imwrite(str(OUT / f"{name}.png"), img)
    ink_vis = ink if ink.max() > 40 else (ink * 255).astype(np.uint8)
    cv2.imwrite(str(OUT / f"{name}_ink.png"), ink_vis)
    avg = r["total_len"] / max(1, r["stroke_count"])
    print(f"{name:14s} {r['stroke_count']:4d}笔 {r['total_len']:6.0f}px "
          f"avg={avg:5.0f} {dt:.2f}s")
    return r


src = normalise(cv2.imread("data/samples/test01.jpg"))
crop = portrait_crop(src)
flat = prep(crop, 1.0)

# A/B: XDoG, two flavours -------------------------------------------------
run("A_xdog_soft", xdog(flat, 0.8, 1.6, 0.97, -0.035, 70), 10, 1.5, 16)
run("B_xdog_bold", xdog(prep(crop, 1.8), 1.3, 1.7, 0.96, -0.05, 45), 14, 1.9, 22)

# C: dodge pencil tone -> ink -------------------------------------------
d = dodge_sketch(crop, 34)
run("C_pencil", soft_ink(d.astype(np.float32) / 255.0, 0.42, 0.30), 10, 1.6, 16)

# G: pencil ink + background removed, smoothed strokes ------------------
g_ink = kill_bg(soft_ink(d.astype(np.float32) / 255.0, 0.40, 0.32), crop, 3)
run("G_pencil_clean", g_ink, 12, 1.2, 18, 5.2)

# H: xdog tuned for continuous curves + background removed --------------
h_ink = kill_bg(xdog(prep(crop, 1.5), 1.5, 1.9, 0.955, 0.012, 26), crop, 2)
run("H_xdog_clean", h_ink, 12, 1.2, 18, 5.2)

# I: region-boundary cartoon (few flat areas) + clean bg -----------------
i_ink = kill_bg(xdog(cv2.pyrMeanShiftFiltering(crop, 20, 30), 2.2, 1.9,
                     0.95, 0.010, 16), crop, 2)
run("I_cartoon_clean", i_ink, 14, 1.4, 20, 5.2)

# J: silhouette outline + xdog detail (the way a person actually draws) ---
j_sil = silhouette_ink(crop, 3)
j_det = kill_bg(xdog(prep(crop, 1.5), 1.5, 1.9, 0.955, 0.012, 26), crop, 2)
run("J_sil_xdog", np.maximum(j_sil, j_det), 12, 1.2, 20, 5.6)

# K: silhouette + cartoon detail (cleaner inner lines) -------------------
k_det = kill_bg(xdog(cv2.pyrMeanShiftFiltering(crop, 20, 30), 2.2, 1.9,
                     0.95, 0.010, 16), crop, 2)
run("K_sil_cartoon", np.maximum(j_sil, k_det), 14, 1.4, 22, 5.6)

# L: silhouette + pencil tone -------------------------------------------
l_det = kill_bg(soft_ink(d.astype(np.float32) / 255.0, 0.40, 0.32), crop, 3)
run("L_sil_pencil", np.maximum(j_sil, l_det), 12, 1.2, 18, 5.6)

# M: silhouette + dual-scale detail (recognised best so far) ------------
m_det = kill_bg(dual_scale(crop), crop, 2)
run("M_dual", np.maximum(j_sil, m_det), 12, 1.1, 20, 5.6)

# N: dual scale, heavier silhouette, fewer small strokes ----------------
run("N_dual_clean", np.maximum(silhouette_ink(crop, 4), m_det), 20, 1.4, 24, 6.0)

# D: XDoG from a heavily flattened frame (cartoon look) -----------------
cart = cv2.pyrMeanShiftFiltering(crop, 18, 28)
run("D_cartoon", xdog(cart, 1.0, 1.7, 0.96, -0.045, 55), 12, 1.8, 20)

# E: XDoG + pencil combined (line over tone) ---------------------------
e_ink = np.maximum(xdog(prep(crop, 1.6), 1.1, 1.7, 0.96, -0.045, 60),
                   soft_ink(d.astype(np.float32) / 255.0, 0.30, 0.34))
run("E_hybrid", e_ink, 10, 1.6, 18)

# F: same as B but tiny sigma -> hair strands and lashes ---------------
run("F_detail", xdog(prep(crop, 1.4), 0.6, 1.55, 0.98, -0.03, 110), 8, 1.4, 14)

print("saved to", OUT)
