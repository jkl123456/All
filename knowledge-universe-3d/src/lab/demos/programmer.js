import {
  THREE,
  addGlow,
  addLabel,
  addLine,
  addTube,
  box,
  cylinder,
  sphere,
  seeded,
} from './helpers.js';

export function binaryTree() {
  const group = new THREE.Group();
  const cyan = '#5BE7FF';
  const green = '#79E86B';

  const nodesData = [
    { value: 50, x: 0, y: 4.35 },
    { value: 30, x: -3.0, y: 2.9 },
    { value: 70, x: 3.0, y: 2.9 },
    { value: 20, x: -4.5, y: 1.4 },
    { value: 40, x: -1.5, y: 1.4 },
    { value: 60, x: 1.5, y: 1.4 },
    { value: 80, x: 4.5, y: 1.4 },
  ];
  const links = [
    [50, 30],
    [50, 70],
    [30, 20],
    [30, 40],
    [70, 60],
    [70, 80],
  ];

  const nodeMap = new Map();
  const nodes = [];
  nodesData.forEach((data) => {
    const node = new THREE.Group();
    node.position.set(data.x, data.y, 0);
    const mesh = sphere(0.46, '#0c2d45', {
      emissive: cyan,
      emissiveIntensity: 0.55,
      roughness: 0.3,
      metalness: 0.4,
      transparent: true,
      opacity: 0.96,
    });
    node.add(mesh);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.018, 6, 48),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(cyan),
        transparent: true,
        opacity: 0.45,
        toneMapped: false,
      })
    );
    ring.position.z = 0.06;
    node.add(ring);
    addLabel(node, String(data.value), [0, 0.02, 0.48], {
      color: '#eaffff',
      fontSize: 32,
      scale: 0.006,
      glow: 10,
      glowColor: cyan,
    });
    addGlow(node, cyan, 1.7, [0, 0, 0], 0.32);
    group.add(node);
    nodeMap.set(data.value, { node, mesh, ring, data, active: false });
    nodes.push(nodeMap.get(data.value));
  });

  const edgeMap = new Map();
  links.forEach(([from, to]) => {
    const a = nodeMap.get(from).data;
    const b = nodeMap.get(to).data;
    const start = new THREE.Vector3(a.x, a.y, 0);
    const end = new THREE.Vector3(b.x, b.y, 0);
    const beam = addTube(group, [start, end], '#3d7c9c', 0.02, 0.45);
    edgeMap.set(`${from}-${to}`, beam);
    edgeMap.set(`${to}-${from}`, beam);
  });

  addLabel(group, '二叉搜索树 · 左子树 < 根 < 右子树', [0, 6.35, 0], {
    color: cyan,
    fontSize: 28,
    scale: 0.0064,
    bg: 'rgba(4, 10, 18, 0.72)',
    border: 'rgba(91, 231, 255, 0.3)',
    padding: 9,
  });

  const searches = [
    { target: 60, path: [50, 70, 60] },
    { target: 20, path: [50, 30, 20] },
    { target: 80, path: [50, 70, 80] },
  ];
  const searchLabels = searches.map((s) => {
    const label = addLabel(group, `查找 ${s.target}：${s.path.join(' → ')}`, [0, 5.62, 0], {
      color: '#cfefff',
      fontSize: 24,
      scale: 0.0057,
      bg: 'rgba(4, 10, 18, 0.6)',
      border: 'rgba(91, 231, 255, 0.22)',
      padding: 8,
      opacity: 0,
    });
    label.material.opacity = 0;
    return label;
  });

  addLabel(group, '每次排除一半 · O(log n)', [0, 0.28, 0.8], {
    color: 'rgba(140, 230, 255, 0.72)',
    fontSize: 24,
    scale: 0.0057,
  });

  const particle = sphere(0.06, '#ffffff', { emissive: '#ffffff', emissiveIntensity: 2 });
  group.add(particle);

  let lastCycle = -1;
  let activeSet = new Set();
  let activeSearch = searches[0];

  return {
    group,
    view: { position: [0, 2.8, 14.8], target: [0, 3.0, 0] },
    autoRotate: false,
    update(time, dt) {
      const cycle = Math.floor(time / 3.0) % searches.length;
      const local = time % 3.0;
      if (cycle !== lastCycle) {
        lastCycle = cycle;
        activeSearch = searches[cycle];
      }
      const step = Math.min(activeSearch.path.length, Math.floor(local / 0.62) + 1);
      activeSet = new Set(activeSearch.path.slice(0, step));

      nodes.forEach((item) => {
        const active = activeSet.has(item.data.value);
        const isTarget = activeSearch.target === item.data.value && local > 1.6;
        const targetEmissive = active ? 1.9 : 0.35;
        const targetScale = active ? (isTarget ? 1.15 : 1.06) : 0.94;
        item.mesh.material.emissiveIntensity += (targetEmissive - item.mesh.material.emissiveIntensity) * Math.min(1, dt * 7);
        item.node.scale.x += (targetScale - item.node.scale.x) * Math.min(1, dt * 7);
        item.node.scale.y = item.node.scale.x;
        item.node.scale.z = item.node.scale.x;
        item.ring.material.opacity = active ? 0.75 : 0.28;
        item.ring.rotation.z = time * 0.6;
      });

      links.forEach(([from, to]) => {
        const beam = edgeMap.get(`${from}-${to}`);
        const active = activeSet.has(from) && activeSet.has(to);
        beam.material.opacity += ((active ? 0.8 : 0.2) - beam.material.opacity) * Math.min(1, dt * 6);
      });

      searchLabels.forEach((label, i) => {
        const target = i === cycle ? 1 : 0;
        label.material.opacity += (target - label.material.opacity) * Math.min(1, dt * 7);
        label.visible = label.material.opacity > 0.02;
      });

      const pathPoint = Math.min(activeSearch.path.length - 1, Math.floor(local / 0.62));
      const current = nodeMap.get(activeSearch.path[pathPoint]);
      particle.position.set(current.data.x + Math.sin(time * 3) * 0.15, current.data.y + 0.6, 0.3);
      particle.material.emissiveIntensity = 1.5 + Math.sin(time * 5) * 0.6;
      group.rotation.y = Math.sin(time * 0.3) * 0.02;
    },
  };
}

export function hanoi() {
  const group = new THREE.Group();
  const accent = '#5BE7FF';

  const base = box(10.4, 0.35, 2.9, '#14263b', {
    roughness: 0.5,
    metalness: 0.35,
    emissive: '#0a1928',
    emissiveIntensity: 0.4,
  });
  base.position.y = 0;
  group.add(base);

  const pegX = [-3.5, 0, 3.5];
  const baseY = 0.18;
  const diskHeight = 0.26;
  const colors = ['#e3664f', '#e8a44b', '#f0d36a', '#79d0a4', '#5b9dff'];
  const diskCount = 5;
  const pegs = [[], [], []];
  const disks = [];

  for (let i = 0; i < diskCount; i += 1) {
    const radius = 1.15 - i * 0.135;
    const disk = cylinder(radius, radius, diskHeight, colors[i], {
      roughness: 0.4,
      metalness: 0.25,
      emissive: colors[i],
      emissiveIntensity: 0.35,
    });
    group.add(disk);
    disks.push(disk);
    pegs[0].push(i);
  }

  const pegMeshes = [];
  pegX.forEach((x, i) => {
    const peg = cylinder(0.065, 0.075, 3.6, '#8fa8c2', {
      metalness: 0.6,
      roughness: 0.28,
      emissive: '#3a556e',
      emissiveIntensity: 0.3,
    });
    peg.position.set(x, baseY + 1.8, 0);
    group.add(peg);
    pegMeshes.push(peg);
    addLabel(group, ['A', 'B', 'C'][i], [x, -0.25, 1.85], {
      color: '#9fc8e8',
      fontSize: 28,
      scale: 0.006,
      bg: 'rgba(4, 10, 18, 0.6)',
      padding: 7,
    });
    const glow = addGlow(group, accent, 2.6, [x, 0.35, 0], 0.16);
    glow.material.opacity = 0.12;
  });
  addGlow(group, accent, 9, [0, 0.5, -2], 0.2);

  const moves = [];
  const solve = (n, from, to, via) => {
    if (n === 0) return;
    solve(n - 1, from, via, to);
    moves.push([from, to]);
    solve(n - 1, via, to, from);
  };
  solve(diskCount, 0, 2, 1);

  const diskY = (pegIndex, slot) => baseY + diskHeight / 2 + slot * (diskHeight + 0.012);

  const placeInitial = () => {
    pegs[0].length = 0;
    pegs[1].length = 0;
    pegs[2].length = 0;
    for (let i = 0; i < diskCount; i += 1) {
      pegs[0].push(i);
      disks[i].position.set(pegX[0], diskY(0, i), 0);
    }
  };
  placeInitial();

  let anim = null;
  let moveIndex = 0;
  let wait = 0;
  let doneWait = 0;
  let restarting = false;

  const startMove = () => {
    const [from, to] = moves[moveIndex];
    const disk = pegs[from].pop();
    const slot = pegs[to].length;
    pegs[to].push(disk);
    const mesh = disks[disk];
    anim = {
      mesh,
      t: 0,
      duration: 0.52,
      start: mesh.position.clone(),
      midX: pegX[to],
      endY: diskY(to, slot),
      end: new THREE.Vector3(pegX[to], diskY(to, slot), 0),
      fromY: mesh.position.y,
      liftY: 3.55,
    };
    moveIndex += 1;
  };

  const restart = () => {
    placeInitial();
    moveIndex = 0;
    anim = null;
    wait = 0;
    doneWait = 0;
    restarting = false;
  };

  addLabel(group, '汉诺塔 · 递归求解', [0, 3.95, 0], {
    color: accent,
    fontSize: 30,
    scale: 0.0066,
    bg: 'rgba(4, 10, 18, 0.72)',
    border: 'rgba(91, 231, 255, 0.3)',
    padding: 10,
  });
  addLabel(group, '2ⁿ − 1 = 31 步', [0, 3.3, 0.5], {
    color: '#dff8ff',
    fontSize: 26,
    scale: 0.006,
  });
  addLabel(group, '移动 n−1 → 移动最大盘 → 移回 n−1', [0, -1.0, 2.2], {
    color: 'rgba(170, 205, 235, 0.68)',
    fontSize: 22,
    scale: 0.0053,
  });

  return {
    group,
    view: { position: [8.0, 5.4, 12.6], target: [0, 1.4, 0] },
    autoRotate: true,
    autoRotateSpeed: 0.12,
    update(time, dt) {
      if (restarting) return;
      if (anim) {
        anim.t += dt / anim.duration;
        const t = Math.min(1, anim.t);
        if (t < 0.28) {
          const k = t / 0.28;
          anim.mesh.position.x = anim.start.x;
          anim.mesh.position.y = anim.start.y + (anim.liftY - anim.start.y) * k;
          anim.mesh.position.z = anim.start.z;
        } else if (t < 0.7) {
          const k = (t - 0.28) / 0.42;
          anim.mesh.position.x = anim.start.x + (anim.midX - anim.start.x) * k;
          anim.mesh.position.y = anim.liftY;
        } else {
          const k = (t - 0.7) / 0.3;
          anim.mesh.position.x = anim.midX;
          anim.mesh.position.y = anim.liftY + (anim.endY - anim.liftY) * k;
        }
        if (t >= 1) {
          anim.mesh.position.copy(anim.end);
          anim = null;
          wait = 0.12;
        }
      } else if (moveIndex < moves.length) {
        wait -= dt;
        if (wait <= 0) startMove();
      } else {
        doneWait += dt;
        if (doneWait > 2.2) {
          restarting = true;
          setTimeout(() => restart(), 350);
        }
      }
      pegMeshes.forEach((peg, i) => {
        peg.material.emissiveIntensity = 0.25 + Math.sin(time * 1.3 + i) * 0.08;
      });
    },
  };
}

export function network() {
  const group = new THREE.Group();
  const accent = '#00E1FF';

  const layers = [
    { name: '应用层', detail: 'HTTP', color: '#00E1FF', y: 4.4 },
    { name: '传输层', detail: 'TCP', color: '#79E86B', y: 2.95 },
    { name: '网络层', detail: 'IP', color: '#FFD37A', y: 1.5 },
    { name: '链路层', detail: 'Ethernet', color: '#FF6FC0', y: 0.05 },
  ];
  const slabs = [];

  layers.forEach((layer, i) => {
    const slab = box(6.6, 0.14, 4.6, layer.color, {
      transparent: true,
      opacity: 0.09,
      roughness: 0.2,
      metalness: 0.35,
      emissive: layer.color,
      emissiveIntensity: 0.2,
      depthWrite: false,
    });
    slab.position.set(0, layer.y, 0);
    group.add(slab);
    slabs.push(slab);

    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(6.6, 0.14, 4.6)),
      new THREE.LineBasicMaterial({
        color: new THREE.Color(layer.color),
        transparent: true,
        opacity: 0.34,
        toneMapped: false,
      })
    );
    border.position.copy(slab.position);
    group.add(border);

    addLabel(group, layer.name, [-4.4, layer.y + 0.22, 0], {
      color: layer.color,
      fontSize: 25,
      scale: 0.0058,
      bg: 'rgba(4, 10, 18, 0.7)',
      border: `rgba(120, 190, 220, 0.22)`,
      padding: 7,
    });
    addLabel(group, layer.detail, [-4.4, layer.y - 0.25, 0], {
      color: 'rgba(180, 205, 235, 0.6)',
      fontSize: 19,
      scale: 0.0049,
    });

    addLine(
      group,
      [
        [3.5, layer.y + 0.03, 2.1],
        [3.8, layer.y + 0.03, 2.4],
        [3.5, layer.y + 0.03, 2.7],
      ],
      layer.color,
      0.3
    );
  });

  addLine(group, [[0, 5.4, 0], [0, -0.1, 0]], accent, 0.18);

  const laptop = new THREE.Group();
  const baseL = box(1.15, 0.07, 0.8, '#183249', { metalness: 0.5, roughness: 0.3 });
  baseL.position.y = 5.62;
  const screen = box(1.15, 0.75, 0.05, '#1f4663', {
    metalness: 0.4,
    roughness: 0.25,
    emissive: '#2fb6d8',
    emissiveIntensity: 0.4,
  });
  screen.position.set(0, 6.0, -0.35);
  screen.rotation.x = -0.18;
  laptop.add(baseL, screen);
  group.add(laptop);
  addLabel(group, '客户端', [0, 6.65, 0], {
    color: '#9fdcff',
    fontSize: 22,
    scale: 0.0052,
  });

  const packet = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.38, 0.38),
    new THREE.MeshStandardMaterial({
      color: '#dffaff',
      emissive: '#6be7ff',
      emissiveIntensity: 1.8,
      transparent: true,
      opacity: 0.92,
      roughness: 0.2,
      metalness: 0.4,
    })
  );
  group.add(packet);
  addGlow(group, accent, 2.2, [0, 0, 0], 0.3);
  const packetGlow = group.children[group.children.length - 1];

  const capsules = [];
  for (let i = 0; i < 3; i += 1) {
    const capsule = new THREE.Mesh(
      new THREE.TorusGeometry(0.34 + i * 0.12, 0.012, 5, 32),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(layers[i].color),
        transparent: true,
        opacity: 0.6,
        toneMapped: false,
      })
    );
    capsule.rotation.x = Math.PI / 2;
    group.add(capsule);
    capsules.push(capsule);
  }
  const tags = layers.map((layer, i) => {
    const tag = addLabel(group, `${layer.detail} 头`, [0.52, 0, 0], {
      color: layer.color,
      fontSize: 20,
      scale: 0.0048,
      bg: 'rgba(4, 8, 14, 0.75)',
      border: `rgba(0, 225, 255, 0.2)`,
      padding: 6,
      opacity: 0,
    });
    tag.material.opacity = 0;
    tag.userData.index = i;
    return tag;
  });

  const server = new THREE.Group();
  server.position.set(5.4, 0, 0);
  const rack = box(1.5, 2.6, 1.4, '#12202f', { metalness: 0.5, roughness: 0.4 });
  rack.position.y = 1.15;
  server.add(rack);
  for (let i = 0; i < 4; i += 1) {
    const unit = box(1.3, 0.3, 0.05, '#1d3549', { metalness: 0.4, roughness: 0.4 });
    unit.position.set(0, 0.5 + i * 0.5, 0.73);
    server.add(unit);
    for (let j = 0; j < 3; j += 1) {
      const led = sphere(0.035, j === 1 ? '#79E86B' : '#00E1FF', {
        emissive: j === 1 ? '#79E86B' : '#00E1FF',
        emissiveIntensity: 1.8,
      });
      led.position.set(-0.4 + j * 0.18, 0.5 + i * 0.5, 0.76);
      server.add(led);
    }
  }
  group.add(server);
  addLabel(group, '服务器', [5.4, 3.0, 0], {
    color: '#9fdcff',
    fontSize: 23,
    scale: 0.0054,
  });

  addLabel(group, '一次点击，逐层封装与解封装', [0, -1.15, 2.6], {
    color: 'rgba(190, 225, 250, 0.75)',
    fontSize: 26,
    scale: 0.0059,
  });
  addLabel(group, 'IP 负责送到哪 · TCP 负责送对送全', [0, -1.7, 2.6], {
    color: 'rgba(160, 195, 230, 0.62)',
    fontSize: 21,
    scale: 0.0051,
  });

  return {
    group,
    view: { position: [9.6, 5.8, 12.8], target: [0.8, 2.5, 0] },
    autoRotate: false,
    update(time, dt) {
      const cycle = (time * 0.33) % 1;
      let x = 0;
      let y = 6.2;
      let activeLayer = -1;
      if (cycle < 0.7) {
        const t = cycle / 0.7;
        y = 6.2 - t * 6.25;
        activeLayer = Math.min(3, Math.floor(t * 4));
      } else if (cycle < 0.88) {
        const t = (cycle - 0.7) / 0.18;
        y = -0.05;
        x = t * 5.4;
        activeLayer = 3;
      } else {
        const t = (cycle - 0.88) / 0.12;
        x = 5.4;
        y = -0.05 + t * 6.25;
      }
      packet.position.set(x, y, 0);
      packet.rotation.y += dt * 1.4;
      packetGlow.position.set(x, y, 0);
      packetGlow.material.opacity = 0.22 + Math.sin(time * 4) * 0.08;
      capsules.forEach((capsule, i) => {
        capsule.position.set(x, y, 0);
        capsule.rotation.z += dt * (1 + i * 0.35);
        capsule.material.opacity = activeLayer >= i && activeLayer < 4 ? 0.36 + Math.sin(time * 3 + i) * 0.12 : 0.08;
      });
      tags.forEach((tag) => {
        const i = tag.userData.index;
        const visible = i <= activeLayer;
        tag.position.set(x + 0.48, y, 0);
        tag.material.opacity += ((visible ? 1 : 0) - tag.material.opacity) * Math.min(1, dt * 8);
        tag.visible = tag.material.opacity > 0.02;
      });
      slabs.forEach((slab, i) => {
        const active = i === activeLayer;
        slab.material.opacity += ((active ? 0.22 : 0.07) - slab.material.opacity) * Math.min(1, dt * 7);
        slab.material.emissiveIntensity = active ? 0.55 : 0.16;
      });
    },
  };
}
