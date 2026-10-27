"""Mobile texture pass for the staged glTF kits (town / character / jungle).

Resizes and re-encodes every image referenced by the .gltf files in a folder,
rewrites the image URIs to WebP, then deletes the original PNGs. Normal maps are
kept a bit sharper than albedo because they carry the surface detail.

用法： python game/tools/optimize-textures.py assets/town [maxAlbedo] [maxNormal]
"""

import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# role -> (max px, webp quality)
PROFILES = {
    'basecolor': (512, 80),
    'albedo': (512, 80),
    'diffuse': (512, 80),
    'normal': (512, 76),
    'orm': (256, 76),
    'roughness': (256, 76),
    'metal': (256, 76),
    'emissive': (256, 80),
}


def profile_for(name, max_albedo, max_normal):
    low = name.lower()
    for key, (px, quality) in PROFILES.items():
        if key in low:
            if key == 'normal':
                return min(px, max_normal), quality
            return min(px, max_albedo), quality
    return max_albedo, 80


def convert_folder(folder, max_albedo=512, max_normal=512):
    gltfs = [f for f in os.listdir(folder) if f.lower().endswith('.gltf')]
    if not gltfs:
        print(f'  no .gltf in {folder}')
        return
    done = {}
    before = after = 0
    touched = 0
    for name in gltfs:
        path = os.path.join(folder, name)
        with open(path, 'r', encoding='utf-8') as fh:
            gltf = json.load(fh)
        changed = False
        for img in gltf.get('images', []):
            uri = img.get('uri')
            if not uri or uri.startswith('data:'):
                continue
            src = os.path.join(folder, uri)
            if not os.path.exists(src):
                continue
            if uri in done:
                img['uri'] = done[uri]
                img['mimeType'] = 'image/webp'
                changed = True
                continue
            max_px, quality = profile_for(os.path.basename(uri), max_albedo, max_normal)
            image = Image.open(src)
            image.load()
            if image.mode not in ('RGB', 'RGBA'):
                image = image.convert('RGB')
            w, h = image.size
            scale = min(1.0, max_px / max(w, h))
            if scale < 1.0:
                image = image.resize((max(1, int(round(w * scale))), max(1, int(round(h * scale)))),
                                     Image.LANCZOS)
            dst_name = os.path.splitext(uri)[0] + '.webp'
            image.save(os.path.join(folder, dst_name), format='WEBP', quality=quality, method=5)
            done[uri] = dst_name
            before += os.path.getsize(src)
            after += os.path.getsize(os.path.join(folder, dst_name))
            img['uri'] = dst_name
            img['mimeType'] = 'image/webp'
            changed = True
        if changed:
            with open(path, 'w', encoding='utf-8') as fh:
                json.dump(gltf, fh, separators=(',', ':'))
            touched += 1

    keep = set(done.values())
    for f in os.listdir(folder):
        if f.lower().endswith('.png') and f not in keep:
            os.remove(os.path.join(folder, f))

    print(f'  {touched} gltf updated · {len(done)} textures · '
          f'{before/1024/1024:.2f} MB -> {after/1024/1024:.2f} MB')


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    folder = sys.argv[1]
    if not os.path.isabs(folder):
        folder = os.path.join(ROOT, folder)
    albedo = int(sys.argv[2]) if len(sys.argv) > 2 else 512
    normal = int(sys.argv[3]) if len(sys.argv) > 3 else 512
    convert_folder(folder, albedo, normal)


if __name__ == '__main__':
    main()
