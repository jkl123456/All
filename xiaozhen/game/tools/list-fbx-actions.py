import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath='H:/minimax/youxi2/xiaozhen/Ultimate Modular Women - April 2022-20261025T152013Z-1-001/Ultimate Modular Women - April 2022/Separate Skeletal Meshes and Animations/Animations.fbx')
print('ACTIONS', len(bpy.data.actions))
for a in sorted(bpy.data.actions, key=lambda x: x.name):
    print('  ', a.name, tuple(round(v) for v in a.frame_range))
print('ARMATURES', [o.name for o in bpy.data.objects if o.type == 'ARMATURE'])
for o in bpy.data.objects:
    if o.type == 'ARMATURE':
        print('BONES', len(o.data.bones), [b.name for b in o.data.bones][:14])
