/**
 * 物理 / 化学 / 生物板书。
 * 六幕（数理化）：现象 → 旧办法 → 谁提出 → 核心关系 → 代入 → 边界。
 * 五幕（生物）：原料 → 条件 → 场所 → 产物 → 串联。
 * 版式仍是左图右批注；五幕的知识点用「一条链往前长」的画法。
 */
import {
  C, arrow, bigLabel, box, circle, ellipse, ground, label, layer, line, note, path, poly, prop, star, tag, underline, wave, figure } from './scene-kit.js';

const AXIS = 'rgba(93,100,112,0.55)';

/* ================================ 物理 ================================ */
function lever() {
  const p0 = [
    layer([
      ground(520, 120, 700),
      ellipse(520, 470, 74, 56, { stroke: C.gray, width: 2.6, fill: 'rgba(160,150,120,0.32)' }),
      label('巨石', 520, 552, { size: 15 }),
      line(210, 508, 470, 448, { w: 7, c: '#a9784a' }),
      figure(176, 520, { pose: 'talk', talk: true, face: 'smile', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      label('一根木棍', 330, 400, { size: 15, color: C.gold }),
      label('一个人，怎么挪动一块石头', 400, 196, { size: 16 }),
    ], [340, 460]),

    layer([
      ellipse(700, 470, 52, 38, { stroke: C.gray, width: 2.2, fill: 'rgba(160,150,120,0.24)' }),
      figure(600, 520, { pose: 'point', face: 'neutral', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      arrow([620, 470], [656, 470], { c: C.red, w: 3 }),
      bigLabel('✕', 700, 400, { size: 40, color: C.red, rot: 8 }),
      label('直接推：力气全白费', 700, 350, { size: 15, color: C.red }),
      label('石头一动不动', 700, 374, { size: 13 }),
    ], [700, 440], { fresh: true }),

    layer([
      ground(540, 120, 720),
      figure(168, 540, { pose: 'think', face: 'doubt', hair: 'bun', hairColor: 'brown', outfit: 'robe', color: '#8a6b4f', s: 0.82 }),
      label('阿基米德', 168, 574, { size: 17, color: C.blue }),
      label('“给我一个支点”', 168, 596, { size: 12.5 }),
      // 一根杆、一个支点、两段力臂
      line(430, 470, 860, 470, { w: 7, c: '#b08050' }),
      poly([[600, 470], [626, 532], [574, 532]], { stroke: C.gray, width: 2, fill: 'rgba(120,110,90,0.28)' }),
      label('支点', 600, 558, { size: 14 }),
      line(470, 506, 600, 506, { w: 1.4, c: C.red, dash: '6 5' }),
      line(600, 506, 830, 506, { w: 1.4, c: C.blue, dash: '6 5' }),
      label('短臂', 528, 530, { size: 13, color: C.red }),
      label('长臂', 716, 530, { size: 13, color: C.blue }),
      label('长臂是短臂的几倍，力就只需要几分之一', 646, 412, { size: 14, color: C.red }),
    ], [620, 440], { fresh: true }),
  ];

  const p1 = [
    layer([
      line(180, 420, 640, 420, { w: 8, c: '#b08050' }),
      poly([[400, 420], [434, 500], [366, 500]], { stroke: C.gray, width: 2.2, fill: 'rgba(120,110,90,0.26)' }),
      label('支点', 400, 528, { size: 15 }),
      ellipse(202, 388, 30, 30, { stroke: C.gray, width: 2.2, fill: 'rgba(160,150,120,0.4)' }),
      label('重物', 262, 372, { size: 15, anchor: 'start' }),
      arrow([202, 316], [202, 354], { c: C.red, w: 2.6, bend: 0 }),
      label('F₂', 176, 330, { size: 16, color: C.red }),
      arrow([600, 300], [600, 412], { c: C.blue, w: 2.6, bend: 0 }),
      label('F₁', 624, 350, { size: 16, color: C.blue }),
      line(202, 468, 400, 468, { w: 1.4, c: C.red, dash: '6 5' }),
      line(400, 468, 600, 468, { w: 1.4, c: C.blue, dash: '6 5' }),
      label('L₂', 300, 492, { size: 15, color: C.red }),
      label('L₁', 500, 492, { size: 15, color: C.blue }),
      bigLabel('F₁ · L₁ = F₂ · L₂', 760, 220, { size: 24 }),
      label('力矩 = 力 × 力臂', 760, 252, { size: 14 }),
      label('两边一平衡，石头就动了', 760, 276, { size: 13 }),
    ], [420, 470]),

    layer([
      tag('1500 N × 0.4 m', 762, 330, { w: 166, h: 30, size: 13, color: C.red }),
      label('=', 762, 366, { size: 18 }),
      tag('300 N × 2.0 m', 762, 400, { w: 166, h: 30, size: 13, color: C.blue }),
      label('压 300 N，就能撬起 1500 N', 762, 446, { size: 14 }),
    ], [760, 390]),

    layer([
      line(180, 470, 400, 470, { w: 5, c: 'rgba(169,120,74,0.4)' }),
      line(180, 520, 400, 520, { w: 5, c: '#a9784a' }),
      arrow([290, 528], [290, 512], { c: C.gray, w: 1.6 }),
      label('省了力，就得多走这一段', 430, 520, { size: 15 }),
      label('功不会凭空减少', 760, 540, { size: 16, color: C.red }),
      label('W = F · s，两边一样', 760, 566, { size: 13 }),
    ], [430, 520]),
  ];

  return [...p0, ...p1];
}

function pendulum() {
  const p0 = [
    layer([
      ground(520, 130, 680),
      circle(360, 330, 92, { stroke: C.gold, width: 3, fill: 'rgba(255,251,238,0.6)' }),
      circle(360, 330, 6, { stroke: C.ink, width: 3, fill: C.ink }),
      ...[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2;
        return line(360 + Math.cos(a) * 76, 330 + Math.sin(a) * 76, 360 + Math.cos(a) * 88, 330 + Math.sin(a) * 88, { w: 2, c: C.gray });
      }),
      line(360, 330, 414, 288, { c: C.red, w: 3 }),
      line(360, 330, 360, 420, { c: C.gray, w: 2.4 }),
      circle(360, 428, 12, { stroke: C.gold, width: 2.4, fill: 'rgba(233,186,96,0.6)' }),
      label('摆钟', 360, 552, { size: 16 }),
      label('一秒，一秒，它靠什么守住', 400, 196, { size: 16 }),
    ], [360, 340]),

    layer([
      line(620, 260, 620, 470, { w: 2, c: C.gray, opacity: 0.5 }),
      line(700, 300, 700, 470, { w: 2, c: C.gray, opacity: 0.5 }),
      line(620, 470, 660, 452, { c: C.red, w: 2.2 }),
      line(700, 470, 760, 420, { c: C.blue, w: 2.2 }),
      circle(662, 450, 9, { stroke: C.red, width: 2, fill: 'rgba(196,86,63,0.3)' }),
      circle(762, 418, 9, { stroke: C.blue, width: 2, fill: 'rgba(47,93,143,0.3)' }),
      label('小摆幅', 660, 496, { size: 13, color: C.red }),
      label('大摆幅', 762, 496, { size: 13, color: C.blue }),
      bigLabel('?', 700, 380, { size: 30, color: C.gold }),
      label('摆得远，是不是就更慢？', 700, 528, { size: 14 }),
    ], [700, 400]),

    layer([
      figure(160, 596, { pose: 'write', face: 'neutral', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      label('伽利略先发现等时性', 220, 552, { size: 15, color: C.blue, anchor: 'start' }),
      label('惠更斯把它做成钟（1656）', 220, 576, { size: 13, anchor: 'start' }),
    ], [280, 560]),
  ];

  const p1 = [
    layer([
      line(200, 240, 600, 240, { w: 4, c: C.gray }),
      line(400, 240, 400, 480, { w: 2, c: C.gray, dash: '5 5' }),
      line(400, 240, 320, 470, { c: C.blue, w: 2.4 }),
      line(400, 240, 480, 470, { c: C.blue, w: 2.4 }),
      circle(320, 474, 13, { stroke: C.blue, width: 2.4, fill: 'rgba(47,93,143,0.25)' }),
      circle(480, 474, 13, { stroke: C.blue, width: 2.4, fill: 'rgba(47,93,143,0.25)' }),
      line(400, 240, 400, 470, { w: 2.2, c: C.gold }),
      circle(400, 474, 13, { stroke: C.gold, width: 2.4, fill: 'rgba(233,186,96,0.5)' }),
      label('L', 414, 360, { size: 16, color: C.gold }),
      label('θ', 408, 270, { size: 15, color: C.red }),
      path('M400 300a60 60 0 0 0 -46 24', { stroke: C.red, width: 1.6, dash: '4 4' }),
      bigLabel('T = 2π√(L/g)', 760, 230, { size: 26 }),
      label('周期只和摆长、重力有关', 760, 264, { size: 14 }),
      label('和摆球质量无关', 760, 288, { size: 13 }),
    ], [400, 360]),

    layer([
      tag('L = 1 m → T ≈ 2 s', 760, 340, { w: 172, h: 30, size: 13, color: C.red }),
      label('所以摆长一米，正好半周期一秒', 760, 384, { size: 13 }),
      star(672, 336, { size: 15 }),
    ], [760, 350]),

    layer([
      line(200, 560, 600, 560, { w: 1.6, c: AXIS }),
      path('M210 552C260 520 320 512 400 512C480 512 540 520 590 552', { stroke: C.gray, width: 2, dash: '5 5' }),
      label('只有小角度，sinθ ≈ θ 才成立', 760, 500, { size: 14, color: C.red }),
      label('摆幅大了，钟就会走慢', 760, 526, { size: 13 }),
      label('真实摆钟要限制摆幅', 760, 550, { size: 13 }),
      tag('θ < 5°', 400, 590, { w: 86, h: 28, size: 13, color: C.blue }),
    ], [400, 540]),
  ];

  return [...p0, ...p1];
}

function refraction() {
  const p0 = [
    layer([
      ground(430, 140, 640),
      path('M260 300v190a24 24 0 0 0 24 24h92a24 24 0 0 0 24 -24V300', { stroke: C.gray, width: 2.6, fill: 'rgba(158,207,221,0.28)' }),
      path('M262 380h156', { stroke: '#4f8fb0', width: 2.4 }),
      line(300, 260, 338, 420, { w: 4, c: '#a9784a' }),
      line(338, 420, 392, 470, { w: 4, c: '#a9784a', opacity: 0.55 }),
      label('看起来断了', 452, 400, { size: 16, color: C.red }),
      arrow([444, 392], [396, 420], { c: C.red, w: 2, bend: 0.1 }),
      label('一根筷子插进水里，为什么像折断了', 400, 196, { size: 16 }),
    ], [340, 380]),

    layer([
      figure(700, 470, { pose: 'listen', face: 'smile', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      line(700, 400, 760, 470, { w: 3, c: '#a9784a' }),
      wave(650, 500, 200, 7, 4, { stroke: '#4f8fb0', width: 2 }),
      label('鱼看起来在这里', 700, 546, { size: 13, color: C.red }),
      bigLabel('✕', 748, 500, { size: 26, color: C.red }),
      label('照眼睛看到的位置叉，总是空的', 700, 576, { size: 12 }),
    ], [700, 480]),

    layer([
      figure(160, 596, { pose: 'wave', face: 'laugh', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      label('斯涅尔 · 1621 年', 226, 556, { size: 16, color: C.blue, anchor: 'start' }),
      label('入射角和折射角的正弦比，是个定值', 226, 580, { size: 13, anchor: 'start' }),
    ], [280, 560]),
  ];

  const p1 = [
    layer([
      line(160, 360, 600, 360, { w: 2.6, c: '#4f8fb0' }),
      line(380, 200, 380, 520, { w: 1.6, c: C.gray, dash: '5 5' }),
      path('M250 240L380 360', { stroke: C.gold, width: 3 }),
      path('M380 360L470 500', { stroke: C.gold, width: 3 }),
      label('空气', 220, 300, { size: 15, color: C.gray }),
      label('水', 220, 430, { size: 15, color: '#4f8fb0' }),
      label('θ₁', 300, 330, { size: 14, color: C.red }),
      label('θ₂', 402, 420, { size: 14, color: C.red }),
      bigLabel('n₁ sinθ₁ = n₂ sinθ₂', 760, 230, { size: 22 }),
      label('光在光密介质里走得更慢', 760, 264, { size: 14 }),
      label('于是它拐向法线', 760, 288, { size: 13 }),
    ], [380, 360]),

    layer([
      tag('1.00 × sin45° = 1.33 × sin32°', 760, 342, { w: 244, h: 30, size: 12, color: C.gold }),
      label('折射率越大，偏折越明显', 760, 384, { size: 13 }),
      arrow([560, 500], [480, 470], { c: C.gold, w: 2, bend: 0.1 }),
    ], [760, 360]),

    layer([
      line(160, 520, 600, 520, { w: 2.6, c: '#4f8fb0' }),
      line(380, 380, 380, 600, { w: 1.4, c: C.gray, dash: '5 5' }),
      path('M380 520L250 470', { stroke: C.red, width: 2.6 }),
      path('M380 520L520 600', { stroke: C.red, width: 2.6, dash: '6 5' }),
      label('超过临界角 → 全反射', 760, 470, { size: 14, color: C.red }),
      label('光纤、钻石的闪光都靠它', 760, 496, { size: 13 }),
      tag('临界角', 480, 496, { w: 86, h: 28, size: 13, color: C.red }),
    ], [760, 480]),
  ];

  return [...p0, ...p1];
}

function induction() {
  const p0 = [
    layer([
      ground(520, 130, 700),
      line(330, 520, 330, 280, { w: 4, c: C.gray }),
      ...[0, 1, 2].map((i) => {
        const a = (i * 2 * Math.PI) / 3 - 0.4;
        return line(330, 280, 330 + Math.cos(a) * 78, 280 + Math.sin(a) * 78, { w: 7, c: '#dfe6ea' });
      }),
      circle(330, 280, 10, { stroke: C.gray, width: 2, fill: C.gray }),
      label('风', 250, 250, { size: 16, color: C.blue }),
      arrow([250, 262], [300, 274], { c: C.blue, w: 2.2 }),
      box(560, 400, 40, 120, { stroke: C.gray, width: 2, fill: 'rgba(255,255,255,0.5)' }),
      box(610, 360, 46, 160, { stroke: C.gray, width: 2, fill: 'rgba(255,255,255,0.5)' }),
      box(666, 420, 40, 100, { stroke: C.gray, width: 2, fill: 'rgba(255,255,255,0.5)' }),
      ...[0, 1, 2].map((i) => box(566, 418 + i * 30, 28, 16, { stroke: C.gold, width: 1, fill: 'rgba(233,186,96,0.8)', anim: 'fade' })),
      ...[0, 1, 2, 3].map((i) => box(616, 376 + i * 32, 34, 16, { stroke: C.gold, width: 1, fill: 'rgba(233,186,96,0.8)', anim: 'fade' })),
      label('风点亮一座城', 470, 196, { size: 16 }),
    ], [420, 400]),

    layer([
      line(160, 360, 620, 360, { w: 2, c: C.gray, dash: '5 5' }),
      poly([[210, 300], [270, 300], [270, 350], [210, 350]], { stroke: C.red, width: 2.4, fill: 'rgba(196,86,63,0.2)' }),
      poly([[270, 300], [330, 300], [330, 350], [270, 350]], { stroke: C.blue, width: 2.4, fill: 'rgba(47,93,143,0.2)' }),
      label('N', 240, 332, { size: 15, color: C.red }),
      label('S', 300, 332, { size: 15, color: C.blue }),
      bigLabel('?', 470, 330, { size: 34, color: C.gold }),
      label('磁铁放着不动，线圈里没有电流', 470, 400, { size: 14 }),
    ], [420, 340]),

    layer([
      figure(160, 596, { pose: 'talk', talk: true, face: 'smile', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      label('法拉第 · 1831 年', 226, 556, { size: 16, color: C.blue, anchor: 'start' }),
      label('磁铁一动，导线里就有了电流', 226, 580, { size: 13, anchor: 'start' }),
    ], [280, 560]),
  ];

  const p1 = [
    layer([
      ...Array.from({ length: 6 }, (_, i) => ellipse(420 + i * 26, 340, 12, 54, { stroke: C.gold, width: 2.4 })),
      poly([[250, 310], [310, 310], [310, 370], [250, 370]], { stroke: C.red, width: 2.4, fill: 'rgba(196,86,63,0.18)' }),
      poly([[310, 310], [370, 310], [370, 370], [310, 370]], { stroke: C.blue, width: 2.4, fill: 'rgba(47,93,143,0.18)' }),
      label('N', 278, 346, { size: 14, color: C.red }),
      label('S', 340, 346, { size: 14, color: C.blue }),
      arrow([390, 340], [430, 340], { c: C.red, w: 2.4, bend: 0 }),
      label('移动', 400, 316, { size: 13, color: C.red }),
      bigLabel('E = −N · ΔΦ / Δt', 760, 230, { size: 22 }),
      label('磁通量变化，才产生电动势', 760, 264, { size: 14 }),
      label('变得越快，电动势越大', 760, 288, { size: 13 }),
    ], [430, 340]),

    layer([
      line(560, 470, 640, 470, { w: 2, c: C.gray }),
      path('M560 470h-20l8 -10M560 470h-20l8 10', { stroke: C.red, width: 2 }),
      label('感应电流', 600, 498, { size: 13, color: C.red }),
      label('方向总是「阻碍」这次变化', 760, 350, { size: 14, color: C.red }),
      tag('楞次定律', 760, 390, { w: 96, h: 30, size: 14, color: C.red }),
    ], [760, 370]),

    layer([
      tag('风能 → 机械能 → 电能', 480, 566, { w: 240, h: 32, size: 14, color: C.green }),
      label('能量只是在换形态', 760, 540, { size: 14 }),
      label('并没有凭空多出来', 760, 564, { size: 13 }),
    ], [480, 560]),
  ];

  return [...p0, ...p1];
}

/* ================================ 化学 ================================ */
function combustion() {
  const p0 = [
    layer([
      ground(520, 130, 700),
      box(280, 430, 240, 26, { stroke: C.gray, width: 2.4, fill: 'rgba(120,110,96,0.2)' }),
      path('M330 430q10 -70 40 -70q30 0 30 40q0 -56 40 -56q40 0 40 86', { stroke: C.gold, width: 2, fill: 'rgba(255,186,92,0.5)' }),
      path('M400 300a86 30 0 0 0 172 0v-46a86 26 0 0 0 -172 0Z', { stroke: C.gray, width: 2.4, fill: 'rgba(180,185,190,0.35)' }),
      label('蓝火', 350, 360, { size: 15, color: C.blue }),
      label('一簇火，烧的到底是什么', 400, 196, { size: 16 }),
    ], [420, 400]),

    layer([
      path('M640 470q-12 -66 22 -76q10 26 26 34q-6 -50 26 -64q8 48 -6 74q26 -6 30 -30q14 46 -22 62Z', {
        stroke: C.gold, width: 2, fill: 'rgba(255,196,92,0.55)',
      }),
      ...[0, 1, 2].map((i) => path(`M690 ${380 - i * 20}q-14 -30 4 -46q6 22 10 30`, { stroke: 'rgba(90,90,90,0.5)', width: 5 })),
      bigLabel('✕', 760, 420, { size: 34, color: C.red }),
      label('缺氧：黄火、黑烟', 720, 520, { size: 14, color: C.red }),
      label('还会产生一氧化碳', 720, 544, { size: 13 }),
    ], [700, 420]),

    layer([
      figure(160, 596, { pose: 'point', face: 'neutral', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      label('拉瓦锡 · 1770 年代', 226, 556, { size: 16, color: C.blue, anchor: 'start' }),
      label('物体燃烧后变重，是因为结合了氧', 226, 580, { size: 13, anchor: 'start' }),
    ], [280, 560]),
  ];

  const p1 = [
    layer([
      tag('CH₄', 220, 300, { w: 66, h: 34, size: 16, color: C.ink }),
      label('+', 276, 306, { size: 18 }),
      tag('2O₂', 330, 300, { w: 70, h: 34, size: 16, color: C.blue }),
      arrow([380, 300], [450, 300], { c: C.red, w: 2.4, bend: 0 }),
      tag('CO₂', 512, 300, { w: 70, h: 34, size: 16, color: C.gray }),
      label('+', 566, 306, { size: 18 }),
      tag('2H₂O', 620, 300, { w: 74, h: 34, size: 16, color: C.blue }),
      label('一个碳，四个氢，两个氧分子', 400, 356, { size: 15 }),
      bigLabel('CH₄ + 2O₂ → CO₂ + 2H₂O', 760, 220, { size: 19 }),
      label('反应前后，原子只是重新排列', 760, 254, { size: 13 }),
    ], [400, 300]),

    layer([
      label('进风量', 200, 470, { size: 14 }),
      line(200, 490, 420, 490, { w: 2, c: C.gray }),
      arrow([200, 490], [200, 440], { c: C.blue, w: 2.4, bend: 0 }),
      tag('氧气足 → 蓝火', 300, 430, { w: 128, h: 30, size: 13, color: C.blue }),
      tag('氧气不足 → 黄火 + CO', 300, 470, { w: 172, h: 30, size: 13, color: C.red }),
      label('颜色就是燃烧效率的仪表', 760, 480, { size: 14 }),
    ], [300, 470]),

    layer([
      label('2C + O₂ → 2CO', 400, 560, { size: 19, color: C.red }),
      label('一氧化碳无色无味，却能致命', 760, 540, { size: 14 }),
      label('所以燃气热水器必须通风', 760, 564, { size: 13 }),
    ], [400, 560]),
  ];

  return [...p0, ...p1];
}

function water() {
  const p0 = [
    layer([
      ground(520, 130, 620),
      path('M260 320v160a20 20 0 0 0 20 20h80a20 20 0 0 0 20 -20V320', { stroke: C.gray, width: 2.6, fill: 'rgba(158,207,221,0.22)' }),
      path('M262 400h118', { stroke: '#4f8fb0', width: 2.4 }),
      circle(320, 380, 8, { stroke: '#4f8fb0', width: 1.6, fill: 'rgba(158,207,221,0.9)' }),
      label('一杯水', 320, 552, { size: 15 }),
      box(470, 330, 74, 66, { stroke: '#7fb6cf', width: 2, fill: 'rgba(210,240,250,0.7)' }),
      line(470, 400, 620, 400, { w: 2.4, c: '#4f8fb0' }),
      label('冰浮在水上', 546, 440, { size: 14 }),
      label('水，看起来最普通不过', 400, 196, { size: 16 }),
    ], [400, 400]),

    layer([
      bigLabel('?', 700, 380, { size: 36, color: C.gold }),
      label('冰为什么浮着？', 700, 424, { size: 14 }),
      label('水为什么 100℃ 才开？', 700, 450, { size: 14 }),
      label('别的分子没这么「黏」', 700, 476, { size: 13 }),
    ], [700, 420]),

    layer([
      figure(160, 596, { pose: 'think', face: 'doubt', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      label('极性分子', 224, 556, { size: 16, color: C.blue, anchor: 'start' }),
      label('氧那头带负电，氢那头带正电', 224, 580, { size: 13, anchor: 'start' }),
    ], [280, 560]),
  ];

  const p1 = [
    layer([
      circle(420, 340, 30, { stroke: C.red, width: 2.6, fill: 'rgba(196,86,63,0.18)' }),
      label('O', 420, 348, { size: 18, color: C.red }),
      circle(340, 286, 17, { stroke: C.blue, width: 2.4, fill: 'rgba(47,93,143,0.16)' }),
      circle(498, 286, 17, { stroke: C.blue, width: 2.4, fill: 'rgba(47,93,143,0.16)' }),
      label('H', 340, 292, { size: 13, color: C.blue }),
      label('H', 498, 292, { size: 13, color: C.blue }),
      line(420, 340, 344, 296, { w: 2.6 }),
      line(420, 340, 494, 296, { w: 2.6 }),
      label('104.5°', 420, 400, { size: 15, color: C.gold }),
      bigLabel('H₂O · 键角 ≈ 104.5°', 760, 230, { size: 20 }),
      label('两对孤对电子，把键角压下来', 760, 264, { size: 13 }),
    ], [420, 340]),

    layer([
      ...[0, 1, 2].map((i) => {
        const x = 200 + i * 130;
        return circle(x, 500, 20, { stroke: C.blue, width: 2, fill: 'rgba(47,93,143,0.12)' });
      }),
      line(220, 500, 310, 500, { w: 1.8, c: C.gold, dash: '5 4' }),
      line(330, 500, 440, 500, { w: 1.8, c: C.gold, dash: '5 4' }),
      label('氢键', 270, 524, { size: 14, color: C.gold }),
      label('分子之间互相拉着', 760, 340, { size: 14 }),
      label('所以沸点高、表面张力大', 760, 366, { size: 13 }),
    ], [360, 500]),

    layer([
      ellipse(700, 560, 46, 14, { stroke: C.gray, width: 2, fill: 'rgba(200,190,170,0.4)' }),
      path('M654 558a46 30 0 0 1 92 0a46 12 0 0 1 -92 0Z', { stroke: '#4f8fb0', width: 2, fill: 'rgba(158,207,221,0.55)' }),
      label('一滴水能鼓成小山', 560, 566, { size: 15 }),
      label('表面张力', 560, 590, { size: 12 }),
    ], [660, 560]),
  ];

  return [...p0, ...p1];
}

function crystal() {
  const p0 = [
    layer([
      ...[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i * Math.PI) / 3;
        return line(400, 320, 400 + Math.cos(a) * 92, 320 + Math.sin(a) * 92, { w: 2.6, c: C.blue });
      }),
      ...[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i * Math.PI) / 3;
        const x = 400 + Math.cos(a) * 56;
        const y = 320 + Math.sin(a) * 56;
        return path(`M${x} ${y}l${Math.cos(a + 1) * 22} ${Math.sin(a + 1) * 22}M${x} ${y}l${Math.cos(a - 1) * 22} ${Math.sin(a - 1) * 22}`, { stroke: C.blue, width: 1.8 });
      }),
      label('雪花总是六瓣', 400, 470, { size: 16 }),
      label('天上掉下来的，为什么这么整齐', 400, 196, { size: 16 }),
    ], [400, 320]),

    layer([
      circle(700, 380, 62, { stroke: C.gold, width: 3 }),
      line(700, 442, 700, 520, { w: 6, c: C.gold }),
      ...[0, 1, 2].map((r) => [0, 1, 2].map((c) => circle(672 + c * 28, 356 + r * 24, 5, { stroke: C.blue, width: 1.6, fill: 'rgba(47,93,143,0.28)' }))),
      label('放大看：分子排成一个点阵', 700, 546, { size: 14 }),
    ], [700, 400]),

    layer([
      figure(160, 596, { pose: 'write', face: 'neutral', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      label('六方晶系', 224, 556, { size: 16, color: C.blue, anchor: 'start' }),
      label('a = b ≠ c，γ = 120°', 224, 580, { size: 13, anchor: 'start' }),
    ], [280, 560]),
  ];

  const p1 = [
    layer([
      ...[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4].map((c) => {
        const x = 220 + c * 62 + (r % 2) * 31;
        const y = 240 + r * 54;
        return circle(x, y, 7, { stroke: C.blue, width: 1.8, fill: 'rgba(47,93,143,0.2)' });
      })),
      ...[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => {
        const x = 220 + c * 62 + (r % 2) * 31;
        const y = 240 + r * 54;
        if (c < 3) return line(x + 7, y, x + 69, y, { c: C.gray, w: 1, opacity: 0.4 });
        return null;
      })),
      label('晶体 = 有规则的点阵', 400, 486, { size: 16, color: C.red }),
      bigLabel('对称，是排列的结果', 760, 230, { size: 20 }),
      label('不是外面长成六瓣，', 760, 262, { size: 13 }),
      label('而是里面本来就六重对称', 760, 286, { size: 13 }),
    ], [400, 340]),

    layer([
      tag('温度低 · 湿度大', 760, 350, { w: 168, h: 30, size: 13, color: C.blue }),
      arrow([760, 372], [760, 396], { c: C.blue, w: 2, bend: 0 }),
      label('慢生长 → 枝晶舒展', 760, 422, { size: 13 }),
      label('生长环境决定最终形态', 760, 448, { size: 13 }),
    ], [760, 400]),

    layer([
      box(640, 480, 76, 76, { stroke: C.blue, width: 2, fill: 'rgba(47,93,143,0.12)' }),
      box(716, 480, 76, 76, { stroke: C.blue, width: 2, fill: 'rgba(47,93,143,0.12)' }),
      label('同一个方向，性能不一样', 700, 590, { size: 12 }),
      label('各向异性', 540, 540, { size: 16, color: C.red }),
    ], [700, 520]),
  ];

  return [...p0, ...p1];
}

function acidbase() {
  const p0 = [
    layer([
      ground(520, 130, 620),
      path('M300 330a54 54 0 0 0 108 0v-40a54 40 0 0 0 -108 0Z', { stroke: C.gray, width: 2.4, fill: 'rgba(255,255,255,0.5)' }),
      label('胃', 354, 350, { size: 15 }),
      bigLabel('!', 380, 290, { size: 30, color: C.red }),
      box(500, 420, 84, 46, { stroke: C.gold, width: 2, fill: 'rgba(233,186,96,0.35)' }),
      label('胃药', 542, 492, { size: 14 }),
      label('胃痛的时候，药片做了什么', 400, 196, { size: 16 }),
    ], [420, 380]),

    layer([
      box(660, 320, 46, 150, { stroke: C.gray, width: 2, fill: 'rgba(255,255,255,0.6)' }),
      ...[0, 1, 2, 3, 4].map((i) => box(666, 328 + i * 27, 34, 20, { stroke: 'rgba(0,0,0,0.08)', width: 1, fill: ['#c0392b', '#e67e22', '#f1c40f', '#7d9d61', '#2c7355'][i], anim: 'fade' })),
      label('酸性 → 碱性', 700, 500, { size: 13 }),
      bigLabel('?', 800, 380, { size: 34, color: C.red }),
      label('颜色在说什么', 800, 420, { size: 14 }),
    ], [740, 400]),

    layer([
      figure(160, 596, { pose: 'listen', face: 'smile', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      label('阿伦尼乌斯 · 1884 年', 224, 556, { size: 15, color: C.blue, anchor: 'start' }),
      label('酸和碱的差别，在于水里放出什么离子', 224, 580, { size: 13, anchor: 'start' }),
    ], [280, 560]),
  ];

  const p1 = [
    layer([
      circle(300, 300, 26, { stroke: C.red, width: 2.6, fill: 'rgba(196,86,63,0.16)' }),
      label('H⁺', 300, 308, { size: 16, color: C.red }),
      label('+', 344, 308, { size: 20 }),
      circle(400, 300, 26, { stroke: C.blue, width: 2.6, fill: 'rgba(47,93,143,0.16)' }),
      label('OH⁻', 400, 308, { size: 15, color: C.blue }),
      arrow([440, 300], [496, 300], { c: C.green, w: 2.4, bend: 0 }),
      circle(550, 300, 30, { stroke: C.blue, width: 2.6, fill: 'rgba(158,207,221,0.5)' }),
      label('H₂O', 550, 308, { size: 15, color: C.blue }),
      bigLabel('H⁺ + OH⁻ → H₂O', 760, 220, { size: 22 }),
      label('中和，就是这两个离子结合', 760, 254, { size: 14 }),
    ], [400, 300]),

    layer([
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => box(180 + i * 54, 470, 54, 40, {
        stroke: 'rgba(0,0,0,0.1)', width: 1, fill: ['#c0392b', '#d35400', '#e67e22', '#f1c40f', '#7d9d61', '#2c7355', '#1f6f8a', '#2f5d8f', '#4a3f8f'][i], anim: 'fade',
      })),
      label('0', 180, 530, { size: 13 }),
      label('7', 396, 530, { size: 13 }),
      label('14', 630, 530, { size: 13 }),
      tag('pH = −lg[H⁺]', 760, 480, { w: 140, h: 30, size: 14, color: C.blue }),
      label('pH 小 1，酸性强 10 倍', 760, 524, { size: 13 }),
    ], [400, 480]),

    layer([
      label('中和会放热', 400, 580, { size: 16, color: C.red }),
      label('药不能一直吃：', 760, 566, { size: 13 }),
      label('胃酸也是防线', 760, 586, { size: 13 }),
    ], [400, 580]),
  ];

  return [...p0, ...p1];
}

function periodic() {
  const p0 = [
    layer([
      ...[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4, 5, 6, 7].map((c) => box(180 + c * 46, 240 + r * 46, 40, 40, {
        stroke: 'rgba(93,100,112,0.4)', width: 1.2, fill: 'rgba(255,255,255,0.4)', anim: 'fade',
      }))),
      box(180 + 6 * 46, 240, 40, 40, { stroke: C.red, width: 2.6, fill: 'rgba(255,255,255,0.9)' }),
      bigLabel('?', 180 + 6 * 46 + 20, 268, { size: 22, color: C.red, rot: 0 }),
      label('他给还没发现的元素，留了空格', 430, 512, { size: 15 }),
      label('一张表，能不能预测还没见过的东西', 400, 196, { size: 16 }),
    ], [420, 300]),

    layer([
      ...[0, 1, 2].map((i) => box(660 + i * 6, 330 + i * 40, 76, 34, { stroke: C.gray, width: 1.6, fill: 'rgba(255,255,255,0.6)', rot: -i * 4 })),
      bigLabel('?', 760, 290, { size: 32, color: C.gold }),
      label('零散的元素卡片', 760, 470, { size: 13 }),
      label('按什么顺序排？', 760, 440, { size: 14 }),
    ], [760, 400]),

    layer([
      figure(160, 596, { pose: 'wave', face: 'laugh', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      label('门捷列夫 · 1869 年', 226, 556, { size: 15, color: C.blue, anchor: 'start' }),
      label('按原子量排队，性质会周期性地回来', 226, 580, { size: 13, anchor: 'start' }),
    ], [280, 560]),
  ];

  const p1 = [
    layer([
      ...[0, 1, 2, 3, 4, 5, 6].map((r) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((c) => box(170 + c * 34, 210 + r * 34, 28, 28, {
        stroke: 'rgba(93,100,112,0.35)', width: 1, fill: 'rgba(255,255,255,0.45)', anim: 'fade',
      }))),
      label('7 个周期 · 18 个族', 400, 486, { size: 16, color: C.red }),
      bigLabel('周期数 = 电子层数', 760, 230, { size: 20 }),
      label('主族序数 = 最外层电子数', 760, 264, { size: 14 }),
    ], [400, 340]),

    layer([
      arrow([640, 300], [590, 300], { c: C.red, w: 2, bend: 0 }),
      label('半径变小', 660, 286, { size: 13, color: C.red }),
      label('非金属性增强 →', 660, 330, { size: 13, color: C.green }),
      label('同一周期从左到右：', 760, 380, { size: 13 }),
      label('核电荷增加，电子被拉得更紧', 760, 404, { size: 13 }),
    ], [660, 330]),

    layer([
      tag('门捷列夫预言的「类铝」= 镓', 470, 540, { w: 250, h: 32, size: 13, color: C.gold }),
      label('1875 年被发现，性质几乎全中', 760, 580, { size: 13 }),
      label('这才是周期表最厉害的地方', 470, 580, { size: 14 }),
    ], [470, 550]),
  ];

  return [...p0, ...p1];
}

/* ================================ 生物 ================================ */
function dna() {
  return [
    layer([
      figure(150, 520, { pose: 'talk', talk: true, face: 'smile', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      label('一个人', 150, 556, { size: 14 }),
      arrow([196, 470], [268, 440], { c: C.gray, w: 2 }),
      circle(330, 400, 44, { stroke: C.green, width: 2.4, fill: 'rgba(125,157,97,0.12)' }),
      label('细胞核', 330, 410, { size: 13, color: C.green }),
      arrow([370, 380], [440, 340], { c: C.gray, w: 2 }),
      path('M470 300q40 40 26 90', { stroke: C.red, width: 4 }),
      path('M500 300q-40 40 -26 90', { stroke: C.red, width: 4 }),
      label('染色体', 500, 420, { size: 14, color: C.red }),
      label('30 亿个字母，写成了你', 480, 196, { size: 16 }),
    ], [340, 380]),

    layer([
      ...Array.from({ length: 11 }, (_, i) => {
        const y = 520 - i * 26;
        const w = Math.sin((i / 10) * Math.PI * 2) * 40;
        return path(`M640 ${y}q${w} 15 ${w * 2} 0`, { stroke: C.blue, width: 2 });
      }),
      ...Array.from({ length: 11 }, (_, i) => {
        const y = 520 - i * 26;
        const w = Math.sin((i / 10) * Math.PI * 2) * 40;
        return path(`M640 ${y}q${-w} 15 ${-w * 2} 0`, { stroke: C.red, width: 2 });
      }),
      label('双螺旋', 640, 552, { size: 15 }),
      label('骨架：磷酸 + 脱氧核糖', 790, 300, { size: 13 }),
    ], [640, 400]),

    layer([
      line(700, 340, 760, 340, { w: 2, c: C.gold }),
      line(760, 340, 760, 300, { w: 2, c: C.gold }),
      label('A — T', 800, 316, { size: 14, color: C.blue }),
      label('C ≡ G', 800, 356, { size: 14, color: C.red }),
      label('两条链互相配对，', 800, 404, { size: 13 }),
      label('才敢把信息分给下一代', 800, 428, { size: 13 }),
      tag('2 个氢键 / 3 个氢键', 300, 300, { w: 178, h: 30, size: 13, color: C.gold }),
    ], [780, 380]),

    layer([
      path('M240 460h70l40 -26l40 26h70', { stroke: C.blue, width: 2.6 }),
      path('M240 500h70l40 26l40 -26h70', { stroke: C.red, width: 2.6 }),
      label('解开', 310, 520, { size: 12 }),
      label('半保留复制：', 760, 486, { size: 14 }),
      label('每条旧链都配一条新链', 760, 510, { size: 13 }),
    ], [400, 480]),

    layer([
      label('你身上的每一个细胞，', 400, 560, { size: 16 }),
      label('都带着同一份底稿', 400, 588, { size: 16, color: C.red }),
      star(700, 566, { size: 18 }),
    ], [400, 570]),
  ];
}

function cell() {
  // 细胞：不规则轮廓 + 双线膜 + 细胞器；标注全部放到右侧，避免压住画面
  const blob = 'M380 200C486 198 556 262 566 342C576 422 504 492 400 498C296 504 216 442 210 356C204 270 274 202 380 200Z';
  return [
    layer([
      path(blob, { stroke: C.green, width: 3, fill: 'rgba(125,157,97,0.10)' }),
      path('M380 214C480 212 544 272 554 344C564 416 496 480 400 486C304 492 230 436 224 358C218 278 280 216 380 214Z', {
        stroke: C.green, width: 1.4, opacity: 0.5,
      }),
      circle(390, 330, 56, { stroke: C.blue, width: 2.4, fill: 'rgba(47,93,143,0.10)' }),
      circle(374, 316, 13, { stroke: C.blue, width: 1.6, opacity: 0.7, fill: 'rgba(47,93,143,0.14)' }),
      label('核', 390, 338, { size: 15, color: C.blue }),
      label('细胞膜', 636, 262, { size: 14, color: C.green, anchor: 'start' }),
      label('膜、质、核，加一堆细胞器', 636, 286, { size: 13, anchor: 'start' }),
    ], [390, 330]),

    layer([
      // 膜上的通道蛋白
      ...[0, 1, 2, 3].map((i) => circle(330 + i * 42, 472 - i * 4, 7, { stroke: C.green, width: 1.6, fill: 'rgba(255,255,255,0.75)' })),
      arrow([300, 420], [300, 462], { c: C.gold, w: 2, bend: 0 }),
      arrow([378, 420], [378, 470], { c: C.red, w: 2, bend: 0 }),
      arrow([628, 352], [470, 466], { c: C.green, w: 1.6, bend: 0.18 }),
      label('膜上有「门」', 636, 344, { size: 14, color: C.green, anchor: 'start' }),
      label('小的放行，大的挡回去', 636, 368, { size: 13, anchor: 'start' }),
    ], [400, 460]),

    layer([
      label('核里放着 DNA', 636, 504, { size: 14, color: C.blue, anchor: 'start' }),
      label('它决定这个细胞做什么', 636, 528, { size: 13, anchor: 'start' }),
    ], [600, 520]),

    layer([
      path('M246 362q-24 16 -10 30q12 12 26 -2q12 -12 -2 -26q-8 -8 -14 -2Z', { stroke: C.red, width: 2.2, fill: 'rgba(196,86,63,0.16)' }),
      path('M250 374q10 10 16 16M260 368q10 10 16 16', { stroke: C.red, width: 1.4 }),
      path('M470 396q30 -6 44 10q10 14 -10 20q-24 6 -38 -8q-8 -12 4 -22Z', { stroke: C.red, width: 2.2, fill: 'rgba(196,86,63,0.16)' }),
      label('线粒体', 240, 420, { size: 12, color: C.red }),
      label('越费能的细胞，它越多', 636, 424, { size: 13, color: C.red, anchor: 'start' }),
      label('心肌细胞里能占三分之一', 636, 448, { size: 12, anchor: 'start' }),
      arrow([630, 430], [508, 416], { c: C.red, w: 1.4, bend: -0.06 }),
    ], [470, 400]),

    layer([
      label('结构，是为功能准备的', 400, 574, { size: 18, color: C.red }),
    ], [400, 566]),
  ];
}

function immune() {
  return [
    layer([
      circle(280, 340, 34, { stroke: C.red, width: 2.4, fill: 'rgba(196,86,63,0.16)' }),
      ...Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return line(280 + Math.cos(a) * 34, 340 + Math.sin(a) * 34, 280 + Math.cos(a) * 52, 340 + Math.sin(a) * 52, { c: C.red, w: 2 });
      }),
      label('病毒（抗原）', 280, 412, { size: 14, color: C.red }),
      arrow([334, 340], [392, 340], { c: C.gray, w: 2 }),
      figure(450, 470, { pose: 'point', face: 'neutral', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      label('身体里留下了记忆', 400, 196, { size: 16 }),
    ], [360, 380]),

    layer([
      circle(560, 330, 24, { stroke: C.green, width: 2.2, fill: 'rgba(125,157,97,0.2)' }),
      ...Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return line(560 + Math.cos(a) * 24, 330 + Math.sin(a) * 24, 560 + Math.cos(a) * 46, 330 + Math.sin(a) * 46, { c: C.green, w: 1.8 });
      }),
      label('树突细胞', 560, 402, { size: 13, color: C.green }),
      arrow([560, 306], [560, 262], { c: C.green, w: 1.8 }),
      label('去淋巴结报信', 560, 244, { size: 12, color: C.green }),
    ], [560, 330]),

    layer([
      circle(700, 330, 22, { stroke: C.blue, width: 2.2, fill: 'rgba(47,93,143,0.14)' }),
      label('B 细胞', 700, 372, { size: 13, color: C.blue }),
      path('M780 300v34M780 320l-22 -20M780 320l22 -20', { stroke: C.green, width: 3.4 }),
      label('抗体', 780, 372, { size: 13, color: C.green }),
      arrow([722, 330], [752, 316], { c: C.gray, w: 1.8 }),
      label('像钥匙插进锁里', 800, 260, { size: 13 }),
    ], [740, 330]),

    layer([
      line(200, 520, 620, 520, { w: 1.6, c: AXIS }),
      path('M210 512C300 500 340 470 400 440C470 404 540 396 610 394', { stroke: C.blue, width: 2.4 }),
      path('M210 512C280 508 300 506 330 502C380 496 420 470 460 420', { stroke: C.red, width: 2.4, dash: '6 5' }),
      label('初次应答：慢', 330, 486, { size: 12, color: C.red }),
      label('再次应答：又快又强', 500, 372, { size: 12, color: C.blue }),
    ], [400, 470]),

    layer([
      label('疫苗做的，就是提前演练一次', 400, 566, { size: 16, color: C.red }),
      label('记忆细胞在，第二次就不用从零开始', 760, 560, { size: 13 }),
      label('这就是免疫的「记住」', 760, 584, { size: 13 }),
    ], [400, 566]),
  ];
}

export const SCIENCE_SCENES = {
  'physics-lever': lever,
  'physics-pendulum': pendulum,
  'physics-refraction': refraction,
  'physics-induction': induction,
  'chemistry-combustion': combustion,
  'chemistry-water': water,
  'chemistry-crystal': crystal,
  'chemistry-acidbase': acidbase,
  'chemistry-periodic': periodic,
  'biology-dna': dna,
  'biology-cell': cell,
  'biology-immune': immune,
};
