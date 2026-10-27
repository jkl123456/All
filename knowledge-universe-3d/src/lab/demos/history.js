import {
  THREE,
  addGlow,
  addLabel,
  addLine,
  addRibbon,
  addTube,
  box,
  cone,
  cylinder,
  glyphPlane,
  seeded,
  sphere,
} from './helpers.js';

function makeFlow(group, curve, color, count = 14, seed = 1) {
  const rand = seeded(seed);
  const dots = [];
  for (let i = 0; i < count; i += 1) {
    const dot = sphere(0.045, color, {
      emissive: color,
      emissiveIntensity: 1.3,
      transparent: true,
      opacity: 0.8,
    });
    group.add(dot);
    dots.push({ dot, offset: rand() });
  }
  return { dots, curve };
}

function updateFlow(flow, time, speed = 0.1) {
  flow.dots.forEach((p) => {
    const u = (time * speed + p.offset) % 1;
    p.dot.position.copy(flow.curve.getPointAt(u));
    p.dot.material.opacity = Math.sin(Math.PI * u) * 0.85;
  });
}

export function dujiangyan() {
  const group = new THREE.Group();
  const waterColor = '#3FB6E4';
  const stone = '#8e9aa4';

  const land = box(15, 0.8, 10, '#28452f', {
    roughness: 0.92,
    emissive: '#12281a',
    emissiveIntensity: 0.25,
  });
  land.position.y = -0.4;
  group.add(land);

  for (let i = 0; i < 6; i += 1) {
    const mountain = cone(1.4 + (i % 3) * 0.4, 2.4 + (i % 2) * 0.7, '#335a3a', {
      roughness: 0.95,
      flatShading: true,
      emissive: '#142b1b',
      emissiveIntensity: 0.25,
    });
    mountain.position.set(-5.5 + i * 2.05, 1.25 + (i % 2) * 0.2, -3.8 - (i % 3) * 0.5);
    group.add(mountain);
  }

  const mainPoints = [
    new THREE.Vector3(0, 0.16, -4.8),
    new THREE.Vector3(0.05, 0.16, -2.8),
    new THREE.Vector3(0, 0.16, -1.9),
  ];
  addRibbon(group, mainPoints, 2.4, waterColor, 0.68, 0.16);

  const innerPoints = [
    new THREE.Vector3(0, 0.16, -1.9),
    new THREE.Vector3(-1.3, 0.16, -1.1),
    new THREE.Vector3(-2.25, 0.16, 0.4),
    new THREE.Vector3(-2.38, 0.16, 1.9),
    new THREE.Vector3(-1.92, 0.16, 2.8),
    new THREE.Vector3(-2.2, 0.16, 4.4),
  ];
  const outerPoints = [
    new THREE.Vector3(0, 0.16, -1.9),
    new THREE.Vector3(1.45, 0.16, -1.0),
    new THREE.Vector3(2.45, 0.16, 0.7),
    new THREE.Vector3(2.6, 0.16, 2.5),
    new THREE.Vector3(2.1, 0.16, 4.4),
  ];
  addRibbon(group, innerPoints, 1.55, waterColor, 0.66, 0.16);
  addRibbon(group, outerPoints, 1.75, waterColor, 0.6, 0.16);

  const innerCurve = new THREE.CatmullRomCurve3(innerPoints);
  const outerCurve = new THREE.CatmullRomCurve3(outerPoints);
  const mainCurve = new THREE.CatmullRomCurve3(mainPoints);
  const flows = [
    makeFlow(group, mainCurve, '#9fe9ff', 8, 3),
    makeFlow(group, innerCurve, '#b7f1ff', 16, 5),
    makeFlow(group, outerCurve, '#9fe9ff', 16, 7),
  ];
  flows[0].dots.forEach((p) => p.dot.material.opacity = 0.55);

  const fishMouthGeometry = new THREE.CylinderGeometry(0.48, 0.48, 2.9, 3);
  fishMouthGeometry.rotateX(Math.PI / 2);
  const fishMouth = new THREE.Mesh(
    fishMouthGeometry,
    new THREE.MeshStandardMaterial({
      color: stone,
      roughness: 0.88,
      flatShading: true,
      emissive: '#3b4349',
      emissiveIntensity: 0.2,
    })
  );
  fishMouth.position.set(0, 0.35, -1.9);
  fishMouth.scale.set(1.15, 0.55, 1);
  group.add(fishMouth);

  const spillway = box(2.6, 0.28, 0.9, '#7c8b96', {
    roughness: 0.8,
    metalness: 0.1,
    emissive: '#313b42',
    emissiveIntensity: 0.3,
  });
  spillway.position.set(1.2, 0.3, 1.2);
  spillway.rotation.y = -0.18;
  group.add(spillway);

  const rockA = box(0.9, 1.1, 1.1, '#6f7d88', { roughness: 0.9, flatShading: true });
  rockA.position.set(-2.55, 0.55, 2.6);
  const rockB = box(0.9, 1.1, 1.1, '#6f7d88', { roughness: 0.9, flatShading: true });
  rockB.position.set(-1.35, 0.55, 2.6);
  group.add(rockA, rockB);

  const canalPoints = [
    new THREE.Vector3(-1.95, 0.16, 2.7),
    new THREE.Vector3(-1.7, 0.16, 3.2),
    new THREE.Vector3(-0.8, 0.16, 3.7),
    new THREE.Vector3(0.4, 0.16, 4.6),
  ];
  addRibbon(group, canalPoints, 0.6, waterColor, 0.55, 0.16);
  updateFlow({ dots: [], curve: new THREE.CatmullRomCurve3(canalPoints) }, 0);

  addLabel(group, '鱼嘴分水堤', [-4.1, 2.35, -1.9], {
    color: '#c8f4ff',
    fontSize: 26,
    scale: 0.0061,
    bg: 'rgba(5, 12, 12, 0.7)',
    border: 'rgba(63, 182, 228, 0.3)',
    padding: 8,
  });
  addLine(group, [[-3.15, 2.2, -1.9], [-1.3, 0.5, -1.95]], waterColor, 0.32);
  addLabel(group, '四六分水', [-4.2, 1.75, -1.9], {
    color: 'rgba(150, 200, 220, 0.7)',
    fontSize: 19,
    scale: 0.005,
  });

  addLabel(group, '飞沙堰', [3.9, 2.0, 1.1], {
    color: '#ffd69b',
    fontSize: 26,
    scale: 0.0061,
    bg: 'rgba(8, 8, 5, 0.7)',
    border: 'rgba(232, 190, 120, 0.3)',
    padding: 8,
  });
  addLine(group, [[3.45, 1.85, 1.15], [2.4, 0.5, 1.2]], '#e8be78', 0.32);
  addLabel(group, '溢洪排沙', [3.9, 1.4, 1.1], {
    color: 'rgba(230, 195, 140, 0.7)',
    fontSize: 19,
    scale: 0.005,
  });

  addLabel(group, '宝瓶口', [-4.4, 3.0, 3.2], {
    color: '#a8f5e0',
    fontSize: 26,
    scale: 0.0061,
    bg: 'rgba(4, 12, 10, 0.7)',
    border: 'rgba(121, 232, 175, 0.3)',
    padding: 8,
  });
  addLine(group, [[-3.5, 2.85, 3.15], [-2.15, 0.8, 2.7]], '#79e8af', 0.32);
  addLabel(group, '控制进入灌区的水量', [-1.2, 2.7, 3.9], {
    color: 'rgba(160, 225, 195, 0.72)',
    fontSize: 19,
    scale: 0.005,
  });

  addLabel(group, '内江 · 灌溉', [-3.9, 1.05, 1.2], {
    color: '#9fe9ff',
    fontSize: 23,
    scale: 0.0057,
  });
  addLabel(group, '外江 · 泄洪', [4.0, 0.95, 2.8], {
    color: '#9fe9ff',
    fontSize: 23,
    scale: 0.0057,
  });
  addLabel(group, '深淘滩，低作堰', [0.2, -1.25, 4.3], {
    color: '#e8f7ff',
    fontSize: 27,
    scale: 0.0062,
    bg: 'rgba(4, 10, 12, 0.68)',
    padding: 9,
  });

  const mist = [];
  const rand = seeded(37);
  for (let i = 0; i < 8; i += 1) {
    const puff = sphere(0.5 + rand() * 0.45, '#cfefff', {
      transparent: true,
      opacity: 0.018,
      roughness: 1,
      depthWrite: false,
    });
    puff.scale.y = 0.22;
    puff.position.set(-5 + rand() * 10, 1.4 + rand() * 1.3, -2.4 + rand() * 1.5);
    group.add(puff);
    mist.push({ puff, phase: rand() * 6 });
  }

  addGlow(group, '#1d5f78', 16, [0, 1, -4], 0.22);

  return {
    group,
    view: { position: [9.8, 7.8, 13.2], target: [0, 0.3, 0] },
    autoRotateSpeed: 0.16,
    update(time) {
      flows.forEach((flow) => updateFlow(flow, time, 0.075));
      mist.forEach((m) => {
        m.puff.position.x += Math.sin(time * 0.22 + m.phase) * 0.002;
        m.puff.material.opacity = 0.012 + Math.sin(time * 0.5 + m.phase) * 0.008;
      });
      spillway.material.emissiveIntensity = 0.25 + Math.sin(time * 1.4) * 0.08;
    },
  };
}

export function silkroad() {
  const group = new THREE.Group();
  const gold = '#FFD37A';
  const sand = '#6b5639';

  const board = box(13.2, 0.65, 8.6, '#7a6242', {
    roughness: 0.92,
    emissive: '#4b3820',
    emissiveIntensity: 0.28,
  });
  board.position.y = -0.38;
  group.add(board);
  const boardEdge = box(13.4, 0.1, 8.8, '#b29364', { roughness: 0.75, emissive: '#4f3a1f', emissiveIntensity: 0.2 });
  boardEdge.position.y = -0.06;
  group.add(boardEdge);

  for (let i = 0; i < 7; i += 1) {
    const line = [];
    for (let j = 0; j <= 24; j += 1) {
      const x = -6.2 + (j / 24) * 12.4;
      line.push([x, 0.02, -3.3 + i * 0.95 + Math.sin(x * 0.65 + i * 1.3) * 0.24]);
    }
    addLine(group, line, '#a1865c', 0.16);
  }
  for (let i = 0; i < 5; i += 1) {
    addLine(
      group,
      [
        [-5.7 + i * 2.4, 0.02, -3.4],
        [-5.2 + i * 2.4, 0.02, 3.3],
      ],
      '#9c8057',
      0.08
    );
  }

  const china = sphere(1.4, '#5f9956', { roughness: 0.95, emissive: '#294f28', emissiveIntensity: 0.4 });
  china.scale.set(1.2, 0.06, 0.9);
  china.position.set(5.0, 0.06, 1.7);
  group.add(china);
  const europe = sphere(1.2, '#708c63', { roughness: 0.95, emissive: '#2d4a2d', emissiveIntensity: 0.35 });
  europe.scale.set(1.1, 0.05, 0.75);
  europe.position.set(-5.0, 0.06, -1.0);
  group.add(europe);
  const sea = sphere(1.0, '#3b809e', { roughness: 0.3, metalness: 0.3, emissive: '#1d546c', emissiveIntensity: 0.5 });
  sea.scale.set(1.6, 0.02, 0.8);
  sea.position.set(-2.2, 0.05, -2.6);
  group.add(sea);

  const routePoints = [
    [5.0, 0.5, 1.7],
    [3.9, 0.55, 1.2],
    [2.7, 0.6, 0.75],
    [1.3, 0.58, 0.3],
    [-0.2, 0.55, -0.1],
    [-1.8, 0.58, -0.5],
    [-3.4, 0.52, -0.75],
    [-5.0, 0.55, -1.0],
  ].map((p) => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(routePoints);
  addTube(group, curve.getPoints(100), gold, 0.035, 0.72);
  addTube(group, curve.getPoints(100).map((p) => p.clone().setY(p.y + 0.06)), '#ff9f45', 0.012, 0.4);

  const cities = [
    { name: '长安', pos: [5.0, 0.7, 1.7], color: '#ffd37a' },
    { name: '敦煌', pos: [2.7, 0.8, 0.75], color: '#ffc46b' },
    { name: '撒马尔罕', pos: [-0.2, 0.75, -0.1], color: '#ffe0a0' },
    { name: '巴格达', pos: [-3.4, 0.72, -0.75], color: '#ffc46b' },
    { name: '罗马', pos: [-5.0, 0.75, -1.0], color: '#ffd37a' },
  ];
  cities.forEach((city, index) => {
    const node = sphere(0.15, city.color, { emissive: city.color, emissiveIntensity: 1.9 });
    node.position.set(...city.pos);
    group.add(node);
    addGlow(group, city.color, 1.7, city.pos, 0.58);
    addLabel(group, city.name, [city.pos[0], city.pos[1] + 0.82, city.pos[2]], {
      color: '#fff1cf',
      fontSize: 26,
      scale: 0.0072,
      bg: 'rgba(18, 11, 5, 0.82)',
      border: 'rgba(255, 211, 122, 0.38)',
      padding: 8,
      opacity: index === 0 || index === 4 ? 1 : 0.94,
    });
  });

  addLabel(group, '丝绸之路 · 示意路线', [0, 2.35, -3.6], {
    color: gold,
    fontSize: 31,
    scale: 0.0072,
    bg: 'rgba(18, 11, 5, 0.82)',
    border: 'rgba(255, 211, 122, 0.36)',
    padding: 10,
    glow: 16,
    glowColor: gold,
  });
  addLabel(group, '商品 · 技术 · 宗教 · 艺术', [0, -1.8, 3.3], {
    color: 'rgba(240, 215, 165, 0.82)',
    fontSize: 23,
    scale: 0.0059,
  });

  const caravan = new THREE.Group();
  const camelBody = sphere(0.16, '#c89c62', { roughness: 0.8 });
  camelBody.scale.set(1.6, 0.8, 0.8);
  const hump1 = sphere(0.1, '#c89c62', { roughness: 0.8 });
  hump1.position.set(-0.12, 0.16, 0);
  const hump2 = hump1.clone();
  hump2.position.x = 0.15;
  const neck = cylinder(0.035, 0.05, 0.38, '#c89c62', { roughness: 0.8 });
  neck.position.set(0.3, 0.18, 0);
  neck.rotation.z = -0.5;
  const head = sphere(0.09, '#d8b27a', { roughness: 0.75 });
  head.position.set(0.48, 0.34, 0);
  const legGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.3, 5);
  const legMat = new THREE.MeshStandardMaterial({ color: '#a77b4d', roughness: 0.8 });
  for (const [x, z] of [[-0.15, 0.08], [0.12, 0.08], [-0.15, -0.08], [0.12, -0.08]]) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, -0.24, z);
    caravan.add(leg);
  }
  addLabel(caravan, '商队', [0, 0.75, 0], {
    color: '#ffe6b8',
    fontSize: 23,
    scale: 0.0058,
    bg: 'rgba(18, 11, 5, 0.62)',
    padding: 5,
  });
  caravan.add(camelBody, hump1, hump2, neck, head);
  caravan.scale.setScalar(1.5);
  group.add(caravan);

  const caravan2 = caravan.clone();
  caravan2.scale.setScalar(1.15);
  group.add(caravan2);

  const pulses = [];
  for (let i = 0; i < 4; i += 1) {
    const dot = sphere(0.055, '#fff0c4', { emissive: '#ffd37a', emissiveIntensity: 2 });
    group.add(dot);
    pulses.push({ dot, offset: i / 4 });
  }

  addGlow(group, '#6b4a1a', 17, [0, 0.5, -5], 0.2);

  return {
    group,
    view: { position: [7.8, 7.4, 11.8], target: [0, 0.25, 0] },
    autoRotateSpeed: 0.1,
    update(time) {
      const u = (time * 0.035 + 0.2) % 0.9;
      caravan.position.copy(curve.getPointAt(u));
      caravan.position.y += 0.02;
      caravan2.position.copy(curve.getPointAt((u + 0.08) % 0.9));
      caravan2.position.y += 0.02;
      pulses.forEach((p) => {
        const v = (time * 0.06 + p.offset) % 1;
        p.dot.position.copy(curve.getPointAt(v));
        p.dot.material.emissiveIntensity = 1.2 + Math.sin(time * 3 + p.offset * 6) * 0.5;
      });
    },
  };
}

export function printing() {
  const group = new THREE.Group();
  const gold = '#FFD37A';

  const table = box(7.6, 0.25, 5.6, '#5c3f29', {
    roughness: 0.8,
    emissive: '#2f1d0e',
    emissiveIntensity: 0.28,
  });
  table.position.y = -0.15;
  group.add(table);

  const workLight = new THREE.PointLight(0xffc98a, 26, 12, 2);
  workLight.position.set(0, 4.2, 2.4);
  group.add(workLight);
  addGlow(group, '#ffcf8a', 5.5, [0, 2.8, 0.5], 0.18);

  const frameMat = '#7b5735';
  const chars = ['活', '字', '印', '刷', '文', '明', '传', '播', '知', '识', '之', '光'];
  const blocks = [];
  const cols = 4;
  const rows = 3;
  for (let i = 0; i < chars.length; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const block = box(0.72, 0.36, 0.72, '#b87f51', {
      roughness: 0.65,
      emissive: '#5c361c',
      emissiveIntensity: 0.28,
    });
    block.position.set(-1.35 + col * 0.94, 0.21, -0.9 + row * 0.94);
    group.add(block);
    const glyph = glyphPlane(chars[i], 0.56, {
      bg: '#c98f5c',
      color: '#2b160d',
      fontSize: 160,
    });
    glyph.rotation.x = -Math.PI / 2;
    glyph.position.set(block.position.x, 0.399, block.position.z);
    group.add(glyph);
    blocks.push({ block, glyph, index: i });
  }

  const frameL = box(0.18, 0.7, 3.4, frameMat, { roughness: 0.75 });
  frameL.position.set(-2.05, 0.28, 0);
  const frameR = frameL.clone();
  frameR.position.x = 2.05;
  const frameB = box(4.3, 0.7, 0.18, frameMat, { roughness: 0.75 });
  frameB.position.set(0, 0.28, -1.5);
  const frameF = frameB.clone();
  frameF.position.z = 1.5;
  group.add(frameL, frameR, frameB, frameF);

  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(4.1, 3.1),
    new THREE.MeshStandardMaterial({
      color: '#f2e8d5',
      transparent: true,
      opacity: 0.18,
      roughness: 0.9,
      side: THREE.DoubleSide,
      emissive: '#cbb894',
      emissiveIntensity: 0.15,
      depthWrite: false,
    })
  );
  paper.rotation.x = -Math.PI / 2;
  paper.position.set(0, 2.3, 0);
  group.add(paper);

  const press = new THREE.Group();
  const plate = box(4.3, 0.22, 3.2, '#3d2a1b', { roughness: 0.7, metalness: 0.1 });
  press.add(plate);
  const handle = cylinder(0.08, 0.1, 1.4, '#6d4a2c', { roughness: 0.7 });
  handle.position.y = 1.0;
  press.add(handle);
  press.position.set(0, 3.0, 0);
  group.add(press);

  addLabel(group, '泥活字 · 单字可重复使用', [0, 4.1, -0.7], {
    color: '#ffdca4',
    fontSize: 28,
    scale: 0.0064,
    bg: 'rgba(10, 6, 4, 0.75)',
    border: 'rgba(255, 211, 122, 0.3)',
    padding: 9,
    glow: 12,
    glowColor: gold,
  });
  addLabel(group, '刻字 → 排版 → 涂墨 → 印刷 → 拆版', [0, -1.25, 2.5], {
    color: 'rgba(230, 205, 165, 0.72)',
    fontSize: 22,
    scale: 0.0054,
  });
  addLabel(group, '排版', [-3.6, 1.0, 1.5], {
    color: '#ffc986',
    fontSize: 21,
    scale: 0.0052,
  });
  addLabel(group, '涂墨', [3.5, 1.0, 1.5], {
    color: '#ffc986',
    fontSize: 21,
    scale: 0.0052,
  });

  const ink = sphere(0.16, '#2b1a12', { roughness: 0.4, metalness: 0.2 });
  ink.position.set(3.0, 0.5, 1.2);
  group.add(ink);

  const sparkles = [];
  for (let i = 0; i < 24; i += 1) {
    const dot = sphere(0.022, '#ffe6a6', { emissive: '#ffd37a', emissiveIntensity: 1.5 });
    group.add(dot);
    sparkles.push({ dot, phase: Math.random() * Math.PI * 2, x: (Math.random() - 0.5) * 4, z: (Math.random() - 0.5) * 3 });
  }

  return {
    group,
    view: { position: [6.8, 5.4, 10.0], target: [0, 0.9, 0] },
    autoRotateSpeed: 0.12,
    update(time) {
      const cycle = (time * 0.3 + 0.58) % 1;
      const pressDown = cycle < 0.3 ? Math.sin((cycle / 0.3) * Math.PI) : 0;
      press.position.y = 3.0 - pressDown * 2.55;
      paper.position.y = 2.3 - pressDown * 1.95;
      paper.material.opacity = 0.12 + pressDown * 0.18;
      blocks.forEach((b, i) => {
        const active = Math.floor(time * 1.1) % blocks.length === i;
        b.block.material.emissiveIntensity = active ? 0.9 : 0.15;
        b.glyph.material.opacity = active ? 1 : 0.72;
      });
      sparkles.forEach((s, i) => {
        s.dot.position.set(s.x + Math.sin(time + s.phase) * 0.08, 0.6 + ((time * 0.25 + i * 0.05) % 1) * 2.4, s.z);
        s.dot.material.opacity = 0.3 + (1 - ((time * 0.25 + i * 0.05) % 1)) * 0.5;
      });
    },
  };
}
