import * as THREE from 'three';
import { mulberry32 } from '../core/utils.js';

/**
 * 程序化贴图库。
 *
 * 全部贴图在运行时用 Canvas 生成，不依赖任何外部资源。
 * 约定：颜色贴图是「接近白色」的明度变化，真正的颜色由材质 color / 顶点色给出，
 * 这样同一张木纹可以被染成松木、柚木或旧船板，而不会互相打架。
 */

const textureCache = new Map();
const textureLoaderAnisotropy = 4;

function createCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function toTexture(canvas, { srgb = true, repeat = 1, anisotropy = textureLoaderAnisotropy } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = anisotropy;
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** 周期性 value noise，保证 4 边可以无缝拼接。 */
function periodicNoise(size, gridSize, seed, octaves = 4) {
  const rng = mulberry32(seed);
  const field = new Float32Array(size * size);
  let amplitude = 1;
  let total = 0;
  let grid = gridSize;
  for (let octave = 0; octave < octaves; octave += 1) {
    const lattice = new Float32Array(grid * grid);
    for (let i = 0; i < lattice.length; i += 1) lattice[i] = rng();
    for (let y = 0; y < size; y += 1) {
      const gy = (y / size) * grid;
      const y0 = Math.floor(gy) % grid;
      const y1 = (y0 + 1) % grid;
      const ty = gy - Math.floor(gy);
      const sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < size; x += 1) {
        const gx = (x / size) * grid;
        const x0 = Math.floor(gx) % grid;
        const x1 = (x0 + 1) % grid;
        const tx = gx - Math.floor(gx);
        const sx = tx * tx * (3 - 2 * tx);
        const a = lattice[y0 * grid + x0];
        const b = lattice[y0 * grid + x1];
        const c = lattice[y1 * grid + x0];
        const d = lattice[y1 * grid + x1];
        const top = a + (b - a) * sx;
        const bottom = c + (d - c) * sx;
        field[y * size + x] += (top + (bottom - top) * sy) * amplitude;
      }
    }
    total += amplitude;
    amplitude *= 0.52;
    grid *= 2;
  }
  for (let i = 0; i < field.length; i += 1) field[i] /= total;
  return field;
}

/** 把 0..1 的场写成灰度 canvas，用作凹凸 / 粗糙度。 */
function fieldToCanvas(field, size, { low = 60, high = 200, curve = 1 } = {}) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < field.length; i += 1) {
    const value = Math.pow(field[i], curve);
    const tone = low + (high - low) * Math.min(1, Math.max(0, value));
    image.data[i * 4] = tone;
    image.data[i * 4 + 1] = tone;
    image.data[i * 4 + 2] = tone;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function fieldToColorCanvas(field, size, palette, { contrast = 1 } = {}) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  const [r0, g0, b0] = palette[0];
  const [r1, g1, b1] = palette[1];
  for (let i = 0; i < field.length; i += 1) {
    const t = Math.min(1, Math.max(0, (field[i] - 0.5) * contrast + 0.5));
    image.data[i * 4] = Math.round(r0 + (r1 - r0) * t);
    image.data[i * 4 + 1] = Math.round(g0 + (g1 - g0) * t);
    image.data[i * 4 + 2] = Math.round(b0 + (b1 - b0) * t);
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function drawGrain(ctx, size, seed, { count = 900, alpha = 0.06, length = 12, color = '#000' } = {}) {
  const rng = mulberry32(seed);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  for (let i = 0; i < count; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    const angle = rng() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length * rng(), y + Math.sin(angle) * length * rng());
    ctx.lineWidth = 0.5 + rng() * 1.2;
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 各类材质
// ---------------------------------------------------------------------------

function woodSet(seed = 11, plankWidth = 64) {
  const size = 256;
  const noise = periodicNoise(size, 6, seed, 4);
  const height = periodicNoise(size, 12, seed + 4, 3);
  const colorCanvas = fieldToColorCanvas(noise, size, [[214, 196, 168], [255, 250, 240]], { contrast: 1.4 });
  const ctx = colorCanvas.getContext('2d');
  const rng = mulberry32(seed + 9);
  // 木纹
  ctx.save();
  for (let x = 0; x < size; x += 1) {
    const tone = 0.5 + Math.sin(x * 0.09 + Math.sin(x * 0.01) * 4) * 0.5;
    ctx.globalAlpha = 0.05 + tone * 0.08;
    ctx.strokeStyle = tone > 0.5 ? '#8b6b48' : '#5c4227';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= size; y += 8) {
      ctx.lineTo(x + Math.sin(y * 0.03 + x * 0.12) * 2.4, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  // 板缝
  const bumpCanvas = ctxForBump(size);
  const bctx = bumpCanvas.getContext('2d');
  bctx.drawImage(fieldToCanvas(height, size, { low: 110, high: 210 }), 0, 0);
  for (let x = 0; x < size; x += plankWidth) {
    ctx.fillStyle = 'rgba(48,32,20,.42)';
    ctx.fillRect(x, 0, 2, size);
    ctx.fillStyle = 'rgba(255,246,225,.16)';
    ctx.fillRect(x + 2, 0, 1.5, size);
    bctx.fillStyle = 'rgba(0,0,0,.85)';
    bctx.fillRect(x, 0, 3, size);
  }
  // 钉子
  for (let x = plankWidth / 2; x < size; x += plankWidth) {
    for (const y of [22, size - 26]) {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 4.5);
      gradient.addColorStop(0, 'rgba(96,74,50,.85)');
      gradient.addColorStop(1, 'rgba(96,74,50,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  drawGrain(ctx, size, seed + 21, { count: 700, alpha: 0.045, length: 22 });
  return { map: colorCanvas, bump: bumpCanvas, repeat: 2 };
}

function ctxForBump(size) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function stoneSet(seed = 21) {
  const size = 256;
  const noise = periodicNoise(size, 5, seed, 5);
  const coarse = periodicNoise(size, 3, seed + 3, 3);
  const canvas = fieldToColorCanvas(noise, size, [[168, 170, 162], [240, 240, 232]], { contrast: 1.5 });
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(seed + 12);
  // 斑驳矿点
  for (let i = 0; i < 420; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 0.6 + rng() * 2.4;
    ctx.fillStyle = rng() > 0.55 ? 'rgba(90,96,88,.32)' : 'rgba(255,255,246,.28)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // 裂缝
  ctx.strokeStyle = 'rgba(68,72,66,.4)';
  for (let i = 0; i < 7; i += 1) {
    let x = rng() * size;
    let y = rng() * size;
    ctx.lineWidth = 0.7 + rng() * 1.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let step = 0; step < 9; step += 1) {
      x += (rng() - 0.5) * 34;
      y += (rng() - 0.5) * 34;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const bump = ctxForBump(size);
  const bctx = bump.getContext('2d');
  bctx.globalAlpha = 0.85;
  bctx.drawImage(fieldToCanvas(noise, size, { low: 96, high: 205 }), 0, 0);
  bctx.globalAlpha = 0.4;
  bctx.drawImage(fieldToCanvas(coarse, size, { low: 60, high: 210 }), 0, 0);
  return { map: canvas, bump, repeat: 2 };
}

function plasterSet(seed = 31) {
  const size = 256;
  const noise = periodicNoise(size, 8, seed, 4);
  const canvas = fieldToColorCanvas(noise, size, [[226, 216, 198], [255, 252, 244]], { contrast: 1.1 });
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(seed + 5);
  for (let i = 0; i < 26; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 8 + rng() * 30;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, 'rgba(150,138,116,.1)');
    gradient.addColorStop(1, 'rgba(150,138,116,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  drawGrain(ctx, size, seed + 8, { count: 300, alpha: 0.03, length: 8 });
  const bump = ctxForBump(size);
  const bctx = bump.getContext('2d');
  bctx.drawImage(fieldToCanvas(noise, size, { low: 108, high: 168 }), 0, 0);
  return { map: canvas, bump, repeat: 2 };
}

function thatchSet(seed = 41) {
  const size = 256;
  const noise = periodicNoise(size, 4, seed, 3);
  const canvas = fieldToColorCanvas(noise, size, [[232, 214, 168], [255, 248, 224]], { contrast: 1.3 });
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(seed + 6);
  const rowHeight = 22;
  const bump = ctxForBump(size);
  const bctx = bump.getContext('2d');
  for (let row = 0; row < size / rowHeight; row += 1) {
    const y = row * rowHeight;
    ctx.fillStyle = 'rgba(120,94,54,.14)';
    ctx.fillRect(0, y, size, 2);
    bctx.fillStyle = 'rgba(0,0,0,.55)';
    bctx.fillRect(0, y, size, 3);
    for (let i = 0; i < 58; i += 1) {
      const x = rng() * size;
      const length = 12 + rng() * 18;
      const lean = (rng() - 0.5) * 7;
      ctx.strokeStyle = `rgba(${rng() > 0.5 ? '120,92,52' : '255,246,214'},${0.1 + rng() * 0.16})`;
      ctx.lineWidth = 1 + rng() * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y + 1);
      ctx.lineTo(x + lean, y + length);
      ctx.stroke();
      bctx.strokeStyle = `rgba(${rng() > 0.5 ? '0,0,0' : '255,255,255'},${0.2 + rng() * 0.35})`;
      bctx.lineWidth = 1 + rng() * 1.6;
      bctx.beginPath();
      bctx.moveTo(x, y + 1);
      bctx.lineTo(x + lean, y + length);
      bctx.stroke();
    }
  }
  return { map: canvas, bump, repeat: 2.4 };
}

function roofTileSet(seed = 51) {
  const size = 256;
  const noise = periodicNoise(size, 6, seed, 3);
  const canvas = fieldToColorCanvas(noise, size, [[208, 198, 182], [252, 248, 238]], { contrast: 1.2 });
  const ctx = canvas.getContext('2d');
  const bump = ctxForBump(size);
  const bctx = bump.getContext('2d');
  const rowHeight = 32;
  const tileWidth = 32;
  for (let row = 0; row * rowHeight < size; row += 1) {
    const y = row * rowHeight;
    const offset = row % 2 ? tileWidth / 2 : 0;
    for (let x = -tileWidth; x < size + tileWidth; x += tileWidth) {
      const px = x + offset;
      const gradient = ctx.createLinearGradient(px, y, px, y + rowHeight);
      gradient.addColorStop(0, 'rgba(255,255,255,.30)');
      gradient.addColorStop(0.55, 'rgba(255,255,255,0)');
      gradient.addColorStop(1, 'rgba(52,46,38,.28)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(px + 1.5, y + 1, tileWidth - 3, rowHeight - 1, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,52,42,.25)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      bctx.strokeStyle = 'rgba(0,0,0,.7)';
      bctx.lineWidth = 2.4;
      bctx.beginPath();
      bctx.roundRect(px + 1.5, y + 1, tileWidth - 3, rowHeight - 1, 5);
      bctx.stroke();
      bctx.fillStyle = 'rgba(255,255,255,.18)';
      bctx.beginPath();
      bctx.roundRect(px + 4, y + 3, tileWidth - 9, rowHeight * 0.5, 5);
      bctx.fill();
    }
  }
  return { map: canvas, bump, repeat: 3 };
}

function soilSet(seed = 61) {
  const size = 256;
  const noise = periodicNoise(size, 7, seed, 4);
  const coarse = periodicNoise(size, 3, seed + 2, 2);
  const canvas = fieldToColorCanvas(noise, size, [[118, 88, 62], [196, 160, 118]], { contrast: 1.35 });
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(seed + 3);
  for (let i = 0; i < 260; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 1 + rng() * 3.6;
    ctx.fillStyle = rng() > 0.5 ? 'rgba(84,58,38,.35)' : 'rgba(214,180,138,.28)';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.65, rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const bump = ctxForBump(size);
  const bctx = bump.getContext('2d');
  bctx.globalAlpha = 0.9;
  bctx.drawImage(fieldToCanvas(noise, size, { low: 90, high: 200 }), 0, 0);
  bctx.globalAlpha = 0.35;
  bctx.drawImage(fieldToCanvas(coarse, size, { low: 70, high: 190 }), 0, 0);
  return { map: canvas, bump, repeat: 2.4 };
}

function sandSet(seed = 71) {
  const size = 256;
  const noise = periodicNoise(size, 4, seed, 3);
  const canvas = fieldToColorCanvas(noise, size, [[226, 208, 172], [255, 250, 232]], { contrast: 1.1 });
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(seed + 4);
  for (let i = 0; i < 1400; i += 1) {
    ctx.fillStyle = rng() > 0.5 ? 'rgba(170,150,112,.22)' : 'rgba(255,255,246,.3)';
    ctx.fillRect(rng() * size, rng() * size, 1, 1);
  }
  // 风纹
  ctx.strokeStyle = 'rgba(160,140,102,.12)';
  for (let i = 0; i < 18; i += 1) {
    ctx.lineWidth = 2 + rng() * 3;
    ctx.beginPath();
    const y = rng() * size;
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.04 + i) * 5);
    ctx.stroke();
  }
  const bump = ctxForBump(size);
  bump.getContext('2d').drawImage(fieldToCanvas(noise, size, { low: 112, high: 178 }), 0, 0);
  return { map: canvas, bump, repeat: 3 };
}

function grassSet(seed = 81) {
  const size = 256;
  const noise = periodicNoise(size, 10, seed, 4);
  const coarse = periodicNoise(size, 4, seed + 5, 3);
  const canvas = fieldToColorCanvas(noise, size, [[176, 190, 148], [255, 255, 236]], { contrast: 1.3 });
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(seed + 7);
  // 草叶走向
  for (let i = 0; i < 2600; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    const len = 2 + rng() * 6;
    ctx.strokeStyle = rng() > 0.45 ? 'rgba(104,126,84,.26)' : 'rgba(238,244,206,.3)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rng() - 0.5) * 2, y - len);
    ctx.stroke();
  }
  // 小野花点
  for (let i = 0; i < 44; i += 1) {
    ctx.fillStyle = rng() > 0.5 ? 'rgba(255,246,210,.5)' : 'rgba(238,206,224,.4)';
    ctx.beginPath();
    ctx.arc(rng() * size, rng() * size, 1 + rng(), 0, Math.PI * 2);
    ctx.fill();
  }
  const bump = ctxForBump(size);
  const bctx = bump.getContext('2d');
  bctx.globalAlpha = 0.9;
  bctx.drawImage(fieldToCanvas(noise, size, { low: 120, high: 188 }), 0, 0);
  bctx.globalAlpha = 0.35;
  bctx.drawImage(fieldToCanvas(coarse, size, { low: 90, high: 196 }), 0, 0);
  return { map: canvas, bump, repeat: 3 };
}

function metalSet(seed = 91) {
  const size = 128;
  const noise = periodicNoise(size, 24, seed, 3);
  const canvas = fieldToColorCanvas(noise, size, [[196, 196, 196], [255, 255, 255]], { contrast: 1.6 });
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(seed + 2);
  for (let i = 0; i < 240; i += 1) {
    const y = rng() * size;
    ctx.strokeStyle = rng() > 0.5 ? 'rgba(110,110,110,.16)' : 'rgba(255,255,255,.2)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (rng() - 0.5) * 2);
    ctx.stroke();
  }
  const bump = ctxForBump(size);
  bump.getContext('2d').drawImage(fieldToCanvas(noise, size, { low: 118, high: 150 }), 0, 0);
  return { map: canvas, bump, repeat: 1, srgb: false };
}

function leafSet(seed = 101) {
  const size = 128;
  const noise = periodicNoise(size, 5, seed, 4);
  const canvas = fieldToColorCanvas(noise, size, [[188, 202, 170], [255, 255, 240]], { contrast: 1.4 });
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(seed + 3);
  for (let i = 0; i < 520; i += 1) {
    ctx.fillStyle = rng() > 0.5 ? 'rgba(84,110,70,.18)' : 'rgba(244,250,214,.24)';
    ctx.beginPath();
    ctx.ellipse(rng() * size, rng() * size, 1.2 + rng() * 3, 0.8 + rng() * 1.8, rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const bump = ctxForBump(size);
  bump.getContext('2d').drawImage(fieldToCanvas(noise, size, { low: 118, high: 178 }), 0, 0);
  return { map: canvas, bump, repeat: 1.4 };
}

const SETS = {
  wood: woodSet,
  stone: stoneSet,
  plaster: plasterSet,
  thatch: thatchSet,
  roof: roofTileSet,
  soil: soilSet,
  sand: sandSet,
  grass: grassSet,
  metal: metalSet,
  leaf: leafSet,
};

/**
 * 取一组材质贴图（带缓存）。
 * @param {string} kind wood | stone | plaster | thatch | roof | soil | sand | grass | metal | leaf
 */
export function getSurface(kind, repeatScale = 1) {
  const recipe = SETS[kind];
  if (!recipe) return null;
  if (!textureCache.has(kind)) {
    const { map, bump, repeat = 1, srgb = true } = recipe();
    textureCache.set(kind, {
      map: toTexture(map, { srgb, repeat }),
      bump: toTexture(bump, { srgb: false, repeat }),
      repeat,
    });
  }
  const entry = textureCache.get(kind);
  if (repeatScale === 1) return entry;
  const key = `${kind}@${repeatScale}`;
  if (!textureCache.has(key)) {
    const map = entry.map.clone();
    const bump = entry.bump.clone();
    map.needsUpdate = true;
    bump.needsUpdate = true;
    map.repeat.set(entry.repeat * repeatScale, entry.repeat * repeatScale);
    bump.repeat.copy(map.repeat);
    textureCache.set(key, { map, bump, repeat: map.repeat.x });
  }
  return textureCache.get(key);
}

/** 草叶的透明贴图，用于 instanced 草地。 */
export function getGrassBladeTexture() {
  if (textureCache.has('grass-blade')) return textureCache.get('grass-blade');
  const size = 128;
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const rng = mulberry32(2024);
  const blades = 9;
  for (let i = 0; i < blades; i += 1) {
    const baseX = 12 + (i / (blades - 1)) * (size - 24) + (rng() - 0.5) * 8;
    const height = size * (0.52 + rng() * 0.44);
    const width = 3.4 + rng() * 3.2;
    const lean = (rng() - 0.5) * 26;
    const tone = 226 + Math.floor(rng() * 29);
    ctx.fillStyle = `rgb(${tone - 6},${tone},${tone - 16})`;
    ctx.beginPath();
    ctx.moveTo(baseX - width / 2, size);
    ctx.quadraticCurveTo(baseX - width * 0.8 + lean * 0.4, size - height * 0.55, baseX + lean, size - height);
    ctx.quadraticCurveTo(baseX + width * 0.9 + lean * 0.4, size - height * 0.5, baseX + width / 2, size);
    ctx.closePath();
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  textureCache.set('grass-blade', texture);
  return texture;
}

/** 圆形软阴影，用于给道具/建筑补一层接触阴影。 */
export function getContactShadowTexture() {
  if (textureCache.has('contact')) return textureCache.get('contact');
  const size = 128;
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(12,26,22,.62)');
  gradient.addColorStop(0.55, 'rgba(12,26,22,.24)');
  gradient.addColorStop(1, 'rgba(12,26,22,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set('contact', texture);
  return texture;
}

export function disposeTextures() {
  textureCache.forEach((entry) => {
    if (entry?.map) entry.map.dispose?.();
    if (entry?.bump) entry.bump.dispose?.();
    if (entry?.isTexture) entry.dispose?.();
  });
  textureCache.clear();
}
