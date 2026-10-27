/**
 * 人物：板书里的「演员」
 *
 * 和 clay.js 的黏土小人不同，这里画的是会演戏、也长得不一样的角色：
 *   体型：slim / mid / stout（肩宽、身高都不同）
 *   肤色、发色、发型、帽子
 *   衣服：shirt / hoodie / jacket / suit / blazer / uniform / apron / coat / robe
 *   配件：眼镜、工牌、耳环、手表、围巾
 *   姿势：站 / 说 / 指 / 听 / 想 / 递 / 写 / 抱 / 挥手
 *
 * 局部坐标：脚底中点为原点，向上为负，身高约 150。
 */
import { group, circle, pathEl, rect, svgEl } from '../stage.js';

const ellipse = (p, cx, cy, rx, ry, o = {}) => svgEl('ellipse', { cx, cy, rx, ry, ...o }, p);

const INK = 'rgba(63,70,82,0.85)';
const HAIRS = { black: '#3b3a3d', brown: '#5a4632', dark: '#2b2b30', gray: '#9a8b76', auburn: '#6f4436' };
const SKINS = ['#f3d3b2', '#e8bf98', '#d6a277', '#b9835c', '#8d5f3f'];

const BUILD = {
  slim: { bw: 12, bh: 104, hr: 16 },
  mid: { bw: 16, bh: 102, hr: 16.5 },
  stout: { bw: 20, bh: 98, hr: 17.2 },
};

const POSE = {
  stand: { armL: [[-0.8, -100], [-0.9, -72], [-0.85, -54]], armR: [[0.8, -100], [0.9, -72], [0.85, -54]] },
  talk: { armL: [[-0.8, -100], [-1.1, -74], [-1, -56]], armR: [[0.8, -100], [1.4, -84], [0.9, -64]] },
  point: { armL: [[-0.8, -100], [-1, -72], [-0.9, -54]], armR: [[0.8, -100], [1.6, -92], [2.6, -86]] },
  listen: { armL: [[-0.8, -100], [-0.9, -78], [-0.2, -62]], armR: [[0.8, -100], [0.9, -78], [0.2, -62]] },
  think: { armL: [[-0.8, -100], [-1, -74], [-0.8, -58]], armR: [[0.8, -100], [1.1, -92], [0.25, -116]] },
  offer: { armL: [[-0.8, -100], [-0.9, -92], [0.5, -88]], armR: [[0.8, -100], [1.1, -92], [1.5, -88]] },
  write: { armL: [[-0.8, -100], [-1, -76], [-0.8, -60]], armR: [[0.8, -100], [1.5, -104], [2.1, -112]] },
  carry: { armL: [[-0.8, -100], [-0.8, -78], [0.6, -70]], armR: [[0.8, -100], [0.8, -78], [0.6, -70]] },
  wave: { armL: [[-0.8, -100], [-1.1, -72], [-1, -54]], armR: [[0.8, -100], [1.5, -120], [1.4, -142]] },
};

const MOUTH = { smile: 'smile', neutral: 'line', surprise: 'o', doubt: 'wave', frown: 'frown', laugh: 'laugh' };

function arm(g, pts, color, bw) {
  const p = pts.map(([k, y]) => [k * bw, y]);
  const d = `M${p[0][0]} ${p[0][1]}Q${p[1][0]} ${p[1][1]} ${p[2][0]} ${p[2][1]}`;
  pathEl(g, d, { fill: 'none', stroke: 'rgba(52,58,68,0.5)', 'stroke-width': 9.4, 'stroke-linecap': 'round' });
  pathEl(g, d, { fill: 'none', stroke: color, 'stroke-width': 7.6, 'stroke-linecap': 'round' });
  pathEl(g, d, { fill: 'none', stroke: 'rgba(255,255,255,0.3)', 'stroke-width': 1.8, 'stroke-linecap': 'round' });
  circle(g, p[2][0], p[2][1], 4, { fill: '#f3d3b2', stroke: INK, 'stroke-width': 0.9 });
  return p[2];
}

function eyes(g, face) {
  const y = -133;
  const open = face === 'surprise' ? 3 : 1.7;
  if (face === 'laugh') {
    pathEl(g, `M-8.4 ${y}q2.4 -3 4.8 0`, { fill: 'none', stroke: INK, 'stroke-width': 1.6, 'stroke-linecap': 'round' });
    pathEl(g, `M3.6 ${y}q2.4 -3 4.8 0`, { fill: 'none', stroke: INK, 'stroke-width': 1.6, 'stroke-linecap': 'round' });
    return;
  }
  circle(g, -6, y, open, { fill: '#3b3a3d' });
  circle(g, 6, y, open, { fill: '#3b3a3d' });
  if (face === 'doubt') {
    pathEl(g, 'M-9.6 -138.6q3 -2.4 6 0', { fill: 'none', stroke: INK, 'stroke-width': 1.4 });
    pathEl(g, 'M3.6 -139.6q3 -1 6 0.6', { fill: 'none', stroke: INK, 'stroke-width': 1.4 });
  }
  if (face === 'frown') {
    pathEl(g, 'M-9.6 -139q3 2 6 0', { fill: 'none', stroke: INK, 'stroke-width': 1.4 });
    pathEl(g, 'M3.6 -139q3 2 6 0', { fill: 'none', stroke: INK, 'stroke-width': 1.4 });
  }
}

function mouthShape(g, kind) {
  const g2 = group(g, { class: 'fig-mouth' });
  if (kind === 'open') {
    ellipse(g2, 0, -122, 4.6, 4, { fill: '#8b4a44', stroke: INK, 'stroke-width': 0.7 });
  } else if (kind === 'o') {
    circle(g2, 0, -122, 3.4, { fill: '#8b4a44', stroke: INK, 'stroke-width': 0.7 });
  } else if (kind === 'smile') {
    pathEl(g2, 'M-4 -123q4 4 8 0', { fill: 'none', stroke: '#8b4a44', 'stroke-width': 1.7, 'stroke-linecap': 'round' });
  } else if (kind === 'laugh') {
    pathEl(g2, 'M-5 -124q5 7 10 0Z', { fill: '#8b4a44', stroke: INK, 'stroke-width': 0.7 });
  } else if (kind === 'frown') {
    pathEl(g2, 'M-4 -121q4 -3 8 0', { fill: 'none', stroke: '#8b4a44', 'stroke-width': 1.7, 'stroke-linecap': 'round' });
  } else if (kind === 'wave') {
    pathEl(g2, 'M-5 -122q3 -2 5 1q2 3 5 0', { fill: 'none', stroke: '#8b4a44', 'stroke-width': 1.6, 'stroke-linecap': 'round' });
  } else {
    pathEl(g2, 'M-3.6 -122h7.2', { fill: 'none', stroke: '#8b4a44', 'stroke-width': 1.6, 'stroke-linecap': 'round' });
  }
  return g2;
}

function hairStyle(g, style, c) {
  if (style === 'bun') {
    circle(g, 0, -150, 7.2, { fill: c });
    pathEl(g, 'M-16 -137q0 -14 16 -14q16 0 16 14q-6 -5 -16 -5q-10 0 -16 5Z', { fill: c });
    pathEl(g, 'M-16 -136v13q4 2 5 -4', { fill: 'none', stroke: c, 'stroke-width': 4, 'stroke-linecap': 'round' });
  } else if (style === 'long') {
    pathEl(g, 'M-16 -137q0 -14 16 -14q16 0 16 14v30q-6 -4 -8 -22q0 -8 -8 -8q-8 0 -8 8q-2 18 -8 22Z', { fill: c });
  } else if (style === 'ponytail') {
    pathEl(g, 'M-15 -137q1 -13 15 -13q14 0 15 13q-7 -5 -15 -5q-8 0 -15 5Z', { fill: c });
    pathEl(g, 'M14 -138q10 4 12 22q-6 -4 -14 -16Z', { fill: c });
  } else if (style === 'buzz') {
    pathEl(g, 'M-15 -138q2 -12 15 -12q13 0 15 12q-8 -4 -15 -4q-7 0 -15 4Z', { fill: c, opacity: 0.85 });
  } else if (style === 'curly') {
    [[-11, -144, 6.4], [-2, -148, 7], [8, -145, 6.4], [14, -139, 5.4], [-15, -139, 5.4]].forEach(([x, y, r]) => {
      circle(g, x, y, r, { fill: c });
    });
  } else if (style === 'bald') {
    pathEl(g, 'M-14 -136q4 -6 14 -6q10 0 14 6', { fill: 'none', stroke: 'rgba(120,100,80,0.3)', 'stroke-width': 1.4 });
  } else if (style === 'none') {
    // 交给帽子
  } else {
    pathEl(g, 'M-15 -138q1 -13 15 -13q14 0 15 13q-7 -5 -15 -5q-8 0 -15 5Z', { fill: c });
  }
}

function hat(g, kind, c = '#4f6f8f') {
  if (kind === 'cap') {
    pathEl(g, 'M-15 -141q2 -12 15 -12q13 0 15 12Z', { fill: c });
    rect(g, -20, -143, 23, 4, { rx: 2, fill: c, opacity: 0.92 });
    circle(g, 0, -152, 2.4, { fill: c });
  } else if (kind === 'beanie') {
    pathEl(g, 'M-16 -140q2 -14 16 -14q14 0 16 14Z', { fill: c });
    rect(g, -17, -142, 34, 5, { rx: 2.5, fill: 'rgba(255,255,255,0.35)' });
    circle(g, 0, -153, 4, { fill: 'rgba(255,255,255,0.6)' });
  } else if (kind === 'visor') {
    pathEl(g, 'M-14 -140q2 -7 14 -7q12 0 14 7Z', { fill: c });
    rect(g, -20, -142, 26, 3.6, { rx: 2, fill: c });
    rect(g, -22, -139, 22, 2.6, { rx: 1.4, fill: c, opacity: 0.75 });
  }
}

function propInHand(g, kind) {
  if (!kind) return;
  const g2 = group(g, {});
  if (kind === 'menu') {
    rect(g2, 4, -22, 24, 32, { rx: 2, fill: '#fdf8ec', stroke: INK, 'stroke-width': 1 });
    rect(g2, 8, -16, 16, 3, { fill: 'rgba(93,100,112,0.5)' });
    rect(g2, 8, -9, 12, 3, { fill: 'rgba(93,100,112,0.35)' });
    rect(g2, 8, -2, 14, 3, { fill: 'rgba(93,100,112,0.35)' });
  } else if (kind === 'ticket') {
    rect(g2, 4, -20, 28, 17, { rx: 2, fill: '#fff6e2', stroke: INK, 'stroke-width': 1 });
    pathEl(g2, 'M18 -20v17', { stroke: 'rgba(93,100,112,0.5)', 'stroke-width': 1, 'stroke-dasharray': '2 2' });
  } else if (kind === 'cup') {
    rect(g2, 5, -18, 15, 19, { rx: 4, fill: '#fff', stroke: INK, 'stroke-width': 1 });
    pathEl(g2, 'M20 -12q7 2 0 9', { fill: 'none', stroke: INK, 'stroke-width': 1.4 });
  } else if (kind === 'map') {
    pathEl(g2, 2, -22, 28, 20, { fill: '#fdf8ec', stroke: INK, 'stroke-width': 1 });
    pathEl(g2, 'M2 -22h28v20h-28Z', { fill: '#fdf8ec', stroke: INK, 'stroke-width': 1 });
    pathEl(g2, 'M7 -16q7 -4 11 2q5 6 11 0', { fill: 'none', stroke: '#4f8fb0', 'stroke-width': 1.4 });
  } else if (kind === 'paper') {
    rect(g2, 4, -22, 22, 28, { rx: 1, fill: '#fff', stroke: INK, 'stroke-width': 1 });
    for (let i = 0; i < 3; i += 1) rect(g2, 8, -16 + i * 7, 14, 2, { fill: 'rgba(93,100,112,0.35)' });
  } else if (kind === 'bag') {
    rect(g2, 6, -20, 18, 26, { rx: 3, fill: '#8a6b4f', stroke: INK, 'stroke-width': 1 });
    pathEl(g2, 'M11 -20q4 -8 9 0', { fill: 'none', stroke: INK, 'stroke-width': 1.2 });
  } else if (kind === 'laptop') {
    rect(g2, 0, -18, 26, 18, { rx: 2, fill: '#cfd8de', stroke: INK, 'stroke-width': 1 });
    rect(g2, -4, 0, 34, 4, { rx: 2, fill: '#b9c3cf', stroke: INK, 'stroke-width': 0.8 });
  } else if (kind === 'phone') {
    rect(g2, 6, -22, 12, 20, { rx: 2, fill: '#3b3a3d', stroke: INK, 'stroke-width': 0.8 });
    rect(g2, 8, -19, 8, 13, { rx: 1, fill: '#9ecfdd' });
  } else if (kind === 'notepad') {
    rect(g2, 2, -20, 18, 24, { rx: 2, fill: '#fffdf4', stroke: INK, 'stroke-width': 1 });
    rect(g2, 6, -14, 10, 2, { fill: 'rgba(93,100,112,0.4)' });
    rect(g2, 6, -9, 8, 2, { fill: 'rgba(93,100,112,0.3)' });
    pathEl(g2, 'M20 -18l8 -4', { stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round' });
  }
}

export function drawFigure(parent, o = {}) {
  const s = o.s || 1;
  const flip = o.flip ? -1 : 1;
  const robe = o.color || '#5b7fa6';
  const build = BUILD[o.build] || BUILD.mid;
  const skin = SKINS[o.skin ?? 0] || SKINS[0];
  const skinDark = SKINS[Math.min(4, (o.skin ?? 0) + 1)];
  const hairC = HAIRS[o.hairColor] || o.hairColor || HAIRS.black;
  const pose = POSE[o.pose] || POSE.stand;
  const mouth = o.talk ? 'open' : (MOUTH[o.face] || 'line');
  const bw = build.bw;
  const sh = -build.bh;

  const g = group(parent, { transform: `translate(${o.x} ${o.y}) scale(${flip * s} ${s})` });

  ellipse(g, 0, -1, bw + 10, 5.4, { fill: 'rgba(90,80,60,0.16)' });

  // 腿与鞋
  rect(g, -bw * 0.62, -46, 8, 42, { rx: 3, fill: o.pants || '#4a5361' });
  rect(g, bw * 0.12, -46, 8, 42, { rx: 3, fill: o.pants || '#4a5361' });
  rect(g, -bw * 0.62 - 4, -8, 14, 6, { rx: 3, fill: '#3b3a3d' });
  rect(g, bw * 0.12 - 2, -8, 14, 6, { rx: 3, fill: '#3b3a3d' });

  // 身体
  const bodyG = group(g, { class: 'fig-body' });
  pathEl(bodyG, `M${-bw} -46L${-bw - 2} ${sh}Q0 ${sh - 8} ${bw + 2} ${sh}L${bw} -46Q0 -39 ${-bw} -46Z`, {
    fill: robe, stroke: INK, 'stroke-width': 1,
  });

  const outfit = o.outfit || 'shirt';
  if (outfit === 'suit' || outfit === 'blazer') {
    pathEl(bodyG, `M${-bw * 0.45} ${sh - 4}L0 ${sh + 18}L${bw * 0.45} ${sh - 4}`, { fill: '#fdf8ec', stroke: INK, 'stroke-width': 0.9 });
    pathEl(bodyG, `M${-bw * 0.62} ${sh - 5}L${-bw * 0.18} ${sh + 26}L${-bw * 0.5} -60Z`, { fill: 'rgba(0,0,0,0.12)' });
    pathEl(bodyG, `M${bw * 0.62} ${sh - 5}L${bw * 0.18} ${sh + 26}L${bw * 0.5} -60Z`, { fill: 'rgba(0,0,0,0.12)' });
    if (outfit === 'suit') rect(bodyG, -1.8, -86, 3.6, 18, { fill: '#b6412f' });
  } else if (outfit === 'uniform') {
    pathEl(bodyG, `M${-bw * 0.9} -46L${-bw * 0.8} ${sh + 4}L${-bw * 0.2} ${sh + 4}L${-bw * 0.35} -46Z`, { fill: 'rgba(255,255,255,0.22)' });
    pathEl(bodyG, `M${bw * 0.9} -46L${bw * 0.8} ${sh + 4}L${bw * 0.2} ${sh + 4}L${bw * 0.35} -46Z`, { fill: 'rgba(255,255,255,0.22)' });
    pathEl(bodyG, `M${-bw * 0.4} ${sh - 2}L0 ${sh + 16}L${bw * 0.4} ${sh - 2}`, { fill: '#fdf8ec', stroke: INK, 'stroke-width': 0.8 });
    rect(bodyG, -2, -84, 4, 16, { fill: '#2f3b4f' });
  } else if (outfit === 'hoodie') {
    pathEl(bodyG, `M${-bw - 1} ${sh + 2}q${bw + 1} -14 ${bw * 2 + 2} 0q-${bw + 1} 8 -${bw * 2 + 2} 0Z`, { fill: 'rgba(0,0,0,0.14)' });
    pathEl(bodyG, 'M-6 -98v14M6 -98v14', { fill: 'none', stroke: 'rgba(255,255,255,0.6)', 'stroke-width': 1.6, 'stroke-linecap': 'round' });
    rect(bodyG, -bw * 0.6, -70, bw * 1.2, 16, { rx: 2, fill: 'rgba(0,0,0,0.12)', stroke: 'rgba(255,255,255,0.25)', 'stroke-width': 0.8 });
  } else if (outfit === 'jacket') {
    pathEl(bodyG, `M${-bw * 0.5} ${sh - 2}L0 ${sh + 14}L${bw * 0.5} ${sh - 2}`, { fill: '#fdf8ec', stroke: INK, 'stroke-width': 0.8 });
    rect(bodyG, -1.4, sh + 16, 2.8, 62, { fill: 'rgba(0,0,0,0.2)' });
    for (let i = 0; i < 3; i += 1) circle(bodyG, 0, -78 + i * 14, 1.6, { fill: 'rgba(255,255,255,0.5)' });
  } else if (outfit === 'apron') {
    rect(bodyG, -bw * 0.62, -74, bw * 1.24, 30, { rx: 2, fill: 'rgba(255,255,255,0.78)', stroke: INK, 'stroke-width': 0.7 });
    pathEl(bodyG, `M${-bw * 0.5} ${sh}l${bw * 0.18} 20M${bw * 0.5} ${sh}l-${bw * 0.18} 20`, { stroke: 'rgba(255,255,255,0.75)', 'stroke-width': 2 });
    rect(bodyG, -1.6, sh + 14, 3.2, 14, { fill: '#8a4b32' });
  } else if (outfit === 'coat') {
    pathEl(bodyG, `M${-bw * 0.5} ${sh - 2}L0 ${sh + 12}L${bw * 0.5} ${sh - 2}`, { fill: '#fdf8ec', stroke: INK, 'stroke-width': 0.9 });
    rect(bodyG, -1, sh + 14, 2, 62, { fill: 'rgba(93,100,112,0.35)' });
    rect(bodyG, -bw * 0.35, -76, bw * 0.7, 16, { rx: 2, fill: 'rgba(255,255,255,0.35)' });
  } else if (outfit === 'robe') {
    pathEl(bodyG, `M${-bw} -46L${-bw - 4} -6H${bw + 4}L${bw} -46Q0 -38 ${-bw} -46Z`, { fill: robe, stroke: INK, 'stroke-width': 1 });
    rect(bodyG, -bw, -64, bw * 2, 5, { fill: '#e9ba60', opacity: 0.9 });
    pathEl(bodyG, `M-6 ${sh - 2}L0 ${sh + 10}L6 ${sh - 2}`, { fill: 'none', stroke: 'rgba(255,255,255,0.55)', 'stroke-width': 2.6 });
  } else {
    pathEl(bodyG, `M-6 ${sh - 2}L0 ${sh + 10}L6 ${sh - 2}`, { fill: 'none', stroke: 'rgba(255,255,255,0.5)', 'stroke-width': 2.4 });
    rect(bodyG, -bw, -60, bw * 2, 5, { fill: 'rgba(255,255,255,0.22)' });
  }

  if (o.badge) {
    rect(bodyG, bw * 0.15, -84, 12, 15, { rx: 1.5, fill: '#fdf8ec', stroke: INK, 'stroke-width': 0.7 });
    rect(bodyG, bw * 0.18, -81, 6, 3, { fill: '#b6412f' });
  }
  if (o.scarf) {
    pathEl(bodyG, `M${-bw * 0.8} ${sh + 2}q${bw * 0.8} 8 ${bw * 1.6} 0v9q-${bw * 0.8} 6 -${bw * 1.6} 0Z`, { fill: o.scarf, stroke: INK, 'stroke-width': 0.7 });
    pathEl(bodyG, `M${bw * 0.2} ${sh + 10}l-4 26h8Z`, { fill: o.scarf, stroke: INK, 'stroke-width': 0.6 });
  }
  if (o.watch) circle(bodyG, -bw - 1, -60, 2.6, { fill: '#e9ba60', stroke: INK, 'stroke-width': 0.6 });

  // 手臂
  const handR = arm(g, pose.armR, robe, bw);
  arm(g, pose.armL, robe, bw);
  if (o.prop) {
    const pg = group(g, { transform: `translate(${handR[0]} ${handR[1] + 4})` });
    propInHand(pg, o.prop);
  }

  rect(g, -4, -114, 8, 10, { fill: skinDark });

  // 头
  const head = group(g, { class: 'fig-head' });
  circle(head, 0, -132, build.hr, { fill: skin, stroke: INK, 'stroke-width': 1 });
  if (o.hat) hat(head, o.hat, o.hatColor || '#4f6f8f');
  else hairStyle(head, o.hair || 'short', hairC);
  eyes(head, o.face || 'smile');
  pathEl(head, 'M0 -129l-1.4 3.4h2.8', { fill: 'none', stroke: 'rgba(180,140,110,0.9)', 'stroke-width': 1 });
  const mouthEl = mouthShape(head, mouth);
  if (o.glasses) {
    circle(head, -6, -133, 5.2, { fill: 'none', stroke: INK, 'stroke-width': 1 });
    circle(head, 6, -133, 5.2, { fill: 'none', stroke: INK, 'stroke-width': 1 });
    pathEl(head, 'M-0.8 -133h1.6', { stroke: INK, 'stroke-width': 1 });
    pathEl(head, 'M-11.2 -133h-3M11.2 -133h3', { stroke: INK, 'stroke-width': 1 });
  }
  if (o.earrings) {
    circle(head, -build.hr + 1, -126, 1.8, { fill: '#e9ba60' });
    circle(head, build.hr - 1, -126, 1.8, { fill: '#e9ba60' });
  }
  if (o.beard) pathEl(head, 'M-8 -122q8 12 16 0q-8 5 -16 0Z', { fill: '#4a4038', opacity: 0.8 });

  return { g, parts: { head, body: bodyG, mouth: mouthEl } };
}
