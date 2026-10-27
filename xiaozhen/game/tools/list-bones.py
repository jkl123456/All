import bpy
for ob in bpy.data.objects:
    if ob.type != 'ARMATURE':
        continue
    print(f'=== {ob.name} ({len(ob.data.bones)} bones) ===')
    for b in ob.data.bones:
        print(f'{b.name}|{b.parent.name if b.parent else "-"}|{round(b.head_local.z,3)}')
