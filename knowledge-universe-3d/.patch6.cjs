const fs = require('fs');
const p = 'src/data/board-gen.js';
let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const start = s.indexOf('function formulaBoard(point) {');
const end = s.indexOf('/* ---------------------------- 骨架 2');
if (start < 0 || end < 0) throw new Error('anchor');
const block = `function formulaBoard(point) {
  const origin = ORIGIN[point.id];
  const p = point.principles;
  const steps = [];

  steps.push({
    title: point.hook,
    text: \`先看一个真实场景：\${point.case}\`,
    chips: ['问题'],
    items: [
      T(point.hook, 500, 62, { size: point.hook.length > 14 ? 24 : 28, color: RED, rot: -1.2 }),
      T('先别急着看公式，先看它要解决什么', 500, 96, { size: 14, color: GRAY }),
      P('person', 110, 240, { hat: 'none', robe: '#5b7fa6', s: 0.9 }),
      P('book', 212, 246, { s: 0.9 }),
      T('现实里的问题', 160, 282, { size: 16, color: GRAY }),
      A([300, 214], [380, 190], { color: BLUE, bend: -0.18 }),
    ],
  });

  steps.push({
    title: '没有它的时候，只能一次次试',
    text: \`没有这条关系，人们只能靠经验估、靠试错逼近。慢，而且换一个条件就得重来。\${firstSentence(point.case)}。\`,
    chips: ['旧办法'],
    items: [
      NOTE(280, 400, 380, 118, wrap(point.case, 15, 4), { color: RED, no: '✕', noColor: RED, seed: 21 }),
      T('试错：慢、贵，还不一定准', 280, 480, { size: 16, color: RED }),
    ],
  });

  steps.push({
    title: origin ? \`\${origin.who} 的那一笔\` : '先把它拆成几个量',
    text: origin
      ? \`\${origin.who}（\${origin.year}）\${origin.what}。\${origin.story}\`
      : '把过程拆成几个能测量的量，再看它们怎么一起变；关系一旦固定下来，就能反过来预测。',
    chips: [origin ? '提出者' : '拆解'],
    items: origin
      ? [
          P('person', 110, 560, { hat: 'scholar', robe: '#8a6b4f', s: 0.9 }),
          T(origin.who, 238, 542, { size: 18, anchor: 'start' }),
          T(origin.year, 238, 568, { size: 14, color: GRAY, anchor: 'start' }),
        ]
      : [
          P('bulb', 130, 556, { s: 0.85 }),
          T('拆成可测量的量', 238, 542, { size: 18, anchor: 'start' }),
          T('找出不变的关系', 238, 568, { size: 14, color: GRAY, anchor: 'start' }),
        ],
  });

  steps.push({
    title: point.formula,
    text: point.summary,
    chips: ['核心关系'],
    items: [
      NOTE(720, 232, 430, 112, [], { color: BLUE, opacity: 0.3, seed: 33 }),
      T(point.formula, 720, 246, { size: point.formula.length > 22 ? 20 : 26, color: BLUE }),
      U(720 - Math.min(180, point.formula.length * 7), 262, Math.min(360, point.formula.length * 14), { color: BLUE, width: 2 }),
      T('一条关系，把过程压成一行', 720, 300, { size: 14, color: GRAY }),
    ],
  });

  steps.push({
    title: '把现实条件代进去',
    text: \`\${p[0]}。\${p[1] || ''}\`,
    chips: ['代入'],
    items: [
      T('代进去，它开始有用', 720, 356, { size: 15, color: GRAY }),
      T(\`→ \${wrap(p[0], 20, 1)[0] || ''}\`, 720, 384, { size: 16 }),
      p[1] ? T(\`→ \${wrap(p[1], 20, 1)[0] || ''}\`, 720, 410, { size: 16 }) : null,
      A([720, 300], [720, 344], { color: BLUE, bend: 0, head: true }),
    ].filter(Boolean),
  });

  steps.push({
    title: '它解决了什么，又管不到哪里',
    text: \`\${firstSentence(point.summary)}。但任何公式都有前提：条件一变，结论就要重算。\`,
    chips: ['结论'],
    items: [
      T('✓ 解决了什么', 720, 470, { size: 17, color: GREEN }),
      T(wrap(firstSentence(point.summary), 17, 2)[0] || '', 720, 498, { size: 16 }),
      T(wrap(firstSentence(point.summary), 17, 2)[1] || '', 720, 522, { size: 16 }),
      T('前提变了，结论就要重算', 720, 552, { size: 13, color: GRAY }),
      S(930, 476, { size: 18, color: GOLD }),
    ],
  });

  return steps;
}

`;
s = s.slice(0, start) + block + s.slice(end);
fs.writeFileSync(p, s);
console.log('ok');
