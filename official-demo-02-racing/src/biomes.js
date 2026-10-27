import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, makeCanvas, mulberry32, radialTexture } from './utils.js';
import { TRACK } from './config.js';
import { COAST } from './environment.js';
import { getTheme } from './themes.js';

const TAU = Math.PI * 2;

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

function groundCanvas(kind) {
  const s = 1024;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rng = mulberry32(kind === 'dry' ? 19 : kind === 'sand' ? 41 : 7);
  const palettes = {
    grass: ['#3f4d2b', '#4a5a34', '#54663a', '#39472a', '#5d6b3d'],
    dry: ['#8a7a52', '#94845a', '#7d6f4a', '#9c8c62', '#6f6442'],
    sand: ['#c3ab86', '#cbb491', '#b59d79', '#d2bd9c', '#a9916f'],
  };
  const pal = palettes[kind] || palettes.grass;
  ctx.fillStyle = pal[0];
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 220; i++) {
    const x = rng() * s, y = rng() * s, r = 30 + rng() * 150;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, pal[1 + Math.floor(rng() * (pal.length - 1))]);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.25 + rng() * 0.3;
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  const speckles = kind === 'sand' ? 5200 : 9000;
  for (let i = 0; i < speckles; i++) {
    const v = rng();
    ctx.fillStyle = kind === 'grass'
      ? `rgba(${56 + v * 60},${74 + v * 70},${38 + v * 44},0.5)`
      : kind === 'dry'
        ? `rgba(${120 + v * 70},${108 + v * 60},${70 + v * 50},0.45)`
        : `rgba(${190 + v * 50},${176 + v * 40},${140 + v * 40},0.4)`;
    const w = kind === 'sand' ? 1.4 : 1.1;
    ctx.fillRect(rng() * s, rng() * s, w, w * (kind === 'grass' ? 2.6 : 1.4));
  }
  if (kind !== 'sand') {
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(${112 + rng() * 40},${104 + rng() * 34},${88 + rng() * 30},${0.18 + rng() * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(rng() * s, rng() * s, 2 + rng() * 7, 1.4 + rng() * 4, rng() * TAU, 0, TAU);
      ctx.fill();
    }
  }
  return canvasTexture(c, { repeat: [1, 1], anisotropy: 8 });
}

export class Biome {
  constructor(scene, textures, track, themeId = 'city') {
    this.scene = scene;
    this.textures = textures;
    this.track = track;
    this.theme = getTheme(themeId);
    this.group = new THREE.Group();
    this.group.name = 'Havelli biome';
    scene.add(this.group);
    this.rng = mulberry32(20261019);
    this.half = TRACK.width / 2;
    this.barrier = TRACK.barrierOffset;
    this.center = new THREE.Vector3();
    for (const s of track.samples) this.center.add(s.position);
    this.center.multiplyScalar(1 / track.samples.length);
    this.buildGrid();

    if (!this.theme.urban) this.buildGround();
    if (this.theme.forest) this.buildForest();
    if (this.theme.valley) this.buildValley();
    if (this.theme.id === 'coast') this.buildCoast();
    if (this.theme.market) this.buildMarket();
    if (this.theme.port) this.buildPort();
  }

  // ---------------------------------------------------------------- helpers

  buildGrid() {
    this.cell = 14;
    this.grid = new Map();
    const samples = this.track.samples;
    for (let i = 0; i < samples.length; i += 2) {
      const p = samples[i].position;
      const key = `${Math.floor(p.x / this.cell)},${Math.floor(p.z / this.cell)}`;
      let arr = this.grid.get(key);
      if (!arr) { arr = []; this.grid.set(key, arr); }
      arr.push(p.x, p.z);
    }
  }

  /** 到赛道中心线的距离（网格加速，造景时会被调用几万次）。 */
  roadDist(x, z) {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    let best = Infinity;
    for (let r = 0; r <= 7; r++) {
      for (let a = -r; a <= r; a++) {
        for (let b = -r; b <= r; b++) {
          if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue;
          const arr = this.grid.get(`${cx + a},${cz + b}`);
          if (!arr) continue;
          for (let k = 0; k < arr.length; k += 2) {
            const dx = arr[k] - x, dz = arr[k + 1] - z;
            const d = dx * dx + dz * dz;
            if (d < best) best = d;
          }
        }
      }
      if (best < Infinity && best < (r * this.cell) * (r * this.cell)) break;
    }
    return Math.sqrt(best);
  }

  clearOfRoad(x, z, margin) {
    return this.roadDist(x, z) > this.half + this.barrier + margin;
  }

  nearStart(x, z, along = 52, lateral = 52) {
    const s = this.track.samples[0];
    const dx = x - s.position.x, dz = z - s.position.z;
    return Math.abs(dx * s.tangent.x + dz * s.tangent.z) < along
      && Math.abs(dx * s.right.x + dz * s.right.z) < this.half + lateral;
  }

  scatter(count, minR, maxR, margin, accept) {
    const pts = [];
    const rng = this.rng;
    let guard = 0;
    while (pts.length < count && guard < count * 60) {
      guard++;
      const a = rng() * TAU;
      const r = Math.sqrt(rng() * (maxR * maxR - minR * minR) + minR * minR);
      const x = this.center.x + Math.cos(a) * r;
      const z = this.center.z + Math.sin(a) * r;
      if (!this.clearOfRoad(x, z, margin)) continue;
      if (this.nearStart(x, z, 50, 50)) continue;
      if (accept && !accept(x, z)) continue;
      pts.push([x, z]);
    }
    return pts;
  }

  mergeInto(geoms, material, opts = {}) {
    if (!geoms.length) return null;
    const merged = mergeGeometries(geoms, false);
    if (!merged) return null;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = opts.castShadow ?? true;
    mesh.receiveShadow = opts.receiveShadow ?? true;
    this.group.add(mesh);
    return mesh;
  }

  // ---------------------------------------------------------------- ground

  buildGround() {
    const kind = this.theme.ground;
    const tex = groundCanvas(kind);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(44, 44);
    tex.needsUpdate = true;
    // 海边主题：地面要停在沙滩前面，否则会盖住海面
    const isCoast = this.theme.id === 'coast';
    const depth = isCoast ? 3600 : 6400;
    const zCenter = isCoast ? 245 - depth / 2 : this.center.z;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(6400, depth, 1, 1),
      new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.98, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    // 必须明显低于赛道面（0.015），否则远处会和柏油抢深度
    ground.position.set(this.center.x, -0.05, zCenter);
    ground.receiveShadow = true;
    this.group.add(ground);
    this.ground = ground;

    // 路面外侧压实的土肩，让草地和柏油之间有个过渡
    const shoulderMat = new THREE.MeshStandardMaterial({
      color: kind === 'sand' ? 0xa8946f : kind === 'dry' ? 0x6f6349 : 0x4c4a33,
      roughness: 1, metalness: 0,
    });
    const verts = [];
    const indices = [];
    const n = this.track.samples.length;
    let v = 0;
    for (const side of [-1, 1]) {
      for (let i = 0; i < n; i += 2) {
        const s0 = this.track.samples[i];
        const s1 = this.track.samples[(i + 2) % n];
        const a0 = s0.position.clone().addScaledVector(s0.right, side * (this.half + this.barrier + 0.9));
        const b0 = s0.position.clone().addScaledVector(s0.right, side * (this.half + this.barrier + 6.4));
        const a1 = s1.position.clone().addScaledVector(s1.right, side * (this.half + this.barrier + 0.9));
        const b1 = s1.position.clone().addScaledVector(s1.right, side * (this.half + this.barrier + 6.4));
        verts.push(a0.x, 0.045, a0.z, b0.x, 0.045, b0.z, a1.x, 0.045, a1.z, b1.x, 0.045, b1.z);
        if (side > 0) indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
        else indices.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
        v += 4;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const shoulder = new THREE.Mesh(geo, shoulderMat);
    shoulder.receiveShadow = true;
    this.group.add(shoulder);
  }

  // ---------------------------------------------------------------- forest

  treeGeometries(kind) {
    const parts = { trunk: [], leaf: [] };
    if (kind === 'pine') {
      const trunk = new THREE.CylinderGeometry(0.26, 0.42, 3.4, 6);
      trunk.translate(0, 1.7, 0);
      parts.trunk.push(trunk);
      const tiers = [
        [2.5, 4.2, 4.2],
        [1.9, 3.6, 6.5],
        [1.2, 3.0, 8.5],
      ];
      for (const [r, h, y] of tiers) {
        const cone = new THREE.ConeGeometry(r, h, 9, 1);
        cone.translate(0, y, 0);
        parts.leaf.push(cone);
      }
    } else {
      const trunk = new THREE.CylinderGeometry(0.3, 0.5, 4.2, 6);
      trunk.translate(0, 2.1, 0);
      parts.trunk.push(trunk);
      const blobs = [
        [2.6, 3.6, 6.4, 0],
        [2.0, 2.8, 7.6, 1.5],
        [1.7, 2.4, 8.4, -1.4],
      ];
      for (const [r, h, y, off] of blobs) {
        const blob = new THREE.IcosahedronGeometry(1, 1);
        blob.scale(r, h, r);
        blob.translate(off * 0.6, y, 0);
        parts.leaf.push(blob);
      }
    }
    const trunkGeo = mergeGeometries(parts.trunk, false);
    const leafGeo = mergeGeometries(parts.leaf, false);
    return { trunkGeo, leafGeo };
  }

  addTreeInstances(kind, points, scaleRange, colors) {
    if (!points.length) return;
    const { trunkGeo, leafGeo } = this.treeGeometries(kind);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3625, roughness: 0.96, metalness: 0 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, points.length);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, points.length);
    trunks.castShadow = true;
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const col = new THREE.Color();
    const from = new THREE.Color(colors[0]);
    const to = new THREE.Color(colors[1]);
    const rng = mulberry32(kind === 'pine' ? 91 : 57);
    for (let i = 0; i < points.length; i++) {
      const [x, z] = points[i];
      const s = scaleRange[0] + rng() * (scaleRange[1] - scaleRange[0]);
      q.setFromAxisAngle(up, rng() * TAU);
      v.set(x, 0, z);
      sc.set(s * (0.9 + rng() * 0.2), s, s * (0.9 + rng() * 0.2));
      m.compose(v, q, sc);
      trunks.setMatrixAt(i, m);
      leaves.setMatrixAt(i, m);
      col.copy(from).lerp(to, rng());
      leaves.setColorAt(i, col);
    }
    trunks.instanceMatrix.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    this.group.add(trunks, leaves);
  }

  buildForest() {
    const pines = this.scatter(760, 20, 620, 11);
    this.addTreeInstances('pine', pines, [0.85, 1.7], [0x27401f, 0x4a6334]);
    const broad = this.scatter(240, 16, 320, 13);
    this.addTreeInstances('broad', broad, [0.8, 1.45], [0x36552c, 0x557c3c]);

    const bush = [];
    const rock = [];
    for (const [x, z] of this.scatter(420, 12, 260, 9)) {
      const r = 0.6 + this.rng() * 1.5;
      const g = new THREE.IcosahedronGeometry(r, 0);
      g.scale(1.25, 0.75, 1.25);
      g.translate(x, r * 0.5, z);
      bush.push(tint(g, this.rng() > 0.5 ? 0x40552c : 0x4e6234));
    }
    for (const [x, z] of this.scatter(90, 14, 220, 8)) {
      const r = 0.35 + this.rng() * 1.1;
      const g = new THREE.DodecahedronGeometry(r, 0);
      g.scale(1, 0.65, 1.15);
      g.translate(x, r * 0.42, z);
      rock.push(tint(g, 0x6a6459));
    }
    this.mergeInto(bush, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    this.mergeInto(rock, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  }

  // ---------------------------------------------------------------- valley

  buildValley() {
    const rng = this.rng;
    const hills = [];
    const count = 15;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + rng() * 0.22;
      const r = 210 + rng() * 330;
      const x = this.center.x + Math.cos(a) * r;
      const z = this.center.z + Math.sin(a) * r;
      if (!this.clearOfRoad(x, z, 46)) continue;
      const geo = new THREE.SphereGeometry(1, 20, 12, 0, TAU, 0, Math.PI / 2);
      const pos = geo.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const px = pos.getX(k), py = pos.getY(k), pz = pos.getZ(k);
        const n = 1 + Math.sin(px * 5.1 + i) * 0.12 + Math.cos(pz * 4.3 - i) * 0.1;
        pos.setXYZ(k, px * n, py * n, pz * n);
      }
      geo.computeVertexNormals();
      const rx = 70 + rng() * 110;
      const ry = 26 + rng() * 60;
      geo.scale(rx, ry, rx * (0.7 + rng() * 0.5));
      geo.translate(x, -1.5, z);
      const colors = new Float32Array(pos.count * 3);
      const grass = new THREE.Color(0x8d7c4f);
      const rock = new THREE.Color(0x8a7460);
      const top = new THREE.Color(0xb19a7b);
      for (let k = 0; k < pos.count; k++) {
        const h = Math.min(1, Math.max(0, (pos.getY(k) + 1.5) / ry));
        const c = grass.clone().lerp(rock, Math.min(1, h * 1.35));
        c.lerp(top, Math.pow(h, 3) * 0.6);
        colors[k * 3] = c.r; colors[k * 3 + 1] = c.g; colors[k * 3 + 2] = c.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      hills.push(geo);
    }
    this.mergeInto(hills, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97 }));

    const rocks = [];
    for (const [x, z] of this.scatter(120, 40, 240, 7)) {
      const r = 1.2 + rng() * 5;
      const g = new THREE.DodecahedronGeometry(r, 0);
      g.scale(1 + rng() * 0.6, 0.7 + rng() * 0.5, 1 + rng() * 0.4);
      g.rotateY(rng() * TAU);
      g.translate(x, r * 0.35, z);
      rocks.push(tint(g, rng() > 0.5 ? 0x8d7a63 : 0x7b6a56));
    }
    this.mergeInto(rocks, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94 }));

    const pines = this.scatter(190, 30, 420, 11);
    this.addTreeInstances('pine', pines, [0.7, 1.35], [0x3c4a2a, 0x5d6b3a]);
  }

  // ---------------------------------------------------------------- coast

  buildCoast() {
    const rng = this.rng;
    // 宽一点的沙滩带
    const verts = [];
    const uvs = [];
    const idx = [];
    let vi = 0;
    for (let x = -2600; x <= 2600; x += 40) {
      const z = COAST(x);
      verts.push(x, 0.008, z - 62, x, 0.004, z + 8);
      uvs.push(x * 0.01, 0, x * 0.01, 1);
      if (x < 2600) idx.push(vi, vi + 2, vi + 1, vi + 1, vi + 2, vi + 3);
      vi += 2;
    }
    const sandGeo = new THREE.BufferGeometry();
    sandGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    sandGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    sandGeo.setIndex(idx);
    sandGeo.computeVertexNormals();
    const sand = new THREE.Mesh(sandGeo, new THREE.MeshStandardMaterial({ color: 0xcbb28c, roughness: 0.96 }));
    sand.receiveShadow = true;
    this.group.add(sand);

    const dunes = [];
    for (let i = 0; i < 44; i++) {
      const x = this.center.x - 900 + rng() * 1800;
      const z = COAST(x) - 58 + rng() * 36;
      if (!this.clearOfRoad(x, z, 14)) continue;
      const r = 12 + rng() * 22;
      const g = new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, Math.PI / 2);
      g.scale(r, 1.5 + rng() * 1.5, r * (0.6 + rng() * 0.5));
      g.translate(x, 0, z);
      dunes.push(tint(g, rng() > 0.5 ? 0xb0956c : 0xa78a63));
    }
    this.mergeInto(dunes, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97 }), { castShadow: false });

    // 沙丘草：让海边到赛道之间不至于是一片空地
    const tufts = [];
    for (const [x, z] of this.scatter(700, 22, 320, 8)) {
      const h = 0.32 + rng() * 0.55;
      for (let k = 0; k < 4; k++) {
        const blade = new THREE.ConeGeometry(0.1, h, 3);
        blade.rotateZ((rng() - 0.5) * 0.8);
        blade.translate(x + (rng() - 0.5) * 0.8, h / 2, z + (rng() - 0.5) * 0.8);
        tufts.push(tint(blade, rng() > 0.5 ? 0x6f7d42 : 0x808d4c));
      }
    }
    this.mergeInto(tufts, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), { castShadow: false });

    // 低矮的海岸灌木
    const shrubs = [];
    for (const [x, z] of this.scatter(340, 26, 340, 8)) {
      const r = 0.7 + rng() * 1.4;
      const g = new THREE.IcosahedronGeometry(r, 0);
      g.scale(1.3, 0.7, 1.2);
      g.translate(x, r * 0.45, z);
      shrubs.push(tint(g, rng() > 0.5 ? 0x5f6b3c : 0x6d7048));
    }
    this.mergeInto(shrubs, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), { castShadow: false });

    const poles = [];
    const shades = [];
    const loungers = [];
    const umbrellaCols = [0xe0562f, 0x2d7f8a, 0xf2c14e, 0xd9d2c0];
    let placed = 0;
    for (let i = 0; i < 150 && placed < 30; i++) {
      const x = this.center.x - 700 + rng() * 1400;
      const z = COAST(x) - 52 + rng() * 34;
      if (!this.clearOfRoad(x, z, 15)) continue;
      placed++;
      const yaw = rng() * TAU;
      const pole = new THREE.CylinderGeometry(0.075, 0.09, 2.5, 6);
      pole.translate(x, 1.25, z);
      poles.push(pole);
      const canopy = new THREE.ConeGeometry(2.1, 0.75, 8, 1, true);
      const base = new THREE.Color(umbrellaCols[placed % umbrellaCols.length]);
      const cream = new THREE.Color(0xf3ead8);
      const colors = new Float32Array(canopy.attributes.position.count * 3);
      for (let k = 0; k < canopy.attributes.position.count; k++) {
        const px = canopy.attributes.position.getX(k);
        const pz = canopy.attributes.position.getZ(k);
        const band = Math.floor(((Math.atan2(pz, px) + Math.PI) / TAU) * 8) % 2;
        const cc = band ? base : cream;
        colors[k * 3] = cc.r; colors[k * 3 + 1] = cc.g; colors[k * 3 + 2] = cc.b;
      }
      canopy.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      canopy.translate(x, 2.55, z);
      shades.push(canopy);
      for (let k = 0; k < 2; k++) {
        const ox = Math.cos(yaw + k * 1.4) * 2.4;
        const oz = Math.sin(yaw + k * 1.4) * 2.4;
        const seat = new THREE.BoxGeometry(1.9, 0.12, 0.62);
        seat.translate(x + ox, 0.42, z + oz);
        loungers.push(tint(seat, 0xe6dcc8));
        const back = new THREE.BoxGeometry(0.62, 0.55, 0.1);
        back.rotateX(-0.5);
        back.translate(x + ox - 0.9, 0.62, z + oz);
        loungers.push(tint(back, 0xd8cdb6));
      }
    }
    this.mergeInto(poles, new THREE.MeshStandardMaterial({ color: 0xd9d2c4, roughness: 0.6, metalness: 0.3 }));
    this.mergeInto(shades, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }));
    this.mergeInto(loungers, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));

    // 救生员塔
    const huts = [];
    for (let i = 0; i < 3; i++) {
      const x = this.center.x - 320 + i * 330 + rng() * 60;
      const z = COAST(x) - 44 + rng() * 16;
      if (!this.clearOfRoad(x, z, 22)) continue;
      const legH = 2.2;
      for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
        const leg = new THREE.BoxGeometry(0.16, legH, 0.16);
        leg.translate(x + dx, legH / 2, z + dz);
        huts.push(tint(leg, 0xb9a179));
      }
      const cabin = new THREE.BoxGeometry(3.4, 1.9, 3.4);
      cabin.translate(x, legH + 0.95, z);
      huts.push(tint(cabin, 0xf0e7d6));
      const roof = new THREE.ConeGeometry(3.1, 1.1, 4);
      roof.rotateY(Math.PI / 4);
      roof.translate(x, legH + 2.45, z);
      huts.push(tint(roof, 0xd9543a));
    }
    this.mergeInto(huts, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }));

    // 海面上的浮标与帆船
    const buoys = [];
    for (let i = 0; i < 9; i++) {
      const x = this.center.x - 420 + i * 105;
      const z = COAST(x) + 26 + rng() * 40;
      const g = new THREE.SphereGeometry(0.9, 8, 6);
      g.translate(x, 0.2, z);
      buoys.push(tint(g, i % 2 ? 0xe0562f : 0xf2c14e));
    }
    this.mergeInto(buoys, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), { castShadow: false });

    const sails = [];
    for (let i = 0; i < 5; i++) {
      const x = this.center.x - 900 + i * 460 + rng() * 120;
      const z = COAST(x) + 150 + rng() * 260;
      const hull = new THREE.BoxGeometry(11, 1.1, 3.4);
      hull.translate(x, 0.3, z);
      sails.push(tint(hull, 0xf1ece0));
      const mast = new THREE.CylinderGeometry(0.12, 0.14, 13, 5);
      mast.translate(x, 6.8, z);
      sails.push(tint(mast, 0xd8d2c4));
      const sail = new THREE.BufferGeometry();
      const p = new Float32Array([x + 0.4, 7.4, z, x + 0.4, 12.6, z, x + 5.6, 7.4, z]);
      sail.setAttribute('position', new THREE.BufferAttribute(p, 3));
      sail.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 0], 2));
      sail.setIndex([0, 1, 2]);
      sail.computeVertexNormals();
      sails.push(tint(sail, 0xf6f1e4));
    }
    this.mergeInto(sails, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }), { castShadow: false });
  }

  // ---------------------------------------------------------------- market

  buildMarket() {
    const rng = this.rng;
    const counter = [];
    const awning = [];
    const glow = [];
    const pools = [];

    // 摊位局部坐标：+Z 沿赛道方向，+X 指向赛道外侧
    const stall = (pose, side, index) => {
      const p = pose.position.clone().addScaledVector(pose.right, side * (this.barrier + 9.5));
      const yaw = Math.atan2(pose.tangent.x, pose.tangent.z);
      const m = new THREE.Matrix4().makeRotationY(yaw);
      m.setPosition(p.x, 0, p.z);
      const add = (geo, color) => {
        geo.applyMatrix4(m);
        tint(geo, color);
        return geo;
      };
      counter.push(add(new THREE.BoxGeometry(1.5, 1.0, 4.2).translate(0, 0.5, 0), 0x5b4030));
      counter.push(add(new THREE.BoxGeometry(1.9, 0.12, 4.5).translate(0, 1.06, 0), 0x8a6a4a));
      for (const dz of [-1.9, 1.9]) {
        counter.push(add(new THREE.BoxGeometry(0.14, 2.5, 0.14).translate(-1.1, 1.25, dz), 0x4a4038));
      }
      const roof = new THREE.BoxGeometry(2.7, 0.14, 4.9);
      roof.rotateZ(-0.16);
      awning.push(add(roof.translate(-0.25, 2.62, 0), index % 3 === 0 ? 0xd9543a : index % 3 === 1 ? 0xe8a33a : 0x2f7f74));
      for (let k = 0; k < 3; k++) {
        const bw = 0.5 + rng() * 0.4;
        const box = new THREE.BoxGeometry(bw, bw, bw);
        box.translate(0.55, 0.25 + (k === 2 ? 0.6 : 0), -1.6 + k * 1.6 + rng() * 0.3);
        counter.push(add(box, k === 1 ? 0x9c7b4f : 0x7d6142));
      }
      for (const dz of [-1.6, 1.6]) {
        const lantern = new THREE.SphereGeometry(0.26, 8, 6);
        lantern.scale(1, 1.15, 1);
        glow.push(add(lantern.translate(-1.2, 2.28, dz), 0xff8a3c));
        counter.push(add(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 6).translate(-1.2, 2.56, dz), 0x2b2119));
      }
      const pool = new THREE.PlaneGeometry(9, 8);
      pool.rotateX(-Math.PI / 2);
      pool.translate(p.x, 0.06, p.z);
      pools.push(pool);
    };

    let index = 0;
    for (let d = 20; d < this.track.totalLength - 20; d += 34) {
      const pose = this.track.getPoseAt(d);
      if (this.nearStart(pose.position.x, pose.position.z, 62, 60)) continue;
      const side = index % 2 === 0 ? 1 : -1;
      stall(pose, side, index);
      if (index % 3 === 0) {
        const opposite = this.track.getPoseAt((d + 17) % this.track.totalLength);
        stall(opposite, -side, index + 1);
      }
      index++;
    }

    // 灯笼的光要「落在」摊位上：给木头和雨棚一点自发光，夜景才读得出来
    this.mergeInto(counter, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.86, emissive: 0x271408, emissiveIntensity: 0.55,
    }));
    this.mergeInto(awning, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.8, side: THREE.DoubleSide,
      emissive: 0x53230c, emissiveIntensity: 0.5,
    }));
    this.mergeInto(glow, new THREE.MeshStandardMaterial({
      vertexColors: true, emissive: 0xff9a4a, emissiveIntensity: 2.4, roughness: 0.5,
    }), { castShadow: false });
    const poolTex = canvasTexture(radialTexture(128, 'rgba(255,170,90,0.55)', 'rgba(255,110,40,0)'), { anisotropy: 4 });
    this.mergeInto(pools, new THREE.MeshBasicMaterial({
      map: poolTex, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    }), { castShadow: false, receiveShadow: false });

    this.buildLightStrings();
  }

  /** 夜市：横跨赛道的灯串。 */
  buildLightStrings() {
    const wire = [];
    const bulbs = [];
    const poles = [];
    const pools = [];
    const stride = 74;
    let n = 0;
    for (let d = 40; d < this.track.totalLength - 40; d += stride) {
      const pose = this.track.getPoseAt(d);
      if (this.nearStart(pose.position.x, pose.position.z, 70, 60)) continue;
      n++;
      const left = pose.position.clone().addScaledVector(pose.right, -(this.barrier + 5.4));
      const right = pose.position.clone().addScaledVector(pose.right, this.barrier + 5.4);
      const top = 7.2;
      for (const p of [left, right]) {
        const poleGeo = new THREE.CylinderGeometry(0.08, 0.11, top, 6);
        poleGeo.translate(p.x, top / 2, p.z);
        poles.push(poleGeo);
      }
      const segments = 12;
      const sag = 1.5;
      let prev = left.clone().setY(top);
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const p = left.clone().lerp(right, t);
        p.y = top - Math.sin(t * Math.PI) * sag;
        const len = prev.distanceTo(p);
        const seg = new THREE.CylinderGeometry(0.03, 0.03, len, 4);
        const dir = p.clone().sub(prev).normalize();
        seg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
        const mid = prev.clone().add(p).multiplyScalar(0.5);
        seg.translate(mid.x, mid.y, mid.z);
        wire.push(seg);
        prev = p;
      }
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const p = left.clone().lerp(right, t);
        p.y = top - Math.sin(t * Math.PI) * sag - 0.18;
        bulbs.push(new THREE.SphereGeometry(0.13, 6, 4).translate(p.x, p.y, p.z));
      }
      if (n % 2 === 0) {
        const pool = new THREE.PlaneGeometry(16, 10);
        pool.rotateX(-Math.PI / 2);
        pool.translate(pose.position.x, 0.065, pose.position.z);
        pools.push(pool);
      }
    }
    this.mergeInto(wire, new THREE.MeshStandardMaterial({ color: 0x241d16, roughness: 0.7, metalness: 0.3 }), { castShadow: false });
    this.mergeInto(poles, new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.6, metalness: 0.4 }));
    this.mergeInto(bulbs, new THREE.MeshStandardMaterial({
      color: 0xfff0c8, emissive: 0xffd08a, emissiveIntensity: 3.0, roughness: 0.4,
    }), { castShadow: false });
    const poolTex = canvasTexture(radialTexture(128, 'rgba(255,190,120,0.4)', 'rgba(255,120,40,0)'), { anisotropy: 4 });
    this.mergeInto(pools, new THREE.MeshBasicMaterial({
      map: poolTex, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    }), { castShadow: false, receiveShadow: false });
  }

  // ---------------------------------------------------------------- port

  buildPort() {
    const rng = this.rng;
    const palette = [0xc75b3a, 0x2f6f8f, 0xd8b33c, 0x4a7a52, 0x8f5b35, 0xb9b2a4];
    const containers = [];
    const clusters = 7;
    for (let c = 0; c < clusters; c++) {
      const a = (c / clusters) * TAU + 0.3;
      const r = 130 + rng() * 190;
      const cx = this.center.x + Math.cos(a) * r;
      const cz = this.center.z + Math.sin(a) * r;
      if (!this.clearOfRoad(cx, cz, 42)) continue;
      const yaw = rng() * TAU;
      const cols = 3 + Math.floor(rng() * 3);
      const rows = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const stack = 1 + Math.floor(rng() * 3);
          for (let k = 0; k < stack; k++) {
            const ox = (i - cols / 2) * 13.2;
            const oz = (j - rows / 2) * 2.9;
            const px = cx + Math.cos(yaw) * ox - Math.sin(yaw) * oz;
            const pz = cz + Math.sin(yaw) * ox + Math.cos(yaw) * oz;
            if (!this.clearOfRoad(px, pz, 6)) continue;
            const geo = new THREE.BoxGeometry(12.2, 2.6, 2.45);
            geo.rotateY(yaw);
            geo.translate(px, 1.3 + k * 2.62, pz);
            containers.push(tint(geo, palette[Math.floor(rng() * palette.length)]));
          }
        }
      }
    }
    this.mergeInto(containers, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.15 }));

    // 龙门吊
    const craneGeos = [];
    const craneSpots = [
      [this.center.x - 210, this.center.z + 150],
      [this.center.x + 240, this.center.z - 170],
    ];
    for (const [x, z] of craneSpots) {
      if (!this.clearOfRoad(x, z, 46)) continue;
      const yaw = Math.atan2(this.center.z - z, this.center.x - x);
      const m = new THREE.Matrix4().makeRotationY(yaw);
      m.setPosition(x, 0, z);
      const add = (geo, color) => {
        geo.applyMatrix4(m);
        tint(geo, color);
        craneGeos.push(geo);
      };
      const span = 26, height = 30;
      for (const dz of [-6, 6]) {
        for (const dx of [-span / 2, span / 2]) {
          add(new THREE.BoxGeometry(1.5, height, 1.5).translate(dx, height / 2, dz), 0x9aa2a2);
        }
      }
      add(new THREE.BoxGeometry(span + 6, 1.8, 1.8).translate(0, height, -6), 0xd8a03a);
      add(new THREE.BoxGeometry(span + 6, 1.8, 1.8).translate(0, height, 6), 0xd8a03a);
      add(new THREE.BoxGeometry(span + 6, 0.8, 13.5).translate(0, height + 1.2, 0), 0xb8bdbd);
      add(new THREE.BoxGeometry(3.2, 5.5, 3.4).translate(0, height - 3.4, 0), 0xe0d8c4);
    }
    this.mergeInto(craneGeos, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.45 }), { castShadow: false });

    // 高杆灯
    const masts = [];
    const heads = [];
    const mastSpots = [
      [this.center.x - 160, this.center.z - 120],
      [this.center.x + 180, this.center.z + 120],
      [this.center.x - 40, this.center.z + 210],
    ];
    for (const [x, z] of mastSpots) {
      if (!this.clearOfRoad(x, z, 22)) continue;
      const h = 26;
      const mast = new THREE.CylinderGeometry(0.22, 0.34, h, 6);
      mast.translate(x, h / 2, z);
      masts.push(tint(mast, 0x55595a));
      for (let i = 0; i < 4; i++) {
        const head = new THREE.BoxGeometry(2.2, 0.5, 0.9);
        head.rotateY((i / 4) * TAU);
        head.translate(x, h, z);
        heads.push(tint(head, 0xfff0c8));
      }
    }
    this.mergeInto(masts, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.5 }));
    this.mergeInto(heads, new THREE.MeshStandardMaterial({
      vertexColors: true, emissive: 0xfff1d4, emissiveIntensity: 1.6, roughness: 0.5,
    }), { castShadow: false });
  }
}
