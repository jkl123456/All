import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * 苔溪镇（xiǎozhèn）的雨林植物库：棕榈、王棕、香蕉、号角树、蕨类与灌木。
 *
 * 这 10 个 GLB 直接来自原项目的 assets/jungle，贴图内嵌、带透明叶片，
 * 载入后把叶子设成 alphaTest（关掉透明排序），就能大量复制而不掉帧。
 */
const KEY_BASE = '/models/jungle';

export const JUNGLE_KEYS = [
  'palm_a',
  'palm_b',
  'palm_queen',
  'palm_beach',
  'cecropia',
  'copal',
  'banana',
  'fern',
  'bush',
  'elephant',
];

class JungleAssetLibrary {
  constructor() {
    this.loader = null;
    this.sources = new Map();
    this.sizes = new Map();
    this.preloadPromise = null;
    this.failedKeys = [];
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
    this.preloadPromise = Promise.all(JUNGLE_KEYS.map(async (key) => {
      try {
        const gltf = await this.loader.loadAsync(`${KEY_BASE}/${key}.glb`);
        const root = gltf.scene;
        this.prepare(root, key);
        const bounds = new THREE.Box3().setFromObject(root);
        this.sources.set(key, root);
        this.sizes.set(key, bounds.getSize(new THREE.Vector3()));
        onProgress?.(this.sources.size, JUNGLE_KEYS.length, key);
      } catch (error) {
        this.failedKeys.push(key);
        console.warn(`[知屿] 雨林模型 ${key} 未能载入。`, error);
      }
    })).then(() => this);
    return this.preloadPromise;
  }

  prepare(root, key) {
    root.traverse((object) => {
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((mat) => {
        if (!mat) return;
        const leafy = mat.alphaTest > 0 || mat.transparent || mat.side === THREE.DoubleSide;
        if (leafy) {
          mat.alphaTest = Math.max(mat.alphaTest ?? 0, 0.35);
          mat.transparent = false;
          mat.depthWrite = true;
          mat.side = THREE.DoubleSide;
        }
        mat.roughness = Math.min(1, (mat.roughness ?? 0.9) + 0.05);
        mat.metalness = 0;
        mat.envMapIntensity = 0.5;
        if (mat.map) {
          mat.map.colorSpace = THREE.SRGBColorSpace;
          mat.map.anisotropy = 4;
        }
      });
      object.castShadow = !key.includes('fern') && !key.includes('bush');
      object.receiveShadow = true;
      object.frustumCulled = true;
      object.userData.sharedAsset = true;
    });
    root.name = `jungle-${key}`;
  }

  create(key, { scale = 1, rotation = 0 } = {}) {
    const source = this.sources.get(key);
    if (!source) return null;
    const clone = source.clone(true);
    clone.scale.setScalar(scale);
    clone.rotation.y = rotation;
    clone.userData.jungleKey = key;
    clone.userData.jungleSize = this.getSize(key);
    return clone;
  }

  random(rng, { scale = 1, keys = ['palm_a', 'palm_b', 'palm_queen', 'cecropia'] } = {}) {
    const available = keys.filter((key) => this.has(key));
    if (!available.length) return null;
    const key = available[Math.floor(rng() * available.length) % available.length];
    return this.create(key, { scale: scale * (0.85 + rng() * 0.3), rotation: rng() * Math.PI * 2 });
  }
}

export const jungle = new JungleAssetLibrary();

export async function preloadJungleAssets(onProgress) {
  return jungle.preload(onProgress);
}
