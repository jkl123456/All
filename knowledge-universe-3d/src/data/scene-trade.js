/**
 * 厨师 / 建筑 / 渔民 / 农民板书（五幕）。
 * 这些行当的知识都在「手上」：锅、拱、船、田。
 * 所以画法以剖面和器物为主，右边只放两三条关键读数。
 */
import {
  C, arrow, bigLabel, box, circle, ellipse, ground, label, layer, line, mountain, note, path, poly, prop, star, tag, underline, wave, figure, arc } from './scene-kit.js';

/* ================================ 厨师 ================================ */
function maillard() {
  return [
    layer([
      ground(500, 150, 680),
      // 锅
      path('M240 460a110 40 0 0 0 220 0v-40a110 26 0 0 0 -220 0Z', { stroke: C.gray, width: 2.6, fill: 'rgba(120,120,125,0.28)' }),
      line(460, 420, 540, 420, { w: 7, c: C.gray }),
      // 牛排
      ellipse(350, 404, 62, 20, { stroke: '#8a4b32', width: 2.4, fill: 'rgba(138,75,50,0.6)' }),
      path('M300 404q50 -14 100 0', { stroke: '#5d2f1e', width: 1.6 }),
      label('牛排', 350, 470, { size: 14 }),
      label('牛排焦香的秘密', 400, 196, { size: 16 }),
    ], [400, 400]),

    layer([
      // 水煮不焦
      path('M620 430a60 24 0 0 0 120 0v-40a60 16 0 0 0 -120 0Z', { stroke: C.gray, width: 2.2, fill: 'rgba(158,207,221,0.35)' }),
      label('水煮：100℃ 封顶', 680, 490, { size: 12 }),
      bigLabel('✕', 740, 380, { size: 26, color: C.red }),
      label('没有焦褐层', 740, 350, { size: 12, color: C.red }),
      label('温度不到 140℃，反应根本不启动', 760, 540, { size: 13 }),
    ], [680, 440]),

    layer([
      // 表面要干
      wave(620, 300, 120, 5, 3, { stroke: '#4f8fb0', width: 1.6 }),
      label('表面有水 → 先蒸发，温度上不去', 660, 270, { size: 12, color: C.blue }),
      tag('先擦干，再下锅', 760, 330, { w: 150, h: 30, size: 13, color: C.gold }),
    ], [700, 300]),

    layer([
      // 风味分子
      ...[0, 1, 2, 3, 4].map((i) => circle(640 + i * 34, 580 - (i % 2) * 16, 7, { stroke: C.gold, width: 1.4, fill: 'rgba(233,186,96,0.6)' })),
      label('上百种香气分子，一起冒出来', 760, 620, { size: 12 }),
      label('氨基酸 + 还原糖 → 类黑精', 400, 566, { size: 15, color: C.red }),
    ], [400, 570]),

    layer([
      label('焦香不是「烧糊了」，是一连串化学反应的名字', 400, 604, { size: 15, color: C.red }),
    ], [400, 604]),
  ];
}

function dough() {
  return [
    layer([
      ellipse(320, 420, 130, 90, { stroke: C.gold, width: 2.6, fill: 'rgba(233,186,96,0.28)' }),
      ...[0, 1, 2, 3, 4, 5].map((i) => circle(270 + (i % 3) * 50, 396 + Math.floor(i / 3) * 46, 8 - (i % 3) * 1.4, { stroke: C.gray, width: 1.2, fill: 'rgba(255,255,255,0.7)' })),
      label('面团里的气孔', 320, 540, { size: 14 }),
      label('面包里的气孔从哪来', 400, 196, { size: 16 }),
    ], [340, 420]),

    layer([
      // 酵母
      circle(600, 300, 16, { stroke: C.green, width: 2, fill: 'rgba(125,157,97,0.3)' }),
      label('酵母', 600, 340, { size: 12, color: C.green }),
      arrow([600, 360], [500, 400], { c: C.green, w: 1.8 }),
      label('吃糖，吐出 CO₂ 和酒精', 660, 380, { size: 12 }),
    ], [620, 340]),

    layer([
      // 面筋网络
      path('M220 400q40 -30 80 0t80 0t80 0', { stroke: C.blue, width: 2, dash: '5 4' }),
      path('M220 430q40 30 80 0t80 0t80 0', { stroke: C.blue, width: 2, dash: '5 4' }),
      label('面筋把气留住', 460, 470, { size: 12, color: C.blue }),
      label('没有面筋，气就跑光了', 760, 430, { size: 13 }),
    ], [400, 440]),

    layer([
      // 温度窗口
      line(620, 560, 860, 560, { w: 1.6, c: C.gray }),
      ...[0, 1, 2, 3].map((i) => line(640 + i * 60, 550, 640 + i * 60, 570, { w: 1.4, c: C.gray })),
      label('4℃', 640, 586, { size: 11 }),
      label('25℃', 700, 586, { size: 11 }),
      label('40℃', 760, 586, { size: 11 }),
      label('55℃', 820, 586, { size: 11 }),
      box(690, 546, 80, 28, { stroke: C.green, width: 1.6, fill: 'rgba(44,115,85,0.18)' }),
      label('最适宜 25—28℃', 760, 530, { size: 12, color: C.green }),
    ], [760, 550]),

    layer([
      label('面包的气孔，是酵母的呼吸被面筋兜住了', 400, 604, { size: 15, color: C.red }),
    ], [400, 604]),
  ];
}

function ferment() {
  return [
    layer([
      ground(500, 150, 640),
      box(240, 400, 200, 100, { stroke: C.gold, width: 2.4, fill: 'rgba(233,186,96,0.22)' }),
      path('M240 400q50 -26 100 0q50 26 100 0', { stroke: C.gold, width: 2 }),
      label('面团', 340, 540, { size: 14 }),
      figure(620, 500, { pose: 'talk', talk: true, face: 'smile', hair: 'short', hairColor: 'dark', outfit: 'shirt', color: '#5b7fa6', s: 0.6 }),
      label('面团为什么会鼓起来', 400, 196, { size: 16 }),
    ], [400, 430]),

    layer([
      line(620, 240, 860, 240, { w: 1.6, c: C.gray }),
      path('M624 236C680 236 700 300 740 330C780 360 830 360 856 352', { stroke: C.red, width: 2.2 }),
      label('产气曲线', 780, 226, { size: 12, color: C.red }),
      label('温度越高，前段越快', 760, 300, { size: 12 }),
      label('但过头就塌', 760, 324, { size: 12 }),
    ], [760, 270]),

    layer([
      tag('C₆H₁₂O₆ → 2C₂H₅OH + 2CO₂', 760, 400, { w: 240, h: 30, size: 12, color: C.green }),
      label('糖 → 酒精 + 二氧化碳', 760, 444, { size: 12 }),
      label('气体撑起面筋，酒精和酸给出风味', 760, 468, { size: 12 }),
    ], [760, 430]),

    layer([
      // 冷藏慢发酵
      box(620, 520, 90, 56, { stroke: C.blue, width: 1.8, fill: 'rgba(158,207,221,0.3)' }),
      label('4℃ 冷藏一夜', 760, 548, { size: 12, color: C.blue, anchor: 'start' }),
      label('慢，但风味更复杂', 760, 574, { size: 12 }),
      arrow([330, 480], [330, 420], { c: C.gold, w: 1.8 }),
      label('鼓起来', 300, 452, { size: 12, color: C.gold }),
    ], [700, 540]),

    layer([
      label('发酵是「控制变量」：温度、糖、时间，三选二', 400, 600, { size: 15, color: C.red }),
    ], [400, 600]),
  ];
}

function emulsion() {
  return [
    layer([
      // 油水分层
      box(200, 300, 180, 200, { stroke: C.gray, width: 2.2, fill: 'rgba(255,255,255,0.4)' }),
      box(202, 300, 176, 70, { stroke: 'none', fill: 'rgba(233,186,96,0.45)', anim: 'fade' }),
      box(202, 370, 176, 128, { stroke: 'none', fill: 'rgba(158,207,221,0.35)', anim: 'fade' }),
      label('油', 290, 340, { size: 14, color: C.gold }),
      label('水', 290, 450, { size: 14, color: '#4f8fb0' }),
      label('油和水的和解', 400, 196, { size: 16 }),
    ], [300, 400]),

    layer([
      bigLabel('?', 460, 400, { size: 32, color: C.red }),
      label('怎么搅都不合', 520, 400, { size: 13 }),
      label('表面张力把油滴推在一起', 760, 300, { size: 12 }),
    ], [500, 400]),

    layer([
      // 乳化剂
      circle(500, 470, 14, { stroke: C.green, width: 2.2 }),
      path('M500 456v-14M500 484v14', { stroke: C.green, width: 2 }),
      label('乳化剂：一头亲水，一头亲油', 620, 470, { size: 12, color: C.green }),
    ], [560, 460]),

    layer([
      // 油滴变小
      ...[0, 1, 2, 3, 4, 5].map((i) => circle(280 + (i % 3) * 60, 360 + Math.floor(i / 3) * 56, 16, { stroke: C.gold, width: 1.6, fill: 'rgba(233,186,96,0.4)' })),
      label('油滴越小，体系越稳', 760, 520, { size: 12 }),
      label('过度搅拌或温度骤变会破乳', 760, 546, { size: 12 }),
    ], [400, 400]),

    layer([
      label('乳化 = 把界面变大，再用乳化剂把界面看住', 400, 600, { size: 15, color: C.red }),
    ], [400, 600]),
  ];
}

/* ================================ 建筑 ================================ */
function arch() {
  return [
    layer([
      ground(520, 130, 700),
      // 拱
      arc(400, 470, 180, Math.PI, Math.PI * 2, { stroke: C.gray, width: 10 }),
      arc(400, 470, 180, Math.PI, Math.PI * 2, { stroke: 'rgba(255,255,255,0.5)', width: 2 }),
      line(200, 470, 600, 470, { w: 2, c: C.gray }),
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const a = Math.PI + (i / 6) * Math.PI;
        return line(400 + Math.cos(a) * 168, 470 + Math.sin(a) * 168, 400 + Math.cos(a) * 192, 470 + Math.sin(a) * 192, { w: 1.4, c: C.gray, opacity: 0.5 });
      }),
      label('赵州桥为什么能站 1400 年', 400, 196, { size: 16 }),
    ], [400, 400]),

    layer([
      arrow([400, 260], [400, 300], { c: C.red, w: 2.4 }),
      label('荷载', 430, 280, { size: 12, color: C.red }),
      // 压力沿拱传
      ...[0, 1, 2, 3].map((i) => {
        const a = Math.PI + (i / 3) * Math.PI;
        return arrow([400 + Math.cos(a) * 120, 470 + Math.sin(a) * 120], [400 + Math.cos(a) * 178, 470 + Math.sin(a) * 178], { c: C.gold, w: 2, bend: 0 });
      }),
      label('拱内主要受压', 760, 300, { size: 13 }),
    ], [400, 300]),

    layer([
      arrow([200, 460], [150, 460], { c: C.red, w: 2.4 }),
      arrow([600, 460], [650, 460], { c: C.red, w: 2.4 }),
      label('拱脚要顶住向外的推力', 700, 430, { size: 12 }),
      label('基础一软，拱就张开', 700, 454, { size: 12 }),
    ], [700, 450]),

    layer([
      // 敞肩拱
      arc(520, 400, 40, Math.PI, Math.PI * 2, { stroke: C.blue, width: 3 }),
      arc(680, 400, 40, Math.PI, Math.PI * 2, { stroke: C.blue, width: 3 }),
      label('敞肩拱：减重，还能泄洪', 700, 350, { size: 12, color: C.blue }),
      tag('f / L ≈ 1/5 ～ 1/7', 760, 520, { w: 160, h: 30, size: 13, color: C.gold }),
    ], [660, 380]),

    layer([
      label('拱把「往下压」变成了「顺着弧走」', 400, 590, { size: 15, color: C.red }),
    ], [400, 590]),
  ];
}

function daylight() {
  return [
    layer([
      ground(520, 140, 700),
      // 房子剖面
      box(260, 340, 300, 180, { stroke: C.gray, width: 2.4, fill: 'rgba(255,255,255,0.45)' }),
      line(260, 340, 560, 340, { w: 3, c: C.gray }),
      line(560, 340, 640, 300, { w: 6, c: '#8a6b4f' }),
      box(540, 400, 20, 60, { stroke: C.blue, width: 2, fill: 'rgba(158,207,221,0.4)' }),
      label('南向窗', 550, 490, { size: 12, color: C.blue }),
      label('冬至那天的一束光', 400, 196, { size: 16 }),
    ], [440, 420]),

    layer([
      // 夏季太阳高
      arrow([660, 220], [560, 400], { c: C.gold, w: 2.2 }),
      label('夏至：太阳高', 660, 200, { size: 12, color: C.gold }),
      label('屋檐挡住直射', 760, 460, { size: 12 }),
      line(640, 300, 700, 300, { w: 1, c: C.gold, dash: '4 4' }),
    ], [660, 300]),

    layer([
      // 冬季太阳低
      arrow([660, 480], [540, 420], { c: C.orange || C.red, w: 2.2 }),
      label('冬至：太阳低', 660, 506, { size: 12, color: C.red }),
      label('光能照进屋子深处', 760, 520, { size: 12 }),
    ], [660, 490]),

    layer([
      tag('h = 90° − |φ − δ|', 760, 570, { w: 168, h: 30, size: 13, color: C.blue }),
      label('屋檐深度按夏季正午高度角定', 760, 610, { size: 12 }),
    ], [760, 580]),

    layer([
      label('好的朝向，是让冬天进光、夏天遮阳', 400, 590, { size: 15, color: C.red }),
    ], [400, 590]),
  ];
}

function windLoad() {
  return [
    layer([
      ground(520, 150, 620),
      box(300, 220, 110, 300, { stroke: C.gray, width: 2.2, fill: 'rgba(255,255,255,0.5)' }),
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => line(310, 250 + i * 38, 400, 250 + i * 38, { w: 1, c: C.gray, opacity: 0.3 })),
      label('摩天楼', 355, 546, { size: 13 }),
      ...[0, 1, 2].map((i) => arrow([160, 280 + i * 60], [280, 280 + i * 60], { c: C.blue, w: 2, bend: 0 })),
      label('风', 170, 250, { size: 14, color: C.blue }),
      label('摩天楼为什么会在风中摇晃', 400, 196, { size: 16 }),
    ], [360, 380]),

    layer([
      // 涡
      ...[0, 1, 2].map((i) => circle(450 + i * 26, 300 + (i % 2) * 30, 16, { stroke: C.gray, width: 1.6, dash: '4 4' })),
      label('背风面脱落的涡', 560, 260, { size: 12 }),
      label('涡激振动，会横向推楼', 760, 340, { size: 12 }),
    ], [520, 300]),

    layer([
      tag('w = ½ · ρ · v²', 760, 420, { w: 150, h: 30, size: 14, color: C.red }),
      label('风压与风速的平方成正比', 760, 462, { size: 12 }),
      label('风速翻倍，力是四倍', 760, 486, { size: 12 }),
    ], [760, 440]),

    layer([
      // 阻尼器
      circle(700, 470, 26, { stroke: C.gold, width: 2.4 }),
      line(700, 444, 700, 420, { w: 2, c: C.gold }),
      label('调谐质量阻尼器', 700, 520, { size: 12, color: C.gold }),
      label('把振动能量变成热', 760, 560, { size: 12 }),
    ], [700, 490]),

    layer([
      label('风不是「吹」，是每秒都在换方向的推力', 400, 590, { size: 15, color: C.red }),
    ], [400, 590]),
  ];
}

function truss() {
  return [
    layer([
      // 三角形
      poly([[300, 460], [420, 260], [540, 460]], { stroke: C.blue, width: 3, fill: 'rgba(47,93,143,0.08)' }),
      label('三角形为什么不塌', 400, 196, { size: 16 }),
      label('边长定了，形状就定了', 700, 300, { size: 12 }),
    ], [420, 380]),

    layer([
      // 加一根杆
      poly([[300, 460], [420, 260], [540, 460]], { stroke: C.blue, width: 2, opacity: 0.4 }),
      line(300, 460, 540, 460, { w: 2, c: C.gray, opacity: 0.5 }),
      polygonLabel(),
      arrow([420, 236], [420, 300], { c: C.red, w: 2.2 }),
      label('受压', 448, 272, { size: 12, color: C.red }),
      arrow([300, 490], [380, 490], { c: C.green, w: 2.2 }),
      label('下弦受拉', 380, 512, { size: 12, color: C.green }),
    ], [420, 400]),

    layer([
      // 桁架桥
      ...[0, 1, 2, 3, 4].map((i) => {
        const x = 560 + i * 70;
        return path(`M${x} 460L${x + 35} 400L${x + 70} 460`, { stroke: C.gray, width: 2 });
      }),
      line(560, 460, 910, 460, { w: 3, c: C.gray }),
      line(560, 400, 910, 400, { w: 2, c: C.gray }),
      label('三角形单元越多，跨得越远', 760, 520, { size: 12 }),
    ], [740, 440]),

    layer([
      // 失稳
      poly([[200, 600], [240, 520], [280, 600]], { stroke: C.red, width: 2, dash: '5 4' }),
      label('杆件失稳，不是强度不够', 760, 570, { size: 12 }),
      label('是形状先垮了', 760, 594, { size: 12 }),
    ], [300, 580]),

    layer([
      label('桁架的信任，全押在「三角形不会变形」上', 400, 590, { size: 15, color: C.red }),
    ], [400, 590]),
  ];
}

function polygonLabel() {
  return label('加一根斜杆，四边形才锁死', 620, 560, { size: 12 });
}

/* ================================ 渔民 ================================ */
function buoy() {
  return [
    layer([
      wave(140, 460, 700, 8, 5, { stroke: '#4f8fb0', width: 2.4 }),
      wave(140, 500, 700, 8, 5, { stroke: '#4f8fb0', width: 1.6, opacity: 0.5 }),
      circle(380, 420, 34, { stroke: C.red, width: 2.6, fill: 'rgba(196,86,63,0.25)' }),
      line(380, 386, 380, 340, { w: 3, c: C.gray }),
      circle(380, 334, 8, { stroke: C.gold, width: 2, fill: 'rgba(233,186,96,0.7)' }),
      label('浮标', 380, 540, { size: 14 }),
      label('海面上的小小「信号兵」', 400, 196, { size: 16 }),
    ], [380, 420]),

    layer([
      // 浮力
      arrow([380, 470], [380, 430], { c: C.blue, w: 2.4 }),
      label('F浮', 410, 456, { size: 12, color: C.blue }),
      arrow([380, 390], [380, 350], { c: C.gray, w: 2 }),
      label('G', 404, 366, { size: 12 }),
      tag('ρ海水 · g · V排 = m · g', 760, 300, { w: 204, h: 30, size: 13, color: C.blue }),
    ], [760, 320]),

    layer([
      // 空心
      circle(660, 440, 46, { stroke: C.gray, width: 2, fill: 'rgba(255,255,255,0.35)' }),
      circle(660, 440, 28, { stroke: C.gray, width: 1.2, dash: '4 4' }),
      label('空心：排水更多，浮力更大', 760, 440, { size: 12 }),
    ], [700, 440]),

    layer([
      // 锚链
      path('M380 454l10 30l-10 30l10 30', { stroke: C.gray, width: 3 }),
      label('锚链提供水平固定', 500, 520, { size: 12 }),
    ], [440, 500]),

    layer([
      label('浮标能站住，是浮力、重力、锚链三方谈好了', 400, 590, { size: 15, color: C.red }),
    ], [400, 590]),
  ];
}

function tide() {
  return [
    layer([
      wave(140, 460, 700, 8, 5, { stroke: '#4f8fb0', width: 2.4 }),
      line(140, 430, 840, 430, { w: 1.6, c: '#4f8fb0', dash: '6 5' }),
      label('高潮位', 700, 420, { size: 12, color: '#4f8fb0' }),
      circle(700, 250, 40, { stroke: C.gold, width: 2.4, fill: 'rgba(233,186,96,0.5)' }),
      label('月球', 700, 304, { size: 13, color: C.gold }),
      arrow([700, 292], [700, 420], { c: C.gold, w: 2, dash: '6 5' }),
      label('月亮拉起的海水', 400, 196, { size: 16 }),
    ], [420, 400]),

    layer([
      wave(140, 400, 700, 8, 5, { stroke: '#4f8fb0', width: 2.4, opacity: 0.7 }),
      line(140, 372, 840, 372, { w: 1.4, c: '#4f8fb0', dash: '4 5' }),
      label('低潮位', 700, 362, { size: 12, color: '#4f8fb0' }),
      label('一天两次，间隔 12 小时 25 分', 760, 520, { size: 12 }),
      label('因为月球也在绕地球跑', 760, 544, { size: 12 }),
    ], [760, 500]),

    layer([
      // 太阳引潮
      circle(860, 480, 26, { stroke: C.gold, width: 2, fill: 'rgba(233,186,96,0.35)' }),
      label('太阳', 860, 530, { size: 12 }),
      label('太阳引潮力约为月球的 46%', 620, 580, { size: 12 }),
    ], [760, 500]),

    layer([
      // 大潮小潮
      circle(240, 560, 22, { stroke: C.gold, width: 1.8 }),
      circle(300, 560, 10, { stroke: C.gold, width: 1.6, fill: 'rgba(233,186,96,0.4)' }),
      label('朔望：大潮', 380, 566, { size: 12 }),
      circle(560, 560, 16, { stroke: C.gold, width: 1.6 }),
      circle(560, 528, 10, { stroke: C.gold, width: 1.6, fill: 'rgba(233,186,96,0.4)' }),
      label('上下弦：小潮', 650, 544, { size: 12 }),
    ], [400, 555]),

    layer([
      label('潮汐是一张时间表，渔民按它出海', 400, 602, { size: 15, color: C.red }),
    ], [400, 602]),
  ];
}

function pressureFish() {
  return [
    layer([
      // 气压表
      circle(300, 340, 66, { stroke: C.gray, width: 3, fill: 'rgba(255,255,255,0.5)' }),
      line(300, 340, 336, 300, { c: C.red, w: 3 }),
      label('hPa', 300, 352, { size: 12 }),
      label('气压', 300, 420, { size: 13 }),
      label('台风来之前，鱼为什么不咬钩', 400, 196, { size: 16 }),
    ], [320, 360]),

    layer([
      // 溶氧下降
      line(560, 460, 840, 460, { w: 1.6, c: C.gray }),
      line(560, 460, 560, 320, { w: 1.6, c: C.gray }),
      path('M562 330C620 340 660 390 720 410C780 430 820 434 838 436', { stroke: C.red, width: 2.4 }),
      label('气压下降 → 溶氧下降', 700, 300, { size: 12, color: C.red }),
    ], [700, 380]),

    layer([
      // 鱼上浮
      wave(560, 520, 280, 6, 4, { stroke: '#4f8fb0', width: 1.6 }),
      path('M660 500q20 -14 42 0q-20 8 -42 0Z', { stroke: C.gray, width: 2, fill: 'rgba(120,130,140,0.4)' }),
      arrow([700, 490], [700, 440], { c: C.blue, w: 2 }),
      label('鱼浮到中上层', 760, 500, { size: 12 }),
    ], [700, 490]),

    layer([
      tag('溶氧 ∝ 气压（亨利定律）', 760, 560, { w: 210, h: 30, size: 13, color: C.blue }),
      label('气压变化往往先于天气变化', 760, 596, { size: 12 }),
    ], [760, 570]),

    layer([
      label('鱼不看天气预报，它读的是水里的氧', 400, 590, { size: 15, color: C.red }),
    ], [400, 590]),
  ];
}

function sonar() {
  return [
    layer([
      wave(140, 300, 700, 8, 5, { stroke: '#4f8fb0', width: 2 }),
      prop('boat', 260, 300, { s: 0.7 }),
      wave(560, 520, 280, 6, 4, { stroke: 'rgba(93,100,112,0.4)', width: 1.6 }),
      label('海底', 700, 560, { size: 12 }),
      label('用声音「看」海底', 400, 196, { size: 16 }),
    ], [400, 380]),

    layer([
      arc(300, 310, 60, 0.6, 2.5, { stroke: C.blue, width: 2, dash: '6 5' }),
      arc(300, 310, 100, 0.6, 2.5, { stroke: C.blue, width: 1.6, dash: '6 7', opacity: 0.6 }),
      arc(300, 310, 150, 0.6, 2.5, { stroke: C.blue, width: 1.2, dash: '5 8', opacity: 0.4 }),
      label('声波', 430, 330, { size: 12, color: C.blue }),
      arrow([440, 470], [300, 350], { c: C.gold, w: 2, bend: 0.1 }),
      label('回声', 470, 480, { size: 12, color: C.gold }),
    ], [360, 400]),

    layer([
      tag('s = v · t / 2', 760, 380, { w: 140, h: 30, size: 14, color: C.red }),
      label('v ≈ 1500 m/s（海水）', 760, 424, { size: 12 }),
      label('除以 2：声音要走一个来回', 760, 448, { size: 12 }),
    ], [760, 400]),

    layer([
      // 频率与分辨率
      ...[0, 1, 2, 3, 4].map((i) => circle(640 + i * 34, 520, 8 - i * 0.8, { stroke: C.blue, width: 1.4 })),
      label('频率越高，分辨率越高，衰减也越快', 760, 566, { size: 12 }),
    ], [720, 520]),

    layer([
      label('声呐不是听声音，是算时间', 400, 590, { size: 15, color: C.red }),
    ], [400, 590]),
  ];
}

/* ================================ 农民 ================================ */
function solarterms() {
  return [
    layer([
      circle(380, 360, 140, { stroke: C.gray, width: 1.8, dash: '6 5' }),
      circle(380, 360, 34, { stroke: C.gold, width: 2.6, fill: 'rgba(233,186,96,0.45)' }),
      ...[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return circle(380 + Math.cos(a) * 140, 360 + Math.sin(a) * 140, 14, { stroke: C.blue, width: 1.8, fill: 'rgba(158,207,221,0.4)' });
      }),
      label('把太阳一年走的路分成 24 份', 400, 196, { size: 16 }),
    ], [380, 360]),

    layer([
      tag('360° ÷ 24 = 15°', 760, 300, { w: 168, h: 30, size: 14, color: C.red }),
      label('每走 15°，就是一个节气', 760, 344, { size: 12 }),
      label('所以节气属于阳历，日期基本固定', 760, 368, { size: 12 }),
    ], [760, 320]),

    layer([
      // 二十四格
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => box(160 + i * 42, 540, 38, 30, {
        stroke: 'rgba(93,100,112,0.3)', width: 1, fill: 'rgba(255,255,255,0.45)', anim: 'fade',
      })),
      label('立春 · 雨水 · 惊蛰 · 春分 …', 400, 594, { size: 12 }),
    ], [400, 550]),

    layer([
      tag('农事跟着节气排', 760, 470, { w: 150, h: 30, size: 12, color: C.green }),
      label('不是迷信，是太阳辐射的季节节律', 760, 512, { size: 12 }),
    ], [760, 480]),

    layer([
      label('节气不是农历的发明，是太阳的高度表', 400, 600, { size: 15, color: C.red }),
    ], [400, 600]),
  ];
}

function terrace() {
  return [
    layer([
      mountain(150, 500, 560, 300, { c: C.gray, fill: 'rgba(160,150,120,0.22)' }),
      ...[0, 1, 2, 3, 4].map((i) => path(`M${190 + i * 24} ${480 - i * 44}q${150 - i * 10} -34 ${300 - i * 16} 0`, {
        stroke: '#8a7a55', width: 2.4,
      })),
      label('把山坡切成一层层台阶', 400, 196, { size: 16 }),
    ], [400, 380]),

    layer([
      // 水往下走
      arrow([330, 300], [300, 360], { c: C.blue, w: 2 }),
      arrow([300, 360], [268, 420], { c: C.blue, w: 2 }),
      label('水被一层层拦住', 460, 380, { size: 12, color: C.blue }),
    ], [400, 380]),

    layer([
      tag('沿等高线修，坡度就被切小了', 760, 320, { w: 218, h: 30, size: 12, color: C.gold }),
      label('等高线密 → 坡陡', 760, 362, { size: 12 }),
      label('等高线疏 → 坡缓', 760, 386, { size: 12 }),
    ], [760, 340]),

    layer([
      label('保水、保土、保肥', 760, 470, { size: 14, color: C.green }),
      label('层层拦蓄，形成立体的水循环', 760, 496, { size: 12 }),
      line(620, 460, 900, 460, { w: 1.2, c: C.gray, dash: '4 4' }),
    ], [760, 480]),

    layer([
      label('梯田不是风景，是把坡度改成台阶的水利工程', 400, 590, { size: 15, color: C.red }),
    ], [400, 590]),
  ];
}

function irrigation() {
  return [
    layer([
      ground(500, 150, 700),
      // 渠与田
      path('M180 380h200v120h180', { stroke: '#4f8fb0', width: 8, opacity: 0.6 }),
      box(400, 420, 240, 90, { stroke: C.gold, width: 2, fill: 'rgba(200,175,120,0.25)' }),
      ...[0, 1, 2, 3].map((i) => line(420 + i * 54, 424, 420 + i * 54, 506, { w: 1, c: C.gold, opacity: 0.4 })),
      label('水为什么会自己流进田里', 400, 196, { size: 16 }),
    ], [400, 420]),

    layer([
      arrow([300, 396], [388, 396], { c: C.blue, w: 2.4 }),
      label('水往低处走', 330, 370, { size: 12, color: C.blue }),
      tag('p = ρgh', 760, 300, { w: 110, h: 30, size: 15, color: C.red }),
      label('水位差，就是压力差', 760, 344, { size: 12 }),
    ], [760, 320]),

    layer([
      // 连通器
      path('M620 420v60h60v-60M720 420v60h60v-60', { stroke: C.gray, width: 2 }),
      line(620, 450, 680, 450, { w: 2, c: '#4f8fb0' }),
      line(720, 450, 780, 450, { w: 2, c: '#4f8fb0' }),
      label('连通器：液面相平', 700, 520, { size: 12 }),
    ], [700, 450]),

    layer([
      // 滴灌
      line(680, 570, 880, 570, { w: 3, c: C.gray }),
      ...[0, 1, 2, 3].map((i) => path(`M${700 + i * 46} 570q0 10 0 14`, { stroke: '#4f8fb0', width: 2 })),
      label('滴灌：直接送到根部，节水 30%—50%', 700, 604, { size: 12 }),
    ], [760, 580]),

    layer([
      label('灌溉的本质，是替水修一条它愿意走的路', 400, 590, { size: 15, color: C.red }),
    ], [400, 590]),
  ];
}

function rotation() {
  return [
    layer([
      ground(520, 150, 700),
      ...[0, 1, 2].map((i) => box(180 + i * 190, 400, 160, 100, { stroke: C.gold, width: 2, fill: 'rgba(200,175,120,0.18)' })),
      label('一块地为什么不能年年种同一种', 400, 196, { size: 16 }),
    ], [400, 420]),

    layer([
      // 玉米
      ...[0, 1, 2].map((i) => line(216 + i * 40, 470, 216 + i * 40, 400, { w: 3, c: '#7d9d61' })),
      ...[0, 1].map((i) => path(`M${216 + i * 40} 440q-20 -10 -24 -26q18 2 24 18`, { stroke: '#7d9d61', width: 2 })),
      label('玉米：耗氮', 240, 530, { size: 12 }),
    ], [260, 450]),

    layer([
      // 大豆 + 根瘤
      ...[0, 1, 2].map((i) => line(400 + i * 46, 470, 400 + i * 46, 410, { w: 3, c: '#5a7742' })),
      ...[0, 1, 2].map((i) => circle(400 + i * 46 + 6, 462, 5, { stroke: C.red, width: 1.4, fill: 'rgba(196,86,63,0.4)' })),
      label('大豆：根瘤固氮', 430, 530, { size: 12, color: C.green }),
      label('把氮还给土壤', 760, 360, { size: 12 }),
    ], [420, 460]),

    layer([
      // 小麦
      ...[0, 1, 2, 3].map((i) => path(`M${640 + i * 30} 470q-6 -40 4 -60`, { stroke: C.gold, width: 2.2 })),
      label('小麦：越冬', 660, 530, { size: 12, color: C.gold }),
      label('轮作打断害虫与病原的生活史', 760, 430, { size: 12 }),
      label('多样性提高系统稳定性', 760, 456, { size: 12 }),
    ], [660, 480]),

    layer([
      label('轮作不是换着种，是让地力有借有还', 400, 592, { size: 15, color: C.red }),
    ], [400, 592]),
  ];
}

export const TRADE_SCENES = {
  'chef-maillard': maillard,
  'chef-dough': dough,
  'chef-ferment': ferment,
  'chef-emulsion': emulsion,
  'architect-arch': arch,
  'architect-light': daylight,
  'architect-wind': windLoad,
  'architect-truss': truss,
  'fisher-buoy': buoy,
  'fisher-tide': tide,
  'fisher-pressure': pressureFish,
  'fisher-sonar': sonar,
  'farmer-solarterms': solarterms,
  'farmer-terrace': terrace,
  'farmer-irrigation': irrigation,
  'farmer-rotation': rotation,
};
