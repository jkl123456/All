import {
  BUILDINGS_BY_ID,
  EXPANSIONS_BY_ID,
  ISLANDS,
  RESIDENTS_BY_ID,
  RANKS,
  SAVE_KEY,
  STARTING_PLOTS,
  STARTING_EQUIPMENT,
  TOOL_RECIPES_BY_ID,
} from '../data/gameData.js';
import { deepClone, uid } from '../core/utils.js';

const SAVE_VERSION = 1;
const KNOWN_ISLAND_IDS = new Set(ISLANDS.map((island) => island.id));
const RELIC_IDS = ['ink_jade', 'theorem_gear', 'momentum_core', 'element_essence', 'life_seed', 'sea_chart', 'craft_badge'];

function createNewState(rankId) {
  const validRank = RANKS[rankId] ? rankId : 'silver';
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    meta: {
      createdAt: now,
      updatedAt: now,
      rank: validRank,
      summary: '刚刚抵达栖云岛。',
    },
    started: true,
    rank: validRank,
    day: 1,
    timeMinutes: 8 * 60 + 20,
    location: 'home',
    player: { x: 0, z: 2.0, energy: 100 },
    coins: 90,
    insight: 0,
    resources: { wood: 8, stone: 5, fiber: 5, ore: 0, crystal: 0, food: 3 },
    seeds: { radish: 4, moonberry: 0, lotus: 0 },
    items: {},
    built: [],
    expansions: [],
    plots: STARTING_PLOTS.map((plot) => ({ ...plot, seed: null, plantedDay: null })),
    trials: {},
    stamps: {},
    codex: [],
    equipment: { ...deepClone(STARTING_EQUIPMENT), weapon: null },
    tools: [],
    mainQuestIndex: 0,
    questProgress: 0,
    completedQuests: [],
    daily: { day: 0, tasks: [], progress: {}, claimed: [] },
    residents: [],
    residentGifts: {},
    stats: {
      gathered: 0,
      built: 0,
      forged: 0,
      harvested: 0,
      quizzes: 0,
      correct: 0,
      traveled: 0,
      talked: 0,
      coinsEarned: 0,
    },
    settings: { sound: true, hints: true, quality: 'high', hand: 'right', stickSize: 'medium', landscapeLock: true },
    flags: {
      introSeen: false,
      dockRepaired: false,
      endingSeen: false,
      hintDismissed: false,
      metSage: false,
    },
    achievements: [],
    visitedIslands: ['home'],
    lastSleepDay: 0,
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCostsTarget(value) {
  if (!isPlainObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, amount]) => Number.isFinite(Number(amount)))
      .map(([key, amount]) => [key, Number(amount)]),
  );
}

function normalizeState(raw) {
  if (!isPlainObject(raw) || !raw.started) return null;
  const base = createNewState(RANKS[raw.rank] ? raw.rank : 'silver');
  const state = { ...base, ...raw };
  state.version = SAVE_VERSION;
  state.rank = RANKS[raw.rank] ? raw.rank : 'silver';
  state.day = Math.max(1, Math.floor(numberOr(raw.day, 1)));
  state.timeMinutes = Math.max(0, Math.min(1439, numberOr(raw.timeMinutes, 390)));
  state.location = KNOWN_ISLAND_IDS.has(raw.location) ? raw.location : 'home';
  state.coins = Math.max(0, Math.floor(numberOr(raw.coins, 0)));
  state.insight = Math.max(0, Math.floor(numberOr(raw.insight, 0)));
  state.player = {
    x: numberOr(raw.player?.x, 0),
    z: numberOr(raw.player?.z, 2.0),
    energy: Math.max(0, Math.min(300, numberOr(raw.player?.energy, 100))),
  };
  state.resources = { ...base.resources, ...normalizeCostsTarget(raw.resources) };
  Object.keys(base.resources).forEach((key) => {
    state.resources[key] = Math.max(0, Math.floor(numberOr(state.resources[key], 0)));
  });
  state.seeds = { ...base.seeds, ...normalizeCostsTarget(raw.seeds) };
  Object.keys(base.seeds).forEach((key) => {
    state.seeds[key] = Math.max(0, Math.floor(numberOr(state.seeds[key], 0)));
  });

  state.items = isPlainObject(raw.items)
    ? Object.fromEntries(
      Object.entries(raw.items)
        .filter(([key]) => RELIC_IDS.includes(key))
        .map(([key, amount]) => [key, Math.max(0, Math.floor(numberOr(amount, 0)))]),
    )
    : {};

  state.built = Array.isArray(raw.built)
    ? raw.built
      .filter((item) => item && BUILDINGS_BY_ID[item.type] && Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.z)))
      .map((item, index) => ({
        uid: String(item.uid || `building-${index}-${item.type}`),
        type: item.type,
        x: numberOr(item.x, 0),
        z: numberOr(item.z, 0),
        rotation: numberOr(item.rotation, 0),
        placedDay: Math.max(1, Math.floor(numberOr(item.placedDay, state.day))),
      }))
    : [];

  state.expansions = Array.isArray(raw.expansions)
    ? [...new Set(raw.expansions.filter((id) => EXPANSIONS_BY_ID[id]))]
    : [];

  const plotsById = new Map(
    (Array.isArray(raw.plots) ? raw.plots : []).map((plot) => [plot?.id, plot]),
  );
  state.plots = STARTING_PLOTS.map((basePlot) => {
    const saved = plotsById.get(basePlot.id) ?? {};
    return {
      ...basePlot,
      seed: ['radish', 'moonberry', 'lotus'].includes(saved.seed) ? saved.seed : null,
      plantedDay: saved.seed ? Math.max(1, Math.floor(numberOr(saved.plantedDay, state.day))) : null,
    };
  });

  state.trials = isPlainObject(raw.trials) ? raw.trials : {};
  state.stamps = isPlainObject(raw.stamps)
    ? Object.fromEntries(Object.entries(raw.stamps).filter(([id, pass]) => KNOWN_ISLAND_IDS.has(id) && pass))
    : {};
  state.codex = Array.isArray(raw.codex) ? [...new Set(raw.codex.filter((id) => typeof id === 'string'))] : [];
  state.equipment = {
    ...deepClone(STARTING_EQUIPMENT),
    ...(isPlainObject(raw.equipment) ? raw.equipment : {}),
    weapon: raw.equipment?.weapon ?? null,
  };
  state.tools = Array.isArray(raw.tools)
    ? raw.tools.filter((item) => item && typeof item === 'object' && item.uid && TOOL_RECIPES_BY_ID[item.recipeId])
    : [];
  state.mainQuestIndex = Math.max(0, Math.min(20, Math.floor(numberOr(raw.mainQuestIndex, 0))));
  state.questProgress = Math.max(0, Math.floor(numberOr(raw.questProgress, 0)));
  state.completedQuests = Array.isArray(raw.completedQuests) ? raw.completedQuests.filter((id) => typeof id === 'string') : [];
  state.daily = {
    day: Math.max(0, Math.floor(numberOr(raw.daily?.day, 0))),
    tasks: Array.isArray(raw.daily?.tasks) ? raw.daily.tasks : [],
    progress: isPlainObject(raw.daily?.progress) ? raw.daily.progress : {},
    claimed: Array.isArray(raw.daily?.claimed) ? raw.daily.claimed : [],
  };
  state.residents = Array.isArray(raw.residents)
    ? [...new Set(raw.residents.filter((id) => RESIDENTS_BY_ID[id]))]
    : [];
  state.residentGifts = isPlainObject(raw.residentGifts) ? raw.residentGifts : {};
  state.stats = { ...base.stats, ...(isPlainObject(raw.stats) ? raw.stats : {}) };
  Object.keys(base.stats).forEach((key) => {
    state.stats[key] = Math.max(0, Math.floor(numberOr(state.stats[key], 0)));
  });
  state.settings = { ...base.settings, ...(isPlainObject(raw.settings) ? raw.settings : {}) };
  state.flags = { ...base.flags, ...(isPlainObject(raw.flags) ? raw.flags : {}) };
  state.achievements = Array.isArray(raw.achievements) ? [...new Set(raw.achievements.filter((id) => typeof id === 'string'))] : [];
  state.visitedIslands = Array.isArray(raw.visitedIslands)
    ? [...new Set(['home', ...raw.visitedIslands.filter((id) => KNOWN_ISLAND_IDS.has(id))])]
    : ['home'];
  state.lastSleepDay = Math.max(0, Math.floor(numberOr(raw.lastSleepDay, 0)));
  state.meta = {
    ...base.meta,
    ...(isPlainObject(raw.meta) ? raw.meta : {}),
    rank: state.rank,
  };
  return state;
}

/** 测试阶段：材料、金币、信物门槛全部放开。正式版把它改回 false 即可。 */
export const SANDBOX = true;

export class GameState {
  constructor(data) {
    Object.assign(this, data);
  }

  static create(rankId) {
    return new GameState(createNewState(rankId));
  }

  static load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const normalized = normalizeState(parsed);
      return normalized ? new GameState(normalized) : null;
    } catch (error) {
      console.warn('[知屿] 存档读取失败。', error);
      return null;
    }
  }

  static hasSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Boolean(parsed?.started);
    } catch {
      return false;
    }
  }

  static peekSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.started) return null;
      return {
        rank: RANKS[parsed.rank] ?? RANKS.silver,
        day: Math.max(1, Math.floor(numberOr(parsed.day, 1))),
        location: KNOWN_ISLAND_IDS.has(parsed.location) ? parsed.location : 'home',
        updatedAt: numberOr(parsed.meta?.updatedAt, Date.now()),
        builtCount: Array.isArray(parsed.built) ? parsed.built.length : 0,
        stamps: isPlainObject(parsed.stamps) ? Object.keys(parsed.stamps).length : 0,
      };
    } catch {
      return null;
    }
  }

  static clearSave() {
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }

  save() {
    this.meta.updatedAt = Date.now();
    this.meta.createdAt = this.meta.createdAt || Date.now();
    this.meta.rank = this.rank;
    const island = ISLANDS.find((item) => item.id === this.location);
    const stampCount = this.getStampCount();
    this.meta.summary = `第 ${this.day} 日 · ${island?.shortName ?? '栖云'} · ${stampCount}/7 枚信物`;
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(this));
    } catch (error) {
      console.warn('[知屿] 存档写入失败，可能是浏览器存储空间不足。', error);
    }
  }

  toJSON() {
    const copy = { ...this };
    delete copy._listeners;
    return copy;
  }

  getRank() {
    return RANKS[this.rank] ?? RANKS.silver;
  }

  getMaxEnergy() {
    let max = 100;
    if (this.hasBuilding('lighthouse')) max += 20;
    const weaponBonus = Number(this.equipment?.weapon?.energyBonus) || 0;
    return max + weaponBonus;
  }

  getEffectiveMaxEnergy() {
    return Math.max(100, this.getMaxEnergy());
  }

  getAxe() {
    return this.equipment?.axe ?? STARTING_EQUIPMENT.axe;
  }

  getPickaxe() {
    return this.equipment?.pickaxe ?? STARTING_EQUIPMENT.pickaxe;
  }

  getBuildingCount(type) {
    return this.built.filter((building) => building.type === type).length;
  }

  hasBuilding(type) {
    return this.getBuildingCount(type) > 0;
  }

  getStampCount() {
    return Object.keys(this.stamps).length;
  }

  hasTrialPassed(trialId) {
    return Boolean(this.trials?.[trialId]?.passed);
  }

  hasAllStamps() {
    return ISLANDS.filter((island) => island.id !== 'home').every((island) => this.stamps[island.id]);
  }

  meetsRequirements(requirements = {}) {
    if (SANDBOX) return true;
    if (requirements.buildings?.some((type) => !this.hasBuilding(type))) return false;
    if (requirements.trials?.some((id) => !this.hasTrialPassed(id))) return false;
    if (requirements.allStamps && !this.hasAllStamps()) return false;
    return true;
  }

  missingRequirement(requirements = {}) {
    if (SANDBOX) return '';
    if (requirements.buildings) {
      const missing = requirements.buildings.filter((type) => !this.hasBuilding(type));
      if (missing.length) return `需要先建造「${BUILDINGS_BY_ID[missing[0]]?.name ?? missing[0]}」`;
    }
    if (requirements.trials) {
      const missing = requirements.trials.filter((id) => !this.hasTrialPassed(id));
      if (missing.length) return '需要先通过对应学科的主试炼';
    }
    if (requirements.allStamps && !this.hasAllStamps()) {
      return `还需要 ${7 - this.getStampCount()} 枚学科信物`;
    }
    return '';
  }

  canAfford(cost = {}) {
    if (SANDBOX) return true;
    if (Number(cost.coins) > this.coins) return false;
    return Object.entries(cost).every(([key, amount]) => {
      if (key === 'coins') return true;
      return (this.resources[key] ?? 0) >= amount;
    });
  }

  spend(cost = {}) {
    if (SANDBOX) return true;
    if (!this.canAfford(cost)) return false;
    if (cost.coins) this.coins -= cost.coins;
    Object.entries(cost).forEach(([key, amount]) => {
      if (key === 'coins') return;
      this.resources[key] = Math.max(0, (this.resources[key] ?? 0) - amount);
    });
    return true;
  }

  addResource(key, amount) {
    if (key === 'coins') {
      this.coins = Math.max(0, this.coins + amount);
      this.stats.coinsEarned += Math.max(0, amount);
      return;
    }
    if (key === 'insight') {
      this.insight = Math.max(0, this.insight + amount);
      return;
    }
    if (key in this.resources) {
      this.resources[key] = Math.max(0, this.resources[key] + amount);
    }
  }

  addSeeds(seedId, amount) {
    if (!(seedId in this.seeds)) this.seeds[seedId] = 0;
    this.seeds[seedId] = Math.max(0, this.seeds[seedId] + amount);
  }

  addItem(itemId, amount = 1) {
    if (!RELIC_IDS.includes(itemId)) return;
    this.items[itemId] = Math.max(0, (this.items[itemId] ?? 0) + amount);
  }

  addInsight(amount) {
    this.insight = Math.max(0, this.insight + amount);
  }

  grantRewards(rewards = {}) {
    const granted = [];
    if (rewards.coins) {
      this.addResource('coins', rewards.coins);
      granted.push({ type: 'coins', amount: rewards.coins, label: '银叶币' });
    }
    if (rewards.insight) {
      this.addInsight(rewards.insight);
      granted.push({ type: 'insight', amount: rewards.insight, label: '悟性' });
    }
    ['wood', 'stone', 'fiber', 'ore', 'crystal', 'food'].forEach((key) => {
      if (rewards[key]) {
        this.addResource(key, rewards[key]);
        granted.push({ type: key, amount: rewards[key], label: key });
      }
    });
    if (rewards.seeds) {
      Object.entries(rewards.seeds).forEach(([seedId, amount]) => {
        this.addSeeds(seedId, amount);
        granted.push({ type: 'seed', seedId, amount });
      });
    }
    if (rewards.items) {
      Object.entries(rewards.items).forEach(([itemId, amount]) => {
        this.addItem(itemId, amount);
        granted.push({ type: 'item', itemId, amount });
      });
    }
    return granted;
  }

  updatePlayerPosition(x, z, energy) {
    this.player.x = x;
    this.player.z = z;
    if (Number.isFinite(energy)) this.player.energy = Math.max(0, Math.min(this.getEffectiveMaxEnergy(), energy));
  }

  spendEnergy(amount) {
    if (SANDBOX) {
      this.player.energy = this.getEffectiveMaxEnergy();
      return true;
    }
    if (this.player.energy < amount) return false;
    this.player.energy = Math.max(0, this.player.energy - amount);
    return true;
  }

  restoreEnergy(amount) {
    this.player.energy = Math.min(this.getEffectiveMaxEnergy(), this.player.energy + amount);
  }

  recordCodex(questionId) {
    if (!this.codex.includes(questionId)) {
      this.codex.push(questionId);
      return true;
    }
    return false;
  }

  recordTrial(trialId, { passed = false, score = 0, total = 0 } = {}) {
    const previous = this.trials[trialId] ?? {};
    this.trials[trialId] = {
      passed: Boolean(previous.passed || passed),
      best: Math.max(previous.best ?? 0, score),
      attempts: (previous.attempts ?? 0) + 1,
      lastDay: this.day,
      total,
    };
    return this.trials[trialId];
  }

  awardStamp(islandId) {
    if (islandId === 'home') return false;
    const had = Boolean(this.stamps[islandId]);
    this.stamps[islandId] = true;
    return !had;
  }

  isAtHome() {
    return this.location === 'home';
  }

  unlockAchievement(id) {
    if (!id || this.achievements.includes(id)) return false;
    this.achievements.push(id);
    return true;
  }

  recordGather(amount) {
    this.stats.gathered += amount;
  }

  recordForge() {
    this.stats.forged += 1;
  }

  recordHarvest() {
    this.stats.harvested += 1;
  }

  createTool(recipe, quality, score) {
    const base = TOOL_RECIPES_BY_ID[recipe.id];
    if (!base) return null;
    const rankTier = this.getRank().tier;
    const powerBoost = Math.floor(score / 60);
    const tool = {
      uid: uid('tool'),
      recipeId: base.id,
      name: quality.prefix ? `${quality.prefix}·${base.name}` : base.name,
      kind: base.kind,
      quality: quality.name,
      qualityTier: quality.tier,
      score,
      rankTier,
      power: (base.axePower ?? base.pickPower ?? 0) + powerBoost + Math.max(0, rankTier - 1),
      toolPower: base.axePower ?? base.pickPower ?? 0,
      energyBonus: base.energyBonus ?? 0,
      forgedDay: this.day,
      icon: base.icon,
    };
    this.tools.push(tool);
    this.stats.forged += 1;
    return tool;
  }

  equipTool(tool) {
    if (!tool) return false;
    if (tool.kind === 'axe') this.equipment.axe = tool;
    else if (tool.kind === 'pickaxe') this.equipment.pickaxe = tool;
    else if (tool.kind === 'weapon') this.equipment.weapon = tool;
    else return false;
    return true;
  }

  getGatherPower(kind) {
    if (['tree', 'bamboo', 'broadleaf', 'pine', 'palm', 'giant'].includes(kind)) return Number(this.getAxe().power) || 0;
    if (kind === 'rock' || kind === 'crystal') return Number(this.getPickaxe().power) || 0;
    return 0;
  }

  getHomeBuilding(type) {
    return this.built.find((building) => building.type === type) ?? null;
  }

  getCapacity() {
    return this.getBuildingCount('cottage');
  }

  getResidentCount() {
    return this.residents.length;
  }

  canAcceptResident() {
    return this.residents.length < this.getCapacity();
  }

  addResident(id) {
    if (!RESIDENTS_BY_ID[id] || this.residents.includes(id)) return false;
    if (!this.canAcceptResident()) return false;
    this.residents.push(id);
    return true;
  }

  hasVisited(islandId) {
    return this.visitedIslands.includes(islandId);
  }

  markVisited(islandId) {
    if (!this.visitedIslands.includes(islandId)) this.visitedIslands.push(islandId);
  }

  getTotalProgress() {
    const quest = Math.min(1, this.mainQuestIndex / 16);
    const stamps = this.getStampCount() / 7;
    const charm = Math.min(1, this.built.length / 16);
    return Math.round((quest * 0.4 + stamps * 0.4 + charm * 0.2) * 100);
  }
}

export { SAVE_VERSION };
