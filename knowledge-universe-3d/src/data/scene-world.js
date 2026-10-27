/**
 * 地理 / 历史板书（五幕）。
 * 地理：现象 → 变量 → 机制 → 结果 → 一句话。
 * 历史：背景 → 转折 → 转折 → 结果 → 影响。
 * 五幕的画法：一幅主图（左），加上右侧两三条批注；最后一行落在底部。
 */
import {
  C, arc, arrow, bigLabel, box, circle, ellipse, ground, label, layer, line, mountain, note, path, poly, prop, star, tag, underline, wave, figure } from './scene-kit.js';

/* ================================ 地理 ================================ */
function seasons() {
  return [
    layer([
      // 公转轨道 + 太阳 + 四个地球
      ellipse(380, 360, 200, 104, { stroke: 'rgba(93,100,112,0.45)', width: 1.6 }),
      circle(380, 360, 34, { stroke: C.gold, width: 2.6, fill: 'rgba(233,186,96,0.55)' }),
      label('太阳', 380, 408, { size: 12, color: C.gold }),
      ...[
        [180, 360, '春分'], [380, 256, '夏至'], [580, 360, '秋分'], [380, 464, '冬至'],
      ].map(([x, y, n]) => [
        circle(x, y, 26, { stroke: C.blue, width: 2.2, fill: 'rgba(158,207,221,0.4)' }),
        line(x - 12, y - 28, x + 12, y + 28, { w: 1.6, c: C.red }),
        label(n, x, y < 360 ? y - 40 : y + 48, { size: 12 }),
      ]),
      label('地球绕太阳一圈，四季就来了', 430, 172, { size: 16 }),
    ], [380, 360]),

    layer([
      // 近日点 ≠ 更热
      circle(760, 224, 20, { stroke: C.blue, width: 2, fill: 'rgba(158,207,221,0.35)' }),
      label('1 月初 · 近日点', 760, 194, { size: 12 }),
      bigLabel('✕', 760, 268, { size: 26, color: C.red }),
      label('北半球这时候正是冬天', 760, 300, { size: 13, color: C.red }),
    ], [760, 250]),

    layer([
      // 地轴倾角
      line(650, 430, 810, 430, { w: 2, c: C.gray }),
      line(700, 350, 730, 430, { w: 1.8, c: C.red, dash: '5 4' }),
      line(700, 350, 800, 350, { w: 1.4, c: C.gold, dash: '5 4' }),
      label('23.5°', 748, 368, { size: 13, color: C.red }),
      label('地轴是斜的', 730, 460, { size: 12 }),
      label('同样的光，斜着照就更摊薄', 760, 500, { size: 13 }),
      tag('h = 90° − |φ − δ|', 760, 536, { w: 180, h: 30, size: 13, color: C.blue }),
    ], [760, 430]),

    layer([
      // 昼长夜短
      circle(690, 580, 18, { stroke: C.blue, width: 2, fill: 'rgba(158,207,221,0.4)' }),
      path('M690 562a18 18 0 0 1 0 36Z', { stroke: C.blue, width: 1, fill: 'rgba(47,93,143,0.35)' }),
      label('夏：昼长夜短', 760, 580, { size: 12, color: C.red, anchor: 'start' }),
      label('冬：反过来', 760, 602, { size: 12, anchor: 'start' }),
    ], [730, 580]),

    layer([
      label('四季不是离太阳远近造成的，是地轴斜着转', 400, 520, { size: 15, color: C.red }),
    ], [400, 520]),
  ];
}

function earthLayers() {
  return [
    layer([
      // 地球剖面（半圆）
      path('M220 480a180 180 0 0 1 360 0Z', { stroke: C.gray, width: 2.6, fill: 'rgba(111,154,176,0.16)' }),
      path('M250 480a150 150 0 0 1 300 0Z', { stroke: '#b98a53', width: 2.2, fill: 'rgba(185,138,83,0.18)' }),
      path('M320 480a80 80 0 0 1 160 0Z', { stroke: C.gold, width: 2.2, fill: 'rgba(233,186,96,0.22)' }),
      path('M370 480a30 30 0 0 1 60 0Z', { stroke: C.red, width: 2.2, fill: 'rgba(196,86,63,0.25)' }),
      line(190, 480, 610, 480, { w: 2, c: C.gray }),
      label('从地表往下，越深越热', 470, 196, { size: 16 }),
      label('地壳', 220, 506, { size: 12, color: '#6f9ab0' }),
      label('地幔', 320, 520, { size: 12, color: '#b98a53' }),
      label('地核', 400, 466, { size: 12, color: C.red }),
    ], [400, 440]),

    layer([
      label('17 km', 620, 452, { size: 12 }),
      label('2900 km', 620, 482, { size: 12 }),
      label('3480 km', 620, 512, { size: 12 }),
      line(596, 470, 640, 470, { w: 1, c: C.gray, dash: '3 3' }),
      line(640, 470, 640, 520, { w: 1.2, c: C.gray }),
      label('厚度差异，决定了谁能流动', 760, 400, { size: 13 }),
    ], [700, 470]),

    layer([
      // 软流层与岩浆
      path('M300 470q60 -22 120 0q50 18 100 -6', { stroke: C.red, width: 2.2, dash: '6 5' }),
      label('软流层', 300, 446, { size: 12, color: C.red }),
      path('M400 470q-10 -60 6 -86q10 26 4 44q14 -14 20 2q4 18 -14 40Z', { stroke: C.red, width: 1.8, fill: 'rgba(196,86,63,0.4)' }),
      label('岩浆发源地', 470, 396, { size: 12, color: C.red }),
      label('板块就在它上面滑', 760, 300, { size: 13 }),
    ], [400, 430]),

    layer([
      // 外部圈层
      arc(400, 480, 232, Math.PI, Math.PI * 2, { stroke: '#7fb6cf', width: 1.6, dash: '7 6' }),
      arc(400, 480, 258, Math.PI * 1.1, Math.PI * 1.9, { stroke: C.blue, width: 1.4, dash: '4 6' }),
      label('大气圈', 620, 250, { size: 12, color: C.blue }),
      label('水圈 / 生物圈', 620, 276, { size: 12, color: '#4f8fb0' }),
      label('外部圈层，是生命待的那一层', 760, 520, { size: 13 }),
    ], [620, 270]),

    layer([
      label('圈层不是知识清单，是一套「深与浅」的秩序', 400, 588, { size: 15, color: C.red }),
    ], [400, 588]),
  ];
}

function monsoon() {
  return [
    layer([
      // 海与陆
      box(160, 360, 220, 150, { stroke: '#4f8fb0', width: 2, fill: 'rgba(158,207,221,0.35)' }),
      label('海', 270, 446, { size: 16, color: '#4f8fb0' }),
      box(420, 330, 220, 180, { stroke: C.gold, width: 2, fill: 'rgba(200,175,120,0.25)' }),
      mountain(470, 380, 80, 46, { c: C.gray }),
      label('陆', 530, 446, { size: 16, color: C.gold }),
      prop('sun', 600, 250, { scale: 0.8 }),
      label('夏天，风为什么从海上吹来', 400, 196, { size: 16 }),
    ], [400, 380]),

    layer([
      arrow([330, 300], [470, 330], { c: C.blue, w: 3 }),
      label('夏季风', 380, 286, { size: 14, color: C.blue }),
      arrow([470, 380], [340, 350], { c: C.red, w: 2.4, opacity: 0.5 }),
      label('冬季风', 400, 374, { size: 12, color: C.red }),
      label('海的比热大，升温慢', 760, 300, { size: 13 }),
      label('陆的比热小，升温快', 760, 324, { size: 13 }),
      tag('陆上热 → 低压 → 风上岸', 760, 366, { w: 194, h: 30, size: 12, color: C.blue }),
    ], [420, 320]),

    layer([
      // 地转偏向
      line(200, 500, 560, 500, { w: 2, c: C.gray }),
      arrow([240, 500], [420, 500], { c: C.blue, w: 2.4, bend: 0 }),
      arrow([420, 500], [500, 448], { c: C.red, w: 2.4, bend: 0.2 }),
      label('本来该直着走', 300, 528, { size: 12 }),
      label('被地球转偏了', 470, 470, { size: 12, color: C.red }),
      label('北半球偏右，南半球偏左', 760, 430, { size: 13 }),
    ], [420, 490]),

    layer([
      // 雨带
      ...[0, 1, 2, 3].map((i) => line(470 + i * 6, 300 + i * 4, 462 + i * 6, 320 + i * 4, { w: 2, c: '#4f8fb0', opacity: 0.7 })),
      label('雨落在迎风坡', 560, 286, { size: 12, color: '#4f8fb0' }),
      label('东南季风带来水汽，', 760, 500, { size: 13 }),
      label('雨季就跟着风走', 760, 524, { size: 13 }),
    ], [560, 300]),

    layer([
      label('季风 = 海陆热力差 + 地转偏向力', 400, 578, { size: 15, color: C.red }),
    ], [400, 578]),
  ];
}

function plates() {
  return [
    layer([
      // 剖面
      box(150, 380, 700, 130, { stroke: 'rgba(93,100,112,0.4)', width: 1.6, fill: 'rgba(185,174,153,0.22)' }),
      poly([[150, 380], [500, 380], [520, 470], [150, 470]], { stroke: C.gray, width: 2, fill: 'rgba(160,150,120,0.35)' }),
      poly([[850, 380], [500, 380], [520, 470], [850, 470]], { stroke: C.gray, width: 2, fill: 'rgba(160,150,120,0.22)' }),
      label('板块', 300, 426, { size: 14 }),
      label('软流层', 660, 510, { size: 12 }),
      label('喜马拉雅山还在长高', 400, 196, { size: 16 }),
    ], [400, 400]),

    layer([
      arrow([300, 380], [430, 330], { c: C.red, w: 3 }),
      arrow([700, 380], [570, 330], { c: C.blue, w: 3 }),
      mountain(430, 380, 120, 90, { c: C.gray, fill: 'rgba(140,130,110,0.4)' }),
      label('碰撞挤压 → 山脉', 500, 300, { size: 13, color: C.red }),
      label('消亡边界', 760, 250, { size: 14, color: C.red }),
      label('板块相撞，地壳被抬起来', 760, 276, { size: 13 }),
    ], [500, 330]),

    layer([
      arrow([450, 470], [330, 470], { c: C.green, w: 2.4, bend: 0 }),
      arrow([560, 470], [680, 470], { c: C.green, w: 2.4, bend: 0 }),
      path('M500 470l-18 40l36 0Z', { stroke: C.green, width: 2, fill: 'rgba(44,115,85,0.3)' }),
      label('张裂 → 裂谷 / 洋中脊', 600, 546, { size: 13, color: C.green }),
      label('生长边界', 760, 380, { size: 14, color: C.green }),
    ], [560, 480]),

    layer([
      arrow([700, 300], [560, 430], { c: C.red, w: 2.6, bend: 0.1 }),
      label('俯冲', 700, 300, { size: 13, color: C.red }),
      path('M560 470q10 40 30 56', { stroke: C.red, width: 2, dash: '5 4' }),
      label('火山 / 地震', 600, 580, { size: 13, color: C.red }),
      label('边界活跃，内部稳定', 760, 520, { size: 13 }),
    ], [620, 500]),

    layer([
      label('看地图上的山脉与海沟，就能读出板块边界', 400, 578, { size: 15, color: C.red }),
    ], [400, 578]),
  ];
}

function ocean() {
  return [
    layer([
      box(140, 300, 360, 210, { stroke: C.gold, width: 2, fill: 'rgba(200,175,120,0.2)' }),
      label('大陆', 240, 420, { size: 15, color: C.gold }),
      box(500, 300, 360, 210, { stroke: '#4f8fb0', width: 2, fill: 'rgba(158,207,221,0.28)' }),
      label('大洋', 680, 420, { size: 15, color: '#4f8fb0' }),
      ...[0, 1, 2].map((i) => wave(560 + i * 80, 340 + i * 30, 90, 6, 3, { stroke: 'rgba(79,143,176,0.5)', width: 1.6 })),
      label('风把热量搬过整片海洋', 400, 196, { size: 16 }),
    ], [400, 380]),

    layer([
      arrow([250, 260], [700, 260], { c: C.gray, w: 2.4, bend: 0.04 }),
      label('盛行西风', 470, 240, { size: 13, color: C.gray }),
      path('M560 400q60 -50 130 -10q50 30 100 0', { stroke: C.blue, width: 3 }),
      arrow([760, 388], [780, 372], { c: C.blue, w: 2.2, bend: 0.1 }),
      label('表层洋流', 640, 470, { size: 13, color: C.blue }),
      label('风是主要动力', 760, 300, { size: 13 }),
    ], [640, 360]),

    layer([
      // 环流
      path('M600 380a90 60 0 1 1 60 60', { stroke: C.blue, width: 2.4, dash: '8 6' }),
      arrow([660, 372], [700, 400], { c: C.blue, w: 2, bend: 0 }),
      label('北半球顺时针', 790, 350, { size: 13, color: C.blue }),
    ], [700, 380]),

    layer([
      // 寒暖流交汇
      path('M560 470q80 -30 140 0q60 28 120 0', { stroke: C.red, width: 2.4 }),
      path('M560 500q80 30 140 0q60 -28 120 0', { stroke: C.blue, width: 2.4 }),
      label('寒暖流交汇 → 渔场', 700, 548, { size: 13, color: C.red }),
      label('上升流也把营养盐带上来', 760, 470, { size: 13 }),
    ], [700, 490]),

    layer([
      label('洋流是一条把热量从赤道送到两极的传送带', 400, 588, { size: 15, color: C.red }),
    ], [400, 588]),
  ];
}

function karst() {
  return [
    layer([
      // 石灰岩山体
      poly([[150, 470], [250, 250], [360, 360], [470, 210], [600, 380], [700, 300], [840, 470]], {
        stroke: C.gray, width: 2.4, fill: 'rgba(185,174,153,0.3)',
      }),
      line(150, 470, 840, 470, { w: 2, c: C.gray }),
      label('石灰岩', 760, 440, { size: 13 }),
      label('水把山凿空了', 400, 196, { size: 16 }),
    ], [440, 340]),

    layer([
      // 裂隙与下渗
      ...[0, 1, 2].map((i) => path(`M${480 + i * 26} 240q6 60 -4 90`, { stroke: C.blue, width: 1.6, dash: '4 4' })),
      label('雨水沿裂隙下渗', 560, 226, { size: 13, color: C.blue }),
      tag('CaCO₃ + CO₂ + H₂O ⇌ Ca(HCO₃)₂', 760, 300, { w: 250, h: 30, size: 12, color: C.gold }),
      label('溶蚀向左，沉淀向右', 760, 340, { size: 12 }),
    ], [520, 260]),

    layer([
      // 溶洞
      path('M300 470q-20 -80 60 -100q70 -20 120 40q30 36 20 60Z', { stroke: C.gray, width: 2, fill: 'rgba(255,255,255,0.5)' }),
      ...[0, 1, 2, 3].map((i) => line(330 + i * 30, 372, 332 + i * 30, 400 + i * 10, { w: 3, c: '#c9bda6' })),
      ...[0, 1, 2].map((i) => line(370 + i * 26, 470, 372 + i * 26, 436 - i * 6, { w: 3, c: '#c9bda6' })),
      label('钟乳石 / 石笋', 300, 500, { size: 12 }),
      label('洞里长出来的，也是同一条反应', 760, 400, { size: 13 }),
    ], [380, 430]),

    layer([
      // 峰林
      ...[0, 1, 2, 3].map((i) => path(`M600 ${470}q-6 -70 18 -96q24 26 18 96Z`, { stroke: C.gray, width: 2, fill: 'rgba(185,174,153,0.28)' })),
      label('峰林 / 石林', 660, 500, { size: 12 }),
      label('地表被溶蚀得只剩骨头', 760, 520, { size: 13 }),
    ], [660, 470]),

    layer([
      label('喀斯特 = 可溶的岩石 + 会流动的水 + 足够多的 CO₂', 400, 580, { size: 15, color: C.red }),
    ], [400, 580]),
  ];
}

/* ================================ 历史 ================================ */
function silkroad() {
  return [
    layer([
      // 简化的路线：长安 → 敦煌 → 撒马尔罕 → 巴格达 → 罗马
      path('M160 470C260 430 330 470 420 420C510 370 580 410 670 350C740 306 790 320 850 286', {
        stroke: 'rgba(93,100,112,0.4)', width: 3, dash: '9 7',
      }),
      ...[
        ['长安', 160, 470], ['敦煌', 340, 448], ['撒马尔罕', 520, 386], ['巴格达', 690, 340], ['罗马', 850, 286],
      ].map(([n, x, y]) => [
        circle(x, y, 7, { stroke: C.red, width: 2, fill: 'rgba(196,86,63,0.25)' }),
        label(n, x, y + 28, { size: 13 }),
      ]),
      prop('horse', 430, 540, { s: 0.7 }),
      label('一条路，把两个文明连起来', 400, 196, { size: 16 }),
    ], [400, 380]),

    layer([
      prop('gate', 200, 300, { s: 0.5 }),
      label('长安出发', 200, 336, { size: 12 }),
      line(240, 330, 300, 400, { w: 1.4, c: C.gray, dash: '4 4' }),
      label('河西走廊是咽喉', 400, 300, { size: 13 }),
      label('商队要在绿洲补给', 400, 324, { size: 12 }),
    ], [300, 320]),

    layer([
      arrow([600, 470], [760, 470], { c: C.gold, w: 2.4, bend: 0 }),
      label('丝绸 / 瓷器 / 茶', 660, 448, { size: 12, color: C.gold }),
      arrow([760, 510], [600, 510], { c: C.green, w: 2.4, bend: 0 }),
      label('葡萄 / 香料 / 佛教 / 乐舞', 680, 536, { size: 12, color: C.green }),
      label('交流一直是双向的', 640, 588, { size: 13 }),
    ], [680, 490]),

    layer([
      label('张骞两次出使西域', 786, 540, { size: 14, color: C.blue, anchor: 'start' }),
      label('前 138 年 · 前 119 年', 786, 564, { size: 12, anchor: 'start' }),
      label('他带回来的，不只是物产', 786, 588, { size: 12, anchor: 'start' }),
    ], [320, 570]),

    layer([
      label('路不只是运货的，它运的是技术与观念', 400, 598, { size: 15, color: C.red }),
    ], [400, 566]),
  ];
}

function printing() {
  return [
    layer([
      ground(500, 140, 700),
      // 字盘
      box(250, 380, 300, 120, { stroke: C.gray, width: 2.4, fill: 'rgba(200,180,140,0.3)' }),
      ...[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4, 5].map((c) => box(268 + c * 46, 396 + r * 27, 36, 20, {
        stroke: '#8a7a55', width: 1, fill: 'rgba(240,230,205,0.9)', anim: 'fade',
      }))),
      label('一格一个字', 400, 528, { size: 13 }),
      label('一个工匠，让知识跑起来', 400, 196, { size: 16 }),
    ], [400, 400]),

    layer([
      // 排版
      box(660, 330, 150, 66, { stroke: C.gray, width: 2, fill: 'rgba(120,110,96,0.2)' }),
      ...[0, 1, 2, 3].map((i) => box(668 + i * 34, 338, 26, 50, { stroke: '#8a7a55', width: 1.2, fill: 'rgba(255,248,225,0.9)', anim: 'fade' })),
      label('排版：按韵取字，松香固定', 735, 424, { size: 12 }),
      label('字是反的，印出来才是正的', 735, 448, { size: 12 }),
    ], [735, 380]),

    layer([
      // 涂墨印刷
      box(660, 500, 150, 20, { stroke: C.ink, width: 2, fill: 'rgba(60,60,60,0.65)' }),
      path('M700 500h70v-40h-70Z', { stroke: C.gray, width: 1.6, fill: 'rgba(255,255,255,0.6)' }),
      label('一版可印数百份', 735, 552, { size: 12 }),
    ], [735, 520]),

    layer([
      // 拆版
      ...[0, 1, 2].map((i) => box(220 + i * 60, 560, 34, 20, { stroke: '#8a7a55', width: 1.2, fill: 'rgba(255,248,225,0.9)', anim: 'fade' })),
      arrow([300, 546], [300, 522], { c: C.gray, w: 1.6 }),
      label('拆版，字回字架，下次再用', 560, 574, { size: 13 }),
    ], [400, 560]),

    layer([
      label('活字 = 可拆分 + 可复用', 400, 610, { size: 15, color: C.red }),
      star(680, 566, { size: 15 }),
    ], [400, 600]),
  ];
}

function zhenghe() {
  return [
    layer([
      // 宝船
      path('M280 420q20 60 100 60h120q70 0 90 -60Z', { stroke: '#8f5636', width: 2.6, fill: 'rgba(169,120,74,0.4)' }),
      line(420, 420, 420, 250, { w: 4, c: '#8f5636' }),
      path('M424 258q60 14 74 58q-40 12 -74 -6Z', { stroke: C.gold, width: 2, fill: 'rgba(233,186,96,0.4)' }),
      path('M416 300q-46 10 -58 46q30 10 58 -4Z', { stroke: C.gold, width: 2, fill: 'rgba(233,186,96,0.3)' }),
      wave(260, 492, 480, 8, 5, { stroke: '#4f8fb0', width: 2 }),
      label('两百余艘船，两万余人', 460, 548, { size: 13 }),
      label('七次远航，最远到东非', 400, 196, { size: 16 }),
    ], [420, 400]),

    layer([
      // 季风
      arrow([700, 260], [520, 300], { c: C.blue, w: 2.6, bend: 0.1 }),
      label('等季风', 700, 240, { size: 13, color: C.blue }),
      label('启航与返航，都要看风的窗口', 560, 330, { size: 13 }),
    ], [660, 270]),

    layer([
      // 航线
      path('M760 400q-60 40 -140 60q-80 20 -120 40', { stroke: C.blue, width: 2.2, dash: '8 6' }),
      label('太仓 → 占城 → 满剌加 → 古里', 640, 470, { size: 12 }),
      label('控制马六甲，就控制贸易节点', 640, 494, { size: 12 }),
    ], [700, 450]),

    layer([
      // 长颈鹿 / 朝贡
      prop('horse', 700, 580, { s: 0.6, c: '#d8b56a' }),
      label('带回来的「麒麟」', 760, 546, { size: 12 }),
      label('朝贡贸易：政治声望多，经济回报少', 760, 596, { size: 12 }),
    ], [740, 570]),

    layer([
      label('远航停下来，不是船不行，是账算不过来', 400, 590, { size: 15, color: C.red }),
    ], [400, 590]),
  ];
}

function grandcanal() {
  return [
    layer([
      // 南北运河
      path('M520 240q30 60 6 120q-24 60 10 120q30 50 6 100', { stroke: '#4f8fb0', width: 7, opacity: 0.5 }),
      ...[0, 1, 2].map((i) => path(`M${470 + i * 10} ${300 + i * 90}q80 -8 130 0`, { stroke: '#4f8fb0', width: 1.6, opacity: 0.4 })),
      label('涿郡（北）', 548, 232, { size: 12 }),
      label('余杭（南）', 548, 592, { size: 12 }),
      label('把南方的大米送到北方', 400, 196, { size: 16 }),
    ], [520, 400]),

    layer([
      ...[0, 1, 2, 3, 4].map((i) => line(150, 300 + i * 60, 880, 296 + i * 60, { w: 1.4, c: C.blue, opacity: 0.25 })),
      label('海河 · 黄河 · 淮河 · 长江 · 钱塘江', 300, 592, { size: 12 }),
      label('串起五大水系', 760, 330, { size: 13 }),
    ], [520, 400]),

    layer([
      prop('boat', 300, 380, { s: 0.9 }),
      label('漕船', 300, 416, { size: 12 }),
      label('水运成本远低于陆运', 760, 390, { size: 13 }),
      label('一船粮，抵几十辆车', 760, 414, { size: 12 }),
    ], [320, 380]),

    layer([
      figure(720, 540, { pose: 'talk', talk: true, face: 'smile', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      figure(800, 540, { pose: 'point', face: 'neutral', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      label('挖河的人', 760, 574, { size: 12 }),
      label('约 2700 km，靠人力与工期', 760, 596, { size: 12 }),
    ], [760, 540]),

    layer([
      label('运河把「工程能力」和「动员能力」绑在一起', 400, 578, { size: 15, color: C.red }),
    ], [400, 578]),
  ];
}

function reform() {
  return [
    layer([
      ground(500, 140, 700),
      prop('gate', 300, 500, { s: 0.7 }),
      line(430, 500, 560, 470, { w: 8, c: '#8f5636' }),
      figure(620, 500, { pose: 'think', face: 'doubt', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      label('南门', 300, 530, { size: 12 }),
      label('一根木头，买来的信任', 400, 196, { size: 16 }),
    ], [400, 440]),

    layer([
      tag('搬木者赏十金', 200, 330, { w: 150, h: 30, size: 13, color: C.gold }),
      label('没人信', 200, 300, { size: 12 }),
      bigLabel('→', 380, 340, { size: 24, color: C.gold }),
      tag('加到五十金', 520, 330, { w: 140, h: 30, size: 13, color: C.red }),
      label('有人试了，真给了', 640, 330, { size: 12 }),
    ], [420, 330]),

    layer([
      // 变法条款
      ...[0, 1, 2].map((i) => box(660, 400 + i * 44, 200, 34, { stroke: C.blue, width: 1.4, fill: 'rgba(255,255,255,0.55)', anim: 'fade' })),
      label('军功爵', 760, 423, { size: 12 }),
      label('什伍连坐', 760, 467, { size: 12 }),
      label('废井田 · 开阡陌', 760, 511, { size: 12 }),
      label('制度改变激励，激励改变行为', 760, 560, { size: 13 }),
    ], [760, 450]),

    layer([
      figure(200, 596, { pose: 'write', face: 'neutral', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      figure(290, 596, { pose: 'listen', face: 'smile', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      label('旧贵族反扑', 380, 570, { size: 14, color: C.red, anchor: 'start' }),
      label('商鞅被杀，法还在', 380, 594, { size: 12, anchor: 'start' }),
    ], [340, 570]),

    layer([
      label('改革者常要承担制度反噬的代价', 400, 566, { size: 15, color: C.red }),
    ], [400, 566]),
  ];
}

export const WORLD_SCENES = {
  'geography-seasons': seasons,
  'geography-earth': earthLayers,
  'geography-monsoon': monsoon,
  'geography-plates': plates,
  'geography-ocean': ocean,
  'geography-karst': karst,
  'history-silkroad': silkroad,
  'history-printing': printing,
  'history-zhenghe': zhenghe,
  'history-grandcanal': grandcanal,
  'history-reform': reform,
};
