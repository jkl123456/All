"""给每个名字配一句祝福语音，和运笔同步播出来。

链路：

    名字 + 档位 → 祝福文案（AI 写一句，失败退回模板）
               → 合成音频：edge-tts 优先（免费、不要 key，一句 1.5 秒）
                           连不上退 Windows 自带语音（离线，音质差一档）
               → ffprobe / wave 量出真实时长
               → payload 带 voice_url / voice_ms / voice_text
               → overlay 在运笔开始那一刻播放，写完同时收声

为什么时长要量出来：presenter 会把运笔时长对齐到语音（`fit_duration`），
这样"说完"和"写完"基本同时发生——不会写完了还在念，也不会念完了干等。

为什么要两条合成引擎：edge-tts 走 speech.platform.bing.com，国内网络经常直接
RST（DNS 正常、TCP 被拒）。只有一条路的话，这个功能在国内基本等于没有。
SAPI 那档音质一般，但它是离线的，一定能出声。

三条容错，都是按"直播不能停"来的：

* **文案**：缓存落盘（data/voice/texts.json），同一个名字永远同一句——
  既能命中音频缓存不再联网，也不会让观众听出"每次都是随机抽的"。
* **合成**：音频按 voice|rate|volume|text 哈希落盘，重播 0 成本。
* **失败**：任何一步炸了都只是没声音，payload 里没有 voice_url，写字照旧。
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import math
import os
import random
import re
import shutil
import subprocess
import threading
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor
from concurrent.futures import wait as fut_wait
from pathlib import Path

import httpx

from .config import ROOT

DIR = ROOT / "data" / "voice"
TEXTS = DIR / "texts.json"
_FFPROBE = (shutil.which("ffprobe")
            or r"G:\cut\zidongship\voice\bin\ffprobe.exe")

# 普通弹幕的祝福：20~26 字，Xiaoxiao +8% 大约 5~6 秒，正好覆盖 6 秒的素签运笔。
PLAIN = [
    "{n}，愿你今天所求皆如愿，所行皆坦途。",
    "{n}，新的一天，好运一直跟着你。",
    "{n}，愿你眼里有光，心中有暖，事事顺意。",
    "{n}，祝你今天所有的期待都刚好实现。",
    "{n}，愿你被这世界温柔以待，平安喜乐。",
    "{n}，愿你往后的日子，步步生花，年年有余。",
    "{n}，今天也要开开心心，顺顺利利。",
    "{n}，愿你的努力都有回响，日子越过越甜。",
    "{n}，愿你天黑有灯，下雨有伞，一路有人相伴。",
    "{n}，祝你前程似锦，未来可期。",
    "{n}，愿你心里想的事，慢慢都变成真的。",
    "{n}，愿你今天顺顺利利，明天也顺顺利利。",
    "{n}，愿你所遇皆是善意，所行皆是坦途。",
    "{n}，愿你身边常有人惦记，日子过得热气腾腾。",
]

# 礼物的祝福更长一点：礼签写得久（9~13 秒），多几秒不至于念完就静音。
GIFT = [
    "{n}，谢谢你的心意，愿你今年财源广进，好事一件接着一件。",
    "{n}，愿你事业顺利，家人安康，想要的都能慢慢得到。",
    "{n}，愿你往后每一步都走得踏实，每一天都过得值得。",
    "{n}，愿你所求皆有回应，所盼皆能如愿，岁岁平安。",
    "{n}，谢谢你的支持，愿好运常伴你左右，日子红红火火。",
]

# 后台下拉框用（id 必须和 edge-tts 的 voice 名一致）
VOICES = [
    {"id": "zh-CN-XiaoxiaoNeural", "label": "晓晓 · 女声温柔（默认）"},
    {"id": "zh-CN-XiaoyiNeural", "label": "晓伊 · 女声活泼"},
    {"id": "zh-CN-YunxiNeural", "label": "云希 · 男声年轻"},
    {"id": "zh-CN-YunjianNeural", "label": "云健 · 男声浑厚"},
    {"id": "zh-CN-YunyangNeural", "label": "云扬 · 男声播报"},
    {"id": "zh-CN-liaoning-XiaobeiNeural", "label": "晓北 · 女声东北"},
]

# AI 写文案的提示词。要点全在"能直接念"：短、口语、别堆四字词。
SYSTEM = (
    "你在给一个手写签名的直播间写祝福语。观众发来一个名字（可能是真名、网名或英文名），"
    "这句话会被配音念出来，同一时刻屏幕上正在一笔一划写这个名字。\n"
    "要求：\n"
    "1. 只写一句话，16~26 个汉字，绝对不超过 26 个字；\n"
    "2. 开头直接用这个名字称呼，后面接祝福内容，名字只出现一次；\n"
    "3. 口语、温暖、具体，像主播亲口说的，不要堆四字成语，不要喊口号；\n"
    "4. 不要引号、括号、表情符号、序号，不要换行；\n"
    "5. 不要提直播、签名、主播、屏幕这些字眼，就当是单独送给这个人的祝福。\n"
    "直接输出这句话本身，不要任何解释。"
)

_lock = threading.Lock()
_rot = -1                          # pick: rotate 的轮播指针（进程内，重启归零）
_cache: dict[str, dict] = {}       # 音色|语速|音量|文案 -> {path, ms, text}
_texts: dict[str, str] | None = None   # "kind|name" -> 文案（落盘，跨重启）


def enabled(conf: dict | None) -> bool:
    return bool((conf or {}).get("enabled"))


# ---------------------------------------------------------------- 文案
def _load_texts() -> dict[str, str]:
    """文案缓存：读过一次就留在内存，进程内不再碰磁盘。"""
    global _texts
    if _texts is None:
        try:
            _texts = json.loads(TEXTS.read_text(encoding="utf-8"))
            if not isinstance(_texts, dict):
                _texts = {}
        except Exception:
            _texts = {}
    return _texts


def _save_texts(key: str, text: str) -> None:
    """写文案缓存。失败无所谓（下次再问一次 AI），所以不抛。"""
    d = _load_texts()
    d[key] = text
    try:
        DIR.mkdir(parents=True, exist_ok=True)
        # 只留最近 800 条：挂一个月能攒几千个名字，文件别无限长
        if len(d) > 800:
            for k in list(d)[: len(d) - 800]:
                d.pop(k, None)
        TEXTS.write_text(json.dumps(d, ensure_ascii=False, indent=0),
                         encoding="utf-8")
    except Exception:
        pass


def _trim(text: str, limit: int) -> str:
    """超长就断在最后一个标点，别把话切成半截。"""
    if len(text) <= limit:
        return text
    head = text[:limit]
    cut = max(head.rfind(c) for c in "，。！？；、,.!?;")
    return (head[:cut] if cut >= limit // 2 else head).rstrip("，、,;；")


def _tidy(t: str, name: str) -> str:
    """把模型爱带的包装去掉：换行、引号、markdown 星号、"好的"这种前言。"""
    t = re.sub(r"[\r\n]+", " ", str(t or "")).strip()
    t = re.sub(r"^```.*?```$", "", t).strip()
    t = t.strip(" \t\"'“”‘’《》「」【】")
    t = re.sub(r"[*#`]+", "", t)
    t = re.sub(r"^(好的|可以|这句|祝福语)[:：,，\s]*", "", t)
    if name not in t:
        t = f"{name}，{t}"
    return t.strip()


def _template(name: str, conf: dict, kind: str) -> str:
    custom = conf.get("gift_templates" if kind == "gift" else "templates")
    pool = [str(x) for x in custom] if custom else (GIFT if kind == "gift" else PLAIN)
    pick = str(conf.get("pick") or "stable")
    # stable：按名字定死一句。同一个名字永远同一句，缓存必命中。
    #   缺点：只有 10 句时按 md5 取模会撞车，两个相邻观众可能听到一模一样的话。
    # rotate：按顺序轮播。相邻订单一定不重句，观众听不出"就那几句"。
    #   名字→句子的对应关系不再固定，但文案本来就落盘缓存，同一场直播里
    #   同一个人重写一次仍是同一句（缓存命中，不会换词）。
    if pick == "rotate":
        with _lock:
            global _rot
            _rot = (_rot + 1) % max(1, len(pool))
            idx = _rot
        return pool[idx].format(n=name)
    if pick == "random":
        return random.choice(pool).format(n=name)
    h = int(hashlib.md5(f"{kind}|{name}".encode()).hexdigest()[:8], 16)
    return pool[h % len(pool)].format(n=name)


def _ai_text(name: str, kind: str, conf: dict) -> str:
    """让 AI 现写一句。返回空串 = 没配 key / 调不通，调用方退回模板。"""
    ai = dict(conf.get("ai") or {})
    key = str(ai.get("api_key") or conf.get("api_key") or "")
    if not key:
        return ""
    base = str(ai.get("base_url") or conf.get("base_url")
               or "https://api.deepseek.com/v1").rstrip("/")
    model = str(ai.get("model") or "deepseek-flash")
    limit = int(conf.get("max_chars") or 26)
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content":
                f"名字：{name}\n档位：{'送礼观众，可以更热情一点' if kind == 'gift' else '普通观众'}"},
        ],
        # 祝福语要的是"人味"，temperature 低会写出模板腔；但太高又爱跑偏
        "temperature": 1.0,
        "max_tokens": 300,
    }
    t0 = time.time()
    try:
        with httpx.Client(timeout=float(ai.get("timeout") or 6.0)) as c:
            r = c.post(f"{base}/chat/completions", json=body,
                       headers={"Authorization": f"Bearer {key}"})
            if r.status_code >= 400:
                raise RuntimeError(f"HTTP {r.status_code}: {r.text[:100]}")
            msg = ((r.json().get("choices") or [{}])[0].get("message") or {})
        t = _trim(_tidy(msg.get("content") or "", name), limit)
    except Exception as e:
        print(f"[voice] 「{name}」AI 文案失败({type(e).__name__}: {str(e)[:60]})，"
              f"用模板", flush=True)
        return ""
    if len(t) < 6 or name not in t:      # 空话/不认名字：宁可走模板
        return ""
    print(f"[voice] 「{name}」AI 文案 {len(t)} 字 / {(time.time() - t0) * 1000:.0f}ms",
          flush=True)
    return t


def say_text(name: str, conf: dict, kind: str = "plain") -> str:
    """定文案。顺序：落盘缓存 → AI 现写 → 模板。永远有结果。"""
    key = f"{kind}|{name}"
    d = _load_texts()
    hit = d.get(key)
    if hit:
        return hit
    text = ""
    if str(conf.get("source") or "ai").lower() == "ai":
        text = _ai_text(name, kind, conf)
    text = text or _template(name, conf, kind)
    _save_texts(key, text)
    return text


# ---------------------------------------------------------------- 合成
def _probe_ms(path: Path) -> int:
    """真实时长（毫秒）。ffprobe 不在就返回 0，由调用方估算。"""
    try:
        r = subprocess.run(
            [_FFPROBE, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", str(path)],
            capture_output=True, text=True, timeout=8)
        return max(0, int(float((r.stdout or "0").strip()) * 1000))
    except Exception:
        return 0


def _estimate_ms(text: str, rate: str) -> int:
    """ffprobe 不可用时的兜底：中文约 220ms/字，再按语速折算。"""
    try:
        speed = 1.0 + float(str(rate).replace("%", "").replace("+", "")) / 100.0
    except ValueError:
        speed = 1.0
    chars = sum(1 for ch in text if ch.strip())
    return int(chars * 220 / max(0.5, speed))


async def _edge(text: str, voice: str, rate: str, volume: str,
                out: Path, proxy: str = "") -> None:
    import edge_tts

    # proxy 要显式传：edge-tts 里 ws_connect(proxy=None) 会盖掉 trust_env，
    # 于是"系统代理设了也没用"，在这台机器上就是连不上 bing 的那个坑。
    c = edge_tts.Communicate(text, voice, rate=rate, volume=volume,
                             proxy=proxy or None)
    await c.save(str(out))


def _sapi(text: str, rate: str, out: Path) -> None:
    """Windows 自带语音（完全离线）：edge-tts 连不上时的兜底。

    音质比晓晓差一档，但国内网络连 speech.platform.bing.com 经常直接被 RST，
    直播里"有声音"比"没声音"重要得多。
    """
    ps = shutil.which("powershell") or "powershell"
    script = ROOT / "app" / "sapi_say.ps1"
    txt = out.with_suffix(".txt")
    txt.write_text(text, encoding="utf-8")
    try:                       # '+8%' → SAPI 的 -10~10 档（每档约 1.2 倍）
        speed = 1.0 + float(str(rate).replace("%", "").replace("+", "")) / 100.0
    except ValueError:
        speed = 1.0
    step = max(-10, min(10, int(round(math.log(max(0.2, speed)) / math.log(1.2)))))
    # 中文 SAPI 音色（Huihui）天生比晓晓慢一档（约 300ms/字 vs 220ms/字），
    # 补一档（≈+20%）听着才不拖拉；这个补偿只对兜底引擎生效。
    step = max(-10, min(10, step + 1))
    flags = 0x08000000 if os.name == "nt" else 0   # CREATE_NO_WINDOW：别闪黑框
    try:
        r = subprocess.run(
            [ps, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script),
             "-TextPath", str(txt), "-OutPath", str(out), "-Rate", str(step)],
            capture_output=True, text=True, timeout=40, creationflags=flags)
        if r.returncode != 0 or not out.exists():
            raise RuntimeError((r.stderr or r.stdout or "sapi 失败").strip()[:100])
    finally:
        txt.unlink(missing_ok=True)      # 文本只在合成那一瞬间有用，别攒一地


def _wav_ms(path: Path) -> int:
    """WAV 的时长读文件头就知道，不用 ffprobe。"""
    try:
        import wave

        with wave.open(str(path), "rb") as w:
            return int(w.getnframes() / max(1, w.getframerate()) * 1000)
    except Exception:
        return 0


# edge-tts 连续失败几次就先别试了：每次都要等连接超时/被 RST，白耽误时间。
# 冷却 10 分钟后自动再试一次（网络可能恢复了），期间全走 SAPI。
_edge_fail = 0
_edge_down_until = 0.0

# 合成线程池。edge 慢的时候要**同时**再起一个 SAPI，两个都得在后台跑着等，
# 所以不能用调用方那一个线程。4 个足够：一批最多 5 单并发配音，多出来的排队。
_POOL = ThreadPoolExecutor(max_workers=6, thread_name_prefix="voice-tx")


def _edge_ready() -> bool:
    return _edge_fail < 3 or time.time() >= _edge_down_until


def _bump_edge_fail() -> None:
    """edge 这条路失败一次。连续 3 次就冷却 10 分钟，全部改走系统语音。"""
    global _edge_fail, _edge_down_until
    _edge_fail += 1
    if _edge_fail >= 3:
        _edge_down_until = time.time() + 600
        print(f"[voice] edge-tts 连续 {_edge_fail} 次失败，"
              f"10 分钟内改走系统语音（SAPI）", flush=True)


def _good(p: Path, min_size: int = 1024) -> bool:
    """文件算不算"合成好了"。

    门槛不是 0 字节而是 1KB：edge-tts 是边收边写的，连接中途断掉会留下
    一个**能打开但内容是断的** mp3。这种残file一旦被当成缓存，下次直接播
    半句就没了——比没声音更难查。
    """
    try:
        return p.exists() and p.stat().st_size >= min_size
    except OSError:
        return False


def _render(text: str, conf: dict, key: str) -> tuple[Path, int]:
    """合成音频，返回 (文件, 毫秒)。

    engine: auto = 先 edge，**edge 慢就同时叫 SAPI，谁先好谁用**。

    为什么要"对冲"而不是"超时就放弃"：实测 edge-tts 正常 2~3 秒，
    但网络抖一下能到 9 秒；而 SAPI 是离线的、0.7 秒就出结果。
    以前是干等 8 秒然后整句没声音，现在 5 秒还没动静就并肩跑 SAPI，
    6 秒内必定有一句能播——代价只是那一句换了个音色。

    时间预算 max_wait 秒（由调用方给），真超了抛 TimeoutError：这单不出声，
    但后台线程还会跑完把文件落盘，下次同名秒过。
    """
    engine = str(conf.get("engine") or "auto").lower()
    voice = str(conf.get("voice") or "zh-CN-XiaoxiaoNeural")
    rate = str(conf.get("rate") or "+8%")
    volume = str(conf.get("volume") or "+0%")
    proxy = str(conf.get("proxy") or os.environ.get("VOICE_PROXY") or "")
    budget = float(conf.get("max_wait") or 10)
    # hedge_after 设 0（或 >= budget）= 对冲关掉，退回"干等到超时就放弃"的老行为
    raw_hedge = conf.get("hedge_after")
    hedge = budget if raw_hedge is None else max(0.0, float(raw_hedge))
    hedge = min(hedge, budget)
    edge_to = float(conf.get("edge_timeout") or 15)
    errs: list[str] = []

    # ---- 两个引擎各自一个"任务"：命中磁盘缓存就直接返回，不用联网 ----
    def edge_job() -> tuple[Path, int]:
        out = DIR / f"{key}.mp3"
        if _good(out):
            return out, (_probe_ms(out) or _estimate_ms(text, rate))
        try:
            asyncio.run(asyncio.wait_for(
                _edge(text, voice, rate, volume, out, proxy), edge_to))
        except BaseException:
            # 残缺 mp3 一定要删：留着下次会被当缓存播出来，而且听不出是坏的
            out.unlink(missing_ok=True)
            raise
        if not _good(out):
            raise RuntimeError("edge 没写出文件")
        return out, (_probe_ms(out) or _estimate_ms(text, rate))

    def sapi_job() -> tuple[Path, int]:
        out = DIR / f"{key}.wav"
        if _good(out, 4096):
            return out, (_wav_ms(out) or _estimate_ms(text, rate))
        try:
            _sapi(text, rate, out)
        except BaseException:
            out.unlink(missing_ok=True)
            raise
        if not _good(out, 4096):
            raise RuntimeError("sapi 没写出文件")
        return out, (_wav_ms(out) or _estimate_ms(text, rate))

    def take_edge(f) -> tuple[Path, int]:
        """edge 成功 → 清零失败计数；失败 → 记账后原样抛出。"""
        global _edge_fail
        try:
            r = f.result()
        except Exception:
            _bump_edge_fail()
            raise
        _edge_fail = 0
        return r

    # ---- 先看磁盘（同一句第二次起完全不联网） ----
    if engine in ("auto", "edge"):
        p = DIR / f"{key}.mp3"
        if _good(p):
            return p, (_probe_ms(p) or _estimate_ms(text, rate))
    if engine in ("auto", "sapi"):
        p = DIR / f"{key}.wav"
        if _good(p, 4096):
            return p, (_wav_ms(p) or _estimate_ms(text, rate))

    deadline = time.time() + budget
    use_edge = engine in ("auto", "edge") and _edge_ready()
    use_sapi = engine in ("auto", "sapi")

    fe = None
    if use_edge:
        fe = _POOL.submit(edge_job)
        # auto 下先只给 edge hedge 秒；engine=edge 就只能给满预算
        span = hedge if use_sapi else budget
        done, _ = fut_wait({fe}, timeout=max(0.0, min(span, budget)))
        if fe in done:
            try:
                return take_edge(fe)
            except Exception as e:
                errs.append(f"edge:{type(e).__name__}")
                fe = None                 # 已经失败了，别再等它
        elif not use_sapi:
            raise TimeoutError(f"edge {span:.0f}s 内没出结果")

    if not use_sapi:
        raise RuntimeError("、".join(errs) or "没有可用的合成引擎")

    # ---- edge 慢（或已失败）：SAPI 上，谁先好谁用 ----
    fs = _POOL.submit(sapi_job)
    waitset = {fs} if fe is None else {fs, fe}
    while waitset:
        done, waitset = fut_wait(waitset, timeout=max(0.0, deadline - time.time()),
                                 return_when=FIRST_COMPLETED)
        if not done:
            break
        for f in done:
            try:
                return take_edge(f) if f is fe else f.result()
            except Exception as e:
                errs.append(f"{'edge' if f is fe else 'sapi'}:{type(e).__name__}")

    raise TimeoutError("、".join(errs) or "合成超时")



def say(name: str, conf: dict, kind: str = "plain") -> dict | None:
    """合成一句祝福，返回 {url, ms, text}；失败返回 None（这单不出声）。

    同步函数，调用方放在 `asyncio.to_thread` 里跑——edge-tts 是异步的，
    这里用 asyncio.run 起一个临时循环，别在事件循环线程里直接调。
    """
    name = (name or "").strip()
    if not name:
        return None
    voice = str(conf.get("voice") or "zh-CN-XiaoxiaoNeural")
    rate = str(conf.get("rate") or "+8%")
    volume = str(conf.get("volume") or "+0%")
    text = say_text(name, conf, kind)
    key = hashlib.md5(f"{voice}|{rate}|{volume}|{text}".encode()).hexdigest()[:16]

    with _lock:
        hit = _cache.get(key)
    if hit and Path(hit["path"]).exists():
        p = Path(hit["path"])
        # 对冲时可能先用 SAPI 的 wav 顶上，而 edge 的 mp3 是几秒后才落盘的。
        # 只要 mp3 在就换成它——同一个名字在整场里应该是同一个音色，
        # 不能"第一次是机器音、第二次又变回晓晓"。
        mp3 = DIR / f"{key}.mp3"
        if p.suffix != ".mp3" and _good(mp3):
            ms = _probe_ms(mp3) or hit["ms"]
            with _lock:
                _cache[key] = {"path": str(mp3), "ms": ms, "text": hit["text"]}
            return {"url": f"/data/voice/{mp3.name}", "ms": ms,
                    "text": hit["text"]}
        return {"url": f"/data/voice/{p.name}",
                "ms": hit["ms"], "text": hit["text"]}

    t0 = time.time()
    try:
        DIR.mkdir(parents=True, exist_ok=True)
        out, ms = _render(text, conf, key)
        info = {"path": str(out), "ms": ms, "text": text}
        with _lock:
            _cache[key] = info
        print(f"[voice] 「{name}」{text[:16]}… {ms}ms / {out.suffix[1:]} "
              f"{time.time() - t0:.2f}s", flush=True)
        return {"url": f"/data/voice/{out.name}", "ms": ms, "text": text}
    except Exception as e:
        print(f"[voice] 「{name}」合成失败({type(e).__name__}: {str(e)[:70]})，"
              f"这单不出声", flush=True)
        return None


def fit_duration(tier_ms: int, voice_ms: int, conf: dict | None = None) -> int:
    """把运笔时长对齐到这句语音：**写完的那一刻，话也正好说完**。

    * 语音比档位短（4 秒的话配 13 秒的尊签）：不动。字慢慢写更贵重，
      早念完就早安静，没人会觉得不对。
    * 语音更长：把运笔拉长到 voice + tail。否则会出现"字写完了还在念，
      而且念到一半画面已经切下一位"。

    上限 max_seconds（默认 20 秒）：AI 偶尔会写出很长的句子，
    不能让一句祝福把一单拖成半分钟（队列会积压）。
    """
    if voice_ms <= 0:
        return tier_ms
    conf = conf or {}
    tail = int(float(conf.get("tail") or 0.25) * 1000)
    cap = int(float(conf.get("max_seconds") or 20) * 1000)
    return max(tier_ms, min(voice_ms + tail, cap))


def warmup(conf: dict | None = None) -> None:
    """开播前**真跑一次** edge-tts，把首次开销花在开播前。

    edge-tts 的第一次请求要 import aiohttp、建 TLS，实测 3~10 秒；
    之后每句 1.7~3.4 秒。这笔钱必须花在启动时，不能花在第一位观众身上。

    两个必须注意的点（都是踩过的）：

    * **不能跟着 engine=auto 走**。data/voice 里只要有一个陈旧的 `你好.wav`
      （上次 edge 连不上时 SAPI 兜底留下的），_render 会直接命中缓存、
      0 秒返回，edge 一次都没碰——于是"预热完成"是假的，第一位真实观众
      成了那个付出 9 秒代价的人。
    * **key 必须每次不同**，否则上一次预热留下的 mp3 同样会让这次变成 0 秒。
      探测文件用完就删，不留垃圾。
    """
    conf = conf or {}
    if not enabled(conf):
        return
    text = "你好"
    key = hashlib.md5(f"warmup|{conf.get('voice')}|{conf.get('rate')}"
                      f"|{time.time()}".encode()).hexdigest()[:16]
    try:
        DIR.mkdir(parents=True, exist_ok=True)
        t0 = time.time()
        live = ""
        for eng in ("edge", "sapi"):
            try:
                # max_wait 给足：预热不占队列，慢一点没关系，反正没开播
                out, _ = _render(text, {**conf, "engine": eng, "hedge_after": 0,
                                        "max_wait": 25}, key)
            except Exception as e:
                print(f"[voice] 预热 {eng} 不可用({type(e).__name__})", flush=True)
                continue
            live = out.suffix[1:]
            out.unlink(missing_ok=True)      # 探测文件用完就删，别当缓存留着
            break
        if not live:
            raise RuntimeError("edge / sapi 都不可用")
        print(f"[voice] 预热完成 {time.time() - t0:.1f}s，引擎 {live}"
              f"（之后每句约 1~3 秒）", flush=True)
    except Exception as e:
        print(f"[voice] 预热失败({type(e).__name__}: {str(e)[:70]})——"
              f"这一场可能没有祝福语音", flush=True)


def preview(name: str = "张三", conf: dict | None = None) -> dict | None:
    """后台"试听"用：不占档位，直接回一句现成的音频。"""
    return say(name or "张三", conf or {}, "plain")


def cleanup(days: int = 7) -> int:
    """删掉过期的音频（每单一句，播一晚能攒不少）。返回删了几个。"""
    if days <= 0 or not DIR.exists():
        return 0
    deadline = time.time() - days * 86400
    n = 0
    for p in list(DIR.glob("*.mp3")) + list(DIR.glob("*.wav")) + list(DIR.glob("*.txt")):
        try:
            if p.stat().st_mtime < deadline:
                p.unlink()
                n += 1
        except OSError:
            pass
    return n


def status() -> dict:
    with _lock:
        cached = len(_cache)
    files = len(list(DIR.glob("*.mp3"))) if DIR.exists() else 0
    return {"cached": cached, "files": files, "texts": len(_load_texts())}
