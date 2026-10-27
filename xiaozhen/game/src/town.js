import * as THREE from 'three';
import { mergeGeometries } from '../vendor/utils/BufferGeometryUtils.js';

/**
 * 中世纪村落（Medieval Village Pack）。
 *
 * 和原来那套"石块模块拼房子"不同，这个包给的是整栋建筑 + 独立道具，
 * 所以这里改成"按图纸摆位"：每栋建筑给坐标和朝向，道具散布在广场和街边。
 */

/** 世界与街道参数（单位：米，与地面贴图一致） */
export const WORLD = {
  groundSize: 128,
  boundary: 36,
  streetHalf: 6,
  laneHalf: 5,
  plazaHalf: 11.5,
};

/** 屋檐高度：动物/主角的碰撞高度参考 */
export const WALL_H = 3.2;

/** 建筑整体缩放（素材是按小尺寸做的，乘上来才像真房子） */
const BUILDING_SCALE = 1.95;
/** 道具缩放 */
const PROP_SCALE = 2.15;
/** 模型正面朝向的修正（0 = 模型正面朝 +Z） */
const FRONT = Math.PI;

/**
 * 建筑摆放：face 是"正面朝向"的方位角（0=+Z 南，PI/2=+X 东，PI=北，-PI/2=西），
 * 统一用小数是为了让房子稍微错开一点，不那么像棋盘。
 */
const BUILDINGS = [
  { piece: 'Inn', name: '落霞客栈', x: -13.5, z: -15.5, scale: 2.05 },
  { piece: 'Bell_Tower', name: '钟楼', x: 8.5, z: -20.5, scale: 2.15 },
  { piece: 'Blacksmith', name: '铁匠铺', x: 13.8, z: -15.0, scale: 1.95 },
  { piece: 'Stable', name: '马厩', x: 14.8, z: 14.5, scale: 1.9 },
  { piece: 'Sawmill', name: '锯木坊', x: -15.5, z: 14.5, scale: 1.9 },
  { piece: 'Mill', name: '老磨坊', x: -22.0, z: -2.0, scale: 2.0 },
  { piece: 'House_1', name: '木匠小屋', x: -18.5, z: -8.5, scale: 1.95 },
  { piece: 'House_2', name: '织布坊', x: 18.5, z: -8.0, scale: 1.95 },
  { piece: 'House_3', name: '面包坊', x: 18.5, z: 6.5, scale: 2.0 },
  { piece: 'House_4', name: '猎人小屋', x: -18.5, z: 7.0, scale: 2.05 },
  { piece: 'House_1', name: '北门农舍', x: -9.0, z: 21.0, scale: 1.85 },
  { piece: 'House_3', name: '南门农舍', x: 9.5, z: 21.5, scale: 1.9 },
];

/** 广场与街边道具 */
const PROPS = [
  { piece: 'Well', x: 0, z: 2.0, face: 0, collider: 1.5 },
  { piece: 'MarketStand_1', x: -7.4, z: 7.4, face: Math.PI * 0.62, collider: 1.3 },
  { piece: 'MarketStand_2', x: -7.0, z: -3.6, face: Math.PI * 0.5, collider: 1.2 },
  { piece: 'MarketStand_1', x: 7.2, z: 7.8, face: -Math.PI * 0.62, collider: 1.3 },
  { piece: 'MarketStand_2', x: 7.4, z: -4.4, face: -Math.PI * 0.5, collider: 1.2 },
  { piece: 'Cart', x: 5.2, z: 10.0, face: Math.PI * 0.2, collider: 1.1 },
  { piece: 'Bonfire_Lit', x: 2.2, z: 8.6, face: 0 },
  { piece: 'Bench_1', x: -3.8, z: 5.2, face: 0.2 },
  { piece: 'Bench_2', x: 3.4, z: -6.2, face: -0.3 },
  { piece: 'Gazebo', x: -9.0, z: -9.0, face: Math.PI * 0.25, collider: 1.1 },
  { piece: 'Cauldron', x: 5.0, z: 3.6, face: 0.3, collider: 0.6 },

  // 客栈门口
  { piece: 'Barrel', x: -8.6, z: -19.4, face: 0.6, collider: 0.5 },
  { piece: 'Barrel', x: -8.2, z: -20.6, face: 1.9 },
  { piece: 'Barrel', x: -7.8, z: -21.8, face: 0.2 },
  { piece: 'Crate', x: -7.6, z: -23.4, face: 0.8, collider: 0.5 },
  { piece: 'Bags', x: -9.4, z: -24.6, face: 1.2 },
  { piece: 'Hay', x: -7.0, z: -17.4, face: 0.4 },

  // 铁匠铺
  { piece: 'Barrel', x: 9.6, z: -13.0, face: 0.9 },
  { piece: 'Crate', x: 9.8, z: -16.6, face: 0.3, collider: 0.5 },
  { piece: 'Package_1', x: 10.2, z: -18.8, face: 0.7 },

  // 马厩
  { piece: 'Hay', x: 10.6, z: 13.2, face: 0.5 },
  { piece: 'Hay', x: 11.8, z: 13.0, face: 1.6 },
  { piece: 'Fence', x: 9.8, z: 18.4, face: Math.PI * 0.5, scale: 3.4 },
  { piece: 'Fence', x: 12.6, z: 18.4, face: Math.PI * 0.5, scale: 3.4 },
  { piece: 'Cart', x: 18.0, z: 10.6, face: 0.9, collider: 1.1 },

  // 锯木坊
  { piece: 'Package_2', x: -12.4, z: 12.0, face: 0.4 },
  { piece: 'Crate', x: -11.8, z: 18.6, face: 0.9, collider: 0.5 },
  { piece: 'Bonfire', x: -12.0, z: 20.0, face: 0 },

  // 磨坊 / 街道
  { piece: 'Bag_Open', x: -17.0, z: 10.0, face: 0.6 },
  { piece: 'Bag', x: -17.6, z: 11.2, face: 1.4 },
  { piece: 'Rock_1', x: -25.0, z: 6.0, face: 0.3 },
  { piece: 'Rock_2', x: 24.5, z: 2.0, face: 1.1 },
  { piece: 'Rock_3', x: 23.5, z: -12.5, face: 0.7 },
  { piece: 'Stairs', x: -9.5, z: -27.0, face: Math.PI * 0.5 },
  // 街边栅栏
  { piece: 'Fence', x: 6.6, z: -8.0, face: 0, scale: 3.2 },
  { piece: 'Fence', x: 6.6, z: -4.6, face: 0, scale: 3.2 },
  { piece: 'Fence', x: -6.6, z: 12.0, face: 0, scale: 3.2 },
  { piece: 'Fence', x: -6.6, z: 15.4, face: 0, scale: 3.2 },
];

/** 建造模式里可选的建筑（piece 对应 assets 里的模型名） */
export const BUILD_TYPES = [
  { piece: 'House_1', name: '民房·一', scale: 1.95 },
  { piece: 'House_2', name: '民房·二', scale: 1.95 },
  { piece: 'House_3', name: '民房·三', scale: 2.0 },
  { piece: 'House_4', name: '民房·四', scale: 2.05 },
  { piece: 'Inn', name: '客栈', scale: 2.05 },
  { piece: 'Blacksmith', name: '铁匠铺', scale: 1.95 },
  { piece: 'Stable', name: '马厩', scale: 1.9 },
  { piece: 'Mill', name: '磨坊', scale: 2.0 },
  { piece: 'Sawmill', name: '锯木坊', scale: 1.9 },
  { piece: 'Bell_Tower', name: '钟楼', scale: 2.15 },
];

export const HOUSES = BUILDINGS.map((b, i) => ({
  id: `v${i}`,
  name: b.name,
  x: b.x,
  z: b.z,
  piece: b.piece,
}));

export const TOWER = { x: 9.0, z: -24.0, size: 4, floors: 2 };

export class Town {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets || {};
    this.root = new THREE.Group();
    this.root.name = 'town';
    this.colliders = [];
    this.mapRects = [];
    this.doorPoints = [];
    this.lights = [];
    scene.add(this.root);
  }

  /* ---------------- 基础工具 ---------------- */

  proto(piece) {
    return this.assets[piece] || null;
  }

  footprint(piece, scale) {
    const info = this.assets[`${piece}__size`];
    const w = (info?.w || 3) * scale;
    const d = (info?.d || 3) * scale;
    return { w, d, h: (info?.h || 3) * scale };
  }

  place(piece, x, z, face = 0, scale = BUILDING_SCALE, opts = {}) {
    const src = this.proto(piece);
    if (!src) return null;
    const obj = src.clone(true);
    obj.position.set(x, opts.y ?? 0, z);
    // 模型正面朝 +Z，FRONT 是素材本身的朝向修正
    obj.rotation.y = FRONT + (opts.spin ?? 0) + face - Math.PI;
    obj.scale.setScalar(scale);
    obj.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = true;
      }
    });
    this.root.add(obj);
    return obj;
  }

  addCollider(x, z, sx, sz, height = 8, pad = 0.3) {
    this.colliders.push({
      minX: x - sx / 2 - pad,
      maxX: x + sx / 2 + pad,
      minZ: z - sz / 2 - pad,
      maxZ: z + sz / 2 + pad,
      height,
      soft: false,
    });
  }

  /** 旋转后的水平包围盒（用于碰撞与小地图） */
  static rotatedExtent(w, d, angle) {
    const c = Math.abs(Math.cos(angle));
    const s = Math.abs(Math.sin(angle));
    return { sx: w * c + d * s, sz: w * s + d * c };
  }

  /* ---------------- 建造 ---------------- */

  build() {
    for (const cfg of BUILDINGS) {
      const scale = cfg.scale || BUILDING_SCALE;
      const { w, d, h } = this.footprint(cfg.piece, scale);
      // 门朝广场：朝向 = 从建筑指向原点的方位角
      const face = cfg.face ?? Math.atan2(-cfg.x, -cfg.z);
      cfg.face = face;
      const obj = this.place(cfg.piece, cfg.x, cfg.z, face, scale);
      if (!obj) continue;
      const { sx, sz } = Town.rotatedExtent(w, d, obj.rotation.y);
      // 建筑本体挡路；稍微收一点，免得门口被自己卡住
      this.addCollider(cfg.x, cfg.z, sx * 0.94, sz * 0.94, h, 0.1);
      this.mapRects.push({ minX: cfg.x - sx / 2, maxX: cfg.x + sx / 2, minZ: cfg.z - sz / 2, maxZ: cfg.z + sz / 2 });
      this.doorPoints.push({ x: cfg.x + Math.sin(cfg.face) * (d / 2 + 1), z: cfg.z + Math.cos(cfg.face) * (d / 2 + 1) });
    }

    for (const cfg of PROPS) {
      const scale = cfg.scale || PROP_SCALE;
      const obj = this.place(cfg.piece, cfg.x, cfg.z, cfg.face || 0, scale, { y: cfg.y ?? 0 });
      if (!obj) continue;
      if (cfg.collider) {
        const { w, d } = this.footprint(cfg.piece, scale);
        const { sx, sz } = Town.rotatedExtent(w, d, obj.rotation.y);
        this.addCollider(cfg.x, cfg.z, sx, sz, (this.assets[`${cfg.piece}__size`]?.h || 1) * scale, 0.05);
      }
    }

    this.batch();

    const b = WORLD.boundary;
    this.bounds = { minX: -b, maxX: b, minZ: -b, maxZ: b };
    return this;
  }

  /**
   * 把静态模型按「材质 + 空间格子」合并，减少 draw call，
   * 同时让视锥剔除能整块剔掉身后那一片。
   */
  batch() {
    this.root.updateMatrixWorld(true);

    const CELL = 24;
    const groups = new Map();
    const pos = new THREE.Vector3();
    this.root.traverse((obj) => {
      if (!obj.isMesh || obj.isSkinnedMesh || obj.isInstancedMesh) return;
      const geo = obj.geometry;
      if (!geo || !geo.attributes.position) return;
      if (Array.isArray(obj.material)) return;
      obj.getWorldPosition(pos);
      const key = [
        obj.material.uuid,
        geo.index ? 'indexed' : 'plain',
        Object.keys(geo.attributes).sort().join(','),
        Math.floor(pos.x / CELL),
        Math.floor(pos.z / CELL),
      ].join('|');

      let group = groups.get(key);
      if (!group) {
        group = { material: obj.material, geos: [] };
        groups.set(key, group);
      }
      const clone = geo.clone();
      clone.applyMatrix4(obj.matrixWorld);
      group.geos.push(clone);
    });

    const merged = new THREE.Group();
    merged.name = 'town-batched';
    for (const { material, geos } of groups.values()) {
      const geometry = mergeGeometries(geos, false);
      if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      merged.add(mesh);
      geos.forEach((g) => g.dispose());
    }

    this.scene.remove(this.root);
    this.root.traverse((obj) => {
      if (obj.isMesh) obj.geometry.dispose();
    });
    this.scene.add(merged);
    this.root = merged;
  }

  /** 这个位置能不能盖：场地内、且不和已有建筑/道具重叠 */
  canPlace(x, z, w, d, margin = 1.0) {
    const limit = WORLD.boundary - 4;
    if (Math.abs(x) + w / 2 > limit || Math.abs(z) + d / 2 > limit) return false;
    const minX = x - w / 2 - margin;
    const maxX = x + w / 2 + margin;
    const minZ = z - d / 2 - margin;
    const maxZ = z + d / 2 + margin;
    for (const c of this.colliders) {
      if (minX < c.maxX && maxX > c.minX && minZ < c.maxZ && maxZ > c.minZ) return false;
    }
    return true;
  }

  /** 玩家在建造模式里点下的一栋房子：摆上去 + 记碰撞 + 记小地图 */
  addBuilding(piece, x, z, face, scale = BUILDING_SCALE) {
    const obj = this.place(piece, x, z, face, scale);
    if (!obj) return null;
    const { w, d, h } = this.footprint(piece, scale);
    const { sx, sz } = Town.rotatedExtent(w, d, obj.rotation.y);
    this.addCollider(x, z, sx * 0.94, sz * 0.94, h, 0.1);
    this.mapRects.push({
      minX: x - sx / 2, maxX: x + sx / 2, minZ: z - sz / 2, maxZ: z + sz / 2,
    });
    const cfg = BUILD_TYPES.find((t) => t.piece === piece);
    HOUSES.push({ id: `b${HOUSES.length}`, name: cfg?.name || '民居', x, z, piece });
    return obj;
  }

  isBlocked(x, z, radius = 0.6) {
    for (const c of this.colliders) {
      if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ) {
        return true;
      }
    }
    return false;
  }
}
