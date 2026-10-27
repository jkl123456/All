/**
 * 程序员 / 设计师板书（五幕：麻烦 → 代价 → 方法 → 操作 → 结果）。
 * 画法：把抽象结构画成「可以指着看」的图 —— 栈、树、桶、锁、栅格、曲线。
 */
import {
  C, arrow, bigLabel, box, circle, grid, ground, label, layer, line, note, path, poly, prop, star, tag, underline,
} from './scene-kit.js';

const MONO = { size: 15 };

/* -------------------------------- 汉诺塔 -------------------------------- */
function hanoi() {
  const pegs = [260, 430, 600];
  return [
    layer([
      ground(500, 160, 700),
      ...pegs.map((x) => line(x, 500, x, 300, { w: 4, c: C.gray })),
      ...pegs.map((x) => line(x - 70, 500, x + 70, 500, { w: 3, c: C.gray })),
      // 初始塔：3 个盘
      ...[0, 1, 2].map((i) => box(pegs[0] - 46 + i * 12, 470 - i * 18, 92 - i * 24, 14, { stroke: C.blue, width: 1.8, fill: 'rgba(47,93,143,0.2)' })),
      label('A', 260, 528, { size: 14 }),
      label('B', 430, 528, { size: 14 }),
      label('C', 600, 528, { size: 14 }),
      label('把一摞盘子，整摞搬到另一根柱子上', 400, 196, { size: 16 }),
    ], [400, 420]),

    layer([
      bigLabel('?', 720, 330, { size: 34, color: C.gold }),
      label('一次只能搬一个，大盘不能压小盘', 660, 380, { size: 13 }),
      label('n 大了，手算就崩了', 660, 404, { size: 12 }),
    ], [700, 350]),

    layer([
      // 递归：把 n-1 当整体
      tag('先搬走上面 n−1 个', 720, 460, { w: 180, h: 30, size: 13, color: C.blue }),
      tag('再搬最大的那个', 720, 500, { w: 180, h: 30, size: 13, color: C.red }),
      tag('最后搬回 n−1 个', 720, 540, { w: 180, h: 30, size: 13, color: C.green }),
      label('同一套动作，规模小一号', 720, 580, { size: 13 }),
    ], [720, 500]),

    layer([
      // 递归树
      line(300, 200, 400, 260, { w: 1.6, c: C.gray }),
      line(300, 200, 200, 260, { w: 1.6, c: C.gray }),
      circle(300, 194, 16, { stroke: C.blue, width: 2 }),
      label('n', 300, 200, { size: 12 }),
      circle(200, 266, 14, { stroke: C.gray, width: 1.8 }),
      label('n−1', 200, 271, { size: 10 }),
      circle(400, 266, 14, { stroke: C.gray, width: 1.8 }),
      label('n−1', 400, 271, { size: 10 }),
      line(200, 280, 160, 320, { w: 1.2, c: C.gray, opacity: 0.7 }),
      line(200, 280, 240, 320, { w: 1.2, c: C.gray, opacity: 0.7 }),
      line(400, 280, 360, 320, { w: 1.2, c: C.gray, opacity: 0.7 }),
      line(400, 280, 440, 320, { w: 1.2, c: C.gray, opacity: 0.7 }),
      label('每一步都长成两枝', 300, 350, { size: 12 }),
    ], [300, 260]),

    layer([
      label('T(n) = 2T(n−1) + 1 = 2ⁿ − 1', 400, 574, { size: 18, color: C.red }),
      label('64 个盘，宇宙年龄都搬不完', 760, 500, { size: 12 }),
    ], [400, 574]),
  ];
}

/* -------------------------------- 二叉树 -------------------------------- */
function binarytree() {
  return [
    layer([
      // 树
      circle(400, 230, 22, { stroke: C.blue, width: 2.4, fill: 'rgba(47,93,143,0.12)' }),
      label('8', 400, 236, { size: 15 }),
      line(400, 252, 320, 300, { w: 1.8, c: C.gray }),
      line(400, 252, 480, 300, { w: 1.8, c: C.gray }),
      circle(320, 312, 20, { stroke: C.blue, width: 2, fill: 'rgba(47,93,143,0.10)' }),
      label('4', 320, 318, { size: 14 }),
      circle(480, 312, 20, { stroke: C.blue, width: 2, fill: 'rgba(47,93,143,0.10)' }),
      label('12', 480, 318, { size: 14 }),
      line(320, 332, 260, 380, { w: 1.6, c: C.gray }),
      line(320, 332, 380, 380, { w: 1.6, c: C.gray }),
      circle(260, 392, 18, { stroke: C.blue, width: 1.8 }),
      label('2', 260, 398, { size: 13 }),
      circle(380, 392, 18, { stroke: C.blue, width: 1.8 }),
      label('6', 380, 398, { size: 13 }),
      label('为什么查词典这么快', 400, 196, { size: 16 }),
    ], [400, 300]),

    layer([
      // 查找 6
      path('M400 252L320 296L376 372', { stroke: C.red, width: 3 }),
      label('6 < 8 → 往左', 500, 240, { size: 12, color: C.red }),
      label('6 > 4 → 往右', 500, 288, { size: 12, color: C.red }),
      label('每比较一次，砍掉一半', 760, 360, { size: 13 }),
    ], [400, 320]),

    layer([
      // 退化链表
      ...[0, 1, 2, 3].map((i) => circle(660 + i * 54, 470, 16, { stroke: C.gray, width: 1.8, fill: 'rgba(255,255,255,0.5)' })),
      ...[0, 1, 2].map((i) => line(676 + i * 54, 470, 698 + i * 54, 470, { c: C.gray, w: 1.4 })),
      label('一直插有序数据 → 退化成链表', 760, 520, { size: 13, color: C.red }),
      label('这时查找就是 O(n)', 760, 544, { size: 12 }),
    ], [760, 480]),

    layer([
      tag('左子树 < 根 < 右子树', 400, 500, { w: 200, h: 30, size: 13, color: C.blue }),
      label('平衡，才是它快的真正原因', 760, 410, { size: 13 }),
      label('h ≈ log₂(n+1)', 760, 440, { size: 17, color: C.red }),
    ], [400, 500]),

    layer([
      label('树把「找」变成了「每次砍一半」', 400, 580, { size: 15, color: C.red }),
    ], [400, 580]),
  ];
}

/* -------------------------------- 网络分层 -------------------------------- */
function network() {
  const rows = [
    ['应用层', 'HTTP / DNS', 236],
    ['传输层', 'TCP / UDP', 316],
    ['网络层', 'IP / 路由', 396],
    ['链路层', '以太网 / WiFi', 476],
  ];
  return [
    layer([
      ...rows.map(([n, p, y]) => [
        box(230, y, 200, 56, { stroke: C.blue, width: 2, fill: 'rgba(47,93,143,0.10)' }),
        label(n, 330, y + 26, { size: 15, color: C.blue }),
        label(p, 480, y + 28, { size: 12, anchor: 'start' }),
      ]),
      label('一次点击，穿过四层协议', 400, 196, { size: 16 }),
    ], [400, 340]),

    layer([
      arrow([700, 250], [700, 470], { c: C.gray, w: 2, bend: -0.06 }),
      label('发送：逐层加头', 760, 250, { size: 13 }),
      arrow([620, 470], [620, 250], { c: C.gold, w: 2, bend: -0.06 }),
      label('接收：逐层拆头', 530, 520, { size: 13, color: C.gold }),
    ], [700, 360]),

    layer([
      // 封装示意
      ...[0, 1, 2, 3].map((i) => box(230 - i * 14, 540 + 0, 200 + i * 28, 16, { stroke: C.gold, width: 1.2, fill: 'rgba(180,131,31,0.10)', anim: 'fade' })),
      label('每层只关心自己那段头', 480, 588, { size: 12 }),
    ], [400, 550]),

    layer([
      tag('IP：送到哪', 720, 546, { w: 120, h: 28, size: 12, color: C.blue }),
      tag('TCP：送对、送全', 720, 582, { w: 140, h: 28, size: 12, color: C.green }),
      label('分层的好处：换一层，不用动其他层', 760, 400, { size: 13 }),
    ], [720, 560]),

    layer([
      label('分层的本质，是把「变化」关在每一层里', 400, 574, { size: 15, color: C.red }),
    ], [400, 574]),
  ];
}

/* --------------------------------- 哈希表 --------------------------------- */
function hashTable() {
  return [
    layer([
      // 键 → 函数 → 桶
      ...[0, 1, 2].map((i) => box(170, 240 + i * 54, 110, 38, { stroke: C.blue, width: 1.8, fill: 'rgba(47,93,143,0.10)' })),
      label('key', 225, 264, { size: 12 }),
      label('key', 225, 318, { size: 12 }),
      label('key', 225, 372, { size: 12 }),
      box(340, 280, 74, 70, { stroke: C.red, width: 2, fill: 'rgba(196,86,63,0.10)' }),
      label('hash', 377, 320, { size: 13, color: C.red }),
      ...[0, 1, 2, 3, 4].map((i) => box(500, 220 + i * 52, 120, 34, { stroke: C.gray, width: 1.4, fill: 'rgba(255,255,255,0.5)' })),
      label('0', 480, 242, { size: 11, anchor: 'end' }),
      label('4', 480, 450, { size: 11, anchor: 'end' }),
      label('一秒找到那个名字', 400, 196, { size: 16 }),
    ], [400, 340]),

    layer([
      arrow([290, 300], [334, 312], { c: C.gray, w: 1.8 }),
      arrow([420, 314], [496, 300], { c: C.gray, w: 1.8 }),
      label('index = hash(key) % capacity', 400, 480, { size: 16, color: C.red }),
      label('键被算成一个下标', 760, 300, { size: 13 }),
    ], [400, 330]),

    layer([
      // 冲突链
      box(500, 428, 120, 34, { stroke: C.red, width: 1.8, fill: 'rgba(196,86,63,0.12)' }),
      box(640, 428, 100, 34, { stroke: C.red, width: 1.6, fill: 'rgba(196,86,63,0.10)' }),
      line(620, 445, 640, 445, { w: 1.8, c: C.red }),
      label('冲突：两个键落到同一个桶', 700, 500, { size: 13, color: C.red }),
      label('鸽巢原理，冲突不可避免', 700, 524, { size: 12 }),
    ], [700, 450]),

    layer([
      // 扩容
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => box(230 + i * 44, 540, 38, 30, { stroke: C.green, width: 1.2, fill: 'rgba(44,115,85,0.10)', anim: 'fade' })),
      arrow([360, 530], [360, 512], { c: C.green, w: 1.8 }),
      label('装太满就翻倍重排：用空间换回常数时间', 760, 566, { size: 12 }),
    ], [420, 540]),

    layer([
      label('哈希把「找」变成了「算」', 400, 600, { size: 15, color: C.red }),
    ], [400, 600]),
  ];
}

/* -------------------------------- 并发与锁 -------------------------------- */
function lock() {
  return [
    layer([
      // 两个线程抢一张钞票
      box(240, 280, 160, 90, { stroke: C.blue, width: 2, fill: 'rgba(47,93,143,0.10)' }),
      label('线程 A', 320, 328, { size: 15, color: C.blue }),
      box(240, 400, 160, 90, { stroke: C.red, width: 2, fill: 'rgba(196,86,63,0.10)' }),
      label('线程 B', 320, 448, { size: 15, color: C.red }),
      arrow([410, 325], [560, 360], { c: C.blue, w: 2 }),
      arrow([410, 445], [560, 410], { c: C.red, w: 2 }),
      box(570, 340, 160, 90, { stroke: C.gold, width: 2.4, fill: 'rgba(233,186,96,0.2)' }),
      label('余额 = 100', 650, 390, { size: 14 }),
      label('两个线程抢同一块钱', 400, 196, { size: 16 }),
    ], [420, 380]),

    layer([
      bigLabel('!', 700, 300, { size: 30, color: C.red }),
      label('都读到 100，都写回 90', 700, 470, { size: 13, color: C.red }),
      label('少扣了一次', 700, 494, { size: 12 }),
    ], [700, 380]),

    layer([
      // 锁
      box(660, 520, 60, 46, { stroke: C.gold, width: 2.4, fill: 'rgba(233,186,96,0.25)' }),
      path('M674 520v-16a16 16 0 0 1 32 0v16', { stroke: C.gold, width: 2.6 }),
      label('lock', 690, 590, { size: 12, color: C.gold }),
      label('临界区必须互斥', 760, 540, { size: 13 }),
      tag('lock → 临界区 → unlock', 400, 560, { w: 218, h: 30, size: 13, color: C.blue }),
    ], [400, 540]),

    layer([
      // 死锁环
      circle(760, 400, 34, { stroke: C.red, width: 2, dash: '5 4' }),
      label('A 等 B', 760, 372, { size: 11 }),
      label('B 等 A', 760, 438, { size: 11 }),
      label('按同一顺序加锁，就不会成环', 500, 500, { size: 13 }),
    ], [760, 410]),

    layer([
      label('锁不是让人排队，是让状态只有一个版本', 400, 604, { size: 15, color: C.red }),
    ], [400, 604]),
  ];
}

/* --------------------------------- 编译原理 --------------------------------- */
function compiler() {
  const stages = [['源码', 220], ['tokens', 320], ['AST', 430], ['IR', 540], ['目标码', 660]];
  return [
    layer([
      ...stages.map(([n, x]) => [
        box(x, 300, 88, 56, { stroke: C.blue, width: 1.8, fill: 'rgba(47,93,143,0.10)' }),
        label(n, x + 44, 334, { size: 12 }),
      ]),
      ...[1, 2, 3, 4].map((i) => arrow([stages[i - 1][1] + 88, 328], [stages[i][1], 328], { c: C.gray, w: 1.6, bend: 0 })),
      label('从一行代码，到机器指令', 400, 196, { size: 16 }),
    ], [420, 328]),

    layer([
      label('词法：切成单词', 220, 394, { size: 12 }),
      label('语法：看结构', 430, 394, { size: 12 }),
      label('语义：看含义', 540, 394, { size: 12 }),
      label('优化：改执行方式', 660, 394, { size: 12 }),
    ], [420, 390]),

    layer([
      // AST
      circle(430, 460, 18, { stroke: C.red, width: 2 }),
      label('+', 430, 466, { size: 13 }),
      line(430, 478, 380, 512, { w: 1.6, c: C.gray }),
      line(430, 478, 480, 512, { w: 1.6, c: C.gray }),
      circle(380, 524, 16, { stroke: C.gray, width: 1.6 }),
      label('×', 380, 529, { size: 11 }),
      circle(480, 524, 16, { stroke: C.gray, width: 1.6 }),
      label('2', 480, 529, { size: 11 }),
      line(380, 540, 350, 566, { w: 1.2, c: C.gray }),
      line(380, 540, 410, 566, { w: 1.2, c: C.gray }),
      label('语法树体现优先级', 600, 500, { size: 13 }),
      label('1 + 2 × 3 先算乘', 600, 524, { size: 12 }),
    ], [430, 500]),

    layer([
      tag('优化：不改变语义', 760, 566, { w: 168, h: 30, size: 13, color: C.green }),
      label('内联、常量折叠、删死代码', 760, 602, { size: 12 }),
    ], [760, 580]),

    layer([
      label('编译 = 把「人写的结构」翻译成「机器能执行的结构」', 400, 620, { size: 15, color: C.red }),
    ], [400, 620]),
  ];
}

/* --------------------------------- 对比与层级 --------------------------------- */
function contrast() {
  return [
    layer([
      // 页面
      box(180, 240, 260, 300, { stroke: 'rgba(93,100,112,0.4)', width: 1.6, fill: 'rgba(255,255,255,0.5)' }),
      box(200, 262, 220, 26, { stroke: 'rgba(93,100,112,0.3)', width: 1, fill: 'rgba(93,100,112,0.10)' }),
      ...[0, 1, 2, 3].map((i) => box(200, 306 + i * 26, 150, 12, { stroke: 'rgba(93,100,112,0.25)', width: 1, fill: 'rgba(93,100,112,0.12)' })),
      box(200, 470, 84, 30, { stroke: C.gray, width: 1.4, fill: 'rgba(93,100,112,0.18)' }),
      label('按钮', 242, 490, { size: 12, color: C.gray }),
      label('为什么你找不到按钮', 400, 196, { size: 16 }),
    ], [320, 380]),

    layer([
      bigLabel('?', 480, 420, { size: 32, color: C.red }),
      label('因为按钮和正文长一样', 600, 420, { size: 13, color: C.red }),
      label('没有对比，就没有焦点', 600, 444, { size: 12 }),
    ], [560, 430]),

    layer([
      // 加大对比
      box(560, 250, 120, 40, { stroke: C.red, width: 2.4, fill: 'rgba(196,86,63,0.85)' }),
      label('主按钮', 620, 276, { size: 13, color: '#fff' }),
      label('大小 / 粗细 / 明度 / 色彩', 700, 330, { size: 12 }),
      label('四个维度一起用力', 700, 354, { size: 12 }),
    ], [620, 280]),

    layer([
      tag('一屏只留一个最强对比', 700, 420, { w: 208, h: 30, size: 12, color: C.blue }),
      label('其余全部退到第二层', 700, 456, { size: 12 }),
      label('层级靠差异，不靠阴影和边框', 700, 480, { size: 12 }),
    ], [700, 440]),

    layer([
      label('用户看不见设计，只看得见「先看哪里」', 400, 580, { size: 15, color: C.red }),
    ], [400, 580]),
  ];
}

/* --------------------------------- 版式网格 --------------------------------- */
function gridLayout() {
  return [
    layer([
      box(160, 240, 460, 260, { stroke: 'rgba(93,100,112,0.35)', width: 1.6, fill: 'rgba(255,255,255,0.4)' }),
      ...[0, 1, 2, 3, 4, 5].map((c) => [0, 1, 2, 3].map((r) => box(180 + c * 72, 262 + r * 58, 56, 44, {
        stroke: 'rgba(47,93,143,0.35)', width: 1, fill: 'rgba(47,93,143,0.10)', anim: 'fade',
      }))),
      label('看不见的线，撑起好设计', 400, 196, { size: 16 }),
    ], [390, 360]),

    layer([
      // 栏与槽
      line(180, 520, 236, 520, { w: 5, c: C.blue }),
      label('栏宽', 208, 546, { size: 12, color: C.blue }),
      line(236, 520, 252, 520, { w: 5, c: C.red }),
      label('槽', 244, 546, { size: 12, color: C.red }),
      label('内容宽度 = 栏宽 × 栏数 + 槽宽 × (栏数 − 1)', 700, 400, { size: 12 }),
    ], [300, 520]),

    layer([
      line(160, 560, 620, 560, { w: 1.6, c: C.gold, dash: '4 4' }),
      label('8px 基准', 700, 440, { size: 13, color: C.gold }),
      label('间距统一，页面才安静', 700, 464, { size: 12 }),
    ], [400, 560]),

    layer([
      tag('留白也是版面的一部分', 700, 520, { w: 200, h: 30, size: 12, color: C.green }),
      label('没有留白，层级就挤在一起', 700, 556, { size: 12 }),
    ], [700, 530]),

    layer([
      label('栅格不是限制，是把随机的决定提前做完', 400, 600, { size: 15, color: C.red }),
    ], [400, 600]),
  ];
}

/* --------------------------------- 贝塞尔 --------------------------------- */
function bezier() {
  return [
    layer([
      line(180, 480, 600, 480, { w: 1.6, c: 'rgba(93,100,112,0.4)' }),
      line(180, 480, 180, 220, { w: 1.6, c: 'rgba(93,100,112,0.4)' }),
      path('M180 480C260 480 300 240 400 240C500 240 540 480 600 480', { stroke: C.blue, width: 3 }),
      circle(180, 480, 6, { stroke: C.red, width: 2, fill: C.red }),
      circle(600, 480, 6, { stroke: C.red, width: 2, fill: C.red }),
      label('一条曲线，撑起所有字体', 400, 196, { size: 16 }),
    ], [400, 380]),

    layer([
      line(180, 480, 250, 270, { w: 1.2, c: C.gray, dash: '5 4' }),
      line(600, 480, 530, 270, { w: 1.2, c: C.gray, dash: '5 4' }),
      circle(250, 270, 7, { stroke: C.gold, width: 2, fill: 'rgba(233,186,96,0.7)' }),
      circle(530, 270, 7, { stroke: C.gold, width: 2, fill: 'rgba(233,186,96,0.7)' }),
      label('P1', 250, 248, { size: 12, color: C.gold }),
      label('P2', 530, 248, { size: 12, color: C.gold }),
      label('控制点决定端点的切线方向', 760, 300, { size: 12 }),
    ], [390, 300]),

    layer([
      label('B(t) = (1−t)³P₀ + 3(1−t)²tP₁ + 3(1−t)t²P₂ + t³P₃', 760, 380, { size: 12 }),
      label('四个点，三次贝塞尔', 760, 410, { size: 12 }),
      label('曲线一定经过 P0 和 P3', 760, 440, { size: 12 }),
    ], [760, 400]),

    layer([
      // 字体轮廓
      path('M660 520q30 -60 60 0q-30 -20 -60 0Z', { stroke: C.blue, width: 2, fill: 'rgba(47,93,143,0.12)' }),
      label('字体的每一笔，都是这样的曲线', 760, 560, { size: 12 }),
    ], [700, 530]),

    layer([
      label('曲线不是画出来的，是被四个点「拉」出来的', 400, 580, { size: 15, color: C.red }),
    ], [400, 580]),
  ];
}

/* --------------------------------- 字距与行高 --------------------------------- */
function typescale() {
  return [
    layer([
      // 一段文字
      ...[0, 1, 2, 3].map((i) => line(180, 280 + i * 34, 560, 280 + i * 34, { w: 9, c: 'rgba(93,100,112,0.28)' })),
      line(180, 238, 560, 238, { w: 1, c: C.red, dash: '4 4' }),
      line(180, 340, 560, 340, { w: 1, c: C.red, dash: '4 4' }),
      label('好读的秘密在 1.5', 400, 196, { size: 16 }),
    ], [400, 300]),

    layer([
      line(600, 238, 600, 340, { w: 1.6, c: C.red }),
      label('行高', 620, 292, { size: 13, color: C.red }),
      label('line-height ≈ 1.5 × 字号', 760, 420, { size: 13 }),
      label('太挤，眼睛会跳行', 760, 444, { size: 12 }),
    ], [620, 300]),

    layer([
      // 字距
      label('字距', 180, 400, { size: 13 }),
      line(180, 420, 560, 420, { w: 1, c: C.gray, dash: '3 3' }),
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => box(190 + i * 46, 404, 26, 30, { stroke: C.blue, width: 1.4, fill: 'rgba(47,93,143,0.10)' })),
      label('每行 30—40 字最舒适', 760, 500, { size: 12 }),
    ], [400, 420]),

    layer([
      tag('大字：行高倍数要小', 700, 540, { w: 196, h: 30, size: 12, color: C.blue }),
      tag('小字：行高倍数要大', 700, 580, { w: 196, h: 30, size: 12, color: C.green }),
    ], [700, 560]),

    layer([
      label('行高不是为了好看，是为了让眼睛有地方落', 400, 560, { size: 15, color: C.red }),
    ], [400, 560]),
  ];
}

export const CODE_SCENES = {
  'programmer-hanoi': hanoi,
  'programmer-binarytree': binarytree,
  'programmer-network': network,
  'programmer-hash': hashTable,
  'programmer-lock': lock,
  'programmer-compiler': compiler,
  'designer-contrast': contrast,
  'designer-grid': gridLayout,
  'designer-bezier': bezier,
  'designer-typescale': typescale,
};
