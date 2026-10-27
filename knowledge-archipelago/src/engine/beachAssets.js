import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * mox/ 里的沙滩道具：阳伞、躺椅、浮圈、皮球、冰桶、野餐篮、玩具桶……
 *
 * OBJ 转出来的 GLB 只有几何，没有材质；贴图是同名 PNG，
 * 这里按名字挂上去，再按「目标高度」把每件道具缩放到真实尺寸。
 */

const BASE = '/models/beach';

/** 每件道具在现实里的高度（米），用来把模型缩放到人的尺度 */
const TARGET_HEIGHT = {
  parasol: 2.3,
  bench_01: 0.9,
  bench_02: 0.85,
  bench_03: 0.95,
  chair_01: 0.95,
  chair_02: 0.9,
  chair_03: 1.0,
  chair_04: 0.95,
  big_table: 0.78,
  small_table: 0.5,
  cooler: 0.45,
  picnic_basket: 0.35,
  toy_bucket: 0.28,
  toy_rake: 0.3,
  toy_shovel: 0.32,
  toy_wagon: 0.55,
  ball: 0.32,
  float_01: 0.32,
  float_02: 0.36,
  float_03: 0.4,
  float_04: 0.45,
};

export const BEACH_KEYS = Object.keys(TARGET_HEIGHT);

class BeachAssetLibrary {
  constructor() {
    this.loader = null;
    this.textureLoader = null;
    this.sources = new Map();
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

  async preload(onProgress) {
    if (this.preloadPromise) return this.preloadPromise;
    if (!this.loader) this.loader = new GLTFLoader();
    if (!this.textureLoader) this.textureLoader = new THREE.TextureLoader();
    this.preloadPromise = Promise.all(BEACH_KEYS.map(async (key) => {
      try {
        const gltf = await this.loader.loadAsync(`${BASE}/${key}.glb`);
        const root = gltf.scene;
        let map = null;
        try {
          map = await this.textureLoader.loadAsync(`${BASE}/textures/${key}.png`);
          map.colorSpace = THREE.SRGBColorSpace;
          map.anisotropy = 4;
        } catch {
          map = null;
        }
        const material = new THREE.MeshStandardMaterial({
          color: map ? '#ffffff' : '#e6d3ae',
          map,
          roughness: key.startsWith('float') ? 0.55 : 0.86,
          metalness: 0,
          side: THREE.DoubleSide,
        });
        root.traverse((object) => {
          if (!object.isMesh) return;
          object.material = material;
          object.castShadow = true;
          object.receiveShadow = true;
          object.frustumCulled = true;
        });
        // 归一化：把模型缩放到目标高度，并把脚底放到 y = 0
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const height = Math.max(0.001, size.y);
        const scale = (TARGET_HEIGHT[key] ?? 0.6) / height;
        const wrapper = new THREE.Group();
        root.position.y = -box.min.y;
        wrapper.add(root);
        wrapper.scale.setScalar(scale);
        wrapper.name = `beach-${key}`;
        this.sources.set(key, wrapper);
        this.sizes.set(key, size.clone().multiplyScalar(scale));
        onProgress?.(this.sources.size, BEACH_KEYS.length, key);
      } catch (error) {
        this.failed.push(key);
      }
    })).then(() => this);
    return this.preloadPromise;
  }

  getSize(key) {
    const size = this.sizes.get(key);
    return size ? size.clone() : new THREE.Vector3(1, 1, 1);
  }

  create(key, { scale = 1, rotation = 0 } = {}) {
    const source = this.sources.get(key);
    if (!source) return null;
    const clone = source.clone(true);
    clone.scale.multiplyScalar(scale);
    clone.rotation.y = rotation;
    clone.userData.beachKey = key;
    return clone;
  }
}

export const beach = new BeachAssetLibrary();

export async function preloadBeachAssets(onProgress) {
  return beach.preload(onProgress);
}
