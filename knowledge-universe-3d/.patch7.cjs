const fs = require('fs');
const p = 'src/game/engines/clay.js';
let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const anchor = 'export function flag(p, o = {}) {';
if (!s.includes(anchor)) throw new Error('anchor');
const add = `export function leaf(p, o = {}) {
  const g = group(p, { transform: \`scale(\${o.scale || 1}) rotate(\${o.rot || 0})\` });
  pathEl(g, 'M0 0 C-52 -26 -58 -86 0 -112 C58 -86 52 -26 0 0 Z', {
    fill: o.c || '#6f9a55',
    stroke: OUT,
    'stroke-width': 1.1,
  });
  pathEl(g, 'M0 -6 L0 -104', { fill: 'none', stroke: 'rgba(255,255,255,0.4)', 'stroke-width': 2.2 });
  for (let i = 0; i < 5; i += 1) {
    const y = -18 - i * 17;
    pathEl(g, \`M0 \${y} q-20 -4 -30 -16\`, { fill: 'none', stroke: 'rgba(255,255,255,0.28)', 'stroke-width': 1.3 });
    pathEl(g, \`M0 \${y} q20 -4 30 -16\`, { fill: 'none', stroke: 'rgba(255,255,255,0.28)', 'stroke-width': 1.3 });
  }
  return g;
}

export function sun(p, o = {}) {
  const g = group(p, { transform: \`scale(\${o.scale || 1})\` });
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
  const g = group(p, { transform: \`scale(\${o.scale || 1})\` });
  pathEl(g, 'M0 0 C-22 -18 -26 -34 -18 -46 C-12 -56 -4 -62 0 -74 C4 -62 12 -56 18 -46 C26 -34 22 -18 0 0 Z', {
    fill: o.c || '#7fb6cf',
    stroke: OUT,
    'stroke-width': 1,
  });
  pathEl(g, 'M-8 -32 q4 -10 10 -14', { fill: 'none', stroke: 'rgba(255,255,255,0.5)', 'stroke-width': 2 });
  return g;
}

export function flask(p, o = {}) {
  const g = group(p, { transform: \`scale(\${o.scale || 1})\` });
  pathEl(g, 'M-10 -78 h20 v18 l20 46 a12 12 0 0 1 -11 18 h-38 a12 12 0 0 1 -11 -18 l20 -46 Z', {
    fill: 'rgba(160,206,222,0.5)',
    stroke: OUT,
    'stroke-width': 1.2,
  });
  pathEl(g, 'M-14 -24 h28 l10 24 a8 8 0 0 1 -7 12 h-34 a8 8 0 0 1 -7 -12 Z', { fill: o.c || '#8fc6a8', opacity: 0.9 });
  rect(g, -11, -82, 22, 6, { rx: 2, fill: '#c9d4dd', stroke: OUT });
  return g;
}

export function flag(p, o = {}) {`;
s = s.replace(anchor, add);
s = s.replace('export const CLAY_TYPES = {', 'export const CLAY_TYPES = {\n  leaf,\n  sun,\n  droplet,\n  flask,');
fs.writeFileSync(p, s);
console.log('ok');
