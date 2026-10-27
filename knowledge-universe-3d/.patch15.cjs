const fs = require('fs');
// 1) 便签文本垂直居中
let b = fs.readFileSync('src/game/engines/board.js', 'utf8').replace(/\r\n/g, '\n');
b = b.replace(
  "  const left = -w / 2 + (it.no ? 54 : 22);\n  let y = -h / 2 + (it.no ? 36 : 30) + (it.padTop || 0);\n  for (const ln of it.lines || []) {",
  "  const left = -w / 2 + (it.no ? 54 : 22);\n  const lines = it.lines || [];\n  const lh = it.lineHeight || 28;\n  let y = it.no\n    ? -h / 2 + 36 + (it.padTop || 0)\n    : -h / 2 + Math.max(14, (h - lines.length * lh) / 2) + (it.size || 19) * 0.72;\n  for (const ln of lines) {"
);
b = b.replace("    y += it.lineHeight || 28;\n  }\n  return { el: g, paths: [], anim: 'fade' };", "    y += lh;\n  }\n  return { el: g, paths: [], anim: 'fade' };");
fs.writeFileSync('src/game/engines/board.js', b);

// 2) 英语对话去掉长引线
let c = fs.readFileSync('src/data/board-content.js', 'utf8').replace(/\r\n/g, '\n');
c = c.replace("        PATH('M150 470 L190 236 L250 236', { stroke: BLUE, width: 1.6, opacity: 0.5, fill: 'none' }),\n", '');
c = c.replace("        PATH('M850 470 L810 372 L760 372', { stroke: RED, width: 1.6, opacity: 0.5, fill: 'none' }),\n", '');
c = c.replace("        PATH('M150 470 L190 488 L250 488', { stroke: GREEN, width: 1.6, opacity: 0.5, fill: 'none' }),\n", '');
fs.writeFileSync('src/data/board-content.js', c);

// 3) 故事面板补场景文字
let g = fs.readFileSync('src/data/board-gen.js', 'utf8').replace(/\r\n/g, '\n');
const start = g.indexOf('function storyBoard(point) {');
const end = g.indexOf('/* ------------------------- 骨架 5');
if (start < 0 || end < 0) throw new Error('story anchor');
const block = `function storyBoard(point) {
  const beats = handBeatsOf(point.id);
  const slots = [
    [280, 220],
    [720, 220],
    [280, 448],
    [720, 448],
  ];
  const steps = [];

  if (beats?.length) {
    beats.slice(0, 4).forEach((beat, i) => {
      const [cx, cy] = slots[i];
      steps.push({
        title: beat.title,
        text: beat.text,
        quote: beat.quote,
        note: beat.note,
        chips: beat.chips || [['起', '承', '转', '合'][i] || \`第 \${i + 1} 幕\`],
        items: [
          NOTE(cx, cy, 410, 168, [], { color: i === 3 ? RED : BLUE, no: ['①', '②', '③', '④'][i], seed: 40 + i }),
          T(beat.title, cx - 156, cy - 46, { size: 20, color: i === 3 ? RED : BLUE, anchor: 'start' }),
          T(wrap(beat.text, 17, 1)[0] || '', cx - 156, cy - 16, { size: 13, color: GRAY, anchor: 'start' }),
          T(wrap(beat.text, 17, 1)[1] || '', cx - 156, cy + 4, { size: 13, color: GRAY, anchor: 'start' }),
          beat.quote
            ? T(beat.quote, cx, cy + 50, { size: 17, color: RED })
            : T(wrap(beat.text, 15, 2)[0] || '', cx, cy + 50, { size: 15, color: GRAY }),
        ],
      });
    });
    steps.push({
      title: '这个故事在讲什么',
      text: \`\${point.summary} 一句话：\${point.formula}。\`,
      chips: ['寓意'],
      items: [
        T('这个故事讲的是', 500, 62, { size: 15, color: GRAY }),
        T(point.formula, 500, 96, { size: 22, color: RED }),
        U(500 - Math.min(240, point.formula.length * 9), 110, Math.min(480, point.formula.length * 18), { color: RED }),
        S(150, 76, { size: 20 }),
      ],
    });
    return steps;
  }

  const p = point.principles;
  const frames = [
    { label: '起', title: point.hook, text: firstSentence(point.case) },
    { label: '承', title: '事情往下走', text: p[0] },
    { label: '转', title: '转折出现', text: p[1] || p[0] },
    { label: '合', title: '落到一句话', text: p[2] || firstSentence(point.summary) },
  ];
  frames.forEach((f, i) => {
    steps.push({
      title: f.title,
      text: f.text,
      chips: [f.label],
      items: [
        NOTE(slots[i][0], slots[i][1], 410, 168, wrap(f.text, 16, 3), {
          color: i === 3 ? RED : BLUE, no: f.label, noSize: 22, seed: 50 + i, size: 16, lineHeight: 27,
        }),
      ],
    });
  });
  steps.push({
    title: '这个故事在讲什么',
    text: \`\${point.summary} 一句话：\${point.formula}。\`,
    chips: ['寓意'],
    items: [
      T(point.formula, 500, 96, { size: 22, color: RED }),
      U(500 - Math.min(240, point.formula.length * 9), 110, Math.min(480, point.formula.length * 18), { color: RED }),
    ],
  });
  return steps;
}

`;
g = g.slice(0, start) + block + g.slice(end);
fs.writeFileSync('src/data/board-gen.js', g);
console.log('ok');
