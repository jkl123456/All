import bpy, os, sys, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, outdir = argv[0], argv[1]
os.makedirs(outdir, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src)

arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
act = bpy.data.actions[0]
arm.animation_data_create()
arm.animation_data.action = act
if hasattr(arm.animation_data.action, 'slots') and len(arm.animation_data.action.slots):
    arm.animation_data.action_slot = arm.animation_data.action.slots[0]

# 相机：正前方略偏右
cam_data = bpy.data.cameras.new('cam')
cam = bpy.data.objects.new('cam', cam_data)
bpy.context.scene.collection.objects.link(cam)
# 找到角色高度
mn = Vector((1e9, 1e9, 1e9)); mx = Vector((-1e9, -1e9, -1e9))
for o in bpy.data.objects:
    if o.type == 'MESH':
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], w[i]); mx[i] = max(mx[i], w[i])
center = (mn + mx) / 2
height = mx.z - mn.z
print('BBOX', tuple(round(v, 2) for v in mn), tuple(round(v, 2) for v in mx), 'h', round(height, 2))

cam.location = (center.x + height * 0.9, center.y - height * 2.2, center.z + height * 0.12)
direction = center - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
cam_data.lens = 50 if hasattr(cam_data, 'lens') else 50
bpy.context.scene.camera = cam

sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.render.resolution_x = 420
sc.render.resolution_y = 480
sc.render.film_transparent = False
try:
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.show_shadows = True
except Exception:
    pass

start, end = int(act.frame_range[0]), int(act.frame_range[1])
print('FRAMES', start, end)
for f in [start, start + (end - start) // 3, start + 2 * (end - start) // 3, end]:
    sc.frame_set(f)
    sc.render.filepath = os.path.join(outdir, f'fbx-{f:03d}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', f)
