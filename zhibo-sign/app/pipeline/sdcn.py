"""本地扩散模型出图（provider: sdcn）。

## 分工和豆包那条路是反的

豆包：把名字交给模型，让它自己写。写错字的风险由提示词和运气承担。
这里：**字形由字体保证，模型只负责上质感**——

    字体渲染整串名字 -> 白底黑字初始图（字形 100% 正确）
      -> 本地 SD1.5 img2img 低强度去噪，把这张"印刷体"重描成毛笔字
      -> 白底墨迹图 -> 抠成透明笔迹 -> 贴底板 -> 交给 brush.py 反推笔顺

名字是观众的名字，写错就是事故，所以这一步不能交给概率。质感交给模型没问题：
初始图里结构已经写死了，strength ≤ 0.5 时模型只能改边缘、浓淡和笔锋。

为什么不走 ControlNet：魔搭（这台机器唯一连得上的权重源）上没有
`control_v11p_sd15_lineart`。而且 img2img 是"从这张图开始改"，比"让模型别乱画"
更直接——省 1.4G 下载、省显存，结构保真度还更高。详见 scripts/sdcn_server.py。

## 三个关键决定

1. **一人一张，绝不拼竖排。** SD1.5 的高分辨率已经会重复/崩坏字形，
   让它一次写 5 行是主动请它出错。一人一张 768~1024 宽，回来自己排版，
   豆包那条 BATCH_PROMPT 里"别说横排""别加序号"的三大坑这里根本不存在。
2. **走 HTTP，不 import torch。** 推理在 scripts/sdcn_server.py 里跑（独立 venv）。
   模型没装、端口没起、显存被占、服务崩了，主程序完全不受影响，直接退回本地笔画。
3. **先探 /health 再干活。** 服务没起的时候不要一张一张去撞 120 秒超时，
   探一次就整批退回 local——观众等的是名字，不是模型。

配置见 config.yaml 的 `signature.sdcn`。
"""
from __future__ import annotations

import base64
import time
from pathlib import Path

import cv2
import httpx
import numpy as np

from ..config import ROOT
from . import glyphstyle, signature, wordsheet
from .glyphcut import alpha_from_light

PAD = 6


def _conf_url(conf: dict) -> str:
    return str(conf.get("url") or "http://127.0.0.1:7863").rstrip("/")


def health(conf: dict, timeout: float = 1.5) -> bool:
    """服务活着吗？活着是指 /health 回 ok:true（模型真的加载完了）。"""
    try:
        # trust_env=False：本机端口不能走系统 HTTP_PROXY，否则 502（豆包 CDP 也踩过）
        with httpx.Client(timeout=timeout, trust_env=False) as c:
            r = c.get(f"{_conf_url(conf)}/health")
            return bool(r.json().get("ok"))
    except Exception:
        return False


# ------------------------------------------------------------------ control 图
def control(name: str, conf: dict, out_dir: Path) -> Path:
    """名字 -> 白底黑字线稿。这张图决定模型能写出什么，字是字体排的，不会错。"""
    font_path = signature.pick_font(str(conf.get("font") or ""))
    n = max(1, len(name))
    # 字越多画得越宽：ControlNet 把结构钉死后，模型不会替我们"排字"，
    # 所以一个字至少给 320px 才够反推出笔锋（笔迹太小时骨架会糊成一团，
    # brush.writes_for 的笔数会明显偏少，写出来就"僵"）。
    target_w = int(conf.get("size") or 0) or min(1024, max(768, 320 * n))

    size = 260
    ink, _starts, _cell = signature._layout(name, font_path, size)
    while ink.shape[1] > target_w - 2 * 12 and size > 64:
        size = int(size * 0.86)
        ink, _starts, _cell = signature._layout(name, font_path, size)

    h, w = ink.shape
    pad = int(max(w, h) * 0.08) + 8
    # _layout 给的是"墨迹亮度"（字 255），反过来就是白底黑字
    canvas = np.full((h + pad * 2, w + pad * 2), 255, np.uint8)
    canvas[pad:pad + h, pad:pad + w] = 255 - ink
    # 收口到目标宽度：让不同的名字都落在同一套像素尺度上，
    # 模型每次拿到的线稿粗细一致（否则长名字会被缩得很细，笔锋就出不来）
    if canvas.shape[1] != target_w:
        k = target_w / canvas.shape[1]
        canvas = cv2.resize(canvas,
                            (target_w, max(64, int(round(canvas.shape[0] * k)))),
                            interpolation=cv2.INTER_AREA)
    img = cv2.cvtColor(canvas, cv2.COLOR_GRAY2BGR)

    out_dir.mkdir(parents=True, exist_ok=True)
    dst = out_dir / f"ctrl_{time.strftime('%m%d_%H%M%S')}_{int(time.time()*1000)%1000}.png"
    ok, buf = cv2.imencode(".png", img)
    if not ok:
        raise RuntimeError("control 图编码失败")
    dst.write_bytes(buf.tobytes())
    return dst


# ------------------------------------------------------------------ 单张出图
def _one(ctrl: Path, conf: dict) -> Path | None:
    """把 control 图丢给本地服务，拿回白底墨迹图。"""
    raw = ctrl.read_bytes()
    body = {
        "image": base64.b64encode(raw).decode(),
        "prompt": str(conf.get("prompt") or ""),
        "negative": str(conf.get("negative") or ""),
        "steps": int(conf.get("steps") or 0),
        # 强度 = 让模型发挥多少。0.35 只把字体边缘磨成毛笔边；
        # 过 0.5 模型开始自己"重写"文字，就有错字风险（服务端上限 0.6）。
        "strength": float(conf.get("strength") or 0.0),
        "cfg": float(conf.get("cfg") or 0.0),
        "seed": int(conf.get("seed") or 0),
    }
    with httpx.Client(timeout=float(conf.get("timeout") or 120),
                      trust_env=False) as c:
        r = c.post(f"{_conf_url(conf)}/sign", json=body)
        if r.status_code >= 400:
            raise RuntimeError(f"服务返回 {r.status_code}: {r.text[:160]}")
        data = r.json()
    if not data.get("ok") or not data.get("image"):
        raise RuntimeError(f"服务没给图: {str(data)[:160]}")
    dst = ctrl.with_name(ctrl.stem + "_out.png")
    dst.write_bytes(base64.b64decode(data["image"]))
    return dst


# ------------------------------------------------------------------ 抠图
def _tight_cut(src: Path, dst: Path, tint: list | None = None,
               ref: Path | None = None) -> tuple[int, int] | None:
    """白底墨迹 -> 紧贴笔迹的透明 PNG（和豆包那条路同一套反预乘）。

    除了抠图，这里还干三件"模型不听话时的兜底"：

    1. **丢掉所有彩色像素。** strength 一过 0.5 模型就爱顺手盖个红印章、
       描个朱文边。墨是灰的、S 很低，红印章 S 很高——按饱和度一刀切掉，
       比在提示词里求它别画可靠得多。
    2. **丢掉孤立的小连通块。** 它还会在旁边写几个小字当落款。这些块的面积
       远小于真正的字，按面积比例掐掉（阈值放得很松，笔画的"点"不会误伤）。
    3. **用字体掩膜把笔画内部填实**（`ref` = 当初喂给模型的字体图）。
       这是最要紧的一条：SD 在 strength≈0.55 时会把笔画画成"浮雕"——
       笔画中间有一道高光，而抠图是拿亮度当 alpha 的，于是笔画内部被啃出
       一条条白缝，贴到海报上像被水洗过。字体图告诉我们"这里本该是实心墨"，
       所以把它（往里收两像素、免得把模型故意飞白的边缘也填掉）并进 alpha。
       结果就是：**内部实心，边缘仍然是模型的毛刺**。

    最后可选**上色**：模型给的是黑墨，海报上的字是墨绿。alpha 保留浓淡，
    RGB 统一换成海报的墨色，贴上去才像本来就画在那儿的。
    """
    img = cv2.imdecode(np.fromfile(str(src), np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        return None
    a = alpha_from_light(img)
    if float(a.max()) < 0.30:              # 几乎全白：模型没画出东西
        return None

    # 1) 彩色像素不要（红印章 / 朱文 / 彩色花边）
    sat = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)[..., 1]
    a = a * np.where(sat > 70, 0.0, 1.0).astype(np.float32)

    # 2) 孤立小碎块不要（落款小字 / 飞点）
    solid = (a > 0.25).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(solid, 8)
    if n > 2:
        areas = stats[1:, cv2.CC_STAT_AREA].astype(np.float32)
        big = float(areas.max())
        keep = [i + 1 for i, ar in enumerate(areas) if ar >= max(30.0, big * 0.025)]
        if keep:
            a = a * np.isin(lab, keep).astype(np.float32)

    # 3) 字体掩膜填实笔画内部（见函数开头第 3 条）
    if ref is not None and Path(ref).exists():
        r = cv2.imdecode(np.fromfile(str(ref), np.uint8), cv2.IMREAD_COLOR)
        if r is not None:
            ar = alpha_from_light(r)
            if ar.shape[:2] != a.shape[:2]:
                ar = cv2.resize(ar, (a.shape[1], a.shape[0]),
                                interpolation=cv2.INTER_LINEAR)
            m = (ar > 0.5).astype(np.uint8)
            m = cv2.erode(m, np.ones((3, 3), np.uint8), iterations=2)
            a = np.maximum(a, m.astype(np.float32) * 0.95)

    ys, xs = np.where(a > 0.10)
    if len(xs) < 60:
        return None
    H, W = a.shape[:2]
    x0 = max(0, int(xs.min()) - PAD)
    x1 = min(W, int(xs.max()) + PAD + 1)
    y0 = max(0, int(ys.min()) - PAD)
    y1 = min(H, int(ys.max()) + PAD + 1)
    rgba = wordsheet._rgba(img[y0:y1, x0:x1], a[y0:y1, x0:x1])
    if tint:
        # 上色为什么要配 gamma：模型的笔迹边缘是灰渐变，alpha 天然有一堆中间调。
        # 直接换成墨绿，中间调就变成浅绿，整幅字看着发虚（浅色背景上尤其明显）。
        # 先把 alpha 提一下（0.5 -> 0.59，0.2 -> 0.30），笔画才实。
        al = rgba[..., 3].astype(np.float32) / 255.0
        rgba[..., 3] = np.clip(np.power(al, 0.75) * 255, 0, 255).astype(np.uint8)
        # cv2 是 BGR；config 里写 RGB 更符合直觉，这里翻一下
        rgba[..., :3] = np.array(list(reversed(tint))[:3], np.uint8)
    ok, buf = cv2.imencode(".png", rgba)
    if not ok:
        return None
    dst.write_bytes(buf.tobytes())
    return int(x1 - x0), int(y1 - y0)


# ------------------------------------------------------------------ 批量
def batch(names: list[str], conf: dict) -> list[dict | None]:
    """和 doubaoweb.batch 同样的返回形状：每人一份 {glyph, full, box, w, h}。

    整批失败（服务没起 / 全都没出图）返回 []，由 main.py 统一退回本地笔画。
    """
    names = [n for n in names if n]
    if not names:
        return []
    if not health(conf):
        print("[sdcn] 本地服务不可用（没起 / 没装 / 模型还在加载），整批退回本地笔画",
              flush=True)
        return []

    out_dir = ROOT / "data" / "signatures"
    out_dir.mkdir(parents=True, exist_ok=True)
    plate_path = str(conf.get("plate") or "").strip()
    plate = (ROOT / plate_path) if plate_path else None
    if not (plate and plate.exists()):
        print(f"[sdcn] 缺底板图 {plate}，退回本地笔画", flush=True)
        return []
    place = conf.get("place") or {}

    result: list[dict | None] = []
    for name in names:
        t0 = time.time()
        try:
            ctrl = control(name, conf, out_dir)
            raw = _one(ctrl, conf)
            if raw is None:
                result.append(None)
                continue
            glyph = raw.with_name(raw.stem + "_glyph.png")
            style = str(conf.get("style") or "ink").lower()
            # 上色只在"平涂墨色"下做。别的材质自己带颜色（金色/立体），
            # 先染色反而会被材质覆盖掉，白算一遍。
            dims = _tight_cut(raw, glyph,
                              conf.get("tint") if style in ("", "ink") else None,
                              ref=ctrl)
            if not dims:
                print(f"[sdcn] 「{name}」没抠出笔迹（模型没画出字），退回本地笔画",
                      flush=True)
                result.append(None)
                continue

            # 材质：立体/烫金/镀铬都在这一步加（见 pipeline/glyphstyle.py）。
            # 会补边（投影、挤出侧面），所以尺寸要重新读一遍。
            # 注意留一份"没上材质"的 plain 给笔顺用：投影和侧面那圈半透明像素
            # 会被 brush.writes_for 当成笔画（alpha 阈值 90），毛笔就会跑出字外描影子。
            plain = glyph
            if style not in ("", "ink"):
                styled = glyph.with_name(raw.stem + f"_glyph_{style}.png")
                if glyphstyle.apply(glyph, styled, style=style):
                    glyph = styled
                    g2 = cv2.imdecode(np.fromfile(str(glyph), np.uint8),
                                      cv2.IMREAD_UNCHANGED)
                    if g2 is not None:
                        dims = (int(g2.shape[1]), int(g2.shape[0]))
            gw, gh = dims
            box = wordsheet.place_box(gw, gh, place)
            full = glyph.with_name(glyph.stem.replace("_glyph", "") + "_full.jpg")
            wordsheet.compose(plate, glyph, box, full)
            result.append({"glyph": glyph, "trace": plain, "full": full,
                           "style": style, "box": box, "w": gw, "h": gh})
            print(f"[sdcn] 「{name}」{gw}x{gh} {time.time() - t0:.1f}s", flush=True)
        except Exception as e:
            print(f"[sdcn] 「{name}」失败({type(e).__name__}: {e})", flush=True)
            result.append(None)
    return result


def generate(name: str, conf: dict) -> dict | None:
    """单个名字（手测用）。"""
    got = batch([name], conf)
    return got[0] if got else None


if __name__ == "__main__":  # 手测：python -m app.pipeline.sdcn 张三
    import sys

    from ..config import load

    conf = dict(load()["signature"].get("sdcn") or {})
    print("health:", health(conf))
    for nm in (sys.argv[1:] or ["张三"]):
        print(nm, "->", generate(nm, conf))
