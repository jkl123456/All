/**
 * 三个新增知识点的三维案例：
 *   电池怎么选（电化学） / 安史之乱（制度与军镇） / 亭台楼阁（古建形制）
 */
import {
  THREE,
  addArrow,
  addGlow,
  addLabel,
  addLine,
  addTube,
  box,
  cone,
  cylinder,
  material,
  sphere,
} from './helpers.js';

/* ------------------------------- 电池怎么选 ------------------------------- */
export function battery() {
  const group = new THREE.Group();
  const accent = '#5BE7FF';
  const red = '#FF8E6B';
  const gold = '#FFD37A';

  // 台面
  const base = new THREE.Mesh(new THREE.CircleGeometry(6.6, 64), material('#0a1220', { roughness: 0.9 }));
  base.rotation.x = -Math.PI / 2;
  base.position.y = -2.5;
  group.add(base);

  // 负极：石墨层叠
  const anode = new THREE.Group();
  anode.position.set(-2.6, 0, 0);
  for (let i = 0; i < 6; i += 1) {
    const slab = box(1.5, 0.12, 2.0, i % 2 ? '#59636f' : '#6d7885', { metalness: 0.35, roughness: 0.6 });
    slab.position.set(0, -1.4 + i * 0.44, 0);
    anode.add(slab);
  }
  group.add(anode);

  // 正极：两块材料
  const cathodeA = box(0.9, 2.2, 2.0, '#8fb6cf', { emissive: '#2f5d8f', emissiveIntensity: 0.35, roughness: 0.5 });
  cathodeA.position.set(2.8, 0.1, 0);
  group.add(cathodeA);
  const cathodeB = box(0.5, 2.2, 2.0, '#e0b06a', { emissive: '#8a5f12', emissiveIntensity: 0.3 });
  cathodeB.position.set(2.8, 0.1, -0.1);
  cathodeB.visible = false;
  group.add(cathodeB);

  // 隔膜
  const separator = box(0.06, 2.6, 2.2, '#9be6ff', { transparent: true, opacity: 0.2, emissive: '#5BE7FF', emissiveIntensity: 0.6 });
  separator.position.set(0.1, 0.1, 0);
  group.add(separator);

  // 外部电路：从负极到正极，中间一只灯泡
  const wire = [
    new THREE.Vector3(-2.6, 1.6, 0),
    new THREE.Vector3(-1.4, 2.9, 0),
    new THREE.Vector3(0, 3.2, 0),
    new THREE.Vector3(1.4, 2.9, 0),
    new THREE.Vector3(2.8, 1.3, 0),
  ];
  addTube(group, wire, '#7d8b99', 0.035, 0.9);
  const bulb = sphere(0.3, '#ffe9bd', { emissive: '#FFD37A', emissiveIntensity: 1.4, transparent: true, opacity: 0.95 });
  bulb.position.set(0, 3.25, 0);
  group.add(bulb);
  addGlow(group, '#FFD37A', 2.6, [0, 3.25, 0], 0.5);

  // 锂离子
  const ions = [];
  for (let i = 0; i < 7; i += 1) {
    const ion = sphere(0.15, '#9be6ff', { emissive: '#5BE7FF', emissiveIntensity: 1.2 });
    group.add(ion);
    ions.push({ mesh: ion, t: i / 7 });
  }

  addLabel(group, '负极 · 石墨', [-2.9, 1.55, 0], { fontSize: 21, scale: 0.0046, color: '#c8d6e6' });
  addLabel(group, '正极', [3.1, 1.6, 0], { fontSize: 21, scale: 0.0046, color: '#e6c99a' });
  addLabel(group, 'Li⁺', [0, -2.4, 1.6], { fontSize: 24, scale: 0.005, color: '#9be6ff' });
  addLabel(group, '放电 →', [0, 4.0, 0], {
    fontSize: 24, scale: 0.005, color: '#ffe9bd', bg: 'rgba(6,11,20,0.75)', border: 'rgba(255,211,122,0.35)', padding: 9,
  });

  let dir = 1;
  let clock = 0;
  return {
    group,
    view: { position: [1.2, 2.6, 11.6], target: [0, 0.4, 0] },
    autoRotateSpeed: 0.2,
    update(time, dt) {
      clock += dt;
      if (clock > 4.2) {
        clock = 0;
        dir *= -1;
      }
      ions.forEach((ion) => {
        ion.t += dt * 0.22 * dir;
        if (ion.t > 1) ion.t -= 1;
        if (ion.t < 0) ion.t += 1;
        const t = dir > 0 ? ion.t : 1 - ion.t;
        const x = -2.4 + t * 5.0;
        ion.mesh.position.set(x, 0.1 + Math.sin(t * Math.PI) * 0.55, Math.sin(t * Math.PI * 2) * 0.35);
        ion.mesh.material.emissiveIntensity = 0.9 + Math.sin(time * 3 + ion.t * 6) * 0.3;
      });
      bulb.material.emissiveIntensity = 1.1 + Math.sin(time * 4) * 0.35;
      void accent;
      void red;
      void gold;
    },
  };
}

/* -------------------------------- 安史之乱 -------------------------------- */
export function anshi() {
  const group = new THREE.Group();
  const gold = '#FFD37A';
  const red = '#FF6B5A';

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 16), material('#0d1522', { roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2.2;
  group.add(ground);

  // 长安：城墙与城门
  const city = new THREE.Group();
  city.position.set(0, -2.2, -1.6);
  const wallMat = '#4a4034';
  const wallL = box(4.2, 1.7, 0.5, wallMat, { roughness: 0.85 });
  wallL.position.set(-3.1, 0.85, 0);
  const wallR = box(4.2, 1.7, 0.5, wallMat, { roughness: 0.85 });
  wallR.position.set(3.1, 0.85, 0);
  const gateHouse = box(2.4, 2.4, 0.8, '#5b4b3a', { roughness: 0.8, emissive: '#1a1109', emissiveIntensity: 0.4 });
  gateHouse.position.set(0, 1.2, 0);
  const gateArch = box(1.1, 1.3, 0.86, '#120d09', { roughness: 1 });
  gateArch.position.set(0, 0.65, 0.01);
  const roofMat = '#7a3f34';
  const roof = cone(2.7, 0.62, roofMat, { segments: 4, roughness: 0.7, emissive: '#4a1d16', emissiveIntensity: 0.55 });
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 2.62, 0);
  const roofTop = box(2.2, 0.16, 0.3, '#8a4636', { emissive: '#3a1510', emissiveIntensity: 0.4 });
  roofTop.position.set(0, 2.95, 0);
  city.add(roofTop);
  city.add(wallL, wallR, gateHouse, gateArch, roof);
  for (const x of [-4.4, 4.4]) {
    const tower = box(0.7, 2.1, 0.7, '#54452f', { roughness: 0.85 });
    tower.position.set(x, 1.05, 0);
    const cap = cone(0.82, 0.42, roofMat, { segments: 4, emissive: '#4a1d16', emissiveIntensity: 0.4 });
    cap.rotation.y = Math.PI / 4;
    cap.position.set(x, 2.3, 0);
    city.add(tower, cap);
  }
  const warm = new THREE.PointLight('#ffb86b', 26, 22, 2);
  warm.position.set(0, 6, 5);
  group.add(warm);
  const cool = new THREE.PointLight('#6fb6ff', 16, 26, 2);
  cool.position.set(-6, 4, -6);
  group.add(cool);
  group.add(city);
  addLabel(group, '长安', [0, 1.3, 0.9], { fontSize: 24, scale: 0.0052, color: '#ffe9bd' });

  // 三镇
  const towns = [
    { name: '平卢', pos: [-6.2, -2.2, 2.6] },
    { name: '范阳', pos: [-1.6, -2.2, 3.8] },
    { name: '河东', pos: [4.6, -2.2, 2.4] },
  ];
  towns.forEach((town, i) => {
    const g = new THREE.Group();
    g.position.set(town.pos[0], town.pos[1], town.pos[2]);
    const keep = box(0.8, 1.1, 0.8, '#43382c', { roughness: 0.9 });
    keep.position.y = 0.55;
    const cap = cone(0.75, 0.55, '#6b3a30', { segments: 4 });
    cap.rotation.y = Math.PI / 4;
    cap.position.y = 1.45;
    const flagPole = cylinder(0.02, 0.02, 1.3, '#8a6b4a');
    flagPole.position.set(0.5, 1.4, 0);
    const flag = box(0.5, 0.32, 0.02, red, { emissive: red, emissiveIntensity: 0.5 });
    flag.position.set(0.75, 1.85, 0);
    g.add(keep, cap, flagPole, flag);
    group.add(g);
    addLabel(group, town.name, [town.pos[0], 0.1, town.pos[2] + 0.9], { fontSize: 20, scale: 0.0046, color: '#ffb8a8' });
    // 指向长安的箭头
    addArrow(group, [town.pos[0], 0.9, town.pos[2] - 0.6], [town.pos[0] * 0.42, 1.4, -0.6], red, { radius: 0.035 });
    void i;
  });

  // 叛军：一排小人（用胶囊+头表示）
  const army = new THREE.Group();
  army.position.set(-1.2, -2.2, 6.2);
  for (let i = 0; i < 12; i += 1) {
    const x = (i % 6) * 0.55 - 1.4;
    const z = Math.floor(i / 6) * 0.6;
    const body = cylinder(0.12, 0.16, 0.5, '#6b3a30', { emissive: '#2a100c', emissiveIntensity: 0.4 });
    body.position.set(x, 0.25, z);
    const head = sphere(0.12, '#d8b48a');
    head.position.set(x, 0.58, z);
    const spear = cylinder(0.015, 0.015, 0.8, '#a98a63');
    spear.position.set(x + 0.16, 0.4, z);
    army.add(body, head, spear);
  }
  group.add(army);
  addLabel(group, '三镇之兵', [-5.2, -0.9, 7.6], { fontSize: 19, scale: 0.0044, color: '#ff9d8b' });

  addLabel(group, '755 — 763', [5.8, 3.4, -3.2], {
    fontSize: 26, scale: 0.0056, color: '#ffd7c6', bg: 'rgba(6,11,20,0.75)', border: 'rgba(255,107,90,0.4)', padding: 10,
  });
  addGlow(group, gold, 3, [0, 1.4, -1.8], 0.3);

  return {
    group,
    view: { position: [0, 9.5, 15.5], target: [0, 0.4, 0] },
    autoRotateSpeed: 0.16,
    update(time) {
      army.position.z = 6.2 - (Math.sin(time * 0.35) * 0.5 + 0.5) * 1.1;
    },
  };
}

/* -------------------------------- 亭台楼阁 -------------------------------- */
export function pavilionModel() {
  const group = new THREE.Group();
  const jade = '#56D9C7';
  const roofMat = '#3f7f8a';
  const wood = '#b5714a';

  const ground = new THREE.Mesh(new THREE.CircleGeometry(6.4, 64), material('#101a24', { roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2.05;
  group.add(ground);

  // 台基
  const base = cylinder(1.95, 2.05, 0.34, '#cfc6b6', { roughness: 0.85 });
  base.position.y = -1.86;
  group.add(base);
  const step = box(1.5, 0.18, 0.5, '#c2b8a6', { roughness: 0.85 });
  step.position.set(0, -1.95, 2.3);
  group.add(step);

  // 四根柱
  const columns = [];
  for (const [x, z] of [[-1.55, -1.55], [1.55, -1.55], [-1.55, 1.55], [1.55, 1.55]]) {
    const col = cylinder(0.11, 0.12, 2.7, wood, { roughness: 0.7, emissive: '#3a1f10', emissiveIntensity: 0.35 });
    col.position.set(x, -0.35, z);
    group.add(col);
    columns.push(col);
  }

  // 栏杆
  for (const [a, b] of [[[-1.55, 1.55], [1.55, 1.55]], [[-1.55, -1.55], [-1.55, 1.55]], [[1.55, -1.55], [1.55, 1.55]]]) {
    const midX = (a[0] + b[0]) / 2;
    const midZ = (a[1] + b[1]) / 2;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const rail = box(len - 0.2, 0.1, 0.08, wood, { emissive: '#3a1f10', emissiveIntensity: 0.3 });
    rail.position.set(midX, -0.9, midZ);
    rail.rotation.y = a[1] === b[1] ? 0 : Math.PI / 2;
    group.add(rail);
    for (let i = 1; i < 4; i += 1) {
      const t = i / 4;
      const px = a[0] + (b[0] - a[0]) * t;
      const pz = a[1] + (b[1] - a[1]) * t;
      const post = box(0.06, 0.42, 0.06, wood);
      post.position.set(px, -1.05, pz);
      group.add(post);
    }
  }

  // 两层屋顶
  const lower = cone(3.0, 1.1, roofMat, { segments: 4, roughness: 0.6, emissive: '#123037', emissiveIntensity: 0.5 });
  lower.rotation.y = Math.PI / 4;
  lower.position.y = 1.45;
  group.add(lower);
  const upper = cone(2.1, 1.15, '#4f8e98', { segments: 4, roughness: 0.55, emissive: '#123037', emissiveIntensity: 0.55 });
  upper.rotation.y = Math.PI / 4;
  upper.position.y = 2.35;
  group.add(upper);
  const finial = sphere(0.18, jade, { emissive: jade, emissiveIntensity: 0.9 });
  finial.position.y = 3.1;
  group.add(finial);

  // 匾额
  const plaque = box(1.1, 0.34, 0.08, '#e0b45a', { emissive: '#8a5f12', emissiveIntensity: 0.4 });
  plaque.position.set(0, 0.95, 1.6);
  group.add(plaque);

  addLabel(group, '亭 · 有顶无墙', [0, 4.1, 0], {
    fontSize: 26, scale: 0.0058, color: '#d9fff7', bg: 'rgba(6,11,20,0.7)', border: 'rgba(86,217,199,0.4)', padding: 10,
  });
  addLabel(group, '台基', [0, -1.35, 2.9], { fontSize: 18, scale: 0.0044, color: '#cfc6b6' });
  addLabel(group, '柱', [-2.1, -0.3, 1.3], { fontSize: 18, scale: 0.0044, color: '#e0b58e' });
  addLabel(group, '檐', [2.4, 1.75, 0.6], { fontSize: 18, scale: 0.0044, color: '#9fd8de' });
  addGlow(group, jade, 3.4, [0, 0.6, 0], 0.24);

  return {
    group,
    view: { position: [6.4, 4.4, 9.6], target: [0, 0.5, 0] },
    autoRotateSpeed: 0.26,
    update(time) {
      finial.material.emissiveIntensity = 0.8 + Math.sin(time * 2) * 0.25;
      lower.material.emissiveIntensity = 0.45 + Math.sin(time * 1.3) * 0.1;
    },
  };
}
