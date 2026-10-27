#!/usr/bin/env python3
"""Convert Tropical Environment Pack DAE plants into small single-file GLBs.

The source pack is Torque3D / OpenCOLLADA and quite loose with the spec:
  * <matrix> values are written row-major (translation in elements 3/7/11)
  * unit is per-file (inch, cm, meter) and the Y-up rotation is sometimes
    already baked into the node hierarchy
So we bake every node transform, then orient the result by measuring the
vertex cloud (longest axis becomes up, canopy side becomes the top).

usage: python tools/convert-trees.py [name ...]
       python tools/convert-trees.py --preview palm_a
"""

import io
import json
import math
import os
import re
import struct
import sys
import xml.etree.ElementTree as ET

from PIL import Image

NS = '{http://www.collada.org/2005/11/COLLADASchema}'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = ('H:/minimax/1/Tropical_Environment_Pack_v2.0/Tropical_Environment_Pack_v2.0_Ready/'
        'Tropical Rain Forest_Source v2.0/game/art/shapes')
OUT_DIR = os.path.join(ROOT, 'assets/jungle')

# name: (dae path, max texture px, target height in meters or 0 to keep)
TREES = {
    'palm_a':     ('trees/Palms/Palm01.DAE', 512, 0),
    'palm_b':     ('trees/Palms/Palm03.dae', 512, 0),
    'palm_queen': ('trees/QueensPalm/QueensPalm01.DAE', 512, 0),
    'palm_beach': ('trees/BeachPalm/BeachPalm01.DAE', 512, 0),
    'cecropia':   ('trees/Cecropia/CecropiaTree01.DAE', 512, 0),
    'copal':      ('trees/CopalTree/CopalTree01.DAE', 512, 0),
    'banana':     ('trees/Banana/Banana01.DAE', 512, 0),
    'fern':       ('Plants/TropicFern/TropicFern01.DAE', 512, 1.7),
    'bush':       ('Plants/Bush01/Bush01.DAE', 512, 1.25),
    'elephant':   ('Plants/ElephantEar/ElephantEar.DAE', 512, 2.4),
}

# ---------------------------------------------------------------- math


def m_identity():
    return [1.0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 1.0]


def m_mul(a, b):
    """column-major 4x4 product a*b (b applied first)."""
    out = [0.0] * 16
    for c in range(4):
        for r in range(4):
            out[c * 4 + r] = (a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] +
                              a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3])
    return out


def m_translate(x, y, z):
    m = m_identity()
    m[12], m[13], m[14] = x, y, z
    return m


def m_scale(x, y, z):
    m = m_identity()
    m[0], m[5], m[10] = x, y, z
    return m


def m_rotate(axis, deg):
    x, y, z = axis
    n = math.sqrt(x * x + y * y + z * z) or 1.0
    x, y, z = x / n, y / n, z / n
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    t = 1 - c
    m = [0.0] * 16
    m[0] = c + x * x * t
    m[1] = y * x * t + z * s
    m[2] = z * x * t - y * s
    m[4] = x * y * t - z * s
    m[5] = c + y * y * t
    m[6] = z * y * t + x * s
    m[8] = x * z * t + y * s
    m[9] = y * z * t - x * s
    m[10] = c + z * z * t
    m[15] = 1.0
    return m


def xform(m, p):
    x, y, z = p
    return (m[0] * x + m[4] * y + m[8] * z + m[12],
            m[1] * x + m[5] * y + m[9] * z + m[13],
            m[2] * x + m[6] * y + m[10] * z + m[14])


def xform_dir(m, p):
    x, y, z = p
    return (m[0] * x + m[4] * y + m[8] * z,
            m[1] * x + m[5] * y + m[9] * z,
            m[2] * x + m[6] * y + m[10] * z)


def floats(node):
    return [float(v) for v in (node.text or '').split()]


def node_matrix(node):
    """local matrix, transforms composed in document order (T * R * S)."""
    m = m_identity()
    for child in node:
        tag = child.tag.replace(NS, '')
        if tag == 'matrix':
            v = floats(child)
            # files here store row-major; transposing gives column-major
            col = [v[r * 4 + c] for c in range(4) for r in range(4)]
            m = m_mul(m, col)
        elif tag == 'translate':
            v = floats(child)
            m = m_mul(m, m_translate(*v[:3]))
        elif tag == 'rotate':
            v = floats(child)
            m = m_mul(m, m_rotate(v[:3], v[3]))
        elif tag == 'scale':
            v = floats(child)
            m = m_mul(m, m_scale(*v[:3]))
    return m


# ---------------------------------------------------------------- collada


class Dae:
    def __init__(self, path):
        self.path = path
        self.dir = os.path.dirname(path)
        self.root = ET.parse(path).getroot()
        asset = self.root.find(NS + 'asset')
        self.unit = 1.0
        if asset is not None:
            unit = asset.find(NS + 'unit')
            if unit is not None:
                self.unit = float(unit.get('meter', '1'))
        self.images = {}
        for img in self.root.iter(NS + 'image'):
            init = img.find(NS + 'init_from')
            if init is not None and init.text:
                self.images[img.get('id')] = init.text.strip()
        self.effects = self._read_effects()
        self.materials = {}
        for mat in self.root.iter(NS + 'material'):
            eff = mat.find(NS + 'instance_effect')
            self.materials[mat.get('id')] = eff.get('url').lstrip('#') if eff is not None else None
        self.geometries = {g.get('id'): g for g in self.root.iter(NS + 'geometry')}
        self.sources = {s.get('id'): s for s in self.root.iter(NS + 'source')}

    def _read_effects(self):
        effects = {}
        for eff in self.root.iter(NS + 'effect'):
            info = {'tex': None, 'color': (0.78, 0.78, 0.78)}
            profile = eff.find(NS + 'profile_COMMON')
            if profile is None:
                effects[eff.get('id')] = info
                continue
            surfaces, samplers = {}, {}
            for p in profile.findall(NS + 'newparam'):
                sid = p.get('sid')
                surf = p.find(NS + 'surface')
                samp = p.find(NS + 'sampler2D')
                if surf is not None:
                    init = surf.find(NS + 'init_from')
                    if init is not None:
                        surfaces[sid] = init.text.strip()
                elif samp is not None:
                    src = samp.find(NS + 'source')
                    if src is not None:
                        samplers[sid] = src.text.strip()
            tech = profile.find(NS + 'technique')
            shader = None
            if tech is not None:
                for tag in ('blinn', 'phong', 'lambert', 'constant'):
                    shader = tech.find(NS + tag)
                    if shader is not None:
                        break
            if shader is not None:
                def tex_of(el):
                    if el is None:
                        return None
                    t = el.find(NS + 'texture')
                    if t is None:
                        return None
                    return self.images.get(surfaces.get(samplers.get(t.get('texture'))))

                diff = shader.find(NS + 'diffuse')
                if diff is not None:
                    c = diff.find(NS + 'color')
                    if c is not None:
                        v = floats(c)
                        info['color'] = (v[0], v[1], v[2])
                    t = tex_of(diff)
                    if t:
                        info['tex'] = t
                if info['tex'] is None:
                    info['tex'] = tex_of(shader.find(NS + 'transparent'))
            effects[eff.get('id')] = info
        return effects

    def resolve_texture(self, uri, hint=''):
        name = os.path.basename(uri.replace('\\', '/'))
        base = os.path.splitext(name)[0]
        entries = {e.lower(): e for e in os.listdir(self.dir)}
        for cand in (name, base + '.png', base + '.jpg', base + '.tga', base + '.dds'):
            hit = entries.get(cand.lower())
            if hit:
                return os.path.join(self.dir, hit)
        # some materials point at textures that were renamed inside the pack:
        # fall back to any albedo image in the folder (skip normal/spec/imposter)
        pool = [e for k, e in entries.items()
                if k.endswith(('.png', '.jpg', '.dds')) and not re.search(
                    r'(_nrm|_spec|imposter|_norm)', k)]
        if not pool:
            return None
        tokens = [w for w in re.split(r'[^a-z0-9]+', hint.lower()) if len(w) > 3]
        for token in tokens:
            for cand in pool:
                if token in cand.lower():
                    return os.path.join(self.dir, cand)
        return os.path.join(self.dir, sorted(pool)[0])


def read_source(dae, sid):
    src = dae.sources[sid]
    acc = src.find(NS + 'technique_common/' + NS + 'accessor')
    count = int(acc.get('count'))
    stride = int(acc.get('stride', '1'))
    offset = int(acc.get('offset', '0'))
    data = [float(v) for v in (src.find(NS + 'float_array').text or '').split()]
    return [tuple(data[i * stride + offset: i * stride + offset + stride]) for i in range(count)]


def geometry_prims(dae, geo_id):
    """list of dicts: symbol, positions, normals, uvs, tris (index triples w/ per-input ids)"""
    mesh = dae.geometries[geo_id].find(NS + 'mesh')
    out = []
    for prim in list(mesh.findall(NS + 'triangles')) + list(mesh.findall(NS + 'polylist')):
        off = {}
        max_off = 0
        for i in prim.findall(NS + 'input'):
            idx = int(i.get('offset', '0'))
            off[(i.get('semantic'), i.get('set'))] = (idx, i.get('source').lstrip('#'))
            max_off = max(max_off, idx)
        stride = max_off + 1
        raw = [int(float(v)) for v in (prim.find(NS + 'p').text or '').split()]

        pos_src = None
        for inp in mesh.find(NS + 'vertices').findall(NS + 'input'):
            if inp.get('semantic') == 'POSITION':
                pos_src = inp.get('source').lstrip('#')
        positions = read_source(dae, pos_src)
        normals = read_source(dae, off[('NORMAL', None)][1]) if ('NORMAL', None) in off else None
        uv_key = next((k for k in [('TEXCOORD', '1'), ('TEXCOORD', '0'), ('TEXCOORD', None)]
                       if k in off), None)
        uvs = read_source(dae, off[uv_key][1]) if uv_key else None
        po = off[('VERTEX', None)][0]
        no = off[('NORMAL', None)][0] if normals else po
        to = off[uv_key][0] if uv_key else po

        recs = [tuple(raw[i * stride:(i + 1) * stride]) for i in range(len(raw) // stride)]
        if prim.tag == NS + 'triangles':
            tris = [(recs[k], recs[k + 1], recs[k + 2]) for k in range(0, len(recs) - 2, 3)]
        else:
            vcount = [int(v) for v in (prim.find(NS + 'vcount').text or '').split()]
            tris, cur = [], 0
            for n in vcount:
                for k in range(1, n - 1):
                    tris.append((recs[cur], recs[cur + k], recs[cur + k + 1]))
                cur += n

        out.append({'symbol': prim.get('material') or 'default', 'positions': positions,
                    'normals': normals, 'uvs': uvs, 'tris': tris, 'po': po, 'no': no, 'to': to})
    return out


def instance_nodes(dae):
    """[(path_name, matrix, geo_id, {symbol: material_id})] for every instance_geometry"""
    scene = dae.root.find(NS + 'library_visual_scenes/' + NS + 'visual_scene')
    found = []

    def walk(node, parent_m, bindings, path):
        name = node.get('name') or node.get('id') or ''
        path = (path + '/' + name) if name else path
        m = m_mul(parent_m, node_matrix(node))
        local = dict(bindings)
        for child in node:
            if child.tag == NS + 'instance_material':
                local[child.get('symbol')] = child.get('target', '').lstrip('#')
        for child in node:
            if child.tag == NS + 'node':
                walk(child, m, local, path)
            elif child.tag == NS + 'instance_geometry':
                bind = dict(local)
                bm = child.find(NS + 'bind_material/' + NS + 'technique_common')
                if bm is not None:
                    for im in bm.findall(NS + 'instance_material'):
                        bind[im.get('symbol')] = im.get('target', '').lstrip('#')
                found.append({'path': path, 'matrix': m,
                              'geo': child.get('url').lstrip('#'), 'bind': bind})

    for top in scene:
        if top.tag == NS + 'node':
            walk(top, m_identity(), {}, '')
    return found


def pick_lod(found):
    cands = []
    for item in found:
        if 'collision' in item['path'].lower():
            continue
        nums = [int(x) for x in re.findall(r'(?<![0-9])(\d{2,3})(?![0-9])', item['path'])
                if int(x) in (32, 60, 64, 96, 100, 128, 200, 256, 512)]
        cands.append({'item': item, 'level': max(nums) if nums else 0})
    if not cands:
        return []
    levels = sorted({c['level'] for c in cands if c['level']})
    if not levels:
        return [c['item'] for c in cands]
    target = 128 if 128 in levels else levels[len(levels) // 2]
    return [c['item'] for c in cands if c['level'] == target]


# ---------------------------------------------------------------- textures


def encode_image(path, max_px):
    img = Image.open(path)
    img.load()
    has_alpha = False
    if img.mode in ('RGBA', 'LA', 'P'):
        img = img.convert('RGBA')
        alpha = img.getchannel('A')
        hist = alpha.histogram()
        clear = sum(hist[:200]) / float(max(1, img.size[0] * img.size[1]))
        # only treat as cutout when a meaningful part of the texture is transparent
        has_alpha = clear > 0.04
        if not has_alpha:
            img = img.convert('RGB')
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    w, h = img.size
    scale = min(1.0, max_px / max(w, h))
    if scale < 1.0:
        img = img.resize((max(1, int(round(w * scale))), max(1, int(round(h * scale)))),
                         Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format='WEBP', quality=80, method=4)
    return buf.getvalue(), has_alpha


# ---------------------------------------------------------------- glb


def build_glb(name, prims):
    blob = bytearray()
    buffer_views, accessors = [], []

    def add_view(data, target=None):
        while len(blob) % 4:
            blob.append(0)
        view = {'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(data)}
        if target:
            view['target'] = target
        blob.extend(data)
        buffer_views.append(view)
        return len(buffer_views) - 1

    def add_accessor(data, comp, count, type_, target, minmax=None):
        view = add_view(data, target)
        acc = {'bufferView': view, 'componentType': comp, 'count': count, 'type': type_}
        if minmax:
            acc['min'], acc['max'] = minmax
        accessors.append(acc)
        return len(accessors) - 1

    materials, mat_index = [], {}
    textures, tex_index, images = [], {}, []

    for p in prims:
        if p['key'] in mat_index:
            continue
        color = [p['color'][0], p['color'][1], p['color'][2], 1.0]
        if p['image'] is not None and p['alpha']:
            color = [1.0, 1.0, 1.0, 1.0]
        mat = {
            'name': p['key'],
            'pbrMetallicRoughness': {'baseColorFactor': color, 'metallicFactor': 0.0,
                                     'roughnessFactor': 0.95},
            'doubleSided': bool(p['alpha']),
        }
        if p['image'] is not None:
            tk = p['tex_key']
            if tk not in tex_index:
                view = add_view(p['image'])
                images.append({'bufferView': view, 'mimeType': 'image/webp', 'name': tk})
                textures.append({'source': len(images) - 1, 'sampler': 0})
                tex_index[tk] = len(textures) - 1
            mat['pbrMetallicRoughness']['baseColorTexture'] = {'index': tex_index[tk]}
        if p['alpha']:
            mat['alphaMode'] = 'MASK'
            mat['alphaCutoff'] = 0.38
        materials.append(mat)
        mat_index[p['key']] = len(materials) - 1

    mesh_prims = []
    for p in prims:
        pos, nrm, uv, idx = p['positions'], p['normals'], p['uvs'], p['indices']
        pos_b = b''.join(struct.pack('<3f', *v) for v in pos)
        attrs = {'POSITION': add_accessor(
            pos_b, 5126, len(pos), 'VEC3', 34962,
            ([min(v[i] for v in pos) for i in range(3)], [max(v[i] for v in pos) for i in range(3)]))}
        if nrm:
            attrs['NORMAL'] = add_accessor(
                b''.join(struct.pack('<3f', *v) for v in nrm), 5126, len(nrm), 'VEC3', 34962)
        if uv:
            attrs['TEXCOORD_0'] = add_accessor(
                b''.join(struct.pack('<2f', *v) for v in uv), 5126, len(uv), 'VEC2', 34962)
        if len(pos) < 65536:
            idx_b = b''.join(struct.pack('<H', i) for i in idx)
            ctype = 5123
        else:
            idx_b = b''.join(struct.pack('<I', i) for i in idx)
            ctype = 5125
        mesh_prims.append({'attributes': attrs, 'material': mat_index[p['key']], 'mode': 4,
                           'indices': add_accessor(idx_b, ctype, len(idx), 'SCALAR', 34963)})

    gltf = {
        'asset': {'version': '2.0', 'generator': 'mossbrook jungle kit'},
        'scene': 0, 'scenes': [{'nodes': [0]}],
        'nodes': [{'name': name, 'mesh': 0}],
        'meshes': [{'name': name, 'primitives': mesh_prims}],
        'materials': materials, 'accessors': accessors, 'bufferViews': buffer_views,
        'buffers': [{'byteLength': len(blob)}],
    }
    if images:
        gltf['images'] = images
        gltf['textures'] = textures
        gltf['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}]

    js = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
    while len(js) % 4:
        js += b' '
    while len(blob) % 4:
        blob.append(0)
    total = 12 + 8 + len(js) + 8 + len(blob)
    out = bytearray()
    out += struct.pack('<III', 0x46546C67, 2, total)
    out += struct.pack('<II', len(js), 0x4E4F534A) + js
    out += struct.pack('<II', len(blob), 0x004E4942) + bytes(blob)
    return bytes(out)


# ---------------------------------------------------------------- orient


def orient(points, axis_hint=None, flip=False):
    """判断竖直轴并把植物摆正、底部落到 y=0。

    不能用"最长边就是高度"：蕨类、灌木、象耳这类植物比高更宽，会被转倒。
    真正稳的特征是——植物底部窄、顶部宽（树干细、树冠大），
    所以对三个轴分别算"顶部横向扩散 - 底部横向扩散"，取分数最高的轴作为竖直轴，
    再让窄的一端朝下。
    """
    ext = []
    for axis in range(3):
        vals = [p[axis] for p in points]
        ext.append(max(vals) - min(vals))

    def spread(sel, others):
        if len(sel) < 3:
            return 0.0
        a = [p[others[0]] for p in sel]
        b = [p[others[1]] for p in sel]
        return ((max(a) - min(a)) + (max(b) - min(b))) * 0.5

    best = None
    for axis in range(3):
        if ext[axis] < 1e-4:
            continue
        others = [k for k in range(3) if k != axis]
        lo = min(p[axis] for p in points)
        hi = max(p[axis] for p in points)
        band = (hi - lo) * 0.18
        if band < 1e-5:
            continue
        bottom = [p for p in points if p[axis] <= lo + band]
        top = [p for p in points if p[axis] >= hi - band]
        score = spread(top, others) - spread(bottom, others)
        # 高一点更可能是树干方向，轻微加权
        score *= 1.0 + ext[axis] / (max(ext) + 1e-6) * 0.35
        if best is None or score > best[0]:
            best = (score, axis)

    # 有碰撞盒时以碰撞盒的长轴为准（树干方向的铁证），
    # 否则用打分；全部为负说明形态判不出来，退回这批资源声明的 Z-up。
    if axis_hint is not None:
        axis = axis_hint
    elif best is not None and best[0] > 0:
        axis = best[1]
    else:
        axis = 2

    # 竖直轴 -> +Y
    m = m_identity()
    if axis == 2:
        m = m_rotate((1, 0, 0), -90)
    elif axis == 0:
        m = m_rotate((0, 0, 1), 90)

    rotated = [xform(m, p) for p in points]
    # 注意：这里刻意不做"上下翻转"。
    # 沙滩棕这类叶片下垂的棕榈，"最宽处在下半部分"是正常形态（底部扩散是顶部的 1.8 倍），
    # 按"宽的翻下去"会把它倒过来。素材本身没有倒着建模的，保持 +Y 向上即可。
    if flip:
        m = m_mul(m_rotate((1, 0, 0), 180), m)
        rotated = [xform(m, p) for p in rotated]
    return m, rotated


# ---------------------------------------------------------------- main


def convert(name):
    rel, max_px, target_h = TREES[name]
    path = os.path.join(PACK, rel)
    if not os.path.exists(path):
        print(f'  ! missing {path}')
        return None
    dae = Dae(path)
    picked = pick_lod(instance_nodes(dae))
    if not picked:
        print(f'  ! no geometry in {rel}')
        return None

    groups, order = {}, []
    for item in picked:
        for gp in geometry_prims(dae, item['geo']):
            mat_id = item['bind'].get(gp['symbol'])
            eff = dae.materials.get(mat_id)
            info = dae.effects.get(eff) if eff else None
            key = f"{name}_{mat_id or gp['symbol']}"
            if key not in groups:
                groups[key] = {'color': info['color'] if info else (0.78, 0.78, 0.78),
                               'tex': info['tex'] if info else None, 'pos': [], 'nrm': [],
                               'uv': [], 'idx': [], 'verts': {}}
                order.append(key)
            g = groups[key]
            world = item['matrix']
            for tri in gp['tris']:
                for rec in tri:
                    vi, ni, ti = rec[gp['po']], rec[gp['no']], rec[gp['to']]
                    k = (vi, ni, ti)
                    slot = g['verts'].get(k)
                    if slot is None:
                        slot = len(g['pos'])
                        g['verts'][k] = slot
                        g['pos'].append(xform(world, gp['positions'][vi]))
                        if gp['normals'] and ni < len(gp['normals']):
                            n = xform_dir(world, gp['normals'][ni])
                            l = math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2) or 1.0
                            g['nrm'].append((n[0] / l, n[1] / l, n[2] / l))
                        if gp['uvs'] and ti < len(gp['uvs']):
                            g['uv'].append((gp['uvs'][ti][0], 1.0 - gp['uvs'][ti][1]))
                    g['idx'].append(slot)

    all_points = [p for k in order for p in groups[k]['pos']]
    if not all_points:
        print(f'  ! empty {rel}')
        return None

    # 碰撞盒是树干方向的可靠线索：找一遍 Collision 几何的长轴
    axis_hint = None
    for item in instance_nodes(dae):
        if 'collision' not in item['path'].lower():
            continue
        pts = []
        for gp in geometry_prims(dae, item['geo']):
            for tri in gp['tris']:
                for rec in tri:
                    pts.append(xform(item['matrix'], gp['positions'][rec[gp['po']]]))
        if len(pts) > 3:
            ext = [max(p[k] for p in pts) - min(p[k] for p in pts) for k in range(3)]
            axis_hint = ext.index(max(ext))
        break

    m_orient, _ = orient(all_points, axis_hint)
    m_final = m_mul(m_scale(dae.unit, dae.unit, dae.unit), m_orient)

    tex_cache = {}
    prims = []
    tris_total = 0
    for key in order:
        g = groups[key]
        pos = [xform(m_final, p) for p in g['pos']]
        nrm = [xform_dir(m_final, n) for n in g['nrm']] if g['nrm'] else None
        image, alpha, tex_key = None, False, None
        if g['tex']:
            src = dae.resolve_texture(g['tex'], key)
            if src:
                tex_key = os.path.basename(src).lower()
                if tex_key not in tex_cache:
                    try:
                        tex_cache[tex_key] = encode_image(src, max_px)
                    except Exception as exc:
                        print(f'  ! texture {src}: {exc}')
                        tex_cache[tex_key] = None
                if tex_cache[tex_key]:
                    image, alpha = tex_cache[tex_key]
        prims.append({'key': key, 'positions': pos, 'normals': nrm,
                      'uvs': g['uv'] if g['uv'] else None, 'indices': g['idx'],
                      'color': g['color'], 'image': image, 'alpha': bool(alpha and image),
                      'tex_key': tex_key})
        tris_total += len(g['idx']) // 3

    xs = [p[0] for pr in prims for p in pr['positions']]
    ys = [p[1] for pr in prims for p in pr['positions']]
    zs = [p[2] for pr in prims for p in pr['positions']]
    cx, cz, my = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2, min(ys)
    height = max(ys) - my
    width = max(xs) - min(xs)
    stretch = (target_h / height) if target_h and height > 1e-4 else 1.0

    for pr in prims:
        pr['positions'] = [((x - cx) * stretch, (y - my) * stretch, (z - cz) * stretch)
                           for (x, y, z) in pr['positions']]

    glb = build_glb(name, prims)
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, f'{name}.glb'), 'wb') as fh:
        fh.write(glb)
    print(f'  {name:11s} {len(prims)}mat tris={tris_total:5d}  h={height*stretch:5.2f}m '
          f'w={width*stretch:5.2f}m  {len(glb)/1024:6.1f} KB')
    return {'name': name, 'height': round(height * stretch, 3),
            'width': round(width * stretch, 3), 'tris': tris_total, 'size': len(glb)}


def preview(name, cols=40, rows=18):
    """ascii front view, to sanity-check orientation/scale"""
    with open(os.path.join(OUT_DIR, f'{name}.glb'), 'rb') as fh:
        data = fh.read()
    jlen = struct.unpack('<I', data[12:16])[0]
    gltf = json.loads(data[20:20 + jlen])
    bin_start = 20 + jlen + 8
    pts = []
    for prim in gltf['meshes'][0]['primitives']:
        acc = gltf['accessors'][prim['attributes']['POSITION']]
        view = gltf['bufferViews'][acc['bufferView']]
        off = bin_start + view.get('byteOffset', 0)
        for i in range(acc['count']):
            pts.append(struct.unpack_from('<3f', data, off + i * 12))
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    y0, y1, x0, x1 = min(ys), max(ys), min(xs), max(xs)
    grid = [[' '] * cols for _ in range(rows)]
    for p in pts:
        c = int((p[0] - x0) / max(x1 - x0, 1e-6) * (cols - 1))
        r = rows - 1 - int((p[1] - y0) / max(y1 - y0, 1e-6) * (rows - 1))
        grid[r][c] = '#'
    print(f'--- {name}  {x1 - x0:.1f} x {y1 - y0:.1f} m')
    for row in grid:
        print('   |' + ''.join(row) + '|')


def main():
    names = sys.argv[1:] or list(TREES)
    results = []
    for name in names:
        print(f'[{name}]')
        r = convert(name)
        if r:
            results.append(r)
    meta = {r['name']: {'height': r['height'], 'width': r['width'], 'tris': r['tris']}
            for r in results}
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, 'trees.json'), 'w', encoding='utf-8') as fh:
        json.dump(meta, fh, indent=2)
    print(f"\ntotal {len(results)} plants, {sum(r['size'] for r in results)/1024/1024:.2f} MB")


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--preview':
        for n in sys.argv[2:]:
            preview(n)
    else:
        main()
