#!/usr/bin/env python3
"""Turn a Quaternius animation glTF/GLB into the game's clip file.

The outfit kit only ships a rig — no real animation data. The matching clips
live in the free "Universal Animation Library" (same Humanoid skeleton, bone
names identical to Male_Ranger), so this tool converts one of those files into
`game/assets/character/clips.json`, which the game picks up automatically.

usage:
  python tools/extract-clip.py <file.glb|file.gltf> [ClipName ...]
  python tools/extract-clip.py            # 内置的服装包文件（只有一段静态姿势）

Without clip names every animation in the file is converted.
"""

import base64
import json
import os
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SRC = ('H:/minimax/youxi2/xiaozhen/Modular Character Outfits - Fantasy[Standard]/'
               'Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/'
               'Modular Parts/Female_Peasant_Body.gltf')
OUT = os.path.join(ROOT, 'assets/character/clips.json')

NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

# 角色前跑的自然速度估计，用来把播放速度对齐到实际位移（可按需改）
NATURAL_SPEED = {
    'walk': 1.5,
    'jog': 3.4,
    'run': 4.8,
    'sprint': 6.0,
}


def load_gltf(path):
    with open(path, 'r', encoding='utf-8') as fh:
        gltf = json.load(fh)
    raw = None
    if gltf.get('buffers'):
        uri = gltf['buffers'][0].get('uri', '')
        if uri.startswith('data:'):
            raw = base64.b64decode(uri.split(',', 1)[1])
        elif uri:
            with open(os.path.join(os.path.dirname(path), uri), 'rb') as fh:
                raw = fh.read()
    return gltf, raw


def read_accessor(gltf, raw, index):
    acc = gltf['accessors'][index]
    n = NCOMP[acc['type']]
    count = acc['count']
    if 'bufferView' not in acc or raw is None:
        return [tuple([0.0] * n)] * count
    view = gltf['bufferViews'][acc['bufferView']]
    offset = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    stride = view.get('byteStride')
    tight = n * 4
    if stride and stride != tight:
        return [struct.unpack_from('<%df' % n, raw, offset + i * stride) for i in range(count)]
    vals = struct.unpack_from('<%df' % (count * n), raw, offset)
    return [vals[i * n:(i + 1) * n] for i in range(count)]


def natural_speed(name):
    low = name.lower()
    for key, speed in NATURAL_SPEED.items():
        if key in low:
            return speed
    return 3.0


def convert(gltf, raw, wanted=None):
    clips = []
    for anim in gltf.get('animations', []):
        name = anim.get('name') or 'clip'
        if wanted and name not in wanted:
            continue
        tracks = {}
        times = None
        moving = 0
        for ch in anim['channels']:
            node = gltf['nodes'][ch['target']['node']]
            bone = node.get('name')
            if ch['target']['path'] != 'rotation' or not bone:
                continue
            sampler = anim['samplers'][ch['sampler']]
            t = [round(v[0], 5) for v in read_accessor(gltf, raw, sampler['input'])]
            quats = read_accessor(gltf, raw, sampler['output'])
            flat = []
            for q in quats:
                x, y, z, w = q
                flat.extend((round(x, 4), round(y, 4), round(z, 4), round(w, 4)))
            # 丢掉从头到尾没变化（=导出残留的静态姿势）的轨道
            if max(max(flat[i::4]) - min(flat[i::4]) for i in range(4)) < 0.002:
                continue
            moving += 1
            tracks[bone] = flat
            times = t
        if not tracks:
            print(f'  ! {name}: 所有轨道都是常量（静态姿势），跳过')
            continue
        clips.append({
            'name': name,
            'duration': round(times[-1], 5),
            'naturalSpeed': natural_speed(name),
            'times': times,
            'tracks': tracks,
        })
        print(f'  {name}: {len(tracks)} 骨骼轨道 × {len(times)} 关键帧, '
              f'{clips[-1]["duration"]}s, 自然速度 {clips[-1]["naturalSpeed"]} m/s')
    return clips


def main():
    if len(sys.argv) > 1:
        src = sys.argv[1]
        wanted = sys.argv[2:] or None
    else:
        src = DEFAULT_SRC
        wanted = None

    gltf, raw = load_gltf(src)
    print(f'== {os.path.basename(src)}  animations: {len(gltf.get("animations", []))}')
    clips = convert(gltf, raw, wanted)
    if not clips:
        print('  没有可用的动画轨道。')
        if os.path.exists(OUT) and os.path.abspath(src) == os.path.abspath(DEFAULT_SRC):
            os.remove(OUT)
            print(f'  已移除旧的 {OUT}')
        return

    merged = []
    if os.path.exists(OUT):
        try:
            merged = json.load(open(OUT, encoding='utf-8')).get('clips', [])
        except Exception:
            merged = []
    by_name = {c['name']: c for c in merged}
    for c in clips:
        by_name[c['name']] = c
    out = {'clips': list(by_name.values())}

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, separators=(',', ':'))
    print(f'  -> {OUT} ({os.path.getsize(OUT)/1024:.1f} KB, {len(out["clips"])} clips)')


if __name__ == '__main__':
    main()
