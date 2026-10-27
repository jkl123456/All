import * as THREE from 'three';
import { createGroundShadow } from './vegetation.js';
import { rts } from './rtsAssets.js';
import {
  M,
  createHalo,
  createLanternPost,
  glowSprite,
  group,
  material,
  mesh,
  shadows,
} from './modelKit.js';

const TIER_STYLES = {
  1: {
    accent: '#c7ad82',
    roof: '#725a46',
    trim: '#b18e5f',
    metal: '#a38a5f',
    banner: '#a8785a',
    glow: '#f0cf95',
    glass: '#cfe0d6',
  },
  2: {
    accent: '#d9b565',
    roof: '#4d6d65',
    trim: '#e1c073',
    metal: '#c5a259',
    banner: '#6b8d7e',
    glow: '#ffdf9b',
    glass: '#cfe8df',
  },
  3: {
    accent: '#9fe1d8',
    roof: '#3b636b',
    trim: '#d9cda8',
    metal: '#b8d2ca',
    banner: '#528d8a',
    glow: '#a9fff0',
    glass: '#d8fbf6',
  },
  4: {
    accent: '#efd188',
    roof: '#2b3134',
    trim: '#f0dda8',
    metal: '#d8b96b',
    banner: '#594b39',
    glow: '#fff1b8',
    glass: '#d9e3dd',
  },
};

function styleFor(tier) {
  return TIER_STYLES[Math.max(1, Math.min(4, Number(tier) || 1))];
}

function addTick(target, fn) {
  const previous = target.userData.tick;
  target.userData.tick = (time, delta, night) => {
    previous?.(time, delta, night);
    fn(time, delta, night);
  };
}

function addFlag(parent, position, color, accent = '#e9d7a6') {
  const flagGroup = group(parent, position);
  mesh(flagGroup, new THREE.CylinderGeometry(0.035, 0.05, 1.9, 5), M.woodDark(), [0, 0.95, 0]);
  const flag = mesh(flagGroup, new THREE.PlaneGeometry(0.85, 0.5), material(color, { side: THREE.DoubleSide, roughness: 0.9 }), [0.44, 1.6, 0], [0, 0.1, 0]);
  mesh(flagGroup, new THREE.BoxGeometry(0.4, 0.03, 0.02), material(accent), [0.32, 1.7, 0.01], [0, 0, 0], [1, 1, 1], false);
  flag.castShadow = false;
  addTick(flagGroup, (t) => {
    flag.rotation.y = 0.1 + Math.sin(t * 1.8) * 0.12;
  });
  return flagGroup;
}

function addCrystalOrnaments(parent, tier, style) {
  if (tier < 3) return;
  const crystalGroup = group(parent);
  for (let i = 0; i < 3; i += 1) {
    const angle = (i / 3) * Math.PI * 2 + 0.3;
    const shard = mesh(crystalGroup, new THREE.OctahedronGeometry(tier === 4 ? 0.18 : 0.14, 0), material(style.accent, {
      roughness: 0.2,
      metalness: 0.18,
      emissive: style.accent,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.9,
    }), [Math.cos(angle) * 1.45, 1.1 + (i % 2) * 0.35, Math.sin(angle) * 1.1], [i, angle, 0], [1, 1.6, 1]);
    shard.castShadow = false;
    const glow = glowSprite(style.glow, 0.42, 0.22);
    shard.add(glow);
  }
  addTick(crystalGroup, (t) => {
    crystalGroup.children.forEach((shard, index) => {
      if (!shard.isMesh) return;
      shard.position.y = 1.1 + index * 0.18 + Math.sin(t * 0.9 + index * 1.7) * 0.12;
      shard.rotation.y = t * 0.24 + index;
    });
  });
}

function addQualityOrnaments(parent, tier, style, size = 1.8) {
  if (tier >= 2) {
    const finialMat = material(style.metal, { metalness: 0.6, roughness: 0.34 });
    for (const x of [-size * 0.7, size * 0.7]) {
      mesh(parent, new THREE.SphereGeometry(0.09, 6, 5), finialMat, [x, 2.1, 0]);
      mesh(parent, new THREE.ConeGeometry(0.07, 0.22, 4), finialMat, [x, 2.26, 0]);
    }
    if (tier >= 2) addFlag(parent, [size * 0.82, 0.15, -size * 0.45], style.banner);
  }
  if (tier >= 3) {
    addCrystalOrnaments(parent, tier, style);
    const halo = createHalo(style.accent, size * 1.15, 0.15);
    halo.position.y = 0.04;
    parent.add(halo);
  }
  if (tier >= 4) {
    const runeGroup = group(parent);
    const runeMat = material(style.accent, { emissive: style.accent, emissiveIntensity: 0.7, transparent: true, opacity: 0.78, side: THREE.DoubleSide });
    for (let i = 0; i < 3; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(size * (0.95 + i * 0.025), 0.018, 4, 48, Math.PI * 1.2), runeMat);
      ring.position.y = 0.1 + i * 0.015;
      ring.rotation.x = Math.PI / 2;
      ring.rotation.z = i * 0.7;
      runeGroup.add(ring);
    }
    const crown = mesh(parent, new THREE.OctahedronGeometry(0.28, 0), material(style.accent, { metalness: 0.7, roughness: 0.22, emissive: style.accent, emissiveIntensity: 0.42 }), [0, 3.15, 0], [0, 0, 0], [1, 1.4, 1]);
    const crownGlow = glowSprite(style.glow, 1.4, 0.3);
    crown.add(crownGlow);
    addTick(runeGroup, (t) => {
      runeGroup.rotation.y = t * 0.12;
      crown.rotation.y = t * 0.4;
      crown.position.y = 3.15 + Math.sin(t * 0.9) * 0.08;
    });
  }
}

function basePlinth(parent, style, tier, width = 3.5, depth = 3) {
  mesh(parent, new THREE.CylinderGeometry(width * 0.52, width * 0.58, 0.2, 8), material(tier >= 4 ? '#3a3d38' : '#7d8075', { roughness: 0.98, texture: 'stone', bumpScale: 0.08 }), [0, 0.1, 0], [0, Math.PI / 8, 0], [1.15, 1, depth / width]);
  mesh(parent, new THREE.CylinderGeometry(width * 0.47, width * 0.52, 0.08, 8), material(style.accent, { roughness: 0.7, texture: 'stone', bumpScale: 0.05 }), [0, 0.22, 0], [0, Math.PI / 8, 0], [1.15, 1, depth / width]);
  if (tier >= 3) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(width * 0.51, 0.025, 4, 48), material(style.accent, { emissive: style.accent, emissiveIntensity: 0.35 }));
    ring.position.y = 0.145;
    ring.rotation.x = Math.PI / 2;
    ring.scale.z = depth / width;
    parent.add(ring);
  }
}

function createWorkshop(style, tier) {
  const root = new THREE.Group();
  basePlinth(root, style, tier, 3.8, 3.3);
  const floor = group(root, [0, 0.3, 0]);
  const wood = M.wood();
  const dark = M.woodDark();
  // 工作区的半开放结构
  mesh(floor, new THREE.BoxGeometry(3.2, 0.12, 2.7), M.woodLight(), [0, 0, 0]);
  [-1.35, 1.35].forEach((x) => {
    mesh(floor, new THREE.BoxGeometry(0.16, 2.2, 0.16), dark, [x, 1.12, -1.15]);
    mesh(floor, new THREE.BoxGeometry(0.16, 1.75, 0.16), dark, [x, 0.9, 1.1]);
  });
  mesh(floor, new THREE.BoxGeometry(3.0, 1.9, 0.12), material('#76583f', { roughness: 0.95 }), [0, 1.1, -1.25]);
  for (let i = 0; i < 6; i += 1) {
    mesh(floor, new THREE.BoxGeometry(0.07, 1.85, 0.08), M.woodLight(), [-1.2 + i * 0.48, 1.1, -1.17], [0, 0, 0], [1, 1, 1], false);
  }
  const roof = mesh(floor, new THREE.BoxGeometry(3.9, 0.16, 3.2), material(style.roof, { roughness: 0.82, texture: 'roof', textureScale: 1.3, bumpScale: 0.11 }), [0, 2.45, -0.05], [-0.12, 0, 0]);
  mesh(roof, new THREE.BoxGeometry(4.0, 0.06, 0.18), material(style.accent, { metalness: 0.25, roughness: 0.6 }), [0, 0.11, -1.4]);
  mesh(floor, new THREE.BoxGeometry(0.12, 0.12, 2.2), dark, [0, 2.38, 0.0], [-0.12, 0, 0]);
  // 工作台、锯和木料
  const bench = group(floor, [0.58, 0.55, 0.1]);
  mesh(bench, new THREE.BoxGeometry(1.65, 0.16, 0.78), wood, [0, 0.38, 0]);
  for (const x of [-0.72, 0.72]) for (const z of [-0.3, 0.3]) mesh(bench, new THREE.BoxGeometry(0.09, 0.7, 0.09), dark, [x, 0.02, z]);
  mesh(bench, new THREE.BoxGeometry(0.54, 0.08, 0.28), material(style.metal, { metalness: 0.55, roughness: 0.4 }), [-0.35, 0.5, 0.05], [0, 0.15, 0]);
  mesh(bench, new THREE.CylinderGeometry(0.045, 0.045, 0.9, 5), M.woodDark(), [0.2, 0.55, 0.1], [0, 0.2, Math.PI / 2]);
  const saw = mesh(bench, new THREE.ConeGeometry(0.18, 0.92, 4), material('#c7bda1', { metalness: 0.4, roughness: 0.5 }), [0.48, 0.55, 0.03], [0, 0.2, Math.PI / 2], [0.3, 1, 1]);
  mesh(bench, new THREE.BoxGeometry(0.42, 0.34, 0.36), M.woodDark(), [-0.7, 0.15, -0.12]);
  // 墙上挂着的工具
  for (let i = 0; i < 4; i += 1) {
    const x = -1.0 + i * 0.62;
    mesh(floor, new THREE.CylinderGeometry(0.025, 0.03, 0.8, 4), dark, [x, 1.45, -1.1]);
    mesh(floor, new THREE.BoxGeometry(0.22, 0.14, 0.05), material(style.metal, { metalness: 0.45, roughness: 0.5 }), [x, 1.82, -1.06], [0, 0, i % 2 ? 0.4 : -0.2]);
  }
  const lantern = createLanternPost(style.glow);
  lantern.position.set(-1.65, 0.24, 1.18);
  root.add(lantern);
  addQualityOrnaments(root, tier, style, 2.1);
  // 木屑
  for (let i = 0; i < 7; i += 1) {
    mesh(root, new THREE.BoxGeometry(0.11, 0.025, 0.035), M.woodLight(), [-1 + (i % 3) * 0.34, 0.36, 0.4 + (i % 2) * 0.25], [0, i * 0.8, 0], [1, 1, 1], false);
  }
  saw.castShadow = false;
  shadows(root);
  return root;
}

function createForge(style, tier) {
  const root = new THREE.Group();
  basePlinth(root, style, tier, 3.4, 3.1);
  const floor = group(root, [0, 0.27, 0]);
  const stone = material(tier >= 4 ? '#3a3b3a' : '#77756b', { roughness: 0.98 });
  mesh(floor, new THREE.BoxGeometry(2.8, 2.2, 2.2), stone, [0, 1.1, -0.1]);
  mesh(floor, new THREE.BoxGeometry(2.55, 0.18, 2.0), material('#a29277', { roughness: 0.9 }), [0, 2.18, -0.1], [0.06, 0, 0]);
  // 炉膛
  const opening = mesh(floor, new THREE.BoxGeometry(1.18, 0.9, 0.1), material('#2d2721', { roughness: 1 }), [0, 0.76, 1.01]);
  const fire = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 0.85, 5),
    new THREE.MeshBasicMaterial({ color: '#ffab53', transparent: true, opacity: 0.94, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  fire.position.set(0, 0.75, 1.1);
  floor.add(fire);
  const emberGlow = glowSprite('#ff9f56', 1.9, 0.52);
  emberGlow.position.set(0, 0.85, 1.1);
  floor.add(emberGlow);
  // 烟囱与烟
  mesh(floor, new THREE.BoxGeometry(0.72, 2.4, 0.64), stone, [0.9, 2.2, -0.65]);
  mesh(floor, new THREE.BoxGeometry(0.9, 0.16, 0.8), material(style.metal, { metalness: 0.4, roughness: 0.5 }), [0.9, 3.42, -0.65]);
  const smoke = group(floor, [0.9, 3.6, -0.65]);
  for (let i = 0; i < 3; i += 1) {
    const puff = mesh(smoke, new THREE.DodecahedronGeometry(0.2 + i * 0.06, 0), material('#d7d0c2', { transparent: true, opacity: 0.25, depthWrite: false }), [i * 0.1, i * 0.45, 0], [0, 0, 0], [1, 0.7, 1], false);
    puff.castShadow = false;
  }
  addTick(floor, (t) => {
    fire.scale.y = 0.85 + Math.sin(t * 8.2) * 0.12;
    fire.scale.x = 0.9 + Math.sin(t * 6.1) * 0.06;
    emberGlow.material.opacity = 0.38 + Math.sin(t * 5.4) * 0.08;
    smoke.children.forEach((puff, index) => {
      puff.position.y = (t * 0.22 + index * 0.3) % 1.1;
      puff.position.x = Math.sin(t * 0.8 + index) * 0.15;
      puff.material.opacity = 0.26 * (1 - puff.position.y / 1.4);
    });
  });
  // 铁砧
  const anvil = group(root, [-1.55, 0.36, 0.95], [0, 0.18, 0]);
  mesh(anvil, new THREE.CylinderGeometry(0.35, 0.5, 0.35, 6), M.woodDark(), [0, 0.17, 0]);
  mesh(anvil, new THREE.BoxGeometry(0.52, 0.28, 0.36), material('#3a3d3b', { metalness: 0.65, roughness: 0.3 }), [0, 0.52, 0]);
  mesh(anvil, new THREE.ConeGeometry(0.28, 0.55, 4), material('#444743', { metalness: 0.6, roughness: 0.35 }), [0.5, 0.52, 0], [0, 0, -Math.PI / 2]);
  const hammer = group(anvil, [0.4, 0.7, 0.36], [0, 0, 0.4]);
  mesh(hammer, new THREE.CylinderGeometry(0.035, 0.035, 0.55, 5), M.woodDark(), [0, 0.15, 0]);
  mesh(hammer, new THREE.BoxGeometry(0.26, 0.14, 0.15), material('#66685f', { metalness: 0.55, roughness: 0.4 }), [0, 0.42, 0]);
  // 水桶和矿石
  mesh(root, new THREE.CylinderGeometry(0.24, 0.19, 0.42, 7), M.woodDark(), [1.65, 0.5, 1.1]);
  mesh(root, new THREE.CylinderGeometry(0.19, 0.19, 0.03, 7), M.water(), [1.65, 0.7, 1.1]);
  for (let i = 0; i < 4; i += 1) {
    mesh(root, new THREE.DodecahedronGeometry(0.12 + (i % 2) * 0.04, 0), material(i % 2 ? '#a4784a' : '#797d75'), [1.0 + (i % 3) * 0.22, 0.38, 1.25 + (i % 2) * 0.25], [i, i, 0]);
  }
  const rack = group(root, [1.62, 0.37, -0.2]);
  mesh(rack, new THREE.CylinderGeometry(0.04, 0.05, 1.4, 5), M.woodDark(), [0, 0.7, 0]);
  mesh(rack, new THREE.BoxGeometry(0.7, 0.05, 0.06), M.woodDark(), [0, 1.3, 0]);
  for (let i = 0; i < 3; i += 1) {
    mesh(rack, new THREE.BoxGeometry(0.1, 0.52, 0.06), material('#c0c1b2', { metalness: 0.5, roughness: 0.4 }), [-0.25 + i * 0.24, 0.97, 0], [0, 0, i % 2 ? 0.15 : -0.1]);
  }
  addQualityOrnaments(root, tier, style, 1.85);
  shadows(root);
  return root;
}

function createCottage(style, tier) {
  const root = new THREE.Group();
  basePlinth(root, style, tier, 3.25, 3);
  const floor = group(root, [0, 0.29, 0]);
  const plaster = material(tier >= 4 ? '#c8c0ab' : '#e2d5bd', { roughness: 0.95 });
  mesh(floor, new THREE.BoxGeometry(2.6, 1.85, 2.2), plaster, [0, 0.95, 0]);
  // 木骨架
  const beam = M.woodDark();
  [[-1.3, 1.0], [1.3, 1.0]].forEach(([x, z]) => mesh(floor, new THREE.BoxGeometry(0.13, 1.95, 0.13), beam, [x, 1.0, z]));
  mesh(floor, new THREE.BoxGeometry(2.78, 0.13, 0.13), beam, [0, 1.9, 1.12]);
  mesh(floor, new THREE.BoxGeometry(0.1, 1.58, 0.12), beam, [0.65, 0.9, 1.14]);
  mesh(floor, new THREE.BoxGeometry(2.6, 0.1, 0.12), beam, [0, 1.32, 1.14]);
  // 屋顶
  const roofGroup = group(floor, [0, 2.02, 0]);
  mesh(roofGroup, new THREE.ConeGeometry(2.15, 1.25, 4), material(style.roof, { roughness: 0.85, texture: 'roof', textureScale: 1.3, bumpScale: 0.11 }), [0, 0.5, 0], [0, Math.PI / 4, 0], [1.15, 1, 0.98]);
  mesh(roofGroup, new THREE.BoxGeometry(3.5, 0.08, 0.13), material(style.accent), [0, 0.0, 1.1], [0, 0, 0]);
  mesh(floor, new THREE.CylinderGeometry(0.18, 0.25, 1.1, 6), material('#7d7264'), [0.75, 2.6, -0.45]);
  const smoke = group(floor, [0.75, 3.15, -0.45]);
  for (let i = 0; i < 2; i += 1) {
    const puff = mesh(smoke, new THREE.SphereGeometry(0.16, 5, 4), material('#d8d4c7', { transparent: true, opacity: 0.2 }), [i * 0.1, i * 0.4, 0], [0, 0, 0], [1, 0.7, 1], false);
    puff.castShadow = false;
  }
  addTick(smoke, (t) => {
    smoke.children.forEach((puff, index) => {
      puff.position.y = (t * 0.16 + index * 0.5) % 1.1;
      puff.position.x = Math.sin(t * 0.5 + index) * 0.15;
    });
  });
  // 门窗与灯
  mesh(floor, new THREE.BoxGeometry(0.58, 1.12, 0.1), material('#6a4a35', { roughness: 0.9 }), [-0.42, 0.75, 1.12]);
  mesh(floor, new THREE.BoxGeometry(0.46, 0.86, 0.1), material('#5a4432'), [0.68, 0.86, 1.12]);
  mesh(floor, new THREE.BoxGeometry(0.24, 0.24, 0.05), material(style.glow, { emissive: style.glow, emissiveIntensity: 1.2 }), [0.68, 1.0, 1.19]);
  const windowGlow = glowSprite(style.glow, 0.9, 0.3);
  windowGlow.position.set(0.68, 0.95, 1.25);
  floor.add(windowGlow);
  const flowerBox = mesh(floor, new THREE.BoxGeometry(0.68, 0.2, 0.24), M.woodDark(), [0.68, 0.33, 1.26]);
  for (let i = 0; i < 4; i += 1) {
    mesh(flowerBox, new THREE.SphereGeometry(0.08, 4, 3), material(i % 2 ? '#e6a1a1' : '#f1d184'), [-0.24 + i * 0.16, 0.15, 0], [0, 0, 0], [1, 0.8, 1], false);
  }
  // 门廊
  mesh(floor, new THREE.BoxGeometry(1.2, 0.14, 0.7), M.woodLight(), [-0.42, 0.35, 1.48]);
  mesh(floor, new THREE.BoxGeometry(0.1, 1.65, 0.1), M.woodDark(), [-1.0, 1.15, 1.72]);
  mesh(floor, new THREE.BoxGeometry(0.1, 1.65, 0.1), M.woodDark(), [0.16, 1.15, 1.72]);
  mesh(floor, new THREE.BoxGeometry(1.3, 0.18, 1.0), material(style.roof, { roughness: 0.86, texture: 'roof', textureScale: 1.2, bumpScale: 0.1 }), [-0.42, 2.5, 1.45], [0.08, 0, 0]);
  if (tier >= 2) addFlag(floor, [1.4, 0.2, 0.9], style.banner);
  addQualityOrnaments(root, tier, style, 1.9);
  shadows(root);
  return root;
}

function createBridge(style, tier) {
  const root = new THREE.Group();
  const wood = M.wood();
  const dark = M.woodDark();
  const span = 4.2;
  const planks = 15;
  for (let i = 0; i < planks; i += 1) {
    const t = i / (planks - 1);
    const x = (t - 0.5) * span;
    const y = 0.36 + Math.sin(t * Math.PI) * 0.85;
    const rotationZ = Math.cos(t * Math.PI) * 0.35;
    const plank = mesh(root, new THREE.BoxGeometry(0.3, 0.1, 1.7), i % 3 === 0 ? material('#9b7650') : wood, [x, y, 0], [0, 0, rotationZ]);
    mesh(plank, new THREE.BoxGeometry(0.28, 0.04, 0.08), material(style.accent), [0, 0.07, 0.65], [0, 0, 0], [1, 1, 1], false);
  }
  for (let i = 0; i < 5; i += 1) {
    const t = i / 4;
    const x = (t - 0.5) * span;
    const y = 0.48 + Math.sin(t * Math.PI) * 0.85;
    for (const z of [-0.92, 0.92]) {
      mesh(root, new THREE.CylinderGeometry(0.055, 0.07, 0.95, 5), dark, [x, y + 0.48, z]);
      mesh(root, new THREE.SphereGeometry(0.09, 5, 4), material(style.accent), [x, y + 0.98, z], [0, 0, 0], [1, 0.8, 1], false);
    }
  }
  const ropeMat = material('#b49a72', { roughness: 1 });
  const pointsLeft = [];
  for (let i = 0; i < 13; i += 1) {
    const t = i / 12;
    pointsLeft.push(new THREE.Vector3((t - 0.5) * span, 0.98 + Math.sin(t * Math.PI) * 0.83, -0.92));
  }
  [-0.92, 0.92].forEach((z) => {
    const points = pointsLeft.map((p) => new THREE.Vector3(p.x, p.y, z));
    const curve = new THREE.CatmullRomCurve3(points);
    const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.026, 4, false), ropeMat);
    root.add(rope);
  });
  for (const x of [-span / 2 - 0.3, span / 2 + 0.3]) {
    mesh(root, new THREE.BoxGeometry(0.8, 0.95, 2.2), material('#8a8c81', { roughness: 0.98 }), [x, 0.35, 0]);
  }
  const lantern = glowSprite(style.glow, 0.8, 0.3);
  lantern.position.set(0, 1.95, 0.9);
  root.add(lantern);
  if (tier >= 3) {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.035, 4, 24, Math.PI), material(style.accent, { emissive: style.accent, emissiveIntensity: 0.3 }));
    arch.position.set(0, 1.8, 0);
    arch.rotation.z = Math.PI;
    root.add(arch);
  }
  addQualityOrnaments(root, tier, style, 1.5);
  shadows(root);
  return root;
}

function createGreenhouse(style, tier) {
  const root = new THREE.Group();
  basePlinth(root, style, tier, 3.6, 3.2);
  const floor = group(root, [0, 0.28, 0]);
  mesh(floor, new THREE.BoxGeometry(2.9, 0.3, 2.4), material('#8f8b7b', { roughness: 0.96 }), [0, 0.15, 0]);
  // 玻璃主体
  const glassMat = material(style.glass, { transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.06, side: THREE.DoubleSide, depthWrite: false });
  mesh(floor, new THREE.BoxGeometry(2.55, 2.05, 2.1), glassMat, [0, 1.28, 0]);
  // 木框
  const frameMat = M.woodDark();
  [[-1.28, 0], [1.28, 0]].forEach(([x, z]) => mesh(floor, new THREE.BoxGeometry(0.08, 2.1, 2.15), frameMat, [x, 1.28, z]));
  for (let i = 0; i < 4; i += 1) {
    mesh(floor, new THREE.BoxGeometry(2.6, 0.07, 0.07), frameMat, [0, 0.4 + i * 0.6, 1.07]);
    mesh(floor, new THREE.BoxGeometry(2.6, 0.07, 0.07), frameMat, [0, 0.4 + i * 0.6, -1.07]);
  }
  mesh(floor, new THREE.BoxGeometry(0.09, 2.15, 0.09), frameMat, [0, 1.3, 1.08]);
  // 屋顶
  const roofL = mesh(floor, new THREE.BoxGeometry(1.55, 0.1, 2.55), material(style.glass, { transparent: true, opacity: 0.3, roughness: 0.12, side: THREE.DoubleSide }), [-0.64, 2.62, 0], [0, 0, 0.42]);
  const roofR = mesh(floor, new THREE.BoxGeometry(1.55, 0.1, 2.55), material(style.glass, { transparent: true, opacity: 0.3, roughness: 0.12, side: THREE.DoubleSide }), [0.64, 2.62, 0], [0, 0, -0.42]);
  mesh(floor, new THREE.BoxGeometry(0.08, 0.08, 2.6), material(style.accent), [0, 2.95, 0]);
  [roofL, roofR].forEach((roof) => { roof.castShadow = false; });
  // 内部种植台
  for (let i = 0; i < 2; i += 1) {
    mesh(floor, new THREE.BoxGeometry(2.1, 0.38, 0.58), M.wood(), [0, 0.5, -0.42 + i * 0.84]);
    for (let j = 0; j < 4; j += 1) {
      mesh(floor, new THREE.CylinderGeometry(0.02, 0.025, 0.26, 3), M.leaf('#5d8850'), [-0.72 + j * 0.48, 0.8, -0.42 + i * 0.84], [0, 0, 0.1], [1, 1, 1], false);
      mesh(floor, new THREE.SphereGeometry(0.11, 5, 4), M.leaf(j % 2 ? '#76a85f' : '#5c8d58'), [-0.72 + j * 0.48, 0.86, -0.42 + i * 0.84], [0, 0, 0], [1.35, 0.5, 0.7], false);
    }
  }
  const watering = mesh(floor, new THREE.CylinderGeometry(0.17, 0.2, 0.3, 7), material('#5e8179'), [1.55, 0.55, 1.1]);
  mesh(watering, new THREE.CylinderGeometry(0.025, 0.025, 0.45, 4), material('#8ea79a'), [0.25, 0.1, 0], [0, 0, -0.6]);
  // 小灯与漂浮孢子
  const glow = glowSprite(style.glow, 1.7, 0.28);
  glow.position.set(0, 1.6, 0);
  floor.add(glow);
  const spores = group(floor);
  for (let i = 0; i < 7; i += 1) {
    const spore = mesh(spores, new THREE.SphereGeometry(0.035, 4, 3), material(style.accent, { emissive: style.accent, emissiveIntensity: 1 }), [(i % 3 - 1) * 0.7, 0.7 + (i % 4) * 0.3, (i % 2 - 0.5) * 0.8], [0, 0, 0], [1, 1, 1], false);
    spore.castShadow = false;
    spore.userData.phase = i * 0.9;
  }
  addTick(floor, (t) => {
    spores.children.forEach((spore) => {
      spore.position.y = 0.8 + Math.sin(t * 0.8 + spore.userData.phase) * 0.25;
      spore.position.x += Math.sin(t * 0.5 + spore.userData.phase) * 0.0008;
    });
  });
  addQualityOrnaments(root, tier, style, 1.95);
  shadows(root);
  root.traverse((child) => {
    if (child.isMesh && child.material?.transparent && child.material.opacity < 0.4) child.castShadow = false;
  });
  return root;
}

function createMarket(style, tier) {
  const root = new THREE.Group();
  basePlinth(root, style, tier, 3.7, 3.3);
  const floor = group(root, [0, 0.28, 0]);
  // 摊位桌面
  mesh(floor, new THREE.BoxGeometry(3.1, 0.16, 1.15), M.wood(), [0, 0.86, 0.55]);
  for (const x of [-1.35, 1.35]) for (const z of [0.12, 1.0]) mesh(floor, new THREE.BoxGeometry(0.1, 0.9, 0.1), M.woodDark(), [x, 0.42, z]);
  // 顶棚
  const canvasColors = [style.accent, '#e8ddc4'];
  for (let i = 0; i < 6; i += 1) {
    const x = -1.55 + i * 0.62;
    mesh(floor, new THREE.BoxGeometry(0.64, 0.09, 2.2), material(canvasColors[i % 2], { roughness: 0.95, side: THREE.DoubleSide }), [x, 2.55, 0.2], [0, 0, 0.035 * (i % 2 ? 1 : -1)]);
  }
  for (const x of [-1.65, 1.65]) for (const z of [-0.75, 1.12]) mesh(floor, new THREE.CylinderGeometry(0.06, 0.07, 2.4, 5), M.woodDark(), [x, 1.35, z]);
  // 货品
  for (let i = 0; i < 3; i += 1) {
    mesh(floor, new THREE.SphereGeometry(0.13, 5, 4), material(i % 2 ? '#dc8d62' : '#e3bb69'), [-0.8 + i * 0.32, 1.02, 0.65], [0, 0, 0], [1, 0.8, 1], false);
  }
  for (let i = 0; i < 4; i += 1) {
    mesh(floor, new THREE.SphereGeometry(0.08, 4, 3), material(i % 2 ? '#91aa6c' : '#c88889'), [0.55 + i * 0.18, 1.01, 0.6], [0, 0, 0], [1, 1, 1], false);
  }
  mesh(floor, new THREE.BoxGeometry(0.45, 0.4, 0.45), M.woodDark(), [1.3, 0.55, 0.8]);
  mesh(floor, new THREE.CylinderGeometry(0.24, 0.28, 0.5, 7), M.wood(), [-1.35, 0.55, 1.1]);
  // 挂旗与风铃
  const sign = group(floor, [-0.4, 2.1, 1.22]);
  mesh(sign, new THREE.BoxGeometry(1.2, 0.4, 0.08), M.wood(), [0, 0, 0]);
  mesh(sign, new THREE.BoxGeometry(1.1, 0.07, 0.09), material(style.accent), [0, 0.1, 0]);
  const banner = addFlag(floor, [1.68, 0.35, -0.65], style.banner);
  // 吊灯
  for (const x of [-0.7, 0.7]) {
    const lamp = mesh(floor, new THREE.CylinderGeometry(0.1, 0.14, 0.22, 6), material(style.glow, { emissive: style.glow, emissiveIntensity: 1.4 }), [x, 2.25, 1.0], [0, 0, 0], [1, 1, 1], false);
    const glow = glowSprite(style.glow, 0.75, 0.42);
    glow.position.set(x, 2.25, 1.0);
    floor.add(glow);
    lamp.castShadow = false;
  }
  addQualityOrnaments(root, tier, style, 2);
  shadows(root);
  return root;
}

function createCampfire(style, tier) {
  const root = new THREE.Group();
  const ring = group(root);
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2;
    const stone = mesh(ring, new THREE.DodecahedronGeometry(0.24 + (i % 3) * 0.05, 0), material('#8a8b81', { roughness: 1 }), [Math.cos(angle) * 0.9, 0.18, Math.sin(angle) * 0.9], [i, angle, 0], [1, 0.72, 1]);
    stone.castShadow = true;
  }
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2;
    mesh(root, new THREE.CylinderGeometry(0.09, 0.12, 1.1, 5), M.bark('#6b4b32'), [Math.cos(angle) * 0.28, 0.28, Math.sin(angle) * 0.28], [0.95, angle, 0.2]);
  }
  const fire = group(root, [0, 0.35, 0]);
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ff9e4c', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const flame1 = mesh(fire, new THREE.ConeGeometry(0.32, 1.0, 5), flameMat, [0, 0.5, 0]);
  const flame2 = mesh(fire, new THREE.ConeGeometry(0.2, 0.75, 5), new THREE.MeshBasicMaterial({ color: '#ffe6a4', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), [0.08, 0.45, 0.05], [0, 0, 0.2]);
  flame1.castShadow = false;
  flame2.castShadow = false;
  const glow = glowSprite('#ffb66d', 2.5, 0.5);
  glow.position.y = 0.7;
  fire.add(glow);
  // 三角吊架
  for (let i = 0; i < 3; i += 1) {
    const angle = (i / 3) * Math.PI * 2 + 0.4;
    mesh(root, new THREE.CylinderGeometry(0.025, 0.035, 1.8, 4), M.woodDark(), [Math.cos(angle) * 0.72, 1.4, Math.sin(angle) * 0.72], [Math.sin(angle) * 0.35, 0, -Math.cos(angle) * 0.35]);
  }
  const kettle = mesh(root, new THREE.CylinderGeometry(0.24, 0.3, 0.33, 8), material('#3d4542', { metalness: 0.45, roughness: 0.5 }), [0, 1.15, 0]);
  mesh(kettle, new THREE.TorusGeometry(0.18, 0.02, 4, 12, Math.PI), material('#9b9c90'), [0, 0.2, 0], [0, 0, 0]);
  addTick(fire, (t) => {
    flame1.scale.y = 0.8 + Math.sin(t * 7.3) * 0.18;
    flame1.scale.x = 0.9 + Math.sin(t * 5.2) * 0.08;
    flame2.rotation.y = t * 0.7;
    glow.material.opacity = 0.4 + Math.sin(t * 5.1) * 0.1;
  });
  if (tier >= 2) {
    mesh(root, new THREE.BoxGeometry(1.6, 0.2, 0.72), M.wood(), [1.45, 0.48, 0.5], [0, 0.15, 0]);
    mesh(root, new THREE.BoxGeometry(1.6, 0.42, 0.16), M.woodDark(), [1.45, 0.75, 0.13], [0, 0.15, 0]);
    addQualityOrnaments(root, tier, style, 1.1);
  }
  shadows(root);
  root.traverse((child) => { if (child.material?.blending === THREE.AdditiveBlending) child.castShadow = false; });
  return root;
}

function createPavilion(style, tier) {
  const root = new THREE.Group();
  basePlinth(root, style, tier, 3.4, 3.1);
  const floor = group(root, [0, 0.28, 0]);
  mesh(floor, new THREE.BoxGeometry(2.7, 0.16, 2.45), M.woodLight(), [0, 0.2, 0]);
  for (const x of [-1.12, 1.12]) for (const z of [-1.0, 1.0]) {
    mesh(floor, new THREE.CylinderGeometry(0.09, 0.12, 2.15, 6), M.woodDark(), [x, 1.3, z]);
    mesh(floor, new THREE.BoxGeometry(0.26, 0.1, 0.26), material(style.stone ?? '#8b8b7f'), [x, 0.35, z]);
  }
  // 四角攒尖屋顶
  mesh(floor, new THREE.ConeGeometry(2.35, 0.85, 4), material(style.roof, { roughness: 0.85, texture: 'roof', textureScale: 1.3, bumpScale: 0.11 }), [0, 2.78, 0], [0, Math.PI / 4, 0]);
  mesh(floor, new THREE.ConeGeometry(1.7, 0.45, 4), material(style.accent, { roughness: 0.7, texture: 'stone', bumpScale: 0.05 }), [0, 3.36, 0], [0, Math.PI / 4, 0]);
  mesh(floor, new THREE.SphereGeometry(0.12, 6, 5), material(style.metal, { metalness: 0.6, roughness: 0.3 }), [0, 3.65, 0]);
  // 薄纱帘（半透明面）
  for (const z of [-1.1, 1.1]) {
    const curtain = mesh(floor, new THREE.PlaneGeometry(2.1, 1.4), material('#e7dfce', { transparent: true, opacity: 0.23, side: THREE.DoubleSide, depthWrite: false }), [0, 1.6, z], [0, 0, 0]);
    curtain.castShadow = false;
  }
  // 桌椅
  mesh(floor, new THREE.CylinderGeometry(0.45, 0.42, 0.08, 8), M.wood(), [0.1, 0.9, 0.1]);
  mesh(floor, new THREE.CylinderGeometry(0.12, 0.18, 0.68, 6), M.woodDark(), [0.1, 0.55, 0.1]);
  mesh(floor, new THREE.CylinderGeometry(0.16, 0.16, 0.22, 7), material(style.glow, { emissive: style.glow, emissiveIntensity: 0.15 }), [0.1, 1.03, 0.1]);
  for (let i = 0; i < 2; i += 1) {
    mesh(floor, new THREE.BoxGeometry(0.55, 0.09, 0.4), M.wood(), [-0.85 + i * 1.9, 0.62, 0.65]);
    mesh(floor, new THREE.BoxGeometry(0.5, 0.35, 0.08), M.woodDark(), [-0.85 + i * 1.9, 0.8, 0.85]);
  }
  const tea = group(floor, [0.1, 1.1, 0.1]);
  mesh(tea, new THREE.SphereGeometry(0.12, 6, 5), material(style.accent, { roughness: 0.45 }), [0, 0, 0], [0, 0, 0], [1, 0.8, 1], false);
  mesh(tea, new THREE.CylinderGeometry(0.13, 0.16, 0.04, 7), M.white(), [0, -0.12, 0]);
  const steam = group(tea, [0, 0.2, 0]);
  for (let i = 0; i < 2; i += 1) {
    mesh(steam, new THREE.TorusGeometry(0.1 + i * 0.03, 0.008, 3, 12, Math.PI), material('#eee6d7', { transparent: true, opacity: 0.3 }), [0, i * 0.2, 0], [0.2, 0, 0], [1, 1, 1], false);
  }
  const lantern = createLanternPost(style.glow);
  lantern.position.set(-1.35, 0.38, 0.95);
  root.add(lantern);
  addQualityOrnaments(root, tier, style, 1.8);
  shadows(root);
  return root;
}

function createFountain(style, tier) {
  const root = new THREE.Group();
  const stoneMat = material(tier >= 4 ? '#4a4d48' : '#a3a294', { roughness: 0.96 });
  mesh(root, new THREE.CylinderGeometry(1.5, 1.7, 0.45, 12), stoneMat, [0, 0.23, 0]);
  mesh(root, new THREE.CylinderGeometry(1.24, 1.28, 0.1, 12), M.water(), [0, 0.43, 0]);
  mesh(root, new THREE.CylinderGeometry(1.33, 1.38, 0.12, 12), material(style.accent, { roughness: 0.6 }), [0, 0.46, 0]);
  mesh(root, new THREE.CylinderGeometry(0.25, 0.42, 1.0, 8), stoneMat, [0, 0.9, 0]);
  mesh(root, new THREE.CylinderGeometry(0.55, 0.34, 0.18, 8), stoneMat, [0, 1.4, 0]);
  mesh(root, new THREE.CylinderGeometry(0.42, 0.46, 0.08, 8), M.water(), [0, 1.52, 0]);
  const crystal = mesh(root, new THREE.OctahedronGeometry(0.32, 0), material(style.accent, { metalness: 0.2, roughness: 0.15, emissive: style.accent, emissiveIntensity: 0.6, transparent: true, opacity: 0.9 }), [0, 1.9, 0], [0, 0, 0], [1, 1.6, 1]);
  mesh(root, new THREE.TorusGeometry(0.52, 0.025, 4, 32), material(style.metal, { metalness: 0.7, roughness: 0.3 }), [0, 1.9, 0], [Math.PI / 2, 0, 0]);
  const jets = group(root);
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2;
    const jet = mesh(jets, new THREE.CylinderGeometry(0.025, 0.05, 0.75, 4), material('#c6f5ed', { transparent: true, opacity: 0.45, emissive: '#89dfd1', emissiveIntensity: 0.3 }), [Math.cos(angle) * 0.65, 0.78, Math.sin(angle) * 0.65], [Math.cos(angle) * 0.2, 0, Math.sin(angle) * 0.2], [1, 1, 1], false);
    jet.castShadow = false;
  }
  const sparkle = group(root);
  for (let i = 0; i < 10; i += 1) {
    const dot = glowSprite(style.glow, 0.18, 0.35);
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.4 + Math.random() * 0.9;
    dot.position.set(Math.cos(angle) * radius, 0.5 + Math.random() * 0.7, Math.sin(angle) * radius);
    dot.userData.phase = Math.random() * 10;
    sparkle.add(dot);
  }
  addTick(root, (t) => {
    crystal.rotation.y = t * 0.35;
    crystal.position.y = 1.9 + Math.sin(t * 0.8) * 0.06;
    sparkle.children.forEach((dot, index) => {
      dot.position.y = 0.45 + ((t * 0.22 + dot.userData.phase) % 1) * 0.9;
      dot.position.x = Math.cos(t * 0.25 + index) * (0.55 + (index % 4) * 0.22);
      dot.position.z = Math.sin(t * 0.25 + index) * (0.55 + (index % 4) * 0.22);
      dot.material.opacity = 0.3 + Math.sin(t * 2 + index) * 0.12;
    });
  });
  addQualityOrnaments(root, tier, style, 1.5);
  shadows(root);
  return root;
}

function createWindmill(style, tier) {
  const root = new THREE.Group();
  basePlinth(root, style, tier, 3.2, 3);
  const floor = group(root, [0, 0.28, 0]);
  mesh(floor, new THREE.CylinderGeometry(1.0, 1.38, 2.6, 9), material(tier >= 3 ? '#ded2b7' : '#d4c7aa', { roughness: 0.96 }), [0, 1.35, 0]);
  mesh(floor, new THREE.TorusGeometry(1.1, 0.06, 4, 24), M.woodDark(), [0, 1.1, 0], [Math.PI / 2, 0, 0]);
  mesh(floor, new THREE.CylinderGeometry(0.95, 1.0, 0.2, 9), material(style.roof, { roughness: 0.86, texture: 'roof', textureScale: 1.2, bumpScale: 0.1 }), [0, 2.7, 0]);
  mesh(floor, new THREE.ConeGeometry(1.35, 1.05, 9), material(style.roof, { roughness: 0.86, texture: 'roof', textureScale: 1.2, bumpScale: 0.1 }), [0, 3.25, 0]);
  mesh(floor, new THREE.CylinderGeometry(0.055, 0.055, 0.7, 5), M.woodDark(), [0, 4.02, 0]);
  // 风车叶片
  const rotor = group(floor, [0, 2.85, 1.22]);
  mesh(rotor, new THREE.CylinderGeometry(0.16, 0.2, 0.2, 8), M.woodDark(), [0, 0, 0], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i += 1) {
    const blade = group(rotor, [0, 0, 0], [0, 0, (i / 4) * Math.PI * 2]);
    mesh(blade, new THREE.BoxGeometry(0.13, 1.75, 0.08), M.woodDark(), [0, 0.95, 0.02]);
    mesh(blade, new THREE.BoxGeometry(0.55, 1.45, 0.05), material(i % 2 ? '#e0d3b6' : '#c7b38e'), [0.33, 0.95, 0], [0, 0, 0]);
    for (let j = 0; j < 3; j += 1) {
      mesh(blade, new THREE.BoxGeometry(0.58, 0.035, 0.06), M.woodDark(), [0.33, 0.42 + j * 0.47, 0.035]);
    }
  }
  addTick(rotor, (t) => {
    rotor.rotation.z = t * 0.42;
  });
  // 门与袋子
  mesh(floor, new THREE.BoxGeometry(0.5, 0.8, 0.1), M.woodDark(), [0.3, 0.7, 1.29]);
  mesh(floor, new THREE.SphereGeometry(0.24, 7, 5), material('#c4aa7e', { roughness: 1 }), [-1.45, 0.52, 0.8], [0.1, 0.3, 0.2], [1, 0.8, 0.8]);
  mesh(floor, new THREE.SphereGeometry(0.2, 6, 5), material('#d0b989', { roughness: 1 }), [-1.25, 0.46, 1.2], [0, 0, 0], [1, 0.8, 0.9]);
  addQualityOrnaments(root, tier, style, 1.7);
  shadows(root);
  return root;
}

function createFlowerArch(style, tier) {
  const root = new THREE.Group();
  const beamMat = M.woodDark();
  const points = [];
  for (let i = 0; i <= 16; i += 1) {
    const angle = (i / 16) * Math.PI;
    points.push(new THREE.Vector3(Math.cos(angle) * 1.35, Math.sin(angle) * 1.9 + 0.05, 0));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const beam = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.075, 5, false), beamMat);
  beam.castShadow = true;
  root.add(beam);
  for (const x of [-1.35, 1.35]) {
    mesh(root, new THREE.BoxGeometry(0.2, 2.4, 0.2), M.woodDark(), [x, 0.2, 0]);
    mesh(root, new THREE.BoxGeometry(0.5, 0.12, 0.5), material(style.accent), [x, 0.1, 0]);
    mesh(root, new THREE.BoxGeometry(0.3, 0.55, 0.3), material('#6c7c59', { roughness: 1 }), [x, 0.45, 0]);
  }
  const leafMat = M.leaf('#5e8b5b');
  for (let i = 0; i <= 10; i += 1) {
    const point = curve.getPoint(i / 10);
    mesh(root, new THREE.SphereGeometry(0.14, 5, 4), leafMat, [point.x, point.y, point.z], [0, 0, 0], [1.5, 0.6, 0.8], false);
    if (i % 2 === 0) {
      mesh(root, new THREE.SphereGeometry(0.1, 5, 4), material(i % 4 === 0 ? '#e9a8a4' : style.accent, { roughness: 0.65 }), [point.x + 0.08, point.y + 0.1, point.z + 0.04], [0, 0, 0], [1, 0.7, 1], false);
    }
  }
  for (let i = 0; i < 5; i += 1) {
    const flower = mesh(root, new THREE.OctahedronGeometry(0.08, 0), material(i % 2 ? '#f1c177' : '#ea9f9b'), [(-0.8 + i * 0.4), 0.38 + Math.sin(i) * 0.15, 0.15], [0, 0, 0], [1, 1, 1], false);
    flower.castShadow = false;
  }
  if (tier >= 3) {
    for (const x of [-1.35, 1.35]) {
      const light = glowSprite(style.glow, 0.5, 0.3);
      light.position.set(x, 2.4, 0);
      root.add(light);
    }
  }
  addQualityOrnaments(root, tier, style, 1.4);
  shadows(root);
  return root;
}

function createLighthouse(style, tier) {
  const root = new THREE.Group();
  basePlinth(root, style, tier, 3.2, 3);
  const floor = group(root, [0, 0.28, 0]);
  mesh(floor, new THREE.CylinderGeometry(1.0, 1.35, 0.35, 9), material('#8d8e83', { roughness: 0.97 }), [0, 0.2, 0]);
  mesh(floor, new THREE.CylinderGeometry(0.62, 0.98, 3.8, 9), material('#e0d8c5', { roughness: 0.92 }), [0, 2.05, 0]);
  // 红白条纹
  for (let i = 0; i < 3; i += 1) {
    const y = 0.8 + i * 1.05;
    const radius = 0.98 - (y / 3.8) * 0.34;
    mesh(floor, new THREE.CylinderGeometry(radius - 0.01, radius + 0.02, 0.38, 9), material(i % 2 ? style.accent : '#a65f50', { roughness: 0.9 }), [0, y, 0]);
  }
  // 阳台、灯室
  mesh(floor, new THREE.CylinderGeometry(0.75, 0.65, 0.14, 9), material('#4b5450'), [0, 4.03, 0]);
  mesh(floor, new THREE.CylinderGeometry(0.46, 0.52, 0.82, 8), material('#b8ddd8', { transparent: true, opacity: 0.55, roughness: 0.12 }), [0, 4.5, 0]);
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2;
    mesh(floor, new THREE.CylinderGeometry(0.025, 0.025, 0.82, 4), material('#4f5c56'), [Math.cos(angle) * 0.45, 4.5, Math.sin(angle) * 0.45], [0, 0, 0], [1, 1, 1], false);
  }
  const lamp = mesh(floor, new THREE.SphereGeometry(0.26, 8, 7), material('#fff1c3', { emissive: style.glow, emissiveIntensity: 2.2 }), [0, 4.5, 0]);
  const lampGlow = glowSprite(style.glow, 2.3, 0.7);
  lampGlow.position.set(0, 4.5, 0);
  floor.add(lampGlow);
  mesh(floor, new THREE.ConeGeometry(0.72, 0.58, 8), material(style.roof, { roughness: 0.86, texture: 'roof', textureScale: 1.2, bumpScale: 0.1 }), [0, 5.18, 0]);
  mesh(floor, new THREE.CylinderGeometry(0.045, 0.045, 0.7, 5), material(style.metal), [0, 5.68, 0]);
  // 光束
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(1.15, 9, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: style.glow, transparent: true, opacity: 0.075, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  beam.position.set(0, 4.5, -4.3);
  beam.rotation.x = -Math.PI / 2;
  beam.rotation.z = 0.1;
  floor.add(beam);
  const beam2 = beam.clone();
  beam2.rotation.z = beam.rotation.z + Math.PI;
  beam2.position.z = 4.3;
  floor.add(beam2);
  addTick(floor, (t) => {
    const intensity = 0.07 + Math.sin(t * 1.5) * 0.018;
    beam.material.opacity = intensity;
    beam2.material.opacity = intensity;
    lampGlow.material.opacity = 0.56 + Math.sin(t * 2.4) * 0.08;
    lamp.scale.setScalar(1 + Math.sin(t * 2.2) * 0.035);
  });
  addQualityOrnaments(root, tier, style, 1.8);
  shadows(root);
  root.traverse((child) => { if (child.material?.blending === THREE.AdditiveBlending) child.castShadow = false; });
  return root;
}

function createObservatory(style, tier) {
  const root = new THREE.Group();
  // 星图基座
  const base = new THREE.Group();
  root.add(base);
  mesh(base, new THREE.CylinderGeometry(2.1, 2.4, 0.35, 12), material('#5b615c', { roughness: 0.92 }), [0, 0.18, 0]);
  const starMap = new THREE.Mesh(new THREE.RingGeometry(1.35, 2.0, 48), material('#375e5d', { emissive: '#4b8d84', emissiveIntensity: 0.28, roughness: 0.45, side: THREE.DoubleSide }));
  starMap.rotation.x = -Math.PI / 2;
  starMap.position.y = 0.37;
  base.add(starMap);
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2;
    const radius = 1.45 + (i % 3) * 0.18;
    mesh(base, new THREE.SphereGeometry(0.035, 4, 3), material(style.accent, { emissive: style.accent, emissiveIntensity: 1 }), [Math.cos(angle) * radius, 0.38, Math.sin(angle) * radius], [0, 0, 0], [1, 1, 1], false);
  }
  // 主体与穹顶
  const floor = group(base, [0, 0.36, 0]);
  mesh(floor, new THREE.CylinderGeometry(1.55, 1.78, 1.7, 12), material(tier >= 4 ? '#3b403d' : '#8a9187', { roughness: 0.9 }), [0, 0.85, 0]);
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2;
    mesh(floor, new THREE.BoxGeometry(0.18, 1.2, 0.3), material('#687069'), [Math.cos(angle) * 1.6, 0.75, Math.sin(angle) * 1.6], [0, angle, 0]);
  }
  mesh(floor, new THREE.TorusGeometry(1.56, 0.05, 4, 32), material(style.accent, { metalness: 0.45, roughness: 0.4 }), [0, 1.65, 0], [Math.PI / 2, 0, 0]);
  // 半球穹顶
  const dome = new THREE.Group();
  floor.add(dome);
  mesh(dome, new THREE.SphereGeometry(1.58, 16, 9, 0, Math.PI * 2, 0, Math.PI / 2), material(tier >= 4 ? '#30393a' : '#9ba99f', { roughness: 0.42, metalness: 0.28 }), [0, 1.68, 0]);
  // 开缝
  const slit = mesh(dome, new THREE.BoxGeometry(0.22, 1.45, 0.05), material('#162a2d', { emissive: '#1e4e52', emissiveIntensity: 0.7 }), [0, 2.15, 1.2], [-0.7, 0, 0]);
  // 望远镜
  const scope = group(dome, [0, 2.05, 0.2]);
  mesh(scope, new THREE.CylinderGeometry(0.18, 0.26, 2.4, 8), material('#384b4e', { metalness: 0.35, roughness: 0.4 }), [0, 0.6, 0], [0.85, 0, 0]);
  mesh(scope, new THREE.CylinderGeometry(0.29, 0.29, 0.28, 8), material(style.metal, { metalness: 0.7, roughness: 0.28 }), [0, 1.55, 0.75], [0.85, 0, 0]);
  mesh(scope, new THREE.CylinderGeometry(0.06, 0.06, 0.7, 5), M.woodDark(), [0, 0.18, 0.12], [0, 0, 0]);
  // 星环
  const starRing = group(floor, [0, 2.55, 0]);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.025, 4, 64), material(style.accent, { transparent: true, opacity: 0.5, emissive: style.accent, emissiveIntensity: 0.25 }));
  ring.rotation.x = Math.PI / 2.35;
  starRing.add(ring);
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    const crystal = mesh(starRing, new THREE.OctahedronGeometry(0.12, 0), material(style.accent, { emissive: style.accent, emissiveIntensity: 0.7 }), [Math.cos(angle) * 2.1, 0, Math.sin(angle) * 2.1], [0, angle, 0], [1, 1.6, 1]);
    crystal.castShadow = false;
  }
  const glow = glowSprite(style.glow, 5.5, 0.28);
  glow.position.set(0, 3.2, 0);
  floor.add(glow);
  // 台阶
  for (let i = 0; i < 4; i += 1) {
    mesh(floor, new THREE.BoxGeometry(0.9 + i * 0.25, 0.16, 0.65), material('#8b8c80'), [0, 0.08 + i * 0.16, 1.9 + i * 0.35]);
  }
  addTick(floor, (t) => {
    dome.rotation.y = Math.sin(t * 0.08) * 0.12;
    scope.rotation.z = Math.sin(t * 0.5) * 0.04;
    starRing.rotation.y = t * 0.09;
    starRing.rotation.x = Math.sin(t * 0.2) * 0.06;
    glow.material.opacity = 0.22 + Math.sin(t * 0.7) * 0.05;
    slit.material.emissiveIntensity = 0.5 + Math.sin(t * 1.4) * 0.2;
  });
  addQualityOrnaments(root, tier, style, 2.1);
  shadows(root);
  root.traverse((child) => { if (child.material?.transparent) child.castShadow = false; });
  return root;
}

/**
 * 每类建筑在 RTS 素材包里的三个等级。
 * 段位越高，房子越大、旗子越多——不再由程序生成建筑。
 */
const MODEL_TIERS = {
  workshop: ['Storage_FirstAge_Level1', 'Storage_FirstAge_Level2', 'Storage_FirstAge_Leve3'],
  forge: ['Barracks_FirstAge_Level1', 'Barracks_FirstAge_Level2', 'Barracks_FirstAge_Level3'],
  market: ['Market_FirstAge_Level1', 'Market_FirstAge_Level2', 'Market_FirstAge_Level3'],
  greenhouse: ['Farm_FirstAge_Level1_Wheat', 'Farm_FirstAge_Level2_Wheat', 'Farm_FirstAge_Level3_Wheat'],
  windmill: ['Windmill_FirstAge', 'Windmill_FirstAge', 'Windmill_SecondAge'],
  cottage: ['Houses_FirstAge_1_Level1', 'Houses_FirstAge_1_Level2', 'Houses_FirstAge_1_Level3'],
  cottage_timber: ['Houses_FirstAge_2_Level1', 'Houses_FirstAge_2_Level2', 'Houses_FirstAge_2_Level3'],
  cottage_stone: ['Houses_FirstAge_3_Level1', 'Houses_FirstAge_3_Level2', 'Houses_FirstAge_3_Level3'],
  campfire: ['Logs', 'Logs', 'Logs'],
  pavilion: ['Temple_FirstAge_Level1', 'Temple_FirstAge_Level2', 'Temple_FirstAge_Level3'],
  fountain: ['Wonder_FirstAge_Level1', 'Wonder_FirstAge_Level2', 'Wonder_FirstAge_Level3'],
  bridge: ['Dock_FirstAge', 'Dock_FirstAge', 'Dock_FirstAge'],
  lighthouse: ['WatchTower_FirstAge_Level1', 'WatchTower_FirstAge_Level2', 'WatchTower_FirstAge_Level3'],
  observatory: ['Wonder_SecondAge_Level1', 'Wonder_SecondAge_Level2', 'Wonder_SecondAge_Level3'],
  flower_arch: ['WallTowers_Door_FirstAge', 'WallTowers_Door_FirstAge', 'WallTowers_Door_SecondAge'],
};

/** 模型的目标宽度（米），决定它在岛上的体量 */
const MODEL_WIDTH = {
  workshop: 6.2,
  forge: 6.6,
  market: 8.0,
  greenhouse: 8.4,
  windmill: 6.0,
  cottage: 5.0,
  cottage_timber: 5.8,
  cottage_stone: 6.6,
  campfire: 2.4,
  pavilion: 5.6,
  fountain: 5.4,
  bridge: 7.0,
  lighthouse: 4.4,
  observatory: 6.4,
  flower_arch: 6.2,
};

const BUILDERS = {
  workshop: createWorkshop,
  forge: createForge,
  cottage: createCottage,
  bridge: createBridge,
  greenhouse: createGreenhouse,
  market: createMarket,
  campfire: createCampfire,
  pavilion: createPavilion,
  fountain: createFountain,
  windmill: createWindmill,
  flower_arch: createFlowerArch,
  lighthouse: createLighthouse,
  observatory: createObservatory,
};

export function createBuilding(type, tier = 1, options = {}) {
  const normalizedTier = Math.max(1, Math.min(4, Number(tier) || 1));
  const style = styleFor(normalizedTier);

  // 有 RTS 模型就用模型：Level1/2/3 就是房子的三个档次
  const tierModels = MODEL_TIERS[type];
  const modelKey = tierModels
    ? tierModels[Math.min(tierModels.length - 1, normalizedTier - 1)]
    : options.modelKey;
  const modelWidth = options.modelWidth ?? MODEL_WIDTH[type] ?? 5.5;
  const fromPack = modelKey
    ? rts.create(modelKey, {
      targetHeight: options.modelHeight ?? 0,
      targetWidth: modelWidth,
      ghost: Boolean(options.ghost),
    })
    : null;

  const building = fromPack ?? (BUILDERS[type] ?? createPavilion)(style, normalizedTier);
  if (fromPack) {
    building.name = `${type}-rts`;
    if (options.ghost) {
      building.traverse((child) => {
        if (child.isMesh) child.castShadow = false;
      });
    } else {
      const shadow = createGroundShadow(options.shadowRadius ?? 2.4, 0.26);
      shadow.name = 'contact-shadow';
      building.add(shadow);
    }
  }
  building.userData.buildingType = type;
  building.userData.qualityTier = normalizedTier;
  building.userData.style = style;
  if (options.ghost && !fromPack) {
    building.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
  } else if (!fromPack) {
    const shadowRadius = type === 'lighthouse' ? 2.6 : type === 'observatory' ? 2.5 : type === 'bridge' ? 2.6 : 2.15;
    const shadow = createGroundShadow(shadowRadius, 0.26);
    shadow.name = 'contact-shadow';
    building.add(shadow);
  }
  return building;
}

export function buildingInteraction(type) {
  const map = {
    workshop: { prompt: '工坊', label: '查看木作工坊', action: 'station:workshop', glyph: '作' },
    forge: { prompt: '锻炉', label: '开炉锻造', action: 'station:forge', glyph: '锻' },
    cottage: { prompt: '小屋', label: '查看旅人小屋', action: 'station:cottage', glyph: '居' },
    greenhouse: { prompt: '暖房', label: '查看玻璃暖房', action: 'station:greenhouse', glyph: '圃' },
    market: { prompt: '市集', label: '逛逛潮汐市集', action: 'station:market', glyph: '市' },
    campfire: { prompt: '篝火', label: '在篝火旁休息', action: 'station:campfire', glyph: '憩' },
    pavilion: { prompt: '茶亭', label: '在茶亭坐一会儿', action: 'station:pavilion', glyph: '茶' },
    fountain: { prompt: '星泉', label: '掬一捧星泉水', action: 'station:fountain', glyph: '泉' },
    windmill: { prompt: '磨坊', label: '看看风语磨坊', action: 'station:windmill', glyph: '风' },
    lighthouse: { prompt: '灯塔', label: '登上看守灯塔', action: 'station:lighthouse', glyph: '灯' },
    observatory: { prompt: '观星台', label: '走进星辉观星台', action: 'station:observatory', glyph: '星' },
    bridge: { prompt: '拱桥', label: '在桥上停留', action: 'station:bridge', glyph: '桥' },
    flower_arch: { prompt: '花门', label: '看看花蔓拱门', action: 'station:flower_arch', glyph: '花' },
  };
  return map[type] ?? map.pavilion;
}

export function buildingHeight(type) {
  if (type === 'lighthouse') return 6;
  if (type === 'observatory') return 5;
  if (type === 'windmill') return 4.5;
  return 3;
}

export { styleFor };
