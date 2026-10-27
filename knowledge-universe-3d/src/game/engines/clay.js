/**
 * 板书素材：黏土贴片（clay）
 * 全部以「底边中点为原点、向上为负」的局部坐标绘制，
 * 由 board 引擎负责摆放、缩放与逐条出现。
 */
import { group, rect, pathEl, circle, poly, line, textEl } from '../stage.js';

export const CLAY = {
  wall: '#eadcc2',
  wallDark: '#cdb995',
  roof: '#4f8e98',
  roofDark: '#33636c',
  roofLight: '#74b0b8',
  wood: '#c07a4c',
  woodDark: '#8f5636',
  stone: '#dcd4c3',
  stoneDark: '#b8ad96',
  gold: '#e9ba60',
  red: '#c4563f',
  redDeep: '#9a3c2d',
  ink: '#3b4048',
  skin: '#f3d3b2',
  skinDark: '#daa87f',
  green: '#7d9d61',
  greenDark: '#5a7742',
  water: '#9ecfdd',
  waterDeep: '#6ba7ba',
  paper: '#f6ecd8',
  paperDark: '#e6d7ba',
  blue: '#5a86a8',
};

const OUT = 'rgba(104, 80, 56, 0.26)';

function block(p, x, y, w, h, r, fill, o = {}) {
  const g = group(p, {});
  rect(g, x, y, w, h, { rx: r, fill, stroke: o.stroke || OUT, 'stroke-width': o.sw || 1 });
  if (o.hi !== 0) {
    rect(g, x + w * 0.09, y + h * 0.07, w * 0.82, Math.max(2, h * 0.2), {
      rx: Math.min(r, 5),
      fill: '#fff',
      opacity: o.hi ?? 0.2,
    });
  }
  return g;
}

/** 庑殿顶 / 歇山顶的简化剪影，带瓦垄与翘角 */
function roofShape(p, cx, y, w, o = {}) {
  const hw = w / 2;
  const h = o.h || w * 0.26;
  const fill = o.c || CLAY.roof;
  const dark = o.dark || CLAY.roofDark;
  const g = group(p, {});
  pathEl(
    g,
    `M${cx - hw} ${y} C${cx - hw * 0.55} ${y - 1} ${cx + hw * 0.55} ${y - 1} ${cx + hw} ${y}
     L${cx + hw * 0.94} ${y + h * 0.26} C${cx + hw * 0.5} ${y + h * 0.34} ${cx - hw * 0.5} ${y + h * 0.34} ${cx - hw * 0.94} ${y + h * 0.26} Z`,
    { fill: dark, opacity: 0.92 }
  );
  pathEl(
    g,
    `M${cx - hw} ${y} C${cx - hw * 0.9} ${y - h * 0.24} ${cx - hw * 0.64} ${y - h * 0.74} ${cx - hw * 0.3} ${y - h}
     L${cx + hw * 0.3} ${y - h} C${cx + hw * 0.64} ${y - h * 0.74} ${cx + hw * 0.9} ${y - h * 0.24} ${cx + hw} ${y}
     C${cx + hw * 0.5} ${y + h * 0.12} ${cx - hw * 0.5} ${y + h * 0.12} ${cx - hw} ${y} Z`,
    { fill, stroke: OUT, 'stroke-width': 1 }
  );
  for (let i = -2; i <= 2; i += 1) {
    const x0 = cx + i * hw * 0.19;
    const x1 = cx + i * hw * 0.43;
    pathEl(g, `M${x0} ${y - h * 0.95} C${x0 + (x1 - x0) * 0.4} ${y - h * 0.6} ${x1} ${y - h * 0.26} ${x1} ${y - h * 0.02}`, {
      fill: 'none',
      stroke: 'rgba(255,255,255,0.26)',
      'stroke-width': 1.2,
    });
  }
  rect(g, cx - hw * 0.17, y - h - 5, hw * 0.34, 7, { rx: 3, fill: dark });
  for (const s of [-1, 1]) {
    pathEl(g, `M${cx + s * hw} ${y} q${s * w * 0.05} ${-h * 0.14} ${s * w * 0.058} ${-h * 0.42}`, {
      fill: 'none',
      stroke: fill,
      'stroke-width': 5,
      'stroke-linecap': 'round',
    });
    circle(g, cx + s * hw * 0.2, y - h - 7, 3.4, { fill: fill });
  }
  return g;
}

/* ------------------------------- 建筑 ------------------------------- */
export function gate(p, o = {}) {
  const w = o.w || 132;
  const h = o.h || 92;
  const g = group(p, {});
  block(g, -w / 2, -h, w, h, 4, CLAY.wall);
  for (let i = 1; i < 4; i += 1) {
    line(g, -w / 2 + 4, -h + (i * h) / 4, w / 2 - 4, -h + (i * h) / 4, { stroke: 'rgba(120,94,66,0.13)', 'stroke-width': 1 });
  }
  pathEl(g, 'M-22 0 v-30 a22 22 0 0 1 44 0 V0 Z', { fill: CLAY.woodDark });
  pathEl(g, 'M-22 0 v-26 a22 22 0 0 1 44 0', { fill: 'none', stroke: 'rgba(255,255,255,0.18)', 'stroke-width': 1.4 });
  for (let i = 0; i < 5; i += 1) {
    const cw = (w - 14) / 5;
    block(g, -w / 2 + 7 + i * cw, -h - 10, cw - 7, 12, 2, CLAY.wall);
  }
  block(g, -w * 0.33, -h - 45, w * 0.66, 35, 3, CLAY.wall);
  for (let i = -1; i <= 1; i += 1) {
    rect(g, i * 24 - 8, -h - 37, 16, 17, { rx: 2, fill: 'rgba(255,210,140,0.8)' });
  }
  roofShape(g, 0, -h - 45, w * 0.94, { h: w * 0.24 });
  return g;
}

export function pavilion(p, o = {}) {
  const w = o.w || 96;
  const g = group(p, {});
  block(g, -w * 0.42, -9, w * 0.84, 9, 3, CLAY.stone);
  for (const x of [-0.34, -0.12, 0.12, 0.34]) {
    rect(g, x * w - 3, -62, 6, 54, { rx: 2, fill: CLAY.wood });
  }
  rect(g, -w * 0.37, -32, w * 0.74, 4, { rx: 2, fill: CLAY.wood, opacity: 0.9 });
  for (let i = -3; i <= 3; i += 1) rect(g, i * w * 0.1 - 1.4, -32, 2.8, 22, { rx: 1, fill: CLAY.wood, opacity: 0.8 });
  block(g, -w * 0.19, -72, w * 0.38, 13, 2, CLAY.gold);
  roofShape(g, 0, -74, w * 1.08, { h: w * 0.34 });
  return g;
}

export function house(p, o = {}) {
  const w = o.w || 96;
  const g = group(p, {});
  block(g, -w * 0.4, -52, w * 0.8, 52, 3, CLAY.wall);
  rect(g, -w * 0.34, -46, w * 0.2, 20, { rx: 2, fill: 'rgba(255,210,140,0.75)' });
  rect(g, w * 0.1, -46, w * 0.2, 20, { rx: 2, fill: 'rgba(255,210,140,0.75)' });
  pathEl(g, `M-11 0 v-24 a11 11 0 0 1 22 0 V0 Z`, { fill: CLAY.woodDark });
  roofShape(g, 0, -52, w * 1.04, { h: w * 0.32 });
  return g;
}

export function storey(p, o = {}) {
  const w = o.w || 100;
  const levels = o.levels || 2;
  const g = group(p, {});
  block(g, -w * 0.44, -8, w * 0.88, 8, 3, CLAY.stone);
  let y = -8;
  for (let i = 0; i < levels; i += 1) {
    const bw = w * (0.82 - i * 0.13);
    const bh = 34 - i * 4;
    block(g, -bw / 2, y - bh, bw, bh, 3, CLAY.wall);
    rect(g, -bw * 0.3, y - bh + 8, bw * 0.22, bh * 0.5, { rx: 2, fill: 'rgba(255,208,140,0.78)' });
    rect(g, bw * 0.08, y - bh + 8, bw * 0.22, bh * 0.5, { rx: 2, fill: 'rgba(255,208,140,0.78)' });
    roofShape(g, 0, y - bh, bw * 1.34, { h: bw * 0.3 });
    y = y - bh - bw * 0.3 + 6;
  }
  return g;
}

export function towerPavilion(p, o = {}) {
  const w = o.w || 112;
  const g = group(p, {});
  block(g, -w * 0.5, -16, w, 16, 3, CLAY.stone);
  for (let i = 0; i < 4; i += 1) {
    rect(g, -w * 0.42 + i * w * 0.28 - 2, -22, 4, 8, { fill: CLAY.stoneDark });
  }
  let y = -16;
  for (let i = 0; i < 2; i += 1) {
    const bw = w * (0.78 - i * 0.12);
    const bh = 38 - i * 5;
    for (const x of [-0.36, -0.12, 0.12, 0.36]) rect(g, x * bw - 2.4, y - bh + 8, 4.8, bh - 8, { rx: 2, fill: CLAY.wood });
    block(g, -bw / 2, y - bh, bw, 9, 2, CLAY.wood, { hi: 0.12 });
    rect(g, -bw * 0.44, y - bh * 0.5, bw * 0.88, 3.5, { rx: 2, fill: CLAY.wood });
    roofShape(g, 0, y - bh, bw * 1.36, { h: bw * 0.3 });
    y = y - bh - bw * 0.3 + 4;
  }
  return g;
}

export function corridor(p, o = {}) {
  const w = o.w || 260;
  const g = group(p, {});
  block(g, -w / 2, -8, w, 8, 3, CLAY.stone);
  for (let i = 0; i < 7; i += 1) {
    const x = -w / 2 + 12 + (i * (w - 24)) / 6;
    rect(g, x - 3, -54, 6, 46, { rx: 2, fill: CLAY.wood });
  }
  rect(g, -w / 2 + 6, -30, w - 12, 4, { rx: 2, fill: CLAY.wood });
  for (let i = 0; i < 20; i += 1) rect(g, -w / 2 + 10 + i * ((w - 20) / 20), -30, 2.6, 20, { rx: 1, fill: CLAY.wood, opacity: 0.75 });
  roofShape(g, 0, -54, w * 1.02, { h: 34 });
  return g;
}

export function terrace(p, o = {}) {
  const w = o.w || 120;
  const g = group(p, {});
  for (let i = 0; i < 3; i += 1) {
    block(g, -w / 2 + i * 9, -12 - i * 14, w - i * 18, 14, 2, i % 2 ? CLAY.stoneDark : CLAY.stone);
  }
  for (let i = 0; i < 5; i += 1) {
    const x = -w * 0.36 + i * w * 0.18;
    rect(g, x - 2, -62, 4, 24, { rx: 2, fill: CLAY.wood });
  }
  rect(g, -w * 0.4, -62, w * 0.8, 4, { rx: 2, fill: CLAY.wood });
  return g;
}

export function waterPavilion(p, o = {}) {
  const w = o.w || 108;
  const g = group(p, {});
  for (const x of [-0.34, -0.12, 0.12, 0.34]) {
    rect(g, x * w - 3, -30, 6, 30, { rx: 2, fill: CLAY.woodDark });
  }
  block(g, -w * 0.46, -36, w * 0.92, 8, 2, CLAY.wood);
  for (const x of [-0.32, -0.11, 0.11, 0.32]) rect(g, x * w - 2.8, -78, 5.6, 44, { rx: 2, fill: CLAY.wood });
  rect(g, -w * 0.36, -50, w * 0.72, 4, { rx: 2, fill: CLAY.wood });
  roofShape(g, 0, -80, w * 0.96, { h: w * 0.3 });
  return g;
}

export function boat(p, o = {}) {
  const w = o.w || 140;
  const g = group(p, {});
  pathEl(g, `M${-w / 2} -10 Q${-w / 2 + 6} 4 0 4 Q${w / 2 - 6} 4 ${w / 2} -10 Z`, { fill: CLAY.woodDark, stroke: OUT });
  block(g, -w * 0.24, -34, w * 0.48, 24, 3, CLAY.wall);
  rect(g, -w * 0.18, -30, w * 0.14, 14, { rx: 2, fill: 'rgba(255,210,140,0.8)' });
  rect(g, w * 0.04, -30, w * 0.14, 14, { rx: 2, fill: 'rgba(255,210,140,0.8)' });
  roofShape(g, 0, -34, w * 0.62, { h: 22 });
  return g;
}

/* ------------------------------- 人物 ------------------------------- */
export function person(p, o = {}) {
  const s = o.scale || 1;
  const bulk = o.bulk || 0;
  const robe = o.robe || CLAY.red;
  const g = group(p, { transform: `scale(${s})` });
  const bw = 15 + bulk * 9;
  const bh = 40 + bulk * 6;
  // 脚
  rect(g, -11, -8, 8, 8, { rx: 3, fill: CLAY.ink, opacity: 0.85 });
  rect(g, 3, -8, 8, 8, { rx: 3, fill: CLAY.ink, opacity: 0.85 });
  // 袍
  pathEl(g, `M${-bw} 0 L${-bw * 0.82} ${-bh} Q0 ${-bh - 6} ${bw * 0.82} ${-bh} L${bw} 0 Z`, {
    fill: robe,
    stroke: OUT,
    'stroke-width': 1,
  });
  // 衣领
  pathEl(g, `M-6 ${-bh - 2} L0 ${-bh + 12} L6 ${-bh - 2}`, { fill: 'none', stroke: 'rgba(255,255,255,0.55)', 'stroke-width': 3, 'stroke-linejoin': 'round' });
  // 腰带
  rect(g, -bw * 0.8, -bh * 0.46, bw * 1.6, 6, { rx: 2, fill: o.belt || CLAY.gold });
  // 手臂
  rect(g, -bw - 7, -bh * 0.9, 8, 26, { rx: 4, fill: robe, stroke: OUT, 'stroke-width': 0.8 });
  rect(g, bw - 1, -bh * 0.9, 8, 26, { rx: 4, fill: robe, stroke: OUT, 'stroke-width': 0.8 });
  // 头
  circle(g, 0, -bh - 15, 13, { fill: CLAY.skin, stroke: OUT, 'stroke-width': 1 });
  // 五官
  circle(g, -4.2, -bh - 17, 1.5, { fill: '#4a3a2e' });
  circle(g, 4.2, -bh - 17, 1.5, { fill: '#4a3a2e' });
  pathEl(g, `M-3.4 ${-bh - 10.5} q3.4 2.6 6.8 0`, { fill: 'none', stroke: '#8a5b48', 'stroke-width': 1.4, 'stroke-linecap': 'round' });
  // 帽
  const hat = o.hat || 'official';
  if (hat === 'emperor') {
    rect(g, -17, -bh - 34, 34, 5, { rx: 2, fill: '#2f3640' });
    rect(g, -11, -bh - 30, 22, 8, { rx: 2, fill: '#2f3640' });
    for (const x of [-12, -6, 0, 6, 12]) circle(g, x, -bh - 25.5, 1.6, { fill: CLAY.gold });
    rect(g, -19, -bh - 35, 3, 12, { fill: CLAY.gold, opacity: 0.9 });
    rect(g, 16, -bh - 35, 3, 12, { fill: CLAY.gold, opacity: 0.9 });
  } else if (hat === 'general') {
    pathEl(g, `M-15 ${-bh - 20} q15 -16 30 0 q-15 -5 -30 0 Z`, { fill: '#59616d', stroke: OUT });
    rect(g, -2, -bh - 40, 4, 12, { rx: 2, fill: CLAY.red });
    circle(g, 0, -bh - 42, 4, { fill: CLAY.gold });
    for (const s2 of [-1, 1]) pathEl(g, `M${s2 * 14} ${-bh - 18} q${s2 * 5} 6 ${s2 * 2} 12`, { fill: 'none', stroke: CLAY.gold, 'stroke-width': 2 });
  } else if (hat === 'soldier') {
    pathEl(g, `M-14 ${-bh - 19} q14 -13 28 0 q-14 -4 -28 0 Z`, { fill: '#6b6f78', stroke: OUT });
    circle(g, 0, -bh - 27, 3, { fill: CLAY.gold });
  } else if (hat === 'scholar') {
    pathEl(g, `M-13 ${-bh - 22} q13 -12 26 0 q-13 -4 -26 0 Z`, { fill: '#4b545e' });
    pathEl(g, `M-2 ${-bh - 30} q4 -6 8 0`, { fill: 'none', stroke: '#4b545e', 'stroke-width': 3 });
  } else if (hat === 'none') {
    // 不戴帽：只留一头短发
    pathEl(g, `M-13 ${-bh - 19} q13 -11 26 0 q-13 4 -26 0 Z`, { fill: '#4a4038', opacity: 0.92 });
  } else {
    rect(g, -14, -bh - 30, 28, 9, { rx: 4, fill: '#333a44' });
    pathEl(g, `M-14 ${-bh - 22} q-8 2 -10 8`, { fill: 'none', stroke: '#333a44', 'stroke-width': 3, 'stroke-linecap': 'round' });
    pathEl(g, `M14 ${-bh - 22} q8 2 10 8`, { fill: 'none', stroke: '#333a44', 'stroke-width': 3, 'stroke-linecap': 'round' });
  }
  if (o.beard) {
    pathEl(g, `M-6 ${-bh - 8} q6 10 12 0 q-6 3 -12 0 Z`, { fill: '#4a4038', opacity: 0.85 });
  }
  if (o.spear) {
    rect(g, bw + 6, -bh - 34, 3, 78, { rx: 2, fill: CLAY.woodDark });
    pathEl(g, `M${bw + 7.5} ${-bh - 46} l5 10 -5 10 -5 -10 Z`, { fill: '#b9c3cf' });
  }
  if (o.flag) {
    rect(g, bw + 8, -bh - 44, 3, 84, { rx: 1, fill: CLAY.woodDark });
    pathEl(g, `M${bw + 11} ${-bh - 44} l34 8 -34 10 Z`, { fill: o.flagColor || CLAY.red });
  }
  return g;
}

export function horse(p, o = {}) {
  const g = group(p, { transform: `scale(${o.scale || 1})` });
  const c = o.c || '#c98a54';
  for (const [x, flip] of [[-26, 0], [-16, 0], [18, 0], [28, 0]]) {
    rect(g, x - 3, -22, 6, 22, { rx: 3, fill: o.dark || '#a66a3c' });
  }
  pathEl(g, 'M-34 -40 q10 -12 30 -12 q22 0 30 12 q6 14 -4 20 q-26 8 -50 0 q-10 -8 -6 -20 Z', {
    fill: c,
    stroke: OUT,
    'stroke-width': 1,
  });
  pathEl(g, 'M30 -48 q8 -14 14 -22 q4 -6 10 -4 q5 2 3 9 l-7 20 Z', { fill: c, stroke: OUT, 'stroke-width': 1 });
  circle(g, 46, -70, 2, { fill: '#3f3025' });
  pathEl(g, 'M-34 -44 q-12 -6 -12 -22 q8 4 15 12 Z', { fill: o.dark || '#a66a3c' });
  pathEl(g, 'M22 -58 q10 -4 14 -12', { fill: 'none', stroke: o.dark || '#a66a3c', 'stroke-width': 4, 'stroke-linecap': 'round' });
  return g;
}

/* ------------------------------- 道具 ------------------------------- */
export function book(p, o = {}) {
  const g = group(p, { transform: `scale(${o.scale || 1})` });
  rect(g, -30, -12, 60, 12, { rx: 2, fill: CLAY.paperDark, stroke: OUT });
  for (let i = 0; i < 6; i += 1) rect(g, -26 + i * 9, -14, 7, 3, { rx: 1, fill: '#b9a888' });
  rect(g, -32, -4, 64, 4, { rx: 2, fill: '#d9c8a8' });
  return g;
}

export function field(p, o = {}) {
  const g = group(p, { transform: `scale(${o.scale || 1})` });
  for (let r = 0; r < 2; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      const x = c * 34 - 51;
      const y = r * 16 - 22;
      pathEl(g, `M${x} ${y} l30 0 l8 12 l-30 0 Z`, { fill: r ? '#b39a6d' : '#c6ad7d', stroke: 'rgba(104,80,56,0.22)', 'stroke-width': 1 });
    }
  }
  for (let i = 0; i < 6; i += 1) {
    pathEl(g, `M${-48 + i * 18} -12 q2 -8 0 -12`, { fill: 'none', stroke: CLAY.greenDark, 'stroke-width': 1.6 });
  }
  return g;
}

export function cell(p, o = {}) {
  const g = group(p, { transform: `scale(${o.scale || 1}) rotate(${o.rot || 0})` });
  rect(g, -17, -64, 34, 58, { rx: 8, fill: o.c || '#5f8fb5', stroke: OUT, 'stroke-width': 1 });
  rect(g, -11, -58, 22, 46, { rx: 5, fill: 'rgba(255,255,255,0.18)' });
  rect(g, -6, -69, 12, 6, { rx: 2, fill: '#c9d4dd', stroke: OUT });
  rect(g, -14, -40, 28, 9, { rx: 2, fill: 'rgba(255,244,214,0.85)' });
  return g;
}

export function pouch(p, o = {}) {
  const g = group(p, { transform: `scale(${o.scale || 1})` });
  pathEl(g, 'M-30 0 v-56 q0 -10 10 -10 l8 0 v-8 l8 0 v8 l6 0 q10 0 10 10 v56 Z', {
    fill: '#cfd6dc',
    stroke: OUT,
    'stroke-width': 1,
  });
  pathEl(g, 'M-30 -18 q-14 2 -12 16 q2 12 14 8', { fill: '#cfd6dc', stroke: OUT });
  pathEl(g, 'M30 -30 q16 4 12 18 q-2 10 -14 6', { fill: '#cfd6dc', stroke: OUT });
  rect(g, -14, -50, 28, 32, { rx: 3, fill: 'rgba(255,255,255,0.35)' });
  for (const [x, y] of [[-22, -12], [10, -26], [0, -6]]) circle(g, x, y, 3, { fill: '#b8a27a', opacity: 0.7 });
  return g;
}

export function graphite(p, o = {}) {
  const g = group(p, { transform: `scale(${o.scale || 1})` });
  for (let i = 0; i < 5; i += 1) {
    rect(g, -42, -12 - i * 12, 84, 7, { rx: 2, fill: i % 2 ? '#5c6672' : '#6d7885', stroke: 'rgba(30,36,44,0.25)' });
  }
  return g;
}

export function bulb(p, o = {}) {
  const g = group(p, { transform: `scale(${o.scale || 1})` });
  circle(g, 0, -52, 17, { fill: 'rgba(255,226,150,0.92)', stroke: OUT, 'stroke-width': 1 });
  pathEl(g, 'M-8 -34 h16 l-3 10 h-10 Z', { fill: '#b9c3cf', stroke: OUT });
  for (let i = 0; i < 4; i += 1) rect(g, -6, -30 + i * 4, 12, 2, { rx: 1, fill: '#98a4b0' });
  pathEl(g, 'M-4 -50 q4 -8 8 0', { fill: 'none', stroke: '#e8a23c', 'stroke-width': 2 });
  return g;
}

export function bird(p, o = {}) {
  const g = group(p, { transform: `scale(${o.scale || 1})` });
  const c = o.c || '#6ba7d6';
  pathEl(g, 'M-14 -8 q10 -12 22 -2 q10 8 4 14 q-10 6 -20 -2 q-8 -4 -6 -10 Z', { fill: c, stroke: OUT, 'stroke-width': 1 });
  pathEl(g, 'M-8 -6 q-10 -10 -4 -16 q8 2 10 10 Z', { fill: c, opacity: 0.9 });
  circle(g, 9, -10, 1.6, { fill: '#2f3a44' });
  pathEl(g, 'M14 -8 l7 3 -7 2 Z', { fill: '#e8a23c' });
  return g;
}

export function leaf(p, o = {}) {
  const g = group(p, { transform: `scale(${o.scale || 1}) rotate(${o.rot || 0})` });
  pathEl(g, 'M0 0 C-52 -26 -58 -86 0 -112 C58 -86 52 -26 0 0 Z', {
    fill: o.c || '#6f9a55',
    stroke: OUT,
    'stroke-width': 1.1,
  });
  pathEl(g, 'M0 -6 L0 -104', { fill: 'none', stroke: 'rgba(255,255,255,0.4)', 'stroke-width': 2.2 });
  for (let i = 0; i < 5; i += 1) {
    const y = -18 - i * 17;
    pathEl(g, `M0 ${y} q-20 -4 -30 -16`, { fill: 'none', stroke: 'rgba(255,255,255,0.28)', 'stroke-width': 1.3 });
    pathEl(g, `M0 ${y} q20 -4 30 -16`, { fill: 'none', stroke: 'rgba(255,255,255,0.28)', 'stroke-width': 1.3 });
  }
  return g;
}

export function sun(p, o = {}) {
  const g = group(p, { transform: `scale(${o.scale || 1})` });
  const c = o.c || '#e9ba60';
  circle(g, 0, -46, 24, { fill: c, stroke: OUT, 'stroke-width': 1 });
  circle(g, -7, -52, 8, { fill: '#fff', opacity: 0.25 });
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    line(g, Math.cos(a) * 32, -46 + Math.sin(a) * 32, Math.cos(a) * 44, -46 + Math.sin(a) * 44, {
      stroke: c,
      'stroke-width': 3,
      'stroke-linecap': 'round',
      opacity: 0.85,
    });
  }
  return g;
}

export function droplet(p, o = {}) {
  const g = group(p, { transform: `scale(${o.scale || 1})` });
  pathEl(g, 'M0 0 C-22 -18 -26 -34 -18 -46 C-12 -56 -4 -62 0 -74 C4 -62 12 -56 18 -46 C26 -34 22 -18 0 0 Z', {
    fill: o.c || '#7fb6cf',
    stroke: OUT,
    'stroke-width': 1,
  });
  pathEl(g, 'M-8 -32 q4 -10 10 -14', { fill: 'none', stroke: 'rgba(255,255,255,0.5)', 'stroke-width': 2 });
  return g;
}

export function flask(p, o = {}) {
  const g = group(p, { transform: `scale(${o.scale || 1})` });
  pathEl(g, 'M-10 -78 h20 v18 l20 46 a12 12 0 0 1 -11 18 h-38 a12 12 0 0 1 -11 -18 l20 -46 Z', {
    fill: 'rgba(160,206,222,0.5)',
    stroke: OUT,
    'stroke-width': 1.2,
  });
  pathEl(g, 'M-14 -24 h28 l10 24 a8 8 0 0 1 -7 12 h-34 a8 8 0 0 1 -7 -12 Z', { fill: o.c || '#8fc6a8', opacity: 0.9 });
  rect(g, -11, -82, 22, 6, { rx: 2, fill: '#c9d4dd', stroke: OUT });
  return g;
}

export function rocket(p, o = {}) {
  const g = group(p, { transform: `scale(${o.scale || 1})` });
  const body = o.c || '#e9e4d8';
  // 尾焰
  if (o.flame) {
    pathEl(g, 'M-14 6 q-8 50 14 92 q22 -42 14 -92 Z', { fill: 'rgba(255,170,80,0.85)' });
    pathEl(g, 'M-7 6 q-4 30 7 56 q11 -26 7 -56 Z', { fill: 'rgba(255,240,190,0.95)' });
  }
  // 箭体
  rect(g, -17, -132, 34, 138, { rx: 12, fill: body, stroke: OUT, 'stroke-width': 1.1 });
  rect(g, -8, -132, 6, 138, { rx: 3, fill: '#fff', opacity: 0.28 });
  // 整流罩
  pathEl(g, 'M-17 -128 q17 -46 34 0 Z', { fill: o.nose || '#d8d2c4', stroke: OUT, 'stroke-width': 1 });
  // 舷窗
  circle(g, 0, -104, 7, { fill: '#7fb6cf', stroke: OUT });
  // 色带
  rect(g, -17, -46, 34, 12, { fill: o.band || '#c4563f', opacity: 0.9 });
  // 尾翼
  pathEl(g, 'M-17 6 l-18 22 h18 Z', { fill: o.fin || '#b6412f', stroke: OUT });
  pathEl(g, 'M17 6 l18 22 h-18 Z', { fill: o.fin || '#b6412f', stroke: OUT });
  // 喷口
  pathEl(g, 'M-12 6 h24 l-4 10 h-16 Z', { fill: '#6b6b6b', stroke: OUT });
  return g;
}

export function flag(p, o = {}) {
  const g = group(p, { transform: `scale(${o.scale || 1})` });
  rect(g, -2, -66, 4, 66, { rx: 2, fill: CLAY.woodDark });
  pathEl(g, 'M2 -64 l40 9 -40 11 Z', { fill: o.c || CLAY.red, stroke: OUT });
  return g;
}

export function panel(p, o = {}) {
  const g = group(p, { transform: `scale(${o.scale || 1})` });
  if (o.kind === 'triple') {
    rect(g, -34, -34, 68, 34, { rx: 4, fill: '#dfe4ea', stroke: OUT });
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) circle(g, -20 + i * 20, -24 + j * 9, 4.4, { fill: '#5a86a8' });
    }
  } else {
    rect(g, -32, -30, 64, 30, { rx: 5, fill: '#f7f3e8', stroke: OUT });
    rect(g, -26, -24, 52, 18, { rx: 3, fill: '#cfd8de' });
    for (let i = 0; i < 4; i += 1) rect(g, -22 + i * 12, -22, 8, 14, { rx: 1.5, fill: '#7f9fb8', opacity: 0.8 });
  }
  return g;
}

export const CLAY_TYPES = {
  rocket,
  leaf,
  sun,
  droplet,
  flask,
  gate,
  pavilion,
  house,
  storey,
  towerPavilion,
  corridor,
  terrace,
  waterPavilion,
  boat,
  person,
  horse,
  book,
  field,
  cell,
  pouch,
  graphite,
  bulb,
  bird,
  flag,
  panel,
};

export function drawClay(parent, type, opts = {}) {
  const fn = CLAY_TYPES[type];
  if (!fn) return group(parent, {});
  return fn(parent, opts);
}

export function clayText(parent, str, opts = {}) {
  return textEl(parent, str, opts);
}

export { textEl, poly };
