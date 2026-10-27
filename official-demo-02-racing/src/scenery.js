import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, makeCanvas, mulberry32, radialTexture } from './utils.js';
import { COAST } from './environment.js';
import { TRACK, trackLayout } from './config.js';
import { getTheme } from './themes.js';

const TAU = Math.PI * 2;

function frondTexture() {
  const w = 512, h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const rng = mulberry32(412);
  const cy = h / 2;
  // central rib
  ctx.strokeStyle = '#35452a';
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 8) {
    const yy = cy + Math.sin(x / w * Math.PI) * 3;
    if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
  }
  ctx.stroke();
  // leaflets, denser toward the middle and tip
  for (let i = 0; i < 54; i++) {
    const t = i / 54;
    const x = 24 + t * (w - 34);
    const spread = 52 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.92) + 8;
    for (const sign of [-1, 1]) {
      const len = spread * (0.65 + rng() * 0.5);
      const rootY = cy + Math.sin(t * Math.PI) * 3;
      const tipX = x + 8 + len * 0.52;
      const tipY = rootY + sign * len;
      const g = ctx.createLinearGradient(x, rootY, tipX, tipY);
      g.addColorStop(0, '#334927');
      g.addColorStop(0.6, '#496b32');
      g.addColorStop(1, '#78914c');
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.6 + rng() * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, rootY);
      ctx.quadraticCurveTo(x + len * 0.28, rootY + sign * len * 0.55, tipX, tipY);
      ctx.stroke();
    }
  }
  // highlights
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = '#c5c681';
  ctx.lineWidth = 1;
  for (let i = 0; i < 36; i++) {
    const x = 30 + rng() * (w - 60), y = cy + (rng() - 0.5) * 42;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 24, y + (rng() - 0.5) * 18); ctx.stroke();
  }
  return canvasTexture(c, { anisotropy: 8 });
}

function barkTexture() {
  const c = makeCanvas(128, 512);
  const ctx = c.getContext('2d');
  const rng = mulberry32(8);
  ctx.fillStyle = '#6a543d';
  ctx.fillRect(0, 0, 128, 512);
  for (let y = 0; y < 512; y += 10) {
    ctx.fillStyle = `rgba(37,28,19,${0.12 + rng() * 0.2})`;
    ctx.fillRect(0, y, 128, 3 + rng() * 4);
    ctx.fillStyle = `rgba(200,170,123,${0.03 + rng() * 0.06})`;
    ctx.fillRect(0, y + 3, 128, 2);
  }
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(35,25,17,${0.08 + rng() * 0.15})`;
    ctx.fillRect(rng() * 128, rng() * 512, 1 + rng() * 3, 10 + rng() * 55);
  }
  return canvasTexture(c, { repeat: [2, 3], anisotropy: 8 });
}

function cornerSignTexture(label, subtitle) {
  const c = makeCanvas(512, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#15130f'; ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = '#ff5a1f'; ctx.fillRect(0, 0, 512, 14);
  ctx.font = '800 118px "Barlow Condensed", sans-serif';
  ctx.fillStyle = '#f2eadd'; ctx.fillText(label, 30, 140);
  ctx.font = '600 24px "Manrope", sans-serif';
  ctx.fillStyle = '#ff8b52'; ctx.fillText(subtitle, 34, 187);
  ctx.fillStyle = '#776c5d'; ctx.font = '500 15px "Manrope", sans-serif'; ctx.fillText('APEX CITY CIRCUIT · DEMO 02', 34, 222);
  ctx.fillStyle = '#ff5a1f'; ctx.fillRect(360, 164, 112, 4);
  // chevrons
  ctx.strokeStyle = '#f2eadd'; ctx.lineWidth = 8; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(376 + i * 17, 92); ctx.lineTo(428 + i * 17, 121); ctx.lineTo(376 + i * 17, 150);
    ctx.stroke();
  }
  return canvasTexture(c, { anisotropy: 8 });
}

function makeMatrix(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
  return m;
}

export class Scenery {
  constructor(scene, textures, track, city) {
    this.scene = scene;
    this.textures = textures;
    this.track = track;
    this.city = city;
    this.theme = getTheme(trackLayout().theme);
    this.group = new THREE.Group();
    this.group.name = 'Apex City scenery';
    scene.add(this.group);
    this.animated = [];
    // 主题决定路边道具：林间/山谷没有棕榈和滨海设施，港口/城市保留
    if (this.theme.palms) this.buildPalms();
    this.buildStreetLights();
    if (this.theme.seaside) {
      if (this.theme.promenade !== false) this.buildPromenade();
      this.buildFerrisWheel();
      this.buildBoats();
      this.buildMarina();
    }
    this.buildCornerSigns();
    this.buildFlags();
    this.buildFootbridge();
    if (this.theme.urban) this.buildHedges();
    this.buildPlazaDetails();
    this.buildBirds();
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

  /** 固定坐标的城市家具（长椅、花槽、系船柱…）必须避开任何一条赛道的路面。 */
  clearOfRoad(x, z, margin = 6) {
    return this.track.distanceToCenterline(x, z) > TRACK.width / 2 + TRACK.barrierOffset + margin;
  }

  buildPalms() {
    const trunkGeos = [];
    const frondGeos = [];
    const rng = mulberry32(2013);
    const spots = [];
    // Two waterfront rows, interrupted by the grandstand sightline.
    for (let x = -760; x < 920; x += 34) {
      if (x > -120 && x < 50) continue;
      const z1 = Math.min(315 + (rng() - 0.5) * 6, COAST(x) - 34);
      const z2 = Math.min(355 + (rng() - 0.5) * 8, COAST(x) - 22);
      spots.push({ x: x + (rng() - 0.5) * 5, z: z1, h: 6.2 + rng() * 3.6 });
      spots.push({ x: x + 16 + (rng() - 0.5) * 4, z: z2, h: 5.5 + rng() * 3.2 });
    }
    // More palms around the promenade display area.
    for (let i = 0; i < 9; i++) {
      const x = 80 + i * 21;
      spots.push({ x, z: 300 + (i % 2) * 13, h: 6.4 + rng() * 2.8 });
    }
    // Palms along the circuit where it opens toward the sea / plazas.
    for (let i = 30; i < this.track.samples.length; i += 137) {
      if (i < 180) continue;
      const s = this.track.samples[i];
      if (rng() > 0.7) continue;
      const side = rng() > 0.5 ? 1 : -1;
      const off = TRACK.barrierOffset + 8 + rng() * 2;
      const p = s.position.clone().addScaledVector(s.right, side * off);
      spots.push({ x: p.x, z: p.z, h: 5.8 + rng() * 3 });
    }
    // A handful in the start plaza.
    for (let i = 0; i < 6; i++) {
      spots.push({ x: -135 + i * 24, z: 300 + (i % 2) * 26, h: 6 + rng() * 2 });
    }
    // Palm rows close to the racing line, outside the barriers. These give
    // the long straights a sense of speed and scale.
    const s0 = this.track.samples[0];
    for (let d = 60; d < this.track.totalLength; d += 27) {
      const pose = this.track.getPoseAt(d);
      for (const side of [-1, 1]) {
        if (rng() < 0.22) continue;
        const p = pose.position.clone().addScaledVector(pose.right, side * (TRACK.barrierOffset + 9.6));
        const dx = p.x - s0.position.x, dz = p.z - s0.position.z;
        const along = Math.abs(dx * s0.tangent.x + dz * s0.tangent.z);
        if (along < 48) continue;
        spots.push({ x: p.x, z: p.z, h: 5.8 + rng() * 3.2 });
      }
    }

    for (const spot of spots) {
      if (this.track.distanceToCenterline(spot.x, spot.z) < TRACK.width / 2 + 5) continue;
      const base = new THREE.Vector3(spot.x, 0, spot.z);
      const height = spot.h;
      const bend = 0.7 + rng() * 1.3;
      const dir = rng() * TAU;
      const curve = new THREE.CatmullRomCurve3([
        base.clone(),
        new THREE.Vector3(base.x + Math.cos(dir) * 0.3, height * 0.38, base.z + Math.sin(dir) * 0.3),
        new THREE.Vector3(base.x + Math.cos(dir) * bend, height * 0.75, base.z + Math.sin(dir) * bend),
        new THREE.Vector3(base.x + Math.cos(dir) * (bend + 0.5), height, base.z + Math.sin(dir) * (bend + 0.6)),
      ]);
      const trunk = new THREE.TubeGeometry(curve, 7, 0.16, 7, false);
      trunkGeos.push(trunk);
      const top = curve.getPoint(1);
      // crown bulb
      const crown = new THREE.SphereGeometry(0.3, 7, 5);
      crown.translate(top.x, top.y - 0.04, top.z);
      trunkGeos.push(crown);

      const fronds = 9 + Math.floor(rng() * 3);
      for (let f = 0; f < fronds; f++) {
        const geo = new THREE.PlaneGeometry(5.8 + rng() * 1.3, 1.5 + rng() * 0.5, 14, 1);
        geo.rotateX(-Math.PI / 2);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const u = (x + 3.5) / 7;
          pos.setY(i, 0.11 * u - 0.32 * u * u);
        }
        geo.computeVertexNormals();
        geo.translate(0.4, 0, 0);
        const yaw = (f / fronds) * TAU + rng() * 0.2;
        const tilt = -0.12 - rng() * 0.35;
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(top.x, top.y, top.z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, rng() * 0.1)),
          new THREE.Vector3(1, 1, 1),
        );
        geo.applyMatrix4(m);
        frondGeos.push(geo);
      }
    }

    const trunkMat = new THREE.MeshStandardMaterial({
      map: barkTexture(), color: 0xcab193, roughness: 0.92, metalness: 0,
    });
    const frondMat = new THREE.MeshStandardMaterial({
      map: frondTexture(), alphaTest: 0.35, side: THREE.DoubleSide,
      roughness: 0.85, metalness: 0.02, vertexColors: false,
      color: 0xffffff,
    });
    this.mergeInto(trunkGeos, trunkMat, { castShadow: true });
    this.mergeInto(frondGeos, frondMat, { castShadow: true });
    this.palmSpots = spots;
  }

  buildStreetLights() {
    const poleGeos = [];
    const lampGeos = [];
    const poolGeos = [];
    const steel = new THREE.MeshStandardMaterial({ color: 0x3b3d3b, roughness: 0.45, metalness: 0.6 });
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0x2b2721, emissive: this.theme.lamp.color,
      emissiveIntensity: this.theme.lamp.intensity, roughness: 0.4, metalness: 0.3,
    });
    const poolTex = canvasTexture(radialTexture(128, 'rgba(255,205,150,0.65)', 'rgba(255,165,80,0)'), { anisotropy: 8 });
    const poolMat = new THREE.MeshBasicMaterial({
      map: poolTex, transparent: true, opacity: this.theme.lamp.pool,
      blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    });
    // template geometry in local coordinates, arm to -x
    const makeLamp = (x, y, z, yaw, mirror) => {
      const root = new THREE.Matrix4().makeRotationY(mirror ? yaw + Math.PI : yaw);
      root.setPosition(x, y, z);
      const px = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(root);
      // pole
      const pole = new THREE.CylinderGeometry(0.075, 0.11, 8.2, 8);
      const pp = px(0, 4.1, 0);
      pole.translate(pp.x, pp.y, pp.z);
      poleGeos.push(pole);
      const base = new THREE.CylinderGeometry(0.17, 0.22, 0.7, 8);
      const bp = px(0, 0.35, 0);
      base.translate(bp.x, bp.y, bp.z);
      poleGeos.push(base);
      // arm (towards track, local -x)
      const arm = new THREE.CylinderGeometry(0.055, 0.07, 2.6, 7);
      arm.rotateZ(Math.PI / 2);
      const ap = px(-1.2, 8.15, 0);
      arm.translate(ap.x, ap.y, ap.z);
      poleGeos.push(arm);
      // lamp head
      const head = new THREE.BoxGeometry(0.9, 0.14, 0.34);
      const hp = px(-2.4, 8.05, 0);
      const mh = new THREE.Matrix4().makeRotationY(mirror ? yaw + Math.PI : yaw);
      mh.setPosition(hp.x, hp.y, hp.z);
      head.applyMatrix4(mh);
      lampGeos.push(head);
      // light pool on asphalt shoulder
      const pool = new THREE.PlaneGeometry(15, 15);
      pool.rotateX(-Math.PI / 2);
      const poolPos = px(-4.2, 0.07, 0);
      pool.translate(poolPos.x, poolPos.y, poolPos.z);
      poolGeos.push(pool);
    };
    const stride = 40;
    for (let i = 20; i < this.track.samples.length; i += stride) {
      const s = this.track.samples[i];
      for (const side of [-1, 1]) {
        const p = s.position.clone().addScaledVector(s.right, side * (TRACK.barrierOffset + 3.5));
        makeLamp(p.x, 0, p.z, s.yaw, side < 0);
      }
    }
    this.mergeInto(poleGeos, steel);
    this.mergeInto(lampGeos, lampMat);
    this.mergeInto(poolGeos, poolMat, { castShadow: false });
  }

  buildPromenade() {
    const concrete = new THREE.MeshStandardMaterial({ color: 0xb5a793, roughness: 0.9 });
    const rail = new THREE.MeshStandardMaterial({ color: 0x474a47, roughness: 0.38, metalness: 0.7 });
    const railGeos = [];
    const curbGeos = [];
    // A seafront balustrade punctuated at the plaza.
    for (let x = -1000; x < 1200; x += 8) {
      const z = COAST(x) - 14;
      if (Math.abs(x) < 100) continue;
      const post = new THREE.BoxGeometry(0.12, 1.15, 0.12);
      post.translate(x, 0.58, z);
      railGeos.push(post);
      if (x % 24 === 0) {
        const top = new THREE.BoxGeometry(8.2, 0.12, 0.12);
        top.translate(x + 4, 1.08, z);
        railGeos.push(top);
        const mid = new THREE.BoxGeometry(8.2, 0.08, 0.08);
        mid.translate(x + 4, 0.66, z);
        railGeos.push(mid);
      }
    }
    // low sea wall
    for (let x = -1000; x < 1200; x += 40) {
      const z = COAST(x) - 18;
      const curb = new THREE.BoxGeometry(40, 0.6, 0.9);
      curb.translate(x + 20, 0.3, z);
      curbGeos.push(curb);
    }
    this.mergeInto(railGeos, rail);
    this.mergeInto(curbGeos, concrete);

    // Benches along the waterfront.
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a4531, roughness: 0.88 });
    const benchGeos = [];
    for (let i = 0; i < 14; i++) {
      const x = -450 + i * 58;
      const z = Math.min(300 + (i % 2) * 9, COAST(x) - 58);
      if (!this.clearOfRoad(x, z, 7)) continue;
      const seat = new THREE.BoxGeometry(2.2, 0.1, 0.55);
      seat.translate(x, 0.48, z);
      benchGeos.push(seat);
      const back = new THREE.BoxGeometry(2.2, 0.55, 0.08);
      back.rotateX(-0.12);
      back.translate(x, 0.78, z - 0.25);
      benchGeos.push(back);
      for (const dx of [-0.85, 0.85]) {
        const leg = new THREE.BoxGeometry(0.1, 0.48, 0.5);
        leg.translate(x + dx, 0.24, z);
        benchGeos.push(leg);
      }
    }
    this.mergeInto(benchGeos, wood, { castShadow: true });
  }

  buildCornerSigns() {
    const clusters = [];
    let active = null;
    for (let i = 0; i < this.track.samples.length; i++) {
      const s = this.track.samples[i];
      if (Math.abs(s.curvature) > 0.0085) {
        if (!active) active = { start: i, end: i };
        else active.end = i;
      } else if (active) {
        if (active.end - active.start > 16) clusters.push(active);
        active = null;
      }
    }
    if (active && active.end - active.start > 16) clusters.push(active);
    const chosen = clusters.slice(0, 10);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x44433f, roughness: 0.45, metalness: 0.6 });
    chosen.forEach((c, idx) => {
      const mid = Math.floor((c.start + c.end) / 2);
      const s = this.track.samples[mid];
      const side = s.curvature > 0 ? -1 : 1;
      const p = s.position.clone().addScaledVector(s.right, side * (TRACK.barrierOffset + 4.5));
      const tex = cornerSignTexture(`T${idx + 1}`, idx % 3 === 0 ? 'BRAKE LATE · 晚刹车' : 'APEX · 弯心');
      const mat = new THREE.MeshStandardMaterial({
        map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.18, roughness: 0.6, side: THREE.DoubleSide,
      });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.4), mat);
      sign.position.set(p.x, 3.1, p.z);
      sign.rotation.y = Math.atan2(-s.right.x * side, -s.right.z * side);
      sign.castShadow = true;
      this.group.add(sign);
      const back = new THREE.Mesh(new THREE.BoxGeometry(5.0, 2.6, 0.18), postMat);
      back.position.copy(sign.position);
      back.rotation.y = sign.rotation.y;
      back.translateZ(-0.1);
      this.group.add(back);
      for (const dx of [-1.8, 1.8]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.4, 0.1), postMat);
        post.position.copy(p);
        post.position.y = 1.7;
        post.position.addScaledVector(s.tangent, dx);
        this.group.add(post);
      }
    });
  }

  buildFlags() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x9e9990, metalness: 0.8, roughness: 0.25 });
    const flagMat = new THREE.MeshStandardMaterial({ color: 0xd6501e, roughness: 0.8, side: THREE.DoubleSide });
    const creamMat = new THREE.MeshStandardMaterial({ color: 0xe8dfcf, roughness: 0.8, side: THREE.DoubleSide });
    const start = this.track.samples[0];
    for (let i = 0; i < 9; i++) {
      const zLocal = -38 + i * 9.5;
      const p = start.position.clone().addScaledVector(start.tangent, zLocal)
        .addScaledVector(start.right, -(TRACK.width / 2 + 15));
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 9, 8), poleMat);
      pole.position.set(p.x, 4.5, p.z);
      this.group.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.15, 8, 1), i % 2 ? creamMat : flagMat);
      flag.position.set(p.x + 1.03, 8.2, p.z);
      flag.rotation.y = start.yaw + Math.PI / 2;
      flag.castShadow = true;
      this.group.add(flag);
    }
  }

  buildFootbridge() {
    const idx = Math.floor(this.track.samples.length * 0.58);
    const s = this.track.samples[idx];
    const g = new THREE.Group();
    g.position.copy(s.position);
    g.rotation.y = s.yaw;
    const steel = new THREE.MeshStandardMaterial({ color: 0x676360, roughness: 0.4, metalness: 0.65 });
    const concrete = new THREE.MeshStandardMaterial({ color: 0xb0a38f, roughness: 0.9 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x5f7377, metalness: 0.4, roughness: 0.1, transparent: true, opacity: 0.35,
      envMapIntensity: 1.4, side: THREE.DoubleSide,
    });
    const span = TRACK.width + 19;
    // deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(span, 0.55, 3.4), concrete);
    deck.position.set(0, 7.6, 0);
    deck.castShadow = true;
    deck.receiveShadow = true;
    g.add(deck);
    for (const side of [-1, 1]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(span, 0.35, 0.35), steel);
      beam.position.set(0, 7.96, side * 1.7);
      beam.castShadow = true;
      g.add(beam);
      const glassPanel = new THREE.Mesh(new THREE.PlaneGeometry(span, 1.15), glass);
      glassPanel.position.set(0, 8.4, side * 1.72);
      g.add(glassPanel);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(span, 0.06, 0.06), steel);
      rail.position.set(0, 9.0, side * 1.72);
      g.add(rail);
      // supporting pylon outside the barrier
      const x = side * (span / 2 - 1.5);
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(1.6, 7.4, 1.6), concrete);
      pylon.position.set(x, 3.7, 0);
      pylon.castShadow = true;
      pylon.receiveShadow = true;
      g.add(pylon);
    }
    // roof / truss
    const roof = new THREE.Mesh(new THREE.BoxGeometry(span + 1, 0.18, 4.0), steel);
    roof.position.set(0, 9.3, 0);
    g.add(roof);
    for (let i = -7; i <= 7; i++) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 0.08), steel);
      brace.position.set(i * 1.7, 8.55, 1.7);
      brace.rotation.z = i % 2 ? 0.3 : -0.3;
      g.add(brace);
    }
    const signTex = canvasTexture((() => {
      const c = makeCanvas(1024, 160);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#171512'; ctx.fillRect(0, 0, 1024, 160);
      ctx.font = '800 76px "Barlow Condensed", sans-serif';
      ctx.fillStyle = '#f2eadd'; ctx.fillText('APEX SKYWALK', 34, 106);
      ctx.fillStyle = '#ff5a1f'; ctx.fillRect(704, 44, 7, 74);
      ctx.font = '600 21px "Manrope", sans-serif';
      ctx.fillStyle = '#b9aa96'; ctx.fillText('SEASIDE DISTRICT · 02', 733, 84);
      return c;
    })(), { anisotropy: 8 });
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.6 });
    for (const side of [-1, 1]) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.55), signMat);
      sign.position.set(0, 9.2, side * 2.02);
      if (side < 0) sign.rotation.y = Math.PI;
      g.add(sign);
    }
    this.group.add(g);
  }

  buildFerrisWheel() {
    const group = new THREE.Group();
    group.position.set(470, 0, COAST(470) - 52);
    group.rotation.y = -0.35;
    const steel = new THREE.MeshStandardMaterial({ color: 0xbab3a6, roughness: 0.38, metalness: 0.75 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x353632, roughness: 0.5, metalness: 0.55 });
    const neon = new THREE.MeshStandardMaterial({
      color: 0x33221a, emissive: 0xff9d55, emissiveIntensity: 2.4, roughness: 0.35,
    });
    const R = 19;
    const hubY = 27;
    const wheel = new THREE.Group();
    wheel.position.y = hubY;
    group.add(wheel);
    // rings
    for (const z of [-1.1, 1.1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.18, 8, 70), steel);
      ring.position.z = z;
      wheel.add(ring);
      const inner = new THREE.Mesh(new THREE.TorusGeometry(R - 2.1, 0.09, 6, 64), steel);
      inner.position.z = z;
      wheel.add(inner);
    }
    // spokes, merged as one geometry
    const spokeGeos = [];
    for (const z of [-1.1, 1.1]) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        const spoke = new THREE.CylinderGeometry(0.05, 0.05, R, 6);
        spoke.translate(0, R / 2, 0);
        const m = new THREE.Matrix4().makeRotationZ(a);
        m.setPosition(0, 0, z);
        spoke.applyMatrix4(m);
        spokeGeos.push(spoke);
      }
    }
    const spokes = new THREE.Mesh(mergeGeometries(spokeGeos, false), steel);
    wheel.add(spokes);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3.6, 16), dark);
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);
    // rim bulbs
    const bulbGeo = new THREE.SphereGeometry(0.14, 6, 4);
    const bulbs = new THREE.InstancedMesh(bulbGeo, neon, 56);
    const tmp = new THREE.Object3D();
    for (let i = 0; i < 56; i++) {
      const a = (i / 56) * TAU;
      tmp.position.set(Math.cos(a) * R, Math.sin(a) * R, i % 2 ? 1.22 : -1.22);
      tmp.updateMatrix();
      bulbs.setMatrixAt(i, tmp.matrix);
    }
    bulbs.instanceMatrix.needsUpdate = true;
    wheel.add(bulbs);
    // cabins are kept upright
    this.cabins = [];
    const cabinColors = [0xd65429, 0xd8c4a5, 0x4f756d, 0xd9ab4d, 0x8a3324, 0xcfc2ac];
    for (let i = 0; i < 12; i++) {
      const cabin = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.9, 0.7, 3, 8),
        new THREE.MeshStandardMaterial({ color: cabinColors[i % cabinColors.length], roughness: 0.6, metalness: 0.15 }),
      );
      body.rotation.z = Math.PI / 2;
      body.scale.set(0.9, 1.1, 0.7);
      cabin.add(body);
      const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 5), dark);
      hanger.position.y = 1.15;
      cabin.add(hanger);
      group.add(cabin);
      this.cabins.push(cabin);
    }
    // A-frame legs
    for (const side of [-1, 1]) {
      for (const z of [-3.2, 3.2]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, hubY + 2, 8), dark);
        leg.position.set(side * 4.8, (hubY + 2) / 2, z);
        leg.rotation.z = side * -0.18;
        group.add(leg);
      }
    }
    const platform = new THREE.Mesh(new THREE.BoxGeometry(26, 1.2, 12), new THREE.MeshStandardMaterial({ color: 0x998b78, roughness: 0.9 }));
    platform.position.y = 0.6;
    group.add(platform);
    group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.group.add(group);
    this.ferrisWheel = wheel;
    this.ferrisCabinGroup = group;
    this.ferrisHubY = hubY;
    this.ferrisR = R;
  }

  buildBoats() {
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xe6dfd3, roughness: 0.45, metalness: 0.15 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x233f50, roughness: 0.5 });
    const mastMat = new THREE.MeshStandardMaterial({ color: 0xb9b4aa, metalness: 0.8, roughness: 0.3 });
    const positions = [
      [180, 510, 0.4, 1.0], [680, 545, -0.2, 1.3], [-280, 520, 0.8, 0.75], [980, 500, 0.1, 0.9],
    ];
    positions.forEach(([x, z, rot, scale], i) => {
      const g = new THREE.Group();
      g.position.set(x, -0.6, z);
      g.rotation.y = rot;
      g.scale.setScalar(scale);
      const hull = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 6, 3, 8), hullMat);
      hull.rotation.z = Math.PI / 2;
      hull.scale.set(0.55, 1, 1);
      hull.position.y = 0.45;
      g.add(hull);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 1.8), trimMat);
      cabin.position.set(0.2, 1.35, 0);
      g.add(cabin);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 7, 6), mastMat);
      mast.position.set(-0.4, 4.8, 0);
      g.add(mast);
      if (i % 2 === 0) {
        const sail = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 5.5), new THREE.MeshStandardMaterial({
          color: 0xe1d8c9, roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.8,
        }));
        sail.position.set(-0.4, 5.3, 0);
        sail.rotation.y = 0.15;
        g.add(sail);
      }
      this.group.add(g);
    });
  }

  buildMarina() {
    const white = new THREE.MeshStandardMaterial({ color: 0xe3ddd0, roughness: 0.62, metalness: 0.03 });
    const warmWhite = new THREE.MeshStandardMaterial({ color: 0xc8bda9, roughness: 0.78 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x31494b, roughness: 0.08, metalness: 0.55, envMapIntensity: 1.5,
      emissive: 0xffbd76, emissiveIntensity: 0.14,
    });
    const wood = new THREE.MeshStandardMaterial({ color: 0x74573c, roughness: 0.82 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x463424, roughness: 0.9 });
    const coral = new THREE.MeshStandardMaterial({ color: 0xd5572f, roughness: 0.75 });
    const group = new THREE.Group();
    group.position.set(300, 0, COAST(300) - 58);
    group.rotation.y = -0.06;

    const base = new THREE.Mesh(new THREE.BoxGeometry(86, 1.1, 26), white);
    base.position.set(0, 0.55, 0);
    base.receiveShadow = true;
    base.castShadow = true;
    group.add(base);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(76, 6.2, 20), white);
    floor.position.set(0, 4.1, 0);
    floor.castShadow = true;
    floor.receiveShadow = true;
    group.add(floor);
    const glazing = new THREE.Mesh(new THREE.BoxGeometry(68, 3.6, 20.3), glass);
    glazing.position.set(0, 4.6, 0);
    group.add(glazing);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(84, 0.55, 25), warmWhite);
    roof.position.set(0, 7.5, 0);
    roof.castShadow = true;
    group.add(roof);
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(78, 0.24, 0.3), coral);
    fascia.position.set(0, 7.1, -10.2);
    group.add(fascia);
    // terrace awnings
    for (let i = -2; i <= 2; i++) {
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(9, 0.18, 6.6), coral);
      canopy.position.set(i * 16, 5.7, -13.2);
      canopy.rotation.z = 0.03;
      group.add(canopy);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5.7, 6), warmWhite);
      pole.position.set(i * 16 + 3.4, 2.85, -16);
      group.add(pole);
      for (const dx of [-3.2, 3.2]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.3, 6), warmWhite);
        leg.position.set(i * 16 + dx, 1.65, -11.7);
        group.add(leg);
      }
    }
    // sign
    const c = makeCanvas(1024, 180);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#161411'; ctx.fillRect(0, 0, 1024, 180);
    ctx.font = '800 80px "Barlow Condensed", sans-serif';
    ctx.fillStyle = '#f2eadd'; ctx.fillText('APEX YACHT CLUB', 34, 112);
    ctx.fillStyle = '#ff8b52'; ctx.font = '600 19px "Manrope", sans-serif';
    ctx.fillText('EST. 1986 · SEASIDE DISTRICT', 38, 147);
    ctx.fillStyle = '#ff5a1f'; ctx.fillRect(846, 38, 7, 78);
    ctx.font = '600 22px "Manrope", sans-serif'; ctx.fillStyle = '#c6b9a5';
    ctx.fillText('MARINA', 875, 86);
    const signTex = canvasTexture(c, { anisotropy: 8 });
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.55,
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(36, 6.3), signMat);
    sign.position.set(0, 9.6, -8);
    sign.rotation.y = Math.PI;
    group.add(sign);
    const signBack = new THREE.Mesh(new THREE.BoxGeometry(38, 7, 0.5), warmWhite);
    signBack.position.set(0, 9.6, -7.6);
    signBack.castShadow = true;
    group.add(signBack);
    for (const x of [-12, 12]) {
      const support = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.2, 0.35), warmWhite);
      support.position.set(x, 7.5, -7.9);
      group.add(support);
    }
    // roof planters and rail
    for (let x = -32; x <= 32; x += 12) {
      const planter = new THREE.Mesh(new THREE.BoxGeometry(5, 0.7, 1.3), wood);
      planter.position.set(x, 8.1, -8.5);
      group.add(planter);
    }
    // pier
    const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 0.35, 52), wood);
    pier.position.set(8, 0.55, 52);
    pier.receiveShadow = true;
    group.add(pier);
    for (let z = 30; z <= 74; z += 11) {
      for (const x of [3, 13]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 3.4, 7), darkWood);
        post.position.set(x, -0.8, z);
        group.add(post);
      }
    }
    group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.group.add(group);

    // A row of roadside billboards faces the start straight. They are positioned
    // from the racing line (not hard-coded world coordinates) so they stay outside
    // the barriers on every circuit.
    const boardMats = this.textures.billboards.map((tex) => new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.42,
      roughness: 0.62, side: THREE.DoubleSide,
    }));
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2b2b27, roughness: 0.5, metalness: 0.5 });
    const boardSpots = [
      { distance: 150, side: 1 },
      { distance: 268, side: -1 },
      { distance: 382, side: -1 },
    ];
    boardSpots.forEach((spot, i) => {
      if (spot.distance > this.track.totalLength * 0.5) return;
      const pose = this.track.getPoseAt(spot.distance);
      const lateral = TRACK.barrierOffset + 5.6;
      const p = pose.position.clone().addScaledVector(pose.right, spot.side * lateral);
      if (this.track.distanceToCenterline(p.x, p.z) < TRACK.width / 2 + TRACK.barrierOffset) return;
      const normal = pose.right.clone().multiplyScalar(-spot.side);
      const yaw = Math.atan2(normal.x, normal.z);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(15, 6.3), boardMats[i % boardMats.length]);
      board.position.set(p.x, 5.8, p.z);
      board.rotation.y = yaw;
      this.group.add(board);
      const back = new THREE.Mesh(new THREE.BoxGeometry(15.4, 6.7, 0.35), frameMat);
      back.position.copy(board.position);
      back.rotation.y = yaw;
      back.translateZ(-0.25);
      back.castShadow = true;
      this.group.add(back);
      for (const dx of [-5.6, 5.6]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.6, 0.3), frameMat);
        post.position.copy(p);
        post.position.y = 2.8;
        post.position.addScaledVector(pose.tangent, dx);
        post.position.addScaledVector(pose.right, spot.side * 0.4);
        this.group.add(post);
      }
    });
  }

  buildHedges() {
    // Low clipped hedges just outside the barriers soften the concrete edge.
    const hedgeMaterial = new THREE.MeshStandardMaterial({ color: 0x3f4d2c, roughness: 0.98 });
    const hedgeGeos = [];
    for (let d = 70; d < this.track.totalLength; d += 23) {
      const pose = this.track.getPoseAt(d);
      for (const side of [-1, 1]) {
        if ((Math.round(d / 23) + (side > 0 ? 1 : 0)) % 3 === 0) continue;
        const p = pose.position.clone().addScaledVector(pose.right, side * (TRACK.barrierOffset + 4.1));
        const hedge = new THREE.BoxGeometry(1.25, 0.9 + (Math.round(d) % 3) * 0.1, 2.7);
        const m = new THREE.Matrix4().makeRotationY(pose.yaw);
        m.setPosition(p.x, 0.5, p.z);
        hedge.applyMatrix4(m);
        hedgeGeos.push(hedge);
      }
    }
    this.mergeInto(hedgeGeos, hedgeMaterial, { castShadow: true });
  }

  buildPlazaDetails() {
    const stone = new THREE.MeshStandardMaterial({ color: 0x82786a, roughness: 0.9 });
    const geos = [];
    // long planters along the promenade
    for (let i = 0; i < 12; i++) {
      const x = -330 + i * 52;
      if (!this.clearOfRoad(x, 284, 9)) continue;
      const box = new THREE.BoxGeometry(15, 0.7, 1.6);
      box.translate(x, 0.4, 284);
      geos.push(box);
    }
    this.mergeInto(geos, stone, { castShadow: true });
    // bollards
    const bollardGeos = [];
    for (let x = -150; x < 220; x += 6) {
      if (x > -100 && x < 100) continue;
      if (!this.clearOfRoad(x, 290, 6)) continue;
      const b = new THREE.CylinderGeometry(0.13, 0.17, 0.9, 8);
      b.translate(x, 0.45, 290);
      bollardGeos.push(b);
    }
    this.mergeInto(bollardGeos, new THREE.MeshStandardMaterial({ color: 0x41413c, metalness: 0.5, roughness: 0.5 }));
  }

  buildBirds() {
    const positions = [];
    for (let i = 0; i < 9; i++) {
      const cx = -80 + i * 20;
      const cy = 45 + (i % 3) * 7;
      const cz = 220 + (i % 4) * 12;
      positions.push(new THREE.Vector3(cx, cy, cz));
    }
    const vertices = [];
    for (const p of positions) {
      vertices.push(
        p.x - 1.2, p.y, p.z,
        p.x, p.y + 0.35, p.z,
        p.x, p.y + 0.35, p.z,
        p.x + 1.2, p.y, p.z,
      );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x2e2b26, transparent: true, opacity: 0.55 });
    this.birds = new THREE.LineSegments(geo, mat);
    this.birds.frustumCulled = false;
    this.group.add(this.birds);
    this.birdBase = positions;
  }

  update(dt, elapsed) {
    if (this.ferrisWheel) {
      const a = elapsed * 0.035;
      this.ferrisWheel.rotation.z = a;
      this.cabins.forEach((cabin, i) => {
        const ang = (i / this.cabins.length) * TAU + a;
        cabin.position.set(Math.cos(ang) * this.ferrisR, this.ferrisHubY + Math.sin(ang) * this.ferrisR, 0);
        cabin.rotation.z = -a * 0;
      });
    }
    if (this.birds) {
      this.birds.position.x = Math.sin(elapsed * 0.04) * 28;
      this.birds.position.z = Math.cos(elapsed * 0.035) * 16;
      this.birds.position.y = Math.sin(elapsed * 0.22) * 1.2;
    }
  }
}
