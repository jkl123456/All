const fs = require('fs');
const p = 'src/game/engines/board.js';
let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const rep = (a, b) => {
  if (!s.includes(a)) console.log('MISS', JSON.stringify(a.slice(0, 50)));
  s = s.split(a).join(b);
};
rep(`  const shadow = svgEl('filter', { id: 'bd-clay', x: '-40%', y: '-40%', width: '180%', height: '190%' }, defs);`, `  linearGradient(defs, 'bd-water', [
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

  const shadow = svgEl('filter', { id: 'bd-clay', x: '-40%', y: '-40%', width: '180%', height: '190%' }, defs);`);
fs.writeFileSync(p, s);
console.log('ok');
