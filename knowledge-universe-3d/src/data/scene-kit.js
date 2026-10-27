/**
 * 手绘板书的零件库
 *
 * 板书不是 PPT：所有内容都是用「笔」一点点画上去的。
 * 这里提供三类零件：
 *   1) 线条 / 形状 —— 用 PATH 画，带一点弧度，像手画的
 *   2) 标注 —— 手写体文字、括号、下划线、圈注
 *   3) 黏土贴片 —— 复用 clay.js 里的人物、建筑、道具
 *
 * 坐标仍是 1000 × 620 的白板，安全区 x∈[80, 900]，y∈[60, 580]。
 */
import {
  A, BLUE, GOLD, GRAY, GREEN, L, NOTE, P, PATH, RED, S, TAG, T, U,
} from './board-kit.js';

export const INK = '#3f4652';
export const PAPER = '#fbf5e8';
export const LINE = 'rgba(93,100,112,0.42)';
export const SOFT = 'rgba(47,93,143,0.10)';

export const C = { blue: BLUE, red: RED, green: GREEN, gold: GOLD, gray: GRAY, ink: INK };

/* ------------------------------- 笔：线 ------------------------------- */
/** 一条会轻微走形的手绘线（默认带 0.25% 的弓形） */
export function line(x1, y1, x2, y2, o = {}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const bend = (o.bend ?? 0.25) * len / 100;
  const nx = -dy / len;
  const ny = dx / len;
  return PATH(`M${x1} ${y1}Q${(x1 + x2) / 2 + nx * bend} ${(y1 + y2) / 2 + ny * bend} ${x2} ${y2}`, {
    stroke: o.c || C.blue,
    width: o.w ?? 2,
    opacity: o.opacity ?? 1,
    dash: o.dash,
    anim: o.anim,
  });
}

export function path(d, o = {}) {
  return PATH(d, {
    stroke: o.stroke ?? o.c ?? C.blue,
    width: o.width ?? o.w ?? 2,
    fill: o.fill ?? 'none',
    opacity: o.opacity ?? 1,
    dash: o.dash,
    anim: o.anim,
  });
}

export function box(x, y, w, h, o = {}) {
  return path(`M${x} ${y}h${w}v${h}h${-w}Z`, o);
}

export function rbox(x, y, w, h, r = 10, o = {}) {
  return path(
    `M${x + r} ${y}h${w - r * 2}a${r} ${r} 0 0 1 ${r} ${r}v${h - r * 2}` +
      `a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - r * 2)}a${r} ${r} 0 0 1 ${-r} ${-r}` +
      `v${-(h - r * 2)}a${r} ${r} 0 0 1 ${r} ${-r}Z`,
    o,
  );
}

export function circle(cx, cy, r, o = {}) {
  return path(`M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`, o);
}

export function ellipse(cx, cy, rx, ry, o = {}) {
  return path(`M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0`, o);
}

export function poly(pts, o = {}) {
  return path(`M${pts.map(([x, y]) => `${x} ${y}`).join('L')}Z`, o);
}

export function arc(cx, cy, r, a0, a1, o = {}) {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return path(`M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(1)} ${y1.toFixed(1)}`, o);
}

/** 波浪线：水面、声波、气流 */
export function wave(x, y, w, amp = 8, n = 4, o = {}) {
  const step = w / n;
  let d = `M${x} ${y}`;
  for (let i = 0; i < n; i += 1) {
    const up = i % 2 === 0 ? -amp : amp;
    d += `q${step * 0.25} ${up} ${step * 0.5} 0q${step * 0.25} ${-up} ${step * 0.5} 0`;
  }
  return path(d, o);
}

/** 山：一条折线 + 可选填充 */
export function mountain(x, y, w, h, o = {}) {
  const peak = x + w * 0.5;
  return path(`M${x} ${y}L${peak - w * 0.18} ${y - h * 0.62}L${peak} ${y - h}L${peak + w * 0.22} ${y - h * 0.5}L${x + w} ${y}Z`, {
    stroke: o.c || C.gray,
    width: o.w ?? 1.8,
    fill: o.fill ?? 'rgba(160,150,120,0.14)',
    opacity: o.opacity ?? 1,
  });
}

/** 手绘矩形网格（表格、坐标纸、版式栅格） */
export function grid(x, y, w, h, cols, rows, o = {}) {
  const out = [box(x, y, w, h, { stroke: o.c || LINE, width: o.w ?? 1.2, opacity: o.opacity ?? 0.8 })];
  for (let i = 1; i < cols; i += 1) out.push(line(x + (w / cols) * i, y, x + (w / cols) * i, y + h, { c: o.c || LINE, w: o.w ?? 1, bend: 0, opacity: 0.6 }));
  for (let i = 1; i < rows; i += 1) out.push(line(x, y + (h / rows) * i, x + w, y + (h / rows) * i, { c: o.c || LINE, w: o.w ?? 1, bend: 0, opacity: 0.6 }));
  return out;
}

/* ------------------------------- 标注 ------------------------------- */
export function label(t, x, y, o = {}) {
  return T(t, x, y, { size: o.size ?? 16, color: o.color ?? C.gray, halo: 4.4, ...o });
}

export function bigLabel(t, x, y, o = {}) {
  return T(t, x, y, { size: o.size ?? 24, color: o.color ?? C.red, halo: 5, rot: o.rot ?? -1.5, ...o });
}

export function arrow(from, to, o = {}) {
  return A(from, to, { color: o.c || C.blue, bend: o.bend ?? 0.1, width: o.w ?? 2.8, label: o.label, labelAt: o.labelAt, labelSize: o.labelSize });
}

export function ring(x, y, rx, ry, o = {}) {
  return L(x, y, rx, ry, { color: o.c || C.red, rot: o.rot ?? -4, width: o.w ?? 2.2, opacity: o.opacity ?? 1 });
}

export function underline(x, y, w, o = {}) {
  return U(x, y, w, { color: o.c || C.red, width: o.w ?? 2.4 });
}

export function star(x, y, o = {}) {
  return S(x, y, { size: o.size ?? 22, color: o.color ?? C.gold });
}

export function tag(t, x, y, o = {}) {
  return TAG(t, x, y, { w: o.w ?? 60, h: o.h ?? 28, size: o.size ?? 15, color: o.color ?? C.blue, fill: o.fill ?? 'rgba(255,255,255,0.55)' });
}

export function note(x, y, w, h, lines, o = {}) {
  return NOTE(x, y, w, h, lines, { color: o.color ?? C.blue, seed: o.seed ?? 13, size: o.size ?? 16, lineHeight: o.lineHeight ?? 26, no: o.no, noColor: o.noColor, opacity: o.opacity ?? 0.55 });
}

export function card(x, y, w, h, title, lines, o = {}) {
  const out = [rbox(x, y, w, h, 8, { fill: o.fill ?? '#fdf8ec', stroke: 'rgba(150,126,92,0.35)', width: 1.2 })];
  if (title) out.push(T(title, x + w / 2, y + 26, { size: o.titleSize ?? 16, color: o.color ?? C.blue }));
  (lines || []).forEach((ln, i) => {
    out.push(T(ln, x + w / 2, y + (title ? 52 : 30) + i * (o.lineHeight ?? 22), { size: o.size ?? 13, color: '#4a5361' }));
  });
  return out;
}

/** 黏土贴片：人物、建筑、道具 */
export function prop(type, x, y, o = {}) {
  return P(type, x, y, o);
}

export function person(x, y, o = {}) {
  return P('person', x, y, { hat: o.hat ?? 'none', robe: o.robe ?? '#5b7fa6', s: o.s ?? 0.72, ...o });
}

/* ------------------------------ 构图零件 ------------------------------ */
/** 地面线：让所有「站着的东西」有落脚点 */
export function ground(y = 520, x0 = 120, x1 = 880, o = {}) {
  return line(x0, y, x1, y, { c: o.c || 'rgba(93,100,112,0.34)', w: o.w ?? 1.8, bend: o.bend ?? 0.4 });
}

/** 板书页眉：标题 + 副题（只在第一幕出现，之后一直留在板上） */
export function header(point) {
  const title = String(point.title || '');
  const w = Math.min(430, title.length * 40);
  return [
    T(title, 500, 82, { size: title.length > 8 ? 34 : 42, color: RED, rot: -1 }),
    underline(500 - w / 2, 96, w, { c: RED, w: 2 }),
    T(point.hook || '', 500, 124, { size: 15, color: GRAY }),
  ];
}

/** 幕标签：右上角的小字，告诉人现在画到第几步 */
export function stepMark(i, total, label = '') {
  const idx = ['①', '②', '③', '④', '⑤', '⑥', '⑦'][i] || `${i + 1}`;
  return T(`${idx}${label ? ` ${label}` : ''}`, 862, 84, { size: 14, color: 'rgba(93,100,112,0.66)', anchor: 'end' });
}

/** 一句带走的结论：写在板书最下方 */
export function takeaway(t, o = {}) {
  const w = Math.min(560, String(t).length * (o.size ?? 20) * 0.92);
  return [
    T(t, 500, o.y ?? 576, { size: o.size ?? 20, color: o.color ?? RED }),
    underline(500 - w / 2, (o.y ?? 576) + 10, w, { c: o.color ?? RED, w: 1.8 }),
  ];
}

/** 把一组行拆成「先画什么」的层：作者只写画面，这里负责节奏 */
export const layer = (items, focus, o = {}) => ({
  items: (Array.isArray(items) ? items : [items]).flat().filter(Boolean),
  focus,
  ...o,
});

/* ------------------------------- 演员 ------------------------------- */
/** 一个会演戏的人：姿势、表情、说话、手里拿的东西 */
export function figure(x, y, o = {}) {
  return { k: 'figure', x, y, s: o.s ?? 0.95, ...o };
}

/** 手绘对话框：尾巴指向说话的人 */
export function bubble(x, y, w, h, lines, o = {}) {
  return {
    k: 'bubble',
    x,
    y,
    w,
    h,
    lines,
    tt: o.tt,
    tail: o.tail,
    color: o.color ?? C.blue,
    size: o.size,
    lineHeight: o.lineHeight,
    key: o.key,
    delay: o.delay,
  };
}

/** 板书里的「旁白角色」：按这一步在讲什么，摆一个动作 */
export function actor(x, y, beat = 0, o = {}) {
  const poses = [
    { pose: 'point', face: 'neutral' },
    { pose: 'think', face: 'doubt' },
    { pose: 'talk', face: 'smile', talk: true },
    { pose: 'write', face: 'neutral' },
    { pose: 'wave', face: 'laugh' },
    { pose: 'stand', face: 'smile' },
  ];
  const p = poses[beat % poses.length];
  return figure(x, y, { ...p, ...o, key: o.key || 'actor' });
}

/* --------------------------- 每个学科的讲解人 --------------------------- */
const HOSTS = {
  math: { color: '#5b7fa6', hair: 'short', outfit: 'shirt' },
  physics: { color: '#6b7f9e', hair: 'short', outfit: 'coat' },
  chemistry: { color: '#5f8f7a', hair: 'bun', outfit: 'coat' },
  biology: { color: '#6b8a5a', hair: 'long', outfit: 'shirt' },
  geography: { color: '#4f7f8f', hair: 'short', outfit: 'shirt' },
  history: { color: '#8a6b4f', hair: 'bun', outfit: 'robe' },
  chinese: { color: '#7f6f9e', hair: 'bun', outfit: 'robe' },
  programmer: { color: '#4f6f8f', hair: 'short', outfit: 'shirt', glasses: true },
  designer: { color: '#a05f8e', hair: 'long', outfit: 'shirt' },
  chef: { color: '#b06a4a', hair: 'short', outfit: 'apron' },
  architect: { color: '#5f8f8a', hair: 'short', outfit: 'shirt' },
  fisherman: { color: '#3f7f9f', hair: 'short', outfit: 'coat' },
  farmer: { color: '#7a8a4a', hair: 'short', outfit: 'shirt' },
};

/** 学科讲解人：站在板书边上，按这一步在讲什么换动作 */
export function host(subjectId, beat = 0, x = 112, y = 592, o = {}) {
  const base = HOSTS[subjectId] || HOSTS.math;
  const poses = ['point', 'think', 'talk', 'write', 'wave', 'stand'];
  const faces = ['neutral', 'doubt', 'smile', 'neutral', 'laugh', 'smile'];
  return figure(x, y, {
    ...base,
    pose: poses[beat % poses.length],
    face: faces[beat % faces.length],
    talk: beat % poses.length === 2,
    s: 0.66,
    key: 'host',
    ...o,
  });
}

/* ------------------------------- 图片 ------------------------------- */
/** 参考图直接裁进画板：crop 用 0~1 的归一化坐标 */
export function plate(x, y, w, h, src, crop = [0, 0, 1, 1], o = {}) {
  return { k: 'plate', x, y, w, h, src, crop, ...o };
}

/** 透明贴纸：抠好的 PNG，按宽高摆放（不用裁剪框） */
export function sticker(x, y, w, h, src, o = {}) {
  return { k: 'sticker', x, y, w, h, src, ...o };
}
