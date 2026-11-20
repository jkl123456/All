"""Where is the hair, the face, the neck, the clothes?

The reveal animation paints one body part at a time (hair -> face -> neck ->
clothes) instead of sweeping the whole picture top to bottom, which looked
exactly like a printer. To do that it needs a rough region map of the drawing.

deepseek-flash reads a 640px JPEG and answers with normalised boxes in ~3 s,
which fits inside the 20 s generation window without adding latency. Results
are cached by image hash, so the same avatar is never analysed twice and a
network hiccup just falls back to geometric defaults instead of breaking a
drawing.
"""
from __future__ import annotations

import base64
import hashlib
import json
import re
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

import cv2

from .avatar import normalise

PARTS = ("hair", "face", "neck", "clothes")
DEFAULT_ORDER = ["hair", "face", "neck", "clothes"]

PROMPT = """这是一张人物画像。把画面分成四个区域，用 0~1 的比例坐标表示 [x0,y0,x1,y1]：
hair 头发（整个发际线以内、不含脸）、face 脸和五官、neck 脖子、clothes 衣服。
直接输出一行 JSON，不要任何解释：
{"hair":[x0,y0,x1,y1],"face":[x0,y0,x1,y1],"neck":[x0,y0,x1,y1],"clothes":[x0,y0,x1,y1],"order":["hair","face","neck","clothes"]}"""


def fallback() -> dict:
    """A centred headshot, which is what the prompts ask Doubao to draw."""
    return {
        "hair": [0.16, 0.00, 0.84, 0.46],
        "face": [0.27, 0.13, 0.73, 0.50],
        "neck": [0.38, 0.48, 0.62, 0.63],
        "clothes": [0.00, 0.56, 1.00, 1.00],
        "order": list(DEFAULT_ORDER),
        "src": "fallback",
    }


def _key(bgr) -> str:
    small = cv2.resize(bgr, (64, 64), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    return hashlib.md5(gray.tobytes()).hexdigest()[:16]


def _clean(raw: str) -> dict | None:
    """Pull the first JSON object out of a chat reply and sanity-check it."""
    m = re.search(r"\{.*\}", raw, re.S)
    if not m:
        return None
    try:
        d = json.loads(m.group(0))
    except Exception:
        return None
    out: dict = {}
    for p in PARTS:
        v = d.get(p)
        if not (isinstance(v, (list, tuple)) and len(v) == 4):
            return None
        try:
            x0, y0, x1, y1 = (float(t) for t in v)
        except (TypeError, ValueError):
            return None
        x0, x1 = sorted((max(0.0, min(1.0, x0)), max(0.0, min(1.0, x1))))
        y0, y1 = sorted((max(0.0, min(1.0, y0)), max(0.0, min(1.0, y1))))
        if x1 - x0 < 0.03 or y1 - y0 < 0.03:
            return None
        out[p] = [round(x0, 3), round(y0, 3), round(x1, 3), round(y1, 3)]
    order = [o for o in (d.get("order") or []) if o in PARTS]
    out["order"] = order if len(order) == 4 else list(DEFAULT_ORDER)
    return out


def _ask(bgr, conf: dict) -> dict | None:
    h, w = bgr.shape[:2]
    sc = 640.0 / max(h, w)
    small = cv2.resize(bgr, (max(1, int(w * sc)), max(1, int(h * sc))))
    ok, buf = cv2.imencode(".jpg", small, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
    if not ok:
        return None
    b64 = base64.b64encode(buf.tobytes()).decode()

    body = {
        "model": conf.get("model", "deepseek-flash"),
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": PROMPT},
            {"type": "image_url",
             "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
        ]}],
        # This model spends most of its budget on hidden reasoning before it
        # answers (1.7-2.4k tokens for a four-box reply), and when the cap cuts
        # the JSON short the whole answer is unusable. Low effort plus a roomy
        # cap keeps it fast and parseable.
        "max_tokens": int(conf.get("max_tokens", 3000)),
        "reasoning_effort": conf.get("effort", "low"),
        "temperature": 0.1,
    }
    url = (conf.get("base_url") or "https://api.deepseek.com").rstrip("/")
    req = urllib.request.Request(
        f"{url}/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {conf.get('api_key', '')}",
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=float(conf.get("timeout", 30))) as r:
        data = json.loads(r.read())
    msg = (data.get("choices") or [{}])[0].get("message") or {}
    return _clean(msg.get("content") or "")


def analyze(bgr, conf: dict | None, cache_dir: Path | None = None,
            blocking: bool = False) -> dict:
    """Region boxes for one picture. Never raises: falls back to geometry.

    `blocking=False` (the default) is what the live pipeline uses. A miss
    returns the geometric defaults immediately and kicks off the model call in
    a background thread, so an 11 s analysis never sits between the viewer
    pressing the gift button and the brush touching the paper. The answer lands
    in the cache, and the same picture -- which is the normal case for the
    stand-in rotation -- gets the real boxes next time round.

    `blocking=True` waits for the model, which is what the startup pre-warm
    uses since nothing is on screen yet.
    """
    conf = conf or {}
    if not conf.get("enabled", True) or not conf.get("api_key"):
        return fallback()

    key = _key(bgr)
    cache = Path(cache_dir) / f"{key}.json" if cache_dir else None
    if cache and cache.exists():
        try:
            d = json.loads(cache.read_text(encoding="utf-8"))
            if all(p in d for p in PARTS):
                return {**d, "src": "cached"}
        except Exception:
            pass

    if not blocking:
        _warm(bgr, conf, cache, key)
        return {**fallback(), "src": "warming"}

    t0 = time.time()
    try:
        d = _ask(bgr, conf)
    except (urllib.error.URLError, urllib.error.HTTPError, OSError, ValueError,
            json.JSONDecodeError, KeyError, IndexError):
        d = None
    if not d:
        return fallback()

    d["src"] = "ai"
    d["ms"] = int((time.time() - t0) * 1000)
    _store(d, cache)
    return d


_inflight: set[str] = set()
_inflight_lock = threading.Lock()


def _store(d: dict, cache: Path | None) -> None:
    if not cache:
        return
    cache.parent.mkdir(parents=True, exist_ok=True)
    try:
        cache.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
    except OSError:
        pass


def _warm(bgr, conf: dict, cache: Path | None, key: str) -> None:
    """Analyse in the background and leave the result in the cache."""
    with _inflight_lock:
        if key in _inflight:
            return
        _inflight.add(key)
    frame = bgr.copy()

    def run() -> None:
        try:
            d = _ask(frame, conf)
            if d:
                d["src"] = "ai"
                _store(d, cache)
        except Exception:
            pass
        finally:
            with _inflight_lock:
                _inflight.discard(key)

    threading.Thread(target=run, daemon=True, name=f"regions-{key[:6]}").start()


def prewarm(paths, conf: dict | None, cache_dir: Path,
            stop=None) -> int:
    """Fill the cache for a folder of pictures, one at a time.

    The stand-in pool rotates through 20 files, so warming them once means the
    live path is served entirely from cache afterwards.
    """
    conf = conf or {}
    if not conf.get("enabled", True) or not conf.get("api_key"):
        return 0
    done = 0
    for p in paths:
        if stop is not None and stop.is_set():
            break
        img = cv2.imread(str(p))
        if img is None:
            continue
        # Same square crop the live path applies before hashing. Skipping it
        # here would key the cache on different pixels than the pipeline does,
        # so every rotation would miss and burn another model call.
        img = normalise(img)
        try:
            if analyze(img, conf, cache_dir, blocking=True).get("src") == "ai":
                done += 1
        except Exception:
            pass
    return done
