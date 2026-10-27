import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Quaternius「Ultimate Fantasy RTS」建筑库。
 *
 * 这套模型没有贴图，颜色直接写在材质里，而且是 .gltf + 内嵌 base64 的单文件，
 * 拷进 public 就能用。每类建筑都有 Level1 / Level2 / Level3 三档，
 * 正好对应「开局只能盖最低级，完成题目之后才能盖更高的」。
 *
 * 载入时做三件事：
 *   1. 按颜色收拢材质，二十个模型只占一套；
 *   2. 量出包围盒，后面按目标高度缩放，不同来源的单位差别就不用管了；
 *   3. 克隆时共用几何体，销毁整岛时不会把别人的几何一起释放。
 */
const BASE = '/models/rts';

const KEYS = [
  'Storage_FirstAge_Level1',
  'Storage_FirstAge_Level2',
  'Storage_FirstAge_Leve3',
  'Barracks_FirstAge_Level1',
  'Barracks_FirstAge_Level2',
  'Barracks_FirstAge_Level3',
  'Market_FirstAge_Level1',
  'Market_FirstAge_Level2',
  'Market_FirstAge_Level3',
  'Farm_FirstAge_Level1_Wheat',
  'Farm_FirstAge_Level2_Wheat',
  'Farm_FirstAge_Level3_Wheat',
  'Windmill_FirstAge',
  'Windmill_SecondAge',
  'Houses_FirstAge_1_Level1',
  'Houses_FirstAge_1_Level2',
  'Houses_FirstAge_1_Level3',
  'Houses_FirstAge_2_Level1',
  'Houses_FirstAge_2_Level2',
  'Houses_FirstAge_2_Level3',
  'Houses_FirstAge_3_Level1',
  'Houses_FirstAge_3_Level2',
  'Houses_FirstAge_3_Level3',
  'Temple_FirstAge_Level1',
  'Temple_FirstAge_Level2',
  'Temple_FirstAge_Level3',
  'Wonder_FirstAge_Level1',
  'Wonder_FirstAge_Level2',
  'Wonder_FirstAge_Level3',
  'Wonder_SecondAge_Level1',
  'Wonder_SecondAge_Level2',
  'Wonder_SecondAge_Level3',
  'WallTowers_Door_FirstAge',
  'WallTowers_Door_SecondAge',
  'WatchTower_FirstAge_Level1',
  'WatchTower_FirstAge_Level2',
  'WatchTower_FirstAge_Level3',
  'Dock_FirstAge',
  'Logs',
  'Barrel',
  'Crate',
  'Rock',
];

class RtsAssetLibrary {
  constructor() {
    this.loader = null;
    this.sources = new Map();
    this.sizes = new Map();
    this.materials = new Map();
    this.preloadPromise = null;
    this.ready = false;
    this.loaded = 0;
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
    this.preloadPromise = (async () => {
      await Promise.all(KEYS.map(async (key) => {
        try {
          const gltf = await this.loader.loadAsync(`${BASE}/${key}.gltf`);
          const root = gltf.scene;
          this.prepare(root, key);
          this.sources.set(key, root);
          this.loaded += 1;
          onProgress?.(this.loaded, KEYS.length, key);
        } catch (error) {
          console.warn(`[知屿] RTS 建筑 ${key} 未能载入。`, error);
        }
      }));
      this.ready = this.sources.size > 0;
      return this;
    })();
    return this.preloadPromise;
  }

  prepare(root, key) {
    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      object.userData.sharedAsset = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const shared = materials.map((mat) => this.shareMaterial(mat));
      object.material = Array.isArray(object.material) ? shared : shared[0];
    });
    root.name = `rts-${key}`;
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    this.sizes.set(key, size);
    root.userData.rtsKey = key;
  }

  shareMaterial(source) {
    if (!source) return source;
    const color = source.color ? source.color.clone() : new THREE.Color('#ffffff');
    const key = color.getHexString();
    let material = this.materials.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        name: `rts-${key}`,
        color,
        roughness: 0.88,
        metalness: 0,
        envMapIntensity: 0.5,
      });
      this.materials.set(key, material);
    }
    return material;
  }

  /**
   * 克隆一栋建筑。
   * targetHeight 给了就按高度归一化——包里每栋模型的原始尺寸都不一样，
   * 统一到「一层楼 ≈ 3 米」之后，房子之间才有正常的比例。
   */
  create(key, { targetHeight = 0, targetWidth = 0, scale = 1, rotation = 0, ghost = false } = {}) {
    const source = this.sources.get(key);
    if (!source) return null;
    const clone = source.clone(true);
    const size = this.sizes.get(key);
    // 按占地宽度归一化更靠谱：RTS 的议事厅带着一圈围墙，按高度缩放会撑到离谱
    const fit = this.fitFor(size, { targetHeight, targetWidth });
    clone.scale.setScalar(fit * scale);
    clone.rotation.y = rotation;
    clone.userData.rtsKey = key;
    clone.traverse((object) => {
      if (!object.isMesh) return;
      object.userData.sharedAsset = true;
      if (ghost) {
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });
    return clone;
  }

  /** 缩放系数：给了宽度按宽度算，否则按高度算 */
  fitFor(size, { targetHeight = 0, targetWidth = 0 } = {}) {
    if (!size) return 1;
    if (targetWidth > 0) {
      const span = Math.max(size.x, size.z);
      return span > 0.001 ? targetWidth / span : 1;
    }
    return targetHeight > 0 && size.y > 0.001 ? targetHeight / size.y : 1;
  }

  /** 缩放后的占地尺寸，用来算碰撞与放置间距 */
  footprint(key, { targetWidth = 0, targetHeight = 0 } = {}) {
    const size = this.sizes.get(key);
    if (!size) return { w: 2, d: 2, h: 2 };
    const fit = this.fitFor(size, { targetWidth, targetHeight });
    return { w: size.x * fit, d: size.z * fit, h: size.y * fit };
  }
}

export const rts = new RtsAssetLibrary();

export async function preloadRtsAssets(onProgress) {
  return rts.preload(onProgress);
}
