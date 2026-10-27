/**
 * 英语不是知识点，是场景：点餐、买票、问路、面试。
 *
 * 每一幕是一个镜头：两个不同的人站在具体的场景里，
 * 说话的人换姿势、张嘴，听的人侧身、点头，对话框从嘴边冒出来。
 * 一页一页翻过去，就是一段小动画。
 */
import { BLUE, GRAY, GOLD, RED } from './board-kit.js';
import { bubble, figure, label, path, star } from './scene-kit.js';

const FEET = 548;

/* ------------------------------- 布景零件 ------------------------------- */
const stroke = (c = 'rgba(93,100,112,0.45)', w = 2) => ({ stroke: c, width: w });
const soft = (c = 'rgba(255,255,255,0.5)') => ({ fill: c });

function frame(x, y, w, h, tint = 'rgba(255,255,255,0.55)', line = 'rgba(93,100,112,0.45)') {
  return path(`M${x} ${y}h${w}v${h}h${-w}Z`, { ...stroke(line, 1.8), ...soft(tint) });
}

function picture(x, y, w, h) {
  return [
    frame(x, y, w, h, 'rgba(255,255,255,0.7)', 'rgba(120,104,78,0.6)'),
    path(`M${x + 8} ${y + h - 8}q${w * 0.22} -${h * 0.55} ${w * 0.4} 0q${w * 0.18} -${h * 0.35} ${w * 0.34} 0`, {
      stroke: 'rgba(93,100,112,0.4)', width: 1.4, fill: 'rgba(125,157,97,0.18)',
    }),
    star(x + w - 10, y + 12, { size: 8, color: 'rgba(180,131,31,0.5)' }),
  ];
}

function pendant(x, y, c = 'rgba(233,186,96,0.45)') {
  return [
    path(`M${x} ${y - 60}v40`, stroke('rgba(93,100,112,0.4)', 1.4)),
    path(`M${x - 26} ${y - 20}h52l-12 22h-28Z`, { ...stroke(GOLD, 2), fill: c }),
    path(`M${x - 12} ${y + 2}q12 16 24 0`, { stroke: 'rgba(233,186,96,0.5)', width: 1.4, fill: 'none' }),
  ];
}

function plant(x, y, s = 1) {
  return [
    path(`M${x} ${y}v-${38 * s}`, stroke('#8a6b4f', 4)),
    path(`M${x - 8} ${y - 12 * s}h16l-3 ${16 * s}h-10Z`, { ...stroke('#8a6b4f', 1.6), fill: 'rgba(200,175,120,0.4)' }),
    path(`M${x} ${y - 38 * s}q-${22 * s} -${16 * s} -${10 * s} -${34 * s}q${16 * s} -${12 * s} ${26 * s} ${6 * s}q${10 * s} ${16 * s} -${16 * s} ${28 * s}Z`, {
      stroke: '#5a7742', width: 2, fill: 'rgba(125,157,97,0.32)',
    }),
  ];
}

/* -------------------------------- 餐厅 -------------------------------- */
function restaurantSet() {
  return [
    path('M110 548H890', stroke('rgba(93,100,112,0.32)', 1.8)),
    path('M110 392H890', stroke('rgba(93,100,112,0.18)', 1.4)),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => path(`M${130 + i * 110} 548v-34`, stroke('rgba(93,100,112,0.12)', 1))),
    ...picture(150, 236, 86, 66),
    ...picture(742, 232, 96, 72),
    ...pendant(500, 214),
    // 窗（夜色）
    path('M232 250h96v120h-96Z', { ...stroke('rgba(93,100,112,0.5)', 2.2), fill: 'rgba(48,66,94,0.24)' }),
    path('M280 250v120M232 310h96', stroke('rgba(93,100,112,0.38)', 1.4)),
    ...[0, 1, 2].map((i) => path(`M${244 + i * 26} 360v-${10 + i * 6}h14v${10 + i * 6}`, {
      stroke: 'rgba(233,186,96,0.5)', width: 1, fill: 'rgba(233,186,96,0.22)',
    })),
    // 左侧卡座
    path('M140 548v-98q0 -14 14 -14h84q14 0 14 14v98', { ...stroke('rgba(93,100,112,0.4)', 2.2), fill: 'rgba(168,83,63,0.16)' }),
    path('M158 470h84', stroke('rgba(93,100,112,0.3)', 1.6)),
    // 桌子：桌布、盘子、杯子、烛台
    path('M404 486h192v16h-192Z', { ...stroke('rgba(93,100,112,0.45)', 2), fill: 'rgba(255,255,255,0.62)' }),
    path('M418 502v46M582 502v46', stroke('rgba(93,100,112,0.4)', 3)),
    path('M452 502v-16h96v16', { stroke: 'rgba(93,100,112,0.2)', width: 1.2, fill: 'rgba(255,255,255,0.45)' }),
    path('M462 474a14 5 0 1 0 28 0a14 5 0 1 0 -28 0', { ...stroke('rgba(93,100,112,0.4)', 1.2), fill: 'rgba(255,255,255,0.8)' }),
    path('M516 470h12v10h-12Z', { ...stroke('rgba(93,100,112,0.4)', 1.2), fill: 'rgba(158,207,221,0.5)' }),
    path('M540 468v12', stroke('rgba(233,186,96,0.8)', 5)),
    // 菜单黑板
    path('M786 300h74v96h-74Z', { ...stroke('rgba(120,104,78,0.6)', 2), fill: 'rgba(70,80,66,0.16)' }),
    label('MENU', 823, 330, { size: 12, color: 'rgba(80,90,80,0.8)' }),
    ...[0, 1, 2].map((i) => path(`M798 ${344 + i * 14}h50`, stroke('rgba(255,255,255,0.45)', 2))),
  ];
}

/* ------------------------------- 售票厅 ------------------------------- */
function ticketSet() {
  return [
    path('M110 548H890', stroke('rgba(93,100,112,0.32)', 1.8)),
    path('M180 176h420', { stroke: 'rgba(255,255,255,0.7)', width: 6 }),
    path('M180 176h420', { stroke: 'rgba(233,186,96,0.5)', width: 2 }),
    // 航班牌
    path('M132 214h226v104h-226Z', { ...stroke('rgba(93,100,112,0.45)', 2), fill: 'rgba(48,66,94,0.18)' }),
    ...[0, 1, 2].map((i) => [
      path(`M146 ${238 + i * 24}h52`, stroke('rgba(233,186,96,0.55)', 3)),
      path(`M212 ${238 + i * 24}h84`, stroke('rgba(255,255,255,0.35)', 3)),
      path(`M310 ${238 + i * 24}h32`, stroke('rgba(158,207,221,0.4)', 3)),
    ]),
    // 柜台与玻璃
    path('M566 386h318v162h-318Z', { ...stroke('rgba(93,100,112,0.42)', 2.2), fill: 'rgba(200,190,170,0.26)' }),
    path('M566 344h318v42h-318Z', { ...stroke('rgba(93,100,112,0.36)', 1.6), fill: 'rgba(190,220,232,0.2)' }),
    path('M700 344v-30a26 26 0 0 1 52 0v30', { stroke: 'rgba(93,100,112,0.3)', width: 1.6, fill: 'rgba(255,255,255,0.35)' }),
    // 设备
    path('M742 386v-22h40v22Z', { ...stroke('rgba(93,100,112,0.4)', 1.6), fill: 'rgba(80,96,112,0.28)' }),
    path('M754 356v8M770 356v8', stroke('rgba(93,100,112,0.4)', 2)),
    path('M806 386v-14h26v14Z', { ...stroke('rgba(93,100,112,0.4)', 1.4), fill: 'rgba(255,255,255,0.6)' }),
    path('M812 372h14', stroke('rgba(233,186,96,0.7)', 3)),
    // 一米线
    path('M452 548v-66', stroke('rgba(93,100,112,0.45)', 3)),
    path('M436 482h32', stroke('rgba(93,100,112,0.45)', 3)),
    path('M436 482h-56v-6h56Z', { ...stroke('rgba(168,83,63,0.5)', 1.2), fill: 'rgba(168,83,63,0.25)' }),
    // 行李
    path('M360 520h44v28h-44Z', { ...stroke('rgba(93,100,112,0.45)', 1.8), fill: 'rgba(138,107,79,0.35)' }),
    path('M370 520v-8h24v8', stroke('rgba(93,100,112,0.45)', 2)),
    path('M366 500h32', stroke('rgba(93,100,112,0.3)', 1.4)),
    // 挂钟
    path('M824 250a24 24 0 1 0 0.1 0', { ...stroke('rgba(93,100,112,0.45)', 2.2), fill: 'rgba(255,255,255,0.6)' }),
    path('M824 250v-12M824 250l10 7', stroke('rgba(93,100,112,0.7)', 1.6)),
  ];
}

/* -------------------------------- 街道 -------------------------------- */
function streetSet() {
  return [
    ...[
      [120, 296, 74, 118], [200, 262, 60, 152], [266, 310, 66, 104],
      [700, 290, 74, 130], [780, 318, 62, 102], [848, 274, 44, 146],
    ].map(([x, y, w, h]) => path(`M${x} ${y}h${w}v${h}h${-w}Z`, {
      stroke: 'rgba(93,100,112,0.24)', width: 1.2, fill: 'rgba(160,170,180,0.16)',
    })),
    // 博物馆（柱廊 + 圆顶）
    path('M330 420h148v-58H330Z', { ...stroke('rgba(93,100,112,0.4)', 1.8), fill: 'rgba(255,255,255,0.5)' }),
    path('M366 362a38 30 0 0 1 76 0Z', { ...stroke('rgba(93,100,112,0.4)', 1.8), fill: 'rgba(200,190,170,0.35)' }),
    ...[0, 1, 2, 3].map((i) => path(`M${344 + i * 34} 420v-46`, stroke('rgba(93,100,112,0.35)', 4))),
    path('M318 426h172', stroke('rgba(93,100,112,0.4)', 2.4)),
    // 树与路灯
    path('M842 548v-104', stroke('#8a6b4f', 6)),
    path('M842 444q-34 -26 -18 -54q14 -24 38 -12q22 12 10 38q-10 22 -30 28Z', { ...stroke('#5a7742', 2), fill: 'rgba(125,157,97,0.32)' }),
    path('M186 548v-120', stroke('rgba(93,100,112,0.5)', 4)),
    path('M170 428h32l-6 14h-20Z', { ...stroke('rgba(93,100,112,0.45)', 1.8), fill: 'rgba(233,186,96,0.4)' }),
    // 路面
    path('M110 548h780', stroke('rgba(93,100,112,0.32)', 2.4)),
    path('M110 566h780', stroke('rgba(93,100,112,0.2)', 1.4)),
    ...[0, 1, 2, 3, 4, 5].map((i) => path(`M${150 + i * 130} 556h54`, stroke('rgba(255,255,255,0.6)', 5))),
    // 垃圾桶、消防栓
    path('M628 548v-42h26v42Z', { ...stroke('rgba(93,100,112,0.4)', 1.6), fill: 'rgba(120,130,140,0.3)' }),
    path('M624 506h34', stroke('rgba(93,100,112,0.45)', 2.4)),
    path('M596 548v-24h12v24Z', { ...stroke('rgba(196,86,63,0.5)', 1.6), fill: 'rgba(196,86,63,0.3)' }),
    path('M594 532h16', stroke('rgba(196,86,63,0.5)', 3)),
    // 路牌
    path('M520 548V420', stroke('rgba(93,100,112,0.5)', 4)),
    path('M480 400h96v34h-96Z', { ...stroke(BLUE, 2), fill: 'rgba(255,255,255,0.75)' }),
    label('MUSEUM', 528, 422, { size: 12, color: BLUE }),
    path('M528 400v-14', stroke('rgba(93,100,112,0.5)', 2)),
  ];
}

/* -------------------------------- 办公室 -------------------------------- */
function officeSet() {
  return [
    path('M110 548H890', stroke('rgba(93,100,112,0.32)', 1.8)),
    // 百叶窗
    path('M126 226h150v180h-150Z', { ...stroke('rgba(93,100,112,0.4)', 2), fill: 'rgba(190,220,232,0.3)' }),
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => path(`M128 ${240 + i * 24}h146`, stroke('rgba(255,255,255,0.75)', 4))),
    // 书架
    path('M300 236h108v182h-108Z', { ...stroke('rgba(120,104,78,0.5)', 2), fill: 'rgba(200,175,120,0.22)' }),
    ...[0, 1, 2, 3].map((i) => [
      path(`M300 ${282 + i * 46}h108`, stroke('rgba(120,104,78,0.5)', 2.2)),
      ...[0, 1, 2, 3, 4].map((j) => path(`M${308 + j * 19} ${282 + i * 46}v-${22 + (j % 3) * 5}h13v${22 + (j % 3) * 5}`, {
        stroke: 'rgba(93,100,112,0.35)', width: 1, fill: ['rgba(168,83,63,0.35)', 'rgba(47,93,143,0.3)', 'rgba(180,131,31,0.3)'][j % 3],
      })),
    ]),
    // 白板 + 便签
    path('M700 230h176v116h-176Z', { ...stroke('rgba(93,100,112,0.4)', 2), fill: 'rgba(255,255,255,0.72)' }),
    path('M716 262h60M716 284h96M716 306h48', stroke('rgba(93,100,112,0.28)', 2.4)),
    ...[0, 1, 2].map((i) => path(`M792 ${252 + i * 26}h22v20h-22Z`, {
      stroke: 'rgba(180,131,31,0.5)', width: 1, fill: 'rgba(233,186,96,0.4)',
    })),
    // 桌面
    path('M392 480h312v16h-312Z', { ...stroke('rgba(93,100,112,0.45)', 2.2), fill: 'rgba(200,175,120,0.3)' }),
    path('M410 496v52M686 496v52', stroke('rgba(93,100,112,0.4)', 4)),
    path('M486 480v-26h54v26Z', { ...stroke('rgba(93,100,112,0.45)', 1.6), fill: 'rgba(207,216,222,0.8)' }),
    path('M556 480v-6h18v6', { ...stroke('rgba(93,100,112,0.4)', 1.2), fill: 'rgba(255,255,255,0.7)' }),
    path('M604 480v-18h34v18Z', { ...stroke('rgba(93,100,112,0.35)', 1.2), fill: 'rgba(255,255,255,0.7)' }),
    path('M610 468h22', stroke('rgba(93,100,112,0.3)', 1.6)),
    // 椅子
    path('M410 548v-40h50v10h-50Z', { ...stroke('rgba(93,100,112,0.4)', 1.8), fill: 'rgba(80,96,112,0.22)' }),
    path('M636 548v-40h50v10h-50Z', { ...stroke('rgba(93,100,112,0.4)', 1.8), fill: 'rgba(80,96,112,0.22)' }),
    ...plant(866, 548, 1),
    ...picture(600, 224, 74, 56),
  ];
}

/* -------------------------------- 角色 -------------------------------- */
const PERSONA = {
  customer: { color: '#4f7fae', outfit: 'hoodie', build: 'slim', skin: 2, hair: 'short', hairColor: 'dark', s: 1.26, prop: 'bag' },
  waiter: { color: '#a8533f', outfit: 'apron', build: 'mid', skin: 0, hair: 'bun', hairColor: 'black', s: 1.36, badge: true },
  traveler: { color: '#5f7f6a', outfit: 'jacket', build: 'stout', skin: 3, hair: 'short', hairColor: 'brown', s: 1.3, hat: 'beanie', hatColor: '#5a6b7a' },
  clerk: { color: '#3f5f8f', outfit: 'uniform', build: 'mid', skin: 0, hair: 'short', hairColor: 'brown', s: 1.34, hat: 'visor', hatColor: '#2f4a6f', badge: true },
  tourist: { color: '#7a9a6a', outfit: 'shirt', build: 'slim', skin: 1, hair: 'long', hairColor: 'auburn', s: 1.22, hat: 'cap', hatColor: '#7a9a6a', earrings: true },
  local: { color: '#8a6b4f', outfit: 'jacket', build: 'mid', skin: 2, hair: 'short', hairColor: 'gray', s: 1.32, scarf: '#b6412f' },
  candidate: { color: '#44598a', outfit: 'suit', build: 'slim', skin: 0, hair: 'short', hairColor: 'black', s: 1.26 },
  interviewer: { color: '#6a5560', outfit: 'blazer', build: 'mid', skin: 1, hair: 'short', hairColor: 'gray', s: 1.34, glasses: true, watch: true },
};

const makeCast = (pa, pb) => (a, b, bub) => [
  figure(292, FEET, { ...pa, ...a, key: 'A' }),
  figure(708, FEET, { ...pb, ...b, key: 'B', flip: true }),
  bub,
].filter(Boolean);

const say = (x, y, lines, tt, color) => bubble(x, y, 408, tt ? 118 : 92, lines, {
  tt,
  color,
  key: 'say',
  size: 18,
  lineHeight: 29,
  tail: [x + (x > 500 ? -74 : 74), FEET - 132 * 1.3 - 4],
});

const card = (title, lines, o = {}) => {
  const x = o.x ?? 596;
  const y = o.y ?? 118;
  return [
    path(`M${x} ${y}h244v196h-244Z`, { stroke: o.color || GOLD, width: 2, fill: 'rgba(255,250,235,0.92)' }),
    label(title, x + 122, y + 32, { size: 15, color: o.color || GOLD }),
    path(`M${x + 26} ${y + 44}h192`, stroke('rgba(180,131,31,0.35)', 1.4)),
    ...lines.map((ln, i) => label(ln, x + 122, y + 76 + i * 27, { size: 13, color: GRAY })),
    star(x + 210, y + 18, { size: 14 }),
  ];
};

/* -------------------------------- 点餐 -------------------------------- */
const ORDERING = (() => {
  const cast = makeCast(PERSONA.customer, PERSONA.waiter);
  return {
    steps: [
      {
        title: '进店，先说几个人',
        text: '服务员第一句通常是 “How many?” 或 “A table for…?”。你只要说人数 + please 就够了。',
        chips: ['点餐', '入座'],
        items: [
          label('在餐厅：从进门到买单', 500, 58, { size: 24, color: RED, rot: -1 }),
          label('A = 你　　B = 服务员', 500, 96, { size: 13 }),
          ...restaurantSet(),
          ...cast(
            { pose: 'stand', face: 'neutral', prop: 'bag' },
            { pose: 'stand', face: 'smile' },
            null,
          ),
        ].filter(Boolean),
      },
      {
        title: 'A：两位',
        text: '最简单的入座句：a table for + 人数。',
        chips: ['入座'],
        items: cast(
          { pose: 'talk', talk: true, face: 'smile' },
          { pose: 'listen', face: 'smile' },
          say(300, 292, ['Hi, a table for two,', 'please.'], '你好，两位。', BLUE),
        ),
      },
      {
        title: 'B：这是菜单',
        text: '“Here’s the menu.” 递东西时用 Here is / Here are。',
        chips: ['递菜单'],
        items: cast(
          { pose: 'listen', face: 'smile' },
          { pose: 'offer', face: 'smile', talk: true, prop: 'menu' },
          say(700, 280, ['Sure. Here’s the menu.', 'Can I get you a drink?'], '好的，这是菜单。要先来点喝的吗？', RED),
        ),
      },
      {
        title: 'A：我要这个',
        text: '点菜最常用 I’ll have… / Could I get…?，比 I want 礼貌。',
        chips: ['点菜'],
        items: cast(
          { pose: 'talk', talk: true, face: 'smile', prop: 'menu' },
          { pose: 'listen', face: 'smile', prop: 'notepad' },
          say(300, 280, ['I’ll have the grilled salmon,', 'and a sparkling water.'], '我要烤三文鱼，再加一杯气泡水。', BLUE),
        ),
      },
      {
        title: 'B：还要别的吗',
        text: '“Anything else?” 是服务员的固定问句；没有就说 That’s all, thanks.',
        chips: ['确认'],
        items: cast(
          { pose: 'listen', face: 'smile' },
          { pose: 'talk', talk: true, face: 'smile', prop: 'notepad' },
          say(700, 292, ['Anything else?', '— That’s all, thanks.'], '还要别的吗？—— 就这些，谢谢。', RED),
        ),
      },
      {
        title: '买单',
        text: '英式说 bill，美式说 check；打包说 to go。',
        chips: ['买单'],
        items: cast(
          { pose: 'talk', talk: true, face: 'smile', prop: 'paper' },
          { pose: 'listen', face: 'smile' },
          say(300, 292, ['Could I get the check, please?', '— Sure, coming right up.'], '可以买单吗？—— 好的，马上来。', BLUE),
        ),
      },
      {
        title: '把这几句带走',
        text: '点餐只要记住四个位置：入座、要菜单、点菜、买单。',
        chips: ['句型卡'],
        items: [
          ...card('餐厅四句', ['A table for two, please.', 'I’ll have the salmon.', 'Could I get the check?', 'For here / to go.']),
          ...cast(
            { pose: 'stand', face: 'smile', prop: 'menu' },
            { pose: 'stand', face: 'smile', prop: 'notepad' },
            null,
          ),
        ],
      },
    ],
    quiz: [
      { q: '想礼貌地点一份三文鱼，最自然的一句是？', options: ['I want salmon.', 'I’ll have the salmon, please.', 'Give me salmon.', 'Salmon is mine.'], answer: 1, why: 'I’ll have… 是餐厅点菜最常用的说法，加 please 更礼貌。' },
      { q: '“两位”怎么说？', options: ['Two people table.', 'A table for two, please.', 'We are two mans.', 'Give two seats.'], answer: 1, why: 'A table for + 人数 是餐厅入座的固定说法。' },
      { q: '想把没吃完的带走，应该说？', options: ['Take away here.', 'To go, please.', 'Go home food.', 'I want bag.'], answer: 1, why: '美式用 to go，英式常用 takeaway。' },
    ],
  };
})();

/* -------------------------------- 买票 -------------------------------- */
const TICKET = (() => {
  const cast = makeCast(PERSONA.traveler, PERSONA.clerk);
  return {
    steps: [
      {
        title: '在售票窗口，先说你要去哪',
        text: '买票的核心信息只有三个：目的地、时间、单程还是往返。先说目的地，再补时间。',
        chips: ['买票', '出行'],
        items: [
          label('在车站 / 机场：买一张票', 500, 58, { size: 24, color: RED, rot: -1 }),
          label('A = 你　　B = 售票员', 500, 96, { size: 13 }),
          ...ticketSet(),
          ...cast(
            { pose: 'stand', face: 'neutral' },
            { pose: 'stand', face: 'smile' },
            null,
          ),
        ].filter(Boolean),
      },
      {
        title: 'A：我要一张往返票',
        text: 'I’d like… 比 I want 礼貌；round-trip 是往返。',
        chips: ['提出需求'],
        items: cast(
          { pose: 'talk', talk: true, face: 'smile' },
          { pose: 'listen', face: 'smile' },
          say(300, 290, ['I’d like a round-trip ticket', 'to Boston, please.'], '我要一张去波士顿的往返票。', BLUE),
        ),
      },
      {
        title: 'B：什么时候走',
        text: 'When are you travelling? / What date? 是售票员的固定问法。',
        chips: ['确认时间'],
        items: cast(
          { pose: 'listen', face: 'neutral' },
          { pose: 'talk', talk: true, face: 'smile', prop: 'ticket' },
          say(700, 290, ['When are you travelling?', '— Next Friday, back on Sunday.'], '什么时候出发？—— 下周五，周日回。', RED),
        ),
      },
      {
        title: '选座：靠窗还是过道',
        text: 'window or aisle 是选座的两句话；中间座位是 middle seat。',
        chips: ['选座'],
        items: cast(
          { pose: 'talk', talk: true, face: 'smile' },
          { pose: 'listen', face: 'smile' },
          say(300, 290, ['Window or aisle?', '— A window seat, please.'], '靠窗还是过道？—— 靠窗。', BLUE),
        ),
      },
      {
        title: '付款与改签',
        text: '改签说 change，退票说 refund；问时间用 Is there a later…?',
        chips: ['改签'],
        items: cast(
          { pose: 'talk', talk: true, face: 'doubt' },
          { pose: 'listen', face: 'neutral', prop: 'ticket' },
          say(300, 290, ['Can I change my ticket?', '— Sure, there’s a $20 fee.'], '可以改签吗？—— 可以，手续费 20 美元。', BLUE),
        ),
      },
      {
        title: '把这几句带走',
        text: '买票的顺序：目的地 → 时间 → 单程/往返 → 选座 → 付款。',
        chips: ['句型卡'],
        items: [
          ...card('买票五句', ['I’d like a ticket to…', 'One-way or round-trip?', 'Next Friday, please.', 'Window seat, if possible.']),
          ...cast(
            { pose: 'stand', face: 'smile', prop: 'ticket' },
            { pose: 'stand', face: 'smile' },
            null,
          ),
        ],
      },
    ],
    quiz: [
      { q: '“往返票”用英语怎么说？', options: ['one-way ticket', 'round-trip ticket', 'return back ticket', 'two-way ticket'], answer: 1, why: 'round-trip（美式）/ return（英式）都表示往返票；one-way 是单程。' },
      { q: '售票员问 “Window or aisle?”，是在问什么？', options: ['要几张票', '靠窗还是过道', '什么时候出发', '要不要保险'], answer: 1, why: 'window seat 是靠窗，aisle seat 是过道，middle seat 是中间。' },
      { q: '想改签，最自然的一句是？', options: ['I want another ticket.', 'Can I change my ticket?', 'Change ticket now.', 'My ticket is wrong.'], answer: 1, why: 'change 用于改签，refund 用于退票。' },
    ],
  };
})();

/* -------------------------------- 问路 -------------------------------- */
const DIRECTIONS = (() => {
  const cast = makeCast(PERSONA.tourist, PERSONA.local);
  return {
    steps: [
      {
        title: '问路先停下对方',
        text: '开头一定要有 Excuse me，否则对方可能不理你。然后直接问 How do I get to…?',
        chips: ['问路', '城市'],
        items: [
          label('在街上：怎么走到博物馆', 500, 58, { size: 24, color: RED, rot: -1 }),
          label('A = 你　　B = 路人', 500, 96, { size: 13 }),
          ...streetSet(),
          ...cast(
            { pose: 'stand', face: 'doubt', prop: 'map' },
            { pose: 'stand', face: 'smile' },
            null,
          ),
        ].filter(Boolean),
      },
      {
        title: 'A：博物馆怎么走',
        text: 'How do I get to…? 是最通用的问路句。',
        chips: ['开口'],
        items: cast(
          { pose: 'talk', talk: true, face: 'neutral', prop: 'map' },
          { pose: 'listen', face: 'smile' },
          say(300, 286, ['Excuse me, how do I get', 'to the museum?'], '打扰一下，博物馆怎么走？', BLUE),
        ),
      },
      {
        title: 'B：直走两个街区',
        text: 'go straight + for two blocks，再 turn left at…（在…左转）。',
        chips: ['路线'],
        items: cast(
          { pose: 'listen', face: 'neutral' },
          { pose: 'point', talk: true, face: 'smile' },
          say(700, 286, ['Go straight for two blocks,', 'then turn left at the bank.'], '直走两个街区，在银行左转。', RED),
        ),
      },
      {
        title: 'A：走路能到吗',
        text: 'within walking distance 是“步行可达”；问距离用 How far…?',
        chips: ['距离'],
        items: cast(
          { pose: 'talk', talk: true, face: 'doubt' },
          { pose: 'listen', face: 'smile' },
          say(300, 292, ['Is it within walking distance?', '— About ten minutes on foot.'], '走路能到吗？—— 步行大约十分钟。', BLUE),
        ),
      },
      {
        title: '确认一下',
        text: '没听清就说 Sorry, could you repeat that?；确认方向说 Am I going the right way?',
        chips: ['确认'],
        items: cast(
          { pose: 'think', talk: true, face: 'doubt' },
          { pose: 'talk', talk: true, face: 'smile' },
          say(300, 292, ['Sorry, could you repeat that?', '— Left at the bank, then straight.'], '不好意思，能再说一遍吗？—— 银行左转，然后直走。', BLUE),
        ),
      },
      {
        title: '把这几句带走',
        text: '问路三件套：Excuse me → How do I get to… → 复述一遍确认。',
        chips: ['句型卡'],
        items: [
          ...card('问路四句', ['Excuse me, how do I get to…?', 'Go straight for two blocks.', 'Turn left at the bank.', 'Is it within walking distance?']),
          ...cast(
            { pose: 'stand', face: 'smile', prop: 'map' },
            { pose: 'stand', face: 'smile' },
            null,
          ),
        ],
      },
    ],
    quiz: [
      { q: '问路时最礼貌的开头是？', options: ['Hey you.', 'Excuse me.', 'Listen.', 'Sorry, move.'], answer: 1, why: 'Excuse me 用来礼貌地引起陌生人注意。' },
      { q: '“在银行左转”怎么说？', options: ['Turn left in the bank.', 'Turn left at the bank.', 'Left the bank.', 'Go left of bank.'], answer: 1, why: '在某个地点转弯用 turn left at + 地点。' },
      { q: '“步行十分钟”最自然的说法是？', options: ['ten minutes by foot', 'ten minutes on foot', 'ten minutes with foot', 'foot ten minutes'], answer: 1, why: '固定搭配 on foot 表示步行。' },
    ],
  };
})();

/* -------------------------------- 面试 -------------------------------- */
const INTERVIEW = (() => {
  const cast = makeCast(PERSONA.candidate, PERSONA.interviewer);
  return {
    steps: [
      {
        title: '面试不是背答案，是接住问题',
        text: '开场几乎固定：Tell me about yourself。不要背简历，用两句话讲“我是谁 + 我做过什么”。',
        chips: ['面试', '工作'],
        items: [
          label('面试：把经历讲成两句话', 500, 58, { size: 24, color: RED, rot: -1 }),
          label('A = 你　　B = 面试官', 500, 96, { size: 13 }),
          ...officeSet(),
          ...cast(
            { pose: 'stand', face: 'neutral', prop: 'paper' },
            { pose: 'stand', face: 'smile' },
            null,
          ),
        ].filter(Boolean),
      },
      {
        title: '面试官：先介绍一下自己',
        text: 'Tell me about yourself. 回答结构：现在做什么 → 做过什么 → 为什么来。',
        chips: ['开场'],
        items: cast(
          { pose: 'listen', face: 'neutral', prop: 'paper' },
          { pose: 'talk', talk: true, face: 'smile' },
          say(700, 292, ['Tell me a little', 'about yourself.'], '简单介绍一下你自己。', RED),
        ),
      },
      {
        title: '你：三年工作经验',
        text: 'I’ve been working as… for + 时间，比 I am a… 更能体现连续性。',
        chips: ['介绍'],
        items: cast(
          { pose: 'talk', talk: true, face: 'smile' },
          { pose: 'listen', face: 'smile', prop: 'paper' },
          say(300, 292, ['I’ve been working as a front-end', 'developer for three years.'], '我做前端开发三年了。', BLUE),
        ),
      },
      {
        title: '面试官：为什么来我们这',
        text: 'Why do you want to join us? 别说“因为你们给钱多”，说你想做什么。',
        chips: ['动机'],
        items: cast(
          { pose: 'listen', face: 'neutral' },
          { pose: 'talk', talk: true, face: 'neutral' },
          say(700, 286, ['Why do you want to join us?', '— I want to build things people use.'], '为什么想来我们这？—— 我想做用户每天都会用的产品。', RED),
        ),
      },
      {
        title: '你：反问一个问题',
        text: '结尾一定要反问：What does a typical day look like here?',
        chips: ['反问'],
        items: cast(
          { pose: 'talk', talk: true, face: 'smile' },
          { pose: 'listen', face: 'smile' },
          say(300, 292, ['What does a typical day', 'look like here?'], '这里的典型一天是什么样的？', BLUE),
        ),
      },
      {
        title: '把这几句带走',
        text: '面试四句：介绍自己、说清经历、讲动机、反问对方。',
        chips: ['句型卡'],
        items: [
          ...card('面试四句', ['I’ve been working as… for…', 'I’m good at…', 'I’d like to work on…', 'What does a typical day look like?']),
          ...cast(
            { pose: 'stand', face: 'smile' },
            { pose: 'stand', face: 'smile' },
            null,
          ),
        ],
      },
    ],
    quiz: [
      { q: '“我做前端三年了”最自然的说法是？', options: ['I am front-end three years.', 'I’ve been working as a front-end developer for three years.', 'I work front-end since three years.', 'My job is front-end three years ago.'], answer: 1, why: '现在完成进行时 have been working 强调从过去持续到现在。' },
      { q: '面试官问 “Why do you want to join us?”，较好的回答方向是？', options: ['Because I need money.', 'I want to work on products people use every day.', 'Because you are near my home.', 'I don’t know.'], answer: 1, why: '把动机落在工作内容与价值上，比谈待遇更合适。' },
      { q: '面试结尾反问，哪一句最合适？', options: ['When do I get paid?', 'What does a typical day look like here?', 'Can I leave early?', 'Do you have free lunch?'], answer: 1, why: '问日常工作与团队，能体现你对岗位的真实兴趣。' },
    ],
  };
})();

export const ENGLISH_SCENES = {
  'english-ordering': ORDERING,
  'english-ticket': TICKET,
  'english-directions': DIRECTIONS,
  'english-interview': INTERVIEW,
};
