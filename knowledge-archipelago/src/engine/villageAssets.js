import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * 中世纪村落模型库（Medieval Village Pack，Quaternius / CC0）。
 *
 * 与热带环境包不同，这一套是「整栋建筑 + 独立道具」的低多边形模型，
 * 没有贴图、只有一组共用命名的纯色材质（Plaster / Wood / RoofTiles_Red …）。
 * 所以这里做两件事：
 *   1. 按颜色把每栋建筑自带的材质实例收拢成共享材质，几十个模型只占一套材质；
 *   2. 记录 manifest 里的长宽高，用来算碰撞、找空地与合批。
 *
 * 模型由 xiǎozhèn 项目的 assets/village 直接拷贝而来，加载失败时
 * 调用方（villageScene）会回退到程序化模型，不会让岛屿空掉。
 */
const KEY_BASE = '/models/village';

const MATERIAL_TUNING = {
  roughness: 0.86,
  metalness: 0,
  envMapIntensity: 0.55,
};

class VillageAssetLibrary {
  constructor() {
    this.loader = null;
    this.sources = new Map();
    this.meta = new Map();
    this.materials = new Map();
    this.preloadPromise = null;
    this.loadedCount = 0;
    this.failedKeys = [];
    this.buildingKeys = [];
    this.propKeys = [];
  }

  get ready() {
    return this.sources.size > 0;
  }

  has(key) {
    return this.sources.has(key);
  }

  info(key) {
    return this.meta.get(key) ?? null;
  }

  /** manifest 里的原始尺寸，未加缩放 */
  getSize(key) {
    const info = this.meta.get(key);
    return new THREE.Vector3(info?.w ?? 1, info?.h ?? 1, info?.d ?? 1);
  }

  /** 应用缩放后的占地尺寸，用于碰撞与空位搜索 */
  footprint(key, scale = 1) {
    const size = this.getSize(key);
    return { w: size.x * scale, d: size.z * scale, h: size.y * scale };
  }

  async preload(onProgress) {
    if (this.preloadPromise) return this.preloadPromise;
    if (!this.loader) this.loader = new GLTFLoader();
    this.preloadPromise = (async () => {
      let list = [];
      try {
        const response = await fetch(`${KEY_BASE}/manifest.json`);
        if (response.ok) list = await response.json();
      } catch (error) {
        console.warn('[知屿] 村落 manifest 读取失败，岛屿将使用程序化建筑。', error);
      }
      if (!Array.isArray(list) || !list.length) return this;

      await Promise.all(list.map(async (meta) => {
        const key = meta?.name;
        if (!key) return;
        try {
          const gltf = await this.loader.loadAsync(`${KEY_BASE}/${key}.glb`);
          const root = gltf.scene;
          this.prepare(root, key);
          this.sources.set(key, root);
          this.meta.set(key, meta);
          if (meta.kind === 'building') this.buildingKeys.push(key);
          else this.propKeys.push(key);
          this.loadedCount += 1;
          onProgress?.(this.loadedCount, list.length, key);
        } catch (error) {
          this.failedKeys.push(key);
          console.warn(`[知屿] 村落模型 ${key} 未能载入。`, error);
        }
      }));
      if (this.failedKeys.length) {
        console.warn('[知屿] 村落缺失模型：', this.failedKeys.join(', '));
      }
      return this;
    })();
    return this.preloadPromise;
  }

  /**
   * 把每个模型自带的材质实例按「颜色 + 粗糙度」收拢。
   * 这套包所有材质都是同名同色的，收拢后整座岛只需要十几个材质。
   */
  prepare(root, key) {
    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = true;
      object.userData.sharedAsset = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const shared = materials.map((mat) => this.shareMaterial(mat));
      object.material = Array.isArray(object.material) ? shared : shared[0];
    });
    root.name = `village-${key}`;
  }

  shareMaterial(source) {
    if (!source) return source;
    const color = source.color ? source.color.clone() : new THREE.Color('#ffffff');
    const key = `${color.getHexString()}|${source.name ?? ''}`;
    let material = this.materials.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        name: source.name ?? 'village',
        color,
        roughness: MATERIAL_TUNING.roughness,
        metalness: MATERIAL_TUNING.metalness,
        envMapIntensity: MATERIAL_TUNING.envMapIntensity,
      });
      // 窗洞是深色玻璃，稍微反光一点才不像贴纸
      if (/window/i.test(source.name ?? '')) {
        material.roughness = 0.42;
        material.metalness = 0.1;
        material.color.offsetHSL(0, 0, 0.03);
      }
      this.materials.set(key, material);
    }
    return material;
  }

  /** 克隆一份模型（几何与共享材质不会重复占内存） */
  create(key, { scale = 1, rotation = 0, castShadow = true } = {}) {
    const source = this.sources.get(key);
    if (!source) return null;
    const clone = source.clone(true);
    clone.scale.setScalar(scale);
    clone.rotation.y = rotation;
    clone.userData.villageKey = key;
    if (!castShadow) {
      clone.traverse((object) => {
        if (object.isMesh) object.castShadow = false;
      });
    }
    return clone;
  }
}

export const village = new VillageAssetLibrary();

export async function preloadVillageAssets(onProgress) {
  return village.preload(onProgress);
}
