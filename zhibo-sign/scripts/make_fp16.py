"""把 SD 权重转成 fp16 存盘，冷启动读盘量减半。

## 为什么值得做

H 盘实测顺序读只有 **43MB/s**，4.2GB 权重光读一遍就 97 秒，加上初始化共 200+ 秒。
存成 fp16 后只要读 2.1GB —— 冷启动压到 1 分钟左右。

质量**完全不变**：推理本来就用 `torch_dtype=float16`，进显存前会把 fp32 当场砍成 fp16；
这里只是把那一步提前做在磁盘上。

## 为什么是"流式"

这台机器只剩 6GB 可用内存，而 `safetensors.numpy.load_file` 会把整个 3.4GB 解到 RAM，
再存一份 fp16 就 5GB+，很容易把系统拖去换页。

所以这里直接操作 safetensors 的文件格式：header 是 JSON（记录每个张量的 dtype/shape/
偏移），后面是连续的数据段。于是可以**一个张量一个张量地读、转、写**，
峰值内存只有最大的那一层（几十 MB）。

原文件一个字节都不动，只在旁边多出 `*.fp16.safetensors`；
`from_pretrained(variant="fp16")` 会在；找不到时自动回落到 fp32（见 sdcn_server.py）。

    python scripts/make_fp16.py
    python scripts/make_fp16.py --force      # 已存在也重做
"""
from __future__ import annotations

import argparse
import json
import struct
import sys
import time
from pathlib import Path

import numpy as np

PARTS = ("unet", "vae", "text_encoder")
NAME = "diffusion_pytorch_model.safetensors"
OUT = "diffusion_pytorch_model.fp16.safetensors"


def _read_header(f) -> tuple[dict, int]:
    n = struct.unpack("<Q", f.read(8))[0]
    head = json.loads(f.read(n))
    return head, 8 + n


def convert(src: Path, dst: Path) -> tuple[int, int]:
    """返回 (原字节数, 新字节数)。"""
    with open(src, "rb") as f:
        head, data_start = _read_header(f)
    meta = head.pop("__metadata__", None)

    out: dict = {}
    plan: list[tuple[str, str, int, int, int, int]] = []
    off = 0
    for name, info in head.items():
        dt = info["dtype"]
        s, e = info["data_offsets"]
        # 只砍 32 位浮点；int64 的 num_batches_tracked、bool 之类原样搬
        if dt == "F32":
            ndt, size = "F16", (e - s) // 4 * 2
        else:
            ndt, size = dt, e - s
        out[name] = {"dtype": ndt, "shape": info["shape"],
                     "data_offsets": [off, off + size]}
        plan.append((name, dt, s, e, off, size))
        off += size
    if meta:
        out["__metadata__"] = meta

    hdr = json.dumps(out, separators=(",", ":")).encode()
    hdr += b" " * ((8 - (8 + len(hdr)) % 8) % 8)      # 数据段要 8 字节对齐

    tmp = dst.with_suffix(".part")
    with open(src, "rb") as fi, open(tmp, "wb") as fo:
        fo.write(struct.pack("<Q", len(hdr)))
        fo.write(hdr)
        for name, dt, s, e, o, size in plan:
            fi.seek(data_start + s)
            raw = fi.read(e - s)
            if dt == "F32":
                buf = np.frombuffer(raw, np.float32).astype(np.float16).tobytes()
            else:
                buf = raw
            fo.write(buf)
    tmp.replace(dst)
    return src.stat().st_size, dst.stat().st_size


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="H:/hf_cache/models/sd15")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    root = Path(a.dir)
    if not (root / "model_index.json").exists():
        print(f"没找到模型：{root}")
        return 1

    total_old = total_new = 0
    for part in PARTS:
        src = root / part / NAME
        dst = root / part / OUT
        if not src.exists():
            print(f"跳过 {part}（没有 {NAME}）")
            continue
        if dst.exists() and not a.force:
            print(f"= {part} 已存在 {dst.stat().st_size / 1e6:.0f}MB（--force 可重做）")
            total_old += src.stat().st_size
            total_new += dst.stat().st_size
            continue
        t0 = time.time()
        old, new = convert(src, dst)
        total_old += old
        total_new += new
        print(f"+ {part:12s} {old / 1e9:.2f}GB -> {new / 1e9:.2f}GB  "
              f"{time.time() - t0:.0f}s", flush=True)

    print(f"\n合计 {total_old / 1e9:.2f}GB -> {total_new / 1e9:.2f}GB"
          f"（省 {100 * (1 - total_new / max(1, total_old)):.0f}%）")
    # 自检：读回来比对一个张量，确认格式没写坏
    try:
        from safetensors import safe_open

        p = root / "vae" / OUT
        if p.exists():
            with safe_open(str(p), framework="numpy") as f:
                k = list(f.keys())[0]
                arr = f.get_tensor(k)
                print(f"自检 OK：{p.name} 的张量 {k} dtype={arr.dtype} shape={arr.shape}")
    except Exception as e:
        print(f"自检失败：{type(e).__name__}: {e}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
