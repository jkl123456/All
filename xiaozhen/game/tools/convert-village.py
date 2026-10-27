"""把 Medieval Village Pack 的 OBJ 批量转成手机用的 GLB。

* 合并成一个网格（减少 draw call）
* 水平居中、底面贴 y=0，方便按位置摆放
* 导出 manifest.json 记录每个模型的长宽高

usage: blender -b --python tools/convert-village.py -- <pack 根目录> <输出目录>
"""
import bpy
import json
import math
import os
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
PACK, OUT = argv[0], argv[1]
os.makedirs(OUT, exist_ok=True)

SOURCES = [
    ('building', os.path.join(PACK, 'Buildings', 'OBJ')),
    ('prop', os.path.join(PACK, 'Props', 'OBJ')),
]


def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_obj(path):
    bpy.ops.wm.obj_import(filepath=path, forward_axis='NEGATIVE_Z', up_axis='Y')


def join_meshes():
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    if not meshes:
        return None
    for o in bpy.data.objects:
        o.select_set(o.type == 'MESH')
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ob


def ground_and_center(ob):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for v in ob.data.vertices:
        w = ob.matrix_world @ v.co
        for i in range(3):
            mn[i] = min(mn[i], w[i])
            mx[i] = max(mx[i], w[i])
    # Blender 里 Z 是竖直方向：水平居中、底面贴到 z=0
    cx = (mn.x + mx.x) / 2
    cy = (mn.y + mx.y) / 2
    offset = Vector((-cx, -cy, -mn.z))
    for v in ob.data.vertices:
        v.co += offset
    ob.data.update()
    size = (mx.x - mn.x, mx.z - mn.z, mx.y - mn.y)   # 宽, 高, 进深
    return size


def export(path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.data.objects:
        if o.type == 'MESH':
            o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_animations=False,
        export_materials='EXPORT',
        export_extras=False,
        export_texcoords=False,
    )


manifest = []
for kind, folder in SOURCES:
    if not os.path.isdir(folder):
        print('MISSING', folder)
        continue
    for name in sorted(os.listdir(folder)):
        if not name.lower().endswith('.obj'):
            continue
        stem = os.path.splitext(name)[0]
        clean_scene()
        try:
            import_obj(os.path.join(folder, name))
        except Exception as err:
            print('FAIL', name, err)
            continue
        ob = join_meshes()
        if ob is None:
            print('EMPTY', name)
            continue
        size = ground_and_center(ob)
        dst = os.path.join(OUT, f'{stem}.glb')
        export(dst)
        kb = os.path.getsize(dst) // 1024
        # glTF 是 Y-up，所以 Blender 的 (x, y, z) -> glTF (x, z, -y)
        manifest.append({
            'name': stem,
            'kind': kind,
            'w': round(size[0], 2),
            'h': round(size[1], 2),
            'd': round(size[2], 2),
        })
        print(f'OK {stem:22s} w{size[0]:5.2f} h{size[1]:5.2f} d{size[2]:5.2f}  {kb:4d}KB')

with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as fh:
    json.dump(manifest, fh, ensure_ascii=False, indent=1)
print('MODELS', len(manifest))
