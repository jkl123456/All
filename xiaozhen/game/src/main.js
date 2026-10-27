import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { Town, WORLD, HOUSES, BUILD_TYPES } from './town.js';
import {
  createSky,
  createLighting,
  createGround,
  createJungle,
  createAmbient,
  updateAmbient,
  updateWind,
  updateShadowFocus,
} from './world.js';
import { loadAnimalAssets, Herd } from './animals.js';
import { Player } from './player.js';
import { clamp } from './utils.js';
import { IS_MOBILE, QUALITY, maxPixelRatio } from './config.js';

const canvas = document.getElementById('scene');
const loadingEl = document.getElementById('loading');
const loadingPct = document.getElementById('loading-pct');
const progressBar = document.getElementById('progress-bar');
const loadingTip = document.getElementById('loading-tip');
const loadingSub = document.querySelector('.loading-sub');
const toastEl = document.getElementById('toast');
const zoneEl = document.getElementById('zone-name');
const hudTop = document.querySelector('.hud-top');
const hudBottom = document.querySelector('.hud-bottom');
const minimapCanvas = document.getElementById('minimap');
const hintBar = document.getElementById('hint-bar');

const TIPS = [
  '晨雾正从林梢间散开…',
  '一只鹿在镇外的灌木边停下了脚步。',
  '石板路被夜露打湿，棕榈叶滴着水。',
  '钟楼的钟声要等到正午才会响起。',
];

/* ------------------------------------------------------------------ */
/* 渲染器                                                              */
/* ------------------------------------------------------------------ */

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: QUALITY.antialias,
  powerPreference: 'high-performance',
  alpha: false,
  stencil: false,
});
let pixelRatio = maxPixelRatio();
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = IS_MOBILE ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.24;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#e9e4cf', 50, 135);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.12, QUALITY.far + 320);

const sunDir = new THREE.Vector3(0.5, 0.72, 0.48).normalize();
createSky(scene, sunDir, QUALITY);
const lights = createLighting(scene, sunDir, QUALITY);

/* ------------------------------------------------------------------ */
/* 资源加载                                                            */
/* ------------------------------------------------------------------ */

const loader = new GLTFLoader();
const assets = {};
const jungleModels = {};
let animalAssets = {};
let progress = 0;
let progressTotal = 0;
let progressDone = 0;

setupHintBar();

function setProgress(done, total) {
  progressDone = done;
  progressTotal = total;
  progress = total > 0 ? done / total : 0;
  const pct = Math.round(progress * 100);
  loadingPct.textContent = `${pct}%`;
  progressBar.style.width = `${pct}%`;
}

function bumpProgress(label) {
  progressDone += 1;
  setProgress(progressDone, progressTotal);
  if (label && progressDone % 3 === 0) {
    loadingSub.firstChild.textContent = `正在铺设${label} · `;
  }
}

function rotateTips() {
  let i = 0;
  setInterval(() => {
    i = (i + 1) % TIPS.length;
    loadingTip.style.opacity = '0';
    setTimeout(() => {
      loadingTip.textContent = TIPS[i];
      loadingTip.style.opacity = '1';
    }, 300);
  }, 2600);
}

async function loadTown() {
  // 中世纪村落包：每个模型一个 GLB，manifest 里带长宽高（用于摆放和碰撞）
  const list = await fetch('./assets/village/manifest.json').then((r) => r.json());

  // 这个包全是不带贴图的纯色材质，每个模型都导出了一套自己的材质实例。
  // 这里按颜色收拢成共享材质，后面合并网格时才能跨建筑合并，draw call 少一大半。
  const matCache = new Map();
  const shareMaterial = (mat) => {
    const key = [
      mat.color ? mat.color.getHexString() : 'fff',
      (mat.roughness ?? 0.9).toFixed(2),
      (mat.metalness ?? 0).toFixed(2),
      mat.side ?? 0,
    ].join('|');
    let shared = matCache.get(key);
    if (!shared) {
      shared = new THREE.MeshStandardMaterial({
        color: mat.color ? mat.color.clone() : new THREE.Color('#ffffff'),
        roughness: mat.roughness ?? 0.92,
        metalness: mat.metalness ?? 0,
        side: mat.side ?? THREE.FrontSide,
      });
      shared.envMapIntensity = 0.6;
      shared.dithering = false;
      matCache.set(key, shared);
    }
    return shared;
  };

  await Promise.all(
    list.map(async (meta) => {
      const gltf = await loader.loadAsync(`./assets/village/${meta.name}.glb`);
      const root = gltf.scene;
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      root.userData.maxY = box.max.y;
      root.userData.minY = box.min.y;
      root.traverse((obj) => {
        if (obj.isMesh && obj.material && !Array.isArray(obj.material)) {
          obj.material = shareMaterial(obj.material);
        }
      });
      assets[meta.name] = root;
      assets[`${meta.name}__size`] = meta;
      bumpProgress();
    })
  );
}

async function loadJungle() {
  const meta = await fetch('./assets/jungle/trees.json').then((r) => r.json());
  await Promise.all(
    Object.keys(meta).map(async (name) => {
      const gltf = await loader.loadAsync(`./assets/jungle/${name}.glb`);
      const root = gltf.scene;
      const parts = [];
      root.traverse((obj) => {
        if (!obj.isMesh) return;
        const mat = obj.material;
        if (!mat) return;
        mat.vertexColors = false;
        mat.envMapIntensity = 0.5;
        const leaf = mat.alphaTest > 0 || mat.transparent || mat.side === THREE.DoubleSide;
        if (leaf) {
          mat.alphaTest = Math.max(mat.alphaTest, 0.35);
          mat.depthWrite = true;
        }
        mat.roughness = Math.min(1, (mat.roughness ?? 0.9) + 0.05);

        // 部分树模型里被打包了"横躺的倒木/枯干"（如 palm_queen 的 PalmMapped、
        // palm_beach 的 SquatPalm）。它们本身是横着建模的，跟着树一起实例化后
        // 看起来就像一棵树被放倒了，这里按包围盒比例过滤掉。
        const geometry = obj.geometry;
        geometry.computeBoundingBox();
        const size = new THREE.Vector3();
        geometry.boundingBox.getSize(size);
        if (size.y < Math.max(size.x, size.z) * 0.35) {
          console.info(`[jungle] 跳过横躺部件：${name} / ${mat.name}`);
          return;
        }

        parts.push({ geometry, material: mat, leaf });
      });
      jungleModels[name] = { parts, height: meta[name].height };
      bumpProgress();
    })
  );
}

function readInput(keyboard) {
  if (window.__forceInput) return window.__forceInput;
  if (joystick.active) {
    const mag = clamp(joystick.magnitude, 0, 1);
    const dead = 0.14;
    if (mag < dead) return { forward: 0, strafe: 0, run: false, speedScale: 0 };
    const scale = (mag - dead) / (1 - dead);
    return {
      forward: -joystick.y / Math.max(mag, 0.0001),
      strafe: joystick.x / Math.max(mag, 0.0001),
      run: scale > 0.82,
      speedScale: scale > 0.82 ? 1 : scale / 0.82 + 0.18,
    };
  }

  const forward = (keyboard.has('KeyW') || keyboard.has('ArrowUp') ? 1 : 0) -
    (keyboard.has('KeyS') || keyboard.has('ArrowDown') ? 1 : 0);
  const strafe = (keyboard.has('KeyD') || keyboard.has('ArrowRight') ? 1 : 0) -
    (keyboard.has('KeyA') || keyboard.has('ArrowLeft') ? 1 : 0);
  return { forward, strafe, run: keyboard.has('ShiftLeft') || keyboard.has('ShiftRight'), speedScale: 1 };
}

/* ------------------------------------------------------------------ */
/* 场景构建                                                            */
/* ------------------------------------------------------------------ */

let player;
let town;
let ambient;
let herd;
let elapsed = 0;

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

async function boot() {
  if (location.protocol === 'file:') {
    loadingTip.textContent = '请用本地服务器打开：node game/server.js';
    loadingTip.style.color = '#e08a7a';
    return;
  }

  rotateTips();
  await nextFrame();
  createGround(scene, QUALITY);
  await nextFrame();

  setProgress(0, 1);
  await loadTown();
  setProgress(progressDone, progressDone + 11);
  await loadJungle();
  setProgress(progressDone, progressDone + 7);
  animalAssets = await loadAnimalAssets(loader, (ratio) => {
    setProgress(progressDone + ratio * 6, progressDone + 6);
  });
  progressDone += 6;
  setProgress(progressDone, progressDone + 1);

  // 主角：Pistol Run.fbx 里的 Mixamo 角色（自带持枪跑动作）
  const characterGltf = await loader.loadAsync('./assets/character/adventurer.glb');
  // 自带的动作名字是 "Armature|mixamo.com|Layer0"，改个能识别的名字
  for (const clip of characterGltf.animations) {
    if (/mixamo/i.test(clip.name)) clip.name = 'PistolRun';
  }
  let clips = characterGltf.animations || [];

  // 从原主角骨架上搬过来的动作（Idle / Walk / Run / 各种招式）
  for (const file of ['./assets/character/clips_runner.json']) {
    try {
      const res = await fetch(file);
      if (res.ok) {
        const data = await res.json();
        if (data.clips && data.clips.length) clips = clips.concat(data.clips);
      }
    } catch (err) {
      /* 没有就跳过 */
    }
  }
  setProgress(1, 1);

  town = new Town(scene, assets).build();
  const forestInfo = createJungle(scene, town, jungleModels, QUALITY);
  herd = new Herd(scene, animalAssets, QUALITY, town);
  ambient = createAmbient(scene, QUALITY);

  player = new Player(scene, characterGltf, clips);

  // 武器道具（由包里的 Sword.fbx / Gun.fbx 导出）
  try {
    const [sword, gun] = await Promise.all([
      loader.loadAsync('./assets/weapons/sword.glb'),
      loader.loadAsync('./assets/weapons/gun.glb'),
    ]);
    player.weapons = { sword: sword.scene, gun: gun.scene };
  } catch (err) {
    player.weapons = null;
  }
  player.position.set(0, 0, 9.5);
  player.heading = Math.PI;
  window.__game = { player, town, herd, forestInfo, cam, camera, scene, renderer, THREE, builder };

  lights.sun.target.position.set(0, 0, 0);
  lights.sun.target.updateMatrixWorld();

  setTimeout(() => loadingEl.classList.add('done'), 260);

  setupControls();
  setupActions();
  showToast(IS_MOBILE ? '苔溪镇 · 左侧摇杆行走' : '苔溪镇 · 用 WASD 四处走走');
  requestAnimationFrame(() => {
    clock.start();
    renderer.setAnimationLoop(tick);
  });
}

/* ------------------------------------------------------------------ */
/* 控制与相机                                                          */
/* ------------------------------------------------------------------ */

const keys = new Set();
const cam = {
  yaw: 0,
  pitch: 0.3,
  distance: IS_MOBILE ? 7.4 : 6.6,
  intro: 1,
  target: new THREE.Vector3(),
};

const params = new URLSearchParams(location.search);
if (params.has('front')) {
  cam.yaw = Math.PI;
  cam.pitch = 0.14;
  cam.distance = 3.6;
  cam.intro = 0;
}
if (params.has('nointro')) cam.intro = 0;

const joystick = {
  active: false,
  id: null,
  originX: 0,
  originY: 0,
  x: 0,
  y: 0,
  magnitude: 0,
};

const joyEl = document.getElementById('joystick');
const joyKnob = document.getElementById('joystick-knob');

function setupControls() {
  window.addEventListener('keydown', (event) => {
    if (event.repeat && event.code !== 'ShiftLeft') return;
    keys.add(event.code);
    if (event.code === 'KeyH') {
      hudTop.classList.toggle('hidden');
      hudBottom.classList.toggle('hidden');
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  let dragId = null;
  let lastX = 0;
  let lastY = 0;
  const pinch = { active: false, startDist: 0, startCam: 0 };

  const touchPointers = new Map();

  let pressX = 0;
  let pressY = 0;

  canvas.addEventListener('pointerdown', (event) => {
    touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pressX = event.clientX;
    pressY = event.clientY;

    if (touchPointers.size === 2) {
      const pts = [...touchPointers.values()];
      pinch.active = true;
      pinch.startDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinch.startCam = cam.distance;
      dragId = null;
      joystick.active = false;
      joystick.id = null;
      hideJoystick();
      return;
    }

    // 左半屏 = 摇杆；右半屏 = 转视角
    if (!builder.type && event.pointerType === 'touch' && event.clientX < window.innerWidth * 0.46 && !joystick.active) {
      joystick.active = true;
      joystick.id = event.pointerId;
      joystick.originX = event.clientX;
      joystick.originY = event.clientY;
      joystick.x = 0;
      joystick.y = 0;
      joystick.magnitude = 0;
      showJoystick(event.clientX, event.clientY);
      return;
    }

    dragId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  });

  canvas.addEventListener('pointermove', (event) => {
    if (touchPointers.has(event.pointerId)) {
      touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (pinch.active && touchPointers.size === 2) {
      const pts = [...touchPointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      cam.distance = clamp(pinch.startCam * (pinch.startDist / Math.max(dist, 1)), 2.6, 16);
      return;
    }

    if (joystick.active && event.pointerId === joystick.id) {
      const maxR = 58;
      let dx = event.clientX - joystick.originX;
      let dy = event.clientY - joystick.originY;
      const len = Math.hypot(dx, dy);
      if (len > maxR) {
        // 摇杆推到底后基座跟着走，转身更跟手
        joystick.originX += dx * (1 - maxR / len);
        joystick.originY += dy * (1 - maxR / len);
        dx *= maxR / len;
        dy *= maxR / len;
        showJoystick(joystick.originX, joystick.originY, dx, dy);
      } else {
        moveKnob(dx, dy);
      }
      joystick.x = dx / maxR;
      joystick.y = dy / maxR;
      joystick.magnitude = Math.min(1, Math.hypot(joystick.x, joystick.y));
      return;
    }

    if (builder.type) builder.move(event.clientX, event.clientY);

    if (event.pointerId !== dragId) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    cam.yaw -= dx * 0.0055;
    cam.pitch = clamp(cam.pitch + dy * 0.0042, -0.1, 1.05);
  });

  const endPointer = (event) => {
    touchPointers.delete(event.pointerId);

    // 建造模式：轻点（没有拖动视角）就落地
    if (builder.type && Math.hypot(event.clientX - pressX, event.clientY - pressY) < 9) {
      builder.move(event.clientX, event.clientY);
      builder.place();
    }

    if (pinch.active && touchPointers.size < 2) {
      pinch.active = false;
      if (joystick.active && joystick.id === null) {
        // 捏合前按下的摇杆已被取消，等下一次按下重新启用
      }
    }

    if (event.pointerId === joystick.id) {
      joystick.active = false;
      joystick.id = null;
      joystick.x = 0;
      joystick.y = 0;
      joystick.magnitude = 0;
      hideJoystick();
    }

    if (event.pointerId === dragId) {
      dragId = null;
      canvas.style.cursor = 'grab';
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  canvas.style.cursor = 'grab';

  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      cam.distance = clamp(cam.distance + event.deltaY * 0.006, 2.6, 16);
    },
    { passive: false }
  );

  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 220));
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function showJoystick(x, y, dx = 0, dy = 0) {
  if (!joyEl) return;
  joyEl.classList.add('active');
  joyEl.style.left = `${x}px`;
  joyEl.style.top = `${y}px`;
  moveKnob(dx, dy);
}

function moveKnob(dx, dy) {
  if (joyKnob) joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

function hideJoystick() {
  if (joyEl) joyEl.classList.remove('active');
  moveKnob(0, 0);
}

function updateCamera(dt) {
  cam.target.set(player.position.x, player.position.y + 1.45 + (cam.targetOffset || 0), player.position.z);

  if (cam.intro > 0) {
    cam.intro = Math.max(0, cam.intro - dt * 0.42);
    const e = cam.intro * cam.intro;
    cam.distance = (IS_MOBILE ? 7.4 : 6.6) + e * 16;
    cam.pitch = 0.3 + e * 0.34;
  }

  const dirX = Math.sin(cam.yaw) * Math.cos(cam.pitch);
  const dirY = Math.sin(cam.pitch);
  const dirZ = Math.cos(cam.yaw) * Math.cos(cam.pitch);

  let distance = cam.distance;
  const steps = 40;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = cam.target.x + dirX * distance * t;
    const pz = cam.target.z + dirZ * distance * t;
    let blocked = false;
    for (const c of town.colliders) {
      if (c.soft) continue;
      if (px > c.minX - 0.35 && px < c.maxX + 0.35 && pz > c.minZ - 0.35 && pz < c.maxZ + 0.35) {
        blocked = true;
        break;
      }
    }
    if (blocked) {
      distance = Math.max(1.8, distance * ((i - 1) / steps));
      break;
    }
  }

  const desired = new THREE.Vector3(
    cam.target.x + dirX * distance,
    Math.max(0.9, cam.target.y + dirY * distance),
    cam.target.z + dirZ * distance
  );

  const lambda = cam.intro > 0 ? 3.2 : 12;
  camera.position.lerp(desired, 1 - Math.exp(-lambda * dt));
  camera.lookAt(cam.target);
}

/* ------------------------------------------------------------------ */
/* UI                                                                  */
/* ------------------------------------------------------------------ */

/* ---------------- 建造模式 ---------------- */

const BUILD_FACE_STEP = Math.PI / 2;

const builder = {
  type: null,
  rot: 0,
  ghost: null,
  material: null,
  valid: false,
  panelOpen: false,

  init() {
    this.panel = document.getElementById('build-panel');
    this.grid = document.getElementById('build-grid');
    this.bar = document.getElementById('build-bar');
    this.nameEl = document.getElementById('build-name');
    if (!this.grid) return;

    for (const type of BUILD_TYPES) {
      const btn = document.createElement('button');
      btn.className = 'build-item';
      btn.dataset.piece = type.piece;
      btn.textContent = type.name;
      btn.addEventListener('click', () => this.select(type));
      this.grid.appendChild(btn);
    }

    document.getElementById('build-close')?.addEventListener('click', () => this.openPanel(false));
    document.getElementById('build-cancel')?.addEventListener('click', () => this.cancel());
    document.getElementById('build-rotate')?.addEventListener('click', () => this.rotate());
  },

  openPanel(open) {
    this.panelOpen = open;
    if (this.panel) this.panel.hidden = !open;
    if (!open && this.type) return;      // 选好类型后收起面板，保留放置状态
    if (!open) this.cancel();
  },

  toggle() {
    if (this.type) { this.cancel(); return; }
    this.openPanel(!this.panelOpen);
  },

  select(type) {
    this.type = type;
    this.rot = 0;
    this.openPanel(false);
    if (this.bar) this.bar.hidden = false;
    if (this.nameEl) this.nameEl.textContent = type.name;
    for (const el of this.grid.children) {
      el.classList.toggle('active', el.dataset.piece === type.piece);
    }
    this.makeGhost(type);
    showToast(`放置 ${type.name} · 点击地面`);
  },

  makeGhost(type) {
    this.dropGhost();
    const src = assets[type.piece];
    if (!src) return;
    const ghost = src.clone(true);
    this.material = new THREE.MeshStandardMaterial({
      color: 0x8fd8a5,
      emissive: 0x1d3a24,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      roughness: 1,
    });
    ghost.traverse((o) => {
      if (o.isMesh) {
        o.material = this.material;
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
    ghost.scale.setScalar(type.scale);
    ghost.visible = false;
    ghost.renderOrder = 5;
    scene.add(ghost);
    this.ghost = ghost;
  },

  dropGhost() {
    if (!this.ghost) return;
    scene.remove(this.ghost);
    this.ghost = null;
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
  },

  /** 屏幕坐标 -> 地面坐标，并更新预览 */
  move(clientX, clientY) {
    if (!this.type || !this.ghost) return;
    const rect = canvas.getBoundingClientRect();
    pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    groundRay.setFromCamera(pointerNdc, camera);
    const hit = groundRay.ray.intersectPlane(groundPlane, groundPoint);
    if (!hit) {
      this.ghost.visible = false;
      return;
    }
    const info = assets[`${this.type.piece}__size`];
    const w = (info?.w || 3) * this.type.scale;
    const d = (info?.d || 3) * this.type.scale;
    const { sx, sz } = Town.rotatedExtent(w, d, this.rot);

    let x = hit.x;
    let z = hit.z;

    // 落点太靠近自己或镜头时，沿点击方向往外推一点。
    // 之前是直接判为"不能放"，玩家点在自己脚边那一下就没反应，以为要再点一次。
    const pushAway = (px, pz, minDist) => {
      let dx = x - px;
      let dz = z - pz;
      let dist = Math.hypot(dx, dz);
      if (dist >= minDist) return;
      if (dist < 0.01) {
        dx = Math.sin(this.rot);
        dz = Math.cos(this.rot);
        dist = 1;
      }
      x = px + (dx / dist) * minDist;
      z = pz + (dz / dist) * minDist;
    };
    pushAway(player.position.x, player.position.z, Math.max(sx, sz) * 0.5 + 1.1);
    pushAway(camera.position.x, camera.position.z, 2.4);

    x = Math.round(x * 2) / 2;
    z = Math.round(z * 2) / 2;

    this.ghost.visible = true;
    this.ghost.position.set(x, 0.02, z);
    this.ghost.rotation.y = this.rot;

    this.valid = town.canPlace(x, z, sx, sz);
    this.material.color.set(this.valid ? 0x8fd8a5 : 0xd9736a);
    this.material.emissive.set(this.valid ? 0x1d3a24 : 0x3a1414);
  },

  rotate() {
    if (!this.type) return;
    this.rot = (this.rot + BUILD_FACE_STEP) % (Math.PI * 2);
    if (this.ghost) this.ghost.rotation.y = this.rot;
  },

  place() {
    if (!this.type || !this.ghost || !this.ghost.visible) return;
    if (!this.valid) {
      showToast('这里放不下，换个位置');
      return;
    }
    const { x, z } = this.ghost.position;
    const name = this.type.name;
    town.addBuilding(this.type.piece, x, z, this.rot, this.type.scale);
    // 建完就收工：预览跟着鼠标跑会让人误以为还能继续点
    this.cancel();
    showToast(`${name} 建好了`);
  },

  cancel() {
    this.type = null;
    this.dropGhost();
    if (this.bar) this.bar.hidden = true;
    if (this.panel) this.panel.hidden = true;
    this.panelOpen = false;
    if (this.grid) {
      for (const el of this.grid.children) el.classList.remove('active');
    }
  },
};

const pointerNdc = new THREE.Vector2();
const groundRay = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const groundPoint = new THREE.Vector3();

const ACTION_CLIPS = {
  punch: ['Punch_Left', 'Punch_Right'],
  kick: ['Kick_Left', 'Kick_Right'],
  slash: ['Sword_Slash'],
  wave: ['Wave'],
  roll: ['Roll'],
  interact: ['Interact'],
  hit: ['HitRecieve', 'HitRecieve_2'],
  die: ['Death'],
  shoot: ['Gun_Shoot'],
};
const actionIndex = {};

let crouching = false;
const WEAPON_CYCLE = [null, 'sword', 'gun'];

function cycleWeapon() {
  if (!player) return;
  const i = WEAPON_CYCLE.indexOf(player.weaponKind);
  const next = WEAPON_CYCLE[(i + 1) % WEAPON_CYCLE.length];
  player.equip(next);
  const label = { sword: '长剑', gun: '火枪' }[next] || '空手';
  showToast(`已换上：${label}`);
}

function triggerAction(act) {
  if (!player) return;
  if (act === 'jump') {
    player.jump();
    return;
  }
  if (act === 'weapon') {
    cycleWeapon();
    return;
  }
  if (act === 'build') {
    builder.toggle();
    return;
  }
  const list = ACTION_CLIPS[act];
  if (!list) return;
  const i = actionIndex[act] || 0;
  actionIndex[act] = i + 1;
  if (!player.playAction(list[i % list.length])) {
    // 退化：没有对应片段时用可见的方式提示
    showToast('这个角色没有该动作');
  }
}

function setupActions() {
  builder.init();
  const bar = document.getElementById('action-bar');
  if (bar) {
    const release = () => {
      if (crouching) {
        crouching = false;
        player?.setCrouch(false);
      }
    };
    bar.addEventListener('pointerdown', (event) => {
      const btn = event.target.closest('.act');
      if (!btn) return;
      event.preventDefault();
      const act = btn.dataset.act;
      if (act === 'crouch') {
        crouching = true;
        player?.setCrouch(true);
        return;
      }
      triggerAction(act);
    });
    bar.addEventListener('pointerup', release);
    bar.addEventListener('pointercancel', release);
    bar.addEventListener('pointerleave', release);
  }

  const keyMap = {
    Space: 'jump', KeyF: 'punch', KeyR: 'slash', KeyE: 'wave',
    KeyQ: 'roll', KeyC: 'kick', KeyG: 'interact', KeyX: 'hit',
    KeyV: 'weapon',
  };
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;

    // 建造模式优先吃按键
    if (event.code === 'KeyB') {
      event.preventDefault();
      builder.toggle();
      return;
    }
    if (builder.type) {
      if (event.code === 'KeyR') {
        event.preventDefault();
        builder.rotate();
        return;
      }
      if (event.code === 'Escape') {
        event.preventDefault();
        builder.cancel();
        return;
      }
    }

    // Ctrl / Z 按住蹲下
    if (event.code === 'ControlLeft' || event.code === 'ControlRight' || event.code === 'KeyZ') {
      crouching = true;
      player?.setCrouch(true);
      event.preventDefault();
      return;
    }
    const act = keyMap[event.code];
    if (!act) return;
    event.preventDefault();
    triggerAction(act);
  });
  window.addEventListener('keyup', (event) => {
    if (event.code === 'ControlLeft' || event.code === 'ControlRight' || event.code === 'KeyZ') {
      crouching = false;
      player?.setCrouch(false);
    }
  });
  window.__triggerAction = triggerAction;
}

function setupHintBar() {
  if (!hintBar) return;
  if (IS_MOBILE) {
    hintBar.innerHTML = `
      <div class="hint"><span>左下摇杆移动 · 推到底奔跑</span></div>
      <div class="hint"><span>右侧拖动转视角 · 右下按钮出招/建造</span></div>`;
  } else {
    hintBar.innerHTML = `
      <div class="hint"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>行走</span></div>
      <div class="hint"><kbd>Shift</kbd><span>奔跑</span></div>
      <div class="hint"><kbd>鼠标拖动</kbd><span>转动视角</span></div>
      <div class="hint"><kbd>Space</kbd><span>跳跃</span></div>
      <div class="hint"><kbd>F</kbd><span>出拳</span></div>
      <div class="hint"><kbd>R</kbd><span>挥剑</span></div>
      <div class="hint"><kbd>Ctrl</kbd><span>蹲下</span></div>
      <div class="hint"><kbd>V</kbd><span>换武器</span></div>
      <div class="hint"><kbd>B</kbd><span>建造</span></div>
      <div class="hint"><kbd>H</kbd><span>隐藏界面</span></div>`;
  }
}

let toastTimer = null;
function showToast(message, duration = 2400) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
}

let currentZone = '';
function updateZone() {
  const x = player.position.x;
  const z = player.position.z;

  let name = '苔溪镇';
  let nearest = null;
  let nearestDist = Infinity;
  for (const house of HOUSES) {
    const d = Math.hypot(house.x - x, house.z - z);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = house;
    }
  }
  const radius = Math.hypot(x, z);
  if (nearest && nearestDist < 9) {
    name = nearest.name || '民居';
  } else if (Math.abs(x) < WORLD.plazaHalf && Math.abs(z) < WORLD.plazaHalf) {
    name = '中央广场';
  } else if (Math.abs(x) < WORLD.streetHalf) {
    name = z < 0 ? '北街' : '南街';
  } else if (Math.abs(z) < WORLD.laneHalf) {
    name = x < 0 ? '西巷' : '东巷';
  } else if (radius > 31) {
    name = radius > 40 ? '雨林深处' : '雨林边缘';
  } else if (nearestDist < 14) {
    name = '镇中小径';
  } else {
    name = '棕榈草地';
  }

  if (name !== currentZone) {
    currentZone = name;
    zoneEl.textContent = name;
  }
}

const mapCtx = minimapCanvas.getContext('2d');
const MAP_RANGE = 44;
let mapTimer = 0;

function drawMinimap() {
  const S = minimapCanvas.width;
  const scale = S / (MAP_RANGE * 2);
  const cx = S / 2;
  const cy = S / 2;
  const toX = (x) => cx + x * scale;
  const toY = (z) => cy + z * scale;

  mapCtx.clearRect(0, 0, S, S);
  mapCtx.save();
  mapCtx.beginPath();
  mapCtx.arc(cx, cy, S / 2 - 1, 0, Math.PI * 2);
  mapCtx.clip();

  // 丛林底色
  const bg = mapCtx.createRadialGradient(cx, cy * 0.8, 10, cx, cy, S * 0.62);
  bg.addColorStop(0, '#3c5230');
  bg.addColorStop(0.62, '#2f4427');
  bg.addColorStop(1, '#1d2b19');
  mapCtx.fillStyle = bg;
  mapCtx.fillRect(0, 0, S, S);

  // 道路
  mapCtx.fillStyle = 'rgba(146, 137, 118, 0.5)';
  mapCtx.fillRect(toX(-WORLD.streetHalf), 0, WORLD.streetHalf * 2 * scale, S);
  mapCtx.fillRect(0, toY(-WORLD.laneHalf), S, WORLD.laneHalf * 2 * scale);
  mapCtx.fillRect(toX(-WORLD.plazaHalf), toY(-WORLD.plazaHalf), WORLD.plazaHalf * 2 * scale, WORLD.plazaHalf * 2 * scale);

  // 建筑
  for (const rect of town.mapRects) {
    mapCtx.fillStyle = rect.kind === 'tower' ? '#8c6f52' : '#c6a67a';
    mapCtx.strokeStyle = 'rgba(60, 42, 26, 0.75)';
    mapCtx.lineWidth = 1;
    const w = rect.sx * scale;
    const h = rect.sz * scale;
    mapCtx.fillRect(toX(rect.x) - w / 2, toY(rect.z) - h / 2, w, h);
    mapCtx.strokeRect(toX(rect.x) - w / 2, toY(rect.z) - h / 2, w, h);
  }

  // 动物
  if (herd) {
    for (const animal of herd.animals) {
      mapCtx.fillStyle = 'rgba(240, 214, 152, 0.8)';
      mapCtx.beginPath();
      mapCtx.arc(toX(animal.position.x), toY(animal.position.z), 1.6, 0, Math.PI * 2);
      mapCtx.fill();
    }
  }

  // 玩家
  const px = toX(player.position.x);
  const py = toY(player.position.z);
  mapCtx.save();
  mapCtx.translate(px, py);
  mapCtx.rotate(Math.PI - player.heading);
  mapCtx.fillStyle = '#ffe9b0';
  mapCtx.beginPath();
  mapCtx.moveTo(0, -7);
  mapCtx.lineTo(4.6, 5);
  mapCtx.lineTo(0, 2.6);
  mapCtx.lineTo(-4.6, 5);
  mapCtx.closePath();
  mapCtx.fill();
  mapCtx.strokeStyle = 'rgba(40, 30, 16, 0.8)';
  mapCtx.lineWidth = 1;
  mapCtx.stroke();
  mapCtx.restore();

  // 视野光晕
  const glow = mapCtx.createRadialGradient(px, py, 0, px, py, 34);
  glow.addColorStop(0, 'rgba(255, 232, 178, 0.14)');
  glow.addColorStop(1, 'rgba(255, 232, 178, 0)');
  mapCtx.fillStyle = glow;
  mapCtx.fillRect(0, 0, S, S);

  mapCtx.restore();
}

/* ------------------------------------------------------------------ */
/* 主循环                                                              */
/* ------------------------------------------------------------------ */

const clock = new THREE.Clock();
const debug = new URLSearchParams(location.search).has('debug');
const shadowFocus = new THREE.Vector3(999, 0, 999);

let perfAcc = 0;
let perfCount = 0;
let perfTimer = 0;

function adaptResolution(dt) {
  if (!IS_MOBILE) return;
  perfAcc += dt;
  perfCount += 1;
  perfTimer += dt;
  if (perfTimer < 2.2) return;
  const avg = perfAcc / Math.max(perfCount, 1);
  perfTimer = 0;
  perfAcc = 0;
  perfCount = 0;
  const cap = maxPixelRatio();
  if (avg > 1 / 42 && pixelRatio > 0.75) {
    pixelRatio = Math.max(0.75, pixelRatio * 0.86);
    renderer.setPixelRatio(pixelRatio);
  } else if (avg < 1 / 57 && pixelRatio < cap) {
    pixelRatio = Math.min(cap, pixelRatio * 1.08);
    renderer.setPixelRatio(pixelRatio);
  }
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  player.update(dt, readInput(keys), cam.yaw, town);
  updateCamera(dt);
  updateAmbient(ambient, elapsed, player.position);
  updateWind(elapsed);
  if (herd) herd.update(dt, player.position);

  // 阴影相机跟随（按 2 米对齐，避免阴影抖动）
  const fx = Math.round(player.position.x / 2) * 2;
  const fz = Math.round(player.position.z / 2) * 2;
  if (fx !== shadowFocus.x || fz !== shadowFocus.z) {
    shadowFocus.set(fx, 0, fz);
    updateShadowFocus(lights, shadowFocus);
  }

  mapTimer += dt;
  if (mapTimer > (IS_MOBILE ? 0.16 : 0.1)) {
    mapTimer = 0;
    updateZone();
    drawMinimap();
  }

  adaptResolution(dt);

  if (debug) {
    const info = renderer.info.render;
    document.title = `${Math.round(1 / Math.max(dt, 0.0001))} fps · ${info.calls} calls · ${(info.triangles / 1000) | 0}k tris`;
  }

  renderer.render(scene, camera);
}

boot().catch((error) => {
  console.error(error);
  loadingTip.textContent = '载入失败，请检查资源文件是否完整。';
  loadingTip.style.color = '#e08a7a';
});
