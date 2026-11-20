"""直播间签名生成 —— FastAPI + 排单 worker + WebSocket 下发。

数据流：

    直播间弹幕/礼物 ──▶ on_event ──▶ QueueManager(记忆 昵称->名字, 礼物插队)
                                        │
                              producer  │  签名笔画（0.1~0.3s，本地字体骨架）
                                        ▼
                                   READY(队列)
                                        │
                             presenter  │  按礼物档位控制时长
                                        ▼
                                  /ws/overlay ──▶ 沙画笔迹逐步写出

生成和播放是两条独立流水线：画 A 的同时已经在生成 B，所以每个观众的等待 ≈ 书写时长，
而不是"生成 + 书写"相加。
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import re
import shutil
import subprocess
import time
from collections import deque
from pathlib import Path

import cv2
import httpx
import numpy as np
import uvicorn
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import moderation, voice
from .bus import Bus
from .config import ROOT, load
from .library import Library
from .pipeline import aiart, brush, doubaoweb, hanzi, plate, sdcn, wordsheet
from .pipeline import signature
from .platforms.base import build_source
from .queue_manager import QueueManager
from .virtual import VirtualPool

cfg = load()
DATA = Path(cfg["paths"]["data"])
if not DATA.is_absolute():
    DATA = ROOT / DATA
for sub in ("signatures", "avatars"):
    (DATA / sub).mkdir(parents=True, exist_ok=True)

SIG = cfg.get("signature") or {}
# 祝福语音：写完一个名字同时说一句（见 app/voice.py）
VCONF = dict(cfg.get("voice") or {})
# AI 写文案那把 key 可以借用审核的（同一家 deepseek），省得配两遍
if not (VCONF.get("ai") or {}).get("api_key"):
    VCONF["api_key"] = str((cfg.get("moderation") or {}).get("api_key") or "")
# 名字审核：公开画面上写什么，得先过一道（见 app/moderation.py）
MOD = moderation.Moderator(dict(cfg.get("moderation") or {}))
bus = Bus()
qm = QueueManager(cfg["queue"])
source = build_source(cfg)
virtual = VirtualPool(cfg.get("virtual"), DATA)
# 空场播的就是这里面的图：data/signatures 里已经生成好的成图，不叫豆包
lib = Library(cfg.get("virtual"), DATA / "signatures", SIG)
LOGS: deque[str] = deque(maxlen=200)
LAST: dict | None = None      # 最近播完的一张：overlay 重连时直接铺回背景
STAGE = ""                    # 最近一张成图地址，overlay 重连时直接铺回背景
_draw_done = asyncio.Event()
_tasks: list[asyncio.Task] = []
CURRENT: tuple[dict, float, float] | None = None

TIERS = sorted(cfg.get("tiers") or [], key=lambda t: -float(t.get("min_value", 0)))
# 一次豆包调用最多写几个名字（见 build_batch / pipeline/wordsheet.py）
BATCH = max(1, int((SIG.get("doubao") or {}).get("batch") or 5))
# 两次生成之间至少隔多久（秒）。出完一张图后，这 20 秒里进来的名字会攒成下一批；
# 队列一直没人就不生成（不烧额度），空闲很久后的第一个名字也不用等。
GEN_EVERY = max(1.0, float((cfg.get("queue") or {}).get("gen_every") or 20))
GIFTS = {str(k): float(v) for k, v in (cfg.get("gifts") or {}).items()}


def tier_for(value: float) -> dict:
    """礼物价值 -> 档位（只决定写多久、笔触多讲究）。"""
    for t in TIERS:
        if value >= float(t.get("min_value", 0)):
            return t
    return TIERS[-1] if TIERS else {"key": "plain", "name": "素签", "duration": 6.0}


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
    if not o:
        return None
    t = tier_for(float(o.get("value") or 0))
    return {**o, "tier": t.get("key"), "tier_name": t.get("name")}


# 空场"虚拟队列"：最近写过的 8 个幽灵单，专门填满面板。
#
# 面板是**固定行数**的（`queue.panel_slots`，默认 8 行）：
#   第 1 行 = 正在播/正在写的那一位（空场时是幽灵）
#   第 2 行 = 礼物插队（最新刷的站这里，前一个顺延到第 3）
#   其余   = 最近的幽灵，不够就从名字池补满
# 真人从**面板最后一行**进队，前面那些虚拟是真播的，播完一个他往上顶一格，
# 队尾同时补一个新虚拟进来 —— 面板永远满、他永远看得见。
GHOSTS: deque = deque(maxlen=8)

# 这几个名字太像"示例名字"，摆在虚拟队列里观众一眼就看穿是摆设。
# 只是不再拿它们当幽灵观众占位；素材库里有它们的成图照样能播。
SKIP_GHOST = {"张三", "王小明"}


def _note_ghost(order, payload: dict | None = None) -> None:
    """记一条虚拟队列项（空场回放时才记，真人单不进这里）。

    **有人排队时干脆不记**：队列面板的虚拟区在真人等着的这段时间必须静止。
    以前每播一张空场成图就把这个名字挪到最前，观众看到的是"上面的人在不停换位"，
    正在等的人会以为自己的位子在动。等真人写完、队列空了，再接着滚。
    """
    if qm.real_pending() or qm.pending:
        return
    payload = payload or {}
    nm = payload.get("name") or getattr(order, "name", "") or ""
    if nm in SKIP_GHOST:          # 示例名不当幽灵观众，见 SKIP_GHOST 的注释
        return
    # 同名只留一条：素材库只有三四张图时，空场会循环回放，
    # 不去重的话面板会变成「张三 张三 张三 …」，一眼就看穿是摆设。
    # 代价是虚拟队列的行数取决于素材库里有几个不同的名字（想要 8 行就备 8 张）。
    for old in [g for g in GHOSTS if g.get("name") == nm]:
        try:
            GHOSTS.remove(old)
        except ValueError:
            pass
    seq = int(getattr(order, "seq", 0) or 0)
    GHOSTS.append({
        "nickname": payload.get("nickname") or getattr(order, "nickname", "") or "",
        "name": nm,
        "seq": seq,
        "kind": "ghost",
        # 每 4 个人里有一个"送礼插队"，金片让队列看起来像真的在走
        "jump": seq % 4 == 0,
        "gift": "小心心" if seq % 4 == 0 else "",
        "value": 0.0,
    })


def _panel_names(used: set[str], want: int) -> list[str]:
    """虚拟区补位用的名字：素材库/幽灵不够时从名字池取，保证行数不缩水。"""
    if want <= 0:
        return []
    pool = [n for n in (getattr(virtual, "names", None) or []) if n]
    out: list[str] = []
    i = 0
    while pool and len(out) < want and i < len(pool) * 4:
        nm = pool[i % len(pool)]
        i += 1
        if nm in used or nm in SKIP_GHOST:
            continue
        used.add(nm)
        out.append(nm)
    return out


def queue_view() -> dict:
    s = qm.snapshot()
    qcfg = cfg.get("queue") or {}

    # 面板**固定** slots 行（`queue.panel_slots`，默认 8）：
    #   空场        -> 整块都是虚拟观众，循环滚，看着一直有人排队
    #   真人进队    -> 他站在面板最末一行，前面那几位虚拟是**真在播**的；
    #                  每播完一个他就往上顶一格，队尾空出来的位置立刻拿新虚拟补满，
    #                  所以面板永远是满的 8 行，而他确实在一格一格往上走；
    #                  顶到第 1 行，就是他开始被写出来的时刻。
    # 以前是"写死 8 行虚拟 + 真人钉在第 9 行"：第九行掉在可视区外面，
    # 观众打完名字在面板上根本找不到自己。真人进队就必须看得见。
    slots = int(qcfg.get("panel_slots", 0) or 0)
    if slots <= 0:                        # 没配就按老口径推：real_from - 1
        slots = max(1, int(qcfg.get("real_from", 9)) - 1)

    cur = s.get("current")
    cur_seq = (cur or {}).get("seq")
    cur_real = bool(cur) and cur.get("kind") != "virtual"

    # 真人单，按实际播放顺序：出字中（已交给模型）→ 排队。
    # 少了"出字中"这一段，观众打完名字后会有二三十秒在面板里查不到自己。
    pending = [{**_decorate(o), "state": "gen"} for o in s.get("pending") or []
               if o.get("seq") != cur_seq and o.get("kind") != "virtual"]
    queued = [{**o, "state": "queue"} for o in s["queue"]
              if o.get("kind") != "virtual"]
    others = pending + queued
    has_real = bool(others) or cur_real
    n_real = len(others) + (1 if cur_real else 0)

    # 真人占几行，虚拟区就让出几行：真人永远在面板里，永远排在虚拟后面。
    room_real = max(0, slots - n_real)
    if not has_real:
        virt_rows = slots                      # 空场：整块门面
    elif cur_real:
        virt_rows = 0                          # 他已经在写，占第 1 行
    elif GHOST_LEFT is None:
        virt_rows = room_real                  # 刚进队，producer 还没开始清位次
    else:
        virt_rows = max(0, int(GHOST_LEFT)) + (1 if cur else 0)
    virt_rows = min(virt_rows, room_real)

    used: set[str] = set()
    head: list[dict] = []
    if cur:
        c = _decorate(cur)
        used.add(c.get("name") or "")
        if cur_real:
            head = [{**c, "state": "writing"}]
        else:
            # 空场那张"正在播"的幽灵占第 1 行。kind 留 ghost：前端不加金色高亮。
            head = [{**c, "kind": "ghost", "state": "writing"}]

    # 礼物紧跟正在写的那一位（第 2 行）。`_to_front` 把新礼物插在 items[0]，
    # 所以这里按顺序取就是**最新刷的排最前**：再有人刷，新礼物顶到第 2 位，
    # 前一个顺延到第 3 位，仍然排在普通弹幕单前面。
    gifts = [o for o in others if o.get("kind") == "gift" and o.get("jump")]
    gseq = {o.get("seq") for o in gifts}
    normal = [o for o in others if o.get("seq") not in gseq]
    # 虚拟区只放得下 virt_rows 个：礼物多到溢出时剩下的顺延到真人区最前面，
    # 不能凭空消失（曾经截断后直接丢掉，第 8 个礼物就查无此人）。
    room = max(0, virt_rows - len(head))
    normal = gifts[room:] + normal
    for o in gifts:          # 溢出的礼物也算真人名字，幽灵不能跟它重名
        used.add(o.get("name") or "")
    gifts = gifts[:room]

    virt: list[dict] = head + gifts
    for g in reversed(GHOSTS):                    # 最近的幽灵排前面
        if len(virt) >= virt_rows:
            break
        d = _decorate(g)
        nm = d.get("name") or ""
        if not nm or nm in used:
            continue
        used.add(nm)
        virt.append({**d, "state": "ghost"})
    # 幽灵不够（刚开播 / 素材库只有两三个名字 / 同名去重后变少）就从名字池补满。
    # 少这一步面板会"矮一截"，真人又往前飘。
    for nm in _panel_names(used, virt_rows - len(virt)):
        virt.append({"nickname": f"路人{len(virt) + 1:02d}", "name": nm,
                     "seq": 0, "kind": "ghost", "state": "ghost",
                     "jump": False, "gift": "", "value": 0.0})

    panel = virt + normal

    # 真人往上顶之后，队尾会空出位置：拿虚拟观众补满，面板永远是 slots 行。
    # 少了这一步，他越往上走面板越短，最后只剩他一个人——一眼看出"根本没人排队"。
    # 补的是队尾，所以他前面的虚拟照样在减，位次还是在往上走。
    if len(panel) < slots:
        for o in normal:                  # 真人名字不能被虚拟观众重名
            used.add(o.get("name") or "")
        want = slots - len(panel)
        pad: list[dict] = []
        for g in reversed(GHOSTS):
            if len(pad) >= want:
                break
            d = _decorate(g)
            nm = d.get("name") or ""
            if not nm or nm in used:
                continue
            used.add(nm)
            pad.append({**d, "state": "ghost"})
        for nm in _panel_names(used, want - len(pad)):
            pad.append({"nickname": f"路人{len(panel) + len(pad) + 1:02d}", "name": nm,
                        "seq": 0, "kind": "ghost", "state": "ghost",
                        "jump": False, "gift": "", "value": 0.0})
        panel = panel + pad

    # 面板最多显示 panel_rows 行。超出的折成"…"+ 队尾那一行：
    # 队尾就是**刚打完名字的那个人**，所以那一行等于在告诉他"你排第几"。
    # 队列通常也就几个人，但连刷礼物时能堆到二十几个，全渲染会把画面顶出去。
    cap = int(qcfg.get("panel_rows", 12) or 12)
    more: dict = {}
    if len(panel) > cap and panel:
        tail = panel[-1]
        cut = len(panel) - cap                  # 被折掉的行数（含队尾那一行）
        more = {"hidden": max(0, cut - 1),      # 中间省略几个人
                "cut": cut,
                "total": len(panel),
                "last_name": tail.get("name") or "",
                "last_nick": tail.get("nickname") or "",
                "last_pos": len(panel),         # 队尾那位的真实排位
                "last_gift": bool(tail.get("jump"))}
        panel = panel[:cap]

    # 右上角"共 N 人"只数真人；把虚拟观众算进去会虚高
    people = len(normal) + len(gifts) + (1 if cur_real else 0)
    return {**s,
            "queue": [o for o in s["queue"] if o.get("kind") != "virtual"],
            "panel": panel,
            "more": more,
            "ghosts": [o for o in virt if o.get("kind") == "ghost"],
            "real_from": virt_rows + 1,      # 真人眼下排在第几行（会随位次往上顶）
            "people": people,
            "current": _decorate(s["current"]),
            "stage": STAGE,
            "platform": str((cfg.get("platform") or {}).get("type") or ""),
            "virtual": virtual.status(),
            "moderation": MOD.status(),
            "library": lib.status()}


# ---------------------------------------------------------------- pipeline
# 一批最多 5 个，所以留够空间让"下一批"在播上一批时就能备好
READY: asyncio.Queue = asyncio.Queue(maxsize=8)

# 真人在等的时候，面板上他前面那 8 位虚拟观众是**真的要走完**，不是只占位置。
# GHOST_LEFT = 还要播几张幽灵；None = 当前没真人在等（下一波重新计）。
# 设成 0 就退回旧行为：幽灵只当门面，真人进队立刻写。
GHOST_LEFT: int | None = None


def _ghost_wait() -> int:
    """真人前面要真播几张虚拟观众（`queue.ghost_wait`，默认 8）。"""
    try:
        return max(0, int((cfg.get("queue") or {}).get("ghost_wait", 8)))
    except (TypeError, ValueError):
        return 8


def _cur_is_real() -> bool:
    """正在播的那一单是不是真人——空场回放的幽灵单是 virtual。"""
    cur = qm.current
    return bool(cur) and getattr(cur, "kind", "") != "virtual"


def _sig_conf(tier: dict) -> dict:
    """全局签名参数 + 档位覆盖。"""
    conf = dict(SIG)
    for k in ("stroke_width", "flourish", "flourish_width", "font"):
        if tier.get(k) is not None:
            conf[k] = tier[k]
    return conf


def _save_preview(name: str, strokes: list, widths: list, size: list) -> str:
    """把这一幅签名渲染成 PNG 存下来。

    用途有两个：后台"已完成"里能回看，以及 OBS 重连时有个静态兜底。
    顺带还是一次自检——笔画数据坏了这里会直接看出来。
    """
    w, h = int(size[0]), int(size[1])
    import numpy as np

    img = np.full((h, w, 4), 0, np.uint8)
    for i, s in enumerate(strokes):
        pts = np.array([[int(p[0]), int(p[1])] for p in s], np.int32)
        # 缩略图要跟沙盘上的观感一致，所以按 2 倍笔宽画
        wd = int(round(widths[i] * 2.0)) if i < len(widths) else 9
        cv2.polylines(img, [pts], False, (28, 26, 32, 255), max(2, wd), cv2.LINE_AA)
    fn = f"{time.strftime('%m%d_%H%M%S')}_{int(time.time() * 1000) % 1000}.png"
    p = DATA / "signatures" / fn
    cv2.imwrite(str(p), img)
    return f"/data/signatures/{fn}"


# ---------------------------------------------------------------- 成图（写完那 3 秒淡入的那张）
SHOT = DATA / "cache" / "live_shot.jpg"


def _live_shot(glyph, box) -> str:
    """用**当前背景**现合成"写完那一刻的整张图"。

    成图以前是生成的时候就合成好落盘的（`data/signatures/*_full.jpg`），
    所以换过背景之后，收笔淡进来的那张还是旧背景 —— 和铺在下面的新背景对不上，
    那 3 秒停留里能明显看到"背景跳了一下又回来"。

    现在改成每次播之前现合成一张：底板永远是 `poster_clean.jpg`（也就是屏幕上
    正在铺的那张），名字盖上去。写**固定文件名**而不是每单一个 —— 不然后台换几次背景、
    播一晚上能堆出上千张 300KB 的图。靠 `?v=` 时间戳绕开浏览器缓存。
    """
    if not glyph or not box:
        return ""
    try:
        SHOT.parent.mkdir(parents=True, exist_ok=True)
        if not wordsheet.compose(BG_CLEAN, glyph, box, SHOT):
            return ""
        return f"/data/cache/live_shot.jpg?v={int(time.time() * 1000)}"
    except Exception as e:
        log(f"现合成成图失败({type(e).__name__}: {e})，退回用预生成的")
        return ""


def _ink_payload(order, tier: dict, art: dict, provider: str,
                 elapsed: float) -> dict:
    """一份"AI 笔迹"payload。art = {glyph, full, box}（见 pipeline/wordsheet.py）。"""
    box = art["box"]
    # 毛笔要的运笔路径：从笔迹图反推笔顺，overlay 一笔一划写过去。
    #
    # **必须从"显示的那张"（art['glyph']）反推**，不能从没上材质的 `trace`：
    # 材质会加投影/斜面/挤出，图变大了、笔画也粗了一圈。拿窄的、错位的那份去
    # 生成遮罩，就会出现"笔已经走到下一笔，上一笔还缺一块"，一直缺到最后
    # 收尾那次整块补齐才完整——就是观众看到的现象。
    #
    # 代价是投影会被当成笔画（它 alpha 到 115，阈值 90 挡不住），所以上了材质的
    # 图把门槛抬到 190：投影被滤掉，剩下的实心字身照常提骨架。
    style = str(art.get("style") or "ink").lower()
    amin = 90 if style in ("", "ink") else 190
    writes = brush.writes_for(art["glyph"], len(order.name), alpha_min=amin,
                              name=order.name)
    return {
        **order.brief(),
        "mode": "ink",
        "art_url": f"/data/signatures/{art['glyph'].name}",
        # 现合成一张（用当前背景）；合成失败才退回生成时落盘的旧图
        "full_url": (_live_shot(art.get("glyph"), box)
                     or (f"/data/signatures/{art['full'].name}"
                         if art.get("full") else "")),
        "box": box,
        "size": [box[2] - box[0], box[3] - box[1]],
        "writes": writes,
        "tier": tier.get("key"), "tier_name": tier.get("name"),
        "duration_ms": int(float(tier.get("duration", 8)) * 1000),
        "hold_seconds": float(tier.get("hold_seconds", 3.0)),
        "provider": provider,
        "elapsed": round(elapsed, 2),
    }


async def build_payload(order) -> dict | None:
    """单个订单（演示数据 / 空场 / 手动补单）。真人单走 build_batch。"""
    t0 = time.time()
    tier = tier_for(order.value)
    conf = _sig_conf(tier)

    # 演示数据（mock 源造出来的假观众）永远不叫 AI：
    # 素材库里有同名成图就播那张，没有就用本地笔画起一张，都免费。
    if getattr(order, "demo", False):
        item = await asyncio.to_thread(lib.by_name, order.name)
        if item:
            payload = await asyncio.to_thread(lib.payload, item, tier, order.seq)
            for k in ("nickname", "kind", "gift", "score", "value",
                      "created", "waited", "jump", "upgraded"):
                payload[k] = getattr(order, k, payload.get(k))
            payload["provider"] = "library"
            payload["elapsed"] = round(time.time() - t0, 2)
            # 空场回放也是"写完停留"的一部分：素材库里的成图是旧背景合成的，
            # 这里同样用当前背景重合成一张，不然换过背景之后回放会闪旧图。
            if payload.get("box") and item.get("glyph"):
                payload["full_url"] = (_live_shot(item["glyph"], payload["box"])
                                       or payload.get("full_url", ""))
            log(f"@{order.nickname}「{order.name}」[{tier.get('name')}] "
                f"素材库回放（演示数据，不调 AI）")
            return payload
        return await local_payload(order, tier, conf, t0)

    pairs = await build_batch([order])
    return pairs[0][1] if pairs else None


async def build_batch(orders: list) -> list[tuple]:
    """一批真人单一起出图：一次豆包调用最多写 BATCH 个名字。

    为什么批量：豆包一张 15~30 秒，队列里 5 个人逐个排队要等两分钟。
    现在一次把 5 个名字写成一列、回来按行切开（pipeline/wordsheet.py），
    五个人的等待都等于"一次生成"。失败就整批退回本地笔画，不会卡住队列。
    """
    t0 = time.time()
    if not orders:
        return []
    # 同一批里同一个名字只写一遍：gift_bypass 允许"刚写过再写一次"，
    # 极端情况下两单同名会同时进同一张图，那就会在同一张纸上写两行一样的。
    seen: set[str] = set()
    uniq: list = []
    for o in orders:
        k = qm.dedupe_key(o)
        if k in seen:
            log(f"@{o.nickname}「{o.name}」与本批重名，跳过（去重）")
            continue
        seen.add(k)
        uniq.append(o)
    orders = uniq
    provider = str(SIG.get("provider") or "local").lower()
    # 各 provider 读自己那一段配置：doubao -> signature.doubao，sdcn -> signature.sdcn。
    # 切 provider 不用改配置结构，也不会把豆包的 port/profile 混进本地模型那边。
    conf = dict(SIG.get(provider) or {})

    arts: list = []
    # 先把名字里没见过的字的标准笔顺抓下来（每个字一次，约 2KB，之后永久本地）。
    # 必须是 fire-and-forget：让它和下面的出图并发跑，出图 2~4 秒足够它抓完，
    # 这样排名单时不会多等一秒。抓不到会自动退回几何排序，不影响出图。
    if str(SIG.get("stroke_order", True)) not in ("False", "false", "0"):
        for o in orders:
            try:
                asyncio.get_running_loop().run_in_executor(None, hanzi.prefetch, o.name)
            except Exception:
                pass
    if provider == "doubao":
        try:
            arts = await asyncio.to_thread(doubaoweb.batch,
                                          [o.name for o in orders], conf)
        except Exception as e:
            log(f"doubao 批量出图异常({type(e).__name__}: {e})，整批退回本地笔画")
            arts = []
    elif provider == "sdcn":
        # 本地扩散：一人一张（不拼竖排，见 pipeline/sdcn.py 开头）。
        # 服务没起/模型没装时 batch 会先探 /health 直接返回 []，不会干等超时。
        try:
            arts = await asyncio.to_thread(sdcn.batch,
                                          [o.name for o in orders], conf)
        except Exception as e:
            log(f"sdcn 批量出图异常({type(e).__name__}: {e})，整批退回本地笔画")
            arts = []
    elif provider == "ai" and aiart.enabled(SIG):
        # 方舟那条路是一张一张的，批量就退化成循环（还是同一条兜底链）
        try:
            arts = [await asyncio.to_thread(aiart.generate, o.name, SIG)
                    for o in orders]
        except Exception as e:
            log(f"ai 出图异常({type(e).__name__}: {e})")
            arts = []

    out: list[tuple] = []
    for i, order in enumerate(orders):
        tier = tier_for(order.value)
        art = arts[i] if i < len(arts) else None
        # 方舟返回的是 {mode, art, full, size}，统一成 ink 需要的字段
        if art and "glyph" not in art and art.get("art"):
            art = {"glyph": art["art"], "full": art.get("full"),
                   "box": art.get("box") or [0, 0, 1080, 420]}
        if art and art.get("glyph"):
            try:
                payload = await asyncio.to_thread(_ink_payload, order, tier, art,
                                                 provider, time.time() - t0)
                log(f"@{order.nickname}「{order.name}」[{tier.get('name')}] "
                    f"{provider} 成图 / 一批 {len(orders)} 人 / {payload['elapsed']}s")
                out.append((order, payload))
                continue
            except Exception as e:
                log(f"@{order.nickname}「{order.name}」组装失败({e})，退回本地笔画")
        else:
            log(f"@{order.nickname}「{order.name}」{provider} 没出图，退回本地笔画")
        payload = await local_payload(order, tier, _sig_conf(tier), t0)
        if payload:
            out.append((order, payload))
    return out


async def local_payload(order, tier: dict | None = None,
                        conf: dict | None = None, t0: float | None = None) -> dict | None:
    """本地字体提骨架逐笔写。不联网、不花钱、0.1~0.3 秒一张。

    两条路会用到这里：真人单豆包挂了时的兜底，以及一张成图都没有时的起头。
    """
    t0 = t0 or time.time()
    tier = tier or tier_for(order.value)
    conf = conf or _sig_conf(tier)
    try:
        res = await asyncio.to_thread(signature.render, order.name, conf)
    except Exception as e:
        log(f"@{order.nickname}「{order.name}」生成失败: {e}")
        return None

    art_url = _save_preview(order.name, res["strokes"], res["widths"], res["size"])
    payload = {
        **order.brief(),
        "mode": "strokes",
        "tier": tier.get("key"), "tier_name": tier.get("name"),
        "strokes": res["strokes"],
        "widths": res["widths"],
        # 逐点笔宽：起笔顿、中段实、收笔尖（见 pipeline/signature.py 的 _profile）。
        # 前端缺这个字段也能跑，会退回 widths 的常数线宽。
        "wps": res.get("wps") or [],
        "size": res["size"],
        "stroke_count": res["stroke_count"],
        "total_len": res["total_len"],
        "art_url": art_url,
        "duration_ms": int(float(tier.get("duration", 8)) * 1000),
        "hold_seconds": float(tier.get("hold_seconds", 3.0)),
        "provider": "local",
        "elapsed": round(time.time() - t0, 2),
    }
    log(f"@{order.nickname}「{order.name}」[{tier.get('name')}] "
        f"{res['stroke_count']} 笔 / {res['total_len']}px / {payload['elapsed']}s")
    return payload


async def _voice_for(order, payload: dict | None) -> dict | None:
    """给一单配祝福语音，并把运笔时长对齐到它（见 app/voice.py）。

    为什么在做完图、还没排队播的时候做：合成一句要 1~2 秒。
    放进 presenter 就是"该开始写了还在等声音"；放在 producer 里，
    这几秒正好花在队列空档上——观众端感觉不到。
    """
    if not payload or not voice.enabled(VCONF):
        return payload
    name = getattr(order, "name", "") or ""
    if not name:
        return payload
    kind = "gift" if str(payload.get("tier") or "") in ("gift", "honor") else "plain"
    t0 = time.time()
    try:
        # 上限 max_wait 秒：文案 + 合成都慢的时候（AI 抽风、网络抖动），
        # 宁可这一单没声音，也不能让整条流水线等它——直播卡一秒都看得出来。
        # 超时后线程还在跑，它会把缓存捂热，下一次同名就秒过。
        info = await asyncio.wait_for(
            asyncio.to_thread(voice.say, name, VCONF, kind),
            timeout=float(VCONF.get("max_wait") or 12))
    except asyncio.TimeoutError:
        log(f"@{order.nickname}「{name}」配音超时（等了 "
            f"{time.time() - t0:.1f}s），这单不出声")
        return payload
    if not info:
        return payload                    # 合成失败：这单不出声，写字照常
    tier_ms = int(payload.get("duration_ms") or 8000)
    ms = voice.fit_duration(tier_ms, int(info["ms"]), VCONF)
    log(f"@{order.nickname}「{name}」祝福「{info['text']}」{info['ms']}ms"
        + (f"，运笔 {tier_ms}→{ms}ms" if ms != tier_ms else ""))
    return {**payload, "voice_url": info["url"], "voice_ms": int(info["ms"]),
            "voice_text": info["text"], "duration_ms": ms}


async def _ready(order, payload: dict | None) -> None:
    """配音 + 入队。所有 READY.put 都从这里走，绕过就是没声音。"""
    payload = await _voice_for(order, payload)
    if payload:
        await READY.put((order, payload))


async def _ready_many(pairs: list[tuple]) -> None:
    """整批配音（并发）再按原顺序入队。

    串行的话 5 个人各 2 秒就是 10 秒空场——队列空着，画面没东西可写。
    并发之后整批也只花一个人的时间；单句失败只影响那一单（gather 里兜住）。
    """
    if not pairs:
        return
    voiced = await asyncio.gather(
        *[_voice_for(o, p) for o, p in pairs], return_exceptions=True)
    for (order, payload), v in zip(pairs, voiced):
        if isinstance(v, Exception):
            log(f"@{getattr(order, 'nickname', '')} 配音异常"
                f"({type(v).__name__}: {v})，这单不出声")
            v = payload
        if v:
            await READY.put((order, v))


async def producer() -> None:
    """提前备好下一幅，让笔不用等生成。

    三条规矩：
    * **生图按 20 秒一拍**（`queue.gen_every`）：一拍里把队列里的真人单一次取走
      （最多 BATCH 个）交给豆包。队列里没有真人单就一拍都不打——不叫 AI、不烧额度。
      空闲很久之后进来的第一个名字不用干等 20 秒，立刻就能生成；之后每批之间隔 20 秒，
      这 20 秒里陆续进来的名字正好攒成下一批。
    * 队列空了 —— 直接从 `data/signatures` 里已经生成好的成图拿一张来播，
      **一次都不叫豆包**。开播、重启、没人说话都不会再烧生成额度。
    * 素材库是空的（第一次跑、还没出过图）—— 用本地字体写一个名字起头，免费。
    """
    global GHOST_LEFT
    last_gen = 0.0                      # 上一次开工的时刻
    # 本地模型不按张收费、单张 2~3 秒：不必攒 20 秒一批，随到随出。
    # 豆包/方舟按张计费，继续走 GEN_EVERY（20 秒）的批量节流。
    local_gen = str(SIG.get("provider") or "").lower() in ("sdcn", "local")
    gen_every = min(GEN_EVERY, 1.5) if local_gen else GEN_EVERY
    while True:
        if READY.full():
            await asyncio.sleep(0.15)
            continue

        # ---------------- 虚拟位次：真排队 ----------------
        # 队列一出现真人，先把面板上他前面那 8 位依次播完，再轮到他。
        # 这几张都是素材库里的成图，不叫模型、不花钱。
        # 礼物是插队的，不等幽灵（见下面 gift_waiting 分支）。
        if not qm.real_pending() and not qm.pending and not _cur_is_real():
            GHOST_LEFT = None                  # 彻底空场了，下一波重新计
        elif GHOST_LEFT is None:
            if qm.pending or _cur_is_real():
                # 已经有一位真人在写/在生成：队伍是连续的，新来的只排在他后面，
                # 不用再等一轮幽灵（否则第 2 个真人要凭空多等 90 秒）。
                GHOST_LEFT = 0
            else:
                # 进队那一刻正在播的那张幽灵算 1 位，所以还差 ghost_wait - 1 张
                GHOST_LEFT = max(0, _ghost_wait() - (1 if qm.current else 0))

        if qm.real_pending():
            if qm.gift_waiting():
                GHOST_LEFT = 0                 # 花过钱的不排队，当前写完就上
            if GHOST_LEFT:
                if not qm.paused and bus.count and READY.empty():
                    if await queue_library():
                        GHOST_LEFT -= 1
                        log(f"虚拟观众让位：前面还有 {GHOST_LEFT} 位")
                        await bus.emit("queue", queue_view())
                        continue
                    # 素材库空到连名字池都没有：别让真人干等，直接放行
                    log("没有可播的空场素材，跳过虚拟位次")
                    GHOST_LEFT = 0
                    continue
                await asyncio.sleep(0.4)
                continue

        # ---------------- 生图节流 ----------------
        if qm.real_pending():
            # 礼物单不等窗口：花过钱的人下一个就该写到他。
            # 本地模型（sdcn/local）不按张收费、单张 2~3 秒，没必要攒 20 秒一批：
            # 随到随出，第 2 个真人才不会在队列里干等一轮窗口。
            wait = 2.0 if qm.gift_waiting() else gen_every
            if time.time() - last_gen >= wait:
                group = qm.pop_real(BATCH)
                if group:
                    last_gen = time.time()
                    await bus.emit("queue", queue_view())
                    try:
                        pairs = await build_batch(group)
                    except Exception as e:
                        log(f"批量出图失败({type(e).__name__}: {e})")
                        pairs = []
                    await _ready_many(pairs)
                    continue            # 本地模型 1~3 秒就出图，别拿幽灵垫场——垫了会抢在真人前面播，
            # 观众看到的是"轮到我之前又插进来一个"。
            # 豆包要等 20 秒窗口，这段时间先用素材库续着，别让画面空着。
            if local_gen:
                await asyncio.sleep(0.2)
                continue
            if not qm.paused and bus.count and READY.empty():
                if await queue_library():
                    continue
            await asyncio.sleep(0.3)
            continue

        # ---------------- 下面只剩演示数据 / 空场 ----------------
        order = qm.pop()
        await bus.emit("queue", queue_view())
        if order is None:
            # `qm.pending` 有单 = 真人已经生成好、正排着等播（或还在出图）。
            # 这时候 READY 可能是空的，但绝不能拿幽灵去填——一填就插到真人前面，
            # 观众会看到"轮到我之前又冒出来一个"。
            if (not qm.paused and bus.count and READY.empty()
                    and not qm.pending):
                if await queue_library():
                    continue
            # 0.4 秒一探：没有叠加层连着也照样这个频率，否则有人打名字要等好几秒才响应
            await asyncio.sleep(0.4)
            continue
        # 演示数据（mock 假观众）：素材库回放或本地笔画，绝不叫 AI
        try:
            payload = await build_payload(order)
        except Exception as e:
            log(f"@{order.nickname} 出图失败: {e}")
            payload = None
        if payload:
            await _ready(order, payload)


async def queue_library() -> bool:
    """空场取一张现成的图排上。返回 False 表示没东西可播。"""
    if not lib.enabled:
        return False
    # 自动轮换背景：借这个空档换（下一张字开始前），写到一半换会闪。
    # 换完把 background 广播出去，overlay 直接改 .poster，不用刷新 OBS。
    try:
        hit = await asyncio.to_thread(bg_rotate_step)
    except Exception as e:
        log(f"自动换背景失败({type(e).__name__}: {e})")
        hit = None
    if hit:
        log(f"自动换背景「{hit['name']}」（每 {BG_AUTO['every']} 张一换）")
        await bus.emit("background", {"url": _bg_info()["url"]})
    item = await asyncio.to_thread(lib.next_item)
    tier = tier_for(0)
    if item:
        # 笔顺路径可能现算（第一次），别卡事件循环
        payload = await asyncio.to_thread(lib.payload, item, tier)
        ghost = qm.ghost(payload["nickname"], payload["name"])
        payload["seq"] = ghost.seq
        _note_ghost(ghost, payload)
        # 空场也说话：名字在素材库里是固定的，文案和 mp3 第二次起全命中缓存，
        # 不联网、不花钱——第一轮过去之后这一段几乎是 0 成本。
        await _ready(ghost, payload)
        return True
    # 一张成图都没有：本地笔画起头（免费），别让画面空着
    if virtual.ready():
        name = virtual.names[virtual.i % len(virtual.names)]
        virtual.i += 1
        ghost = qm.ghost(f"路人{virtual.i:02d}", name)
        payload = await local_payload(ghost, tier)
        if payload:
            _note_ghost(ghost, payload)
            await _ready(ghost, payload)
            return True
    return False


async def presenter() -> None:
    global CURRENT, LAST, STAGE
    while True:
        order, payload = await READY.get()
        # 生成完之后才补的礼物（先报名字、过几秒才送礼）：笔迹是现成的，不用重画，
        # 但档位要按礼物重算——礼物必须写得比普通弹幕久、成品展示也更长。
        if getattr(order, "upgraded", False):
            t = tier_for(float(order.value or 0))
            payload = {**payload, "tier": t.get("key"), "tier_name": t.get("name"),
                       "duration_ms": int(float(t.get("duration", 8)) * 1000),
                       "hold_seconds": float(t.get("hold_seconds", 3.0)),
                       "jump": True}
        duration = payload.get("duration_ms", 8000) / 1000.0
        hold = float(payload.get("hold_seconds", 3.0))
        qm.current = order
        await bus.emit("queue", queue_view())
        _draw_done.clear()
        CURRENT = (payload, time.time(), duration)
        await bus.emit("draw_start", payload)
        if bus.count:
            deadline = time.time() + duration + 8
            while time.time() < deadline:
                try:
                    await asyncio.wait_for(_draw_done.wait(), timeout=0.25)
                    break
                except asyncio.TimeoutError:
                    if not bus.count:      # overlay 中途断了，别干等到超时
                        break
            else:
                log("overlay 未回报完成，按超时继续")
            # 成图已经淡入完了（overlay 是在淡入结束那一刻才报的 done），
            # 这里停的就是纯粹的"成品展示时间"，够截图。
            await asyncio.sleep(hold)
        else:
            await asyncio.sleep(min(duration, 2.0))
        CURRENT = None
        await bus.emit("draw_end", {"nickname": order.nickname, "name": order.name})
        # 这张已经铺在画面上了：OBS 重连时直接拿它当背景
        LAST = dict(payload)
        STAGE = LAST.get("full_url") or LAST.get("art_url") or STAGE
        if order.kind == "virtual":
            qm.current = None          # 空场回放不算"写过一张"，别污染计数
        else:
            qm.finish()
        await bus.emit("queue", queue_view())


# ---------------------------------------------------------------- events
async def on_event(ev: dict) -> None:
    kind = ev.get("type")
    nick = ev.get("nickname", "") or ""
    demo = bool(ev.get("demo"))      # mock 造出来的假观众
    if kind == "chat":
        # 先审再入队。审核是网络调用（约 1~2 秒），放在 add_chat 前面：
        # 宁可让这条弹幕晚 2 秒进队，也不能让不合规的名字出现在公屏上。
        # demo（mock 假观众）跳过审核：那 27 个名字是写死的，白白烧 API 调用。
        nm = signature.clean_name(ev.get("content", ""), qm.prefix)
        if nm and not demo:
            ok, why = await MOD.check(nm)
            if not ok:
                log(f"@{nick} 弹幕「{nm}」拦下：{why or '不合规'}")
                await bus.emit("toast", {"text": f"@{nick} 这个名字不适合上屏，已跳过"})
                await bus.emit("queue", queue_view())
                return
        order = qm.add_chat(nick, ev.get("content", ""))
        if order:
            order.demo = demo
            log(f"@{nick} 弹幕「{order.name}」入队")
            await bus.emit("toast", {"text": f"@{nick}：{order.name}"})
        elif qm.last_reject:
            # 去重挡下来的也记一笔，方便回看"这个名字是不是刚写过"
            log(f"@{nick} 弹幕「{ev.get('content', '')}」跳过：{qm.last_reject}")
    elif kind == "gift":
        gift = ev.get("gift", "") or ""
        diamond = float(ev.get("diamond") or 0)
        value = float(ev.get("value") or GIFTS.get(gift, 0) or diamond / 10.0 or 0)
        # 送礼写的是"他弹幕里说过的名字"；那份名字在入队时已经审过了。
        # 只有一种情况没审过：他从没发过名字，写的是他的**昵称**——昵称同样可能不合规。
        if nick not in qm.names and not demo:
            nm = qm.name_for(nick)
            ok, why = await MOD.check(nm)
            if not ok:
                log(f"@{nick} 送 {gift} 拦下：昵称「{nm}」{why or '不合规'}")
                await bus.emit("toast", {"text": f"@{nick} 这个名字不适合上屏，已跳过"})
                await bus.emit("queue", queue_view())
                return
        order = qm.add_gift(nick, gift, value)
        if order:
            order.demo = demo
            src = "弹幕里的名字" if qm.names.get(nick) == order.name else "昵称"
            tail = "，原单升级" if getattr(order, "upgraded", False) else ""
            log(f"@{nick} 送 {gift}(¥{value:g}) -> 插队写「{order.name}」(取自{src}){tail}")
            await bus.emit("toast", {"text": f"@{nick} 送{gift}，插队写「{order.name}」"})
        elif qm.last_reject:
            log(f"@{nick} 送 {gift} 跳过：{qm.last_reject}")
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
    # 先把成图索引建好（缺字框的会现算一次，放线程里别卡事件循环），
    # 这样第一条空场画面是立刻出来的，不会先愣几秒。
    await asyncio.to_thread(lib.refresh, True)
    log(f"空场素材库: {len(lib.items)} 张现成成图（{lib.mode}），"
        f"队列没人的时候直接播它们，不叫豆包")
    # 右上角队列开播就有内容：先用素材库里的名字垫满（`queue.real_from` 前那 8 行），
    # 之后每播一张幽灵单就顶掉最旧的一条，看着像一直有人在排队。
    # 为什么要"直接垫"而不是等回放慢慢攒：攒满 8 行得播 8 次，开播头几分钟面板会
    # 一格一格长出来，观众一眼看出是人造的。
    # 素材库里不同名字不够 8 个时，用 `virtual.names` 补足 —— 幽灵行纯粹是摆设，
    # 不需要真有对应成图。
    need = max(0, int((cfg.get("queue") or {}).get("real_from", 9)) - 1)
    pool = [n for n in lib.names() if n] + [n for n in virtual.names if n]
    seen: set[str] = set()
    for n in pool:
        if len(seen) >= need:
            break
        if n in SKIP_GHOST or n in seen:
            continue
        seen.add(n)
        GHOSTS.append({"nickname": f"路人{len(seen):02d}", "name": n,
                       "seq": len(seen), "kind": "ghost",
                       "jump": len(seen) % 4 == 0,
                       "gift": "小心心" if len(seen) % 4 == 0 else "",
                       "value": 0.0})
    # 演示数据跟着素材库走：喊的名字库里正好有同名成图，就真的写出那一张
    if getattr(source, "name", "") == "mock":
        names = [n for n in lib.names() if n]
        if names and hasattr(source, "use_names"):
            source.use_names(names)
            log(f"演示数据（mock）：假观众只说这 {len(names)} 个名字，"
                f"全部播现成成图，不会调豆包")
    _tasks.append(asyncio.create_task(producer()))
    _tasks.append(asyncio.create_task(presenter()))
    _tasks.append(asyncio.create_task(source_loop()))
    _tasks.append(asyncio.create_task(watchdog()))
    # 预热语音：edge-tts 第一次连服务器（TLS/代理）要 10 秒以上，
    # 这钱花在开播前，别花在第一位观众身上。
    if voice.enabled(VCONF):
        _tasks.append(asyncio.create_task(asyncio.to_thread(voice.warmup, VCONF)))
    log(f"启动完成: platform={cfg['platform']['type']} "
        f"provider={SIG.get('provider', 'local')}")
    yield
    for t in _tasks:
        t.cancel()
    await source.close()


async def watchdog() -> None:
    while True:
        await asyncio.sleep(30)
        await bus.prune(90.0)


app = FastAPI(lifespan=lifespan, title="zhibo-sign")


@app.middleware("http")
async def no_stale_ui(request: Request, call_next):
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
            "provider": SIG.get("provider", "local"),
            "logs": list(LOGS)[-40:]}


async def _json_body(req: Request) -> dict:
    raw = await req.body()
    if not raw.strip():
        return {}
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


def _resolve_value(d: dict, q) -> tuple[float, str]:
    raw_v = d.get("value") or q.get("value")
    gift = str(d.get("gift") or q.get("gift") or "")
    if raw_v not in (None, ""):
        try:
            return float(raw_v), gift
        except (TypeError, ValueError):
            pass
    if gift:
        return float(GIFTS.get(gift, 0) or 0), gift
    t = tier_by_name(str(d.get("tier") or q.get("tier") or ""))
    if t:
        return float(t.get("min_value", 0)), gift
    return 0.0, gift


async def _enqueue(nick: str, name: str, value: float = 0.0,
                   gift: str = "", kind: str = "manual") -> dict:
    """后台/模拟加单。礼物走真正的插队路径（add_gift），否则"送礼插队"在后台点不出来。"""
    if kind == "gift":
        if name and name != nick:      # 带了名字就先记住，礼物只认昵称
            qm.remember(nick, name)
        order = qm.add_gift(nick, gift, value)
        if not order:
            return {"ok": False, "error": qm.last_reject or "没排上"}
    else:
        order = qm.add_manual(nick, name, kind, gift, value)
    log(f"手动加入 @{nick}「{order.name}」[{tier_for(order.value).get('name')}]")
    await bus.emit("queue", queue_view())
    return {"ok": True, "tier": tier_for(order.value).get("key"), "order": order.brief()}


@app.post("/api/simulate")
async def simulate(req: Request):
    d = await _json_body(req)
    q = req.query_params
    nick = d.get("nickname") or q.get("nickname") or "测试观众"
    name = d.get("name") or q.get("name") or d.get("content") or q.get("content") or ""
    value, gift = _resolve_value(d, q)
    return await _enqueue(nick, name or nick, value, gift, "gift" if gift else "manual")


@app.get("/api/simulate")
async def simulate_get(nickname: str = "", name: str = "", content: str = "",
                       value: str = "", gift: str = "", tier: str = ""):
    """浏览器直接打开即可： /api/simulate?nickname=小明&name=张三"""
    nick = nickname or "测试观众"
    value_, gift_ = _resolve_value({"value": value, "gift": gift, "tier": tier}, {})
    return await _enqueue(nick, name or content or nick, value_, gift_,
                          "gift" if gift_ else "manual")


@app.get("/api/tiers")
async def list_tiers():
    return {"tiers": [{"key": t.get("key"), "name": t.get("name"),
                       "min_value": t.get("min_value"),
                       "duration": t.get("duration")} for t in TIERS],
            "gifts": GIFTS}


# ---------------------------------------------------------------- 签名样式
# 字体和材质都要能**当场换**：一次直播里看腻了、或者某个名字长得怪，
# 后台点一下就行，不用重启，也不用等下一场。
#
# 当场生效的原理：build_batch 每一批都重新 `dict(SIG.get(provider) or {})`，
# 所以改 SIG["sdcn"] 立刻作用到下一单。
FONT_LABELS = {
    "MaShanZheng": "马善政毛笔楷书",
    "ZhiMangXing": "志莽行书",
    "LiuJianMaoCao": "柳建毛草",
    "ZCOOLQingKeHuangYou": "站酷庆科黄油",
    "ZCOOLKuaiLe": "站酷快乐体",
    "ZCOOLXiaoWei": "站酷小薇",
    "LongCang": "龙藏体",
}
STYLE_LABELS = {
    "ink": "墨绿平涂",
    "emboss": "立体浮雕",
    "extrude": "立体挤出 3D",
    "gold": "烫金立体",
    "chrome": "镀铬",
    "neon": "霓虹发光",
}


def font_options() -> list[dict]:
    """可选字形。空 id = 系统楷体（local 兜底那条路也只有它能用，行书连笔提不出笔顺）。"""
    out = [{"id": "", "label": "楷体（骨架最稳）"}]
    d = ROOT / "overlay" / "assets" / "fonts"
    if d.is_dir():
        for p in sorted(d.glob("*.ttf")):
            out.append({"id": str(p.relative_to(ROOT)).replace("\\", "/"),
                        "label": FONT_LABELS.get(p.stem, p.stem)})
    return out


def _save_sdcn(key: str, value: str) -> bool:
    """把 font / style 写回 config.yaml。

    只替换那一行的**值**、保留行尾注释，也不碰 sdcn 段以外的东西——
    顶层 signature 也有一个 `font:`（给 local 用），别误改。
    整体 yaml.dump 是不行的：这文件里全是中文注释，dump 一遍全丢。
    """
    p = ROOT / "config.yaml"
    try:
        txt = p.read_text(encoding="utf-8")
    except Exception:
        return False
    i = txt.find("\n  sdcn:")
    if i < 0:
        return False
    j = txt.find("\n  # ---- 可选 AI 出图", i)
    head, seg, tail = (txt[:i], txt[i:j], txt[j:]) if j > 0 else (txt[:i], txt[i:], "")
    seg2, n = re.subn(rf'(?m)^(\s*{key}:\s*)("[^"]*"|\S+)(.*)$',
                      lambda m: f"{m.group(1)}{value}{m.group(3)}", seg, count=1)
    if not n:
        return False
    try:
        p.write_text(head + seg2 + tail, encoding="utf-8")
        return True
    except Exception as e:
        log(f"写 config.yaml 失败: {e}")
        return False


def _style_conf() -> dict:
    return SIG.setdefault("sdcn", {}) or {}


@app.get("/api/style")
async def style_get():
    c = dict(SIG.get("sdcn") or {})
    return {"ok": True,
            "font": c.get("font") or "",
            "style": c.get("style") or "ink",
            "fonts": font_options(),
            "styles": [{"id": k, "label": v} for k, v in STYLE_LABELS.items()]}


@app.post("/api/style")
async def style_set(req: Request):
    d = await _json_body(req)
    conf = _style_conf()
    changed = []

    if "font" in d:
        font = str(d.get("font") or "")
        ids = {o["id"] for o in font_options()}
        if font not in ids:
            return JSONResponse({"ok": False, "error": "字体不在列表里"}, status_code=400)
        conf["font"] = font
        _save_sdcn("font", f'"{font}"')
        changed.append("font=" + (font or "楷体"))

    if "style" in d:
        style = str(d.get("style") or "").lower()
        if style not in STYLE_LABELS:
            return JSONResponse({"ok": False, "error": "材质不在列表里"}, status_code=400)
        conf["style"] = style
        _save_sdcn("style", style)
        changed.append("style=" + style)

    if not changed:
        return JSONResponse({"ok": False, "error": "没给 font/style"}, status_code=400)
    log("签名样式: " + " ".join(changed) + "（下一单生效）")
    return {"ok": True, "font": conf.get("font") or "",
            "style": conf.get("style") or "ink"}


def _save_voice(key: str, value: str) -> bool:
    """把 voice 段里某一行的值写回 config.yaml（只换值，保留注释）。

    和 _save_sdcn 一个套路：整份 yaml.dump 会把满文件的中文注释全丢掉。
    voice 段是顶格的，所以边界就是"下一行顶格的键"。
    """
    p = ROOT / "config.yaml"
    try:
        txt = p.read_text(encoding="utf-8")
    except Exception:
        return False
    i = txt.find("\nvoice:")
    if i < 0:
        return False
    j = txt.find("\n# ----", i + 1)
    if j < 0:
        j = len(txt)
    head, seg, tail = txt[:i], txt[i:j], txt[j:]
    # 必须锚两个空格：段头那一行 `voice:` 是顶格的，正则一松就会把段头当成
    # "voice 这一项"改掉，整段配置直接崩。
    seg2, n = re.subn(rf'(?m)^(  {key}:\s*)("[^"]*"|\S+)(.*)$',
                      lambda m: f"{m.group(1)}{value}{m.group(3)}", seg, count=1)
    if not n:
        return False
    try:
        p.write_text(head + seg2 + tail, encoding="utf-8")
        return True
    except Exception as e:
        log(f"写 config.yaml 失败: {e}")
        return False


@app.get("/api/voice")
async def voice_get():
    return {"ok": True,
            "enabled": voice.enabled(VCONF),
            "voice": str(VCONF.get("voice") or "zh-CN-XiaoxiaoNeural"),
            "rate": str(VCONF.get("rate") or "+8%"),
            "source": str(VCONF.get("source") or "ai"),
            "voices": voice.VOICES,
            "status": voice.status()}


@app.post("/api/voice")
async def voice_set(req: Request):
    """开关 / 换音色 / 换语速 / 换文案来源。下一单生效，同时写回 config.yaml。"""
    d = await _json_body(req)
    changed = []

    if "enabled" in d:
        on = bool(d.get("enabled"))
        VCONF["enabled"] = on
        _save_voice("enabled", "true" if on else "false")
        changed.append("语音" + ("开" if on else "关"))

    if "voice" in d:
        v = str(d.get("voice") or "")
        if v not in {o["id"] for o in voice.VOICES}:
            return JSONResponse({"ok": False, "error": "音色不在列表里"}, status_code=400)
        VCONF["voice"] = v
        _save_voice("voice", f'"{v}"')
        changed.append("音色=" + v)

    if "rate" in d:
        r = str(d.get("rate") or "+0%")
        if not re.fullmatch(r"[+-]?\d{1,3}%", r):
            r = "+0%"
        VCONF["rate"] = r
        _save_voice("rate", f'"{r}"')
        changed.append("语速=" + r)

    if "source" in d:
        s = str(d.get("source") or "template").lower()
        if s not in ("ai", "template"):
            return JSONResponse({"ok": False, "error": "来源只能是 ai / template"},
                                status_code=400)
        VCONF["source"] = s
        _save_voice("source", s)
        changed.append("文案=" + ("AI 现写" if s == "ai" else "模板"))

    if not changed:
        return JSONResponse({"ok": False, "error": "没给 enabled/voice/rate/source"},
                            status_code=400)
    log("祝福语音: " + " ".join(changed) + "（下一单生效）")
    return {"ok": True, "enabled": voice.enabled(VCONF),
            "voice": VCONF.get("voice"), "rate": VCONF.get("rate"),
            "source": VCONF.get("source")}


@app.get("/api/voice/preview")
async def voice_preview(name: str = "张三"):
    """后台"试听"：现写现念一句。合成要 1~2 秒，前端自己 loading。"""
    if not voice.enabled(VCONF):
        return JSONResponse({"ok": False, "error": "语音开关是关着的"}, status_code=400)
    info = await asyncio.to_thread(voice.say, name, VCONF, "plain")
    if not info:
        return JSONResponse({"ok": False,
                             "error": "合成失败（没网 / 没装 edge-tts？）"},
                            status_code=502)
    return {"ok": True, **info}


@app.post("/api/control")
async def control(req: Request):
    d = await _json_body(req)
    action = d.get("action") or req.query_params.get("action")
    await _do_action(str(action), d)
    return {"ok": True, **queue_view()}


async def _do_action(a: str, d: dict) -> None:
    if a == "pause":
        qm.paused = True
    elif a == "resume":
        qm.paused = False
        qm._event.set()
    elif a == "skip":
        qm.skip()
    elif a == "clear":
        n = len(qm.items) + len(qm.pending)
        qm.items.clear()
        qm.pending.clear()          # 生成中的也一起清掉，面板别留着幽灵行
        log(f"清空队列（{n} 单）")
    elif a == "virtual_on":
        virtual.conf["enabled"] = True
    elif a == "virtual_off":
        virtual.conf["enabled"] = False
    elif a == "drop":
        qm.drop(int(d.get("seq") or 0))
    elif a == "bump":
        qm.bump(int(d.get("seq") or 0))


@app.get("/api/admin/state")
async def admin_state():
    return {**queue_view(), "logs": list(LOGS)[-80:], "overlays": bus.count,
            "ready": READY.qsize(), "remembered": dict(list(qm.names.items())[-20:]),
            "tiers": [{"key": t.get("key"), "name": t.get("name"),
                       "min_value": t.get("min_value")} for t in TIERS],
            "config": {"provider": SIG.get("provider", "local"),
                       "prefix": qm.prefix, "max": int(cfg["queue"].get("max", 30))},
            "libgen": LIBGEN,
            "voice": {**voice.status(), "enabled": voice.enabled(VCONF)}}


@app.post("/api/admin/action")
async def admin_action(req: Request):
    d = await _json_body(req)
    a = str(d.get("action") or req.query_params.get("action") or "")
    if a == "add":
        nick = str(d.get("nickname") or "手动")
        name = str(d.get("name") or d.get("content") or "")
        if not signature.clean_name(name):
            return JSONResponse({"ok": False, "error": "名字不合法"}, status_code=400)
        value, gift = _resolve_value(d, {})
        return await _enqueue(nick, signature.clean_name(name), value, gift, "manual")
    if a not in ("pause", "resume", "skip", "clear", "virtual_on", "virtual_off",
                 "drop", "bump"):
        return JSONResponse({"ok": False, "error": f"未知操作 {a}"}, status_code=400)
    await _do_action(a, d)
    await bus.emit("queue", queue_view())
    log(f"后台: {a}")
    return {"ok": True, **queue_view()}


# ---------------------------------------------------------------- 直播间设置
# 每次开播房间号都会变，所以后台给一个输入框：贴完整地址
# （https://live.douyin.com/YOUR_ROOM_ID?camera_id=0）或纯房间号都行。
# 保存动作两件事：写回 config.yaml（下次启动直接生效）+ 通过桥的控制口
# （ws 端口 +1，默认 9001）让采集器当场切房间，不用重启任何进程。
def room_from(text: str) -> str:
    """把用户粘的那串东西归一化成房间号。"""
    t = (text or "").strip()
    if not t:
        return ""
    m = re.search(r"live\.douyin\.com/([A-Za-z0-9_-]+)", t)
    if m:
        return m.group(1)
    m = re.search(r"(\d{5,})", t)          # 纯数字 / 带了一堆参数
    if m:
        return m.group(1)
    return t.rstrip("/").split("?")[0].split("&")[0]


def _ext_conf() -> dict:
    return (cfg.setdefault("platform", {}) or {}).setdefault("external", {}) or {}


def _ctl_url() -> str:
    """桥的控制口：从 ws_url（ws://127.0.0.1:9000/events）推出来，默认端口 +1。"""
    ws = str(_ext_conf().get("ws_url") or "ws://127.0.0.1:9000/events")
    m = re.search(r"//([^:/]+):(\d+)", ws)
    if not m:
        return "http://127.0.0.1:9001/room"
    return f"http://{m.group(1)}:{int(m.group(2)) + 1}/room"


async def _ws_open() -> bool:
    """弹幕 ws 口（默认 9000）通不通。用来区分"采集器没启动"和"采集器是旧版本"。"""
    ws = str(_ext_conf().get("ws_url") or "ws://127.0.0.1:9000/events")
    m = re.search(r"//([^:/]+):(\d+)", ws)
    host, port = (m.group(1), int(m.group(2))) if m else ("127.0.0.1", 9000)
    try:
        _, w = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=0.8)
        w.close()
        return True
    except Exception:
        return False


def _save_room(room: str) -> bool:
    """把房间号写回 config.yaml。

    用按行替换而不是 yaml.dump：配置文件里全是中文注释，
    重新 dump 一遍会全部丢掉，人就没法改配置了。
    """
    p = ROOT / "config.yaml"
    try:
        txt = p.read_text(encoding="utf-8")
    except Exception:
        return False
    i = txt.find("external:")             # 只在 external 段里动，别误改别处
    if i < 0:
        return False
    head, tail = txt[:i], txt[i:]
    tail2, n = re.subn(r'(?m)^(\s*)room:\s*.*$',
                       lambda m: f'{m.group(1)}room: "{room}"', tail, count=1)
    if not n:
        return False
    try:
        p.write_text(head + tail2, encoding="utf-8")
    except Exception as e:
        log(f"写 config.yaml 失败: {e}")
        return False
    return True


@app.get("/api/live")
async def live_get():
    """当前直播间 + 采集器（桥）是否在线、能不能当场切。"""
    ext = _ext_conf()
    room = str(ext.get("room") or "")
    info: dict | None = None
    try:
        async with httpx.AsyncClient(timeout=1.5, trust_env=False) as c:
            r = await c.get(_ctl_url())
            info = r.json()
    except Exception:
        info = None

    # 控制口连不上时，再看一眼弹幕 ws 口在不在：
    # 9000 通、9001 不通 = 采集器是**旧版本**（还得重启一下才有控制口），
    # 跟"根本没启动"是两回事，后台提示要分开，不然人会一直以为自己没开。
    ws_up = False
    if not info:
        ws_up = await _ws_open()

    return {"ok": True, "room": room,
            "url": f"https://live.douyin.com/{room}" if room else "",
            "bridge": bool(info and info.get("ok")),
            "bridge_old": bool(ws_up and not info),
            "bridge_room": (info or {}).get("room") or "",
            "frames": (info or {}).get("frames"),
            "events": (info or {}).get("events"),
            "platform": str((cfg.get("platform") or {}).get("type") or "")}



@app.post("/api/live")
async def live_set(req: Request):
    """保存新直播间，并让采集器立刻切过去。"""
    d = await _json_body(req)
    raw = str(d.get("room") or d.get("url")
              or req.query_params.get("room") or "").strip()
    room = room_from(raw)
    if not room:
        return JSONResponse({"ok": False, "error": "没填直播间地址"}, status_code=400)

    ext = _ext_conf()
    old = str(ext.get("room") or "")
    ext["room"] = room
    # 数据源对象里也存了一份 external 配置，顺手更新，保持一致
    try:
        if getattr(source, "cfg", None) is not None:
            source.cfg["room"] = room
    except Exception:
        pass

    saved = await asyncio.to_thread(_save_room, room)
    switched, note = False, ""
    try:
        async with httpx.AsyncClient(timeout=8, trust_env=False) as c:
            r = await c.post(_ctl_url(), json={"room": room})
            j = r.json()
            switched = bool(j.get("ok"))
            note = "" if switched else str(j.get("error") or "切换失败")
    except Exception as e:
        # 采集器没起也照存：下次 `python scripts/douyin_browser.py` 读到新房间
        if await _ws_open():
            note = ("采集器是旧版本（没有控制口），房间号已保存；"
                    "重启一次采集器后才会当场切")
        else:
            note = f"采集器没在线（{type(e).__name__}），已存进配置，启动后生效"

    if room == old:
        log(f"直播间没变化：{room}")
    else:
        log(f"直播间 {old or '空'} -> {room}"
            f"{'（采集器已切）' if switched else '（仅保存）'}")
    return {"ok": True, "room": room, "old": old, "saved": saved,
            "switched": switched, "note": note}


@app.get("/api/library")
async def library_list():
    """空场循环用的成图清单（后台那一栏素材管理）。"""
    items = await asyncio.to_thread(lib.listing)
    return {"ok": True, "count": len(items), "items": items, "status": lib.status()}


# ---------------------------------------------------------------- 直播背景
# 背景就是那张海报：`.poster` 这一层铺它，写完的那一刻换成 `.shot` 成图。
# 以前它写死在 overlay/style.css 里（url("/overlay/assets/poster_clean.jpg")），
# 换一次图要改 CSS 再重启。现在改成上传即换：
#
#   原图 -> poster_src.jpg（保留，方便以后重新擦）
#        -> poster_clean.jpg（真正铺上去的；擦过字的底板）
#
# 两个必须处理的细节：
# 1. **统一成 1080x1920**（居中裁切 + 缩放）。写字的位置是按 1080x1920 算死的
#    （见 wordsheet.place_box 和 overlay 里的字位），背景尺寸不一样就会写偏。
# 2. **浏览器会缓存同名图片**。所以文件名不变、靠 `?v=时间戳` 强制重载，
#    并且 overlay 收到 `background` 事件后自己换 style.backgroundImage。
BG_DIR = ROOT / "overlay" / "assets"
BG_SRC = BG_DIR / "poster_src.jpg"
BG_CLEAN = BG_DIR / "poster_clean.jpg"
BG_BAK = BG_DIR / "poster_clean.bak.jpg"
BG_SRC_BAK = BG_DIR / "poster_src.bak.jpg"
BG_VER = {"v": int(time.time())}

# 擦字默认框，**1080x1920 坐标系**（背景统一成这个尺寸）。
# 别直接抄 plate.DEFAULT_BOX —— 那个是 1279x2280 模板坐标，套到 1080 画面上
# 会整体往右下偏一块（229->193、1008->849），擦到不该擦的地方。
BG_BOX_STAGE = (193, 849, 893, 1148)


def _imread_bytes(raw: bytes) -> np.ndarray | None:
    a = np.frombuffer(raw, np.uint8)
    return cv2.imdecode(a, cv2.IMREAD_COLOR)


def _fit_stage(img: np.ndarray, size: tuple[int, int] = (1080, 1920)) -> np.ndarray:
    """等比放大到铺满，再居中裁成 1080x1920。不做拉伸——拉伸会把脸和图形挤扁。"""
    sw, sh = size
    h, w = img.shape[:2]
    k = max(sw / w, sh / h)
    nw, nh = int(round(w * k)), int(round(h * k))
    interp = cv2.INTER_AREA if k < 1 else cv2.INTER_CUBIC
    img = cv2.resize(img, (nw, nh), interpolation=interp)
    x0 = max(0, (nw - sw) // 2)
    y0 = max(0, (nh - sh) // 2)
    return img[y0:y0 + sh, x0:x0 + sw]


def _bg_render(img: np.ndarray, erase: bool, box_raw: str,
               pad: int) -> tuple[np.ndarray, np.ndarray]:
    """原图 -> (src, clean)，两张都是 1080x1920。

    抽出来是给"单张上传"和"传进背景库"共用：两条路的缩放、擦字规则必须一模一样，
    否则后台存的库图和当前生效图会差几个像素，字位就对不上。
    """
    src = _fit_stage(img)
    clean = src
    if erase:
        box = BG_BOX_STAGE
        if box_raw:
            try:
                parts = [int(float(x)) for x in box_raw.replace("，", ",").split(",")[:4]]
                if len(parts) == 4:
                    box = tuple(parts)
            except Exception:
                pass
        clean = plate.rebuild_region(src, box, pad=pad)
    return src, clean


def _bg_write(src: np.ndarray, clean: np.ndarray) -> None:
    """把处理好的两张图落盘成"当前背景"。上一个版本成对备份到 .bak。"""
    for cur, bak in ((BG_CLEAN, BG_BAK), (BG_SRC, BG_SRC_BAK)):
        if cur.exists():
            try:
                cur.replace(bak)
            except Exception as e:
                log(f"备份旧背景失败({cur.name}): {e}")
    ok, buf = cv2.imencode(".jpg", src, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    if ok:
        BG_SRC.write_bytes(buf.tobytes())
    ok2, buf2 = cv2.imencode(".jpg", clean, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    if not ok2:
        raise RuntimeError("编码失败")
    BG_CLEAN.write_bytes(buf2.tobytes())


# 背景换了之后"底图 + 笔迹"的合成缓存不需要手动作废：
# `Library._full_view` 的缓存文件名里带底板指纹（mtime + 大小），换背景等于
# 换了一套新文件名，旧的自然读不到。以前这里是 glob 删 jpg——一张背景几十个文件，
# 批量删会被系统的删除保护拦住（严重时直接杀进程），而且删完下一张还要重新合。


# ---------------------------------------------------------------- 背景库
# 一直用同一张海报，"画面周期性重复"就是录播判定里最省事的一条特征。
# 这里允许存多张**同版式**的背景（换色/换纹理/换文案都行，字位必须一样），
# 按"每写 N 个名字换一张"自动轮换；也可以手动点某一张。
BG_LIB = BG_DIR / "backgrounds"
BG_INDEX = BG_LIB / "_index.json"
BG_ROT = {"i": 0, "n": 0}          # i = 库里当前用第几张；n = 距上次换图播了几张
_BGC = cfg.get("background") or {}
BG_AUTO = {"rotate": bool(_BGC.get("rotate")),
           "every": max(2, int(_BGC.get("every") or 6))}


def _bg_items() -> list[dict]:
    try:
        d = json.loads(BG_INDEX.read_text("utf-8"))
        return [x for x in d if isinstance(x, dict) and x.get("file")] if isinstance(d, list) else []
    except Exception:
        return []


def _bg_save_items(items: list[dict]) -> None:
    BG_LIB.mkdir(parents=True, exist_ok=True)
    try:
        BG_INDEX.write_text(json.dumps(items, ensure_ascii=False, indent=1), "utf-8")
    except Exception as e:
        log(f"背景索引写入失败: {e}")


def _bg_list_view() -> dict:
    items = _bg_items()
    cur = BG_ROT.get("i", 0)
    out = []
    for k, it in enumerate(items):
        f = BG_LIB / it["file"]
        out.append({"id": it.get("id") or it["file"], "name": it.get("name") or it["file"],
                    "url": f"/overlay/assets/backgrounds/{it['file']}?v={BG_VER['v']}",
                    "ts": int(it.get("ts") or 0), "current": k == cur})
    return {"ok": True, "count": len(out), "items": out,
            "rotate": dict(BG_AUTO), "every": BG_AUTO["every"]}


def _bg_info() -> dict:
    p = BG_CLEAN if BG_CLEAN.exists() else BG_SRC
    size = [0, 0]
    if p.exists():
        im = cv2.imdecode(np.fromfile(str(p), np.uint8), cv2.IMREAD_COLOR)
        if im is not None:
            size = [int(im.shape[1]), int(im.shape[0])]
    return {"ok": True,
            "url": f"/overlay/assets/poster_clean.jpg?v={BG_VER['v']}",
            "src_url": (f"/overlay/assets/poster_src.jpg?v={BG_VER['v']}"
                        if BG_SRC.exists() else ""),
            "size": size, "stage": [1080, 1920],
            "has_backup": BG_BAK.exists(),
            "box": list(BG_BOX_STAGE), "pad": plate.DEFAULT_PAD}


@app.get("/api/background")
async def background_get():
    return _bg_info()


@app.post("/api/background")
async def background_set(req: Request):
    """上传新背景。原图直接放请求体（和素材库上传一个路数，避开 multipart）。

    query:
        erase=1        上传后把中间那块原有的字擦掉（同一套模板才需要）
        box=x0,y0,x1,y1  要擦的区域（默认就是「智纪元」那个框）
        pad=40         往外多吃多少像素（字有投影）
    """
    q = req.query_params
    raw = await req.body()
    if len(raw) < 1000:
        return JSONResponse({"ok": False, "error": "没收到图片内容"}, status_code=400)

    img = await asyncio.to_thread(_imread_bytes, raw)
    if img is None:
        return JSONResponse({"ok": False, "error": "这张图读不出来（要 jpg/png/webp）"},
                            status_code=400)

    # 换图前把上一代成对备份下来（clean 和 src 一起），"恢复上一张"靠它。
    # 只备 clean 是不够的：src 也会被这次上传覆盖，用户上一张的原图就永久丢了。
    # 这一步现在在 _bg_write 里（背景库切换走的也是同一条路，两边必须一致）。

    erase = str(q.get("erase") or "0") in ("1", "true", "on", "yes")
    box_raw = str(q.get("box") or "").strip()
    pad = int(float(q.get("pad") or plate.DEFAULT_PAD))

    def work() -> dict:
        src, clean = _bg_render(img, erase, box_raw, pad)
        _bg_write(src, clean)
        return {"erase": erase, "size": [int(clean.shape[1]), int(clean.shape[0])]}

    try:
        info = await asyncio.to_thread(work)
    except Exception as e:
        log(f"换背景失败: {e}")
        return JSONResponse({"ok": False, "error": f"处理失败: {e}"}, status_code=500)

    BG_VER["v"] = int(time.time() * 1000)
    log(f"后台换背景（{'擦了原字' if info['erase'] else '原图直接用'}，"
        f"{info['size'][0]}x{info['size'][1]}）")
    await bus.emit("background", {"url": _bg_info()["url"]})
    return _bg_info()


@app.post("/api/background/reset")
async def background_reset():
    """恢复上一张背景（每次上传都会把上一代成对挪成 .bak）。"""
    if not BG_BAK.exists():
        return JSONResponse({"ok": False, "error": "没有备份可恢复"}, status_code=404)
    for bak, cur in ((BG_BAK, BG_CLEAN), (BG_SRC_BAK, BG_SRC)):
        if bak.exists():
            cur.unlink(missing_ok=True)
            bak.replace(cur)
        elif cur.exists():
            # 上一代本来就没有 src：把这次上传留下的那张删掉，
            # 否则 clean 回到旧图、src 还停在新图，下次"重新擦字"就擦错文件。
            cur.unlink(missing_ok=True)
    BG_VER["v"] = int(time.time() * 1000)
    log("后台恢复上一张背景")
    await bus.emit("background", {"url": _bg_info()["url"]})
    return _bg_info()


# ---------------------------------------------------------------- 背景库
# 单张替换（上面那条 /api/background）适合"我这套模板就一个版式"的用法。
# 但一场直播十几小时都铺同一张图，画面上就是"一圈一圈重复"，这是判定录播
# 最省事的一条特征。所以再加一个库：后台可以传多张，按"每写 N 个名字换一张"
# 自动轮换，也可以手动点某一张。
#
# 硬约束：**必须是同一版式**。字位是按 1080x1920 算死的（193,851 - 893,1148），
# 换一张版式不同的背景，字就写到别处去了。换色、换纹理、换四周装饰都没问题。

@app.get("/api/background/list")
async def bg_list():
    return _bg_list_view()


@app.post("/api/background/add")
async def bg_add(req: Request):
    """上传一张进背景库。body = 原图；query: name / erase / box / pad / pick=1。"""
    q = req.query_params
    raw = await req.body()
    if len(raw) < 1000:
        return JSONResponse({"ok": False, "error": "没收到图片内容"}, status_code=400)
    img = await asyncio.to_thread(_imread_bytes, raw)
    if img is None:
        return JSONResponse({"ok": False, "error": "这张图读不出来（要 jpg/png/webp）"},
                            status_code=400)

    erase = str(q.get("erase") or "0") in ("1", "true", "on", "yes")
    box_raw = str(q.get("box") or "").strip()
    pad = int(float(q.get("pad") or plate.DEFAULT_PAD))
    name = str(q.get("name") or "").strip() or time.strftime("背景%m%d_%H%M%S")
    want_pick = str(q.get("pick") or "0") in ("1", "true", "on", "yes")

    def work() -> dict:
        src, clean = _bg_render(img, erase, box_raw, pad)
        BG_LIB.mkdir(parents=True, exist_ok=True)
        fid = time.strftime("bg_%m%d_%H%M%S") + f"_{int(time.time() * 1000) % 1000:03d}"
        fp = BG_LIB / f"{fid}.jpg"
        ok, buf = cv2.imencode(".jpg", clean, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        if not ok:
            raise RuntimeError("编码失败")
        fp.write_bytes(buf.tobytes())
        items = _bg_items()
        items.append({"id": fid, "file": fp.name, "name": name,
                      "erase": erase, "ts": int(time.time())})
        _bg_save_items(items)
        return {"id": fid, "file": fp.name}

    try:
        made = await asyncio.to_thread(work)
    except Exception as e:
        log(f"背景入库失败: {e}")
        return JSONResponse({"ok": False, "error": f"处理失败: {e}"}, status_code=500)

    log(f"后台加入背景「{name}」，库里有 {len(_bg_items())} 张")
    if want_pick or len(_bg_items()) == 1:
        await _bg_pick_by_id(made["id"])
    return _bg_list_view()


async def _bg_pick_by_id(bid: str) -> dict | None:
    """把库里某一张变成当前背景。返回换后的信息，没找到返回 None。"""
    items = _bg_items()
    idx = next((k for k, it in enumerate(items)
                if (it.get("id") or it.get("file")) == bid), -1)
    if idx < 0:
        return None
    p = BG_LIB / items[idx]["file"]
    if not p.exists():
        return None

    def work() -> bool:
        raw = p.read_bytes()
        img = _imread_bytes(raw)
        if img is None:
            return False
        # 库里存的已经是 1080x1920 的 clean 版，_fit_stage 幂等，再走一遍只是保险
        clean = _fit_stage(img)
        _bg_write(clean, clean)
        return True

    if not await asyncio.to_thread(work):
        return None
    BG_ROT["i"] = idx
    BG_ROT["n"] = 0
    BG_VER["v"] = int(time.time() * 1000)
    info = {"id": items[idx].get("id") or items[idx]["file"],
            "name": items[idx].get("name") or items[idx]["file"],
            "url": _bg_info()["url"]}
    await bus.emit("background", {"url": info["url"]})
    return info


@app.post("/api/background/pick")
async def bg_pick(req: Request):
    d = await _json_body(req)
    bid = str(d.get("id") or req.query_params.get("id") or "").strip()
    hit = await _bg_pick_by_id(bid)
    if not hit:
        return JSONResponse({"ok": False, "error": "没找到这张背景"}, status_code=404)
    log(f"后台手动切背景「{hit['name']}」")
    return {**_bg_list_view(), "picked": hit}


@app.post("/api/background/remove")
async def bg_remove(req: Request):
    d = await _json_body(req)
    bid = str(d.get("id") or req.query_params.get("id") or "").strip()
    items = _bg_items()
    idx = next((k for k, it in enumerate(items)
                if (it.get("id") or it.get("file")) == bid), -1)
    if idx < 0:
        return JSONResponse({"ok": False, "error": "没找到这张背景"}, status_code=404)
    if len(items) <= 1:
        return JSONResponse({"ok": False, "error": "只剩这一张了，删了就没背景可用"},
                            status_code=400)
    it = items.pop(idx)
    try:
        (BG_LIB / it["file"]).unlink()
    except OSError:
        pass
    _bg_save_items(items)
    if BG_ROT.get("i", 0) >= len(items):
        BG_ROT["i"] = 0
    if idx == BG_ROT.get("i"):
        BG_ROT["i"] = 0
    log(f"后台删除背景「{it.get('name') or it['file']}」，还剩 {len(items)} 张")
    return _bg_list_view()


@app.post("/api/background/rotate")
async def bg_rotate_set(req: Request):
    """是否自动轮换、每写几个名字换一张。库里不足 2 张时开了也没用。"""
    d = await _json_body(req)
    if "rotate" in d:
        BG_AUTO["rotate"] = bool(d.get("rotate"))
    if "every" in d:
        try:
            BG_AUTO["every"] = max(2, min(200, int(float(d.get("every")))))
        except (TypeError, ValueError):
            pass
    BG_ROT["n"] = 0
    log(f"背景轮换：{'开' if BG_AUTO['rotate'] else '关'}"
        f"（每 {BG_AUTO['every']} 张换一次，库里 {len(_bg_items())} 张）")
    return _bg_list_view()


def bg_rotate_step() -> dict | None:
    """空场每播一张调一次。到点了就换下一张，返回新背景信息（None = 这次没换）。

    只从 producer 的空场分支调用 —— 那是"两张字之间"唯一的空档。
    写到一半换底板，画面会闪一下，观众一眼就看出这是程序在切图。
    """
    if not BG_AUTO.get("rotate"):
        return None
    items = _bg_items()
    if len(items) < 2:
        return None
    BG_ROT["n"] = int(BG_ROT.get("n", 0)) + 1
    if BG_ROT["n"] < int(BG_AUTO.get("every") or 6):
        return None
    BG_ROT["n"] = 0
    BG_ROT["i"] = (int(BG_ROT.get("i", 0)) + 1) % len(items)
    it = items[BG_ROT["i"]]
    p = BG_LIB / it["file"]
    if not p.exists():
        return None
    img = _imread_bytes(p.read_bytes())
    if img is None:
        return None
    clean = _fit_stage(img)
    _bg_write(clean, clean)
    return {"id": it.get("id") or it["file"], "name": it.get("name") or it["file"]}


# ---------------------------------------------------------------- 真人小窗
# 平台判「录播 / 挂机」看的不是"画面好不好看"，而是**有没有真人实时参与**。
# 背景轮换和左下角时钟只能把"机械重复"拆散，真正管用的是画面里有一个会动的人。
# 这里做的就是：后台上传一段本人录像（自拍 / 手部 / 侧脸都行），在画面左下角
# 当画中画循环播放。
#
# 多段视频会挨个播，不 loop 同一段——同一段反复循环，本身就是"周期性重复"，
# 只是比整屏循环轻一点。
#
# 代码管不了、但比代码更重要的三件事：
#   1) 只能用**你本人**的录像，别人的素材涉及肖像权
#   2) 循环播放不等于真人值守，还是要开麦隔几分钟说一句
#   3) 用 TTS 合成音就必须在画面显著位置标注"AI 生成"
CAM_DIR = BG_DIR / "cam"
CAM_INDEX = CAM_DIR / "_cam.json"
CAM_VER = {"v": int(time.time())}
# 默认右下角：左下角那块地被"全力以赴 未来可期"（y≈1265~1345）挡着，
# 小窗想放大一点就会压字；右下角只有一行"心有山海 静而不争"（y≈1490~1520），
# 小窗压到它的右端比压住主标语容易接受，而且右边是整块深绿山体，画面干净。
# 尺寸仍然是个硬账：小窗底 58 + 高 H + 间隙 16 + 时钟 44 不能碰到那行字，
# 所以 H 默认 340（480×600 的竖屏视频落到 272×340）。
CAM_DEF = {"on": True, "pos": "br", "w": 440, "h": 340,
           "x": 40, "y": 58, "k": 26, "mirror": False}
CAM_MAX_MB = 200


def _cam_load() -> dict:
    """索引结构：{items:[{id,file,name,ts}], cur:id, opt:{...}}。

    背景库用的是裸 list，这里带 opt，所以是 dict——两套结构别互相套用。
    """
    try:
        d = json.loads(CAM_INDEX.read_text("utf-8"))
        if isinstance(d, dict):
            items = [x for x in (d.get("items") or [])
                     if isinstance(x, dict) and x.get("file")]
            return {"items": items, "cur": str(d.get("cur") or ""),
                    "opt": d.get("opt") or {}}
    except Exception:
        pass
    return {"items": [], "cur": "", "opt": {}}


def _cam_save(d: dict) -> None:
    CAM_DIR.mkdir(parents=True, exist_ok=True)
    try:
        CAM_INDEX.write_text(json.dumps(d, ensure_ascii=False, indent=1), "utf-8")
    except Exception as e:
        log(f"真人小窗索引写入失败: {e}")


def _cam_opt(d: dict) -> dict:
    o = dict(CAM_DEF)
    raw = d.get("opt") or {}
    for k in ("on", "mirror"):
        if k in raw:
            o[k] = bool(raw[k])
    # pos 只能是 bl（左下）或 br（右下），别的值一律当默认
    if raw.get("pos") in ("bl", "br"):
        o["pos"] = raw["pos"]
    for k, lo, hi in (("w", 0, 1080), ("h", 0, 1920), ("x", 0, 900),
                      ("y", 0, 1600), ("k", 0, 120)):
        v = raw.get(k)
        if v is None:
            continue
        try:
            o[k] = max(lo, min(hi, int(float(v))))
        except (TypeError, ValueError):
            pass
    return o


def _cam_state() -> dict:
    d = _cam_load()
    items = d["items"]
    opt = _cam_opt(d)
    cur = d.get("cur") or (items[0]["id"] if items else "")
    if items and not any((it.get("id") or it["file"]) == cur for it in items):
        cur = items[0]["id"]
    out = []
    for it in items:
        iid = it.get("id") or it["file"]
        out.append({"id": iid, "name": it.get("name") or it["file"],
                    "url": f"/overlay/assets/cam/{it['file']}?v={CAM_VER['v']}",
                    "ts": int(it.get("ts") or 0), "cur": iid == cur,
                    "codec": it.get("codec") or "", "note": it.get("note") or ""})
    return {"ok": True, "on": bool(opt["on"]) and bool(out), "count": len(out),
            "items": out, "cur": cur, "opt": opt}


def _video_ext(raw: bytes, name: str = "") -> str:
    """认出容器。容器对了不代表能播——编码是另一回事，见 _video_codec()。"""
    if len(raw) > 12 and raw[4:8] == b"ftyp":
        return ".mp4"                                    # mp4 / m4v / mov 共用一个 box
    if raw[:4] == b"\x1a\x45\xdf\xa3":
        return ".webm"
    ext = Path(name).suffix.lower()
    return ext if ext in (".mp4", ".webm", ".mov", ".m4v") else ""


def _video_codec(raw: bytes) -> str:
    """从 mp4 的 stsd 里认 fourcc。

    手机/剪映导出的竖屏视频大量是 HEVC(H.265)，浏览器内核（尤其直播伴侣的 CEF）
    多数解不了——表现出来就是画面上一个纯黑方块，而且**不报错**，静默失败。
    所以上传时就得认出来、转掉。

    只扫头尾 400KB：moov 要么在头（faststart）要么在尾，扫全文件是为了
    一个 200MB 的视频白读两遍。
    """
    for blob in (raw[:400000], raw[-400000:]):
        for tag, name in ((b"avc1", "h264"), (b"avc3", "h264"),
                          (b"hvc1", "hevc"), (b"hev1", "hevc"),
                          (b"av01", "av1"), (b"vp09", "vp9")):
            if blob.find(tag) >= 0:
                return name
    return ""


def _ffmpeg_path() -> str:
    """config.yaml 的 cam.ffmpeg 优先，其次 PATH，最后几个常见安装位置。"""
    p = str((cfg.get("cam") or {}).get("ffmpeg") or "").strip()
    if p and Path(p).exists():
        return p
    w = shutil.which("ffmpeg")
    if w:
        return w
    for c in (r"G:\cut\zidongship\voice\bin\ffmpeg.exe",
              r"C:\ffmpeg\bin\ffmpeg.exe",
              r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
              r"D:\ffmpeg\bin\ffmpeg.exe"):
        if Path(c).exists():
            return c
    return ""


def _cam_transcode(src: Path, dst: Path) -> bool:
    """转成 H.264 + 去音轨 + faststart。

    小窗最大也就两三百像素宽，降到 720 高、crf 24、ultrafast 足够，
    30 秒的片子几秒就转完。去音轨是因为页面里本来就 muted 播放。
    """
    ff = _ffmpeg_path()
    if not ff:
        return False
    cmd = [ff, "-y", "-hide_banner", "-loglevel", "error",
           "-i", str(src),
           "-vf", "scale='min(720,iw)':-2",
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
           "-pix_fmt", "yuv420p", "-an",
           "-movflags", "+faststart", str(dst)]
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=240)
        return r.returncode == 0 and dst.exists() and dst.stat().st_size > 10000
    except Exception as e:
        log(f"真人视频转码失败: {e}")
        return False


@app.get("/api/cam")
async def cam_get():
    return _cam_state()


@app.post("/api/cam/add")
async def cam_add(req: Request):
    """上传一段真人录像。body = 视频原文件；query: name / filename / pick=1。

    不是 H.264 / VP9 的（典型是手机导出的 HEVC）会先转码——
    直播伴侣的 CEF 解不了 H.265，表现是一个纯黑方块，而且不报错。
    """
    q = req.query_params
    raw = await req.body()
    if len(raw) < 10000:
        return JSONResponse({"ok": False, "error": "没收到视频内容"}, status_code=400)
    if len(raw) > CAM_MAX_MB * 1024 * 1024:
        return JSONResponse({"ok": False,
                             "error": f"视频超过 {CAM_MAX_MB}MB，剪短一点（建议 5~20 秒）"},
                            status_code=400)
    ext = _video_ext(raw, str(q.get("filename") or ""))
    if not ext:
        return JSONResponse({"ok": False, "error": "只认 mp4 / webm / mov（浏览器能直接播的）"},
                            status_code=400)

    name = str(q.get("name") or "").strip()
    if not name:
        name = Path(str(q.get("filename") or "")).stem[:20] or time.strftime("真人%m%d_%H%M%S")
    want_pick = str(q.get("pick") or "0") in ("1", "true", "on", "yes")
    codec = "vp9" if ext == ".webm" else _video_codec(raw)
    need = bool(codec) and codec not in ("h264", "vp9")

    def work() -> dict:
        CAM_DIR.mkdir(parents=True, exist_ok=True)
        fid = time.strftime("cam_%m%d_%H%M%S") + f"_{int(time.time() * 1000) % 1000:03d}"
        note = ""
        if need:
            tmp = CAM_DIR / f"{fid}.src{ext}"
            fp = CAM_DIR / f"{fid}.mp4"
            tmp.write_bytes(raw)
            if _cam_transcode(tmp, fp):
                try:
                    tmp.unlink()
                except OSError:
                    pass
                note = f"源是 {codec.upper()}，已自动转成 H.264"
                log(f"真人视频转码 {codec} -> h264，{len(raw) / 1048576:.1f}MB -> "
                    f"{fp.stat().st_size / 1048576:.1f}MB")
            else:
                # 转不了就原样留着，至少不丢东西。前端会黑一块，后台能看到这条说明。
                fp = CAM_DIR / f"{fid}{ext}"
                tmp.replace(fp)
                note = f"源是 {codec.upper()}，这台机器转不了码（没有可用的 ffmpeg），多半播不出来"
        else:
            fp = CAM_DIR / f"{fid}{ext}"
            fp.write_bytes(raw)
            if not codec:
                note = "认不出编码，播不出来就换成 H.264 的 mp4"

        d = _cam_load()
        d["items"].append({"id": fid, "file": fp.name, "name": name,
                           "ts": int(time.time()), "codec": codec, "note": note})
        if want_pick or not d.get("cur"):
            d["cur"] = fid
        _cam_save(d)
        return {"id": fid, "note": note, "codec": codec}

    try:
        made = await asyncio.to_thread(work)
    except Exception as e:
        log(f"真人视频入库失败: {e}")
        return JSONResponse({"ok": False, "error": f"保存失败: {e}"}, status_code=500)

    CAM_VER["v"] = int(time.time() * 1000)
    log(f"后台上传真人视频「{name}」（{len(raw) / 1048576:.1f}MB），"
        f"共 {len(_cam_load()['items'])} 段")
    st = _cam_state()
    st["note"] = made.get("note") or ""
    await bus.emit("cam", st)
    return st


@app.post("/api/cam/pick")
async def cam_pick(req: Request):
    d = await _json_body(req)
    cid = str(d.get("id") or req.query_params.get("id") or "").strip()
    cur = _cam_load()
    if not any((it.get("id") or it["file"]) == cid for it in cur["items"]):
        return JSONResponse({"ok": False, "error": "没找到这段视频"}, status_code=404)
    cur["cur"] = cid
    _cam_save(cur)
    CAM_VER["v"] = int(time.time() * 1000)
    st = _cam_state()
    await bus.emit("cam", st)
    return st


@app.post("/api/cam/remove")
async def cam_remove(req: Request):
    d = await _json_body(req)
    cid = str(d.get("id") or req.query_params.get("id") or "").strip()
    cur = _cam_load()
    idx = next((k for k, it in enumerate(cur["items"])
                if (it.get("id") or it["file"]) == cid), -1)
    if idx < 0:
        return JSONResponse({"ok": False, "error": "没找到这段视频"}, status_code=404)
    it = cur["items"].pop(idx)
    try:
        (CAM_DIR / it["file"]).unlink()
    except OSError:
        pass
    if cur.get("cur") == cid:
        cur["cur"] = cur["items"][0]["id"] if cur["items"] else ""
    _cam_save(cur)
    CAM_VER["v"] = int(time.time() * 1000)
    log(f"后台删除真人视频「{it.get('name') or it['file']}」，还剩 {len(cur['items'])} 段")
    st = _cam_state()
    await bus.emit("cam", st)
    return st


@app.post("/api/cam/fix")
async def cam_fix():
    """把库里所有不是 H.264 / VP9 的段转一遍。

    上传时会自动转，这个接口是给"自动转码上线之前传进来的 HEVC"补的——
    不用重新传一遍文件。转完把索引里的 file / codec 一起改掉，并清掉源文件。
    """
    def work() -> list[str]:
        d = _cam_load()
        done = []
        for it in d["items"]:
            if (it.get("codec") or "") in ("h264", "vp9"):
                continue
            src = CAM_DIR / it["file"]
            if not src.exists():
                continue
            fid = time.strftime("cam_%m%d_%H%M%S") + f"_{int(time.time() * 1000) % 1000:03d}"
            dst = CAM_DIR / f"{fid}.mp4"
            if not _cam_transcode(src, dst):
                it["note"] = "转码失败（没有可用的 ffmpeg）"
                continue
            old_id = it.get("id") or it["file"]
            try:
                src.unlink()
            except OSError:
                pass
            it["file"] = dst.name
            it["id"] = fid
            it["codec"] = "h264"
            it["note"] = "已转码为 H.264"
            if d.get("cur") == old_id:
                d["cur"] = fid
            done.append(it.get("name") or dst.name)
        _cam_save(d)
        return done

    done = await asyncio.to_thread(work)
    CAM_VER["v"] = int(time.time() * 1000)
    log(f"真人视频转码：{('、'.join(done)) if done else '没有需要转的'}")
    st = _cam_state()
    st["fixed"] = done
    await bus.emit("cam", st)
    return st


@app.post("/api/cam/opt")
async def cam_opt(req: Request):
    """显示开关 / 位置（左下·右下）/ 最大宽高 / 边距 / 圆角 / 镜像。

    x 的语义跟着 pos 走：右下时是"离右边多远"，左下时是"离左边多远"。
    """
    d = await _json_body(req)
    cur = _cam_load()
    opt = dict(cur.get("opt") or {})
    for k in ("on", "mirror", "pos", "w", "h", "x", "y", "k"):
        if k in d:
            opt[k] = d[k]
    cur["opt"] = opt
    _cam_save(cur)
    o = _cam_opt(cur)
    log(f"真人小窗：{'开' if o['on'] else '关'}"
        f"（{'右下' if o['pos'] == 'br' else '左下'}，最大 {o['w']}×{o['h']}，"
        f"边距 {o['x']},{o['y']}）")
    st = _cam_state()
    await bus.emit("cam", st)
    return st


@app.post("/api/library/upload")
async def library_upload(req: Request):
    """上传一张成图，塞进空场轮播。原图直接放请求体，名字走 query。"""
    q = req.query_params
    name = str(q.get("name") or "").strip()
    if not name:
        name = Path(str(q.get("filename") or "")).stem or "素材"
    raw = await req.body()
    if len(raw) < 200:
        return JSONResponse({"ok": False, "error": "没收到图片内容"}, status_code=400)
    item = await asyncio.to_thread(lib.add, raw, name)
    if not item:
        return JSONResponse({"ok": False, "error": "这张图里认不出字迹（要整张海报或白底字）"},
                            status_code=400)
    log(f"后台上传素材「{item['name']}」，素材库 {len(lib.items)} 张")
    await bus.emit("queue", queue_view())
    return {"ok": True, "count": len(lib.items),
            "item": {"stem": item["stem"], "name": item["name"]}}


@app.post("/api/library/delete")
async def library_delete(req: Request):
    d = await _json_body(req)
    stem = str(d.get("stem") or req.query_params.get("stem") or "").strip()
    ok = await asyncio.to_thread(lib.remove, stem)
    if not ok:
        return JSONResponse({"ok": False, "error": "没找到这张图"}, status_code=404)
    log(f"后台删除素材 {stem}，素材库 {len(lib.items)} 张")
    await bus.emit("queue", queue_view())
    return {"ok": True, "count": len(lib.items)}


# ------------------------------------------------------------ 一键生成空场素材
# 空场有三层：素材库（播现成成图）-> 虚拟名字池（本地楷体起头）-> 什么都没有。
# 素材库被清空之后，空场就掉到第二层，写出来是**楷体**——和你在后台选的
# 马善政 + 烫金完全不是一回事。所以这里给一个"按当前样式批量补货"的入口：
# 拿虚拟名字池里的名字，走**和真人单同一条**出图链路（sdcn/doubao），
# 生成的成图直接落进 data/signatures，素材库一扫就回来。
LIBGEN = {"running": False, "done": 0, "total": 0, "failed": 0, "name": ""}
_LIBGEN_TASK: asyncio.Task | None = None


def _lib_stem(name: str, seq: int) -> str:
    """文件名要能被 library.STEM_RE 认出名字：
    `ai_月日_时分秒_b序号_名字`（正则只认这个形状）。"""
    safe = "".join(ch for ch in name if ch.isalnum())[:12] or "sig"
    return f"ai_{time.strftime('%m%d_%H%M%S')}_b{seq}_{safe}"


def _make_library_item(name: str, art: dict, seq: int) -> bool:
    """把一份出图结果落成素材库认的那一对文件（_glyph.png + _full.jpg）。"""
    stem = _lib_stem(name, seq)
    glyph_dst = DATA / "signatures" / f"{stem}_glyph.png"
    full_dst = DATA / "signatures" / f"{stem}_full.jpg"
    try:
        shutil.copyfile(art["glyph"], glyph_dst)
    except Exception as e:
        log(f"素材生成：拷贝笔迹失败 {e}")
        return False
    if not wordsheet.compose(BG_CLEAN, glyph_dst, art["box"], full_dst):
        return False
    return True


def _gen_one(provider: str, name: str) -> dict | None:
    """按当前 provider 出一张图。只在后台线程里调。"""
    if provider == "sdcn":
        got = sdcn.batch([name], dict(SIG.get("sdcn") or {}))
    elif provider == "doubao":
        got = doubaoweb.batch([name], dict(SIG.get("doubao") or {}))
    else:
        return None
    return got[0] if got else None


async def _gen_library(names: list[str], provider: str) -> None:
    LIBGEN.update(running=True, done=0, total=len(names), failed=0, name="")
    made = 0
    try:
        for nm in names:
            LIBGEN["name"] = nm
            try:
                art = await asyncio.to_thread(_gen_one, provider, nm)
                if not art or not art.get("glyph"):
                    LIBGEN["failed"] += 1
                elif await asyncio.to_thread(_make_library_item, nm, art, made + 1):
                    made += 1
                else:
                    LIBGEN["failed"] += 1
            except Exception as e:
                LIBGEN["failed"] += 1
                log(f"素材生成「{nm}」失败({type(e).__name__}: {e})")
            LIBGEN["done"] += 1
            await asyncio.sleep(0)          # 让出事件循环，别卡住直播
        log(f"空场素材生成完成：成功 {made} 张，失败 {LIBGEN['failed']} 张")
    finally:
        LIBGEN.update(running=False, name="")
        await asyncio.to_thread(lib.refresh, True)
        await bus.emit("queue", queue_view())


@app.post("/api/library/generate")
async def library_generate(req: Request):
    """按当前字体/材质，用虚拟名字池批量生成空场素材。

    body: {"count": 20, "names": ["张三", ...]}   names 可选，默认用 virtual.names
    """
    global _LIBGEN_TASK
    if LIBGEN["running"]:
        return JSONResponse({"ok": False, "error": "已经在生成了，等这批跑完"},
                            status_code=409)
    d = await _json_body(req)
    provider = str(SIG.get("provider") or "local").lower()
    if provider not in ("sdcn", "doubao"):
        return JSONResponse(
            {"ok": False, "error": f"provider={provider} 出不了图，"
                                   f"先把签名样式切到 sdcn 或 doubao"}, status_code=400)

    pool = d.get("names") or list(virtual.names)
    pool = [str(n).strip() for n in pool if str(n).strip()]
    if not pool:
        return JSONResponse({"ok": False, "error": "名字池是空的"}, status_code=400)
    n = max(1, min(60, int(d.get("count") or len(pool))))
    # 名字池不够就循环取，别只生成 3 张
    names = [pool[i % len(pool)] for i in range(n)]

    _LIBGEN_TASK = asyncio.create_task(_gen_library(names, provider))
    log(f"开始生成空场素材：{n} 张（{provider}）")
    return {"ok": True, "started": n, "provider": provider,
            "note": "在后台跑，进度看 pics 计数或日志"}


@app.websocket("/ws/overlay")
async def ws_overlay(ws: WebSocket):
    await ws.accept()
    await bus.register(ws)
    await ws.send_text(json.dumps({"type": "hello", "payload": queue_view()},
                                  ensure_ascii=False))
    if CURRENT:
        payload, started, dur = CURRENT
        if time.time() - started < dur + 8:
            await ws.send_text(json.dumps({"type": "draw_start", "payload": payload},
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
            elif msg.get("type") == "voice_ack":
                # overlay 回报这句祝福到底有没有播出来。成功记一行，失败记明原因——
                # "画面正常但没声音"以前是静默的，现场没法定位。
                v = msg.get("payload") or {}
                if v.get("ok"):
                    log(f"overlay 语音已播 {v.get('ms') or '?'}ms")
                else:
                    log(f"overlay 语音播放失败 {v.get('err')}"
                        f"{(': ' + str(v.get('msg'))) if v.get('msg') else ''}")
            elif msg.get("type") == "ping":
                await ws.send_text('{"type":"pong","payload":{}}')
    except WebSocketDisconnect:
        pass
    finally:
        await bus.unregister(ws)


if __name__ == "__main__":
    s = cfg["server"]
    uvicorn.run("app.main:app", host=s["host"], port=int(s["port"]), reload=False)
