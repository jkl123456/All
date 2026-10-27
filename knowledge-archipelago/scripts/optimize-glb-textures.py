"""把 GLB 里内嵌的贴图缩小，重写二进制块。

用法：python scripts/optimize-glb-textures.py <in.glb> <out.glb> [max_size]
"""
import io
import json
import struct
import sys
from pathlib import Path

from PIL import Image


def read_glb(path: Path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, "not a glb"
    offset = 12
    json_chunk = None
    bin_chunk = b""
    while offset < length:
        chunk_len, chunk_type = struct.unpack_from("<II", data, offset)
        chunk = data[offset + 8: offset + 8 + chunk_len]
        if chunk_type == 0x4E4F534A:
            json_chunk = json.loads(chunk.decode("utf-8"))
        elif chunk_type == 0x004E4942:
            bin_chunk = chunk
        offset += 8 + chunk_len
    return json_chunk, bin_chunk


def write_glb(path: Path, gltf: dict, blob: bytes):
    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)
    blob += b"\x00" * ((4 - len(blob) % 4) % 4)
    total = 12 + 8 + len(json_bytes) + 8 + len(blob)
    with path.open("wb") as fh:
        fh.write(struct.pack("<III", 0x46546C67, 2, total))
        fh.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))
        fh.write(json_bytes)
        fh.write(struct.pack("<II", len(blob), 0x004E4942))
        fh.write(blob)


def main():
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    max_size = int(sys.argv[3]) if len(sys.argv) > 3 else 512
    gltf, blob = read_glb(src)

    image_views = {}
    for image in gltf.get("images", []):
        view_index = image.get("bufferView")
        if view_index is None:
            continue
        view = gltf["bufferViews"][view_index]
        start = view.get("byteOffset", 0)
        raw = blob[start:start + view["byteLength"]]
        try:
            img = Image.open(io.BytesIO(raw))
        except Exception:
            continue
        if max(img.size) > max_size:
            img.thumbnail((max_size, max_size), Image.LANCZOS)
        buffer = io.BytesIO()
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA")
        img.save(buffer, format="PNG", optimize=True)
        image_views[view_index] = buffer.getvalue()
        print(f"{image.get('name', view_index)}: {img.size} -> {len(buffer.getvalue()) // 1024} KB")

    # 重排二进制块：image bufferView 用新数据，其余原样
    ordered = sorted(range(len(gltf["bufferViews"])), key=lambda i: gltf["bufferViews"][i].get("byteOffset", 0))
    new_blob = bytearray()
    for index in ordered:
        view = gltf["bufferViews"][index]
        if index in image_views:
            payload = image_views[index]
        else:
            start = view.get("byteOffset", 0)
            payload = blob[start:start + view["byteLength"]]
        while len(new_blob) % 4:
            new_blob.append(0)
        view["byteOffset"] = len(new_blob)
        view["byteLength"] = len(payload)
        new_blob.extend(payload)

    gltf["buffers"] = [{"byteLength": len(new_blob)}]
    write_glb(dst, gltf, bytes(new_blob))
    print(f"{dst} -> {dst.stat().st_size / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
