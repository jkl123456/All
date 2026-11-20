from __future__ import annotations

import asyncio
import contextlib
import json
import re
import threading
import time
from collections import deque
from pathlib import Path

import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .bus import Bus
from .config import ROOT, load
from .pipeline import regions as regions_mod
from .pipeline import sketch as sketch_mod
from .pipeline import styles as styles_mod
from .pipeline import tiers as tiers_mod
from .pipeline.avatar import load_avatar
from .pipeline.strokes import image_to_strokes
from .platforms.base import build_source
from .queue_manager import QueueManager
from .virtual import VirtualPool

cfg = load()
DATA = Path(cfg["paths"]["data"])
if not DATA.is_absolute():
    DATA = ROOT / DATA
DATA.mkdir(parents=True, exist_ok=True)

bus = Bus()
qm = QueueManager(cfg["queue"])
provider = sketch_mod.build_provider(cfg["sketch"])
source = build_source(cfg)
virtual = VirtualPool(cfg.get("virtual"), DATA)
styles = styles_mod.Styles(cfg.get("styles"), ROOT)
LOGS: deque[str] = deque(maxlen=200)
# The overlay pins the last few finished pictures to the desk, top-left, the
# way a live sketch stream keeps the works it already drew within reach.
RECENT: deque[dict] = deque(maxlen=8)
_draw_done = asyncio.Event()
# Flipped on shutdown so the background region pre-warm stops between files.
_stop = threading.Event()
_tasks: list[asyncio.Task] = []
# The drawing currently on screen, so a browser that connects mid-picture can
# replay it instead of staring at "waiting" for the next order.
CURRENT: tuple[dict, float, float] | None = None

TIERS = sorted(cfg.get("tiers") or [], key=lambda t: -float(t.get("min_value", 0)))
GIFTS = {str(k): float(v) for k, v in (cfg.get("gifts") or {}).items()}


def tier_for(value: float) -> dict:
    """Pick the drawing tier for a gift price (CNY)."""
    for t in TIERS:
        if value >= float(t.get("min_value", 0)):
            return t
    return TIERS[-1] if TIERS else {"key": "simple", "name": "简单", "mode": "detail"}


def tier_by_name(name: str) -> dict | None:
    name = (name or "").strip()
    for t in TIERS:
        if name in (t.get("key"), t.get("name")):
            return t
    return None


def log(msg: str) -> None:
    line = f"{time.strftime('%H:%M:%S')} {msg}"
    LOGS.append(line)
    print(line, flush=True)


def _decorate(o: dict | None) -> dict | None:
    """Attach the tier a waiting order will be drawn in, for the UIs.

    `style_name` is what the overlay badge shows: the viewer cares whether they
    are getting 素描/动漫/沙画/水粉, not which price bracket they are in.
    """
    if not o:
        return None
    t = tier_for(float(o.get("value") or 0))
    sk = styles.resolve(o.get("style") or o.get("gift"))
    # tier_name carries the art direction (素描/动漫/沙画/水粉) because that is
    # the only thing a viewer can see; the price bracket stays in `tier` for
    # the badge's colour.
    return {**o, "tier": t.get("key"), "tier_name": styles.name(sk),
            "style": sk, "style_name": styles.name(sk)}


def queue_view() -> dict:
    s = qm.snapshot()
    return {**s,
            "queue": [_decorate(o) for o in s["queue"]],
            "current": _decorate(s["current"]),
            "recent": list(RECENT)[:3],
            "virtual": virtual.status()}


# Which AI prompt style a gift tier maps to. Only used when sketch.provider is
# an image model; the local provider ignores it.
STYLE_BY_TIER = {"fine": "pencil", "sketch": "ink", "color": "color", "simple": "ink"}


def _style_for(tier: dict) -> str:
    return STYLE_BY_TIER.get(str(tier.get("key", "")), "ink")


# ---------------------------------------------------------------- pipeline
READY: asyncio.Queue = asyncio.Queue(maxsize=2)


async def build_payload(order) -> dict | None:
    """Avatar -> line art -> (shading, colour) -> overlay payload."""
    t0 = time.time()
    d = cfg["draw"]
    canvas = int(d.get("canvas", 900))
    margin = 24
    tier = tier_for(order.value)
    # Gift (or an explicit style from the grabber) picks the art direction;
    # the price tier only picks the pace.
    style_key = styles.resolve(order.style or order.gift)

    avatar = await load_avatar(order.avatar, DATA)

    if order.art or order.kind in ("ai", "virtual"):
        # Doubao already produced the finished artwork (virtual orders are
        # pre-drawn pictures from data/virtual/). Re-tracing it into pen
        # strokes only made it look broken -- the picture is a pencil drawing
        # now, with hundreds of soft strokes. So we ship the image itself and
        # let the overlay paint it in under a moving brush.
        stamp = time.strftime("%m%d_%H%M%S")
        av_name = f"{stamp}_{order.seq}.jpg"
        (DATA / "avatars").mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(DATA / "avatars" / av_name), avatar)
        # Which part of the picture is hair / face / neck / clothes decides the
        # painting order. Cached per image, ~3 s on a miss.
        region_map = await asyncio.to_thread(
            regions_mod.analyze, avatar, cfg.get("regions"),
            DATA / "cache" / "regions")
        payload = {
            **order.brief(),
            "mode": "reveal",
            "tier": tier.get("key", "simple"),
            "tier_name": styles.name(style_key),
            "style": style_key,
            # A virtual order's picture is its own artwork, not a viewer photo,
            # so the overlay draws a letter tile instead of that image.
            # The picture itself is not the viewer's face, so only a
            # Doubao order shows it in the avatar circle.
            "avatar_url": "" if order.kind != "ai"
                          else f"/data/avatars/{av_name}",
            "art_url": f"/data/avatars/{av_name}",
            "regions": region_map,
            "size": [canvas, canvas],
            "duration_ms": int(float(tier.get("duration", 1.0)) * 1000),
            "hold_seconds": float(tier.get("hold_seconds", d.get("hold_seconds", 0.3))),
            "provider": "doubao" if order.kind == "ai" else "virtual",
            "elapsed": round(time.time() - t0, 2),
        }
        log(f"@{order.nickname} [{styles.name(style_key)}] 成稿渐显 "
            f"{avatar.shape[1]}x{avatar.shape[0]} / 分区{region_map.get('src')}"
            f" / {payload['elapsed']}s")
        return payload

    ink, who, crop = await sketch_mod.render_with_fallback(
        provider, avatar, tier.get("mode", "detail"), tier.get("k"),
        style=tier.get("ai_style") or _style_for(tier))

    def to_strokes(tt: dict) -> dict:
        return image_to_strokes(
            ink,
            canvas=canvas,
            min_len=float(tt.get("min_stroke_len", d.get("min_stroke_len", 8))),
            simplify=float(tt.get("simplify", d.get("simplify", 1.6))),
            stitch_gap=float(tt.get("stitch_gap", d.get("stitch_gap", 14))),
            margin=margin,
        )

    res = to_strokes(tier)
    if res["stroke_count"] < 4 and tier.get("mode") == "simple":
        # too aggressive for this face -> fall back to the normal line art
        log(f"@{order.nickname} 简单档线稿过少({res['stroke_count']}笔)，改用标准线稿")
        ink, who, crop = await sketch_mod.render_with_fallback(provider, avatar, "detail")
        res = to_strokes({"mode": "detail"})
    if res["stroke_count"] < 4:
        log(f"@{order.nickname} 线稿太稀疏({res['stroke_count']}笔)，跳过")
        return None

    hatch: list = []
    fills: list = []
    if tier.get("hatch") and order.kind != "ai":
        # Hatching reads brightness from the photo; a finished line art has
        # none, so AI orders skip it rather than scribbling over the drawing.
        hatch = await asyncio.to_thread(tiers_mod.hatch_strokes, crop, canvas, margin)
    if tier.get("color"):
        # For AI orders the artwork itself carries the colours (Doubao drew a
        # coloured version), so the blocks come from it, not from the photo.
        src = avatar if order.kind == "ai" else crop
        if order.kind == "ai" and not _has_colour(avatar):
            log(f"@{order.nickname} 彩色档拿到的是黑白稿，跳过上色")
        else:
            fills = await asyncio.to_thread(tiers_mod.color_fills, src, canvas,
                                            margin, int(tier.get("fills_k", 5)))

    stamp = time.strftime("%m%d_%H%M%S")
    tag = f"{stamp}_{order.seq}"
    cv2.imwrite(str(DATA / "sketches" / f"{tag}.png"), (ink * 255).astype("uint8"))
    payload_json = {**res, "tier": tier.get("key"), "hatch": len(hatch),
                    "fills": len(fills)}
    (DATA / "sketches" / f"{tag}.json").write_text(
        json.dumps(payload_json, ensure_ascii=False), encoding="utf-8")
    av_name = f"{stamp}_{order.seq}.jpg"
    cv2.imwrite(str(DATA / "avatars" / av_name), avatar)

    payload = {
        **order.brief(),
        "tier": tier.get("key", "simple"),
        "tier_name": tier.get("name", "简单"),
        "avatar_url": f"/data/avatars/{av_name}",
        "strokes": res["strokes"],
        "hatch": hatch,
        "fills": fills,
        "size": res["size"],
        "stroke_width": float(tier.get("stroke_width", d.get("stroke_width", 4.0))),
        "duration_ms": int(float(tier.get("duration", 1.0)) * 1000),
        "hold_seconds": float(tier.get("hold_seconds", d.get("hold_seconds", 0.3))),
        "total_len": res["total_len"],
        "provider": who,
        "elapsed": round(time.time() - t0, 2),
    }
    log(f"@{order.nickname} [{tier.get('name')}] 出图 {res['stroke_count']} 笔"
        f"{' +阴影%d' % len(hatch) if hatch else ''}"
        f"{' +上色%d' % len(fills) if fills else ''}"
        f" / {res['total_len']}px / {payload['elapsed']}s / {who}")
    return payload


def _has_colour(bgr) -> bool:
    """A near-greyscale image means the model returned line art, not colour.

    Painting k-means blocks over a black-and-white drawing just makes grey
    smudges, so the colour tier checks first.
    """
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    return float(hsv[:, :, 1].mean()) > 25.0


async def producer() -> None:
    """Prepare drawings ahead of time so generation never blocks the pen."""
    while True:
        # Two finished drawings in hand is enough. Racing ahead of the playback
        # emptied the queue instantly, so the overlay showed "0 waiting" while
        # a picture was being drawn.
        if READY.full():
            await asyncio.sleep(0.15)
            continue
        # Refill the stand-ins right after popping, and top the queue up on
        # every pass -- filling only when empty meant the queue went straight
        # back to zero each time a drawing finished. Five is what the phone
        # screen shows, so the list is never half empty. Never refill while a
        # real viewer is waiting: they must not queue behind fake people.
        order = qm.pop()
        has_real = any(o.kind != "virtual" for o in qm.items)
        if (not has_real and not qm.paused and virtual.ready()
                and len(qm.items) < 5):
            while len(qm.items) < 5:
                if not virtual.next(qm):
                    break
        await bus.emit("queue", queue_view())
        if order is None:
            # Nobody watching? Still worth pre-generating, but slowly, so an
            # unattended service does not spin the CPU all night.
            await asyncio.sleep(0.4 if bus.count else 3.0)
            continue
        try:
            payload = await build_payload(order)
        except Exception as e:
            log(f"@{order.nickname} 出图失败: {e}")
            continue
        if payload:
            await READY.put((order, payload))


async def presenter() -> None:
    """Play back finished drawings at the pace of their gift tier."""
    while True:
        order, payload = await READY.get()
        duration = payload.get("duration_ms", 1000) / 1000.0
        hold = float(payload.get("hold_seconds", 0.3))
        qm.current = order
        await bus.emit("queue", queue_view())
        _draw_done.clear()
        global CURRENT
        CURRENT = (payload, time.time(), duration)
        await bus.emit("draw_start", payload)
        if bus.count:                      # nobody watching -> don't stall
            try:
                await asyncio.wait_for(_draw_done.wait(), timeout=duration + 5)
            except asyncio.TimeoutError:
                log("overlay 未回报完成，按超时继续")
            await asyncio.sleep(hold)
        else:
            # No overlay attached. Do not spin: without this floor the loop
            # consumed the whole stand-in pool in a couple of seconds and
            # pegged a core. A short beat keeps the pipeline warm while
            # staying essentially free.
            await asyncio.sleep(min(duration, 2.0))
        CURRENT = None
        await bus.emit("draw_end", {"nickname": order.nickname})
        art = payload.get("art_url") or payload.get("avatar_url")
        if art:
            RECENT.appendleft({"nickname": order.nickname, "url": art,
                               "score": order.score,
                               "tier_name": payload.get("tier_name", "")})
        qm.finish()
        await bus.emit("queue", queue_view())


# ---------------------------------------------------------------- events
async def on_event(ev: dict) -> None:
    kind = ev.get("type")
    nick, avatar = ev.get("nickname", ""), ev.get("avatar", "")
    if kind == "chat":
        order = qm.add_chat(nick, ev.get("content", ""), avatar)
        if order:
            log(f"@{nick} 扣 1 进队列")
            await bus.emit("toast", {"text": f"@{nick} 排队成功"})
    elif kind == "gift":
        gift = ev.get("gift", "") or ""
        diamond = float(ev.get("diamond") or 0)
        # Price: an explicit value from the bridge wins, then the gift map in
        # config.yaml, then Douyin's own diamond count (1 yuan = 10 diamonds).
        value = float(ev.get("value") or GIFTS.get(gift, 0) or diamond / 10.0 or 0)
        order = qm.add_gift(nick, avatar, gift, value=value)
        if order:
            sk = styles.name(styles.resolve(gift))
            log(f"@{nick} 送 {gift}(¥{value:g}) -> {sk} 插队")
            await bus.emit("toast", {"text": f"@{nick} 送 {gift}，画{sk}"})
    elif kind == "member":
        await bus.emit("member", {"nickname": nick})
    await bus.emit("queue", queue_view())


async def source_loop() -> None:
    while True:
        try:
            await source.run(on_event)
        except Exception as e:
            log(f"音源异常: {e}; 5s 后重启")
            await asyncio.sleep(5)


# ---------------------------------------------------------------- app
@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    _tasks.append(asyncio.create_task(producer()))
    _tasks.append(asyncio.create_task(presenter()))
    _tasks.append(asyncio.create_task(source_loop()))
    _tasks.append(asyncio.create_task(watchdog()))
    _tasks.append(asyncio.create_task(prewarm_regions()))
    log(f"启动完成: platform={cfg['platform']['type']} sketch={cfg['sketch']['provider']}")
    yield
    _stop.set()
    for t in _tasks:
        t.cancel()
    await source.close()


async def watchdog() -> None:
    """Evict overlays that stopped answering, so `bus.count` means something."""
    while True:
        await asyncio.sleep(30)
        await bus.prune(90.0)


async def prewarm_regions() -> None:
    """Fill the region cache for the stand-in pool ahead of time.

    Partitioning a picture costs ~11 s of model time. That must not happen on
    the live path, so the rotation's 20 files get analysed once, in the
    background, right after start-up; afterwards every pass is a cache hit.
    """
    await asyncio.sleep(8)                     # let the stream come up first
    pics = virtual.files()
    if not pics:
        return
    n = await asyncio.to_thread(regions_mod.prewarm, pics, cfg.get("regions"),
                                DATA / "cache" / "regions", _stop)
    if n:
        log(f"分区缓存预热完成 {n}/{len(pics)} 张")


app = FastAPI(lifespan=lifespan, title="zhibo-sketch")


@app.middleware("http")
async def no_stale_ui(request: Request, call_next):
    """Never let the overlay keep an old pencil or an old hatching on screen.

    The page lives in OBS's embedded browser for hours and it happily serves
    css/js from memory, so a tweak to the overlay only showed up after a full
    restart of the source. These three paths are the whole UI; nothing here is
    worth caching.
    """
    resp = await call_next(request)
    p = request.url.path
    if p == "/" or p.startswith(("/overlay", "/admin")):
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
    return resp


app.mount("/overlay", StaticFiles(directory=str(ROOT / "overlay"), html=True), name="overlay")
app.mount("/admin", StaticFiles(directory=str(ROOT / "admin"), html=True), name="admin")
app.mount("/data", StaticFiles(directory=str(DATA)), name="data")


@app.exception_handler(Exception)
async def on_error(request: Request, exc: Exception):
    """Never answer with a bare 'Internal Server Error' again."""
    import traceback
    print(traceback.format_exc(), flush=True)
    log(f"ERROR {request.method} {request.url.path}: {type(exc).__name__}: {exc}")
    return JSONResponse({"ok": False, "path": str(request.url.path),
                         "error": f"{type(exc).__name__}: {exc}"}, status_code=500)


@app.get("/")
async def index():
    return FileResponse(ROOT / "overlay" / "index.html")


@app.get("/api/status")
async def status():
    return {**queue_view(), "overlays": bus.count,
            "platform": cfg["platform"]["type"],
            "sketch": cfg["sketch"]["provider"], "logs": list(LOGS)[-40:]}


async def _json_body(req: Request) -> dict:
    """Tolerant JSON parsing.

    cmd.exe / PowerShell do not strip single quotes, so `curl -d '{"a":1}'`
    arrives as `'{"a":1}'` which is not valid JSON. Strip the wrapping quotes
    instead of returning an opaque 500.
    """
    raw = await req.body()
    if not raw.strip():
        return {}
    # Chinese Windows terminals (cmd / Git Bash) send GBK bytes, not UTF-8.
    txt = ""
    for enc in ("utf-8", "gbk", "gb18030"):
        try:
            txt = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        txt = raw.decode("utf-8", "ignore")
    txt = txt.strip()
    for _ in range(2):
        if len(txt) > 1 and txt[0] == txt[-1] and txt[0] in "'\"":
            txt = txt[1:-1].strip()
    try:
        d = json.loads(txt)
        return d if isinstance(d, dict) else {}
    except Exception:
        log(f"请求体不是合法 JSON: {txt[:120]}")
        return {}


def _pick_sample() -> str:
    d = DATA / "samples"
    imgs = sorted(p for p in d.glob("*") if p.suffix.lower() in
                  {".jpg", ".jpeg", ".png", ".webp", ".bmp"}) if d.exists() else []
    if not imgs:
        return ""
    return str(imgs[int(time.time() * 10) % len(imgs)].resolve())


def _pick_stand_in() -> str:
    """A finished picture to draw when the order carries no artwork.

    Adding an order by hand (or a viewer who sent a gift before the Doubao
    grabber finished) has no art of its own. Falling back to the local edge
    tracer produced the fragmented pen-stroke look we moved away from, so a
    picture from the stand-in pool is used instead and painted in properly.
    """
    pics = virtual.files()
    if pics:
        return str(pics[int(time.time() * 10) % len(pics)].resolve())
    return ""


async def _enqueue(nick: str, avatar: str, value: float = 0.0,
                   gift: str = "", kind: str = "manual",
                   style: str = "") -> dict:
    art = bool(avatar)
    if not avatar:
        avatar = _pick_stand_in()
        art = bool(avatar)
    if not avatar:
        avatar = _pick_sample() or \
            f"https://picsum.photos/seed/{int(time.time())}/300"
    style_key = styles.resolve(style or gift)
    order = qm.add_manual(nick, avatar, value, kind, gift, art=art,
                          style=style_key)
    log(f"手动加入 @{nick} <- {Path(avatar).name} "
        f"[{styles.name(style_key)} ¥{value:g}]")
    await bus.emit("queue", queue_view())
    return {"ok": True, "tier": tier_for(value).get("key"),
            "style": style_key, "order": order.brief()}


def _resolve_value(d: dict, q) -> tuple[float, str]:
    """value > gift name > tier name, in that order."""
    raw_v = d.get("value") or q.get("value")
    gift = str(d.get("gift") or q.get("gift") or "")
    if raw_v not in (None, ""):
        try:
            return float(raw_v), gift
        except (TypeError, ValueError):
            pass
    if gift:
        return float(GIFTS.get(gift, 0) or 0), gift
    name = str(d.get("tier") or q.get("tier") or "")
    t = tier_by_name(name)
    if t:
        return float(t.get("min_value", 0)), gift
    return 0.0, gift


@app.post("/api/supply")
async def supply(req: Request):
    """Doubao grabber pushes a finished drawing in as raw image bytes.

    Query: nickname, tier (or value/gift). Body: png/jpg binary. No multipart,
    so the server needs no extra dependency.
    """
    q = req.query_params
    raw = await req.body()
    if len(raw) < 1024:
        return JSONResponse({"ok": False, "error": "empty image"}, status_code=400)
    ext = ".png" if raw[:4] == b"\x89PNG" else ".jpg"
    folder = DATA / "supply"
    folder.mkdir(parents=True, exist_ok=True)
    p = folder / f"{time.strftime('%m%d_%H%M%S')}_{int(time.time() * 1000) % 1000}{ext}"
    p.write_bytes(raw)

    nick = q.get("nickname") or f"豆包{int(time.time()) % 1000}"
    value, gift = _resolve_value({}, q)
    # The grabber knows which style it just asked Doubao for; the gift is the
    # fallback when it does not say.
    style = styles.resolve(q.get("style") or gift)
    order = qm.add_manual(nick, str(p), value, "ai", gift, style=style)
    log(f"收到豆包成稿 @{nick} [{styles.name(style)}] {p.name} {len(raw) // 1024}KB")
    await bus.emit("queue", queue_view())
    return {"ok": True, "file": str(p), "tier": tier_for(value).get("key"),
            "style": style, "style_name": styles.name(style),
            "order": order.brief()}


@app.post("/api/simulate")
async def simulate(req: Request):
    d = await _json_body(req)
    q = req.query_params
    nick = (d.get("nickname") or q.get("nickname")
            or f"测试用户{int(time.time()) % 1000}")
    value, gift = _resolve_value(d, q)
    kind = "gift" if gift else "manual"
    return await _enqueue(nick, d.get("avatar") or q.get("avatar") or "",
                          value, gift, kind)


@app.get("/api/simulate")
async def simulate_get(nickname: str = "", avatar: str = "", value: str = "",
                       gift: str = "", tier: str = ""):
    """Browser-friendly: open http://127.0.0.1:8848/api/simulate?nickname=小明&tier=彩色"""
    nick = nickname or f"测试用户{int(time.time()) % 1000}"
    value_, gift_ = _resolve_value({"value": value, "gift": gift, "tier": tier}, {})
    return await _enqueue(nick, avatar, value_, gift_,
                          "gift" if gift_ else "manual")


@app.get("/api/tiers")
async def list_tiers():
    """What the four gift tiers look like right now."""
    return {"tiers": [{"key": t.get("key"), "name": t.get("name"),
                       "min_value": t.get("min_value"),
                       "duration": t.get("duration"),
                       "hatch": bool(t.get("hatch")),
                       "color": bool(t.get("color"))} for t in TIERS],
            "gifts": GIFTS,
            "styles": styles.options(),
            "gift_style": styles.gift_map,
            "default_style": styles.default}


@app.post("/api/control")
async def control(req: Request):
    d = await _json_body(req)
    action = d.get("action") or req.query_params.get("action")
    if action == "pause":
        qm.paused = True
    elif action == "resume":
        qm.paused = False
        qm._event.set()
    elif action == "skip":
        qm.skip()
    elif action == "clear":
        qm.items.clear()
    await bus.emit("queue", queue_view())
    log(f"控制: {action}")
    return {"ok": True, **queue_view()}


@app.get("/api/admin/state")
async def admin_state():
    """Everything the back office shows: the full queue, not just the top 5."""
    return {**queue_view(), "logs": list(LOGS)[-80:], "overlays": bus.count,
            "ready": READY.qsize(), "virtual_files": _vpics(),
            "styles": styles.options(),
            "tiers": [{"key": t.get("key"), "name": t.get("name"),
                       "min_value": t.get("min_value")} for t in TIERS]}


@app.post("/api/admin/action")
async def admin_action(req: Request):
    d = await _json_body(req)
    a = str(d.get("action") or req.query_params.get("action") or "")
    if a == "pause":
        qm.paused = True
    elif a == "resume":
        qm.paused = False
        qm._event.set()
    elif a == "skip":
        qm.skip()
    elif a == "clear":
        n = len(qm.items)
        qm.items.clear()
        log(f"后台清空队列（{n} 单）")
    elif a == "virtual_on":
        virtual.conf["enabled"] = True
    elif a == "virtual_off":
        virtual.conf["enabled"] = False
    elif a == "drop":
        qm.drop(int(d.get("seq") or 0))
    elif a == "bump":
        qm.bump(int(d.get("seq") or 0))
    elif a == "add":
        nick = str(d.get("nickname") or f"手动{int(time.time()) % 1000}")
        value, gift = _resolve_value(d, {})
        return await _enqueue(nick, str(d.get("avatar") or ""), value, gift,
                              "manual", style=str(d.get("style") or ""))
    else:
        return JSONResponse({"ok": False, "error": f"未知操作 {a}"},
                            status_code=400)
    await bus.emit("queue", queue_view())
    log(f"后台: {a}")
    return {"ok": True, **queue_view()}


# ------------------------------------------------------- virtual gallery
# The stand-in rotation is fed from a folder, but typing into a folder is not
# something the streamer should have to do mid-session. These endpoints let the
# back office upload, preview and delete the pictures directly.
VPIC_MAX_BYTES = 20 * 1024 * 1024


def _vpics() -> list[dict]:
    out = []
    for p in virtual.files():
        st = p.stat()
        out.append({"name": p.name, "url": f"/vpic/{p.name}",
                    "kb": max(1, round(st.st_size / 1024)),
                    "mtime": int(st.st_mtime)})
    return out


def _vpic_name() -> str:
    """Lowest free `vNN.png` slot.

    Numbered names keep the rotation order stable and readable, and filling the
    first gap means deleting picture 7 of 20 does not push everything along.
    """
    used = set()
    for p in virtual.dir.glob("v*"):
        m = re.fullmatch(r"v(\d+)", p.stem, re.I)
        if m:
            used.add(int(m.group(1)))
    i = 1
    while i in used:
        i += 1
    return f"v{i:02d}.png"


@app.get("/vpic/{name}")
async def vpic(name: str):
    """Serve a stand-in picture from wherever the folder actually lives."""
    p = virtual.dir / name
    if Path(name).name != name or not p.is_file():
        return JSONResponse({"ok": False, "error": "not found"}, status_code=404)
    return FileResponse(str(p), headers={"Cache-Control": "no-store"})


@app.get("/api/admin/virtual")
async def admin_virtual():
    return {"ok": True, "dir": str(virtual.dir), "items": _vpics(),
            "enabled": virtual.enabled}


@app.post("/api/admin/virtual/upload")
async def admin_virtual_upload(req: Request):
    """Raw-body upload: the browser posts the File itself as the body.

    No multipart parsing on purpose -- it keeps `python-multipart` out of the
    dependency list, and a single file per request makes progress reporting in
    the panel trivial.
    """
    raw = await req.body()
    if not raw:
        return JSONResponse({"ok": False, "error": "空文件"}, status_code=400)
    if len(raw) > VPIC_MAX_BYTES:
        return JSONResponse({"ok": False, "error": "单张不能超过 20MB"},
                            status_code=400)
    if len(virtual.files()) >= 200:
        return JSONResponse({"ok": False, "error": "图库已满（200 张）"},
                            status_code=400)
    img = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_UNCHANGED)
    if img is None:
        return JSONResponse({"ok": False, "error": "不是可识别的图片"},
                            status_code=400)
    # Cut-out PNGs would otherwise paint a black block onto the white sheet.
    if img.ndim == 3 and img.shape[2] == 4:
        alpha = img[:, :, 3:4].astype(np.float32) / 255.0
        img = (img[:, :, :3].astype(np.float32) * alpha + 255.0 * (1 - alpha))
        img = np.clip(img, 0, 255).astype(np.uint8)
    elif img.dtype != np.uint8:
        img = cv2.normalize(img, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

    virtual.dir.mkdir(parents=True, exist_ok=True)
    name = _vpic_name()
    cv2.imwrite(str(virtual.dir / name), img)
    log(f"图库上传 {name}（{img.shape[1]}x{img.shape[0]}）")
    # Analyse it now, off the live path, so the first pass over the new picture
    # does not stall on the ~11 s part-detection call.
    asyncio.create_task(_warm_one(virtual.dir / name))
    await bus.emit("queue", queue_view())
    return {"ok": True, "name": name, "items": _vpics()}


async def _warm_one(path: Path) -> None:
    try:
        await asyncio.to_thread(regions_mod.prewarm, [path],
                                cfg.get("regions"),
                                DATA / "cache" / "regions", _stop)
    except Exception as exc:                       # never kill the stream over this
        log(f"分区预热失败 {path.name}: {exc}")


@app.post("/api/admin/virtual/delete")
async def admin_virtual_delete(req: Request):
    d = await _json_body(req)
    name = str(d.get("name") or req.query_params.get("name") or "")
    p = virtual.dir / name
    if Path(name).name != name or not p.is_file():
        return JSONResponse({"ok": False, "error": "文件不存在"}, status_code=404)
    p.unlink()
    log(f"图库删除 {name}")
    await bus.emit("queue", queue_view())
    return {"ok": True, "items": _vpics()}


@app.post("/api/admin/virtual/clear")
async def admin_virtual_clear():
    n = 0
    for p in virtual.files():
        p.unlink()
        n += 1
    log(f"图库清空（{n} 张）")
    return {"ok": True, "removed": n, "items": _vpics()}


@app.websocket("/ws/overlay")
async def ws_overlay(ws: WebSocket):
    await ws.accept()
    await bus.register(ws)
    await ws.send_text(json.dumps({"type": "hello",
                                   "payload": {**queue_view(),
                                               "stroke_width": float(cfg["draw"].get("stroke_width", 3.2))}},
                                  ensure_ascii=False))
    # OBS may be opened (or refreshed) while a picture is already underway.
    # Replay it so the new tab is not blank until the next order starts.
    if CURRENT:
        payload, started, dur = CURRENT
        if time.time() - started < dur + 6:
            await ws.send_text(json.dumps({"type": "draw_start",
                                           "payload": payload},
                                          ensure_ascii=False))
    try:
        while True:
            raw = await ws.receive_text()
            bus.touch(ws)
            try:
                msg = json.loads(raw)
            except Exception:
                continue
            if msg.get("type") == "done":
                _draw_done.set()
            elif msg.get("type") == "ping":
                await ws.send_text('{"type":"pong","payload":{}}')
    except WebSocketDisconnect:
        pass
    finally:
        await bus.unregister(ws)


if __name__ == "__main__":
    s = cfg["server"]
    uvicorn.run("app.main:app", host=s["host"], port=int(s["port"]), reload=False)
