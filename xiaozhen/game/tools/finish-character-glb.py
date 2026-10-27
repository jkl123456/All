#!/usr/bin/env python3
"""把 Barbarian 角色贴到 GLB 上：贴图转 WebP、写进材质、顺手瘦身。

Blender 导出时材质没带上贴图（这版 .blend 的节点是旧的），所以这里直接用
diff_base / normal 两张图生成 WebP，并给 GLB 里所有材质挂上 baseColor + normal。

usage: python tools/finish-character-glb.py <raw.glb> <out.glb> <base.png> <normal.png>
"""

import json
import os
import struct
import sys

from PIL import Image

BASE_SIZE = 1024
NORMAL_SIZE = 512


def glb_read(path):
    data = open(path, 'rb').read()
    json_len = struct.unpack('<I', data[12:16])[0]
    gltf = json.loads(data[20:20 + json_len])
    bin_start = 20 + json_len + 8
    bin_len = struct.unpack('<I', data[bin_start - 8:bin_start - 4])[0]
    return gltf, data[bin_start:bin_start + bin_len]


def glb_write(path, gltf, blob):
    while len(blob) % 4:
        blob += b'\x00'
    js = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
    while len(js) % 4:
        js += b' '
    total = 12 + 8 + len(js) + 8 + len(blob)
    out = bytearray()
    out += struct.pack('<III', 0x46546C67, 2, total)
    out += struct.pack('<II', len(js), 0x4E4F534A) + js
    out += struct.pack('<II', len(blob), 0x004E4942) + blob
    open(path, 'wb').write(out)


def encode(src, dst, max_px, quality, srgb=True):
    img = Image.open(src)
    img.load()
    if img.mode not in ('RGB', 'RGBA'):
        img = img.convert('RGB')
    w, h = img.size
    scale = min(1.0, max_px / max(w, h))
    if scale < 1.0:
        img = img.resize((max(1, int(round(w * scale))), max(1, int(round(h * scale)))),
                         Image.LANCZOS)
    img.save(dst, format='WEBP', quality=quality, method=5)
    return os.path.basename(dst)


def main():
    if len(sys.argv) < 5:
        print(__doc__)
        return
    raw, out, base_png, normal_png = sys.argv[1:5]
    folder = os.path.dirname(out)

    base_name = encode(base_png, os.path.join(folder, 'barbarian_base.webp'), BASE_SIZE, 84)
    normal_name = encode(normal_png, os.path.join(folder, 'barbarian_normal.webp'), NORMAL_SIZE, 80)

    gltf, blob = glb_read(raw)

    gltf['images'] = [
        {'uri': base_name, 'mimeType': 'image/webp'},
        {'uri': normal_name, 'mimeType': 'image/webp'},
    ]
    gltf['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}]
    gltf['textures'] = [{'sampler': 0, 'source': 0}, {'sampler': 0, 'source': 1}]

    for mat in gltf.get('materials', []):
        mat['pbrMetallicRoughness'] = {
            'baseColorTexture': {'index': 0},
            'metallicFactor': 0.0,
            'roughnessFactor': 0.82,
        }
        mat['normalTexture'] = {'index': 1, 'scale': 0.9}
        mat['doubleSided'] = False

    glb_write(out, gltf, blob)
    print(f'  {os.path.getsize(raw)/1024:.0f} KB -> {os.path.getsize(out)/1024:.0f} KB  '
          f'(+{os.path.getsize(os.path.join(folder, base_name))/1024:.0f} KB base, '
          f'+{os.path.getsize(os.path.join(folder, normal_name))/1024:.0f} KB normal)')


if __name__ == '__main__':
    main()
