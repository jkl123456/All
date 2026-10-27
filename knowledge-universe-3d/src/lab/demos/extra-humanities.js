/**
 * 扩充知识点的三维案例（历史 / 语文）
 * 语文尽量做成「一个可以绕着看的小舞台」：房间、楼、田、江。
 */
import {
  THREE,
  addGlow,
  addLabel,
  addLine,
  addTube,
  box,
  cone,
  cylinder,
  glyphPlane,
  material,
  ringLine,
  seeded,
  sphere,
  torus,
} from './helpers.js';

function waterPlane(size, color, y = -1.5, opacity = 0.85) {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size, 40, 40),
    new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity,
      roughness: 0.18,
      metalness: 0.6,
      emissive: color,
      emissiveIntensity: 0.16,
    })
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = y;
  return plane;
}

function waves(plane) {
  const base = plane.geometry.attributes.position.array.slice();
  return (time) => {
    const arr = plane.geometry.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = base[i];
      const y = base[i + 1];
      arr[i + 2] = Math.sin(x * 0.35 + time * 1.1) * 0.07 + Math.cos(y * 0.28 + time * 0.8) * 0.05;
    }
    plane.geometry.attributes.position.needsUpdate = true;
  };
}

/* -------------------------------- 郑和下西洋 ------------------------------- */
export function voyage() {
  const group = new THREE.Group();
  const sea = waterPlane(26, '#17506b', -1.4);
  group.add(sea);
  const wave = waves(sea);

  const ship = new THREE.Group();
  const hull = box(3.4, 0.8, 1.3, '#3a2616', { roughness: 0.85, emissive: '#1b0f08', emissiveIntensity: 0.2 });
  ship.add(hull);
  const bow = cone(0.66, 1.3, '#3a2616', { roughness: 0.85 });
  bow.rotation.z = -Math.PI / 2;
  bow.position.set(2.1, 0, 0);
  bow.scale.z = 1.3;
  ship.add(bow);
  const deck = box(3.2, 0.1, 1.16, '#6b4a2c', { roughness: 0.8 });
  deck.position.y = 0.42;
  ship.add(deck);
  const mast = cylinder(0.05, 0.07, 2.8, '#5a3d22');
  mast.position.set(-0.4, 1.8, 0);
  ship.add(mast);
  const sail = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 2.0, 8, 8),
    new THREE.MeshStandardMaterial({ color: '#d9c39a', transparent: true, opacity: 0.9, side: THREE.DoubleSide, roughness: 0.9 })
  );
  sail.position.set(-0.4, 2.1, 0);
  sail.rotation.y = Math.PI / 2;
  ship.add(sail);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.4),
    new THREE.MeshStandardMaterial({ color: '#c8443c', side: THREE.DoubleSide, roughness: 0.9 })
  );
  flag.position.set(-0.4, 3.1, 0);
  ship.add(flag);
  ship.scale.setScalar(1.5);
  ship.position.set(-9, -0.9, 0);
  ship.rotation.y = 0.3;
  group.add(ship);

  const route = [];
  for (let i = 0; i <= 60; i += 1) {
    const u = i / 60;
    route.push(new THREE.Vector3(-9 + u * 18, -1.32, Math.sin(u * Math.PI * 1.6) * 1.6));
  }
  addLine(group, route, '#FFB86B', 0.55);

  const ports = [0, 0.22, 0.45, 0.68, 0.86, 1];
  ports.forEach((u, i) => {
    const x = -9 + u * 18;
    const z = Math.sin(u * Math.PI * 1.6) * 1.6;
    const pillar = cylinder(0.06, 0.1, 0.7, '#FFD37A', { emissive: '#FFB86B', emissiveIntensity: 0.5 });
    pillar.position.set(x, -1.0, z);
    group.add(pillar);
    addLabel(group, ['太仓', '占城', '满剌加', '锡兰', '古里', '麻林地'][i], [x, -0.1, z - 0.55], {
      fontSize: 24, scale: 0.0062, color: 'rgba(255,240,210,0.98)',
    });
  });

  // 指南针
  const compass = new THREE.Group();
  const disc = cylinder(0.75, 0.75, 0.08, '#1a2735', { metalness: 0.5, roughness: 0.4 });
  compass.add(disc);
  const needle = box(0.05, 0.02, 1.2, '#FF8E6B', { emissive: '#FF8E6B', emissiveIntensity: 0.8 });
  compass.add(needle);
  compass.position.set(9.5, -1.2, -4.2);
  group.add(compass);

  addLabel(group, '1405 — 1433 · 七下西洋', [0, 4.0, -3], {
    fontSize: 30, scale: 0.0058, color: '#ffe9bd', bg: 'rgba(6,11,20,0.8)', border: 'rgba(255,211,122,0.4)', padding: 12,
  });

  return {
    group,
    view: { position: [0, 11.5, 15.5], target: [0, -0.2, 0] },
    autoRotateSpeed: 0.1,
    update(time) {
      wave(time);
      const u = (time * 0.045) % 1;
      const idx = Math.min(59, Math.floor(u * 60));
      const p = route[idx];
      ship.position.set(p.x, -0.9 + Math.sin(time * 1.4) * 0.06, p.z);
      ship.rotation.y = Math.sin(time * 0.5) * 0.08;
      ship.rotation.z = Math.sin(time * 1.1) * 0.03;
      sail.rotation.z = Math.sin(time * 1.2) * 0.04;
      flag.rotation.y = Math.sin(time * 2.2) * 0.5;
      compass.rotation.y = time * 0.2;
    },
  };
}

/* --------------------------------- 大运河 -------------------------------- */
export function canal() {
  const group = new THREE.Group();
  const lower = new THREE.Mesh(
    new THREE.BoxGeometry(5.4, 0.5, 7.4),
    new THREE.MeshStandardMaterial({ color: '#1a6a86', transparent: true, opacity: 0.7, roughness: 0.2, metalness: 0.4 })
  );
  lower.position.set(-4.2, -1.3, 0);
  group.add(lower);
  const upper = lower.clone();
  upper.position.set(4.2, 0.3, 0);
  group.add(upper);

  const wallMat = { roughness: 0.9, emissive: '#1b1812', emissiveIntensity: 0.2 };
  [-7.4, -0.9, 0.9, 7.4].forEach((x) => {
    const wall = box(0.5, 3.4, 7.6, '#3b3226', wallMat);
    wall.position.set(x, 0.4, 0);
    group.add(wall);
  });
  const gate = box(0.24, 2.4, 5.2, '#5a4a32', { roughness: 0.8, metalness: 0.2 });
  gate.position.set(0, 0.6, 0);
  group.add(gate);

  const boat = new THREE.Group();
  const hull = box(2.2, 0.5, 1.0, '#3a2616', { roughness: 0.85 });
  boat.add(hull);
  const cabin = box(1.0, 0.6, 0.8, '#6b4a2c', { roughness: 0.8 });
  cabin.position.set(-0.2, 0.55, 0);
  boat.add(cabin);
  group.add(boat);

  addLabel(group, '水位低', [-4.2, 2.9, 0], { fontSize: 18, scale: 0.0044, color: 'rgba(150,220,255,0.9)' });
  addLabel(group, '水位高', [4.2, 2.9, 0], { fontSize: 18, scale: 0.0044, color: 'rgba(150,220,255,0.9)' });
  addLabel(group, '闸门', [0, 2.5, 2.8], { fontSize: 18, scale: 0.0044, color: 'rgba(255,235,190,0.9)' });
  addLabel(group, '涿郡 ← 洛阳 → 余杭', [0, 4.0, 0], {
    fontSize: 28, scale: 0.0056, color: '#ffe9bd', bg: 'rgba(6,11,20,0.8)', border: 'rgba(255,211,122,0.4)', padding: 11,
  });

  return {
    group,
    view: { position: [0, 5.2, 13.2], target: [0, 0.4, 0] },
    autoRotateSpeed: 0.1,
    update(time) {
      const u = (time * 0.12) % 1;
      const x = -6.4 + u * 12.8;
      const lift = x < -0.6 ? 0 : x > 0.6 ? 1 : (x + 0.6) / 1.2;
      boat.position.set(x, -0.85 + lift * 1.6 + Math.sin(time * 1.6) * 0.03, 1.4);
      boat.rotation.y = Math.PI / 2;
      gate.scale.y = 1 - Math.abs(x) < 1.2 ? 0.3 : 1;
      gate.position.y = 0.6 + (Math.abs(x) < 1.2 ? 0.9 : 0);
    },
  };
}

/* -------------------------------- 商鞅变法 -------------------------------- */
export function reform() {
  const group = new THREE.Group();
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(7, 48),
    material('#1a1510', { roughness: 0.95, emissive: '#0b0906', emissiveIntensity: 0.3 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.6;
  group.add(ground);

  const gate = new THREE.Group();
  const pillarMat = { roughness: 0.85, emissive: '#1a1208', emissiveIntensity: 0.2 };
  [-1.9, 1.9].forEach((x) => {
    const p = box(0.5, 3.6, 0.5, '#4a3a28', pillarMat);
    p.position.set(x, 0.2, -2.2);
    gate.add(p);
  });
  const lintel = box(4.6, 0.4, 0.6, '#5a4630', pillarMat);
  lintel.position.set(0, 2.0, -2.2);
  gate.add(lintel);
  const roof = cone(2.9, 0.7, '#3a2a1e', { roughness: 0.9, segments: 4 });
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 2.55, -2.2);
  gate.add(roof);
  group.add(gate);

  const pole = cylinder(0.12, 0.15, 3.2, '#8a6a45', { roughness: 0.9 });
  pole.position.set(0, 0, 1.2);
  group.add(pole);
  addLabel(group, '徙木立信', [0, 2.1, 1.2], { fontSize: 22, scale: 0.005, color: '#ffe9bd' });

  const coins = [];
  for (let i = 0; i < 5; i += 1) {
    const c = cylinder(0.16, 0.16, 0.05, '#FFD37A', { metalness: 0.8, roughness: 0.3, emissive: '#8a6a20', emissiveIntensity: 0.4 });
    c.rotation.x = Math.PI / 2;
    c.position.set(-0.9 + i * 0.45, -1.5, 1.9);
    group.add(c);
    coins.push(c);
  }

  const crowd = [];
  for (let i = 0; i < 6; i += 1) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.6, 4, 8), material('#20242e', { roughness: 0.9 }));
    body.position.y = 0.5;
    g.add(body);
    const head = sphere(0.14, '#4a3a2c', { roughness: 0.9 });
    head.position.y = 1.06;
    g.add(head);
    const a = -0.9 + i * 0.36;
    g.position.set(Math.cos(a) * 4.4, -1.6, Math.sin(a) * 2.4 + 1.2);
    group.add(g);
    crowd.push(g);
  }

  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 2.2, 10, 10),
    new THREE.MeshStandardMaterial({ color: '#8a2a24', side: THREE.DoubleSide, roughness: 0.9 })
  );
  banner.position.set(-2.6, 0.6, -1.4);
  group.add(banner);
  addLabel(group, '废井田 · 奖军功 · 编户齐民', [0, 4.0, -1], {
    fontSize: 22, scale: 0.0048, color: '#eaf6ff',
  });

  return {
    group,
    view: { position: [0, 3.2, 12.6], target: [0, 0.2, 0] },
    autoRotateSpeed: 0.14,
    update(time) {
      banner.rotation.y = Math.sin(time * 1.1) * 0.16;
      banner.rotation.z = Math.sin(time * 0.7) * 0.03;
      coins.forEach((c, i) => {
        c.position.y = -1.5 + Math.abs(Math.sin(time * 2 + i)) * 0.03;
      });
      crowd.forEach((g, i) => {
        g.rotation.y = Math.sin(time * 0.4 + i) * 0.12;
      });
    },
  };
}

/* -------------------------------- 静夜思 --------------------------------- */
export function moonlight() {
  const group = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 11),
    material('#0d1119', { roughness: 0.9, emissive: '#070b12', emissiveIntensity: 0.4 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.5;
  group.add(floor);

  const wallMat = { roughness: 0.9, emissive: '#0d131f', emissiveIntensity: 0.35 };
  // 留出窗洞的四面墙
  const wallZ = -4.4;
  const parts = [
    { w: 6.8, h: 6.2, x: -2.6, y: 1.4 }, // 左
    { w: 1.9, h: 6.2, x: 5.15, y: 1.4 }, // 右
    { w: 3.6, h: 1.2, x: 2.6, y: -1.0 }, // 下
    { w: 3.6, h: 2.0, x: 2.6, y: 3.4 }, // 上
  ];
  parts.forEach((p) => {
    const b = box(p.w, p.h, 0.28, '#101826', wallMat);
    b.position.set(p.x, p.y, wallZ);
    group.add(b);
  });
  const side = box(0.28, 6.2, 11, '#0e1522', wallMat);
  side.position.set(-6.1, 1.4, 0.6);
  group.add(side);

  // 窗外夜空
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 7),
    new THREE.MeshBasicMaterial({ color: '#0b1b38', transparent: true, opacity: 0.95 })
  );
  sky.position.set(2.6, 1.4, -7.2);
  group.add(sky);
  const moon = sphere(0.52, '#FFF3D0', { emissive: '#FFF3D0', emissiveIntensity: 1.6 });
  moon.position.set(2.9, 1.9, -6.6);
  group.add(moon);
  addGlow(group, '#FFE9B8', 4.6, [2.9, 1.9, -6.6], 0.4);

  // 窗棂
  const frameMat = material('#23324a', { roughness: 0.7, emissive: '#0c1524', emissiveIntensity: 0.4 });
  const bars = [
    [2.6, -0.46, 3.7, 0.14],
    [2.6, 2.46, 3.7, 0.14],
    [0.78, 1.0, 0.14, 3.0],
    [4.42, 1.0, 0.14, 3.0],
    [2.6, 1.0, 0.1, 3.0],
    [2.6, 1.0, 3.7, 0.1],
  ];
  bars.forEach(([x, y, w, h]) => {
    const b = box(w, h, 0.22, '#23324a', frameMat);
    b.position.set(x, y, wallZ + 0.2);
    group.add(b);
  });

  // 从窗洞斜射到地面的光柱
  const beamGeo = new THREE.BufferGeometry();
  beamGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    0.82, -0.42, wallZ + 0.32,
    4.38, -0.42, wallZ + 0.32,
    5.6, -1.47, 0.9,
    -0.4, -1.47, 0.9,
  ], 3));
  beamGeo.setIndex([0, 1, 2, 0, 2, 3]);
  beamGeo.computeVertexNormals();
  const beam = new THREE.Mesh(
    beamGeo,
    new THREE.MeshBasicMaterial({
      color: '#d6e4ff', transparent: true, opacity: 0.05, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending,
    })
  );
  group.add(beam);

  const patch = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 2.6),
    new THREE.MeshBasicMaterial({ color: '#cfe0ff', transparent: true, opacity: 0.06, depthWrite: false })
  );
  patch.rotation.x = -Math.PI / 2;
  patch.position.set(2.2, -1.48, 0.5);
  patch.rotation.z = -0.18;
  group.add(patch);

  const bed = box(3.0, 0.5, 1.7, '#1e2a3c', { roughness: 0.8 });
  bed.position.set(-1.8, -1.2, 1.4);
  group.add(bed);
  const pillow = box(0.72, 0.24, 0.52, '#2a3a52', { roughness: 0.9 });
  pillow.position.set(-2.9, -0.87, 1.4);
  group.add(pillow);

  const person = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 4, 10), material('#080b12', { roughness: 0.95 }));
  body.position.y = 0.55;
  person.add(body);
  const head = sphere(0.23, '#080b12', { roughness: 0.95 });
  head.position.y = 1.18;
  person.add(head);
  person.position.set(-1.6, -0.95, 1.4);
  group.add(person);

  addLabel(group, '床前明月光', [2.4, 3.5, -3.4], {
    fontSize: 30, scale: 0.0058, color: '#ffe9bd', bg: 'rgba(6,11,20,0.78)', border: 'rgba(255,211,122,0.4)', padding: 12,
  });
  addLabel(group, '疑是地上霜', [2.4, -0.6, 1.2], { fontSize: 20, scale: 0.0046, color: 'rgba(220,235,255,0.85)' });

  return {
    group,
    view: { position: [3.8, 3.2, 10.8], target: [-0.4, 0.4, -2.0] },
    autoRotateSpeed: 0.1,
    update(time) {
      moon.position.y = 1.8 + Math.sin(time * 0.12) * 0.45;
      beam.material.opacity = 0.04 + (Math.sin(time * 0.4) * 0.5 + 0.5) * 0.035;
      patch.material.opacity = 0.04 + (Math.sin(time * 0.4) * 0.5 + 0.5) * 0.04;
      head.position.y = 1.18 + (Math.sin(time * 0.35) * 0.5 + 0.5) * 0.06;
      head.rotation.x = Math.sin(time * 0.35) * 0.12;
    },
  };
}

/* ------------------------------- 登鹳雀楼 -------------------------------- */
export function tower() {
  const group = new THREE.Group();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    material('#12100f', { roughness: 1, emissive: '#080606', emissiveIntensity: 0.3 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.6;
  group.add(ground);

  const river = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 7, 30, 8),
    new THREE.MeshStandardMaterial({ color: '#7a5a30', roughness: 0.2, metalness: 0.55, transparent: true, opacity: 0.9 })
  );
  river.rotation.x = -Math.PI / 2;
  river.position.set(0, -1.55, -6);
  group.add(river);

  const pagoda = new THREE.Group();
  const tiers = 4;
  for (let i = 0; i < tiers; i += 1) {
    const w = 2.6 - i * 0.42;
    const body = box(w, 0.9, w, '#2a1b18', { roughness: 0.9, emissive: '#120a08', emissiveIntensity: 0.3 });
    body.position.y = i * 0.92;
    pagoda.add(body);
    const roof = cone(w * 0.95, 0.55, '#3d2622', { roughness: 0.9, segments: 4, emissive: '#1a0f0c', emissiveIntensity: 0.3 });
    roof.rotation.y = Math.PI / 4;
    roof.position.y = i * 0.92 + 0.72;
    pagoda.add(roof);
    for (let k = -1; k <= 1; k += 1) {
      const win = box(0.22, 0.34, 0.06, '#FFD37A', { emissive: '#FFB86B', emissiveIntensity: 0.8, transparent: true, opacity: 0.85 });
      win.position.set(k * w * 0.26, i * 0.92 + 0.05, w / 2 + 0.02);
      pagoda.add(win);
    }
  }
  const base = box(3.6, 0.3, 3.6, '#1a1512', { roughness: 0.95 });
  base.position.y = -0.6;
  pagoda.add(base);
  pagoda.position.set(5.4, -1.3, 1.0);
  group.add(pagoda);

  const sun = sphere(0.66, '#FFF3D0', { emissive: '#FFF3D0', emissiveIntensity: 1.4 });
  sun.position.set(-6.4, 1.4, -8.2);
  group.add(sun);
  addGlow(group, '#FFE9B8', 9, [-6.4, 1.4, -8.2], 0.4);

  const birds = [];
  for (let i = 0; i < 4; i += 1) {
    const g = new THREE.Group();
    const wingL = box(0.34, 0.02, 0.08, '#2a2028');
    wingL.position.x = -0.17;
    wingL.rotation.z = 0.3;
    g.add(wingL);
    const wingR = wingL.clone();
    wingR.position.x = 0.17;
    wingR.rotation.z = -0.3;
    g.add(wingR);
    group.add(g);
    birds.push(g);
  }

  addLabel(group, '白日依山尽', [-4.6, 3.0, -6.6], { fontSize: 22, scale: 0.0048, color: '#ffe9bd' });
  addLabel(group, '黄河入海流', [-1.0, -1.2, -6.0], { fontSize: 22, scale: 0.0048, color: 'rgba(255,225,190,0.85)' });
  addLabel(group, '更上一层楼', [5.4, 4.6, 1.0], {
    fontSize: 26, scale: 0.0052, color: '#ffe9bd', bg: 'rgba(6,11,20,0.78)', border: 'rgba(255,211,122,0.4)', padding: 10,
  });

  return {
    group,
    view: { position: [1.5, 3.4, 14.6], target: [1.5, 0.6, 0] },
    autoRotateSpeed: 0.12,
    update(time) {
      sun.position.y = 1.4 - (Math.sin(time * 0.16) * 0.5 + 0.5) * 1.3;
      birds.forEach((b, i) => {
        const a = time * 0.28 + i * 1.5;
        b.position.set(Math.cos(a) * 6.5 - 1, 2.6 + Math.sin(time * 0.8 + i) * 0.3, Math.sin(a) * 4 - 2);
        b.rotation.y = -a;
        b.children[0].rotation.z = 0.3 + Math.sin(time * 6 + i) * 0.25;
        b.children[1].rotation.z = -0.3 - Math.sin(time * 6 + i) * 0.25;
      });
      river.geometry.attributes.position.needsUpdate = false;
    },
  };
}

/* ------------------------------- 守株待兔 -------------------------------- */
export function stump() {
  const group = new THREE.Group();
  const field = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 14, 24, 16),
    material('#1c2416', { roughness: 1, emissive: '#0b1108', emissiveIntensity: 0.3 })
  );
  field.rotation.x = -Math.PI / 2;
  field.position.y = -1.4;
  group.add(field);

  const rows = [];
  for (let i = 0; i < 9; i += 1) {
    const r = box(20, 0.03, 0.16, '#2b3a20', { emissiveIntensity: 0.2 });
    r.position.set(0, -1.38, -5.2 + i * 1.3);
    group.add(r);
    rows.push(r);
  }

  const trunk = cylinder(0.5, 0.62, 1.4, '#3a2a1d', { roughness: 0.95 });
  trunk.position.set(-1.2, -0.7, 1.2);
  group.add(trunk);
  const top = cylinder(0.5, 0.5, 0.06, '#6b4d32', { roughness: 0.9 });
  top.position.set(-1.2, 0, 1.2);
  group.add(top);
  const rings = [];
  for (let i = 1; i <= 3; i += 1) {
    const ring = torus(0.5 * i * 0.28, 0.012, '#8b6a45', { emissiveIntensity: 0.4 });
    ring.rotation.x = Math.PI / 2;
    ring.position.set(-1.2, 0.04, 1.2);
    group.add(ring);
    rings.push(ring);
  }

  const hare = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.4, 4, 10), material('#e9e4da', { roughness: 0.9 }));
  body.rotation.z = Math.PI / 2;
  hare.add(body);
  const head = sphere(0.15, '#f2ede4', { roughness: 0.9 });
  head.position.set(0.36, 0.1, 0);
  hare.add(head);
  [-1, 1].forEach((d) => {
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.26, 3, 6), material('#e5dfd4'));
    ear.position.set(0.36 + d * 0.05, 0.34, d * 0.05);
    ear.rotation.z = d * 0.12;
    hare.add(ear);
  });
  group.add(hare);

  const farmer = new THREE.Group();
  const fbody = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.8, 4, 10), material('#1a1f16', { roughness: 0.95 }));
  fbody.position.y = 0.7;
  farmer.add(fbody);
  const fhead = sphere(0.19, '#3a2a20', { roughness: 0.9 });
  fhead.position.y = 1.3;
  farmer.add(fhead);
  const hat = cone(0.34, 0.2, '#5a4a2c', { roughness: 0.95 });
  hat.position.y = 1.46;
  farmer.add(hat);
  const hoe = box(0.06, 1.7, 0.06, '#4a3a28');
  hoe.position.set(0.34, 0.7, 0);
  hoe.rotation.z = 0.2;
  farmer.add(hoe);
  farmer.position.set(2.6, -1.4, 2.4);
  group.add(farmer);

  addLabel(group, '守株待兔', [-1.2, 1.8, 1.2], {
    fontSize: 28, scale: 0.0056, color: '#ffe9bd', bg: 'rgba(6,11,20,0.78)', border: 'rgba(255,211,122,0.4)', padding: 11,
  });
  addLabel(group, '偶然 → 错误归纳 → 荒废本业', [0, -1.05, 3.6], { fontSize: 17, scale: 0.0042, color: 'rgba(220,235,255,0.75)' });

  return {
    group,
    view: { position: [0.5, 5.2, 12.4], target: [0, -0.4, 0.6] },
    autoRotateSpeed: 0.12,
    update(time) {
      const u = (time * 0.28) % 1;
      const x = -6.4 + u * 5.0;
      const z = 3.4 - u * 2.1;
      hare.position.set(x, -1.2 + Math.abs(Math.sin(u * Math.PI * 3)) * 0.5, z);
      hare.rotation.y = -0.4;
      hare.visible = u < 0.96;
      rings.forEach((r, i) => {
        r.rotation.z = time * 0.05 * (i + 1);
      });
      rows.forEach((r, i) => {
        r.position.y = -1.38 + Math.sin(time * 0.6 + i) * 0.004;
      });
    },
  };
}

/* ------------------------------- 刻舟求剑 -------------------------------- */
export function kezhou() {
  const group = new THREE.Group();
  const river = waterPlane(26, '#17475f', -1.4);
  const keyLight = new THREE.PointLight('#7fd4ff', 24, 22, 2);
  keyLight.position.set(2, 4, 4);
  group.add(keyLight);
  const warmLight = new THREE.PointLight('#ffb86b', 16, 14, 2);
  warmLight.position.set(-3, 2, 2);
  group.add(warmLight);
  group.add(river);
  const wave = waves(river);

  const bank = box(7, 1.6, 8, '#141c14', { roughness: 0.95 });
  bank.position.set(-8.5, -1.0, 0);
  group.add(bank);

  const boat = new THREE.Group();
  const hull = box(3.4, 0.7, 1.2, '#5a3c24', { roughness: 0.85, emissive: '#2a160a', emissiveIntensity: 0.5 });
  boat.add(hull);
  const bow = cone(0.6, 1.2, '#5a3c24', { roughness: 0.85, emissive: '#2a160a', emissiveIntensity: 0.5 });
  bow.rotation.z = -Math.PI / 2;
  bow.position.set(2.1, 0, 0);
  bow.scale.z = 1.2;
  boat.add(bow);
  const canopy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.62, 1.5, 16, 1, true, 0, Math.PI),
    material('#3a2a1c', { roughness: 0.9, side: THREE.DoubleSide, emissive: '#160e08', emissiveIntensity: 0.4 })
  );
  canopy.rotation.z = Math.PI / 2;
  canopy.position.set(-0.4, 0.34, 0);
  boat.add(canopy);
  const figure = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.4, 3, 8), material('#0c1018'));
  figure.position.set(0.9, 0.55, 0);
  boat.add(figure);
  const notch = box(0.15, 0.36, 0.12, '#FFD37A', { emissive: '#FFD37A', emissiveIntensity: 1.8 });
  notch.position.set(1.5, 0.1, 0.61);
  boat.add(notch);
  boat.position.set(-3.2, -1.0, 0);
  group.add(boat);

  const sword = new THREE.Group();
  const blade = box(0.11, 1.0, 0.03, '#dfe9f8', { metalness: 0.9, roughness: 0.2, emissive: '#9fc4e8', emissiveIntensity: 0.7 });
  sword.add(blade);
  const hilt = box(0.24, 0.06, 0.06, '#c8a25a', { metalness: 0.7 });
  hilt.position.y = 0.48;
  sword.add(hilt);
  sword.position.set(0.6, -1.1, 2.2);
  sword.rotation.z = 0.3;
  group.add(sword);

  const bubbles = [];
  for (let i = 0; i < 8; i += 1) {
    const b = sphere(0.05, '#9fe9ff', { emissive: '#6BE7FF', emissiveIntensity: 0.8, transparent: true, opacity: 0.7 });
    group.add(b);
    bubbles.push(b);
  }

  const markLine = addLine(group, [[0, 0, 0], [0, 0, 0]], '#FFD37A', 0.6);
  addLabel(group, '刻舟求剑', [0, 3.4, 0], {
    fontSize: 28, scale: 0.0056, color: '#ffe9bd', bg: 'rgba(6,11,20,0.78)', border: 'rgba(255,211,122,0.4)', padding: 11,
  });
  addLabel(group, '舟已行矣，而剑不行', [0, -1.9, 3.4], { fontSize: 18, scale: 0.0044, color: 'rgba(220,235,255,0.8)' });

  return {
    group,
    view: { position: [0, 6.6, 14.8], target: [0, -0.7, 0.6] },
    autoRotateSpeed: 0.12,
    update(time) {
      wave(time);
      const u = (Math.sin(time * 0.1) * 0.5 + 0.5);
      boat.position.x = -3.6 + u * 6.2;
      boat.position.y = -1.0 + Math.sin(time * 1.3) * 0.05;
      boat.rotation.z = Math.sin(time * 0.9) * 0.02;
      sword.position.y = -1.1 - u * 1.0;
      sword.rotation.z = 0.3 + u * 0.5;
      const notchWorld = new THREE.Vector3(1.5, 0.1, 0.61).add(boat.position);
      markLine.geometry.setFromPoints([notchWorld, new THREE.Vector3(sword.position.x, sword.position.y + 0.4, sword.position.z)]);
      bubbles.forEach((b, i) => {
        const p = (time * 0.5 + i * 0.12) % 1;
        b.position.set(sword.position.x + Math.sin(i) * 0.2, sword.position.y + p * 0.8, sword.position.z + Math.cos(i) * 0.2);
        b.material.opacity = (1 - p) * 0.6;
      });
    },
  };
}

/* ------------------------------ 比喻与通感 ------------------------------- */
export function metaphor() {
  const group = new THREE.Group();
  const left = new THREE.Group();
  const lq = sphere(0.7, '#FF7096', { emissive: '#FF7096', emissiveIntensity: 0.9 });
  left.add(lq);
  left.position.set(-3.6, 0.6, 0);
  group.add(left);
  addGlow(group, '#FF7096', 5, [-3.6, 0.6, 0], 0.5);

  const right = new THREE.Group();
  const rq = sphere(0.7, '#6BE7FF', { emissive: '#6BE7FF', emissiveIntensity: 0.9 });
  right.add(rq);
  right.position.set(3.6, 0.6, 0);
  group.add(right);
  addGlow(group, '#6BE7FF', 5, [3.6, 0.6, 0], 0.5);

  const arcs = [];
  const colors = ['#FFD37A', '#B08BFF', '#79E86B'];
  for (let i = 0; i < 3; i += 1) {
    const pts = [];
    for (let k = 0; k <= 40; k += 1) {
      const u = k / 40;
      const x = -3.6 + u * 7.2;
      const y = 0.6 + Math.sin(u * Math.PI) * (1.4 + i * 0.55);
      const z = Math.sin(u * Math.PI) * (i - 1) * 0.8;
      pts.push(new THREE.Vector3(x, y, z));
    }
    const tube = addTube(group, pts, colors[i], 0.02, 0.55);
    arcs.push({ tube, pts });
  }

  const particles = [];
  for (let i = 0; i < 12; i += 1) {
    const p = sphere(0.07, '#fffdf4', { emissive: '#ffffff', emissiveIntensity: 1.1 });
    group.add(p);
    particles.push(p);
  }

  addLabel(group, '本体', [-3.6, 1.9, 0], { fontSize: 22, scale: 0.0048, color: 'rgba(255,180,200,0.95)' });
  addLabel(group, '喻体', [3.6, 1.9, 0], { fontSize: 22, scale: 0.0048, color: 'rgba(150,235,255,0.95)' });
  addLabel(group, '香气 ≈ 渺茫的歌声', [0, -1.5, 0], {
    fontSize: 22, scale: 0.0048, color: '#ffe9bd',
  });
  addLabel(group, '相似点：若有若无', [0, -2.1, 0], { fontSize: 17, scale: 0.0042, color: 'rgba(200,220,245,0.75)' });

  return {
    group,
    view: { position: [0, 1.6, 10.4], target: [0, 0.5, 0] },
    autoRotateSpeed: 0.16,
    update(time) {
      left.rotation.y = time * 0.4;
      right.rotation.y = -time * 0.4;
      particles.forEach((p, i) => {
        const seg = i % 3;
        const pts = arcs[seg].pts;
        const u = (time * 0.35 + i / 12) % 1;
        const idx = Math.min(pts.length - 1, Math.floor(u * (pts.length - 1)));
        p.position.copy(pts[idx]);
        p.material.opacity = Math.sin(u * Math.PI);
      });
    },
  };
}

/* ------------------------------- 文言虚词 -------------------------------- */
export function classical() {
  const group = new THREE.Group();
  const chars = ['之', '乎', '者', '也'];
  const planes = chars.map((c, i) => {
    const p = glyphPlane(c, 1.2, { bg: '#101a2a', color: '#ffd98a', border: 'rgba(255,217,138,0.4)', fontSize: 190 });
    p.position.set((i - 1.5) * 2.0, 0.8, 0);
    group.add(p);
    return p;
  });

  const links = [];
  for (let i = 0; i < chars.length - 1; i += 1) {
    links.push(addLine(group, [[(i - 1.5) * 2.0, 0.8, 0], [(i - 0.5) * 2.0, 0.8, 0]], '#FFD37A', 0.25));
  }

  const sentence = addLabel(group, '吾尝终日而思矣，不如须臾之所学也', [0, -1.5, 0], {
    fontSize: 26, scale: 0.005, color: 'rgba(230,242,255,0.9)',
  });
  addLabel(group, '实词定内容，虚词定关系', [0, -2.3, 0], { fontSize: 18, scale: 0.0044, color: 'rgba(190,215,245,0.75)' });
  addLabel(group, '之 · 乎 · 者 · 也', [0, 2.6, 0], {
    fontSize: 24, scale: 0.005, color: '#ffe9bd',
  });

  return {
    group,
    view: { position: [0, 0.8, 11.4], target: [0, 0, 0] },
    autoRotateSpeed: 0.12,
    update(time) {
      planes.forEach((p, i) => {
        p.position.y = 0.8 + Math.sin(time * 0.8 + i * 0.8) * 0.12;
        p.rotation.y = Math.sin(time * 0.4 + i) * 0.18;
      });
      links.forEach((l, i) => {
        l.material.opacity = 0.16 + Math.abs(Math.sin(time * 0.9 + i)) * 0.22;
      });
      sentence.position.y = -1.5 + Math.sin(time * 0.5) * 0.03;
    },
  };
}
