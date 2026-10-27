const fs = require('fs');
const p = 'src/data/board-art.js';
let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const anchor = 'const ART = {';
if (!s.includes(anchor)) throw new Error('anchor');
const extra = `/* --------------------------- 具体知识点的专用图 --------------------------- */
function leverArt(cx, cy) {
  return [
    PATH(\`M\${cx - 150} \${cy + 10} L\${cx + 150} \${cy - 50}\`, { stroke: '#8a6b4f', width: 7 }),
    PATH(\`M\${cx} \${cy - 14} l26 44 h-52 Z\`, { stroke: GRAY, width: 2, fill: 'rgba(90,86,80,0.2)' }),
    P('person', cx - 150, cy + 110, { hat: 'none', robe: '#5b7fa6', s: 0.6 }),
    PATH(\`M\${cx - 110} \${cy + 4} m-18 0 a18 18 0 1 0 36 0 a18 18 0 1 0 -36 0\`, { stroke: RED, width: 2.4, fill: 'rgba(196,86,63,0.18)' }),
    PATH(\`M\${cx + 96} \${cy - 32} m-13 0 a13 13 0 1 0 26 0 a13 13 0 1 0 -26 0\`, { stroke: BLUE, width: 2.2, fill: 'rgba(47,93,143,0.16)' }),
    T('L₁', cx - 110, cy + 52, { size: 15, color: RED }),
    T('L₂', cx + 96, cy + 22, { size: 15, color: BLUE }),
    T('支点', cx + 34, cy + 58, { size: 14, color: GRAY }),
  ];
}

function refractionArt(cx, cy) {
  return [
    PATH(\`M\${cx - 160} \${cy + 10} H\${cx + 160}\`, { stroke: '#4f8fb0', width: 2.4 }),
    PATH(\`M\${cx} \${cy - 110} V\${cy + 120}\`, { stroke: GRAY, width: 1.4, opacity: 0.5 }),
    PATH(\`M\${cx - 90} \${cy - 100} L\${cx} \${cy + 10}\`, { stroke: GOLD, width: 3 }),
    PATH(\`M\${cx} \${cy + 10} L\${cx + 58} \${cy + 108}\`, { stroke: GOLD, width: 3 }),
    T('空气', cx - 120, cy - 20, { size: 14, color: GRAY }),
    T('水', cx - 120, cy + 60, { size: 14, color: '#4f8fb0' }),
    T('θ₁', cx - 44, cy - 34, { size: 14, color: RED }),
    T('θ₂', cx + 26, cy + 52, { size: 14, color: RED }),
  ];
}

function inductionArt(cx, cy) {
  const coil = [];
  for (let i = 0; i < 6; i += 1) {
    coil.push(PATH(\`M\${cx - 30 + i * 16} \${cy + 40} a8 24 0 1 1 0 -48\`, { stroke: GOLD, width: 2.2 }));
  }
  return [
    ...coil,
    PATH(\`M\${cx - 120} \${cy - 50} h54 v40 h-54 Z\`, { stroke: RED, width: 2.4, fill: 'rgba(196,86,63,0.16)' }),
    T('N', cx - 108, cy - 26, { size: 15, color: RED }),
    T('S', cx - 78, cy - 26, { size: 15, color: BLUE }),
    A([cx - 160, cy - 30], [cx - 126, cy - 30], { color: BLUE, bend: 0 }),
    PATH(\`M\${cx + 66} \${cy + 40} q40 30 0 56\`, { stroke: BLUE, width: 2, opacity: 0.5 }),
  ];
}

function cellArt(cx, cy) {
  return [
    PATH(\`M\${cx} \${cy} m-120 0 a120 96 0 1 0 240 0 a120 96 0 1 0 -240 0\`, { stroke: GREEN, width: 2.6, fill: 'rgba(125,157,97,0.1)' }),
    PATH(\`M\${cx + 20} \${cy - 6} m-40 0 a40 40 0 1 0 80 0 a40 40 0 1 0 -80 0\`, { stroke: BLUE, width: 2, fill: 'rgba(47,93,143,0.12)' }),
    T('核', cx + 20, cy + 2, { size: 15, color: BLUE }),
    PATH(\`M\${cx - 74} \${cy + 34} q-30 10 -34 -14 q-2 -18 22 -16 q18 2 12 30 Z\`, { stroke: RED, width: 2, fill: 'rgba(196,86,63,0.12)' }),
    T('线粒体', cx - 86, cy + 52, { size: 13, color: RED }),
    T('细胞膜', cx + 96, cy - 82, { size: 13, color: GREEN }),
  ];
}

function dnaArt(cx, cy) {
  const g = [];
  for (let i = 0; i < 10; i += 1) {
    const y = cy + 90 - i * 20;
    const w = Math.sin((i / 10) * Math.PI * 2) * 46;
    g.push(PATH(\`M\${cx - 46} \${y} q46 \${w} 92 0\`, { stroke: BLUE, width: 2 }));
    g.push(PATH(\`M\${cx - 46} \${y} q46 \${-w} 92 0\`, { stroke: RED, width: 2 }));
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
    spikes.push(PATH(\`M\${cx - 60 + Math.cos(a) * 38} \${cy + Math.sin(a) * 38} L\${x} \${y}\`, { stroke: RED, width: 2 }));
  }
  return [
    PATH(\`M\${cx - 60} \${cy} m-38 0 a38 38 0 1 0 76 0 a38 38 0 1 0 -76 0\`, { stroke: RED, width: 2.2, fill: 'rgba(196,86,63,0.14)' }),
    ...spikes,
    PATH(\`M\${cx + 86} \${cy - 50} L\${cx + 86} \${cy + 10} M\${cx + 86} \${cy - 40} L\${cx + 54} \${cy - 62} M\${cx + 86} \${cy - 40} L\${cx + 118} \${cy - 62}\`, { stroke: GREEN, width: 3 }),
    T('抗体', cx + 96, cy + 26, { size: 14, color: GREEN }),
    T('病毒', cx - 60, cy + 74, { size: 14, color: RED }),
  ];
}

function hashArt(cx, cy) {
  const g = [];
  for (let i = 0; i < 5; i += 1) {
    const x = cx - 130 + i * 52;
    g.push(PATH(\`M\${x} \${cy - 60} h38 v24 h-38 Z\`, { stroke: BLUE, width: 2, fill: 'rgba(255,255,255,0.4)' }));
    g.push(PATH(\`M\${x} \${cy - 24} h38 v24 h-38 Z\`, { stroke: BLUE, width: 1.6, opacity: 0.55 }));
    g.push(T(String(i), x + 19, cy - 40, { size: 13, color: GRAY }));
  }
  g.push(A([cx - 170, cy + 50], [cx - 110, cy - 20], { color: RED, bend: -0.2 }));
  g.push(T('key', cx - 186, cy + 56, { size: 14, color: RED }));
  return g;
}

function lockArt(cx, cy) {
  return [
    PATH(\`M\${cx - 100} \${cy - 40} h70 v50 h-70 Z\`, { stroke: BLUE, width: 2.2, fill: 'rgba(255,255,255,0.4)' }),
    PATH(\`M\${cx + 30} \${cy - 40} h70 v50 h-70 Z\`, { stroke: RED, width: 2.2, fill: 'rgba(255,255,255,0.4)' }),
    T('线程 A', cx - 65, cy - 12, { size: 14, color: BLUE }),
    T('线程 B', cx + 65, cy - 12, { size: 14, color: RED }),
    PATH(\`M\${cx - 16} \${cy + 10} h32\`, { stroke: GRAY, width: 3, opacity: 0.6 }),
    PATH(\`M\${cx} \${cy + 30} m-16 0 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0\`, { stroke: GOLD, width: 2.4 }),
    T('锁', cx, cy + 76, { size: 15, color: GOLD }),
  ];
}

function codeArt(cx, cy) {
  const g = [
    PATH(\`M\${cx - 160} \${cy - 90} h320 v190 h-320 Z\`, { stroke: BLUE, width: 2.2, fill: 'rgba(255,255,255,0.4)' }),
    PATH(\`M\${cx - 160} \${cy - 68} h320\`, { stroke: BLUE, width: 1.4, opacity: 0.6 }),
  ];
  for (let i = 0; i < 3; i += 1) g.push(PATH(\`M\${cx - 150 + i * 12} \${cy - 79} h6\`, { stroke: RED, width: 3, opacity: 0.6 }));
  const rows = [0.52, 0.72, 0.4, 0.86, 0.62];
  rows.forEach((r, i) => {
    g.push(PATH(\`M\${cx - 136} \${cy - 44 + i * 26} h\${240 * r}\`, { stroke: i % 2 ? BLUE : GRAY, width: 3, opacity: 0.55 }));
  });
  g.push(T('{ }', cx + 120, cy + 74, { size: 18, color: GOLD }));
  return g;
}

function fullstackArt(cx, cy) {
  return programmerArt(cx, cy);
}

const POINT_ART = {
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

const ART = {`;
s = s.replace(anchor, extra);
fs.writeFileSync(p, s);
console.log('ok');
