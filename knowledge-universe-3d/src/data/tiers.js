/**
 * 知域 · 段位系统
 * 从黑铁到王者共 8 段，段位越高，知识点的抽象程度越高。
 * 每一段用「星数」解锁：学完一关最多 3 星，星数累积到阈值即晋级。
 */

export const TIERS = [
  {
    id: 'iron',
    level: 1,
    name: '黑铁',
    en: 'IRON',
    color: '#9AA3B5',
    deep: '#4A5162',
    glow: 'rgba(154, 163, 181, 0.5)',
    stars: 0,
    motto: '从看见，到问出第一个为什么',
    brief: '日常现象的第一次解释。不需要公式，只需要好奇。',
  },
  {
    id: 'bronze',
    level: 2,
    name: '青铜',
    en: 'BRONZE',
    color: '#D08A4E',
    deep: '#6B3F1D',
    glow: 'rgba(208, 138, 78, 0.5)',
    stars: 8,
    motto: '把现象收进一条规律里',
    brief: '开始用一条关系式概括许多次观察。',
  },
  {
    id: 'silver',
    level: 3,
    name: '白银',
    en: 'SILVER',
    color: '#C3D2E4',
    deep: '#5A6B80',
    glow: 'rgba(195, 210, 228, 0.5)',
    stars: 20,
    motto: '在纸上推演还没发生的事',
    brief: '模型开始替代试错，你可以预测了。',
  },
  {
    id: 'gold',
    level: 4,
    name: '黄金',
    en: 'GOLD',
    color: '#F2C24E',
    deep: '#8A5F12',
    glow: 'rgba(242, 194, 78, 0.5)',
    stars: 36,
    motto: '让两个变量同时说话',
    brief: '多因素耦合：改一个条件，结果会怎样连锁变化。',
  },
  {
    id: 'platinum',
    level: 5,
    name: '铂金',
    en: 'PLATINUM',
    color: '#5FE3D0',
    deep: '#146B62',
    glow: 'rgba(95, 227, 208, 0.5)',
    stars: 56,
    motto: '看见结构，而不只是现象',
    brief: '从零件走向系统，理解层级、反馈与守恒。',
  },
  {
    id: 'diamond',
    level: 6,
    name: '钻石',
    en: 'DIAMOND',
    color: '#7FB0FF',
    deep: '#1D3E7A',
    glow: 'rgba(127, 176, 255, 0.5)',
    stars: 80,
    motto: '在抽象里建造可以运行的世界',
    brief: '把现实压缩成模型，再让模型给出答案。',
  },
  {
    id: 'star',
    level: 7,
    name: '星耀',
    en: 'STARFALL',
    color: '#B08BFF',
    deep: '#4A2C86',
    glow: 'rgba(176, 139, 255, 0.5)',
    stars: 108,
    motto: '让不同学科互相作证',
    brief: '跨域连接：同一件事，物理、地理与历史各说一半。',
  },
  {
    id: 'king',
    level: 8,
    name: '王者',
    en: 'SOVEREIGN',
    color: '#FF7A5C',
    deep: '#8A2A17',
    glow: 'rgba(255, 122, 92, 0.5)',
    stars: 140,
    motto: '把复杂性握在手里，仍然讲得清楚',
    brief: '最难的一层：抽象、耦合，以及把话说明白的本事。',
  },
];

export const TIER_BY_LEVEL = Object.fromEntries(TIERS.map((tier) => [tier.level, tier]));
export const TIER_BY_ID = Object.fromEntries(TIERS.map((tier) => [tier.id, tier]));
export const MAX_STARS_PER_LESSON = 3;

/**
 * 知识点 → 段位。整体按「抽象程度」而非学科排列：
 * 同一段位里混合文理与行业，让每一次晋级都要换一种思考方式。
 */
export const POINT_TIER = {
  /* T1 · 黑铁：日常现象的第一层解释（9） */
  'english-preposition': 1,
  'english-ordering': 1,
  'english-ticket': 1,
  'english-directions': 1,
  'english-interview': 2,
  'chinese-poem-jingye': 1,
  'chinese-idiom-shouzhu': 1,
  'chef-heat': 1,
  'designer-color': 1,
  'biology-foodchain': 1,
  'physics-buoyancy': 1,
  'math-golden': 1,
  'chemistry-dissolve': 1,

  /* T2 · 青铜：从现象到规律（9） */
  'chinese-hanzi': 2,
  'chinese-poem-dengguanque': 2,
  'math-pythagoras': 2,
  'architect-pavilion': 2,
  'physics-lever': 2,
  'chemistry-combustion': 2,
  'designer-contrast': 2,
  'fisher-buoy': 2,
  'farmer-solarterms': 2,
  'geography-seasons': 2,

  /* T3 · 白银：用模型描述世界（10） */
  'math-parabola': 3,
  'physics-pendulum': 3,
  'chemistry-water': 3,
  'chemistry-crystal': 3,
  'biology-photosynthesis': 3,
  'geography-earth': 3,
  'history-silkroad': 3,
  'architect-arch': 3,
  'chef-maillard': 3,
  'chinese-poetry': 3,

  /* T4 · 黄金：多因素耦合（9） */
  'math-probability': 4,
  'physics-refraction': 4,
  'chemistry-acidbase': 4,
  'chemistry-battery': 4,
  'english-tense': 4,
  'english-wordtree': 4,
  'geography-monsoon': 4,
  'history-printing': 4,
  'designer-grid': 4,
  'chinese-idiom-kezhou': 4,

  /* T5 · 铂金：结构与系统（9） */
  'biology-cell': 5,
  'biology-dna': 5,
  'history-dujiangyan': 5,
  'history-zhenghe': 5,
  'history-anshi': 5,
  'chef-dough': 5,
  'farmer-terrace': 5,
  'farmer-irrigation': 5,
  'fisher-tide': 5,
  'programmer-hanoi': 5,

  /* T6 · 钻石：抽象与建模（9） */
  'geography-plates': 6,
  'programmer-binarytree': 6,
  'chef-ferment': 6,
  'farmer-rotation': 6,
  'fisher-pressure': 6,
  'history-grandcanal': 6,
  'math-fibonacci': 6,
  'architect-light': 6,
  'architect-bridge': 5,
  'physics-induction': 6,
  'physics-rocket': 6,

  /* T7 · 星耀：跨域互证（9） */
  'programmer-network': 7,
  'programmer-fullstack': 6,
  'architect-wind': 7,
  'fisher-sonar': 7,
  'geography-ocean': 7,
  'chinese-couplet': 7,
  'biology-immune': 7,
  'geography-karst': 7,
  'programmer-hash': 7,
  'chinese-rhetoric': 7,

  /* T8 · 王者：抽象、耦合与讲清楚（10） */
  'chemistry-periodic': 8,
  'designer-bezier': 8,
  'designer-typescale': 8,
  'architect-truss': 8,
  'programmer-lock': 8,
  'programmer-compiler': 8,
  'chef-emulsion': 8,
  'math-calculus': 8,
  'chinese-classical': 8,
  'history-reform': 8,
};

/** 每关基础积分（乘以段位系数与星级） */
export const XP_PER_LESSON = 40;
export const XP_TIER_BONUS = 0.35;
export const XP_CHALLENGE_BASE = 30;

export function tierFor(level) {
  return TIER_BY_LEVEL[Math.min(8, Math.max(1, level || 1))];
}

export function lessonXp(level, stars, combo = 0) {
  const tier = tierFor(level);
  const base = Math.round(XP_PER_LESSON * (1 + (tier.level - 1) * XP_TIER_BONUS));
  const starMul = [0, 0.6, 0.85, 1.12][Math.min(3, Math.max(0, stars))] || 0;
  return Math.round(base * starMul + combo * 4);
}
