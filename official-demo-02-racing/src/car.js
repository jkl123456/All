import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, makeCanvas, radialTexture, roundRect } from './utils.js';
import { createBoostFlames, createBrakeGlows, createCarBody, hasCarModel, retintCarBody } from './carasset.js';

const TAU = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/* =========================================================================
   Shared materials and cached geometry
   ========================================================================= */

let SHARED = null;
let CARBON_TEX = null;
let AERO_WHEEL_TEX = null;
let GRILLE_TEX = null;

function grilleTexture() {
  if (GRILLE_TEX) return GRILLE_TEX;
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#060707';
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(105,112,115,0.75)';
  ctx.lineWidth = 2;
  const step = 22;
  for (let x = -s; x < s * 2; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + s, s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, s); ctx.lineTo(x + s, 0); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(25,28,29,0.9)';
  ctx.lineWidth = 4;
  for (let x = -s; x < s * 2; x += step * 2) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + s, s); ctx.stroke();
  }
  GRILLE_TEX = canvasTexture(c, { repeat: [2, 1], anisotropy: 8 });
  return GRILLE_TEX;
}

function carbonTexture() {
  if (CARBON_TEX) return CARBON_TEX;
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#090a0a';
  ctx.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 8) {
    for (let x = 0; x < s; x += 8) {
      const light = ((x / 8 + y / 8) % 2) === 0;
      ctx.fillStyle = light ? '#1c2023' : '#101214';
      ctx.fillRect(x, y, 7, 7);
      ctx.fillStyle = 'rgba(110,125,135,0.12)';
      ctx.fillRect(x + 1, y + 1, 5, 2);
    }
  }
  CARBON_TEX = canvasTexture(c, { repeat: [7, 7], anisotropy: 8 });
  return CARBON_TEX;
}

function aeroWheelTexture() {
  if (AERO_WHEEL_TEX) return AERO_WHEEL_TEX;
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const cx = s / 2, cy = s / 2;
  ctx.clearRect(0, 0, s, s);
  // rim lip
  ctx.strokeStyle = '#bfc2c0';
  ctx.lineWidth = 15;
  ctx.beginPath(); ctx.arc(cx, cy, 224, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#1a1b1c';
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.arc(cx, cy, 205, 0, TAU); ctx.stroke();
  // brushed aero cover
  const g = ctx.createRadialGradient(cx - 40, cy - 50, 20, cx, cy, 210);
  g.addColorStop(0, '#b8bcbc');
  g.addColorStop(0.5, '#707678');
  g.addColorStop(1, '#d0d2cf');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, 202, 0, TAU); ctx.fill();
  ctx.save();
  ctx.translate(cx, cy);
  // ten vent slots
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - 0.2;
    ctx.save(); ctx.rotate(a);
    ctx.fillStyle = 'rgba(15,18,20,0.88)';
    roundRect(ctx, 62, -7, 108, 14, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    roundRect(ctx, 70, -3, 88, 2, 1); ctx.fill();
    ctx.restore();
  }
  // center lock
  ctx.fillStyle = '#17191a'; ctx.beginPath(); ctx.arc(0, 0, 38, 0, TAU); ctx.fill();
  ctx.fillStyle = '#cf2032'; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e9e4d8'; ctx.font = '900 21px "Arial Narrow", sans-serif';
  ctx.textAlign = 'center'; ctx.fillText('A', 0, 8);
  ctx.restore();
  AERO_WHEEL_TEX = canvasTexture(c, { anisotropy: 8 });
  AERO_WHEEL_TEX.wrapS = AERO_WHEEL_TEX.wrapT = THREE.ClampToEdgeWrapping;
  return AERO_WHEEL_TEX;
}

function sharedMaterials() {
  if (SHARED) return SHARED;  SHARED = {
    paintBlack: null, // replaced per car
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x071013, roughness: 0.025, metalness: 0.48,
      clearcoat: 1, clearcoatRoughness: 0.015, envMapIntensity: 2.8,
    }),
    glassLight: new THREE.MeshPhysicalMaterial({
      color: 0x26343a, roughness: 0.04, metalness: 0.25,
      clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.6,
    }),
    carbon: new THREE.MeshPhysicalMaterial({
      color: 0xffffff, map: carbonTexture(), roughness: 0.3, metalness: 0.42,
      clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 1.15,
    }),
    carbonDark: new THREE.MeshPhysicalMaterial({
      color: 0x141617, roughness: 0.38, metalness: 0.4,
      clearcoat: 0.5, clearcoatRoughness: 0.18,
    }),
    pianoBlack: new THREE.MeshPhysicalMaterial({
      color: 0x050607, roughness: 0.12, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.02,
      envMapIntensity: 1.6,
    }),
    black: new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.55, metalness: 0.12 }),
    mesh: new THREE.MeshStandardMaterial({ color: 0x17191a, roughness: 0.72, metalness: 0.35 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd7d7d1, roughness: 0.12, metalness: 1.0, envMapIntensity: 1.5 }),
    titanium: new THREE.MeshStandardMaterial({ color: 0x8a8882, roughness: 0.26, metalness: 1.0 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x101110, roughness: 0.86, metalness: 0.02 }),
    brake: new THREE.MeshStandardMaterial({ color: 0x3c3b39, roughness: 0.34, metalness: 0.85 }),
    headlight: new THREE.MeshStandardMaterial({
      color: 0x1b1c1c, emissive: 0xfff0d4, emissiveIntensity: 6.0, roughness: 0.16, metalness: 0.25,
    }),
    headlightHousing: new THREE.MeshStandardMaterial({
      color: 0x000000, roughness: 0.32, metalness: 0.08, envMapIntensity: 0.25,
    }),
    drl: new THREE.MeshStandardMaterial({
      color: 0x1f2323, emissive: 0xe8f6ff, emissiveIntensity: 5.0, roughness: 0.15, metalness: 0.25,
    }),
    grille: new THREE.MeshStandardMaterial({
      color: 0xffffff, map: grilleTexture(), roughness: 0.56, metalness: 0.42,
    }),
    rimGt: new THREE.MeshPhysicalMaterial({
      color: 0x25282a, roughness: 0.3, metalness: 0.88, clearcoat: 0.4, clearcoatRoughness: 0.18,
    }),
    rimSilver: new THREE.MeshPhysicalMaterial({
      color: 0xb7b8b4, roughness: 0.2, metalness: 0.9, clearcoat: 0.4,
    }),
    tireMark: new THREE.MeshBasicMaterial({ color: 0xe8d445, toneMapped: false }),
    exhaust: new THREE.MeshPhysicalMaterial({ color: 0x9b8d7a, roughness: 0.2, metalness: 1.0 }),
    interior: new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.9 }),
  };
  return SHARED;
}

function tireGeometry() {
  if (TIRE_GEO) return TIRE_GEO;
  const pts = [
    new THREE.Vector2(0.245, -0.155),
    new THREE.Vector2(0.285, -0.17),
    new THREE.Vector2(0.33, -0.16),
    new THREE.Vector2(0.36, -0.12),
    new THREE.Vector2(0.373, -0.06),
    new THREE.Vector2(0.378, 0),
    new THREE.Vector2(0.373, 0.06),
    new THREE.Vector2(0.36, 0.12),
    new THREE.Vector2(0.33, 0.16),
    new THREE.Vector2(0.285, 0.17),
    new THREE.Vector2(0.245, 0.155),
  ];
  const geo = new THREE.LatheGeometry(pts, 56);
  geo.rotateZ(Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(y, z);
    if (r > 0.345 && Math.abs(x) < 0.12) {
      const k = Math.sin(Math.atan2(z, y) * 48) * 0.0028;
      pos.setY(i, y * (1 + k));
      pos.setZ(i, z * (1 + k));
    }
  }
  geo.computeVertexNormals();
  TIRE_GEO = geo;
  return geo;
}

let TIRE_GEO = null;
let RIM_GT_GEO = null;
let RIM_LM_GEO = null;
let BRAKE_GEO = null;
let CALIPER_GEO = null;
let SHADOW_TEX = null;
let PLATE_TEX = null;
let DECAL_MATS = new Map();

function rimGtGeometry() {
  if (RIM_GT_GEO) return RIM_GT_GEO;
  const parts = [];
  const add = (g) => parts.push(g);
  const outer = new THREE.CylinderGeometry(0.256, 0.256, 0.24, 40, 1, true);
  outer.rotateZ(Math.PI / 2);
  add(outer);
  for (const face of [-1, 1]) {
    const lip = new THREE.TorusGeometry(0.258, 0.015, 8, 48);
    lip.rotateY(Math.PI / 2);
    lip.translate(face * 0.102, 0, 0);
    add(lip);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + 0.1;
      const spoke = new THREE.BoxGeometry(0.035, 0.205, 0.038);
      spoke.translate(0, 0.13, 0);
      spoke.applyMatrix4(new THREE.Matrix4().makeRotationX(a));
      spoke.translate(face * 0.088, 0, 0);
      add(spoke);
    }
    const hub = new THREE.CylinderGeometry(0.072, 0.072, 0.034, 24);
    hub.rotateZ(Math.PI / 2);
    hub.translate(face * 0.1, 0, 0);
    add(hub);
  }
  const merged = mergeGeometries(parts, false);
  RIM_GT_GEO = merged;
  return merged;
}

function rimLmGeometry() {
  if (RIM_LM_GEO) return RIM_LM_GEO;
  const parts = [];
  const barrel = new THREE.CylinderGeometry(0.256, 0.256, 0.24, 40, 1, true);
  barrel.rotateZ(Math.PI / 2);
  parts.push(barrel);
  for (const face of [-1, 1]) {
    const backing = new THREE.CylinderGeometry(0.23, 0.23, 0.05, 32);
    backing.rotateZ(Math.PI / 2);
    backing.translate(face * 0.075, 0, 0);
    parts.push(backing);
  }
  const merged = mergeGeometries(parts, false);
  RIM_LM_GEO = merged;
  return merged;
}

function brakeGeometry() {
  if (BRAKE_GEO) return BRAKE_GEO;
  const disc = new THREE.CylinderGeometry(0.185, 0.185, 0.026, 36);
  disc.rotateZ(Math.PI / 2);
  BRAKE_GEO = disc;
  return disc;
}

function caliperGeometry() {
  if (CALIPER_GEO) return CALIPER_GEO;
  CALIPER_GEO = new RoundedBoxGeometry(0.07, 0.17, 0.11, 3, 0.02);
  return CALIPER_GEO;
}

function shadowTexture() {
  if (SHADOW_TEX) return SHADOW_TEX;
  const canvas = radialTexture(128, 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0)');
  SHADOW_TEX = canvasTexture(canvas, { srgb: false });
  SHADOW_TEX.wrapS = SHADOW_TEX.wrapT = THREE.ClampToEdgeWrapping;
  return SHADOW_TEX;
}

/* =========================================================================
   Livery artwork
   ========================================================================= */

function sideLiveryTexture(style, number) {
  const w = 2048, h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  if (style === 'gt3') {
    // Clean works-style GT3 livery: a red sweep through the rocker, a white
    // number panel, and a triangular motif over the rear quarter.
    ctx.fillStyle = '#f0263c';
    ctx.beginPath();
    ctx.moveTo(0, 462);
    ctx.lineTo(330, 372);
    ctx.lineTo(720, 330);
    ctx.lineTo(1130, 342);
    ctx.lineTo(1500, 318);
    ctx.lineTo(2048, 250);
    ctx.lineTo(2048, 422);
    ctx.lineTo(1530, 410);
    ctx.lineTo(1120, 436);
    ctx.lineTo(700, 462);
    ctx.lineTo(330, 512);
    ctx.lineTo(0, 512);
    ctx.closePath();
    ctx.fill();
    // white pinstripe following the top edge of the red sweep
    ctx.strokeStyle = 'rgba(248,245,238,0.92)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(0, 454);
    ctx.lineTo(330, 365);
    ctx.lineTo(720, 323);
    ctx.lineTo(1130, 335);
    ctx.lineTo(1500, 311);
    ctx.lineTo(2048, 242);
    ctx.stroke();
    // triangular mesh on the rear quarter
    ctx.strokeStyle = 'rgba(248,245,238,0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      const x = 1560 + i * 48;
      ctx.beginPath();
      ctx.moveTo(x, 100);
      ctx.lineTo(x + 70, 165);
      ctx.lineTo(x - 8, 192);
      ctx.stroke();
    }
    // race number panel
    ctx.save();
    ctx.translate(850, 120);
    ctx.fillStyle = 'rgba(248,246,240,0.98)';
    roundRect(ctx, 0, 0, 320, 275, 8); ctx.fill();
    ctx.strokeStyle = '#f0263c'; ctx.lineWidth = 8; ctx.stroke();
    ctx.fillStyle = '#17191d';
    ctx.font = '900 205px "Arial Narrow", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(number, 160, 220);
    ctx.fillStyle = '#6d7278'; ctx.font = '700 19px "Arial Narrow", sans-serif';
    ctx.fillText('STRADALE  MOTORSPORT', 160, 253);
    ctx.restore();
    ctx.fillStyle = 'rgba(248,245,238,0.96)';
    ctx.font = '800 43px "Arial Narrow", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('VELOCITY', 1350, 258);
    ctx.font = '600 19px "Arial Narrow", sans-serif';
    ctx.fillText('APEX RACING FUEL', 1350, 289);
    ctx.fillStyle = '#f8f5ee';
    ctx.font = '700 22px "Arial Narrow", sans-serif';
    ctx.fillText('GT3  /  #' + number, 72, 348);
    // small red accents forward and aft
    ctx.fillStyle = '#f0263c';
    ctx.beginPath(); ctx.moveTo(0, 250); ctx.lineTo(180, 286); ctx.lineTo(0, 320); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(2048, 88); ctx.lineTo(1900, 120); ctx.lineTo(2048, 152); ctx.closePath(); ctx.fill();
  } else {
    // Martini-style blue/red sweep along the LM body.
    const bands = [
      { y: 300, h: 26, color: '#1c2c63', off: 0 },
      { y: 330, h: 36, color: '#3e8cc3', off: 10 },
      { y: 370, h: 20, color: '#d12f3d', off: 18 },
      { y: 394, h: 30, color: '#2b5d9b', off: 24 },
    ];
    for (const b of bands) {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(0, b.y);
      ctx.bezierCurveTo(520, b.y - 12, 920, b.y + 14 + b.off, 1250, b.y - 30);
      ctx.lineTo(2048, b.y - 40);
      ctx.lineTo(2048, b.y + b.h);
      ctx.lineTo(1280, b.y + b.h - 12);
      ctx.bezierCurveTo(960, b.y + b.h + 18, 520, b.y + b.h - 10, 0, b.y + b.h);
      ctx.closePath(); ctx.fill();
    }
    // white/black number roundel
    ctx.save();
    ctx.translate(1140, 170);
    ctx.fillStyle = 'rgba(249,247,241,0.98)';
    ctx.beginPath(); ctx.arc(0, 0, 132, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#c92333'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(0, 0, 126, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#1a1b1e';
    ctx.font = '900 170px "Arial Narrow", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(number, 0, 60);
    ctx.fillStyle = '#4c5055'; ctx.font = '700 18px "Arial Narrow", sans-serif';
    ctx.fillText('AURELIA  ENDURANCE', 0, -84);
    ctx.restore();
    ctx.fillStyle = '#222a3d';
    ctx.font = '800 38px "Arial Narrow", sans-serif';
    ctx.fillText('AURELIA', 140, 248);
    ctx.fillStyle = '#c92635'; ctx.fillRect(140, 258, 240, 5);
    ctx.fillStyle = '#4a5260'; ctx.font = '600 18px "Arial Narrow", sans-serif';
    ctx.fillText('HYBRID  /  LM  /  #' + number, 140, 286);
    ctx.fillStyle = '#f4f1e8'; ctx.font = '800 34px "Arial Narrow", sans-serif';
    ctx.fillText('24H  SERIES', 1560, 258);
  }
  const tex = canvasTexture(c, { anisotropy: 8 });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function roofLiveryTexture(style) {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, s, s);
  if (style === 'gt3') {
    ctx.strokeStyle = 'rgba(239,41,64,0.92)';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const x = 20 + i * 36;
      ctx.beginPath();
      ctx.moveTo(x, 60);
      ctx.lineTo(x + 66, 238 + (i % 4) * 30);
      ctx.lineTo(x + 18, 315 + (i % 3) * 24);
      ctx.stroke();
    }
    ctx.fillStyle = '#ef2940';
    ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(512, 0); ctx.lineTo(512, 34); ctx.lineTo(0, 58); ctx.closePath(); ctx.fill();
  } else {
    const bands = [
      [156, 32, '#1b2b5e'], [194, 42, '#3c88bd'], [242, 28, '#d12f3d'], [274, 30, '#1b2b5e'],
    ];
    for (const [x, width, color] of bands) {
      ctx.fillStyle = color;
      ctx.fillRect(x, 0, width, 512);
    }
    ctx.fillStyle = '#f7f4ea';
    ctx.font = '900 66px "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('12', 234, 330);
  }
  const tex = canvasTexture(c, { anisotropy: 8 });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function bannerTexture(style) {
  const c = makeCanvas(512, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(10,11,12,0.86)';
  ctx.fillRect(0, 0, 512, 64);
  ctx.fillStyle = '#f0ede5';
  ctx.font = '800 31px "Arial Narrow", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(style === 'gt3' ? 'STRADALE  ·  GT3' : 'AURELIA  ·  ENDURANCE', 256, 41);
  const tex = canvasTexture(c, { anisotropy: 8 });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function rearPlateTexture(style, number) {
  const c = makeCanvas(512, 220);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2efe6';
  ctx.fillRect(0, 0, 512, 220);
  ctx.strokeStyle = '#171819'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, 504, 212);
  ctx.fillStyle = '#171819';
  ctx.font = '900 166px "Arial Narrow", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(number, 256, 172);
  ctx.fillStyle = '#8a857a'; ctx.font = '600 16px "Arial Narrow", sans-serif';
  ctx.fillText(style === 'gt3' ? 'STRADALE GT3' : 'AURELIA LM', 256, 200);
  const tex = canvasTexture(c, { anisotropy: 8 });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function decalMaterial(tex, opacity = 1) {
  const key = tex.uuid + ':' + opacity;
  if (DECAL_MATS.has(key)) return DECAL_MATS.get(key);
  const m = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity, depthWrite: false,
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  });
  DECAL_MATS.set(key, m);
  return m;
}

/* =========================================================================
   Geometry helpers
   ========================================================================= */

function matrixFrom(pos, rot = null, scale = null) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  if (rot) q.setFromEuler(new THREE.Euler(rot.x || 0, rot.y || 0, rot.z || 0));
  m.compose(
    new THREE.Vector3(pos.x, pos.y, pos.z), q,
    new THREE.Vector3(scale?.x ?? 1, scale?.y ?? 1, scale?.z ?? 1),
  );
  return m;
}

function addBeam(bucket, a, b, radius, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const geo = new THREE.CylinderGeometry(radius, radius, dir.length(), 8);
  const q = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, dir.clone().normalize());
  geo.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1),
  ));
  bucket.push(geo);
}

const BODY = {
  gt3: {
    width: 1.98,
    length: 4.55,
    wheelFront: 1.48,
    wheelRear: -1.36,
    roofBase: 0.79,
    cabinFront: 0.84,
    cabinRear: -1.18,
    roofTop: 1.235,
  },
  lm: {
    width: 2.02,
    length: 4.58,
    wheelFront: 1.46,
    wheelRear: -1.37,
    roofBase: 0.72,
    cabinFront: 0.64,
    cabinRear: -1.03,
    roofTop: 1.12,
  },
};

function makeBodyGeometry(style) {
  const cfg = BODY[style];
  const wheelZ = cfg.wheelFront;
  const rearZ = cfg.wheelRear;
  const archY = 0.38;
  const archR = 0.46;
  const shape = new THREE.Shape();
  shape.moveTo(-2.22, 0.31);
  shape.lineTo(-1.79, 0.26);
  shape.absarc(rearZ, archY, archR, Math.PI, 0, true);
  shape.lineTo(wheelZ - archR, 0.25);
  shape.absarc(wheelZ, archY, archR, Math.PI, 0, true);
  shape.lineTo(2.09, 0.22);
  if (style === 'gt3') {
    shape.quadraticCurveTo(2.34, 0.30, 2.32, 0.48);
    shape.quadraticCurveTo(2.28, 0.61, 2.07, 0.68);
    shape.quadraticCurveTo(1.55, 0.76, 1.05, 0.79);
    shape.quadraticCurveTo(0.45, 0.82, -0.05, 0.84);
    shape.quadraticCurveTo(-0.72, 0.87, -1.25, 0.91);
    shape.quadraticCurveTo(-1.88, 0.95, -2.11, 0.84);
    shape.quadraticCurveTo(-2.33, 0.70, -2.30, 0.50);
    shape.quadraticCurveTo(-2.31, 0.37, -2.22, 0.31);
  } else {
    shape.quadraticCurveTo(2.30, 0.27, 2.30, 0.40);
    shape.quadraticCurveTo(2.26, 0.52, 2.04, 0.57);
    shape.quadraticCurveTo(1.55, 0.63, 1.02, 0.68);
    shape.quadraticCurveTo(0.45, 0.72, -0.05, 0.75);
    shape.quadraticCurveTo(-0.7, 0.79, -1.22, 0.84);
    shape.quadraticCurveTo(-1.85, 0.88, -2.08, 0.78);
    shape.quadraticCurveTo(-2.32, 0.66, -2.28, 0.45);
    shape.quadraticCurveTo(-2.28, 0.36, -2.22, 0.31);
  }
  // close along bottom
  shape.lineTo(-2.22, 0.31);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: cfg.width - 0.14,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.06,
    bevelSegments: 5,
    curveSegments: 24,
    steps: 1,
  });
  geo.translate(0, 0, -(cfg.width - 0.14) / 2);
  geo.rotateY(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const pinch = 1 - (style === 'gt3' ? 0.075 : 0.05) * Math.pow(Math.min(1, Math.abs(z) / 2.25), 2.4);
    const wheelBulge = Math.exp(-Math.pow((Math.abs(z) - 1.42) / 0.62, 2));
    const heightBand = 0.58 + 0.42 * Math.min(1, Math.max(0, (y - 0.30) / 0.42));
    const rearHaunch = style === 'lm' ? 0.042 * Math.exp(-Math.pow((z + 1.38) / 0.7, 2)) : 0;
    const newX = x * pinch + Math.sign(x) * (wheelBulge * heightBand * 0.08 + rearHaunch);
    const topness = Math.min(1, Math.max(0, (y - 0.52) / 0.32));
    const crown = 0.03 * topness * (1 - Math.pow(Math.min(1, Math.abs(newX) / 1.1), 2));
    pos.setX(i, newX);
    pos.setY(i, y + crown);
  }
  geo.computeVertexNormals();
  return geo;
}

function topSurfaceY(style, z) {
  const key = style === 'gt3'
    ? [[-2.2, 0.66], [-1.9, 0.86], [-1.25, 0.92], [-0.4, 0.86], [0.4, 0.82], [1.1, 0.77], [1.8, 0.7], [2.2, 0.55]]
    : [[-2.25, 0.6], [-1.9, 0.82], [-1.2, 0.86], [-0.4, 0.79], [0.4, 0.72], [1.0, 0.68], [1.6, 0.63], [2.1, 0.56], [2.3, 0.42]];
  if (z <= key[0][0]) return key[0][1];
  for (let i = 1; i < key.length; i++) {
    if (z <= key[i][0]) {
      const [z0, y0] = key[i - 1], [z1, y1] = key[i];
      return THREE.MathUtils.lerp(y0, y1, (z - z0) / (z1 - z0));
    }
  }
  return key[key.length - 1][1];
}

function makeCabinGeometry(style) {
  const cfg = BODY[style];
  const top = cfg.roofTop;
  const base = cfg.roofBase;
  const shape = new THREE.Shape();
  shape.moveTo(cfg.cabinFront, base);
  if (style === 'gt3') {
    shape.quadraticCurveTo(0.58, 1.02, 0.28, top);
    shape.lineTo(-0.58, top - 0.01);
    shape.quadraticCurveTo(-0.9, 1.02, cfg.cabinRear, base + 0.02);
  } else {
    shape.quadraticCurveTo(0.38, 0.94, 0.10, top);
    shape.lineTo(-0.4, top - 0.01);
    shape.quadraticCurveTo(-0.7, 0.9, cfg.cabinRear, base + 0.02);
  }
  shape.lineTo(cfg.cabinRear + 0.03, base - 0.01);
  shape.lineTo(cfg.cabinFront - 0.02, base - 0.01);
  shape.closePath();
  const width = style === 'gt3' ? 1.38 : 1.44;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.038,
    bevelSegments: 4,
    curveSegments: 20,
    steps: 1,
  });
  geo.translate(0, 0, -width / 2);
  geo.rotateY(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const narrow = 1 - Math.max(0, y - base) * (style === 'gt3' ? 0.3 : 0.36);
    const backTaper = 1 - Math.max(0, -z - 0.8) * 0.035;
    pos.setX(i, x * narrow * backTaper);
  }
  geo.computeVertexNormals();
  return geo;
}

function makeQuadStrip(xCenter, width, z0, z1, style, segments = 24) {
  const pos = [], uv = [], index = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const z = THREE.MathUtils.lerp(z0, z1, t);
    const y = topSurfaceY(style, z) + 0.09;
    pos.push(xCenter - width / 2, y, z, xCenter + width / 2, y, z);
    uv.push(0, t, 1, t);
    if (i < segments) {
      const j = i * 2;
      index.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

// Livery-side surface that follows the body's plan taper instead of floating
// beside it as a flat billboard.
function sideSurfaceX(style, z, y) {
  const cfg = BODY[style];
  const pinch = 1 - (style === 'gt3' ? 0.075 : 0.05) * Math.pow(Math.min(1, Math.abs(z) / 2.25), 2.4);
  const wheelBulge = Math.exp(-Math.pow((Math.abs(z) - 1.42) / 0.62, 2));
  const heightBand = 0.58 + 0.42 * Math.min(1, Math.max(0, (y - 0.30) / 0.42));
  const rearHaunch = style === 'lm' ? 0.042 * Math.exp(-Math.pow((z + 1.38) / 0.7, 2)) : 0;
  return (cfg.width / 2 + 0.075) * pinch + wheelBulge * heightBand * 0.08 + rearHaunch + 0.006;
}

function makeSideDecalGeometry(style, side, z0, z1, y0, y1, segments = 22) {
  const pos = [], uv = [], index = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const z = THREE.MathUtils.lerp(z0, z1, t);
    const u = side > 0 ? 1 - t : t;
    for (let j = 0; j <= 1; j++) {
      const y = j ? y1 : y0;
      pos.push(side * sideSurfaceX(style, z, y), y, z);
      uv.push(u, j);
    }
    if (i < segments) {
      const a = i * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/* =========================================================================
   Car model
   ========================================================================= */

let HEADLIGHT_GLOW = null;
function headlightGlowTexture() {
  if (HEADLIGHT_GLOW) return HEADLIGHT_GLOW;
  HEADLIGHT_GLOW = canvasTexture(
    radialTexture(128, 'rgba(255,252,238,1)', 'rgba(255,224,150,0)'),
    { anisotropy: 4 },
  );
  return HEADLIGHT_GLOW;
}

export class CarModel {
  constructor(def, paintHex, options = {}) {
    this.def = def;
    this.style = def.model?.style || 'gt3';
    this.paintHex = paintHex;
    this.isPlayer = options.isPlayer ?? false;
    this.number = String(options.number || def.model?.number || '33');
    this.ai = options.ai ?? !this.isPlayer;
    this.night = Boolean(options.night);
    this.headlights = [];
    this.headlightGlows = [];
    this.root = new THREE.Group();
    this.root.name = `Car:${def.name}`;
    this.chassis = new THREE.Group();
    this.root.add(this.chassis);
    this.buckets = new Map();
    this.wheels = [];
    this.wheelAngle = 0;
    this.lean = 0;
    this.pitch = 0;
    this.P = sharedMaterials();
    // 有 AI 生成的车体 GLB 就直接用，否则回退到程序化车身
    this.glbBody = null;
    this.glbDesat = options.glbDesat ?? (this.ai ? 0.42 : 0);
    this.useGlb = options.useGlb !== false && hasCarModel(this.style);
    this.build(paintHex);
    const cfg = BODY[this.style];
    this.boostLevel = 0;
    this.boostEffect = createBoostFlames(cfg.width, cfg.length, { isPlayer: this.isPlayer });
    this.boostFlames = this.boostEffect.sprites;
    this.chassis.add(this.boostEffect.group);
    this.addShadow();
    if (this.night) this.buildHeadlights();
    this.root.userData.car = this;
  }

  /** 夜间车灯：玩家车带真实聚光灯光束，所有车都补一对灯组辉光。 */
  buildHeadlights() {
    const cfg = BODY[this.style];
    const lampY = this.style === 'lm' ? 0.52 : 0.62;
    const lampZ = cfg.length / 2 + 0.04;
    const offsetX = cfg.width * 0.3;
    const glowTex = headlightGlowTexture();

    for (const side of [-1, 1]) {
      const x = side * offsetX;
      if (this.isPlayer) {
        const target = new THREE.Object3D();
        // 大灯中心压到车前约 8–9 米的路面上，别再照到远处门架和广告牌
        target.position.set(x, lampY - 2.2, 30);
        this.chassis.add(target);
        const light = new THREE.SpotLight(0xfff0d2, 520, 75, 0.32, 0.6, 1.8);
        light.position.set(x, lampY, lampZ);
        light.target = target;
        light.castShadow = false;
        this.chassis.add(light);
        this.headlights.push(light);
      }

      const glowMat = new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xfff3d8,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const glow = new THREE.Sprite(glowMat);
      glow.scale.set(0.9, 0.52, 1);
      glow.position.set(x, lampY, lampZ + 0.05);
      glow.renderOrder = 5;
      this.chassis.add(glow);
      this.headlightGlows.push(glow);
    }
  }

  bucket(mat) {
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    return this.buckets.get(mat);
  }

  add(geo, mat, pos = null, rot = null, scale = null) {
    if (pos || rot || scale) geo.applyMatrix4(matrixFrom(pos ?? { x: 0, y: 0, z: 0 }, rot, scale));
    const prepared = geo.index ? geo.toNonIndexed() : geo;
    this.bucket(mat).push(prepared);
    return geo;
  }

  addRounded(w, h, d, r, mat, pos, rot = null) {
    return this.add(new RoundedBoxGeometry(w, h, d, 3, r), mat, pos, rot);
  }

  decal(tex, w, h, pos, rot, opacity = 1) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), decalMaterial(tex, opacity));
    mesh.position.set(pos.x, pos.y, pos.z);
    if (rot) mesh.rotation.set(rot.x || 0, rot.y || 0, rot.z || 0);
    mesh.renderOrder = 5;
    mesh.castShadow = false;
    this.chassis.add(mesh);
    return mesh;
  }

  build(paintHex) {
    const P = this.P;
    const cfg = BODY[this.style];
    if (this.useGlb) {
      this.buildFromGlb(paintHex);
      return;
    }
    const sideSkin = this.style === 'lm' ? 1.075 : 1.06;
    this.paintMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(paintHex),
      metalness: this.style === 'lm' ? 0.28 : 0.44,
      roughness: this.style === 'lm' ? 0.18 : 0.21,
      clearcoat: 1.0,
      clearcoatRoughness: 0.035,
      envMapIntensity: 2.0,
      sheen: 0.02,
      sheenColor: new THREE.Color(0xffe8d1),
    });
    const accentColor = this.style === 'gt3' ? '#e21f37' : '#cf2032';
    this.accentMaterial = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.38, metalness: 0.35 });
    this.tailMaterial = new THREE.MeshStandardMaterial({
      color: 0x1c0302, emissive: 0xff1a0b, emissiveIntensity: 2.4,
      roughness: 0.22, metalness: 0.2,
    });
    this.reverseMaterial = new THREE.MeshStandardMaterial({
      color: 0x151515, emissive: 0xfff5e2, emissiveIntensity: 0, roughness: 0.25,
    });
    this.caliperMaterial = new THREE.MeshStandardMaterial({
      color: this.style === 'lm' ? '#e0b84b' : '#e02432', roughness: 0.32, metalness: 0.45,
    });

    // --- body shell -------------------------------------------------------
    const body = makeBodyGeometry(this.style);
    this.add(body, this.paintMaterial);
    this.add(new THREE.BoxGeometry(1.7, 0.17, 4.0), P.black, { x: 0, y: 0.18, z: 0 });
    // wheel well darkness
    // (the dark inner arch is provided by the body sides and tire barrels;
    // a full half-cylinder here would arch above the low nose)

    // A painted fender shell bridges the low body over each wheel. Without it
    // the extruded body would leave the wheel arch open above the bonnet line.
    for (const side of [-1, 1]) {
      for (const z of [cfg.wheelFront, cfg.wheelRear]) {
        const shell = new THREE.CylinderGeometry(0.49, 0.49, 0.44, 28, 1, true, 0, Math.PI);
        shell.rotateZ(Math.PI / 2);
        this.add(shell, this.paintMaterial, { x: side * 0.86, y: 0.4, z });
        const face = new THREE.RingGeometry(0.435, 0.55, 28, 1, 0, Math.PI);
        face.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2);
        this.add(face, P.black, { x: side * 1.078, y: 0.4, z });
        const trim = new THREE.RingGeometry(0.525, 0.55, 28, 1, 0, Math.PI);
        trim.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2);
        this.add(trim, this.paintMaterial, { x: side * 1.08, y: 0.4, z });
        const lip = new THREE.TorusGeometry(0.477, 0.018, 6, 28, Math.PI);
        lip.rotateY(Math.PI / 2);
        this.add(lip, P.carbonDark, { x: side * 1.082, y: 0.4, z });
      }
      this.addRounded(0.032, 0.045, 3.5, 0.012, this.paintMaterial, { x: side * 0.958, y: 0.66, z: -0.05 });
      this.addRounded(0.02, 0.025, 2.9, 0.008, P.black, { x: side * 0.976, y: 0.58, z: -0.03 });
    }

    // remove the old arch trims (replaced by the painted shell above)


    // --- cockpit ----------------------------------------------------------
    this.add(makeCabinGeometry(this.style), P.glass);
    const roofW = this.style === 'gt3' ? 1.15 : 1.18;
    this.addRounded(roofW, 0.075, 1.05, 0.034, this.paintMaterial, { x: 0, y: cfg.roofTop + 0.02, z: -0.28 });
    for (const side of [-1, 1]) {
      const aBase = new THREE.Vector3(side * 0.655, cfg.roofBase + 0.015, this.style === 'gt3' ? 0.84 : 0.64);
      const aTop = new THREE.Vector3(side * 0.53, cfg.roofTop + 0.005, this.style === 'gt3' ? 0.24 : 0.06);
      addBeam(this.bucket(this.paintMaterial), aBase, aTop, 0.032, this.paintMaterial);
      const cBase = new THREE.Vector3(side * 0.67, cfg.roofBase + 0.015, this.style === 'gt3' ? -1.16 : -1.02);
      const cTop = new THREE.Vector3(side * 0.54, cfg.roofTop + 0.005, this.style === 'gt3' ? -0.66 : -0.46);
      addBeam(this.bucket(this.paintMaterial), cBase, cTop, 0.04, this.paintMaterial);
      addBeam(this.bucket(P.black), new THREE.Vector3(side * 0.68, cfg.roofBase + 0.02, -0.15), new THREE.Vector3(side * 0.57, cfg.roofTop, -0.15), 0.018, P.black);
      // roof rail
      this.addRounded(0.07, 0.026, 0.9, 0.012, this.paintMaterial, { x: side * 0.58, y: cfg.roofTop + 0.06, z: -0.28 });
      // aero mirrors on shorter stalks
      addBeam(this.bucket(P.black), new THREE.Vector3(side * 0.68, cfg.roofBase + 0.09, 0.54), new THREE.Vector3(side * 1.0, cfg.roofBase + 0.17, 0.5), 0.018, P.black);
      this.addRounded(0.15, 0.085, 0.235, 0.035, this.style === 'gt3' ? this.accentMaterial : this.paintMaterial, { x: side * 1.06, y: cfg.roofBase + 0.19, z: 0.47 }, { y: side * 0.1 });
      this.add(new THREE.PlaneGeometry(0.2, 0.06), P.glassLight, { x: side * 1.137, y: cfg.roofBase + 0.19, z: 0.46 }, { y: side * Math.PI / 2 });
      // black window surround and B-pillar
      const cabinEdge = this.style === 'lm' ? 0.755 : 0.735;
      this.addRounded(0.06, 0.06, 1.72, 0.025, this.paintMaterial, { x: side * (cabinEdge - 0.005), y: cfg.roofBase + 0.025, z: -0.2 });
      this.addRounded(0.014, 0.026, 1.65, 0.006, P.black, { x: side * (cabinEdge + 0.025), y: cfg.roofBase + 0.015, z: -0.2 });
      addBeam(this.bucket(P.black), new THREE.Vector3(side * (cabinEdge - 0.005), cfg.roofBase + 0.02, -0.24), new THREE.Vector3(side * 0.56, cfg.roofTop + 0.005, -0.3), 0.028, P.black);
      this.addRounded(0.03, 0.37, 0.06, 0.012, P.black, { x: side * (cabinEdge + 0.018), y: (cfg.roofBase + cfg.roofTop) / 2 + 0.01, z: -0.26 });
      this.addRounded(0.014, 0.02, 0.95, 0.005, P.black, { x: side * 0.585, y: cfg.roofTop + 0.065, z: -0.26 });
      this.addRounded(0.02, 0.02, 1.1, 0.006, P.black, { x: side * (cabinEdge + 0.02), y: cfg.roofTop - 0.015, z: -0.35 });
      addBeam(this.bucket(P.black), new THREE.Vector3(side * (cabinEdge + 0.015), cfg.roofBase + 0.03, cfg.cabinFront - 0.02), new THREE.Vector3(side * 0.58, cfg.roofTop + 0.02, 0.27), 0.02, P.black);
      // black rear quarter sail blends into the canopy and frames the glass
      const sailMat = new THREE.MeshStandardMaterial({
        color: 0x060708, roughness: 0.18, metalness: 0.45, side: THREE.DoubleSide,
        envMapIntensity: 1.4,
      });
      const sail = new THREE.BufferGeometry();
      sail.setAttribute('position', new THREE.Float32BufferAttribute([
        side * (cabinEdge + 0.005), cfg.roofTop - 0.01, -0.48,
        side * (cabinEdge + 0.005), cfg.roofBase + 0.02, -1.17,
        side * (cabinEdge + 0.005), cfg.roofBase + 0.02, -0.7,
      ], 3));
      sail.setIndex([0, 1, 2]);
      sail.computeVertexNormals();
      const sailMesh = new THREE.Mesh(sail, sailMat);
      sailMesh.renderOrder = 2;
      this.chassis.add(sailMesh);
      // wiper resting at the base of the windscreen
      const wiper = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.52, 5), P.black);
      wiper.rotation.z = -0.22;
      wiper.rotation.x = 0.15;
      wiper.position.set(side * 0.05, cfg.roofBase + 0.06, cfg.cabinFront - 0.03);
      this.chassis.add(wiper);
      // door shut lines and fuel filler
      this.add(new THREE.BoxGeometry(0.006, 0.5, 0.01), P.black, { x: side * (sideSkin + 0.014), y: 0.48, z: this.style === 'gt3' ? 0.78 : 0.68 });
      this.add(new THREE.BoxGeometry(0.006, 0.44, 0.01), P.black, { x: side * (sideSkin + 0.014), y: 0.48, z: this.style === 'gt3' ? -0.88 : -0.82 });
      const cap = new THREE.CylinderGeometry(0.05, 0.05, 0.018, 16);
      cap.rotateZ(Math.PI / 2);
      this.add(cap, P.chrome, { x: side * (sideSkin + 0.02), y: 0.68, z: this.style === 'gt3' ? -0.72 : -0.66 });
      // flush door handle / side detail
      this.add(new THREE.BoxGeometry(0.01, 0.016, 0.15), P.chrome, { x: side * (sideSkin + 0.018), y: cfg.roofBase - 0.1, z: -0.28 });
    }

    // roof antenna
    const antenna = new THREE.CylinderGeometry(0.006, 0.011, 0.28, 5);
    this.add(antenna, P.black, { x: 0, y: cfg.roofTop + 0.18, z: -0.55 });

    // --- side aero and details -------------------------------------------
    for (const side of [-1, 1]) {
      // carbon side skirt with fins
      this.addRounded(0.052, 0.055, 2.05, 0.016, P.carbon, { x: side * (sideSkin - 0.012), y: 0.155, z: -0.03 });
      for (let i = 0; i < 3; i++) {
        this.addRounded(0.024, 0.1, 0.24, 0.008, P.carbonDark, { x: side * (sideSkin + 0.012), y: 0.19, z: -0.65 + i * 0.5 });
      }
      // red pin line along the skirt (GT3 only)
      if (this.style === 'gt3') {
        this.add(new THREE.BoxGeometry(0.012, 0.012, 1.8), this.accentMaterial, { x: side * (sideSkin + 0.048), y: 0.225, z: -0.05 });
      }
      // rear wheel air intake
      this.addRounded(0.03, 0.28, 0.62, 0.035, P.pianoBlack, { x: side * (sideSkin + 0.002), y: 0.54, z: -0.92 }, { z: side * 0.06 });
      this.addRounded(0.03, 0.035, 0.48, 0.012, P.carbon, { x: side * (sideSkin + 0.02), y: 0.63, z: -0.92 });
      // front fender exit vent
      for (let i = 0; i < 3; i++) {
        this.addRounded(0.012, 0.045, 0.24, 0.008, P.carbon, { x: side * (sideSkin + 0.004), y: 0.6 + i * 0.055, z: 0.87 }, { z: side * 0.12 });
      }
      // fender louvers above front arch
      for (let i = 0; i < 3; i++) {
        this.addRounded(0.2, 0.012, 0.055, 0.006, P.black, { x: side * 0.72, y: 0.8, z: 1.16 + i * 0.065 }, { z: side * 0.05 });
      }
      // rear quarter vent
      this.addRounded(0.012, 0.12, 0.5, 0.025, P.pianoBlack, { x: side * (sideSkin + 0.002), y: 0.65, z: -1.62 });
      for (let i = 0; i < 3; i++) {
        this.add(new THREE.BoxGeometry(0.012, 0.016, 0.43), P.carbon, { x: side * (sideSkin + 0.012), y: 0.62 + i * 0.045, z: -1.62 });
      }
    }

    // rounded lower bumper volume: keeps the nose from reading as one flat slab
    if (this.style === 'gt3') {
      const nose = new THREE.SphereGeometry(1, 24, 12);
      nose.scale(0.86, 0.14, 0.2);
      this.add(nose, this.paintMaterial, { x: 0, y: 0.34, z: 2.09 });
    } else {
      const nose = new THREE.SphereGeometry(1, 24, 12);
      nose.scale(0.93, 0.15, 0.18);
      this.add(nose, this.paintMaterial, { x: 0, y: 0.32, z: 2.1 });
    }
    // --- front fascia -----------------------------------------------------
    this.buildFront();
    // --- rear fascia ------------------------------------------------------
    this.buildRear();
    // --- livery -----------------------------------------------------------
    this.buildLivery();
    // --- wing -------------------------------------------------------------
    this.buildWing();
    // --- wheels -----------------------------------------------------------
    this.buildWheels();
    this.flushBuckets();
  }

  /**
   * AI 车体模式：整块烘焙好的 GLB 车身 + 动态尾灯辉光。
   * 轮组已烘进模型，所以不再生成程序化轮圈。
   */
  buildFromGlb(paintHex) {
    const cfg = BODY[this.style];
    this.paintMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(paintHex),
      metalness: 0.5,
      roughness: 0.22,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.8,
    });
    this.tailMaterial = new THREE.MeshStandardMaterial({
      color: 0x1c0302, emissive: 0xff1a0b, emissiveIntensity: 2.4,
      roughness: 0.22, metalness: 0.2,
    });
    this.reverseMaterial = new THREE.MeshStandardMaterial({
      color: 0x151515, emissive: 0xfff5e2, emissiveIntensity: 0, roughness: 0.25,
    });
    this.caliperMaterial = new THREE.MeshStandardMaterial({
      color: this.style === 'lm' ? '#e0b84b' : '#e02432', roughness: 0.32, metalness: 0.45,
    });

    const body = createCarBody(this.style, paintHex, { desat: this.glbDesat });
    if (body) {
      this.glbBody = body;
      this.chassis.add(body);
    } else {
      this.useGlb = false;
      this.build(paintHex);
      return;
    }

    const glows = createBrakeGlows(cfg.width, cfg.length);
    this.chassis.add(glows.group);
    this.brakeGlows = glows.sprites;

    this.flushBuckets();
  }

  buildFront() {
    const P = this.P;
    const style = this.style;
    const frontZ = 2.18;
    if (style === 'gt3') {
      // big splitter and canards
      this.addRounded(2.08, 0.055, 0.38, 0.012, P.carbon, { x: 0, y: 0.12, z: 2.12 });
      this.addRounded(0.18, 0.16, 0.05, 0.012, P.carbonDark, { x: -1.02, y: 0.2, z: 2.09 });
      this.addRounded(0.18, 0.16, 0.05, 0.012, P.carbonDark, { x: 1.02, y: 0.2, z: 2.09 });
      for (const side of [-1, 1]) {
        this.addRounded(0.38, 0.028, 0.32, 0.01, P.carbon, { x: side * 0.78, y: 0.24, z: 2.14 }, { y: side * 0.14 });
        this.addRounded(0.3, 0.024, 0.26, 0.008, P.carbon, { x: side * 0.79, y: 0.31, z: 2.1 }, { y: side * 0.14 });
      }
      // central grille
      this.addRounded(1.26, 0.29, 0.08, 0.03, P.pianoBlack, { x: 0, y: 0.35, z: 2.35 });
      this.add(new THREE.PlaneGeometry(1.13, 0.22), P.grille, { x: 0, y: 0.35, z: 2.402 });
      for (let i = -1; i <= 1; i++) {
        this.add(new THREE.BoxGeometry(1.02, 0.016, 0.018), P.carbonDark, { x: 0, y: 0.3 + i * 0.05, z: 2.412 });
      }
      this.addRounded(1.34, 0.018, 0.028, 0.006, this.accentMaterial, { x: 0, y: 0.505, z: 2.39 });
      this.addRounded(1.34, 0.018, 0.028, 0.006, this.accentMaterial, { x: 0, y: 0.205, z: 2.39 });
      this.addRounded(1.46, 0.035, 0.045, 0.01, this.accentMaterial, { x: 0, y: 0.53, z: 2.39 });
      // side intakes
      for (const side of [-1, 1]) {
        this.addRounded(0.36, 0.27, 0.08, 0.03, P.pianoBlack, { x: side * 0.73, y: 0.3, z: 2.32 });
        for (let i = 0; i < 3; i++) {
          this.add(new THREE.BoxGeometry(0.3, 0.014, 0.015), P.carbonDark, { x: side * 0.73, y: 0.25 + i * 0.06, z: 2.365 });
        }
        // oval headlights
        const lens = new THREE.SphereGeometry(1, 20, 12);
        lens.scale(0.325, 0.125, 0.075);
        this.add(lens, P.headlightHousing, { x: side * 0.61, y: 0.6, z: 2.34 }, { y: side * 0.12 });
        for (let i = 0; i < 2; i++) {
          const proj = new THREE.CylinderGeometry(0.043, 0.043, 0.025, 16);
          proj.rotateX(Math.PI / 2);
          this.add(proj, P.headlight, { x: side * (0.51 + i * 0.17), y: 0.605, z: 2.41 });
        }
        this.addRounded(0.37, 0.02, 0.025, 0.008, P.drl, { x: side * 0.61, y: 0.675, z: 2.405 }, { z: side * 0.03 });
        // projector trims keep the lamps from reading as a single white bar
        for (let i = 0; i < 2; i++) {
          const ring = new THREE.TorusGeometry(0.052, 0.009, 5, 16);
          ring.rotateY(Math.PI / 2);
          this.add(ring, P.chrome, { x: side * (0.51 + i * 0.17), y: 0.605, z: 2.403 });
        }
        // dive planes
        this.addRounded(0.34, 0.02, 0.25, 0.008, P.carbon, { x: side * 0.73, y: 0.28, z: 2.06 }, { y: side * 0.12 });
      }
      // hood vents
      for (const side of [-1, 1]) {
        this.addRounded(0.42, 0.018, 0.42, 0.02, P.pianoBlack, { x: side * 0.45, y: 0.85, z: 1.42 }, { x: -0.04 });
        for (let i = 0; i < 3; i++) {
          this.add(new THREE.BoxGeometry(0.34, 0.008, 0.045), P.carbonDark, { x: side * 0.45, y: 0.863, z: 1.3 + i * 0.08 });
        }
      }
      // front tow strap
      const tow = new THREE.TorusGeometry(0.047, 0.012, 6, 14, Math.PI * 1.6);
      this.add(tow, this.accentMaterial, { x: 0.62, y: 0.235, z: 2.34 }, { x: 0.3 });
      // bonnet quick-release pins
      for (const side of [-1, 1]) {
        const pin = new THREE.CylinderGeometry(0.02, 0.02, 0.028, 8);
        this.add(pin, P.chrome, { x: side * 0.56, y: 0.845, z: 1.94 });
      }
      // front badge / number
      this.add(new THREE.BoxGeometry(0.26, 0.11, 0.02), P.chrome, { x: 0, y: 0.49, z: 2.34 });
    } else {
      // LM low nose / splitter
      this.addRounded(2.02, 0.045, 0.32, 0.01, P.carbon, { x: 0, y: 0.105, z: 2.11 });
      for (const side of [-1, 1]) {
        this.addRounded(0.28, 0.025, 0.28, 0.008, P.carbon, { x: side * 0.82, y: 0.18, z: 2.08 }, { y: side * 0.1 });
        this.addRounded(0.32, 0.018, 0.24, 0.008, P.carbon, { x: side * 0.83, y: 0.25, z: 2.04 }, { y: side * 0.1 });
        // black headlamp pod with quad LEDs
        this.addRounded(0.46, 0.18, 0.055, 0.035, P.pianoBlack, { x: side * 0.61, y: 0.49, z: 2.37 }, { y: side * 0.1, x: -0.08 });
        for (let ix = 0; ix < 2; ix++) {
          for (let iy = 0; iy < 2; iy++) {
            this.addRounded(0.055, 0.026, 0.02, 0.005, P.headlight, { x: side * (0.52 + ix * 0.12), y: 0.46 + iy * 0.055, z: 2.405 });
          }
        }
        this.addRounded(0.32, 0.014, 0.018, 0.006, P.drl, { x: side * 0.61, y: 0.56, z: 2.405 });
        // hood vents
        this.addRounded(0.36, 0.016, 0.5, 0.02, P.pianoBlack, { x: side * 0.49, y: 0.735, z: 1.28 }, { x: -0.03 });
        for (let i = 0; i < 4; i++) {
          this.add(new THREE.BoxGeometry(0.3, 0.006, 0.03), P.carbon, { x: side * 0.49, y: 0.748, z: 1.12 + i * 0.075 });
        }
      }
      // low central intake
      this.addRounded(1.18, 0.21, 0.08, 0.035, P.pianoBlack, { x: 0, y: 0.3, z: 2.38 });
      this.add(new THREE.PlaneGeometry(0.94, 0.13), P.grille, { x: 0, y: 0.3, z: 2.426 });
      this.addRounded(0.96, 0.035, 0.02, 0.01, this.accentMaterial, { x: 0, y: 0.41, z: 2.425 });
      // nose top vent/indicator
      this.addRounded(0.3, 0.015, 0.2, 0.02, P.black, { x: 0, y: 0.54, z: 2.05 });
      // tow ring
      const tow = new THREE.TorusGeometry(0.045, 0.011, 6, 14, Math.PI * 1.5);
      this.add(tow, this.accentMaterial, { x: -0.58, y: 0.26, z: 2.26 }, { x: 0.3 });
      // bonnet quick-release pins
      for (const side of [-1, 1]) {
        const pin = new THREE.CylinderGeometry(0.02, 0.02, 0.028, 8);
        this.add(pin, P.chrome, { x: side * 0.54, y: 0.745, z: 1.88 });
      }
    }
    // splitter endplates
    for (const side of [-1, 1]) {
      this.addRounded(0.045, 0.17, 0.5, 0.012, P.carbonDark, { x: side * 1.04, y: 0.15, z: 2.05 });
    }
    void frontZ;
  }

  buildRear() {
    const P = this.P;
    const style = this.style;
    // rear valance and diffuser
    this.addRounded(1.82, 0.22, 0.08, 0.03, P.pianoBlack, { x: 0, y: 0.46, z: -2.25 });
    this.addRounded(1.56, 0.36, 0.06, 0.025, P.carbon, { x: 0, y: 0.2, z: -2.25 });
    for (let i = -3; i <= 3; i++) {
      this.add(new THREE.BoxGeometry(0.035, 0.26, 0.23), P.carbonDark, { x: i * 0.21, y: 0.18, z: -2.29 });
    }
    this.addRounded(1.8, 0.08, 0.36, 0.025, P.carbon, { x: 0, y: 0.29, z: -2.22 });
    // taillight bar + vertical ends
    this.addRounded(1.52, 0.062, 0.035, 0.018, this.tailMaterial, { x: 0, y: 0.72, z: -2.31 });
    for (const side of [-1, 1]) {
      this.addRounded(0.055, 0.21, 0.05, 0.018, this.tailMaterial, { x: side * 0.76, y: 0.65, z: -2.3 });
      this.addRounded(0.23, 0.04, 0.025, 0.01, this.reverseMaterial, { x: side * 0.42, y: 0.59, z: -2.32 });
      // rear mesh vents
      this.addRounded(0.26, 0.22, 0.05, 0.03, P.mesh, { x: side * 0.72, y: 0.36, z: -2.28 });
    }
    // exhausts (two large central-ish tips)
    for (const side of [-1, 1]) {
      const pipe = new THREE.CylinderGeometry(0.062, 0.072, 0.2, 18, 1, true);
      pipe.rotateX(Math.PI / 2);
      this.add(pipe, P.titanium, { x: side * 0.35, y: 0.23, z: -2.34 });
      const inner = new THREE.CylinderGeometry(0.045, 0.045, 0.018, 18);
      inner.rotateX(Math.PI / 2);
      this.add(inner, P.black, { x: side * 0.35, y: 0.23, z: -2.33 });
    }
    // rear number plate / brand strip
    const plateTex = rearPlateTexture(style, this.number);
    this.decal(plateTex, 0.46, 0.2, { x: 0, y: 0.57, z: -2.365 }, { y: Math.PI });
    // mesh panel and deck vents
    this.addRounded(1.08, 0.24, 0.045, 0.02, P.mesh, { x: 0, y: 0.56, z: -2.315 });
    this.add(new THREE.PlaneGeometry(1.05, 0.225), P.grille, { x: 0, y: 0.56, z: -2.326 }, { y: Math.PI });
    for (let i = 0; i < 5; i++) {
      this.add(new THREE.BoxGeometry(0.92, 0.012, 0.018), P.carbon, { x: 0, y: 0.47 + i * 0.042, z: -2.337 });
    }
    for (const side of [-1, 1]) {
      this.addRounded(0.19, 0.28, 0.04, 0.02, P.mesh, { x: side * 0.84, y: 0.42, z: -2.32 });
      for (let i = 0; i < 3; i++) {
        this.add(new THREE.BoxGeometry(0.15, 0.018, 0.02), P.carbonDark, { x: side * 0.84, y: 0.33 + i * 0.07, z: -2.345 });
      }
    }
    const deckY = style === 'gt3' ? 0.99 : 0.93;
    if (style === 'gt3') {
      this.addRounded(0.58, 0.018, 0.27, 0.012, P.mesh, { x: 0, y: deckY, z: -1.28 });
      for (let i = 0; i < 4; i++) {
        this.add(new THREE.BoxGeometry(0.5, 0.006, 0.02), P.carbon, { x: 0, y: deckY + 0.013, z: -1.37 + i * 0.055 });
      }
    }
    // brand text
    const brand = makeCanvas(512, 64);
    const bctx = brand.getContext('2d');
    bctx.clearRect(0, 0, 512, 64);
    bctx.fillStyle = '#e9e5da';
    bctx.font = '700 30px "Arial Narrow", sans-serif';
    bctx.textAlign = 'center';
    bctx.fillText(style === 'gt3' ? 'S T R A D A L E' : 'A U R E L I A', 256, 42);
    const brandTex = canvasTexture(brand, { anisotropy: 8 });
    brandTex.wrapS = brandTex.wrapT = THREE.ClampToEdgeWrapping;
    this.decal(brandTex, 0.62, 0.077, { x: 0, y: 0.84, z: -2.3 }, { y: Math.PI });
    // LM ducktail / GT3 gurney base
    if (style === 'lm') {
      this.addRounded(1.92, 0.055, 0.3, 0.02, this.paintMaterial, { x: 0, y: 0.82, z: -2.26 }, { x: -0.13 });
      this.addRounded(1.7, 0.018, 0.08, 0.008, P.carbon, { x: 0, y: 0.87, z: -2.33 }, { x: -0.1 });
    }
  }

  buildWing() {
    const P = this.P;
    const wing = new THREE.Group();
    wing.name = 'rear-wing';
    this.chassis.add(wing);
    this.wingGroup = wing;
    if (this.style === 'gt3') {
      // swan-neck GT3 wing
      const foil = new THREE.Mesh(new RoundedBoxGeometry(2.05, 0.06, 0.36, 3, 0.022), P.carbon);
      foil.position.set(0, 1.27, -1.97);
      foil.rotation.x = -0.12;
      foil.castShadow = true;
      wing.add(foil);
      const gurney = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.055, 0.025), P.carbonDark);
      gurney.position.set(0, 1.31, -2.13);
      wing.add(gurney);
      for (const side of [-1, 1]) {
        const end = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.35, 0.46), P.carbon);
        end.position.set(side * 1.02, 1.27, -1.97);
        end.rotation.x = -0.12;
        end.castShadow = true;
        wing.add(end);
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.46), this.accentMaterial);
        tip.position.set(side * 1.022, 1.435, -1.97);
        tip.rotation.x = -0.12;
        wing.add(tip);
        // swan neck supports
        const curve = new THREE.CubicBezierCurve3(
          new THREE.Vector3(side * 0.55, 0.88, -1.72),
          new THREE.Vector3(side * 0.55, 1.2, -1.86),
          new THREE.Vector3(side * 0.55, 1.24, -1.98),
          new THREE.Vector3(side * 0.55, 1.21, -2.05),
        );
        const support = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.027, 7, false), P.carbon);
        support.castShadow = true;
        wing.add(support);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.07, 0.3), P.carbonDark);
        foot.position.set(side * 0.55, 0.87, -1.74);
        wing.add(foot);
      }
      // brake light in the wing
      const brake = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.025), this.tailMaterial);
      brake.position.set(0, 1.24, -2.14);
      wing.add(brake);
      this.wingFlap = foil;
    } else {
      // integrated low ducktail with a small active flap
      const base = new THREE.Mesh(new RoundedBoxGeometry(1.55, 0.05, 0.26, 3, 0.018), this.paintMaterial);
      base.position.set(0, 0.91, -2.12);
      base.rotation.x = -0.18;
      wing.add(base);
      for (const side of [-1, 1]) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.17, 0.28), P.carbon);
        fin.position.set(side * 0.8, 0.9, -2.1);
        wing.add(fin);
      }
      const gurney = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.018, 0.05), P.carbonDark);
      gurney.position.set(0, 0.94, -2.25);
      wing.add(gurney);
      const brake = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.02), this.tailMaterial);
      brake.position.set(0, 0.93, -2.23);
      wing.add(brake);
      this.wingFlap = base;
    }
  }

  buildLivery() {
    const style = this.style;
    const number = this.number;
    const sideTex = sideLiveryTexture(style, number);
    for (const side of [-1, 1]) {
      const geo = makeSideDecalGeometry(this.style, side, -0.92, 1.02, 0.3, 0.86, 26);
      const mesh = new THREE.Mesh(geo, decalMaterial(sideTex));
      mesh.renderOrder = 6;
      mesh.castShadow = false;
      this.chassis.add(mesh);
    }
    // roof livery
    const roofTex = roofLiveryTexture(style);
    const cfg = BODY[style];
    this.decal(roofTex, 0.92, 0.78, { x: 0, y: cfg.roofTop + 0.065, z: -0.28 }, { x: -Math.PI / 2 }, 0.96);
    // windshield banner
    const bTex = bannerTexture(style);
    this.decal(bTex, 0.82, 0.1, { x: 0, y: cfg.roofTop - 0.06, z: this.style === 'gt3' ? 0.38 : 0.22 }, { x: -0.78 }, 0.95);
    // technical hood decals
    const decal = makeCanvas(512, 512);
    const dctx = decal.getContext('2d');
    dctx.clearRect(0, 0, 512, 512);
    if (style === 'gt3') {
      dctx.strokeStyle = 'rgba(238,35,55,0.9)'; dctx.lineWidth = 6;
      for (let i = 0; i < 7; i++) {
        dctx.beginPath(); dctx.moveTo(80 + i * 55, 30); dctx.lineTo(60 + i * 55, 200); dctx.stroke();
      }
    } else {
      for (const [x, col] of [[150, '#1b2b5e'], [210, '#3c88bd'], [270, '#d12f3d'], [320, '#1b2b5e']]) {
        dctx.fillStyle = col; dctx.fillRect(x, 0, 28, 512);
      }
    }
    const topTex = canvasTexture(decal, { anisotropy: 8 });
    topTex.wrapS = topTex.wrapT = THREE.ClampToEdgeWrapping;
    // GT3 roof number / red accents
    if (style === 'gt3') {
      // The GT3 keeps a clean bonnet; its red graphics are physical stripes
      // that follow the body surface toward the rear deck.
      const stripeMat = new THREE.MeshStandardMaterial({
        color: '#f0263c', roughness: 0.3, metalness: 0.22, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      });
      for (const sx of [-0.095, 0.095]) {
        const hood = new THREE.Mesh(makeQuadStrip(sx, 0.075, 0.98, 2.14, style), stripeMat);
        hood.renderOrder = 4;
        this.chassis.add(hood);
        const deck = new THREE.Mesh(makeQuadStrip(sx, 0.075, -2.05, -1.0, style), stripeMat);
        deck.renderOrder = 4;
        this.chassis.add(deck);
      }
      const centerStripe = new THREE.MeshStandardMaterial({ color: '#f3efe3', roughness: 0.36, metalness: 0.15 });
      for (const sx of [-0.095, 0.095]) {
        const roofStripe = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.005, 0.8), centerStripe);
        roofStripe.position.set(sx, cfg.roofTop + 0.086, -0.28);
        this.chassis.add(roofStripe);
      }
    } else {      // crisp centre stripes following the LM body top
      const colors = ['#1b2b5e', '#3c88bd', '#d12f3d', '#1b2b5e'];
      for (let i = 0; i < 4; i++) {
        const mat = new THREE.MeshStandardMaterial({
          color: colors[i], roughness: 0.32, metalness: 0.2, side: THREE.DoubleSide,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        });
        const geo = makeQuadStrip(-0.28 + i * 0.18, 0.13, 0.8, 2.16, style);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = 4;
        this.chassis.add(mesh);
        const rearStripe = makeQuadStrip(-0.28 + i * 0.18, 0.13, -2.08, -1.0, style);
        const rearMesh = new THREE.Mesh(rearStripe, mat);
        rearMesh.renderOrder = 4;
        this.chassis.add(rearMesh);
      }
    }
    // NACA/roof details for LM
    if (style === 'lm') {
      this.addRounded(0.36, 0.045, 0.22, 0.02, this.P.black, { x: 0, y: cfg.roofTop + 0.055, z: -0.72 });
    }
  }

  buildWheels() {
    const P = this.P;
    const cfg = BODY[this.style];
    const tire = tireGeometry();
    const rim = this.style === 'gt3' ? rimGtGeometry() : rimLmGeometry();
    const brake = brakeGeometry();
    const caliper = caliperGeometry();
    const positions = [
      { x: -0.88, z: cfg.wheelFront, front: true },
      { x: 0.88, z: cfg.wheelFront, front: true },
      { x: -0.88, z: cfg.wheelRear, front: false },
      { x: 0.88, z: cfg.wheelRear, front: false },
    ];
    for (const p of positions) {
      const wheelRoot = new THREE.Group();
      wheelRoot.position.set(p.x, 0.407, p.z);
      wheelRoot.scale.setScalar(1.1);
      const steer = new THREE.Group();
      wheelRoot.add(steer);
      const spin = new THREE.Group();
      steer.add(spin);
      const tireMesh = new THREE.Mesh(tire, P.tire);
      tireMesh.castShadow = true;
      tireMesh.receiveShadow = true;
      spin.add(tireMesh);
      const rimMesh = new THREE.Mesh(rim, this.style === 'gt3' ? P.rimGt : P.rimSilver);
      rimMesh.castShadow = true;
      spin.add(rimMesh);
      // dark wheel-well backing so daylight never shines through the spokes
      const backing = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.035, 30), P.black);
      backing.rotation.z = Math.PI / 2;
      spin.add(backing);
      // aero cover face for LM
      if (this.style === 'lm') {
        const face = new THREE.Mesh(
          new THREE.CircleGeometry(0.252, 40),
          new THREE.MeshStandardMaterial({ map: aeroWheelTexture(), roughness: 0.3, metalness: 0.55 }),
        );
        face.position.x = Math.sign(p.x) * 0.112;
        face.rotation.y = Math.sign(p.x) * Math.PI / 2;
        spin.add(face);
      }
      // yellow sidewall ring
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.322, 0.0055, 5, 48), P.tireMark);
      ring.rotation.y = Math.PI / 2;
      ring.position.x = Math.sign(p.x) * 0.152;
      spin.add(ring);
      const disc = new THREE.Mesh(brake, P.brake);
      disc.position.x = Math.sign(p.x) * 0.02;
      spin.add(disc);
      const cal = new THREE.Mesh(caliper, this.caliperMaterial);
      cal.position.set(Math.sign(p.x) * 0.06, 0.1, 0.07);
      cal.rotation.x = -0.35;
      cal.castShadow = true;
      steer.add(cal);
      // centre lock detail
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.04, 16),
        this.accentMaterial,
      );
      hub.rotation.z = Math.PI / 2;
      hub.position.x = Math.sign(p.x) * 0.125;
      spin.add(hub);
      this.root.add(wheelRoot);
      this.wheels.push({ root: wheelRoot, steer, spin, front: p.front, side: Math.sign(p.x) });
    }
  }

  flushBuckets() {
    for (const [mat, geoms] of this.buckets) {
      if (!geoms.length) continue;
      const prepared = geoms.map((g) => (g.index ? g.toNonIndexed() : g));
      const merged = prepared.length === 1 ? prepared[0] : mergeGeometries(prepared, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.chassis.add(mesh);
    }
    this.buckets.clear();
  }

  addShadow() {
    const mat = new THREE.MeshBasicMaterial({
      map: shadowTexture(), transparent: true, opacity: 0.92,
      depthWrite: false, color: 0x000000, toneMapped: false,
    });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 5.5), mat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.018;
    shadow.renderOrder = 1;
    this.root.add(shadow);
    this.shadow = shadow;
  }

  setPaint(hex) {
    this.paintHex = hex;
    this.paintMaterial.color.set(hex);
    if (this.glbBody) retintCarBody(this.glbBody, this.style, hex);
  }

  updateVisual(dt, state) {
    const speed = state.speed ?? 0;
    const steer = state.steer ?? 0;
    this.wheelAngle += speed * dt / 0.378;
    for (const w of this.wheels) {
      w.spin.rotation.x = this.wheelAngle;
      if (w.front) {
        w.steer.rotation.y = THREE.MathUtils.damp(w.steer.rotation.y, steer * 0.4, 16, dt);
      }
    }
    const targetLean = THREE.MathUtils.clamp((state.yawRate ?? 0) * Math.abs(speed) * 0.0034, -0.07, 0.07);
    const targetPitch = THREE.MathUtils.clamp((state.braking ? 0.028 : 0) - ((state.throttle ?? 0) * 0.01), -0.04, 0.06);
    this.lean = THREE.MathUtils.damp(this.lean, targetLean, 7, dt);
    this.pitch = THREE.MathUtils.damp(this.pitch, targetPitch, 7, dt);
    this.chassis.rotation.z = this.lean;
    this.chassis.rotation.x = this.pitch;
    this.chassis.position.y = Math.sin(performance.now() * 0.07) * Math.min(0.003, Math.abs(speed) * 0.00007 + 0.0009);
    const brakeTarget = state.braking ? 4.8 : 1.3;
    this.tailMaterial.emissiveIntensity = THREE.MathUtils.damp(this.tailMaterial.emissiveIntensity, brakeTarget, 15, dt);
    this.reverseMaterial.emissiveIntensity = THREE.MathUtils.damp(
      this.reverseMaterial.emissiveIntensity, speed < -0.6 ? 2.8 : 0, 18, dt,
    );
    if (this.brakeGlows) {
      const glowTarget = state.braking ? 0.9 : 0;
      for (const g of this.brakeGlows) {
        g.material.opacity = THREE.MathUtils.damp(g.material.opacity, glowTarget, 14, dt);
      }
    }
    if (this.boostEffect) {
      const target = Math.min(1, Math.max(0, state.boost ?? 0));
      this.boostLevel = THREE.MathUtils.damp(this.boostLevel, target, target > 0 ? 18 : 6.5, dt);
      this.boostEffect.update(this.boostLevel, performance.now() * 0.001);
    }
    if (this.wingFlap && this.style === 'gt3') {
      const t = THREE.MathUtils.clamp(Math.abs(speed) / 80, 0, 1);
      this.wingFlap.rotation.x = -0.12 + t * 0.1;
    }
    if (this.shadow) this.shadow.material.opacity = 0.88;
  }

  dispose() {
    this.boostEffect?.dispose();
    if (this.useGlb) {
      // 几何体在模板之间共享，只能释放各自的材质
      this.root.traverse((o) => {
        if (o.material && o.material !== this.P.tire) o.material.dispose?.();
      });
      this.paintMaterial.dispose();
      this.tailMaterial.dispose();
      this.reverseMaterial.dispose();
      this.caliperMaterial.dispose();
      return;
    }
    this.root.traverse((o) => {
      if (o.geometry && o.geometry !== TIRE_GEO && o.geometry !== RIM_GT_GEO && o.geometry !== RIM_LM_GEO) o.geometry.dispose();
    });
    this.paintMaterial.dispose();
    this.tailMaterial.dispose();
    this.reverseMaterial.dispose();
    this.caliperMaterial.dispose();
  }
}

export function createCar(def, paintHex, options) {
  return new CarModel(def, paintHex, options);
}
