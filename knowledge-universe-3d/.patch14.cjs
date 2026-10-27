const fs = require('fs');
let g = fs.readFileSync('src/data/board-gen.js', 'utf8').replace(/\r\n/g, '\n');
g = g.replace("if (s === 'biology') return 'process';", "if (s === 'biology') return 'problem';");
fs.writeFileSync('src/data/board-gen.js', g);

let s = fs.readFileSync('src/data/subjects.js', 'utf8').replace(/\r\n/g, '\n');
const anchor = 'export const SUBJECT_BY_ID = Object.fromEntries(SUBJECTS.map((s) => [s.id, s]));';
if (!s.includes(anchor)) throw new Error('anchor subjects');
s = s.replace(anchor, `/* 去掉过于基础、只配一句话的知识点，把位置留给更复杂的问题 */
const RETIRED = new Set([
  'english-preposition',
  'chef-heat',
  'designer-color',
  'biology-foodchain',
  'physics-buoyancy',
  'math-golden',
  'chemistry-dissolve',
]);
for (const subject of SUBJECTS) {
  subject.points = subject.points.filter((point) => !RETIRED.has(point.id));
}

${anchor}`);
fs.writeFileSync('src/data/subjects.js', s);

let h = fs.readFileSync('index.html', 'utf8').replace(/\r\n/g, '\n');
h = h.replace('68 个知识点', '71 个知识点');
fs.writeFileSync('index.html', h);
console.log('ok');
