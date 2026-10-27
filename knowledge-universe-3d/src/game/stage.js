/**
 * 关卡舞台（Stage）
 * 每个知识点是一段可以在 SVG 上「演出来」的动画。
 * 引擎只负责按 state 画面，Stage 负责把 state 平滑地推过去 —— 于是「下一步」=
 * 改一组变量，画面自己走过去，而不是硬切。
 */

export const VIEW = { w: 1000, h: 620 };

const NS = 'http://www.w3.org/2000/svg';

export function svgEl(tag, attrs = {}, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    node.setAttribute(key, String(value));
  }
  if (parent) parent.appendChild(node);
  return node;
}

export function textEl(parent, str, attrs = {}) {
  const node = svgEl('text', attrs, parent);
  node.textContent = str;
  return node;
}

export function group(parent, attrs = {}) {
  return svgEl('g', attrs, parent);
}

export function pathEl(parent, d, attrs = {}) {
  return svgEl('path', { d, ...attrs }, parent);
}

export function circle(parent, cx, cy, r, attrs = {}) {
  return svgEl('circle', { cx, cy, r, ...attrs }, parent);
}

export function rect(parent, x, y, w, h, attrs = {}) {
  return svgEl('rect', { x, y, width: w, height: h, ...attrs }, parent);
}

export function line(parent, x1, y1, x2, y2, attrs = {}) {
  return svgEl('line', { x1, y1, x2, y2, ...attrs }, parent);
}

export function poly(parent, points, attrs = {}) {
  return svgEl('polygon', { points: points.map((p) => `${p[0]},${p[1]}`).join(' '), ...attrs }, parent);
}

export function linearGradient(defs, id, stops, attrs = {}) {
  const grad = svgEl('linearGradient', { id, ...attrs }, defs);
  for (const [offset, color, opacity = 1] of stops) {
    svgEl('stop', { offset, 'stop-color': color, 'stop-opacity': opacity }, grad);
  }
  return grad;
}

export function radialGradient(defs, id, stops, attrs = {}) {
  const grad = svgEl('radialGradient', { id, ...attrs }, defs);
  for (const [offset, color, opacity = 1] of stops) {
    svgEl('stop', { offset, 'stop-color': color, 'stop-opacity': opacity }, grad);
  }
  return grad;
}

export function glowFilter(defs, id, radius = 12) {
  const filter = svgEl('filter', { id, x: '-60%', y: '-60%', width: '220%', height: '220%' }, defs);
  svgEl('feGaussianBlur', { stdDeviation: radius, result: 'b' }, filter);
  const merge = svgEl('feMerge', {}, filter);
  svgEl('feMergeNode', { in: 'b' }, merge);
  svgEl('feMergeNode', { in: 'SourceGraphic' }, merge);
  return filter;
}

export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mix = (t, a, b) => lerp(a, b, clamp(t));
export const easeOut = (t) => 1 - (1 - clamp(t)) ** 3;
export const smooth = (t) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 极简的多频正弦叠加，用来做水面与烟，比随机更像自然运动 */
export function wobble(t, seed = 1, amp = 1) {
  return (Math.sin(t * 1.1 + seed) * 0.6 + Math.sin(t * 1.9 + seed * 2.3) * 0.3 + Math.sin(t * 3.3 + seed * 0.7) * 0.1) * amp;
}

export function mixColor(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const k = clamp(t);
  return `rgb(${Math.round(lerp(a[0], b[0], k))},${Math.round(lerp(a[1], b[1], k))},${Math.round(lerp(a[2], b[2], k))})`;
}

export function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function alpha(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function formatNumber(value, digits = 0) {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

export class Stage {
  constructor(host) {
    this.host = host;
    this.svg = svgEl('svg', {
      viewBox: `0 0 ${VIEW.w} ${VIEW.h}`,
      preserveAspectRatio: 'xMidYMid slice',
      class: 'stage-svg',
      'aria-hidden': 'true',
    });
    host.appendChild(this.svg);

    this.defs = svgEl('defs', {}, this.svg);
    this.bg = group(this.svg, { class: 'stage-bg' });
    this.mid = group(this.svg, { class: 'stage-mid' });
    this.fg = group(this.svg, { class: 'stage-fg' });
    this.hud = group(this.svg, { class: 'stage-hud' });

    this.engine = null;
    this.spec = {};
    this.tone = '#6BE7FF';
    this.state = {};
    this.target = {};
    this.time = 0;
    this.paused = false;
    this.last = performance.now();
    this.running = true;
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  get ctx() {
    return {
      root: this.mid,
      bg: this.bg,
      fg: this.fg,
      hud: this.hud,
      defs: this.defs,
      spec: this.spec,
      tone: this.tone,
    };
  }

  mount(engineId, spec = {}, initial = {}) {
    const factory = ENGINES[engineId] || ENGINES.curve;
    this.teardown();
    this.spec = spec;
    this.tone = spec.tone || '#6BE7FF';
    // 竖屏时把视口收窄到「有效内容区」，避免读数与公式被裁掉
    const immersive = ['scene', 'verse', 'mirror', 'mapping', 'sentence', 'glyph'].includes(engineId);
    const narrow = window.innerWidth < 700;
    this.svg.setAttribute('viewBox', narrow && !immersive ? '40 0 1000 620' : `0 0 ${VIEW.w} ${VIEW.h}`);
    // 板书要完整显示整块白板，其余场景铺满即可
    this.svg.setAttribute('preserveAspectRatio', engineId === 'board' ? 'xMidYMid meet' : 'xMidYMid slice');
    this.defs.replaceChildren();
    this.bg.replaceChildren();
    this.mid.replaceChildren();
    this.fg.replaceChildren();
    this.hud.replaceChildren();
    this.engine = factory(this.ctx);
    this.state = { ...this.engine.defaults, ...initial, ...spec.state };
    this.target = { ...this.state };
    this.time = 0;
    this.engine.render?.(this.state, 0, 0);
    return this;
  }

  setState(patch = {}) {
    Object.assign(this.target, patch);
  }

  jump(patch = {}) {
    Object.assign(this.target, patch);
    Object.assign(this.state, patch);
    this.engine?.render?.(this.state, this.time, 0);
  }

  setVar(key, value) {
    this.target[key] = value;
  }

  teardown() {
    if (!this.engine) return;
    this.engine.destroy?.();
    this.engine = null;
    this.state = {};
    this.target = {};
  }

  destroy() {
    this.running = false;
    this.teardown();
    this.svg.remove();
  }

  _loop(now) {
    if (!this.running) return;
    requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (!this.engine) return;

    this.time += this.paused ? 0 : dt;
    const k = 1 - Math.exp(-dt * 5.2);
    for (const key of Object.keys(this.target)) {
      const t = this.target[key];
      const c = this.state[key];
      if (typeof t === 'number' && typeof c === 'number') {
        this.state[key] = Math.abs(t - c) < 0.0008 ? t : c + (t - c) * k;
      } else {
        this.state[key] = t;
      }
    }
    this.engine.render?.(this.state, this.time, dt);
    this.engine.animate?.(this.time, dt);
  }
}

/* 引擎在这里注册，避免 stage.js 与引擎文件循环依赖 */
export const ENGINES = {};

export function registerEngines(map) {
  Object.assign(ENGINES, map);
}
