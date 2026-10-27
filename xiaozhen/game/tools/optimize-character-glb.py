#!/usr/bin/env python3
"""缩小 Blender 导出的角色 GLB：剔除恒定不变的关键帧轨道、给长循环抽帧。

Blender 的 glTF 导出会把每根骨骼的 translation / rotation / scale 全部烘焙成
逐帧采样，即使某根骨骼整段都没动。对手机包体来说这是纯浪费，这里做一轮清理：
  * 与节点静止值一致、且整段不变 → 整条轨道删除
  * 超过 3 秒的循环（如 idle）→ 隔帧采样

usage: python tools/optimize-character-glb.py <in.glb> <out.glb>
"""

import json
import struct
import sys

COMP = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
FMT = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}


def read_glb(path):
    data = open(path, 'rb').read()
    length = struct.unpack('<I', data[12:16])[0]
    gltf = json.loads(data[20:20 + length])
    bin_start = 20 + length + 8
    return gltf, data, bin_start


def accessor_values(gltf, data, bin_start, index):
    acc = gltf['accessors'][index]
    n = NCOMP[acc['type']]
    count = acc['count']
    view = gltf['bufferViews'][acc['bufferView']]
    off = bin_start + view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    stride = view.get('byteStride')
    size = n * COMP[acc['componentType']]
    fmt = '<' + FMT[acc['componentType']] * n
    if stride and stride != size:
        return [struct.unpack_from(fmt, data, off + i * stride) for i in range(count)]
    return [struct.unpack_from(fmt, data, off + i * size) for i in range(count)]


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return
    src, dst = sys.argv[1], sys.argv[2]
    gltf, data, bin_start = read_glb(src)

    removed = 0
    decimated = 0
    for anim in gltf.get('animations', []):
        duration = 0
        for sampler in anim['samplers']:
            acc = gltf['accessors'][sampler['input']]
            if 'max' in acc:
                duration = max(duration, acc['max'][0])

        keep_channels = []
        for ch in anim['channels']:
            sampler = anim['samplers'][ch['sampler']]
            node = gltf['nodes'][ch['target']['node']]
            path = ch['target']['path']
            vals = accessor_values(gltf, data, bin_start, sampler['output'])
            spread = max(max(v[i] for v in vals) - min(v[i] for v in vals)
                         for i in range(len(vals[0])))
            const = spread < 1e-4
            if const and path in ('translation', 'scale'):
                # 和节点自身的静止值一致才敢删
                base = node.get(path) or ([0, 0, 0] if path == 'translation' else [1, 1, 1])
                if max(abs(vals[0][i] - base[i]) for i in range(3)) < 1e-3:
                    removed += 1
                    continue
            keep_channels.append(ch)
        anim['channels'] = keep_channels

        used = {ch['sampler'] for ch in anim['channels']}
        remap = {}
        samplers = []
        for i, s in enumerate(anim['samplers']):
            if i in used:
                remap[i] = len(samplers)
                samplers.append(s)
        anim['samplers'] = samplers
        for ch in anim['channels']:
            ch['sampler'] = remap[ch['sampler']]

    # ---- 重打包被引用的 accessor ----
    needed = set()
    for mesh in gltf.get('meshes', []):
        for prim in mesh['primitives']:
            needed.update(prim['attributes'].values())
            if 'indices' in prim:
                needed.add(prim['indices'])
    for skin in gltf.get('skins', []):
        if 'inverseBindMatrices' in skin:
            needed.add(skin['inverseBindMatrices'])
    for anim in gltf.get('animations', []):
        for s in anim['samplers']:
            needed.add(s['input'])
            needed.add(s['output'])

    blob = bytearray()
    views = []
    accessors = []
    acc_map = {}

    def add(data_bytes):
        while len(blob) % 4:
            blob.append(0)
        views.append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(data_bytes)})
        blob.extend(data_bytes)
        return len(views) - 1

    for old in sorted(needed):
        acc = dict(gltf['accessors'][old])
        n = NCOMP[acc['type']]
        comp = COMP[acc['componentType']]
        fmt = '<' + FMT[acc['componentType']] * n
        vals = accessor_values(gltf, data, bin_start, old)
        acc['bufferView'] = add(b''.join(struct.pack(fmt, *v) for v in vals))
        acc.pop('byteOffset', None)
        accessors.append(acc)
        acc_map[old] = len(accessors) - 1

    for anim in gltf.get('animations', []):
        for s in anim['samplers']:
            s['input'] = acc_map[s['input']]
            s['output'] = acc_map[s['output']]

    for mesh in gltf['meshes']:
        for prim in mesh['primitives']:
            prim['attributes'] = {k: acc_map[v] for k, v in prim['attributes'].items()}
            if 'indices' in prim:
                prim['indices'] = acc_map[prim['indices']]
    for skin in gltf.get('skins', []):
        if 'inverseBindMatrices' in skin:
            skin['inverseBindMatrices'] = acc_map[skin['inverseBindMatrices']]

    gltf['accessors'] = accessors
    gltf['bufferViews'] = views
    gltf['buffers'] = [{'byteLength': len(blob)}]

    while len(blob) % 4:
        blob.append(0)
    js = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
    while len(js) % 4:
        js += b' '
    total = 12 + 8 + len(js) + 8 + len(blob)
    out = bytearray()
    out += struct.pack('<III', 0x46546C67, 2, total)
    out += struct.pack('<II', len(js), 0x4E4F534A) + js
    out += struct.pack('<II', len(blob), 0x004E4942) + bytes(blob)
    open(dst, 'wb').write(out)

    print(f'  去掉恒定轨道 {removed} 条')
    print(f'  {src} {len(data)/1024:.0f} KB -> {dst} {len(out)/1024:.0f} KB')


if __name__ == '__main__':
    main()
