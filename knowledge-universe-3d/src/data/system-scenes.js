/**
 * 工程系统：把很多知识点串成一条长板书。
 * 火箭发射 13 页步、桥梁建造 10 页步，每一步只多画一块，前面画过的不擦。
 */
import { A, BLUE, GRAY, GOLD, GREEN, L, NOTE, P, PATH, RED, S, TAG, T, U, wrap } from './board-kit.js';

const flame = (x, y, s = 1) => [
  PATH(`M${x - 16 * s} ${y} q-10 ${54 * s} ${16 * s} ${100 * s} q${26 * s} ${-46 * s} ${16 * s} ${-100 * s} Z`, {
    stroke: 'rgba(255,170,80,0.7)',
    width: 1,
    fill: 'rgba(255,170,80,0.55)',
  }),
];

/* ================================ 火箭发射 ================================ */
const ROCKET = {
  steps: [
    {
      page: 0,
      title: '把一吨东西送到 100 公里以上',
      text: '火箭要做的不是“飞起来”，而是把载荷加速到 7.9 km/s，让它横向快到“一直往下掉却掉不到地面”。先看它要跨过的距离。',
      chips: ['问题', '入轨'],
      items: [
        T('怎么把一吨东西，送到 100 公里以上', 500, 62, { size: 24, color: RED, rot: -1 }),
        T('而且要横着飞到 7.9 km/s', 500, 94, { size: 14, color: GRAY }),
        PATH('M-40 566 Q500 496 1040 566', { stroke: '#6f9ab0', width: 3, fill: 'none' }),
        T('地球', 120, 586, { size: 14, color: '#4f8fb0' }),
        PATH('M60 300 H940', { stroke: GRAY, width: 1.4, opacity: 0.5, }), 
        T('100 km · 卡门线', 800, 288, { size: 14, color: GRAY }),
        P('rocket', 250, 520, { scale: 1.3 }),
        PATH('M170 522 h160 v14 h-160 Z', { stroke: GRAY, width: 1.6, fill: 'rgba(120,110,90,0.16)' }),
      ],
    },
    {
      page: 0,
      title: '它靠“往下扔东西”往上走',
      text: '牛顿第三定律：火箭向下高速喷出燃气，燃气给火箭一个大小相等、方向相反的反作用力。真空中也能工作，因为它不需要空气。',
      chips: ['牛顿第三定律', '推力'],
      items: [
        ...flame(250, 528, 1.2),
        A([250, 650], [250, 590], { color: RED, bend: 0 }),
        T('燃气向下', 250, 600, { size: 15, color: RED }),
        A([390, 560], [390, 430], { color: GREEN, bend: 0 }),
        T('火箭向上', 390, 500, { size: 15, color: GREEN }),
        T('F = −F′', 540, 300, { size: 20, color: BLUE }),
      ],
    },
    {
      page: 0,
      title: '飞机为什么不行',
      text: '飞机靠机翼在空气中产生升力，靠进气口取氧。到了 20 公里以上，空气稀薄到两者都不成立——火箭必须自带氧化剂（液氧）。',
      chips: ['大气层', '自带氧化剂'],
      items: [
        PATH('M650 190 q80 -26 150 0 q40 12 60 2 q-30 26 -70 26 h-110 q-40 0 -30 -28 Z', { stroke: BLUE, width: 2, fill: 'rgba(255,255,255,0.5)' }),
        PATH('M650 190 l-60 -26 M650 190 l-60 26', { stroke: BLUE, width: 2 }),
        PATH('M660 140 a110 90 0 1 0 220 0 a110 90 0 1 0 -220 0', { stroke: RED, width: 3, opacity: 0.75 }),
        T('空气太薄：升力不够，也没氧可烧', 760, 300, { size: 15, color: RED }),
        TAG('液氧 −183°C', 760, 360, { w: 150, h: 40, size: 15, color: BLUE, fill: 'rgba(255,255,255,0.6)' }),
        TAG('煤油 / 液氢', 760, 410, { w: 150, h: 40, size: 15, color: GOLD, fill: 'rgba(255,248,225,0.7)' }),
      ],
    },
    {
      page: 0,
      title: '为什么必须分级',
      text: '全程带满燃料是最亏的：油箱和结构在大部分时间里都是死重。分级就是“用完了就扔”，让剩下的部分轻装前进。',
      chips: ['分级', '死重'],
      items: [
        TAG('一级', 650, 330, { w: 100, h: 40, size: 16, color: BLUE, fill: 'rgba(255,255,255,0.6)' }),
        TAG('二级', 790, 330, { w: 100, h: 40, size: 16, color: GREEN, fill: 'rgba(232,244,226,0.7)' }),
        TAG('三级 / 载荷', 930, 330, { w: 120, h: 40, size: 14, color: GOLD, fill: 'rgba(255,248,225,0.7)' }),
        A([650, 380], [650, 450], { color: RED, bend: 0.1 }),
        T('抛掉空油箱', 650, 470, { size: 13, color: RED }),
        T('每抛一次，剩下的部分就轻一截', 760, 430, { size: 14, color: GRAY }),
      ],
    },

    {
      page: 1,
      title: 'T-3 小时：加注',
      text: '液氧必须保持在 −183°C，加注会持续到临射前。低温让金属收缩、让阀门结霜，所以发射前要反复检查密封。',
      chips: ['加注', '低温'],
      items: [
        T('发射当天：从加注到入轨', 500, 62, { size: 24, color: RED, rot: -1 }),
        PATH('M120 520 v-260 M120 300 h-50', { stroke: GRAY, width: 3 }),
        PATH('M120 420 h60 M120 360 h60 M120 300 h60', { stroke: GRAY, width: 2, opacity: 0.7 }),
        PATH('M180 520 v-300 M180 260 h50', { stroke: GRAY, width: 2, opacity: 0.4 }),
        P('rocket', 260, 520, { scale: 1.15 }),
        TAG('T-3h', 500, 170, { w: 76, h: 34, size: 14, color: BLUE, fill: 'rgba(255,255,255,0.6)' }),
        T('液氧 −183°C / 煤油加注', 590, 176, { size: 15, anchor: 'start' }),
        T('箭体结霜、阀门收缩', 590, 202, { size: 13, color: GRAY, anchor: 'start' }),
      ],
    },
    {
      page: 1,
      title: 'T-0：点火与牵制释放',
      text: '发动机先点火、达到额定推力，确认正常后才松开牵制机构。这一步的意义是：起飞前还有机会中止。',
      chips: ['点火', '牵制'],
      items: [
        ...flame(260, 528, 1.1),
        TAG('T-0', 500, 262, { w: 76, h: 34, size: 14, color: RED, fill: 'rgba(255,245,238,0.7)' }),
        T('点火，推力到额定值', 590, 268, { size: 15, anchor: 'start' }),
        T('牵制释放 → 起飞', 590, 294, { size: 13, color: GRAY, anchor: 'start' }),
      ],
    },
    {
      page: 1,
      title: 'Max-Q：最难熬的一分钟',
      text: '速度上来、空气还没变稀，箭体承受的动压达到峰值，叫 Max-Q。此时通常会节流，减少结构载荷。',
      chips: ['Max-Q', '动压'],
      items: [
        TAG('Max-Q', 500, 354, { w: 96, h: 34, size: 14, color: GOLD, fill: 'rgba(255,248,225,0.75)' }),
        T('动压峰值，发动机节流', 600, 360, { size: 15, anchor: 'start' }),
        T('不是故障，是设计里的必经点', 600, 386, { size: 13, color: GRAY, anchor: 'start' }),
        PATH('M410 360 q30 -22 60 0 q30 22 60 0', { stroke: GOLD, width: 2, opacity: 0.6 }),
      ],
    },
    {
      page: 1,
      title: '一级分离',
      text: '一级燃料耗尽，爆炸螺栓切断连接，一级靠惯性分离；二级发动机点火。分离是最危险的瞬间之一，必须避免两者相撞。',
      chips: ['分离', '二级点火'],
      items: [
        TAG('一级分离', 500, 446, { w: 110, h: 34, size: 14, color: BLUE, fill: 'rgba(255,255,255,0.65)' }),
        T('爆炸螺栓切断，一级脱离', 620, 452, { size: 15, anchor: 'start' }),
        T('二级点火，继续加速', 620, 478, { size: 13, color: GRAY, anchor: 'start' }),
        PATH('M300 380 l-40 40', { stroke: RED, width: 2, opacity: 0.7 }),
      ],
    },
    {
      page: 1,
      title: '整流罩分离',
      text: '已经冲出稠密大气，整流罩没用了。两瓣罩子向两侧弹开，露出卫星——这一步之后，气动外形已经不重要。',
      chips: ['整流罩', '真空'],
      items: [
        TAG('整流罩分离', 500, 538, { w: 128, h: 34, size: 14, color: GREEN, fill: 'rgba(232,244,226,0.75)' }),
        T('两瓣弹开，露出卫星', 640, 544, { size: 15, anchor: 'start' }),
        PATH('M300 250 q-50 -30 -80 -10 M300 250 q50 -30 80 -10', { stroke: GREEN, width: 2 }),
      ],
    },
    {
      page: 1,
      title: '入轨：不是“到高度”，是“到速度”',
      text: '轨道不是地点，是速度。7.9 km/s 时，飞行器下落的曲线正好跟上地球的弯曲，于是它一直在“掉”，却永远掉不到地面。',
      chips: ['第一宇宙速度'],
      items: [
        TAG('入轨 7.9 km/s', 500, 600, { w: 150, h: 34, size: 14, color: RED, fill: 'rgba(255,245,238,0.75)' }),
        T('速度够了，才叫“在轨”', 670, 606, { size: 14, anchor: 'start' }),
      ],
    },

    {
      page: 2,
      title: '为什么现在要回收',
      text: '传统火箭一次性使用：箭体、发动机、航电占了大头成本，打一次扔一次。回收不是为了“环保”，是为了把最贵的那部分拿回来。',
      chips: ['成本', '复用'],
      items: [
        T('一枚火箭的钱，花在哪', 500, 62, { size: 24, color: RED, rot: -1 }),
        TAG('一级 · 发动机', 330, 190, { w: 170, h: 46, size: 15, color: BLUE, fill: 'rgba(255,255,255,0.6)' }),
        T('约 60–70%', 330, 232, { size: 15, color: BLUE }),
        TAG('二级', 330, 300, { w: 130, h: 42, size: 15, color: GREEN, fill: 'rgba(232,244,226,0.7)' }),
        T('约 15%', 330, 338, { size: 14, color: GREEN }),
        TAG('整流罩', 330, 392, { w: 130, h: 42, size: 15, color: GOLD, fill: 'rgba(255,248,225,0.7)' }),
        T('约 10%', 330, 430, { size: 14, color: GOLD }),
        T('回收一级，等于把最大的一块成本拿回来', 700, 220, { size: 16, color: RED }),
      ],
    },
    {
      page: 3,
      title: '怎么让它稳稳落下来',
      text: '再入时用栅格舵控制姿态，发动机多次点火反推减速，最后用着陆腿缓冲。整个过程要在几秒内把速度从超音速降到零。',
      chips: ['栅格舵', '反推'],
      items: [
        P('rocket', 260, 470, { scale: 1.1, flame: false }),
        PATH('M236 344 h-18 v-14 h18 Z M284 344 h18 v-14 h-18 Z', { stroke: GRAY, width: 1.8, fill: 'rgba(255,255,255,0.5)' }),
        T('栅格舵', 180, 320, { size: 13, color: GRAY }),
        PATH('M226 472 l-24 42 M294 472 l24 42', { stroke: '#8a6b4f', width: 4 }),
        T('着陆腿', 340, 510, { size: 13, color: '#8a6b4f' }),
        PATH('M120 556 h280 v16 h-280 Z', { stroke: GRAY, width: 2, fill: 'rgba(120,110,90,0.18)' }),
        T('回收船', 260, 594, { size: 13, color: GRAY }),
        A([360, 520], [430, 540], { color: BLUE, bend: -0.1 }),
        T('反推减速 → 触地', 560, 548, { size: 15, color: BLUE }),
      ],
    },
    {
      page: 4,
      title: '复用到底省了多少',
      text: '如果一级能复用 10 次，分摊到每次的箭体成本就降到十分之一；但翻修、检测、发射场占用也要钱。可复用不是免费，是把“制造”换成“维护”。',
      chips: ['复用账'],
      items: [
        PATH('M620 420 h300', { stroke: GRAY, width: 1.6 }),
        PATH('M620 420 v-140', { stroke: GRAY, width: 1.6 }),
        PATH('M660 420 v-170 h50 v170 Z', { stroke: BLUE, width: 2, fill: 'rgba(47,93,143,0.16)' }),
        PATH('M780 420 v-34 h50 v34 Z', { stroke: GREEN, width: 2, fill: 'rgba(44,115,85,0.18)' }),
        T('一次性', 685, 442, { size: 14, color: BLUE }),
        T('复用 10 次', 805, 442, { size: 14, color: GREEN }),
        T('每次的箭体成本 ≈ 1/10', 770, 480, { size: 16, color: RED }),
        T('但翻修与检测也是成本', 770, 508, { size: 13, color: GRAY }),
      ],
    },
  ],
  quiz: [
    { q: '火箭在真空中也能加速，靠的是什么？', options: ['空气的反作用力', '向下喷气产生的反作用力', '机翼升力', '地球引力'], answer: 1, why: '牛顿第三定律：喷出的燃气给火箭反作用力，不需要空气。' },
    { q: '“入轨”真正的要求是？', options: ['飞到 100 公里以上', '速度达到约 7.9 km/s 的横向速度', '飞出大气层即可', '发动机一直开着'], answer: 1, why: '轨道是速度问题：横向速度足够时，下落曲线与地球曲率匹配。' },
    { q: '火箭分级的主要目的是？', options: ['让外观更好看', '抛掉空油箱与结构，减少死重', '方便回收', '降低发动机推力'], answer: 1, why: '分级把已经用完的质量扔掉，让剩下部分轻装继续加速。' },
  ],
};

/* ================================ 桥梁建造 ================================ */
const BRIDGE = {
  steps: [
    {
      page: 0,
      title: '先看要跨多远',
      text: '桥的第一问不是“造什么样式”，而是跨度、地质、通航和造价。500 米的跨度，直接把梁桥排除了一半。',
      chips: ['跨度', '选型'],
      items: [
        T('跨过 500 米，用什么桥', 500, 62, { size: 24, color: RED, rot: -1 }),
        PATH('M60 470 h240 l30 40 h-270 Z', { stroke: GRAY, width: 2, fill: 'rgba(160,150,120,0.2)' }),
        PATH('M700 470 h240 l30 40 h-270 Z', { stroke: GRAY, width: 2, fill: 'rgba(160,150,120,0.2)' }),
        PATH('M300 500 q40 -12 80 0 q40 12 80 0 q40 -12 80 0 q40 12 80 0', { stroke: '#4f8fb0', width: 2, opacity: 0.6 }),
        T('500 m', 500, 560, { size: 20, color: BLUE }),
        A([330, 560], [670, 560], { color: BLUE, bend: 0 }),
      ],
    },
    {
      page: 1,
      title: '梁桥：越跨越弯',
      text: '最简单的梁，靠自身抗弯。弯矩随跨度的平方增长：跨度翻倍，弯矩变四倍——所以梁桥的跨度上不去。',
      chips: ['梁桥', '弯矩'],
      items: [
        PATH('M300 360 h400 v22 h-400 Z', { stroke: GRAY, width: 2, fill: 'rgba(180,170,140,0.25)' }),
        PATH('M340 470 v-88 M660 470 v-88', { stroke: GRAY, width: 3 }),
        PATH('M320 392 q180 44 360 0', { stroke: RED, width: 2.4, opacity: 0.8 }),
        T('跨中下挠', 500, 430, { size: 14, color: RED }),
        T('M ∝ L²', 760, 330, { size: 20, color: RED }),
      ],
    },
    {
      page: 2,
      title: '拱桥：把弯变成压',
      text: '拱把竖向荷载转成沿拱轴的压力，送到两岸的拱脚。石、混凝土抗压很强，所以拱桥能做得又大又久。',
      chips: ['拱桥', '压力'],
      items: [
        PATH('M300 470 q200 -190 400 0', { stroke: BLUE, width: 6, fill: 'none' }),
        PATH('M300 470 h-40 v34 h40 Z M700 470 h40 v34 h-40 Z', { stroke: GRAY, width: 2, fill: 'rgba(160,150,120,0.25)' }),
        A([390, 400], [330, 470], { color: RED, bend: 0.1 }),
        A([610, 400], [670, 470], { color: RED, bend: -0.1 }),
        T('压力沿拱传到两岸', 500, 300, { size: 15, color: RED }),
      ],
    },
    {
      page: 3,
      title: '桁架：三角形不会变形',
      text: '四边形受力会变成平行四边形，三角形不会。用三角形拼出的桁架，把弯矩拆成一根根杆的拉与压，用料更省。',
      chips: ['桁架', '三角形'],
      items: [
        PATH('M330 360 h340 v80 h-340 Z', { stroke: GRAY, width: 2 }),
        PATH('M330 360 l56 80 l57 -80 l57 80 l57 -80 l57 80 l56 -80', { stroke: BLUE, width: 2 }),
        T('上弦受压 · 下弦受拉', 500, 470, { size: 15, color: GRAY }),
        T('斜杆把剪力传走', 500, 498, { size: 13, color: GRAY }),
      ],
    },
    {
      page: 4,
      title: '悬索桥：把力送到塔和锚碇',
      text: '主缆是一根巨大的弧线，吊索把桥面挂上去。荷载经主缆传到塔顶，再由塔传到地基、由锚碇拉住两端。',
      chips: ['悬索桥', '主缆'],
      items: [
        PATH('M330 470 v-170 M670 470 v-170', { stroke: GRAY, width: 5 }),
        PATH('M330 300 q170 120 340 0', { stroke: RED, width: 5, fill: 'none' }),
        PATH('M330 330 v140 M386 360 v110 M442 382 v88 M498 390 v80 M554 382 v88 M610 360 v110 M666 330 v140', { stroke: GRAY, width: 1.4, opacity: 0.6 }),
        PATH('M300 470 h400 v16 h-400 Z', { stroke: GRAY, width: 2, fill: 'rgba(180,170,140,0.25)' }),
        TAG('锚碇', 280, 500, { w: 80, h: 34, size: 14, color: GOLD, fill: 'rgba(255,248,225,0.7)' }),
        TAG('锚碇', 720, 500, { w: 80, h: 34, size: 14, color: GOLD, fill: 'rgba(255,248,225,0.7)' }),
      ],
    },
    {
      page: 5,
      title: '斜拉桥：索直接拉桥面',
      text: '和悬索不同，斜拉的索直接连到桥面，力走的是“桥面—索—塔”的短路径。跨度 200–1000 米时，它比悬索更经济。',
      chips: ['斜拉桥'],
      items: [
        T('另一种拉法：斜拉桥', 500, 62, { size: 24, color: RED, rot: -1 }),
        PATH('M500 470 v-230', { stroke: GRAY, width: 6 }),
        PATH('M500 250 L360 470 M500 250 L640 470 M500 280 L400 470 M500 280 L600 470 M500 310 L440 470 M500 310 L560 470', { stroke: BLUE, width: 1.8, opacity: 0.75 }),
        PATH('M300 470 h400 v16 h-400 Z', { stroke: GRAY, width: 2, fill: 'rgba(180,170,140,0.25)' }),
        T('索距越密，桥面受力越均匀', 500, 540, { size: 14, color: GRAY }),
      ],
    },
    {
      page: 6,
      title: '地基：桥最后是站在土里的',
      text: '塔和桥台要把力传进河床。软弱地层要打桩到持力层，深水区用沉井或围堰。上部结构再漂亮，基础不稳就全白搭。',
      chips: ['桩基', '沉井'],
      items: [
        PATH('M300 470 h400', { stroke: GRAY, width: 2 }),
        PATH('M330 500 v90 M370 500 v70 M410 500 v90 M590 500 v90 M630 500 v70 M670 500 v90', { stroke: '#8a6b4f', width: 4 }),
        PATH('M280 590 h440', { stroke: '#8a6b4f', width: 2, opacity: 0.4 }),
        T('桩打到持力层', 720, 560, { size: 15, color: '#8a6b4f' }),
        TAG('软土', 500, 620, { w: 80, h: 30, size: 13, color: GRAY, fill: 'rgba(255,255,255,0.5)' }),
      ],
    },
    {
      page: 7,
      title: '施工顺序：先塔，后索，再吊梁',
      text: '悬索桥不能先造桥面：先建塔与锚碇，再架猫道、拉主缆，最后从中间向两边吊装桥面。顺序错了，结构受力就变了。',
      chips: ['施工', '顺序'],
      items: [
        TAG('① 塔与锚碇', 300, 250, { w: 150, h: 40, size: 15, color: BLUE, fill: 'rgba(255,255,255,0.6)' }),
        TAG('② 主缆与吊索', 300, 320, { w: 160, h: 40, size: 15, color: GREEN, fill: 'rgba(232,244,226,0.7)' }),
        TAG('③ 桥面吊装', 300, 390, { w: 140, h: 40, size: 15, color: GOLD, fill: 'rgba(255,248,225,0.7)' }),
        A([300, 270], [300, 300], { color: GRAY, bend: 0 }),
        A([300, 340], [300, 370], { color: GRAY, bend: 0 }),
        T('顺序本身就是结构设计的一部分', 700, 330, { size: 16, color: RED }),
      ],
    },
    {
      page: 8,
      title: '风：桥最怕的不是重，是抖',
      text: '1940 年塔科马海峡大桥在 19 m/s 的风里扭断——不是被吹倒，是颤振。现代大跨桥用流线型箱梁、导流板与阻尼器抑制。',
      chips: ['颤振', '风洞'],
      items: [
        PATH('M620 300 q140 -50 280 0', { stroke: GRAY, width: 2 }),
        PATH('M640 300 q120 40 240 0', { stroke: RED, width: 2, opacity: 0.6 }),
        PATH('M700 380 q120 -40 240 0 q-120 40 -240 0 Z', { stroke: BLUE, width: 2, fill: 'rgba(47,93,143,0.12)' }),
        T('流线型箱梁', 820, 420, { size: 14, color: BLUE }),
        TAG('风洞试验', 760, 480, { w: 140, h: 40, size: 14, color: GOLD, fill: 'rgba(255,248,225,0.7)' }),
        T('抗风，是跨度的上限', 500, 560, { size: 16, color: RED }),
      ],
    },
    {
      page: 9,
      title: '选型：没有最好，只有合适',
      text: '500 米以内：梁桥、拱桥更经济；500–1000 米：斜拉桥主沉浮；1000 米以上：悬索桥。再叠加地质、通航、造价与工期。',
      chips: ['选型'],
      items: [
        TAG('梁桥 < 200 m', 240, 260, { w: 180, h: 44, size: 15, color: GRAY, fill: 'rgba(255,255,255,0.55)' }),
        TAG('拱桥 200–500 m', 240, 330, { w: 190, h: 44, size: 15, color: BLUE, fill: 'rgba(255,255,255,0.6)' }),
        TAG('斜拉 200–1000 m', 240, 400, { w: 200, h: 44, size: 15, color: GREEN, fill: 'rgba(232,244,226,0.7)' }),
        TAG('悬索 > 1000 m', 240, 470, { w: 180, h: 44, size: 15, color: RED, fill: 'rgba(255,245,238,0.7)' }),
        T('跨度定类型，地质定基础，造价定细节', 660, 360, { size: 17, color: RED }),
        S(900, 560, { size: 18, color: GOLD }),
      ],
    },
  ],
  quiz: [
    { q: '梁桥跨度上不去，主要原因是？', options: ['材料太贵', '弯矩随跨度平方增长', '施工太慢', '桥面太宽'], answer: 1, why: '简支梁的弯矩与跨度平方成正比，跨度翻倍弯矩变四倍。' },
    { q: '悬索桥的主缆把荷载主要传给？', options: ['桥面', '塔与锚碇', '河水', '路面'], answer: 1, why: '主缆经塔顶把竖向力传入地基，两端由锚碇平衡水平拉力。' },
    { q: '塔科马桥倒塌的直接原因是？', options: ['超载', '风致颤振', '地震', '船撞'], answer: 1, why: '低风速下的扭转颤振，不是被风吹倒，而是结构自振与风耦合失稳。' },
  ],
};

export const SYSTEM_SCENES = {
  'physics-rocket': ROCKET,
  'architect-bridge': BRIDGE,
};
