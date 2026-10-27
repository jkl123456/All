import * as THREE from 'three';
import {
  TRACK, TRACK_POINTS, START_OFFSETS,
} from './config.js';
import { canvasTexture, clamp, makeCanvas, mulberry32, nearestOnPolyline, roundRect } from './utils.js';

const UP = new THREE.Vector3(0, 1, 0);

function gantrySignTexture() {
  const c = makeCanvas(1536, 320);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#14120f';
  ctx.fillRect(0, 0, 1536, 320);
  ctx.fillStyle = '#ff5a1f';
  ctx.fillRect(0, 0, 1536, 14);
  // checker edges
  const cell = 20;
  for (let x = 0; x < 1536; x += cell) {
    for (let y = 0; y < 40; y += cell) {
      if (((x / cell) + (y / cell)) % 2 === 0) {
        ctx.fillStyle = '#e8e0d2';
        ctx.fillRect(x, y, cell, cell);
      }
    }
  }
  ctx.font = '800 128px "Barlow Condensed", sans-serif';
  ctx.fillStyle = '#f2eadd';
  ctx.fillText('APEX CITY', 52, 178);
  ctx.fillStyle = '#ff5a1f';
  ctx.fillRect(668, 74, 8, 112);
  ctx.font = '600 28px "Manrope", sans-serif';
  ctx.fillStyle = '#d8c9b4';
  ctx.fillText('APEX CITY CIRCUIT', 704, 118);
  ctx.fillStyle = '#8e8272';
  ctx.font = '600 19px "Manrope", sans-serif';
  ctx.fillText('ROUND 02  ·  OFFICIAL DEMO', 704, 154);
  ctx.fillStyle = '#ff5a1f';
  ctx.fillRect(704, 170, 248, 3);
  ctx.font = '800 62px "Barlow Condensed", sans-serif';
  ctx.fillStyle = '#f2eadd';
  ctx.fillText('START / FINISH', 1210, 172);
  ctx.font = '600 16px "Manrope", sans-serif';
  ctx.fillStyle = '#978a79';
  ctx.fillText('18:42  ·  DRY  ·  23°C', 1213, 205);
  // vertical footer
  ctx.font = '600 15px "Manrope", sans-serif';
  ctx.fillStyle = 'rgba(242,234,221,0.28)';
  ctx.fillText('OFFICIAL DEMO 02 / APEX CITY', 52, 292);
  ctx.fillStyle = '#ff5a1f';
  for (let i = 0; i < 5; i++) ctx.fillRect(1170 + i * 40, 262, 28, 5);
  return canvasTexture(c, { anisotropy: 8 });
}

function grandstandTexture() {
  const c = makeCanvas(1024, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#262420'; ctx.fillRect(0, 0, 1024, 256);
  // crowd
  const rng = mulberry32(312);
  const pal = ['#d8c7ad', '#b29a78', '#7a4c39', '#2d5c57', '#b34a2e', '#e0a13e', '#48566f'];
  for (let row = 0; row < 7; row++) {
    for (let i = 0; i < 76; i++) {
      const x = 8 + i * 13 + rng() * 4;
      const y = 30 + row * 31 + rng() * 8;
      ctx.fillStyle = pal[Math.floor(rng() * pal.length)];
      ctx.fillRect(x, y, 4 + rng() * 3, 8 + rng() * 6);
      ctx.beginPath(); ctx.arc(x + 2, y - 3, 3.2, 0, Math.PI * 2); ctx.fill();
    }
  }
  // safety rail and concrete tiers
  for (let row = 0; row < 8; row++) {
    ctx.fillStyle = 'rgba(248,236,218,0.08)'; ctx.fillRect(0, 20 + row * 31, 1024, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 26 + row * 31, 1024, 5);
  }
  // orange accent stripe
  ctx.fillStyle = 'rgba(255,90,31,0.45)';
  ctx.fillRect(0, 5, 1024, 7);
  return canvasTexture(c, { anisotropy: 8 });
}

export class Track {
  constructor(textures, scene) {
    this.textures = textures;
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'Apex City Circuit';
    scene.add(this.group);
    this.samples = [];
    this.totalLength = 0;
    this.n = 1600;
    this.width = TRACK.width;
    this.barrierOffset = TRACK.barrierOffset;
    this.startLights = [];
    this.startLightState = 'off';
    this.buildSamples();
    this.buildRoad();
    this.buildBarriers();
    this.buildStartComplex();
    this.buildBillboards();
    this.buildMinimapData();
  }

  buildSamples() {
    const curve = new THREE.CatmullRomCurve3(TRACK_POINTS, true, 'centripetal', 0.45);
    this.curve = curve;
    const raw = curve.getSpacedPoints(this.n);
    raw.pop();
    // Rotate the sample array so index 0 is the start/finish line.
    let startIdx = 0, best = Infinity;
    for (let i = 0; i < raw.length; i++) {
      const d = raw[i].distanceToSquared(TRACK.startPoint);
      if (d < best) { best = d; startIdx = i; }
    }
    const n = raw.length;
    const rotated = [];
    for (let i = 0; i < n; i++) rotated.push(raw[(i + startIdx) % n]);

    const dists = [0];
    for (let i = 1; i < n; i++) dists[i] = dists[i - 1] + rotated[i].distanceTo(rotated[i - 1]);
    const total = dists[n - 1] + rotated[0].distanceTo(rotated[n - 1]);

    const tangents = [];
    const rights = [];
    for (let i = 0; i < n; i++) {
      const a = rotated[(i - 1 + n) % n];
      const b = rotated[(i + 1) % n];
      const t = new THREE.Vector3().subVectors(b, a).normalize();
      tangents.push(t);
      rights.push(new THREE.Vector3(t.z, 0, -t.x).normalize());
    }

    const curv = [];
    for (let i = 0; i < n; i++) {
      const t0 = tangents[(i - 1 + n) % n];
      const t1 = tangents[(i + 1) % n];
      const cross = t0.x * t1.z - t0.z * t1.x;
      const dot = clamp(t0.dot(t1), -1, 1);
      const angle = Math.acos(dot);
      const seg = (total / n) * 2;
      curv.push((cross >= 0 ? -1 : 1) * angle / seg);
    }
    // smooth curvature for AI / curbs
    const smooth = [];
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let k = -4; k <= 4; k++) sum += curv[(i + k + n) % n];
      smooth.push(sum / 9);
    }

    this.samples = rotated.map((p, i) => ({
      position: p.clone(),
      tangent: tangents[i],
      right: rights[i],
      distance: i === 0 ? 0 : dists[i],
      curvature: smooth[i],
      yaw: Math.atan2(tangents[i].x, tangents[i].z),
    }));
    this.totalLength = total;
    this.startSample = this.samples[0];

    // quantize start offsets to distances that are less than total.
    this.grid = START_OFFSETS.map((off, i) => {
      const d = (off + total) % total;
      return { distance: d, offset: i % 2 === 0 ? -2.25 : 2.25, index: i };
    });
  }

  getSample(index) {
    const n = this.samples.length;
    return this.samples[((index % n) + n) % n];
  }

  wrapDistance(d) {
    return ((d % this.totalLength) + this.totalLength) % this.totalLength;
  }

  getPoseAt(distance) {
    const n = this.samples.length;
    const wrapped = this.wrapDistance(distance);
    const step = this.totalLength / n;
    const fi = wrapped / step;
    const i0 = Math.floor(fi) % n;
    const i1 = (i0 + 1) % n;
    const f = fi - Math.floor(fi);
    const a = this.samples[i0], b = this.samples[i1];
    const position = a.position.clone().lerp(b.position, f);
    const tangent = a.tangent.clone().lerp(b.tangent, f).normalize();
    const right = new THREE.Vector3(tangent.z, 0, -tangent.x);
    return {
      position, tangent, right,
      yaw: Math.atan2(tangent.x, tangent.z),
      index: i0, curvature: THREE.MathUtils.lerp(a.curvature, b.curvature, f),
    };
  }

  placeOnTrack(distance, lateral, y = 0) {
    const pose = this.getPoseAt(distance);
    pose.position.addScaledVector(pose.right, lateral);
    pose.position.y = y;
    return pose;
  }

  nearest(x, z, hint = -1, windowSize = 55) {
    const n = this.samples.length;
    let best = Infinity, bestI = 0;
    if (hint >= 0) {
      for (let k = -windowSize; k <= windowSize; k++) {
        const i = (hint + k + n) % n;
        const p = this.samples[i].position;
        const dx = p.x - x, dz = p.z - z;
        const d = dx * dx + dz * dz;
        if (d < best) { best = d; bestI = i; }
      }
    } else {
      for (let i = 0; i < n; i++) {
        const p = this.samples[i].position;
        const dx = p.x - x, dz = p.z - z;
        const d = dx * dx + dz * dz;
        if (d < best) { best = d; bestI = i; }
      }
    }
    const s = this.samples[bestI];
    const dx = x - s.position.x;
    const dz = z - s.position.z;
    const lateral = dx * s.right.x + dz * s.right.z;
    return { index: bestI, distanceSq: best, lateral, sample: s, distance: s.distance };
  }

  getSurfaceInfo(x, z, hint = -1) {
    const near = this.nearest(x, z, hint);
    return {
      ...near,
      onRoad: Math.abs(near.lateral) < TRACK.width / 2,
      onKerb: Math.abs(near.lateral) >= TRACK.width / 2 - 0.5 && Math.abs(near.lateral) < TRACK.width / 2 + 0.8,
      isBarrier: Math.abs(near.lateral) > 9.2,
    };
  }

  distanceToCenterline(x, z) {
    let best = Infinity;
    for (let i = 0; i < this.samples.length; i += 2) {
      const p = this.samples[i].position;
      const dx = p.x - x, dz = p.z - z;
      const d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  ribbon(offsetA, offsetB, y, vScale = 16, step = 1) {
    const n = this.samples.length;
    const pos = [], uv = [], idx = [];
    let v = 0;
    let row = 0;
    for (let i = 0; i <= n; i += step) {
      const s = this.samples[i % n];
      const next = this.samples[(i + step) % n];
      const a = s.position.clone().addScaledVector(s.right, offsetA);
      const b = s.position.clone().addScaledVector(s.right, offsetB);
      pos.push(a.x, y, a.z, b.x, y, b.z);
      const segLen = step ? (next.distance - s.distance + this.totalLength) % this.totalLength : 0;
      uv.push(0, v, 1, v);
      if (i < n) {
        const j = row * 2;
        idx.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
      }
      v += (segLen > 0 ? segLen : 2) / vScale;
      row++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  buildRoad() {
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0xd0cdc5,
      map: this.textures.asphalt,
      roughness: 0.9,
      metalness: 0.0,
      envMapIntensity: 0.18,
    });
    // The colour map already carries the tarmac tone.
    roadMat.color.setHex(0xbcb8b0);
    const road = new THREE.Mesh(this.ribbon(-TRACK.width / 2, TRACK.width / 2, 0.015, 28), roadMat);
    road.receiveShadow = true;
    road.name = 'asphalt';
    this.group.add(road);
    this.road = road;

    // shoulder / run-off strips
    const shoulderMat = new THREE.MeshStandardMaterial({
      color: 0x70675c, map: this.textures.concrete, roughness: 0.92, metalness: 0,
    });
    for (const side of [-1, 1]) {
      const a = side * (TRACK.width / 2 + 0.05);
      const b = side * (TRACK.width / 2 + 2.2);
      const mesh = new THREE.Mesh(this.ribbon(a, b, 0.005, 12), shoulderMat);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }

    const lineMat = new THREE.MeshStandardMaterial({ color: 0xe9e2d2, roughness: 0.62, metalness: 0.02 });
    for (const side of [-1, 1]) {
      const edge = side * (TRACK.width / 2 - 0.23);
      const line = new THREE.Mesh(this.ribbon(edge - 0.095, edge + 0.095, 0.055, 20), lineMat);
      line.receiveShadow = true;
      this.group.add(line);
    }
    // subtle centre seam
    const seamMat = new THREE.MeshStandardMaterial({ color: 0x777168, roughness: 0.9 });
    const seam = new THREE.Mesh(this.ribbon(-0.035, 0.035, 0.028, 22), seamMat);
    this.group.add(seam);

    this.buildCurbs();

    // concrete apron beyond the barriers
    const apronMat = new THREE.MeshStandardMaterial({ color: 0x9e9384, map: this.textures.concrete, roughness: 0.94 });
    for (const side of [-1, 1]) {
      const a = side * (TRACK.width / 2 + 2.1);
      const b = side * (TRACK.width / 2 + 8.5);
      const apron = new THREE.Mesh(this.ribbon(a, b, -0.02, 10), apronMat);
      apron.receiveShadow = true;
      this.group.add(apron);
    }
  }

  buildCurbs() {
    const redMat = new THREE.MeshStandardMaterial({ color: 0xb42a21, roughness: 0.7 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.65 });
    const geo = new THREE.BoxGeometry(0.9, 0.08, 2.15);
    const redList = [], whiteList = [];
    const step = Math.max(1, Math.round(2.3 / (this.totalLength / this.samples.length)));
    for (let i = 0; i < this.samples.length; i += step) {
      const s = this.samples[i];
      if (Math.abs(s.curvature) < 0.0042) continue;
      const phase = Math.floor(i / step) % 2;
      for (const sd of [-1, 1]) {
        const pos = s.position.clone().addScaledVector(s.right, sd * (TRACK.width / 2 - 0.42));
        const m = new THREE.Object3D();
        m.position.copy(pos);
        m.position.y = 0.06;
        m.rotation.y = s.yaw;
        m.updateMatrix();
        (phase === 0 ? redList : whiteList).push(m.matrix.clone());
      }
    }
    const make = (mats, material) => {
      if (!mats.length) return null;
      const inst = new THREE.InstancedMesh(geo, material, mats.length);
      mats.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.instanceMatrix.needsUpdate = true;
      inst.receiveShadow = true;
      this.group.add(inst);
      return inst;
    };
    make(redList, redMat);
    make(whiteList, whiteMat);
  }

  buildBarriers() {
    const avgStep = this.totalLength / this.samples.length;
    const stepIdx = Math.max(1, Math.round(2.45 / avgStep));
    const count = Math.floor(this.samples.length / stepIdx);
    const blockGeo = new THREE.BoxGeometry(0.42, 0.85, 2.38);
    const blockMat = new THREE.MeshStandardMaterial({ color: 0xd5cabb, roughness: 0.82, metalness: 0.02 });
    const railGeo = new THREE.BoxGeometry(0.12, 0.1, 2.4);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x5d6163, roughness: 0.4, metalness: 0.7 });
    const concrete = new THREE.InstancedMesh(blockGeo, blockMat, count * 2);
    const rail = new THREE.InstancedMesh(railGeo, railMat, count * 2);
    const dummy = new THREE.Object3D();
    let n = 0;
    const bannerMatrices = [];
    const bannerGeo = new THREE.PlaneGeometry(6.1, 0.94);
    const bannerMat = new THREE.MeshStandardMaterial({
      map: this.textures.barrierBanner, roughness: 0.55, metalness: 0.08,
      side: THREE.DoubleSide,
    });
    for (const side of [-1, 1]) {
      for (let k = 0; k < count; k++) {
        const idx = (k * stepIdx) % this.samples.length;
        const s = this.samples[idx];
        const pos = s.position.clone().addScaledVector(s.right, side * TRACK.barrierOffset);
        dummy.position.set(pos.x, 0.43, pos.z);
        dummy.rotation.set(0, s.yaw, 0);
        dummy.updateMatrix();
        concrete.setMatrixAt(n, dummy.matrix);
        dummy.position.y = 0.9;
        dummy.updateMatrix();
        rail.setMatrixAt(n, dummy.matrix);
        if (k % 5 === 0) {
          const normal = s.right.clone().multiplyScalar(-side);
          const p = s.position.clone().addScaledVector(s.right, side * (TRACK.barrierOffset - 0.24));
          const obj = new THREE.Object3D();
          obj.position.set(p.x, 0.5, p.z);
          obj.rotation.y = Math.atan2(normal.x, normal.z);
          obj.updateMatrix();
          bannerMatrices.push(obj.matrix.clone());
        }
        n++;
      }
    }
    concrete.instanceMatrix.needsUpdate = true;
    concrete.castShadow = true;
    concrete.receiveShadow = true;
    rail.instanceMatrix.needsUpdate = true;
    rail.castShadow = true;
    this.group.add(concrete, rail);
    const banner = new THREE.InstancedMesh(bannerGeo, bannerMat, bannerMatrices.length);
    bannerMatrices.forEach((m, i) => banner.setMatrixAt(i, m));
    banner.instanceMatrix.needsUpdate = true;
    this.group.add(banner);

    // Tire stacks on the outside of the fastest corners.
    const tireGeo = new THREE.BoxGeometry(2.0, 0.9, 1.1);
    const tireMat = new THREE.MeshStandardMaterial({ map: this.textures.tireWall, roughness: 0.92 });
    const tireSpots = [];
    for (let i = 0; i < this.samples.length; i += 3) {
      const s = this.samples[i];
      if (Math.abs(s.curvature) > 0.011) {
        const side = s.curvature > 0 ? -1 : 1;
        const p = s.position.clone().addScaledVector(s.right, side * (TRACK.barrierOffset + 1.8));
        const obj = new THREE.Object3D();
        obj.position.set(p.x, 0.3, p.z);
        obj.rotation.y = s.yaw;
        obj.updateMatrix();
        tireSpots.push(obj.matrix.clone());
      }
    }
    if (tireSpots.length) {
      const tires = new THREE.InstancedMesh(tireGeo, tireMat, tireSpots.length);
      tireSpots.forEach((m, i) => tires.setMatrixAt(i, m));
      tires.instanceMatrix.needsUpdate = true;
      tires.castShadow = true;
      tires.receiveShadow = true;
      this.group.add(tires);
    }
  }

  buildStartComplex() {
    const start = this.samples[0];
    const group = new THREE.Group();
    group.position.copy(start.position);
    group.position.y = 0;
    group.rotation.y = start.yaw;
    this.group.add(group);
    this.startGroup = group;

    // start/finish checker band
    const lineTex = this.textures.checkered.clone();
    lineTex.repeat.set(9, 1.2);
    lineTex.needsUpdate = true;
    const lineMat = new THREE.MeshStandardMaterial({ map: lineTex, roughness: 0.72, metalness: 0.02 });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(TRACK.width, 2.4), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.07, 0.4);
    line.receiveShadow = true;
    group.add(line);

    // Starting grid slots
    const gridMat = new THREE.MeshBasicMaterial({ color: 0xd8d1c4, transparent: true, opacity: 0.5 });
    for (let i = 0; i < 6; i++) {
      const off = START_OFFSETS[i];
      for (const side of [-1, 1]) {
        const x = side * 2.2;
        const z = off;
        const front = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.12), gridMat);
        front.rotation.x = -Math.PI / 2;
        front.position.set(x, 0.06, z + 1.3);
        group.add(front);
        const left = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 1.8), gridMat);
        left.rotation.x = -Math.PI / 2;
        left.position.set(x - 1.55, 0.06, z + 0.45);
        group.add(left);
        const right = left.clone();
        right.position.x = x + 1.55;
        group.add(right);
      }
    }

    const steel = new THREE.MeshStandardMaterial({ color: 0x333536, roughness: 0.42, metalness: 0.72 });
    const signTex = gantrySignTexture();
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 0.18,
      roughness: 0.5, metalness: 0.05,
    });
    // vertical pylons
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.9, 8.2, 0.9), steel);
      post.position.set(side * (TRACK.width / 2 + 3.3), 4.1, 0);
      post.castShadow = true;
      group.add(post);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 1.8), steel);
      foot.position.set(side * (TRACK.width / 2 + 3.3), 0.2, 0);
      foot.castShadow = true;
      group.add(foot);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(TRACK.width + 8.2, 0.55, 0.9), steel);
    beam.position.set(0, 8.1, 0);
    beam.castShadow = true;
    group.add(beam);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14.2, 3.0), signMat);
    sign.position.set(0, 6.45, -0.48);
    sign.rotation.y = Math.PI;
    group.add(sign);
    const signBack = new THREE.Mesh(new THREE.BoxGeometry(14.4, 3.2, 0.24), steel);
    signBack.position.set(0, 6.45, 0.0);
    group.add(signBack);

    // F1 start light pods
    const pod = new THREE.Mesh(new THREE.BoxGeometry(5.0, 1.1, 0.4), steel);
    pod.position.set(0, 5.0, -0.15);
    group.add(pod);
    const lightGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.15, 20);
    lightGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 5; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x1b1b1b, emissive: 0x000000, roughness: 0.3, metalness: 0.2,
      });
      const bulb = new THREE.Mesh(lightGeo, mat);
      bulb.position.set(-1.9 + i * 0.95, 5.0, -0.37);
      group.add(bulb);
      this.startLights.push(mat);
    }

    // Timing tower at the outside of the start straight.
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x292725, roughness: 0.55, metalness: 0.2 });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(4.2, 18, 4.2), towerMat);
    tower.position.set(-TRACK.width / 2 - 12, 9, -6);
    tower.castShadow = true;
    group.add(tower);
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x101513, emissive: 0x74c7b1, emissiveIntensity: 0.3, roughness: 0.32,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 4.2), screenMat);
    screen.position.set(-TRACK.width / 2 - 12, 15, -6);
    screen.rotation.y = Math.PI;
    group.add(screen);

    this.buildGrandstand(group);
    this.buildPitBuilding(group);

    // start lights labels
    this.startGroup = group;
  }

  buildGrandstand(parent) {
    const concrete = new THREE.MeshStandardMaterial({ color: 0xa79b8a, roughness: 0.88 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2926, roughness: 0.7, metalness: 0.25 });
    const crowdTex = grandstandTexture();
    const crowdMat = new THREE.MeshStandardMaterial({ map: crowdTex, roughness: 0.9, emissiveMap: crowdTex, emissive: 0xffffff, emissiveIntensity: 0.05 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xd94d1a, roughness: 0.6 });
    const stand = new THREE.Group();
    // 留出一条维修通道的距离，弯道处的看台远端也不会啃到路面
    const leftX = -TRACK.width / 2 - 20.5;
    const width = 12;
    // 街道赛道的发车直道不一定笔直：看台长度收短，避免远端切进弯道里的路面
    const length = 66;
    for (let tier = 0; tier < 7; tier++) {
      const x = leftX - tier * 1.8;
      const y = 0.8 + tier * 1.35;
      const tierBox = new THREE.Mesh(new THREE.BoxGeometry(width, 1.35, length), concrete);
      tierBox.position.set(x - width / 2, y - 0.675, 0);
      tierBox.castShadow = true;
      tierBox.receiveShadow = true;
      stand.add(tierBox);
      const front = new THREE.Mesh(new THREE.PlaneGeometry(length, 2.5), crowdMat);
      front.rotation.y = Math.PI / 2;
      front.position.set(x - 0.02, y + 0.55, 0);
      stand.add(front);
    }
    // canopy
    const roof = new THREE.Mesh(new THREE.BoxGeometry(22, 0.3, length + 8), dark);
    roof.position.set(leftX - 12, 15.2, 0);
    roof.rotation.z = -0.07;
    roof.castShadow = true;
    stand.add(roof);
    for (let z = -length / 2 + 4; z <= length / 2 - 4; z += 16) {
      for (const x of [leftX - 2, leftX - 21]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 15, 8), dark);
        pole.position.set(x, 7.8, z);
        stand.add(pole);
      }
    }
    // orange fascia
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, length), orange);
    fascia.position.set(leftX + 0.4, 14.0, 0);
    stand.add(fascia);
    // big screen
    const screenMat = new THREE.MeshStandardMaterial({ color: 0x0b0d0d, emissive: 0x77b9a8, emissiveIntensity: 0.48, roughness: 0.32 });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(15, 6.6), screenMat);
    screen.rotation.y = Math.PI / 2;
    screen.position.set(leftX - 20, 10.5, 19);
    stand.add(screen);
    const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7.3, 16), dark);
    screenFrame.position.set(leftX - 20.3, 10.5, 19);
    stand.add(screenFrame);
    stand.position.z = 0;
    parent.add(stand);
    this.grandstand = stand;
  }

  buildPitBuilding(parent) {
    const building = new THREE.Group();
    const rightX = TRACK.width / 2 + 20.5;
    const mat = new THREE.MeshStandardMaterial({ color: 0x887c6d, roughness: 0.76, metalness: 0.05 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x2c403f, metalness: 0.7, roughness: 0.16, envMapIntensity: 1.2,
      emissive: 0x9a6634, emissiveIntensity: 0.12,
    });
    const trim = new THREE.MeshStandardMaterial({ color: 0x222321, roughness: 0.5, metalness: 0.3 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(18, 8.6, 58), mat);
    base.position.set(rightX, 4.3, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    building.add(base);
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 56), glass);
    ribbon.position.set(rightX - 9.05, 5.2, 0);
    building.add(ribbon);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(20, 0.45, 60), trim);
    lip.position.set(rightX, 8.7, 0);
    lip.castShadow = true;
    building.add(lip);
    // garage doors
    const garageMat = new THREE.MeshStandardMaterial({ color: 0x171716, roughness: 0.6, metalness: 0.3 });
    for (let z = -21; z <= 21; z += 7) {
      const door = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 4.0), garageMat);
      door.rotation.y = -Math.PI / 2;
      door.position.set(rightX - 9.12, 2.4, z);
      building.add(door);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 7.0), new THREE.MeshBasicMaterial({ color: 0xff6b32 }));
      strip.position.set(rightX - 9.18, 4.5, z);
      building.add(strip);
    }
    // signage
    const c = makeCanvas(1024, 160);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#171512'; ctx.fillRect(0, 0, 1024, 160);
    ctx.font = '800 86px "Barlow Condensed", sans-serif';
    ctx.fillStyle = '#f1e8db'; ctx.fillText('APEX PADDOCK', 36, 108);
    ctx.fillStyle = '#ff5a1f'; ctx.fillRect(722, 42, 8, 74);
    ctx.font = '600 22px "Manrope", sans-serif';
    ctx.fillStyle = '#c5b7a3'; ctx.fillText('APEX MOTORSPORT', 754, 76);
    ctx.fillStyle = '#7c7163'; ctx.font = '500 15px "Manrope", sans-serif'; ctx.fillText('OFFICIAL DEMO 02', 756, 103);
    const signTex = canvasTexture(c, { anisotropy: 8 });
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.6 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(18, 2.8), signMat);
    sign.rotation.y = -Math.PI / 2;
    sign.position.set(rightX - 9.3, 7.2, 0);
    building.add(sign);
    // roof plant
    for (let z = -18; z <= 18; z += 12) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 4.8), trim);
      ac.position.set(rightX + 3, 9.4, z);
      ac.castShadow = true;
      building.add(ac);
    }
    parent.add(building);
    this.pitBuilding = building;
  }

  buildBillboards() {
    const materials = this.textures.billboards.map((tex) => new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.55, metalness: 0.05,
      emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.1,
      side: THREE.DoubleSide,
    }));
    const boardGeo = new THREE.PlaneGeometry(11, 4.6);
    const backGeo = new THREE.BoxGeometry(11.4, 5.0, 0.24);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x262725, roughness: 0.55, metalness: 0.5 });
    const postGeo = new THREE.CylinderGeometry(0.14, 0.20, 4.2, 8);
    let count = 0;
    for (let i = 55; i < this.samples.length - 20; i += 86) {
      // avoid the immediate start gantry
      if (i < 38) continue;
      const s = this.samples[i];
      const side = count % 2 === 0 ? 1 : -1;
      const p = s.position.clone().addScaledVector(s.right, side * (TRACK.barrierOffset + 3.5));
      const normal = s.right.clone().multiplyScalar(-side);
      const board = new THREE.Mesh(boardGeo, materials[count % materials.length]);
      board.position.set(p.x, 3.3, p.z);
      board.rotation.y = Math.atan2(normal.x, normal.z);
      board.castShadow = true;
      this.group.add(board);
      const back = new THREE.Mesh(backGeo, frameMat);
      back.position.copy(board.position);
      back.rotation.y = board.rotation.y;
      back.translateZ(-0.18);
      back.castShadow = true;
      this.group.add(back);
      for (const dx of [-4.2, 4.2]) {
        const post = new THREE.Mesh(postGeo, frameMat);
        post.position.copy(p);
        post.position.y = 1.4;
        const along = s.tangent.clone().multiplyScalar(dx);
        post.position.add(along);
        post.castShadow = true;
        this.group.add(post);
      }
      count++;
    }
  }

  buildMinimapData() {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < this.samples.length; i += 8) {
      const p = this.samples[i].position;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
    this.mapBounds = { minX, maxX, minZ, maxZ };
    this.mapPoints = [];
    for (let i = 0; i < this.samples.length; i += 10) {
      const p = this.samples[i].position;
      this.mapPoints.push({ x: (p.x - minX) / (maxX - minX), y: (p.z - minZ) / (maxZ - minZ) });
    }
  }

  setStartLights(state, count = 0) {
    // state: off | red | go
    this.startLightState = state;
    this.startLights.forEach((mat, i) => {
      if (state === 'red') {
        mat.emissive.setHex(i < count ? 0xff2a12 : 0x000000);
        mat.emissiveIntensity = i < count ? 2.5 : 0;
      } else if (state === 'go') {
        mat.emissive.setHex(0x6bffae);
        mat.emissiveIntensity = 2.4;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    });
  }

  update(dt) {
    void dt;
  }
}
