"""把 FBX 里的骨骼动画导出成 GLB（只保留骨架，丢掉网格，体积小）。

usage: blender -b --python tools/export-fbx-anim.py -- <in.fbx> <out.glb>
"""
import bpy
import os
import sys

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src)

# 删掉网格和空物体，只留骨架（动画在骨架上）
for ob in list(bpy.data.objects):
    if ob.type != 'ARMATURE':
        bpy.data.objects.remove(ob, do_unlink=True)

arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
if arm is None:
    print('NO ARMATURE')
    sys.exit(1)

# 把每个动作都推到一个 NLA 轨道上，不然 glTF 导出器只认当前动作
arm.animation_data_create()
arm.animation_data.action = None
for action in list(bpy.data.actions):
    track = arm.animation_data.nla_tracks.new()
    track.name = action.name
    strip = track.strips.new(action.name, int(action.frame_range[0]), action)
    strip.name = action.name

os.makedirs(os.path.dirname(dst), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True)
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
    export_materials='NONE',
    export_skins=False,
    export_morph=False,
    export_extras=False,
)
print('WROTE', dst, os.path.getsize(dst) // 1024, 'KB')
