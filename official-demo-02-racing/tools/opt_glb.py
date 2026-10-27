#!/usr/bin/env python
"""把混元输出的原始 GLB 处理成可直接进游戏的资产：

1. 把非等比缩放和落地偏移烘进 node.matrix（AI 生成的车比例偏胖，需要按目标长宽高校准）
2. 贴图降到 1024/512 的 JPEG，体积从 ~38MB 压到 ~1MB
3. 去掉 KHR_materials_specular 这类引擎不一定支持的扩展

用法:
  python tools/opt_glb.py --in tools/out/car01.glb --out assets/models/car-gt3.glb --fit 4.55,1.98,1.20
"""
import argparse
import io
import json
import math
import struct
import sys


def read_glb(path):
    b = open(path, "rb").read()
    magic, ver, total = struct.unpack("<III", b[:12])
    assert magic == 0x46546C67, "not a glb"
    off, js, bin_chunk = 12, None, None
    while off < total:
        clen, ctype = struct.unpack("<II", b[off:off + 8])
        body = b[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(body.decode("utf-8"))
        elif ctype == 0x004E4942:
            bin_chunk = body
        off += 8 + clen
    return js, bin_chunk


def write_glb(path, js, bin_chunk):
    jjson = json.dumps(js, separators=(",", ":")).encode("utf-8")
    jjson += b" " * ((4 - len(jjson) % 4) % 4)
    bpad = bin_chunk + b"\x00" * ((4 - len(bin_chunk) % 4) % 4)
    total = 12 + 8 + len(jjson) + 8 + len(bpad)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(jjson), 0x4E4F534A))
        f.write(jjson)
        f.write(struct.pack("<II", len(bpad), 0x004E4942))
        f.write(bpad)


def quat_matrix(q):
    x, y, z, w = q
    xx, yy, zz = x * x, y * y, z * z
    xy, xz, yz = x * y, x * z, y * z
    wx, wy, wz = w * x, w * y, w * z
    return [
        [1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy)],
        [2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx)],
        [2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)],
    ]


def mat_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def to_col_major(m):
    return [m[i][j] for j in range(4) for i in range(4)]


def to_rows(cm):
    return [[cm[c * 4 + r] for c in range(4)] for r in range(4)]


def refit(js, fit):
    """在已处理好的 GLB 上再标定一次尺寸：只改 node.matrix，不动网格和贴图。
    用来调「压扁程度」——零成本、毫秒级。"""
    node = js["nodes"][0]
    L, W, H = fit
    if "matrix" in node:
        M = to_rows(node["matrix"])
    else:  # 兜底：从 TRS 组一个
        r = quat_matrix(node.get("rotation", [0, 0, 0, 1]))
        s = node.get("scale", [1, 1, 1])
        t = node.get("translation", [0, 0, 0])
        M = [[r[i][j] * s[j] if i < 3 else (1 if i == j else 0) for j in range(4)] for i in range(4)]
        for i in range(3):
            M[i][3] = t[i]

    acc = js["accessors"][0]
    mn, mx = acc["min"], acc["max"]
    corners = [[mn[0] if i & 1 else mx[0], mn[1] if i & 2 else mx[1], mn[2] if i & 4 else mx[2], 1]
               for i in range(8)]
    world = [[sum(M[i][k] * c[k] for k in range(4)) for i in range(3)] for c in corners]
    wmin = [min(p[i] for p in world) for i in range(3)]
    wmax = [max(p[i] for p in world) for i in range(3)]
    size = [wmax[i] - wmin[i] for i in range(3)]
    center = [(wmax[i] + wmin[i]) / 2 for i in range(3)]

    sx, sy, sz = W / size[0], H / size[1], L / size[2]
    tx, ty, tz = -center[0] * sx, -wmin[1] * sy, -center[2] * sz
    T = [[1, 0, 0, tx], [0, 1, 0, ty], [0, 0, 1, tz], [0, 0, 0, 1]]
    S = [[sx, 0, 0, 0], [0, sy, 0, 0], [0, 0, sz, 0], [0, 0, 0, 1]]
    node.pop("rotation", None)
    node.pop("scale", None)
    node.pop("translation", None)
    node["matrix"] = to_col_major(mat_mul(mat_mul(T, S), M))
    return size, [s * k for s, k in zip((sx, sy, sz), size)]


def bake_transform(js, fit):
    """node 上烘焙 T·S·R，让模型输出即为目标尺寸（长度 z / 宽度 x / 高度 y）。"""
    node = js["nodes"][0]
    L, W, H = fit
    r = node.get("rotation", [0, 0, 0, 1])
    R = quat_matrix(r)

    acc = js["accessors"][0]
    mn, mx = acc["min"], acc["max"]
    corners = [[mn[0] if i & 1 else mx[0], mn[1] if i & 2 else mx[1], mn[2] if i & 4 else mx[2]]
               for i in range(8)]
    world = [[sum(R[i][k] * c[k] for k in range(3)) for i in range(3)] for c in corners]
    wmin = [min(p[i] for p in world) for i in range(3)]
    wmax = [max(p[i] for p in world) for i in range(3)]
    size = [wmax[i] - wmin[i] for i in range(3)]
    center = [(wmax[i] + wmin[i]) / 2 for i in range(3)]

    sx, sy, sz = W / size[0], H / size[1], L / size[2]
    tx, ty, tz = -center[0] * sx, -wmin[1] * sy, -center[2] * sz

    T = [[1, 0, 0, tx], [0, 1, 0, ty], [0, 0, 1, tz], [0, 0, 0, 1]]
    S = [[sx, 0, 0, 0], [0, sy, 0, 0], [0, 0, sz, 0], [0, 0, 0, 1]]
    R4 = [[R[i][j] if i < 3 and j < 3 else (1 if i == j else 0) for j in range(4)] for i in range(4)]

    M = mat_mul(mat_mul(T, S), R4)
    node.pop("rotation", None)
    node.pop("scale", None)
    node.pop("translation", None)
    node["matrix"] = to_col_major(M)
    return (sx, sy, sz), (size, [s * k for s, k in zip((sx, sy, sz), size)])


def shrink_images(js, bin_chunk, base_size, misc_size):
    from PIL import Image
    new_images = {}
    for i, img in enumerate(js.get("images", [])):
        bv = js["bufferViews"][img["bufferView"]]
        start = bv.get("byteOffset", 0)
        raw = bin_chunk[start:start + bv["byteLength"]]
        im = Image.open(io.BytesIO(raw))
        name = img.get("name", "")
        target = base_size if "metallic" not in name and "normal" not in name else misc_size
        im = im.convert("RGB")
        if max(im.size) > target:
            im.thumbnail((target, target), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=88, optimize=True, progressive=False)
        new_images[img["bufferView"]] = buf.getvalue()
        img["mimeType"] = "image/jpeg"
        print("  img[%d] %-52s %6d KB -> %4d KB (%dx%d)" % (
            i, name[-52:], len(raw) // 1024, len(buf.getvalue()) // 1024, im.size[0], im.size[1]),
            file=sys.stderr)
    return new_images


def repack(js, bin_chunk, replacements):
    out = bytearray()
    for i, bv in enumerate(js["bufferViews"]):
        data = replacements.get(i)
        if data is None:
            start = bv.get("byteOffset", 0)
            data = bin_chunk[start:start + bv["byteLength"]]
        pad = (4 - len(out) % 4) % 4
        out.extend(b"\x00" * pad)
        bv["byteOffset"] = len(out)
        bv["byteLength"] = len(data)
        out.extend(data)
    js["buffers"] = [{"byteLength": len(out)}]
    return bytes(out)


def strip_extensions(js):
    js.pop("extensionsUsed", None)
    for m in js.get("materials", []):
        m.pop("extensions", None)
        m["doubleSided"] = True
        m["pbrMetallicRoughness"]["metallicFactor"] = 1.0
        m["pbrMetallicRoughness"]["roughnessFactor"] = 1.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="src", required=True)
    ap.add_argument("--out", dest="dst", required=True)
    ap.add_argument("--fit", default="", help="L,W,H 以米为单位")
    ap.add_argument("--refit", default="", help="只重新标定已处理好的 GLB（L,W,H），不动贴图")
    ap.add_argument("--base", type=int, default=1024)
    ap.add_argument("--misc", type=int, default=512)
    args = ap.parse_args()

    js, bin_chunk = read_glb(args.src)

    if args.refit:
        fit = [float(v) for v in args.refit.split(",")]
        raw, new = refit(js, fit)
        print("[refit] %.3f x %.3f x %.3f -> %.3f x %.3f x %.3f" % (
            raw[0], raw[1], raw[2], new[0], new[1], new[2]), file=sys.stderr)
        write_glb(args.dst, js, bin_chunk)
        import os
        print("[out] %s  %.2f MB" % (args.dst, os.path.getsize(args.dst) / 1048576.0), file=sys.stderr)
        return

    if args.fit:
        fit = [float(v) for v in args.fit.split(",")]
        scale, (raw_size, new_size) = bake_transform(js, fit)
        print("[fit] raw %.3f x %.3f x %.3f -> %.3f x %.3f x %.3f" % (
            raw_size[0], raw_size[1], raw_size[2], new_size[0], new_size[1], new_size[2]),
            file=sys.stderr)
    strip_extensions(js)
    reps = shrink_images(js, bin_chunk, args.base, args.misc)
    bin2 = repack(js, bin_chunk, reps)
    write_glb(args.dst, js, bin2)
    import os
    print("[out] %s  %.2f MB" % (args.dst, os.path.getsize(args.dst) / 1048576.0), file=sys.stderr)


if __name__ == "__main__":
    main()
