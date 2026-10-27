import * as THREE from 'three';
import { mulberry32 } from '../core/utils.js';
import { nature } from './natureAssets.js';

/**
 * 草地与沙滩的植被层，贴图来自 mox/3TD Starter Pack：
 *   · FieldGrass01 —— 一丛真实的野草，做成十字面片实例化铺满岛
 *   · YelloPrarie01 —— 黄色草原小花
 *   · DryWeeds —— 靠海的枯草，用来过渡沙滩与草地
 *
 * 之前岛上的草是程序化画出来的小三角，现在换成真实草叶贴图，
 * 远景不再是一片噪点，近看能看到一根一根的草。
 */

const BASE = '/models/ground';

const TEXTURES = {
  grass: 'field-grass.png',
  flower: 'yellow-prarie.png',
  weeds: 'dry-weeds.png',
};

/** 24-grass 的两张照片草皮，用来给地面铺一层真实的草纹 */
const PHOTOS = {
  grass: 'grass-ground.jpg',
  grassAlt: 'grass-ground-2.jpg',
};

class GroundTextureLibrary {
  constructor() {
    this.loader = null;
    this.maps = new Map();
    this.images = new Map();
    this.promise = null;
  }

  get ready() {
    return this.maps.size > 0;
  }

  has(key) {
    return this.maps.has(key);
  }

  async preload() {
    if (this.promise) return this.promise;
    if (!this.loader) this.loader = new THREE.TextureLoader();
    const textureJobs = Object.entries(TEXTURES).map(async ([key, file]) => {
      try {
        const map = await this.loader.loadAsync(`${BASE}/${file}`);
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = 4;
        map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
        this.maps.set(key, map);
      } catch {
        // 缺图就退回程序化草叶
      }
    });
    const photoJobs = Object.entries(PHOTOS).map(async ([key, file]) => {
      try {
        const image = await loadImage(`${BASE}/${file}`);
        this.images.set(key, image);
      } catch {
        // 没有照片草皮时只保留颜色
      }
    });
    this.promise = Promise.all([...textureJobs, ...photoJobs]).then(() => this);
    return this.promise;
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

export const groundTextures = new GroundTextureLibrary();

export async function preloadGroundTextures() {
  return groundTextures.preload();
}

const windUniform = { value: 0 };

export function updateMeadowTime(elapsed) {
  windUniform.value = elapsed;
}

function crossGeometry(width = 0.9, height = 1) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const half = width / 2;
  const planes = 2;
  for (let i = 0; i < planes; i += 1) {
    const angle = (i / planes) * Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const base = i * 4;
    [
      [-half, 0],
      [half, 0],
      [half, height],
      [-half, height],
    ].forEach(([x, y], index) => {
      positions.push(x * cos, y, x * sin);
      normals.push(0, 1, 0);
      uvs.push(index === 0 || index === 3 ? 0 : 1, index === 1 || index === 2 ? 1 : 0);
    });
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function withWind(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float meadowPhase = 0.0;
        #ifdef USE_INSTANCING
          meadowPhase = instanceMatrix[3][0] * 0.41 + instanceMatrix[3][2] * 0.73;
        #endif
        float h = clamp(position.y, 0.0, 1.0);
        float gust = sin(uWindTime * 1.25 + meadowPhase) * 0.65 + sin(uWindTime * 2.7 + meadowPhase * 1.6) * 0.22;
        transformed.x += gust * h * h * 0.16;
        transformed.z += gust * h * h * 0.09;`,
      );
  };
  material.customProgramCacheKey = () => 'meadow-wind';
  return material;
}

/**
 * 在草地上铺真实草叶与野花。
 * @param {{ radius:number, yAt:Function, seed?:number, clearAt?:Function, quality?:string }} options
 */
export function createMeadow({
  radius,
  yAt,
  seed = 5,
  clearAt = null,
  quality = 'high',
  center = { x: 0, z: 0 },
  style = 'home',
}) {
  const group = new THREE.Group();
  group.name = 'meadow';
  if (!nature.ready) return group;

  const rng = mulberry32(seed * 7 + 11);
  const budget = quality === 'low' ? 0.45 : quality === 'medium' ? 0.72 : 1;

  /** 把一个模型铺成实例：同一套矩阵喂给它的每个网格部件 */
  const scatter = (key, count, { minRatio, maxRatio, targetHeight, name }) => {
    const parts = nature.getParts(key);
    if (!parts.length || count <= 0) return;
    const size = nature.getSize(key);
    const scale = targetHeight / Math.max(0.001, size.y);
    const placements = [];
    let guard = 0;
    while (placements.length < count && guard < count * 12) {
      guard += 1;
      const angle = rng() * Math.PI * 2;
      const ratio = (minRatio + (maxRatio - minRatio) * Math.sqrt(rng())) * 0.97;
      const x = center.x + Math.cos(angle) * radius * ratio;
      const z = center.z + Math.sin(angle) * radius * ratio;
      if (clearAt && clearAt(x, z)) continue;
      const patch = Math.sin(angle * 3.7 + seed) * 0.5 + Math.cos(ratio * 8.1) * 0.5;
      if (patch < -0.42 && rng() > 0.4) continue;
      placements.push({
        x,
        y: yAt(ratio, angle) - 0.02,
        z,
        rotation: rng() * Math.PI * 2,
        scale: scale * (0.75 + rng() * 0.55),
      });
    }

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const vector = new THREE.Vector3();
    const dimensions = new THREE.Vector3();
    for (const part of parts) {
      // 草叶贴图偏暗，稍微提亮一点点，和地面颜色咬得住
      if (String(part.material?.name ?? '').match(/grass/i) || String(key).match(/Grass/)) {
        part.material.color?.setHex?.(0xd9e6bd);
      }
      // 草叶贴图偏暗，稍微提亮一点点，和地面颜色咬得住
      if (String(part.material?.name ?? '').match(/grass/i) || String(key).match(/Grass/)) {
        part.material.color?.setHex?.(0xd9e6bd);
      }
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, placements.length);
      mesh.name = name;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      placements.forEach((placement, index) => {
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.rotation);
        vector.set(placement.x, placement.y, placement.z);
        dimensions.setScalar(placement.scale);
        matrix.compose(vector, quaternion, dimensions);
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
  };

  // 草与花：全部是模型库里的小模型，用实例化铺满岛
  const area = radius * radius;
  scatter('Grass_Large', Math.round(Math.min(1500, area * 0.85) * budget), {
    minRatio: 0.04,
    maxRatio: 0.93,
    targetHeight: 0.52,
    name: 'meadow-grass',
  });
  scatter('Grass_Small', Math.round(Math.min(1100, area * 0.62) * budget), {
    minRatio: 0.05,
    maxRatio: 0.9,
    targetHeight: 0.34,
    name: 'meadow-grass-small',
  });

  const flowerKeys = ['Flower_1_Clump', 'Flower_2_Clump', 'Flower_3_Clump', 'Flower_4_Clump', 'Flower_5_Clump'];
  const flowerCount = Math.round(Math.min(420, area * 0.2) * budget);
  flowerKeys.forEach((key, index) => {
    if (!nature.has(key)) return;
    scatter(key, Math.round(flowerCount / flowerKeys.length), {
      minRatio: 0.12 + index * 0.04,
      maxRatio: 0.9,
      targetHeight: 0.42,
      name: 'meadow-flower',
    });
  });

  return group;
}
