"""从魔搭（ModelScope）拉扩散模型权重。

为什么不用 huggingface：这台机器上 hf-mirror 和 huggingface.co 都连不上
（代理把 SSL 掐了），但 modelscope.cn 直连正常。所以权重走魔搭。

只拉 diffusers 格式需要的那些 safetensors，**跳过 safety_checker**——
我们推理时 `safety_checker=None`，那 1.2GB 纯属浪费（脚本会顺手把它从
model_index.json 里删掉，否则 from_pretrained 会去找它）。

    python scripts/fetch_models.py                 # 默认拉 SD1.5 到 H:/hf_cache/models/sd15
    python scripts/fetch_models.py --dir D:/x      # 换目录
    python scripts/fetch_models.py --check         # 只看要下多少，不真下

已有文件按大小比对跳过，中断了直接重跑。
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import httpx

API = "https://modelscope.cn/api/v1/models/{mid}/repo"
FILES_API = "https://modelscope.cn/api/v1/models/{mid}/repo/files"

# 只要这些；.bin 和整包 .ckpt/.safetensors（4~7GB 那种）一律不碰
KEEP = (
    "model_index.json",
    "scheduler/scheduler_config.json",
    "text_encoder/config.json",
    "text_encoder/model.safetensors",
    "tokenizer/merges.txt",
    "tokenizer/special_tokens_map.json",
    "tokenizer/tokenizer_config.json",
    "tokenizer/vocab.json",
    "unet/config.json",
    "unet/diffusion_pytorch_model.safetensors",
    "vae/config.json",
    "vae/diffusion_pytorch_model.safetensors",
)

REPOS = {
    "sd15": "AI-ModelScope/stable-diffusion-v1-5",
}


def _list(mid: str) -> dict[str, int]:
    with httpx.Client(timeout=30, follow_redirects=True) as c:
        r = c.get(FILES_API.format(mid=mid),
                  params={"Revision": "master", "Recursive": "true"})
        r.raise_for_status()
        files = (r.json().get("Data") or {}).get("Files") or []
    return {f["Path"]: int(f.get("Size") or 0) for f in files}


def _download(mid: str, path: str, dst: Path, size: int) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists() and dst.stat().st_size == size:
        print(f"  = {path}（已存在）", flush=True)
        return
    tmp = dst.with_suffix(dst.suffix + ".part")
    url = API.format(mid=mid)
    got = 0
    t0 = time.time()
    with httpx.Client(timeout=60, follow_redirects=True) as c:
        with c.stream("GET", url,
                      params={"Revision": "master", "FilePath": path}) as r:
            r.raise_for_status()
            total = int(r.headers.get("content-length") or size or 0)
            next_log = 0.0
            with open(tmp, "wb") as f:
                for chunk in r.iter_bytes(1 << 20):
                    f.write(chunk)
                    got += len(chunk)
                    el = time.time() - t0
                    if el >= next_log and total:
                        pct = got * 100 / total
                        sp = got / max(el, 0.01) / 1e6
                        sys.stdout.write(
                            f"\r   ↓ {path} {pct:5.1f}%  "
                            f"{got / 1e6:.0f}/{total / 1e6:.0f}MB  {sp:.1f}MB/s   ")
                        sys.stdout.flush()
                        next_log = el + 2
    print(flush=True)
    tmp.replace(dst)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="H:/hf_cache/models")
    ap.add_argument("--repo", default="sd15", choices=list(REPOS))
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()

    mid = REPOS[a.repo]
    dst = Path(a.dir) / a.repo
    print(f"仓库 {mid} -> {dst}", flush=True)
    have = _list(mid)

    todo = [(p, have[p]) for p in KEEP if p in have]
    missing = [p for p in KEEP if p not in have]
    if missing:
        print(f"! 仓库里没有这些文件（跳过）：{missing}", flush=True)
    total = sum(s for _, s in todo)
    print(f"需要 {len(todo)} 个文件，合计 {total / 1e9:.2f}GB", flush=True)
    if a.check:
        for p, s in todo:
            print(f"   {s / 1e6:8.1f}MB  {p}")
        return

    for p, s in todo:
        _download(mid, p, dst / p, s)

    # from_pretrained 会照着 model_index.json 去找 safety_checker/feature_extractor，
    # 我们推理时是 None，所以把这两项从索引里摘掉，不然它会去下载或者报错。
    idx = dst / "model_index.json"
    if idx.exists():
        d = json.loads(idx.read_text("utf-8"))
        for k in ("safety_checker", "feature_extractor"):
            d.pop(k, None)
        idx.write_text(json.dumps(d, indent=2), "utf-8")
        print("已从 model_index.json 移除 safety_checker / feature_extractor", flush=True)

    print(f"完成：{dst}", flush=True)


if __name__ == "__main__":
    main()
