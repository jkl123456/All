const fs = require('fs');
const p = 'src/data/board-gen.js';
let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const rep = (a, b) => {
  if (!s.includes(a)) console.log('MISS', JSON.stringify(a.slice(0, 60)));
  s = s.split(a).join(b);
};
rep('...subjectArt(point.subjectId, 235, 320),', '...subjectArt(point.subjectId, 225, 282),');
rep("NOTE(650, 424, 500, 92, [], { color: BLUE, opacity: 0.32, seed: 33 }),", "NOTE(640, 372, 480, 88, [], { color: BLUE, opacity: 0.32, seed: 33 }),");
rep("T(point.formula, 650, 438, { size: point.formula.length > 22 ? 18 : 24, color: BLUE }),", "T(point.formula, 640, 386, { size: point.formula.length > 22 ? 18 : 24, color: BLUE }),");
rep("T('一条关系，把过程压成一行', 650, 470, { size: 13, color: GRAY }),", "T('一条关系，把过程压成一行', 640, 440, { size: 13, color: GRAY }),");
rep("T('代进去，它开始有用', 650, 520, { size: 14, color: GRAY }),", "T('代进去，它开始有用', 640, 470, { size: 14, color: GRAY }),");
rep("T(`→ ${short(p[0], 20)}`, 650, 546, { size: 16 }),\n      p[1] ? T(`→ ${short(p[1], 20)}`, 650, 572, { size: 16 }) : null,", "T(`→ ${short(p[0], 20)}`, 640, 498, { size: 16 }),");
rep("T('✓ 解决了什么', 650, 600, { size: 14, color: GREEN }),", "T('✓ 解决了什么', 640, 538, { size: 14, color: GREEN }),");
rep("T(short(firstSentence(point.summary), 24), 760, 600, { size: 14 }),", "T(short(firstSentence(point.summary), 24), 720, 538, { size: 14, anchor: 'start' }),");
rep("S(920, 592, { size: 16, color: GOLD }),", "S(930, 528, { size: 16, color: GOLD }),");
fs.writeFileSync(p, s);
console.log('ok');
