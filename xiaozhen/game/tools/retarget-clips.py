#!/usr/bin/env python3
"""把别的骨架上的动画重定向到游戏主角的骨架上。

两个角色都是 Humanoid，但骨骼命名和静止姿势不同（Mixamo 是 A-pose，
Adventurer 也是 A-pose 但命名不同），所以不能用"同名骨骼直接拷贝旋转"，而是：

  1. 取源骨骼在某一帧的"世界朝向"相对其静止朝向的增量 D
  2. 把 D 乘到目标骨骼的静止世界朝向上
  3. 再换算回目标骨骼的局部空间（父级用重定向后的结果）

这样手臂、腿的摆动方向都对得上，静止姿势的差异也能保留下来。
胯部还会搬运位移（按身高比例缩放），跑动的上下起伏才不会丢。

usage:
  python tools/retarget-clips.py --src src.glb --preset mixamo [--dst x.glb] [--out clips.json]
"""

import json
import math
import os
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST_DEFAULT = os.path.join(ROOT, 'assets/character/adventurer.glb')
OUT_DEFAULT = os.path.join(ROOT, 'assets/character/clips_pistol.json')

# --layer 用的骨骼分组：上半身层交给持枪动作，下半身层保持原生走跑
UPPER_BONES = ('Abdomen', 'Torso', 'Chest', 'Neck', 'Head',
               'Shoulder', 'UpperArm', 'LowerArm', 'Wrist')
LOWER_BONES = ('Hips', 'UpperLeg', 'LowerLeg', 'Foot', 'PT')

# 源骨骼 -> 目标骨骼（目标名用 glTF 里的原始写法，比较时再 sanitize）
PRESETS = {
    # Mixamo 骨架（mixamorig:*） -> Universal/Adventurer 骨架
    'mixamo': {
        'Hips': 'Hips',
        'Spine': 'Abdomen',
        'Spine1': 'Torso',
        'Spine2': 'Chest',
        'Neck': 'Neck',
        'Head': 'Head',
        'LeftShoulder': 'Shoulder.L',
        'LeftArm': 'UpperArm.L',
        'LeftForeArm': 'LowerArm.L',
        'LeftHand': 'Wrist.L',
        'LeftUpLeg': 'UpperLeg.L',
        'LeftLeg': 'LowerLeg.L',
        'LeftFoot': 'Foot.L',
        'LeftToeBase': 'PT.L',
        'RightShoulder': 'Shoulder.R',
        'RightArm': 'UpperArm.R',
        'RightForeArm': 'LowerArm.R',
        'RightHand': 'Wrist.R',
        'RightUpLeg': 'UpperLeg.R',
        'RightLeg': 'LowerLeg.R',
        'RightFoot': 'Foot.R',
        'RightToeBase': 'PT.R',
    },
    # 主角 Universal/Adventurer 骨架 -> Mixamo 骨架（用于把原生动作搬到 Mixamo 角色上）
    'adventurer2mixamo': {
        'Hips': 'Hips',
        'Abdomen': 'Spine',
        'Torso': 'Spine1',
        'Chest': 'Spine2',
        'Neck': 'Neck',
        'Head': 'Head',
        'Shoulder.L': 'LeftShoulder',
        'UpperArm.L': 'LeftArm',
        'LowerArm.L': 'LeftForeArm',
        'Wrist.L': 'LeftHand',
        'UpperLeg.L': 'LeftUpLeg',
        'LowerLeg.L': 'LeftLeg',
        'Foot.L': 'LeftFoot',
        'PT.L': 'LeftToeBase',
        'Shoulder.R': 'RightShoulder',
        'UpperArm.R': 'RightArm',
        'LowerArm.R': 'RightForeArm',
        'Wrist.R': 'RightHand',
        'UpperLeg.R': 'RightUpLeg',
        'LowerLeg.R': 'RightLeg',
        'Foot.R': 'RightFoot',
        'PT.R': 'RightToeBase',
    },
    'mudeater': {
        'pelvis': 'Hips',
        'spine1': 'Abdomen',
        'spine2': 'Torso',
        'spine3': 'Chest',
        'neck': 'Neck',
        'head': 'Head',
        'shoulder_L': 'Shoulder.L',
        'upperarm_L': 'UpperArm.L',
        'forearm_L': 'LowerArm.L',
        'hand_L': 'Wrist.L',
        'upperleg_L': 'UpperLeg.L',
        'lowerleg_L': 'LowerLeg.L',
        'foot_L': 'Foot.L',
        'toe_L': 'PT.L',
        'shoulder_R': 'Shoulder.R',
        'upperarm_R': 'UpperArm.R',
        'forearm_R': 'LowerArm.R',
        'hand_R': 'Wrist.R',
        'upperleg_R': 'UpperLeg.R',
        'lowerleg_R': 'LowerLeg.R',
        'foot_R': 'Foot.R',
        'toe_R': 'PT.R',
    },
}


# ---------------------------------------------------------------- quat

def q_mul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    )


def q_inv(q):
    x, y, z, w = q
    n = x * x + y * y + z * z + w * w or 1.0
    return (-x / n, -y / n, -z / n, w / n)


def q_norm(q):
    x, y, z, w = q
    n = math.sqrt(x * x + y * y + z * z + w * w) or 1.0
    return (x / n, y / n, z / n, w / n)


def q_from_to(a, b):
    """把向量 a 转到 b 的最短弧四元数"""
    ax, ay, az = a
    bx, by, bz = b
    d = ax * bx + ay * by + az * bz
    if d > 0.999999:
        return (0.0, 0.0, 0.0, 1.0)
    if d < -0.999999:
        # 反向：绕任意垂直轴转 180°
        axis = (0.0, 0.0, 0.0)
        if abs(ax) < 0.9:
            axis = (-az, 0.0, ax)
        else:
            axis = (0.0, -az, ay)
        n = math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2) or 1.0
        return (axis[0] / n, axis[1] / n, axis[2] / n, 0.0)
    cx = ay * bz - az * by
    cy = az * bx - ax * bz
    cz = ax * by - ay * bx
    return q_norm((cx, cy, cz, 1.0 + d))


def q_twist_y(q):
    """提取绕本地 Y 轴的自转角"""
    x, y, z, w = q
    n = math.sqrt(y * y + w * w)
    if n < 1e-8:
        return 0.0
    return 2.0 * math.atan2(y / n, w / n)


def q_axis_angle(axis, angle):
    h = angle * 0.5
    s = math.sin(h)
    return (axis[0] * s, axis[1] * s, axis[2] * s, math.cos(h))


def v_apply(q, v):
    x, y, z, w = q
    vx, vy, vz = v
    tx = 2 * (y * vz - z * vy)
    ty = 2 * (z * vx - x * vz)
    tz = 2 * (x * vy - y * vx)
    return (vx + w * tx + (y * tz - z * ty),
            vy + w * ty + (z * tx - x * tz),
            vz + w * tz + (x * ty - y * tx))


# ---------------------------------------------------------------- glb

NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
CFMT = {5126: 'f', 5123: 'H', 5125: 'I', 5121: 'B'}


def load_glb(path):
    data = open(path, 'rb').read()
    jlen = struct.unpack('<I', data[12:16])[0]
    gltf = json.loads(data[20:20 + jlen])
    bstart = 20 + jlen + 8
    blen = struct.unpack('<I', data[bstart - 8:bstart - 4])[0]
    return gltf, data[bstart:bstart + blen]


def read_accessor(gltf, blob, index):
    acc = gltf['accessors'][index]
    n = NCOMP[acc['type']]
    view = gltf['bufferViews'][acc['bufferView']]
    off = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    fmt = '<' + CFMT[acc['componentType']] * (n * acc['count'])
    vals = struct.unpack_from(fmt, blob, off)
    return [tuple(vals[i * n:(i + 1) * n]) for i in range(acc['count'])]


def hierarchy(gltf):
    nodes = gltf['nodes']
    parent = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []):
            parent[c] = i
    return nodes, parent


def rest_rot(node):
    return tuple(node.get('rotation', (0.0, 0.0, 0.0, 1.0)))


def rest_pos(node):
    return node.get('translation', (0.0, 0.0, 0.0))


def world_rest_rot(nodes, parent, idx):
    chain = []
    i = idx
    while i is not None:
        chain.append(i)
        i = parent.get(i)
    q = (0.0, 0.0, 0.0, 1.0)
    for i in reversed(chain):
        q = q_mul(q, rest_rot(nodes[i]))
    return q


def world_rest_frame(nodes, parent, idx):
    """静止姿态下某个节点的世界位置 / 朝向 / 累计缩放"""
    chain = []
    i = idx
    while i is not None:
        chain.append(i)
        i = parent.get(i)
    q = (0.0, 0.0, 0.0, 1.0)
    sc = (1.0, 1.0, 1.0)
    p = (0.0, 0.0, 0.0)
    for i in reversed(chain):
        t = rest_pos(nodes[i])
        scaled = (t[0] * sc[0], t[1] * sc[1], t[2] * sc[2])
        off = v_apply(q, scaled)
        p = (p[0] + off[0], p[1] + off[1], p[2] + off[2])
        q = q_mul(q, rest_rot(nodes[i]))
        ns = nodes[i].get('scale', (1.0, 1.0, 1.0))
        sc = (sc[0] * ns[0], sc[1] * ns[1], sc[2] * ns[2])
    return p, q, sc


def world_rest_pos(nodes, parent, idx):
    return world_rest_frame(nodes, parent, idx)[0]


def sanitize(name):
    """和 three 的 PropertyBinding.sanitizeNodeName 保持一致"""
    return name.replace('.', '').replace(' ', '_').replace(':', '')


def bone_height(gltf, nodes, parent):
    """骨架身高：Head 与 Foot 的世界高度差（模型没网格时也能算）"""
    idx = {}
    for i, n in enumerate(nodes):
        nm = (n.get('name') or '').split(':')[-1]
        if nm in ('Head', 'HeadTop_End', 'head', 'Foot', 'foot_L', 'LeftFoot', 'RightFoot'):
            idx.setdefault(nm, i)
    head = None
    foot = None
    for k in ('HeadTop_End', 'Head', 'head'):
        if k in idx:
            head = world_rest_pos(nodes, parent, idx[k])
            break
    for k in ('Foot', 'LeftFoot', 'foot_L'):
        if k in idx:
            foot = world_rest_pos(nodes, parent, idx[k])
            break
    if head and foot:
        return abs(head[1] - foot[1])
    return 0.0


def mesh_height(gltf):
    mn, mx = 1e9, -1e9
    for m in gltf.get('meshes', []):
        for p in m['primitives']:
            a = gltf['accessors'][p['attributes']['POSITION']]
            mn = min(mn, a['min'][1])
            mx = max(mx, a['max'][1])
    return max(0.0, mx - mn)


# ---------------------------------------------------------------- retarget

def build_tracks(src, dst, anim, bone_map, height_ratio, mode='delta'):
    src_gltf, src_blob, src_nodes, src_parent = src
    dst_nodes, dst_parent = dst

    times = None
    rot_by_node = {}
    trans_by_node = {}
    for ch in anim['channels']:
        sampler = anim['samplers'][ch['sampler']]
        node = ch['target']['node']
        path = ch['target']['path']
        t = [v[0] for v in read_accessor(src_gltf, src_blob, sampler['input'])]
        vals = read_accessor(src_gltf, src_blob, sampler['output'])
        if times is None or len(t) > len(times):
            times = t
        if path == 'rotation':
            rot_by_node[node] = (t, vals)
        elif path == 'translation':
            trans_by_node[node] = (t, vals)

    # 源骨骼索引（去掉 mixamorig: 前缀再比对）
    src_idx = {}
    for i, n in enumerate(src_nodes):
        nm = (n.get('name') or '').split(':')[-1]
        if nm in bone_map:
            src_idx[nm] = i

    dst_idx = {}
    dst_short = {}
    for i, n in enumerate(dst_nodes):
        nm = n.get('name')
        if not nm:
            continue
        full = sanitize(nm)
        dst_idx[full] = i
        short = full[len('mixamorig'):] if full.startswith('mixamorig') else full
        dst_short[short] = i

    def dst_lookup(name):
        key = sanitize(name)
        if key in dst_idx:
            return dst_idx[key]
        return dst_short.get(key)

    src_rest_world = {k: world_rest_rot(src_nodes, src_parent, i) for k, i in src_idx.items()}
    dst_rest_world = {i: world_rest_rot(dst_nodes, dst_parent, i) for i in dst_idx.values()}

    def depth(i):
        d = 0
        while dst_parent.get(i) is not None:
            i = dst_parent[i]
            d += 1
        return d

    dst_target = {}
    for src_name, dst_name in bone_map.items():
        target = dst_lookup(dst_name)
        if src_name in src_idx and target is not None:
            dst_target[src_idx[src_name]] = target

    tracks = {}
    trans_tracks = {}
    frame_times = []

    # 源胯部的位移要换算到世界空间才能判断"竖直"是哪个分量
    # （Mixamo 的 Armature 节点带 90° 旋转和 0.01 缩放，本地轴和世界轴并不一致）
    pelvis_src_idx = src_idx.get('Hips') or src_idx.get('pelvis')
    pelvis_world = None

    def sample(series, t):
        ts, vals = series
        if t <= ts[0]:
            return vals[0]
        if t >= ts[-1]:
            return vals[-1]
        for i in range(1, len(ts)):
            if ts[i] >= t:
                span = ts[i] - ts[i - 1] or 1.0
                f = (t - ts[i - 1]) / span
                a, b = vals[i - 1], vals[i]
                if len(a) == 4:
                    out = tuple(a[k] + (b[k] - a[k]) * f for k in range(4))
                    return q_norm(out)
                return tuple(a[k] + (b[k] - a[k]) * f for k in range(len(a)))
        return vals[-1]

    if pelvis_src_idx is not None and pelvis_src_idx in trans_by_node:
        pidx = src_parent.get(pelvis_src_idx)
        if pidx is None:
            base_p, base_q, base_s = (0.0, 0.0, 0.0), (0.0, 0.0, 0.0, 1.0), (1.0, 1.0, 1.0)
        else:
            base_p, base_q, base_s = world_rest_frame(src_nodes, src_parent, pidx)

        def world_of(local):
            scaled = (local[0] * base_s[0], local[1] * base_s[1], local[2] * base_s[2])
            off = v_apply(base_q, scaled)
            return (base_p[0] + off[0], base_p[1] + off[1], base_p[2] + off[2])

        ys = sorted(world_of(sample(trans_by_node[pelvis_src_idx], tt))[1] for tt in times)
        ref = ys[len(ys) // 2]
        dst_pelvis_idx = dst_target.get(pelvis_src_idx)
        dp = dst_parent.get(dst_pelvis_idx) if dst_pelvis_idx is not None else None
        dq = world_rest_rot(dst_nodes, dst_parent, dp) if dp is not None else (0.0, 0.0, 0.0, 1.0)
        pelvis_world = {'ref': ref, 'dst_parent_q': dq, 'fn': world_of}

    for t in times:
        src_world = {}

        def src_world_of(i):
            if i in src_world:
                return src_world[i]
            p = src_parent.get(i)
            pq = src_world_of(p) if p is not None else (0.0, 0.0, 0.0, 1.0)
            local = sample(rot_by_node[i], t) if i in rot_by_node else rest_rot(src_nodes[i])
            q = q_mul(pq, local)
            src_world[i] = q
            return q

        dst_world = {}
        for src_i, dst_i in sorted(dst_target.items(), key=lambda kv: depth(kv[1])):
            if mode == 'swing':
                # 摆-转分解：只保证骨骼"指向"和源动画一致，自转量按源动画搬过来。
                # 两套骨架的静止姿势差异（A-pose 角度、骨骼 roll）不会把手臂带歪。
                src_name = src_nodes[src_i]['name'].split(':')[-1]
                src_w = src_world_of(src_i)
                a_s = v_apply(src_w, (0.0, 1.0, 0.0))
                a_d = v_apply(dst_rest_world[dst_i], (0.0, 1.0, 0.0))
                swing = q_from_to(a_d, a_s)
                theta = q_twist_y(q_mul(q_inv(src_rest_world[src_name]), src_w))
                target_world = q_mul(q_mul(swing, dst_rest_world[dst_i]), q_axis_angle((0.0, 1.0, 0.0), theta))
            elif mode == 'world':
                # 直接采用源骨骼的世界朝向：两套骨架静止姿势本来就接近（都是 A-pose），
                # 这样手、脚、手腕的朝向和原动画完全一致，不会因为静止朝向差异被拧 90°。
                target_world = src_world_of(src_i)
            else:
                delta = q_mul(src_world_of(src_i), q_inv(src_rest_world[src_nodes[src_i]['name'].split(':')[-1]]))
                target_world = q_mul(delta, dst_rest_world[dst_i])
            p = dst_parent.get(dst_i)
            parent_world = dst_world.get(p)
            if parent_world is None:
                parent_world = world_rest_rot(dst_nodes, dst_parent, p) if p is not None else (0.0, 0.0, 0.0, 1.0)
            local = q_mul(q_inv(parent_world), target_world)
            dst_world[dst_i] = target_world
            name = sanitize(dst_nodes[dst_i]['name'])
            tracks.setdefault(name, []).extend(q_norm(local))

        # 胯部位移：只搬运"竖直起伏"。
        # 这类 FBX 常常自带根位移（向前跑了 2 米多），直接照搬会把角色拉长；
        # 游戏里前进由代码驱动，所以水平位移丢掉，只留上下的重心起伏。
        pelvis_src = src_idx.get('Hips') or src_idx.get('pelvis')
        if pelvis_src is not None and pelvis_src in trans_by_node and pelvis_world is not None:
            dst_pelvis = dst_target.get(pelvis_src)
            if dst_pelvis is not None:
                local = sample(trans_by_node[pelvis_src], t)
                world = pelvis_world['fn'](local)
                dy = (world[1] - pelvis_world['ref']) * height_ratio
                dbase = rest_pos(dst_nodes[dst_pelvis])
                # 世界 +Y 的位移换算到目标胯部父级空间
                up_local = v_apply(q_inv(pelvis_world['dst_parent_q']), (0.0, dy, 0.0))
                name = sanitize(dst_nodes[dst_pelvis]['name'])
                trans_tracks.setdefault(name, []).extend((
                    dbase[0] + up_local[0], dbase[1] + up_local[1], dbase[2] + up_local[2]))
        frame_times.append(round(t, 5))

    return frame_times, tracks, trans_tracks


def arg(flag, default=None):
    if flag in sys.argv:
        return sys.argv[sys.argv.index(flag) + 1]
    return default


def main():
    src_path = arg('--src')
    if not src_path:
        print('缺少 --src')
        return
    preset = arg('--preset', 'mixamo')
    dst_path = arg('--dst', DST_DEFAULT)
    out_path = arg('--out')
    speed = float(arg('--speed', '0'))
    name_override = arg('--name')
    start = float(arg('--trim-start', '0'))
    mode = arg('--mode', 'delta')
    layer = arg('--layer', 'all')
    only = arg('--clips', '')
    only = set(x.strip() for x in only.split(',') if x.strip())

    bone_map = PRESETS[preset]

    src_gltf, src_blob = load_glb(src_path)
    src_nodes, src_parent = hierarchy(src_gltf)
    dst_gltf, dst_blob = load_glb(dst_path)
    dst_nodes, dst_parent = hierarchy(dst_gltf)

    src_h = mesh_height(src_gltf) or bone_height(src_gltf, src_nodes, src_parent)
    dst_h = mesh_height(dst_gltf) or bone_height(dst_gltf, dst_nodes, dst_parent)
    ratio = dst_h / src_h if src_h else 1.0
    print(f'  身高 源 {src_h:.3f} 目标 {dst_h:.3f} 比例 {ratio:.4f}')

    src = (src_gltf, src_blob, src_nodes, src_parent)
    dst = (dst_nodes, dst_parent)

    clips = []
    for anim in src_gltf.get('animations', []):
        if only:
            short = anim['name'].split('|')[-1]
            if short not in only:
                continue
        times, tracks, trans = build_tracks(src, dst, anim, bone_map, ratio, mode)
        if start > 0:
            # 去掉开头的过渡帧
            keep = [i for i, t in enumerate(times) if t >= start]
            times = [round(t - times[keep[0]], 5) for t in times[keep[0]:]]
            tracks = {k: [x for i in keep for x in v[i * 4:(i + 1) * 4]] for k, v in tracks.items()}
            trans = {k: [x for i in keep for x in v[i * 3:(i + 1) * 3]] for k, v in trans.items()}

        if layer in ('upper', 'lower'):
            keep = UPPER_BONES if layer == 'upper' else LOWER_BONES
            tracks = {k: v for k, v in tracks.items() if k.startswith(keep)}
            if layer == 'upper':
                # 上半身层不带胯部位移，腿才不会被拽走
                trans = {}

        name = name_override or anim['name'].split('|')[-1]
        clip = {
            'name': name,
            'duration': round(times[-1], 4),
            'naturalSpeed': speed,
            'times': times,
            'tracks': {k: [round(x, 4) for x in v] for k, v in tracks.items()},
        }
        if trans:
            clip['translation'] = {k: [round(x, 4) for x in v] for k, v in trans.items()}
        clips.append(clip)
        print(f'  {name}: {len(clip["tracks"])} 骨骼, {len(times)} 帧, {clip["duration"]}s')

    out = out_path or OUT_DEFAULT
    with open(out, 'w', encoding='utf-8') as fh:
        json.dump({'clips': clips}, fh, separators=(',', ':'))
    print(f'  -> {out} ({os.path.getsize(out) / 1024:.1f} KB)')


if __name__ == '__main__':
    main()
