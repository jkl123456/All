import * as THREE from 'three';
import { WORLD } from './town.js';
import { mulberry32, range } from './utils.js';

/* ------------------------------------------------------------------ */
/* 天空                                                                */
/* ------------------------------------------------------------------ */

export function createSky(scene, sunDir, quality) {
  const radius = quality.far + 220;
  const geo = new THREE.SphereGeometry(radius, 32, 20);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const horizon = new THREE.Color('#f0e6cf');
  const mid = new THREE.Color('#c8dfee');
  const top = new THREE.Color('#7dadcf');
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / radius;
    if (h <= 0.02) {
      c.copy(horizon);
    } else if (h < 0.42) {
      c.copy(horizon).lerp(mid, Math.pow((h - 0.02) / 0.4, 0.85));
    } else {
      c.copy(mid).lerp(top, Math.min(1, (h - 0.42) / 0.5));
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const sky = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: true,
    })
  );
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  scene.add(sky);

  // 太阳光晕
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 249, 226, 1)');
  grad.addColorStop(0.18, 'rgba(255, 238, 197, 0.8)');
  grad.addColorStop(0.48, 'rgba(255, 226, 170, 0.2)');
  grad.addColorStop(1, 'rgba(255, 220, 160, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sun = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
      fog: false,
    })
  );
  sun.scale.setScalar(130);
  sun.position.copy(sunDir).multiplyScalar(radius - 40).setY(sunDir.y * (radius - 40) + 70);
  sun.renderOrder = -99;
  scene.add(sun);
}

/* ------------------------------------------------------------------ */
/* 灯光                                                                */
/* ------------------------------------------------------------------ */

export function createLighting(scene, sunDir, quality) {
  const hemi = new THREE.HemisphereLight('#c6dcf4', '#6b7648', 1.45);
  hemi.position.set(0, 40, 0);
  scene.add(hemi);

  const span = quality.shadowSpan;
  const sun = new THREE.DirectionalLight('#ffe8bf', 2.9);
  sun.position.copy(sunDir).multiplyScalar(70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadows, quality.shadows);
  sun.shadow.camera.left = -span;
  sun.shadow.camera.right = span;
  sun.shadow.camera.top = span;
  sun.shadow.camera.bottom = -span;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 170;
  sun.shadow.bias = -0.0009;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight('#a8c3dc', 0.32);
  fill.position.set(-40, 26, -34);
  scene.add(fill);

  // 让阴影相机跟着玩家走，小分辨率下也能覆盖身边
  sun.userData.follow = true;
  sun.userData.dir = sunDir.clone();

  return { hemi, sun, fill };
}

export function updateShadowFocus(lights, focus) {
  const sun = lights.sun;
  if (!sun.userData.follow) return;
  sun.target.position.set(focus.x, 0, focus.z);
  sun.target.updateMatrixWorld();
  sun.position.set(focus.x + sun.userData.dir.x * 70, sun.userData.dir.y * 70, focus.z + sun.userData.dir.z * 70);
}

/* ------------------------------------------------------------------ */
/* 地面（Canvas 绘制草地 + 泥土小径）                                   */
/* ------------------------------------------------------------------ */

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

function drawGroundTexture(size) {
  const k = size / 3072;
  const span = WORLD.groundSize;
  const px = size / span;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(20261025);

  const toPx = (v) => (v + span / 2) * px;

  // 草地底色
  ctx.fillStyle = '#54763c';
  ctx.fillRect(0, 0, size, size);

  // 大块色斑
  for (let i = 0; i < 330 * k * k; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = range(rng, 40, 260) * k;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = rng();
    if (tone > 0.62) {
      g.addColorStop(0, 'rgba(146, 168, 88, 0.24)');
    } else if (tone > 0.3) {
      g.addColorStop(0, 'rgba(46, 68, 34, 0.26)');
    } else {
      g.addColorStop(0, 'rgba(88, 104, 52, 0.22)');
    }
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 草叶细节
  for (let i = 0; i < 26000 * k * k; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const h = range(rng, 1.5, 5) * k;
    const shade = 54 + Math.floor(rng() * 46);
    ctx.strokeStyle = `rgba(${shade - 16}, ${shade + 30}, ${Math.floor(shade * 0.55)}, ${range(rng, 0.22, 0.58)})`;
    ctx.lineWidth = Math.max(0.6, 0.9 * k);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + range(rng, -1.6, 1.6) * k, y - h);
    ctx.stroke();
  }

  // 小径：镇内的石板路 + 通往丛林的三条土路
  const road = new Path2D();
  road.rect(toPx(-WORLD.streetHalf), 0, WORLD.streetHalf * 2 * px, size);
  road.rect(0, toPx(-WORLD.laneHalf), size, WORLD.laneHalf * 2 * px);
  const plazaPx = WORLD.plazaHalf * 2 * px;
  road.roundRect(toPx(-WORLD.plazaHalf), toPx(-WORLD.plazaHalf), plazaPx, plazaPx, 26 * k);

  // 路边泥土过渡
  ctx.save();
  ctx.lineWidth = 46 * k;
  ctx.strokeStyle = 'rgba(112, 100, 68, 0.18)';
  ctx.stroke(road);
  ctx.lineWidth = 24 * k;
  ctx.strokeStyle = 'rgba(108, 94, 64, 0.26)';
  ctx.stroke(road);
  ctx.restore();

  // 石板路底色
  ctx.save();
  ctx.clip(road);
  ctx.fillStyle = '#8a7455';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 800 * k * k; i++) {
    const x = rng() * size;
    const y = rng() * size;
    ctx.fillStyle = `rgba(${120 + rng() * 50}, ${112 + rng() * 44}, ${98 + rng() * 40}, ${range(rng, 0.05, 0.22)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, range(rng, 10, 70) * k, range(rng, 8, 50) * k, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  const stepX = 0.48 * px;
  const stepY = 0.32 * px;
  // 土路用暖褐色碎石，广场用灰石板
  const dirtPalette = ['#9a825f', '#a08765', '#8e7757', '#a68d6a', '#947c5c', '#9f8663'];
  const stonePalette = ['#9c9284', '#948b7e', '#a1978a', '#8d8578', '#98907f', '#a69b8c', '#968e80'];
  const stoneField = (x0, z0, x1, z1, opts = {}) => {
    const palette = opts.palette || stonePalette;
    const density = opts.density ?? 1;
    const skip = 1 - density;
    let row = 0;
    for (let y = toPx(z0); y < toPx(z1); y += stepY) {
      const offset = (row % 2) * stepX * 0.5;
      for (let x = toPx(x0) - stepX; x < toPx(x1); x += stepX) {
        if (rng() < skip) continue;
        const w = stepX * range(rng, 0.76, 0.94);
        const h = stepY * range(rng, 0.66, 0.9);
        const cx = x + offset + stepX / 2 + range(rng, -2.6, 2.6) * k;
        const cy = y + stepY / 2 + range(rng, -1.8, 1.8) * k;
        ctx.fillStyle = palette[Math.floor(rng() * palette.length)];
        ctx.beginPath();
        ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 3 * k);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 248, 226, ${range(rng, 0.02, 0.07)})`;
        ctx.beginPath();
        ctx.roundRect(cx - w / 2, cy - h / 2, w, h * 0.38, 2.5 * k);
        ctx.fill();
      }
      row++;
    }
  };

  const half = WORLD.groundSize / 2;
  // 街道：土路 + 零星碎石；广场：整片石板
  stoneField(-WORLD.streetHalf, -half, WORLD.streetHalf, half, { palette: dirtPalette, density: 0.28 });
  stoneField(-half, -WORLD.laneHalf, half, WORLD.laneHalf, { palette: dirtPalette, density: 0.28 });
  stoneField(-WORLD.plazaHalf, -WORLD.plazaHalf, WORLD.plazaHalf, WORLD.plazaHalf);

  // 细砂噪点，打散贴图放大后的糊感
  const grain = ctx.getImageData(0, 0, size, size);
  const gd = grain.data;
  for (let i = 0; i < gd.length; i += 4) {
    const n = (rng() - 0.5) * 16;
    gd[i] = clamp255(gd[i] + n);
    gd[i + 1] = clamp255(gd[i + 1] + n);
    gd[i + 2] = clamp255(gd[i + 2] + n);
  }
  ctx.putImageData(grain, 0, 0);

  // 石缝里的青苔
  for (let i = 0; i < 380 * k * k; i++) {
    const x = rng() * size;
    const y = rng() * size;
    ctx.fillStyle = `rgba(${64 + rng() * 30}, ${94 + rng() * 34}, ${48 + rng() * 24}, ${range(rng, 0.06, 0.2)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, range(rng, 4, 26) * k, range(rng, 3, 14) * k, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 路边草丛，柔化道路边界
  const tuft = (cx, cy) => {
    for (let n = 0; n < 3; n++) {
      const gx = cx + range(rng, -3, 3) * k;
      const gy = cy + range(rng, -3, 3) * k;
      const h = range(rng, 3, 9) * k;
      ctx.strokeStyle = `rgba(${46 + rng() * 30}, ${82 + rng() * 34}, ${34 + rng() * 20}, ${range(rng, 0.35, 0.7)})`;
      ctx.lineWidth = Math.max(0.6, range(rng, 0.8, 1.6) * k);
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.quadraticCurveTo(gx + range(rng, -2, 2) * k, gy - h * 0.6, gx + range(rng, -3, 3) * k, gy - h);
      ctx.stroke();
    }
  };

  for (let z = -half; z < half; z += 0.42) {
    tuft(toPx(-WORLD.streetHalf), toPx(z) + range(rng, -2, 2));
    tuft(toPx(WORLD.streetHalf), toPx(z) + range(rng, -2, 2));
  }
  for (let x = -half; x < half; x += 0.42) {
    tuft(toPx(x) + range(rng, -2, 2), toPx(-WORLD.laneHalf));
    tuft(toPx(x) + range(rng, -2, 2), toPx(WORLD.laneHalf));
  }

  // 草丛中的碎石
  for (let i = 0; i < 240 * k * k; i++) {
    const x = rng() * size;
    const y = rng() * size;
    ctx.fillStyle = `rgba(${150 + rng() * 40}, ${144 + rng() * 36}, ${126 + rng() * 30}, ${range(rng, 0.3, 0.7)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, range(rng, 1.5, 4.5) * k, range(rng, 1, 3) * k, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // 广场中央的圆形石纹
  ctx.save();
  ctx.translate(toPx(0), toPx(0));
  ctx.strokeStyle = 'rgba(70, 66, 58, 0.35)';
  ctx.lineWidth = 8 * k;
  ctx.beginPath();
  ctx.arc(0, 0, WORLD.plazaHalf * px * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(214, 202, 176, 0.2)';
  ctx.lineWidth = 4 * k;
  ctx.beginPath();
  ctx.arc(0, 0, WORLD.plazaHalf * px * 0.42 + 9 * k, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function createGround(scene, quality) {
  const tex = drawGroundTexture(quality.groundTex);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.groundSize, WORLD.groundSize, 1, 1),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.97, metalness: 0 })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // 远景草地裙边，避免地面边缘出现一条硬线
  const skirt = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 760, 1, 1),
    new THREE.MeshStandardMaterial({ color: '#3f5730', roughness: 1, metalness: 0 })
  );
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.y = -0.08;
  scene.add(skirt);

  return mesh;
}

/* ------------------------------------------------------------------ */
/* 风（顶点动画，CPU 零开销）                                           */
/* ------------------------------------------------------------------ */

export const windUniforms = { time: { value: 0 } };

function applyWind(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniforms.time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 iPos = vec3(0.0);
        #endif
        float ph = uWindTime * 1.05 + iPos.x * 0.33 + iPos.z * 0.42;
        float amp = 0.05 * max(transformed.y, 0.0);
        transformed.x += sin(ph) * amp;
        transformed.z += cos(ph * 0.81 + 1.7) * amp * 0.75;`
      );
  };
  material.customProgramCacheKey = () => 'jungle-wind';
}

export function updateWind(time) {
  windUniforms.time.value = time;
}

/* ------------------------------------------------------------------ */
/* 丛林：真实热带植物 + 实例化                                          */
/* ------------------------------------------------------------------ */

/** 物种配置：role 决定摆放区域，collide 是碰撞半径（0 表示不阻挡） */
const SPECIES = [
  { name: 'palm_a', role: 'canopy', weight: 16, scale: [0.58, 0.92], collide: 0.38 },
  { name: 'palm_b', role: 'canopy', weight: 14, scale: [0.6, 0.95], collide: 0.34 },
  { name: 'palm_queen', role: 'canopy', weight: 10, scale: [0.85, 1.3], collide: 0.3 },
  { name: 'palm_beach', role: 'canopy', weight: 9, scale: [0.85, 1.25], collide: 0.28 },
  { name: 'cecropia', role: 'canopy', weight: 13, scale: [0.7, 1.05], collide: 0.42 },
  { name: 'copal', role: 'canopy', weight: 8, scale: [0.62, 0.98], collide: 0.44 },
  { name: 'banana', role: 'mid', weight: 12, scale: [0.85, 1.35], collide: 0 },
  { name: 'fern', role: 'under', weight: 26, scale: [0.8, 1.5], collide: 0 },
  { name: 'bush', role: 'under', weight: 22, scale: [0.85, 1.5], collide: 0 },
  { name: 'elephant', role: 'under', weight: 14, scale: [0.85, 1.3], collide: 0 },
];

const POND_SAFE = 1.8;

export function createJungle(scene, town, forest, quality) {
  const rng = mulberry32(913377);
  const half = WORLD.boundary;
  const placements = [];

  const roadClear = (x, z, pad) => {
    if (Math.abs(x) < WORLD.streetHalf + pad) return false;
    if (Math.abs(z) < WORLD.laneHalf + pad) return false;
    if (Math.abs(x) < WORLD.plazaHalf + pad && Math.abs(z) < WORLD.plazaHalf + pad) return false;
    return true;
  };

  const ok = (x, z, radius, pad) => {
    if (Math.abs(x) > half - 1.5 || Math.abs(z) > half - 1.5) return false;
    if (!roadClear(x, z, pad)) return false;
    if (town.isBlocked(x, z, radius + POND_SAFE)) return false;
    return true;
  };

  // 1) 镇内点缀：沿街的行道棕榈 + 房前屋后的零星植物
  const canopyPool = SPECIES.filter((s) => s.role === 'canopy');
  const underPool = SPECIES.filter((s) => s.role === 'under');
  const midPool = SPECIES.filter((s) => s.role === 'mid');

  const pickSpecies = (pool) => {
    const total = pool.reduce((sum, s) => sum + s.weight, 0);
    let t = rng() * total;
    for (const s of pool) {
      t -= s.weight;
      if (t <= 0) return s;
    }
    return pool[0];
  };

  // 主街两侧成排的棕榈
  for (let z = -30; z <= 30; z += 9.5) {
    for (const side of [-1, 1]) {
      const x = side * (WORLD.streetHalf + 2.1 + range(rng, 0, 1.1));
      if (!ok(x, z + range(rng, -1.4, 1.4), 0.5, 1.2)) continue;
      placements.push({ species: rng() > 0.45 ? 'palm_queen' : 'palm_a', x, z: z + range(rng, -1, 1), yaw: rng() * 6.283, scale: range(rng, 0.8, 1.05), role: 'canopy' });
    }
  }

  // 2) 丛林主体：越靠外越密
  const outerAttempts = quality.trees * 14;
  let outer = 0;
  for (let i = 0; i < outerAttempts && outer < quality.trees; i++) {
    const a = rng() * Math.PI * 2;
    const r = range(rng, 20, half + 2);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const sp = pickSpecies(canopyPool);
    if (!ok(x, z, 0.9, 1.4)) continue;
    placements.push({ species: sp.name, x, z, yaw: rng() * 6.283, scale: range(rng, sp.scale[0], sp.scale[1]), role: 'canopy' });
    outer++;
  }

  // 3) 林下植被：贴着树干与路肩
  const underTargets = quality.undergrowth;
  let under = 0;
  for (let i = 0; i < underTargets * 16 && under < underTargets; i++) {
    const a = rng() * Math.PI * 2;
    const r = range(rng, 9, half + 4);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const sp = pickSpecies(underPool);
    if (!ok(x, z, 0.4, 0.6)) continue;
    placements.push({ species: sp.name, x, z, yaw: rng() * 6.283, scale: range(rng, sp.scale[0], sp.scale[1]), role: 'under' });
    under++;
  }

  // 4) 香蕉丛：成簇出现，点缀在房屋之间
  for (let i = 0; i < quality.trees * 0.22; i++) {
    const a = rng() * Math.PI * 2;
    const r = range(rng, 14, 34);
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r;
    const sp = midPool[0];
    for (let n = 0; n < 3; n++) {
      const x = cx + range(rng, -1.8, 1.8);
      const z = cz + range(rng, -1.8, 1.8);
      if (!ok(x, z, 0.6, 1)) continue;
      placements.push({ species: sp.name, x, z, yaw: rng() * 6.283, scale: range(rng, sp.scale[0], sp.scale[1]), role: 'mid' });
    }
  }

  // 建树：每个物种一份 InstancedMesh / 每个子网格
  const groups = new Map();
  for (const p of placements) {
    if (!forest[p.species]) continue;
    if (!groups.has(p.species)) groups.set(p.species, []);
    groups.get(p.species).push(p);
  }

  const dummy = new THREE.Object3D();
  const root = new THREE.Group();
  root.name = 'jungle';
  let instanced = 0;

  for (const [name, list] of groups) {
    const asset = forest[name];
    const spec = SPECIES.find((s) => s.name === name);
    for (const part of asset.parts) {
      const mat = part.material;
      if (part.leaf && quality.sway) {
        if (!mat.userData.wind) {
          mat.userData.wind = true;
          applyWind(mat);
        }
      }
      const mesh = new THREE.InstancedMesh(part.geometry, mat, list.length);
      mesh.castShadow = !part.leaf || quality.leafShadows;
      mesh.receiveShadow = false;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        dummy.position.set(p.x, 0, p.z);
        dummy.rotation.set(0, p.yaw, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.userData.species = name;
      mesh.userData.leaf = part.leaf;
      mesh.frustumCulled = true;
      mesh.computeBoundingSphere();
      root.add(mesh);
      instanced++;
    }

    // 树干碰撞只给大树，玩家能感觉到植物，但相机不会被顶飞（soft）
    if (spec && spec.collide > 0) {
      for (const p of list) {
        const r = spec.collide * p.scale;
        town.addCollider(p.x, p.z, r * 2, r * 2, 8, 0, true);
      }
    }
  }

  scene.add(root);
  return { root, count: placements.length, meshes: instanced, placements };
}

/* ------------------------------------------------------------------ */
/* 空气中的浮尘/萤火                                                    */
/* ------------------------------------------------------------------ */

export function createAmbient(scene, quality) {
  const count = quality.dust;
  const rng = mulberry32(9182);
  const positions = new Float32Array(count * 3);
  const base = new Float32Array(count * 3);
  const phase = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = range(rng, 6, 24);
    base[i * 3] = Math.cos(angle) * radius;
    base[i * 3 + 1] = range(rng, 0.4, 7.5);
    base[i * 3 + 2] = Math.sin(angle) * radius;
    positions[i * 3] = base[i * 3];
    positions[i * 3 + 1] = base[i * 3 + 1];
    positions[i * 3 + 2] = base[i * 3 + 2];
    phase[i] = rng() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 32;
  const sctx = sprite.getContext('2d');
  const grad = sctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 32, 32);
  const dotTex = new THREE.CanvasTexture(sprite);
  dotTex.colorSpace = THREE.SRGBColorSpace;

  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: '#ffeec6',
      map: dotTex,
      size: 0.14,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      fog: true,
    })
  );
  points.frustumCulled = false;
  scene.add(points);

  return { points, positions, base, phase, count };
}

export function updateAmbient(ambient, time, center) {
  const { positions, base, phase, count } = ambient;
  for (let i = 0; i < count; i++) {
    const p = phase[i];
    positions[i * 3] = base[i * 3] + Math.sin(time * 0.22 + p) * 1.6 + center.x;
    positions[i * 3 + 1] = base[i * 3 + 1] + Math.sin(time * 0.5 + p * 1.7) * 0.5;
    positions[i * 3 + 2] = base[i * 3 + 2] + Math.cos(time * 0.19 + p * 0.8) * 1.6 + center.z;
  }
  ambient.points.geometry.attributes.position.needsUpdate = true;
}
