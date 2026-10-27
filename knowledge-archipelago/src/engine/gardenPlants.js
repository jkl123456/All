import * as THREE from 'three';
import { mulberry32 } from '../core/utils.js';
import { megakit, nature, plantLibrary } from './natureAssets.js';

/**
 * 花园植物的「收集器」。
 *
 * 摆放阶段不立刻建 Mesh，只登记 (模型, 位置, 高度, 色调)；
 * 整座岛装完之后一次性合并成 InstancedMesh。
 * 好处是：一片 80 株的花圃也只占 2~4 个 draw call，
 * 加载和渲染都比「每个模型 clone 一份」轻得多。
 */

const GROUND_Y = 1.12;

export const PLANT_KEYS = {
  flower: ['Flower_3_Group', 'Flower_4_Group'],
  flowerSingle: ['Flower_3_Single', 'Flower_4_Single'],
  foliage: ['Clover_1', 'Fern_1', 'Clover_2'],
  bigLeaf: ['Plant_1_Big', 'Plant_1'],
  bush: ['Bush_Small', 'Bush_Flowers', 'Bush_Small_Flowers'],
  grass: ['Grass_Common_Tall', 'Grass_Common_Short'],
  mushroom: ['Mushroom_Common'],
  rock: ['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3'],
  pathRound: ['RockPath_Round_Wide'],
  pathSquare: ['RockPath_Square_Wide'],
  pebble: ['Pebble_Round_1'],
  tree: ['MapleTree_1', 'BirchTree_1', 'MapleTree_2', 'BirchTree_3'],
};

export function createPlantCollector(parent) {
  const buckets = new Map();

  const add = (key, spec = {}) => {
    if (!key) return;
    if (!plantLibrary(key)?.has(key)) return;
    const tint = spec.tint ?? null;
    const id = `${key}|${tint ?? ''}`;
    let bucket = buckets.get(id);
    if (!bucket) {
      bucket = { key, tint, items: [] };
      buckets.set(id, bucket);
    }
    bucket.items.push({
      x: spec.x ?? 0,
      y: spec.y ?? GROUND_Y,
      z: spec.z ?? 0,
      height: spec.height ?? 0,
      scale: spec.scale ?? 1,
      rotation: spec.rotation ?? 0,
      tilt: spec.tilt ?? 0,
    });
  };

  const patch = ({
    x,
    z,
    radius = 1,
    count = 12,
    keys = PLANT_KEYS.flower,
    height = 0.5,
    heightJitter = 0.25,
    tint = null,
    seed = 1,
    y = 0,
    innerRadius = 0,
  }) => {
    const rng = mulberry32(seed * 97 + 3);
    for (let i = 0; i < count; i += 1) {
      const angle = rng() * Math.PI * 2;
      const distance = innerRadius + Math.sqrt(rng()) * (radius - innerRadius);
      add(keys[Math.floor(rng() * keys.length) % keys.length], {
        x: x + Math.cos(angle) * distance,
        z: z + Math.sin(angle) * distance,
        y,
        height: height * (1 - heightJitter + rng() * heightJitter * 2),
        rotation: rng() * Math.PI * 2,
        tint,
      });
    }
  };

  const row = ({
    from,
    to,
    count = 8,
    keys = PLANT_KEYS.foliage,
    height = 0.5,
    tint = null,
    seed = 1,
  }) => {
    const rng = mulberry32(seed * 31 + 11);
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      add(keys[Math.floor(rng() * keys.length) % keys.length], {
        x: from.x + (to.x - from.x) * t + (rng() - 0.5) * 0.18,
        z: from.z + (to.z - from.z) * t + (rng() - 0.5) * 0.18,
        height: height * (0.85 + rng() * 0.3),
        rotation: rng() * Math.PI * 2,
        tint,
      });
    }
  };

  const flush = () => {
    let drawCalls = 0;
    let instances = 0;
    buckets.forEach((bucket) => {
      const library = plantLibrary(bucket.key);
      const parts = library?.getParts(bucket.key) ?? [];
      if (!parts.length) return;
      const size = library.getSize(bucket.key);
      const baseHeight = Math.max(0.001, size.y);
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      const euler = new THREE.Euler();

      parts.forEach((part) => {
        let material = part.material;
        if (bucket.tint) {
          material = part.material.clone();
          material.color = new THREE.Color(bucket.tint);
          material.needsUpdate = true;
        }
        const mesh = new THREE.InstancedMesh(part.geometry, material, bucket.items.length);
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        bucket.items.forEach((item, index) => {
          const s = item.height > 0 ? item.height / baseHeight : item.scale;
          position.set(item.x, item.y, item.z);
          euler.set(item.tilt, item.rotation, 0);
          quaternion.setFromEuler(euler);
          scale.setScalar(s);
          matrix.compose(position, quaternion, scale);
          mesh.setMatrixAt(index, matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.frustumCulled = true;
        mesh.name = `plants-${bucket.key}`;
        parent.add(mesh);
        drawCalls += 1;
        instances += bucket.items.length;
      });
    });
    buckets.clear();
    return { drawCalls, instances };
  };

  return { add, patch, row, flush };
}

/** 单块石头：数量少，直接克隆模型 */
export function addRock(parent, { x, z, y = 0, key, scale = 1, rotation = 0 } = {}) {
  const library = plantLibrary(key) ?? megakit;
  const object = library.create(key ?? 'Rock_Medium_1', { scale, rotation });
  if (!object) return null;
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

/** 景石用实例化铺一小片 */
export function rockPatch(plants, { x, z, radius = 1.4, count = 4, seed = 1, scale = [0.5, 0.9] } = {}) {
  const rng = mulberry32(seed * 53 + 9);
  for (let i = 0; i < count; i += 1) {
    const angle = rng() * Math.PI * 2;
    const distance = Math.sqrt(rng()) * radius;
    plants.add(PLANT_KEYS.rock[Math.floor(rng() * 3) % 3], {
      x: x + Math.cos(angle) * distance,
      z: z + Math.sin(angle) * distance,
      scale: scale[0] + rng() * (scale[1] - scale[0]),
      rotation: rng() * Math.PI * 2,
    });
  }
}

/** 花园里最常用的一小片「花 + 叶」 */
export function flowerBed(plants, {
  x, z, radius = 1.6, flowers = 16, foliage = 8, tint = null, seed = 1, height = 0.5,
} = {}) {
  plants.patch({ x, z, radius, count: foliage, keys: PLANT_KEYS.foliage, height: 0.28, seed: seed + 1 });
  plants.patch({ x, z, radius: radius * 0.92, count: flowers, keys: PLANT_KEYS.flower, height, tint, seed: seed + 2 });
}
