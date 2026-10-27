const fs = require('fs');
const p = 'src/data/board-gen.js';
let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const rep = (a, b) => {
  if (!s.includes(a)) console.log('MISS', JSON.stringify(a.slice(0, 60)));
  s = s.split(a).join(b);
};
rep("T('✓ 解决了什么', 640, 538, { size: 14, color: GREEN }),", "T('✓ 解决了什么', 560, 530, { size: 14, color: GREEN }),");
rep("T(short(firstSentence(point.summary), 24), 720, 538, { size: 14, anchor: 'start' }),", "T(short(firstSentence(point.summary), 22), 560, 558, { size: 15 }),");
rep("S(930, 528, { size: 16, color: GOLD }),", "S(880, 522, { size: 16, color: GOLD }),");
fs.writeFileSync(p, s);
console.log('ok');
