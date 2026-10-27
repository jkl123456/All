"""Blender 端导出脚本：把 mudeater.blend 导成游戏用的 GLB。

用法：
  blender -b mudeater.blend --python game/tools/export-blend.py

只保留巡游/战斗需要的动作，丢掉灯光相机，导出 Y-up 的 GLB。
"""
import bpy
import os

KEEP_ACTIONS = [
    'Idle.Submissive.000',
    'Walk.Male.L',
    'Walk.Male.R',
    'Fight.UnarmedL.Attack.000',
    'Lie',
]

for action in list(bpy.data.actions):
    if action.name not in KEEP_ACTIONS:
        bpy.data.actions.remove(action)

for ob in list(bpy.data.objects):
    if ob.type in ('LIGHT', 'CAMERA') or ob.name in ('Plane', 'MHJaw', 'CustomShapes'):
        bpy.data.objects.remove(ob, do_unlink=True)

for ob in bpy.data.objects:
    ob.select_set(ob.type in ('MESH', 'ARMATURE'))
    if ob.type == 'ARMATURE':
        bpy.context.view_layer.objects.active = ob

out = os.path.join(os.path.dirname(bpy.data.filepath), 'game/assets/character/mudeater_raw.glb')
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    use_selection=False,
    export_yup=True,
    export_apply=True,
    export_animations=True,
    export_animation_mode='ACTIONS',
    export_bake_animation=False,
    export_force_sampling=True,
    export_optimize_animation_size=True,
    export_optimize_animation_keep_anim_armature=True,
    export_anim_slide_to_zero=True,
    export_materials='EXPORT',
    export_skins=True,
    export_def_bones=False,
    export_normals=True,
    export_texcoords=True,
    export_extras=False,
)
print('WROTE', out, os.path.getsize(out) // 1024, 'KB')
