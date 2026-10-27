import {
  THREE,
  addDashedLine,
  addGlow,
  addLabel,
  addLine,
  addTube,
  box,
  cone,
  cylinder,
  seeded,
  sphere,
} from './helpers.js';

function createBird(color = '#070b12') {
  const bird = new THREE.Group();
  const body = sphere(0.08, color, { roughness: 0.8 });
  body.scale.set(1.6, 0.8, 0.8);
  const wingGeo = new THREE.BoxGeometry(0.52, 0.015, 0.12);
  const wingMat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const wingL = new THREE.Mesh(wingGeo, wingMat);
  wingL.position.set(0, 0.02, 0.14);
  wingL.rotation.x = 0.3;
  const wingR = wingL.clone();
  wingR.position.z = -0.14;
  wingR.rotation.x = -0.3;
  bird.add(body, wingL, wingR);
  bird.userData.wings = [wingL, wingR];
  return bird;
}

export function poetry() {
  const group = new THREE.Group();
  const warm = '#ffd9a0';
  const moonColor = '#fff2d0';

  group.fogColor = '#040810';
  group.background = '#040810';

  const waterGeo = new THREE.PlaneGeometry(60, 40, 60, 40);
  const water = new THREE.Mesh(
    waterGeo,
    new THREE.MeshStandardMaterial({
      color: '#061824',
      emissive: '#03101a',
      emissiveIntensity: 0.35,
      roughness: 0.18,
      metalness: 0.82,
      transparent: true,
      opacity: 0.96,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.9;
  group.add(water);
  const waterBase = waterGeo.attributes.position.array.slice();

  const moon = sphere(1.15, moonColor, {
    emissive: '#ffe7b0',
    emissiveIntensity: 1.05,
    roughness: 0.75,
    metalness: 0.05,
  });
  moon.position.set(-5.6, 2.0, -12.5);
  group.add(moon);
  addGlow(group, '#ffe3a4', 10, moon.position, 0.55);

  const reflection = addGlow(group, '#ffe3a4', 6, [-5.6, -0.72, -7.5], 0.22);
  reflection.scale.set(3.6, 12, 1);
  reflection.material.depthTest = false;

  const bank = sphere(9, '#0b1a1c', { roughness: 1, emissive: '#04100f', emissiveIntensity: 0.2 });
  bank.scale.set(1, 0.16, 0.8);
  bank.position.set(-8.5, -1.1, -2.5);
  group.add(bank);

  const tree = new THREE.Group();
  tree.position.set(-6.3, -0.9, -2.0);
  const trunk = cylinder(0.12, 0.24, 3.2, '#2d1d14', { roughness: 0.95, emissive: '#150b06', emissiveIntensity: 0.2 });
  trunk.position.y = 1.6;
  trunk.rotation.z = 0.14;
  tree.add(trunk);
  const branchMat = '#3d2718';
  for (let i = 0; i < 3; i += 1) {
    const branch = cylinder(0.05, 0.08, 1.4, branchMat, { roughness: 0.95 });
    branch.position.set(0.28, 2.2 + i * 0.28, -0.1 + i * 0.15);
    branch.rotation.z = -0.8 + i * 0.35;
    branch.rotation.x = 0.2;
    tree.add(branch);
  }
  const leafColors = ['#8f2d32', '#b8443d', '#d26947'];
  for (let i = 0; i < 12; i += 1) {
    const leaf = sphere(0.4 + (i % 3) * 0.14, leafColors[i % 3], {
      roughness: 0.9,
      emissive: '#5e1a1c',
      emissiveIntensity: 0.22,
      flatShading: true,
    });
    const a = (i / 12) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * (0.9 + (i % 4) * 0.3) + 0.6, 3.3 + Math.sin(a) * 0.65, Math.sin(a) * 0.5);
    leaf.scale.y = 0.72;
    tree.add(leaf);
  }
  group.add(tree);
  addLabel(group, '江枫', [-6.0, 4.7, -1.9], {
    color: '#e89a86',
    fontSize: 22,
    scale: 0.0055,
  });

  const boat = new THREE.Group();
  boat.position.set(1.2, -0.72, 2.2);
  const hullMat = { roughness: 0.85, emissive: '#0e0906', emissiveIntensity: 0.3 };
  const hull = box(3.2, 0.52, 1.15, '#2a1c13', hullMat);
  boat.add(hull);
  const bow = cone(0.62, 1.0, '#2a1c13', hullMat);
  bow.rotation.z = -Math.PI / 2;
  bow.position.set(2.0, 0.02, 0);
  bow.scale.z = 1.5;
  boat.add(bow);
  const stern = box(0.14, 0.9, 0.9, '#352317', hullMat);
  stern.position.set(-1.65, 0.35, 0);
  boat.add(stern);
  const canopy = box(1.4, 0.08, 1.0, '#4a3422', hullMat);
  canopy.position.set(-0.35, 1.4, 0);
  boat.add(canopy);

  const figure = new THREE.Group();
  const body = new THREE.CapsuleGeometry(0.16, 0.4, 4, 8);
  const bodyMesh = new THREE.Mesh(body, new THREE.MeshStandardMaterial({ color: '#101820', roughness: 0.9 }));
  bodyMesh.position.y = 0.82;
  const head = sphere(0.13, '#17222d', { roughness: 0.9 });
  head.position.y = 1.27;
  figure.add(bodyMesh, head);
  figure.position.set(-0.2, 0.25, 0.1);
  boat.add(figure);

  const pole = cylinder(0.025, 0.03, 2.2, '#3e2b1d', { roughness: 0.9 });
  pole.position.set(0.65, 1.2, 0.25);
  boat.add(pole);
  const lantern = sphere(0.16, '#ffc46b', {
    emissive: '#ff9f35',
    emissiveIntensity: 2.2,
    roughness: 0.4,
  });
  lantern.position.set(0.65, 2.3, 0.25);
  boat.add(lantern);
  addGlow(boat, '#ffb45e', 2.2, lantern.position, 0.75);
  const lanternLight = new THREE.PointLight(0xffb45e, 12, 9, 2);
  lanternLight.position.copy(lantern.position);
  boat.add(lanternLight);
  group.add(boat);
  addLabel(group, '渔火', [2.7, -0.1, 2.4], {
    color: warm,
    fontSize: 22,
    scale: 0.0055,
  });

  const ripples = [];
  for (let i = 0; i < 5; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.95 + i * 0.6, 0.97 + i * 0.6, 64),
      new THREE.MeshBasicMaterial({
        color: 0x8fc7d8,
        transparent: true,
        opacity: 0.1 - i * 0.014,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(1.2, -0.88, 2.2);
    ring.scale.z = 0.55;
    group.add(ring);
    ripples.push({ ring, phase: i * 0.8 });
  }

  const crows = [];
  for (let i = 0; i < 3; i += 1) {
    const bird = createBird('#05080e');
    group.add(bird);
    crows.push({ bird, phase: i * 2.1, radius: 3.8 + i * 0.8, y: 3.2 + i * 0.5 });
  }

  const frostCount = 240;
  const frostPositions = new Float32Array(frostCount * 3);
  const rand = seeded(1024);
  for (let i = 0; i < frostCount; i += 1) {
    frostPositions.set([(rand() - 0.5) * 28, rand() * 12 - 1, (rand() - 0.5) * 24], i * 3);
  }
  const frostGeo = new THREE.BufferGeometry();
  frostGeo.setAttribute('position', new THREE.BufferAttribute(frostPositions, 3));
  const frost = new THREE.Points(
    frostGeo,
    new THREE.PointsMaterial({
      color: 0xdff4ff,
      size: 0.035,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
  );
  frost.frustumCulled = false;
  group.add(frost);

  const poem1 = [...'月落乌啼霜满天'].join('\n');
  const poem2 = [...'江枫渔火对愁眠'].join('\n');
  addLabel(group, poem1, [5.7, 2.6, 1.0], {
    color: '#f3e6c9',
    fontSize: 38,
    scale: 0.0082,
    glow: 16,
    glowColor: '#ffd9a0',
    opacity: 0.92,
  });
  addLabel(group, poem2, [4.95, 2.6, 1.0], {
    color: '#f3e6c9',
    fontSize: 38,
    scale: 0.0082,
    glow: 16,
    glowColor: '#ffd9a0',
    opacity: 0.92,
  });
  addLabel(group, '枫桥夜泊 · 张继', [5.3, 4.75, 1.0], {
    color: '#ffd9a0',
    fontSize: 27,
    scale: 0.0062,
    bg: 'rgba(5, 8, 14, 0.55)',
    border: 'rgba(255, 217, 160, 0.24)',
    padding: 8,
  });
  addLabel(group, '意象：月 · 乌 · 霜 · 江枫 · 渔火', [1.8, -1.55, 5.0], {
    color: 'rgba(220, 205, 175, 0.68)',
    fontSize: 23,
    scale: 0.0055,
  });

  addGlow(group, '#182d4d', 20, [-10, 4, -16], 0.2);

  return {
    group,
    view: { position: [7.2, 3.7, 14.4], target: [0.4, 1.5, 0] },
    autoRotate: false,
    fogColor: '#040810',
    background: '#040810',
    update(time, dt) {
      const positions = waterGeo.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        const x = waterBase[i];
        const y = waterBase[i + 1];
        positions[i + 2] = Math.sin(x * 0.55 + time * 0.7) * 0.035 + Math.cos(y * 0.75 + time * 0.5) * 0.025;
      }
      waterGeo.attributes.position.needsUpdate = true;
      boat.position.y = -0.72 + Math.sin(time * 0.75) * 0.045;
      boat.rotation.z = Math.sin(time * 0.5) * 0.012;
      boat.rotation.x = Math.cos(time * 0.42) * 0.008;
      lantern.material.emissiveIntensity = 1.8 + Math.sin(time * 3.6) * 0.5;
      lanternLight.intensity = 10 + Math.sin(time * 3.6) * 3;
      reflection.material.opacity = 0.16 + Math.sin(time * 0.8) * 0.045;
      ripples.forEach((r) => {
        const scale = 1 + Math.sin(time * 0.7 + r.phase) * 0.1;
        r.ring.scale.set(scale, scale, 0.55);
        r.ring.material.opacity = 0.055 + Math.sin(time * 0.7 + r.phase) * 0.025;
      });
      const fp = frostGeo.attributes.position.array;
      for (let i = 0; i < frostCount; i += 1) {
        fp[i * 3 + 1] -= dt * (0.18 + (i % 5) * 0.025);
        fp[i * 3] += Math.sin(time * 0.4 + i) * dt * 0.02;
        if (fp[i * 3 + 1] < -1.2) fp[i * 3 + 1] = 10.5;
      }
      frostGeo.attributes.position.needsUpdate = true;
      crows.forEach((crow, i) => {
        const angle = time * 0.08 + crow.phase;
        crow.bird.position.set(-5.0 + Math.cos(angle) * crow.radius, crow.y + Math.sin(time * 0.4 + i) * 0.2, -8.5 + Math.sin(angle) * 2.2);
        crow.bird.rotation.y = -angle;
        crow.bird.userData.wings[0].rotation.z = Math.sin(time * 3 + i) * 0.5;
        crow.bird.userData.wings[1].rotation.z = -Math.sin(time * 3 + i) * 0.5;
      });
      tree.rotation.z = Math.sin(time * 0.4) * 0.004;
    },
  };
}

export function couplet() {
  const group = new THREE.Group();
  const red = '#8f2f36';
  const gold = '#FFD37A';

  const pillars = new THREE.Group();
  for (const x of [-3.25, 3.25]) {
    const pillar = box(0.5, 6.4, 0.5, red, {
      roughness: 0.62,
      emissive: '#3d1114',
      emissiveIntensity: 0.3,
    });
    pillar.position.set(x, 0.8, 0);
    pillars.add(pillar);
    const cap = box(0.8, 0.24, 0.8, '#b58a4d', { metalness: 0.35, roughness: 0.4 });
    cap.position.set(x, 4.1, 0);
    pillars.add(cap);
  }
  const lintel = box(7.0, 0.5, 0.6, red, { roughness: 0.6, emissive: '#3d1114', emissiveIntensity: 0.3 });
  lintel.position.set(0, 4.35, 0);
  pillars.add(lintel);
  const roof = box(8.2, 0.18, 1.8, '#5c1e23', { roughness: 0.7 });
  roof.position.set(0, 4.85, 0);
  pillars.add(roof);
  group.add(pillars);

  const scrolls = [];
  for (const x of [-1.55, 1.55]) {
    const scroll = box(1.62, 5.9, 0.05, '#d8c3a2', {
      roughness: 0.82,
      emissive: '#7a6549',
      emissiveIntensity: 0.18,
      transparent: true,
      opacity: 0.22,
    });
    scroll.position.set(x, 1.0, 0);
    group.add(scroll);
    scrolls.push(scroll);
  }

  const lines = ['两个黄鹂鸣翠柳', '一行白鹭上青天'];
  const pairGroups = [
    [0, 1],
    [2, 3],
    [4],
    [5, 6],
  ];
  const pairColors = ['#FFD37A', '#79E86B', '#6BE7FF', '#FF9DB5'];

  const charSprites = [];
  lines.forEach((line, lineIndex) => {
    for (let i = 0; i < line.length; i += 1) {
      const char = addLabel(group, line[i], [lineIndex === 0 ? -1.55 : 1.55, 3.15 - i * 0.72, 0.14], {
        color: '#ffe8bd',
        fontSize: 46,
        scale: 0.0068,
        glow: 14,
        glowColor: gold,
        bg: 'rgba(30, 12, 10, 0.24)',
        padding: 6,
        radius: 6,
      });
      charSprites.push({ sprite: char, line: lineIndex, index: i });
    }
  });

  const pairLines = [];
  for (const pair of pairGroups) {
    const color = pairColors[pairGroups.indexOf(pair)];
    for (const index of pair) {
      const y = 3.15 - index * 0.72;
      const line = addDashedLine(group, [[-1.55, y, 0.08], [1.55, y, 0.08]], color, 0.12, 0.16, 0.12);
      pairLines.push({ line, groupIndex: pairGroups.indexOf(pair), color });
    }
  }

  const legend = [
    { text: '数量', color: pairColors[0] },
    { text: '名词', color: pairColors[1] },
    { text: '动词', color: pairColors[2] },
    { text: '偏正短语', color: pairColors[3] },
  ];
  legend.forEach((item, i) => {
    addLabel(group, item.text, [4.85, 2.2 - i * 0.45, 0], {
      color: item.color,
      fontSize: 21,
      scale: 0.0052,
      align: 'left',
    });
    const dot = sphere(0.045, item.color, { emissive: item.color, emissiveIntensity: 1.2 });
    dot.position.set(4.42, 2.2 - i * 0.45, 0);
    group.add(dot);
  });

  const lanterns = [];
  for (const x of [-2.55, 2.55]) {
    const lantern = sphere(0.28, '#e05a3f', {
      emissive: '#c33922',
      emissiveIntensity: 1.0,
      roughness: 0.5,
    });
    lantern.scale.y = 1.2;
    lantern.position.set(x, 2.75, 0.5);
    group.add(lantern);
    addGlow(group, '#ff8b5e', 2.4, [x, 2.75, 0.5], 0.4);
    const tassel = cylinder(0.01, 0.01, 0.4, '#f0b35b', { emissiveIntensity: 0.4 });
    tassel.position.set(x, 2.25, 0.5);
    group.add(tassel);
    const string = cylinder(0.007, 0.007, 0.8, '#d8b26e');
    string.position.set(x, 3.4, 0.5);
    group.add(string);
    lanterns.push({ lantern, x, phase: x });
  }

  addLabel(group, '两个黄鹂鸣翠柳 / 一行白鹭上青天', [0, -2.45, 0.4], {
    color: '#f0dcb6',
    fontSize: 25,
    scale: 0.0058,
    bg: 'rgba(20, 8, 7, 0.6)',
    padding: 9,
  });
  addLabel(group, '字数相等 · 词性相对 · 结构相同 · 平仄相谐', [0, -3.05, 0.4], {
    color: 'rgba(210, 185, 150, 0.66)',
    fontSize: 21,
    scale: 0.0052,
  });
  addLabel(group, '上联', [-1.55, 3.9, 0.2], {
    color: 'rgba(255, 220, 170, 0.65)',
    fontSize: 21,
    scale: 0.0052,
  });
  addLabel(group, '下联', [1.55, 3.9, 0.2], {
    color: 'rgba(255, 220, 170, 0.65)',
    fontSize: 21,
    scale: 0.0052,
  });

  return {
    group,
    view: { position: [0, 1.3, 13.8], target: [0, 1.1, 0] },
    autoRotate: false,
    update(time) {
      const active = Math.floor(time * 0.75) % 4;
      pairLines.forEach((p) => {
        const target = p.groupIndex === active ? 0.6 : 0.1;
        p.line.material.opacity += (target - p.line.material.opacity) * 0.08;
      });
      charSprites.forEach((c) => {
        const inActive = pairGroups[active].includes(c.index);
        const scale = inActive ? 1.08 : 1;
        c.sprite.scale.x += ((c.sprite.userData.width * 0.0068 * scale) - c.sprite.scale.x) * 0.06;
        c.sprite.scale.y += ((c.sprite.userData.height * 0.0068 * scale) - c.sprite.scale.y) * 0.06;
      });
      lanterns.forEach((l) => {
        l.lantern.rotation.z = Math.sin(time * 0.7 + l.phase) * 0.04;
        l.lantern.material.emissiveIntensity = 0.8 + Math.sin(time * 2 + l.phase) * 0.2;
      });
    },
  };
}

export function hanzi() {
  const group = new THREE.Group();
  const gold = '#FFD37A';
  const jade = '#79E86B';

  const pedestalMat = { roughness: 0.65, metalness: 0.2, emissive: '#1a2634', emissiveIntensity: 0.3 };
  const positions = [
    { x: -4.2, z: -1.1, glyph: '日', meaning: '太阳', kind: '象形' },
    { x: 0, z: 0.7, glyph: '山', meaning: '山峰', kind: '象形' },
    { x: 4.2, z: -1.1, glyph: '休', meaning: '人倚树休息', kind: '会意' },
  ];

  positions.forEach((p, i) => {
    const pedestal = cylinder(1.15, 1.3, 0.5, '#1a2a3b', pedestalMat);
    pedestal.position.set(p.x, 0.05, p.z);
    group.add(pedestal);
    const topRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.14, 0.015, 6, 72),
      new THREE.MeshBasicMaterial({
        color: i === 2 ? gold : jade,
        transparent: true,
        opacity: 0.4,
        toneMapped: false,
      })
    );
    topRing.rotation.x = Math.PI / 2;
    topRing.position.set(p.x, 0.31, p.z);
    group.add(topRing);
    addLabel(group, p.glyph, [p.x, 1.0, p.z + 1.25], {
      color: '#fff1cf',
      fontSize: 44,
      scale: 0.0072,
      bg: 'rgba(6, 10, 18, 0.7)',
      border: 'rgba(255, 211, 122, 0.3)',
      padding: 9,
      glow: 12,
      glowColor: gold,
    });
    addLabel(group, `${p.meaning} · ${p.kind}`, [p.x, 0.42, p.z + 1.35], {
      color: 'rgba(190, 215, 235, 0.7)',
      fontSize: 22,
      scale: 0.0054,
    });
  });

  const sunGroup = new THREE.Group();
  sunGroup.position.set(-4.2, 2.2, -1.0);
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.72, 48),
    new THREE.MeshBasicMaterial({
      color: '#ffcf6b',
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      toneMapped: false,
    })
  );
  sunGroup.add(sunDisc);
  const sunRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.74, 0.04, 8, 64),
    new THREE.MeshBasicMaterial({ color: gold, toneMapped: false })
  );
  sunGroup.add(sunRing);
  const sunDot = sphere(0.11, '#fff6d8', { emissive: '#ffe9a8', emissiveIntensity: 2.4 });
  sunDot.position.z = 0.03;
  sunGroup.add(sunDot);
  addGlow(sunGroup, '#ffd37a', 3.4, [0, 0, 0], 0.4);
  group.add(sunGroup);

  const mountainGroup = new THREE.Group();
  mountainGroup.position.set(0, 0.35, 0.65);
  const mountainData = [
    { x: -0.62, h: 1.45, r: 0.62 },
    { x: 0, h: 2.35, r: 0.8 },
    { x: 0.66, h: 1.65, r: 0.62 },
  ];
  mountainData.forEach((m) => {
    const coneMesh = cone(m.r, m.h, '#4f8d78', {
      roughness: 0.72,
      flatShading: true,
      emissive: '#22503f',
      emissiveIntensity: 0.35,
    });
    coneMesh.position.set(m.x, m.h / 2, 0);
    mountainGroup.add(coneMesh);
    const ridge = cone(m.r * 0.5, m.h * 0.34, '#b7e8d4', {
      roughness: 0.7,
      transparent: true,
      opacity: 0.35,
    });
    ridge.position.set(m.x, m.h * 0.93, 0);
    mountainGroup.add(ridge);
  });
  addGlow(mountainGroup, '#79e8b0', 3.2, [0, 1.1, 0], 0.24);
  group.add(mountainGroup);

  const restGroup = new THREE.Group();
  restGroup.position.set(4.2, 0.35, -1.0);
  const trunk = cylinder(0.09, 0.16, 2.3, '#6b4b2c', { roughness: 0.9 });
  trunk.position.set(0.55, 1.15, 0);
  restGroup.add(trunk);
  for (let i = 0; i < 3; i += 1) {
    const foliage = cone(0.72 - i * 0.14, 0.9, '#4f8d5d', {
      roughness: 0.8,
      flatShading: true,
      emissive: '#1e3d22',
      emissiveIntensity: 0.25,
    });
    foliage.position.set(0.55, 2.0 + i * 0.5, 0);
    restGroup.add(foliage);
  }
  const person = new THREE.Group();
  const pBody = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.13, 0.55, 4, 8),
    new THREE.MeshStandardMaterial({
      color: '#e0b477',
      roughness: 0.6,
      emissive: '#6b4b24',
      emissiveIntensity: 0.3,
    })
  );
  pBody.position.y = 0.65;
  pBody.rotation.z = 0.22;
  const pHead = sphere(0.15, '#f1cd9a', { roughness: 0.55, emissive: '#7a5528', emissiveIntensity: 0.2 });
  pHead.position.set(-0.1, 1.2, 0);
  const legL = cylinder(0.04, 0.04, 0.55, '#c79860', { roughness: 0.7 });
  legL.position.set(-0.1, 0.25, 0.1);
  legL.rotation.z = 0.5;
  const legR = legL.clone();
  legR.position.z = -0.1;
  legR.rotation.z = 0.1;
  person.add(pBody, pHead, legL, legR);
  person.position.set(-0.55, 0, 0);
  restGroup.add(person);
  addGlow(restGroup, '#ffd37a', 3.0, [0, 1.2, 0], 0.18);
  group.add(restGroup);

  addLabel(group, '汉字：从图画到文字', [0, 5.25, 0.4], {
    color: gold,
    fontSize: 34,
    scale: 0.0074,
    bg: 'rgba(6, 11, 18, 0.72)',
    border: 'rgba(255, 211, 122, 0.3)',
    padding: 11,
    glow: 16,
    glowColor: gold,
  });
  addLabel(group, '甲骨文 → 金文 → 小篆 → 隶书 → 楷书', [0, -0.75, 4.0], {
    color: 'rgba(225, 235, 250, 0.78)',
    fontSize: 26,
    scale: 0.0059,
  });
  addLabel(group, '象形 · 会意 · 形声', [0, -1.3, 4.0], {
    color: 'rgba(170, 205, 235, 0.64)',
    fontSize: 22,
    scale: 0.0053,
  });

  const motes = [];
  for (let i = 0; i < 40; i += 1) {
    const mote = addGlow(group, '#ffe7b0', 0.09, [(Math.random() - 0.5) * 12, 0.5 + Math.random() * 4, (Math.random() - 0.5) * 8], 0.2);
    motes.push({ mote, phase: Math.random() * 6, speed: 0.1 + Math.random() * 0.15 });
  }

  addGlow(group, '#293a52', 16, [0, 2, -6], 0.2);

  return {
    group,
    view: { position: [7.6, 4.4, 12.6], target: [0, 1.5, 0] },
    autoRotateSpeed: 0.16,
    update(time, dt) {
      sunGroup.rotation.z = time * 0.08;
      sunDot.scale.setScalar(1 + Math.sin(time * 2) * 0.08);
      mountainGroup.rotation.y = Math.sin(time * 0.3) * 0.04;
      person.position.y = Math.sin(time * 1.1) * 0.025;
      motes.forEach((m) => {
        m.mote.position.y += dt * m.speed;
        m.mote.position.x += Math.sin(time * 0.4 + m.phase) * dt * 0.05;
        if (m.mote.position.y > 4.8) m.mote.position.y = 0.4;
        m.mote.material.opacity = 0.1 + (Math.sin(time + m.phase) * 0.5 + 0.5) * 0.18;
      });
    },
  };
}
