/**
 * 语文板书（五幕：起 · 承 · 转 · 合 · 寓意）。
 * 语文的画不追求「示意图」，更像是给诗配一张小画：
 * 一个物象、一个动作、一层情绪，画到最后一幕才合成意境。
 */
import {
  C, arc, arrow, bigLabel, box, circle, ellipse, ground, label, layer, line, mountain, note, path, poly, prop, star, tag, underline, wave, figure, plate, sticker } from './scene-kit.js';

/* ------------------------------- 静夜思 ------------------------------- */
function jingye() {
  return [
    layer([
      // 窗：一格一格的木框，月亮在外面
      line(470, 400, 470, 210, { w: 3.4, c: '#8a6b4f' }),
      line(470, 210, 700, 210, { w: 3.4, c: '#8a6b4f' }),
      line(470, 400, 700, 400, { w: 3.4, c: '#8a6b4f' }),
      line(700, 210, 700, 400, { w: 3.4, c: '#8a6b4f' }),
      line(585, 210, 585, 400, { w: 2, c: '#8a6b4f' }),
      line(470, 305, 700, 305, { w: 2, c: '#8a6b4f' }),
      circle(640, 262, 26, { stroke: C.gold, width: 2, fill: 'rgba(233,186,96,0.55)' }),
      label('明月', 640, 196, { size: 13, color: C.gold }),
      // 月光斜进屋
      path('M470 240L250 500L470 500L700 240Z', { stroke: 'none', fill: 'rgba(233,224,190,0.45)', anim: 'fade' }),
      label('二十个字，一场失眠', 400, 196, { size: 16 }),
    ], [560, 300]),

    layer([
      // 床
      box(160, 430, 300, 66, { stroke: C.gray, width: 2.4, fill: 'rgba(255,255,255,0.5)' }),
      line(160, 466, 460, 466, { w: 1.4, c: C.gray, opacity: 0.5 }),
      line(160, 472, 160, 500, { w: 3, c: '#8a6b4f' }),
      line(460, 472, 460, 500, { w: 3, c: '#8a6b4f' }),
      label('床前', 200, 548, { size: 14 }),
      // 霜一样的光斑
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => circle(260 + i * 26, 556 + (i % 2) * 8, 3, { stroke: 'rgba(120,140,160,0.4)', width: 1, fill: 'rgba(255,255,255,0.9)' })),
      label('地上像结了一层霜', 360, 520, { size: 13, color: '#4f8fb0' }),
    ], [300, 500]),

    layer([
      // 举头
      figure(506, 560, { pose: 'stand', face: 'neutral', hair: 'bun', hairColor: 'brown', outfit: 'robe', color: '#6b7f9e', s: 0.9 }),
      arrow([524, 462], [604, 334], { c: C.gold, w: 2.2, bend: -0.1 }),
      label('举头', 566, 392, { size: 14, color: C.gold }),
    ], [400, 420]),

    layer([
      arrow([490, 470], [490, 512], { c: C.gray, w: 2, bend: 0 }),
      label('低头', 452, 500, { size: 14 }),
      mountain(120, 590, 100, 44, { c: C.gray, opacity: 0.45 }),
      label('故乡', 150, 570, { size: 12, color: C.red }),
      label('一抬头一低头，空间就开了又合', 700, 540, { size: 13 }),
    ], [320, 460]),

    layer([
      label('物象 → 错觉 → 动作 → 情感', 500, 566, { size: 16, color: C.red }),
      underline(410, 576, 180, { c: C.red, w: 2 }),
    ], [500, 566]),
  ];
}

/* ------------------------------ 守株待兔 ------------------------------ */
function shouzhu() {
  // 参考图自上而下四行，一行一幕；翻页才出现下一行
  const cut = (n) => `assets/boards/cut/${n}.png`;
  const RATIO = { row1: 2.629, row2: 3.034, row3: 2.852, row4: 2.659 };
  const X = 104;
  const W = 792;
  const BOTTOM = 452;

  const rowLayer = (name, no, title, lines, tip, hint) => {
    // 每行按自己的比例缩放到这条「图带」里，宽高都不越界
    const h = Math.min(328, Math.round(W / RATIO[name]));
    const w = Math.round(h * RATIO[name]);
    const x = X + Math.round((W - w) / 2);
    const y = BOTTOM - h;
    return layer([
      label(`${no} · ${title}`, X, 96, { size: 24, color: C.blue, anchor: 'start' }),
      label(`第 ${['一', '二', '三', '四'].indexOf(no) + 1} 行 / 共 4 行`, 896, 92, {
        size: 12, color: '#8a7a62', anchor: 'end',
      }),
      sticker(x, y, w, h, cut(name)),
      ...lines.map((t, i) => label(t, X, 500 + i * 28, { size: 15, anchor: 'start' })),
      label(tip, X, 578, { size: 15, color: C.red, anchor: 'start' }),
      ...(hint ? [
        arrow([X - 42, 300], [X - 42, 396], { c: C.blue, w: 2.6, bend: -0.3, opacity: 0.55 }),
        label(hint, X - 42, 424, { size: 11, color: C.blue }),
      ] : []),
    ], [X + W / 2, y + h / 2], { fresh: true });
  };

  return [
    rowLayer('row1', '一', '耕者', [
      '宋国有个耕田的人，每天在田里耕作；',
      '田边立着一截树桩。',
    ], '走：跑。折颈：折断脖子。株：露出地面的树桩。', '往下'),

    rowLayer('row2', '二', '兔走触株', [
      '一只兔子跑得太快，撞在树桩上，折断了脖子。',
      '他没花一点力气，就捡到一只兔子。',
    ], '兔子是自己撞死的，不是等来的。', '往下'),

    rowLayer('row3', '三', '释耒守株', [
      '他放下锄头，不再耕地，天天守在树桩旁边。',
      '冀：希望。他希望再捡到一只。',
    ], '他把一次偶然，当成了可以重复的规律。', '往下'),

    rowLayer('row4', '四', '兔不可复得', [
      '兔子再没出现，田也荒了。',
      '兔不可复得，而身为宋国笑。',
    ], '把偶然当必然，代价是整块田。', null),

    // 五 · 寓意
    layer([
      label('五 · 寓意', 104, 96, { size: 24, color: C.blue, anchor: 'start' }),
      label('四行连起来，是一个完整的故事', 104, 132, { size: 13, color: '#8a7a62', anchor: 'start' }),
      ...[
        ['一 · 耕者', '人、田、桩', C.blue],
        ['二 · 兔走触株', '偶然捡到一只兔子', C.red],
        ['三 · 释耒守株', '把偶然当规律', C.gold],
        ['四 · 兔不可复得', '田荒了，身为宋国笑', C.red],
      ].flatMap(([t, d, c], i) => [
        label(t, 104, 196 + i * 58, { size: 17, color: c, anchor: 'start' }),
        label(d, 360, 196 + i * 58, { size: 14, anchor: 'start' }),
        line(104, 216 + i * 58, 880, 216 + i * 58, { w: 1, c: 'rgba(93,100,112,0.18)', bend: 0 }),
      ]),
      line(104, 448, 880, 448, { w: 1.6, c: C.red, opacity: 0.4, bend: 0 }),
      label('寓言 = 一个极端的故事 + 一句没写出来的道理', 104, 486, { size: 16, color: C.gold, anchor: 'start' }),
      label('把偶然当必然，只会错失机会。', 104, 528, { size: 24, color: C.red, anchor: 'start' }),
    ], [480, 380], { fresh: true }),
  ];
}

/* -------------------------------- 汉字 -------------------------------- */
function hanzi() {
  const glyph = (x, y, s, t, color) => label(t, x, y, { size: s, color, anchor: 'middle' });
  return [
    layer([
      // 甲骨
      path('M250 250q70 -24 156 0v150q-78 24 -156 0Z', { stroke: C.gray, width: 2.4, fill: 'rgba(240,232,210,0.7)' }),
      ...[0, 1, 2].map((i) => line(288 + i * 34, 280, 288 + i * 34, 392, { w: 1, c: 'rgba(120,104,78,0.3)' })),
      glyph(328, 348, 44, '日', C.red),
      label('甲骨上刻下的，本来就是画', 470, 300, { size: 14 }),
      label('从甲骨文到今天', 400, 196, { size: 16 }),
    ], [330, 320]),

    layer([
      // 字形演变
      ...[
        ['日', '甲骨'], ['日', '金文'], ['日', '小篆'], ['日', '隶书'], ['日', '楷书'],
      ].map(([g, n], i) => [
        box(160 + i * 96, 420, 78, 70, { stroke: 'rgba(93,100,112,0.35)', width: 1.2, fill: 'rgba(255,255,255,0.45)', anim: 'fade' }),
        glyph(199 + i * 96, 468, 36 - i * 2, g, i < 2 ? C.gold : C.blue),
        label(n, 199 + i * 96, 514, { size: 11 }),
      ]),
      arrow([150, 530], [470, 530], { c: C.gray, w: 1.4 }),
      label('越写越方，越写越快', 520, 536, { size: 13, anchor: 'start' }),
    ], [400, 500]),

    layer([
      // 造字法：象形 / 指事 / 会意
      tag('象形', 660, 250, { w: 72, h: 28, size: 13, color: C.gold }),
      glyph(760, 258, 30, '月', C.gold),
      label('画出轮廓', 810, 264, { size: 11, anchor: 'start' }),
      tag('指事', 660, 310, { w: 72, h: 28, size: 13, color: C.blue }),
      glyph(760, 318, 30, '上', C.blue),
      label('加个符号指位置', 810, 324, { size: 11, anchor: 'start' }),
      tag('会意', 660, 370, { w: 72, h: 28, size: 13, color: C.green }),
      glyph(760, 378, 30, '休', C.green),
      label('人靠着树，就是休息', 810, 384, { size: 11, anchor: 'start' }),
    ], [760, 320]),

    layer([
      // 形声
      tag('形声：形旁表义 + 声旁表音', 760, 450, { w: 238, h: 30, size: 13, color: C.red }),
      glyph(700, 512, 40, '河', C.blue),
      label('氵 = 水', 650, 546, { size: 12, color: C.blue }),
      label('可 = 音', 754, 546, { size: 12, color: C.gold }),
    ], [720, 510]),

    layer([
      label('看一个字，先看它画的是形，还是借的音', 400, 580, { size: 15, color: C.red }),
    ], [400, 404]),
  ];
}

/* ----------------------------- 登鹳雀楼 ----------------------------- */
function dengguanque() {
  return [
    layer([
      ground(520, 140, 700),
      prop('towerPavilion', 330, 520, { s: 0.9 }),
      label('鹳雀楼', 330, 556, { size: 14 }),
      circle(600, 300, 34, { stroke: C.gold, width: 2.2, fill: 'rgba(233,186,96,0.45)' }),
      label('白日', 600, 360, { size: 13, color: C.gold }),
      label('更上一层楼', 400, 196, { size: 16 }),
    ], [400, 400]),

    layer([
      // 白日依山尽
      mountain(470, 480, 260, 150, { c: C.gray, fill: 'rgba(140,130,110,0.22)' }),
      circle(620, 390, 26, { stroke: C.gold, width: 2, fill: 'rgba(233,186,96,0.5)' }),
      arrow([620, 364], [600, 420], { c: C.gold, w: 2, bend: 0 }),
      label('依山尽', 700, 400, { size: 13, color: C.gold }),
    ], [600, 400]),

    layer([
      // 黄河入海流
      path('M150 500q120 -40 220 0q100 40 200 0q80 -32 160 0', { stroke: '#4f8fb0', width: 4 }),
      arrow([700, 486], [780, 466], { c: '#4f8fb0', w: 2.4, bend: 0.1 }),
      label('黄河', 260, 470, { size: 13, color: '#4f8fb0' }),
      label('入海流', 720, 520, { size: 13, color: '#4f8fb0' }),
    ], [400, 500]),

    layer([
      // 更上一层
      line(300, 400, 360, 400, { w: 1.6, c: C.red, dash: '4 4' }),
      line(330, 400, 330, 240, { w: 1.6, c: C.red, dash: '4 4' }),
      arrow([330, 400], [330, 246], { c: C.red, w: 2.2, bend: 0 }),
      label('更上一层', 386, 296, { size: 14, color: C.red }),
      label('空间层层递进：一楼 → 千里 → 更上', 760, 520, { size: 13 }),
    ], [330, 320]),

    layer([
      label('由景入理：看得远，是因为站得高', 400, 576, { size: 15, color: C.red }),
    ], [400, 596]),
  ];
}

/* ------------------------------- 诗歌意象 ------------------------------- */
function poetry() {
  return [
    layer([
      // 月落、乌啼、霜
      circle(230, 250, 34, { stroke: C.gold, width: 2, fill: 'rgba(233,186,96,0.35)' }),
      line(196, 286, 264, 218, { w: 1.4, c: C.gray, dash: '4 4' }),
      label('月落', 230, 314, { size: 13, color: C.gold }),
      // 乌
      path('M420 250q14 -10 26 0q-8 6 -14 6q8 10 0 16q-10 -4 -16 -12q-4 -6 4 -10Z', { stroke: C.gray, width: 2, fill: 'rgba(90,90,90,0.5)' }),
      label('乌啼', 430, 300, { size: 13 }),
      // 霜
      ...[0, 1, 2, 3, 4].map((i) => line(320 + i * 18, 360, 328 + i * 18, 380, { w: 1.2, c: '#7fb6cf', opacity: 0.6 })),
      label('霜满天', 380, 404, { size: 13, color: '#4f8fb0' }),
      label('月落乌啼霜满天', 400, 196, { size: 16 }),
    ], [400, 300]),

    layer([
      // 江枫渔火
      line(140, 500, 700, 500, { w: 2.4, c: '#4f8fb0' }),
      ...[0, 1, 2].map((i) => path(`M${220 + i * 150} 500q-8 -50 8 -70q16 20 8 70`, { stroke: '#8a6b4f', width: 2, fill: 'rgba(138,107,79,0.2)' })),
      label('江枫', 260, 532, { size: 13, color: '#8a6b4f' }),
      prop('boat', 560, 496, { s: 0.6 }),
      circle(600, 470, 7, { stroke: C.gold, width: 1.6, fill: 'rgba(233,186,96,0.85)' }),
      label('渔火', 620, 532, { size: 13, color: C.gold }),
    ], [400, 500]),

    layer([
      // 寒山寺 + 钟声
      prop('gate', 760, 470, { s: 0.46 }),
      label('寒山寺', 760, 504, { size: 13 }),
      ...[0, 1, 2].map((i) => arc(760, 470, 60 + i * 26, -2.6, -0.5, { stroke: 'rgba(93,100,112,0.4)', width: 1.4, dash: '6 6' })),
      label('夜半钟声', 760, 400, { size: 13, color: C.red }),
    ], [760, 460]),

    layer([
      // 意象群
      ...[
        ['月', 200, 542], ['乌', 300, 542], ['霜', 400, 542], ['枫', 500, 542], ['火', 600, 542], ['钟', 700, 542],
      ].map(([t, x, y]) => [
        circle(x, y, 22, { stroke: C.blue, width: 1.6, fill: 'rgba(255,255,255,0.5)' }),
        label(t, x, y + 6, { size: 14 }),
      ]),
      label('意象 = 物象 + 情感', 400, 584, { size: 13, color: C.red }),
    ], [400, 560]),

    layer([
      label('意境不是一件事，是一群东西一起发冷', 400, 440, { size: 15, color: C.red }),
    ], [400, 452]),
  ];
}

/* ------------------------------ 刻舟求剑 ------------------------------ */
function kezhou() {
  return [
    layer([
      line(140, 480, 840, 480, { w: 2, c: '#4f8fb0' }),
      ...[0, 1, 2, 3].map((i) => wave(180 + i * 160, 500 + (i % 2) * 14, 140, 6, 3, { stroke: 'rgba(79,143,176,0.5)', width: 1.6 })),
      prop('boat', 420, 470, { s: 1.0 }),
      figure(420, 438, { pose: 'point', face: 'neutral', hair: 'bun', hairColor: 'brown', outfit: 'robe', color: '#7f9bb5', s: 0.64 }),
      label('船在走', 420, 540, { size: 14 }),
      label('剑沉了，船还在走', 400, 196, { size: 16 }),
    ], [420, 440]),

    layer([
      // 剑落水
      line(470, 330, 470, 420, { w: 3, c: '#9aa7b4' }),
      line(458, 420, 482, 420, { w: 2, c: '#9aa7b4' }),
      circle(470, 470, 12, { stroke: '#4f8fb0', width: 1.6, fill: 'none' }),
      circle(470, 470, 22, { stroke: '#4f8fb0', width: 1.2, opacity: 0.5 }),
      label('剑落水', 540, 430, { size: 13, color: C.red }),
    ], [470, 440]),

    layer([
      // 刻记号
      line(392, 452, 452, 452, { w: 2, c: C.red }),
      path('M400 444l8 16M416 444l8 16', { stroke: C.red, width: 1.6 }),
      label('刻个记号', 470, 396, { size: 13, color: C.red }),
      arrow([462, 404], [438, 442], { c: C.red, w: 1.6, bend: 0.1 }),
    ], [420, 420]),

    layer([
      // 船走了
      prop('boat', 700, 470, { s: 0.8, opacity: 0.4 }),
      arrow([700, 440], [800, 440], { c: C.gray, w: 2.4, bend: 0 }),
      line(600, 452, 660, 452, { w: 2, c: C.red }),
      label('记号留在这里', 600, 500, { size: 13, color: C.red }),
      label('船早就不在这了', 760, 520, { size: 13 }),
    ], [700, 460]),

    layer([
      label('参照系选错了，结论必然错', 400, 574, { size: 15, color: C.red }),
    ], [400, 592]),
  ];
}

/* -------------------------------- 对仗 -------------------------------- */
function couplet() {
  return [
    layer([
      // 门 + 两条红联
      prop('gate', 380, 520, { s: 0.95 }),
      box(250, 300, 40, 180, { stroke: C.red, width: 2, fill: 'rgba(196,86,63,0.18)' }),
      box(470, 300, 40, 180, { stroke: C.red, width: 2, fill: 'rgba(196,86,63,0.18)' }),
      label('上联', 270, 500, { size: 12, color: C.red }),
      label('下联', 490, 500, { size: 12, color: C.red }),
      label('两句诗里的对称美学', 400, 196, { size: 16 }),
    ], [400, 400]),

    layer([
      // 黄鹂鸣翠柳
      path('M600 420q-16 -70 10 -110', { stroke: '#8a6b4f', width: 3 }),
      ...[0, 1, 2, 3, 4].map((i) => path(`M${596 + i * 4} ${360 - i * 22}q-26 -6 -34 -22`, { stroke: C.green, width: 2 })),
      circle(660, 330, 10, { stroke: C.gold, width: 2, fill: 'rgba(233,186,96,0.5)' }),
      circle(700, 356, 9, { stroke: C.gold, width: 2, fill: 'rgba(233,186,96,0.4)' }),
      label('两个黄鹂鸣翠柳', 700, 410, { size: 13 }),
    ], [660, 360]),

    layer([
      // 白鹭上青天
      ...[0, 1, 2].map((i) => path(`M${680 + i * 50} ${250 - i * 26}q10 -12 22 -2q12 -8 22 2`, { stroke: C.gray, width: 2 })),
      line(670, 300, 820, 190, { w: 1.2, c: C.gray, dash: '4 5' }),
      label('一行白鹭上青天', 760, 316, { size: 13 }),
    ], [750, 260]),

    layer([
      // 对仗结构
      tag('字数相等', 200, 536, { w: 96, h: 28, size: 12, color: C.blue }),
      tag('词性相对', 312, 536, { w: 96, h: 28, size: 12, color: C.gold }),
      tag('结构一致', 424, 536, { w: 96, h: 28, size: 12, color: C.green }),
      tag('平仄相对', 536, 536, { w: 96, h: 28, size: 12, color: C.red }),
      label('两个 / 一行　黄鹂 / 白鹭　鸣 / 上　翠柳 / 青天', 500, 502, { size: 13 }),
    ], [400, 570]),

    layer([
      label('对仗不是重复，是让两句话互相照见', 400, 578, { size: 15, color: C.red }),
    ], [400, 640]),
  ];
}

/* ------------------------------ 比喻与通感 ------------------------------ */
function rhetoric() {
  return [
    layer([
      // 花 + 香 + 颜色/声音
      path('M300 500v-70', { stroke: '#7d9d61', width: 3 }),
      circle(300, 410, 26, { stroke: C.red, width: 2, fill: 'rgba(196,86,63,0.2)' }),
      ...[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return circle(300 + Math.cos(a) * 34, 410 + Math.sin(a) * 34, 14, { stroke: C.red, width: 1.6, fill: 'rgba(233,150,150,0.3)' });
      }),
      label('香气也有颜色和声音', 400, 196, { size: 16 }),
    ], [320, 420]),

    layer([
      // 本体 / 喻体
      circle(250, 320, 60, { stroke: C.blue, width: 2, fill: 'rgba(47,93,143,0.10)' }),
      circle(370, 320, 60, { stroke: C.gold, width: 2, fill: 'rgba(180,131,31,0.12)' }),
      label('本体', 250, 330, { size: 14, color: C.blue }),
      label('喻体', 370, 330, { size: 14, color: C.gold }),
      label('相似点', 310, 268, { size: 12, color: C.red }),
      label('没有相似点，就不是比喻', 560, 320, { size: 13 }),
    ], [310, 320]),

    layer([
      // 通感
      arrow([500, 430], [660, 430], { c: C.red, w: 2.2, bend: -0.12 }),
      label('嗅觉', 500, 462, { size: 12 }),
      label('视觉 / 听觉', 700, 462, { size: 12 }),
      label('通感是跨感官的映射', 720, 400, { size: 13, color: C.red }),
      label('不能乱借', 720, 424, { size: 12 }),
    ], [620, 430]),

    layer([
      tag('✓ 香气是淡紫色的', 700, 512, { w: 190, h: 30, size: 12, color: C.green }),
      tag('✗ 香气是一块砖', 700, 548, { w: 190, h: 30, size: 12, color: C.red }),
      label('喻体要比本体更具体、更可感', 460, 512, { size: 13 }),
    ], [700, 560]),

    layer([
      label('好比喻，是替读者找到一个能看见的东西', 400, 584, { size: 15, color: C.red }),
    ], [400, 620]),
  ];
}

/* ------------------------------- 文言虚词 ------------------------------- */
function classical() {
  return [
    layer([
      // 竹简
      ...[0, 1, 2, 3, 4].map((i) => box(180 + i * 46, 280, 38, 210, { stroke: '#8a6b4f', width: 2, fill: 'rgba(240,225,190,0.75)' })),
      line(180, 320, 400, 320, { w: 1.2, c: '#8a6b4f', opacity: 0.5 }),
      label('之', 200, 400, { size: 30, color: C.red }),
      label('乎', 246, 400, { size: 30, color: C.blue }),
      label('者', 292, 400, { size: 30, color: C.gold }),
      label('也', 338, 400, { size: 30, color: C.green }),
      label('之乎者也的分寸', 400, 196, { size: 16 }),
    ], [300, 380]),

    layer([
      tag('之：的', 640, 240, { w: 96, h: 28, size: 13, color: C.red }),
      tag('之：代词', 640, 280, { w: 96, h: 28, size: 13, color: C.red }),
      tag('之：往', 640, 320, { w: 96, h: 28, size: 13, color: C.red }),
      label('同一个字，三种身份', 700, 380, { size: 13 }),
      label('看它在句子里干什么活', 700, 404, { size: 12 }),
    ], [680, 300]),

    layer([
      tag('而：并列', 640, 440, { w: 100, h: 28, size: 12, color: C.blue }),
      tag('而：承接', 750, 440, { w: 100, h: 28, size: 12, color: C.blue }),
      tag('而：转折', 640, 478, { w: 100, h: 28, size: 12, color: C.blue }),
      tag('而：修饰', 750, 478, { w: 100, h: 28, size: 12, color: C.blue }),
      label('而，是最会变脸的连词', 700, 516, { size: 13 }),
    ], [700, 470]),

    layer([
      tag('乎：于', 640, 552, { w: 90, h: 28, size: 13, color: C.green }),
      tag('乎：吗 / 啊', 750, 552, { w: 110, h: 28, size: 13, color: C.green }),
      label('虚词不翻成实义，它定的是关系', 470, 566, { size: 13 }),
    ], [700, 590]),

    layer([
      label('实词定内容，虚词定关系', 400, 594, { size: 15, color: C.red }),
    ], [400, 660]),
  ];
}

export const WORD_SCENES = {
  'chinese-poem-jingye': jingye,
  'chinese-idiom-shouzhu': shouzhu,
  'chinese-hanzi': hanzi,
  'chinese-poem-dengguanque': dengguanque,
  'chinese-poetry': poetry,
  'chinese-idiom-kezhou': kezhou,
  'chinese-couplet': couplet,
  'chinese-rhetoric': rhetoric,
  'chinese-classical': classical,
};
