/**
 * 数学板书：每一幕都是「再画一笔」。
 * 六幕节奏固定：现象 → 旧办法 → 谁提出 → 核心关系 → 代入 → 边界。
 * 前三幕在第 1 页（实物与人物），后三幕换到第 2 页（几何与公式）。
 * 版式：左边画画（x 130~610），右边批注（x 640~890）。
 */
import {
  C, arrow, bigLabel, box, circle, ellipse, grid, ground, label, layer, line, note, path, poly, prop, star, tag, underline, figure } from './scene-kit.js';

const AXIS = 'rgba(93,100,112,0.55)';

/* ------------------------------- 勾股定理 ------------------------------- */
function pythagoras() {
  const p0 = [
    layer([
      ground(516, 130, 660),
      line(322, 516, 322, 300, { w: 3.2 }),
      line(322, 516, 600, 516, { w: 3.2 }),
      ...[0, 1, 2, 3].map((i) => line(322, 460 - i * 54, 306, 460 - i * 54, { w: 1.4, c: C.gray, opacity: 0.4 })),
      line(322, 300, 596, 514, { w: 2.6, c: C.red }),
      label('3 米', 298, 404, { color: C.red, size: 17 }),
      label('4 米', 474, 548, { color: C.red, size: 17 }),
      label('5 米', 498, 386, { color: C.red, size: 17, rot: 31 }),
      figure(620, 516, { pose: 'talk', talk: true, face: 'smile', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      label('工人', 620, 550, { size: 14 }),
      label('一根绳子，就能验出墙角是不是直角', 400, 196, { size: 16 }),
    ], [460, 400]),

    layer([
      line(700, 470, 656, 292, { w: 3, c: C.gray }),
      line(656, 292, 812, 470, { w: 2.4, c: C.red }),
      line(700, 470, 812, 470, { w: 2.4, c: C.gray, opacity: 0.5 }),
      bigLabel('✕', 742, 398, { size: 44, color: C.red, rot: 8 }),
      label('角度一歪，绳子就不准', 758, 236, { size: 15, color: C.red }),
      label('只能一遍遍试', 758, 258, { size: 13 }),
      arrow([726, 272], [714, 292], { c: C.gray, w: 2, bend: 0.05 }),
    ], [760, 380], { fresh: true }),

    layer([
      ground(520, 120, 700),
      figure(196, 520, { pose: 'point', face: 'neutral', hair: 'bun', hairColor: 'brown', outfit: 'robe', color: '#8a6b4f', s: 0.86 }),
      prop('book', 292, 516, { s: 1.1 }),
      label('毕达哥拉斯', 190, 556, { size: 18, color: C.blue }),
      label('公元前 6 世纪', 190, 578, { size: 12 }),
      // 3-4-5 的直角三角形
      poly([[520, 470], [520, 350], [680, 470]], { stroke: C.blue, width: 2.6, fill: 'rgba(47,93,143,0.06)' }),
      path('M520 452h18v18', { stroke: C.gray, width: 1.6 }),
      label('3', 504, 412, { size: 15, color: C.blue }),
      label('4', 598, 496, { size: 15, color: C.blue }),
      label('5', 612, 392, { size: 15, color: C.red, rot: -37 }),
      label('a² + b² = c²', 620, 300, { size: 27, color: C.red }),
      underline(520, 314, 200, { c: C.red, w: 2 }),
      label('把一次次测量，变成一条永远成立的式子', 620, 338, { size: 13 }),
    ], [420, 430], { fresh: true }),
  ];

  const p1 = [
    layer([
      poly([[360, 380], [360, 290], [480, 380]], { stroke: C.blue, width: 2.8, fill: 'rgba(47,93,143,0.06)' }),
      path('M360 362h18v18', { stroke: C.gray, width: 1.6 }),
      poly([[270, 290], [360, 290], [360, 380], [270, 380]], { stroke: C.blue, width: 1.8, fill: 'rgba(47,93,143,0.12)' }),
      poly([[360, 380], [480, 380], [480, 500], [360, 500]], { stroke: C.gold, width: 1.8, fill: 'rgba(180,131,31,0.14)' }),
      poly([[360, 290], [480, 380], [570, 260], [450, 170]], { stroke: C.red, width: 1.8, fill: 'rgba(196,86,63,0.10)' }),
      label('a', 350, 340, { size: 16, color: C.blue }),
      label('b', 420, 410, { size: 16, color: C.blue }),
      label('c', 428, 316, { size: 16, color: C.red, rot: 37 }),
      label('a²', 314, 342, { size: 24, color: C.blue }),
      label('b²', 420, 452, { size: 24, color: C.gold }),
      label('c²', 512, 250, { size: 24, color: C.red, rot: 14 }),
      bigLabel('a² + b² = c²', 756, 200, { size: 30 }),
      underline(636, 214, 240, { c: C.red, w: 2 }),
      label('两条直角边上的正方形，', 756, 246, { size: 14 }),
      label('面积加起来正好是斜边那个', 756, 270, { size: 14 }),
    ], [450, 350]),

    layer([
      poly([[680, 452], [680, 352], [818, 452]], { stroke: C.red, width: 2.4, fill: 'rgba(196,86,63,0.06)' }),
      label('3', 668, 402, { size: 16, color: C.red }),
      label('4', 748, 478, { size: 16, color: C.red }),
      label('5', 764, 392, { size: 16, color: C.red, rot: 33 }),
      label('9 + 16 = 25', 748, 516, { size: 20, color: C.red }),
      star(690, 534, { size: 15 }),
    ], [750, 420]),

    layer([
      poly([[150, 578], [150, 538], [210, 578]], { stroke: C.green, width: 2 }),
      label('✓ 直角', 232, 570, { size: 14, color: C.green, anchor: 'start' }),
      poly([[320, 578], [320, 538], [390, 566]], { stroke: C.red, width: 2 }),
      label('✗ 钝角', 404, 570, { size: 14, color: C.red, anchor: 'start' }),
      label('公式的前提，是那个直角', 560, 566, { size: 15 }),
    ], [420, 560]),
  ];

  return [...p0, ...p1];
}

/* -------------------------------- 抛物线 -------------------------------- */
function parabola() {
  const p0 = [
    layer([
      ground(516, 130, 700),
      figure(214, 516, { pose: 'think', face: 'doubt', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      label('投篮的人', 214, 550, { size: 14 }),
      line(640, 250, 640, 516, { w: 4, c: C.gray }),
      line(596, 288, 640, 288, { w: 3, c: C.gray }),
      circle(606, 292, 16, { stroke: C.red, width: 2.4, fill: 'rgba(196,86,63,0.08)' }),
      path('M258 436Q470 150 604 290', { stroke: C.blue, width: 2.6, dash: '7 7' }),
      circle(300, 392, 8, { stroke: C.gold, width: 2, fill: 'rgba(233,186,96,0.5)' }),
      label('出手', 268, 372, { size: 13, color: C.gold }),
      label('篮球划出的那条线，为什么是弯的', 400, 196, { size: 16 }),
    ], [450, 300]),

    layer([
      path('M258 436Q430 210 600 300', { stroke: C.gray, width: 2, dash: '4 6', opacity: 0.7 }),
      path('M258 436Q520 240 604 288', { stroke: C.gray, width: 2, dash: '4 6', opacity: 0.7 }),
      bigLabel('?', 690, 380, { size: 44, color: C.red }),
      label('换个力度、换个角度，全靠手感', 690, 420, { size: 15 }),
      label('投不进，也不知道为什么', 690, 444, { size: 13 }),
    ], [690, 400], { fresh: true }),

    layer([
      figure(150, 596, { pose: 'write', face: 'neutral', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      label('把它拆成两个方向', 250, 540, { size: 18, color: C.blue, anchor: 'start' }),
      label('水平：匀速　竖直：匀变速', 250, 566, { size: 14, anchor: 'start' }),
      arrow([500, 300], [590, 300], { c: C.blue, w: 2.4 }),
      label('v₀cosθ', 546, 288, { size: 14, color: C.blue }),
      arrow([500, 300], [500, 200], { c: C.gold, w: 2.4 }),
      label('v₀sinθ', 522, 236, { size: 14, color: C.gold }),
    ], [420, 480]),
  ];

  const p1 = [
    layer([
      line(180, 500, 600, 500, { w: 2, c: AXIS }),
      line(180, 520, 180, 230, { w: 2, c: AXIS }),
      path('M150 470Q330 190 560 470', { stroke: C.red, width: 3 }),
      label('x', 606, 506, { size: 14, color: C.gray, anchor: 'start' }),
      label('y', 168, 232, { size: 14, color: C.gray, anchor: 'end' }),
      circle(330, 330, 5, { stroke: C.gold, width: 2, fill: C.gold }),
      label('最高点', 330, 316, { size: 13, color: C.gold }),
      bigLabel('y = x·tanθ − gx² / (2v₀²cos²θ)', 756, 218, { size: 19 }),
      label('一条开口向下的抛物线', 756, 252, { size: 14 }),
      label('水平走多远、竖直怎么变，', 756, 276, { size: 13 }),
      label('都由这个式子一起决定', 756, 298, { size: 13 }),
    ], [380, 330]),

    layer([
      line(180, 470, 300, 470, { w: 1.2, c: C.gray, dash: '4 4' }),
      line(300, 470, 300, 384, { w: 1.2, c: C.gray, dash: '4 4' }),
      arrow([230, 470], [292, 470], { c: C.blue, w: 2, bend: 0 }),
      label('v₀cosθ · t', 240, 492, { size: 13, color: C.blue }),
      label('v₀sinθ · t', 312, 432, { size: 13, color: C.gold }),
      label('落点', 560, 486, { size: 13, color: C.red }),
      tag('消去 t', 756, 350, { w: 82, h: 28, size: 14, color: C.red }),
      arrow([756, 368], [756, 392], { c: C.red, w: 2, bend: 0 }),
      label('只含 x、y 的式子', 756, 418, { size: 14 }),
    ], [300, 440]),

    layer([
      line(640, 520, 880, 520, { w: 1.6, c: C.gray, opacity: 0.6 }),
      ...[38, 45, 60].map((deg, i) => {
        const a = (deg * Math.PI) / 180;
        const r = 120 + i * 6;
        return path(`M650 520Q${650 + r * 1.1} ${520 - Math.sin(a) * r * 1.6} ${650 + r * 1.85} 520`, {
          stroke: [C.gold, C.red, C.blue][i], width: 2,
        });
      }),
      label('38°', 668, 486, { size: 12, color: C.gold }),
      label('45°', 726, 470, { size: 12, color: C.red }),
      label('60°', 770, 482, { size: 12, color: C.blue }),
      label('45° 射得最远', 762, 552, { size: 17, color: C.red }),
      label('有空气阻力时，最佳角略小于 45°', 762, 576, { size: 12 }),
    ], [760, 520]),
  ];

  return [...p0, ...p1];
}

/* --------------------------------- 概率 --------------------------------- */
function probability() {
  const p0 = [
    layer([
      ...grid(280, 300, 120, 120, 3, 3, { c: C.blue, w: 1.6, opacity: 0.9 }),
      ...[
        [306, 326], [374, 326], [306, 366], [374, 366], [340, 400],
      ].map(([x, y]) => circle(x, y, 5, { stroke: C.red, width: 2, fill: C.red })),
      label('一颗骰子', 340, 274, { size: 15 }),
      prop('sun', 620, 420, { scale: 0.85 }),
      prop('droplet', 716, 420, { s: 1.15 }),
      label('明天会下雨吗', 668, 458, { size: 15 }),
      label('掷骰子与天气预报，问的是同一件事', 400, 196, { size: 16 }),
    ], [440, 330]),

    layer([
      bigLabel('?', 470, 300, { size: 46, color: C.red }),
      bigLabel('?', 526, 344, { size: 34, color: C.red, rot: 10 }),
      label('“大概”“也许”“说不准”', 500, 424, { size: 16 }),
      label('凭感觉，就没法比较两个选择', 500, 450, { size: 13 }),
    ], [500, 360]),

    layer([
      figure(190, 596, { pose: 'listen', face: 'smile', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      figure(300, 596, { pose: 'wave', face: 'laugh', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      label('帕斯卡', 190, 556, { size: 15 }),
      label('费马', 300, 556, { size: 15 }),
      note(500, 566, 240, 62, ['赌局没打完，钱怎么分？'], { color: C.gold, size: 14 }),
      arrow([330, 574], [382, 574], { c: C.gray, w: 1.8 }),
      label('1654 年的两封通信', 500, 604, { size: 12 }),
    ], [300, 560]),
  ];

  const p1 = [
    layer([
      ...grid(190, 210, 360, 300, 6, 6, { c: C.blue, w: 1.2, opacity: 0.5 }),
      ...[0, 1, 2, 3, 4, 5].map((i) => box(190 + i * 60, 210 + i * 50, 60, 50, {
        stroke: C.red, width: 2, fill: 'rgba(196,86,63,0.16)', anim: 'fade',
      })),
      label('两个骰子：6 × 6 = 36 种', 370, 546, { size: 16, color: C.red }),
      bigLabel('P = 6/36 = 1/6', 762, 220, { size: 24 }),
      label('点数和为 7 的那一条，正好 6 格', 762, 254, { size: 14 }),
      label('每一格，机会相等', 762, 278, { size: 13 }),
    ], [370, 360]),

    layer([
      line(640, 470, 880, 470, { w: 1.6, c: AXIS }),
      line(640, 470, 640, 352, { w: 1.6, c: AXIS }),
      path('M642 464C700 452 730 400 770 388C820 374 850 380 878 380', { stroke: C.green, width: 2.4 }),
      label('试验次数 →', 760, 492, { size: 12 }),
      label('频率', 628, 350, { size: 12, anchor: 'end' }),
      label('大数定律', 760, 420, { size: 18, color: C.green }),
      label('试验越多，频率越靠近概率', 760, 444, { size: 13 }),
    ], [760, 420]),

    layer([
      line(660, 560, 870, 560, { w: 3, c: C.gray }),
      ...[0, 0.5, 1].map((k) => line(660 + k * 210, 550, 660 + k * 210, 570, { w: 1.6, c: C.gray })),
      label('0', 660, 588, { size: 14 }),
      label('1', 870, 588, { size: 14 }),
      label('不可能', 660, 608, { size: 11 }),
      label('必然', 870, 608, { size: 11 }),
      tag('P(A) 在 0 与 1 之间', 765, 528, { w: 158, h: 28, size: 13, color: C.red }),
      label('所有结果的概率加起来 = 1', 480, 566, { size: 15, color: C.red }),
    ], [760, 560]),
  ];

  return [...p0, ...p1];
}

/* ------------------------------ 斐波那契 ------------------------------ */
function fibonacci() {
  const p0 = [
    layer([
      ground(510, 130, 700),
      prop('sun', 700, 300, { scale: 0.7 }),
      ellipse(288, 470, 34, 22, { stroke: C.gray, width: 2, fill: 'rgba(255,255,255,0.55)' }),
      circle(318, 452, 12, { stroke: C.gray, width: 2, fill: 'rgba(255,255,255,0.55)' }),
      path('M314 442q-2 -18 6 -22q2 12 4 20', { stroke: C.gray, width: 2 }),
      path('M322 442q4 -16 12 -18q-2 12 -6 20', { stroke: C.gray, width: 2 }),
      circle(324, 450, 1.6, { stroke: C.ink, width: 3 }),
      label('兔子', 288, 516, { size: 15 }),
      circle(560, 420, 34, { stroke: C.gold, width: 2, fill: 'rgba(233,186,96,0.35)' }),
      ...Array.from({ length: 20 }, (_, i) => {
        const a = (i / 20) * Math.PI * 2;
        return line(560 + Math.cos(a) * 36, 420 + Math.sin(a) * 36, 560 + Math.cos(a) * 54, 420 + Math.sin(a) * 54, { c: C.gold, w: 2.4, bend: 0 });
      }),
      line(560, 474, 560, 516, { c: C.green, w: 3 }),
      label('向日葵', 560, 540, { size: 15 }),
      label('兔子的数量、花瓣的圈数，为什么总出现同一串数', 400, 196, { size: 16 }),
    ], [420, 420]),

    layer([
      label('1, 1, 2, 3, 5, 8, 13 …', 500, 300, { size: 26, color: C.red }),
      label('数得出来，却说不清为什么', 500, 336, { size: 15 }),
      bigLabel('?', 720, 300, { size: 34, color: C.gray }),
    ], [500, 320]),

    layer([
      figure(170, 596, { pose: 'talk', talk: true, face: 'smile', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      prop('book', 268, 592, { s: 1.1 }),
      label('斐波那契 · 1202 年', 300, 556, { size: 16, color: C.blue, anchor: 'start' }),
      label('《计算之书》里的一道兔子题', 300, 580, { size: 13, anchor: 'start' }),
    ], [300, 560]),
  ];

  const p1 = [
    layer([
      box(300, 400, 60, 60, { stroke: C.blue, width: 2, fill: 'rgba(47,93,143,0.10)' }),
      box(360, 400, 60, 60, { stroke: C.blue, width: 2, fill: 'rgba(47,93,143,0.14)' }),
      box(300, 340, 120, 60, { stroke: C.gold, width: 2, fill: 'rgba(180,131,31,0.12)' }),
      box(420, 340, 120, 120, { stroke: C.green, width: 2, fill: 'rgba(44,115,85,0.10)' }),
      box(300, 460, 240, 120, { stroke: C.red, width: 2, fill: 'rgba(196,86,63,0.08)' }),
      label('1', 330, 436, { size: 15 }),
      label('1', 390, 436, { size: 15 }),
      label('2', 360, 376, { size: 15 }),
      label('3', 480, 404, { size: 15 }),
      label('5', 420, 524, { size: 15 }),
      bigLabel('aₙ = aₙ₋₁ + aₙ₋₂', 762, 220, { size: 22 }),
      label('每一项 = 前两项之和', 762, 252, { size: 14 }),
      label('正方形边长越长越大，', 762, 276, { size: 13 }),
      label('拼出来的形状却不散', 762, 298, { size: 13 }),
    ], [480, 420]),

    layer([
      path('M300 460a120 120 0 0 1 120 -120a180 180 0 0 1 180 180a240 240 0 0 1 -240 24', {
        stroke: C.red, width: 2.4, dash: '7 5',
      }),
      bigLabel('φ ≈ 1.618', 762, 370, { size: 24 }),
      label('相邻两项的比值，越往后越靠近它', 762, 402, { size: 13 }),
      label('螺线', 560, 486, { size: 14, color: C.red }),
    ], [520, 420]),

    layer([
      circle(700, 500, 40, { stroke: C.green, width: 2 }),
      ...[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i * 137.5 * Math.PI) / 180;
        return circle(700 + Math.cos(a) * (7 + i * 5.4), 500 + Math.sin(a) * (7 + i * 5.4), 4.4, { stroke: C.green, width: 1.4, fill: 'rgba(44,115,85,0.28)' });
      }),
      label('137.5°', 700, 566, { size: 15, color: C.green }),
      label('每片叶子都晒得到太阳', 700, 588, { size: 12 }),
      label('自然界最省空间的排布', 480, 566, { size: 15 }),
    ], [700, 500]),
  ];

  return [...p0, ...p1];
}

/* -------------------------------- 微积分 -------------------------------- */
function calculus() {
  const p0 = [
    layer([
      ground(516, 130, 700),
      box(300, 440, 170, 62, { stroke: C.blue, width: 2.4, fill: 'rgba(47,93,143,0.14)' }),
      circle(340, 512, 18, { stroke: C.ink, width: 2.4 }),
      circle(436, 512, 18, { stroke: C.ink, width: 2.4 }),
      path('M330 440q30 -28 62 -28q30 0 56 28', { stroke: C.blue, width: 2.2, fill: 'rgba(255,255,255,0.4)' }),
      circle(600, 350, 56, { stroke: C.gold, width: 2.6, fill: 'rgba(255,255,255,0.5)' }),
      line(600, 350, 636, 320, { c: C.red, w: 3 }),
      label('km/h', 600, 356, { size: 11 }),
      label('速度表', 600, 424, { size: 13 }),
      label('仪表上那个数字，到底是什么意思', 400, 196, { size: 16 }),
    ], [450, 430]),

    layer([
      line(640, 470, 860, 470, { w: 2, c: AXIS }),
      label('平均速度 = 总路程 ÷ 总时间', 750, 500, { size: 14 }),
      label('可它只告诉你「这一段」', 750, 524, { size: 13 }),
      bigLabel('?', 700, 300, { size: 38, color: C.red }),
      label('某一瞬间呢', 700, 340, { size: 14 }),
    ], [740, 460]),

    layer([
      figure(160, 596, { pose: 'point', face: 'neutral', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      figure(262, 596, { pose: 'think', face: 'doubt', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      label('牛顿', 160, 556, { size: 14 }),
      label('莱布尼茨', 274, 556, { size: 14 }),
      label('一个从速度出发，一个从切线出发', 390, 570, { size: 14, anchor: 'start' }),
      label('最后走到同一套语言', 390, 594, { size: 13, anchor: 'start' }),
    ], [300, 560]),
  ];

  const p1 = [
    layer([
      line(180, 500, 600, 500, { w: 2, c: AXIS }),
      line(180, 520, 180, 210, { w: 2, c: AXIS }),
      path('M180 480C300 470 380 300 500 262C560 244 580 242 600 244', { stroke: C.blue, width: 3 }),
      label('f(x)', 600, 230, { size: 14, color: C.blue, anchor: 'start' }),
      label('x', 600, 508, { size: 14, color: C.gray, anchor: 'start' }),
      line(370, 392, 570, 250, { c: C.red, w: 2.4 }),
      circle(370, 392, 6, { stroke: C.red, width: 2, fill: C.red }),
      circle(570, 250, 6, { stroke: C.red, width: 2, fill: C.red }),
      label('割线', 540, 220, { size: 14, color: C.red }),
      bigLabel('导数 = 切线斜率', 762, 230, { size: 22 }),
      label('两点越靠近，割线越像切线', 762, 264, { size: 13 }),
      label('积分 = 曲线下的面积', 762, 300, { size: 16 }),
      label('一个切开看瞬间，一个加起来看总量', 762, 326, { size: 12 }),
    ], [500, 300]),

    layer([
      line(370, 392, 420, 392, { c: C.gray, w: 1.2, dash: '4 4' }),
      line(420, 392, 420, 356, { c: C.gray, w: 1.2, dash: '4 4' }),
      label('Δx', 396, 414, { size: 13 }),
      label('Δy', 436, 372, { size: 13 }),
      bigLabel('v = ds/dt', 762, 420, { size: 24 }),
      label('Δx 越小，差商越接近瞬时', 762, 452, { size: 13 }),
      arrow([700, 396], [560, 330], { c: C.red, w: 1.8, bend: -0.14 }),
    ], [400, 400]),

    layer([
      path('M180 480C300 470 380 300 500 262C560 244 580 242 600 244L600 500L180 500Z', {
        stroke: C.gold, width: 1.6, fill: 'rgba(180,131,31,0.16)', anim: 'fade',
      }),
      label('面积', 300, 452, { size: 16, color: C.gold }),
      tag('s = ∫ v dt', 762, 520, { w: 118, h: 32, size: 15, color: C.gold }),
      label('微分与积分互为逆运算', 762, 560, { size: 15 }),
      label('这是同一件事的两个方向', 762, 584, { size: 12 }),
    ], [340, 460]),
  ];

  return [...p0, ...p1];
}

export const MATH_SCENES = {
  'math-pythagoras': pythagoras,
  'math-parabola': parabola,
  'math-probability': probability,
  'math-fibonacci': fibonacci,
  'math-calculus': calculus,
};
