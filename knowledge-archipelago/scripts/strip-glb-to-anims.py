"""把带模型/贴图的 GLB 精简成「只有骨骼与动画」的小文件。

mox/ren 里的每个 FBX 都是 19MB（角色 + 贴图 + 一段动作），
但游戏里只需要动作本身，所以这里丢掉网格、材质、贴图、蒙皮，
只保留节点层级与 animation，再把动画用到的那部分二进制重新打包。

用法：python scripts/strip-glb-to-anims.py <in.glb> <out.glb> [clip-name]
"""
import json
import struct
import sys
from pathlib import Path


def read_glb(path: Path):
    data = path.read_bytes()
    magic, _, length = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, "not a glb"
    offset = 12
    gltf = None
    blob = b""
    while offset < length:
        chunk_len, chunk_type = struct.unpack_from("<II", data, offset)
        chunk = data[offset + 8: offset + 8 + chunk_len]
        if chunk_type == 0x4E4F534A:
            gltf = json.loads(chunk.decode("utf-8"))
        elif chunk_type == 0x004E4942:
            blob = chunk
        offset += 8 + chunk_len
    return gltf, blob


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
    clip_name = sys.argv[3] if len(sys.argv) > 3 else None

    gltf, blob = read_glb(src)
    animations = gltf.get("animations", [])
    if not animations:
        raise SystemExit("no animations in " + str(src))

    # 只留 animation 用到的 accessor / bufferView
    used_accessors = set()
    for anim in animations:
        for sampler in anim.get("samplers", []):
            used_accessors.add(sampler["input"])
            used_accessors.add(sampler["output"])

    accessors = []
    accessor_map = {}
    for old_index in sorted(used_accessors):
        accessor_map[old_index] = len(accessors)
        accessors.append(gltf["accessors"][old_index])

    used_views = []
    view_map = {}
    for accessor in accessors:
        view_index = accessor.get("bufferView")
        if view_index is None:
            continue
        if view_index not in view_map:
            view_map[view_index] = len(used_views)
            used_views.append(gltf["bufferViews"][view_index])
        accessor["bufferView"] = view_map[view_index]

    for accessor in accessors:
        sparse = accessor.get("sparse")
        if sparse:
            view = sparse["indices"]["bufferView"]
            if view not in view_map:
                view_map[view] = len(used_views)
                used_views.append(gltf["bufferViews"][view])
            sparse["indices"]["bufferView"] = view_map[view]
            view = sparse["values"]["bufferView"]
            if view not in view_map:
                view_map[view] = len(used_views)
                used_views.append(gltf["bufferViews"][view])
            sparse["values"]["bufferView"] = view_map[view]

    # 重排二进制
    new_blob = bytearray()
    for view in used_views:
        start = view.get("byteOffset", 0)
        payload = blob[start:start + view["byteLength"]]
        while len(new_blob) % 4:
            new_blob.append(0)
        view["byteOffset"] = len(new_blob)
        view["byteLength"] = len(payload)
        new_blob.extend(payload)

    for anim in animations:
        for sampler in anim.get("samplers", []):
            sampler["input"] = accessor_map[sampler["input"]]
            sampler["output"] = accessor_map[sampler["output"]]
        if clip_name:
            anim["name"] = clip_name

    # 丢掉网格 / 材质 / 贴图 / 蒙皮，只留节点层级
    for node in gltf.get("nodes", []):
        node.pop("mesh", None)
        node.pop("skin", None)
    for key in ("meshes", "materials", "textures", "images", "samplers", "skins"):
        gltf.pop(key, None)

    gltf["accessors"] = accessors
    gltf["bufferViews"] = used_views
    gltf["buffers"] = [{"byteLength": len(new_blob)}]
    gltf["animations"] = animations

    write_glb(dst, gltf, bytes(new_blob))
    print(f"{dst.name}: {dst.stat().st_size / 1024:.0f} KB, {len(animations)} anim(s)")


if __name__ == "__main__":
    main()
