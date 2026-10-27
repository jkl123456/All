import * as THREE from 'three';
import { mulberry32 } from '../core/utils.js';
import { getContactShadowTexture, getSurface } from './textures.js';

const materialCache = new Map();
let glowTexture = null;

/**
 * 统一材质入口。
 *
 * `texture` 会挂上一张程序化颜色贴图 + 凹凸贴图，颜色仍然由 `color` 决定，
 * 于是同一套木纹可以同时当好几种木头的底子，而画面不再是纯色块。
 */
export function material(color, options = {}) {
  const {
    roughness = 0.82,
    metalness = 0,
    emissive = null,
    emissiveIntensity = 1,
    transparent = false,
    opacity = 1,
    side = THREE.FrontSide,
    flatShading = false,
    depthWrite = true,
    texture = null,
    textureScale = 1,
    bumpScale = 0.05,
    envMapIntensity = 0.7,
  } = options;
  const key = [color, roughness, metalness, emissive, emissiveIntensity, transparent, opacity, side, flatShading, depthWrite, texture, textureScale, bumpScale].join('|');
  if (!materialCache.has(key)) {
    const surface = texture ? getSurface(texture, textureScale) : null;
    const instance = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      emissive: emissive ?? 0x000000,
      emissiveIntensity,
      transparent,
      opacity,
      side,
      flatShading,
      depthWrite,
      envMapIntensity,
    });
    if (surface) {
      instance.map = surface.map;
      instance.bumpMap = surface.bump;
      instance.bumpScale = bumpScale;
    }
    materialCache.set(key, instance);
  }
  return materialCache.get(key);
}

export const M = {
  wood: (color = '#8b6546') => material(color, { roughness: 0.88, texture: 'wood', textureScale: 1, bumpScale: 0.035 }),
  woodDark: () => material('#5b4230', { roughness: 0.92, texture: 'wood', bumpScale: 0.04 }),
  woodLight: () => material('#b58b62', { roughness: 0.86, texture: 'wood', bumpScale: 0.03 }),
  plaster: () => material('#e2d4b7', { roughness: 0.94, texture: 'plaster', bumpScale: 0.025 }),
  stone: () => material('#96998f', { roughness: 0.96, texture: 'stone', bumpScale: 0.06 }),
  stoneDark: () => material('#6d726a', { roughness: 0.97, texture: 'stone', bumpScale: 0.07 }),
  stoneLight: () => material('#c1c0b2', { roughness: 0.93, texture: 'stone', bumpScale: 0.05 }),
  brass: () => material('#bd9554', { metalness: 0.66, roughness: 0.32, texture: 'metal', bumpScale: 0.012 }),
  gold: () => material('#dfbd72', { metalness: 0.8, roughness: 0.24, texture: 'metal', bumpScale: 0.01 }),
  crystal: () => material('#89ded0', { roughness: 0.18, metalness: 0.05, emissive: '#3d958d', emissiveIntensity: 0.45, flatShading: true }),
  water: () => material('#5bb5ae', { roughness: 0.22, metalness: 0.1, transparent: true, opacity: 0.7 }),
  roofTeal: () => material('#416c66', { roughness: 0.72, texture: 'roof', textureScale: 1.2, bumpScale: 0.09 }),
  roofClay: () => material('#9c5f4b', { roughness: 0.88, texture: 'roof', textureScale: 1.2, bumpScale: 0.09 }),
  thatch: (color = '#c7ad7b') => material(color, { roughness: 0.96, texture: 'thatch', bumpScale: 0.08 }),
  leaf: (color = '#4f8a5d') => material(color, { roughness: 0.94, texture: 'leaf', bumpScale: 0.03 }),
  bark: (color = '#6f513b') => material(color, { roughness: 0.98, texture: 'wood', textureScale: 1.6, bumpScale: 0.07 }),
  soil: () => material('#735136', { roughness: 1, texture: 'soil', bumpScale: 0.07 }),
  white: () => material('#eee6d3', { roughness: 0.85, texture: 'plaster', bumpScale: 0.02 }),
  black: () => material('#2f3634', { roughness: 0.8 }),
  ember: () => material('#ff9b4a', { emissive: '#ff752b', emissiveIntensity: 2.4, roughness: 0.4 }),
  glass: () => material('#c9e9e3', { transparent: true, opacity: 0.28, roughness: 0.15, metalness: 0.08, side: THREE.DoubleSide }),
  sand: () => material('#e0c99a', { roughness: 1, texture: 'sand', bumpScale: 0.04 }),
  metal: () => material('#9aa3a0', { roughness: 0.42, metalness: 0.72, texture: 'metal', bumpScale: 0.01 }),
};

/** 给道具补一片贴地软阴影，解决「东西像浮在草地上」的问题。 */
export function createContactShadow(radius = 1, opacity = 0.5, y = 0.03) {
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = y;
  shadow.renderOrder = 1;
  return shadow;
}

export function mesh(parent, geometry, mat, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], shadows = true) {
  const object = new THREE.Mesh(geometry, mat);
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.scale.set(...scale);
  if (shadows) {
    object.castShadow = true;
    object.receiveShadow = true;
  }
  parent.add(object);
  return object;
}

export function group(parent, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const node = new THREE.Group();
  node.position.set(...position);
  node.rotation.set(...rotation);
  parent?.add(node);
  return node;
}

export function shadows(node, cast = true, receive = true) {
  node.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = cast;
    child.receiveShadow = receive;
  });
  return node;
}

export function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.22, 'rgba(255,255,255,.85)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,.28)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

export function glowSprite(color = '#ffe7a7', scale = 1, opacity = 0.8) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getGlowTexture(),
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  sprite.scale.setScalar(scale);
  return sprite;
}

export function glyphTexture(glyph, color = '#f1d28d') {
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = 'rgba(14, 38, 37, .82)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  roundedRect(ctx, -43, -43, 86, 86, 14);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = color;
  ctx.font = '600 62px "STKaiti", "KaiTi", "Songti SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, size / 2, size / 2 + 3);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

export function glyphSprite(glyph, color = '#f1d28d', scale = 1.15) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glyphTexture(glyph, color),
    transparent: true,
    depthWrite: false,
    opacity: 0.96,
  }));
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

export function createHalo(color = '#8fe4d3', radius = 1.2, opacity = 0.34) {
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.72, radius, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.04;
  return halo;
}

// 有机团块：给正二十面体加噪声位移，比纯多面体更像树冠/石头
const blobGeometryCache = new Map();

function blobGeometry(radius, seed, detail = 1, squash = 1) {
  const key = `${radius.toFixed(2)}|${seed % 17}|${detail}|${squash}`;
  if (blobGeometryCache.has(key)) return blobGeometryCache.get(key);
  const geometry = new THREE.IcosahedronGeometry(radius, detail);
  const position = geometry.attributes.position;
  const vector = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    vector.fromBufferAttribute(position, i);
    const n = vector.clone().normalize();
    const wobble = 1
      + Math.sin(n.x * 3.1 + seed) * 0.13
      + Math.cos(n.y * 2.7 - seed * 0.7) * 0.11
      + Math.sin(n.z * 4.3 + seed * 1.3) * 0.09;
    vector.multiplyScalar(wobble);
    vector.y *= squash;
    position.setXYZ(i, vector.x, vector.y, vector.z);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  blobGeometryCache.set(key, geometry);
  return geometry;
}

function addRoots(root, height, color) {
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2 + 0.4;
    const rootMesh = mesh(
      root,
      new THREE.ConeGeometry(0.13, 0.55, 5),
      M.bark(color),
      [Math.cos(angle) * 0.24, 0.12, Math.sin(angle) * 0.24],
      [Math.PI * 0.42, angle, 0],
    );
    rootMesh.scale.set(1, 1, 0.7);
    rootMesh.castShadow = false;
  }
}

export function createTree(type = 'broadleaf', colors = {}, seed = 1) {
  const rng = mulberry32(seed);
  const root = new THREE.Group();
  const trunkColor = colors.trunk ?? '#6b4d37';
  const leafColor = colors.leaf ?? '#4f8c62';
  const accent = colors.accent ?? '#7dab73';
  const deep = colors.deep ?? '#3d6f52';

  if (type === 'pine') {
    const h = 3.1 + rng() * 1.4;
    addRoots(root, h, trunkColor);
    mesh(root, new THREE.CylinderGeometry(0.13, 0.32, h, 8), M.bark(trunkColor), [0, h / 2, 0]);
    const tiers = 6;
    for (let i = 0; i < tiers; i += 1) {
      const t = i / (tiers - 1);
      const y = h * 0.34 + i * (h * 0.13);
      const radius = (1.16 - t * 0.86) * (0.92 + rng() * 0.16);
      const coneHeight = 1.15 - t * 0.35;
      const cone = mesh(
        root,
        new THREE.ConeGeometry(radius, coneHeight, 9, 2),
        M.leaf(i % 3 === 0 ? accent : i % 3 === 1 ? leafColor : deep),
        [(rng() - 0.5) * 0.1, y + coneHeight * 0.42, (rng() - 0.5) * 0.1],
        [0, rng() * Math.PI, 0],
      );
      cone.scale.set(1, 1, 1);
    }
    mesh(root, new THREE.ConeGeometry(0.17, 0.5, 7), M.leaf(accent), [0, h * 1.14, 0]);
  } else if (type === 'bamboo') {
    const clump = 7;
    for (let i = 0; i < clump; i += 1) {
      const offsetX = (rng() - 0.5) * 1.35;
      const offsetZ = (rng() - 0.5) * 1.35;
      const h = 3.8 + rng() * 2.6;
      const lean = (rng() - 0.5) * 0.1;
      const stem = mesh(root, new THREE.CylinderGeometry(0.05, 0.085, h, 7), material('#6f9a62', { roughness: 0.88, texture: 'wood', textureScale: 2 }), [offsetX, h / 2, offsetZ], [lean, 0, lean * 0.6]);
      stem.castShadow = true;
      for (let j = 1; j < 5; j += 1) {
        mesh(root, new THREE.CylinderGeometry(0.062, 0.064, 0.05, 7), material('#5a8053', { roughness: 0.9 }), [offsetX + lean * (h / 5) * j * 0.3, (h / 5) * j, offsetZ]);
      }
      for (let j = 0; j < 7; j += 1) {
        const angle = rng() * Math.PI * 2;
        const leaf = mesh(
          root,
          blobGeometry(0.34 + rng() * 0.14, seed + i * 3 + j, 0, 0.24),
          M.leaf(j % 2 ? '#8fb66d' : '#719a58'),
          [offsetX + Math.cos(angle) * (0.35 + rng() * 0.7), h * (0.55 + rng() * 0.4), offsetZ + Math.sin(angle) * (0.35 + rng() * 0.7)],
          [rng() * 0.5, angle, rng() * 0.4],
        );
        leaf.scale.set(1.7, 1, 0.55);
        leaf.castShadow = false;
      }
    }
  } else if (type === 'palm') {
    const h = 3.3 + rng() * 1.1;
    const segments = 7;
    for (let i = 0; i < segments; i += 1) {
      const t = i / segments;
      const y = (h / segments) * i;
      const bend = Math.pow(t, 1.7) * 0.85;
      mesh(
        root,
        new THREE.CylinderGeometry(0.1 - i * 0.007, 0.17 - i * 0.009, h / segments + 0.06, 8),
        M.bark('#9b7a52'),
        [bend, y + h / segments / 2, 0],
        [0, 0, -bend * 0.32],
      );
    }
    const crown = group(root, [0.85, h - 0.12, 0]);
    for (let i = 0; i < 11; i += 1) {
      const angle = (i / 11) * Math.PI * 2 + rng() * 0.2;
      const frond = group(crown, [0, 0, 0], [0, angle, 0]);
      const blade = mesh(frond, new THREE.ConeGeometry(0.42, 2.05, 4, 1, true), M.leaf(i % 2 ? '#61956a' : '#79a871'), [0, -0.12, 1.0], [Math.PI / 2 - 0.22, 0, 0], [1, 1, 0.16]);
      blade.castShadow = false;
      const tip = mesh(frond, new THREE.ConeGeometry(0.2, 1.1, 4, 1, true), M.leaf(i % 3 ? '#6ba073' : '#8bb47c'), [0, -0.5, 1.95], [Math.PI / 2 + 0.55, 0, 0], [1, 1, 0.15]);
      tip.castShadow = false;
    }
    for (let i = 0; i < 4; i += 1) {
      mesh(crown, new THREE.SphereGeometry(0.12, 7, 6), M.bark('#5c4028'), [0.22 * (rng() - 0.5) - 0.1, -0.16, 0.2 * (rng() - 0.5)]);
    }
  } else if (type === 'giant') {
    const h = 5.2 + rng() * 0.9;
    addRoots(root, h, '#57402f');
    const trunk = mesh(root, new THREE.CylinderGeometry(0.36, 0.95, h, 10), M.bark('#57402f'), [0, h / 2, 0]);
    trunk.geometry.translate(0, 0, 0);
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2 + 0.6;
      mesh(root, new THREE.CylinderGeometry(0.12, 0.26, 1.9, 6), M.bark('#5c4531'), [Math.cos(angle) * 0.62, h * 0.72, Math.sin(angle) * 0.62], [Math.sin(angle) * 0.5, 0, -Math.cos(angle) * 0.5]);
    }
    const crown = group(root, [0, h - 0.1, 0]);
    for (let i = 0; i < 11; i += 1) {
      const angle = (i / 11) * Math.PI * 2;
      const radius = 0.8 + (i % 4) * 0.42;
      mesh(
        crown,
        blobGeometry(1.15 + rng() * 0.55, seed + i, 1, 0.8),
        M.leaf(i % 3 === 0 ? accent : i % 3 === 1 ? leafColor : deep),
        [Math.cos(angle) * radius, rng() * 1.5, Math.sin(angle) * radius],
        [rng(), rng() * 3, rng()],
      );
    }
    mesh(crown, blobGeometry(1.9, seed + 31, 1, 0.78), M.leaf(leafColor), [0, 1.9, 0]);
  } else {
    const h = 2.8 + rng() * 1.5;
    const bend = (rng() - 0.5) * 0.4;
    addRoots(root, h, trunkColor);
    mesh(root, new THREE.CylinderGeometry(0.15, 0.34, h, 8), M.bark(trunkColor), [bend, h / 2, 0], [0, 0, -bend * 0.22]);
    for (let i = 0; i < 3; i += 1) {
      const angle = (i / 3) * Math.PI * 2 + rng();
      mesh(
        root,
        new THREE.CylinderGeometry(0.055, 0.12, 1.15, 5),
        M.bark(trunkColor),
        [bend + Math.cos(angle) * 0.34, h * 0.72, Math.sin(angle) * 0.34],
        [Math.sin(angle) * 0.55, 0, -Math.cos(angle) * 0.55],
      );
    }
    const crown = group(root, [bend, h * 0.84, 0]);
    const clusters = 8;
    for (let i = 0; i < clusters; i += 1) {
      const angle = (i / clusters) * Math.PI * 2 + rng() * 0.6;
      const radius = 0.55 + (i % 3) * 0.34 + rng() * 0.25;
      mesh(
        crown,
        blobGeometry(0.72 + rng() * 0.42, seed + i, 1, 0.88),
        M.leaf(i % 3 === 0 ? accent : i % 3 === 1 ? leafColor : deep),
        [Math.cos(angle) * radius, rng() * 1.15, Math.sin(angle) * radius],
        [rng() * 0.6, rng() * Math.PI, rng() * 0.5],
      );
    }
    mesh(crown, blobGeometry(1.08, seed + 21, 1, 0.9), M.leaf(leafColor), [0, 1.25, 0], [0, rng() * 3, 0]);
    mesh(crown, blobGeometry(0.8, seed + 22, 1, 0.9), M.leaf(accent), [0.5, 1.72, -0.3], [0, rng() * 3, 0]);
  }
  root.userData.sway = { amount: 0.05 + rng() * 0.025, speed: 0.7 + rng() * 0.5, phase: rng() * Math.PI * 2 };
  const shadowRadius = type === 'giant' ? 2.4 : type === 'palm' ? 1.5 : 1.6 + rng() * 0.4;
  root.add(createContactShadow(shadowRadius, 0.26, 0.025));
  return root;
}

export function createRock(seed = 1, color = '#8f938b', size = 1) {
  const rng = mulberry32(seed);
  const root = new THREE.Group();
  const rockMat = material(color, { roughness: 0.96, texture: 'stone', textureScale: 1.6, bumpScale: 0.1 });
  const mossMat = material('#6d8a5c', { roughness: 1, texture: 'leaf', bumpScale: 0.05 });
  const base = mesh(
    root,
    blobGeometry(size, seed, 1, 0.72 + rng() * 0.18),
    rockMat,
    [0, size * 0.58, 0],
    [rng() * 0.4, rng() * Math.PI, rng() * 0.35],
    [1 + rng() * 0.3, 1, 0.9 + rng() * 0.3],
  );
  base.receiveShadow = true;
  // 碎块让石头有「堆」的感觉，而不是一颗球
  for (let i = 0; i < 3; i += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = size * (0.62 + rng() * 0.42);
    const chunk = mesh(
      root,
      blobGeometry(size * (0.16 + rng() * 0.2), seed + i + 4, 1, 0.78),
      rockMat,
      [Math.cos(angle) * radius, size * (0.14 + rng() * 0.14), Math.sin(angle) * radius],
      [rng(), rng() * 3, rng()],
    );
    chunk.castShadow = false;
  }
  // 顶上一片苔藓
  if (rng() > 0.35) {
    const moss = mesh(root, blobGeometry(size * 0.72, seed + 9, 1, 0.22), mossMat, [(rng() - 0.5) * 0.24, size * 0.98, (rng() - 0.5) * 0.24], [0, rng() * 3, 0]);
    moss.castShadow = false;
  }
  root.add(createContactShadow(size * 1.7, 0.24, 0.025));
  return root;
}

export function createBush(seed = 1, berry = true) {
  const rng = mulberry32(seed);
  const root = new THREE.Group();
  for (let i = 0; i < 5; i += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = rng() * 0.5;
    mesh(
      root,
      blobGeometry(0.42 + rng() * 0.24, seed + i, 1, 0.78),
      M.leaf(i === 1 ? '#5a9366' : i === 3 ? '#3f7452' : '#4f845e'),
      [Math.cos(angle) * radius, 0.3 + rng() * 0.26, Math.sin(angle) * radius],
      [rng() * 0.4, rng() * 3, rng() * 0.4],
    );
  }
  if (berry) {
    for (let i = 0; i < 8; i += 1) {
      mesh(root, new THREE.SphereGeometry(0.07, 7, 6), material(i % 2 ? '#b9545a' : '#d87976', { roughness: 0.55 }), [(rng() - 0.5) * 0.95, 0.36 + rng() * 0.4, (rng() - 0.5) * 0.95], [0, 0, 0], [1, 1, 1], false);
    }
  }
  root.add(createContactShadow(0.95, 0.22, 0.02));
  return root;
}

export function createCrystalCluster(seed = 1, color = '#82d9cb') {
  const rng = mulberry32(seed);
  const root = new THREE.Group();
  const crystalMat = material(color, { roughness: 0.18, metalness: 0.08, emissive: color, emissiveIntensity: 0.32 });
  for (let i = 0; i < 5; i += 1) {
    const height = 0.55 + rng() * 1.2;
    const shard = mesh(root, new THREE.ConeGeometry(0.16 + rng() * 0.16, height, 5), crystalMat, [(rng() - 0.5) * 0.9, height * 0.5, (rng() - 0.5) * 0.8], [(rng() - 0.5) * 0.4, rng() * 3, (rng() - 0.5) * 0.35]);
    shard.material = crystalMat;
  }
  const glow = glowSprite(color, 2.2, 0.35);
  glow.position.y = 0.8;
  root.add(glow);
  return root;
}

export function createMushroom(seed = 1, giant = false, color = '#d995a4') {
  const rng = mulberry32(seed);
  const root = new THREE.Group();
  const scale = giant ? 2.3 + rng() * 1.4 : 0.6 + rng() * 0.5;
  mesh(root, new THREE.CylinderGeometry(0.11 * scale, 0.18 * scale, 0.8 * scale, 7), M.bark('#d8c7a0'), [0, 0.4 * scale, 0], [0.06, 0, (rng() - 0.5) * 0.16]);
  const cap = mesh(root, new THREE.SphereGeometry(0.55 * scale, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), material(color, { roughness: 0.78, emissive: color, emissiveIntensity: 0.11 }), [0, 0.86 * scale, 0], [0, rng() * 2, 0], [1.2, 0.55, 1.2]);
  for (let i = 0; i < 5; i += 1) {
    const dot = mesh(root, new THREE.SphereGeometry(0.055 * scale, 5, 4), material('#f4e4c8', { emissive: '#f4e4c8', emissiveIntensity: 0.3 }), [(rng() - 0.5) * 0.8 * scale, 1.0 * scale + rng() * 0.12 * scale, (rng() - 0.5) * 0.8 * scale], [0, 0, 0], [1, 0.4, 1], false);
    dot.castShadow = false;
  }
  if (giant) {
    const glow = glowSprite(color, 3.2, 0.22);
    glow.position.y = scale;
    root.add(glow);
  }
  return root;
}

export function createFlowerPatch(seed = 1, colors = ['#f3b7b4', '#efce87', '#b7c7e7']) {
  const rng = mulberry32(seed);
  const root = new THREE.Group();
  for (let i = 0; i < 9; i += 1) {
    const color = colors[Math.floor(rng() * colors.length)];
    const x = (rng() - 0.5) * 1.6;
    const z = (rng() - 0.5) * 1.6;
    const h = 0.15 + rng() * 0.15;
    mesh(root, new THREE.CylinderGeometry(0.015, 0.02, h, 3), M.leaf('#668757'), [x, h / 2, z], [0, 0, 0], [1, 1, 1], false);
    mesh(root, new THREE.OctahedronGeometry(0.09 + rng() * 0.06, 0), material(color, { roughness: 0.8 }), [x, h + 0.04, z], [0, rng() * 2, 0], [1, 0.55, 1], false);
  }
  return root;
}

export function createGrassTuft(seed = 1, color = '#6f9a64') {
  const rng = mulberry32(seed);
  const root = new THREE.Group();
  const mat = material(color, { roughness: 1, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i += 1) {
    const blade = mesh(root, new THREE.ConeGeometry(0.04, 0.28 + rng() * 0.2, 3), mat, [(rng() - 0.5) * 0.18, 0.14, (rng() - 0.5) * 0.18], [0.1 * (rng() - 0.5), rng() * 3, 0.25 * (rng() - 0.5)], [1, 1, 0.3], false);
    blade.castShadow = false;
  }
  return root;
}

export function createReeds(seed = 1) {
  const rng = mulberry32(seed);
  const root = new THREE.Group();
  for (let i = 0; i < 7; i += 1) {
    const h = 0.7 + rng() * 0.9;
    mesh(root, new THREE.CylinderGeometry(0.012, 0.02, h, 3), M.leaf('#78906a'), [(rng() - 0.5) * 0.7, h / 2, (rng() - 0.5) * 0.7], [0, 0, (rng() - 0.5) * 0.25], [1, 1, 1], false);
    if (rng() > 0.55) {
      mesh(root, new THREE.CylinderGeometry(0.04, 0.04, 0.18, 5), M.bark('#6e4e36'), [(rng() - 0.5) * 0.7, h - 0.05, (rng() - 0.5) * 0.7], [0, 0, 0], [1, 1, 1], false);
    }
  }
  return root;
}

export function createCloud(scale = 1) {
  const root = new THREE.Group();
  const mat = material('#f2ecdb', { roughness: 1, transparent: true, opacity: 0.82, depthWrite: false });
  const count = 4;
  for (let i = 0; i < count; i += 1) {
    mesh(root, new THREE.DodecahedronGeometry(1.4 + Math.random() * 0.8, 0), mat, [(i - count / 2) * 1.4, Math.random() * 0.5, Math.random() * 0.7], [0, 0, 0], [1.2, 0.62, 0.9], false);
  }
  root.scale.setScalar(scale);
  return root;
}

export function createCharacter(config = {}) {
  const {
    robe = '#4d7c6b',
    robeDark = '#365d51',
    trim = '#e4c27d',
    skin = '#eac3a0',
    hair = '#4b382c',
    hat = null,
    scarf = null,
    backpack = false,
    boots = '#4d3c2f',
    staff = false,
  } = config;
  const root = new THREE.Group();
  const visual = group(root);
  const robeMat = material(robe, { roughness: 0.92 });
  const robeDarkMat = material(robeDark, { roughness: 0.92 });
  const skinMat = material(skin, { roughness: 0.9 });
  const hairMat = material(hair, { roughness: 0.95 });
  const trimMat = material(trim, { roughness: 0.6, metalness: 0.08 });
  const bootMat = material(boots, { roughness: 0.95 });

  const body = mesh(visual, new THREE.CylinderGeometry(0.2, 0.34, 0.68, 7), robeMat, [0, 0.66, 0]);
  mesh(visual, new THREE.ConeGeometry(0.36, 0.25, 7), robeDarkMat, [0, 0.3, 0], [0, Math.PI / 7, 0]);
  mesh(visual, new THREE.CylinderGeometry(0.22, 0.23, 0.11, 7), trimMat, [0, 0.94, 0]);
  const head = mesh(visual, new THREE.SphereGeometry(0.26, 9, 8), skinMat, [0, 1.17, 0]);
  head.scale.set(0.95, 1.03, 0.92);
  mesh(visual, new THREE.SphereGeometry(0.275, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.56), hairMat, [0, 1.22, -0.015], [0.06, 0, 0]);
  mesh(visual, new THREE.SphereGeometry(0.035, 5, 4), material('#28322e'), [0.085, 1.19, 0.235], [0, 0, 0], [1, 1, 0.7], false);
  mesh(visual, new THREE.SphereGeometry(0.035, 5, 4), material('#28322e'), [-0.085, 1.19, 0.235], [0, 0, 0], [1, 1, 0.7], false);
  mesh(visual, new THREE.BoxGeometry(0.13, 0.026, 0.025), material('#b57469', { roughness: 0.9 }), [0, 1.07, 0.238], [0, 0, 0], [1, 1, 1], false);

  const legLeft = group(visual, [0.12, 0.34, 0]);
  const legRight = group(visual, [-0.12, 0.34, 0]);
  [legLeft, legRight].forEach((leg) => {
    mesh(leg, new THREE.CylinderGeometry(0.06, 0.07, 0.3, 5), robeDarkMat, [0, -0.17, 0]);
    const foot = mesh(leg, new THREE.BoxGeometry(0.14, 0.12, 0.25), bootMat, [0, -0.34, 0.055]);
    foot.geometry.translate(0, 0, 0);
  });

  const armLeft = group(visual, [0.29, 0.9, 0]);
  const armRight = group(visual, [-0.29, 0.9, 0]);
  [armLeft, armRight].forEach((arm, index) => {
    mesh(arm, new THREE.CylinderGeometry(0.055, 0.06, 0.34, 5), robeMat, [0, -0.16, 0], [0, 0, 0]);
    mesh(arm, new THREE.SphereGeometry(0.065, 6, 5), skinMat, [0, -0.35, 0.01], [0, 0, 0], [1, 1, 1], false);
    arm.rotation.z = index === 0 ? 0.12 : -0.12;
  });

  if (scarf) {
    const scarfMat = material(scarf, { roughness: 0.86 });
    mesh(visual, new THREE.TorusGeometry(0.21, 0.055, 5, 12), scarfMat, [0, 0.97, 0], [Math.PI / 2, 0, 0]);
    const tail = group(visual, [0.12, 0.9, -0.13]);
    mesh(tail, new THREE.BoxGeometry(0.11, 0.42, 0.035), scarfMat, [0, -0.18, 0], [0.15, 0, 0.18]);
    tail.userData.sway = true;
  }

  if (backpack) {
    const pack = mesh(visual, new THREE.BoxGeometry(0.36, 0.42, 0.2), material('#7a5c3f', { roughness: 0.95 }), [0, 0.7, -0.3]);
    mesh(visual, new THREE.BoxGeometry(0.32, 0.11, 0.21), M.bark('#59432f'), [0, 0.79, -0.31]);
    mesh(pack, new THREE.TorusGeometry(0.15, 0.025, 4, 12, Math.PI), trimMat, [0, 0.23, 0.1], [0, 0, 0], [1, 1, 1], false);
    const scroll = mesh(visual, new THREE.CylinderGeometry(0.035, 0.035, 0.37, 6), material('#e7d9bb'), [0.2, 0.69, -0.35], [0.1, 0, Math.PI / 2.4]);
    scroll.castShadow = false;
  }

  if (hat === 'straw') {
    const hatMat = material('#cda76a', { roughness: 0.95 });
    mesh(visual, new THREE.CylinderGeometry(0.46, 0.5, 0.035, 12), hatMat, [0, 1.4, 0], [0.04, 0, 0]);
    mesh(visual, new THREE.ConeGeometry(0.26, 0.24, 9), hatMat, [0, 1.54, 0]);
    mesh(visual, new THREE.TorusGeometry(0.22, 0.022, 4, 12), trimMat, [0, 1.43, 0], [Math.PI / 2, 0, 0], [1, 1, 1], false);
  } else if (hat === 'conical') {
    mesh(visual, new THREE.ConeGeometry(0.43, 0.34, 10), material('#b58d5e', { roughness: 0.95 }), [0, 1.44, 0], [0.04, 0.2, 0]);
    mesh(visual, new THREE.CylinderGeometry(0.46, 0.47, 0.025, 12), trimMat, [0, 1.31, 0], [0.04, 0, 0]);
  } else if (hat === 'cap') {
    mesh(visual, new THREE.SphereGeometry(0.265, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), M.white(), [0, 1.34, 0], [0, 0, 0], [1.06, 0.65, 1.06]);
    mesh(visual, new THREE.BoxGeometry(0.2, 0.03, 0.19), M.white(), [0.16, 1.33, 0.16], [0.1, 0.2, 0]);
  } else if (hat === 'hood') {
    mesh(visual, new THREE.SphereGeometry(0.31, 8, 7, 0, Math.PI * 2, 0, Math.PI * 0.72), robeDarkMat, [0, 1.21, -0.015], [0.02, 0, 0]);
  }

  if (staff) {
    const staffGroup = group(visual, [0.39, 0.62, 0.04]);
    staffGroup.rotation.z = -0.08;
    mesh(staffGroup, new THREE.CylinderGeometry(0.035, 0.045, 1.75, 6), M.bark('#6e513d'), [0, 0.3, 0]);
    const glow = mesh(staffGroup, new THREE.OctahedronGeometry(0.12, 0), M.crystal(), [0, 1.18, 0], [0, 0, 0], [1, 1.4, 1]);
    const halo = glowSprite('#9fe6d4', 0.8, 0.55);
    halo.position.set(0, 1.18, 0);
    staffGroup.add(halo);
  }

  root.userData.rig = { visual, legLeft, legRight, armLeft, armRight, body, head };
  shadows(visual, true, true);
  return root;
}

export function animateCharacter(character, elapsed, speed = 0) {
  const rig = character.userData.rig;
  if (!rig) return;
  const moving = speed > 0.05;
  const phase = elapsed * (6.2 + speed * 2);
  const swing = moving ? Math.sin(phase) * Math.min(0.75, speed / 4) : Math.sin(elapsed * 1.4) * 0.035;
  rig.legLeft.rotation.x = swing;
  rig.legRight.rotation.x = -swing;
  rig.armLeft.rotation.x = -swing * 0.8;
  rig.armRight.rotation.x = swing * 0.8;
  rig.visual.position.y = moving ? Math.abs(Math.sin(phase)) * 0.055 : Math.sin(elapsed * 1.7) * 0.012;
  rig.body.rotation.z = moving ? Math.sin(phase) * 0.02 : 0;
}

export function createDock(broken = false, accent = '#d7b56f') {
  const root = new THREE.Group();
  const wood = M.wood();
  const dark = M.woodDark();
  const len = 9;
  for (let i = 0; i < len; i += 1) {
    if (broken && i > 2 && i < 6) continue;
    const y = 1.02 - i * 0.035;
    const z = i * 1.15;
    mesh(root, new THREE.BoxGeometry(2.55, 0.12, 1.0), i % 3 ? wood : material('#987250', { roughness: 0.95 }), [0, y, z], [0.02 * (i % 2 ? 1 : -1), 0, 0]);
  }
  [0, 3, 6, 8.5].forEach((z) => {
    if (broken && z > 2.2 && z < 6.5) return;
    mesh(root, new THREE.CylinderGeometry(0.13, 0.16, 3.5, 6), dark, [1.25, 0.4, z], [0.03, 0, 0.08]);
    mesh(root, new THREE.CylinderGeometry(0.13, 0.16, 3.5, 6), dark, [-1.25, 0.4, z], [-0.03, 0, -0.08]);
    mesh(root, new THREE.CylinderGeometry(0.06, 0.06, 2.5, 5), material('#d0b88a', { roughness: 0.94 }), [1.25, 1.45, z], [0, 0, Math.PI / 2 + 0.04]);
  });
  if (broken) {
    mesh(root, new THREE.BoxGeometry(0.15, 1.5, 0.15), dark, [1.25, 1.2, 3.2], [0.4, 0, -0.45]);
    mesh(root, new THREE.BoxGeometry(0.15, 1.2, 0.15), dark, [-1.25, 1.0, 3.4], [-0.2, 0, 0.35]);
    const flag = mesh(root, new THREE.PlaneGeometry(1.1, 0.65), material('#e4d6b8', { side: THREE.DoubleSide, roughness: 0.9 }), [1.25, 2.1, 3.2], [0, 0.4, -0.2]);
    flag.castShadow = false;
  } else {
    mesh(root, new THREE.CylinderGeometry(0.1, 0.13, 2.8, 6), dark, [-2.0, 1.95, 7.9]);
    mesh(root, new THREE.BoxGeometry(1.3, 0.75, 0.12), acaciaMaterial(accent), [-1.35, 2.8, 7.9], [0, 0.2, 0]);
    const lantern = glowSprite('#ffd9a1', 1.1, 0.55);
    lantern.position.set(-2.0, 3.1, 7.9);
    root.add(lantern);
  }
  const ropeMat = material('#b8a27a', { roughness: 1 });
  for (let i = 0; i < 9; i += 1) {
    if (broken && i > 2 && i < 6) continue;
    mesh(root, new THREE.TorusGeometry(0.15, 0.025, 4, 8), ropeMat, [1.31, 1.05 - i * 0.035, i * 1.15], [0, Math.PI / 2, 0], [1, 1, 1], false);
  }
  return root;
}

function acaciaMaterial(color) {
  return material(color, { roughness: 0.7, metalness: 0.08 });
}

export function createTent() {
  const root = new THREE.Group();
  const canvasMat = material('#d7c7a5', { roughness: 0.98, side: THREE.DoubleSide });
  const darkMat = material('#8e795d', { roughness: 0.98 });
  mesh(root, new THREE.ConeGeometry(2.2, 2.4, 4), canvasMat, [0, 1.2, 0], [0, Math.PI / 4, 0]);
  mesh(root, new THREE.CircleGeometry(0.72, 5), darkMat, [0, 0.72, 1.35], [0, 0, 0], [1, 1, 1], false);
  mesh(root, new THREE.CylinderGeometry(0.045, 0.055, 3.1, 5), M.woodDark(), [0, 1.5, 0]);
  mesh(root, new THREE.PlaneGeometry(1.8, 0.9), material('#b69769', { roughness: 1, side: THREE.DoubleSide }), [0, 0.45, 1.5], [-0.2, 0, 0]);
  mesh(root, new THREE.BoxGeometry(1.5, 0.06, 0.65), M.woodDark(), [0, 0.12, 1.9], [0, 0.1, 0]);
  const lantern = glowSprite('#ffcea1', 0.85, 0.6);
  lantern.position.set(-0.75, 1.15, 0.75);
  root.add(lantern);
  return root;
}

export function createMailbox() {
  const root = new THREE.Group();
  mesh(root, new THREE.CylinderGeometry(0.09, 0.12, 1.25, 5), M.woodDark(), [0, 0.63, 0]);
  mesh(root, new THREE.BoxGeometry(0.68, 0.5, 0.42), M.wood(), [0, 1.35, 0]);
  mesh(root, new THREE.CylinderGeometry(0.34, 0.34, 0.68, 8, 1, false, 0, Math.PI), material('#8b5c43'), [0, 1.6, 0], [0, 0, Math.PI / 2]);
  const flag = mesh(root, new THREE.BoxGeometry(0.04, 0.42, 0.15), material('#c8775d'), [0.37, 1.55, 0.02]);
  flag.rotation.z = -0.35;
  mesh(root, new THREE.BoxGeometry(0.38, 0.03, 0.36), M.woodDark(), [0, 1.08, 0.14]);
  const envelope = mesh(root, new THREE.BoxGeometry(0.26, 0.02, 0.16), M.white(), [0.1, 1.11, 0.15], [0, 0.3, 0]);
  envelope.castShadow = false;
  return root;
}

export function createFarmPlot(plot, crop = null, growth = 0, accent = '#e5c981') {
  const root = new THREE.Group();
  root.position.set(plot.x, 1.12, plot.z);
  root.userData.plotId = plot.id;
  const soil = mesh(root, new THREE.BoxGeometry(2.15, 0.16, 1.55), M.soil(), [0, 0.02, 0], [0, 0, 0], [1, 1, 1]);
  soil.receiveShadow = true;
  for (let i = -2; i <= 2; i += 1) {
    mesh(root, new THREE.BoxGeometry(0.035, 0.25, 1.55), material('#5f432e'), [i * 0.4, 0.1, 0], [0, 0, 0], [1, 1, 1], false);
  }
  [[0, -0.83], [0, 0.83]].forEach(([x, z]) => {
    mesh(root, new THREE.BoxGeometry(2.28, 0.2, 0.12), M.woodLight(), [x, 0.17, z]);
  });
  [[-1.08, 0], [1.08, 0]].forEach(([x, z]) => {
    mesh(root, new THREE.BoxGeometry(0.12, 0.2, 1.65), M.woodLight(), [x, 0.17, z]);
  });
  if (crop) {
    const cropGroup = new THREE.Group();
    root.add(cropGroup);
    const height = growth > 0.55 ? 0.75 : growth > 0.25 ? 0.4 : 0.18;
    const leafMat = M.leaf(growth > 0.8 ? '#5b9c56' : '#73a866');
    for (let row = -1; row <= 1; row += 1) {
      for (let col = -2; col <= 2; col += 1) {
        const x = col * 0.36;
        const z = row * 0.42;
        const jitter = ((row + 2) * 5 + (col + 2)) * 0.07;
        mesh(cropGroup, new THREE.CylinderGeometry(0.018, 0.026, height, 4), M.leaf('#648b54'), [x, height / 2, z], [0, 0, Math.sin(jitter) * 0.1], [1, 1, 1], false);
        if (growth > 0.35) {
          mesh(cropGroup, new THREE.SphereGeometry(0.12, 5, 4), leafMat, [x + Math.sin(jitter) * 0.12, height * 0.8, z], [0, 0, 0.5], [1.8, 0.55, 0.8], false);
          mesh(cropGroup, new THREE.SphereGeometry(0.11, 5, 4), leafMat, [x - Math.sin(jitter) * 0.12, height * 0.7, z], [0, 0, -0.5], [1.8, 0.55, 0.8], false);
        }
        if (growth >= 0.85) {
          const cropInfo = crop === 'radish' ? { color: '#e88f83', y: 0.23, scale: 0.08 } : crop === 'moonberry' ? { color: '#9b89dd', y: 0.47, scale: 0.09 } : { color: '#8de1d3', y: 0.58, scale: 0.1, glow: true };
          const fruit = mesh(cropGroup, new THREE.OctahedronGeometry(cropInfo.scale, 0), material(cropInfo.color, { roughness: 0.55, emissive: cropInfo.glow ? cropInfo.color : '#000', emissiveIntensity: 0.6 }), [x, cropInfo.y, z], [0.3, 0.2, 0], [1, 1.2, 1], false);
          if (crop === 'lotus') {
            const glow = glowSprite(cropInfo.color, 0.42, 0.45);
            glow.position.set(x, cropInfo.y, z);
            cropGroup.add(glow);
          }
          fruit.castShadow = false;
        }
      }
    }
    if (growth >= 0.85) {
      const ready = glowSprite(accent, 1.5, 0.24);
      ready.position.set(0, 0.8, 0);
      cropGroup.add(ready);
    }
  } else {
    for (let i = 0; i < 4; i += 1) {
      mesh(root, new THREE.SphereGeometry(0.045, 4, 3), material('#a98b67'), [(-0.7 + i * 0.45), 0.12, (i % 2 - 0.5) * 0.6], [0, 0, 0], [1, 0.6, 1], false);
    }
  }
  return root;
}

export function createCropIcon(cropId, color = '#e98b83') {
  const root = new THREE.Group();
  mesh(root, new THREE.CylinderGeometry(0.02, 0.025, 0.5, 4), M.leaf(), [0, 0.25, 0]);
  mesh(root, new THREE.SphereGeometry(0.16, 7, 5), material(color, { roughness: 0.65 }), [0, 0.15, 0], [0.2, 0, 0.4], [1, 0.9, 1]);
  for (let i = 0; i < 3; i += 1) {
    mesh(root, new THREE.SphereGeometry(0.09, 5, 4), M.leaf('#6a9c5f'), [Math.cos(i * 2.1) * 0.15, 0.34 + i * 0.04, Math.sin(i * 2.1) * 0.15], [0.4, 0, 0.4], [1.4, 0.3, 0.7], false);
  }
  return root;
}

export function createTrialMonument(style = 'wen', color = '#e3ce9d', main = true) {
  const root = new THREE.Group();
  const stoneMat = material(style === 'shu' ? '#ded7c5' : style === 'hua' ? '#756480' : '#727b70', { roughness: 0.92 });
  const accentMat = material(color, { roughness: 0.36, metalness: 0.24 });
  const glow = glowSprite(color, main ? 4.2 : 2.8, 0.35);
  glow.position.y = 2.7;
  root.add(glow);
  if (style === 'wen') {
    mesh(root, new THREE.CylinderGeometry(0.9, 1.3, 0.35, 7), stoneMat, [0, 0.17, 0]);
    const tablet = mesh(root, new THREE.BoxGeometry(1.3, 2.5, 0.34), stoneMat, [0, 1.45, 0], [0.02, 0.1, -0.04]);
    tablet.rotation.z = 0.03;
    mesh(root, new THREE.BoxGeometry(1.12, 0.06, 0.4), accentMat, [0, 0.5, 0]);
    mesh(root, new THREE.BoxGeometry(1.03, 0.06, 0.4), accentMat, [0, 1.65, 0]);
    mesh(root, new THREE.CylinderGeometry(0.045, 0.045, 2.2, 5), M.woodDark(), [0.88, 1.2, 0], [0, 0, 0.1]);
    const brush = mesh(root, new THREE.ConeGeometry(0.16, 1.5, 6), material('#3c4440'), [0.95, 2.1, 0], [0.05, 0, 0.15]);
    brush.castShadow = false;
    const scroll = group(root, [0, 2.85, 0]);
    mesh(scroll, new THREE.CylinderGeometry(0.17, 0.17, 1.5, 6), M.white(), [0, 0, 0], [0, 0, Math.PI / 2]);
    const ribbon = mesh(scroll, new THREE.PlaneGeometry(0.55, 1.35), material('#e4d6b7', { side: THREE.DoubleSide }), [0.15, 0, 0.02]);
    ribbon.castShadow = false;
    root.userData.tick = (t) => {
      scroll.rotation.y = t * 0.18;
      scroll.position.y = 2.85 + Math.sin(t * 1.1) * 0.1;
      glow.material.opacity = 0.25 + Math.sin(t * 1.5) * 0.07;
    };
  } else if (style === 'shu') {
    mesh(root, new THREE.CylinderGeometry(1.2, 1.45, 0.32, 8), stoneMat, [0, 0.16, 0]);
    mesh(root, new THREE.BoxGeometry(0.55, 2.8, 0.55), stoneMat, [-0.62, 1.5, 0], [0, 0, 0.02]);
    mesh(root, new THREE.BoxGeometry(0.55, 2.3, 0.55), stoneMat, [0.64, 1.25, 0], [0, 0, -0.03]);
    mesh(root, new THREE.BoxGeometry(1.85, 0.26, 0.7), stoneMat, [0, 2.84, 0]);
    const orb = mesh(root, new THREE.IcosahedronGeometry(0.65, 1), material(color, { roughness: 0.22, metalness: 0.2, emissive: color, emissiveIntensity: 0.22 }), [0, 2.15, 0.24]);
    const ring = mesh(root, new THREE.TorusGeometry(1.02, 0.025, 4, 48), accentMat, [0, 2.15, 0.2], [0.2, 0, 0]);
    root.userData.tick = (t) => {
      orb.rotation.y = t * 0.35;
      orb.rotation.x = t * 0.12;
      ring.rotation.z = t * 0.22;
      glow.material.opacity = 0.25 + Math.sin(t * 1.2) * 0.08;
    };
  } else if (style === 'wu') {
    mesh(root, new THREE.CylinderGeometry(1.15, 1.35, 0.4, 8), stoneMat, [0, 0.2, 0]);
    const gear = group(root, [0, 1.65, 0], [0.12, 0, 0]);
    mesh(gear, new THREE.TorusGeometry(0.98, 0.18, 5, 16), accentMat);
    for (let i = 0; i < 8; i += 1) {
      mesh(gear, new THREE.BoxGeometry(0.26, 0.42, 0.22), accentMat, [Math.cos((i / 8) * Math.PI * 2) * 1.05, Math.sin((i / 8) * Math.PI * 2) * 1.05, 0], [0, 0, (i / 8) * Math.PI * 2]);
    }
    mesh(gear, new THREE.BoxGeometry(0.5, 0.5, 0.36), stoneMat, [0, 0, 0], [0, 0, Math.PI / 4]);
    const pendulum = group(root, [0, 3.5, 0]);
    mesh(pendulum, new THREE.CylinderGeometry(0.035, 0.035, 1.4, 5), accentMat, [0, -0.7, 0]);
    mesh(pendulum, new THREE.SphereGeometry(0.25, 8, 6), material(color, { metalness: 0.65, roughness: 0.3 }), [0, -1.45, 0]);
    root.userData.tick = (t) => {
      gear.rotation.z = t * 0.2;
      pendulum.rotation.z = Math.sin(t * 1.1) * 0.3;
      glow.material.opacity = 0.22 + Math.sin(t * 2.1) * 0.05;
    };
  } else if (style === 'hua') {
    mesh(root, new THREE.CylinderGeometry(1.1, 1.35, 0.35, 9), stoneMat, [0, 0.17, 0]);
    const flask = group(root, [0, 0.42, 0]);
    mesh(flask, new THREE.SphereGeometry(0.78, 12, 9), material('#b8e0cf', { transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.08 }), [0, 0.65, 0], [0, 0, 0], [1, 1.2, 1]);
    mesh(flask, new THREE.CylinderGeometry(0.28, 0.36, 0.8, 8), material('#b8e0cf', { transparent: true, opacity: 0.5, roughness: 0.12 }), [0, 1.6, 0]);
    mesh(flask, new THREE.CylinderGeometry(0.4, 0.4, 0.12, 8), accentMat, [0, 2.05, 0]);
    for (let i = 0; i < 4; i += 1) {
      const bubble = mesh(flask, new THREE.SphereGeometry(0.06 + i * 0.018, 5, 4), material('#e4c6ed', { transparent: true, opacity: 0.75, emissive: '#8fe5d0', emissiveIntensity: 0.5 }), [(i % 2 - 0.5) * 0.35, 0.35 + i * 0.23, 0.2], [0, 0, 0], [1, 1, 1], false);
      bubble.userData.rise = i * 0.5;
    }
    root.userData.tick = (t) => {
      flask.children.forEach((child) => {
        if (child.userData.rise !== undefined) {
          child.position.y = 0.3 + ((t * 0.24 + child.userData.rise) % 1.15);
          child.position.x = Math.sin(t * 1.4 + child.userData.rise) * 0.28;
        }
      });
      glow.material.opacity = 0.26 + Math.sin(t * 1.4) * 0.08;
    };
  } else if (style === 'sheng') {
    const trunk = mesh(root, new THREE.CylinderGeometry(0.7, 1.15, 2.8, 8), M.bark('#5e6950'), [0, 1.4, 0]);
    mesh(root, new THREE.CylinderGeometry(0.18, 0.32, 1.4, 5), M.bark('#687456'), [-0.82, 2.2, 0], [0, 0, 0.5]);
    const canopy = group(root, [0, 3.0, 0]);
    for (let i = 0; i < 5; i += 1) {
      mesh(canopy, new THREE.DodecahedronGeometry(0.8 + (i % 2) * 0.25, 0), M.leaf(i % 2 ? '#82ad69' : '#5d8b5d'), [Math.cos(i * 1.5) * 0.85, 0.3 + Math.sin(i) * 0.4, Math.sin(i * 1.5) * 0.85], [i, i, i], [1, 0.8, 1]);
    }
    const seeds = group(root, [0, 2.0, 0.5]);
    for (let i = 0; i < 3; i += 1) {
      mesh(seeds, new THREE.SphereGeometry(0.085, 5, 4), material('#e9b27e', { emissive: '#d98755', emissiveIntensity: 0.45 }), [Math.cos(i * 2.1) * 0.65, i * 0.35, Math.sin(i * 2.1) * 0.4], [0, 0, 0], [1, 1.4, 1], false);
    }
    root.userData.tick = (t) => {
      canopy.rotation.y = Math.sin(t * 0.25) * 0.08;
      seeds.rotation.y = t * 0.3;
    };
  } else if (style === 'ying') {
    mesh(root, new THREE.CylinderGeometry(1.0, 1.35, 0.4, 9), stoneMat, [0, 0.2, 0]);
    mesh(root, new THREE.CylinderGeometry(0.22, 0.36, 3.3, 8), material('#e3ddcb'), [0, 1.7, 0]);
    mesh(root, new THREE.CylinderGeometry(0.44, 0.52, 0.35, 8), accentMat, [0, 3.48, 0]);
    mesh(root, new THREE.CylinderGeometry(0.3, 0.44, 0.7, 8), material('#b8d7d8', { emissive: '#87c5c2', emissiveIntensity: 0.3, transparent: true, opacity: 0.7 }), [0, 3.95, 0]);
    mesh(root, new THREE.ConeGeometry(0.55, 0.5, 8), accentMat, [0, 4.55, 0]);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(1.8, 6, 16, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    beam.position.set(0, 3.9, 0);
    beam.rotation.z = Math.PI;
    root.add(beam);
    const ring = mesh(root, new THREE.TorusGeometry(1.3, 0.035, 4, 48), accentMat, [0, 0.55, 0], [Math.PI / 2, 0, 0]);
    root.userData.tick = (t) => {
      ring.rotation.z = t * 0.1;
      beam.rotation.y = t * 0.5;
      glow.material.opacity = 0.2 + Math.sin(t * 1.7) * 0.05;
    };
  } else {
    mesh(root, new THREE.CylinderGeometry(1.2, 1.4, 0.35, 8), stoneMat, [0, 0.17, 0]);
    const table = mesh(root, new THREE.BoxGeometry(2.2, 0.18, 1.2), M.wood(), [0, 1.25, 0]);
    mesh(table, new THREE.CylinderGeometry(0.1, 0.13, 1.15, 5), M.woodDark(), [-0.8, -0.68, -0.35]);
    mesh(table, new THREE.CylinderGeometry(0.1, 0.13, 1.15, 5), M.woodDark(), [0.8, -0.68, -0.35]);
    mesh(table, new THREE.BoxGeometry(0.7, 0.3, 0.5), material('#d7b382'), [0.55, 0.22, 0]);
    mesh(table, new THREE.BoxGeometry(0.45, 0.08, 0.35), M.white(), [-0.6, 0.14, 0.1], [0, 0.2, 0]);
    mesh(table, new THREE.CylinderGeometry(0.05, 0.05, 0.45, 5), M.bark(), [0.2, 0.28, -0.25]);
    const badge = group(root, [0, 2.5, 0]);
    mesh(badge, new THREE.CylinderGeometry(0.55, 0.55, 0.12, 14), accentMat, [0, 0, 0], [Math.PI / 2, 0, 0]);
    mesh(badge, new THREE.TorusGeometry(0.64, 0.04, 4, 24), M.gold(), [0, 0, 0], [0, 0, 0]);
    root.userData.tick = (t) => {
      badge.rotation.z = Math.sin(t * 0.6) * 0.08;
      badge.position.y = 2.5 + Math.sin(t) * 0.06;
    };
  }
  const halo = createHalo(color, main ? 2.1 : 1.4, 0.2);
  halo.position.y = 0.03;
  root.add(halo);
  return root;
}

export function createKnowledgeTree() {
  const root = new THREE.Group();
  const trunk = mesh(root, new THREE.CylinderGeometry(0.4, 0.9, 3.8, 8), M.bark('#5a4533'), [0, 1.9, 0]);
  const branches = [
    [-0.6, 3.1, 0.1, 0.55],
    [0.6, 3.5, -0.2, -0.5],
    [0.1, 4.0, 0.5, 0.2],
  ];
  branches.forEach(([x, y, z, angle]) => {
    mesh(root, new THREE.CylinderGeometry(0.13, 0.25, 1.5, 5), M.bark('#644b37'), [x, y, z], [0.1, 0, angle]);
  });
  for (let i = 0; i < 11; i += 1) {
    const angle = (i / 11) * Math.PI * 2;
    const radius = 1.0 + (i % 4) * 0.33;
    mesh(root, new THREE.DodecahedronGeometry(0.9 + (i % 3) * 0.18, 0), M.leaf(i % 3 ? '#598d61' : '#75a26d'), [Math.cos(angle) * radius, 4.6 + (i % 3) * 0.5, Math.sin(angle) * radius], [i, angle, i * 0.2], [1, 0.8, 1]);
  }
  const tags = [];
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    const tag = group(root, [Math.cos(angle) * 1.5, 3.4 - (i % 3) * 0.4, Math.sin(angle) * 1.5]);
    mesh(tag, new THREE.BoxGeometry(0.33, 0.52, 0.03), material('#e3d2ac', { side: THREE.DoubleSide }), [0, 0, 0]);
    mesh(tag, new THREE.CylinderGeometry(0.008, 0.008, 0.6, 3), material('#b39a6e'), [0, 0.5, 0], [0, 0, 0], [1, 1, 1], false);
    tag.rotation.z = Math.sin(i) * 0.1;
    tags.push(tag);
  }
  const halo = createHalo('#e6cf8e', 2.8, 0.18);
  halo.position.y = 0.03;
  root.add(halo);
  const glow = glowSprite('#f5d89a', 5.5, 0.19);
  glow.position.y = 4;
  root.add(glow);
  root.userData.tick = (t) => {
    tags.forEach((tag, index) => {
      tag.rotation.z = Math.sin(t * 0.8 + index) * 0.14;
    });
    glow.material.opacity = 0.16 + Math.sin(t * 0.9) * 0.04;
  };
  return root;
}

export function createSignpost(text = '栖云', color = '#d8bb7b') {
  const root = new THREE.Group();
  mesh(root, new THREE.CylinderGeometry(0.08, 0.12, 1.7, 5), M.woodDark(), [0, 0.85, 0]);
  const board = mesh(root, new THREE.BoxGeometry(1.25, 0.55, 0.1), M.wood(), [0.2, 1.45, 0], [0, 0.1, 0]);
  mesh(board, new THREE.BoxGeometry(1.1, 0.03, 0.11), material(color), [0, 0.17, 0], [0, 0, 0]);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#eaddc0';
  ctx.font = '600 45px "STKaiti", "KaiTi", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 50);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(1.14, 0.43), new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
  label.material.userData.uniqueTexture = true;
  label.position.set(0, 0, 0.056);
  board.add(label);
  return root;
}

export function createLanternPost(color = '#ffd69b') {
  const root = new THREE.Group();
  mesh(root, new THREE.CylinderGeometry(0.06, 0.09, 2.1, 5), M.woodDark(), [0, 1.05, 0]);
  mesh(root, new THREE.BoxGeometry(0.48, 0.06, 0.06), M.woodDark(), [0.18, 2.05, 0]);
  const lantern = mesh(root, new THREE.CylinderGeometry(0.16, 0.2, 0.34, 6), material('#ffd49a', { emissive: color, emissiveIntensity: 1.5, transparent: true, opacity: 0.9 }), [0.34, 1.87, 0]);
  mesh(root, new THREE.ConeGeometry(0.22, 0.12, 6), M.woodDark(), [0.34, 2.1, 0]);
  const glow = glowSprite(color, 1.1, 0.5);
  glow.position.set(0.34, 1.87, 0);
  root.add(glow);
  root.userData.tick = (t) => {
    lantern.material.emissiveIntensity = 1.2 + Math.sin(t * 3.1) * 0.25;
    glow.material.opacity = 0.42 + Math.sin(t * 2.3) * 0.1;
  };
  return root;
}

export function createBoat(color = '#d8b16d') {
  const root = new THREE.Group();
  mesh(root, new THREE.CylinderGeometry(0.9, 0.35, 4.2, 8, 1, true), material('#6b4e37', { side: THREE.DoubleSide, roughness: 0.95 }), [0, 0.35, 0], [Math.PI / 2, 0, 0], [1, 0.65, 1]);
  mesh(root, new THREE.BoxGeometry(1.3, 0.12, 3), M.woodLight(), [0, 0.55, 0.1]);
  mesh(root, new THREE.CylinderGeometry(0.06, 0.08, 3.4, 5), M.woodDark(), [0, 2, 0]);
  const sail = mesh(root, new THREE.PlaneGeometry(2.2, 2.1), material(color, { side: THREE.DoubleSide, roughness: 0.9 }), [0.5, 2.1, 0], [0, 0.3, 0.1]);
  sail.castShadow = false;
  mesh(root, new THREE.BoxGeometry(0.9, 0.08, 0.12), M.woodDark(), [0, 1.0, -1.4]);
  const glow = glowSprite('#ffd59a', 0.8, 0.45);
  glow.position.set(0, 1.1, 1.25);
  root.add(glow);
  root.userData.tick = (t) => {
    root.position.y = Math.sin(t * 0.8) * 0.04;
    sail.rotation.y = 0.3 + Math.sin(t * 0.6) * 0.03;
  };
  return root;
}

export function createArchRuin(seed = 1) {
  const rng = mulberry32(seed);
  const root = new THREE.Group();
  const mat = material('#82877d', { roughness: 0.96 });
  mesh(root, new THREE.BoxGeometry(0.7, 2.2 + rng() * 0.5, 0.7), mat, [-1.35, 1.1, 0], [0, 0, -0.05]);
  mesh(root, new THREE.BoxGeometry(0.7, 1.7, 0.7), mat, [1.35, 0.85, 0], [0, 0, 0.08]);
  mesh(root, new THREE.BoxGeometry(3.4, 0.4, 0.8), mat, [0, 2.2, 0], [0, 0.05, -0.1]);
  for (let i = 0; i < 3; i += 1) {
    mesh(root, new THREE.DodecahedronGeometry(0.25, 0), mat, [(rng() - 0.5) * 3.5, 0.15, (rng() - 0.5) * 1.5], [rng(), rng(), rng()], [1, 0.6, 1]);
  }
  for (let i = 0; i < 4; i += 1) {
    mesh(root, new THREE.SphereGeometry(0.06, 4, 3), M.leaf('#6b8f59'), [(-1 + i * 0.6), 1.3 + rng() * 0.5, 0.34], [0, 0, 0], [1, 1.6, 1], false);
  }
  return root;
}

export function createFenceSegment(length = 3, color = '#8b6847') {
  const root = new THREE.Group();
  for (let i = 0; i < Math.ceil(length / 1.2); i += 1) {
    mesh(root, new THREE.CylinderGeometry(0.07, 0.08, 0.9, 4), M.wood(color), [i * 1.15, 0.45, 0]);
  }
  mesh(root, new THREE.BoxGeometry(length, 0.08, 0.08), M.wood(color), [length / 2 - 0.55, 0.65, 0]);
  mesh(root, new THREE.BoxGeometry(length, 0.08, 0.08), M.wood(color), [length / 2 - 0.55, 0.35, 0]);
  return root;
}

export function createUmbrellaTree(colors = {}) {
  const root = new THREE.Group();
  mesh(root, new THREE.CylinderGeometry(0.2, 0.35, 3.1, 6), M.bark(colors.trunk ?? '#6e513e'), [0, 1.55, 0]);
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2;
    mesh(root, new THREE.ConeGeometry(1.8, 0.5, 9), M.leaf(colors.leaf ?? '#55885f'), [Math.cos(angle) * 0.8, 3.15 + (i % 2) * 0.25, Math.sin(angle) * 0.8], [0.05, angle, 0.04], [1, 1, 0.9]);
  }
  mesh(root, new THREE.ConeGeometry(1.4, 0.4, 9), M.leaf(colors.accent ?? '#7ca16d'), [0, 3.65, 0]);
  return root;
}

export function setGhostAppearance(object, valid = true) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = false;
    child.receiveShadow = false;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    child.material = materials.map((mat) => {
      const clone = mat.clone();
      clone.transparent = true;
      clone.opacity = 0.5;
      clone.depthWrite = false;
      clone.emissive = new THREE.Color(valid ? '#5aa88f' : '#d36e61');
      clone.emissiveIntensity = 0.35;
      return clone;
    });
    if (child.material.length === 1) child.material = child.material[0];
  });
  const ring = createHalo(valid ? '#7fe4c4' : '#e17b6a', 2.4, 0.35);
  ring.name = 'ghost-ring';
  object.add(ring);
}

export function disposeObject(object) {
  if (!object) return;
  // 只释放几何体。材质与贴图大多来自共享缓存，由页面生命周期统一回收，
  // 避免在换岛重建时把其它岛上正在使用的材质一并销毁。
  object.traverse((child) => {
    // 热带环境包的几何体在多个克隆之间共享，不能随单座岛销毁。
    if (child.geometry && !child.userData?.sharedAsset) child.geometry.dispose?.();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((mat) => {
        if (mat?.userData?.uniqueTexture) {
          mat.map?.dispose?.();
          mat.dispose?.();
        }
      });
    }
    if (child.isSprite && child.material?.map && child.material.userData?.uniqueMap) {
      child.material.map.dispose?.();
      child.material.dispose?.();
    }
  });
  object.removeFromParent?.();
}

/** 岛屿边缘的扩建石碑：把「还能往哪里长」直接摆在玩家脚下。 */
export function createExpansionStele(glyph = '扩', color = '#e2c68c') {
  const root = new THREE.Group();
  const stone = material('#8d9088', { roughness: 0.95, texture: 'stone', bumpScale: 0.08 });
  mesh(root, new THREE.BoxGeometry(1.15, 0.24, 1.0), stone, [0, 0.12, 0]);
  mesh(root, new THREE.BoxGeometry(0.92, 0.16, 0.82), material('#a5a79d', { roughness: 0.94, texture: 'stone', bumpScale: 0.06 }), [0, 0.28, 0]);
  const pillar = mesh(root, new THREE.BoxGeometry(0.62, 1.65, 0.4), stone, [0, 1.12, 0], [0.02, 0, 0.015]);
  pillar.geometry.translate(0, 0, 0);
  mesh(root, new THREE.BoxGeometry(0.72, 0.12, 0.48), material('#b9b9ac', { roughness: 0.9, texture: 'stone' }), [0, 1.98, 0]);
  // 描金牌匾
  const plaque = glyphSprite(glyph, color, 1.0);
  plaque.position.set(0, 1.28, 0.22);
  root.add(plaque);
  // 指引方向的木牌
  const sign = group(root, [0.78, 0.9, 0.1], [0, -0.35, 0]);
  mesh(sign, new THREE.CylinderGeometry(0.05, 0.06, 1.3, 5), M.woodDark(), [0, 0, 0]);
  const board = mesh(sign, new THREE.BoxGeometry(0.9, 0.4, 0.06), M.woodLight(), [0.4, 0.42, 0], [0, 0, -0.06]);
  mesh(board, new THREE.BoxGeometry(0.74, 0.56, 0.02), material(color, { roughness: 0.7 }), [0, 0, 0.04], [0, 0, 0]);
  const glow = glowSprite(color, 1.8, 0.34);
  glow.position.set(0, 1.3, 0.1);
  root.add(glow);
  const halo = createHalo(color, 1.1, 0.26);
  halo.position.y = 0.03;
  root.add(halo);
  root.userData.tick = (t) => {
    glow.material.opacity = 0.24 + Math.sin(t * 1.7) * 0.07;
    plaque.position.y = 1.28 + Math.sin(t * 1.1) * 0.03;
  };
  return root;
}

// ---------------------------------------------------------------------------
// 生活道具：让营地看起来真的有人住
// ---------------------------------------------------------------------------

export function createBarrel(color = '#8b6546') {
  const root = new THREE.Group();
  const body = mesh(root, new THREE.CylinderGeometry(0.34, 0.3, 0.82, 14), M.wood(color), [0, 0.41, 0]);
  body.scale.set(1, 1, 1);
  [0.16, 0.66].forEach((y) => mesh(root, new THREE.TorusGeometry(0.345, 0.028, 5, 18), M.metal(), [0, y, 0], [Math.PI / 2, 0, 0]));
  mesh(root, new THREE.CylinderGeometry(0.3, 0.32, 0.06, 14), M.woodDark(), [0, 0.83, 0]);
  mesh(root, new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8), M.woodDark(), [0.1, 0.87, 0.05]);
  root.add(createContactShadow(0.5, 0.4, 0.02));
  return root;
}

export function createCrate(size = 0.55) {
  const root = new THREE.Group();
  const box = mesh(root, new THREE.BoxGeometry(size, size * 0.82, size * 0.9), M.woodLight(), [0, size * 0.41, 0]);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    mesh(root, new THREE.BoxGeometry(0.055, size * 0.82, 0.055), M.woodDark(), [x * (size / 2 - 0.02), size * 0.41, z * (size * 0.45 - 0.02)]);
  }
  mesh(root, new THREE.BoxGeometry(size * 1.01, 0.05, 0.05), M.woodDark(), [0, size * 0.62, size * 0.45]);
  root.add(createContactShadow(size * 0.85, 0.36, 0.02));
  return root;
}

export function createWoodpile() {
  const root = new THREE.Group();
  const lengths = [1.15, 1.0, 0.9];
  for (let row = 0; row < 3; row += 1) {
    const count = 3 - row;
    for (let i = 0; i < count; i += 1) {
      const length = lengths[row];
      const log = mesh(
        root,
        new THREE.CylinderGeometry(0.115, 0.12, length, 7),
        M.bark(row % 2 ? '#6b4f38' : '#7a5b40'),
        [(i - (count - 1) / 2) * 0.24, 0.13 + row * 0.21, 0],
        [0, 0, Math.PI / 2],
      );
      log.castShadow = true;
      mesh(root, new THREE.CylinderGeometry(0.09, 0.09, 0.02, 7), M.woodLight(), [(i - (count - 1) / 2) * 0.24, 0.13 + row * 0.21, length / 2], [Math.PI / 2, 0, 0]);
    }
  }
  root.add(createContactShadow(0.95, 0.34, 0.02));
  return root;
}

export function createWell() {
  const root = new THREE.Group();
  mesh(root, new THREE.CylinderGeometry(0.95, 1.05, 0.8, 12), M.stone(), [0, 0.4, 0]);
  mesh(root, new THREE.CylinderGeometry(0.82, 0.82, 0.06, 12), material('#1f3a3a', { roughness: 0.6 }), [0, 0.8, 0]);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.78, 12), new THREE.MeshBasicMaterial({ color: '#1b3436' }));
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.5;
  root.add(bottom);
  // 木架与吊桶
  [-0.78, 0.78].forEach((x) => mesh(root, new THREE.BoxGeometry(0.14, 1.9, 0.14), M.woodDark(), [x, 1.6, 0]));
  mesh(root, new THREE.CylinderGeometry(0.08, 0.08, 1.7, 7), M.wood(), [0, 2.42, 0], [0, 0, Math.PI / 2]);
  const roof = mesh(root, new THREE.ConeGeometry(1.25, 0.6, 4), M.roofClay(), [0, 2.9, 0], [0, Math.PI / 4, 0]);
  roof.scale.set(1.15, 1, 1.1);
  const bucket = mesh(root, new THREE.CylinderGeometry(0.18, 0.15, 0.26, 8), M.wood(), [0.1, 1.55, 0]);
  mesh(root, new THREE.TorusGeometry(0.2, 0.014, 3, 12, Math.PI), M.metal(), [0.1, 1.7, 0]);
  root.userData.tick = (t) => {
    bucket.position.y = 1.55 + Math.sin(t * 0.8) * 0.06;
  };
  root.add(createContactShadow(1.5, 0.42, 0.02));
  return root;
}

export function createBench() {
  const root = new THREE.Group();
  mesh(root, new THREE.BoxGeometry(1.7, 0.1, 0.42), M.woodLight(), [0, 0.46, 0]);
  mesh(root, new THREE.BoxGeometry(1.7, 0.1, 0.34), M.woodLight(), [0, 0.78, -0.22], [0.18, 0, 0]);
  [-0.72, 0.72].forEach((x) => {
    mesh(root, new THREE.BoxGeometry(0.1, 0.46, 0.36), M.woodDark(), [x, 0.23, 0]);
    mesh(root, new THREE.BoxGeometry(0.1, 0.5, 0.1), M.woodDark(), [x, 0.62, -0.22], [0.16, 0, 0]);
  });
  root.add(createContactShadow(1.05, 0.32, 0.02));
  return root;
}

export function createFlowerPot(seed = 1) {
  const rng = mulberry32(seed);
  const root = new THREE.Group();
  mesh(root, new THREE.CylinderGeometry(0.2, 0.14, 0.28, 8), M.roofClay(), [0, 0.14, 0]);
  mesh(root, new THREE.CylinderGeometry(0.19, 0.19, 0.04, 8), M.soil(), [0, 0.27, 0]);
  const colors = ['#f0b0b4', '#f4d68d', '#c7b2e0'];
  for (let i = 0; i < 5; i += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = rng() * 0.12;
    mesh(root, new THREE.CylinderGeometry(0.008, 0.01, 0.2 + rng() * 0.16, 3), M.leaf('#6f9a64'), [Math.cos(angle) * radius, 0.36 + rng() * 0.08, Math.sin(angle) * radius], [0, 0, 0], [1, 1, 1], false);
    mesh(root, new THREE.IcosahedronGeometry(0.05, 0), material(colors[i % 3], { roughness: 0.7 }), [Math.cos(angle) * radius, 0.48 + rng() * 0.1, Math.sin(angle) * radius], [0, 0, 0], [1, 0.7, 1], false);
  }
  return root;
}

export function createLaundryLine() {
  const root = new THREE.Group();
  mesh(root, new THREE.CylinderGeometry(0.055, 0.07, 1.85, 6), M.woodDark(), [-1.3, 0.92, 0]);
  mesh(root, new THREE.CylinderGeometry(0.055, 0.07, 1.7, 6), M.woodDark(), [1.3, 0.85, 0]);
  const rope = mesh(root, new THREE.CylinderGeometry(0.012, 0.012, 2.6, 4), material('#cfbb92', { roughness: 1 }), [0, 1.62, 0], [0, 0, Math.PI / 2 + 0.05]);
  rope.castShadow = false;
  const colors = ['#e6dcc0', '#b9cdd8', '#dcc3a6'];
  for (let i = 0; i < 3; i += 1) {
    const cloth = mesh(root, new THREE.PlaneGeometry(0.5, 0.62), material(colors[i], { roughness: 0.95, side: THREE.DoubleSide }), [-0.72 + i * 0.72, 1.28, 0], [0, 0, 0]);
    cloth.castShadow = false;
    cloth.userData.sway = true;
  }
  return root;
}

export function createStoneWall(length = 2.4) {
  const root = new THREE.Group();
  const rng = mulberry32(Math.round(length * 17));
  const count = Math.max(2, Math.round(length / 0.4));
  for (let i = 0; i < count; i += 1) {
    const x = (i - (count - 1) / 2) * (length / count);
    for (let row = 0; row < 3; row += 1) {
      const size = 0.24 + rng() * 0.1;
      mesh(root, new THREE.DodecahedronGeometry(size, 0), M.stone(), [x + (rng() - 0.5) * 0.08, 0.16 + row * 0.24, (rng() - 0.5) * 0.12], [rng(), rng() * 3, rng()], [1.1, 0.8, 0.9]);
    }
  }
  root.add(createContactShadow(length * 0.6, 0.3, 0.02));
  return root;
}
