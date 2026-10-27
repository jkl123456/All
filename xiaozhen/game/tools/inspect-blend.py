"""查看 .blend 里的对象/骨骼/动作/贴图情况。

用法： blender -b <file.blend> --python game/tools/inspect-blend.py
"""
import bpy

print('=== OBJECTS ===')
for ob in bpy.data.objects:
    line = f'{ob.type:9s} {ob.name!r} parent={ob.parent.name if ob.parent else None}'
    if ob.type == 'MESH':
        me = ob.data
        line += (f' verts={len(me.vertices)} polys={len(me.polygons)}'
                 f' mats={[m.name if m else None for m in me.materials]}'
                 f' vgroups={len(ob.vertex_groups)}'
                 f' mods={[m.type for m in ob.modifiers]}'
                 f' dims={tuple(round(v, 2) for v in ob.dimensions)}')
    elif ob.type == 'ARMATURE':
        line += f' bones={len(ob.data.bones)}'
    print(line)

print('=== ACTIONS ===')
for a in bpy.data.actions:
    print(f'   {a.name!r} range={tuple(round(v, 1) for v in a.frame_range)}')

print('=== IMAGES ===')
for im in bpy.data.images:
    print(f'   {im.name!r} size={im.size[:]} packed={bool(im.packed_file)} path={im.filepath}')

print('=== MATERIALS ===')
for m in bpy.data.materials:
    if not m.use_nodes:
        print(f'   {m.name!r} (no nodes) diffuse={tuple(round(v, 2) for v in m.diffuse_color)}')
        continue
    nodes = [(n.type, getattr(getattr(n, "image", None), "name", None)) for n in m.node_tree.nodes]
    print(f'   {m.name!r} nodes={nodes}')
