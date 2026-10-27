import bpy
print('IMG', [ (i.name, i.size[:], bool(i.packed_file)) for i in bpy.data.images ])
for m in bpy.data.materials:
    print('MAT', m.name, 'use_nodes', m.use_nodes, 'users', m.users)
    if m.node_tree:
        print('   nodes', [(n.type, n.name) for n in m.node_tree.nodes])
        print('   links', [(l.from_node.type, l.to_node.type, l.to_socket.name) for l in m.node_tree.links])
