import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/utils.js';
import { village } from './villageAssets.js';
import { glowSprite } from './modelKit.js';
import { getSurface } from './textures.js';

/**
 * 岛屿上的中世纪村落。
 *
 * 场景结构参考 xiǎozhèn 的苔溪镇：一座有广场、水井、市集摊和石板路的小镇，
 * 木石结构的整栋建筑围着广场站一圈，家家门口朝广场，道具沿街与广场边缘散落。
 *
 * 与苔溪镇不同的是，这里是「岛」：广场会被压缩到 4~5 米半径，
 * 建筑环贴着小岛的等高线，外面再交给热带海岸的棕榈与礁石。
 *
 * 所有摆放都走同一套「先登记、再避让」的流程：
 *   1. 先把已存在的建筑 / 学问碑 / 地标记进 blockers；
 *   2. 村落自己按角度找空位，找不到就跳过，绝不硬塞进别的东西里；
 *   3. 摆好的建筑再登记回 blockers，供玩家建造与后续道具使用。
 */

const SQUARE_TILE = 'Path_Square';
const STRAIGHT_TILE = 'Path_Straight';
const TILE_SCALE = 2.05;

/* ------------------------------------------------------------------ */
/* 颜色与画布小工具                                                     */
/* ------------------------------------------------------------------ */

function hexToRgb(hex) {
  const raw = String(hex ?? '#888888').replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return { r: 128, g: 128, b: 128 };
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixHex(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function shaded(hex, amount) {
  return mixHex(hex, amount > 0 ? '#ffffff' : '#000000', Math.abs(amount));
}

/* ------------------------------------------------------------------ */
/* 地面：草地 + 踩出来的土路 + 广场土坪                                   */
/* ------------------------------------------------------------------ */

/**
 * 画一张圆形地面贴图。石板本身由 Path_* 模型铺出来，这里只负责
 * 「被踩秃的草地」——广场与街道中心的土色、边缘的杂草、散落的碎石。
 */
export function createVillageGroundTexture({
  radius = 18,
  plazaRadius = 4.6,
  streetAngle = 0,
  laneAngle = streetAngle + Math.PI * 0.5,
  laneLength = 0.72,
  streetWidthScale = 1,
  ringRoad = false,
  palette = {},
  seed = 7,
  size = 1024,
  grassPhoto = null,
}) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(seed * 17 + 3);
  const px = size / (radius * 2);
  const c = size / 2;
  const toX = (x) => c + x * px;
  const toY = (z) => c + z * px;

  const grass = palette.grass ?? '#7aa06a';
  const grassDeep = palette.grassDeep ?? shaded(grass, -0.22);
  const grassDry = palette.grassDry ?? '#a8b878';
  const dirt = mixHex(palette.sand ?? '#d8bd8a', '#6d5b42', 0.52);

  // 草地底色
  ctx.fillStyle = grass;
  ctx.fillRect(0, 0, size, size);

  // 深浅草斑
  for (let i = 0; i < 260; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    const r = (18 + rng() * 90) * (size / 1024);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    const roll = rng();
    gradient.addColorStop(0, rgba(roll > 0.55 ? grassDry : grassDeep, 0.16 + rng() * 0.12));
    gradient.addColorStop(1, rgba(grass, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 24-grass 的照片草皮：叠一层真实的草纹，远看不再是纯色块
  if (grassPhoto) {
    const tile = 13 * px;
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.globalCompositeOperation = 'overlay';
    for (let y = 0; y < size; y += tile) {
      for (let x = 0; x < size; x += tile) {
        ctx.drawImage(grassPhoto, x, y, tile, tile);
      }
    }
    ctx.restore();
  }

  // 草叶纹理
  for (let i = 0; i < 16000; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    const h = (2 + rng() * 5) * (size / 1024);
    ctx.strokeStyle = rgba(rng() > 0.5 ? grassDeep : shaded(grass, 0.18), 0.18 + rng() * 0.3);
    ctx.lineWidth = Math.max(0.6, 0.9 * (size / 1024));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rng() - 0.5) * 2, y - h);
    ctx.stroke();
  }

  // 广场：一圈被踩得很实的土
  const plazaGradient = ctx.createRadialGradient(toX(0), toY(0), plazaRadius * px * 0.2, toX(0), toY(0), plazaRadius * px * 1.9);
  plazaGradient.addColorStop(0, rgba(dirt, 0.95));
  plazaGradient.addColorStop(0.55, rgba(dirt, 0.72));
  plazaGradient.addColorStop(1, rgba(dirt, 0));
  ctx.fillStyle = plazaGradient;
  ctx.beginPath();
  ctx.arc(toX(0), toY(0), plazaRadius * px * 1.9, 0, Math.PI * 2);
  ctx.fill();

  // 主街：从广场通向码头的土路
  ctx.save();
  ctx.translate(toX(0), toY(0));
  ctx.rotate(-streetAngle + Math.PI);
  const streetWidth = Math.max(2.6, plazaRadius * 0.78) * streetWidthScale * px;
  const laneGradient = ctx.createLinearGradient(0, -streetWidth / 2, 0, streetWidth / 2);
  laneGradient.addColorStop(0, rgba(dirt, 0));
  laneGradient.addColorStop(0.25, rgba(dirt, 0.78));
  laneGradient.addColorStop(0.75, rgba(dirt, 0.78));
  laneGradient.addColorStop(1, rgba(dirt, 0));
  ctx.fillStyle = laneGradient;
  ctx.fillRect(0, -streetWidth / 2, radius * px * 1.02, streetWidth);
  ctx.restore();

  // 横巷：角度与长度每座岛都不一样，小镇的路网就不会长得一模一样
  ctx.save();
  ctx.translate(toX(0), toY(0));
  ctx.rotate(-laneAngle + Math.PI);
  const laneWidth = streetWidth * 0.66;
  const laneGrad = ctx.createLinearGradient(0, -laneWidth / 2, 0, laneWidth / 2);
  laneGrad.addColorStop(0, rgba(dirt, 0));
  laneGrad.addColorStop(0.3, rgba(dirt, 0.68));
  laneGrad.addColorStop(0.7, rgba(dirt, 0.68));
  laneGrad.addColorStop(1, rgba(dirt, 0));
  ctx.fillStyle = laneGrad;
  ctx.fillRect(-radius * px * laneLength * 0.5, -laneWidth / 2, radius * px * laneLength, laneWidth);
  ctx.restore();

  // 环村道：绕广场一圈，家岛那种「村子长开了」的样子
  if (ringRoad) {
    const ringR = plazaRadius * 1.32;
    const ringW = Math.max(1.5, plazaRadius * 0.16);
    ctx.strokeStyle = rgba(dirt, 0.6);
    ctx.lineWidth = ringW * px;
    ctx.beginPath();
    ctx.arc(toX(0), toY(0), ringR * px, 0, Math.PI * 2);
    ctx.stroke();
    // 从环道伸向房子的小岔路
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + 0.32;
      ctx.lineWidth = ringW * 0.55 * px;
      ctx.beginPath();
      ctx.moveTo(toX(Math.cos(a) * ringR), toY(Math.sin(a) * ringR));
      ctx.lineTo(toX(Math.cos(a) * (ringR + plazaRadius * 0.5)), toY(Math.sin(a) * (ringR + plazaRadius * 0.5)));
      ctx.stroke();
    }
  }

  // 路面上的碎石与车辙
  for (let i = 0; i < 900; i += 1) {
    const angle = rng() * Math.PI * 2;
    const dist = Math.pow(rng(), 0.55) * radius * 0.92;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const onPlaza = dist < plazaRadius * 1.05;
    const nearStreet = Math.abs(Math.atan2(x, z) - streetAngle) < 0.16 || Math.abs(Math.atan2(x, z) - streetAngle + Math.PI * 2) < 0.16;
    if (!onPlaza && !nearStreet && rng() > 0.18) continue;
    ctx.fillStyle = rgba(rng() > 0.5 ? '#9c9484' : shaded(dirt, -0.18), 0.2 + rng() * 0.35);
    ctx.beginPath();
    ctx.ellipse(toX(x), toY(z), (1.2 + rng() * 3.2) * (size / 1024), (0.9 + rng() * 2.2) * (size / 1024), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // 岛缘的沙滩：从草地过渡到沙，再往外交给地形本身的礁石
  const sandColor = palette.sand ?? '#e3c990';
  const sandGradient = ctx.createRadialGradient(c, c, radius * px * 0.82, c, c, radius * px * 1.0);
  sandGradient.addColorStop(0, rgba(sandColor, 0));
  sandGradient.addColorStop(0.45, rgba(sandColor, 0.55));
  sandGradient.addColorStop(1, rgba(sandColor, 0.95));
  ctx.fillStyle = sandGradient;
  ctx.beginPath();
  ctx.arc(c, c, radius * px, 0, Math.PI * 2);
  ctx.fill();

  // 沙粒与贝壳碎屑
  for (let i = 0; i < 1400; i += 1) {
    const angle = rng() * Math.PI * 2;
    const dist = radius * (0.84 + rng() * 0.16);
    ctx.fillStyle = rgba(rng() > 0.6 ? '#f3e2bd' : shaded(sandColor, -0.16), 0.2 + rng() * 0.4);
    ctx.beginPath();
    ctx.ellipse(toX(Math.cos(angle) * dist), toY(Math.sin(angle) * dist), (0.8 + rng() * 2.4) * (size / 1024), (0.6 + rng() * 1.6) * (size / 1024), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // 岛缘的草簇，柔化圆形边界
  for (let i = 0; i < 320; i += 1) {
    const angle = rng() * Math.PI * 2;
    const dist = radius * (0.78 + rng() * 0.2);
    const x = toX(Math.cos(angle) * dist);
    const y = toY(Math.sin(angle) * dist);
    for (let n = 0; n < 3; n += 1) {
      const h = (3 + rng() * 7) * (size / 1024);
      ctx.strokeStyle = rgba(grassDeep, 0.3 + rng() * 0.4);
      ctx.lineWidth = Math.max(0.6, rng() * 1.4 * (size / 1024));
      ctx.beginPath();
      ctx.moveTo(x + (rng() - 0.5) * 5, y + (rng() - 0.5) * 5);
      ctx.quadraticCurveTo(x, y - h * 0.6, x + (rng() - 0.5) * 7, y - h);
      ctx.stroke();
    }
  }

  // 圆形边缘羽化，避免和地形之间出现一刀切的边
  ctx.globalCompositeOperation = 'destination-out';
  const fade = ctx.createRadialGradient(c, c, radius * px * 0.9, c, c, radius * px);
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

/**
 * 把这张贴图铺成地面上的一层薄片。贴在岛顶之上一点点，
 * 用透明通道和地形软过渡。
 */
export function createVillageGround({
  center = { x: 0, z: 0 },
  radius = 18,
  groundY = 0,
  plazaRadius = 4.6,
  streetAngle = 0,
  laneAngle = streetAngle + Math.PI * 0.5,
  laneLength = 0.72,
  streetWidthScale = 1,
  ringRoad = false,
  palette = {},
  seed = 7,
  grassPhoto = null,
}) {
  const texture = createVillageGroundTexture({
    radius,
    plazaRadius,
    streetAngle,
    laneAngle,
    laneLength,
    streetWidthScale,
    ringRoad,
    palette,
    seed,
    grassPhoto,
  });
  const surface = getSurface('grass', 1);
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 96),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.97,
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
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(center.x, groundY + 0.012, center.z);
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  mesh.name = 'village-ground';
  return mesh;
}

/* ------------------------------------------------------------------ */
/* 石板路：用包里的 Path_* 地块铺，最后按材质合批                        */
/* ------------------------------------------------------------------ */

function extractGroupGeometry(geometry, group) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const out = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    if (!attribute) continue;
    const start = group.start * attribute.itemSize;
    const end = (group.start + group.count) * attribute.itemSize;
    if (end > attribute.array.length) return null;
    const array = attribute.array.slice(start, end);
    out.setAttribute(name, new THREE.BufferAttribute(array, attribute.itemSize, attribute.normalized));
  }
  return out;
}

/**
 * 把一个静态组里的网格按材质合并成少量 Mesh。
 * 广场石板动辄上百块，不合并会多出两三百个 draw call。
 */
export function mergeByMaterial(root, { castShadow = true, receiveShadow = true, name = 'village-merged' } = {}) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const collect = (mat, geometry) => {
    if (!mat || !geometry) return;
    if (!buckets.has(mat)) buckets.set(mat, []);
    buckets.get(mat).push(geometry);
  };

  root.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh || object.isSkinnedMesh) return;
    const geometry = object.geometry;
    if (!geometry?.attributes?.position) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.length <= 1) {
      const clone = geometry.index ? geometry.toNonIndexed() : geometry.clone();
      clone.applyMatrix4(object.matrixWorld);
      collect(materials[0], clone);
      return;
    }
    const groups = geometry.groups?.length
      ? geometry.groups
      : [{ start: 0, count: (geometry.index?.count ?? geometry.attributes.position.count), materialIndex: 0 }];
    groups.forEach((group) => {
      const slice = extractGroupGeometry(geometry, group);
      if (!slice) return;
      slice.applyMatrix4(object.matrixWorld);
      collect(materials[group.materialIndex] ?? materials[0], slice);
    });
  });

  const merged = new THREE.Group();
  merged.name = name;
  buckets.forEach((geometries, mat) => {
    if (!geometries.length) return;
    let geometry = null;
    try {
      geometry = mergeGeometries(geometries, false);
    } catch {
      geometry = null;
    }
    geometries.forEach((item) => item.dispose());
    if (!geometry) return;
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.frustumCulled = true;
    merged.add(mesh);
  });
  return merged;
}

/**
 * 铺广场与主街的石板。返回一个已经合批的 Group。
 */
export function createPaving({
  center = { x: 0, z: 0 },
  plazaRadius = 4.6,
  streetAngle = 0,
  streetLength = 14,
  groundY = 0,
  seed = 11,
  tile = 1.0,
  laneAngle = streetAngle + Math.PI * 0.5,
  withLane = false,
}) {
  const rng = mulberry32(seed * 31 + 5);
  const group = new THREE.Group();
  group.name = 'village-paving';
  if (!village.ready || !village.has(SQUARE_TILE)) return group;

  const squareScale = tile / 0.49;
  const straightScale = (tile * 1.95) / 0.98;
  const y = groundY - 0.015;
  const step = tile * 0.94;

  // 广场：方形石板铺满一个圆，边缘随机缺几块
  const span = Math.ceil(plazaRadius / step);
  for (let gx = -span; gx <= span; gx += 1) {
    for (let gz = -span; gz <= span; gz += 1) {
      const x = gx * step;
      const z = gz * step;
      const dist = Math.hypot(x, z);
      if (dist > plazaRadius - step * 0.2) continue;
      if (dist > plazaRadius - step * 0.9 && rng() > 0.82) continue;
      const piece = village.create(SQUARE_TILE, {
        scale: squareScale,
        rotation: Math.floor(rng() * 4) * (Math.PI / 2),
      });
      if (!piece) continue;
      piece.position.set(center.x + x, y, center.z + z);
      group.add(piece);
    }
  }

  // 主街：两排直板，从广场边一直铺到码头
  const rows = [-0.5, 0.5];
  for (let offset = plazaRadius - step * 0.5; offset < streetLength; offset += tile * 1.92) {
    for (const row of rows) {
      const dist = offset;
      const x = Math.sin(streetAngle) * dist + Math.cos(streetAngle) * row;
      const z = Math.cos(streetAngle) * dist - Math.sin(streetAngle) * row;
      if (Math.hypot(x, z) > streetLength) continue;
      const piece = village.create(STRAIGHT_TILE, { scale: straightScale, rotation: streetAngle });
      if (!piece) continue;
      piece.position.set(center.x + x, y, center.z + z);
      group.add(piece);
    }
  }

  // 横巷：各岛角度不同，石板路的走向也就不一样
  if (withLane) {
    const laneRows = [-0.5, 0.5];
    const laneEnd = streetLength * 0.58;
    for (let offset = plazaRadius - step * 0.5; offset < laneEnd; offset += tile * 1.9) {
      for (const row of laneRows) {
        const dist = offset;
        const x = Math.sin(laneAngle) * dist + Math.cos(laneAngle) * row;
        const z = Math.cos(laneAngle) * dist - Math.sin(laneAngle) * row;
        const piece = village.create(STRAIGHT_TILE, { scale: straightScale, rotation: laneAngle });
        if (!piece) continue;
        piece.position.set(center.x + x, y, center.z + z);
        group.add(piece);
      }
    }
  }

  return mergeByMaterial(group, { name: 'village-paving-merged' });
}

/* ------------------------------------------------------------------ */
/* 空位搜索                                                            */
/* ------------------------------------------------------------------ */

function clearanceAt(x, z, blockers, radius) {
  let best = Infinity;
  for (const blocker of blockers) {
    const gap = Math.hypot(x - blocker.x, z - blocker.z) - blocker.radius - radius;
    if (gap < best) best = gap;
  }
  return best;
}

/**
 * 在理想角度附近找一个真正空着的落位。
 * 村落不是棋盘，找不到正对广场的位置时稍微偏一点比硬塞好得多。
 */
function findSlot({
  center,
  blockers,
  radius,
  angle,
  footprintRadius,
  maxRadius = 999,
  tolerance = 0.55,
}) {  const steps = 24;
  let best = null;
  for (let i = 0; i <= steps; i += 1) {
    const delta = (i / steps) * tolerance;
    const signs = i === 0 ? [1] : [1, -1];
    for (const sign of signs) {
      const candidate = angle + delta * sign;
      const gap = clearanceAt(
        center.x + Math.sin(candidate) * radius,
        center.z + Math.cos(candidate) * radius,
        blockers,
        footprintRadius,
      );
      if (gap < 0.15) continue;
      if (Math.hypot(center.x + Math.sin(candidate) * radius, center.z + Math.cos(candidate) * radius) > maxRadius) continue;
      const score = gap - delta * 1.6;
      if (!best || score > best.score) {
        best = {
          score,
          angle: candidate,
          x: center.x + Math.sin(candidate) * radius,
          z: center.z + Math.cos(candidate) * radius,
        };
      }
      if (i === 0) break;
    }
  }
  return best;
}

/** 把一个点沿半径方向往外推，直到不再压到别的东西 */
export function resolveFreePosition(x, z, blockers, { radius = 0.6, limit = 99, minGap = 0.12 } = {}) {
  if (clearanceAt(x, z, blockers, radius) >= minGap) return { x, z };
  const angle = Math.atan2(x, z);
  let distance = Math.hypot(x, z);
  for (let step = 0; step < 24; step += 1) {
    distance += 0.55;
    const nx = Math.sin(angle) * distance;
    const nz = Math.cos(angle) * distance;
    if (distance > limit) break;
    if (clearanceAt(nx, nz, blockers, radius) >= minGap) return { x: nx, z: nz };
  }
  return { x, z };
}

/* ------------------------------------------------------------------ */
/* 村落装配                                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_PLAZA_PROPS = [
  { piece: 'MarketStand_1', angle: Math.PI * 0.55, radius: 1.5, scale: 1.0 },
  { piece: 'MarketStand_2', angle: -Math.PI * 0.55, radius: 1.5, scale: 1.0 },
  { piece: 'Bench_1', angle: Math.PI * 0.88, radius: 1.1, scale: 1.0 },
  { piece: 'Bench_2', angle: -Math.PI * 0.2, radius: 1.05, scale: 1.0 },
  { piece: 'Cauldron', angle: Math.PI * 0.2, radius: 1.0, scale: 1.0 },
  { piece: 'Cart', angle: Math.PI * 0.32, radius: 1.45, scale: 1.0, collider: 1.1 },
];

const STREET_PROPS = [
  { piece: 'Barrel', scale: 1.0, radius: 0.35 },
  { piece: 'Barrel', scale: 1.0, radius: 0.35 },
  { piece: 'Crate', scale: 1.0, radius: 0.35 },
  { piece: 'Crate', scale: 1.0, radius: 0.35 },
  { piece: 'Bag', scale: 1.0, radius: 0.3 },
  { piece: 'Bags', scale: 1.0, radius: 0.42 },
  { piece: 'Hay', scale: 1.15, radius: 0.4 },
  { piece: 'Fence', scale: 2.6, radius: 0.5, rotation: Math.PI / 2 },
  { piece: 'Rock_1', scale: 1.2, radius: 0.4 },
  { piece: 'Rock_2', scale: 1.1, radius: 0.4 },
];

/**
 * 在岛上摆一座村落。
 * @returns {{ group: THREE.Group, blockers: Array, solid: Array, buildings: Array, plaza: object }}
 */
export function createVillage({
  center = { x: 0, z: 0 },
  groundY = 0,
  walkRadius = 18,
  plazaRadius = 4.6,
  ringRadius = 8.8,
  buildingScale = 1.65,
  streetAngle = 0,
  streetLength = 15,
  buildings = [],
  blockers = [],
  palette = {},
  seed = 7,
  quality = 'high',
  paving = true,
  props = true,
  well = true,
}) {
  const rng = mulberry32(seed * 23 + 9);
  const group = new THREE.Group();
  group.name = 'village';
  const placed = [];
  const solid = [];
  const scale = buildingScale;

  // 1) 地面
  group.add(createVillageGround({
    center,
    radius: walkRadius * 0.995,
    groundY,
    plazaRadius,
    streetAngle,
    palette,
    seed,
  }));

  // 2) 石板
  if (paving) {
    const pavingGroup = createPaving({
      center,
      plazaRadius: plazaRadius * 0.94,
      streetAngle,
      streetLength: streetLength - 0.6,
      groundY,
      seed,
    });
    if (pavingGroup.children.length) group.add(pavingGroup);
  }

  if (!village.ready) {
    return { group, blockers, solid, buildings: placed, plaza: { ...center, radius: plazaRadius }, ready: false };
  }

  // 3) 建筑环
  for (const spec of buildings) {
    const piece = spec.piece;
    if (!village.has(piece)) continue;
    const footprint = village.footprint(piece, scale);
    const footprintRadius = Math.hypot(footprint.w, footprint.d) * 0.5 * 0.82;
    const slot = findSlot({
      center,
      blockers,
      radius: spec.radius ?? ringRadius,
      angle: spec.angle ?? 0,
      footprintRadius,
      tolerance: spec.tolerance ?? 0.55,
      maxRadius: walkRadius - footprintRadius * 0.6,
    });
    if (!slot) continue;
    const model = village.create(piece, { scale, rotation: 0 });
    if (!model) continue;
    // 门朝广场：朝向 = 从建筑指向中心
    const facing = Math.atan2(center.x - slot.x, center.z - slot.z);
    model.position.set(slot.x, groundY - 0.02, slot.z);
    model.rotation.y = facing + (spec.turn ?? 0);
    model.name = `village-${piece}`;
    model.userData.villageBuilding = piece;
    group.add(model);

    const blocker = {
      x: slot.x,
      z: slot.z,
      radius: footprintRadius * 0.92,
      type: 'village',
    };
    blockers.push(blocker);
    solid.push({ x: slot.x, z: slot.z, radius: footprintRadius * 0.74 });
    placed.push({
      piece,
      x: slot.x,
      z: slot.z,
      rotation: model.rotation.y,
      scale,
      blocker,
      label: spec.label ?? null,
      role: spec.role ?? null,
    });
  }

  // 4) 广场中央的水井
  if (well && village.has('Well')) {
    const wellScale = Math.max(1.1, plazaRadius * 0.3);
    const spot = resolveFreePosition(
      center.x + Math.sin(streetAngle + Math.PI * 0.5) * plazaRadius * 0.16,
      center.z + Math.cos(streetAngle + Math.PI * 0.5) * plazaRadius * 0.16,
      blockers,
      { radius: 0.9, limit: walkRadius * 0.6 },
    );
    const object = village.create('Well', { scale: wellScale, rotation: rng() * Math.PI });
    if (object) {
      object.position.set(spot.x, groundY - 0.02, spot.z);
      group.add(object);
      blockers.push({ x: spot.x, z: spot.z, radius: 0.85, type: 'village' });
      solid.push({ x: spot.x, z: spot.z, radius: 0.85 });
      placed.push({ piece: 'Well', x: spot.x, z: spot.z, role: 'well' });
    }
  }

  // 5) 广场边的摊位、长凳与货车
  if (props) {
    const propScale = scale * 0.98;
    for (const spec of DEFAULT_PLAZA_PROPS) {
      if (!village.has(spec.piece)) continue;
      const angle = streetAngle + Math.PI + spec.angle;
      const radius = plazaRadius + spec.radius * 0.85;
      const x = center.x + Math.sin(angle) * radius;
      const z = center.z + Math.cos(angle) * radius;
      const footprint = village.footprint(spec.piece, propScale);
      const gap = clearanceAt(x, z, blockers, Math.max(footprint.w, footprint.d) * 0.45);
      if (gap < 0) continue;
      const object = village.create(spec.piece, {
        scale: propScale,
        rotation: angle + Math.PI + (rng() - 0.5) * 0.5,
      });
      if (!object) continue;
      object.position.set(x, groundY - 0.01, z);
      group.add(object);
      if (spec.collider) {
        blockers.push({ x, z, radius: spec.collider, type: 'village-prop' });
      }
    }

    // 沿街的零碎道具：木桶、箱子、干草、围栏、石头
    const scatter = Math.min(10, 4 + Math.round(walkRadius * 0.32));
    for (let i = 0; i < scatter; i += 1) {
      const spec = STREET_PROPS[i % STREET_PROPS.length];
      if (!village.has(spec.piece)) continue;
      const angle = rng() * Math.PI * 2;
      const radius = plazaRadius + 1.4 + rng() * (ringRadius - plazaRadius - 1.0);
      let x = center.x + Math.sin(angle) * radius;
      let z = center.z + Math.cos(angle) * radius;
      // 别把道具摆到街心
      const toStreet = Math.abs(Math.atan2(x - center.x, z - center.z) - streetAngle);
      const streetClear = Math.min(toStreet, Math.PI * 2 - toStreet);
      if (streetClear < 0.34) continue;
      const footprint = village.footprint(spec.piece, propScale * spec.scale);
      const gap = clearanceAt(x, z, blockers, Math.max(footprint.w, footprint.d) * 0.45);
      if (gap < 0.1) continue;
      const object = village.create(spec.piece, {
        scale: propScale * spec.scale,
        rotation: spec.rotation ?? rng() * Math.PI * 2,
      });
      if (!object) continue;
      object.position.set(x, groundY - 0.01, z);
      group.add(object);
      if (spec.radius) {
        blockers.push({ x, z, radius: spec.radius * propScale * 0.6, type: 'village-prop' });
      }
    }
  }

  // 6) 广场上的火堆，晚上是一团暖光
  if (props && village.has('Bonfire_Lit')) {
    const angle = streetAngle + Math.PI * 1.28;
    const radius = plazaRadius * 0.62;
    const x = center.x + Math.sin(angle) * radius;
    const z = center.z + Math.cos(angle) * radius;
    if (clearanceAt(x, z, blockers, 0.9) > 0) {
      const fire = village.create('Bonfire_Lit', { scale: scale * 0.95 });
      if (fire) {
        fire.position.set(x, groundY - 0.01, z);
        group.add(fire);
        const glow = glowSprite('#ffb469', 2.6, 0.4);
        glow.position.set(x, groundY + 0.55, z);
        group.add(glow);
        blockers.push({ x, z, radius: 0.6, type: 'village-prop' });
        group.userData.tick = (time) => {
          glow.material.opacity = 0.26 + Math.sin(time * 4.2) * 0.08;
          glow.scale.setScalar(2.6 + Math.sin(time * 3.1) * 0.14);
        };
        group.userData.campfire = { x, z };
      }
    }
  }

  return {
    group,
    blockers,
    solid,
    buildings: placed,
    plaza: { x: center.x, z: center.z, radius: plazaRadius },
    ready: true,
  };
}

/**
 * 给一组已经摆好的东西收集「足迹圆圈」，用来给后来的建筑避让。
 *
 * 直接按顶层子节点算不行：学科地标常常是「一个 Group 里散着好几件」，
 * 包围盒会把整片岛都圈进去。所以按网格把网格体聚成簇，一簇一个圆圈。
 */
export function collectFootprints(root, list = [], { pad = 0.5, minRadius = 0.4, cell = 2.4 } = {}) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const cells = new Map();
  root.traverse((object) => {
    if (!object.isMesh) return;
    box.setFromObject(object);
    if (box.isEmpty() || !Number.isFinite(box.min.x)) return;
    const centerX = (box.min.x + box.max.x) / 2;
    const centerZ = (box.min.z + box.max.z) / 2;
    const key = `${Math.round(centerX / cell)}:${Math.round(centerZ / cell)}`;
    const entry = cells.get(key);
    if (!entry) {
      cells.set(key, { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z });
    } else {
      entry.minX = Math.min(entry.minX, box.min.x);
      entry.maxX = Math.max(entry.maxX, box.max.x);
      entry.minZ = Math.min(entry.minZ, box.min.z);
      entry.maxZ = Math.max(entry.maxZ, box.max.z);
    }
  });
  cells.forEach((entry) => {
    const width = entry.maxX - entry.minX;
    const depth = entry.maxZ - entry.minZ;
    list.push({
      x: (entry.minX + entry.maxX) / 2,
      z: (entry.minZ + entry.maxZ) / 2,
      radius: Math.max(minRadius, Math.max(width, depth) * 0.5 + pad),
      type: 'scenery',
    });
  });
  return list;
}
