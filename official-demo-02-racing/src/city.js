import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeCanvas, mulberry32, canvasTexture, clamp } from './utils.js';
import { TRACK } from './config.js';

const FACADE_TILE_W = 12;
const FACADE_TILE_H = 14;

function scaleBoxUVs(geo, w, h, d) {
  const uv = geo.attributes.uv;
  const scales = [
    [d / FACADE_TILE_W, h / FACADE_TILE_H],
    [d / FACADE_TILE_W, h / FACADE_TILE_H],
    [w / FACADE_TILE_W, d / FACADE_TILE_W],
    [w / FACADE_TILE_W, d / FACADE_TILE_W],
    [w / FACADE_TILE_W, h / FACADE_TILE_H],
    [w / FACADE_TILE_W, h / FACADE_TILE_H],
  ];
  for (let face = 0; face < 6; face++) {
    for (let i = 0; i < 4; i++) {
      const k = face * 4 + i;
      uv.setXY(k, uv.getX(k) * scales[face][0], uv.getY(k) * scales[face][1]);
    }
  }
  uv.needsUpdate = true;
}

// The shopfront sheet is a single 5m-tall strip: do not tile it vertically.
function scaleShopUVs(geo, w, h, d) {
  const uv = geo.attributes.uv;
  const xs = [
    Math.max(1, d / 26), Math.max(1, d / 26),
    1, 1,
    Math.max(1, w / 26), Math.max(1, w / 26),
  ];
  for (let face = 0; face < 6; face++) {
    for (let i = 0; i < 4; i++) {
      const k = face * 4 + i;
      uv.setXY(k, uv.getX(k) * xs[face], uv.getY(k));
    }
  }
  uv.needsUpdate = true;
}

function setTint(geo, tint) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = tint.r;
    arr[i * 3 + 1] = tint.g;
    arr[i * 3 + 2] = tint.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}

function makeBuildingGeometry(w, h, d, x, y, z, rot, tint, uv = true) {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (uv) scaleBoxUVs(geo, w, h, d);
  setTint(geo, tint);
  const m = new THREE.Matrix4().makeRotationY(rot);
  m.setPosition(x, y + h / 2, z);
  geo.applyMatrix4(m);
  return geo;
}

function cityGroundTexture() {
  const s = 1024;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rng = mulberry32(73);
  // tile = 120m: outer roads 18m, sidewalks, and a city block.
  ctx.fillStyle = '#262421';
  ctx.fillRect(0, 0, s, s);
  const road = 148; // 17.3m
  // sidewalk apron
  ctx.fillStyle = '#807668';
  ctx.fillRect(road, road, s - road * 2, s - road * 2);
  ctx.fillStyle = '#5f594f';
  ctx.fillRect(road + 52, road + 52, s - (road + 52) * 2, s - (road + 52) * 2);
  // block inner lot
  ctx.fillStyle = '#6b6459';
  ctx.fillRect(road + 62, road + 62, s - (road + 62) * 2, s - (road + 62) * 2);
  // inner markings / parking
  ctx.strokeStyle = 'rgba(214,199,176,0.15)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const y = road + 80 + i * 38;
    ctx.beginPath(); ctx.moveTo(road + 86, y); ctx.lineTo(s - road - 86, y); ctx.stroke();
  }
  ctx.strokeRect(road + 72, road + 72, s - (road + 72) * 2, s - (road + 72) * 2);
  // asphalt texture, roads
  ctx.fillStyle = '#33312e';
  ctx.fillRect(0, 0, s, road - 6);
  ctx.fillRect(0, s - road + 6, s, road - 6);
  ctx.fillRect(0, 0, road - 6, s);
  ctx.fillRect(s - road + 6, 0, road - 6, s);
  // road speckle
  for (let i = 0; i < 8000; i++) {
    const v = 35 + rng() * 45;
    ctx.fillStyle = `rgba(${v},${v - 1},${v - 3},0.5)`;
    ctx.fillRect(rng() * s, rng() * s, 1.3, 1.3);
  }
  // crosswalks at intersection corners
  ctx.fillStyle = 'rgba(224,214,195,0.24)';
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(20 + i * 14, road - 34, 8, 22);
    ctx.fillRect(20 + i * 14, s - road + 12, 8, 22);
    ctx.fillRect(road - 34, 20 + i * 14, 22, 8);
    ctx.fillRect(s - road + 12, 20 + i * 14, 22, 8);
  }
  // lane dashes
  ctx.fillStyle = 'rgba(231,218,195,0.4)';
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(s / 2 - 2, road + 25 + i * 78, 4, 34);
    ctx.fillRect(s / 2 - 2, s - road + 55 + i * 78, 4, 34);
    ctx.fillRect(road + 25 + i * 78, s / 2 - 2, 34, 4);
    ctx.fillRect(s - road + 55 + i * 78, s / 2 - 2, 34, 4);
  }
  // sidewalk joints
  ctx.strokeStyle = 'rgba(40,36,31,0.28)';
  ctx.lineWidth = 2;
  ctx.strokeRect(road, road, s - road * 2, s - road * 2);
  ctx.strokeRect(road + 54, road + 54, s - (road + 54) * 2, s - (road + 54) * 2);
  // subtle stains
  for (let i = 0; i < 60; i++) {
    const x = rng() * s, y = rng() * s;
    const r = 10 + rng() * 80;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(20,18,15,0.09)');
    g.addColorStop(1, 'rgba(20,18,15,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // center courtyard green flecks
  ctx.fillStyle = 'rgba(76, 86, 57, 0.20)';
  for (let i = 0; i < 26; i++) ctx.fillRect(road + 80 + rng() * 400, road + 80 + rng() * 400, 12 + rng() * 18, 6 + rng() * 12);
  return canvasTexture(c, { repeat: [1, 1], anisotropy: 16 });
}

export class City {
  constructor(scene, textures, track) {
    this.scene = scene;
    this.textures = textures;
    this.track = track;
    this.group = new THREE.Group();
    this.group.name = 'Havelli City';
    scene.add(this.group);
    this.rng = mulberry32(20261018);
    this.collections = {
      facades: Array.from({ length: 6 }, () => []),
      storefront: [],
      roof: [],
      trim: [],
      sidewalk: [],
      grass: [],
      signs: Array.from({ length: 4 }, () => []),
      balcony: [],
      fins: [],
      ac: [],
      antenna: [],
      neon: [],
    };
    this.nearbyBuildings = [];
    this.buildingCount = 0;
    // hw / hd 是地标实际占地的一半尺寸：避让时按真实轮廓而不是一个中心点计算。
    this.landmarkPlan = [
      { id: 'aurelia', x: -35, z: -36, r: 62, hw: 26, hd: 26 },
      { id: 'havelli1', x: 77, z: -17, r: 80, hw: 36, hd: 22 },
      { id: 'exchange', x: -360, z: 120, r: 75, hw: 32, hd: 32 },
      { id: 'pier', x: 560, z: 274, r: 150, hw: 58, hd: 22 },
      { id: 'nova', x: 200, z: 92, r: 54, hw: 26, hd: 25 },
      { id: 'spire', x: 285, z: 38, r: 52, hw: 28, hd: 27 },
      { id: 'annex', x: 115, z: -20, r: 48, hw: 18, hd: 18 },
    ];
    // 地标是手写坐标，赛道改过之后可能压到路面上；先做一次避让再建城。
    this.landmarkAnchors = this.resolveLandmarks();
    this.landmarkReserves = Object.values(this.landmarkAnchors).map((a) => ({ x: a.x, z: a.z, r: a.r }));
    this.buildMaterials();
    this.buildGround();
    this.buildCity();
    this.flush();
    this.buildLandmarks();
  }

  r(a = 0, b = 1) {
    return a + this.rng() * (b - a);
  }

  ri(a, b) {
    return Math.floor(this.r(a, b + 1));
  }

  buildMaterials() {
    const defs = this.textures.facades;
    this.facadeMaterials = defs.map((d) => new THREE.MeshStandardMaterial({
      map: d.map,
      emissiveMap: d.emissiveMap,
      emissive: 0xffffff,
      emissiveIntensity: d.emissiveIntensity * 1.25,
      normalMap: d.normalMap,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughness: d.roughness,
      metalness: d.metalness,
      vertexColors: true,
      envMapIntensity: 0.72,
    }));
    this.storeMaterial = new THREE.MeshStandardMaterial({
      map: this.textures.storeMap,
      emissiveMap: this.textures.storeEmissive,
      emissive: 0xffffff,
      emissiveIntensity: 0.65,
      roughness: 0.48,
      metalness: 0.1,
      vertexColors: true,
    });
    this.roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x5b554b, roughness: 0.94, metalness: 0.02, vertexColors: true,
    });
    this.trimMaterial = new THREE.MeshStandardMaterial({
      color: 0x3e3b35, roughness: 0.55, metalness: 0.35, vertexColors: true,
    });
    this.sidewalkMaterial = new THREE.MeshStandardMaterial({
      color: 0x948877, map: this.textures.concrete, roughness: 0.9, metalness: 0.01,
      vertexColors: true,
    });
    this.grassMaterial = new THREE.MeshStandardMaterial({ color: 0x596044, roughness: 0.96 });
    this.balconyMaterial = new THREE.MeshStandardMaterial({
      color: 0xc4b8a3, roughness: 0.82, metalness: 0.03,
    });
    this.finMaterial = new THREE.MeshStandardMaterial({
      color: 0x9c9486, roughness: 0.34, metalness: 0.7,
    });
    this.acMaterial = new THREE.MeshStandardMaterial({ color: 0x777268, roughness: 0.72, metalness: 0.15 });
    this.antennaMaterial = new THREE.MeshStandardMaterial({ color: 0x3c3b38, roughness: 0.45, metalness: 0.7 });
    this.landmarkRoofMaterial = new THREE.MeshStandardMaterial({ color: 0x4d4a44, roughness: 0.8, metalness: 0.1 });
    this.landmarkStoreMaterial = new THREE.MeshStandardMaterial({
      map: this.textures.storeMap,
      emissiveMap: this.textures.storeEmissive,
      emissive: 0xffffff,
      emissiveIntensity: 0.5,
      roughness: 0.48,
      metalness: 0.1,
    });
    this.neonMaterial = new THREE.MeshStandardMaterial({
      color: 0x1b130c, emissive: 0xff6a22, emissiveIntensity: 1.8, roughness: 0.35, metalness: 0.2,
    });
    this.signMaterials = this.textures.billboards.map((tex) => new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.56,
      roughness: 0.56, metalness: 0.04, side: THREE.DoubleSide,
    }));
  }

  buildGround() {
    const groundTex = cityGroundTexture();
    groundTex.repeat.set(30, 24);
    groundTex.needsUpdate = true;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(3600, 2880),
      new THREE.MeshStandardMaterial({
        map: groundTex, roughness: 0.95, metalness: 0.01, color: 0xbdb3a3,
        envMapIntensity: 0.25,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0.003, -1140);
    ground.receiveShadow = true;
    this.group.add(ground);
    this.ground = ground;

    // Waterfront promenade strip, drawn separately to feel more open.
    const prom = new THREE.Mesh(
      new THREE.PlaneGeometry(2700, 130),
      new THREE.MeshStandardMaterial({
        color: 0xab9d89, map: this.textures.concrete, roughness: 0.92, metalness: 0.01,
      }),
    );
    prom.rotation.x = -Math.PI / 2;
    prom.position.set(0, 0.04, 328);
    prom.receiveShadow = true;
    this.group.add(prom);
    this.promenade = prom;

    // A calm reflecting pool in a pocket plaza on the infield. It is anchored to
    // the track-free area so a layout change can never put water over the asphalt.
    const poolSpot = this.clearOfTrack(25, -38, { hw: 29, hd: 15 }, {},
      TRACK.width / 2 + TRACK.barrierOffset + 4);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(58, 30),
      new THREE.MeshPhysicalMaterial({
        color: 0x203b40, roughness: 0.12, metalness: 0.35, envMapIntensity: 1.3,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(poolSpot.x, 0.07, poolSpot.z);
    this.group.add(water);
    this.plazaPool = water;
  }

  /** 地标锚点：能放原处就放原处，压到赛道就就近外扩到净空位置。 */
  resolveLandmarks() {
    const anchors = {};
    const clearance = TRACK.width / 2 + TRACK.barrierOffset + 5;
    for (const p of this.landmarkPlan) {
      const spot = this.clearOfTrack(p.x, p.z, p, anchors, clearance);
      const moved = Math.hypot(spot.x - p.x, spot.z - p.z);
      anchors[p.id] = { x: spot.x, z: spot.z, r: p.r + moved, moved };
    }
    return anchors;
  }

  /** 按建筑真实占地（hw × hd）检测是否越过了护栏内侧。 */
  footprintClear(x, z, hw, hd, clearance) {
    const nx = Math.max(2, Math.ceil(hw / 10));
    const nz = Math.max(2, Math.ceil(hd / 10));
    for (let i = 0; i <= nx; i++) {
      const px = x + (i / nx - 0.5) * 2 * hw;
      for (let j = 0; j <= nz; j++) {
        const pz = z + (j / nz - 0.5) * 2 * hd;
        if (this.track.distanceToCenterline(px, pz) < clearance) return false;
      }
    }
    return true;
  }

  clearOfTrack(x, z, plan, taken, clearance = 0) {
    const hw = plan.hw ?? plan.solid ?? 20;
    const hd = plan.hd ?? plan.solid ?? 20;
    const reach = Math.hypot(hw, hd);
    const ok = (px, pz) => {
      // 先用外接圆做快速排除，再逐点核对轮廓
      if (this.track.distanceToCenterline(px, pz) < reach + clearance) return false;
      if (pz > 240) return false;
      if (this.isNearStart(px, pz)) return false;
      for (const other of Object.values(taken || {})) {
        if (Math.hypot(px - other.x, pz - other.z) < (other.r + reach) * 0.55 + 40) return false;
      }
      return this.footprintClear(px, pz, hw, hd, clearance);
    };
    if (ok(x, z)) return { x, z };
    for (let ring = 1; ring <= 40; ring++) {
      const rad = ring * 10;
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2 + ring * 0.27;
        const px = x + Math.cos(a) * rad;
        const pz = z + Math.sin(a) * rad;
        if (ok(px, pz)) return { x: px, z: pz };
      }
    }
    return { x, z };
  }

  anchor(id) {
    const a = this.landmarkAnchors?.[id];
    return a ? { x: a.x, z: a.z } : { x: 0, z: 0 };
  }

  /**
   * 发车建筑群（龙门架 / 看台 / 维修区）是按发车线局部坐标摆的，
   * 这里用同一套局部坐标留出净空，换赛道时自动跟着走。
   */
  isNearStart(x, z) {
    const s = this.track.samples[0];
    if (!s) return false;
    const dx = x - s.position.x;
    const dz = z - s.position.z;
    const along = dx * s.tangent.x + dz * s.tangent.z;
    const lateral = dx * s.right.x + dz * s.right.z;
    return Math.abs(along) < 56 && Math.abs(lateral) < TRACK.width / 2 + 54;
  }

  canPlace(x, z, radius, clearance = 18) {
    if (this.isNearStart(x, z)) return false;
    if (z > 292) return false;
    if (this.track.distanceToCenterline(x, z) < radius + TRACK.barrierOffset + clearance) return false;
    for (const lm of this.landmarkReserves || []) {
      if (Math.hypot(x - lm.x, z - lm.z) < radius + lm.r) return false;
    }
    return true;
  }

  heightAt(x, z) {
    let h = 12 + Math.abs(Math.sin(x * 0.012) * Math.cos(z * 0.014)) * 24;
    const clusters = [
      { x: -80, z: -100, r: 270, h: 150 },
      { x: 260, z: -200, r: 250, h: 120 },
      { x: -430, z: -290, r: 260, h: 90 },
      { x: 500, z: 40, r: 260, h: 105 },
      { x: 80, z: 40, r: 200, h: 120 },
      { x: -750, z: 170, r: 300, h: 85 },
      { x: 860, z: -300, r: 380, h: 100 },
    ];
    for (const c of clusters) {
      const d = Math.hypot(x - c.x, z - c.z);
      const f = Math.max(0, 1 - d / c.r);
      h += c.h * f * f;
    }
    h += Math.sin((x - z) * 0.0031) * 10;
    return clamp(h, 9, 210);
  }

  addBox(collection, w, h, d, x, y, z, rot, tint, uv = true) {
    const geo = makeBuildingGeometry(w, h, d, x, y, z, rot, tint, uv);
    collection.push(geo);
  }

  addShopBox(w, h, d, x, y, z, rot, tint) {
    const geo = new THREE.BoxGeometry(w, h, d);
    scaleShopUVs(geo, w, h, d);
    setTint(geo, tint);
    const m = new THREE.Matrix4().makeRotationY(rot);
    m.setPosition(x, y + h / 2, z);
    geo.applyMatrix4(m);
    this.collections.storefront.push(geo);
  }

  addInstance(list, pos, scale, rot = 0) {
    const obj = new THREE.Object3D();
    obj.position.copy(pos);
    obj.scale.copy(scale);
    obj.rotation.y = rot;
    obj.updateMatrix();
    list.push(obj.matrix.clone());
  }

  pickType(h) {
    const r = this.r();
    if (h > 75) {
      if (r < 0.5) return 0;
      if (r < 0.78) return 5;
      return this.r() < 0.5 ? 1 : 2;
    }
    if (h > 38) {
      if (r < 0.28) return 1;
      if (r < 0.5) return 2;
      if (r < 0.68) return 5;
      if (r < 0.86) return 3;
      return 0;
    }
    if (r < 0.3) return 4;
    if (r < 0.62) return 3;
    if (r < 0.8) return 1;
    return 2;
  }

  buildCity() {
    const cell = 100;
    const startX = -1500, endX = 1500, startZ = -1500, endZ = 292;
    const list = [];
    for (let gx = startX; gx < endX; gx += cell) {
      for (let gz = startZ; gz < endZ; gz += cell) {
        const cx = gx + cell / 2;
        const cz = gz + cell / 2;
        // waterfront stays low and open
        if (cz > 220 && this.r() < 0.45) continue;
        const rand = this.r();
        if (rand < 0.1) {
          this.addPark(cx + this.r(-18, 18), cz + this.r(-18, 18), this.r(22, 34));
          continue;
        }
        list.push({ cx, cz, gx, gz });
      }
    }

    for (const cellInfo of list) {
      const { cx, cz } = cellInfo;
      const count = this.r() < 0.62 ? 1 : this.r() < 0.82 ? 2 : 3;
      const placements = [];
      for (let i = 0; i < count; i++) {
        const w = this.r(20, i === 0 ? 52 : 32);
        const d = this.r(20, i === 0 ? 46 : 30);
        const sx = Math.max(2, 34 - w / 2);
        const sz = Math.max(2, 34 - d / 2);
        const ox = this.r(-sx, sx);
        const oz = this.r(-sz, sz);
        const x = cx + ox;
        const z = cz + oz;
        const radius = Math.hypot(w, d) / 2;
        if (!this.canPlace(x, z, radius, 17)) continue;
        let overlap = false;
        for (const p of placements) {
          if (Math.abs(p.x - x) < (p.w + w) / 2 + 5 && Math.abs(p.z - z) < (p.d + d) / 2 + 5) {
            overlap = true; break;
          }
        }
        if (overlap) continue;
        placements.push({ x, z, w, d });
        this.addBuilding(x, z, w, d);
      }
      if (!placements.length && this.r() < 0.28) {
        this.addPark(cx, cz, this.r(18, 32));
      }
    }
  }

  addPark(x, z, size) {
    // 铺装广场是正方形，比圆形草地半径更大，按外接圆一起做避让
    const rimRadius = (size + 12) * 0.7071;
    if (!this.canPlace(x, z, rimRadius, 7)) return;
    const geo = new THREE.CircleGeometry(size / 2, 12);
    geo.rotateX(-Math.PI / 2);
    geo.translate(x, 0.15, z);
    this.collections.grass.push(geo);
    // paved plaza rim
    this.addBox(this.collections.sidewalk, size + 12, 0.12, size + 12, x, 0, z, 0, new THREE.Color(0.92, 0.87, 0.81));
  }

  addBuilding(x, z, w, d) {
    let h = this.heightAt(x, z);
    const trackDist = this.track.distanceToCenterline(x, z);
    if (trackDist < 65) h = Math.min(h, 46);
    else if (trackDist < 120) h = Math.min(h, 88);
    if (z > 190) h = Math.min(h, 42);
    const r = this.r();
    h *= 0.72 + r * 0.6;
    h = clamp(h, 10, 205);
    const type = this.pickType(h);
    const rot = this.r(-0.055, 0.055);
    const tint = new THREE.Color(
      0.88 + this.r(-0.08, 0.12) + (this.r() < 0.5 ? 0.02 : -0.015),
      0.85 + this.r(-0.06, 0.10),
      0.82 + this.r(-0.07, 0.08) + (this.r() < 0.35 ? 0.035 : 0),
    );
    const near = trackDist < 230;
    const groundH = h > 55 ? 8.5 : 4.8;
    // sidewalk slab
    this.addBox(this.collections.sidewalk, w + 7, 0.16, d + 7, x, 0, z, rot, new THREE.Color(0.92, 0.87, 0.81));
    // podium and shopfront
    if (h > 44 && this.r() < 0.8) {
      this.addBox(this.collections.facades[type], w + 5, h > 90 ? 12 : 7, d + 5, x, groundH, z, rot, tint);
    }
    if (near || h < 32) {
      this.addShopBox(w + 0.35, groundH, d + 0.35, x, 0, z, rot, tint);
    } else {
      this.addBox(this.collections.facades[type], w, groundH, d, x, 0, z, rot, tint);
    }
    const startY = groundH;
    const bodyH = h - groundH;
    const setback = h > 92 && this.r() < 0.72;
    if (setback) {
      const lower = bodyH * 0.74;
      this.addBox(this.collections.facades[type], w, lower, d, x, startY, z, rot, tint);
      this.addBox(this.collections.facades[type], w * 0.78, bodyH * 0.21, d * 0.78, x, startY + lower, z, rot, tint);
      this.addBox(this.collections.trim, w * 0.82, 0.8, d * 0.82, x, startY + lower - 0.4, z, rot, new THREE.Color(0.55, 0.52, 0.47));
      this.addBox(this.collections.roof, w * 0.78, 0.3, d * 0.78, x, startY + lower + bodyH * 0.21, z, rot, new THREE.Color(0.75, 0.72, 0.66));
    } else {
      this.addBox(this.collections.facades[type], w, bodyH, d, x, startY, z, rot, tint);
    }
    // roof cap
    const roofW = w * (setback ? 0.78 : 1) + 0.5;
    const roofD = d * (setback ? 0.78 : 1) + 0.5;
    const topY = startY + bodyH;
    this.addBox(this.collections.roof, roofW, 0.4, roofD, x, topY, z, rot, new THREE.Color(0.72, 0.68, 0.6), false);
    this.addBox(this.collections.trim, roofW + 0.4, 0.85, 0.25, x, topY, z - (roofD / 2 + 0.1), rot, new THREE.Color(0.5, 0.48, 0.44), false);
    // corner parapet / crown lights
    if (h > 58 && this.r() < 0.72) {
      const bh = this.r(1.2, 3.2);
      this.addBox(this.collections.trim, roofW * 0.7, bh, roofD * 0.7, x, topY + 0.2, z, rot, new THREE.Color(0.45, 0.42, 0.38));
      if (this.r() < 0.6) {
        this.addBox(this.collections.neon, roofW * 0.68, 0.16, 0.16, x, topY + 0.9, z - roofD * 0.35, rot, new THREE.Color(1, 1, 1), false);
      }
    }
    // horizontal ledges and corner pilasters give close-up façades depth
    if (h > 26) {
      const ledgeColor = new THREE.Color(0.72, 0.68, 0.62);
      for (let yy = groundH + 7; yy < topY - 4; yy += this.r(9, 15)) {
        this.addBox(this.collections.trim, roofW + 0.45, 0.13, roofD + 0.45, x, yy, z, rot, ledgeColor, false);
      }
      if (h > 45 && near) {
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            this.addBox(this.collections.trim, 0.3, bodyH * 0.94, 0.3,
              x + sx * w * 0.48, startY + 1, z + sz * d * 0.48, rot,
              new THREE.Color(0.52, 0.49, 0.44), false);
          }
        }
      }
    }
    // mechanical penthouse
    if (h > 24 && this.r() < 0.8) {
      const mw = this.r(2.5, Math.max(3, w * 0.25));
      const md = this.r(2.5, Math.max(3, d * 0.25));
      this.addBox(this.collections.roof, mw, this.r(0.8, 2.6), md, x + this.r(-w * 0.18, w * 0.18), topY, z + this.r(-d * 0.18, d * 0.18), rot, new THREE.Color(0.62, 0.59, 0.54), false);
    }
    // roof AC units and antenna
    if (near || h > 60) {
      const n = this.ri(1, 4);
      for (let i = 0; i < n; i++) {
        const ac = new THREE.Vector3(x + this.r(-w * 0.3, w * 0.3), topY + 0.5, z + this.r(-d * 0.3, d * 0.3));
        this.addInstance(this.collections.ac, ac, new THREE.Vector3(this.r(1.2, 3.2), this.r(0.5, 1.2), this.r(1.2, 2.7)), rot);
      }
      if (h > 60) {
        const ant = new THREE.Vector3(x, topY + 0.2, z);
        this.addInstance(this.collections.antenna, ant, new THREE.Vector3(0.18, this.r(3, 9), 0.18), 0);
      }
    }
    // balcony slabs for residential mid-rises
    if (near && type === 3 && h < 110) {
      const floors = Math.min(13, Math.floor(bodyH / 3.6));
      for (let f = 1; f < floors; f++) {
        const yy = startY + f * 3.6;
        const front = new THREE.Vector3(x, yy, z + (d / 2 + 0.8));
        this.addInstance(this.collections.balcony, front, new THREE.Vector3(w * 0.72, 0.16, 1.7), rot);
        const side = new THREE.Vector3(x + (w / 2 + 0.8), yy, z);
        this.addInstance(this.collections.balcony, side, new THREE.Vector3(1.7, 0.16, d * 0.6), rot);
      }
    }
    // vertical fins on glass / ribbon towers
    if (near && (type === 0 || type === 5) && h > 28) {
      const finCount = 4;
      for (let i = 0; i < finCount; i++) {
        const fx = x + (i / (finCount - 1) - 0.5) * w * 0.95;
        this.addInstance(this.collections.fins, new THREE.Vector3(fx, startY + bodyH / 2, z + d / 2 + 0.18), new THREE.Vector3(0.12, bodyH, 0.55), rot);
      }
    }
    // shop awning along the street side
    if (near && h < 90 && this.r() < 0.55) {
      const awning = this.r() < 0.5 ? 1 : -1;
      this.addBox(this.collections.trim, w + 1.6, 0.22, 1.4, x, groundH - 0.8, z + awning * (d / 2 + 0.7), rot, new THREE.Color(0.45, 0.32, 0.24), false);
    }
    // 入口雨篷：薄板 + 细柱，给临街立面一层"人尺度"的细节
    if (near && h > 20 && this.r() < 0.5) {
      const dir = this.r() < 0.5 ? 1 : -1;
      const cz = z + dir * (d / 2 + 1.7);
      const canopy = new THREE.Color(0.26, 0.27, 0.3);
      this.addBox(this.collections.trim, w * 0.36, 0.18, 3.4, x, groundH - 0.34, cz, rot, canopy, false);
      for (const sx of [-1, 1]) {
        this.addBox(this.collections.trim, 0.14, groundH - 0.34, 0.14, x + sx * w * 0.15, 0, cz + dir * 1.25, rot, canopy, false);
      }
    }
    // 竖向色带 / 幕墙腰线：拉高立面的层次
    if (near && h > 34 && this.r() < 0.34) {
      const bandColor = new THREE.Color(0.34, 0.33, 0.31);
      const bw = 1.1;
      this.addBox(this.collections.trim, bw, bodyH * 0.72, 0.35,
        x + w * 0.18, startY + bodyH * 0.1, z + d / 2 + 0.2, rot, bandColor, false);
    }
    // billboard on the façade facing the track
    if (near && h > 26 && h < 160 && this.r() < 0.4) {
      const nearSample = this.track.nearest(x, z);
      const dx = nearSample.sample.position.x - x;
      const dz = nearSample.sample.position.z - z;
      const ang = Math.atan2(dx, dz);
      const depth = d / 2 + 0.25;
      const sx = x + Math.sin(ang) * depth;
      const sz = z + Math.cos(ang) * depth;
      const by = Math.min(h - 7, Math.max(12, h * 0.45));
      this.addSign(sx, by, sz, ang, this.ri(0, 3), this.r(0.75, 1.15));
    }
    // occasional orange façade line
    if (near && this.r() < 0.18) {
      this.addBox(this.collections.neon, 0.1, bodyH * 0.8, 0.1, x + w / 2 + 0.06, startY + bodyH * 0.4, z + d / 2 + 0.06, rot, new THREE.Color(1, 1, 1), false);
    }

    this.buildingCount++;
    if (near) this.nearbyBuildings.push({ x, z, w, d, h, type });
  }

  addSign(x, y, z, yaw, textureIndex, scale = 1) {
    const g = new THREE.PlaneGeometry(13 * scale, 5.2 * scale);
    const m = new THREE.Matrix4().makeRotationY(yaw);
    m.setPosition(x, y, z);
    g.applyMatrix4(m);
    this.collections.signs[textureIndex].push(g);
    // frame edge
    const trim = new THREE.BoxGeometry(13 * scale + 0.3, 5.2 * scale + 0.3, 0.2);
    const mt = new THREE.Matrix4().makeRotationY(yaw);
    mt.setPosition(x, y, z - 0.14);
    trim.applyMatrix4(mt);
    setTint(trim, new THREE.Color(0.6, 0.57, 0.5));
    this.collections.trim.push(trim);
  }

  flush() {
    const merge = (geos, mat, cast = true) => {
      if (!geos.length) return null;
      const merged = mergeGeometries(geos, false);
      if (!merged) return null;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      return mesh;
    };
    this.collections.facades.forEach((list, i) => merge(list, this.facadeMaterials[i]));
    merge(this.collections.storefront, this.storeMaterial);
    merge(this.collections.roof, this.roofMaterial);
    merge(this.collections.trim, this.trimMaterial);
    merge(this.collections.sidewalk, this.sidewalkMaterial);
    merge(this.collections.grass, this.grassMaterial, false);
    merge(this.collections.neon, this.neonMaterial, false);
    this.collections.signs.forEach((list, i) => {
      if (!list.length) return;
      const mesh = new THREE.Mesh(mergeGeometries(list, false), this.signMaterials[i]);
      this.group.add(mesh);
    });

    const instanced = (matrices, geo, mat, cast = true) => {
      if (!matrices.length) return;
      const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    };
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
    instanced(this.collections.balcony, unitBox, this.balconyMaterial);
    instanced(this.collections.fins, unitBox, this.finMaterial);
    instanced(this.collections.ac, unitBox, this.acMaterial);
    instanced(this.collections.antenna, unitCyl, this.antennaMaterial);
  }

  buildLandmarks() {
    // Landmarks are composed from the same façade language, then finished with
    // sculpted crowns so the skyline has a recognizable silhouette.
    this.landmarks = new THREE.Group();
    this.landmarks.name = 'Havelli landmarks';
    this.group.add(this.landmarks);

    const addGeometry = (geo, mat) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.landmarks.add(mesh);
      return mesh;
    };

    // AURELIA TOWER — a faceted glass obelisk on the western skyline.
    {
      const { x, z } = this.anchor('aurelia');
      const base = 12;
      const tint = new THREE.Color(0.95, 0.92, 0.9);
      const stack = [
        { w: 40, d: 40, h: 86, y: 0 },
        { w: 32, d: 32, h: 48, y: 86 },
        { w: 24, d: 24, h: 30, y: 134 },
      ];
      for (const s of stack) {
        addGeometry(makeBuildingGeometry(s.w, s.h, s.d, x, base + s.y, z, 0.2, tint), this.facadeMaterials[0]);
      }
      addGeometry(makeBuildingGeometry(6, 46, 6, x, base + 164, z, 0.2, tint), this.trimMaterial);
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(5.6, 12, 4),
        new THREE.MeshStandardMaterial({ color: 0x2a2a27, roughness: 0.4, metalness: 0.7, emissive: 0xff6a22, emissiveIntensity: 0.25 }),
      );
      crown.position.set(x, base + 205, z);
      crown.rotation.y = Math.PI / 4;
      crown.castShadow = true;
      this.landmarks.add(crown);
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xff5a1f }),
      );
      beacon.position.set(x, base + 212, z);
      this.landmarks.add(beacon);
    }

    // HAVELLI ONE — twin towers with illuminated mechanical crowns.
    {
      const materials = this.facadeMaterials[5];
      const a1 = this.anchor('havelli1');
      const positions = [[a1.x - 17, a1.z + 5], [a1.x + 17, a1.z - 5]];
      positions.forEach(([x, z], i) => {
        const tint = new THREE.Color(i ? 0.84 : 0.9, 0.87, 0.88);
        const base = new THREE.Mesh(makeBuildingGeometry(34, 12, 30, x, 0, z, 0.04, new THREE.Color(0.92, 0.87, 0.8)), this.landmarkStoreMaterial);
        base.position.set(0, 0, 0);
        base.castShadow = true; base.receiveShadow = true;
        this.landmarks.add(base);
        addGeometry(makeBuildingGeometry(30, 124 + i * 18, 27, x, 12, z, 0.02, tint), materials);
        addGeometry(makeBuildingGeometry(26, 4, 23, x, 136 + i * 18, z, 0.02, tint), this.trimMaterial);
      });
      const bridge = addGeometry(makeBuildingGeometry(38, 3.2, 8, a1.x, 113, a1.z, 0, new THREE.Color(0.8, 0.76, 0.7)), this.trimMaterial);
      bridge.material = this.trimMaterial;
    }

    // The Havelli Exchange — stone civic tower with a clock-like crown.
    {
      const { x, z } = this.anchor('exchange');
      const tint = new THREE.Color(0.96, 0.89, 0.79);
      addGeometry(makeBuildingGeometry(54, 44, 54, x, 0, z, -0.12, tint), this.facadeMaterials[1]);
      addGeometry(makeBuildingGeometry(42, 34, 42, x, 44, z, -0.12, tint), this.facadeMaterials[1]);
      addGeometry(makeBuildingGeometry(30, 24, 30, x, 78, z, -0.12, tint), this.facadeMaterials[1]);
      addGeometry(makeBuildingGeometry(8, 34, 8, x, 102, z, -0.12, tint), this.facadeMaterials[2]);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(9, 13, 4), this.landmarkRoofMaterial);
      roof.position.set(x, 142, z);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      this.landmarks.add(roof);
    }

    // Sunset Pier Hotel — curved low-rise on the waterfront.
    {
      const { x, z } = this.anchor('pier');
      const tint = new THREE.Color(1.0, 0.93, 0.83);
      addGeometry(makeBuildingGeometry(110, 28, 34, x, 0, z, 0.1, tint), this.facadeMaterials[3]);
      addGeometry(makeBuildingGeometry(92, 15, 28, x, 28, z, 0.1, tint), this.facadeMaterials[3]);
      addGeometry(makeBuildingGeometry(170, 1.1, 46, x, 0, z, 0.1, new THREE.Color(0.85, 0.78, 0.67)), this.sidewalkMaterial);
      // balconies
      for (let f = 1; f < 8; f++) {
        addGeometry(makeBuildingGeometry(112, 0.35, 2.1, x, f * 3.5, z + 17, 0.1, new THREE.Color(0.8, 0.74, 0.66)), this.balconyMaterial);
      }
    }

    // NOVA TOWER — a faceted glass obelisk that anchors the eastern skyline.
    {
      const { x, z } = this.anchor('nova');
      const tint = new THREE.Color(0.92, 0.95, 1.0);
      addGeometry(makeBuildingGeometry(44, 12, 42, x, 0, z, -0.06, new THREE.Color(0.9, 0.86, 0.79)), this.facadeMaterials[1]);
      addGeometry(makeBuildingGeometry(34, 92, 32, x, 12, z, -0.06, tint), this.facadeMaterials[0]);
      addGeometry(makeBuildingGeometry(26, 27, 24, x, 104, z, -0.06, tint), this.facadeMaterials[5]);
      addGeometry(makeBuildingGeometry(18, 11, 17, x, 131, z, -0.06, tint), this.facadeMaterials[0]);
      addGeometry(makeBuildingGeometry(22, 1.4, 21, x, 142, z, -0.06, new THREE.Color(0.6, 0.57, 0.51)), this.trimMaterial);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addGeometry(makeBuildingGeometry(0.5, 92, 0.5, x + sx * 16.8, 12, z + sz * 15.8, -0.06, tint), this.finMaterial);
        }
      }
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.65, 22, 8), this.antennaMaterial);
      mast.position.set(x, 153, z);
      this.landmarks.add(mast);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4b26 }));
      beacon.position.set(x, 164.5, z);
      this.landmarks.add(beacon);
      const crownLight = makeBuildingGeometry(18.2, 0.25, 0.25, x, 141.4, z - 8.5, -0.06, new THREE.Color(1, 1, 1));
      const mesh = new THREE.Mesh(crownLight, this.neonMaterial);
      this.landmarks.add(mesh);
    }

    // HAVELLI SPIRE — art-deco setbacks and a slender illuminated mast.
    {
      const { x, z } = this.anchor('spire');
      const tint = new THREE.Color(0.98, 0.9, 0.78);
      addGeometry(makeBuildingGeometry(50, 18, 48, x, 0, z, 0.05, tint), this.facadeMaterials[1]);
      addGeometry(makeBuildingGeometry(38, 62, 36, x, 18, z, 0.05, tint), this.facadeMaterials[2]);
      addGeometry(makeBuildingGeometry(32, 38, 30, x, 80, z, 0.05, tint), this.facadeMaterials[1]);
      addGeometry(makeBuildingGeometry(24, 24, 22, x, 118, z, 0.05, tint), this.facadeMaterials[2]);
      addGeometry(makeBuildingGeometry(16, 12, 15, x, 142, z, 0.05, tint), this.facadeMaterials[5]);
      for (let i = 0; i < 4; i++) {
        addGeometry(makeBuildingGeometry(40 - i * 3, 0.9, 38 - i * 3, x, 18 + i * 16, z, 0.05, new THREE.Color(0.6, 0.55, 0.48)), this.trimMaterial);
      }
      const spire = new THREE.Mesh(new THREE.ConeGeometry(3.4, 26, 4), this.landmarkRoofMaterial);
      spire.position.set(x, 167, z);
      spire.rotation.y = Math.PI / 4;
      spire.castShadow = true;
      this.landmarks.add(spire);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5a1f }));
      beacon.position.set(x, 182, z);
      this.landmarks.add(beacon);
      for (let i = 0; i < 4; i++) {
        const band = new THREE.Mesh(
          new THREE.BoxGeometry(26 - i * 4, 0.18, 0.18),
          new THREE.MeshBasicMaterial({ color: 0xffb066 }),
        );
        band.position.set(x, 146 + i * 3, z - 10 + i * 1.5);
        this.landmarks.add(band);
      }
    }

    this.addLandmarkSigns();
  }

  addLandmarkSigns() {
    // Crown signage, repeated enough to register at speed without turning the
    // skyline into a neon carnival.
    const signPositions = [
      { ...this.anchor('aurelia'), y: 172, dz: 19.5, yaw: 0, i: 1 },
      { ...this.anchor('havelli1'), y: 116, dz: -13.5, yaw: -0.05, i: 0 },
      { ...this.anchor('exchange'), y: 58, dz: 28, yaw: 0, i: 3 },
    ].map((s) => ({ x: s.x, y: s.y, z: s.z + s.dz, yaw: s.yaw, i: s.i }));
    for (const s of signPositions) {
      const g = new THREE.PlaneGeometry(17, 6.8);
      const m = new THREE.Matrix4().makeRotationY(s.yaw);
      m.setPosition(s.x, s.y, s.z);
      g.applyMatrix4(m);
      const mesh = new THREE.Mesh(g, this.signMaterials[s.i]);
      this.landmarks.add(mesh);
    }

    // A row of low waterfront pavilions east of the circuit adds scale.
    for (let i = 0; i < 5; i++) {
      const x = 350 + i * 60;
      const z = 310 + (i % 2) * 12;
      const g = makeBuildingGeometry(34, 8, 22, x, 0, z, 0.04, new THREE.Color(0.96, 0.9, 0.8));
      addMeshToGroup(this.landmarks, g, this.facadeMaterials[4]);
    }
  }
}

function addMeshToGroup(group, geo, material) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
}
