/**
 * 关卡装配：把「知识点」翻译成一段可以演出来的剧本。
 * 手写剧本在 lesson-content.js，其余知识点由引擎规格 + 分幕变量自动生成。
 */
import { ALL_POINTS, POINT_BY_ID } from './subjects.js';
import { BOARD_LESSONS } from './board-content.js';
import { buildNarrativeBoard } from './board-gen.js';
import { ENGLISH_SCENES } from './english-scenes.js';
import { SYSTEM_SCENES } from './system-scenes.js';
import { DUJIANGYAN } from './dujiangyan.js';

/* --------------------------- 每个知识点的舞台规格 --------------------------- */
export const ENGINE_SPECS = {
  /* 数学 */
  'math-golden': ['ratio', { mode: 'rectangle', tone: '#5B9DFF' }],
  'math-probability': ['grid', { mode: 'probability', tone: '#5B9DFF' }],
  'math-pythagoras': ['geometry', { tone: '#5B9DFF' }],
  'math-fibonacci': ['ratio', { mode: 'phyllotaxis', tone: '#5B9DFF' }],
  'math-calculus': ['curve', { mode: 'tangent', xLabel: 'x', yLabel: 'f(x)', tone: '#5B9DFF' }],

  /* 物理 */
  'physics-buoyancy': ['fluid', { mode: 'buoy', tone: '#9B7BFF' }],
  'physics-induction': ['induction', { tone: '#9B7BFF' }],
  'physics-lever': ['mech', { mode: 'lever', tone: '#9B7BFF' }],

  /* 化学 */
  'chemistry-combustion': ['heat', { mode: 'flame', tone: '#2FE0A8' }],
  'chemistry-crystal': ['grid', { mode: 'lattice', tone: '#2FE0A8' }],
  'chemistry-dissolve': ['dissolve', { tone: '#2FE0A8' }],
  'chemistry-periodic': ['grid', { mode: 'periodic', tone: '#2FE0A8' }],

  /* 英语 */
  'english-preposition': ['space', { tone: '#FFC94D' }],
  'english-tense': [
    'timeline',
    {
      mode: 'tense',
      tone: '#FFC94D',
      rows: [
        { label: '过去', points: [{ x: 200, text: 'did', color: '#FF8E6B' }, { x: 330, text: 'was doing', color: '#FF8E6B' }] },
        { label: '现在', points: [{ x: 500, text: 'do', color: '#FFC94D' }, { x: 610, text: 'have done', color: '#FFC94D' }] },
        { label: '将来', points: [{ x: 800, text: 'will do', color: '#6BE7FF' }] },
      ],
      note: '时间 + 体，两条轴交叉出十六种时态',
    },
  ],
  'english-wordtree': [
    'graph',
    {
      mode: 'tree',
      tone: '#FFC94D',
      labels: ['spect', 'inspect', 'respect', 'spectator', 'perspective', 'suspect', 'aspect', 'expect', '', '', '', '', '', '', ''],
    },
  ],

  /* 生物 */
  'biology-dna': ['orbit', { mode: 'helix', tone: '#79E86B' }],
  'biology-cell': ['orbit', { mode: 'cell', tone: '#79E86B' }],
  'biology-foodchain': [
    'cycle',
    {
      tone: '#79E86B',
      center: '能量流动',
      nodes: [{ label: '草' }, { label: '兔' }, { label: '狐' }, { label: '分解者' }],
      notes: ['生产者：把阳光变成化学能', '初级消费者：吃草，只同化约 10% 的能量', '次级消费者：吃兔，能量再次递减', '分解者：把有机物还原成无机物'],
    },
  ],
  'biology-immune': [
    'cycle',
    {
      tone: '#79E86B',
      center: '免疫应答',
      nodes: [{ label: '抗原' }, { label: '树突细胞' }, { label: 'B 细胞' }, { label: '抗体' }, { label: '记忆细胞' }],
      notes: ['病原体表面的“身份证”', '抓住抗原，去淋巴结报信', '被激活后分化成浆细胞', '特异性结合抗原，让它失效', '下次同样的抗原再来，几天就能响应'],
    },
  ],

  /* 地理 */
  'geography-earth': ['map', { mode: 'layers', tone: '#56D9C7' }],
  'geography-monsoon': ['map', { mode: 'terrain', tone: '#56D9C7', note: '海陆热力差异 + 地转偏向力 → 季风' }],
  'geography-plates': ['map', { mode: 'plates', tone: '#56D9C7' }],
  'geography-ocean': ['fluid', { mode: 'current', tone: '#56D9C7' }],
  'geography-karst': ['map', { mode: 'terrain', variant: 'karst', tone: '#56D9C7', note: '含 CO₂ 的水沿裂隙溶蚀石灰岩' }],

  /* 历史 */
  'history-silkroad': [
    'map',
    {
      mode: 'route',
      tone: '#FFB86B',
      points: [
        { name: '长安', x: 150, y: 470 },
        { name: '敦煌', x: 330, y: 436 },
        { name: '撒马尔罕', x: 500, y: 410 },
        { name: '巴格达', x: 670, y: 442 },
        { name: '君士坦丁堡', x: 830, y: 402 },
      ],
      notes: ['起点：丝绸、瓷器、茶叶从这里西去', '河西走廊的咽喉，商队在此补给', '中亚枢纽，粟特商人主导贸易', '阿拔斯王朝的都城，知识也随商品流动', '终点：丝绸比黄金还贵'],
    },
  ],
  'history-printing': [
    'timeline',
    {
      mode: 'press',
      tone: '#FFB86B',
      stages: ['刻字', '排版', '涂墨', '印刷', '拆版'],
      notes: [
        '用胶泥刻出单个反字，火烧成硬字',
        '按韵取字，排在铁板上，松香固定',
        '墨匀刷在字面，纸覆上去',
        '一版可印数百份，字可重复使用',
        '拆版，字归回字架，下次再用',
      ],
      formula: '活字 = 可拆分 + 可复用',
    },
  ],
  'history-zhenghe': [
    'map',
    {
      mode: 'route',
      tone: '#FFB86B',
      points: [
        { name: '太仓', x: 800, y: 392 },
        { name: '占城', x: 700, y: 432 },
        { name: '满剌加', x: 610, y: 470 },
        { name: '锡兰', x: 520, y: 502 },
        { name: '古里', x: 430, y: 520 },
        { name: '忽鲁谟斯', x: 310, y: 478 },
        { name: '麻林地', x: 200, y: 540 },
      ],
      notes: ['刘家港出发，船队两百余艘', '沿中南半岛南下', '控制马六甲海峡的贸易节点', '绕过印度洋', '古里是重要的贸易与补给站', '进入波斯湾', '最远抵达东非海岸'],
    },
  ],
  'history-grandcanal': [
    'map',
    {
      mode: 'route',
      tone: '#FFB86B',
      points: [
        { name: '涿郡', x: 720, y: 382 },
        { name: '洛阳', x: 560, y: 430 },
        { name: '汴州', x: 630, y: 458 },
        { name: '扬州', x: 710, y: 492 },
        { name: '余杭', x: 790, y: 520 },
      ],
      notes: ['北端，军用与漕粮的终点', '中心枢纽，连接黄河与淮河', '汴渠要冲，商旅云集', '运河与长江交汇，盐商富甲天下', '南端，江南粮仓的出口'],
    },
  ],
  'history-reform': [
    'timeline',
    {
      mode: 'era',
      tone: '#FFB86B',
      eras: [
        { name: '变法前', span: 1, color: '#6B7280' },
        { name: '商鞅变法', span: 1.8, color: '#F2C24E' },
        { name: '秦强', span: 1.2, color: '#FF8E6B' },
      ],
      events: [
        { x: 210, year: '前 356', text: '徙木立信' },
        { x: 420, year: '前 350', text: '第一次变法' },
        { x: 620, year: '前 338', text: '商鞅被杀' },
        { x: 800, year: '前 221', text: '秦统一' },
      ],
      note: '制度改变激励，激励改变行为',
    },
  ],

  /* 程序员 */
  'programmer-hanoi': ['graph', { mode: 'hanoi', tone: '#00E1FF' }],
  'programmer-network': [
    'graph',
    {
      mode: 'network',
      tone: '#00E1FF',
      labels: ['HTTP / DNS', 'TCP / UDP', 'IP / 路由', '以太网 / WiFi'],
    },
  ],
  'programmer-hash': ['graph', { mode: 'hash', tone: '#00E1FF' }],
  'programmer-lock': ['graph', { mode: 'lock', tone: '#00E1FF' }],
  'programmer-compiler': ['graph', { mode: 'compiler', tone: '#00E1FF' }],

  /* 设计师 */
  'designer-color': ['wheel', { tone: '#FF7AD9' }],
  'designer-grid': ['layout', { mode: 'grid', tone: '#FF7AD9' }],
  'designer-bezier': ['bezier', { tone: '#FF7AD9' }],
  'designer-typescale': ['layout', { mode: 'typescale', tone: '#FF7AD9' }],

  /* 厨师 */
  'chef-heat': ['heat', { mode: 'pan', tone: '#FFB86B' }],
  'chef-dough': ['heat', { mode: 'ferment', tone: '#FFB86B' }],
  'chef-ferment': ['heat', { mode: 'ferment', tone: '#FFB86B' }],
  'chef-emulsion': ['heat', { mode: 'emulsion', tone: '#FFB86B' }],

  /* 建筑 */
  'architect-arch': ['mech', { mode: 'arch', tone: '#56D9C7' }],
  'architect-truss': ['mech', { mode: 'truss', tone: '#56D9C7' }],
  'architect-wind': ['mech', { mode: 'wind', tone: '#56D9C7' }],

  /* 渔民 */
  'fisher-buoy': ['fluid', { mode: 'buoy', tone: '#3FB8D6' }],
  'fisher-tide': ['fluid', { mode: 'tide', tone: '#3FB8D6' }],
  'fisher-sonar': ['sonar', { tone: '#3FB8D6' }],
  'fisher-pressure': ['pressure', { tone: '#3FB8D6' }],

  /* 农民 */
  'farmer-solarterms': [
    'cycle',
    {
      tone: '#8FD14F',
      center: '二十四节气',
      nodes: [{ label: '立春' }, { label: '春分' }, { label: '立夏' }, { label: '夏至' }, { label: '立秋' }, { label: '秋分' }, { label: '立冬' }, { label: '冬至' }],
      notes: ['东风解冻，开始备耕', '昼夜等长，播种的关键窗口', '作物进入旺长期', '白昼最长，光照最足', '暑气渐退，开始灌浆', '昼夜再次等长，秋收', '收藏入库，准备越冬', '白昼最短，计算来年的起点'],
    },
  ],
  'farmer-terrace': ['terrace', { tone: '#8FD14F' }],
  'farmer-irrigation': ['terrace', { tone: '#8FD14F' }],
  'farmer-rotation': [
    'cycle',
    {
      tone: '#8FD14F',
      center: '轮作',
      nodes: [{ label: '玉米' }, { label: '大豆' }, { label: '小麦' }],
      notes: ['禾本科，耗氮多', '豆科，根瘤菌固氮，把氮还给土壤', '越冬作物，利用冬春的光与水分'],
    },
  ],
};

/* ------------------------------ 变量（滑杆） ------------------------------ */
const V = (key, label, min, max, step, digits = 2, unit = '') => ({ key, label, min, max, step, digits, unit });

export const VAR_SPECS = {
  'math-golden': [V('depth', '分割层数', 0, 1, 0.01), V('spiral', '螺线浓度', 0, 1, 0.01)],
  'math-probability': [V('trials', '试验次数', 0, 1, 0.01)],
  'math-pythagoras': [V('a', '直角边 a', 1.2, 7, 0.1, 1), V('b', '直角边 b', 1.2, 6, 0.1, 1)],
  'math-fibonacci': [V('count', '种子数量', 10, 240, 1, 0), V('angle', '相邻夹角 (°)', 100, 180, 0.5, 1, '°')],
  'math-calculus': [V('h', '时间间隔 Δx', 0.02, 1.6, 0.01), V('t', '切点位置', 0, 1, 0.01)],

  'physics-buoyancy': [V('density', '物体密度 (g/cm³)', 0.1, 1.4, 0.01)],
  'physics-induction': [V('speed', '磁铁速度', 0, 1, 0.01)],
  'physics-lever': [V('ratio', '左力臂长度', 0, 1, 0.01)],

  'chemistry-combustion': [V('air', '进风量', 0, 1, 0.01)],
  'chemistry-crystal': [V('temp', '温度', 0, 1, 0.01)],
  'chemistry-dissolve': [V('temp', '水温', 0, 1, 0.01), V('dissolve', '已溶解比例', 0, 1, 0.01)],
  'chemistry-periodic': [V('focus', '原子序数', 0, 53, 1, 0)],

  'english-preposition': [V('pos', '换一个介词', 0, 2.99, 0.01)],
  'english-tense': [V('cursor', '时间位置', 0, 1, 0.01)],
  'english-wordtree': [V('step', '展开词族', 0.06, 1, 0.01)],

  'biology-dna': [V('speed', '解旋速度', 0, 1.4, 0.01)],
  'biology-cell': [V('nucleus', '细胞核', 0, 1, 0.01), V('mito', '线粒体', 0, 1, 0.01)],
  'biology-foodchain': [V('focus', '营养级', 0, 3, 1, 0), V('speed', '能量流速', 0.05, 1.2, 0.01)],
  'biology-immune': [V('focus', '应答阶段', 0, 4, 1, 0), V('speed', '反应速度', 0.05, 1.2, 0.01)],

  'geography-earth': [V('focus', '圈层', 0, 1, 0.01)],
  'geography-monsoon': [V('wind', '风力', 0, 1, 0.01), V('rain', '降水', 0, 1, 0.01)],
  'geography-plates': [V('move', '板块运动', 0, 1, 0.01), V('subduct', '俯冲深度', 0, 1, 0.01)],
  'geography-ocean': [V('wave', '洋流强度', 0, 1, 0.01)],
  'geography-karst': [V('rain', '降水', 0, 1, 0.01), V('wind', '地下水流速', 0, 1, 0.01)],

  'history-silkroad': [V('progress', '商队位置', 0, 1, 0.01)],
  'history-printing': [V('step', '工序', 0, 1, 0.01)],
  'history-zhenghe': [V('progress', '航行进度', 0, 1, 0.01)],
  'history-grandcanal': [V('progress', '漕运进度', 0, 1, 0.01)],
  'history-reform': [V('focus', '时间', 0, 1, 0.01)],

  'programmer-hanoi': [V('n', '盘子数', 1, 6, 1, 0), V('progress', '解法进度', 0, 1, 0.01)],
  'programmer-network': [V('flow', '传输速率', 0, 1, 0.01)],
  'programmer-hash': [V('fill', '已插入键', 0, 1, 0.01)],
  'programmer-lock': [V('locked', '加锁', 0, 1, 0.01)],
  'programmer-compiler': [V('stage', '编译阶段', 0, 1, 0.01)],

  'designer-color': [V('base', '色相', 0, 1, 0.01), V('scheme', '配色方案', 0, 2, 1, 0)],
  'designer-grid': [V('cols', '栅格列数', 2, 12, 1, 0), V('gutter', '槽宽', 0, 1, 0.01)],
  'designer-bezier': [V('p1', '控制点 P1', 0, 1, 0.01), V('p2', '控制点 P2', 0, 1, 0.01), V('sharp', '曲率', 0, 1, 0.01)],
  'designer-typescale': [V('lh', '行高倍数', 1.05, 2.4, 0.01), V('tracking', '字距 (px)', -1, 8, 0.1, 1, 'px')],

  'chef-heat': [V('heat', '锅温', 0.1, 1, 0.01), V('time', '加热时间', 0, 1, 0.01)],
  'chef-dough': [V('temp', '室温 (°C)', 4, 55, 1, 0, '°C'), V('time', '发酵时间', 0, 1, 0.01)],
  'chef-ferment': [V('temp', '温度 (°C)', 4, 55, 1, 0, '°C'), V('time', '发酵时间', 0, 1, 0.01)],
  'chef-emulsion': [V('agitation', '搅拌强度', 0, 1, 0.01)],

  'architect-arch': [V('load', '拱顶荷载', 0, 1, 0.01)],
  'architect-truss': [V('load', '桥面荷载', 0, 1, 0.01)],
  'architect-wind': [V('wind', '风速', 0, 1, 0.01)],

  'fisher-buoy': [V('density', '浮标密度', 0.1, 1.3, 0.01)],
  'fisher-tide': [V('moon', '月相', 0, 1, 0.01)],
  'fisher-sonar': [V('depth', '海底深度', 0, 1, 0.01)],
  'fisher-pressure': [V('pressure', '气压', 0, 1, 0.01)],

  'farmer-solarterms': [V('focus', '节气', 0, 7, 1, 0)],
  'farmer-terrace': [V('level', '水位', 0, 1, 0.01), V('flow', '流速', 0, 1, 0.01)],
  'farmer-irrigation': [V('level', '渠水高度', 0, 1, 0.01), V('flow', '流量', 0, 1, 0.01)],
  'farmer-rotation': [V('focus', '轮作季', 0, 2, 1, 0)],
};

/* ---------------------------- 每个引擎的分幕状态 ---------------------------- */
const BEAT_STATES = {
  'ratio:rectangle': [{ depth: 0.25, spiral: 0.2 }, { depth: 0.55, spiral: 0.6 }, { depth: 1, spiral: 1 }, { depth: 0.7, spiral: 0.8 }],
  'ratio:phyllotaxis': [{ count: 40, angle: 137.5 }, { count: 120, angle: 137.5 }, { count: 210, angle: 137.5 }, { count: 180, angle: 92 }],
  'grid:probability': [{ trials: 0.1 }, { trials: 0.4 }, { trials: 0.75 }, { trials: 1 }],
  'geometry:default': [{ a: 3.0, b: 2.2, squares: 0.15 }, { a: 4.2, b: 3, squares: 0.75 }, { a: 5.4, b: 4.2, squares: 1 }, { a: 3.6, b: 4.8, squares: 1 }],
  'curve:tangent': [{ h: 1.4, t: 0.45 }, { h: 0.8, t: 0.5 }, { h: 0.12, t: 0.5 }, { h: 0.03, t: 0.5 }],
  'curve:parabola': [{ a: 0.8, b: 2.6, t: 0.15 }, { a: 1.1, b: 3.0, t: 0.5 }, { a: 2.0, b: 3.6, t: 0.78 }, { a: 1.0, b: 3.0, t: 0.5 }],

  'fluid:buoy': [{ density: 0.35 }, { density: 0.72 }, { density: 0.98 }, { density: 1.25 }],
  'fluid:tide': [{ moon: 0.1, wave: 0.5 }, { moon: 0.5, wave: 0.8 }, { moon: 0.9, wave: 1 }],
  'fluid:current': [{ wave: 0.2 }, { wave: 0.6 }, { wave: 1 }],
  'induction:default': [{ speed: 0.2 }, { speed: 0.6 }, { speed: 1 }, { speed: 0 }],
  'mech:lever': [{ ratio: 0.2 }, { ratio: 0.5 }, { ratio: 1 }, { ratio: 0.75 }],

  'heat:flame': [{ air: 0.15 }, { air: 0.55 }, { air: 0.95 }, { air: 0.35 }],
  'heat:pan': [{ heat: 0.3, time: 0.1 }, { heat: 0.7, time: 0.35 }, { heat: 0.92, time: 0.6 }, { heat: 1, time: 0.95 }],
  'heat:ferment': [{ temp: 12, time: 0.1 }, { temp: 28, time: 0.45 }, { temp: 42, time: 0.85 }, { temp: 58, time: 1 }],
  'heat:emulsion': [{ agitation: 0.1 }, { agitation: 0.45 }, { agitation: 0.8 }, { agitation: 1 }],
  'grid:lattice': [{ temp: 0.1 }, { temp: 0.35 }, { temp: 0.65 }, { temp: 1 }],
  'grid:periodic': [{ focus: 3 }, { focus: 20 }, { focus: 38 }, { focus: 52 }],
  'dissolve:default': [{ temp: 0.15, dissolve: 0.05 }, { temp: 0.5, dissolve: 0.35 }, { temp: 0.9, dissolve: 0.8 }, { temp: 0.5, dissolve: 1 }],

  'space:default': [{ pos: 0 }, { pos: 1 }, { pos: 2 }, { pos: 0.5 }],
  'timeline:tense': [{ cursor: 0.15 }, { cursor: 0.45 }, { cursor: 0.7 }, { cursor: 0.95 }],
  'graph:tree': [{ step: 0.2 }, { step: 0.55 }, { step: 0.8 }, { step: 1 }],

  'orbit:helix': [{ speed: 0.2 }, { speed: 0.6 }, { speed: 1 }, { speed: 0.5 }],
  'orbit:cell': [{ nucleus: 0.2, mito: 0.2 }, { nucleus: 1, mito: 0.4 }, { nucleus: 1, mito: 1 }, { nucleus: 0.6, mito: 1 }],
  'orbit:molecule': [{ angle: 180 }, { angle: 104.5 }, { angle: 104.5 }, { angle: 178 }],
  'cycle:default': [{ focus: 0, speed: 0.3 }, { focus: 1, speed: 0.7 }, { focus: 2, speed: 1 }, { focus: 3, speed: 0.8 }],

  'map:layers': [{ focus: 0.05 }, { focus: 0.3 }, { focus: 0.55 }, { focus: 0.95 }],
  'map:terrain': [{ wind: 0.2, rain: 0.15 }, { wind: 0.55, rain: 0.45 }, { wind: 0.85, rain: 0.8 }, { wind: 0.4, rain: 0.6 }],
  'map:plates': [{ move: 0.15, subduct: 0.1 }, { move: 0.5, subduct: 0.4 }, { move: 0.85, subduct: 0.8 }, { move: 1, subduct: 1 }],
  'map:route': [{ progress: 0.1 }, { progress: 0.4 }, { progress: 0.7 }, { progress: 1 }],
  'timeline:press': [{ step: 0.15 }, { step: 0.4 }, { step: 0.7 }, { step: 1 }],
  'timeline:era': [{ focus: 0.15 }, { focus: 0.4 }, { focus: 0.7 }, { focus: 0.95 }],

  'graph:hanoi': [{ n: 2, progress: 0.2 }, { n: 3, progress: 0.5 }, { n: 4, progress: 0.75 }, { n: 4, progress: 1 }],
  'graph:network': [{ flow: 0.2 }, { flow: 0.5 }, { flow: 0.8 }, { flow: 1 }],
  'graph:hash': [{ fill: 0.25 }, { fill: 0.5 }, { fill: 0.8 }, { fill: 1 }],
  'graph:lock': [{ locked: 0 }, { locked: 0.5 }, { locked: 1 }, { locked: 1 }],
  'graph:compiler': [{ stage: 0.15 }, { stage: 0.4 }, { stage: 0.75 }, { stage: 1 }],

  'wheel:default': [{ base: 0.08, scheme: 0 }, { base: 0.08, scheme: 1 }, { base: 0.35, scheme: 2 }, { base: 0.6, scheme: 1 }],
  'layout:grid': [{ cols: 4, gutter: 0.2 }, { cols: 8, gutter: 0.4 }, { cols: 12, gutter: 0.3 }, { cols: 12, gutter: 0.55 }],
  'layout:contrast': [{ scale: 0.05, contrast: 0.7 }, { scale: 0.55, contrast: 0.7 }, { scale: 0.55, contrast: 0.28 }, { scale: 0.8, contrast: 0.35 }],
  'layout:typescale': [{ lh: 1.1, tracking: 0 }, { lh: 1.55, tracking: 0 }, { lh: 1.9, tracking: 2 }, { lh: 1.5, tracking: 0 }],
  'bezier:default': [{ p1: 0.2, p2: 0.8, sharp: 0.2 }, { p1: 0.45, p2: 0.55, sharp: 0.6 }, { p1: 0.7, p2: 0.3, sharp: 0.9 }, { p1: 0.5, p2: 0.5, sharp: 0.5 }],

  'mech:arch': [{ load: 0.2 }, { load: 0.5 }, { load: 0.8 }, { load: 1 }],
  'mech:truss': [{ load: 0.2 }, { load: 0.5 }, { load: 0.8 }, { load: 1 }],
  'mech:wind': [{ wind: 0.15 }, { wind: 0.45 }, { wind: 0.75 }, { wind: 1 }],
  'mech:sun': [{ altitude: 0.28 }, { altitude: 0.85 }, { altitude: 0.6 }, { altitude: 0.4 }],

  'sonar:default': [{ depth: 0.2, pulse: 0.3 }, { depth: 0.5, pulse: 0.6 }, { depth: 0.8, pulse: 0.9 }, { depth: 1, pulse: 1 }],
  'pressure:default': [{ pressure: 0.15 }, { pressure: 0.5 }, { pressure: 0.85 }, { pressure: 1 }],
  'terrace:default': [{ level: 0.2, flow: 0.2 }, { level: 0.5, flow: 0.5 }, { level: 0.8, flow: 0.8 }, { level: 1, flow: 1 }],
  'ph:default': [{ ph: 1.8, base: 0 }, { ph: 4.5, base: 0.5 }, { ph: 6.5, base: 0.8 }, { ph: 7.2, base: 1 }],
  'seasons:default': [{ month: 0.25, tilt: 1 }, { month: 0.5, tilt: 1 }, { month: 0.5, tilt: 0.05 }, { month: 0.78, tilt: 1 }],
};

/* --------------------------------- 生成器 --------------------------------- */
function engineKey(spec) {
  return `${spec.engine}:${spec.spec?.mode || 'default'}`;
}

function autoBeats(point, lesson) {
  const states = BEAT_STATES[engineKey(lesson)] || [{}, {}, {}, {}];
  const v = lesson.vars[0];
  const first = point.summary.split('。')[0];
  const beat3 = v
    ? `把「${v.label}」从 ${v.min}${v.unit || ''} 推到 ${v.max}${v.unit || ''}，画面会给出另一个答案。先猜一下结果，再动手。`
    : '换一个条件，画面就会给出另一个答案。先猜，再验证。';
  return [
    {
      label: '现象',
      title: point.hook,
      text: point.case,
      state: states[0] || {},
      chips: point.tags,
    },
    {
      label: '原理',
      title: '拆开来看',
      text: point.summary,
      bullets: point.principles,
      state: states[1] || {},
      chips: [point.tags[0]],
    },
    {
      label: '变量',
      title: v ? `改变「${v.label}」` : '换一个条件',
      text: beat3,
      state: states[2] || {},
      chips: ['动手'],
    },
    {
      label: '带走',
      title: point.formula,
      text: `${first}。公式不是用来背的，是用来在换条件时告诉你答案会往哪边走。`,
      state: states[3] || {},
      chips: ['一句话'],
    },
  ];
}

/* --------------------------------- 题目 --------------------------------- */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededPick(list, index, count) {
  const out = [];
  const len = list.length || 1;
  for (let i = 0; i < count; i += 1) {
    const at = ((index + i * 7) % len + len) % len;
    out.push(list[at]);
  }
  return out;
}

function buildOptions(correct, distractors, seed) {
  const items = [correct, ...distractors];
  const order = [0, 1, 2, 3];
  let s = seed;
  for (let i = order.length - 1; i > 0; i -= 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    options: order.map((i) => items[i]),
    answer: order.indexOf(0),
  };
}

export function generatedQuiz(point) {
  const seed = hashString(point.id);
  const others = ALL_POINTS.filter((p) => p.id !== point.id);
  const sameSubject = others.filter((p) => p.subjectId === point.subjectId);
  const pool = sameSubject.length >= 4 ? sameSubject : others;
  const distant = seededPick(others, seed % others.length, 3);
  const near = seededPick(pool, (seed >>> 3) % pool.length, 3);
  const out = [];

  const f1 = buildOptions(point.formula, distant.map((p) => p.formula), seed);
  out.push({
    q: `「${point.title}」的核心关系是下面哪一条？`,
    options: f1.options,
    answer: f1.answer,
    why: point.summary,
  });

  const p1 = buildOptions(point.principles[0], near.map((p) => p.principles[0]), seed >>> 5);
  out.push({
    q: `关于「${point.title}」，下面哪一句是正确的？`,
    options: p1.options,
    answer: p1.answer,
    why: point.principles.slice(0, 2).join('；'),
  });

  const t1 = buildOptions(point.title, near.map((p) => p.title), seed >>> 9);
  out.push({
    q: `「${point.hook}」说的是哪个知识点？`,
    options: t1.options,
    answer: t1.answer,
    why: `${point.title}：${point.summary.split('。')[0]}。`,
  });

  return out;
}

/* -------------------------------- 装配入口 -------------------------------- */
function boardLesson(script, point) {
  const spec = { tone: point.subject?.color, subjectId: point.subjectId, style: script.style, steps: script.steps };
  return {
    engine: 'board',
    spec,
    vars: [],
    beats: script.steps.map((step, i) => ({
      label: `第 ${i + 1} 步`,
      title: step.title,
      text: step.text,
      note: step.note,
      quote: step.quote,
      chips: step.chips,
      state: { step: i },
    })),
    quiz: script.quiz || generatedQuiz(point),
    point,
    boardSpec: spec,
    boardOnly: true,
  };
}

export function buildLesson(point) {
  if (!point) return null;
  return boardLesson(BOARD_LESSONS[point.id] || ENGLISH_SCENES[point.id] || SYSTEM_SCENES[point.id] || (point.id === 'history-dujiangyan' ? DUJIANGYAN : null) || buildNarrativeBoard(point), point);
}

export function lessonFor(pointId) {
  return buildLesson(POINT_BY_ID[pointId]);
}

/** 主线：按段位、再按学科轮转排序，连续两关尽量不同学科 */
export const CURRICULUM = (() => {
  const byTier = {};
  for (const point of ALL_POINTS) (byTier[point.tier] ||= []).push(point);
  const out = [];
  for (const tier of Object.keys(byTier).map(Number).sort((a, b) => a - b)) {
    const pools = {};
    for (const p of byTier[tier]) (pools[p.subjectId] ||= []).push(p);
    const ids = Object.keys(pools);
    let guard = 0;
    while (ids.some((id) => pools[id].length) && guard < 400) {
      for (const id of ids) {
        const next = pools[id].shift();
        if (next) out.push(next);
      }
      guard += 1;
    }
  }
  return out;
})();

export function curriculumIndex(pointId) {
  return CURRICULUM.findIndex((p) => p.id === pointId);
}

export function nextLessonPoint(pointId) {
  const i = curriculumIndex(pointId);
  return i >= 0 ? CURRICULUM[i + 1] || null : null;
}
