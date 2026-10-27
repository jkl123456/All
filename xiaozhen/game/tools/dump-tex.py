import bpy, os
out_dir = 'H:/minimax/youxi2/xiaozhen/game/assets/character'
os.makedirs(out_dir, exist_ok=True)
for name in ('diff_base.png', 'normal.png'):
    img = bpy.data.images.get(name)
    if not img or img.size[0] == 0:
        print('MISS', name)
        continue
    img.filepath_raw = os.path.join(out_dir, name)
    img.file_format = 'PNG'
    img.save()
    print('SAVED', img.filepath_raw, os.path.getsize(img.filepath_raw) // 1024, 'KB', img.size[:])
