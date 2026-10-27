/**
 * 板书（board）引擎
 * 一块纸白板 + 黏土贴片 + 手写标注。每一步（step）只多画几笔，
 * 前面的内容留在板上，最后拼成一张完整的「知识板书」。
 */
import {
  VIEW, group, rect, pathEl, circle, textEl, line, poly,
  linearGradient, radialGradient, svgEl, clamp, seeded,
} from '../stage.js';
import { drawClay } from './clay.js';
import { drawFigure } from './figures.js';

const HAND = "'Kaiti SC', 'KaiTi', 'STKaiti', 'Kaiti TC', 'FangSong', 'Songti SC', serif";
const INK = {
  blue: '#2f5d8f',
  red: '#b6412f',
  green: '#2c7355',
  gray: '#5d6470',
  gold: '#b4831f',
};

const clampStep = (v, max) => Math.max(0, Math.min(max, Math.round(v || 0)));

const PAPER_INK = {
  math: '#2f5d8f', physics: '#525a86', chemistry: '#2c7355', biology: '#5a7742',
  geography: '#3f6f7f', history: '#8a6b4f', chinese: '#8a5450', english: '#8a6b3f',
  programmer: '#46525f', designer: '#9a5a86', chef: '#a8613f', architect: '#4f7f7a',
  fisherman: '#3f7f9f', farmer: '#6f7f3f',
};

function motif(bg, id, tone) {
  const g = group(bg, { opacity: 0.85 });
  const line2 = (x1, y1, x2, y2, o = {}) => line(g, x1, y1, x2, y2, {
    stroke: tone, 'stroke-width': o.w || 1, opacity: o.o ?? 0.12, 'stroke-dasharray': o.dash,
  });
  if (id === 'math') {
    for (let i = 0; i <= 20; i += 1) line2(120 + i * 38, 140, 120 + i * 38, 560);
    for (let i = 0; i <= 11; i += 1) line2(120, 140 + i * 38, 880, 140 + i * 38);
  } else if (id === 'physics') {
    for (let i = 1; i <= 6; i += 1) arcPath(g, 110, 620, i * 74, tone);
  } else if (id === 'chemistry') {
    for (let r = 0; r < 4; r += 1) {
      for (let c = 0; c < 5; c += 1) hexPath(g, 640 + c * 60 + (r % 2) * 30, 180 + r * 52, 30, tone);
    }
  } else if (id === 'biology') {
    for (let i = 0; i < 5; i += 1) {
      pathEl(g, `M${120 + i * 170} 600q60 -180 20 -300`, { fill: 'none', stroke: tone, 'stroke-width': 1.2, opacity: 0.1 });
    }
  } else if (id === 'geography') {
    for (let i = 0; i <= 6; i += 1) arcPath2(g, 500, 640, 180 + i * 78, tone);
    for (let i = 0; i <= 6; i += 1) line2(120, 180 + i * 62, 880, 180 + i * 62, { o: 0.08 });
  } else if (id === 'history') {
    for (let i = 0; i < 9; i += 1) line2(120, 170 + i * 50, 880, 170 + i * 50, { o: 0.07 });
    for (let i = 0; i < 5; i += 1) pathEl(g, `M${140 + i * 180} 596q40 -70 80 0`, { fill: 'none', stroke: tone, 'stroke-width': 1.4, opacity: 0.1 });
  } else if (id === 'chinese') {
    for (let i = 0; i <= 18; i += 1) line2(120 + i * 42, 150, 120 + i * 42, 570, { o: 0.09 });
    for (let i = 0; i <= 10; i += 1) line2(120, 150 + i * 42, 876, 150 + i * 42, { o: 0.045 });
  } else if (id === 'programmer') {
    for (let i = 0; i <= 30; i += 1) {
      for (let j = 0; j <= 18; j += 1) circle(g, 120 + i * 26, 150 + j * 26, 1, { fill: tone, opacity: 0.1 });
    }
  } else if (id === 'designer') {
    for (let i = 0; i <= 12; i += 1) {
      rect(g, 120 + i * 63, 140, 46, 440, { fill: tone, opacity: 0.035 });
    }
  } else if (id === 'chef') {
    for (let i = 1; i <= 3; i += 1) circle(g, 500, 350, 90 * i, { fill: 'none', stroke: tone, 'stroke-width': 1, opacity: 0.07 });
  } else if (id === 'architect') {
    for (let i = 0; i < 4; i += 1) arcPath(g, 500, 560, 120 + i * 70, tone);
  } else if (id === 'fisherman') {
    for (let i = 0; i < 5; i += 1) {
      pathEl(g, `M120 ${500 + i * 26}q90 -14 180 0t180 0t180 0t180 0`, { fill: 'none', stroke: tone, 'stroke-width': 1.2, opacity: 0.1 });
    }
  } else if (id === 'farmer') {
    for (let i = 0; i < 6; i += 1) {
      pathEl(g, `M100 ${560 - i * 22}q160 -26 320 0t320 0t160 0`, { fill: 'none', stroke: tone, 'stroke-width': 1.4, opacity: 0.1 });
    }
  }
}

function arcPath(p, cx, cy, r, tone) {
  pathEl(p, `M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}`, {
    fill: 'none', stroke: tone, 'stroke-width': 1.2, opacity: 0.09,
  });
}

function arcPath2(p, cx, cy, r, tone) {
  pathEl(p, `M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}`, {
    fill: 'none', stroke: tone, 'stroke-width': 1, opacity: 0.08,
  });
}

function hexPath(p, cx, cy, r, tone) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
  });
  pathEl(p, `M${pts.join('L')}Z`, { fill: 'none', stroke: tone, 'stroke-width': 1, opacity: 0.1 });
}

function paper(defs, bg, tone, subjectId, style) {
  if (style === 'tech') {
    // 技术图纸：冷白底 + 细网格 + 右侧留白，给实拍图做衬
    rect(bg, 0, 0, VIEW.w, VIEW.h, { fill: '#f6f8fa' });
    const g = group(bg, { opacity: 1 });
    for (let i = 0; i <= 50; i += 1) {
      line(g, i * 20, 0, i * 20, VIEW.h, { stroke: 'rgba(96,124,150,0.10)', 'stroke-width': 1 });
    }
    for (let i = 0; i <= 31; i += 1) {
      line(g, 0, i * 20, VIEW.w, i * 20, { stroke: 'rgba(96,124,150,0.10)', 'stroke-width': 1 });
    }
    radialGradient(defs, 'bd-vig-tech', [
      [0.6, 'rgba(90,110,130,0)'],
      [1, 'rgba(80,100,120,0.10)'],
    ]);
    rect(bg, 0, 0, VIEW.w, VIEW.h, { fill: 'url(#bd-vig-tech)' });
    rect(bg, 26, 24, VIEW.w - 52, VIEW.h - 48, {
      fill: 'none', stroke: 'rgba(90,116,140,0.18)', 'stroke-width': 1, rx: 4,
    });
    const shadowTech = svgEl('filter', { id: 'bd-clay', x: '-40%', y: '-40%', width: '180%', height: '190%' }, defs);
    svgEl('feDropShadow', { dx: 0, dy: 4, stdDeviation: 5, 'flood-color': '#3a4a5a', 'flood-opacity': 0.18 }, shadowTech);
    const shadowPlate = svgEl('filter', { id: 'bd-plate', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
    svgEl('feDropShadow', { dx: 0, dy: 5, stdDeviation: 6, 'flood-color': '#2c3a48', 'flood-opacity': 0.22 }, shadowPlate);
    return;
  }
  linearGradient(defs, 'bd-paper', [
    [0, '#fbf5e8'],
    [0.55, '#f6eedd'],
    [1, '#eee3cc'],
  ], { x1: 0, y1: 0, x2: 0.7, y2: 1 });
  rect(bg, 0, 0, VIEW.w, VIEW.h, { fill: 'url(#bd-paper)' });

  // 纸纹：极淡的斑点
  const grain = svgEl('filter', { id: 'bd-grain', x: 0, y: 0, width: '100%', height: '100%' }, defs);
  svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.9, numOctaves: 2, result: 'n' }, grain);
  svgEl('feColorMatrix', { in: 'n', type: 'saturate', values: 0 }, grain);
  svgEl('feComponentTransfer', {}, grain);
  rect(bg, 0, 0, VIEW.w, VIEW.h, { fill: '#a98c60', opacity: 0.045, filter: 'url(#bd-grain)' });

  radialGradient(defs, 'bd-vig', [
    [0.55, 'rgba(120,92,58,0)'],
    [1, 'rgba(112,84,52,0.16)'],
  ]);
  rect(bg, 0, 0, VIEW.w, VIEW.h, { fill: 'url(#bd-vig)' });

  rect(bg, 26, 24, VIEW.w - 52, VIEW.h - 48, {
    fill: 'none',
    stroke: 'rgba(122,100,72,0.13)',
    'stroke-width': 1.2,
    rx: 6,
  });

  linearGradient(defs, 'bd-water', [
    [0, '#a8d3e4'],
    [1, '#4f8fb0'],
  ], { x1: 0, y1: 0, x2: 0.35, y2: 1 });
  linearGradient(defs, 'bd-rock', [
    [0, '#ddd5c1'],
    [1, '#b0a288'],
  ], { x1: 0, y1: 0, x2: 0.4, y2: 1 });
  linearGradient(defs, 'bd-sand', [
    [0, '#ecdcb6'],
    [1, '#c9b287'],
  ], { x1: 0, y1: 0, x2: 0.3, y2: 1 });
  linearGradient(defs, 'bd-green', [
    [0, '#b7d192'],
    [1, '#7d9d61'],
  ], { x1: 0, y1: 0, x2: 0.3, y2: 1 });
  const hatch = svgEl('pattern', {
    id: 'bd-hatch', width: 9, height: 9, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(38)',
  }, defs);
  svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 9, stroke: 'rgba(120,104,78,0.5)', 'stroke-width': 1.3 }, hatch);
  const stone = svgEl('pattern', {
    id: 'bd-stone', width: 22, height: 14, patternUnits: 'userSpaceOnUse',
  }, defs);
  svgEl('rect', { x: 0, y: 0, width: 22, height: 14, fill: '#cbbda4' }, stone);
  svgEl('line', { x1: 0, y1: 0, x2: 22, y2: 0, stroke: 'rgba(120,104,78,0.55)', 'stroke-width': 1 }, stone);
  svgEl('line', { x1: 11, y1: 0, x2: 11, y2: 7, stroke: 'rgba(120,104,78,0.5)', 'stroke-width': 1 }, stone);
  svgEl('line', { x1: 0, y1: 7, x2: 22, y2: 7, stroke: 'rgba(120,104,78,0.45)', 'stroke-width': 1 }, stone);
  svgEl('line', { x1: 22, y1: 7, x2: 22, y2: 14, stroke: 'rgba(120,104,78,0.45)', 'stroke-width': 1 }, stone);

  const paperInk = PAPER_INK[subjectId] || INK.blue;
  if (subjectId) motif(bg, subjectId, paperInk);
  void tone;

  const shadow = svgEl('filter', { id: 'bd-clay', x: '-40%', y: '-40%', width: '180%', height: '190%' }, defs);
  svgEl('feDropShadow', { dx: 0, dy: 3.2, stdDeviation: 2.8, 'flood-color': '#6b5334', 'flood-opacity': 0.3 }, shadow);
  const plateShadow = svgEl('filter', { id: 'bd-plate', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
  svgEl('feDropShadow', { dx: 0, dy: 4.5, stdDeviation: 5, 'flood-color': '#6b5334', 'flood-opacity': 0.26 }, plateShadow);
  void tone;
}

function handText(parent, str, o = {}) {
  const node = textEl(parent, str, {
    x: o.x,
    y: o.y,
    'font-size': o.size || 22,
    'font-family': o.font || HAND,
    'font-weight': o.weight || 600,
    fill: o.color || INK.blue,
    'text-anchor': o.anchor || 'middle',
    'letter-spacing': o.ls ?? 1,
    'paint-order': 'stroke',
    stroke: '#fbf5e8',
    'stroke-width': o.halo ?? 5,
    'stroke-linejoin': 'round',
  });
  if (o.rot) node.setAttribute('transform', `rotate(${o.rot} ${o.x} ${o.y})`);
  return node;
}

function buildArrow(parent, it) {
  const [x0, y0] = it.from;
  const [x1, y1] = it.to;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bend = (it.bend ?? 0.14) * len;
  const cx = (x0 + x1) / 2 + nx * bend;
  const cy = (y0 + y1) / 2 + ny * bend;
  const color = it.color || INK.blue;
  const g = group(parent, {});

  const main = pathEl(g, `M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}`, {
    fill: 'none', stroke: color, 'stroke-width': it.width || 3.2, 'stroke-linecap': 'round',
  });
  // 第二笔，轻微偏移，模拟手绘的重描
  pathEl(g, `M${x0 + 1.4} ${y0 + 1.2} Q${cx + 1.8} ${cy + 1.4} ${x1 + 1.2} ${y1 + 1}`, {
    fill: 'none', stroke: color, 'stroke-width': 1.1, 'stroke-linecap': 'round', opacity: 0.5,
  });

  const a2 = Math.atan2(y1 - cy, x1 - cx);
  const head = it.head === false ? null : poly(g, [
    [x1, y1],
    [x1 - 12 * Math.cos(a2 - 0.42), y1 - 12 * Math.sin(a2 - 0.42)],
    [x1 - 7 * Math.cos(a2 + 0.1), y1 - 7 * Math.sin(a2 + 0.1)],
    [x1 - 12 * Math.cos(a2 + 0.42), y1 - 12 * Math.sin(a2 + 0.42)],
  ], { fill: color, opacity: 0.95 });

  if (it.label) {
    handText(g, it.label, {
      x: it.labelAt?.[0] ?? cx,
      y: it.labelAt?.[1] ?? cy - 12,
      size: it.labelSize || 21,
      color: it.labelColor || color,
      rot: it.labelRot || 0,
      anchor: it.labelAnchor || 'middle',
    });
  }
  return { el: g, paths: [main, ...(head ? [head] : [])] };
}

function buildLoop(parent, it) {
  const g = group(parent, { transform: `rotate(${it.rot || -6} ${it.x} ${it.y})` });
  const color = it.color || INK.red;
  const a = svgEl('ellipse', {
    cx: it.x, cy: it.y, rx: it.rx || 60, ry: it.ry || 26,
    fill: 'none', stroke: color, 'stroke-width': it.width || 2.6,
  }, g);
  const b = svgEl('ellipse', {
    cx: it.x + 1.5, cy: it.y - 1.5, rx: (it.rx || 60) * 0.98, ry: (it.ry || 26) * 1.04,
    fill: 'none', stroke: color, 'stroke-width': 1, opacity: 0.45,
  }, g);
  return { el: g, paths: [a, b] };
}

function buildUnderline(parent, it) {
  const g = group(parent, {});
  const w = it.w || 80;
  const color = it.color || INK.red;
  const d = `M${it.x} ${it.y} q${w * 0.25} -4 ${w * 0.5} 0 q${w * 0.25} 4 ${w * 0.5} 0`;
  const a = pathEl(g, d, { fill: 'none', stroke: color, 'stroke-width': it.width || 2.6, 'stroke-linecap': 'round' });
  const paths = [a];
  if (it.double !== false) {
    const b = pathEl(g, `M${it.x + 3} ${it.y + 5} q${w * 0.25} -3 ${w * 0.5} 0 q${w * 0.25} 3 ${w * 0.5} 0`, {
      fill: 'none', stroke: color, 'stroke-width': 1.1, 'stroke-linecap': 'round', opacity: 0.5,
    });
    paths.push(b);
  }
  return { el: g, paths };
}

function buildBrace(parent, it) {
  const g = group(parent, {});
  const w = it.w || 120;
  const h = it.h || 18;
  const x = it.x;
  const y = it.y;
  const d = `M${x} ${y} q${w * 0.4} 0 ${w * 0.46} ${h * 0.2} q${w * 0.06} ${h * 0.3} 0 ${h * 0.6} q${w * 0.06} ${h * 0.3} ${w * 0.46} ${h * 0.2}`;
  const p = pathEl(g, d, { fill: 'none', stroke: it.color || INK.blue, 'stroke-width': 2, 'stroke-linecap': 'round' });
  if (it.label) {
    handText(g, it.label, { x: x + w * 0.6, y: y + h * 0.72, size: it.size || 19, color: it.color || INK.blue, anchor: 'start' });
  }
  return { el: g, paths: [p] };
}

function buildCard(parent, it) {
  const w = it.w || 240;
  const h = it.h || 110;
  const g = group(parent, { transform: `translate(${it.x} ${it.y}) rotate(${it.rot || 0})` });
  const paperG = group(g, { filter: 'url(#bd-clay)' });
  rect(paperG, -w / 2, -h, w, h, { rx: 4, fill: it.fill || '#fdf8ec', stroke: 'rgba(150,126,92,0.3)', 'stroke-width': 1 });
  rect(paperG, -w / 2 + 6, -h + 5, w - 12, 4, { rx: 2, fill: it.bar || 'rgba(181,152,110,0.35)' });
  const lines = it.lines || [];
  const lh = it.lineHeight || 24;
  const contentH = (it.title ? 28 : 0) + lines.length * lh;
  let y = -h + Math.max(18, (h - contentH) / 2) + (it.title ? 20 : 16);
  if (it.title) {
    handText(g, it.title, { x: 0, y, size: it.titleSize || 20, color: it.color || INK.blue, anchor: 'middle' });
    y += 26;
    pathEl(g, `M${-w * 0.18} ${y - 12} h${w * 0.36}`, { stroke: 'rgba(150,126,92,0.4)', 'stroke-width': 1 });
  }
  for (const ln of lines) {
    handText(g, ln, { x: 0, y, size: it.size || 17, color: it.lineColor || INK.gray, anchor: 'middle', halo: 3.4, weight: 500 });
    y += lh;
  }
  return { el: g, paths: [], anim: 'fade' };
}

function buildNote(parent, it) {
  const w = it.w || 360;
  const h = it.h || 120;
  const g = group(parent, { transform: `translate(${it.x} ${it.y})` });
  const rnd = seeded(it.seed || 11);
  const j = () => (rnd() - 0.5) * 3.4;
  const x0 = -w / 2;
  const y0 = -h / 2;
  const x1 = w / 2;
  const y1 = h / 2;
  const d = `M${x0 + j()} ${y0 + j()} Q0 ${y0 + j()} ${x1 + j()} ${y0 + j()} Q${x1 + j()} 0 ${x1 + j()} ${y1 + j()} Q0 ${y1 + j()} ${x0 + j()} ${y1 + j()} Q${x0 + j()} 0 ${x0 + j()} ${y0 + j()} Z`;
  pathEl(g, d, {
    fill: it.fill || 'none',
    stroke: it.color || INK.blue,
    'stroke-width': it.width || 2,
    opacity: it.opacity ?? 0.5,
    'stroke-linejoin': 'round',
  });
  if (it.no) {
    handText(g, it.no, { x: -w / 2 + 28, y: -h / 2 + 36, size: it.noSize || 25, color: it.noColor || INK.red, anchor: 'middle' });
  }
  const left = -w / 2 + (it.no ? 54 : 22);
  const lines = it.lines || [];
  const lh = it.lineHeight || 28;
  let y = it.no
    ? -h / 2 + 36 + (it.padTop || 0)
    : -h / 2 + Math.max(14, (h - lines.length * lh) / 2) + (it.size || 19) * 0.72;
  for (const ln of lines) {
    handText(g, ln, {
      x: left,
      y,
      size: it.size || 19,
      color: it.lineColor || INK.gray,
      anchor: 'start',
      halo: 3.2,
      weight: 500,
      ls: it.ls ?? 0.5,
    });
    y += lh;
  }
  return { el: g, paths: [], anim: 'fade' };
}

function buildTag(parent, it) {
  const g = group(parent, {});
  const pad = it.pad || 10;
  const w = it.w || 46;
  const h = it.h || 26;
  rect(g, it.x - w / 2, it.y - h / 2, w, h, {
    rx: 6, fill: it.fill || 'rgba(255,255,255,0.5)', stroke: it.color || INK.blue, 'stroke-width': 1.4,
  });
  handText(g, it.t, { x: it.x, y: it.y + 6, size: it.size || 16, color: it.color || INK.blue, halo: 0, weight: 600 });
  void pad;
  return { el: g, paths: [], anim: 'fade' };
}

function buildStar(parent, it) {
  const g = group(parent, {});
  const t = textEl(g, '★', {
    x: it.x, y: it.y, 'font-size': it.size || 26, fill: it.color || INK.gold, 'text-anchor': 'middle',
  });
  if (it.rot) t.setAttribute('transform', `rotate(${it.rot} ${it.x} ${it.y})`);
  return { el: g, paths: [], anim: 'fade' };
}

function buildDivider(parent, it) {
  const g = group(parent, {});
  const p = pathEl(g, `M${it.x} ${it.y} q${(it.w || 200) * 0.3} -3 ${(it.w || 200) * 0.55} 0 q${(it.w || 200) * 0.2} 3 ${(it.w || 200) * 0.45} -1`, {
    fill: 'none', stroke: it.color || 'rgba(90,110,140,0.35)', 'stroke-width': 1.6, 'stroke-linecap': 'round',
  });
  return { el: g, paths: [p] };
}

function buildBubble(parent, it) {
  const g = group(parent, {});
  const w = it.w || 340;
  const h = it.h || 92;
  const x0 = it.x - w / 2;
  const y0 = it.y - h / 2;
  const r = 16;
  const color = it.color || INK.blue;
  const [tx, ty] = it.tail || [it.x, y0 + h + 42];
  const bx = it.tailFrom ?? Math.max(x0 + 30, Math.min(x0 + w - 30, tx));
  const by = y0 + h - 2;
  // 尾巴：从框底最短的一条，指向说话人的嘴
  pathEl(g, `M${bx - 16} ${by}L${tx} ${ty}L${bx + 20} ${by}Z`, {
    fill: 'rgba(255,253,246,0.94)', stroke: color, 'stroke-width': 1.6, 'stroke-linejoin': 'round',
  });
  pathEl(g, `M${bx - 13} ${by - 1}L${bx + 17} ${by - 1}`, { stroke: 'rgba(255,253,246,0.94)', 'stroke-width': 3.2 });
  // 框
  pathEl(g, `M${x0 + r} ${y0}h${w - r * 2}q${r} 0 ${r} ${r}v${h - r * 2}q0 ${r} ${-r} ${r}h${-(w - r * 2)}q${-r} 0 ${-r} ${-r}v${-(h - r * 2)}q0 ${-r} ${r} ${-r}Z`, {
    fill: 'rgba(255,253,246,0.94)', stroke: color, 'stroke-width': 1.8,
  });
  const lines = it.lines || [];
  const lh = it.lineHeight || 27;
  let y = it.y - ((lines.length - 1) * lh) / 2 + (it.tt ? -10 : 2);
  for (const ln of lines) {
    handText(g, ln, { x: it.x, y, size: it.size || 17, color: it.lineColor || INK.gray, halo: 2.4, weight: 600, ls: 0.3 });
    y += lh;
  }
  if (it.tt) {
    handText(g, it.tt, { x: it.x, y: y + 4, size: it.ttSize || 12.5, color: 'rgba(93,100,112,0.8)', halo: 2, weight: 500, ls: 0.2 });
  }
  return { el: g, anim: 'pop', dur: 320 };
}

let plateSeq = 0;

/** 裁图：直接把参考图按 crop（0~1 归一化）裁进画板，不再重画 */
function buildPlate(parent, it) {
  const g = group(parent, {});
  const w = it.w;
  const h = it.h;
  const x = it.x;
  const y = it.y;
  const r = it.radius ?? 10;
  const iw = it.iw || 1216;
  const ih = it.ih || 1920;
  const [cx, cy, cw, ch] = it.crop || [0, 0, 1, 1];
  const cid = `bd-plate-${plateSeq += 1}`;
  const cp = svgEl('clipPath', { id: cid }, g);
  svgEl('rect', { x, y, width: w, height: h, rx: r, ry: r }, cp);
  if (it.frame !== false) {
    const pad = it.pad ?? 5;
    pathEl(g, `M${x - pad + r + 4} ${y - pad}h${w + pad * 2 - (r + 4) * 2}q${r + 4} 0 ${r + 4} ${r + 4}v${h + pad * 2 - (r + 4) * 2}q0 ${r + 4} ${-r - 4} ${r + 4}h${-(w + pad * 2 - (r + 4) * 2)}q${-r - 4} 0 ${-r - 4} ${-r - 4}v${-(h + pad * 2 - (r + 4) * 2)}q0 ${-r - 4} ${r + 4} ${-r - 4}Z`, {
      fill: it.frameFill || '#fffdf9',
      stroke: it.frameStroke || 'rgba(120,104,78,0.22)',
      'stroke-width': 1.2,
      filter: 'url(#bd-plate)',
    });
  }
  const inner = group(g, { 'clip-path': `url(#${cid})` });
  const nest = svgEl('svg', {
    x, y, width: w, height: h,
    viewBox: `${cx * iw} ${cy * ih} ${cw * iw} ${ch * ih}`,
    preserveAspectRatio: 'xMidYMid slice',
  }, inner);
  svgEl('image', {
    x: 0, y: 0, width: iw, height: ih, href: it.src, preserveAspectRatio: 'none',
  }, nest);
  return { el: g, anim: 'plate', dur: it.dur || 520 };
}

/** 透明贴纸：抠好的 PNG 直接摆进画面 */
function buildSticker(parent, it) {
  const g = group(parent, it.flip ? { transform: `translate(${it.x * 2 + it.w} 0) scale(-1 1)` } : {});
  svgEl('image', {
    x: it.x,
    y: it.y,
    width: it.w,
    height: it.h,
    href: it.src,
    preserveAspectRatio: 'none',
    filter: it.shadow === false ? undefined : 'url(#bd-plate)',
    opacity: it.opacity ?? 1,
  }, g);
  return { el: g, anim: 'plate', dur: it.dur || 460 };
}

function buildFigure(parent, item) {
  const g = group(parent, {});
  const { parts } = drawFigure(g, item);
  return { el: g, anim: 'figure', parts };
}

function buildItem(item, parent, si, ii) {
  const kind = item.k || 'clay';
  const recOut = (() => {
  if (kind === 'clay') {
    const outer = group(parent, {
      transform: `translate(${item.x} ${item.y}) scale(${item.s || 1})${item.rot ? ` rotate(${item.rot})` : ''}`,
    });
    const inner = group(outer, { class: 'bd-piece' });
    drawClay(inner, item.type, item);
    return { el: inner, anim: 'clay' };
  }
  if (kind === 'text') {
    const node = handText(parent, item.t, item);
    return { el: node, anim: 'text' };
  }
  if (kind === 'arrow') {
    const r = buildArrow(parent, item);
    return { ...r, anim: 'draw', dur: item.dur || 520 };
  }
  if (kind === 'loop') {
    const r = buildLoop(parent, item);
    return { ...r, anim: 'draw', dur: item.dur || 620 };
  }
  if (kind === 'underline') {
    const r = buildUnderline(parent, item);
    return { ...r, anim: 'draw', dur: item.dur || 360 };
  }
  if (kind === 'brace') {
    const r = buildBrace(parent, item);
    return { ...r, anim: 'draw', dur: item.dur || 460 };
  }
  if (kind === 'divider') {
    const r = buildDivider(parent, item);
    return { ...r, anim: 'draw', dur: 420 };
  }
  if (kind === 'card') {
    return buildCard(parent, item);
  }
  if (kind === 'note') {
    return buildNote(parent, item);
  }
  if (kind === 'path') {
    const g = group(parent, {});
    const p = pathEl(g, item.d, {
      fill: item.fill || 'none',
      stroke: item.stroke || INK.blue,
      'stroke-width': item.width || 2,
      'stroke-linecap': item.cap || 'round',
      'stroke-linejoin': 'round',
      opacity: item.opacity ?? 1,
    });
    // 虚线不参与「描绘」动画：dasharray 会和描边动画打架，直接淡入
    const dashed = Boolean(item.dash);
    if (dashed) p.setAttribute('stroke-dasharray', item.dash);
    const anim = item.anim || (dashed ? 'fade' : 'draw');
    return { el: g, paths: anim === 'draw' ? [p] : [], anim, dur: item.dur || 520 };
  }
  if (kind === 'tag') {
    return buildTag(parent, item);
  }
  if (kind === 'star') {
    return buildStar(parent, item);
  }
  if (kind === 'figure') {
    return buildFigure(parent, item);
  }
  if (kind === 'bubble') {
    return buildBubble(parent, item);
  }
  if (kind === 'plate') {
    return buildPlate(parent, item);
  }
  if (kind === 'sticker') {
    return buildSticker(parent, item);
  }
  const node = textEl(parent, '', {});
  return { el: node, anim: 'text', _skip: true, si, ii };
  })();
  recOut.el.dataset.kind = kind;
  if (item.key) recOut.el.dataset.key = item.key;
  return recOut;
}

function prepareDraw(el, paths) {
  for (const p of paths) {
    if (!p || !p.getTotalLength) continue;
    let len = 0;
    try {
      len = p.getTotalLength();
    } catch {
      len = 0;
    }
    if (!len) continue;
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = `${len}`;
    p.dataset.len = String(len);
  }
}

function showNode(rec, delay) {
  const el = rec.el;
  el.style.opacity = '1';
  if (rec.anim === 'clay') {
    el.animate(
      [
        { opacity: 0, transform: 'scale(0.52) translateY(8px)' },
        { opacity: 1, transform: 'scale(1.07) translateY(-2px)', offset: 0.72 },
        { opacity: 1, transform: 'scale(1) translateY(0)' },
      ],
      { duration: 540, delay, easing: 'cubic-bezier(.22,.9,.3,1.08)', fill: 'both' }
    );
  } else if (rec.anim === 'text') {
    el.animate(
      [
        { opacity: 0, clipPath: 'inset(-40% 100% -40% -12%)' },
        { opacity: 1, clipPath: 'inset(-40% -12% -40% -12%)' },
      ],
      { duration: 430, delay, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' }
    );
  } else if (rec.anim === 'figure') {
    el.animate(
      [
        { opacity: 0, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 300, delay, easing: 'ease-out', fill: 'both' }
    );
  } else if (rec.anim === 'plate') {
    el.animate(
      [
        { opacity: 0, transform: 'scale(0.985)', filter: 'blur(6px)' },
        { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' },
      ],
      { duration: rec.dur || 520, delay, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' }
    );
  } else if (rec.anim === 'pop') {
    el.animate(
      [
        { opacity: 0, transform: 'scale(0.92)' },
        { opacity: 1, transform: 'scale(1.02)', offset: 0.7 },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: rec.dur || 300, delay, easing: 'cubic-bezier(.2,.8,.3,1.05)', fill: 'both' }
    );
  } else if (rec.anim === 'fade') {
    el.animate(
      [{ opacity: 0, filter: 'blur(2px)' }, { opacity: 1, filter: 'blur(0px)' }],
      { duration: 420, delay, easing: 'ease-out', fill: 'both' }
    );
  } else if (rec.anim === 'draw') {
    (rec.paths || [el]).forEach((p, i) => {
      if (!p?.dataset?.len) return;
      p.animate(
        [{ strokeDashoffset: Number(p.dataset.len), opacity: 1 }, { strokeDashoffset: 0, opacity: 1 }],
        { duration: rec.dur || 500, delay: delay + i * 60, easing: 'ease-in-out', fill: 'both' }
      );
    });
  }
}

function hideNode(rec) {
  // fill:'both' 的动画会盖住 inline style，必须先取消
  rec.el.getAnimations?.().forEach((a) => a.cancel());
  rec.el.style.opacity = '0';
  // 退场淡出：让「换帧」看起来是一次擦除，而不是硬切
  try {
    rec.el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 190, easing: 'ease-out', fill: 'both',
    });
  } catch {
    /* 老浏览器直接硬切 */
  }
  (rec.paths || []).forEach((p) => {
    p.getAnimations?.().forEach((a) => a.cancel());
    if (p?.dataset?.len) p.style.strokeDashoffset = p.dataset.len;
  });
}

export function board(ctx) {
  const { root, bg, fg, defs, spec } = ctx;
  paper(defs, bg, spec.tone, spec.subjectId, spec.style);
  const steps = spec.steps || [];
  const records = [];
  const stepGroups = [];

  steps.forEach((step, si) => {
    const g = group(root, {});
    stepGroups.push(g);
    (step.items || []).forEach((item, ii) => {
      const rec = buildItem(item, g, si, ii);
      rec.si = si;
      rec.page = step.page ?? 0;
      rec.ii = ii;
      rec.shown = false;
      rec.delay = (item.delay ?? Math.min(ii * 55, 380));
      rec.key = item.key || null;
      rec.kind = item.k || 'clay';
      rec.el.dataset.si = String(si);
      rec.el.style.opacity = '0';
      if (rec.anim === 'draw') prepareDraw(rec.el, rec.paths || []);
      records.push(rec);
    });
  });

  // 右下角的步数水印
  const mark = textEl(fg, '', {
    x: VIEW.w - 52, y: VIEW.h - 34, 'text-anchor': 'end', 'font-size': 12,
    'font-family': "'SF Mono', ui-monospace, monospace", fill: 'rgba(96,78,56,0.4)', 'letter-spacing': 2,
  });

  let current = -1;

  let clock = 0;

  return {
    defaults: { step: 0 },
    render(state) {
      const step = clampStep(state.step, Math.max(0, steps.length - 1));
      if (step === current) return;
      const prevPage = current >= 0 ? (steps[current]?.page ?? 0) : -1;
      current = step;
      const page = steps[step]?.page ?? 0;
      const pageChanged = page !== prevPage;
      // 换帧：标了 fresh 的这一步，会把同页前面几幕整块擦掉，只留自己
      let base = 0;
      for (let i = 0; i <= step; i += 1) {
        if ((steps[i].page ?? 0) !== page) continue;
        if (steps[i].fresh) base = i;
      }
      // 同一个 key 只留最后一版：人物换姿势、对话框换下一句，都是「替换」而不是叠加
      const activeKey = new Map();
      for (const rec of records) {
        if (rec.page !== page || rec.si > step || rec.si < base) continue;
        if (rec.key) activeKey.set(rec.key, rec);
      }
      // 这一幕有人的话，前面几幕的人就该下场，不然会出现两拨人站在同一处
      const stepHasFigure = records.some((r) => r.si === step && r.kind === 'figure');
      for (const rec of records) {
        const staleFigure = stepHasFigure && rec.kind === 'figure' && rec.si < step;
        const visible = rec.page === page && rec.si <= step && rec.si >= base && !staleFigure
          && (!rec.key || activeKey.get(rec.key) === rec);
        if (visible) {
          if (!rec.shown) {
            rec.shown = true;
            const base = pageChanged || rec.si !== step ? 0 : rec.delay;
            showNode(rec, base);
          }
        } else if (rec.shown) {
          rec.shown = false;
          hideNode(rec);
        }
      }
      const pages = new Set(steps.map((st) => st.page ?? 0)).size;
      mark.textContent = steps.length
        ? `${pages > 1 ? `第 ${page + 1} 页 · ` : ''}板 书 ${String(step + 1).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')}`
        : '';
      mark.style.display = steps.length ? '' : 'none';
    },
    // 每一帧的小动作：呼吸、眨眼、说话时嘴动
    animate(t) {
      clock = t;
      for (const rec of records) {
        if (!rec.shown || !rec.parts) continue;
        const { head, body, mouth } = rec.parts;
        const seed = rec.ii * 1.7 + rec.si;
        if (body) body.setAttribute('transform', `translate(0 ${(Math.sin(t * 1.35 + seed) * 0.9).toFixed(2)})`);
        if (head) {
          const nod = rec.talk ? Math.sin(t * 4.6 + seed) * 1.4 : Math.sin(t * 1.1 + seed) * 0.5;
          head.setAttribute('transform', `rotate(${nod.toFixed(2)} 0 -132)`);
        }
        if (mouth && rec.talk) {
          const k = 0.45 + Math.abs(Math.sin(t * 8.4 + seed)) * 0.8;
          mouth.setAttribute('transform', `translate(0 -122) scale(1 ${k.toFixed(2)}) translate(0 122)`);
        }
      }
    },
  };
}

export const boardEngines = { board };
export { INK, HAND, clampStep };
export const __unused = { line, circle, clamp, clockNow: () => clock };
