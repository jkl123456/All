"""Avatar -> ink mask (line art).

Providers
  local    : pure OpenCV, zero cost, instant. Good enough for live use.
  openai   : any OpenAI-compatible image endpoint (Doubao / DashScope / SD ...)
  command  : shell out to your own script, {in} and {out} placeholders

All providers return a bool ink mask (True = ink) ready for strokes.py.
"""
from __future__ import annotations

import asyncio
import base64
import shutil
import subprocess
import tempfile
from pathlib import Path

import cv2
import httpx
import numpy as np

from .avatar import portrait_crop

DEFAULT_PROMPT = (
    "Turn this profile photo into a minimalist black-ink line drawing "
    "(simple cartoon sketch). Rules: pure black outlines on pure white "
    "background, no shading, no hatching, no grey, no colour, keep the "
    "hairstyle and facial features recognisable, single continuous clean "
    "lines, comic style, leave generous white margin."
)

# Style block for text-to-image models. These models obey style far better than
# they obey "keep this exact face", so the style has to be spelled out hard.
DRAW_STYLE = (
    "Minimalist black ink line drawing of {subject}, quick live-sketch style. "
    "Pure black lines on pure white paper, single-weight continuous strokes, "
    "no shading, no hatching, no grey tones, no colour, no background. "
    "Simple cartoon proportions, confident smooth curves, generous white margin."
)

DESCRIBE_PROMPT = (
    "Describe the person in this photo in one short English sentence for an "
    "artist who will draw their portrait: apparent gender, approximate age, "
    "hair length / colour / style, glasses or beard, and expression. "
    "Do not mention the background. Answer with the sentence only."
)


# ------------------------------------------------------------------ helpers
def _clean(mask: np.ndarray, min_area: int = 20, max_thick: float = 0.0) -> np.ndarray:
    """Drop specks and solid blobs.

    Thin lines survive; filled regions (deep shadows, striped fabric) are removed
    by width, measured with a single distance transform over the whole mask.
    """
    m = (mask > 0).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    dt = cv2.distanceTransform(m, cv2.DIST_L2, 3) if max_thick else None
    keep = np.zeros_like(m)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < min_area:
            continue
        comp = lab == i
        if dt is not None and dt[comp].max() * 2 > max_thick:
            continue
        keep[comp] = 1
    return keep > 0


def _side_mask(bgr: np.ndarray, tol: float = 42, grow: int = 2) -> np.ndarray:
    """Background = the colour that owns the four corners.

    Restricted to the component touching the frame, so a head cropped by the
    border survives. Without this the wall behind the subject turns into
    hundreds of meaningless strokes -- that was the main reason the old output
    looked dirty rather than drawn.
    """
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


def _skin_mask(bgr: np.ndarray, feather: int = 5) -> np.ndarray:
    """Rough YCrCb skin detector. Accuracy is not the point: it only decides
    where the drawing keeps fine detail."""
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


def _silhouette(bgr: np.ndarray, thick: int = 3, border: int = 4) -> np.ndarray:
    """The subject/background border, i.e. the face outline.

    An edge operator cannot find this: a cheek against a blurred wall has almost
    no local contrast, which is exactly why an autotraced face keeps breaking
    apart at the jaw. A person starts with this line, so we build it from the
    segmentation instead of from gradients.
    """
    m = (~_side_mask(bgr, grow=1)).astype(np.uint8) * 255
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
    out[:border, :] = 0                       # never trace the crop frame
    out[-border:, :] = 0
    out[:, :border] = 0
    out[:, -border:] = 0
    return out


def _prep(bgr: np.ndarray, strength: float = 1.0) -> np.ndarray:
    """Flatten texture, keep structure: two bilateral passes kill pores and
    fabric weave while the jaw line and eyelashes survive."""
    s = cv2.bilateralFilter(bgr, 9, int(75 * strength), 9)
    return cv2.bilateralFilter(s, 9, int(75 * strength), 9)


def _xdog(bgr: np.ndarray, sigma: float, k: float, p: float, eps: float,
          phi: float) -> np.ndarray:
    """Extended difference of Gaussians -- the standard operator for painterly
    line art. Unlike Canny it yields smooth, variable-width strokes."""
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
    g1 = cv2.GaussianBlur(g, (0, 0), sigma)
    g2 = cv2.GaussianBlur(g, (0, 0), sigma * k)
    d = g1 - p * g2
    e = np.where(d >= eps, 1.0, 1.0 + np.tanh(phi * (d - eps)))
    return np.clip((1.0 - e) * 255, 0, 255).astype(np.uint8)


def _portrait_ink(bgr: np.ndarray, fine: float = 1.5, coarse: float = 2.9,
                  detail: bool = False) -> np.ndarray:
    """Outline + dual-scale interior detail.

    Skin gets a small radius (eyelashes, lip line); hair and clothing get a
    large one, because at a small radius every strand becomes its own scribble.
    The silhouette is unioned in so the face stays closed.
    """
    f = _xdog(_prep(bgr, 1.5), fine if not detail else 0.9, 1.9, 0.955,
              0.012, 26)
    c = _xdog(_prep(bgr, 2.6), coarse, 2.0, 0.95, 0.012, 18)
    s = _skin_mask(bgr)
    det = (f.astype(np.float32) * s + c.astype(np.float32) * (1 - s)).astype(np.uint8)
    bg = _side_mask(bgr, grow=2)
    det[bg] = 0
    sil = _silhouette(bgr, 3)
    return np.maximum(det, sil)


def _absorb_tiny(labels: np.ndarray, h: int, w: int,
                 ratio: float = 0.004, rounds: int = 2) -> np.ndarray:
    """Merge small colour regions into their surroundings, otherwise every hair
    strand becomes its own outline."""
    for _ in range(rounds):
        for lb in np.unique(labels):
            m = labels == lb
            if m.sum() < ratio * h * w:
                ring = cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
                ring &= ~m
                if ring.any():
                    labels[m] = np.bincount(labels[ring]).argmax()
    return labels


def _region_ink(bgr: np.ndarray, k: int = 4) -> np.ndarray:
    """Cartoon line art: flatten the photo into k colour regions and keep the
    region boundaries.

    Region boundaries are single closed curves by construction, so there are no
    Canny double edges and no skin-texture noise. This is what makes the result
    read as a drawing instead of a photo trace.
    """
    sm = cv2.bilateralFilter(bgr, 9, 90, 9)
    sm = cv2.bilateralFilter(sm, 9, 90, 9)
    h, w = sm.shape[:2]
    lab = cv2.cvtColor(sm, cv2.COLOR_BGR2LAB).astype(np.float32)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
    _, labels, _ = cv2.kmeans(lab.reshape(-1, 3), k, None, crit, 3,
                              cv2.KMEANS_PP_CENTERS)
    labels = _absorb_tiny(labels.reshape(h, w), h, w)

    edge = np.zeros((h, w), np.uint8)
    edge[:, :-1] |= (labels[:, :-1] != labels[:, 1:]).astype(np.uint8) * 255
    edge[:-1, :] |= (labels[:-1, :] != labels[1:, :]).astype(np.uint8) * 255

    m = max(2, int(0.014 * w))          # the crop frame is not a real edge
    edge[:m, :] = 0
    edge[-m:, :] = 0
    edge[:, :m] = 0
    edge[:, -m:] = 0
    return _clean(edge, 12, 0)


def to_ink(gray_or_bgr: np.ndarray, mode: str = "portrait", blur: int = 3,
           k: int = 4) -> np.ndarray:
    """Photo -> ink mask (True = ink).

    portrait  silhouette + dual-scale XDoG (default, reads as a drawing)
    detail    same but keeps eyelashes / hair strands
    simple    few flat regions, for the cheapest gift tier
    region    colour-region boundaries, k regions
    canny     legacy edge trace
    """
    bgr = gray_or_bgr if gray_or_bgr.ndim == 3 else \
        cv2.cvtColor(gray_or_bgr, cv2.COLOR_GRAY2BGR)

    if mode == "portrait":
        return _clean(_portrait_ink(bgr), 14)
    if mode == "detail":
        return _clean(_portrait_ink(bgr, detail=True), 10)
    if mode == "simple":
        return _region_ink(bgr, max(2, min(k, 3)))
    if mode == "region":
        return _region_ink(bgr, k)

    g = gray_or_bgr if gray_or_bgr.ndim == 2 else cv2.cvtColor(gray_or_bgr, cv2.COLOR_BGR2GRAY)
    if mode == "canny":
        s = cv2.GaussianBlur(g, (blur * 2 + 1, blur * 2 + 1), 0)
        return _clean(cv2.Canny(s, 45, 120), 20, 9)

    g = cv2.fastNlMeansDenoising(g, None, 8, 7, 21)
    g = cv2.medianBlur(g, 5)
    g = cv2.bilateralFilter(g, 7, 60, 60)
    g = cv2.GaussianBlur(g, (blur * 2 + 1, blur * 2 + 1), 0)
    lo, hi = (14, 48) if mode == "detail2" else (22, 74)
    # min_area must stay small: thin line fragments are real ink, not noise.
    return _clean(cv2.Canny(g, lo, hi), 10, 14)


def png_bytes(arr: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".png", arr if arr.dtype == np.uint8 else (arr * 255).astype(np.uint8))
    if not ok:
        raise RuntimeError("png encode failed")
    return buf.tobytes()


# ------------------------------------------------------------------ providers
class LocalProvider:
    def __init__(self, cfg: dict):
        self.cfg = cfg

    async def render(self, avatar_bgr: np.ndarray, mode: str | None = None,
                     k: int | None = None) -> np.ndarray:
        mode = mode or self.cfg.get("mode", "portrait")
        blur = int(self.cfg.get("blur", 3))
        k = int(k if k is not None else self.cfg.get("k", 4))
        return await asyncio.to_thread(to_ink, avatar_bgr, mode, blur, k)


class OpenAIProvider:
    """OpenAI-compatible /images/edits. Returns ink mask from the result."""

    def __init__(self, cfg: dict):
        self.cfg = cfg

    async def render(self, avatar_bgr: np.ndarray, mode: str | None = None,
                     k: int | None = None) -> np.ndarray:
        base = self.cfg["base_url"].rstrip("/")
        key = self.cfg["api_key"]
        if not key:
            raise RuntimeError("sketch.openai.api_key is empty")
        ok, buf = cv2.imencode(".jpg", avatar_bgr, [cv2.IMWRITE_JPEG_QUALITY, 92])
        files = {"image": ("avatar.jpg", buf.tobytes(), "image/jpeg")}
        data = {
            "model": self.cfg["model"],
            "prompt": self.cfg.get("prompt") or DEFAULT_PROMPT,
            "size": "1024x1024",
            "n": "1",
        }
        headers = {"Authorization": f"Bearer {key}"}
        async with httpx.AsyncClient(timeout=120) as c:
            r = await c.post(f"{base}/images/edits", headers=headers, data=data, files=files)
            if r.status_code >= 400:
                raise RuntimeError(f"image api {r.status_code}: {r.text[:300]}")
            j = r.json()
        item = j["data"][0]
        if item.get("b64_json"):
            raw = base64.b64decode(item["b64_json"])
        else:
            async with httpx.AsyncClient(timeout=60) as c:
                raw = (await c.get(item["url"])).content
        img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            raise RuntimeError("model returned undecodable image")
        # model already returns line art -> hard binarise, do not re-extract edges
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, ink = cv2.threshold(g, 155, 255, cv2.THRESH_BINARY_INV)
        return _clean(ink, 14)


class CommandProvider:
    def __init__(self, cfg: dict):
        self.cfg = cfg

    async def render(self, avatar_bgr: np.ndarray, mode: str | None = None,
                     k: int | None = None) -> np.ndarray:
        tmpl: list[str] = self.cfg["command"]
        with tempfile.TemporaryDirectory() as td:
            src, dst = Path(td) / "in.png", Path(td) / "out.png"
            src.write_bytes(png_bytes(avatar_bgr))
            argv = [a.replace("{in}", str(src)).replace("{out}", str(dst)) for a in tmpl]
            await asyncio.to_thread(subprocess.run, argv, check=True)
            img = cv2.imread(str(dst))
            if img is None:
                raise RuntimeError("command provider produced no image")
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
        return to_ink(g, "lineart")


def _image_to_ink(img: np.ndarray, min_white: float = 0.45) -> np.ndarray:
    """A model output -> ink mask.

    Line art is mostly white with thin dark lines, so Otsu is reliable. If the
    model ignored the style and returned a grey picture or a photo, Otsu would
    make half the frame solid black, so we detect that and fall back to the
    local portrait operator instead of shipping a black square.
    """
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    _, ink = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    white = float((g > 200).mean())
    if white < min_white:
        print(f"[sketch] model output is not line art (white={white:.2f}); "
              "re-extracting locally")
        return _clean(_portrait_ink(cv2.cvtColor(g, cv2.COLOR_GRAY2BGR)), 14)
    return _clean(ink, 12)


# public alias: an already-finished drawing (from Doubao or any external tool)
# goes straight through this, no line extraction involved.
image_to_ink = _image_to_ink


class ZhipuProvider:
    """Two free Zhipu models chained: a vision model looks at the avatar and
    writes one sentence, then the text-to-image model draws from it.

    Why not image-to-image? The reliable image-edit endpoints are paid. Both
    models here are on Zhipu's free list, so this is the only genuinely
    zero-cost route that still produces a real drawing rather than an edge
    trace. The trade-off is likeness: the result looks like a drawing of a
    person who resembles the viewer, not a portrait of them.
    """

    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.base = (cfg.get("base_url")
                     or "https://open.bigmodel.cn/api/paas/v4").rstrip("/")
        self.key = cfg.get("api_key") or ""
        self.vlm = cfg.get("vlm") or "glm-4.6v-flash"
        self.model = cfg.get("model") or "cogview-3-flash"
        self.style = cfg.get("style") or DRAW_STYLE

    def _headers(self) -> dict:
        if not self.key:
            raise RuntimeError("sketch.zhipu.api_key is empty")
        return {"Authorization": f"Bearer {self.key}"}

    async def describe(self, bgr: np.ndarray) -> str:
        ok, buf = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, 88])
        if not ok:
            raise RuntimeError("encode failed")
        b64 = base64.b64encode(buf.tobytes()).decode()
        payload = {
            "model": self.vlm,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "image_url",
                     "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                    {"type": "text", "text": DESCRIBE_PROMPT},
                ],
            }],
            "temperature": 0.3,
        }
        async with httpx.AsyncClient(timeout=40) as c:
            r = await c.post(f"{self.base}/chat/completions",
                             headers=self._headers(), json=payload)
            if r.status_code >= 400:
                raise RuntimeError(f"vlm {r.status_code}: {r.text[:200]}")
            j = r.json()
        return (j["choices"][0]["message"]["content"] or "").strip()

    async def render(self, bgr: np.ndarray, mode: str | None = None,
                     k: int | None = None) -> np.ndarray:
        desc = await self.describe(bgr)
        prompt = self.style.format(subject=desc)
        payload = {"model": self.model, "prompt": prompt, "size": "1024x1024"}
        async with httpx.AsyncClient(timeout=90) as c:
            r = await c.post(f"{self.base}/images/generations",
                             headers=self._headers(), json=payload)
            if r.status_code >= 400:
                raise RuntimeError(f"image api {r.status_code}: {r.text[:250]}")
            j = r.json()
            item = (j.get("data") or [{}])[0]
            if item.get("b64_json"):
                raw = base64.b64decode(item["b64_json"])
            elif item.get("url"):
                raw = (await c.get(item["url"])).content
            else:
                raise RuntimeError(f"no image in response: {str(j)[:200]}")
        img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            raise RuntimeError("model returned undecodable image")
        return _image_to_ink(img)


# The two styles that were verified to look right on a real avatar. Keep the
# wording stable: these prompts are tuned for image-to-image on Seedream, and
# small edits change the output noticeably.
SEEDREAM_STYLE = {
    # 极简黑墨线稿 —— 单一线宽、纯白底，逐笔描出来最像手绘
    "ink": (
        "Transform this portrait into a minimalist black ink line drawing on "
        "pure white background, like a street artist's quick live sketch. "
        "Pure black single-weight continuous lines, no shading, no hatching, "
        "no grey tones, no colour, no background. Keep the hairstyle, eyes, "
        "eyebrows, nose and mouth clearly recognisable but simplify "
        "aggressively - omit skin texture, clothing detail and all background. "
        "Flat 2D comic line art, generous white space, confident smooth curves."
    ),
    # 石墨铅笔素描 —— 有轻重变化和少量排线，配合本地排线层
    "pencil": (
        "Transform this portrait into a loose graphite pencil sketch on clean "
        "white paper, like a street artist's 3-minute portrait. Visible pencil "
        "strokes with varied pressure and natural hand wobble, light "
        "directional cross-hatching only in the hair and under the chin, white "
        "paper background with no colour and no background objects. The face "
        "must stay recognisable: eyes, eyebrows, nose, lips and jawline clearly "
        "drawn. Artistic and confident, not photographic."
    ),
    # 彩色线稿 —— 只上大色块，不要渐变，色块留给本地填充
    "color": (
        "Turn this portrait into a clean flat-colour cartoon line illustration: "
        "crisp black outlines with 4 to 6 flat solid colour blocks for skin, "
        "hair and clothing, no gradients, no airbrush, no photo texture, "
        "white background removed. Simple comic-book colouring, generous flat "
        "areas that are easy to fill in with a marker, features clearly "
        "recognisable and simplified."
    ),
}


class SeedreamProvider:
    """火山方舟 Seedream 图生图（/images/generations + image 参数）。

    和 OpenAI 的 /images/edits（multipart）不是同一个接口：火山这边是把参考图
    以 data URL 放进 JSON 的 image 字段，返回 b64_json 或 url。走 OpenAI 那套
    适配器会 400。
    """

    supports_style = True

    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.base = (cfg.get("base_url")
                     or "https://ark.cn-beijing.volces.com/api/v3").rstrip("/")
        self.key = cfg.get("api_key") or ""
        self.model = cfg.get("model") or "doubao-seedream-5-0-flash-260915"
        self.size = cfg.get("size") or "1024x1024"
        self.watermark = bool(cfg.get("watermark", False))

    async def render(self, bgr: np.ndarray, mode: str | None = None,
                     k: int | None = None, style: str | None = None) -> np.ndarray:
        if not self.key:
            raise RuntimeError("sketch.seedream.api_key is empty")
        name = style or self.cfg.get("style") or "ink"
        prompt = self.cfg.get("prompt") or SEEDREAM_STYLE.get(name, SEEDREAM_STYLE["ink"])

        ok, buf = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, 92])
        if not ok:
            raise RuntimeError("encode failed")
        data_url = "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode()

        payload = {
            "model": self.model,
            "prompt": prompt,
            "image": data_url,
            "size": self.size,
            "response_format": "b64_json",
            "watermark": self.watermark,
        }
        async with httpx.AsyncClient(timeout=120) as c:
            r = await c.post(f"{self.base}/images/generations",
                             headers={"Authorization": f"Bearer {self.key}"},
                             json=payload)
            if r.status_code >= 400:
                raise RuntimeError(f"seedream {r.status_code}: {r.text[:300]}")
            j = r.json()
        item = (j.get("data") or [{}])[0]
        if item.get("b64_json"):
            raw = base64.b64decode(item["b64_json"])
        elif item.get("url"):
            async with httpx.AsyncClient(timeout=60) as c:
                raw = (await c.get(item["url"])).content
        else:
            raise RuntimeError(f"no image in response: {str(j)[:200]}")
        img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            raise RuntimeError("model returned undecodable image")
        return _image_to_ink(img)


def build_provider(cfg: dict):
    name = cfg.get("provider", "local")
    if name == "local":
        return LocalProvider(cfg.get("local") or {})
    if name == "seedream":
        return SeedreamProvider(cfg.get("seedream") or {})
    if name == "zhipu":
        return ZhipuProvider(cfg.get("zhipu") or {})
    if name == "openai":
        return OpenAIProvider(cfg.get("openai") or {})
    if name == "command":
        return CommandProvider(cfg.get("command_cfg") or cfg)
    raise ValueError(f"unknown sketch provider: {name}")


async def render_with_fallback(provider, avatar_bgr: np.ndarray,
                               mode: str | None = None,
                               k: int | None = None,
                               style: str | None = None) -> tuple[np.ndarray, str, np.ndarray]:
    """Returns (ink mask, provider name, the cropped frame used).

    The crop is returned because the colour and shading layers must be built
    from exactly the same pixels the line art came from, otherwise the fills
    land in the wrong place.
    """
    crop = avatar_bgr
    try:
        crop = await asyncio.to_thread(portrait_crop, avatar_bgr)
    except Exception as e:
        print(f"[sketch] portrait crop failed ({e}); using full frame")
    try:
        if getattr(provider, "supports_style", False):
            ink = await provider.render(crop, style=style)
        else:
            ink = await provider.render(crop, mode, k)
        return ink, type(provider).__name__, crop
    except Exception as e:  # never break the live stream
        print(f"[sketch] provider failed ({e}); fallback to local lineart")
        ink = await asyncio.to_thread(to_ink, crop, mode or "detail", 3, k or 4)
        return ink, "LocalProvider(fallback)", crop
