"""把 FBX 角色导出成适合手机运行的 GLB：网格抽稀 + 只保留需要的动作。

usage: blender -b --python tools/build-runner.py -- <in.fbx> <out.glb> [decimate]
"""
import bpy
import os
import sys

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst = argv[0], argv[1]
ratio = float(argv[2]) if len(argv) > 2 else 0.45

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src)

for ob in list(bpy.data.objects):
    if ob.type in ('LIGHT', 'CAMERA'):
        bpy.data.objects.remove(ob, do_unlink=True)

arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
if arm is None:
    print('NO ARMATURE')
    sys.exit(1)

# 网格抽稀：低模风格，抽到一半以下肉眼看不出差别
for ob in list(bpy.data.objects):
    if ob.type != 'MESH':
        continue
    before = len(ob.data.vertices)
    mod = ob.modifiers.new('dec', 'DECIMATE')
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=mod.name)
    print('DECIMATE', ob.name, before, '->', len(ob.data.vertices))

arm.animation_data_create()
arm.animation_data.action = None
for action in list(bpy.data.actions):
    track = arm.animation_data.nla_tracks.new()
    track.name = action.name
    track.strips.new(action.name, int(action.frame_range[0]), action)

os.makedirs(os.path.dirname(dst), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for ob in bpy.data.objects:
    if ob.type in ('MESH', 'ARMATURE'):
        ob.select_set(True)
bpy.context.view_layer.objects.active = arm

bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format='GLB',
    use_selection=True,
    export_yup=True,
    export_apply=False,
    export_animations=True,
    export_animation_mode='NLA_TRACKS',
    export_force_sampling=True,
    export_optimize_animation_size=False,
    export_anim_slide_to_zero=True,
    export_materials='EXPORT',
    export_skins=True,
    export_extras=False,
)
print('WROTE', dst, os.path.getsize(dst) // 1024, 'KB')
