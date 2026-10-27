#!/usr/bin/env python3
"""量一下每段走路/跑步动画的自然移动速度（脚的前后幅度 / 一个周期）。

游戏里把位移速度对齐到这个值，脚才不会打滑。

usage: python tools/measure-clip-speed.py <file.gltf|glb> [clip ...]
"""

import json
import os
import struct
import sys

NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
CFMT = {5126: 'f', 5123: 'H', 5125: 'I', 5121: 'B'}


def load(path):
    with open(path, 'rb') as fh:
        head = fh.read(12)
    if head[:4] == b'glTF':
        data = open(path, 'rb').read()
        jlen = struct.unpack('<I', data[12:16])[0]
        gltf = json.loads(data[20:20 + jlen])
        bstart = 20 + jlen + 8
        blen = struct.unpack('<I', data[bstart - 8:bstart - 4])[0]
        return gltf, data[bstart:bstart + blen]
    gltf = json.load(open(path, encoding='utf-8'))
    uri = gltf['buffers'][0].get('uri', '')
    if uri.startswith('data:'):
        import base64
        return gltf, base64.b64decode(uri.split(',', 1)[1])
    return gltf, open(os.path.join(os.path.dirname(path), uri), 'rb').read()


def read_acc(gltf, blob, index):
    acc = gltf['accessors'][index]
    n = NCOMP[acc['type']]
    view = gltf['bufferViews'][acc['bufferView']]
    off = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    fmt = '<' + CFMT[acc['componentType']] * (n * acc['count'])
    vals = struct.unpack_from(fmt, blob, off)
    return [tuple(vals[i * n:(i + 1) * n]) for i in range(acc['count'])]


def q_mul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw,
            aw * bw - ax * bx - ay * by - az * bz)


def v_apply(q, v):
    x, y, z, w = q
    vx, vy, vz = v
    tx = 2 * (y * vz - z * vy)
    ty = 2 * (z * vx - x * vz)
    tz = 2 * (x * vy - y * vx)
    return (vx + w * tx + (y * tz - z * ty),
            vy + w * ty + (z * tx - x * tz),
            vz + w * tz + (x * ty - y * tx))


def main():
    path = sys.argv[1]
    gltf, blob = load(path)
    nodes = gltf['nodes']
    parent = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []):
            parent[c] = i

    want = sys.argv[2:] or ['walk', 'run', 'jog']
    for clip in gltf.get('animations', []):
        if not any(w in clip['name'].lower() for w in want):
            continue
        rot, trans = {}, {}
        times = None
        for ch in clip['channels']:
            s = clip['samplers'][ch['sampler']]
            node = ch['target']['node']
            t = [v[0] for v in read_acc(gltf, blob, s['input'])]
            vals = read_acc(gltf, blob, s['output'])
            if times is None or len(t) > len(times):
                times = t
            if ch['target']['path'] == 'rotation':
                rot[node] = (t, vals)
            elif ch['target']['path'] == 'translation':
                trans[node] = (t, vals)

        feet = [i for i, n in enumerate(nodes)
                if n.get('name') and n['name'].lower().startswith(('foot', 'toe', 'tarsal'))]
        if not feet:
            continue

        def sample(series, t):
            ts, vals = series
            if t <= ts[0]:
                return vals[0]
            if t >= ts[-1]:
                return vals[-1]
            for k in range(1, len(ts)):
                if ts[k] >= t:
                    f = (t - ts[k - 1]) / max(ts[k] - ts[k - 1], 1e-6)
                    a, b = vals[k - 1], vals[k]
                    return tuple(a[j] + (b[j] - a[j]) * f for j in range(len(a)))
            return vals[-1]

        zs = []
        for t in times:
            world = {}

            def W(i):
                if i in world:
                    return world[i]
                p = parent.get(i)
                pq, pt = W(p) if p is not None else ((0.0, 0.0, 0.0, 1.0), (0.0, 0.0, 0.0))
                lq = sample(rot[i], t) if i in rot else tuple(nodes[i].get('rotation', (0, 0, 0, 1)))
                lt = sample(trans[i], t) if i in trans else tuple(nodes[i].get('translation', (0, 0, 0)))
                q = q_mul(pq, lq)
                off = v_apply(pq, lt)
                world[i] = (q, (pt[0] + off[0], pt[1] + off[1], pt[2] + off[2]))
                return world[i]

            for fi in feet:
                _, pos = W(fi)
                zs.append(pos[2])

        step = max(zs) - min(zs)
        dur = times[-1]
        print(f'  {clip["name"]:16s} 脚前后 {step:5.3f} m · 周期 {dur:4.2f}s '
              f'-> 自然速度 ~{2 * step / dur:4.2f} m/s')


if __name__ == '__main__':
    main()
