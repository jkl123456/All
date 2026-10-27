const fs = require('fs');
const p = 'index.html';
let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const before = s.length;
s = s.replace(/      <section class="lab" id="lab"[\s\S]*?<\/section>\n\n/, '');
s = s.replace('<title>知域 · 3D 知识宇宙</title>', '<title>知域 · 知识图谱</title>');
s = s.replace(
  'content="知域是一个可交互的 3D 知识图谱，也是一条从黑铁到王者的闯关路径。74 个知识点，分幕动画、可改变量、检查点与挑战模式，横跨数理化、英语、生物、地理、历史、语文与程序员、设计师、厨师、建筑、渔民、农民等行业。"',
  'content="知域是一个可交互的知识图谱，也是一条从青铜到王者的闯关路径。68 个知识点，每一关都是一块白板板书：老师一笔一笔画出来，由浅入深讲到用得上。横跨数理化、英语、生物、地理、历史、语文与程序员、设计师、厨师、建筑、渔民、农民等行业。"'
);
s = s.replace('<noscript>请启用 JavaScript 以浏览三维知识宇宙。</noscript>', '<noscript>请启用 JavaScript 以浏览知识宇宙。</noscript>');
fs.writeFileSync(p, s);
console.log('size', before, '->', s.length, 'lab left:', (s.match(/lab-/g) || []).length);
