import * as THREE from 'three';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));
export const mod = (n, m) => ((n % m) + m) % m;
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const angleDiff = (a, b) => wrapAngle(a - b);
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const RAD = Math.PI / 180;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRandom(seed, min = 0, max = 1) {
  const rng = mulberry32(seed);
  return min + rng() * (max - min);
}

export function formatTime(seconds, short = false) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--.---';
  const total = Math.max(0, seconds);
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const ms = Math.floor((total % 1) * 1000);
  if (short) return `${m}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export function formatDelta(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const sign = seconds >= 0 ? '+' : '−';
  const abs = Math.abs(seconds);
  return `${sign}${abs.toFixed(3)}`;
}

export function formatGap(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds > 60) return `+${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  return `+${seconds.toFixed(1)}`;
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}

export function mixHex(a, b, t) {
  const ca = hexToRgb(a), cb = hexToRgb(b);
  return rgbToHex(lerp(ca.r, cb.r, t), lerp(ca.g, cb.g, t), lerp(ca.b, cb.b, t));
}

export function canvasTexture(canvas, { srgb = true, repeat = [1, 1], anisotropy = 8 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = anisotropy;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function noiseCanvas(w, h, base = '#202020', opacity = 0.22, seed = 1) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const rng = mulberry32(seed);
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * 255 * opacity;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Canvas normal map from a grayscale height canvas.
export function heightToNormal(source, strength = 2.0) {
  const w = source.width, h = source.height;
  const sctx = source.getContext('2d');
  const src = sctx.getImageData(0, 0, w, h).data;
  const out = makeCanvas(w, h);
  const octx = out.getContext('2d');
  const dst = octx.createImageData(w, h);
  const d = dst.data;
  const at = (x, y) => src[((y + h) % h * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x - 1, y) - at(x + 1, y)) * strength;
      const dy = (at(x, y - 1) - at(x, y + 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      d[i] = (dx / len * 0.5 + 0.5) * 255;
      d[i + 1] = (dy / len * 0.5 + 0.5) * 255;
      d[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  octx.putImageData(dst, 0, 0);
  return out;
}

export function radialTexture(size = 128, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function disposeObject(obj) {
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose?.();
    const mats = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose?.();
      m.dispose?.();
    }
  });
}

export function canvasToTexture(canvas, opts) {
  return canvasTexture(canvas, opts);
}

export function seededColor(seed, saturation = 0.25, lightness = 0.55) {
  const rng = mulberry32(seed);
  const h = rng();
  const s = saturation * (0.6 + rng() * 0.7);
  const l = lightness * (0.72 + rng() * 0.5);
  const c = new THREE.Color();
  c.setHSL(h, s, l);
  return c.getHex();
}

export function makeTextSprite(text, { font = '700 44px "Barlow Condensed", sans-serif', color = '#f3ecdf', bg = 'transparent' } = {}) {
  const pad = 16;
  const c = makeCanvas(8, 8);
  const ctx = c.getContext('2d');
  ctx.font = font;
  const m = ctx.measureText(text);
  const width = Math.ceil(m.width + pad * 2);
  const height = 74;
  c.width = width;
  c.height = height;
  const cx = c.getContext('2d');
  if (bg !== 'transparent') {
    cx.fillStyle = bg;
    cx.fillRect(0, 0, width, height);
  }
  cx.font = font;
  cx.fillStyle = color;
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillText(text, width / 2, height / 2 + 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { texture: tex, aspect: width / height };
}

export function nearestOnPolyline(points, x, z, startIndex = -1, windowSize = 60) {
  let best = Infinity;
  let bestI = 0;
  const n = points.length;
  if (startIndex >= 0) {
    for (let k = -windowSize; k <= windowSize; k++) {
      const i = (startIndex + k + n) % n;
      const p = points[i];
      const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
      if (d < best) { best = d; bestI = i; }
    }
  } else {
    for (let i = 0; i < n; i++) {
      const p = points[i];
      const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
      if (d < best) { best = d; bestI = i; }
    }
  }
  return { index: bestI, distanceSq: best, point: points[bestI] };
}

export function downloadJSON(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function isMobile() {
  return window.matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
}
