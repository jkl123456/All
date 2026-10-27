import bpy, sys, traceback
path = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=path)

print('OBJECTS', len(bpy.data.objects))
for o in bpy.data.objects:
    extra = ''
    if o.type == 'ARMATURE':
        extra = f'bones={len(o.data.bones)}'
    elif o.type == 'MESH':
        extra = f'verts={len(o.data.vertices)} groups={len(o.vertex_groups)}'
    print(f'OBJ|{o.type}|{o.name}|{extra}')

print('ACTIONCOUNT', len(bpy.data.actions))
for a in bpy.data.actions:
    try:
        rng = tuple(round(v) for v in a.frame_range)
    except Exception as e:
        rng = str(e)
    n = -1
    try:
        n = len(a.fcurves)
    except Exception:
        try:
            n = sum(len(s.channelbag(a.slots[0]).fcurves) for s in a.slots)
        except Exception:
            pass
    print(f'ACTION|{a.name}|range={rng}|fcurves={n}')

for o in bpy.data.objects:
    if o.type == 'ARMATURE':
        names = [b.name for b in o.data.bones]
        print(f'ARMATURE|{o.name}|{len(names)}')
        print('BONES|' + ','.join(names))
