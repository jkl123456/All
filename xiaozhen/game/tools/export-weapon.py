"""把武器 FBX 转成可以直接挂到手上的 GLB。

导入后删掉骨骼/空物体，只留网格，按目标长度归一化（模型原本可能是厘米单位），
再把原点移到握把位置附近，导出 Y-up 的 GLB。

用法：
  blender -b --python game/tools/export-weapon.py -- <in.fbx> <out.glb> <目标长度米>
"""

import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst, length = argv[0], argv[1], float(argv[2])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src)

# 只保留网格
for ob in list(bpy.data.objects):
    if ob.type != 'MESH':
        bpy.data.objects.remove(ob, do_unlink=True)

meshes = [ob for ob in bpy.data.objects if ob.type == 'MESH']
if not meshes:
    print('NO MESH in', src)
    sys.exit(1)

# 合并成一个物体，方便挂点
for ob in bpy.data.objects:
    ob.select_set(ob.type == 'MESH')
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()

ob = bpy.context.view_layer.objects.active
ob.parent = None

# 应用旋转/缩放
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# 归一化尺寸
dims = ob.dimensions
longest = max(dims)
scale = length / longest if longest else 1.0
ob.scale = (scale, scale, scale)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# 原点放在"最长轴"的一端（握把端），这样游戏里只要把武器从原点往外摆就行
bb = [Vector(c) for c in ob.bound_box]
dims2 = [max(v[i] for v in bb) - min(v[i] for v in bb) for i in range(3)]
long_axis = dims2.index(max(dims2))
center = sum(bb, Vector()) / 8
loc = [-center.x, -center.y, -center.z]
loc[long_axis] = -min(v[long_axis] for v in bb)
ob.location = loc
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

os.makedirs(os.path.dirname(dst), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format='GLB',
    use_selection=False,
    export_yup=True,
    export_apply=True,
    export_animations=False,
    export_materials='EXPORT',
    export_normals=True,
    export_texcoords=True,
)
# FBX 材质常常把 baseColor 的 alpha 导成 0，整把武器会被 alphaTest 全丢掉，这里修回来
import json
import struct
raw = open(dst, 'rb').read()
jlen = struct.unpack('<I', raw[12:16])[0]
gltf = json.loads(raw[20:20 + jlen])
blob = raw[20 + jlen + 8:]
for mat in gltf.get('materials', []):
    pbr = mat.get('pbrMetallicRoughness', {})
    factor = pbr.get('baseColorFactor')
    if factor and len(factor) == 4 and factor[3] < 1:
        factor[3] = 1.0
    mat.pop('alphaMode', None)
    mat.pop('alphaCutoff', None)
js = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
while len(js) % 4:
    js += b' '
while len(blob) % 4:
    blob += b'\x00'
total = 12 + 8 + len(js) + 8 + len(blob)
out = bytearray()
out += struct.pack('<III', 0x46546C67, 2, total)
out += struct.pack('<II', len(js), 0x4E4F534A) + js
out += struct.pack('<II', len(blob), 0x004E4942) + blob
open(dst, 'wb').write(out)

print('WROTE', dst, os.path.getsize(dst) // 1024, 'KB',
      'dims', [round(v, 3) for v in ob.dimensions], 'longAxis', 'XYZ'[long_axis])
