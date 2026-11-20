"""可选出图：让模型画一张"沙画签名"成图。

默认不用（`signature.provider: local`）。本地字体笔画已经能写得很像，这条路是给
"要更惊艳的沙画质感"准备的：每张约 20 秒、按张计费，而且要联网。

失败一律返回 None，由调用方退回本地笔画——直播里第三方接口挂掉不能导致空场。
"""
from __future__ import annotations

import base64
import time
from pathlib import Path

import httpx

from ..config import ROOT

DEFAULT_PROMPT = (
    "沙画风格艺术签名，内容是「{name}」三个以内的汉字，"
    "细沙颗粒质感，暖色灯光从侧上方打亮，背景是干净的沙盘浅米色，"
    "字迹是手写连笔，笔画边缘有沙粒飞散，整体构图居中留白，"
    "不要出现任何其他文字、水印、边框"
)


def enabled(conf: dict) -> bool:
    return bool(conf.get("api_key")) and conf.get("provider") == "ai"


def _out_path(name: str) -> Path:
    folder = ROOT / "data" / "signatures"
    folder.mkdir(parents=True, exist_ok=True)
    safe = "".join(ch for ch in name if ch.isalnum())[:12] or "sig"
    return folder / f"ai_{time.strftime('%m%d_%H%M%S')}_{safe}.png"


def generate(name: str, conf: dict) -> Path | None:
    """返回落盘的 png 路径；任何失败都返回 None。"""
    key = str(conf.get("api_key") or "")
    if not key:
        return None
    base = str(conf.get("base_url") or "https://ark.cn-beijing.volces.com/api/v3").rstrip("/")
    model = str(conf.get("model") or "doubao-seedream-5-0-flash-260915")
    size = str(conf.get("size") or "1024x1024")
    tpl = str(conf.get("prompt") or DEFAULT_PROMPT)
    prompt = tpl.format(name=name) if "{name}" in tpl else f"{tpl}「{name}」"

    body = {
        "model": model,
        "prompt": prompt,
        "size": size,
        "response_format": "b64_json",
        "watermark": bool(conf.get("watermark", False)),
    }
    try:
        with httpx.Client(timeout=float(conf.get("timeout", 90))) as c:
            r = c.post(f"{base}/images/generations", json=body,
                       headers={"Authorization": f"Bearer {key}"})
            if r.status_code >= 400:
                # 有的模型/版本只回 url，不支持 b64_json，换一种再试一次
                body.pop("response_format", None)
                r = c.post(f"{base}/images/generations", json=body,
                           headers={"Authorization": f"Bearer {key}"})
                r.raise_for_status()
            data = (r.json().get("data") or [{}])[0]
            raw = None
            if data.get("b64_json"):
                raw = base64.b64decode(data["b64_json"])
            elif data.get("url"):
                raw = c.get(data["url"], timeout=60).content
            if not raw:
                return None
        p = _out_path(name)
        p.write_bytes(raw)
        return p
    except Exception:
        return None
