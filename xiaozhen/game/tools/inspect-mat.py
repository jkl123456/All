import bpy
for m in bpy.data.materials:
    print(f'--- {m.name!r} use_nodes={m.use_nodes}')
    if not m.use_nodes:
        continue
    nt = m.node_tree
    for n in nt.nodes:
        extra = ''
        if n.type in ('TEX_IMAGE',):
            extra = f' image={getattr(n.image, "name", None)}'
        if n.type == 'BSDF_PRINCIPLED':
            for key in ('Base Color', 'Metallic', 'Roughness', 'Normal'):
                if key in n.inputs:
                    inp = n.inputs[key]
                    src = inp.links[0].from_node.type if inp.links else None
                    extra += f' [{key}<-{src}]'
        print(f'    {n.type} {n.name!r}{extra}')
    print('    links:', [(l.from_node.type, l.from_socket.name, '->', l.to_node.type, l.to_socket.name) for l in nt.links][:8])
print('=== UV layers ===')
for ob in bpy.data.objects:
    if ob.type == 'MESH' and ob.data.uv_layers:
        print('  ', ob.name, [uv.name for uv in ob.data.uv_layers])
