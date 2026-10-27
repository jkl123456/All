import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { village } from './villageAssets.js';

/**
 * 苔溪镇（xiǎozhèn）的村子布局，原样搬过来的。
 *
 * 坐标、朝向、道具清单都取自原项目的 town.js，只多了三件事：
 *   · layoutScale —— 岛比原来的 128 米地面小，把坐标整体收缩，房子本身不缩；
 *   · subset     —— 小岛只留几栋标志性建筑（客栈、钟楼、铁匠铺……）；
 *   · anchor     —— 给交互留一个看不见的锚点（合批之后模型不再是一个个对象）。
 */

/** 原项目的街道参数（单位：米），layoutScale 会乘上去 */
export const TOWN_WORLD = {
  streetHalf: 6,
  laneHalf: 5,
  plazaHalf: 11.5,
};

const BUILDING_SCALE = 1.95;
const PROP_SCALE = 2.15;

/** 建筑摆放：face 是「正面朝向」的方位角，注释里的名字是原项目的叫法 */
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

/** 小岛用的建筑子集：留最能认出村子的那几栋 */
export const TOWN_SUBSETS = {
  full: null,
  small: ['Inn', 'Bell_Tower', 'Blacksmith', 'Mill', 'House_1', 'House_2', 'House_3'],
  tiny: ['Inn', 'Bell_Tower', 'Blacksmith', 'House_1', 'House_3'],
};

export class Town {
  constructor(scene, {
    layoutScale = 1,
    center = { x: 0, z: 0 },
    groundY = 0,
    buildingScale = 1,
    propScale = 1,
    subset = null,
    withProps = true,
    maxRadius = 999,
    rotation = 0,
  } = {}) {
    this.rotation = rotation;
    this.scene = scene;
    this.layoutScale = layoutScale;
    this.center = center;
    this.groundY = groundY;
    this.buildingScale = buildingScale;
    this.propScale = propScale;
    this.subset = subset;
    this.withProps = withProps;
    this.maxRadius = maxRadius;

    this.root = new THREE.Group();
    this.root.name = 'town';
    this.anchors = new THREE.Group();
    this.anchors.name = 'town-anchors';
    this.colliders = [];
    this.blockers = [];
    this.named = new Map();
    scene.add(this.root);
    scene.add(this.anchors);
  }

  /** 世界坐标：原项目的坐标乘上收缩比，再加岛心偏移 */
  /**
   * 原项目的坐标 → 岛上的世界坐标。
   * rotation 让整座村子转个方向，同一个苔溪镇就能在每座岛上摆出不同的朝向。
   */
  toWorld(x, z) {
    const rotation = this.rotation;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const rx = x * cos + z * sin;
    const rz = -x * sin + z * cos;
    return {
      x: this.center.x + rx * this.layoutScale,
      z: this.center.z + rz * this.layoutScale,
    };
  }

  place(piece, x, z, face = 0, scale = this.buildingScale, opts = {}) {
    if (!village.has(piece)) return null;
    const object = village.create(piece, { scale, rotation: face });
    if (!object) return null;
    object.position.set(x, this.groundY + (opts.y ?? 0), z);
    object.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = true;
      }
    });
    this.root.add(object);
    return object;
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

  static rotatedExtent(w, d, angle) {
    const c = Math.abs(Math.cos(angle));
    const s = Math.abs(Math.sin(angle));
    return { sx: w * c + d * s, sz: w * s + d * c };
  }

  /** 在建筑位置放一个看不见的锚点，交互标记与对话都挂在它上面 */
  anchor(name, x, z, height = 2.4) {
    const node = new THREE.Object3D();
    node.position.set(x, this.groundY + 0.05, z);
    node.name = `anchor-${name}`;
    node.visible = true;
    this.anchors.add(node);
    this.named.set(name, { x, z, height, object: node });
    return node;
  }

  build() {
    const pieces = this.subset ?? BUILDINGS.map((b) => b.piece);
    const allowed = new Set(pieces);
    // 子集里同名建筑可能出现两次（民房），按出现次数放行
    const budget = new Map();
    pieces.forEach((piece) => budget.set(piece, (budget.get(piece) ?? 0) + 1));

    for (const cfg of BUILDINGS) {
      const left = budget.get(cfg.piece) ?? 0;
      if (!allowed.has(cfg.piece) || left <= 0) continue;
      const spot = this.toWorld(cfg.x, cfg.z);
      if (Math.hypot(spot.x - this.center.x, spot.z - this.center.z) > this.maxRadius) continue;
      const scale = (cfg.scale ?? BUILDING_SCALE) * this.buildingScale;
      const face = Math.atan2(this.center.x - spot.x, this.center.z - spot.z);
      const object = this.place(cfg.piece, spot.x, spot.z, face, scale);
      if (!object) continue;
      budget.set(cfg.piece, left - 1);
      const footprint = village.footprint(cfg.piece, scale);
      const { sx, sz } = Town.rotatedExtent(footprint.w, footprint.d, object.rotation.y);
      this.addCollider(spot.x, spot.z, sx * 0.94, sz * 0.94, footprint.h, 0.1);
      this.blockers.push({
        x: spot.x,
        z: spot.z,
        radius: Math.max(sx, sz) * 0.5,
        type: 'town',
        name: cfg.name,
        piece: cfg.piece,
      });
      this.anchor(cfg.name, spot.x, spot.z, footprint.h);
      this.named.get(cfg.name).piece = cfg.piece;
      this.named.get(cfg.name).scale = scale;
      this.named.get(cfg.name).footprint = footprint;
    }

    if (this.withProps) {
      for (const cfg of PROPS) {
        const spot = this.toWorld(cfg.x, cfg.z);
        if (Math.hypot(spot.x - this.center.x, spot.z - this.center.z) > this.maxRadius) continue;
        const scale = (cfg.scale ?? PROP_SCALE) * this.propScale;
        const object = this.place(cfg.piece, spot.x, spot.z, cfg.face ?? 0, scale, { y: cfg.y ?? 0 });
        if (!object) continue;
        if (cfg.collider) {
          const footprint = village.footprint(cfg.piece, scale);
          const { sx, sz } = Town.rotatedExtent(footprint.w, footprint.d, object.rotation.y);
          this.addCollider(spot.x, spot.z, sx, sz, footprint.h, 0.05);
          this.blockers.push({
            x: spot.x,
            z: spot.z,
            radius: Math.max(sx, sz) * 0.5,
            type: 'town-prop',
          });
        }
      }
    }

    this.batch();
    return this;
  }

  /**
   * 静态模型按「材质 + 空间格子」合并，把 draw call 压到几十个。
   * 合批之后每个交互点仍靠 anchor 定位，所以不影响玩法。
   */
  batch() {
    this.root.updateMatrixWorld(true);
    const CELL = 16;
    const groups = new Map();
    const position = new THREE.Vector3();

    this.root.traverse((object) => {
      if (!object.isMesh || object.isSkinnedMesh || object.isInstancedMesh) return;
      const geometry = object.geometry;
      if (!geometry?.attributes?.position) return;
      if (Array.isArray(object.material)) return;
      object.getWorldPosition(position);
      const key = [
        object.material.uuid,
        geometry.index ? 'indexed' : 'plain',
        Object.keys(geometry.attributes).sort().join(','),
        Math.floor(position.x / CELL),
        Math.floor(position.z / CELL),
      ].join('|');
      let group = groups.get(key);
      if (!group) {
        group = { material: object.material, geometries: [] };
        groups.set(key, group);
      }
      const clone = geometry.index ? geometry.toNonIndexed() : geometry.clone();
      clone.applyMatrix4(object.matrixWorld);
      group.geometries.push(clone);
    });

    const merged = new THREE.Group();
    merged.name = 'town-batched';
    for (const { material, geometries } of groups.values()) {
      let geometry = null;
      try {
        geometry = mergeGeometries(geometries, false);
      } catch {
        geometry = null;
      }
      if (!geometry) {
        geometries.forEach((item) => item.dispose());
        continue;
      }
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      merged.add(mesh);
      geometries.forEach((item) => item.dispose());
    }

    this.scene.remove(this.root);
    this.root.traverse((object) => {
      if (object.isMesh) object.geometry.dispose();
    });
    this.scene.add(merged);
    this.root = merged;
  }

  isBlocked(x, z, radius = 0.6) {
    for (const collider of this.colliders) {
      if (x + radius > collider.minX && x - radius < collider.maxX
        && z + radius > collider.minZ && z - radius < collider.maxZ) {
        return true;
      }
    }
    return false;
  }
}
