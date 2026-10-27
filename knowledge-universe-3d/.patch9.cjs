const fs = require('fs');
const p = 'src/data/board-gen.js';
let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
s = s.replace("import { buildNarrativeBoard } from './board-gen.js';", "");
s = s.replace("} from './board-kit.js';", "} from './board-kit.js';\nimport { subjectArt } from './board-art.js';");

const start = s.indexOf('function formulaBoard(point) {');
const end = s.indexOf('/* ---------------------------- 骨架 2');
if (start < 0 || end < 0) throw new Error('anchor formula');
const formula = `function formulaBoard(point) {
  const origin = ORIGIN[point.id];
  const p = point.principles;
  const short = (str, n = 22) => {
    const t = String(str || '').split(/[；;。]/)[0];
    return t.length > n ? \`\${t.slice(0, n)}…\` : t;
  };
  const steps = [];

  steps.push({
    title: point.hook,
    text: \`先看一个真实场景：\${point.case}\`,
    chips: ['问题'],
    items: [
      T(point.hook, 720, 78, { size: point.hook.length > 14 ? 22 : 26, color: RED, rot: -1.2 }),
      T('先看它要解决什么', 720, 112, { size: 14, color: GRAY }),
      ...subjectArt(point.subjectId, 235, 320),
      A([430, 300], [540, 200], { color: BLUE, bend: -0.2 }),
    ],
  });

  steps.push({
    title: '没有它的时候，只能一次次试',
    text: \`没有这条关系，人们只能靠经验估、靠试错逼近。慢，而且换一个条件就得重来。\${firstSentence(point.case)}。\`,
    chips: ['旧办法'],
    items: [
      NOTE(710, 214, 400, 96, wrap(short(point.case, 26), 15, 2), { color: RED, no: '✕', noColor: RED, seed: 21 }),
      T('试错：慢、贵，还不一定准', 710, 278, { size: 15, color: RED }),
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
          P('person', 150, 540, { hat: 'scholar', robe: '#8a6b4f', s: 0.85 }),
          T(origin.who, 260, 520, { size: 18, anchor: 'start' }),
          T(origin.year, 260, 546, { size: 14, color: GRAY, anchor: 'start' }),
        ]
      : [
          P('bulb', 150, 536, { s: 0.8 }),
          T('拆成可测量的量', 250, 520, { size: 18, anchor: 'start' }),
          T('找出不变的关系', 250, 546, { size: 14, color: GRAY, anchor: 'start' }),
        ],
  });

  steps.push({
    title: point.formula,
    text: point.summary,
    chips: ['核心关系'],
    items: [
      NOTE(650, 424, 500, 92, [], { color: BLUE, opacity: 0.32, seed: 33 }),
      T(point.formula, 650, 438, { size: point.formula.length > 22 ? 18 : 24, color: BLUE }),
      T('一条关系，把过程压成一行', 650, 470, { size: 13, color: GRAY }),
    ],
  });

  steps.push({
    title: '把现实条件代进去',
    text: \`\${p[0]}。\${p[1] || ''}\`,
    chips: ['代入'],
    items: [
      T('代进去，它开始有用', 650, 520, { size: 14, color: GRAY }),
      T(\`→ \${short(p[0], 20)}\`, 650, 546, { size: 16 }),
      p[1] ? T(\`→ \${short(p[1], 20)}\`, 650, 572, { size: 16 }) : null,
    ].filter(Boolean),
  });

  steps.push({
    title: '它解决了什么，又管不到哪里',
    text: \`\${firstSentence(point.summary)}。但任何公式都有前提：条件一变，结论就要重算。\`,
    chips: ['结论'],
    items: [
      T('✓ 解决了什么', 650, 600, { size: 14, color: GREEN }),
      T(short(firstSentence(point.summary), 24), 760, 600, { size: 14 }),
      S(920, 592, { size: 16, color: GOLD }),
    ],
  });

  return steps;
}

`;
s = s.slice(0, start) + formula + s.slice(end);

const s2 = s.indexOf('function problemBoard(point) {');
const e2 = s.indexOf('/* --------------------------------- 入口');
if (s2 < 0 || e2 < 0) throw new Error('anchor problem');
const problem = `function problemBoard(point) {
  const p = point.principles;
  const short = (str, n = 20) => {
    const t = String(str || '').split(/[；;。]/)[0];
    return t.length > n ? \`\${t.slice(0, n)}…\` : t;
  };
  const steps = [];

  steps.push({
    title: point.hook,
    text: \`先看一个具体场景：\${point.case}\`,
    chips: ['麻烦'],
    items: [
      T(point.hook, 720, 78, { size: point.hook.length > 14 ? 22 : 26, color: RED, rot: -1.2 }),
      T('先看它难在哪', 720, 112, { size: 14, color: GRAY }),
      ...subjectArt(point.subjectId, 235, 310),
      A([430, 290], [545, 200], { color: BLUE, bend: -0.2 }),
    ],
  });

  steps.push({
    title: '不解决会怎样',
    text: \`\${p[2] || p[0]}。代价不是抽象的，它会落在时间、成本或者体验上。\`,
    chips: ['代价'],
    items: [
      NOTE(710, 210, 400, 96, wrap(short(p[2] || point.case, 26), 15, 2), { color: RED, no: '✕', noColor: RED, seed: 61 }),
      T('硬扛的代价', 710, 274, { size: 15, color: RED }),
    ],
  });

  steps.push({
    title: '引入这个方法',
    text: \`\${p[0]}。这一步是整件事的转折：从「凭感觉」变成「有依据」。\`,
    chips: ['方法'],
    items: [
      TAG('方法', 590, 330, { w: 88, h: 38, size: 16, color: GREEN, fill: 'rgba(255,255,255,0.6)' }),
      T(\`→ \${short(p[0], 18)}\`, 590, 378, { size: 16 }),
      A([590, 352], [590, 364], { color: GREEN, bend: 0, head: true }),
    ],
  });

  steps.push({
    title: '具体怎么做',
    text: \`\${p[1] || ''} 操作上把它拆成三步，每一步都能检查、能复现。\`,
    chips: ['操作'],
    items: [
      T('① 先看条件', 590, 428, { size: 17, color: GRAY }),
      T('② 再套方法', 590, 458, { size: 17, color: GRAY }),
      T('③ 最后验证', 590, 488, { size: 17, color: GRAY }),
      A([700, 440], [660, 470], { color: BLUE, bend: 0.12 }),
    ],
  });

  steps.push({
    title: '结果与一句话',
    text: \`\${firstSentence(point.case)}。方法有效，但换个场景要先确认前提还成立。\`,
    chips: ['结果'],
    items: [
      T('✓ 结果', 720, 540, { size: 15, color: GREEN }),
      T(short(firstSentence(point.case), 22), 720, 566, { size: 15 }),
      T(point.formula, 500, 604, { size: point.formula.length > 20 ? 17 : 21, color: RED }),
      U(500 - Math.min(200, point.formula.length * 7), 614, Math.min(400, point.formula.length * 14), { color: RED }),
      S(880, 552, { size: 16, color: GOLD }),
    ],
  });

  return steps;
}

`;
s = s.slice(0, s2) + problem + s.slice(e2);
fs.writeFileSync(p, s);
console.log('ok');
