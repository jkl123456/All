const fs = require('fs');
const repFile = (p, pairs) => {
  let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) console.log('MISS', p, JSON.stringify(a.slice(0, 50)));
    s = s.split(a).join(b);
  }
  fs.writeFileSync(p, s);
};

repFile('src/data/lesson-content.js', [[
  'export const HAND_BEATS = {',
  'export function handBeatsOf(id) {\n  return HAND_BEATS[id]?.beats || null;\n}\n\nexport const HAND_BEATS = {'
]]);

let s = fs.readFileSync('src/data/lessons.js', 'utf8').replace(/\r\n/g, '\n');
s = s.replace("import { HAND_BEATS } from './lesson-content.js';\nimport { BOARD_LESSONS, buildAutoBoard } from './board-content.js';", "import { BOARD_LESSONS } from './board-content.js';\nimport { buildNarrativeBoard } from './board-gen.js';");
const start = s.indexOf('/* -------------------------------- 装配入口 -------------------------------- */');
const end = s.indexOf('export function lessonFor(pointId) {');
if (start < 0 || end < 0) console.log('MISS block');
const block = `/* -------------------------------- 装配入口 -------------------------------- */
function boardLesson(script, point) {
  const spec = { tone: point.subject?.color, steps: script.steps };
  return {
    engine: 'board',
    spec,
    vars: [],
    beats: script.steps.map((step, i) => ({
      label: \`第 \${i + 1} 步\`,
      title: step.title,
      text: step.text,
      note: step.note,
      quote: step.quote,
      chips: step.chips,
      state: { step: i },
    })),
    quiz: script.quiz || generatedQuiz(point),
    point,
    boardSpec: spec,
    boardOnly: true,
  };
}

export function buildLesson(point) {
  if (!point) return null;
  return boardLesson(BOARD_LESSONS[point.id] || buildNarrativeBoard(point), point);
}

`;
s = s.slice(0, start) + block + s.slice(end);
fs.writeFileSync('src/data/lessons.js', s);
console.log('ok');
