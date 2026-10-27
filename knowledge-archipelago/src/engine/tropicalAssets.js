import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * 热带环境包模型库。
 *
 * GLB 由 scripts/import-tropical-assets.py 从 Torque 3D 的 DAE/DDS 源包
 * 离线转换而来：最高 LOD、按材质合批、贴图内嵌、Z-up 转 Y-up，并把
 * 每个资产归一到可玩的米制高度。这里只负责浏览器端加载与轻量材质整理。
 */
export const TROPICAL_ASSET_KEYS = [
  'beach-palm',
  'palm-01',
  'queens-palm',
  'banana',
  'cecropia',
  'fern',
  'elephant-ear',
  'beach-grass',
  'beach-rock',
  'stone',
  'jetty-simple',
  'jetty',
  'hut',
  'crate',
];

const KEY_BASE = '/models/tropical';

class TropicalAssetLibrary {
  constructor() {
    this.loader = null;
    this.sources = new Map();
    this.sizes = new Map();
    this.preloadPromise = null;
    this.loadedCount = 0;
    this.failedKeys = [];
  }

  get ready() {
    return this.sources.size > 0;
  }

  has(key) {
    return this.sources.has(key);
  }

  hasAny(keys = TROPICAL_ASSET_KEYS) {
    return keys.some((key) => this.has(key));
  }

  getSize(key) {
    const size = this.sizes.get(key);
    return size ? size.clone() : new THREE.Vector3(1, 1, 1);
  }

  async preload(onProgress) {
    if (this.preloadPromise) return this.preloadPromise;
    if (!this.loader) this.loader = new GLTFLoader();
    this.preloadPromise = Promise.all(TROPICAL_ASSET_KEYS.map(async (key) => {
      try {
        const gltf = await this.loader.loadAsync(`${KEY_BASE}/${key}.glb`);
        const root = gltf.scene;
        this.prepare(root, key);
        const bounds = new THREE.Box3().setFromObject(root);
        const size = bounds.getSize(new THREE.Vector3());
        this.sources.set(key, root);
        if (!this.sizes.has(key)) this.sizes.set(key, size);
        this.loadedCount += 1;
        onProgress?.(this.loadedCount, TROPICAL_ASSET_KEYS.length, key);
      } catch (error) {
        this.failedKeys.push(key);
        console.warn(`[知屿] 热带模型 ${key} 未能载入，将使用程序化模型兜底。`, error);
      }
    })).then(() => {
      if (this.failedKeys.length) {
        console.warn('[知屿] 热带模型缺项：', this.failedKeys.join(', '));
      }
      return this;
    });
    return this.preloadPromise;
  }

  prepare(root, key) {
    const smallFoliage = key === 'beach-grass' || key === 'fern' || key === 'elephant-ear';
    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = !smallFoliage;
      object.receiveShadow = true;
      object.frustumCulled = true;
      object.userData.sharedAsset = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((mat) => {
        if (!mat) return;
        mat.envMapIntensity = 0.58;
        mat.roughness = Math.max(0.68, mat.roughness ?? 0.82);
        mat.metalness = 0;
        if (mat.map) {
          mat.map.colorSpace = THREE.SRGBColorSpace;
          mat.map.anisotropy = 4;
        }
        if (mat.alphaTest > 0 || mat.transparent) {
          mat.alphaTest = Math.max(mat.alphaTest ?? 0, 0.32);
          mat.transparent = false;
          mat.depthWrite = true;
          mat.side = THREE.DoubleSide;
        }
      });
    });
    root.name = `tropical-${key}`;
  }

  /**
   * Return a fresh clone. Geometries and materials are shared, so a grove of
   * palms costs memory once and only draw calls per instance.
   */
  create(key, { scale = 1, rotation = 0, castShadow = null } = {}) {
    const source = this.sources.get(key);
    if (!source) return null;
    const clone = source.clone(true);
    clone.scale.setScalar(scale);
    clone.rotation.y = rotation;
    clone.userData.tropicalKey = key;
    clone.userData.tropicalSize = this.getSize(key);
    if (castShadow !== null) {
      clone.traverse((object) => {
        if (object.isMesh) object.castShadow = castShadow;
      });
    }
    return clone;
  }

  randomPalm(rng, { scale = 1 } = {}) {
    const options = ['beach-palm', 'palm-01', 'queens-palm'].filter((key) => this.has(key));
    if (!options.length) return null;
    const key = options[Math.floor(rng() * options.length) % options.length];
    const baseScale = key === 'palm-01' ? 0.82 : key === 'queens-palm' ? 1.05 : 1;
    const variant = baseScale * scale * (0.86 + rng() * 0.28);
    return this.create(key, {
      scale: variant,
      rotation: rng() * Math.PI * 2,
    });
  }
}

export const tropical = new TropicalAssetLibrary();

export async function preloadTropicalAssets(onProgress) {
  return tropical.preload(onProgress);
}
