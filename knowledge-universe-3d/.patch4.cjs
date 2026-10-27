const fs = require('fs');
const p = 'src/game/engines/board.js';
let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const rep = (a, b) => {
  if (!s.includes(a)) console.log('MISS:', JSON.stringify(a.slice(0, 60)));
  s = s.split(a).join(b);
};
rep("  linearGradient, radialGradient, svgEl, clamp,", "  linearGradient, radialGradient, svgEl, clamp, seeded,");

// note + path 构造器
rep("function buildTag(parent, it) {", `function buildNote(parent, it) {
  const w = it.w || 360;
  const h = it.h || 120;
  const g = group(parent, { transform: \`translate(\${it.x} \${it.y})\` });
  const rnd = seeded(it.seed || 11);
  const j = () => (rnd() - 0.5) * 3.4;
  const x0 = -w / 2;
  const y0 = -h / 2;
  const x1 = w / 2;
  const y1 = h / 2;
  const d = \`M\${x0 + j()} \${y0 + j()} Q0 \${y0 + j()} \${x1 + j()} \${y0 + j()} Q\${x1 + j()} 0 \${x1 + j()} \${y1 + j()} Q0 \${y1 + j()} \${x0 + j()} \${y1 + j()} Q\${x0 + j()} 0 \${x0 + j()} \${y0 + j()} Z\`;
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
  let y = -h / 2 + (it.no ? 36 : 30) + (it.padTop || 0);
  for (const ln of it.lines || []) {
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
    y += it.lineHeight || 28;
  }
  return { el: g, paths: [], anim: 'fade' };
}

function buildTag(parent, it) {`);

rep("  if (kind === 'tag') {\n    return buildTag(parent, item);\n  }", "  if (kind === 'note') {\n    return buildNote(parent, item);\n  }\n  if (kind === 'path') {\n    const g = group(parent, {});\n    const p = pathEl(g, item.d, {\n      fill: item.fill || 'none',\n      stroke: item.stroke || INK.blue,\n      'stroke-width': item.width || 2,\n      'stroke-linecap': 'round',\n      opacity: item.opacity ?? 1,\n    });\n    return { el: g, paths: [p], anim: 'draw', dur: item.dur || 520 };\n  }\n  if (kind === 'tag') {\n    return buildTag(parent, item);\n  }");

fs.writeFileSync(p, s);
console.log('ok');
