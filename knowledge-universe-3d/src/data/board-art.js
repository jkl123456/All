/**
 * 学科插图：每个领域在板书上有一张手绘图，文字只做标注。
 * 所有函数把图画在以 (cx, cy) 为中心、约 340 × 260 的框里。
 */
import { A, BLUE, GOLD, GRAY, GREEN, L, P, PATH, RED, TAG, T, U } from './board-kit.js';

const ROCK = '#b9ae99';

const ink = (d, o = {}) => PATH(d, { stroke: BLUE, width: 2.2, ...o });

/* --------------------------------- 数学 --------------------------------- */
function mathArt(cx, cy) {
  const x0 = cx - 150;
  const y0 = cy + 90;
  return [
    ink(`M${x0} ${y0} H${cx + 150}`, { opacity: 0.55 }),
    ink(`M${x0} ${y0} V${cy - 100}`, { opacity: 0.55 }),
    PATH(`M${cx - 128} ${y0 - 8} Q${cx - 10} ${cy - 150} ${cx + 118} ${y0 - 60}`, { stroke: RED, width: 3 }),
    PATH(`M${cx - 40} ${cy + 10} L${cx + 120} ${cy - 92}`, { stroke: GOLD, width: 2, opacity: 0.9 }),
    P('panel', cx + 96, y0 - 4, { s: 0.55, kind: 'stack' }),
    T('x', cx + 158, y0 + 4, { size: 16, color: GRAY }),
    T('y', x0 - 12, cy - 108, { size: 16, color: GRAY }),
  ];
}

/* --------------------------------- 物理 --------------------------------- */
function physicsArt(cx, cy) {
  const px = cx - 20;
  const py = cy - 110;
  return [
    ink(`M${px} ${py} L${px + 74} ${py + 120}`, { width: 2.6 }),
    PATH(`M${px - 70} ${py + 120} Q${px} ${py + 168} ${px + 70} ${py + 120}`, { stroke: GRAY, width: 1.6, opacity: 0.45 }),
    P('person', cx - 190, cy + 130, { hat: 'none', robe: '#5b7fa6', s: 0.62 }),
    PATH(`M${px} ${py} m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0`, { stroke: BLUE, width: 2, fill: 'rgba(255,255,255,0.6)' }),
    PATH(`M${px + 74} ${py + 120} m-16 0 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0`, { stroke: RED, width: 2.4, fill: 'rgba(196,86,63,0.16)' }),
    A([px + 96, py + 120], [px + 150, py + 120], { color: RED, bend: 0.1 }),
    T('F', px + 176, py + 126, { size: 17, color: RED }),
    T('L', px + 26, py + 40, { size: 16, color: GRAY }),
  ];
}

/* --------------------------------- 化学 --------------------------------- */
function chemistryArt(cx, cy) {
  return [
    P('flask', cx - 70, cy + 100, { s: 1.15 }),
    PATH(`M${cx - 124} ${cy - 96} m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0`, { stroke: BLUE, width: 2, fill: 'rgba(255,255,255,0.5)' }),
    PATH(`M${cx - 92} ${cy - 130} m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0`, { stroke: RED, width: 2, fill: 'rgba(255,255,255,0.5)' }),
    PATH(`M${cx - 108} ${cy - 96} L${cx - 96} ${cy - 130}`, { stroke: GRAY, width: 1.4, opacity: 0.6 }),
    PATH(`M${cx + 40} ${cy + 60} q-8 -40 20 -52 q10 -30 38 -14 q26 -14 34 18 q22 6 14 48 Z`, {
      stroke: GREEN,
      width: 2.2,
      fill: 'rgba(125,157,97,0.14)',
    }),
    T('反应物', cx - 70, cy + 128, { size: 15, color: GRAY }),
    T('产物', cx + 96, cy + 100, { size: 15, color: GREEN }),
    A([cx + 6, cy - 20], [cx + 40, cy + 20], { color: GOLD, bend: -0.2 }),
  ];
}

/* --------------------------------- 生物 --------------------------------- */
function biologyArt(cx, cy) {
  return [
    P('leaf', cx + 10, cy + 110, { scale: 1.75, rot: 8 }),
    P('sun', cx - 128, cy - 30, { scale: 0.9 }),
    A([cx - 84, cy - 40], [cx - 18, cy + 34], { color: GOLD, bend: -0.12 }),
    PATH(`M${cx + 10} ${cy + 110} q-30 -70 -10 -150`, { stroke: GREEN, width: 2, opacity: 0.5 }),
    T('叶绿体', cx + 10, cy + 30, { size: 15, color: GREEN }),
  ];
}

/* --------------------------------- 地理 --------------------------------- */
function geographyArt(cx, cy) {
  return [
    PATH(`M${cx - 160} ${cy + 80} q60 -46 120 -8 q52 34 96 -6 q40 -34 92 8`, { stroke: BLUE, width: 1.8, opacity: 0.5 }),
    PATH(`M${cx - 140} ${cy + 44} q56 -40 106 -10 q50 30 92 -4 q36 -30 82 4`, { stroke: BLUE, width: 1.6, opacity: 0.4 }),
    PATH(`M${cx - 120} ${cy + 8} q52 -34 96 -10 q46 24 84 -2 q32 -24 74 2`, { stroke: BLUE, width: 1.4, opacity: 0.3 }),
    PATH(`M${cx - 120} ${cy + 84} L${cx - 20} ${cy - 76} L${cx + 42} ${cy + 20} L${cx + 82} ${cy - 20} L${cx + 150} ${cy + 84} Z`, {
      stroke: GOLD,
      width: 2,
      fill: 'rgba(180,131,31,0.08)',
    }),
    A([cx - 140, cy - 70], [cx - 40, cy - 20], { color: BLUE, bend: -0.2 }),
    T('风', cx - 158, cy - 74, { size: 16, color: BLUE }),
  ];
}

/* --------------------------------- 语文 --------------------------------- */
function chineseArt(cx, cy) {
  const items = [
    PATH(`M${cx - 140} ${cy + 40} q70 -26 140 0 v96 q-70 -26 -140 0 Z`, { stroke: BLUE, width: 2, fill: 'rgba(255,255,255,0.35)' }),
    PATH(`M${cx} ${cy + 40} q70 -26 140 0 v96 q-70 -26 -140 0 Z`, { stroke: BLUE, width: 2, fill: 'rgba(255,255,255,0.35)' }),
    PATH(`M${cx} ${cy + 40} v96`, { stroke: BLUE, width: 1.4, opacity: 0.6 }),
    PATH(`M${cx + 96} ${cy - 106} m-34 0 a34 34 0 1 0 68 0 a34 34 0 1 0 -68 0`, { stroke: GOLD, width: 2, fill: 'rgba(233,186,96,0.3)' }),
    T('月', cx + 96, cy - 116, { size: 15, color: GOLD }),
    T('诗', cx - 70, cy + 100, { size: 18, color: GRAY }),
    T('文', cx + 70, cy + 100, { size: 18, color: GRAY }),
  ];
  for (let i = 0; i < 3; i += 1) {
    items.push(PATH(`M${cx - 108} ${cy + 72 + i * 20} h58`, { stroke: GRAY, width: 1.4, opacity: 0.4 }));
    items.push(PATH(`M${cx + 32} ${cy + 72 + i * 20} h58`, { stroke: GRAY, width: 1.4, opacity: 0.4 }));
  }
  return items;
}

/* --------------------------------- 英语 --------------------------------- */
function englishArt(cx, cy) {
  return [
    PATH(`M${cx - 150} ${cy - 90} h150 a12 12 0 0 1 12 12 v46 a12 12 0 0 1 -12 12 h-96 l-26 24 v-24 h-28 a12 12 0 0 1 -12 -12 v-46 a12 12 0 0 1 12 -12 Z`, {
      stroke: BLUE,
      width: 2,
      fill: 'rgba(255,255,255,0.45)',
    }),
    PATH(`M${cx + 10} ${cy + 10} h140 a12 12 0 0 1 12 12 v46 a12 12 0 0 1 -12 12 h-24 v24 l-26 -24 h-90 a12 12 0 0 1 -12 -12 v-46 a12 12 0 0 1 12 -12 Z`, {
      stroke: RED,
      width: 2,
      fill: 'rgba(255,255,255,0.45)',
    }),
    T('A: I drink coffee.', cx - 66, cy - 54, { size: 15, color: BLUE }),
    T('B: I drank tea.', cx + 82, cy + 48, { size: 15, color: RED }),
    T('every morning', cx - 66, cy - 30, { size: 12, color: GRAY }),
    T('yesterday', cx + 82, cy + 72, { size: 12, color: GRAY }),
  ];
}

/* -------------------------------- 程序员 -------------------------------- */
function programmerArt(cx, cy) {
  const g = [];
  // 浏览器窗口
  g.push(PATH(`M${cx - 160} ${cy - 100} h150 v110 h-150 Z`, { stroke: BLUE, width: 2.2, fill: 'rgba(255,255,255,0.4)' }));
  g.push(PATH(`M${cx - 160} ${cy - 78} h150`, { stroke: BLUE, width: 1.4, opacity: 0.6 }));
  for (let i = 0; i < 3; i += 1) g.push(PATH(`M${cx - 150 + i * 12} ${cy - 89} h6`, { stroke: RED, width: 3, opacity: 0.6 }));
  g.push(T('前端', cx - 85, cy - 30, { size: 15, color: BLUE }));
  // 服务器
  g.push(PATH(`M${cx - 30} ${cy - 70} h96 v72 h-96 Z`, { stroke: GREEN, width: 2.2, fill: 'rgba(255,255,255,0.4)' }));
  g.push(PATH(`M${cx - 22} ${cy - 52} h80`, { stroke: GREEN, width: 1.4, opacity: 0.5 }));
  g.push(PATH(`M${cx - 22} ${cy - 34} h80`, { stroke: GREEN, width: 1.4, opacity: 0.5 }));
  g.push(T('后端', cx + 18, cy - 12, { size: 15, color: GREEN }));
  // 数据库
  g.push(PATH(`M${cx + 106} ${cy - 70} a26 10 0 1 0 52 0 a26 10 0 1 0 -52 0`, { stroke: GOLD, width: 2, fill: 'rgba(255,255,255,0.5)' }));
  g.push(PATH(`M${cx + 106} ${cy - 70} v58 a26 10 0 0 0 52 0 v-58`, { stroke: GOLD, width: 2, fill: 'rgba(255,255,255,0.15)' }));
  g.push(T('数据库', cx + 132, cy + 12, { size: 15, color: GOLD }));
  // 连接
  g.push(A([cx - 6, cy - 30], [cx - 30, cy - 30], { color: GRAY, bend: 0, width: 2 }));
  g.push(A([cx + 66, cy - 30], [cx + 104, cy - 40], { color: GRAY, bend: 0, width: 2 }));
  return g;
}

/* -------------------------------- 设计师 -------------------------------- */
function designerArt(cx, cy) {
  return [
    PATH(`M${cx - 150} ${cy - 80} h110 v110 h-110 Z`, { stroke: GRAY, width: 1.6, opacity: 0.4 }),
    PATH(`M${cx - 150} ${cy - 34} h110`, { stroke: GRAY, width: 1.2, opacity: 0.3 }),
    PATH(`M${cx - 106} ${cy - 80} v110`, { stroke: GRAY, width: 1.2, opacity: 0.3 }),
    PATH(`M${cx - 62} ${cy - 80} v110`, { stroke: GRAY, width: 1.2, opacity: 0.3 }),
    PATH(`M${cx + 10} ${cy - 70} h44 v44 h-44 Z`, { stroke: RED, width: 2, fill: 'rgba(196,86,63,0.18)' }),
    PATH(`M${cx + 62} ${cy - 70} h44 v44 h-44 Z`, { stroke: BLUE, width: 2, fill: 'rgba(47,93,143,0.16)' }),
    PATH(`M${cx + 10} ${cy - 18} h44 v44 h-44 Z`, { stroke: GREEN, width: 2, fill: 'rgba(44,115,85,0.14)' }),
    PATH(`M${cx + 62} ${cy - 18} h44 v44 h-44 Z`, { stroke: GOLD, width: 2, fill: 'rgba(180,131,31,0.16)' }),
    T('栅格', cx - 96, cy + 52, { size: 14, color: GRAY }),
    T('色板', cx + 58, cy + 44, { size: 14, color: GRAY }),
  ];
}

/* --------------------------------- 厨师 --------------------------------- */
function chefArt(cx, cy) {
  return [
    PATH(`M${cx - 120} ${cy + 20} a70 40 0 1 0 140 0 a70 40 0 1 0 -140 0`, { stroke: GRAY, width: 2.4, fill: 'rgba(90,86,80,0.14)' }),
    PATH(`M${cx + 20} ${cy + 20} h90 q14 0 10 12`, { stroke: GRAY, width: 5, fill: 'none' }),
    P('person', cx - 190, cy + 120, { hat: 'none', robe: '#a8533f', s: 0.62 }),
    T('火候', cx, cy + 48, { size: 15, color: RED }),
    T('时间', cx + 110, cy + 12, { size: 14, color: GRAY }),
  ];
}

/* --------------------------------- 建筑 --------------------------------- */
function architectArt(cx, cy) {
  return [
    PATH(`M${cx - 130} ${cy + 90} v-120 h44 v120`, { stroke: GRAY, width: 2.2, fill: 'rgba(255,255,255,0.4)' }),
    PATH(`M${cx + 86} ${cy + 90} v-120 h44 v120`, { stroke: GRAY, width: 2.2, fill: 'rgba(255,255,255,0.4)' }),
    PATH(`M${cx - 130} ${cy - 30} a130 130 0 0 1 260 0`, { stroke: BLUE, width: 3, fill: 'none' }),
    PATH(`M${cx - 140} ${cy - 30} h280`, { stroke: GRAY, width: 1.6, opacity: 0.4 }),
    T('拱', cx, cy - 60, { size: 17, color: BLUE }),
    T('荷载', cx, cy - 110, { size: 14, color: RED }),
    A([cx, cy - 130], [cx, cy - 86], { color: RED, bend: 0 }),
  ];
}

/* --------------------------------- 渔民 --------------------------------- */
function fisherArt(cx, cy) {
  return [
    P('boat', cx + 10, cy + 40, { s: 1.05 }),
    PATH(`M${cx - 170} ${cy + 66} q30 -12 60 0 q30 12 60 0 q30 -12 60 0 q30 12 60 0`, { stroke: '#4f8fb0', width: 2, opacity: 0.7 }),
    PATH(`M${cx - 160} ${cy + 92} q30 -12 60 0 q30 12 60 0 q30 -12 60 0 q30 12 60 0`, { stroke: '#4f8fb0', width: 1.6, opacity: 0.5 }),
    T('潮', cx - 140, cy - 40, { size: 17, color: BLUE }),
    A([cx - 120, cy - 30], [cx - 60, cy + 16], { color: BLUE, bend: 0.2 }),
  ];
}

/* --------------------------------- 农民 --------------------------------- */
function farmerArt(cx, cy) {
  const g = [];
  for (let i = 0; i < 4; i += 1) {
    const y = cy + 80 - i * 34;
    g.push(PATH(`M${cx - 160 + i * 14} ${y} q80 -18 160 0 q80 18 160 0`, {
      stroke: i % 2 ? GREEN : '#8a7a55',
      width: 2.2,
      opacity: 0.7,
    }));
  }
  g.push(T('梯田', cx + 120, cy - 60, { size: 15, color: GREEN }));
  return g;
}

/* -------------------------------- 兜底 -------------------------------- */
function genericArt(cx, cy) {
  return [
    P('bulb', cx - 20, cy + 60, { s: 1.5 }),
    L(cx - 20, cy - 20, 96, 74, { color: GOLD, rot: -6, width: 2 }),
    T('为什么', cx - 20, cy + 100, { size: 15, color: GRAY }),
  ];
}

/* --------------------------- 具体知识点的专用图 --------------------------- */
function leverArt(cx, cy) {
  return [
    PATH(`M${cx - 150} ${cy + 10} L${cx + 150} ${cy - 50}`, { stroke: '#8a6b4f', width: 7 }),
    PATH(`M${cx} ${cy - 14} l26 44 h-52 Z`, { stroke: GRAY, width: 2, fill: 'rgba(90,86,80,0.2)' }),
    P('person', cx - 150, cy + 110, { hat: 'none', robe: '#5b7fa6', s: 0.6 }),
    PATH(`M${cx - 110} ${cy + 4} m-18 0 a18 18 0 1 0 36 0 a18 18 0 1 0 -36 0`, { stroke: RED, width: 2.4, fill: 'rgba(196,86,63,0.18)' }),
    PATH(`M${cx + 96} ${cy - 32} m-13 0 a13 13 0 1 0 26 0 a13 13 0 1 0 -26 0`, { stroke: BLUE, width: 2.2, fill: 'rgba(47,93,143,0.16)' }),
    T('L₁', cx - 110, cy + 52, { size: 15, color: RED }),
    T('L₂', cx + 96, cy + 22, { size: 15, color: BLUE }),
    T('支点', cx + 34, cy + 58, { size: 14, color: GRAY }),
  ];
}

function refractionArt(cx, cy) {
  return [
    PATH(`M${cx - 160} ${cy + 10} H${cx + 160}`, { stroke: '#4f8fb0', width: 2.4 }),
    PATH(`M${cx} ${cy - 110} V${cy + 120}`, { stroke: GRAY, width: 1.4, opacity: 0.5 }),
    PATH(`M${cx - 90} ${cy - 100} L${cx} ${cy + 10}`, { stroke: GOLD, width: 3 }),
    PATH(`M${cx} ${cy + 10} L${cx + 58} ${cy + 108}`, { stroke: GOLD, width: 3 }),
    T('空气', cx - 120, cy - 20, { size: 14, color: GRAY }),
    T('水', cx - 120, cy + 60, { size: 14, color: '#4f8fb0' }),
    T('θ₁', cx - 44, cy - 34, { size: 14, color: RED }),
    T('θ₂', cx + 26, cy + 52, { size: 14, color: RED }),
  ];
}

function inductionArt(cx, cy) {
  const coil = [];
  for (let i = 0; i < 6; i += 1) {
    coil.push(PATH(`M${cx - 30 + i * 16} ${cy + 40} a8 24 0 1 1 0 -48`, { stroke: GOLD, width: 2.2 }));
  }
  return [
    ...coil,
    PATH(`M${cx - 120} ${cy - 50} h54 v40 h-54 Z`, { stroke: RED, width: 2.4, fill: 'rgba(196,86,63,0.16)' }),
    T('N', cx - 108, cy - 26, { size: 15, color: RED }),
    T('S', cx - 78, cy - 26, { size: 15, color: BLUE }),
    A([cx - 160, cy - 30], [cx - 126, cy - 30], { color: BLUE, bend: 0 }),
    PATH(`M${cx + 66} ${cy + 40} q40 30 0 56`, { stroke: BLUE, width: 2, opacity: 0.5 }),
  ];
}

function cellArt(cx, cy) {
  return [
    PATH(`M${cx} ${cy} m-120 0 a120 96 0 1 0 240 0 a120 96 0 1 0 -240 0`, { stroke: GREEN, width: 2.6, fill: 'rgba(125,157,97,0.1)' }),
    PATH(`M${cx + 20} ${cy - 6} m-40 0 a40 40 0 1 0 80 0 a40 40 0 1 0 -80 0`, { stroke: BLUE, width: 2, fill: 'rgba(47,93,143,0.12)' }),
    T('核', cx + 20, cy + 2, { size: 15, color: BLUE }),
    PATH(`M${cx - 74} ${cy + 34} q-30 10 -34 -14 q-2 -18 22 -16 q18 2 12 30 Z`, { stroke: RED, width: 2, fill: 'rgba(196,86,63,0.12)' }),
    T('线粒体', cx - 86, cy + 52, { size: 13, color: RED }),
    T('细胞膜', cx + 96, cy - 82, { size: 13, color: GREEN }),
  ];
}

function dnaArt(cx, cy) {
  const g = [];
  for (let i = 0; i < 10; i += 1) {
    const y = cy + 90 - i * 20;
    const w = Math.sin((i / 10) * Math.PI * 2) * 46;
    g.push(PATH(`M${cx - 46} ${y} q46 ${w} 92 0`, { stroke: BLUE, width: 2 }));
    g.push(PATH(`M${cx - 46} ${y} q46 ${-w} 92 0`, { stroke: RED, width: 2 }));
  }
  g.push(T('A–T', cx + 96, cy - 40, { size: 14, color: BLUE }));
  g.push(T('G–C', cx + 96, cy + 30, { size: 14, color: RED }));
  return g;
}

function immuneArt(cx, cy) {
  const spikes = [];
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    const x = cx - 60 + Math.cos(a) * 54;
    const y = cy + Math.sin(a) * 54;
    spikes.push(PATH(`M${cx - 60 + Math.cos(a) * 38} ${cy + Math.sin(a) * 38} L${x} ${y}`, { stroke: RED, width: 2 }));
  }
  return [
    PATH(`M${cx - 60} ${cy} m-38 0 a38 38 0 1 0 76 0 a38 38 0 1 0 -76 0`, { stroke: RED, width: 2.2, fill: 'rgba(196,86,63,0.14)' }),
    ...spikes,
    PATH(`M${cx + 86} ${cy - 50} L${cx + 86} ${cy + 10} M${cx + 86} ${cy - 40} L${cx + 54} ${cy - 62} M${cx + 86} ${cy - 40} L${cx + 118} ${cy - 62}`, { stroke: GREEN, width: 3 }),
    T('抗体', cx + 96, cy + 26, { size: 14, color: GREEN }),
    T('病毒', cx - 60, cy + 74, { size: 14, color: RED }),
  ];
}

function hashArt(cx, cy) {
  const g = [];
  for (let i = 0; i < 5; i += 1) {
    const x = cx - 130 + i * 52;
    g.push(PATH(`M${x} ${cy - 60} h38 v24 h-38 Z`, { stroke: BLUE, width: 2, fill: 'rgba(255,255,255,0.4)' }));
    g.push(PATH(`M${x} ${cy - 24} h38 v24 h-38 Z`, { stroke: BLUE, width: 1.6, opacity: 0.55 }));
    g.push(T(String(i), x + 19, cy - 40, { size: 13, color: GRAY }));
  }
  g.push(A([cx - 170, cy + 50], [cx - 110, cy - 20], { color: RED, bend: -0.2 }));
  g.push(T('key', cx - 186, cy + 56, { size: 14, color: RED }));
  return g;
}

function lockArt(cx, cy) {
  return [
    PATH(`M${cx - 100} ${cy - 40} h70 v50 h-70 Z`, { stroke: BLUE, width: 2.2, fill: 'rgba(255,255,255,0.4)' }),
    PATH(`M${cx + 30} ${cy - 40} h70 v50 h-70 Z`, { stroke: RED, width: 2.2, fill: 'rgba(255,255,255,0.4)' }),
    T('线程 A', cx - 65, cy - 12, { size: 14, color: BLUE }),
    T('线程 B', cx + 65, cy - 12, { size: 14, color: RED }),
    PATH(`M${cx - 16} ${cy + 10} h32`, { stroke: GRAY, width: 3, opacity: 0.6 }),
    PATH(`M${cx} ${cy + 30} m-16 0 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0`, { stroke: GOLD, width: 2.4 }),
    T('锁', cx, cy + 76, { size: 15, color: GOLD }),
  ];
}

function codeArt(cx, cy) {
  const g = [
    PATH(`M${cx - 160} ${cy - 90} h320 v190 h-320 Z`, { stroke: BLUE, width: 2.2, fill: 'rgba(255,255,255,0.4)' }),
    PATH(`M${cx - 160} ${cy - 68} h320`, { stroke: BLUE, width: 1.4, opacity: 0.6 }),
  ];
  for (let i = 0; i < 3; i += 1) g.push(PATH(`M${cx - 150 + i * 12} ${cy - 79} h6`, { stroke: RED, width: 3, opacity: 0.6 }));
  const rows = [0.52, 0.72, 0.4, 0.86, 0.62];
  rows.forEach((r, i) => {
    g.push(PATH(`M${cx - 136} ${cy - 44 + i * 26} h${240 * r}`, { stroke: i % 2 ? BLUE : GRAY, width: 3, opacity: 0.55 }));
  });
  g.push(T('{ }', cx + 120, cy + 74, { size: 18, color: GOLD }));
  return g;
}

function fullstackArt(cx, cy) {
  return programmerArt(cx, cy);
}

/* --------------------------- 更多知识点的专用图 --------------------------- */
function parabolaArt(cx, cy) {
  return [
    PATH(`M${cx - 150} ${cy + 80} H${cx + 150}`, { stroke: BLUE, width: 2, opacity: 0.5 }),
    PATH(`M${cx - 140} ${cy + 80} V${cy - 100}`, { stroke: BLUE, width: 2, opacity: 0.5 }),
    PATH(`M${cx - 140} ${cy - 20} Q${cx} ${cy - 170} ${cx + 130} ${cy + 60}`, { stroke: RED, width: 3 }),
    PATH(`M${cx - 20} ${cy + 80} V${cy - 72}`, { stroke: GRAY, width: 1.2, 'stroke-dasharray': '4 4' }),
    PATH(`M${cx - 28} ${cy - 72} m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0`, { stroke: RED, width: 2, fill: 'rgba(196,86,63,0.25)' }),
    T('顶点', cx - 20, cy - 92, { size: 13, color: RED }),
    T('x', cx + 160, cy + 86, { size: 14, color: GRAY }),
    T('y', cx - 156, cy - 104, { size: 14, color: GRAY }),
  ];
}

function probabilityArt(cx, cy) {
  const g = [];
  for (let r = 0; r < 6; r += 1) {
    for (let c = 0; c < 6; c += 1) {
      g.push(PATH(`M${cx - 120 + c * 40} ${cy - 80 + r * 27} m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0`, { stroke: BLUE, width: 1.2, fill: 'rgba(47,93,143,0.25)' }));
    }
  }
  g.push(PATH(`M${cx - 132} ${cy - 40} h240 v81 h-240 Z`, { stroke: RED, width: 2, fill: 'rgba(196,86,63,0.08)' }));
  g.push(T('6 × 6 = 36 种结果', cx, cy + 116, { size: 15, color: GRAY }));
  return g;
}

function calculusArt(cx, cy) {
  return [
    PATH(`M${cx - 150} ${cy + 80} H${cx + 150}`, { stroke: BLUE, width: 2, opacity: 0.5 }),
    PATH(`M${cx - 140} ${cy + 80} V${cy - 100}`, { stroke: BLUE, width: 2, opacity: 0.5 }),
    PATH(`M${cx - 130} ${cy + 60} C${cx - 40} ${cy + 40} ${cx + 10} ${cy - 120} ${cx + 130} ${cy - 60}`, { stroke: RED, width: 3 }),
    PATH(`M${cx - 50} ${cy + 40} L${cx + 90} ${cy - 92}`, { stroke: GOLD, width: 2.4 }),
    PATH(`M${cx + 10} ${cy - 8} h44 v-40`, { stroke: GRAY, width: 1.4 }),
    T('Δx', cx + 34, cy + 10, { size: 12, color: GRAY }),
    T('Δy', cx + 60, cy - 26, { size: 12, color: GRAY }),
    T('切线', cx + 96, cy - 104, { size: 13, color: GOLD }),
  ];
}

function fibonacciArt(cx, cy) {
  const g = [];
  let x = cx - 120;
  let y = cy + 60;
  let w = 40;
  let h = 40;
  let dir = 0;
  for (let i = 0; i < 6; i += 1) {
    g.push(PATH(`M${x} ${y} h${w} v${-h} h${-w} Z`, { stroke: i % 2 ? BLUE : GOLD, width: 1.6, opacity: 0.6 }));
    const size = Math.min(w, h);
    if (dir === 0) { x += w; w += size; }
    else if (dir === 1) { y -= h; h += size; }
    else if (dir === 2) { x -= w; w += size; }
    else { y += h; h += size; }
    dir = (dir + 1) % 4;
  }
  g.push(PATH(`M${cx - 80} ${cy + 60} a30 30 0 0 1 30 -30 a50 50 0 0 1 50 -50 a80 80 0 0 1 80 80`, { stroke: RED, width: 2.2, fill: 'none' }));
  g.push(T('1 · 1 · 2 · 3 · 5 · 8', cx, cy + 120, { size: 14, color: GRAY }));
  return g;
}

function periodicArt(cx, cy) {
  const g = [];
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      const highlight = r === 1 && c === 6;
      g.push(PATH(`M${cx - 150 + c * 34} ${cy - 90 + r * 34} h28 v28 h-28 Z`, {
        stroke: highlight ? RED : BLUE,
        width: highlight ? 2.4 : 1.2,
        opacity: highlight ? 1 : 0.45,
        fill: highlight ? 'rgba(196,86,63,0.18)' : 'rgba(255,255,255,0.3)',
      }));
    }
  }
  g.push(T('周期 →', cx + 150, cy - 104, { size: 12, color: GRAY }));
  g.push(T('族 ↓', cx - 172, cy + 80, { size: 12, color: GRAY }));
  return g;
}

function acidbaseArt(cx, cy) {
  const g = [];
  const colors = ['#c0392b', '#d35400', '#e67e22', '#f1c40f', '#7d9d61', '#2c7355', '#1f6f8a', '#2f5d8f', '#4a3f8f'];
  for (let i = 0; i < 9; i += 1) {
    g.push(PATH(`M${cx - 144 + i * 32} ${cy - 10} h32 v34 h-32 Z`, { stroke: 'rgba(0,0,0,0.12)', width: 1, fill: colors[i], opacity: 0.75 }));
  }
  g.push(T('0', cx - 148, cy + 44, { size: 12, color: GRAY }));
  g.push(T('7', cx - 2, cy + 44, { size: 12, color: GRAY }));
  g.push(T('14', cx + 142, cy + 44, { size: 12, color: GRAY }));
  g.push(PATH(`M${cx - 100} ${cy - 30} l8 16`, { stroke: RED, width: 2 }));
  g.push(T('酸', cx - 100, cy - 40, { size: 14, color: RED }));
  g.push(PATH(`M${cx + 100} ${cy - 30} l8 16`, { stroke: BLUE, width: 2 }));
  g.push(T('碱', cx + 100, cy - 40, { size: 14, color: BLUE }));
  g.push(T('pH = −lg[H⁺]', cx, cy + 90, { size: 16, color: BLUE }));
  return g;
}

function combustionArt(cx, cy) {
  return [
    PATH(`M${cx - 20} ${cy + 90} q-40 -60 0 -110 q10 30 26 44 q-6 -40 22 -62 q6 44 -4 70 q22 -10 26 -34 q18 52 -18 92 Z`, {
      stroke: GOLD, width: 2, fill: 'rgba(255,170,80,0.55)',
    }),
    PATH(`M${cx - 80} ${cy + 96} h120 v18 h-120 Z`, { stroke: '#8a6b4f', width: 2, fill: 'rgba(138,107,79,0.3)' }),
    A([cx + 130, cy + 40], [cx + 40, cy + 40], { color: BLUE, bend: 0.1 }),
    T('O₂', cx + 150, cy + 44, { size: 16, color: BLUE }),
    T('燃料', cx, cy + 136, { size: 14, color: '#8a6b4f' }),
    T('足够氧气 → 充分燃烧', cx + 120, cy - 70, { size: 13, color: GRAY }),
  ];
}

function crystalArt(cx, cy) {
  const g = [];
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      const x = cx - 120 + c * 66 + (r % 2) * 33;
      const y = cy - 60 + r * 60;
      g.push(PATH(`M${x} ${y} m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0`, { stroke: r === 1 && c === 1 ? RED : BLUE, width: 2, fill: 'rgba(255,255,255,0.5)' }));
      if (c < 3) g.push(PATH(`M${x + 8} ${y} h50`, { stroke: GRAY, width: 1, opacity: 0.4 }));
      if (r < 2) g.push(PATH(`M${x} ${y + 8} l33 52`, { stroke: GRAY, width: 1, opacity: 0.3 }));
    }
  }
  g.push(T('晶格：离子按周期排列', cx, cy + 120, { size: 14, color: GRAY }));
  return g;
}

function monsoonArt(cx, cy) {
  return [
    PATH(`M${cx - 170} ${cy + 80} h150 v-60 h-150 Z`, { stroke: '#4f8fb0', width: 2, fill: 'rgba(79,143,176,0.2)' }),
    PATH(`M${cx + 20} ${cy + 80} h150 v-110 h-150 Z`, { stroke: GOLD, width: 2, fill: 'rgba(180,131,31,0.12)' }),
    T('海', cx - 96, cy + 60, { size: 15, color: '#4f8fb0' }),
    T('陆', cx + 96, cy + 60, { size: 15, color: GOLD }),
    P('sun', cx + 96, cy - 70, { scale: 0.6 }),
    A([cx - 60, cy - 70], [cx + 30, cy - 20], { color: BLUE, bend: 0.1 }),
    A([cx + 40, cy + 10], [cx - 50, cy - 30], { color: RED, bend: 0.1 }),
    T('夏：海风上岸多雨', cx, cy + 118, { size: 13, color: BLUE }),
  ];
}

function platesArt(cx, cy) {
  return [
    PATH(`M${cx - 170} ${cy + 30} L${cx} ${cy + 30} L${cx + 40} ${cy + 100} L${cx - 170} ${cy + 100} Z`, { stroke: GRAY, width: 2, fill: 'rgba(160,150,120,0.25)' }),
    PATH(`M${cx + 170} ${cy + 30} L${cx} ${cy + 30} L${cx + 40} ${cy + 100} L${cx + 170} ${cy + 100} Z`, { stroke: GRAY, width: 2, fill: 'rgba(160,150,120,0.18)' }),
    A([cx + 120, cy + 60], [cx + 10, cy + 60], { color: RED, bend: 0 }),
    A([cx - 120, cy + 40], [cx - 30, cy + 40], { color: BLUE, bend: 0 }),
    PATH(`M${cx + 30} ${cy + 20} q10 -40 24 -60`, { stroke: RED, width: 2.4 }),
    T('俯冲', cx + 90, cy + 24, { size: 14, color: RED }),
    T('火山 / 地震', cx + 30, cy - 60, { size: 13, color: RED }),
  ];
}

function earthArt(cx, cy) {
  const rings = [[120, '#6f9ab0'], [92, '#b98a53'], [62, '#e9ba60'], [30, '#f3d3a0']];
  const g = [];
  rings.forEach(([r, c], i) => {
    g.push(PATH(`M${cx} ${cy + 20} m-${r} 0 a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 -${r * 2} 0`, { stroke: c, width: 2, fill: i === 0 ? 'rgba(111,154,176,0.12)' : 'none' }));
  });
  g.push(T('地壳', cx + 132, cy + 24, { size: 13, color: '#6f9ab0' }));
  g.push(T('地幔', cx + 104, cy + 24, { size: 13, color: '#b98a53' }));
  g.push(T('外核', cx + 74, cy + 24, { size: 13, color: '#b4831f' }));
  return g;
}

function oceanArt(cx, cy) {
  return [
    PATH(`M${cx - 150} ${cy + 60} q-30 -70 40 -100 q40 -20 80 10 q50 -20 70 20 q30 50 -10 80 Z`, { stroke: GOLD, width: 2, fill: 'rgba(180,131,31,0.12)' }),
    T('大陆', cx - 40, cy + 20, { size: 13, color: GOLD }),
    PATH(`M${cx + 40} ${cy - 60} a110 70 0 1 1 -20 110`, { stroke: BLUE, width: 2.4, 'stroke-dasharray': '10 6' }),
    A([cx + 130, cy + 40], [cx + 110, cy + 90], { color: BLUE, bend: 0.2 }),
    T('洋流', cx + 150, cy - 20, { size: 14, color: BLUE }),
    T('风', cx - 120, cy - 70, { size: 13, color: GRAY }),
    PATH(`M${cx - 170} ${cy - 60} q40 -20 80 0`, { stroke: GRAY, width: 2 }),
  ];
}

function karstArt(cx, cy) {
  const g = [
    PATH(`M${cx - 160} ${cy - 60} h320 v140 h-320 Z`, { stroke: ROCK, width: 2, fill: 'rgba(185,174,153,0.25)' }),
    PATH(`M${cx - 130} ${cy + 20} q40 -60 90 -30 q20 10 0 40 q30 30 -10 50 h-90 q-20 -30 10 -60 Z`, { stroke: '#8a7a55', width: 2, fill: 'rgba(255,255,255,0.55)' }),
    PATH(`M${cx - 100} ${cy - 10} v20 M${cx - 80} ${cy - 20} v26 M${cx - 60} ${cy - 6} v16`, { stroke: '#8a7a55', width: 3 }),
    PATH(`M${cx + 40} ${cy + 20} v-20 M${cx + 56} ${cy + 20} v-26 M${cx + 72} ${cy + 20} v-16`, { stroke: '#8a7a55', width: 3 }),
    PATH(`M${cx + 90} ${cy - 60} q6 30 -4 44 M${cx + 120} ${cy - 60} q6 36 -4 50`, { stroke: BLUE, width: 1.6, 'stroke-dasharray': '4 4' }),
    T('石灰岩', cx + 90, cy - 74, { size: 13, color: '#8a7a55' }),
    T('溶洞 / 石笋', cx, cy + 100, { size: 13, color: GRAY }),
  ];
  return g;
}

function printingArt(cx, cy) {
  const g = [
    PATH(`M${cx - 120} ${cy - 10} h240 v26 h-240 Z`, { stroke: GRAY, width: 2, fill: 'rgba(138,107,79,0.3)' }),
    PATH(`M${cx - 110} ${cy + 16} h220 v14 h-220 Z`, { stroke: GOLD, width: 2, fill: 'rgba(255,248,225,0.7)' }),
  ];
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      g.push(PATH(`M${cx - 104 + c * 26} ${cy - 2 + r * 9} h20 v7 h-20 Z`, { stroke: '#8a7a55', width: 0.8, opacity: 0.45 }));
    }
  }
  g.push(PATH(`M${cx - 96} ${cy - 34} h192 v14 h-192 Z`, { stroke: '#8a6b4f', width: 4 }));
  g.push(T('一块版，印很多份', cx, cy + 62, { size: 14, color: GRAY }));
  return g;
}

const POINT_ART = {
  'math-parabola': parabolaArt,
  'math-probability': probabilityArt,
  'math-calculus': calculusArt,
  'math-fibonacci': fibonacciArt,
  'chemistry-periodic': periodicArt,
  'chemistry-acidbase': acidbaseArt,
  'chemistry-combustion': combustionArt,
  'chemistry-crystal': crystalArt,
  'geography-monsoon': monsoonArt,
  'geography-plates': platesArt,
  'geography-earth': earthArt,
  'geography-ocean': oceanArt,
  'geography-karst': karstArt,
  'history-printing': printingArt,

  'physics-pendulum': physicsArt,
  'physics-lever': leverArt,
  'physics-refraction': refractionArt,
  'physics-induction': inductionArt,
  'biology-photosynthesis': biologyArt,
  'biology-cell': cellArt,
  'biology-dna': dnaArt,
  'biology-immune': immuneArt,
  'programmer-hash': hashArt,
  'programmer-lock': lockArt,
  'programmer-compiler': codeArt,
  'programmer-hanoi': codeArt,
  'programmer-binarytree': codeArt,
  'programmer-network': fullstackArt,
  'programmer-fullstack': fullstackArt,
};

export function artFor(point, cx = 240, cy = 300) {
  const fn = POINT_ART[point.id] || ART[point.subjectId] || genericArt;
  return fn(cx, cy);
}

const ART = {
  math: mathArt,
  physics: physicsArt,
  chemistry: chemistryArt,
  biology: biologyArt,
  geography: geographyArt,
  chinese: chineseArt,
  english: englishArt,
  programmer: programmerArt,
  designer: designerArt,
  chef: chefArt,
  architect: architectArt,
  fisherman: fisherArt,
  farmer: farmerArt,
};

export function subjectArt(subjectId, cx = 250, cy = 300) {
  const fn = ART[subjectId] || genericArt;
  return fn(cx, cy);
}

export const ART_TAGS = { math: TAG, U };
