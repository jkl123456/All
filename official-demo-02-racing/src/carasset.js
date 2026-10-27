import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * AI 生成车体资产（四视图 -> 混元 3D -> GLB）。
 *
 * 每个 GLB 在导出时已把真实尺寸（长/宽/高）和落地偏移烘进节点矩阵，
 * 所以这里只需要克隆 + 换材质，不用再做缩放标定。
 */

const SOURCES = {
  gt3: { url: '/assets/models/car-gt3.glb', base: '#1d34a4' },
  lm: { url: '/assets/models/car-lm.glb', base: '#e7e3d8' },
};

const templates = new Map();

/**
 * 车体比例微调（运行时缩放，不改 GLB）。
 * 模型是「重建」出来的、比例偏胖，为了塞进真实尺寸做了非等比校正，
 * 垂直方向会被压扁；所以留三个系数让展厅里实时调，
 * 找到舒服的比例后再决定要不要烘回资产。
 */
const UNIT_STANCE = { l: 1, w: 1, h: 1 };
// 每台车各自一套比例系数（按车型存）。同款车的玩家车与 AI 车共用这一套，
// 所以场上不会出现同款车高矮不一。GT3 的重建结果偏扁，默认抬 10%。
const DEFAULT_STANCE = {
  gt3: { l: 1, w: 1, h: 1.1 },
  lm: { l: 1, w: 1, h: 1 },
};
const stanceMap = new Map();

export function getBodyStance(style) {
  const key = style || 'gt3';
  return { ...UNIT_STANCE, ...(DEFAULT_STANCE[key] || {}), ...(stanceMap.get(key) || {}) };
}

export function setBodyStance(style, next) {
  stanceMap.set(style || 'gt3', { ...getBodyStance(style), ...(next || {}) });
}

/** 应用比例系数（x=宽度、y=高度、z=长度；原点在车底中心，所以加高不会离地）。 */
export function applyBodyStance(body, style) {
  if (!body) return;
  const s = getBodyStance(style);
  body.scale.set(s.w, s.h, s.l);
}

const TEX_CACHE = {};
function radialGlow(key, inner, mid, outer) {
  if (TEX_CACHE[key]) return TEX_CACHE[key];
  const s = 64;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.28, mid);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  TEX_CACHE[key] = tex;
  return tex;
}

function glowTexture() {
  return radialGlow('brake', 'rgba(255,255,255,1)', 'rgba(255,120,96,0.85)', 'rgba(255,40,24,0)');
}

function boostTexture() {
  return radialGlow('boost', 'rgba(255,255,255,1)', 'rgba(150,225,255,0.9)', 'rgba(40,140,255,0)');
}

function buildMaterial(src, baseColor, paintColor, desat) {
  const mat = new THREE.MeshPhysicalMaterial({
    map: src.map || null,
    normalMap: src.normalMap || null,
    roughnessMap: src.roughnessMap || null,
    metalnessMap: src.metalnessMap || null,
    color: 0xffffff,
    metalness: 1,
    roughness: 1,
    clearcoat: 0.55,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.75,
    side: THREE.DoubleSide,
  });
  mat.normalScale = new THREE.Vector2(0.85, 0.85);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCarBase = { value: baseColor.clone() };
    shader.uniforms.uCarPaint = { value: paintColor.clone() };
    shader.uniforms.uCarDesat = { value: desat };
    mat.userData.paintUniform = shader.uniforms.uCarPaint;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 uCarBase;\nuniform vec3 uCarPaint;\nuniform float uCarDesat;',
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
          {
            vec3 carC = diffuseColor.rgb;
            float carL = dot(carC, vec3(0.2126, 0.7152, 0.0722));
            // 只替换「主色」区域：和原涂装主色同向的像素换成新颜色，
            // 白色号码牌、红色几何纹样、碳纤维保留下来。
            vec3 carN = carC / max(max(carC.r, max(carC.g, carC.b)), 0.0015);
            vec3 baseN = uCarBase / max(max(uCarBase.r, max(uCarBase.g, uCarBase.b)), 0.0015);
            float sim = dot(carN, baseN);
            float mask = smoothstep(0.86, 0.985, sim);
            float baseL = max(dot(uCarBase, vec3(0.2126, 0.7152, 0.0722)), 0.02);
            vec3 painted = clamp(uCarPaint * clamp(carL / baseL, 0.0, 1.22), 0.0, 1.0);
            vec3 rest = mix(carC, vec3(carL), uCarDesat);
            diffuseColor.rgb = mix(rest, painted, mask);
          }`,
      );
  };
  mat.customProgramCacheKey = () => `carlivery-${desat.toFixed(2)}`;
  return mat;
}

function base64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function injectScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-car-assets]`)) {
      resolve();
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.dataset.carAssets = '1';
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`无法加载 ${src}`));
    document.head.appendChild(el);
  });
}

export async function preloadCarModels(onProgress) {
  // file:// 下浏览器禁止 fetch 本地文件，改读构建时内联进来的 base64
  const isFile = typeof location !== 'undefined' && location.protocol === 'file:';
  const loader = new GLTFLoader();
  const entries = Object.entries(SOURCES);
  for (let i = 0; i < entries.length; i++) {
    const [style, cfg] = entries[i];
    try {
      let gltf;
      if (isFile) {
        if (!globalThis.__APEX_CAR_GLB) await injectScript('./dist/car-assets.js');
        const b64 = globalThis.__APEX_CAR_GLB?.[style];
        if (!b64) throw new Error('内联车体缺失（先跑 npm run build）');
        gltf = await loader.parseAsync(base64ToArrayBuffer(b64), '');
        delete globalThis.__APEX_CAR_GLB[style];
      } else {
        gltf = await loader.loadAsync(cfg.url);
      }
      const root = gltf.scene;
      root.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = true;
      });
      templates.set(style, { root, base: new THREE.Color(cfg.base) });
    } catch (err) {
      console.warn('[car] 车体模型加载失败，回退到程序化模型：', style, err);
    }
    if (onProgress) onProgress((i + 1) / entries.length);
  }
  return templates.size;
}

export function hasCarModel(style) {
  return templates.has(style);
}

/** 克隆车体并套上当前涂装。desat 越高副色越灰（AI 车用）。 */
export function createCarBody(style, paintHex, { desat = 0 } = {}) {
  const tpl = templates.get(style);
  if (!tpl) return null;
  const body = tpl.root.clone(true);
  const paint = new THREE.Color(paintHex);
  body.traverse((o) => {
    if (!o.isMesh) return;
    o.material = buildMaterial(o.material, tpl.base, paint, desat);
  });
  body.userData.paint = paint;
  applyBodyStance(body, style);
  return body;
}

/** 换配色：只改 uniform，不重建网格。 */
export function retintCarBody(body, style, paintHex) {
  if (!body) return;
  const paint = new THREE.Color(paintHex);
  body.traverse((o) => {
    if (!o.isMesh) return;
    const u = o.material?.userData?.paintUniform;
    if (u) u.value.copy(paint);
  });
  body.userData.paint = paint;
}

/** 氮气尾焰：双层锥形喷流 + 冲击钻石 + 喷口辉光，长度收敛到约 1.7m。 */
function boostJetGeometry(radius, length, segments = 20) {
  const geo = new THREE.ConeGeometry(radius, length, segments, 1, true);
  // 圆锥默认尖端朝 +Y；转成尖端朝车尾（-Z），并把喷口放在 z=0。
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -length / 2);
  return geo;
}

function boostJetMaterial(length, core, mid, tip, alpha) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPower: { value: 0 },
      uLength: { value: length },
      uAlpha: { value: alpha },
      uCore: { value: new THREE.Color(core) },
      uMid: { value: new THREE.Color(mid) },
      uTip: { value: new THREE.Color(tip) },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vPos;
      void main() {
        vUv = uv;
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uPower;
      uniform float uLength;
      uniform float uAlpha;
      uniform vec3 uCore;
      uniform vec3 uMid;
      uniform vec3 uTip;
      varying vec2 vUv;
      varying vec3 vPos;
      void main() {
        float t = clamp(-vPos.z / uLength, 0.0, 1.0);
        // 火焰根部收束、尾端散开并随速度抖动
        float root = smoothstep(0.0, 0.055, t);
        float tipFade = 1.0 - smoothstep(0.62, 1.0, t);
        float flicker = 0.82 + 0.18 * sin(t * 42.0 - uTime * 44.0 + sin(vUv.x * 6.2831) * 2.3);
        float wobble = 0.94 + 0.06 * sin(t * 19.0 + uTime * 17.0 + vUv.x * 6.2831);
        float shock = pow(max(0.0, sin(t * 38.0 - uTime * 9.0)), 14.0);
        shock *= (1.0 - t) * 0.8;
        vec3 col = mix(uCore, uMid, smoothstep(0.015, 0.32, t));
        col = mix(col, uTip, smoothstep(0.42, 0.95, t));
        col += shock * vec3(1.0, 0.94, 0.82);
        // 喷射尾端的软边与轻微体积感
        float edge = 0.72 + 0.28 * sin(vUv.x * 3.14159);
        float a = root * tipFade * flicker * wobble * edge * uAlpha * uPower;
        if (a < 0.012) discard;
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function createBoostFlames(width, length, options = {}) {
  const tex = boostTexture();
  const group = new THREE.Group();
  group.name = 'rocket-boost';
  const sprites = [];
  const jets = [];
  const light = options.isPlayer
    ? new THREE.PointLight(0xff8a4c, 0, 6, 2)
    : null;
  if (light) {
    light.position.set(0, 0.48, -length / 2 - 0.55);
    group.add(light);
  }
  const nozzleX = Math.max(0.34, width * 0.205);
  for (const side of [-1, 1]) {
    const nozzle = new THREE.Group();
    nozzle.position.set(side * nozzleX, 0.42, -length / 2 + 0.015);
    // 两股尾焰只轻微外张，主体保持向车尾后方喷射。
    nozzle.rotation.y = -side * 0.06;
    group.add(nozzle);

    const layers = [];
    const makeLayer = (radius, core, mid, tip, alpha, scale) => {
      const len = 1.68 * scale;
      const mat = boostJetMaterial(len, core, mid, tip, alpha);
      const mesh = new THREE.Mesh(boostJetGeometry(radius, len), mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 8;
      nozzle.add(mesh);
      layers.push({ mesh, mat, len, radius, scale });
    };
    // 外焰（橙红到蓝紫），中焰（金黄），内芯（白蓝）
    makeLayer(0.11, '#ff9a38', '#ff3a08', '#2f45ff', 0.26, 1.0);
    makeLayer(0.058, '#ffd27a', '#ff6a16', '#ff1d06', 0.30, 0.78);
    makeLayer(0.022, '#dff4ff', '#9fd8ff', '#477dff', 0.13, 0.54);

    const glowMat = new THREE.SpriteMaterial({
      map: tex,
      color: 0x8fe6ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(0.4, 0.26, 1);
    glow.position.set(0, 0, 0.04);
    glow.renderOrder = 9;
    nozzle.add(glow);
    sprites.push(glow);
    jets.push({ nozzle, layers });
  }

  const state = {
    group,
    sprites,
    jets,
    light,
    level: 0,
    update(level, time = performance.now() * 0.001) {
      const p = Math.min(1, Math.max(0, level));
      state.level = p;
      const flickA = 0.92 + Math.sin(time * 61) * 0.05 + Math.random() * 0.04;
      const flickB = 0.94 + Math.sin(time * 47 + 1.7) * 0.05 + Math.random() * 0.03;
      for (let j = 0; j < jets.length; j++) {
        const jet = jets[j];
        const localFlick = j === 0 ? flickA : flickB;
        // 约 1.2m → 1.75m，随氮气压力平滑伸长。
        const scale = 0.72 + p * 0.32;
        jet.nozzle.scale.set(0.85 + p * 0.12, 0.85 + p * 0.1, scale * localFlick);
        jet.nozzle.visible = p > 0.012;
        for (const l of jet.layers) {
          l.mat.uniforms.uPower.value = p;
          l.mat.uniforms.uTime.value = time;
        }
      }
      for (const s of sprites) {
        s.material.opacity = p * 0.26 * flickA;
        const sc = 0.2 + p * 0.34;
        s.scale.set(sc, sc * 0.64, 1);
      }
      if (light) {
        light.intensity = p * 2.1;
        light.color.setHSL(0.05 + Math.sin(time * 17) * 0.02, 0.9, 0.55);
        light.position.z = -length / 2 - 0.45 - p * 0.45;
      }
    },
    dispose() {
      for (const jet of jets) {
        for (const l of jet.layers) {
          l.mesh.geometry.dispose();
          l.mat.dispose();
        }
      }
      for (const s of sprites) s.material.dispose();
    },
  };
  state.update(0, 0);
  return state;
}

/** 刹车/尾灯辉光。车体是整块烘焙好的网格，尾灯只能靠贴片补动态。 */
export function createBrakeGlows(width, length) {
  const tex = glowTexture();
  const group = new THREE.Group();
  const sprites = [];
  for (const side of [-1, 1]) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color: 0xff2a14,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.46, 0.24, 1);
    sprite.position.set(side * width * 0.3, 0.5, -length / 2 + 0.02);
    sprite.renderOrder = 4;
    group.add(sprite);
    sprites.push(sprite);
  }
  return { group, sprites };
}
