import * as THREE from 'three';
import { mulberry32 } from '../core/utils.js';
import { village } from './villageAssets.js';
import { nature } from './natureAssets.js';
import { jungle } from './jungleAssets.js';
import { mergeByMaterial } from './villageScene.js';
import {
  M,
  createLanternPost,
  glyphSprite,
  createReeds,
  createRock,
  createTree,
  glowSprite,
  group,
  material,
  mesh,
} from './modelKit.js';
import { getSurface } from './textures.js';
import { PLANT_KEYS, addRock, createPlantCollector, flowerBed, rockPatch } from './gardenPlants.js';

/**
 * 学科岛的园林设计。
 *
 * 之前每座学科岛都套同一座苔溪镇：十来栋房子围着石板广场，花草随机撒。
 * 现在改成「一座岛 = 一个主题庭院」：
 *   · 只留 2~3 栋有身份的建筑（书院、钟塔、铁匠铺……），彼此拉开距离；
 *   · 每个学科有自己的道路语法（汀步、轴线、之字坡、环形、栈道……）；
 *   · 花草不是随机撒，而是按主题成园（枯山水、几何花坛、岩园、试剂花圃……）。
 *
 * 所有坐标都写在 `GARDENS` 里，改动只需调数据，不用碰摆放逻辑。
 */

const GROUND_Y = 1.12;
const TRIAL_PULL = 1;

/* ------------------------------------------------------------------ */
/* 主题配置                                                            */
/* ------------------------------------------------------------------ */

export const GARDENS = {
  wen: {
    name: '书院竹庭',
    loopRadius: 13.4,
    border: { type: 'moss', color: '#5f7d54' },
    hub: { x: 0, z: 3.2, radius: 2.9, shape: 'circle' },
    path: { surface: 'stepping', width: 1.7, color: '#8f8c79', shape: 'curve', sway: 2.3 },
    buildings: [
      { piece: 'Inn', angle: 2.62, radius: 12.6, scale: 0.62, label: '问墨书院' },
      { piece: 'Gazebo', angle: -1.42, radius: 11.2, scale: 0.95, label: '拾句亭' },
    ],
    features: [
      { type: 'zen', x: -8.6, z: -8.2, radius: 4.3 },
      { type: 'grove', x: -13.2, z: 4.2, count: 3, radius: 5 },
      { type: 'steles', x: 9.2, z: -8.6, count: 5, glyphs: ['诗', '书', '礼', '乐', '墨'] },
      { type: 'pond', x: 10.6, z: 8.4, radius: 2.4 },
    ],
    palette: { bed: '#5d7060', flower: '#e7dbe9', accent: '#e3ce9d' },
  },

  shu: {
    name: '几何台地',
    loopRadius: 12.6,
    border: { type: 'hedge', color: '#4a6b47' },
    hub: { x: 0, z: 2.4, radius: 3.4, shape: 'square' },
    path: { surface: 'tile', width: 2.2, color: '#a9a69a', shape: 'axis' },
    buildings: [
      { piece: 'Bell_Tower', angle: 2.42, radius: 13.2, scale: 0.92, label: '测海钟塔' },
      { piece: 'House_2', angle: -1.34, radius: 12.0, scale: 1.7, label: '算学馆' },
    ],
    features: [
      { type: 'parterre', x: -8.4, z: 9.2, size: 3.1, count: 4 },
      { type: 'sundial', x: 6.2, z: -8.4 },
      { type: 'hedgewalk', x: 0, z: -11.4, length: 9 },
    ],
    palette: { bed: '#6f7a5c', flower: '#e8d68d', accent: '#d9b565' },
  },

  wu: {
    name: '风轮岩园',
    loopRadius: 13.8,
    border: { type: 'rocks' },
    hub: { x: 0, z: 2.8, radius: 2.7, shape: 'circle' },
    path: { surface: 'slab', width: 2.0, color: '#98958a', shape: 'zigzag', sway: 2.6 },
    buildings: [
      { piece: 'Blacksmith', angle: 2.7, radius: 12.4, scale: 1.0, label: '机巧坊' },
      { piece: 'Mill', angle: -1.5, radius: 13.4, scale: 1.55, label: '风轮磨坊' },
    ],
    features: [
      { type: 'rockgarden', x: 9.6, z: -8.4, radius: 4.2 },
      { type: 'chimes', x: 13.0, z: 3.6, count: 4 },
      { type: 'gears', x: -9.4, z: -9.2 },
    ],
    palette: { bed: '#6b6f66', flower: '#d9c27a', accent: '#c9a05a' },
  },

  hua: {
    name: '试剂花圃',
    loopRadius: 13.2,
    border: { type: 'flowers', color: '#c6a8e0' },
    hub: { x: 0, z: 2.6, radius: 3.0, shape: 'ring' },
    path: { surface: 'brick', width: 1.9, color: '#9c8fa4', shape: 'radial' },
    buildings: [
      { piece: 'House_4', angle: 2.5, radius: 12.2, scale: 1.7, label: '炼金居' },
      { piece: 'Blacksmith', angle: -1.28, radius: 12.6, scale: 0.95, label: '炉房' },
    ],
    features: [
      { type: 'colorbeds', x: 9.4, z: 9.6, rows: 3 },
      { type: 'colorbeds', x: -9.6, z: 9.4, rows: 3 },
      { type: 'fungi', x: -10.4, z: -8.2, count: 9 },
      { type: 'vials', x: 6.4, z: -10.2 },
    ],
    palette: { bed: '#5f5568', flower: '#c9b7e6', accent: '#b79ad9' },
  },

  sheng: {
    name: '野花药圃',
    loopRadius: 13.6,
    border: { type: 'wildflowers', color: '#efd0d8' },
    hub: { x: 0, z: 3.4, radius: 2.6, shape: 'circle' },
    path: { surface: 'gravel', width: 1.8, color: '#9d8f74', shape: 'organic', sway: 3.2 },
    buildings: [
      { piece: 'Inn', angle: 2.64, radius: 12.8, scale: 0.6, label: '草木居' },
      { piece: 'Gazebo', angle: -1.44, radius: 11.6, scale: 0.9, label: '藤架亭' },
    ],
    features: [
      { type: 'wildflowers', x: 9.8, z: -8.8, radius: 5.2, count: 46 },
      { type: 'herbs', x: -9.6, z: 9.8, rows: 4 },
      { type: 'arbor', x: 0.6, z: 14.4 },
      { type: 'bigleaf', x: -12.4, z: -4.4, count: 6 },
    ],
    palette: { bed: '#4e6b4a', flower: '#f0c7cf', accent: '#8fbf87' },
  },

  ying: {
    name: '海风花园',
    loopRadius: 13.0,
    border: { type: 'lavender' },
    hub: { x: 0, z: 3.8, radius: 2.8, shape: 'circle' },
    path: { surface: 'plank', width: 2.1, color: '#a08a68', shape: 'boardwalk', sway: 1.2 },
    buildings: [
      { piece: 'Inn', angle: 2.5, radius: 12.0, scale: 0.64, label: '海员之家' },
      { piece: 'Bell_Tower', angle: -1.34, radius: 13.0, scale: 0.88, label: '望海塔' },
    ],
    features: [
      { type: 'roses', x: -9.8, z: -7.8, radius: 4.6 },
      { type: 'lavender', x: 9.6, z: 4.2, rows: 4 },
      { type: 'seabench', x: 2.6, z: 16.2 },
      { type: 'pickets', x: -6.4, z: 12.6, length: 7 },
    ],
    palette: { bed: '#5f6f68', flower: '#e9b7c6', accent: '#8fb7c9' },
  },

  gong: {
    name: '工坊菜圃',
    loopRadius: 12.8,
    border: { type: 'pots' },
    hub: { x: 0, z: 3.0, radius: 2.8, shape: 'square' },
    path: { surface: 'brick', width: 2.0, color: '#a08d70', shape: 'grid' },
    buildings: [
      { piece: 'Blacksmith', angle: 2.66, radius: 12.2, scale: 1.0, label: '百工炉' },
      { piece: 'Sawmill', angle: -1.36, radius: 12.8, scale: 1.4, label: '锯木坊' },
      { piece: 'MarketStand_1', angle: 0.44, radius: 8.6, scale: 1.5, label: '日用手作摊', kind: 'stall' },
    ],
    features: [
      { type: 'kitchen', x: -9.8, z: 9.4, rows: 4 },
      { type: 'pots', x: 9.2, z: -8.8, count: 7 },
      { type: 'timber', x: 12.6, z: 3.0 },
      { type: 'toolrack', x: 6.8, z: 10.8 },
    ],
    palette: { bed: '#6b5f4a', flower: '#d9c07a', accent: '#c9a05a' },
  },
};

/* ------------------------------------------------------------------ */
/* 小工具                                                              */
/* ------------------------------------------------------------------ */

function addBlocker(list, x, z, radius, type = 'garden') {
  list.push({ x, z, radius, type });
}

function clearanceAt(x, z, blockers, radius) {
  let best = Infinity;
  for (const blocker of blockers) {
    const gap = Math.hypot(x - blocker.x, z - blocker.z) - blocker.radius - radius;
    if (gap < best) best = gap;
  }
  return best;
}

function distanceToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSq = dx * dx + dz * dz || 1;
  let t = ((px - ax) * dx + (pz - az) * dz) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function distanceToPolyline(x, z, points) {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i += 1) {
    const d = distanceToSegment(x, z, points[i].x, points[i].z, points[i + 1].x, points[i + 1].z);
    if (d < best) best = d;
  }
  return best;
}

function textPlate(text, color = '#e8ddc0', border = 'rgba(232,221,192,.5)') {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 160, 220);
  ctx.strokeStyle = border;
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 140, 200);
  ctx.fillStyle = color;
  ctx.font = '600 74px "STKaiti", "KaiTi", "Songti SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  [...text].forEach((char, index) => {
    ctx.fillText(char, 80, 62 + index * 78);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  mat.userData.uniqueTexture = true;
  return new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), mat);
}

/* ------------------------------------------------------------------ */
/* 路径：从锚点生成曲线，再按每个岛的路面语法铺开                        */
/* ------------------------------------------------------------------ */

function sampleLine(from, to, spacing = 0.5) {
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  const count = Math.max(2, Math.ceil(distance / spacing));
  const points = [];
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    points.push({ x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t });
  }
  return points;
}

function sampleCurve(from, to, { sway = 2, wave = 1.2, seed = 1, spacing = 0.5 } = {}) {
  const rng = mulberry32(seed * 131 + 7);
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz) || 1;
  const nx = -dz / length;
  const nz = dx / length;
  const points = [];
  const steps = Math.max(8, Math.ceil(length / spacing));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const bell = Math.sin(t * Math.PI);
    const offset = bell * (Math.sin(t * Math.PI * wave + rng() * 0.15) * sway);
    points.push({
      x: from.x + dx * t + nx * offset,
      z: from.z + dz * t + nz * offset,
    });
  }
  return points;
}

function sampleAxis(from, to, spacing = 0.5) {
  // 曼哈顿：先沿 x 再沿 z，形成直角街
  const corner = { x: to.x, z: from.z };
  return [...sampleLine(from, corner, spacing), ...sampleLine(corner, to, spacing)];
}

function sampleZigzag(from, to, { sway = 2.4, spacing = 0.4 } = {}) {
  const base = sampleLine(from, to, spacing);
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz) || 1;
  const nx = -dz / length;
  const nz = dx / length;
  const period = Math.max(4, Math.round(base.length / 5));
  return base.map((point, index) => {
    const phase = Math.floor(index / period) % 2 === 0 ? 1 : -1;
    const ramp = Math.min(1, (index % period) / 1.4);
    return { x: point.x + nx * sway * phase * ramp, z: point.z + nz * sway * phase * ramp };
  });
}

function shapeRoute(from, to, shape, options = {}) {
  switch (shape) {
    case 'axis':
    case 'grid':
      return sampleAxis(from, to);
    case 'zigzag':
      return sampleZigzag(from, to, options);
    case 'radial':
      return sampleLine(from, to, 0.5);
    case 'boardwalk':
      return sampleCurve(from, to, { sway: 1.1, wave: 0.8, seed: options.seed ?? 3, spacing: 0.4 });
    case 'organic':
      return sampleCurve(from, to, { sway: options.sway ?? 3, wave: 1.7, seed: options.seed ?? 5 });
    case 'curve':
    default:
      return sampleCurve(from, to, { sway: options.sway ?? 2, wave: 1.2, seed: options.seed ?? 1 });
  }
}

function loopPoints(shape, hub, radius, seed) {
  const points = [];
  const rng = mulberry32(seed * 41 + 13);
  if (shape === 'axis' || shape === 'grid') {
    // 圆角矩形：数学/百工的庭院是「规划出来的」
    for (let i = 0; i <= 84; i += 1) {
      const a = (i / 84) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const nx = Math.sign(c) * Math.pow(Math.abs(c), 0.55);
      const nz = Math.sign(s) * Math.pow(Math.abs(s), 0.55);
      points.push({ x: hub.x + nx * radius * 1.02, z: hub.z + nz * radius * 0.86 });
    }
    return points;
  }
  if (shape === 'zigzag') {
    // 八边形：机巧峰的园路是「造出来的」
    const sides = 8;
    for (let i = 0; i <= sides * 6; i += 1) {
      const a = (i / (sides * 6)) * Math.PI * 2;
      const k = Math.round((a / (Math.PI * 2)) * sides) % sides;
      const angle = (k / sides) * Math.PI * 2 + Math.PI / sides;
      points.push({ x: hub.x + Math.cos(angle) * radius, z: hub.z + Math.sin(angle) * radius });
    }
    return points;
  }
  const wobbleAmp = shape === 'organic' ? 1.5 : shape === 'boardwalk' ? 0.5 : 0.9;
  const wobble = 2 + Math.floor(rng() * 2);
  for (let i = 0; i <= 96; i += 1) {
    const a = (i / 96) * Math.PI * 2;
    const r = radius + Math.sin(a * wobble + seed * 0.7) * wobbleAmp + Math.cos(a * 3.1) * 0.35;
    points.push({ x: hub.x + Math.cos(a) * r, z: hub.z + Math.sin(a) * r });
  }
  return points;
}

function nearestPoint(points, target) {
  let best = points[0];
  let bestDistance = Infinity;
  for (const point of points) {
    const d = Math.hypot(point.x - target.x, point.z - target.z);
    if (d < bestDistance) {
      bestDistance = d;
      best = point;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* 地面：草地 + 主题路面                                                */
/* ------------------------------------------------------------------ */

function createGardenGroundTexture({ radius, palette, plan, seed, size = 1024, grassPhoto = null }) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(seed * 19 + 5);
  const px = size / (radius * 2);
  const center = size / 2;
  const toX = (x) => center + x * px;
  const toY = (z) => center + z * px;

  const grass = palette.grass ?? '#7aa06a';
  const grassDeep = palette.grassDeep ?? '#4f7157';
  const grassDry = palette.grassDry ?? '#a8b878';
  const dirt = plan.palette?.bed ?? '#7c7057';

  ctx.fillStyle = grass;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 220; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    const r = (20 + rng() * 90) * (size / 1024);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, `rgba(${rng() > 0.5 ? '168,184,120' : '79,113,87'},${0.12 + rng() * 0.12})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (grassPhoto) {
    const tile = 13 * px;
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.globalCompositeOperation = 'overlay';
    for (let y = 0; y < size; y += tile) {
      for (let x = 0; x < size; x += tile) ctx.drawImage(grassPhoto, x, y, tile, tile);
    }
    ctx.restore();
  }

  // 草叶
  for (let i = 0; i < 14000; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    const h = (2 + rng() * 5) * (size / 1024);
    ctx.strokeStyle = `rgba(${rng() > 0.5 ? '79,113,87' : '160,178,120'},${0.16 + rng() * 0.26})`;
    ctx.lineWidth = Math.max(0.6, 0.9 * (size / 1024));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rng() - 0.5) * 2, y - h);
    ctx.stroke();
  }

  // 路面：先画一层宽而柔的土色，再压一层更亮的中心
  const drawPath = (points) => {
    if (points.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const widths = [plan.path.width * 1.45, plan.path.width, plan.path.width * 0.62];
    const colors = [`rgba(120,104,80,.30)`, `rgba(140,124,96,.55)`, `rgba(170,156,126,.45)`];
    widths.forEach((width, index) => {
      ctx.strokeStyle = colors[index];
      ctx.lineWidth = width * px;
      ctx.beginPath();
      points.forEach((point, i) => {
        if (i === 0) ctx.moveTo(toX(point.x), toY(point.z));
        else ctx.lineTo(toX(point.x), toY(point.z));
      });
      ctx.stroke();
    });
    ctx.restore();
  };
  plan.routes.forEach((route) => drawPath(route.points));

  // 中心庭院：圆形 / 方形 / 环形
  const hub = plan.hub;
  ctx.save();
  ctx.translate(toX(hub.x), toY(hub.z));
  if (hub.shape === 'square') {
    const half = hub.radius * px;
    const gradient = ctx.createRadialGradient(0, 0, half * 0.1, 0, 0, half * 1.4);
    gradient.addColorStop(0, 'rgba(186,176,152,.9)');
    gradient.addColorStop(0.7, 'rgba(160,150,128,.75)');
    gradient.addColorStop(1, 'rgba(150,140,118,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(-half * 1.2, -half * 1.2, half * 2.4, half * 2.4);
  } else if (hub.shape === 'ring') {
    ctx.strokeStyle = 'rgba(176,164,138,.75)';
    ctx.lineWidth = hub.radius * 0.34 * px;
    ctx.beginPath();
    ctx.arc(0, 0, hub.radius * px * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(150,160,120,.55)';
    ctx.beginPath();
    ctx.arc(0, 0, hub.radius * px * 0.42, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const gradient = ctx.createRadialGradient(0, 0, hub.radius * px * 0.1, 0, 0, hub.radius * px);
    gradient.addColorStop(0, 'rgba(186,176,152,.92)');
    gradient.addColorStop(0.72, 'rgba(160,150,128,.78)');
    gradient.addColorStop(1, 'rgba(150,140,118,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, hub.radius * px, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 路面碎石
  for (let i = 0; i < 700; i += 1) {
    const route = plan.routes[Math.floor(rng() * plan.routes.length)];
    if (!route) break;
    const point = route.points[Math.floor(rng() * route.points.length)];
    if (!point) break;
    const angle = rng() * Math.PI * 2;
    const dist = rng() * plan.path.width * 0.75;
    ctx.fillStyle = `rgba(${rng() > 0.5 ? '150,144,130' : '110,104,92'},${0.18 + rng() * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(
      toX(point.x + Math.cos(angle) * dist),
      toY(point.z + Math.sin(angle) * dist),
      (1.2 + rng() * 2.6) * (size / 1024),
      (0.9 + rng() * 1.8) * (size / 1024),
      rng() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // 沙滩过渡
  const sandColor = palette.sand ?? '#e3c990';
  const sandGradient = ctx.createRadialGradient(center, center, radius * px * 0.82, center, center, radius * px);
  sandGradient.addColorStop(0, 'rgba(227,201,144,0)');
  sandGradient.addColorStop(0.5, 'rgba(227,201,144,.5)');
  sandGradient.addColorStop(1, 'rgba(227,201,144,.95)');
  ctx.fillStyle = sandGradient;
  ctx.beginPath();
  ctx.arc(center, center, radius * px, 0, Math.PI * 2);
  ctx.fill();

  // 边缘羽化
  ctx.globalCompositeOperation = 'destination-out';
  const fade = ctx.createRadialGradient(center, center, radius * px * 0.9, center, center, radius * px);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createGardenGround({ radius, palette, plan, seed, grassPhoto }) {
  const texture = createGardenGroundTexture({ radius, palette, plan, seed, grassPhoto });
  const surface = getSurface('grass', 1);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 96),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.96,
      metalness: 0,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      bumpMap: surface?.bump ?? null,
      bumpScale: 0.02,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND_Y + 0.012;
  ground.receiveShadow = true;
  ground.renderOrder = 1;
  ground.name = 'garden-ground';
  return ground;
}

/* ------------------------------------------------------------------ */
/* 路面构件                                                            */
/* ------------------------------------------------------------------ */

const SURFACES = {
  stone: () => material('#a3a094', { roughness: 0.95, texture: 'stone', bumpScale: 0.06 }),
  stoneDark: () => material('#8b887c', { roughness: 0.96, texture: 'stone', bumpScale: 0.07 }),
  plank: () => material('#9c7c56', { roughness: 0.9, texture: 'wood', bumpScale: 0.04 }),
  brick: () => material('#a58c74', { roughness: 0.95, texture: 'stone', bumpScale: 0.05 }),
  gravel: () => material('#9a9484', { roughness: 1 }),
};

function stepPiece(style, tangent, rng) {
  switch (style) {
    case 'stepping':
      return {
        geometry: new THREE.CylinderGeometry(0.52 + rng() * 0.12, 0.56, 0.08, 7),
        material: SURFACES.stone(),
        rotation: [0, rng() * Math.PI, 0],
        scale: [1 + rng() * 0.25, 1, 0.86 + rng() * 0.2],
      };
    case 'slab':
      return {
        geometry: new THREE.BoxGeometry(0.98 + rng() * 0.16, 0.08, 0.78 + rng() * 0.12),
        material: SURFACES.stoneDark(),
        rotation: [0, tangent + (rng() - 0.5) * 0.06, 0],
        scale: [1, 1, 1],
      };
    case 'tile':
      return {
        geometry: new THREE.BoxGeometry(0.78, 0.06, 0.78),
        material: SURFACES.stone(),
        rotation: [0, Math.floor(rng() * 4) * (Math.PI / 2), 0],
        scale: [1, 1, 1],
      };
    case 'brick':
      return {
        geometry: new THREE.BoxGeometry(0.42, 0.07, 0.3),
        material: SURFACES.brick(),
        rotation: [0, tangent + (rng() - 0.5) * 0.1, 0],
        scale: [1, 1, 1],
      };
    case 'plank':
      return {
        geometry: new THREE.BoxGeometry(0.36, 0.09, 1, 1),
        material: SURFACES.plank(),
        rotation: [0, tangent + Math.PI / 2, 0],
        scale: [1, 1, 1],
      };
    case 'gravel':
      return {
        geometry: new THREE.DodecahedronGeometry(0.09 + rng() * 0.05, 0),
        material: SURFACES.gravel(),
        rotation: [rng(), rng() * 3, rng()],
        scale: [1, 0.55, 1],
      };
    default:
      return null;
  }
}

function layPath(parent, points, { style, width = 2, seed = 1, plants = null }) {
  const rng = mulberry32(seed * 71 + 9);
  const group3d = new THREE.Group();
  group3d.name = `path-${style}`;
  const spacing = style === 'gravel' ? 0.34 : style === 'brick' ? 0.5 : style === 'plank' ? 0.44 : 0.92;
  let travelled = 0;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const current = points[i];
    const segment = Math.hypot(current.x - prev.x, current.z - prev.z);
    travelled += segment;
    if (travelled < spacing) continue;
    travelled = 0;
    const tangent = Math.atan2(current.x - prev.x, current.z - prev.z);
    if (style === 'plank') {
      // 栈道：横向木板，中间留缝
      const piece = stepPiece(style, tangent, rng);
      const board = mesh(group3d, piece.geometry, piece.material, [current.x, GROUND_Y + 0.05, current.z], piece.rotation);
      board.scale.set(width / 2.1, 1, 1);
      continue;
    }
    if (style === 'brick') {
      // 砖路：沿宽度铺三列
      for (let lane = -1; lane <= 1; lane += 1) {
        const offset = lane * 0.34;
        const nx = Math.cos(tangent) * offset;
        const nz = -Math.sin(tangent) * offset;
        const piece = stepPiece(style, tangent, rng);
        mesh(group3d, piece.geometry, piece.material, [current.x + nx, GROUND_Y + 0.035, current.z + nz], piece.rotation, piece.scale);
      }
      continue;
    }
    if (style === 'gravel') {
      const count = 3;
      for (let n = 0; n < count; n += 1) {
        const angle = rng() * Math.PI * 2;
        const dist = rng() * width * 0.6;
        const piece = stepPiece(style, tangent, rng);
        mesh(group3d, piece.geometry, piece.material, [current.x + Math.cos(angle) * dist, GROUND_Y + 0.03, current.z + Math.sin(angle) * dist], piece.rotation, piece.scale);
      }
      continue;
    }
    if (plants && (style === 'stepping' || style === 'tile')) {
      plants.add(style === 'tile' ? 'RockPath_Square_Wide' : 'RockPath_Round_Wide', {
        x: current.x,
        z: current.z,
        scale: width * (style === 'tile' ? 0.52 : 0.5),
        rotation: tangent,
      });
      continue;
    }
    const piece = stepPiece(style, tangent, rng);
    if (!piece) continue;
    if (style === 'tile') {
      // 石板：以网格对齐，边缘会自然参差
      const gx = Math.round(current.x / 0.8) * 0.8;
      const gz = Math.round(current.z / 0.8) * 0.8;
      if (Math.hypot(gx - current.x, gz - current.z) > 0.36) continue;
      mesh(group3d, piece.geometry, piece.material, [gx, GROUND_Y + 0.035, gz], piece.rotation, piece.scale);
      continue;
    }
    mesh(group3d, piece.geometry, piece.material, [current.x, GROUND_Y + 0.04, current.z], piece.rotation, piece.scale);
  }
  const merged = mergeByMaterial(group3d, { name: `path-${style}-merged`, castShadow: false });
  parent.add(merged);
  return merged;
}

/* ------------------------------------------------------------------ */
/* 花园构件：植物全部来自 Ultimate Stylized Nature / MegaKit 的模型      */
/* ------------------------------------------------------------------ */

function buildZen(parent, feature, seed, plants) {
  const { x, z, radius } = feature;
  const root = group(parent, [x, GROUND_Y, z]);
  // 白砂与耙纹是「地面做法」，不是植物
  const sand = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 48),
    new THREE.MeshStandardMaterial({ color: '#e6e2d2', roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = 0.04;
  sand.receiveShadow = true;
  root.add(sand);
  for (let i = 1; i <= 7; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * (i / 8), radius * (i / 8) + 0.035, 64),
      new THREE.MeshBasicMaterial({ color: '#cfc9b6', transparent: true, opacity: 0.75, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.045;
    root.add(ring);
  }
  // 三块苔石：石头与苔藓都用模型
  [[-1.1, 0.4, 1.1], [0.9, -0.7, 1.3], [0.3, 1.1, 0.9]].forEach(([ox, oz, scale], index) => {
    addRock(root, { x: ox, z: oz, y: 0.02, key: PLANT_KEYS.rock[index % 3], scale: scale * 0.55, rotation: index * 1.4 });
    plants.patch({ x: x + ox, z: z + oz, radius: 0.55, count: 7, keys: ['Clover_1', 'Clover_2'], height: 0.12, tint: '#6f8a5c', seed: seed + index });
  });
  // 竹篱
  const fence = group(root, [0, 0, 0], [0, 0.2, 0]);
  const count = 18;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const fx = Math.cos(angle) * (radius + 0.55);
    const fz = Math.sin(angle) * (radius + 0.55);
    if (fx > radius * 0.2 && Math.abs(fz) < radius * 0.55) continue;
    mesh(fence, new THREE.CylinderGeometry(0.035, 0.045, 0.85, 4), M.bark('#7d6446'), [fx, 0.42, fz]);
    mesh(fence, new THREE.CylinderGeometry(0.018, 0.018, 0.9, 4), material('#b39a6e', { roughness: 1 }), [fx, 0.62, fz], [0, 0, Math.PI / 2], [1, 1, 1], false);
  }
  return root;
}

function buildGrove(parent, feature, seed, plants) {
  const { x, z, radius = 5, count = 3, treeKeys = [], understory = true } = feature;
  const root = group(parent, [x, GROUND_Y, z]);
  const rng = mulberry32(seed * 29 + 7);
  // 树只放 3 棵：一棵主树 + 两棵陪衬，避免「一坨树」拖慢加载
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + rng() * 0.7;
    const dist = i === 0 ? 0 : radius * (0.55 + rng() * 0.25);
    const tree = nature.create(treeKeys[i % Math.max(1, treeKeys.length)] ?? 'BirchTree_1', {
      scale: (i === 0 ? 0.9 : 0.66) + rng() * 0.12,
      rotation: rng() * Math.PI * 2,
    });
    if (!tree) continue;
    tree.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
    root.add(tree);
  }
  if (understory) {
    plants.patch({ x, z, radius: radius * 0.85, count: 10, keys: PLANT_KEYS.foliage, height: 0.42, seed: seed + 4 });
    plants.patch({ x, z, radius: radius * 0.6, count: 4, keys: PLANT_KEYS.bush, height: 0.7, seed: seed + 8 });
  }
  return root;
}

function buildSteles(parent, feature, seed, plants) {
  const root = group(parent, [feature.x, GROUND_Y, feature.z]);
  const glyphs = feature.glyphs ?? ['诗', '书', '礼', '乐', '墨'];
  const count = feature.count ?? 4;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 1.2 - 0.4;
    const dist = 0.9 + (i % 2) * 0.7;
    const sx = Math.cos(angle) * dist;
    const sz = Math.sin(angle) * dist;
    const stele = mesh(root, new THREE.BoxGeometry(0.62, 1.7 + (i % 3) * 0.2, 0.22), material('#8f9186', { roughness: 0.94, texture: 'stone', bumpScale: 0.07 }), [sx, 0.85, sz], [0.02, angle, 0.02]);
    stele.castShadow = true;
    const plate = textPlate(glyphs[i % glyphs.length]);
    plate.position.set(0, 0.16, 0.13);
    stele.add(plate);
    mesh(root, new THREE.BoxGeometry(0.8, 0.16, 0.44), material('#7f8177', { roughness: 0.96, texture: 'stone' }), [sx, 0.08, sz]);
  }
  plants.patch({ x: feature.x, z: feature.z, radius: 2.2, count: 6, keys: PLANT_KEYS.foliage, height: 0.36, tint: '#5f7a54', seed: seed + 2 });
  return root;
}

function buildPond(parent, feature, seed, plants) {
  const root = group(parent, [feature.x, GROUND_Y, feature.z]);
  const radius = feature.radius ?? 2.2;
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 40),
    new THREE.MeshStandardMaterial({ color: '#2f4f4b', roughness: 0.15, metalness: 0.25, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.05;
  root.add(water);
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2;
    plants.add(PLANT_KEYS.rock[i % 3], {
      x: feature.x + Math.cos(angle) * (radius + 0.18),
      z: feature.z + Math.sin(angle) * (radius + 0.18),
      scale: 0.4 + (i % 3) * 0.16,
      rotation: angle,
    });
  }
  // 岸边芦苇与苔草
  plants.patch({ x: feature.x + radius * 0.7, z: feature.z + radius * 0.45, radius: 0.9, count: 8, keys: ['Grass_Common_Tall', 'Plant_1'], height: 0.75, seed: seed + 5 });
  plants.patch({ x: feature.x - radius * 0.5, z: feature.z - radius * 0.6, radius: 0.7, count: 5, keys: ['Grass_Common_Short'], height: 0.3, seed: seed + 6 });
  return root;
}

function buildParterre(parent, feature, seed, plants) {
  const { x, z, size = 3, count = 4 } = feature;
  const root = group(parent, [x, GROUND_Y, z]);
  const half = size / 2;
  for (let i = 0; i < count; i += 1) {
    const gx = (i % 2 === 0 ? -1 : 1) * (half + 0.25);
    const gz = (i < 2 ? -1 : 1) * (half + 0.25);
    const bed = group(root, [gx, 0, gz]);
    mesh(bed, new THREE.BoxGeometry(size - 0.35, 0.14, size - 0.35), material('#6b5a44', { roughness: 1, texture: 'soil', bumpScale: 0.05 }), [0, 0.06, 0]);
    // 四角用黄杨球（Bush_Small）当「绿篱角」，中间是花
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      plants.add('Bush_Small', {
        x: x + gx + sx * (size - 0.7) / 2,
        z: z + gz + sz * (size - 0.7) / 2,
        height: 0.55,
        rotation: 0,
      });
    });
    flowerBed(plants, {
      x: x + gx,
      z: z + gz,
      radius: (size - 1.1) / 2,
      flowers: 10,
      foliage: 4,
      tint: ['#e8d68d', '#e7c0c6', '#cfd8ef'][i % 3],
      seed: seed + i * 3,
    });
  }
  return root;
}

function buildSundial(parent, feature, seed, plants) {
  const root = group(parent, [feature.x, GROUND_Y, feature.z]);
  mesh(root, new THREE.CylinderGeometry(0.95, 1.05, 0.18, 8), material('#b6ae98', { roughness: 0.9, texture: 'stone' }), [0, 0.09, 0]);
  mesh(root, new THREE.CylinderGeometry(0.72, 0.72, 0.1, 16), material('#d8cfae', { roughness: 0.55, metalness: 0.3 }), [0, 0.2, 0]);
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    mesh(root, new THREE.BoxGeometry(0.06, 0.015, 0.16), material('#6c6552', { roughness: 0.8 }), [Math.cos(angle) * 0.52, 0.26, Math.sin(angle) * 0.52], [0, -angle, 0]);
  }
  const gnomon = mesh(root, new THREE.ConeGeometry(0.09, 0.92, 3), material('#c9a05a', { metalness: 0.6, roughness: 0.3 }), [0, 0.55, 0], [0, 0, 0], [1, 1, 0.45]);
  gnomon.rotation.y = 0.6;
  plants.patch({ x: feature.x, z: feature.z, radius: 1.9, count: 8, keys: PLANT_KEYS.flowerSingle, height: 0.4, seed: seed + 1, innerRadius: 1.15 });
  return root;
}

function buildHedgewalk(parent, feature, seed, plants) {
  const root = group(parent, [feature.x, GROUND_Y, feature.z]);
  const length = feature.length ?? 8;
  for (const side of [-1.0, 1.0]) {
    plants.row({
      from: { x: feature.x - length / 2, z: feature.z + side },
      to: { x: feature.x + length / 2, z: feature.z + side },
      count: 7,
      keys: ['Bush_Small'],
      height: 0.55,
      seed: seed + side,
    });
  }
  for (let i = 0; i < 4; i += 1) {
    const offset = (i - 1.5) * (length / 4.6);
    mesh(root, new THREE.CylinderGeometry(0.22, 0.26, 0.34, 8), material('#b9b09a', { roughness: 0.9, texture: 'stone' }), [offset, 0.17, 1.55]);
    plants.patch({ x: feature.x + offset, z: feature.z + 1.55, radius: 0.35, count: 4, keys: PLANT_KEYS.flowerSingle, height: 0.42, seed: seed + i });
  }
  return root;
}

function buildRockgarden(parent, feature, seed, plants) {
  const root = group(parent, [feature.x, GROUND_Y, feature.z]);
  const radius = feature.radius ?? 4;
  const gravel = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 40),
    new THREE.MeshStandardMaterial({ color: '#b3ada0', roughness: 1 }),
  );
  gravel.rotation.x = -Math.PI / 2;
  gravel.position.y = 0.04;
  root.add(gravel);
  rockPatch(plants, { x: feature.x, z: feature.z, radius: radius * 0.6, count: 5, seed, scale: [0.7, 1.5] });
  plants.patch({ x: feature.x, z: feature.z, radius: radius * 0.9, count: 10, keys: ['Grass_Common_Short', 'Clover_1'], height: 0.22, seed: seed + 3 });
  return root;
}

function buildChimes(parent, feature, seed, plants) {
  const root = group(parent, [feature.x, GROUND_Y, feature.z]);
  const count = feature.count ?? 3;
  mesh(root, new THREE.BoxGeometry(2.4, 0.1, 0.12), M.woodDark(), [0, 2.1, 0]);
  [-1.15, 1.15].forEach((x) => mesh(root, new THREE.BoxGeometry(0.12, 2.15, 0.12), M.woodDark(), [x, 1.05, 0]));
  for (let i = 0; i < count; i += 1) {
    const x = (i - (count - 1) / 2) * 0.55;
    const length = 0.7 + i * 0.18;
    mesh(root, new THREE.CylinderGeometry(0.035, 0.035, length, 8, 1, true), material('#b9b3a2', { metalness: 0.65, roughness: 0.32, side: THREE.DoubleSide }), [x, 2.05 - length / 2, 0]);
    mesh(root, new THREE.SphereGeometry(0.05, 6, 5), material('#8d8677', { metalness: 0.6, roughness: 0.4 }), [x, 2.0 - length, 0]);
  }
  plants.patch({ x: feature.x, z: feature.z, radius: 1.5, count: 6, keys: ['Grass_Common_Tall'], height: 0.4, seed: seed + 2 });
  return root;
}

function buildGears(parent, feature, seed, plants) {
  const root = group(parent, [feature.x, GROUND_Y, feature.z]);
  const gearMat = material('#b08a58', { metalness: 0.55, roughness: 0.42 });
  const big = group(root, [0, 1.1, 0], [0.1, 0.4, 0]);
  mesh(big, new THREE.TorusGeometry(0.7, 0.12, 6, 18), gearMat);
  for (let i = 0; i < 10; i += 1) {
    mesh(big, new THREE.BoxGeometry(0.18, 0.3, 0.16), gearMat, [Math.cos((i / 10) * Math.PI * 2) * 0.76, Math.sin((i / 10) * Math.PI * 2) * 0.76, 0], [0, 0, (i / 10) * Math.PI * 2]);
  }
  const small = group(root, [1.1, 0.7, 0.2], [0.1, 0.9, 0]);
  mesh(small, new THREE.TorusGeometry(0.42, 0.09, 6, 16), gearMat);
  for (let i = 0; i < 8; i += 1) {
    mesh(small, new THREE.BoxGeometry(0.13, 0.22, 0.12), gearMat, [Math.cos((i / 8) * Math.PI * 2) * 0.46, Math.sin((i / 8) * Math.PI * 2) * 0.46, 0], [0, 0, (i / 8) * Math.PI * 2]);
  }
  mesh(root, new THREE.CylinderGeometry(0.5, 0.6, 0.3, 8), material('#8f8b7d', { texture: 'stone', roughness: 0.95 }), [0, 0.15, 0]);
  plants.patch({ x: feature.x, z: feature.z, radius: 1.8, count: 6, keys: ['Grass_Common_Tall', 'Clover_1'], height: 0.28, seed: seed + 4 });
  root.userData.tick = (t) => {
    big.rotation.z = t * 0.12;
    small.rotation.z = -t * 0.2;
  };
  return root;
}

function buildColorbeds(parent, feature, seed, plants) {
  const { x, z, rows = 3 } = feature;
  const root = group(parent, [x, GROUND_Y, z]);
  const colors = ['#d98fb0', '#9fc7e8', '#e8d68d', '#c6a8e0'];
  for (let row = 0; row < rows; row += 1) {
    const rz = (row - (rows - 1) / 2) * 1.35;
    mesh(root, new THREE.BoxGeometry(4.6, 0.14, 0.8), material('#6a5a48', { roughness: 1, texture: 'soil', bumpScale: 0.05 }), [0, 0.06, rz]);
    for (let i = 0; i < 4; i += 1) {
      plants.patch({
        x: x - 1.7 + i * 1.15,
        z: z + rz,
        radius: 0.42,
        count: 5,
        keys: PLANT_KEYS.flower,
        height: 0.46,
        tint: colors[(row + i) % colors.length],
        seed: seed + row * 9 + i,
      });
    }
    mesh(root, new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), material('#cfe6e0', { transparent: true, opacity: 0.45, roughness: 0.1 }), [2.5, 0.3, rz], [0, 0, 0.06], [1, 1, 1], false);
    mesh(root, new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), material(colors[row % colors.length], { emissive: colors[row % colors.length], emissiveIntensity: 0.5, transparent: true, opacity: 0.85 }), [2.5, 0.2, rz], [0, 0, 0.06], [1, 1, 1], false);
  }
  return root;
}

function buildFungi(parent, feature, seed, plants) {
  const root = group(parent, [feature.x, GROUND_Y, feature.z]);
  plants.patch({ x: feature.x, z: feature.z, radius: 3.0, count: feature.count ?? 8, keys: ['Mushroom_Common'], height: 0.55, seed: seed + 1 });
  plants.patch({ x: feature.x, z: feature.z, radius: 2.6, count: 6, keys: PLANT_KEYS.foliage, height: 0.3, seed: seed + 2 });
  return root;
}

function buildVials(parent, feature, seed, plants) {
  const root = group(parent, [feature.x, GROUND_Y, feature.z]);
  const glass = material('#d5ebe6', { transparent: true, opacity: 0.42, roughness: 0.12, metalness: 0.05 });
  const colors = ['#8fd8c9', '#c6a8e0', '#e8c98d'];
  for (let i = 0; i < 3; i += 1) {
    const x = (i - 1) * 0.65;
    mesh(root, new THREE.CylinderGeometry(0.24, 0.16, 0.5, 10), glass, [x, 0.25, 0], [0, 0, 0], [1, 1, 1], false);
    mesh(root, new THREE.SphereGeometry(0.26, 10, 7), glass, [x, 0.56, 0], [0, 0, 0], [1, 0.9, 1], false);
    mesh(root, new THREE.CylinderGeometry(0.1, 0.1, 0.26, 8), glass, [x, 0.86, 0], [0, 0, 0], [1, 1, 1], false);
    mesh(root, new THREE.SphereGeometry(0.2, 10, 7), material(colors[i], { emissive: colors[i], emissiveIntensity: 0.35, transparent: true, opacity: 0.9 }), [x, 0.22, 0], [0, 0, 0], [1, 0.55, 1], false);
    const glow = glowSprite(colors[i], 0.8, 0.3);
    glow.position.set(x, 0.4, 0);
    root.add(glow);
  }
  mesh(root, new THREE.CylinderGeometry(1.0, 1.08, 0.16, 8), material('#8d8578', { texture: 'stone', roughness: 0.95 }), [0, 0.08, 0]);
  plants.patch({ x: feature.x, z: feature.z, radius: 1.6, count: 5, keys: PLANT_KEYS.flowerSingle, height: 0.42, tint: '#c6a8e0', seed: seed + 3 });
  return root;
}

function buildWildflowers(parent, feature, seed, plants) {
  const { x, z, radius = 4.5, count = 24 } = feature;
  const root = group(parent, [x, GROUND_Y, z]);
  plants.patch({ x, z, radius, count, keys: PLANT_KEYS.flower, height: 0.4, seed: seed + 2 });
  plants.patch({ x, z, radius: radius * 0.9, count: 8, keys: PLANT_KEYS.foliage, height: 0.3, seed: seed + 3 });
  plants.patch({ x, z, radius: radius * 0.75, count: 3, keys: PLANT_KEYS.bush, height: 0.6, seed: seed + 4 });
  return root;
}

function buildHerbs(parent, feature, seed, plants) {
  const { x, z, rows = 4 } = feature;
  const root = group(parent, [x, GROUND_Y, z]);
  for (let row = 0; row < rows; row += 1) {
    const rz = (row - (rows - 1) / 2) * 1.15;
    mesh(root, new THREE.BoxGeometry(4.0, 0.15, 0.7), material('#5d4c38', { roughness: 1, texture: 'soil', bumpScale: 0.05 }), [0, 0.07, rz]);
    for (let i = 0; i < 6; i += 1) {
      plants.add(row % 2 ? 'Plant_1' : 'Clover_1', {
        x: x - 1.65 + i * 0.66,
        z: z + rz,
        height: 0.4,
        rotation: (i % 2 ? 0.3 : -0.2),
        tint: row % 2 ? '#8fb86a' : null,
      });
    }
  }
  return root;
}

function buildArbor(parent, feature, seed, plants) {
  const root = group(parent, [feature.x, GROUND_Y, feature.z]);
  const arch = group(root, [0, 0, 0]);
  [-1.3, 1.3].forEach((x) => mesh(arch, new THREE.CylinderGeometry(0.07, 0.09, 2.4, 6), M.woodDark(), [x, 1.2, 0]));
  const top = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.07, 6, 16, Math.PI), M.woodDark());
  top.position.y = 2.4;
  arch.add(top);
  // 藤蔓由模型攀在两侧，不再用球体拼
  for (const side of [-1.25, 1.25]) {
    plants.patch({ x: feature.x + side, z: feature.z, radius: 0.5, count: 4, keys: ['Fern_1', 'Plant_1_Big'], height: 0.9, seed: seed + side });
  }
  plants.patch({ x: feature.x, z: feature.z, radius: 1.5, count: 5, keys: PLANT_KEYS.flowerSingle, height: 0.4, seed: seed + 5 });
  return root;
}

function buildBigleaf(parent, feature, seed, plants) {
  const root = group(parent, [feature.x, GROUND_Y, feature.z]);
  const rng = mulberry32(seed * 11 + 2);
  for (let i = 0; i < (feature.count ?? 3); i += 1) {
    const angle = rng() * Math.PI * 2;
    const dist = Math.sqrt(rng()) * 2.2;
    const plant = jungleLike(rng, 0.55 + rng() * 0.3);
    if (!plant) continue;
    plant.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
    root.add(plant);
  }
  return root;
}

function buildRoses(parent, feature, seed, plants) {
  const { x, z, radius = 4 } = feature;
  const root = group(parent, [x, GROUND_Y, z]);
  for (let i = 0; i < 14; i += 1) {
    const angle = (i / 14) * Math.PI * 2;
    const fx = Math.cos(angle) * radius;
    const fz = Math.sin(angle) * radius;
    mesh(root, new THREE.BoxGeometry(0.08, 0.62, 0.08), material('#e6e0cf', { roughness: 0.9 }), [fx, 0.31, fz]);
    mesh(root, new THREE.BoxGeometry(0.5, 0.07, 0.05), material('#e6e0cf', { roughness: 0.9 }), [fx, 0.42, fz], [0, -angle + Math.PI / 2, 0]);
  }
  // 玫瑰：带花的 Bush 模型 + 一圈花
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2 + 0.3;
    const dist = radius * 0.5;
    plants.add('Bush_Flowers', {
      x: x + Math.cos(angle) * dist,
      z: z + Math.sin(angle) * dist,
      height: 0.9,
      rotation: angle,
    });
  }
  plants.patch({ x, z, radius: radius * 0.7, count: 12, keys: PLANT_KEYS.flower, height: 0.42, tint: '#e6a2b2', seed: seed + 2 });
  mesh(root, new THREE.BoxGeometry(1.5, 0.1, 0.42), M.woodLight(), [0, 0.45, radius + 0.5]);
  [-0.6, 0.6].forEach((bx) => mesh(root, new THREE.BoxGeometry(0.1, 0.45, 0.36), M.woodDark(), [bx, 0.22, radius + 0.5]));
  return root;
}

function buildLavender(parent, feature, seed, plants) {
  const { x, z, rows = 4 } = feature;
  const root = group(parent, [x, GROUND_Y, z]);
  for (let row = 0; row < rows; row += 1) {
    const rz = (row - (rows - 1) / 2) * 0.9;
    plants.row({
      from: { x: x - 1.8, z: z + rz },
      to: { x: x + 1.8, z: z + rz },
      count: 7,
      keys: ['Flower_3_Single', 'Flower_4_Single'],
      height: 0.55,
      tint: '#9a86c8',
      seed: seed + row,
    });
  }
  return root;
}

function buildSeabench(parent, feature, seed, plants) {
  const root = group(parent, [feature.x, GROUND_Y, feature.z]);
  mesh(root, new THREE.BoxGeometry(1.8, 0.1, 0.45), M.woodLight(), [0, 0.46, 0]);
  mesh(root, new THREE.BoxGeometry(1.8, 0.1, 0.36), M.woodLight(), [0, 0.8, -0.24], [0.16, 0, 0]);
  [-0.75, 0.75].forEach((x) => mesh(root, new THREE.BoxGeometry(0.1, 0.46, 0.4), M.woodDark(), [x, 0.23, 0]));
  const lantern = group(root, [1.15, 0, 0]);
  mesh(lantern, new THREE.CylinderGeometry(0.06, 0.08, 1.7, 5), M.woodDark(), [0, 0.85, 0]);
  mesh(lantern, new THREE.CylinderGeometry(0.16, 0.2, 0.3, 6), material('#ffd49a', { emissive: '#ffb765', emissiveIntensity: 1.4, transparent: true, opacity: 0.9 }), [0, 1.75, 0]);
  const glow = glowSprite('#ffc98a', 1.2, 0.4);
  glow.position.set(0, 1.75, 0);
  lantern.add(glow);
  plants.patch({ x: feature.x, z: feature.z, radius: 1.5, count: 5, keys: ['Grass_Common_Short'], height: 0.22, seed: seed + 1 });
  return root;
}

function buildPickets(parent, feature, seed, plants) {
  const root = group(parent, [feature.x, GROUND_Y, feature.z]);
  const length = feature.length ?? 6;
  const count = Math.round(length / 0.42);
  for (let i = 0; i < count; i += 1) {
    const px = (i - (count - 1) / 2) * 0.42;
    mesh(root, new THREE.BoxGeometry(0.07, 0.66, 0.07), material('#ece6d5', { roughness: 0.9 }), [px, 0.33, 0]);
    mesh(root, new THREE.ConeGeometry(0.05, 0.1, 4), material('#ece6d5', { roughness: 0.9 }), [px, 0.7, 0], [0, Math.PI / 4, 0]);
  }
  mesh(root, new THREE.BoxGeometry(length, 0.07, 0.05), material('#e6e0cf', { roughness: 0.9 }), [0, 0.46, 0]);
  plants.patch({
    x: feature.x,
    z: feature.z - 0.8,
    radius: length * 0.32,
    count: 7,
    keys: PLANT_KEYS.flower,
    height: 0.42,
    tint: '#e9b7c6',
    seed: seed + 2,
  });
  return root;
}

function buildKitchen(parent, feature, seed, plants) {
  const { x, z, rows = 4 } = feature;
  const root = group(parent, [x, GROUND_Y, z]);
  for (let row = 0; row < rows; row += 1) {
    const rz = (row - (rows - 1) / 2) * 1.2;
    mesh(root, new THREE.BoxGeometry(4.4, 0.16, 0.8), material('#5f4c38', { roughness: 1, texture: 'soil', bumpScale: 0.06 }), [0, 0.07, rz]);
    for (let i = 0; i < 6; i += 1) {
      plants.add('Bush_Small', {
        x: x - 1.85 + i * 0.74,
        z: z + rz,
        height: 0.34,
        rotation: i * 0.7,
        tint: i % 3 ? '#7da85f' : '#95b86a',
      });
    }
  }
  mesh(root, new THREE.BoxGeometry(0.6, 0.5, 0.5), M.woodLight(), [2.9, 0.25, 0.4], [0, 0.3, 0]);
  mesh(root, new THREE.CylinderGeometry(0.18, 0.24, 0.34, 8), material('#8f8b7d', { roughness: 0.7, metalness: 0.3 }), [2.7, 0.17, -0.6]);
  return root;
}

function buildPots(parent, feature, seed, plants) {
  const root = group(parent, [feature.x, GROUND_Y, feature.z]);
  const rng = mulberry32(seed * 23 + 5);
  for (let i = 0; i < (feature.count ?? 6); i += 1) {
    const angle = rng() * Math.PI * 2;
    const dist = Math.sqrt(rng()) * 2.2;
    const px = Math.cos(angle) * dist;
    const pz = Math.sin(angle) * dist;
    const scale = 0.7 + rng() * 0.7;
    mesh(root, new THREE.CylinderGeometry(0.26 * scale, 0.2 * scale, 0.36 * scale, 10), material('#9c5f4b', { texture: 'stone', roughness: 0.9 }), [px, 0.18 * scale, pz]);
    plants.add('Clover_1', { x: feature.x + px, z: feature.z + pz, height: 0.3 * scale, rotation: rng() * 3 });
  }
  return root;
}

function buildTimber(parent, feature, seed, plants) {
  const root = group(parent, [feature.x, GROUND_Y, feature.z]);
  for (let row = 0; row < 3; row += 1) {
    for (let i = 0; i < 3 - row; i += 1) {
      mesh(
        root,
        new THREE.CylinderGeometry(0.14, 0.14, 1.6, 7),
        M.bark(row % 2 ? '#6b4f38' : '#7a5b40'),
        [(i - (2 - row) / 2) * 0.3, 0.15 + row * 0.26, 0],
        [0, 0, Math.PI / 2],
      );
    }
  }
  mesh(root, new THREE.BoxGeometry(1.9, 0.12, 0.5), M.woodDark(), [0, 0.06, 0.62]);
  plants.patch({ x: feature.x, z: feature.z, radius: 1.4, count: 4, keys: ['Grass_Common_Short'], height: 0.2, seed: seed + 1 });
  return root;
}

function buildToolrack(parent, feature, seed, plants) {
  const root = group(parent, [feature.x, GROUND_Y, feature.z]);
  mesh(root, new THREE.BoxGeometry(2.0, 0.1, 0.12), M.woodDark(), [0, 1.7, 0]);
  [-0.9, 0.9].forEach((x) => mesh(root, new THREE.BoxGeometry(0.12, 1.75, 0.12), M.woodDark(), [x, 0.87, 0]));
  for (let i = 0; i < 4; i += 1) {
    const x = -0.66 + i * 0.44;
    mesh(root, new THREE.CylinderGeometry(0.03, 0.03, 0.8, 5), M.woodLight(), [x, 1.28, 0]);
    mesh(root, new THREE.BoxGeometry(0.2, 0.14, 0.06), material('#9aa3a0', { metalness: 0.6, roughness: 0.4 }), [x, 1.72, 0], [0, 0, i % 2 ? 0.3 : -0.2]);
  }
  return root;
}

function dressBorders(parent, plan, scheme, seed, plants) {
  const rng = mulberry32(seed * 59 + 17);
  const palette = plan.palette ?? {};
  const border = scheme.border ?? { type: 'flowers', color: palette.flower };
  const routes = plan.routes.filter((route) => route.kind === 'loop' || route.kind === 'main');
  let lampCounter = 0;

  const addCluster = (x, z, side) => {
    if (Math.hypot(x - plan.hub.x, z - plan.hub.z) < plan.hub.radius + 1.1) return;
    if (plan.buildings.some((b) => Math.hypot(x - b.x, z - b.z) < b.radius + 0.9)) return;
    if (plan.routes.some((route) => route.kind === 'spur' && distanceToPolyline(x, z, route.points) < 1.0)) return;
    switch (border.type) {
      case 'moss':
        plants.patch({ x, z, radius: 0.75, count: 3, keys: ['Clover_1', 'Clover_2'], height: 0.16, tint: '#6f8a5c', seed: 1 });
        break;
      case 'hedge':
        plants.patch({ x, z, radius: 0.6, count: 2, keys: ['Bush_Small'], height: 0.5, seed: 2 });
        break;
      case 'rocks':
        plants.add(PLANT_KEYS.rock[Math.floor(rng() * 3) % 3], { x, z, scale: 0.55 + rng() * 0.3, rotation: rng() * 3 });
        break;
      case 'lavender':
        plants.patch({ x, z, radius: 0.55, count: 3, keys: ['Flower_3_Single'], height: 0.5, tint: '#9a86c8', seed: 3 });
        break;
      case 'pots':
        plants.patch({ x, z, radius: 0.5, count: 2, keys: ['Clover_1'], height: 0.3, seed: 4 });
        break;
      case 'wildflowers':
        plants.patch({ x, z, radius: 0.85, count: 5, keys: ['Flower_3_Single', 'Flower_4_Single'], height: 0.38, tint: border.color, seed: 5 });
        break;
      default:
        plants.patch({ x, z, radius: 0.75, count: 4, keys: PLANT_KEYS.flower, height: 0.4, tint: border.color, seed: 6 });
    }
    if (side > 0 && lampCounter++ % 4 === 0) {
      const lamp = createLanternPost(rng() > 0.5 ? '#ffd9a1' : '#ffe6bb');
      lamp.position.set(x + 0.35, GROUND_Y, z + 0.35);
      lamp.scale.setScalar(0.82);
      parent.add(lamp);
    }
  };

  routes.forEach((route) => {
    let travelled = 0;
    let side = 1;
    for (let i = 1; i < route.points.length; i += 1) {
      const prev = route.points[i - 1];
      const current = route.points[i];
      travelled += Math.hypot(current.x - prev.x, current.z - prev.z);
      if (travelled < 7.2) continue;
      travelled = 0;
      side *= -1;
      const tangent = Math.atan2(current.x - prev.x, current.z - prev.z);
      const offset = route.width * 0.62 + 0.7;
      const x = current.x + Math.cos(tangent) * offset * side;
      const z = current.z - Math.sin(tangent) * offset * side;
      addCluster(x, z, side);
    }
  });
}

function buildMeadowbed(parent, feature, seed, plants) {
  const { x, z, radius = 3.6, color = '#e9c6d6', accentColor = '#e8dc9a' } = feature;
  const root = group(parent, [x, GROUND_Y, z]);
  plants.patch({ x, z, radius, count: 18, keys: PLANT_KEYS.flower, height: 0.38, tint: color, seed: seed + 2 });
  plants.patch({ x, z, radius: radius * 0.8, count: 10, keys: ['Flower_3_Single', 'Flower_4_Single'], height: 0.34, tint: accentColor, seed: seed + 3 });
  plants.patch({ x, z, radius: radius * 0.9, count: 6, keys: PLANT_KEYS.foliage, height: 0.28, seed: seed + 1 });
  return root;
}

const FEATURE_BUILDERS = {
  grove: buildGrove,
  bamboo: buildGrove,
  meadowbed: buildMeadowbed,
  zen: buildZen,
  steles: buildSteles,
  pond: buildPond,
  parterre: buildParterre,
  sundial: buildSundial,
  hedgewalk: buildHedgewalk,
  rockgarden: buildRockgarden,
  chimes: buildChimes,
  gears: buildGears,
  colorbeds: buildColorbeds,
  fungi: buildFungi,
  vials: buildVials,
  wildflowers: buildWildflowers,
  herbs: buildHerbs,
  arbor: buildArbor,
  bigleaf: buildBigleaf,
  roses: buildRoses,
  lavender: buildLavender,
  seabench: buildSeabench,
  pickets: buildPickets,
  kitchen: buildKitchen,
  pots: buildPots,
  timber: buildTimber,
  toolrack: buildToolrack,
};

/* ------------------------------------------------------------------ */
/* 规划：先算出所有坐标，地形与草甸要靠它来决定哪里不长草                 */
/* ------------------------------------------------------------------ */

export function planGarden({ island, dock, reserved = [], treeKeys = [], seed = 7 }) {
  const scheme = GARDENS[island.style] ?? GARDENS.wen;
  const hub = { ...scheme.hub };
  const trials = (island.trials ?? []).map((trial) => ({
    x: trial.position.x * TRIAL_PULL,
    z: trial.position.z * TRIAL_PULL,
    id: trial.id,
  }));

  const routes = [];
  const push = (from, to, width, shape, seed, kind) => {
    const points = shapeRoute(from, to, shape, { sway: scheme.path.sway, seed });
    routes.push({ points, width, kind });
  };

  push(dock, hub, scheme.path.width + 0.6, scheme.path.shape, 11, 'main');
  trials.forEach((trial, index) => {
    push(hub, trial, scheme.path.width, scheme.path.shape === 'zigzag' ? 'zigzag' : scheme.path.shape, 21 + index, 'branch');
  });
  // 额外的路：环形花园与十字街
  if (scheme.path.shape === 'radial') {
    const ring = [];
    for (let i = 0; i <= 60; i += 1) {
      const angle = (i / 60) * Math.PI * 2;
      ring.push({ x: hub.x + Math.cos(angle) * (hub.radius + 1.1), z: hub.z + Math.sin(angle) * (hub.radius + 1.1) });
    }
    routes.push({ points: ring, width: scheme.path.width * 0.9, kind: 'ring' });
  }
  if (scheme.path.shape === 'grid') {
    push({ x: hub.x - 9.5, z: hub.z }, { x: hub.x + 9.5, z: hub.z }, scheme.path.width, 'radial', 31, 'cross');
    push({ x: hub.x, z: hub.z - 9.5 }, { x: hub.x, z: hub.z + 9.5 }, scheme.path.width, 'radial', 32, 'cross');
  }

  // 建筑：给出理想位置，再往空处挪
  const blockers = [...reserved, { x: hub.x, z: hub.z, radius: hub.radius + 0.6, type: 'hub' }];
  const buildings = [];
  for (const config of scheme.buildings ?? []) {
    if (!village.has(config.piece)) continue;
    const scale = config.scale ?? 1;
    const footprint = village.footprint(config.piece, scale);
    const radius = config.kind === 'stall' ? Math.max(0.6, footprint.w * 0.3) : Math.max(footprint.w, footprint.d) * 0.42;
    let placed = null;
    const angleTries = [0, 0.18, -0.18, 0.36, -0.36, 0.55, -0.55];
    const radiusTries = [0, 1.6, 3.0, -1.4];
    for (const dRadius of radiusTries) {
      for (const dAngle of angleTries) {
        const angle = config.angle + dAngle;
        // 房子站在园路外侧，门朝园路，院子才不会被路穿过去
        const minOutside = (scheme.loopRadius ?? 13.2) + radius + 1.3;
        const distance = Math.max(config.radius, minOutside) + dRadius;
        const x = hub.x + Math.sin(angle) * distance;
        const z = hub.z + Math.cos(angle) * distance;
        if (Math.hypot(x, z) > island.walkRadius - radius - 0.6) continue;
        if (clearanceAt(x, z, blockers, radius) < 0.1) continue;
        placed = { x, z, angle: Math.atan2(hub.x - x, hub.z - z) + (config.turn ?? 0), radius, scale, config };
        break;
      }
      if (placed) break;
    }
    if (!placed) continue;
    blockers.push({ x: placed.x, z: placed.z, radius: placed.radius, type: 'garden-building' });
    buildings.push(placed);
  }

  // 花园：避开建筑、路口与彼此
  const features = [];
  for (const feature of scheme.features ?? []) {
    const radius = feature.radius ?? (feature.type === 'parterre' ? (feature.size ?? 3) * 0.85 : 1.6);
    if (clearanceAt(feature.x, feature.z, blockers, radius * 0.5) < 0) continue;
    if (Math.hypot(feature.x, feature.z) > island.walkRadius - 1.2) continue;
    blockers.push({ x: feature.x, z: feature.z, radius: radius * 0.55, type: 'garden-feature' });
    features.push(feature);
  }

  // 环形园路：把房子、花园与学问碑串成一圈，岛才不会散
  const loopRadius = Math.min(island.walkRadius - 5.2, scheme.loopRadius ?? 13.2);
  const loop = loopPoints(scheme.path.shape, hub, loopRadius, seed ?? 7);
  routes.push({ points: loop, width: scheme.path.width * 0.86, kind: 'loop' });

  // 从园路到每栋房子的短支路
  buildings.forEach((building, index) => {
    const node = nearestPoint(loop, building);
    const points = sampleLine(node, building, 0.55);
    routes.push({ points, width: scheme.path.width * 0.55, kind: 'spur' });
  });

  // 空地填充：树丛与草花坪交替铺在外圈，形成「园林房间」
  const palette = scheme.palette ?? {};
  const occupied = [
    ...buildings.map((b) => ({ angle: Math.atan2(b.x - hub.x, b.z - hub.z), radius: 2.0 })),
    ...features.map((f) => ({ angle: Math.atan2(f.x - hub.x, f.z - hub.z), radius: 1.2 })),
    { angle: Math.atan2(dock.x - hub.x, dock.z - hub.z), radius: 1.6 },
  ];
  const candidates = [];
  const slots = 18;
  for (let i = 0; i < slots; i += 1) {
    const angle = (i / slots) * Math.PI * 2;
    const distance = loopRadius + 4.2 + (i % 2) * 1.5;
    const dockAngle = Math.atan2(dock.x - hub.x, dock.z - hub.z);
    let toDock = Math.abs(angle - dockAngle);
    if (toDock > Math.PI) toDock = Math.PI * 2 - toDock;
    if (toDock < 0.5) continue;
    const x = hub.x + Math.sin(angle) * distance;
    const z = hub.z + Math.cos(angle) * distance;
    if (Math.hypot(x, z) > island.walkRadius - 3.4) continue;
    const clearance = clearanceAt(x, z, blockers, 3.2);
    if (clearance < 0.4) continue;
    let minAngle = Math.PI;
    for (const item of occupied) {
      let delta = Math.abs(angle - item.angle);
      if (delta > Math.PI) delta = Math.PI * 2 - delta;
      minAngle = Math.min(minAngle, delta / Math.max(1, item.radius * 0.5));
    }
    candidates.push({ x, z, angle, clearance, minAngle });
  }
  candidates.sort((a, b) => b.clearance + b.minAngle * 4 - (a.clearance + a.minAngle * 4));
  const chosen = [];
  for (const candidate of candidates) {
    if (chosen.length >= 5) break;
    if (chosen.some((item) => Math.hypot(item.x - candidate.x, item.z - candidate.z) < 6.4)) continue;
    chosen.push(candidate);
  }
  chosen.forEach((spot, index) => {
    const isGrove = index % 2 === 0;
    const feature = isGrove
      ? {
        type: 'grove',
        x: spot.x,
        z: spot.z,
        radius: 5.0,
        count: 3,
        treeKeys,
      }
      : {
        type: 'meadowbed',
        x: spot.x,
        z: spot.z,
        radius: 3.4,
        color: palette.flower ?? '#e9c6d6',
        accentColor: palette.accent ?? '#e8dc9a',
      };
    features.push(feature);
    blockers.push({ x: feature.x, z: feature.z, radius: isGrove ? 3.2 : 2.2, type: 'garden-fill' });
  });

  return {
    style: island.style,
    scheme,
    hub,
    routes,
    buildings,
    features,
    palette: scheme.palette,
    path: scheme.path,
    trials,
  };
}

/** 不长草的地方：路面、庭院、建筑与花圃 */
export function gardenClearAt(plan) {
  return (x, z) => {
    if (Math.hypot(x - plan.hub.x, z - plan.hub.z) < plan.hub.radius * 1.05) return true;
    for (const route of plan.routes) {
      if (distanceToPolyline(x, z, route.points) < route.width * 0.72) return true;
    }
    for (const building of plan.buildings) {
      if (Math.hypot(x - building.x, z - building.z) < building.radius * 0.95) return true;
    }
    for (const feature of plan.features) {
      const radius = feature.radius ?? (feature.size ?? 3) * 0.8;
      if (Math.hypot(x - feature.x, z - feature.z) < radius * 0.8) return true;
    }
    return false;
  };
}

/* ------------------------------------------------------------------ */
/* 装配                                                                */
/* ------------------------------------------------------------------ */

export function buildGarden({ root, island, plan, blockers, solid, seed, quality = 'high', grassPhoto }) {
  const plants = createPlantCollector(root);
  // 地面
  root.add(createGardenGround({
    radius: island.walkRadius * 0.995,
    palette: island.palette,
    plan,
    seed,
    grassPhoto,
  }));

  // 路
  plan.routes.forEach((route, index) => {
    layPath(root, route.points, { style: plan.path.surface, width: route.width, seed: seed + index * 7, plants });
  });
  // 沿路镶边
  dressBorders(root, plan, plan.scheme, seed, plants);

  // 庭院中心：一圈石台 + 悬浮的学科字，给每座岛一个「这里是哪」的锚点
  const emblem = group(root, [plan.hub.x, GROUND_Y, plan.hub.z]);
  const disc = mesh(
    emblem,
    new THREE.CylinderGeometry(plan.hub.radius * 0.52, plan.hub.radius * 0.58, 0.14, 24),
    material('#b9b09a', { texture: 'stone', roughness: 0.9, bumpScale: 0.06 }),
    [0, 0.07, 0],
  );
  disc.receiveShadow = true;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(plan.hub.radius * 0.62, plan.hub.radius * 0.66, 48),
    new THREE.MeshBasicMaterial({ color: island.accent, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.16;
  emblem.add(ring);
  const floating = glyphSprite(island.glyph, island.accent, 1.5);
  floating.position.y = 2.05;
  emblem.add(floating);
  const halo = glowSprite(island.accent, 2.6, 0.28);
  halo.position.y = 2.0;
  emblem.add(halo);
  emblem.userData.tick = (time) => {
    floating.position.y = 2.05 + Math.sin(time * 0.9) * 0.09;
    floating.material.opacity = 0.82 + Math.sin(time * 1.3) * 0.12;
    halo.material.opacity = 0.22 + Math.sin(time * 1.1) * 0.06;
    ring.rotation.z = time * 0.18;
  };

  // 建筑
  for (const building of plan.buildings) {
    const { config, scale, angle } = building;
    const object = village.create(config.piece, { scale, rotation: 0 });
    if (!object) continue;
    object.position.set(building.x, GROUND_Y - 0.02, building.z);
    object.rotation.y = angle;
    object.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    root.add(object);
    addBlocker(blockers, building.x, building.z, building.radius, 'garden-building');
    solid.push({ x: building.x, z: building.z, radius: building.radius * 0.8 });
  }

  // 花园
  plan.features.forEach((feature, index) => {
    const builder = FEATURE_BUILDERS[feature.type];
    if (!builder) return;
    const object = builder(root, feature, seed + index * 13, plants);
    if (object) object.name = `garden-${feature.type}`;
  });

  plants.flush();
  return plan;
}
