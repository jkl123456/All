"""把 LOW_barbarian_rig_051.blend 导成游戏用 GLB（含贴图）。

这个 .blend 里的贴图是打包好的，但材质里没有连节点；脚本会把
diff_base / normal 接到 Principled BSDF 上再导出。

用法： blender -b low_barbarian_rig_051/LOW_barbarian_rig_051.blend --python game/tools/export-barbarian.py
"""
import bpy
import os

DIFF = 'diff_base.png'
NORMAL = 'normal.png'

# 只保留角色本体
for ob in list(bpy.data.objects):
    if ob.type in ('LIGHT', 'CAMERA') or ob.name == 'BACKGROUND':
        bpy.data.objects.remove(ob, do_unlink=True)

for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)


def image(name):
    img = bpy.data.images.get(name)
    return img if img and img.size[0] > 0 else None


diff_img = image(DIFF)
normal_img = image(NORMAL)
print('tex', bool(diff_img), bool(normal_img))

for mat in bpy.data.materials:
    if mat.name == 'bg':
        continue
    mat.use_nodes = True
    nt = mat.node_tree

    # 清掉原有的输出/Diffuse，避免 glTF 导出器选错出口
    for node in list(nt.nodes):
        if node.type in ('BSDF_DIFFUSE', 'FRAME') or (
            node.type == 'OUTPUT_MATERIAL' and node.name != 'Material Output'
        ):
            nt.nodes.remove(node)

    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None)
    if bsdf is None or out is None:
        continue

    bsdf.inputs['Roughness'].default_value = 0.72
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Base Color'].default_value = (0.55, 0.5, 0.45, 1.0)

    if diff_img:
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = diff_img
        tex.location = (-560, 260)
        diff_img.colorspace_settings.name = 'sRGB'
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])

    if normal_img:
        normal_img.colorspace_settings.name = 'Non-Color'
        ntex = nt.nodes.new('ShaderNodeTexImage')
        ntex.image = normal_img
        ntex.location = (-560, -120)
        nmap = nt.nodes.new('ShaderNodeNormalMap')
        nmap.location = (-300, -120)
        nmap.inputs['Strength'].default_value = 0.85
        nt.links.new(ntex.outputs['Color'], nmap.inputs['Color'])
        nt.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])

for ob in bpy.data.objects:
    ob.select_set(ob.type in ('MESH', 'ARMATURE'))
    if ob.type == 'ARMATURE':
        bpy.context.view_layer.objects.active = ob

out = os.path.join(os.path.dirname(bpy.data.filepath), 'game/assets/character/barbarian_raw.glb')
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    use_selection=False,
    export_yup=True,
    export_apply=False,
    export_animations=False,
    export_materials='EXPORT',
    export_image_format='AUTO',
    export_skins=True,
    export_normals=True,
    export_texcoords=True,
    export_extras=False,
)
print('WROTE', out, os.path.getsize(out) // 1024, 'KB')
