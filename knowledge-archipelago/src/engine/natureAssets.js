import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * 两套植被模型库（都是 Quaternius 的 CC0 素材）：
 *
 *   1. Ultimate Stylized Nature —— 白桦、枫树、灌木、花簇、草。
 *   2. Stylized Nature MegaKit —— 蕨类、三叶草、蘑菇、卵石、景石、
 *      真正的石板路（RockPath），以及另一种花簇。
 *
 * 岛上的植物一律从这里拿模型，不再用几何体现搓。
 * 数量大的草与花走 InstancedMesh（见 meadow.js / gardenPlants.js），
 * 这样即使铺满一片草地，draw call 也只增加几个。
 *
 * 第二套只搬了实际用到的 20 个模型和 7 张贴图，避免首屏下载几十兆素材。
 */

class NatureAssetLibrary {
  constructor({ base, keys, tag, leafyPattern = /leaf|leaves|grass|flower|bush|fern|clover|plant|petal/i } = {}) {
    this.base = base;
    this.keys = keys ?? [];
    this.tag = tag ?? base;
    this.leafyPattern = leafyPattern;
    this.loader = null;
    this.sources = new Map();
    this.parts = new Map();
    this.sizes = new Map();
    this.preloadPromise = null;
    this.failed = [];
  }

  get ready() {
    return this.sources.size > 0;
  }

  has(key) {
    return this.sources.has(key);
  }

  getSize(key) {
    const size = this.sizes.get(key);
    return size ? size.clone() : new THREE.Vector3(1, 1, 1);
  }

  async preload(onProgress) {
    if (this.preloadPromise) return this.preloadPromise;
    if (!this.loader) this.loader = new GLTFLoader();
    this.preloadPromise = Promise.all(this.keys.map(async (key) => {
      try {
        const gltf = await this.loader.loadAsync(`${this.base}/${key}.gltf`);
        const root = gltf.scene;
        this.prepare(root, key);
        const box = new THREE.Box3().setFromObject(root);
        this.sizes.set(key, box.getSize(new THREE.Vector3()));
        this.sources.set(key, root);
        onProgress?.(this.sources.size, this.keys.length, key);
      } catch (error) {
        this.failed.push(key);
        console.warn(`[知屿] 植被模型 ${key} 未能载入。`, error);
      }
    })).then(() => {
      if (this.failed.length) console.warn(`[知屿] ${this.tag} 缺失：`, this.failed.join(', '));
      return this;
    });
    return this.preloadPromise;
  }

  prepare(root, key) {
    const parts = [];
    root.traverse((object) => {
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((mat) => {
        if (!mat) return;
        const leafy = this.leafyPattern.test(`${mat.name} ${key}`) || mat.alphaTest > 0 || mat.transparent;
        if (leafy && mat.map) {
          mat.alphaTest = Math.max(mat.alphaTest ?? 0, 0.35);
          mat.transparent = false;
          mat.depthWrite = true;
          mat.side = THREE.DoubleSide;
        }
        mat.roughness = Math.min(1, (mat.roughness ?? 0.9) + 0.02);
        mat.metalness = 0;
        mat.envMapIntensity = 0.5;
        if (mat.map) {
          mat.map.colorSpace = THREE.SRGBColorSpace;
          mat.map.anisotropy = 4;
        }
      });
      object.castShadow = !/grass|flower|fern|clover|petal|plant|mushroom/i.test(key);
      object.receiveShadow = true;
      object.frustumCulled = true;
      object.userData.natureKey = key;
      parts.push(object);
    });
    root.name = `${this.tag}-${key}`;
    this.parts.set(key, parts);
  }

  /** 克隆一份（几何与材质共享） */
  create(key, { scale = 1, rotation = 0 } = {}) {
    const source = this.sources.get(key);
    if (!source) return null;
    const clone = source.clone(true);
    clone.scale.setScalar(scale);
    clone.rotation.y = rotation;
    clone.userData.natureKey = key;
    clone.traverse((object) => {
      if (object.isMesh) object.userData.natureKey = key;
    });
    return clone;
  }

  /** 取某个模型的网格部件，供 InstancedMesh 使用 */
  getParts(key) {
    const list = this.parts.get(key);
    if (!list) return [];
    return list.map((object) => ({
      geometry: object.geometry,
      material: object.material,
    }));
  }

  random(rng, { scale = 1, keys = this.keys } = {}) {
    const available = keys.filter((key) => this.has(key));
    if (!available.length) return null;
    const key = available[Math.floor(rng() * available.length) % available.length];
    return this.create(key, { scale: scale * (0.85 + rng() * 0.3), rotation: rng() * Math.PI * 2 });
  }
}

export const NATURE_TREES = [
  'BirchTree_1',
  'BirchTree_2',
  'BirchTree_3',
  'BirchTree_4',
  'MapleTree_1',
  'MapleTree_2',
  'MapleTree_3',
];

export const NATURE_BUSHES = [
  'Bush',
  'Bush_Flowers',
  'Bush_Large',
  'Bush_Large_Flowers',
  'Bush_Small',
  'Bush_Small_Flowers',
];

export const NATURE_FLOWERS = [
  'Flower_1_Clump',
  'Flower_2_Clump',
  'Flower_3_Clump',
  'Flower_4_Clump',
  'Flower_5_Clump',
];

export const NATURE_GRASS = ['Grass_Small', 'Grass_Large', 'Grass_Large_Extruded'];

export const NATURE_KEYS = [...NATURE_TREES, ...NATURE_BUSHES, ...NATURE_FLOWERS, ...NATURE_GRASS];

/** MegaKit 里真正搬进项目的那一批 */
export const MEGAKIT_TREES = ['Pine_1', 'CommonTree_1', 'TwistedTree_1', 'DeadTree_1'];

export const MEGAKIT_PLANTS = [
  'Fern_1',
  'Plant_1',
  'Plant_1_Big',
  'Clover_1',
  'Clover_2',
  'Mushroom_Common',
  'Bush_Common_Flowers',
];

export const MEGAKIT_FLOWERS = [
  'Flower_3_Group',
  'Flower_4_Group',
  'Flower_3_Single',
  'Flower_4_Single',
];

export const MEGAKIT_GROUND = [
  'Grass_Common_Short',
  'Grass_Common_Tall',
  'Rock_Medium_1',
  'Rock_Medium_2',
  'Rock_Medium_3',
  'RockPath_Round_Wide',
  'RockPath_Square_Wide',
  'Pebble_Round_1',
];

export const MEGAKIT_KEYS = [...MEGAKIT_TREES, ...MEGAKIT_PLANTS, ...MEGAKIT_FLOWERS, ...MEGAKIT_GROUND];

export const nature = new NatureAssetLibrary({ base: '/models/nature', keys: NATURE_KEYS, tag: 'nature' });

export const megakit = new NatureAssetLibrary({ base: '/models/megakit', keys: MEGAKIT_KEYS, tag: 'megakit' });

/** 按 key 找到它属于哪个库 */
export function plantLibrary(key) {
  if (megakit.has(key)) return megakit;
  if (nature.has(key)) return nature;
  return null;
}

export async function preloadNatureAssets(onProgress) {
  return nature.preload(onProgress);
}

export async function preloadMegakitAssets(onProgress) {
  return megakit.preload(onProgress);
}
