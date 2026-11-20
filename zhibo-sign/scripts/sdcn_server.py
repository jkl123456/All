"""本地 SD 出图服务（沙画签名的"质感"那一层）。

和主程序完全解耦的独立进程：主程序 POST 一张白底黑字线稿过来，拿回一张
"用毛笔重写过"的同款图。好处是——
* 主进程不 import torch，不背 5GB 依赖；
* 模型没装 / 显存被占 / 服务没起，主程序照常跑，直接退回本地笔画（不开天窗）；
* 换模型、调参数只重启这个服务，不用碰直播程序。

## 为什么是 img2img，不是 ControlNet

原计划是 SD1.5 + ControlNet(lineart) 把线稿"钉死"。实际部署时撞到两个硬约束：

1. 这台机器的 hf-mirror / huggingface.co 都连不上（代理把 SSL 掐了），权重只能
   走魔搭；而魔搭上没有 `control_v11p_sd15_lineart` 和 `lcm-lora-sdv1-5`，
   只有 SD1.5 本体。与其为了一个 ControlNet 去折腾翻墙，不如换条路。
2. img2img 对我们这件事**反而更对**：初始图就是字体渲染出的精确字形，
   低强度去噪（strength 0.35~0.5）时结构几乎原样保留，模型能改的只有边缘、
   笔锋、干湿。ControlNet 是"告诉模型别乱画"，img2img 是"从这张开始改"，
   对"字形绝对不能错"这个要求，后者更直接、也更省显存。

所以：**字形由字体保证（字已经在初始图里），模型只上质感。** 想加大模型发挥就调
`strength`，但它一过 0.6 模型就开始自己"重写"文字，出现错字。别贪。

## 装环境（一次性，约 5GB）

    python -m venv H:/envs/sdcn
    H:/envs/sdcn/Scripts/python.exe -m pip install -r requirements-sdcn.txt
    python scripts/fetch_models.py          # 从魔搭拉 SD1.5（约 4.3GB）

torch 直接从 PyPI 装就行（Windows 的 PyPI 轮子自带 CUDA），**别用
download.pytorch.org**——这台机器上它被代理挡住了。

## 跑

    python scripts/sdcn_server.py
    python scripts/sdcn_server.py --steps 20
"""
from __future__ import annotations

import argparse
import base64
import io
import os
import socket
import sys
import time
import urllib.request
import warnings
from pathlib import Path

# 必须在 import diffusers / transformers 之前设好。
# 这台机器的 base 环境里装着 tensorflow 2.16（编译时用的是 numpy 1.x），而 numpy 是 2.5；
# transformers 只要探测到 "TF 可用"，CLIP 那一路就会真的去 import tensorflow，
# 然后炸在 `numpy.core.umath failed to import`，整个服务起不来。
# 我们压根不用 TF，把探测关掉最省事——比降 numpy 安全（降 numpy 会带崩 base 里的 cv2/pandas）。
os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("USE_FLAX", "0")
os.environ.setdefault("TRANSFORMERS_NO_ADVISORY_WARNINGS", "1")

# transformers 4.57 会把 diffusers 0.29 传下来的 `torch_dtype` 报成"已废弃"。
# 但 diffusers 0.29.2 只认这个名字（改成 dtype 会被忽略，模型就变成 fp32，
# 显存翻倍、速度减半）。所以名字不能改，只把这条噪音警告压掉。
warnings.filterwarnings("ignore", message=r".*`torch_dtype` is deprecated.*")

import torch
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# 只要质感，不要模型重新构图。强调"纯白背景"很重要：抠图是拿亮度当 alpha
# （glyphcut.alpha_from_light），背景一旦变成米色宣纸，笔画和背景的亮度差
# 就变小，飞白会被当成背景啃掉。
#
# "solid filled" 和负向里的 "outline / hollow / empty inside" 是必须的：
# 一旦提示词里只提 "rough bristle edges / flying white"，SD 会把笔画画成**空心描边**
# （只剩轮廓线、中间发白）——实测过，整幅字变成"双钩"，比不加质感还难看。
DEFAULT_PROMPT = (
    "solid filled thick black ink calligraphy strokes, chinese brush writing, "
    "dense wet ink, slight dry brush texture at stroke ends, "
    "single subject on clean pure white background, high contrast"
)
DEFAULT_NEGATIVE = (
    "beige background, paper texture, sepia, color tint, gradient, "
    "seal, stamp, red ink, chop, signature, caption, small text, decoration, "
    "watermark, frame, border, photo, blurry, low quality, "
    "outline, hollow, empty inside, doubled lines, "
    "extra strokes, distorted, messy"
)

app = FastAPI()
_pipe = None
_state: dict = {}


class SignReq(BaseModel):
    image: str                      # 初始图（PNG base64，白底黑字）
    prompt: str = ""
    negative: str = ""
    steps: int = 0
    strength: float = 0.0
    cfg: float = 0.0
    seed: int = 0


def _load(model_dir: str, steps: int):
    global _pipe
    from diffusers import (DPMSolverMultistepScheduler,
                           StableDiffusionImg2ImgPipeline)

    d = Path(model_dir)
    if not (d / "model_index.json").exists():
        raise SystemExit(
            f"没找到模型：{d}\n先跑：python scripts/fetch_models.py")

    t0 = time.time()
    print(f"[sdcn] 加载 {d} …", flush=True)
    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    kw = dict(safety_checker=None, requires_safety_checker=False,
              local_files_only=True)

    # 有 fp16 权重就读它（scripts/make_fp16.py 生成）：H 盘只有 43MB/s，
    # 读 2.1GB 比读 4.2GB 快一倍，冷启动从 200 秒掉到 60~90 秒。
    # 推理本来就是 fp16，所以质量完全一样。文件不在 / 加载失败就回落 fp32。
    pipe = None
    if (d / "unet" / "diffusion_pytorch_model.fp16.safetensors").exists():
        try:
            pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
                str(d), variant="fp16", torch_dtype=dtype, **kw)
            print("[sdcn] 用 fp16 权重（读盘量减半）", flush=True)
        except Exception as e:
            print(f"[sdcn] fp16 权重加载失败({type(e).__name__}: {e})，回退 fp32",
                  flush=True)
            pipe = None
    if pipe is None:
        pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
            str(d), torch_dtype=dtype, **kw)
    # DPM++ 2M：12~16 步就收敛；乘上 strength 之后实际只跑 5~7 次 UNet，
    # 3060 上 768x352 大约 1.5~2.5 秒一张。默认的 PNDM 要 50 步，直播等不起。
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(
        pipe.scheduler.config, use_karras_sigmas=True, algorithm_type="dpmsolver++")
    pipe.to("cuda" if torch.cuda.is_available() else "cpu")
    pipe.set_progress_bar_config(disable=True)
    _pipe = pipe
    _state.update(model=str(d), steps=steps, device=str(pipe.device),
                  cuda=torch.cuda.is_available(),
                  gpu=(torch.cuda.get_device_name(0) if torch.cuda.is_available() else ""),
                  load_s=round(time.time() - t0, 1))
    print(f"[sdcn] 就绪 {_state['load_s']}s  {_state['device']}  "
          f"{_state['gpu']}", flush=True)


def _decode(b64: str):
    from PIL import Image

    raw = b64.split(",", 1)[-1]
    return Image.open(io.BytesIO(base64.b64decode(raw))).convert("RGB")


def _encode(img) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


@app.get("/health")
def health():
    return {"ok": _pipe is not None, **_state}


@app.post("/sign")
def sign(req: SignReq):
    if _pipe is None:
        return JSONResponse({"ok": False, "error": "模型还没加载完"}, status_code=503)

    init = _decode(req.image)
    # 边要是 8 的倍数；总宽压到 1024 以内——再大只会更慢，而且 SD1.5 在这个尺度
    # 上开始重复/崩坏字形。等比缩放，绝不拉伸（一拉伸书法感立刻没了）。
    w = min(1024, init.width)
    h = max(64, int(round(w * init.height / max(1, init.width))))
    w8, h8 = max(256, (w // 8) * 8), max(64, (h // 8) * 8)
    init = init.resize((w8, h8))

    steps = int(req.steps or _state.get("steps") or 16)
    # 强度 = 让模型发挥多少：0.35 只把字体边缘磨成毛笔边，0.55 笔画明显飞白，
    # 0.65 往上开始自己加印章/小字（客户端会做去彩色、去碎块的兜底，但别指望它）。
    strength = max(0.15, min(0.75, float(req.strength or 0.55)))
    cfg = float(req.cfg or 7.5)
    seed = int(req.seed or 0) or int(time.time() * 1000) % (2 ** 31 - 1)
    gen = torch.Generator(device=_pipe.device).manual_seed(seed)

    t0 = time.time()
    with torch.inference_mode():
        out = _pipe(
            prompt=req.prompt or DEFAULT_PROMPT,
            negative_prompt=req.negative or DEFAULT_NEGATIVE,
            image=init,
            num_inference_steps=steps,
            strength=strength,
            guidance_scale=cfg,
            generator=gen,
        ).images[0]

    ms = int((time.time() - t0) * 1000)
    evals = int(steps * strength)
    print(f"[sdcn] {w8}x{h8} steps={steps}×{strength:.2f}({evals}次UNet) "
          f"{ms}ms seed={seed}", flush=True)
    return {"ok": True, "image": _encode(out), "ms": ms, "seed": seed,
            "size": [w8, h8], "evals": evals}


def _port_busy(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex((host, port)) == 0


def _health_ok(port: int, host: str = "127.0.0.1", timeout: float = 1.5) -> bool:
    """端口上那个东西是不是我们的服务（而不是别的程序）。"""
    import json

    # urllib 默认会读 HTTP_PROXY，本机端口必须绕开，否则 502
    op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with op.open(f"http://{host}:{port}/health", timeout=timeout) as r:
            return bool(json.loads(r.read().decode()).get("ok"))
    except Exception:
        return False


if __name__ == "__main__":
    import uvicorn

    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=7863)
    ap.add_argument("--model", default=os.environ.get("SDCN_MODEL")
                    or "H:/hf_cache/models/sd15")
    ap.add_argument("--steps", type=int, default=16)
    a = ap.parse_args()

    # 端口检查必须放在加载模型**之前**。4GB 权重要读两三分钟，
    # 先读完再撞端口，等于白等——第一次踩就是"等了 208 秒换来一行 Errno 10048"。
    if _port_busy(a.port):
        if _health_ok(a.port):
            print(f"[sdcn] 端口 {a.port} 上已经有一个服务在跑了，直接用就行，不用再起。",
                  flush=True)
            print(f"[sdcn]   健康检查： http://127.0.0.1:{a.port}/health", flush=True)
            print("[sdcn]   真要重启：在跑它的那个窗口按 Ctrl+C，或者结束占用进程后再来。",
                  flush=True)
            sys.exit(0)
        print(f"[sdcn] 端口 {a.port} 被别的程序占着（/health 不通）。", flush=True)
        print(f"[sdcn]   换端口： --port 7864，并同步改 config.yaml 的 signature.sdcn.url",
              flush=True)
        sys.exit(1)

    _load(a.model, a.steps)
    try:
        uvicorn.run(app, host=a.host, port=a.port, log_level="warning")
    except OSError as e:
        print(f"[sdcn] 起不来：{e}", flush=True)
        sys.exit(1)
