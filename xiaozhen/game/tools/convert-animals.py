#!/usr/bin/env python3
"""Repack rigged glTFs (animals / characters) into small GLBs for mobile.

The source files are ~3 MB each: 12-13 clips of base64 animation, and every
material primitive carries a full copy of the whole mesh. This script

  * keeps only Idle / Walk / Gallop
  * drops constant scale tracks
  * halves the Idle keyframes (slow clip, 15 fps is plenty)
  * compacts each primitive down to the vertices it actually indexes
  * writes one tightly packed .glb

usage: python tools/convert-animals.py [name ...]
"""

import base64
import json
import os
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = ('H:/minimax/youxi2/xiaozhen/Ultimate Animated Animals - July 2021-'
       '20261025T132851Z-1-001/Ultimate Animated Animals - July 2021/glTF')
OUT_DIR = os.path.join(ROOT, 'assets/animals')

KEEP_CLIPS = ['Idle', 'Walk', 'Gallop']
ANIMALS = ['Deer', 'Fox', 'Donkey', 'Cow', 'Alpaca', 'ShibaInu']

_DST_OVERRIDE = None

COMP_SIZE = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
COMP_FMT = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
TYPE_N = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


class Builder:
    def __init__(self):
        self.blob = bytearray()
        self.views = []
        self.accessors = []

    def add_raw(self, data):
        while len(self.blob) % 4:
            self.blob.append(0)
        self.views.append({'buffer': 0, 'byteOffset': len(self.blob), 'byteLength': len(data)})
        self.blob += data
        return len(self.views) - 1

    def add_accessor(self, acc, data):
        acc = dict(acc)
        acc['bufferView'] = self.add_raw(data)
        acc.pop('byteOffset', None)
        self.accessors.append(acc)
        return len(self.accessors) - 1


def load(path):
    with open(path, 'r', encoding='utf-8') as fh:
        gltf = json.load(fh)
    uri = gltf['buffers'][0].get('uri', '')
    if uri.startswith('data:'):
        raw = base64.b64decode(uri.split(',', 1)[1])
    else:
        with open(os.path.join(os.path.dirname(path), uri), 'rb') as fh:
            raw = fh.read()
    return gltf, raw


def read_elements(gltf, raw, index):
    """returns (bytes_per_element, [element bytes])"""
    acc = gltf['accessors'][index]
    n = TYPE_N[acc['type']]
    comp = COMP_SIZE[acc['componentType']]
    tight = n * comp
    count = acc['count']
    if 'bufferView' not in acc:
        return tight, [bytes(tight)] * count
    view = gltf['bufferViews'][acc['bufferView']]
    base = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    stride = view.get('byteStride') or tight
    if stride == tight:
        body = raw[base:base + count * tight]
        return tight, [body[i * tight:(i + 1) * tight] for i in range(count)]
    return tight, [raw[base + i * stride: base + i * stride + tight] for i in range(count)]


def pack_elements(data, tight):
    return b''.join(data)


def is_constant(gltf, raw, index, value, eps=2e-3):
    acc = gltf['accessors'][index]
    if acc['componentType'] != 5126:
        return False
    n = TYPE_N[acc['type']]
    _, elems = read_elements(gltf, raw, index)
    for el in elems:
        vals = struct.unpack('<%df' % n, el)
        for c in range(n):
            if abs(vals[c] - value) > eps:
                return False
    return True


def convert(name):
    src_path = os.path.join(SRC, f'{name}.gltf')
    gltf, raw = load(src_path)

    clips = [a for a in gltf.get('animations', []) if a['name'] in KEEP_CLIPS]
    if not clips:
        print(f'  ! {name}: no target clips')
        return None

    dropped = 0
    for clip in clips:
        keep = []
        for ch in clip['channels']:
            if ch['target']['path'] == 'scale':
                s = clip['samplers'][ch['sampler']]
                if is_constant(gltf, raw, s['output'], 1.0):
                    dropped += 1
                    continue
            keep.append(ch)
        clip['channels'] = keep
        used = {ch['sampler'] for ch in clip['channels']}
        remap, samplers = {}, []
        for i, s in enumerate(clip['samplers']):
            if i in used:
                remap[i] = len(samplers)
                samplers.append(s)
        clip['samplers'] = samplers
        for ch in clip['channels']:
            ch['sampler'] = remap[ch['sampler']]

    b = Builder()

    # ---- meshes: compact each primitive down to referenced vertices ----
    for mesh in gltf['meshes']:
        for prim in mesh['primitives']:
            idx_acc = gltf['accessors'][prim['indices']]
            tight_i, elems_i = read_elements(gltf, raw, prim['indices'])
            fmt_i = '<' + COMP_FMT[idx_acc['componentType']]
            index_list = [struct.unpack(fmt_i, el)[0] for el in elems_i]
            used = sorted(set(index_list))
            lut = {old: new for new, old in enumerate(used)}

            for attr, acc_index in list(prim['attributes'].items()):
                src_acc = gltf['accessors'][acc_index]
                tight, elems = read_elements(gltf, raw, acc_index)
                if attr == 'WEIGHTS_0' and src_acc['componentType'] == 5126:
                    keep = [elems[i] for i in used]
                    out_w = bytearray()
                    for el in keep:
                        w = struct.unpack('<4f', el)
                        total = sum(w) or 1.0
                        out_w += struct.pack('<4H', *[min(65535, max(0, int(round(v / total * 65535))))
                                                      for v in w])
                    prim['attributes'][attr] = b.add_accessor(
                        {'componentType': 5123, 'type': 'VEC4', 'normalized': True,
                         'count': len(keep)}, bytes(out_w))
                    continue
                packed = pack_elements([elems[i] for i in used], tight)
                new_acc = {k: v for k, v in src_acc.items()
                           if k in ('componentType', 'type', 'normalized', 'min', 'max')}
                new_acc['count'] = len(used)
                if attr == 'POSITION':
                    # min/max must follow the compaction
                    comp = COMP_SIZE[src_acc['componentType']]
                    n = TYPE_N[src_acc['type']]
                    if comp == 4 and src_acc['componentType'] == 5126:
                        vals = struct.unpack('<%df' % (len(packed) // 4), packed)
                        cols = [[vals[i * n + c] for i in range(len(used))] for c in range(n)]
                        new_acc['min'] = [min(c) for c in cols]
                        new_acc['max'] = [max(c) for c in cols]
                prim['attributes'][attr] = b.add_accessor(new_acc, packed)

            remapped = [lut[i] for i in index_list]
            if max(remapped) < 65536:
                packed_idx = b''.join(struct.pack('<H', i) for i in remapped)
                prim['indices'] = b.add_accessor(
                    {'componentType': 5123, 'type': 'SCALAR', 'count': len(remapped)}, packed_idx)
            else:
                packed_idx = b''.join(struct.pack('<I', i) for i in remapped)
                prim['indices'] = b.add_accessor(
                    {'componentType': 5125, 'type': 'SCALAR', 'count': len(remapped)}, packed_idx)

    # ---- skins ----
    for skin in gltf.get('skins', []):
        if 'inverseBindMatrices' in skin:
            old = skin['inverseBindMatrices']
            acc = gltf['accessors'][old]
            tight, elems = read_elements(gltf, raw, old)
            skin['inverseBindMatrices'] = b.add_accessor(
                {k: v for k, v in acc.items() if k in ('componentType', 'type', 'count')},
                pack_elements(elems, tight))

    # ---- animation samplers (Idle gets halved) ----
    decimated = 0
    for clip in clips:
        for s in clip['samplers']:
            in_acc = gltf['accessors'][s['input']]
            count = in_acc['count']
            keep_ids = None
            if clip['name'] == 'Idle' and count > 60:
                keep_ids = list(range(0, count, 2))
                if keep_ids[-1] != count - 1:
                    keep_ids.append(count - 1)
                decimated += 1
            for key in ('input', 'output'):
                old = s[key]
                acc = gltf['accessors'][old]
                tight, elems = read_elements(gltf, raw, old)
                if keep_ids:
                    elems = [elems[i] for i in keep_ids]
                keys = ('componentType', 'type', 'normalized')
                if not keep_ids:
                    keys += ('min', 'max')
                new_acc = {k: v for k, v in acc.items() if k in keys}
                new_acc['count'] = len(elems)
                s[key] = b.add_accessor(new_acc, pack_elements(elems, tight))

    out = {
        'asset': {'version': '2.0', 'generator': 'mossbrook animal kit'},
        'scene': gltf.get('scene', 0),
        'scenes': gltf['scenes'],
        'nodes': gltf['nodes'],
        'meshes': gltf['meshes'],
        'accessors': b.accessors,
        'bufferViews': b.views,
        'buffers': [{'byteLength': len(b.blob)}],
        'animations': clips,
    }
    for key in ('materials', 'skins', 'textures', 'images', 'samplers'):
        if key in gltf:
            out[key] = gltf[key]

    blob = b.blob
    while len(blob) % 4:
        blob.append(0)
    js = json.dumps(out, separators=(',', ':')).encode('utf-8')
    while len(js) % 4:
        js += b' '
    total = 12 + 8 + len(js) + 8 + len(blob)
    glb = bytearray()
    glb += struct.pack('<III', 0x46546C67, 2, total)
    glb += struct.pack('<II', len(js), 0x4E4F534A) + js
    glb += struct.pack('<II', len(blob), 0x004E4942) + bytes(blob)

    os.makedirs(OUT_DIR, exist_ok=True)
    dst = os.path.join(OUT_DIR, f'{name.lower()}.glb')
    if _DST_OVERRIDE:
        dst = _DST_OVERRIDE
    with open(dst, 'wb') as fh:
        fh.write(glb)
    verts = sum(gltf['accessors'][p['attributes']['POSITION']]['count']
                for m in gltf['meshes'] for p in m['primitives'])
    print(f'  {name:10s} {os.path.getsize(src_path)/1024:7.0f} KB -> {len(glb)/1024:6.1f} KB '
          f'| verts {verts:5d} | scale-tracks -{dropped} | idle-dec -{decimated}')
    return {'name': name.lower(), 'size': len(glb), 'verts': verts,
            'clips': [c['name'] for c in clips]}


def pack_one(src_path, dst_path, keep):
    """通用入口：任意带 skin + 动画的 glTF/GLB -> 精简 GLB"""
    global KEEP_CLIPS, SRC, OUT_DIR, _DST_OVERRIDE
    _DST_OVERRIDE = dst_path
    KEEP_CLIPS = keep
    SRC = os.path.dirname(src_path)
    name = os.path.splitext(os.path.basename(src_path))[0]
    OUT_DIR = os.path.dirname(dst_path) or OUT_DIR
    return convert(name)


def main():
    args = sys.argv[1:]
    if '--src' in args:
        src = args[args.index('--src') + 1]
        dst = args[args.index('--out') + 1]
        keep = args[args.index('--keep') + 1].split(',')
        pack_one(src, dst, keep)
        return

    names = sys.argv[1:] or ANIMALS
    results = []
    for name in names:
        print(f'[{name}]')
        r = convert(name)
        if r:
            results.append(r)
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, 'animals.json'), 'w', encoding='utf-8') as fh:
        json.dump({r['name']: {'clips': r['clips']} for r in results}, fh, indent=2)
    print(f"\ntotal {len(results)} animals, {sum(r['size'] for r in results)/1024/1024:.2f} MB")


if __name__ == '__main__':
    main()
