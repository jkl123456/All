const fs = require('fs');
const p = 'src/game/lesson.js';
let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const rep = (a, b) => {
  if (!s.includes(a)) console.log('MISS:', JSON.stringify(a.slice(0, 70)));
  s = s.split(a).join(b);
};

// 1) 头部的模式切换按钮
rep('          <button class="mode-switch" id="lesson-mode" type="button" hidden>板书讲解</button>\n', '');
rep("    this.variant = 'stage';\n", '');
rep("    this.$mode = this.el.querySelector('#lesson-mode');\n", '');
rep("      if (event.target.closest('#lesson-mode')) {\n        this.toggleVariant();\n        return;\n      }\n", '');

// 2) open 时的变体初始化
rep("    this.variant = lesson.boardOnly ? 'board' : 'stage';\n", '');
rep('    this.mountVariant();', '    this.mountBoard();');

// 3) 变体方法整体替换
const start = s.indexOf('  mountVariant() {');
const end = s.indexOf('  renderDots() {');
if (start < 0 || end < 0) console.log('MISS block', start, end);
s = s.slice(0, start) + `  mountBoard() {
    this.stage.mount('board', this.lesson.boardSpec || this.lesson.spec, { step: this.index });
    this.el.classList.add('is-board');
    this.$scale.textContent = \`\${this.point.subject.en} · BOARD\`;
  }

` + s.slice(end);

// 4) 变量面板永远不显示
rep("    if (!vars.length || this.variant === 'board') {", "    if (!vars.length || true) {");

// 5) 分幕跳步
rep("    if (this.variant === 'board' && this.lesson.boardSpec) {\n      this.stage.jump({ step: this.boardStep() });\n    } else if (this.lesson.instant) {\n      this.stage.jump(beat.state || {});\n    } else {\n      this.stage.setState(beat.state || {});\n    }", "    this.stage.jump(beat.state || { step: this.index });");
rep("    this.$vars.hidden = (this.lesson.vars || []).length === 0 || this.variant === 'board';", "    this.$vars.hidden = true;");

// 6) 结算页去掉 3D 实验室
rep('          <button class="ghost-btn" type="button" data-action="lab">进入 3D 实验室</button>\n', '');
rep("    if (action === 'lab') {\n      const point = this.point;\n      this.close();\n      this.onOpenLab(point);\n      return;\n    }\n", '');

fs.writeFileSync(p, s);
console.log('ok', s.length);
