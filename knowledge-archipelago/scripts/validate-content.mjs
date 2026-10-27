/**
 * 内容自检：在开发与提交前确认题库、试炼、配方与任务引用都是完整的。
 * 运行：npm run validate
 */
import {
  BUILDINGS_BY_ID,
  CROPS,
  EXPANSIONS,
  ISLANDS,
  ITEM_DEFS,
  RESIDENTS,
  RESOURCE_DEFS,
  TOOL_RECIPES,
} from '../src/data/gameData.js';
import { MAIN_QUESTS } from '../src/data/quests.js';
import { QUESTIONS } from '../src/data/questions.js';

const errors = [];
const warnings = [];
const allTrials = new Map();

for (const island of ISLANDS) {
  for (const trial of island.trials ?? []) {
    if (allTrials.has(trial.id)) errors.push(`重复的试炼 id：${trial.id}`);
    allTrials.set(trial.id, { ...trial, islandId: island.id });
  }
}

// 题库尺寸与字段完整性
const expectedPerLevel = new Map();
for (const question of QUESTIONS) {
  const key = `${question.island}-${question.level}`;
  expectedPerLevel.set(key, (expectedPerLevel.get(key) ?? 0) + 1);
  if (!question.question || !question.explanation) errors.push(`题目缺少文本：${question.id}`);
  if (!Array.isArray(question.options) || question.options.length !== 4) errors.push(`选项数量错误：${question.id}`);
  if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer > 3) errors.push(`答案索引错误：${question.id}`);
  if (!question.topic) warnings.push(`题目缺少 topic：${question.id}`);
}
const ids = new Set();
for (const question of QUESTIONS) {
  if (ids.has(question.id)) errors.push(`重复题目 id：${question.id}`);
  ids.add(question.id);
}
for (const island of ISLANDS.filter((item) => item.id !== 'home')) {
  for (const level of ['junior', 'senior', 'university', 'postgrad']) {
    const count = expectedPerLevel.get(`${island.id}-${level}`) ?? 0;
    if (count < 3) errors.push(`${island.name} ${level} 题目不足 3 道（当前 ${count}）`);
  }
}
if (QUESTIONS.length !== 112) warnings.push(`题库总数为 ${QUESTIONS.length}，预期为 112。`);

// 知识岛与信物
for (const island of ISLANDS.filter((item) => item.id !== 'home')) {
  const main = island.trials?.find((trial) => trial.main);
  if (!main) errors.push(`${island.name} 缺少主试炼`);
  if (!island.rewardRelic) errors.push(`${island.name} 缺少主试炼信物`);
  if (island.rewardRelic) {
    const item = ITEM_DEFS[island.rewardRelic];
    if (!item) errors.push(`${island.name} 的信物不存在：${island.rewardRelic}`);
    else if (item.island !== island.id) errors.push(`${island.name} 的信物 ${island.rewardRelic} 所属岛屿错误`);
  }
  if (!island.guardian?.name) errors.push(`${island.name} 缺少守岛人`);
  if (!island.trials?.every((trial) => trial.position)) errors.push(`${island.name} 有试炼缺少坐标`);
}

// 配方和建筑引用
for (const recipe of TOOL_RECIPES) {
  Object.keys(recipe.cost ?? {}).forEach((key) => {
    if (!(key in RESOURCE_DEFS)) errors.push(`工具配方 ${recipe.id} 使用了未知资源 ${key}`);
  });
  for (const trialId of recipe.requirements?.trials ?? []) {
    if (!allTrials.has(trialId)) errors.push(`工具配方 ${recipe.id} 引用了不存在的试炼 ${trialId}`);
  }
}
for (const building of Object.values(BUILDINGS_BY_ID)) {
  Object.keys(building.cost ?? {}).forEach((key) => {
    if (key !== 'coins' && !(key in RESOURCE_DEFS)) errors.push(`建筑 ${building.id} 使用了未知资源 ${key}`);
  });
  for (const trialId of building.requirements?.trials ?? []) {
    if (!allTrials.has(trialId)) errors.push(`建筑 ${building.id} 引用了不存在的试炼 ${trialId}`);
  }
  for (const dependency of building.requirements?.buildings ?? []) {
    if (!BUILDINGS_BY_ID[dependency]) errors.push(`建筑 ${building.id} 依赖不存在的建筑 ${dependency}`);
  }
}
for (const expansion of EXPANSIONS) {
  for (const trialId of expansion.requirements?.trials ?? []) {
    if (!allTrials.has(trialId)) errors.push(`扩建 ${expansion.id} 引用了不存在的试炼 ${trialId}`);
  }
  Object.keys(expansion.cost ?? {}).forEach((key) => {
    if (!(key in RESOURCE_DEFS)) errors.push(`扩建 ${expansion.id} 使用了未知资源 ${key}`);
  });
}
for (const resident of RESIDENTS) {
  for (const trialId of resident.requirement?.trials ?? []) {
    if (!allTrials.has(trialId)) errors.push(`居民 ${resident.id} 引用了不存在的试炼 ${trialId}`);
  }
}
for (const crop of CROPS) {
  for (const trialId of crop.requirements?.trials ?? []) {
    if (!allTrials.has(trialId)) errors.push(`作物 ${crop.id} 引用了不存在的试炼 ${trialId}`);
  }
}

// 主线的引用与奖励
const validObjectiveTypes = new Set(['build', 'repair', 'trial', 'expand', 'harvest', 'forge', 'talk', 'quiz', 'gather']);
for (const quest of MAIN_QUESTS) {
  if (!validObjectiveTypes.has(quest.objective.type)) errors.push(`任务 ${quest.id} 使用了未知目标类型`);
  if (quest.objective.type === 'build' && !BUILDINGS_BY_ID[quest.objective.building]) errors.push(`任务 ${quest.id} 指向不存在的建筑`);
  if (quest.objective.type === 'trial' && !allTrials.has(quest.objective.trial)) errors.push(`任务 ${quest.id} 指向不存在的试炼`);
  if (quest.objective.type === 'trial' && !allTrials.get(quest.objective.trial)?.main) errors.push(`任务 ${quest.id} 的主线目标不是主试炼`);
  Object.keys(quest.rewards ?? {}).forEach((key) => {
    if (!['coins', 'insight', 'wood', 'stone', 'fiber', 'ore', 'crystal', 'food', 'seeds', 'items'].includes(key)) {
      errors.push(`任务 ${quest.id} 奖励包含未知字段 ${key}`);
    }
  });
}

console.log(`题库：${QUESTIONS.length} 道 · ${new Set(QUESTIONS.map((q) => q.island)).size} 座知识岛 · ${Object.keys(ITEM_DEFS).length} 件信物`);
console.log(`岛屿：${ISLANDS.length} 座 · 试炼：${allTrials.size} 处 · 建筑：${Object.keys(BUILDINGS_BY_ID).length} 种 · 工具：${TOOL_RECIPES.length} 种`);
console.log(`主线：${MAIN_QUESTS.length} 章 · 居民：${RESIDENTS.length} 位 · 扩建：${EXPANSIONS.length} 处`);
if (warnings.length) {
  console.log('\n提示：');
  warnings.forEach((warning) => console.log(`  · ${warning}`));
}
if (errors.length) {
  console.error('\n内容校验失败：');
  errors.forEach((error) => console.error(`  ✕ ${error}`));
  process.exitCode = 1;
} else {
  console.log('\n内容校验通过。潮汐、题目和配方都能咬合。');
}
