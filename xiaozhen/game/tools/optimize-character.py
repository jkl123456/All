#!/usr/bin/env python3
"""Shrink the character textures for mobile and repoint the glTF at WebP.

The Male_Ranger asset ships 6 uncompressed PNGs (~4.6 MB). Phones only need a
512 px albedo, so every texture is resampled and re-encoded to WebP, then the
.gltf image list is rewritten. Obsolete PNGs are removed.

usage: python tools/optimize-character.py
"""

import io
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHAR_DIR = os.path.join(ROOT, 'assets/character')
GLTF = os.path.join(CHAR_DIR, 'Male_Ranger.gltf')

# name fragment -> (max px, webp quality)
BUDGET = {
    'basecolor': (512, 78),
    'normal': (512, 72),
    'orm': (256, 72),
    'roughness': (256, 72),
}


def budget_for(name):
    low = name.lower()
    for key, cfg in BUDGET.items():
        if key in low:
            return cfg
    return (512, 78)


def main():
    with open(GLTF, 'r', encoding='utf-8') as fh:
        gltf = json.load(fh)

    before = after = 0
    keep = set()
    for img in gltf.get('images', []):
        uri = img.get('uri')
        if not uri:
            continue
        src = os.path.join(CHAR_DIR, uri)
        if not os.path.exists(src):
            continue
        before += os.path.getsize(src)
        max_px, quality = budget_for(os.path.basename(uri))
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
        dst = os.path.join(CHAR_DIR, dst_name)
        image.save(dst, format='WEBP', quality=quality, method=5)
        after += os.path.getsize(dst)
        img['uri'] = dst_name
        img['mimeType'] = 'image/webp'
        keep.add(os.path.basename(uri))
        if dst_name in os.listdir(CHAR_DIR):
            print(f'  {os.path.basename(uri):34s} {w}x{h} -> {image.size[0]}x{image.size[1]} '
                  f'{os.path.getsize(dst)/1024:6.1f} KB')

    with open(GLTF, 'w', encoding='utf-8') as fh:
        json.dump(gltf, fh, indent=2)

    for name in os.listdir(CHAR_DIR):
        if name.lower().endswith('.png'):
            os.remove(os.path.join(CHAR_DIR, name))

    print(f'\ncharacter textures {before/1024/1024:.2f} MB -> {after/1024:6.0f} KB')


if __name__ == '__main__':
    main()
