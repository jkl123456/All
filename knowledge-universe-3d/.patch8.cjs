const fs = require('fs');
const p = 'src/game/lesson.js';
let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const rep = (a, b) => {
  if (!s.includes(a)) console.log('MISS', JSON.stringify(a.slice(0, 50)));
  s = s.split(a).join(b);
};
// 检查点不再锁住“继续”，答不答都能往下走
rep("    this.$next.disabled = true;\n    this.$next.innerHTML = '继续<span class=\"arrow\">→</span>';", "    this.$next.disabled = false;\n    this.$next.innerHTML = this.quizAnswered ? '下一题<span class=\"arrow\">→</span>' : '跳过这题<span class=\"arrow\">→</span>';");
rep("    if (this.mode === 'quiz') {\n      if (!this.quizAnswered) return;\n      if (this.quizIndex < this.lesson.quiz.length - 1) {", "    if (this.mode === 'quiz') {\n      if (this.quizIndex < this.lesson.quiz.length - 1) {");
rep("  back() {\n    if (this.mode === 'quiz') {", "  back() {\n    if (this.mode === 'reward') return;\n    if (this.mode === 'quiz') {");
// 上一步在第一步也不再是灰的
rep("    this.$prev.disabled = this.index === 0;", "    this.$prev.disabled = false;");
rep("    this.$prev.disabled = this.quizIndex === 0;", "    this.$prev.disabled = false;");
fs.writeFileSync(p, s);
console.log('ok');
