import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TRACK, trackLayout } from './config.js';
import { getTheme } from './themes.js';
import { canvasTexture, makeCanvas, mulberry32, roundRect } from './utils.js';

const TAU = Math.PI * 2;
const ORANGE = 0xff5a1f;
const CREAM = 0xe9e2d4;

function tint(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function chainlinkTexture() {
  const s = 128;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(176,192,190,0.5)';
  ctx.lineWidth = 1.2;
  const step = 12;
  for (let x = -s; x < s * 2; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + s, s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, s);
    ctx.lineTo(x + s, 0);
    ctx.stroke();
  }
  const tex = canvasTexture(c, { repeat: [9, 2], anisotropy: 4 });
  return tex;
}

function bannerTexture(label, sub, bg = '#171512', fg = '#f3eadb', accent = '#ff5a1f') {
  const c = makeCanvas(1024, 160);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 160);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 14, 160);
  ctx.fillRect(1004, 0, 20, 160);
  ctx.fillStyle = fg;
  ctx.font = '800 74px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, 54, 100);
  ctx.fillStyle = accent;
  ctx.font = '700 22px "Manrope", sans-serif';
  ctx.fillText(sub, 56, 132);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 16, 972, 128);
  return canvasTexture(c, { anisotropy: 8 });
}

function brakeBoardTexture(label, accent = '#ff5a1f') {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2eee4';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#17191b';
  ctx.lineWidth = 10;
  ctx.strokeRect(6, 6, 244, 244);
  ctx.fillStyle = '#17191b';
  ctx.font = '900 148px "Barlow Condensed", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 128, 176);
  ctx.fillStyle = accent;
  ctx.fillRect(18, 192, 220, 10);
  const tex = canvasTexture(c, { anisotropy: 8 });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function marshalTexture() {
  const c = makeCanvas(512, 160);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#171512';
  ctx.fillRect(0, 0, 512, 160);
  ctx.fillStyle = ORANGE ? '#ff5a1f' : '#ff5a1f';
  ctx.fillRect(0, 0, 512, 15);
  ctx.fillStyle = '#f3eadb';
  ctx.font = '800 68px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MARSHAL', 256, 92);
  ctx.fillStyle = '#ffb28d';
  ctx.font = '600 18px "Manrope", sans-serif';
  ctx.fillText('APEX CITY · SAFETY TEAM', 256, 124);
  return canvasTexture(c, { anisotropy: 8 });
}

function roofLabelTexture(label, sub, bg = '#15130f', fg = '#f2eadc', accent = '#ff5a1f') {
  const c = makeCanvas(1024, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 1024, 14);
  ctx.fillRect(0, 242, 1024, 14);
  ctx.fillStyle = fg;
  ctx.font = '900 116px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 512, 148);
  ctx.fillStyle = accent;
  ctx.font = '700 25px "Manrope", sans-serif';
  ctx.fillText(sub, 512, 196);
  return canvasTexture(c, { anisotropy: 8 });
}

function archTexture() {  const c = makeCanvas(2048, 320);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#13110f';
  ctx.fillRect(0, 0, 2048, 320);
  ctx.fillStyle = '#ff5a1f';
  ctx.fillRect(0, 0, 2048, 16);
  ctx.fillRect(0, 304, 2048, 16);
  ctx.fillStyle = '#f2eadc';
  ctx.font = '900 150px "Barlow Condensed", sans-serif';
  ctx.fillText('APEX CITY', 70, 190);
  ctx.fillStyle = '#ff5a1f';
  ctx.fillRect(830, 62, 8, 160);
  ctx.font = '800 54px "Barlow Condensed", sans-serif';
  ctx.fillStyle = '#f2eadc';
  ctx.fillText('HAVELLI STREET CIRCUIT', 886, 148);
  ctx.font = '600 22px "Manrope", sans-serif';
  ctx.fillStyle = '#a99d8e';
  ctx.fillText('OFFICIAL DEMO 02  ·  ROUND 02  ·  DRY  ·  23°C', 888, 190);
  ctx.fillStyle = '#ff5a1f';
  ctx.fillRect(888, 210, 310, 4);
  ctx.font = '800 50px "Barlow Condensed", sans-serif';
  ctx.fillStyle = '#f2eadc';
  ctx.fillText('SECTOR 02', 1590, 168);
  // checkered corners
  for (let x = 0; x < 2048; x += 26) {
    for (let y = 0; y < 26; y += 26) {
      if (((x / 26) + (y / 26)) % 2 === 0) {
        ctx.fillStyle = 'rgba(245,238,225,0.16)';
        ctx.fillRect(x, 0, 26, 26);
      }
    }
  }
  return canvasTexture(c, { anisotropy: 8 });
}

function containerTexture() {
  const c = makeCanvas(512, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#38546a';
  ctx.fillRect(0, 0, 512, 256);
  for (let x = 0; x < 512; x += 18) {
    ctx.fillStyle = x % 36 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, 0, 8, 256);
  }
  ctx.fillStyle = 'rgba(10,12,14,0.55)';
  ctx.fillRect(0, 0, 512, 12);
  ctx.fillRect(0, 244, 512, 12);
  ctx.fillStyle = 'rgba(210,220,220,0.45)';
  ctx.font = '700 34px "Barlow Condensed", sans-serif';
  ctx.fillText('AXU 402 2', 34, 78);
  const tex = canvasTexture(c, { anisotropy: 8 });
  return tex;
}

export class Trackside {
  constructor(scene, textures, track) {
    this.scene = scene;
    this.textures = textures;
    this.track = track;
    this.theme = getTheme(trackLayout().theme);
    this.group = new THREE.Group();
    this.group.name = 'Apex trackside dressing';
    scene.add(this.group);
    this.rng = mulberry32(99271 + (this.theme.id || '').length * 17);
    this.total = track.totalLength;
    this.barrier = TRACK.barrierOffset;
    this.buckets = new Map();
    this.crowd = [];
    this.flags = [];
    this.zones = [];
    this.trees = [];
    this.fanCenters = [];
    this.forestClearings = [];
    this.staffColor = 0xff6a26;
    this.buildMaterials();
    this.buildFenceLines();
    this.buildSpectatorZones();
    this.buildMarshalPosts();
    this.buildServiceVehicles();
    this.buildSignage();
    this.buildFanZones();
    this.buildLandmarks();
    this.buildPaddock();
    this.buildRoadsideLife();
    this.buildThemeProps();
    this.flushBuckets();
    this.buildCrowdMeshes();
    this.buildTreeInstances();
  }

  buildMaterials() {
    const T = this.textures;
    const concreteTex = T.concrete;
    this.mat = {
      concrete: new THREE.MeshStandardMaterial({ map: concreteTex, color: 0xd2c5b4, roughness: 0.9, metalness: 0.02 }),
      concreteDark: new THREE.MeshStandardMaterial({ map: concreteTex, color: 0x81786c, roughness: 0.94 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x34383a, roughness: 0.38, metalness: 0.7 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.58, metalness: 0.2 }),
      white: new THREE.MeshStandardMaterial({ color: 0xe4ddd0, roughness: 0.62, metalness: 0.04 }),
      orange: new THREE.MeshStandardMaterial({ color: ORANGE, roughness: 0.48, metalness: 0.12 }),
      red: new THREE.MeshStandardMaterial({ color: 0xc83225, roughness: 0.5, metalness: 0.1 }),
      yellow: new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.48, metalness: 0.1 }),
      green: new THREE.MeshStandardMaterial({ color: 0x4c6b48, roughness: 0.85, side: THREE.DoubleSide }),
      blue: new THREE.MeshStandardMaterial({ color: 0x2d5874, roughness: 0.48, metalness: 0.2 }),
      tire: new THREE.MeshStandardMaterial({ color: 0x121312, roughness: 0.86 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x1c2e35, roughness: 0.14, metalness: 0.55 }),
      crowd: new THREE.MeshStandardMaterial({ map: T.crowd, roughness: 0.88, metalness: 0 }),
      banner: new THREE.MeshStandardMaterial({
        map: T.barrierBanner, roughness: 0.6, metalness: 0.04, side: THREE.DoubleSide,
      }),
      fence: new THREE.MeshStandardMaterial({
        map: chainlinkTexture(), color: 0x9fb2ae, roughness: 0.5, metalness: 0.38,
        side: THREE.DoubleSide, transparent: true, alphaTest: 0.12, depthWrite: true,
      }),
      wood: new THREE.MeshStandardMaterial({ color: 0x6e5137, roughness: 0.92 }),
      woodDark: new THREE.MeshStandardMaterial({ color: 0x4b3829, roughness: 0.94 }),
      skin: new THREE.MeshStandardMaterial({ color: 0xc4916d, roughness: 0.9 }),
      led: new THREE.MeshBasicMaterial({ color: 0xffd28a }),
      blueLed: new THREE.MeshBasicMaterial({ color: 0xa6e7ff }),
      redLed: new THREE.MeshBasicMaterial({ color: 0xff3822 }),
      amberLed: new THREE.MeshBasicMaterial({ color: 0xffa31a }),
      neonA: new THREE.MeshBasicMaterial({ color: 0xff3b88 }),
      neonB: new THREE.MeshBasicMaterial({ color: 0x50c8b5 }),
      neonC: new THREE.MeshBasicMaterial({ color: 0xffa744 }),
      neonD: new THREE.MeshBasicMaterial({ color: 0xff6a2e }),
      container: new THREE.MeshStandardMaterial({ map: containerTexture(), color: 0xffffff, roughness: 0.74, metalness: 0.25 }),
      carPaint: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.45, roughness: 0.3 }),
      tent: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, side: THREE.DoubleSide }),
      marchal: new THREE.MeshStandardMaterial({ map: marshalTexture(), roughness: 0.6, side: THREE.DoubleSide }),
      arch: new THREE.MeshStandardMaterial({
        map: archTexture(), emissiveMap: archTexture(), emissive: 0xffffff, emissiveIntensity: 0.12,
        roughness: 0.5, metalness: 0.08, side: THREE.DoubleSide,
      }),
    };
    this.brakeMats = {
      '100': new THREE.MeshStandardMaterial({ map: brakeBoardTexture('100'), roughness: 0.6, side: THREE.DoubleSide }),
      '50': new THREE.MeshStandardMaterial({ map: brakeBoardTexture('50'), roughness: 0.6, side: THREE.DoubleSide }),
    };
    this.adMats = T.billboards.map((tex) => new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.55, metalness: 0.05, emissiveMap: tex,
      emissive: 0xffffff, emissiveIntensity: 0.1, side: THREE.DoubleSide,
    }));
  }

  bucket(mat) {
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    return this.buckets.get(mat);
  }

  /** 在世界坐标轨道点建立局部的 +Z=赛道前方、+X=赛道右侧坐标系。 */
  anchor(distance, side, lateral, along = 0) {
    const pose = this.track.getPoseAt(distance);
    const p = pose.position.clone()
      .addScaledVector(pose.right, side * lateral)
      .addScaledVector(pose.tangent, along);
    const m = new THREE.Matrix4().makeRotationY(pose.yaw);
    m.setPosition(p.x, 0, p.z);
    return m;
  }

  add(geo, mat, base, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
    const local = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
    local.setPosition(x, y, z);
    geo.applyMatrix4(base.clone().multiply(local));
    this.bucket(mat).push(geo.index ? geo.toNonIndexed() : geo);
    return geo;
  }

  addBox(mat, base, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) {
    return this.add(new THREE.BoxGeometry(w, h, d), mat, base, x, y, z, ry, rx, rz);
  }

  addCyl(mat, base, rTop, rBot, h, seg, x, y, z, ry = 0, rx = 0, rz = 0) {
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat, base, x, y, z, ry, rx, rz);
  }

  addPlane(mat, base, w, h, x, y, z, ry = 0, rx = 0, rz = 0) {
    return this.add(new THREE.PlaneGeometry(w, h), mat, base, x, y, z, ry, rx, rz);
  }

  addPerson(base, x, y, z, yaw, scale, color) {
    const local = new THREE.Matrix4().makeRotationY(yaw);
    local.scale(new THREE.Vector3(scale, scale, scale));
    local.setPosition(x, y, z);
    const world = base.clone().multiply(local);
    this.crowd.push({ matrix: world, color: new THREE.Color(color) });
  }

  addFlag(base, x, y, z, w, h, color, ry = 0) {
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: 0.75, side: THREE.DoubleSide,
      transparent: true, opacity: 0.96,
    });
    const geo = new THREE.PlaneGeometry(w, h, 5, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      pos.setZ(i, Math.sin((px + w / 2) / w * Math.PI * 1.2) * 0.18);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    const local = new THREE.Matrix4().makeRotationY(ry);
    local.setPosition(x, y, z);
    const world = base.clone().multiply(local);
    const group = new THREE.Group();
    group.applyMatrix4(world);
    group.add(mesh);
    this.group.add(group);
    this.flags.push({ group, mesh });
  }

  mergeInto(geoms, material, opts = {}) {
    if (!geoms.length) return null;
    const merged = mergeGeometries(geoms, false);
    if (!merged) return null;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = opts.castShadow ?? false;
    mesh.receiveShadow = opts.receiveShadow ?? true;
    this.group.add(mesh);
    return mesh;
  }

  flushBuckets() {
    for (const [mat, geos] of this.buckets) {
      if (!geos.length) continue;
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = !mat.isMeshBasicMaterial && mat !== this.mat.fence && mat !== this.mat.crowd;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    this.buckets.clear();
  }

  // ---------------------------------------------------------------- fence

  buildFenceLines() {
    const step = 5.8;
    const fenceLat = this.barrier + 1.45;
    const isForest = this.theme.forest;
    for (const side of [-1, 1]) {
      for (let d = 0; d < this.total; d += step) {
        if (d < 58 || this.total - d < 18) continue;
        const base = this.anchor(d, side, fenceLat);
        if (isForest) {
          // 木桩 + 双横杆，林区不用工业铁丝网
          this.addBox(this.mat.wood, base, 0.14, 1.45, 0.14, 0, 0.72, 0);
          this.addBox(this.mat.wood, base, 5.95, 0.1, 0.12, 0, 0.55, 0);
          this.addBox(this.mat.wood, base, 5.95, 0.1, 0.12, 0, 1.15, 0);
          if (Math.floor(d / step) % 5 === 0) {
            this.addPlane(this.mat.banner, base, 4.2, 0.52, 0, 1.28, 0.02, -side * Math.PI / 2);
          }
          continue;
        }
        // 菱形铁丝网面板：合并为一个透明贴图网格
        this.addPlane(this.mat.fence, base, step + 0.05, 1.72, 0, 0.88, 0, -side * Math.PI / 2);
        this.addBox(this.mat.steel, base, 0.075, 1.95, 0.075, 0, 0.97, 0);
        this.addBox(this.mat.steel, base, 0.055, 0.055, step + 0.05, 0, 1.76, 0);
        if (Math.floor(d / step) % 6 === 0) {
          this.addPlane(this.mat.banner, base, 3.8, 0.55, 0, 0.83, 0.06, -side * Math.PI / 2);
        }
        if (Math.floor(d / step) % 11 === 0) {
          const color = (Math.floor(d / step) % 3 === 0) ? ORANGE : (Math.floor(d / step) % 3 === 1 ? 0xe2d7c5 : 0x3d7082);
          this.addFlag(base, 0, 2.25, 0, 0.8, 0.5, color, -side * Math.PI / 2);
        }
      }
    }
  }

  // ---------------------------------------------------------------- marshal / safety

  buildMarshalPosts() {
    const fractions = [0.07, 0.22, 0.41, 0.61, 0.8, 0.94];
    const tex = marshalTexture();
    const boardMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide });
    for (let i = 0; i < fractions.length; i++) {
      const d = fractions[i] * this.total;
      if (this.isNearZone(d, 28)) continue;
      const s = this.track.getPoseAt(d);
      const side = s.curvature > 0.002 ? -1 : 1;
      const base = this.anchor(d, side, this.barrier + 3.1);
      // 水泥基座
      this.addBox(this.mat.concreteDark, base, 3.0, 0.18, 2.35, 0, 0.09, 0);
      // 值班亭
      this.addBox(this.mat.white, base, 2.15, 1.55, 1.75, 0, 1.0, -0.1);
      this.addBox(this.mat.dark, base, 2.36, 0.14, 2.02, 0, 1.87, -0.1);
      this.addBox(this.mat.dark, base, 0.16, 1.55, 1.8, -1.09, 1.0, -0.1);
      this.addBox(this.mat.dark, base, 0.16, 1.55, 1.8, 1.09, 1.0, -0.1);
      this.addBox(this.mat.glass, base, 1.6, 0.62, 0.05, 0, 1.18, 0.82);
      // 雨棚
      this.addBox(this.mat.orange, base, 2.8, 0.08, 1.25, 0.4, 2.48, 0.85, 0, 0, -0.12);
      this.addBox(this.mat.steel, base, 0.06, 1.1, 0.06, -0.9, 2.0, 1.28);
      this.addBox(this.mat.steel, base, 0.06, 1.1, 0.06, 1.7, 2.0, 1.28);
      // 值守牌
      this.addPlane(boardMat, base, 2.2, 0.68, 0, 2.0, 0.96);
      // 灭火器、轮胎、工具
      this.addCyl(this.mat.red, base, 0.11, 0.11, 0.62, 10, -1.35, 0.34, 0.6);
      this.addCyl(this.mat.tire, base, 0.38, 0.38, 0.24, 12, 0.95, 0.28, 0.9, 0, Math.PI / 2, 0);
      this.addCyl(this.mat.tire, base, 0.38, 0.38, 0.24, 12, 0.95, 0.53, 0.9, 0, Math.PI / 2, 0);
      this.addBox(this.mat.dark, base, 0.4, 0.32, 0.32, -1.25, 0.18, -0.7);
      // 旗杆和旗
      this.addBox(this.mat.steel, base, 0.045, 3.7, 0.045, 1.75, 1.85, -0.8);
      const flagColor = i % 2 === 0 ? 0xffcc33 : 0xe7e1d4;
      this.addFlag(base, 1.73, 3.35, -0.76, 1.0, 0.64, flagColor, 0);
      // 两名 marshal
      this.addPerson(base, -0.5, 0, 0.75, 0.2, 1.02, 0xff7a2d);
      this.addPerson(base, 0.45, 0, 1.0, -0.4, 1.0, 0xf1e3c9);
      // 警示灯
      this.addBox(this.mat.amberLed, base, 0.22, 0.12, 0.22, 0, 2.62, 0.45);
    }
  }

  // ---------------------------------------------------------------- spectator banks

  buildSpectatorZones() {
    const fractions = [0.13, 0.31, 0.52, 0.72, 0.88];
    const colors = [ORANGE, 0x3e7b83, 0xd3ad54, 0xb84b3c, 0x5d7197];
    for (let z = 0; z < fractions.length; z++) {
      const d = fractions[z] * this.total;
      if (d < 75 || this.total - d < 60) continue;
      const s = this.track.getPoseAt(d);
      const side = z % 2 === 0 ? 1 : -1;
      const front = this.barrier + 10.2;
      const length = 11.5;
      const tiers = 4;
      const depth = 1.15;
      const tierH = 0.58;
      const base = this.anchor(d, side, front);
      const accent = colors[z % colors.length];
      this.zones.push({ d, side, front, length });
      // 看台阶梯
      for (let t = 0; t < tiers; t++) {
        const x = side * (depth * (t + 0.5));
        this.addBox(this.mat.concrete, base, depth + 0.05, tierH, length, x, tierH * (t + 0.5), 0);
        this.addPlane(
          this.mat.crowd, base, length, tierH + 0.1,
          side * (depth * (t + 0.02)), tierH * (t + 1) + 0.08, 0,
          -side * Math.PI / 2,
        );
      }
      // 顶部遮阳棚和立柱
      const roofX = side * (depth * (tiers + 0.9));
      this.addBox(this.mat.white, base, depth * 6.2, 0.2, length + 1.4, roofX, 4.5, 0, 0, 0, side * -0.04);
      this.addBox(new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 }), base, depth * 6.2, 0.13, 0.4, roofX, 4.62, side * (length / 2 + 0.5));
      for (const dz of [-length / 2 + 0.7, length / 2 - 0.7]) {
        this.addBox(this.mat.steel, base, 0.12, 4.4, 0.12, side * depth * 0.5, 2.2, dz);
        this.addBox(this.mat.steel, base, 0.12, 4.4, 0.12, roofX, 2.2, dz);
      }
      // 品牌色条
      this.addBox(new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 }), base, 0.26, 0.5, length + 1.2, roofX, 4.65, 0);
      // 顶旗
      for (const dz of [-4.6, 4.6]) {
        this.addBox(this.mat.steel, base, 0.035, 2.2, 0.035, roofX, 5.75, dz);
        this.addFlag(base, roofX + side * 0.05, 6.65, dz, 1.25, 0.72, accent, -side * Math.PI / 2);
      }
      // 侧边广告
      this.addPlane(this.mat.banner, base, 8.4, 0.9, side * (depth * 0.4), 1.0, -length / 2 - 0.05, -side * Math.PI / 2);
      // 两端品牌墙，避免从弯道看过去只剩一块白墙
      for (const end of [-1, 1]) {
        this.addPlane(this.adMats[(z + 1) % this.adMats.length], base, 4.6, 1.35,
          side * (depth * 2.2), 2.5, end * (length / 2 + 0.06), end > 0 ? 0 : Math.PI);
        this.addBox(new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 }), base,
          depth * 4.6, 0.36, 0.16, side * (depth * 2.4), 4.1, end * (length / 2 + 0.02));
      }
      // 观众（3D，层叠）
      for (let t = 0; t < tiers; t++) {
        const count = 7 + Math.floor(this.rng() * 3);
        for (let k = 0; k < count; k++) {
          const px = side * (depth * (t + 0.35 + this.rng() * 0.3));
          const pz = (this.rng() - 0.5) * (length - 0.8);
          const py = tierH * (t + 1);
          const shirt = [0xd45a37, 0x2f6470, 0xe2c25d, 0x6e4a7e, 0xd8d3c8, 0x416d4a][Math.floor(this.rng() * 6)];
          this.addPerson(base, px, py, pz, this.rng() * TAU, 0.82 + this.rng() * 0.24, shirt);
        }
      }
      // 观众区外侧的便携设施
      this.addBox(this.mat.white, base, 0.9, 2.1, 0.9, side * (depth * 7.2), 1.05, -length / 2 + 1);
      this.addBox(this.mat.green, base, 0.85, 0.7, 0.85, side * (depth * 7.2), 0.35, -length / 2 + 2.2);
      // 三把伞
      for (let u = 0; u < 3; u++) {
        const ux = side * (depth * (0.8 + u * 1.25));
        const uz = length / 2 + 1.4 + u * 1.2;
        this.addCyl(this.mat.steel, base, 0.035, 0.045, 2.3, 6, ux, 1.15, uz);
        const canopy = new THREE.ConeGeometry(1.35, 0.5, 10);
        this.add(tint(canopy, u === 0 ? ORANGE : u === 1 ? 0xe5dac9 : 0x4e7f87), new THREE.MeshStandardMaterial({
          vertexColors: true, roughness: 0.78, side: THREE.DoubleSide,
        }), base, ux, 2.35, uz);
      }
    }
  }

  isNearZone(d, margin = 26) {
    return this.zones.some((z) => Math.abs(this.wrapDelta(z.d - d)) < margin);
  }

  wrapDelta(v) {
    const half = this.total / 2;
    return ((v + half) % this.total + this.total) % this.total - half;
  }

  // ---------------------------------------------------------------- service vehicles

  buildServiceVehicles() {
    const sites = [
      { f: 0.045, side: 1, lat: 7.5, type: 'recovery' },
      { f: 0.16, side: -1, lat: 8.0, type: 'ambulance' },
      { f: 0.37, side: -1, lat: 8.5, type: 'recovery' },
      { f: 0.67, side: 1, lat: 8.5, type: 'safety' },
    ];
    for (const site of sites) {
      const d = site.f * this.total;
      if (d < 30 || this.isNearZone(d, 18)) continue;
      const base = this.anchor(d, site.side, this.barrier + site.lat);
      if (site.type === 'recovery') this.buildRecoveryTruck(base);
      else if (site.type === 'ambulance') this.buildAmbulance(base);
      else this.buildSafetyCar(base);
    }
    // 维修区外的平板车/设备车
    const pitTruck = this.anchor(this.total - 34, 1, this.barrier + 11);
    this.buildRecoveryTruck(pitTruck);
    if (this.theme.market || this.theme.port) {
      const forklift = this.anchor(this.total * 0.47, 1, this.barrier + 12);
      this.buildForklift(forklift);
    }
  }

  buildWheels(base, zs, x = 1.05, r = 0.47) {
    for (const z of zs) {
      for (const side of [-1, 1]) {
        this.addCyl(this.mat.tire, base, r, r, 0.34, 12, side * x, r, z, 0, 0, Math.PI / 2);
        this.addCyl(this.mat.steel, base, r * 0.47, r * 0.47, 0.36, 10, side * x, r, z, 0, 0, Math.PI / 2);
      }
    }
  }

  buildRecoveryTruck(base) {
    const white = this.mat.white;
    // 底盘、驾驶室、平板
    this.addBox(this.mat.dark, base, 2.25, 0.35, 5.5, 0, 0.56, 0);
    this.addBox(white, base, 2.2, 1.55, 1.6, 0, 1.35, 1.55);
    this.addBox(white, base, 2.18, 0.62, 0.9, 0, 1.72, 0.54);
    this.addBox(this.mat.glass, base, 1.72, 0.55, 0.06, 0, 1.58, 0.44);
    this.addBox(this.mat.orange, base, 2.25, 0.13, 5.2, 0, 0.95, -0.45);
    this.addBox(this.mat.dark, base, 2.1, 0.12, 3.5, 0, 0.98, -1.35);
    this.addBox(this.mat.dark, base, 0.16, 0.22, 3.4, -1.0, 0.82, -1.35);
    this.addBox(this.mat.dark, base, 0.16, 0.22, 3.4, 1.0, 0.82, -1.35);
    // 起重机小臂
    this.addBox(this.mat.steel, base, 0.16, 0.16, 2.6, 0.35, 1.5, -1.4, 0, 0.42, 0);
    this.addCyl(this.mat.steel, base, 0.15, 0.15, 0.25, 8, 0.35, 1.0, -0.4);
    // 警示灯
    this.addBox(this.mat.amberLed, base, 1.2, 0.1, 0.2, 0, 2.2, 1.5);
    this.addBox(this.mat.white, base, 0.65, 0.2, 0.3, -0.6, 2.26, 1.5);
    this.addBox(this.mat.white, base, 0.65, 0.2, 0.3, 0.6, 2.26, 1.5);
    this.buildWheels(base, [-1.55, 1.55], 1.02, 0.46);
  }

  buildAmbulance(base) {
    this.addBox(this.mat.white, base, 2.18, 2.05, 4.7, 0, 1.35, 0);
    this.addBox(this.mat.red, base, 2.2, 0.28, 4.72, 0, 1.9, 0);
    this.addBox(this.mat.glass, base, 1.72, 0.62, 0.06, 0, 1.62, 2.37);
    this.addBox(this.mat.blueLed, base, 1.1, 0.12, 0.22, 0, 2.5, 1.4);
    this.addBox(this.mat.red, base, 0.45, 0.45, 0.05, 0, 1.26, 2.4);
    this.addBox(this.mat.white, base, 0.3, 0.3, 0.06, 0, 1.26, 2.43);
    this.addBox(this.mat.red, base, 0.09, 0.34, 0.06, 0, 1.26, 2.44);
    this.addBox(this.mat.red, base, 0.32, 0.09, 0.06, 0, 1.26, 2.44);
    this.buildWheels(base, [-1.25, 1.45], 1.0, 0.44);
  }

  buildSafetyCar(base) {
    this.addBox(this.mat.blue, base, 1.9, 0.5, 4.2, 0, 0.66, 0);
    this.addBox(this.mat.blue, base, 1.55, 0.38, 1.9, 0, 1.0, 0.2);
    this.addBox(this.mat.glass, base, 1.3, 0.3, 0.06, 0, 1.0, 1.14);
    this.addBox(this.mat.amberLed, base, 0.9, 0.1, 0.18, 0, 1.24, 0.1);
    this.addBox(this.mat.dark, base, 1.6, 0.08, 0.3, 0, 1.0, -2.0);
    this.buildWheels(base, [-1.25, 1.3], 0.92, 0.36);
  }

  buildForklift(base) {
    this.addBox(this.mat.yellow, base, 1.35, 1.2, 1.9, 0, 0.8, 0);
    this.addBox(this.mat.dark, base, 1.1, 0.75, 1.1, 0, 1.7, -0.3);
    this.addBox(this.mat.steel, base, 0.12, 2.25, 0.12, -0.72, 1.5, 0.82);
    this.addBox(this.mat.steel, base, 0.12, 2.25, 0.12, 0.72, 1.5, 0.82);
    this.addBox(this.mat.steel, base, 0.14, 0.1, 1.55, 0, 0.38, 1.55);
    this.addBox(this.mat.dark, base, 0.12, 0.12, 0.62, -0.33, 0.3, 2.1);
    this.addBox(this.mat.dark, base, 0.12, 0.12, 0.62, 0.33, 0.3, 2.1);
    this.buildWheels(base, [-0.6, 0.6], 0.62, 0.28);
  }

  // ---------------------------------------------------------------- signs / flags / big arch

  buildSignage() {
    // 弯前 100 / 50 米刹车牌
    const corners = [];
    for (let i = 0; i < this.track.samples.length; i += 4) {
      const s = this.track.samples[i];
      if (Math.abs(s.curvature) > 0.009) {
        if (!corners.length || s.distance - corners[corners.length - 1].d > 60) {
          corners.push({ d: s.distance, side: s.curvature > 0 ? -1 : 1 });
        }
      }
    }
    for (const c of corners.slice(0, 5)) {
      for (const [offset, label] of [[42, '100'], [18, '50']]) {
        const d = c.d - offset;
        if (d < 30) continue;
        const base = this.anchor(d, c.side, this.barrier + 2.8);
        for (const dz of [-0.55, 0.55]) {
          this.addBox(this.mat.steel, base, 0.08, 2.0, 0.08, dz, 1.0, 0);
        }
        this.addPlane(this.brakeMats[label], base, 1.55, 1.15, 0, 2.2, 0, Math.PI, 0, 0);
      }
    }
    // 高塔广告
    for (let i = 0; i < 4; i++) {
      const f = 0.09 + i * 0.25;
      const d = f * this.total;
      if (d < 55) continue;
      const side = i % 2 === 0 ? 1 : -1;
      const base = this.anchor(d, side, this.barrier + 12.5);
      this.addBox(this.mat.concreteDark, base, 1.6, 0.35, 1.6, 0, 0.18, 0);
      this.addBox(this.mat.steel, base, 0.8, 8.4, 0.8, 0, 4.2, 0);
      const ad = this.adMats[i % this.adMats.length];
      this.addPlane(ad, base, 5.8, 3.3, 0, 8.3, 0.42, 0, 0, 0);
      this.addPlane(ad, base, 5.8, 3.3, 0, 8.3, -0.42, Math.PI, 0, 0);
      this.addBox(this.mat.amberLed, base, 4.7, 0.1, 0.08, 0, 6.55, 0.46);
    }
    // 一座横跨赛道的龙门架（中段直道）
    let archD = this.total * 0.49;
    let best = Infinity;
    for (let k = 0; k < 40; k++) {
      const d = this.total * 0.42 + (k / 40) * this.total * 0.16;
      const s = this.track.getPoseAt(d);
      if (Math.abs(s.curvature) < best) { best = Math.abs(s.curvature); archD = d; }
    }
    const archBase = this.anchor(archD, 1, 0);
    for (const side of [-1, 1]) {
      this.addBox(this.mat.steel, archBase, 0.45, 7.2, 0.45, side * (TRACK.width / 2 + 2.4), 3.6, 0);
      this.addBox(this.mat.concreteDark, archBase, 1.3, 0.3, 1.3, side * (TRACK.width / 2 + 2.4), 0.15, 0);
    }
    this.addBox(this.mat.steel, archBase, TRACK.width + 6.2, 0.7, 0.55, 0, 7.3, 0);
    this.addPlane(this.mat.arch, archBase, 13.5, 2.5, 0, 6.2, 0.3, 0, 0, 0);
    this.addPlane(this.mat.arch, archBase, 13.5, 2.5, 0, 6.2, -0.3, Math.PI, 0, 0);
    this.addBox(this.mat.orange, archBase, TRACK.width + 6.5, 0.08, 0.6, 0, 7.8, 0);
    // 龙门架照明
    for (let i = -2; i <= 2; i++) {
      this.addBox(this.mat.led, archBase, 0.95, 0.12, 0.58, i * 2.5, 7.52, 0);
    }
    // 起点/看台附近的小旗阵
    for (let i = 0; i < 10; i++) {
      const d = 30 + i * 9;
      const side = i % 2 ? 1 : -1;
      const base = this.anchor(d, side, this.barrier + 2.0);
      this.addBox(this.mat.steel, base, 0.035, 2.8, 0.035, 0, 1.4, 0);
      this.addFlag(base, 0.02, 2.7, 0, 0.72, 0.46, i % 3 === 0 ? ORANGE : i % 3 === 1 ? CREAM : 0x3a6f79, 0);
    }
  }

  // ---------------------------------------------------------------- fan zones / parking

  buildFanZones() {
    const specs = [
      { f: 0.245, side: 1, color: 0xff7a32 },
      { f: 0.685, side: -1, color: 0x3d8b91 },
    ];
    for (let z = 0; z < specs.length; z++) {
      const spec = specs[z];
      const d = spec.f * this.total;
      if (d < 80) continue;
      const base = this.anchor(d, spec.side, this.barrier + 10.2);
      const side = spec.side;
      // 铺装场地
      this.addBox(this.mat.concreteDark, base, 18, 0.08, 21, side * 9, 0.04, 0);
      this.fanCenters.push(new THREE.Vector3().setFromMatrixPosition(base).add(new THREE.Vector3(side * 9, 0, 0)));
      // 简易围栏
      for (const dz of [-10.5, 10.5]) {
        this.addBox(this.mat.steel, base, 18, 0.9, 0.08, side * 9, 0.45, dz);
        this.addBox(this.mat.orange, base, 18, 0.07, 0.11, side * 9, 0.9, dz);
      }
      for (const dx of [0.2, 17.8]) {
        this.addBox(this.mat.steel, base, 0.08, 0.9, 21, side * dx, 0.45, 0);
      }
      // 帐篷市集
      for (let i = 0; i < 6; i++) {
        const tx = side * (3.0 + (i % 3) * 3.1);
        const tz = -6.2 + Math.floor(i / 3) * 6.6;
        for (const ox of [-1.35, 1.35]) {
          for (const oz of [-1.35, 1.35]) {
            this.addBox(this.mat.steel, base, 0.06, 2.35, 0.06, tx + ox, 1.17, tz + oz);
          }
        }
        const roof = new THREE.ConeGeometry(2.15, 0.65, 4);
        roof.rotateY(Math.PI / 4);
        this.add(tint(roof, i % 3 === 0 ? spec.color : i % 3 === 1 ? 0xf0e1c8 : 0x384b58), this.mat.tent, base, tx, 2.5, tz);
        this.addBox(this.mat.wood, base, 2.2, 0.72, 0.62, tx, 0.4, tz + 1.0);
        this.addBox(this.mat.white, base, 1.4, 0.08, 0.6, tx, 0.78, tz + 1.0);
      }
      // 停放车辆
      const carColors = [0xcf4c30, 0x2d5f73, 0xe0b34d, 0xded7c7, 0x4f6b51, 0x8e6c8a, 0x44484a, 0xb16d39];
      for (let i = 0; i < 10; i++) {
        const cx = side * (12.5 + (i % 2) * 3.0);
        const cz = -8.2 + Math.floor(i / 2) * 4.0;
        const yaw = (i % 2 ? 1 : 1) * Math.PI / 2 + (this.rng() - 0.5) * 0.12;
        this.addParkedCar(base, cx, cz, yaw, carColors[i % carColors.length]);
      }
      // 大屏幕
      const screenBase = base.clone();
      this.addPlane(this.adMats[z % this.adMats.length], screenBase, 6.2, 3.1, side * 17.2, 3.6, 0, -side * Math.PI / 2);
      for (const dz of [-3.3, 3.3]) this.addBox(this.mat.steel, base, 0.22, 5.0, 0.22, side * 17.5, 2.5, dz);
      this.addBox(this.mat.dark, base, 0.2, 0.35, 6.8, side * 17.55, 5.05, 0);
      // 旗帜
      for (const dz of [-9.5, 9.5]) {
        this.addBox(this.mat.steel, base, 0.08, 6.5, 0.08, side * 2, 3.25, dz);
        this.addFlag(base, side * 2, 6.4, dz, 1.7, 1.0, spec.color, 0);
      }
      // 卫生间与垃圾桶
      for (let i = 0; i < 2; i++) {
        this.addBox(this.mat.white, base, 0.9, 2.1, 0.9, side * (15.2 + i * 1.1), 1.05, 8.4);
        this.addBox(this.mat.green, base, 0.6, 0.75, 0.6, side * 3.4, 0.38, 8.6 + i * 0.9);
      }
      // 大事件帐篷，地图上能形成明显色块
      for (const ox of [-1, 1]) {
        for (const oz of [-1, 1]) {
          this.addBox(this.mat.steel, base, 0.1, 4.3, 0.1, side * 9 + ox * 5.2, 2.15, oz * 3.3);
        }
      }
      const bigTent = new THREE.ConeGeometry(8.0, 2.7, 4);
      bigTent.rotateY(Math.PI / 4);
      this.add(tint(bigTent, z === 0 ? 0xe9dfca : 0x3f7f86), this.mat.tent, base, side * 9, 5.1, 0);
      this.addBox(this.mat.white, base, 10, 0.8, 6.5, side * 9, 0.45, 0);
      this.roofLabel(base, 'FAN ZONE', 'APEX CITY · OFFICIAL DEMO 02', side * 9, 0.1, 7.0, 11, 3.6, '#171512', '#f3eadb', z === 0 ? '#ff5a1f' : '#3d8b91');
      // 停车位标线
      for (let pi = 0; pi < 5; pi++) {
        this.addBox(this.mat.white, base, 0.08, 0.012, 3.3, side * (10.5 + pi * 2.8), 0.09, 5.5);
      }
      // 高杆灯
      this.addBox(this.mat.steel, base, 0.22, 11, 0.22, side * 3.2, 5.5, 9.4);
      for (let li = 0; li < 3; li++) {
        this.addBox(this.mat.led, base, 1.1, 0.24, 0.5, side * 3.2 + (li - 1) * 1.3, 10.9, 9.4);
      }
      // 观众
      for (let i = 0; i < 34; i++) {
        const px = side * (2.8 + this.rng() * 12.0);
        const pz = -8.8 + this.rng() * 17.6;
        this.addPerson(base, px, 0.08, pz, this.rng() * TAU, 0.84 + this.rng() * 0.25,
          [0xd05a3b, 0x346f7b, 0xd7b94f, 0x6d547c, 0xe0d7c7, 0x4a6c4b][Math.floor(this.rng() * 6)]);
      }
      // 食品摊 / 冰淇淋车
      this.addBox(this.mat.dark, base, 1.8, 0.45, 3.2, side * 7.6, 0.35, 7.2);
      this.addBox(this.mat.white, base, 1.8, 1.35, 2.6, side * 7.6, 1.2, 7.2);
      this.addBox(this.mat.orange, base, 1.9, 0.12, 2.8, side * 7.6, 1.95, 7.2);
      this.addBox(this.mat.glass, base, 1.5, 0.55, 0.06, side * 7.6, 1.4, 8.52);
    }
  }

  addParkedCar(base, x, z, yaw, color) {
    const local = new THREE.Matrix4().makeRotationY(yaw);
    local.setPosition(x, 0, z);
    const m = base.clone().multiply(local);
    const push = (geo, mat, colorHex = null) => {
      if (colorHex != null) tint(geo, colorHex);
      geo.applyMatrix4(m);
      this.bucket(mat).push(geo.index ? geo.toNonIndexed() : geo);
    };
    const body = new THREE.BoxGeometry(1.75, 0.52, 4.0);
    body.translate(0, 0.58, 0);
    push(body, this.mat.carPaint, color);
    const cabin = new THREE.BoxGeometry(1.35, 0.46, 1.9);
    cabin.translate(0, 1.05, -0.2);
    push(cabin, this.mat.dark);
    for (const zz of [-1.3, 1.3]) {
      for (const xx of [-0.86, 0.86]) {
        const wheel = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 10);
        wheel.rotateZ(Math.PI / 2);
        wheel.translate(xx, 0.32, zz);
        push(wheel, this.mat.tire);
      }
    }
  }


  // ---------------------------------------------------------------- theme landmarks

  buildLandmarks() {
    const d = this.total * 0.38;
    if (this.theme.port || this.theme.id === 'harbor') this.buildHarborTerminal(d, -1);
    else if (this.theme.id === 'coast') this.buildCoastClub(d, this.coastSide(d));
    else if (this.theme.market) this.buildNightBazaar(d, -1);
    else if (this.theme.forest) this.buildForestLodge(d, 1);
  }

  coastSide(d) {
    const s = this.track.getPoseAt(d);
    return s.right.z >= 0 ? 1 : -1;
  }

  landmarkSign(label, sub, accent = '#ff5a1f') {
    const tex = bannerTexture(label, sub, '#15130f', '#f2eadc', accent);
    return new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.18,
      roughness: 0.55, metalness: 0.04, side: THREE.DoubleSide,
    });
  }

  roofLabel(base, label, sub, x, y, z, w, h, bg, fg, accent) {
    const tex = roofLabelTexture(label, sub, bg, fg, accent);
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: true, side: THREE.DoubleSide });
    this.addPlane(mat, base, w, h, x, y, z, 0, -Math.PI / 2);
  }

  addPalm(base, x, z, h = 7.5) {
    this.addCyl(this.mat.wood, base, 0.16, 0.25, h, 7, x, h / 2, z);
    for (let i = 0; i < 7; i++) {
      const geo = new THREE.PlaneGeometry(4.5, 0.9, 8, 1);
      const pos = geo.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const px = pos.getX(k);
        const u = (px + 2.25) / 4.5;
        pos.setY(k, pos.getY(k) + 0.1 * u - 0.55 * u * u);
      }
      geo.computeVertexNormals();
      const yaw = (i / 7) * TAU + this.rng() * 0.2;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, h - 0.2, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.36, yaw, 0)),
        new THREE.Vector3(1, 1, 1),
      );
      geo.applyMatrix4(m);
      this.add(geo, this.mat.green, base);
    }
  }

  buildHarborTerminal(d, side) {
    const base = this.anchor(d, side, this.barrier + 27);
    this.addBox(this.mat.concrete, base, 22, 10, 31, 0, 5, 0);
    this.addBox(this.mat.white, base, 23.2, 0.7, 32.2, 0, 10.35, 0);
    this.addBox(this.mat.orange, base, 23.4, 0.35, 32.4, 0, 9.6, 0);
    this.roofLabel(base, 'APEX FREIGHT', 'TERMINAL 02 · HAVELLI', 0, 10.76, 0, 19, 5.0, '#15130f', '#f3eadb', '#ff5a1f');
    for (let i = -3; i <= 3; i++) {
      const z = i * 4.1;
      this.addBox(this.mat.dark, base, 0.18, 5.0, 3.5, -side * 11.1, 2.7, z);
      this.addBox(this.mat.glass, base, 0.1, 1.5, 3.2, -side * 11.16, 6.8, z);
    }
    const sign = this.landmarkSign('APEX FREIGHT', 'TERMINAL 02  ·  PORT OF HAVELLI');
    this.addPlane(sign, base, 15.5, 2.4, -side * 11.3, 8.25, 0, -side * Math.PI / 2);
    this.addBox(this.mat.concreteDark, base, 2.2, 1.1, 28, -side * 13.2, 0.55, 0);
    this.addBox(this.mat.yellow, base, 0.16, 0.08, 28, -side * 14.25, 1.12, 0);
    const colors = [0xb54f37, 0x3c647c, 0x4e7352, 0xb28a42];
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshStandardMaterial({
        map: this.mat.container.map, color: colors[i % colors.length], roughness: 0.72, metalness: 0.22,
      });
      this.addBox(mat, base, 5.8, 2.55, 2.45, -side * 16.2, 1.3, -10 + i * 5.2);
      if (i % 2 === 0) this.addBox(mat, base, 5.8, 2.55, 2.45, -side * 16.2, 3.85, -10 + i * 5.2);
    }
    for (let i = 0; i < 4; i++) {
      this.addCyl(this.mat.tire, base, 0.55, 0.55, 0.32, 12, -side * 15, 0.3 + i * 0.3, 9.2, 0, Math.PI / 2, 0);
    }
    for (let i = 0; i < 3; i++) {
      this.addBox(this.mat.wood, base, 2.4, 0.18, 1.6, -side * 14, 0.15 + i * 0.2, 7.5);
    }
    for (const z of [-14, 14]) {
      this.addBox(this.mat.steel, base, 0.22, 13, 0.22, -side * 13.5, 6.5, z);
      this.addBox(this.mat.led, base, 1.3, 0.22, 0.65, -side * 13.5, 12.9, z);
    }
    const crane = this.anchor(d + 62, side, this.barrier + 20);
    for (const sx of [-7, 7]) {
      for (const sz of [-8, 8]) this.addBox(this.mat.steel, crane, 0.8, 24, 0.8, sx, 12, sz);
    }
    this.addBox(this.mat.steel, crane, 16, 1.1, 1.1, 0, 24, -8);
    this.addBox(this.mat.steel, crane, 16, 1.1, 1.1, 0, 24, 8);
    this.addBox(this.mat.orange, crane, 4.8, 2.2, 4.8, 0, 20.8, 1.8);
    this.addBox(this.mat.dark, crane, 4.2, 1.2, 3.6, 0, 22.2, 1.8);
    this.addBox(this.mat.steel, crane, 0.35, 5.2, 0.35, 2.0, 18.5, 1.8);
  }

  buildCoastClub(d, side) {
    const base = this.anchor(d, side, this.barrier + 21);
    this.addBox(this.mat.white, base, 24, 6.8, 16, side * 5, 3.4, 0);
    this.addBox(this.mat.white, base, 25, 0.45, 17, side * 5, 6.9, 0);
    this.addBox(new THREE.MeshStandardMaterial({ color: 0x2d7f8a, roughness: 0.48, metalness: 0.15 }), base, 25.2, 0.32, 17.2, side * 5, 6.25, 0);
    this.roofLabel(base, 'SUNSET CLUB', 'BEACH BAR · HAVELLI BAY', side * 5, 7.16, 0, 18, 4.4, '#f0e7d8', '#155560', '#d45533');
    // 露天泳池
    this.addBox(this.mat.white, base, 15, 0.3, 9, side * 6, 0.2, -1);
    const poolMat = new THREE.MeshPhysicalMaterial({
      color: 0x1b8da6, roughness: 0.16, metalness: 0.25,
      clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0x0a4251, emissiveIntensity: 0.18,
    });
    this.addBox(poolMat, base, 13.4, 0.12, 7.4, side * 6, 0.31, -1);
    for (let i = -2; i <= 2; i++) {
      this.addBox(this.mat.glass, base, 0.1, 1.9, 1.9, -side * 7.05, 4.0, i * 2.7);
    }
    const sign = this.landmarkSign('SUNSET CLUB', 'BEACH BAR  ·  HAVELLI BAY', '#2d7f8a');
    this.addPlane(sign, base, 12.5, 1.9, -side * 7.15, 5.5, 0, -side * Math.PI / 2);
    this.addBox(this.mat.wood, base, 26, 0.22, 13, side * 4, 0.16, 0);
    for (let i = 0; i < 9; i++) {
      const ux = side * (2 + (i % 3) * 3.4);
      const uz = -5.2 + Math.floor(i / 3) * 4.5;
      this.addBox(this.mat.white, base, 2.5, 0.13, 0.9, ux, 0.38, uz, 0.1);
      this.addCyl(this.mat.steel, base, 0.035, 0.045, 2.55, 6, ux, 1.35, uz + 0.3);
      const canopy = new THREE.ConeGeometry(1.65, 0.55, 10, 1, true);
      this.add(tint(canopy, i % 3 === 0 ? 0xe0562f : i % 3 === 1 ? 0x2d7f8a : 0xf0dfbd), this.mat.tent,
        base, ux, 2.75, uz + 0.3);
    }
    this.addBox(this.mat.dark, base, 6.0, 1.0, 1.6, side * 12, 0.45, 3.5);
    this.addBox(this.mat.white, base, 6.2, 0.12, 1.8, side * 12, 1.0, 3.5);
    this.addBox(this.mat.glass, base, 0.2, 1.7, 0.2, side * 9.4, 0.85, 3.5);
    // 大面积遮阳帆，白/青配色在沙滩上很醒目
    this.addBox(this.mat.white, base, 22, 0.18, 10, side * 4, 4.6, 0);
    this.addBox(new THREE.MeshStandardMaterial({ color: 0x2d7f8a, roughness: 0.5 }), base, 22.2, 0.12, 0.35, side * 4, 4.75, 0);
    for (const px of [-2, 2]) {
      for (const pz of [-4.2, 4.2]) this.addBox(this.mat.steel, base, 0.1, 4.5, 0.1, side * (4 + px), 2.25, pz);
    }
    // 高杆投光灯
    this.addBox(this.mat.steel, base, 0.22, 12, 0.22, side * 15, 6, 7);
    this.addBox(this.mat.led, base, 2.4, 0.22, 0.75, side * 15, 12, 7);
    for (let i = 0; i < 7; i++) {
      this.addPalm(base, side * (2 + i * 2.0), -7.8 + (i % 2) * 1.1, 7 + this.rng() * 2.5);
    }
    for (let i = 0; i < 4; i++) {
      this.addPerson(base, side * (4 + i * 2.2), 0.25, 4.0 + (i % 2) * 1.3, this.rng() * TAU, 0.95, [0xeedcc3, 0x2e6f7a, 0xd45533, 0xe3c05a][i]);
    }
    for (const z of [-6, 6]) {
      this.addBox(this.mat.steel, base, 0.08, 8.0, 0.08, side * 16, 4, z);
      this.addFlag(base, side * 16, 7.85, z, 1.6, 0.9, 0xe0562f, 0);
    }
  }

  buildNightBazaar(d, side) {
    const base = this.anchor(d, side, this.barrier + 15);
    for (let i = 0; i < 6; i++) {
      const z = -8 + (i % 3) * 8;
      this.addBox(this.mat.steel, base, 0.18, 5.0, 0.18, side * 2.5, 2.5, z);
      this.addBox(this.mat.steel, base, 0.18, 5.0, 0.18, side * 25, 2.5, z);
    }
    this.addBox(this.mat.dark, base, 23, 0.28, 18, side * 13.7, 5.0, 0);
    this.roofLabel(base, 'NIGHT MARKET', 'MIDTOWN · APEX CITY', side * 13.7, 5.16, 0, 20, 5.0, '#17110f', '#ffe1b8', '#ff3b88');
    this.addBox(this.mat.neonD, base, 23.2, 0.12, 0.25, side * 13.7, 4.8, -9.0);
    this.addBox(this.mat.neonA, base, 23.2, 0.12, 0.25, side * 13.7, 4.8, 9.0);
    this.addBox(this.mat.neonB, base, 0.2, 0.12, 18.2, side * 2.2, 4.8, 0);
    this.addBox(this.mat.neonC, base, 0.2, 0.12, 18.2, side * 25.2, 4.8, 0);
    // 高亮招牌塔
    this.addBox(this.mat.steel, base, 0.25, 12, 0.25, side * 3.4, 6, 10.5);
    for (let i = 0; i < 4; i++) {
      this.addBox(i % 2 === 0 ? this.mat.neonA : this.mat.neonC, base, 1.6, 0.55, 0.2, side * 3.4, 11.2 - i * 0.8, 10.5);
    }
    for (let i = 0; i < 8; i++) {
      const z = -7.6 + i * 2.2;
      this.addBox(this.mat.woodDark, base, 2.4, 1.0, 1.9, side * 26, 0.5, z);
      this.addBox(this.mat.dark, base, 2.4, 0.1, 2.1, side * 26, 1.1, z);
      const neonMats = [this.mat.neonD, this.mat.neonB, this.mat.amberLed, this.mat.neonA];
      this.addBox(neonMats[i % 4], base, 2.2, 0.36, 0.05, side * 27.2, 2.5, z);
      for (let k = 0; k < 3; k++) {
        this.addBox(this.mat.neonC, base, 0.18, 0.18, 0.18, side * 26.8, 2.0 + k * 0.5, z + (k - 1) * 0.5);
      }
      this.addPerson(base, side * (24.2 + this.rng() * 1.5), 0, z + (this.rng() - 0.5) * 0.8, this.rng() * TAU, 0.9, 0x2e3b45);
    }
    for (const z of [-9.4, 9.4]) this.addBox(this.mat.steel, base, 0.14, 7.2, 0.14, side * 18, 3.6, z);
    this.addBox(this.mat.steel, base, 0.14, 7.2, 0.14, side * 3, 3.6, -9.4);
    this.addBox(this.mat.steel, base, 0.14, 7.2, 0.14, side * 3, 3.6, 9.4);
    this.addBox(this.mat.steel, base, 15, 0.16, 0.16, side * 10.5, 7.15, -9.4);
    this.addBox(new THREE.MeshBasicMaterial({ color: 0xff3b88 }), base, 14.8, 0.38, 0.14, side * 10.5, 6.9, -9.4);
    const screenMat = new THREE.MeshStandardMaterial({
      map: this.adMats[0].map, emissiveMap: this.adMats[0].map, emissive: 0xffffff,
      emissiveIntensity: 0.45, roughness: 0.4, side: THREE.DoubleSide,
    });
    this.addBox(this.mat.dark, base, 0.35, 4.0, 6.6, side * 31, 2.0, 2.0);
    this.addPlane(screenMat, base, 6.2, 3.4, side * 31.2, 3.2, 2.0, -side * Math.PI / 2);
    this.addBox(this.mat.dark, base, 8, 0.8, 5, side * 20, 0.4, 0);
    for (let i = 0; i < 26; i++) {
      this.addPerson(base, side * (3 + this.rng() * 13), 0, -8 + this.rng() * 16, this.rng() * TAU,
        0.85 + this.rng() * 0.22, [0xc94f38, 0x2f6d78, 0xd9b84e, 0x705780, 0xd8d1c2][Math.floor(this.rng() * 5)]);
    }
  }

  buildForestLodge(d, side) {
    const base = this.anchor(d, side, this.barrier + 20);
    this.forestClearing = new THREE.Vector3().setFromMatrixPosition(base);
    this.forestClearings.push(new THREE.Vector3().setFromMatrixPosition(base).add(new THREE.Vector3(0, 0, 4)));
    // 增加一盏营地灯，让地图上的木屋更容易被看见
    this.addCyl(this.mat.steel, base, 0.12, 0.18, 10, 8, side * 10, 5, -3);
    this.addBox(this.mat.led, base, 1.4, 0.22, 0.7, side * 10, 9.9, -3);
    // 碎石营地广场，深色林地里能清楚看到
    this.addBox(this.mat.concreteDark, base, 30, 0.08, 25, side * 6, 0.04, 4);
    this.addBox(this.mat.woodDark, base, 20, 1.0, 12, 0, 0.5, 0);
    this.addBox(this.mat.wood, base, 19, 4.4, 11, 0, 3.0, 0);
    // 双坡屋顶，避免大圆锥体压到赛道上
    this.addBox(this.mat.white, base, 21.5, 0.5, 13.5, 0, 6.65, 0);
    this.addBox(this.mat.white, base, 15.5, 0.45, 12.5, 0, 7.2, 0);
    this.roofLabel(base, 'FOREST LODGE', 'APEX OUTDOOR CLUB · PASS 02', 0, 7.46, 0, 16, 4.0, '#31251b', '#f0e2c7', '#e0b35a');
    this.addBox(this.mat.orange, base, 22, 0.16, 0.2, 0, 6.45, 0);
    for (let i = -1; i <= 1; i++) {
      this.addBox(this.mat.glass, base, 0.1, 1.45, 1.9, -10.0, 3.2, i * 3.3);
    }
    this.addBox(this.mat.glass, base, 2.2, 1.7, 0.1, 0, 2.4, 5.6);
    this.addBox(this.mat.woodDark, base, 4.0, 1.0, 3.2, 0, 0.5, 7.0);
    const sign = this.landmarkSign('FOREST LODGE', 'PASS 02  ·  APEX OUTDOOR CLUB', '#e0b35a');
    this.addPlane(sign, base, 9.8, 1.5, -10.15, 4.8, 0, -side * Math.PI / 2);
    for (let i = 0; i < 7; i++) {
      const tx = side * (3.5 + this.rng() * 11);
      const tz = 11 + (i % 3) * 4.2;
      const tent = new THREE.ConeGeometry(2.0, 2.4, 4);
      tent.rotateY(Math.PI / 4);
      this.add(tint(tent, i % 3 === 0 ? 0x5e6b3a : i % 3 === 1 ? 0xb8a883 : 0x7a4c38), this.mat.tent, base, tx, 1.2, tz);
      this.addBox(this.mat.woodDark, base, 1.2, 0.08, 1.2, tx, 0.05, tz);
    }
    this.addBox(this.mat.woodDark, base, 2.0, 0.24, 2.0, side * 8, 0.12, 12);
    for (let i = 0; i < 5; i++) {
      this.addBox(new THREE.MeshBasicMaterial({ color: 0xff8a2e }), base, 0.3, 0.16, 0.3, side * 8 + (this.rng() - 0.5) * 1.0, 0.3, 12 + (this.rng() - 0.5) * 1.0);
    }
    for (let i = 0; i < 4; i++) {
      const x = side * (12 + (i % 2) * 3);
      const z = 6 + Math.floor(i / 2) * 4;
      this.addParkedCar(base, x, z, Math.PI / 2, [0x4e6b47, 0xd8d0bc, 0x9a5b36, 0x405c69][i]);
    }
    for (let i = -4; i <= 4; i++) {
      this.addBox(this.mat.wood, base, 0.12, 1.3, 0.12, side * (2 + i * 3.0), 0.65, 17);
    }
    this.addBox(this.mat.wood, base, 26, 0.12, 0.1, side * 14, 1.1, 17);
  }

  // ---------------------------------------------------------------- roadside life

  buildRoadsideLife() {
    const urban = this.theme.urban || this.theme.id === 'coast' || this.theme.market;
    const palette = [0xcf4c30, 0x2d5f73, 0xe0b34d, 0xded7c7, 0x4f6b51, 0x8e6c8a, 0x44484a, 0xb16d39];
    const count = Math.floor(this.total / 64);
    for (let i = 0; i < count; i++) {
      const d = 42 + i * 64;
      if (this.total - d < 22) continue;
      const side = i % 2 ? 1 : -1;
      if (this.isNearZone(d, 16)) continue;
      if (urban) {
        const base = this.anchor(d, side, this.barrier + 6.2);
        this.addParkedCar(base, 0, 0, (i % 4) * 0.04 - 0.06, palette[i % palette.length]);
      }
      // 围栏后的三三两两观众 / 摄影师
      if (i % 2 === 0) {
        const crowdBase = this.anchor(d + 9, side, this.barrier + 2.4);
        for (let k = 0; k < 7; k++) {
          const px = side * (this.rng() * 0.8);
          this.addPerson(crowdBase, px, 0, -2.5 + this.rng() * 5, this.rng() * TAU,
            0.82 + this.rng() * 0.24,
            [0xd05a3b, 0x346f7b, 0xd7b94f, 0x6d547c, 0xe0d7c7, 0x4a6c4b][Math.floor(this.rng() * 6)]);
        }
        if (i % 6 === 0) {
          this.addPerson(crowdBase, side * 1.1, 0, 1.5, Math.PI, 0.92, 0x293747);
          this.addBox(this.mat.dark, crowdBase, 0.4, 0.3, 0.26, side * 1.35, 1.1, 1.5);
          this.addBox(this.mat.steel, crowdBase, 0.04, 0.7, 0.04, side * 1.2, 0.6, 1.4);
        }
      }
    }
  }

  buildPaddock() {
    const startD = 18;
    for (let i = 0; i < 7; i++) {
      const d = startD + i * 7.2;
      const base = this.anchor(d, 1, this.barrier + 2.2);
      this.addBox(this.mat.white, base, 0.32, 0.85, 6.9, 0, 0.43, 0);
      this.addBox(this.mat.orange, base, 0.36, 0.13, 6.9, 0, 0.88, 0);
      // 后方的 team stand
      const team = this.anchor(d, 1, this.barrier + 4.5);
      this.addBox(this.mat.dark, team, 1.6, 0.9, 4.0, 0, 0.45, 0);
      this.addBox(this.mat.steel, team, 0.08, 2.4, 0.08, 0, 1.2, -1.4);
      this.addBox(this.mat.steel, team, 0.08, 2.4, 0.08, 0, 1.2, 1.4);
      this.addBox(this.mat.orange, team, 2.0, 0.08, 3.4, 0, 2.35, 0);
      this.addPlane(this.mat.banner, team, 3.4, 0.46, 0, 1.5, 0.2, -Math.PI / 2);
      // 轮胎架、工具箱与技师
      for (let k = 0; k < 3; k++) {
        this.addCyl(this.mat.tire, team, 0.38, 0.38, 0.21, 10, -0.7, 0.36 + k * 0.22, -0.8, 0, Math.PI / 2, 0);
      }
      this.addBox(this.mat.red, team, 0.8, 0.55, 0.4, 0.4, 0.3, 0.9);
      this.addPerson(team, -0.8, 0, 1.2, 0.2, 1.0, 0xff6a2a);
      this.addPerson(team, 0.7, 0, 0.2, Math.PI, 0.96, 0xf0e4d0);
    }
    // 发车区的锥桶与技师
    for (let i = 0; i < 12; i++) {
      const d = -45 + i * 5.5;
      const side = i % 2 ? 1 : -1;
      const base = this.anchor(d, side, TRACK.width / 2 + 0.9);
      this.addCyl(this.mat.orange, base, 0.17, 0.24, 0.5, 8, 0, 0.25, 0);
      this.addBox(this.mat.white, base, 0.35, 0.07, 0.35, 0, 0.2, 0);
      if (i % 3 === 0) this.addPerson(base, side * 0.7, 0, 0.7, 0, 0.95, 0xff6a2a);
    }
    // 起点摄影记者
    for (let i = 0; i < 5; i++) {
      const base = this.anchor(-28 + i * 6, -1, this.barrier + 2.4);
      this.addPerson(base, 0, 0, 0, Math.PI, 0.9, 0x2f3c4c);
      this.addBox(this.mat.dark, base, 0.42, 0.32, 0.28, 0.28, 1.15, 0.22);
      this.addBox(this.mat.steel, base, 0.04, 0.75, 0.04, 0.2, 0.65, 0.15);
      this.addBox(this.mat.dark, base, 0.03, 0.4, 0.03, -0.2, 0.1, 0);
    }
  }

  // ---------------------------------------------------------------- rescue / camera cranes

  buildCameraCranes() {
    for (const [d, side] of [[84, -1], [this.total * 0.62, 1]]) {
      const base = this.anchor(d, side, this.barrier + 5.0);
      this.addBox(this.mat.concreteDark, base, 2.2, 0.25, 2.2, 0, 0.12, 0);
      this.addBox(this.mat.dark, base, 0.26, 5.4, 0.26, 0, 2.7, 0);
      this.addBox(this.mat.steel, base, 0.26, 5.4, 0.26, -1.2, 2.7, 0);
      this.addBox(this.mat.steel, base, 0.18, 0.18, 6.2, 0, 5.1, 2.6, 0, 0.25, 0);
      this.addBox(this.mat.dark, base, 0.6, 0.42, 0.7, 0, 5.8, 5.6);
      this.addBox(this.mat.amberLed, base, 0.2, 0.12, 0.2, 0, 6.05, 5.6);
      this.addPerson(base, 0.6, 0, 0.7, 0, 1.0, 0x2f3c4c);
    }
  }

  // ---------------------------------------------------------------- theme props

  buildThemeProps() {
    if (this.theme.port || this.theme.id === 'harbor') this.buildHarborProps();
    if (this.theme.id === 'coast') this.buildCoastProps();
    if (this.theme.market) this.buildMarketProps();
    if (this.theme.forest) this.buildForestProps();
  }

  buildHarborProps() {
    const palette = [0xb54f37, 0x3c647c, 0x4e7352, 0xb28a42, 0x6e5f56];
    // 集装箱堆场
    for (let i = 0; i < 5; i++) {
      const d = 0.12 * this.total + i * 0.17 * this.total;
      const side = i % 2 ? 1 : -1;
      const base = this.anchor(d, side, this.barrier + 16.5);
      for (let k = 0; k < 2 + (i % 2); k++) {
        const mat = new THREE.MeshStandardMaterial({
          map: containerTexture(), color: palette[(i + k) % palette.length], roughness: 0.74, metalness: 0.22,
        });
        this.addBox(mat, base, 6.0, 2.55, 2.45, 0, 1.3 + k * 2.55, 0);
        this.addBox(this.mat.dark, base, 6.1, 0.1, 2.5, 0, 2.6 + k * 2.55, 0);
      }
      this.addBox(this.mat.concreteDark, base, 6.2, 0.22, 2.8, 0, 0.1, 0);
    }
    // 龙门吊
    const craneD = this.total * 0.3;
    const craneBase = this.anchor(craneD, -1, this.barrier + 22);
    for (const sx of [-5, 5]) {
      for (const sz of [-6, 6]) {
        this.addBox(this.mat.steel, craneBase, 0.6, 18, 0.6, sx, 9, sz);
      }
    }
    this.addBox(this.mat.steel, craneBase, 12, 0.8, 0.8, 0, 18, -6);
    this.addBox(this.mat.steel, craneBase, 12, 0.8, 0.8, 0, 18, 6);
    this.addBox(this.mat.orange, craneBase, 2.3, 1.5, 2.6, 0, 16.4, 1.4);
    this.addBox(this.mat.dark, craneBase, 2.0, 0.8, 1.4, 0, 17.3, 1.4);
    // 木托盘、油桶
    for (let i = 0; i < 4; i++) {
      const base = this.anchor(this.total * 0.2 + i * 23, i % 2 ? -1 : 1, this.barrier + 8.2);
      this.addBox(this.mat.wood, base, 1.8, 0.12, 1.3, 0, 0.06, 0);
      this.addBox(this.mat.wood, base, 1.8, 0.12, 1.3, 0, 0.2, 0);
      this.addCyl(this.mat.blue, base, 0.3, 0.3, 0.8, 10, 0.35, 0.4, -0.4);
    }
    // 紧贴围栏的集装箱堆，地图和追尾视角都能看到
    for (let i = 0; i < 5; i++) {
      const d = this.total * 0.16 + i * this.total * 0.16;
      const side = i % 2 ? 1 : -1;
      const base = this.anchor(d, side, this.barrier + 13.5);
      const mat = new THREE.MeshStandardMaterial({
        map: this.mat.container.map, color: palette[i % palette.length], roughness: 0.72, metalness: 0.24,
      });
      this.addBox(mat, base, 6.0, 2.55, 2.45, 0, 1.3, 0);
      if (i % 2 === 0) this.addBox(mat, base, 6.0, 2.55, 2.45, 0, 3.85, 0);
      this.addBox(this.mat.concreteDark, base, 6.2, 0.2, 2.8, 0, 0.1, 0);
      this.addBox(this.mat.steel, base, 0.16, 8.0, 0.16, side * 3.2, 4, 1.3);
      this.addBox(this.mat.led, base, 1.1, 0.18, 0.5, side * 3.2, 8, 1.3);
    }
  }

  buildCoastProps() {
    // 沙丘草与低矮灌木
    const tufts = [];
    for (let i = 0; i < 240; i++) {
      const d = this.rng() * this.total;
      if (d < 50) continue;
      const side = this.rng() > 0.5 ? 1 : -1;
      const base = this.anchor(d, side, this.barrier + 2.0 + this.rng() * 5.5);
      const pos = new THREE.Vector3().setFromMatrixPosition(base);
      const g = new THREE.ConeGeometry(0.09 + this.rng() * 0.08, 0.35 + this.rng() * 0.55, 3);
      g.translate(pos.x + (this.rng() - 0.5) * 1.4, 0.3, pos.z + (this.rng() - 0.5) * 1.4);
      tufts.push(tint(g, this.rng() > 0.45 ? 0x758348 : 0x8e9a5b));
    }
    this.mergeInto(tufts, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94 }), { castShadow: false });
    // 近距离沙滩伞
    for (let i = 0; i < 7; i++) {
      const d = (0.1 + i * 0.115) * this.total;
      const side = i % 2 ? 1 : -1;
      const base = this.anchor(d, side, this.barrier + 7.6 + (i % 3) * 1.2);
      this.addCyl(this.mat.steel, base, 0.05, 0.07, 2.7, 6, 0, 1.35, 0);
      const canopy = new THREE.ConeGeometry(2.15, 0.7, 10, 1, true);
      this.add(tint(canopy, [0xe0562f, 0x2d7f8a, 0xf2c14e, 0xefe7d7][i % 4]), new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.8, side: THREE.DoubleSide,
      }), base, 0, 2.7, 0);
      this.addBox(this.mat.white, base, 1.5, 0.15, 0.55, 0.6, 0.12, 0.7, 0.4);
    }
    // 救生员塔
    const base = this.anchor(this.total * 0.78, -1, this.barrier + 10);
    for (const x of [-1.2, 1.2]) {
      for (const z of [-1.2, 1.2]) this.addBox(this.mat.wood, base, 0.16, 2.4, 0.16, x, 1.2, z);
    }
    this.addBox(this.mat.white, base, 3.0, 1.8, 3.0, 0, 3.0, 0);
    this.addBox(this.mat.orange, base, 3.2, 0.18, 3.2, 0, 3.95, 0);
    this.addBox(this.mat.glass, base, 1.8, 0.55, 0.06, 0, 3.35, 1.52);
    this.addBox(this.mat.steel, base, 0.06, 2.7, 0.06, 1.4, 4.6, 0);
    this.addFlag(base, 1.37, 5.95, 0, 1.0, 0.6, 0xe0562f, 0);
    // 冲浪板架
    const rack = this.anchor(this.total * 0.58, 1, this.barrier + 8.0);
    this.addBox(this.mat.wood, rack, 2.2, 1.1, 0.3, 0, 0.55, 0);
    for (let i = 0; i < 4; i++) {
      const board = new THREE.CapsuleGeometry(0.18, 1.4, 4, 8);
      board.rotateZ(0.16);
      this.add(board, tint(board, [0xe0d6bd, 0xd35a36, 0x3d7d83, 0xe7c35a][i]), rack, -0.7 + i * 0.46, 1.5, 0.16);
    }
    // 海滩伞、躺椅与小cabana，填满赛道与沙滩之间的空白
    for (let i = 0; i < 13; i++) {
      const d = this.total * 0.08 + i * this.total * 0.071;
      const side = this.coastSide(d);
      const base = this.anchor(d, side, this.barrier + 9.4);
      const ux = side * (i % 2 ? 1.2 : -0.9);
      this.addCyl(this.mat.steel, base, 0.045, 0.06, 2.8, 6, ux, 1.4, 0);
      const canopy = new THREE.ConeGeometry(2.25, 0.7, 10, 1, true);
      this.add(tint(canopy, [0xe0562f, 0x2d7f8a, 0xf2c14e, 0xefe7d7][i % 4]), this.mat.tent, base, ux, 2.8, 0);
      for (const oz of [-0.9, 0.9]) {
        this.addBox(this.mat.white, base, 2.0, 0.12, 0.7, ux + side * 1.8, 0.36, oz);
        this.addBox(new THREE.MeshStandardMaterial({ color: [0xd45435, 0x3c7b85, 0xf0d16a][i % 3], roughness: 0.85 }), base, 1.4, 0.04, 0.5, ux + side * 1.8, 0.43, oz);
      }
      if (i % 3 === 0) {
        // 小更衣/储物cabana
        const cx = side * (i % 2 ? 3.2 : -3.0);
        for (const ox of [-1.2, 1.2]) {
          for (const oz of [-1.2, 1.2]) this.addBox(this.mat.wood, base, 0.12, 2.5, 0.12, cx + ox, 1.25, oz);
        }
        const roof = new THREE.ConeGeometry(2.35, 0.6, 4);
        roof.rotateY(Math.PI / 4);
        this.add(tint(roof, i % 2 ? 0x2d7f8a : 0xd45a35), this.mat.tent, base, cx, 2.75, 0);
        this.addBox(new THREE.MeshStandardMaterial({ color: 0xefe5d2, roughness: 0.8 }), base, 2.6, 0.8, 2.6, cx, 0.4, 0);
      }
      if (i % 3 === 1) {
        // 沙滩上的小观众群
        for (let k = 0; k < 3; k++) {
          this.addPerson(base, side * (4.0 + this.rng() * 1.2), 0, -1.6 + this.rng() * 3.2, this.rng() * TAU,
            0.82 + this.rng() * 0.2, [0xe7d8bd, 0xd35b3a, 0x2f707b][k]);
        }
      }
    }
  }

  buildMarketProps() {
    // 三辆小吃车 / 餐车
    for (let i = 0; i < 3; i++) {
      const d = (0.18 + i * 0.23) * this.total;
      const side = i % 2 ? 1 : -1;
      const base = this.anchor(d, side, this.barrier + 5.8);
      const bodyColor = [0xd25437, 0x2f7f74, 0xe0a33a][i];
      this.addBox(this.mat.dark, base, 1.8, 0.4, 3.4, 0, 0.45, 0);
      this.addBox(new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.52 }), base, 1.8, 1.45, 2.7, 0, 1.38, -0.2);
      this.addBox(this.mat.white, base, 2.0, 0.12, 3.0, 0, 2.3, -0.2);
      this.addBox(this.mat.orange, base, 2.1, 0.12, 3.1, 0, 2.42, -0.2);
      this.addBox(this.mat.glass, base, 1.45, 0.6, 0.06, 0, 1.55, 1.18);
      this.addBox(this.mat.steel, base, 0.1, 0.35, 0.1, 1.3, 0.22, 1.0);
      this.buildWheels(base, [-0.9], 0.92, 0.3);
      // 霓虹菜单牌
      const signMat = new THREE.MeshBasicMaterial({ color: i === 1 ? 0xffad4d : 0xff6a2e });
      this.addBox(signMat, base, 1.6, 0.32, 0.06, 0, 2.55, 1.35);
      // 灯笼串
      for (let k = 0; k < 5; k++) {
        const lx = (k - 2) * 0.45;
        const lantern = new THREE.SphereGeometry(0.12, 8, 6);
        this.add(lantern, new THREE.MeshBasicMaterial({ color: 0xff9a45 }), base, lx, 2.1, 1.55);
      }
    }
    // 场地边的小摩托和霓虹牌
    for (let i = 0; i < 4; i++) {
      const base = this.anchor(0.16 * this.total + i * 0.2 * this.total, i % 2 ? 1 : -1, this.barrier + 4.2);
      this.addBox(this.mat.dark, base, 0.45, 0.4, 1.25, 0, 0.55, 0);
      this.addCyl(this.mat.tire, base, 0.25, 0.25, 0.12, 10, 0, 0.28, 0.5, 0, 0, Math.PI / 2);
      this.addCyl(this.mat.tire, base, 0.25, 0.25, 0.12, 10, 0, 0.28, -0.5, 0, 0, Math.PI / 2);
      this.addBox(this.mat.steel, base, 0.05, 0.75, 0.05, 0, 0.85, 0.6);
      this.addBox(new THREE.MeshBasicMaterial({ color: 0xff3b88 }), base, 0.75, 0.2, 0.04, 0, 1.4, 0.6);
    }
    // 沿围栏挂一串暖色灯笼，夜里从地图上也能看到
    let li = 0;
    for (let d = 14; d < this.total - 12; d += 15) {
      const side = li % 2 ? 1 : -1;
      const base = this.anchor(d, side, this.barrier + 2.0);
      this.addBox(this.mat.steel, base, 0.055, 3.5, 0.055, 0, 1.75, 0);
      for (let k = 0; k < 3; k++) {
        this.addBox(k % 2 ? this.mat.neonC : this.mat.neonD, base, 0.24, 0.24, 0.24, side * 0.28, 3.35 - k * 0.32, k * 0.18 - 0.18);
      }
      li++;
    }
  }

  buildForestProps() {
    // 松林与林间灌木，直接贴近围栏，解决林区赛道两侧发空的问题。
    const pinePts = [];
    for (let i = 0; i < 760; i++) {
      const d = (i / 760) * this.total + this.rng() * 4.5;
      if (d < 38) continue;
      const side = i % 2 ? 1 : -1;
      const lat = this.barrier + 2.6 + this.rng() * 29;
      const p = this.track.getPoseAt(d).position.clone().addScaledVector(this.track.getPoseAt(d).right, side * lat);
      let skip = false;
      for (const c of this.forestClearings) {
        if (Math.hypot(p.x - c.x, p.z - c.z) < 32) { skip = true; break; }
      }
      for (const c of this.fanCenters) {
        if (Math.hypot(p.x - c.x, p.z - c.z) < 24) { skip = true; break; }
      }
      if (skip) continue;
      pinePts.push([p.x, p.z]);
    }
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.34, 2.6, 6);
    trunkGeo.translate(0, 1.3, 0);
    const leafParts = [];
    [[2.1, 3.4, 3.1], [1.6, 3.0, 5.2], [0.9, 2.5, 7.0]].forEach(([r, h, y]) => {
      const cone = new THREE.ConeGeometry(r, h, 8, 1);
      cone.translate(0, y, 0);
      leafParts.push(cone);
    });
    const leafGeo = mergeGeometries(leafParts, false);
    this.trees.push({ trunkGeo, leafGeo, points: pinePts, scale: [1.05, 1.9] });
    // 少量阔叶树，丰富林冠层次
    const broadPts = [];
    for (let i = 0; i < 180; i++) {
      const d = (i / 180) * this.total + this.rng() * 7;
      if (d < 50) continue;
      const side = i % 2 ? 1 : -1;
      const lat = this.barrier + 6 + this.rng() * 24;
      const p = this.track.getPoseAt(d).position.clone().addScaledVector(this.track.getPoseAt(d).right, side * lat);
      let skip = false;
      for (const c of this.forestClearings) if (Math.hypot(p.x - c.x, p.z - c.z) < 30) skip = true;
      for (const c of this.fanCenters) if (Math.hypot(p.x - c.x, p.z - c.z) < 24) skip = true;
      if (!skip) broadPts.push([p.x, p.z]);
    }
    const bTrunk = new THREE.CylinderGeometry(0.3, 0.5, 4.2, 6);
    bTrunk.translate(0, 2.1, 0);
    const bLeaves = [];
    for (const [x, y, z, r] of [[0, 6.3, 0, 2.6], [1.4, 7.2, 0.4, 1.9], [-1.2, 7.8, -0.4, 1.7]]) {
      const blob = new THREE.IcosahedronGeometry(r, 1);
      blob.scale(1.2, 0.85, 1.2);
      blob.translate(x, y, z);
      bLeaves.push(blob);
    }
    this.trees.push({ trunkGeo: bTrunk, leafGeo: mergeGeometries(bLeaves, false), points: broadPts, scale: [0.9, 1.55] });
    // 蕨类 / 草簇
    const ferns = [];
    for (let i = 0; i < 130; i++) {
      const d = this.rng() * this.total;
      if (d < 40) continue;
      const side = this.rng() > 0.5 ? 1 : -1;
      const base = this.anchor(d, side, this.barrier + 1.8 + this.rng() * 4.5);
      const p = new THREE.Vector3().setFromMatrixPosition(base);
      for (let k = 0; k < 4; k++) {
        const g = new THREE.ConeGeometry(0.08, 0.45 + this.rng() * 0.4, 3);
        g.rotateZ((this.rng() - 0.5) * 0.9);
        g.translate(p.x + (this.rng() - 0.5) * 1.2, 0.22, p.z + (this.rng() - 0.5) * 1.2);
        ferns.push(tint(g, this.rng() > 0.5 ? 0x4b6b35 : 0x647b3e));
      }
    }
    this.mergeInto(ferns, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94 }), { castShadow: false });
    // 石头与木堆
    const stones = [];
    for (let i = 0; i < 35; i++) {
      const d = this.rng() * this.total;
      if (d < 45) continue;
      const side = this.rng() > 0.5 ? 1 : -1;
      const base = this.anchor(d, side, this.barrier + 2.5 + this.rng() * 4);
      const p = new THREE.Vector3().setFromMatrixPosition(base);
      const r = 0.45 + this.rng() * 1.1;
      const g = new THREE.DodecahedronGeometry(r, 0);
      g.scale(1.1, 0.65, 1);
      g.translate(p.x, r * 0.4, p.z);
      stones.push(tint(g, 0x6b675d));
    }
    this.mergeInto(stones, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94 }));
    for (let i = 0; i < 4; i++) {
      const base = this.anchor(0.15 * this.total + i * 0.2 * this.total, i % 2 ? -1 : 1, this.barrier + 4.8);
      for (let k = 0; k < 4; k++) {
        this.addCyl(this.mat.woodDark, base, 0.22, 0.22, 2.6, 8, 0, 0.24 + k * 0.4, 0, 0, 0, Math.PI / 2);
      }
    }
    // 林间救援帐篷
    const camp = this.anchor(this.total * 0.55, 1, this.barrier + 7.6);
    this.addBox(this.mat.green, camp, 4.2, 0.12, 3.6, 0, 0.12, 0);
    this.addBox(this.mat.white, camp, 4.0, 1.3, 3.4, 0, 0.76, 0);
    this.addBox(this.mat.red, camp, 1.2, 0.12, 0.12, 0, 1.52, 0);
    this.addBox(this.mat.red, camp, 0.12, 0.12, 1.2, 0, 1.52, 0);
    this.addBox(this.mat.orange, camp, 4.4, 0.1, 3.8, 0, 1.48, 0);
    this.addFlag(camp, -2.1, 3.0, -1.6, 1.0, 0.62, 0xf1e4cc, 0);
  }

  // ---------------------------------------------------------------- crowd + trees finish

  buildCrowdMeshes() {
    if (!this.crowd.length) return;
    const body = [];
    for (const x of [-0.1, 0.1]) {
      const leg = new THREE.BoxGeometry(0.14, 0.7, 0.14);
      leg.translate(x, 0.35, 0);
      body.push(leg);
    }
    const torso = new THREE.BoxGeometry(0.38, 0.56, 0.24);
    torso.translate(0, 0.96, 0);
    body.push(torso);
    for (const x of [-0.24, 0.24]) {
      const arm = new THREE.BoxGeometry(0.09, 0.46, 0.11);
      arm.translate(x, 0.98, 0);
      body.push(arm);
    }
    const bodyGeo = mergeGeometries(body, false);
    const headGeo = new THREE.SphereGeometry(0.11, 8, 6);
    headGeo.translate(0, 1.6, 0);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.02 });
    const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, this.crowd.length);
    const heads = new THREE.InstancedMesh(headGeo, this.mat.skin, this.crowd.length);
    bodies.castShadow = false;
    bodies.receiveShadow = false;
    heads.castShadow = false;
    for (let i = 0; i < this.crowd.length; i++) {
      const c = this.crowd[i];
      bodies.setMatrixAt(i, c.matrix);
      heads.setMatrixAt(i, c.matrix);
      bodies.setColorAt(i, c.color);
    }
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
    this.group.add(bodies, heads);
  }

  buildTreeInstances() {
    for (const t of this.trees) {
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4c3626, roughness: 0.95 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
      const trunks = new THREE.InstancedMesh(t.trunkGeo, trunkMat, t.points.length);
      const leaves = new THREE.InstancedMesh(t.leafGeo, leafMat, t.points.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      const v = new THREE.Vector3();
      const s = new THREE.Vector3();
      const leafColor = new THREE.Color();
      for (let i = 0; i < t.points.length; i++) {
        const [x, z] = t.points[i];
        const sc = t.scale[0] + this.rng() * (t.scale[1] - t.scale[0]);
        q.setFromAxisAngle(up, this.rng() * TAU);
        v.set(x, 0, z);
        s.set(sc * (0.9 + this.rng() * 0.2), sc, sc * (0.9 + this.rng() * 0.2));
        m.compose(v, q, s);
        trunks.setMatrixAt(i, m);
        leaves.setMatrixAt(i, m);
        leafColor.setHex(i % 3 === 0 ? 0x36522d : i % 3 === 1 ? 0x49673a : 0x2d4727);
        leaves.setColorAt(i, leafColor);
      }
      trunks.instanceMatrix.needsUpdate = true;
      leaves.instanceMatrix.needsUpdate = true;
      if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
      trunks.castShadow = false;
      leaves.castShadow = true;
      leaves.receiveShadow = true;
      this.group.add(trunks, leaves);
    }
  }

  update(dt, time) {
    // 旗帜轻微摆动；旗面独立于合并后的赛道设施。
    for (let i = 0; i < this.flags.length; i++) {
      const f = this.flags[i];
      f.mesh.rotation.y = Math.sin(time * 2.1 + i * 0.7) * 0.06;
    }
    void dt;
  }
}
