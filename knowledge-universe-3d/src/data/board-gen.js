/**
 * 讲解生成器：按学科把知识点讲成「一段过程」，而不是三张静态卡片。
 * 每种学科有自己的叙事骨架：
 *   数学 / 物理 / 化学 —— 问题 → 旧办法 → 谁提出 → 公式 → 代入 → 边界
 *   生物 —— 原料 → 条件 → 场所 → 产物 → 意义
 *   历史 —— 背景 → 转折 → 转折 → 结果 → 影响
 *   语文 —— 起 → 承 → 转 → 合 → 寓意（优先用手写剧本的分幕）
 *   行业 / 英语 / 程序员 —— 麻烦 → 代价 → 方法 → 操作 → 结果 → 一句话
 */
import { handBeatsOf } from './lesson-content.js';
import {
  A, BLUE, GRAY, GOLD, GREEN, L, NOTE, P, PATH, RED, S, TAG, T, U, firstSentence, wrap,
} from './board-kit.js';
import { artFor } from './board-art.js';
import { SCENES } from './board-scenes.js';
import { header as pageHeader, host } from './scene-kit.js';

/* --------------------------- 少数可考的来源信息 --------------------------- */
const ORIGIN = {
  'math-pythagoras': { who: '毕达哥拉斯', year: '公元前 6 世纪', what: '把直角三角形的三边关系写成定理', story: '中国《周髀算经》更早记下「勾三股四弦五」；古希腊把它变成了普遍证明。' },
  'math-calculus': { who: '牛顿与莱布尼茨', year: '17 世纪', what: '各自独立发明了微积分', story: '一个从运动与速度出发，一个从几何的切线出发，最后走到同一套语言。' },
  'math-probability': { who: '帕斯卡与费马', year: '1654 年', what: '用通信讨论赌局里的分账问题', story: '一场没打完的赌局，逼出了「可能性」的算法。' },
  'math-fibonacci': { who: '斐波那契', year: '1202 年', what: '在《计算之书》里提出兔子繁殖问题', story: '一对兔子每个月的数量，长成了一串在自然界反复出现的数。' },
  'physics-pendulum': { who: '惠更斯', year: '1656 年', what: '把单摆做成了钟', story: '伽利略先发现摆的等时性，惠更斯把这条关系变成了能计时的机器。' },
  'physics-refraction': { who: '斯涅尔', year: '1621 年', what: '发现入射角与折射角的正弦比是定值', story: '一根筷子插进水里看起来折了，背后是一个固定的比例。' },
  'physics-lever': { who: '阿基米德', year: '公元前 3 世纪', what: '写出杠杆的平衡条件', story: '「给我一个支点，我能撬起地球」——支点不是修辞，是力臂。' },
  'physics-induction': { who: '法拉第', year: '1831 年', what: '发现磁通量变化会产生电流', story: '磁铁一动，导线里就有了电流；电与磁从此不再是两件事。' },
  'chemistry-periodic': { who: '门捷列夫', year: '1869 年', what: '排出了第一张元素周期表', story: '他给还没发现的元素留了空格，并预言了它们的性质。' },
  'chemistry-combustion': { who: '拉瓦锡', year: '1770 年代', what: '用称量推翻了燃素说', story: '物体燃烧后变重，不是因为放出燃素，而是因为结合了空气里的氧。' },
  'chemistry-acidbase': { who: '阿伦尼乌斯', year: '1884 年', what: '提出电离理论', story: '酸和碱的差别，不在于味道，而在于在水里放出什么离子。' },
  'biology-immune': { who: '詹纳', year: '1796 年', what: '用牛痘让人获得天花免疫', story: '挤奶女工不得天花，这个观察成了疫苗的起点。' },
  'biology-dna': { who: '沃森与克里克', year: '1953 年', what: '提出 DNA 双螺旋结构', story: '富兰克林的 X 射线照片，让那条螺旋第一次可以被看见。' },
};

const roleOf = (point) => {
  const s = point.subjectId;
  if (s === 'chinese') return 'chinese';
  if (s === 'history') return 'history';
  if (s === 'biology') return 'problem';
  if (s === 'chemistry' || s === 'math' || s === 'physics') return 'formula';
  return 'problem';
};

/* ------------------------------- 通用零件 ------------------------------- */
function header(point) {
  return [
    T(point.title, 500, 86, { size: point.title.length > 7 ? 32 : 38, color: RED, rot: -1.2 }),
    U(500 - Math.min(220, point.title.length * 22), 100, Math.min(440, point.title.length * 44), { color: RED, width: 2 }),
  ];
}

/* ------------------------- 骨架 1：公式（数理化） ------------------------- */
function formulaBoard(point) {
  const origin = ORIGIN[point.id];
  const p = point.principles;
  const short = (str, n = 22) => {
    const t = String(str || '').split(/[；;。]/)[0];
    return t.length > n ? `${t.slice(0, n)}…` : t;
  };
  const steps = [];

  steps.push({
    title: point.hook,
    text: `先看一个真实场景：${point.case}`,
    chips: ['问题'],
    items: [
      T(point.hook, 720, 78, { size: point.hook.length > 14 ? 22 : 26, color: RED, rot: -1.2 }),
      T('先看它要解决什么', 720, 112, { size: 14, color: GRAY }),
      ...artFor(point, 225, 282),
      A([430, 300], [540, 200], { color: BLUE, bend: -0.2 }),
    ],
  });

  steps.push({
    title: '没有它的时候，只能一次次试',
    text: `没有这条关系，人们只能靠经验估、靠试错逼近。慢，而且换一个条件就得重来。${firstSentence(point.case)}。`,
    chips: ['旧办法'],
    items: [
      NOTE(710, 214, 400, 96, wrap(short(point.case, 26), 15, 2), { color: RED, no: '✕', noColor: RED, seed: 21 }),
      T('试错：慢、贵，还不一定准', 710, 278, { size: 15, color: RED }),
    ],
  });

  steps.push({
    title: origin ? `${origin.who} 的那一笔` : '先把它拆成几个量',
    text: origin
      ? `${origin.who}（${origin.year}）${origin.what}。${origin.story}`
      : '把过程拆成几个能测量的量，再看它们怎么一起变；关系一旦固定下来，就能反过来预测。',
    chips: [origin ? '提出者' : '拆解'],
    items: origin
      ? [
          P('person', 150, 540, { hat: 'scholar', robe: '#8a6b4f', s: 0.85 }),
          T(origin.who, 260, 520, { size: 18, anchor: 'start' }),
          T(origin.year, 260, 546, { size: 14, color: GRAY, anchor: 'start' }),
        ]
      : [
          P('bulb', 150, 536, { s: 0.8 }),
          T('拆成可测量的量', 250, 520, { size: 18, anchor: 'start' }),
          T('找出不变的关系', 250, 546, { size: 14, color: GRAY, anchor: 'start' }),
        ],
  });

  steps.push({
    title: point.formula,
    text: point.summary,
    chips: ['核心关系'],
    items: [
      NOTE(640, 372, 480, 88, [], { color: BLUE, opacity: 0.32, seed: 33 }),
      T(point.formula, 640, 386, { size: point.formula.length > 22 ? 18 : 24, color: BLUE }),
      T('一条关系，把过程压成一行', 640, 440, { size: 13, color: GRAY }),
    ],
  });

  steps.push({
    title: '把现实条件代进去',
    text: `${p[0]}。${p[1] || ''}`,
    chips: ['代入'],
    items: [
      T('代进去，它开始有用', 640, 470, { size: 14, color: GRAY }),
      T(`→ ${short(p[0], 20)}`, 640, 498, { size: 16 }),
    ].filter(Boolean),
  });

  steps.push({
    title: '它解决了什么，又管不到哪里',
    text: `${firstSentence(point.summary)}。但任何公式都有前提：条件一变，结论就要重算。`,
    chips: ['结论'],
    items: [
      T('✓ 解决了什么', 560, 530, { size: 14, color: GREEN }),
      T(short(firstSentence(point.summary), 22), 560, 558, { size: 15 }),
      S(880, 522, { size: 16, color: GOLD }),
    ],
  });

  return steps;
}

/* ---------------------------- 骨架 2：过程（生物） ---------------------------- */
function processBoard(point) {
  const p = point.principles;
  const labels = ['原料', '条件', '场所', '产物'];
  const xs = [185, 405, 625, 845];
  const y = 418;
  const steps = [];

  steps.push({
    title: '先把参与者请上台',
    text: `这件事不是一句话发生的，它有原料、有条件、有场所、有产物。第一样进场的是：${p[0]}。`,
    chips: ['起点'],
    items: [
      ...header(point),
      TAG(labels[0], xs[0], y, { w: 140, h: 56, size: 19, color: BLUE, fill: 'rgba(255,255,255,0.55)' }),
      T(wrap(p[0], 12, 2)[0] || '', xs[0], 330, { size: 14, color: GRAY }),
      T(wrap(p[0], 12, 2)[1] || '', xs[0], 352, { size: 14, color: GRAY }),
      P('field', 120, 560, { s: 0.9 }),
    ],
  });

  steps.push({
    title: '少了这个条件，反应就不发生',
    text: p[1] || '除了原料，还需要一个外部条件，过程才启动。',
    chips: ['条件'],
    items: [
      A([260, y], [330, y], { color: BLUE, bend: -0.12 }),
      TAG(labels[1], xs[1], y, { w: 140, h: 56, size: 19, color: BLUE, fill: 'rgba(255,255,255,0.55)' }),
      T(wrap(p[1] || '', 12, 2)[0] || '', xs[1], 330, { size: 14, color: GRAY }),
      T(wrap(p[1] || '', 12, 2)[1] || '', xs[1], 352, { size: 14, color: GRAY }),
    ],
  });

  steps.push({
    title: '它到底在哪儿发生',
    text: p[2] || '过程的每一步都发生在具体的场所里，场所决定了谁能进来、谁会出去。',
    chips: ['场所'],
    items: [
      A([480, y], [550, y], { color: BLUE, bend: -0.12 }),
      TAG(labels[2], xs[2], y, { w: 140, h: 56, size: 19, color: GREEN, fill: 'rgba(255,255,255,0.55)' }),
      T(wrap(p[2] || '', 12, 2)[0] || '', xs[2], 330, { size: 14, color: GRAY }),
      T(wrap(p[2] || '', 12, 2)[1] || '', xs[2], 352, { size: 14, color: GRAY }),
    ],
  });

  steps.push({
    title: '产物出来，过程才算走完',
    text: `${p[3] || ''} ${firstSentence(point.case)}。`,
    chips: ['产物'],
    items: [
      A([700, y], [770, y], { color: BLUE, bend: -0.12 }),
      TAG(labels[3], xs[3], y, { w: 140, h: 56, size: 19, color: RED, fill: 'rgba(255,255,255,0.6)' }),
      T(wrap(p[3] || '', 12, 2)[0] || '', xs[3], 330, { size: 14, color: GRAY }),
      T(wrap(p[3] || '', 12, 2)[1] || '', xs[3], 352, { size: 14, color: GRAY }),
      A([920, y], [960, y - 40], { color: GOLD, bend: -0.2 }),
      T('去向', 942, 356, { size: 14, color: GOLD }),
    ],
  });

  steps.push({
    title: '把这条链记住',
    text: `${point.summary} 一句话：${point.formula}。`,
    chips: ['串联'],
    items: [
      L(520, y, 460, 74, { color: RED, rot: -1.5 }),
      T('四步连起来，才是完整的它', 520, 556, { size: 19, color: RED }),
      T(point.formula, 520, 590, { size: 20, color: BLUE }),
    ],
  });

  return steps;
}

/* ---------------------------- 骨架 3：时间（历史） ---------------------------- */
function timelineBoard(point) {
  const p = point.principles;
  const xs = [190, 410, 630, 850];
  const labels = ['背景', '转折', '转折', '结果'];
  const steps = [];

  steps.push({
    title: '先看它发生之前',
    text: `${p[0]}。这是整件事的起点：不是某一天突然出事，而是条件早就摆在那里。`,
    chips: ['背景'],
    items: [
      ...header(point),
      PATH('M90 402 H930', { stroke: BLUE, width: 2.4, opacity: 0.55 }),
      PATH('M918 394 L934 402 L918 410', { stroke: BLUE, width: 2.4 }),
      T('时间 →', 890, 430, { size: 14, color: GRAY }),
      T(wrap(p[0], 13, 2)[0] || '', xs[0], 322, { size: 14, color: GRAY }),
      T(wrap(p[0], 13, 2)[1] || '', xs[0], 344, { size: 14, color: GRAY }),
      TAG(labels[0], xs[0], 402, { w: 120, h: 44, size: 18, color: BLUE, fill: 'rgba(255,255,255,0.6)' }),
    ],
  });

  for (let i = 1; i < 3; i += 1) {
    steps.push({
      title: i === 1 ? '第一个转折' : '第二个转折',
      text: `${p[i]}。旧平衡被打破，人物与选择开始起作用。`,
      chips: [labels[i]],
      items: [
        A([xs[i - 1] + 62, 402], [xs[i] - 62, 402], { color: BLUE, bend: -0.1 }),
        TAG(labels[i], xs[i], 402, { w: 120, h: 44, size: 18, color: GOLD, fill: 'rgba(255,255,255,0.6)' }),
        T(wrap(p[i], 13, 2)[0] || '', xs[i], 322, { size: 14, color: GRAY }),
        T(wrap(p[i], 13, 2)[1] || '', xs[i], 344, { size: 14, color: GRAY }),
        i === 1
          ? P('person', 510, 500, { hat: 'official', robe: '#a8452f', s: 0.72 })
          : P('flag', 300, 520, { s: 0.8 }),
      ],
    });
  }

  steps.push({
    title: '结果落下来',
    text: `${p[3] || firstSentence(point.case)}。`,
    chips: ['结果'],
    items: [
      A([xs[2] + 62, 402], [xs[3] - 62, 402], { color: BLUE, bend: -0.1 }),
      TAG(labels[3], xs[3], 402, { w: 120, h: 44, size: 18, color: RED, fill: 'rgba(255,255,255,0.65)' }),
      T(wrap(p[3] || firstSentence(point.case), 13, 2)[0] || '', xs[3], 322, { size: 14, color: GRAY }),
      T(wrap(p[3] || firstSentence(point.case), 13, 2)[1] || '', xs[3], 344, { size: 14, color: GRAY }),
      P('person', 870, 530, { hat: 'general', robe: '#6b5a46', s: 0.72, flag: true, flagColor: '#b6412f' }),
    ],
  });

  steps.push({
    title: '它为什么还在被讲',
    text: `${point.summary} 一句话：${point.formula}。`,
    chips: ['影响'],
    items: [
      L(520, 402, 470, 86, { color: RED, rot: -1 }),
      T('把这条时间线连起来看，因果就出来了', 500, 560, { size: 18, color: RED }),
      T(point.formula, 500, 590, { size: 19, color: BLUE }),
    ],
  });

  return steps;
}

/* ---------------------------- 骨架 4：故事（语文） ---------------------------- */
function storyBoard(point) {
  const beats = handBeatsOf(point.id);
  const slots = [
    [280, 220],
    [720, 220],
    [280, 448],
    [720, 448],
  ];
  const steps = [];

  if (beats?.length) {
    beats.slice(0, 4).forEach((beat, i) => {
      const [cx, cy] = slots[i];
      steps.push({
        title: beat.title,
        text: beat.text,
        quote: beat.quote,
        note: beat.note,
        chips: beat.chips || [['起', '承', '转', '合'][i] || `第 ${i + 1} 幕`],
        items: [
          NOTE(cx, cy, 410, 168, [], { color: i === 3 ? RED : BLUE, no: ['①', '②', '③', '④'][i], seed: 40 + i }),
          T(beat.title, cx - 156, cy - 46, { size: 20, color: i === 3 ? RED : BLUE, anchor: 'start' }),
          T(wrap(beat.text, 17, 1)[0] || '', cx - 156, cy - 16, { size: 13, color: GRAY, anchor: 'start' }),
          T(wrap(beat.text, 17, 1)[1] || '', cx - 156, cy + 4, { size: 13, color: GRAY, anchor: 'start' }),
          beat.quote
            ? T(beat.quote, cx, cy + 50, { size: 17, color: RED })
            : T(wrap(beat.text, 15, 2)[0] || '', cx, cy + 50, { size: 15, color: GRAY }),
        ],
      });
    });
    steps.push({
      title: '这个故事在讲什么',
      text: `${point.summary} 一句话：${point.formula}。`,
      chips: ['寓意'],
      items: [
        T('这个故事讲的是', 500, 62, { size: 15, color: GRAY }),
        T(point.formula, 500, 96, { size: 22, color: RED }),
        U(500 - Math.min(240, point.formula.length * 9), 110, Math.min(480, point.formula.length * 18), { color: RED }),
        S(150, 76, { size: 20 }),
      ],
    });
    return steps;
  }

  const p = point.principles;
  const frames = [
    { label: '起', title: point.hook, text: firstSentence(point.case) },
    { label: '承', title: '事情往下走', text: p[0] },
    { label: '转', title: '转折出现', text: p[1] || p[0] },
    { label: '合', title: '落到一句话', text: p[2] || firstSentence(point.summary) },
  ];
  frames.forEach((f, i) => {
    steps.push({
      title: f.title,
      text: f.text,
      chips: [f.label],
      items: [
        NOTE(slots[i][0], slots[i][1], 410, 168, wrap(f.text, 16, 3), {
          color: i === 3 ? RED : BLUE, no: f.label, noSize: 22, seed: 50 + i, size: 16, lineHeight: 27,
        }),
      ],
    });
  });
  steps.push({
    title: '这个故事在讲什么',
    text: `${point.summary} 一句话：${point.formula}。`,
    chips: ['寓意'],
    items: [
      T(point.formula, 500, 96, { size: 22, color: RED }),
      U(500 - Math.min(240, point.formula.length * 9), 110, Math.min(480, point.formula.length * 18), { color: RED }),
    ],
  });
  return steps;
}

/* ------------------------- 骨架 5：问题（行业 / 英语） ------------------------- */
function problemBoard(point) {
  const p = point.principles;
  const short = (str, n = 20) => {
    const t = String(str || '').split(/[；;。]/)[0];
    return t.length > n ? `${t.slice(0, n)}…` : t;
  };
  const steps = [];

  steps.push({
    title: point.hook,
    text: `先看一个具体场景：${point.case}`,
    chips: ['麻烦'],
    items: [
      T(point.hook, 720, 78, { size: point.hook.length > 14 ? 22 : 26, color: RED, rot: -1.2 }),
      T('先看它难在哪', 720, 112, { size: 14, color: GRAY }),
      ...artFor(point, 235, 310),
      A([430, 290], [545, 200], { color: BLUE, bend: -0.2 }),
    ],
  });

  steps.push({
    title: '不解决会怎样',
    text: `${p[2] || p[0]}。代价不是抽象的，它会落在时间、成本或者体验上。`,
    chips: ['代价'],
    items: [
      NOTE(710, 210, 400, 96, wrap(short(p[2] || point.case, 26), 15, 2), { color: RED, no: '✕', noColor: RED, seed: 61 }),
      T('硬扛的代价', 710, 274, { size: 15, color: RED }),
    ],
  });

  steps.push({
    title: '引入这个方法',
    text: `${p[0]}。这一步是整件事的转折：从「凭感觉」变成「有依据」。`,
    chips: ['方法'],
    items: [
      TAG('方法', 590, 330, { w: 88, h: 38, size: 16, color: GREEN, fill: 'rgba(255,255,255,0.6)' }),
      T(`→ ${short(p[0], 18)}`, 590, 378, { size: 16 }),
      A([590, 352], [590, 364], { color: GREEN, bend: 0, head: true }),
    ],
  });

  steps.push({
    title: '具体怎么做',
    text: `${p[1] || ''} 操作上把它拆成三步，每一步都能检查、能复现。`,
    chips: ['操作'],
    items: [
      T('① 先看条件', 590, 428, { size: 17, color: GRAY }),
      T('② 再套方法', 590, 458, { size: 17, color: GRAY }),
      T('③ 最后验证', 590, 488, { size: 17, color: GRAY }),
      A([700, 440], [660, 470], { color: BLUE, bend: 0.12 }),
    ],
  });

  steps.push({
    title: '结果与一句话',
    text: `${firstSentence(point.case)}。方法有效，但换个场景要先确认前提还成立。`,
    chips: ['结果'],
    items: [
      T('✓ 结果', 720, 540, { size: 15, color: GREEN }),
      T(short(firstSentence(point.case), 22), 720, 566, { size: 15 }),
      T(point.formula, 500, 604, { size: point.formula.length > 20 ? 17 : 21, color: RED }),
      U(500 - Math.min(200, point.formula.length * 7), 614, Math.min(400, point.formula.length * 14), { color: RED }),
      S(880, 552, { size: 16, color: GOLD }),
    ],
  });

  return steps;
}

/* --------------------------------- 入口 --------------------------------- */
function fitLayers(layers, n) {
  if (!layers?.length) return null;
  if (layers.length === n) return layers;
  if (layers.length > n) {
    const head = layers.slice(0, n - 1);
    const tail = layers.slice(n - 1).flatMap((l) => l.items || []);
    return [...head, { items: tail, focus: layers[n - 1].focus }];
  }
  const out = layers.slice();
  while (out.length < n) out.push({ items: [] });
  return out;
}

export function buildNarrativeBoard(point) {
  const role = roleOf(point);
  let steps;
  if (role === 'process') steps = processBoard(point);
  else if (role === 'history') steps = timelineBoard(point);
  else if (role === 'chinese') steps = storyBoard(point);
  else if (role === 'formula') steps = formulaBoard(point);
  else steps = problemBoard(point);

  // 有手绘图的知识点：每一幕换成「再画一笔」，文字仍用上面的脚本
  const scene = fitLayers(SCENES[point.id]?.(), steps.length);
  if (!scene) return { steps };

  // 学科讲解人：画面里还没有角色时，让一个人站在板书边上，跟着讲
  const SIDE = {
    math: 112, physics: 112, chemistry: 888, biology: 112, geography: 888,
    history: 112, chinese: 888, programmer: 112, designer: 888, chef: 112,
    architect: 888, fisherman: 112, farmer: 888,
  };
  const casted = steps.some((st) => (st.items || []).some((it) => it.k === 'figure' || it.k === 'plate' || it.k === 'sticker'))
    || (scene || []).some((l) => (l.items || []).some((it) => ['plate', 'figure', 'sticker'].includes(it.k)));

  // 挑一个空着的下角站人：先看这一关所有幕加起来占没占这块地方
  const pointOf = (it) => {
    if (!it) return null;
    if (it.k === 'arrow') return [(it.from[0] + it.to[0]) / 2, (it.from[1] + it.to[1]) / 2];
    if (typeof it.x === 'number' && typeof it.y === 'number') return [it.x, it.y];
    const m = /M(-?[\d.]+)[ ,](-?[\d.]+)/.exec(it.d || '');
    return m ? [Number(m[1]), Number(m[2])] : null;
  };
  const all = steps.flatMap((st) => st.items || []);
  const freeAt = (x, y) => !all.some((it) => {
    const p = pointOf(it);
    if (!p) return false;
    return Math.abs(p[0] - x) < 74 && p[1] > y - 122 && p[1] < y + 16;
  });
  const prefer = SIDE[point.subjectId] ?? 112;
  const order = [prefer, prefer === 112 ? 888 : 112];
  let spot = null;
  for (const x of order) if (freeAt(x, 594)) { spot = x; break; }

  const twoPages = steps.length >= 6;
  let prevPage = -1;
  return {
    steps: steps.map((s, i) => {
      const page = twoPages && i >= 3 ? 1 : 0;
      const items = [];
      const useSticker = (scene || []).some((l) => (l.items || []).some((it) => it.k === 'sticker'));
      if (page !== prevPage && !useSticker) items.push(...pageHeader(point));
      prevPage = page;
      const lay = scene[i] || {};
      items.push(...(lay.items || []));
      if (!casted && spot !== null) items.push(host(point.subjectId, i, spot, 594));
      // 场景层上的换帧标记要带到这一幕上，否则只会把上一幕叠在这里
      return { ...s, ...(lay.fresh ? { fresh: true } : {}), page, items };
    }),
  };
}
