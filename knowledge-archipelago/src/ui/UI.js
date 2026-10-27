import {
  ACHIEVEMENT_DEFS,
  BUILDINGS_BY_ID,
  BUILD_CATEGORIES,
  CROPS,
  CROPS_BY_ID,
  EXPANSIONS,
  ITEM_DEFS,
  ISLANDS,
  ISLAND_MAP,
  KNOWLEDGE_ISLANDS,
  RANKS,
  RANK_LIST,
  RESIDENTS,
  RESIDENTS_BY_ID,
  RESOURCE_DEFS,
  TOOL_RECIPES,
  TOOL_RECIPES_BY_ID,
} from '../data/gameData.js';
import { MAIN_QUESTS, TOTAL_MAIN_QUESTS } from '../data/quests.js';
import { getQuestionById } from '../data/questions.js';
import { clamp, escapeHTML, formatNumber, formatTime, getSeason, timePeriod } from '../core/utils.js';
import { hydrateIcons, icon } from './icons.js';
import { portrait } from './portraits.js';

const SPECIAL_RESOURCES = {
  coins: { name: '银叶币', icon: 'coin', color: '#e3c57b' },
  insight: { name: '悟性', icon: 'insight', color: '#a9dfd4' },
};

const HUD_RESOURCES = ['coins', 'wood', 'stone', 'fiber', 'ore', 'crystal', 'food', 'insight'];

const TOOL_LABELS = { axe: '斧', pickaxe: '镐', weapon: '护身器' };

const COST_LABELS = {
  coins: '银叶币',
  wood: '木材',
  stone: '石料',
  fiber: '纤维',
  ore: '矿石',
  crystal: '星晶',
};

const SELL_PRICES = { food: 4, wood: 2, stone: 2, fiber: 2, ore: 5, crystal: 12 };

function iconMarkup(name, className = '') {
  return icon(name, className);
}

function specialDef(type) {
  return SPECIAL_RESOURCES[type] ?? RESOURCE_DEFS[type] ?? { name: type, icon: 'spark' };
}

function resourceChip(type, amount, options = {}) {
  const def = specialDef(type);
  const label = options.label ?? def.name;
  return `<span class="res-chip res-chip--${type}" title="${escapeHTML(label)}">
    <span class="res-chip__icon">${iconMarkup(def.icon)}</span>
    <b>${formatNumber(amount)}</b>
    ${options.showName === false ? '' : `<em>${escapeHTML(label)}</em>`}
  </span>`;
}

function smallCostChip(type, amount, affordable = true) {
  const def = specialDef(type);
  return `<span class="cost-chip ${affordable ? '' : 'is-short'}" title="${escapeHTML(def.name)}">
    ${iconMarkup(def.icon)}<b>${formatNumber(amount)}</b>
  </span>`;
}

function costMarkup(cost, state) {
  return `<div class="cost-row">${Object.entries(cost)
    .filter(([, amount]) => amount > 0)
    .map(([type, amount]) => {
      const affordable = type === 'coins' ? state.coins >= amount : (state.resources[type] ?? 0) >= amount;
      return smallCostChip(type, amount, affordable);
    }).join('')}</div>`;
}

function rewardChips(rewards = {}) {
  const chips = [];
  if (rewards.coins) chips.push(resourceChip('coins', rewards.coins, { showName: true }));
  if (rewards.insight) chips.push(resourceChip('insight', rewards.insight, { showName: true }));
  ['wood', 'stone', 'fiber', 'ore', 'crystal', 'food'].forEach((type) => {
    if (rewards[type]) chips.push(resourceChip(type, rewards[type], { showName: true }));
  });
  if (rewards.seeds) {
    Object.entries(rewards.seeds).forEach(([seedId, amount]) => {
      const crop = CROPS_BY_ID[seedId];
      if (crop) chips.push(`<span class="res-chip"><span class="res-chip__icon">${iconMarkup(crop.icon)}</span><b>${amount}</b><em>${crop.name}种子</em></span>`);
    });
  }
  if (rewards.items) {
    Object.entries(rewards.items).forEach(([itemId, amount]) => {
      const item = ITEM_DEFS[itemId];
      if (item) chips.push(`<span class="res-chip"><span class="res-chip__icon">${iconMarkup(item.icon)}</span><b>${amount}</b><em>${item.name}</em></span>`);
    });
  }
  return `<div class="reward-chips">${chips.join('')}</div>`;
}

function inventoryGrantChip(grant) {
  if (!grant) return '';
  if (grant.type === 'seed') {
    const crop = CROPS_BY_ID[grant.seedId];
    return `<span class="loot-chip">${iconMarkup(crop?.icon ?? 'seed')}<b>${crop?.name ?? '种子'} ×${grant.amount}</b></span>`;
  }
  if (grant.type === 'item') {
    const item = ITEM_DEFS[grant.itemId];
    return `<span class="loot-chip">${iconMarkup(item?.icon ?? 'spark')}<b>${item?.name ?? '信物'} ×${grant.amount}</b></span>`;
  }
  const def = specialDef(grant.type);
  return `<span class="loot-chip">${iconMarkup(def.icon)}<b>${escapeHTML(grant.label ?? def.name)} ×${grant.amount}</b></span>`;
}

function stampMark(island, passed) {
  return `<span class="island-stamp ${passed ? 'is-stamped' : ''}" style="--stamp:${island.accent}">
    <span>${island.glyph}</span><small>${passed ? '已印' : '未印'}</small>
  </span>`;
}

function qualityClass(tier) {
  return ['quality-plain', 'quality-rough', 'quality-fine', 'quality-lux', 'quality-legend'][clamp(tier ?? 0, 0, 4)];
}

function escapeText(value) {
  return escapeHTML(value ?? '');
}

export class UI {
  constructor(game) {
    this.game = game;
    this.modal = null;
    this.modalType = null;
    this.modalCleanup = null;
    this.queuedNotices = [];
    this.isTouch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    this.selectedRank = 'silver';
    this.saveMeta = null;
    this.started = false;
    this.lastResourceSignature = '';
    this.lastQuestSignature = '';
    this.lastNearestId = null;
    this.buildOpen = false;
    this.buildCategory = '全部';
    this.selectedBuildType = null;
    this.confirmCallback = null;
    this.soundEnabled = true;
    this.controlHintTimer = null;
    this.farmFocusPlotId = null;
    this.panelType = null;
    this.mapSelection = null;
    this.journalTab = 'main';
    this.codexFilter = 'all';
    this.codexQuery = '';
    this.forgeTimer = null;
    this.forgeState = null;
    this.activeDialogue = null;
    this.pausedMenuOpen = false;
    this.finaleShown = false;
    this._titleBound = false;
    // 自动横屏容器里的游戏已经处于横向视口；不再请求原生全屏/转屏锁定。
    this.isLandscapeFrame = new URLSearchParams(window.location.search).get('landscape-frame') === '1';
  }

  bind() {
    hydrateIcons(document);
    this.els = {
      title: document.getElementById('title-screen'),
      titleActions: document.getElementById('title-actions'),
      hud: document.getElementById('hud'),
      questTracker: document.getElementById('quest-tracker'),
      resources: document.getElementById('hud-resources'),
      prompt: document.getElementById('interaction-prompt'),
      promptLabel: document.getElementById('interaction-label'),
      promptHint: document.getElementById('interaction-hint'),
      minimap: document.getElementById('minimap'),
      actionRail: document.querySelector('.action-rail'),
      toastStack: document.getElementById('toast-stack'),
      overlayRoot: document.getElementById('overlay-root'),
      buildDock: document.getElementById('build-dock'),
      transition: document.getElementById('transition'),
      transitionTitle: document.getElementById('transition-title'),
      transitionSub: document.getElementById('transition-sub'),
      energyRing: document.getElementById('energy-ring'),
      energyValue: document.getElementById('hud-energy'),
      controlHint: document.getElementById('control-hint'),
      touchControls: document.getElementById('touch-controls'),
      buildHover: null,
    };

    this.els.overlayRoot.addEventListener('click', (event) => this.handleOverlayClick(event));
    this.els.overlayRoot.addEventListener('input', (event) => this.handleOverlayInput(event));
    this.els.titleActions.addEventListener('click', (event) => this.handleTitleClick(event));
    document.getElementById('btn-credits')?.addEventListener('click', () => this.showCredits());
    document.getElementById('btn-sound-title')?.addEventListener('click', () => this.game.toggleSound());
    document.getElementById('btn-menu')?.addEventListener('click', () => this.openPauseMenu());
    document.querySelectorAll('.rail-btn').forEach((button) => {
      button.addEventListener('click', () => this.handleAction(button.dataset.action));
    });
    document.getElementById('dismiss-hint')?.addEventListener('click', () => this.hideControlHint(true));
    document.getElementById('touch-interact')?.addEventListener('click', () => {
      this.game.world?.interactNearest();
      if (navigator.vibrate) navigator.vibrate(12);
    });
    document.getElementById('touch-build')?.addEventListener('click', () => {
      this.handleAction('build');
      if (navigator.vibrate) navigator.vibrate(10);
    });
    this.els.buildDock.addEventListener('click', (event) => this.handleBuildClick(event));
    this.els.overlayRoot.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target?.matches?.('[data-dialogue-next]')) {
        event.preventDefault();
        event.target.click();
      }
    });
    this.game.world?.setupMobileJoystick(document.getElementById('joystick'));
    if (this.isTouch) {
      this.els.touchControls?.classList.remove('is-hidden');
    }
    window.addEventListener('resize', () => {
      if (this.started) this.drawMinimap();
    });
  }

  setSoundIcon(enabled) {
    this.soundEnabled = enabled;
    const btn = document.getElementById('btn-sound-title');
    if (!btn) return;
    const iconSpan = btn.querySelector('[data-icon]');
    if (iconSpan) iconSpan.innerHTML = icon(enabled ? 'sound' : 'muted');
    btn.setAttribute('aria-pressed', String(enabled));
  }

  // ---------------------------------------------------------------------------
  // 标题页
  // ---------------------------------------------------------------------------

  showTitle(saveMeta) {
    this.saveMeta = saveMeta;
    this.selectedRank = saveMeta?.rank?.id ?? 'silver';
    this.els.title?.classList.remove('is-hidden', 'is-leaving');
    this.renderTitleActions();
  }

  renderTitleActions() {
    const save = this.saveMeta;
    const rank = RANKS[this.selectedRank] ?? RANKS.silver;
    const rankCards = RANK_LIST.map((entry) => `
      <button class="rank-choice ${entry.id === this.selectedRank ? 'is-selected' : ''}" data-title-rank="${entry.id}" type="button" aria-pressed="${entry.id === this.selectedRank}" style="--rank:${entry.color};--rank-deep:${entry.deep}">
        <span class="rank-choice__mark">${entry.mark}</span>
        <span class="rank-choice__name">${entry.name}</span>
        <small>${entry.stage}</small>
      </button>
    `).join('');
    const saveBlock = save ? `
      <button class="continue-save" data-title-continue type="button">
        <span class="continue-save__icon">${icon('arrow')}</span>
        <span class="continue-save__copy">
          <small>${save.rank.name}段位 · 第 ${save.day} 日 · ${save.stamps}/7 枚信物</small>
          <strong>继续旅程</strong>
        </span>
        <span class="continue-save__meta">${save.builtCount} 座建筑</span>
      </button>
      <div class="title-divider"><span>或者，重新选择一段航程</span></div>
    ` : `
      <div class="title-divider"><span>选择你的学者段位</span></div>
    `;
    this.els.titleActions.innerHTML = `
      ${saveBlock}
      <div class="rank-grid">${rankCards}</div>
      <div class="rank-description" id="title-rank-description">
        <span class="rank-dot" style="background:${rank.color}"></span>
        <div>
          <p><b>${rank.title}</b> · ${rank.flavor}</p>
          <small>${rank.description}</small>
        </div>
        <span class="rank-level">${rank.name} / ${rank.stage}</span>
      </div>
      <div class="title-primary-row">
        <button class="primary-btn title-start" data-title-start type="button">
          <span>${save ? '开始新的航程' : '踏入群岛'}</span>
          <small>${rank.name} · ${rank.stage}</small>
          ${icon('arrow')}
        </button>
        <span class="title-seal">栖云<br>岛</span>
      </div>
      <p class="title-footnote">${save ? '新的航程会覆盖当前存档。' : '难度只改变问题的深度与奖励的华丽程度，不改变故事。'}</p>
    `;
    hydrateIcons(this.els.titleActions);
  }

  updateRankSelection(rankId) {
    this.selectedRank = rankId;
    const rank = RANKS[rankId] ?? RANKS.silver;
    this.els.titleActions.querySelectorAll('[data-title-rank]').forEach((button) => {
      const selected = button.dataset.titleRank === rankId;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const desc = document.getElementById('title-rank-description');
    if (desc) {
      desc.innerHTML = `
        <span class="rank-dot" style="background:${rank.color}"></span>
        <div><p><b>${rank.title}</b> · ${rank.flavor}</p><small>${rank.description}</small></div>
        <span class="rank-level">${rank.name} / ${rank.stage}</span>
      `;
    }
    const startSmall = this.els.titleActions.querySelector('[data-title-start] small');
    if (startSmall) startSmall.textContent = `${rank.name} · ${rank.stage}`;
  }

  handleTitleClick(event) {
    const rankButton = event.target.closest('[data-title-rank]');
    if (rankButton) {
      this.updateRankSelection(rankButton.dataset.titleRank);
      this.game.audio.unlock();
      this.game.audio.click();
      return;
    }
    if (event.target.closest('[data-title-continue]')) {
      this.game.audio.click();
      this.requestLandscape();
      this.game.continueGame();
      return;
    }
    if (event.target.closest('[data-title-start]')) {
      this.game.audio.unlock();
      this.game.audio.click();
      this.requestLandscape();
      if (this.saveMeta) {
        this.openConfirm({
          eyebrow: '新的航程',
          title: '要覆盖现在的栖云岛吗？',
          body: `这会删除现有的旅程存档（第 ${this.saveMeta.day} 日、${this.saveMeta.stamps}/7 枚信物），从第一天的潮声重新开始。`,
          confirmLabel: '覆盖并开始',
          cancelLabel: '保留现状',
          danger: true,
          onConfirm: () => this.game.startNewGame(this.selectedRank),
        });
      } else {
        this.game.startNewGame(this.selectedRank);
      }
    }
  }

  hideTitle(immediate = false) {
    if (!this.els.title) return;
    if (immediate) {
      this.els.title.classList.add('is-hidden');
      return;
    }
    this.els.title.classList.add('is-leaving');
    window.setTimeout(() => this.els.title?.classList.add('is-hidden'), 780);
  }

  startGame({ isNew }) {
    this.started = true;
    this.hideTitle();
    this.els.hud?.classList.remove('is-hidden');
    document.body.classList.add('in-game');
    this.updateHUD(true);
    this.drawMinimap();
    this.updateInteraction(null);
    this.setSoundIcon(this.game.state.settings.sound !== false);
    this.applyControlPreferences();
    if (this.isTouch) this.els.touchControls?.classList.remove('is-hidden');
    if (!this.game.state.flags.hintDismissed) {
      this.showControlHint();
    } else {
      this.hideControlHint(true);
    }
    window.setTimeout(() => this.hideControlHint(true), 18000);
    this.game.audio.unlock();
  }

  showControlHint() {
    this.els.controlHint?.classList.remove('is-hidden');
    if (this.controlHintTimer) window.clearTimeout(this.controlHintTimer);
    this.controlHintTimer = window.setTimeout(() => this.hideControlHint(true), 16000);
  }

  hideControlHint(remember = false) {
    this.els.controlHint?.classList.add('is-hidden');
    if (this.controlHintTimer) window.clearTimeout(this.controlHintTimer);
    if (remember && this.game.state) this.game.state.flags.hintDismissed = true;
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  handleAction(action) {
    if (!this.game.state) return;
    if (action === 'map') this.game.openMap();
    else if (action === 'build') {
      if (this.buildOpen) this.game.closeBuildMode();
      else this.game.openBuildMode();
    } else if (action === 'expand') this.game.openExpansionPanel();
    else if (action === 'study') this.game.openStudyGuide();
    else if (action === 'bag') this.game.openBag();
    else if (action === 'codex') this.game.openCodex();
    else if (action === 'journal') this.game.openJournal();
    else if (action === 'time') this.game.skipHours(6);
  }

  /** 把「左右手 / 摇杆大小 / 横屏」这些偏好真正落到 DOM 上。 */
  applyControlPreferences() {
    const settings = this.game.state?.settings ?? {};
    document.body.dataset.hand = settings.hand === 'left' ? 'left' : 'right';
    const sizes = {
      small: ['5.3rem', '2.2rem'],
      medium: ['6.4rem', '2.7rem'],
      large: ['7.5rem', '3.15rem'],
    };
    const [stick, knob] = sizes[settings.stickSize] ?? sizes.medium;
    document.body.style.setProperty('--stick-size', stick);
    document.body.style.setProperty('--stick-knob', knob);
    this.isTouch = this.isTouch || (settings.forceTouch === true);
  }

  async requestLandscape() {
    if (!this.isTouch || this.isLandscapeFrame) return;
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
      }
      await screen.orientation?.lock?.('landscape');
    } catch (error) {
      // 没有原生转屏权限也不需要提示：移动端入口已由横向容器兜底。
    }
  }

  updateHUD(force = false) {
    const state = this.game.state;
    if (!state || !this.els.resources) return;
    const signature = JSON.stringify({
      coins: state.coins, r: state.resources, energy: Math.round(state.player.energy), p: state.player,
      day: state.day, time: Math.floor(state.timeMinutes), loc: state.location, insights: state.insight,
      quest: state.mainQuestIndex, qp: state.questProgress, daily: state.daily?.claimed,
    });
    if (!force && signature === this.lastResourceSignature) {
      this.updateQuestTracker(false);
      return;
    }
    this.lastResourceSignature = signature;
    const resourceValues = {
      ...state.resources,
      coins: state.coins,
      insight: state.insight,
    };
    this.els.resources.innerHTML = HUD_RESOURCES.map((type) => resourceChip(type, resourceValues[type] ?? 0, { showName: false })).join('');
    this.els.resources.querySelectorAll('.res-chip').forEach((chip) => {
      const type = [...chip.classList].find((cls) => cls.startsWith('res-chip--'))?.replace('res-chip--', '');
      const value = Number(resourceValues[type] ?? 0);
      chip.title = `${specialDef(type).name}：${value}`;
      chip.setAttribute('data-resource', type);
      chip.setAttribute('data-value', String(value));
    });
    const island = ISLAND_MAP[state.location] ?? ISLAND_MAP.home;
    const locationEl = document.getElementById('hud-location');
    const dayEl = document.getElementById('hud-day');
    const timeEl = document.getElementById('hud-time');
    const glyphEl = document.getElementById('hud-location-icon');
    if (locationEl) locationEl.textContent = island.name;
    if (dayEl) dayEl.textContent = `第 ${state.day} 日 · ${getSeason(state.day)} · ${this.game.getWeatherForDay(state.day)?.name ?? '晴潮'}`;
    if (timeEl) timeEl.textContent = formatTime(state.timeMinutes);
    if (glyphEl) glyphEl.textContent = island.glyph;
    this.updateEnergyRing(state);
    this.updateQuestTracker(force);
    this.updateHUDLocks();
    const mapButton = document.querySelector('[data-action="map"]');
    if (mapButton) mapButton.classList.toggle('is-locked', !state.flags.dockRepaired);
    const buildButton = document.querySelector('[data-action="build"]');
    if (buildButton) buildButton.classList.toggle('is-locked', state.location !== 'home');
    const coords = document.getElementById('hud-coordinates');
    if (coords) {
      const nearest = this.game.world?.getNearestInteraction?.();
      const context = nearest?.prompt ? ` · ${nearest.prompt}` : '';
      coords.textContent = `${island.name}${context}`;
    }
  }

  updateEnergyRing(state) {
    const max = state.getEffectiveMaxEnergy?.() ?? 100;
    const current = Math.round(state.player.energy);
    const ratio = clamp(current / max, 0, 1);
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    if (this.els.energyRing) {
      this.els.energyRing.style.strokeDasharray = String(circumference);
      this.els.energyRing.style.strokeDashoffset = String(circumference * (1 - ratio));
    }
    if (this.els.energyValue) this.els.energyValue.textContent = String(current);
    const label = document.getElementById('hud-energy-label');
    if (label) label.textContent = ratio > 0.7 ? '状态很好' : ratio > 0.35 ? '有些疲惫' : '需要休息';
    document.body.classList.toggle('low-energy', ratio < 0.28);
  }

  updateHUDLocks() {
    const state = this.game.state;
    const mapLocked = !state?.flags.dockRepaired;
    const railButtons = document.querySelectorAll('.rail-btn');
    railButtons.forEach((button) => {
      const isLocked = button.dataset.action === 'map' ? mapLocked : button.dataset.action === 'build' ? state?.location !== 'home' : false;
      button.classList.toggle('is-locked', isLocked);
    });
  }

  updateQuestTracker(force = false) {
    if (!this.els.questTracker) return;
    const state = this.game.state;
    if (!state) return;
    const view = this.game.getQuestProgressView();
    const dailyClaimed = state.daily?.claimed?.length ?? 0;
    const questSignature = `${state.mainQuestIndex}-${view.current}-${view.target}-${dailyClaimed}-${state.getStampCount?.()}`;
    if (!force && questSignature === this.lastQuestSignature) return;
    this.lastQuestSignature = questSignature;
    if (!view.quest) {
      this.els.questTracker.innerHTML = `
        <div class="tracker-kicker"><span>群岛 · 自由生长</span><span>${state.getStampCount()}/7</span></div>
        <h3>让岛按你的方式继续</h3>
        <p class="tracker-objective">所有主线已经落成。种花、造桥、和居民聊天，或者去远岛重温问题。</p>
        <button class="tracker-link" data-tracker-action="journal" type="button">打开手记 ${icon('arrow')}</button>
      `;
      return;
    }
    const quest = view.quest;
    this.els.questTracker.innerHTML = `
      <div class="tracker-kicker"><span>${quest.chapter}</span><span>${state.getStampCount()}/7 信物</span></div>
      <h3>${escapeText(quest.title)}</h3>
      <div class="tracker-progress">
        <span style="width:${Math.round(view.ratio * 100)}%"></span>
      </div>
      <div class="tracker-objective-row">
        <p class="tracker-objective">${escapeText(quest.objective.label)}</p>
        <small>${view.current}/${view.target}</small>
      </div>
      <p class="tracker-hint">${escapeText(quest.hint)}</p>
      <div class="tracker-footer">
        <button class="tracker-link" data-tracker-action="journal" type="button">手记 ${icon('arrow')}</button>
        <span class="tracker-daily">每日 ${dailyClaimed}/3</span>
      </div>
    `;
    const link = this.els.questTracker.querySelector('[data-tracker-action]');
    link?.addEventListener('click', () => this.game.openJournal());
  }

  updateInteraction(interaction) {
    if (!this.els.prompt) return;
    if (!interaction || this.hasModalOpen() || this.isBuildOpen()) {
      this.els.prompt.classList.add('is-hidden');
      this.lastNearestId = null;
      return;
    }
    this.els.prompt.classList.remove('is-hidden');
    this.els.promptLabel.textContent = interaction.label;
    this.els.promptHint.textContent = interaction.prompt ?? '走近之后';
    this.lastNearestId = interaction.id;
    if (this.isTouch) {
      const key = this.els.prompt.querySelector('kbd');
      if (key) key.textContent = '触';
    }
  }

  drawMinimap() {
    const canvas = this.els?.minimap;
    if (!canvas || !this.game.world || !this.game.state) return;
    const data = this.game.world.getMinimapData?.();
    if (!data) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const centerX = width / 2;
    const centerY = height / 2;
    const padding = 18;
    const maxRadius = Math.min(width, height) / 2 - padding;
    const extent = Math.max(data.radius + 2, ...data.buildZones.map((zone) => Math.hypot(zone.x, zone.z) + zone.r + 3), 22);
    const scale = maxRadius / extent;
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxRadius - 2, 0, Math.PI * 2);
    ctx.clip();
    const bg = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, maxRadius);
    bg.addColorStop(0, 'rgba(31,72,69,.95)');
    bg.addColorStop(1, 'rgba(14,40,44,.94)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    // 潮纹
    ctx.strokeStyle = 'rgba(179,226,205,.08)';
    ctx.lineWidth = 1;
    for (let r = 24; r < maxRadius; r += 16) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    const toCanvas = (x, z) => [centerX + x * scale, centerY + z * scale];
    // 岛屿外轮廓
    ctx.beginPath();
    const mainR = (ISLAND_MAP[this.game.state.location]?.walkRadius ?? data.radius) * scale;
    ctx.arc(centerX, centerY, mainR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(178,196,137,.2)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(199,224,174,.44)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    data.buildZones.forEach((zone, index) => {
      if (index === 0) return;
      const [x, y] = toCanvas(zone.x, zone.z);
      ctx.beginPath();
      ctx.arc(x, y, zone.r * scale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(178,196,137,.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(199,224,174,.33)';
      ctx.stroke();
    });
    // 路径
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX, centerY + 15 * scale);
    ctx.strokeStyle = 'rgba(231,205,151,.28)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 可交互点
    data.interactions.forEach((item) => {
      if (item.disabled) return;
      if (['gather'].includes(item.kind) && !item.glyph) return;
      const [x, y] = toCanvas(item.x, item.z);
      if (Math.hypot(x - centerX, y - centerY) > maxRadius - 3) return;
      let color = '#d7c38c';
      if (item.kind === 'gather' || item.kind === 'farm') color = '#9ac47e';
      else if (item.kind === 'trial' || item.kind === 'codex') color = '#9fe5d8';
      else if (item.kind === 'npc' || item.kind === 'resident') color = '#e6b2a2';
      else if (item.kind === 'dock') color = '#8dcad5';
      else if (item.kind === 'building') color = '#e1c27e';
      ctx.beginPath();
      ctx.arc(x, y, item.glyph ? 3.2 : 1.8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
    if (this.buildOpen) {
      ctx.strokeStyle = 'rgba(234,207,150,.35)';
      ctx.setLineDash([2, 4]);
      data.buildZones.forEach((zone) => {
        const [x, y] = toCanvas(zone.x, zone.z);
        ctx.beginPath();
        ctx.arc(x, y, zone.r * scale, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.setLineDash([]);
    }
    // 玩家
    const px = centerX + data.player.x * scale;
    const py = centerY + data.player.z * scale;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-data.player.rotation + Math.PI);
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fillStyle = '#ffe3a0';
    ctx.shadowColor = 'rgba(255,227,160,.8)';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
    ctx.restore();
    // 外圈
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxRadius - 1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(227,204,154,.38)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ---------------------------------------------------------------------------
  // Toast / modal 基础设施
  // ---------------------------------------------------------------------------

  showToast(message, options = {}) {
    if (!this.els?.toastStack) return;
    const { title = '', tone = 'calm', iconName = null, duration = 3200 } = options;
    const iconNameResolved = iconName ?? options.icon ?? 'spark';
    const toast = document.createElement('div');
    toast.className = `toast toast--${tone}`;
    toast.innerHTML = `
      <span class="toast-icon">${iconMarkup(iconNameResolved)}</span>
      <div class="toast-copy">${title ? `<strong>${escapeText(title)}</strong>` : ''}<p>${message}</p></div>
      <button class="toast-close" type="button" aria-label="关闭通知">${icon('close')}</button>
      <span class="toast-line" style="animation-duration:${duration}ms"></span>
    `;
    toast.querySelector('.toast-close')?.addEventListener('click', () => this.removeToast(toast));
    this.els.toastStack.appendChild(toast);
    const maxToasts = this.isTouch ? 3 : 5;
    while (this.els.toastStack.children.length > maxToasts) {
      this.els.toastStack.firstElementChild?.remove();
    }
    const timeout = window.setTimeout(() => this.removeToast(toast), duration);
    toast._timeout = timeout;
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    return toast;
  }

  removeToast(toast) {
    if (!toast?.isConnected) return;
    window.clearTimeout(toast._timeout);
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), 260);
  }

  showLoot(granted, { title = '收进行囊' } = {}) {
    if (!granted?.length) return;
    const toast = document.createElement('div');
    toast.className = 'toast toast--loot';
    toast.innerHTML = `
      <span class="toast-icon">${icon('spark')}</span>
      <div class="toast-copy">
        <strong>${escapeText(title)}</strong>
        <div class="loot-chips">${granted.map(inventoryGrantChip).join('')}</div>
      </div>
      <button class="toast-close" type="button" aria-label="关闭">${icon('close')}</button>
      <span class="toast-line" style="animation-duration:4200ms"></span>
    `;
    toast.querySelector('.toast-close')?.addEventListener('click', () => this.removeToast(toast));
    this.els.toastStack.appendChild(toast);
    while (this.els.toastStack.children.length > (this.isTouch ? 3 : 4)) this.els.toastStack.firstElementChild?.remove();
    toast._timeout = window.setTimeout(() => this.removeToast(toast), 4200);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
  }

  showAchievement(definition) {
    this.showToast(`「${definition.name}」 · ${definition.desc}`, {
      title: '获得一枚岛上印记',
      tone: 'achievement',
      icon: definition.icon ?? 'crown',
      duration: 4800,
    });
  }

  mountModal({
    content,
    className = '',
    size = 'md',
    dismissable = true,
    hideClose = false,
    ariaLabel = '对话框',
    onMount,
    onClose,
    type = 'generic',
  }) {
    if (this.modal) this.closeModal(true);
    this.els?.toastStack?.replaceChildren();
    const root = document.createElement('div');
    root.className = 'overlay-backdrop';
    root.dataset.dismissable = String(dismissable);
    root.innerHTML = `
      <section class="modal-panel modal-${size} ${className}" role="dialog" aria-modal="true" tabindex="-1" aria-label="${escapeText(ariaLabel)}">
        ${hideClose ? '' : `<button class="modal-close" data-modal-close type="button" aria-label="关闭">${icon('close')}</button>`}
        ${content}
      </section>
    `;
    this.els.overlayRoot.appendChild(root);
    document.body.classList.add('has-overlay');
    this.modal = root;
    this.modalType = type;
    this.panelType = type;
    this.modalCleanup = onClose ?? null;
    this.game.onUiModalChanged?.(true);
    onMount?.(root);
    requestAnimationFrame(() => root.classList.add('is-open'));
    const focusTarget = root.querySelector('[data-autofocus]') ?? root.querySelector('.modal-panel');
    window.setTimeout(() => focusTarget?.focus?.(), 80);
    return root;
  }

  closeModal(immediate = false) {
    if (!this.modal) return;
    const root = this.modal;
    const cleanup = this.modalCleanup;
    this.modal = null;
    this.modalType = null;
    this.panelType = null;
    this.modalCleanup = null;
    this.pausedMenuOpen = false;
    if (this.activeDialogue?.stop) this.activeDialogue.stop();
    this.activeDialogue = null;
    this.stopForgeAnimation();
    try { cleanup?.(); } catch (error) { console.warn(error); }
    document.body.classList.remove('has-overlay');
    root.classList.remove('is-open');
    root.classList.add('is-closing');
    if (immediate) root.remove();
    else window.setTimeout(() => root.remove(), 240);
    this.game.onUiModalChanged?.(false);
    window.setTimeout(() => this.flushNoticeQueue(), 260);
  }

  hasModalOpen() {
    return Boolean(this.modal);
  }

  isBuildOpen() {
    return this.buildOpen;
  }

  isPausedMenuOpen() {
    return this.pausedMenuOpen;
  }

  handleOverlayClick(event) {
    const closeButton = event.target.closest('[data-modal-close]');
    if (closeButton) {
      this.game.audio.click();
      this.closeModal();
      return;
    }
    if (event.target.classList?.contains('overlay-backdrop')) {
      if (event.target.dataset.dismissable !== 'false') this.closeModal();
      return;
    }
    const confirmButton = event.target.closest('[data-confirm-action]');
    if (confirmButton) {
      event.preventDefault();
      const action = confirmButton.dataset.confirmAction;
      const callback = this.confirmCallback;
      this.confirmCallback = null;
      if (action === 'confirm') {
        this.closeModal();
        window.setTimeout(() => callback?.(), 120);
      } else {
        this.closeModal();
      }
      return;
    }
    const tab = event.target.closest('[data-journal-tab]');
    if (tab) {
      this.journalTab = tab.dataset.journalTab;
      this.renderJournalTab();
      return;
    }
    const codexFilter = event.target.closest('[data-codex-filter]');
    if (codexFilter) {
      this.codexFilter = codexFilter.dataset.codexFilter;
      this.renderCodexContent();
      return;
    }
    const mapNode = event.target.closest('[data-map-node]');
    if (mapNode) {
      this.mapSelection = mapNode.dataset.mapNode;
      this.renderMapSelection();
      return;
    }
    if (event.target.closest('[data-map-travel]')) {
      const islandId = this.mapSelection;
      if (islandId && islandId !== this.game.state.location) {
        this.game.travel(islandId);
      }
      return;
    }
    if (event.target.closest('[data-eat-food]')) {
      this.game.eatFood();
      return;
    }
    const equip = event.target.closest('[data-equip-tool]');
    if (equip) {
      this.game.equipTool(equip.dataset.equipTool);
      return;
    }
    const plant = event.target.closest('[data-plant-seed]');
    if (plant) {
      this.game.plantSeed(plant.dataset.plotId, plant.dataset.plantSeed);
      return;
    }
    const harvest = event.target.closest('[data-harvest-plot]');
    if (harvest) {
      this.game.harvestPlot(harvest.dataset.harvestPlot);
      return;
    }
    const buySeed = event.target.closest('[data-buy-seed]');
    if (buySeed) {
      const wasMarket = this.modalType === 'market';
      this.game.buySeed(buySeed.dataset.buySeed);
      if (wasMarket && this.modal) this.openMarket();
      return;
    }
    const sell = event.target.closest('[data-sell-resource]');
    if (sell) {
      this.game.sellResource(sell.dataset.sellResource, 1);
      return;
    }
    const recipe = event.target.closest('[data-forge-recipe]');
    if (recipe) {
      this.game.startForge(recipe.dataset.forgeRecipe);
      return;
    }
    const quizAnswer = event.target.closest('[data-quiz-answer]');
    if (quizAnswer) {
      this.answerQuiz(Number(quizAnswer.dataset.quizAnswer));
      return;
    }
    if (event.target.closest('[data-quiz-next]')) {
      this.advanceQuiz();
      return;
    }
    if (event.target.closest('[data-quiz-retry]')) {
      const quiz = this.quiz;
      const context = quiz ?? this.lastQuizContext;
      this.closeModal();
      if (context?.trial && context?.island) {
        window.setTimeout(() => this.game.startTrial(context.trial.id, { data: { islandId: context.island.id } }), 280);
      }
      return;
    }
    if (event.target.closest('[data-quiz-close]')) {
      this.closeModal();
      return;
    }
    if (event.target.closest('[data-forge-strike]')) {
      this.strikeForge();
      return;
    }
    if (event.target.closest('[data-forge-finish]')) {
      this.completeForgeMinigame();
      return;
    }
    if (event.target.closest('[data-forge-again]')) {
      this.openForge();
      return;
    }
    if (event.target.closest('[data-forge-close]')) {
      this.closeModal();
      return;
    }
    if (event.target.closest('[data-dialogue-next]')) {
      this.advanceDialogue();
      return;
    }
    if (event.target.closest('[data-dialogue-skip]')) {
      this.finishDialogue(true);
      return;
    }
    if (event.target.closest('[data-campfire-rest]')) {
      this.closeModal();
      window.setTimeout(() => this.game.restAtCampfire(), 160);
      return;
    }
    if (event.target.closest('[data-campfire-sleep]')) {
      this.closeModal();
      window.setTimeout(() => this.game.openSleepConfirm(), 160);
      return;
    }
    if (event.target.closest('[data-pause-resume]')) {
      this.closeModal();
      return;
    }
    if (event.target.closest('[data-pause-save]')) {
      this.game.persistState();
      this.game.audio.coin();
      this.showToast('旅程已收进海底的贝壳里。', { title: '保存成功', icon: 'check', tone: 'reward' });
      return;
    }
    if (event.target.closest('[data-pause-journal]')) {
      this.closeModal();
      window.setTimeout(() => this.game.openJournal(), 260);
      return;
    }
    if (event.target.closest('[data-pause-help]')) {
      this.closeModal();
      window.setTimeout(() => this.game.openHelp(), 260);
      return;
    }
    if (event.target.closest('[data-pause-settings]')) {
      this.openSettings();
      return;
    }
    if (event.target.closest('[data-pause-restart]')) {
      this.openConfirm({
        eyebrow: '重新开始',
        title: '确定要舍弃这座岛吗？',
        body: '当前存档会被清除，所有建筑、信物和居民都会回到潮水里。',
        confirmLabel: '清除并重新开始',
        cancelLabel: '再想想',
        danger: true,
        onConfirm: () => this.game.restartGame(),
      });
      return;
    }
    const settingsAction = event.target.closest('[data-settings-action]');
    if (settingsAction) {
      const action = settingsAction.dataset.settingsAction;
      if (action === 'sound') {
        this.game.toggleSound();
        this.openSettings();
      }
      if (action === 'quality') {
        this.game.setQuality(settingsAction.dataset.value);
        this.openSettings();
      }
      if (action === 'hand' || action === 'stick') {
        const key = action === 'hand' ? 'hand' : 'stickSize';
        this.game.state.settings[key] = settingsAction.dataset.value;
        this.applyControlPreferences();
        this.game.persistState();
        this.openSettings();
      }
      if (action === 'landscape') {
        const next = !this.game.state.settings.landscapeLock;
        this.game.state.settings.landscapeLock = next;
        this.game.persistState();
        if (next) this.requestLandscape();
        this.openSettings();
      }
      if (action === 'back') this.closeModal();
      return;
    }
    if (event.target.closest('[data-finale-close]')) {
      this.closeModal();
      return;
    }
    if (event.target.closest('[data-day-close]')) {
      this.closeModal();
      return;
    }
    const expandButton = event.target.closest('[data-expand-id]');
    if (expandButton) {
      this.game.expandIsland(expandButton.dataset.expandId);
      this.closeModal();
      return;
    }
    if (event.target.closest('[data-expansion-study]')) {
      this.closeModal();
      this.openStudyGuide();
      return;
    }
    const studyGo = event.target.closest('[data-study-go]');
    if (studyGo) {
      this.closeModal();
      this.game.travel(studyGo.dataset.studyGo);
      return;
    }
    if (event.target.closest('[data-help-close]')) {
      this.closeModal();
      return;
    }
    if (event.target.closest('[data-credits-close]')) {
      this.closeModal();
      return;
    }
    if (event.target.closest('[data-info-close]')) {
      this.closeModal();
      return;
    }
  }

  handleOverlayInput(event) {
    if (event.target.matches('#codex-search')) {
      this.codexQuery = event.target.value;
      this.renderCodexContent();
    }
  }

  // ---------------------------------------------------------------------------
  // 对话
  // ---------------------------------------------------------------------------

  playDialogueSequence(lines, options = {}) {
    if (!Array.isArray(lines) || !lines.length) {
      options.onComplete?.();
      return;
    }
    let index = 0;
    let typing = false;
    let finished = false;
    let typeTimer = null;
    let fullText = '';
    let closeFn = null;
    const sequenceComplete = () => {
      if (finished) return;
      finished = true;
      if (typeTimer) window.clearInterval(typeTimer);
      if (this.activeDialogue?.keyHandler) document.removeEventListener('keydown', this.activeDialogue.keyHandler);
      this.activeDialogue = null;
      try { options.onComplete?.(); } catch (error) { console.warn(error); }
    };
    const root = this.mountModal({
      hideClose: true,
      dismissable: false,
      className: 'story-dialog-modal',
      size: 'story',
      ariaLabel: '剧情对话',
      type: 'dialogue',
      content: `
        <div class="story-dialog">
          <div class="story-dialog__art">
            <div class="story-orb"></div>
            <div class="story-arch"></div>
            <div class="story-portrait" id="dialogue-portrait">${portrait(lines[0].avatar ?? 'alan')}</div>
            <span class="story-caption">${escapeText(options.eyebrow ?? '群岛手记')}</span>
          </div>
          <div class="story-dialog__text">
            <div class="story-speaker">
              <strong id="dialogue-speaker">${escapeText(lines[0].speaker ?? '')}</strong>
              <span id="dialogue-title">${escapeText(lines[0].title ?? '')}</span>
            </div>
            <p class="story-line" id="dialogue-line"></p>
            <div class="story-nav">
              <span id="dialogue-counter">01 / ${String(lines.length).padStart(2, '0')}</span>
              <div class="story-nav__actions">
                <button class="text-btn" data-dialogue-skip type="button">跳过</button>
                <button class="primary-btn compact" data-dialogue-next type="button" data-autofocus>继续 ${icon('arrow')}</button>
              </div>
            </div>
          </div>
        </div>
      `,
      onMount: (modalRoot) => {
        closeFn = () => this.closeModal();
        const lineEl = modalRoot.querySelector('#dialogue-line');
        const speakerEl = modalRoot.querySelector('#dialogue-speaker');
        const titleEl = modalRoot.querySelector('#dialogue-title');
        const counterEl = modalRoot.querySelector('#dialogue-counter');
        const portraitEl = modalRoot.querySelector('#dialogue-portrait');
        const nextButton = modalRoot.querySelector('[data-dialogue-next]');
        const reveal = () => {
          if (typeTimer) window.clearInterval(typeTimer);
          typeTimer = null;
          typing = false;
          lineEl.textContent = fullText;
          if (nextButton) nextButton.innerHTML = `${index === lines.length - 1 ? '结束对话' : '继续'} ${icon('arrow')}`;
        };
        const typeLine = () => {
          typing = true;
          lineEl.textContent = '';
          nextButton.innerHTML = '展开这段话';
          let charIndex = 0;
          typeTimer = window.setInterval(() => {
            charIndex += 1;
            lineEl.textContent = fullText.slice(0, charIndex);
            if (charIndex >= fullText.length) {
              window.clearInterval(typeTimer);
              typeTimer = null;
              typing = false;
              nextButton.innerHTML = `${index === lines.length - 1 ? '结束对话' : '继续'} ${icon('arrow')}`;
            }
          }, 20);
        };
        const renderLine = () => {
          const line = lines[index];
          speakerEl.textContent = line.speaker ?? '';
          titleEl.textContent = line.title ?? '';
          counterEl.textContent = `${String(index + 1).padStart(2, '0')} / ${String(lines.length).padStart(2, '0')}`;
          portraitEl.innerHTML = portrait(line.avatar ?? 'alan');
          fullText = line.text ?? '';
          typeLine();
        };
        this.advanceDialogue = () => {
          if (typing) {
            reveal();
            return;
          }
          if (index < lines.length - 1) {
            index += 1;
            renderLine();
            this.game.audio.click();
          } else {
            this.finishDialogue(true);
          }
        };
        this.finishDialogue = (silent = false) => {
          if (typeTimer) window.clearInterval(typeTimer);
          if (!silent) this.game.audio.success();
          sequenceComplete();
          this.closeModal();
        };
        const keyHandler = (event) => {
          if (event.target?.closest?.('button, a, input, textarea, summary')) return;
          if ([' ', 'Enter'].includes(event.key)) {
            event.preventDefault();
            this.advanceDialogue();
          }
        };
        document.addEventListener('keydown', keyHandler);
        this.activeDialogue = {
          stop: () => {
            if (typeTimer) window.clearInterval(typeTimer);
            document.removeEventListener('keydown', keyHandler);
            if (!finished) sequenceComplete();
          },
          keyHandler,
        };
        renderLine();
      },
      onClose: () => {
        if (!finished) sequenceComplete();
      },
    });
    root.querySelector('[data-dialogue-next]')?.focus();
    this.activeDialogue.close = closeFn;
  }

  // ---------------------------------------------------------------------------
  // 通知队列 / 任务完成
  // ---------------------------------------------------------------------------

  enqueueNotice(callback) {
    this.queuedNotices.push(callback);
    this.flushNoticeQueue();
  }

  flushNoticeQueue() {
    if (!this.queuedNotices.length) return;
    if (this.modal || this.buildOpen) return;
    const next = this.queuedNotices.shift();
    try { next(); } catch (error) { console.warn(error); }
  }

  showQuestComplete(quest, nextQuest, granted) {
    this.enqueueNotice(() => {
      const reward = rewardChips(quest.rewards ?? {});
      this.mountModal({
        size: 'quest',
        className: 'quest-complete-modal',
        ariaLabel: '主线完成',
        content: `
          <div class="quest-complete">
            <div class="quest-complete__sigil">${icon('spark')}<span></span></div>
            <p class="eyebrow">${escapeText(quest.chapter)} · 主线完成</p>
            <h2>${escapeText(quest.title)}</h2>
            <p class="quest-complete__sub">${escapeText(quest.subtitle)}</p>
            <div class="quest-story">${escapeText(quest.completion)}</div>
            <div class="quest-reward-block">
              <span class="block-label">收进手记的奖励</span>
              ${reward}
            </div>
            ${nextQuest ? `<div class="quest-next"><span>下一步</span><strong>${escapeText(nextQuest.title)}</strong><p>${escapeText(nextQuest.objective.label)}</p></div>` : '<div class="quest-next"><span>终章</span><strong>群岛的灯已经亮起</strong><p>继续自由地生活、建造与学习吧。</p></div>'}
            <button class="primary-btn" data-modal-close type="button">合上手记 ${icon('arrow')}</button>
          </div>
        `,
        onClose: () => {},
      });
      this.game.audio.quest();
    });
  }

  showDaySummary({ day, income, foodInc, readyCrops, activeQuest, dailyTasks, weather }) {
    this.enqueueNotice(() => {
      const tasks = dailyTasks?.map((task) => `<li>${iconMarkup(task.icon)}<span>${escapeText(task.label)}</span><small>${rewardChips(task.reward)}</small></li>`).join('') ?? '';
      this.mountModal({
        size: 'day',
        className: 'day-summary-modal',
        ariaLabel: '新的一天',
        content: `
          <div class="day-summary">
            <div class="day-summary__sun"><span></span></div>
            <p class="eyebrow">第 ${day} 日 · ${escapeText(getSeason(day))}</p>
            <h2>潮水又替你<br>翻开了新的一页</h2>
            <div class="weather-line">${iconMarkup(weather?.icon ?? 'sun')}<span><b>${escapeText(weather?.name ?? '晴潮')}</b> · ${escapeText(weather?.desc ?? '适合出门。')}</span></div>
            <div class="day-summary__grid">
              <div><small>岛上市集</small><strong>${income ? `+${income} 银叶币` : '安静的清晨'}</strong></div>
              <div><small>风语磨坊</small><strong>${foodInc ? `+${foodInc} 份食物` : '叶片慢慢转着'}</strong></div>
              <div><small>田垄</small><strong>${readyCrops ? `${readyCrops} 株可以收获` : '还在悄悄生长'}</strong></div>
            </div>
            ${activeQuest ? `<div class="day-quest"><span>手记上的方向</span><strong>${escapeText(activeQuest.title)}</strong><p>${escapeText(activeQuest.objective.label)}</p></div>` : ''}
            <div class="day-daily">
              <div class="block-label"><span>今日委托</span><small>完成即可自动领取</small></div>
              <ul>${tasks}</ul>
            </div>
            <button class="primary-btn" data-day-close type="button">开始新的一天 ${icon('sun')}</button>
          </div>
        `,
      });
    });
  }

  showFinale(data) {
    this.enqueueNotice(() => {
      if (this.finaleShown) return;
      this.finaleShown = true;
      // 终章不应被一堆“任务完成”的通知遮住。
      this.els.toastStack?.replaceChildren();
      const stars = Array.from({ length: 42 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--y:${(i * 61) % 100}%;--d:${(i % 7) * 0.3}s"></i>`).join('');
      this.mountModal({
        size: 'finale',
        className: 'finale-modal',
        ariaLabel: '终章',
        hideClose: true,
        content: `
          <div class="finale">
            <div class="finale-stars">${stars}</div>
            <div class="finale-observatory">${icon('observatory')}</div>
            <p class="eyebrow">终章 · 群星回信</p>
            <h1>你造了一座<br><em>望向问题尽头的塔</em></h1>
            <p class="finale-prose">七座岛的信物在同一枚镜片里安静下来。海风穿过观星台的缝隙，带来语文的墨香、数学的秩序、物理的微光、化学的颜色、生物的气息、英语的远方，以及百工城里普通而可靠的锤声。</p>
            <p class="finale-prose">栖云岛不再是荒岛。${data.residents} 位居民在这里点灯，${data.buildings} 座建筑替你记住了每一次选择。你终于明白：所谓知识，不是离开生活去回答的问题，而是回到生活里，把问题变成桥、变成屋顶、变成一顿晚饭。</p>
            <div class="finale-stats">
              <div><span>${data.days}</span><small>在岛上的日子</small></div>
              <div><span>${data.stamps}/7</span><small>学科信物</small></div>
              <div><span>${data.residents}</span><small>留下的居民</small></div>
              <div><span>${data.codex}</span><small>知海卡片</small></div>
            </div>
            <div class="finale-quote">“群岛没有最后一题。<br>只有下一座，愿意为你亮起的岛。”</div>
            <button class="primary-btn" data-finale-close type="button">继续在群岛上生活 ${icon('arrow')}</button>
            <p class="finale-small">存档保留 · 可以继续建造、答题、种田与旅行</p>
          </div>
        `,
      });
      this.game.audio.quest();
    });
  }

  // ---------------------------------------------------------------------------
  // 建造
  // ---------------------------------------------------------------------------

  openBuild({ selectedType, definitions }) {
    this.buildOpen = true;
    this.buildCategory = '全部';
    this.selectedBuildType = selectedType;
    this.buildDefinitions = definitions;
    this.els.toastStack?.replaceChildren();
    this.els.buildDock.classList.remove('is-hidden', 'is-minimized');
    document.body.classList.add('build-open');
    document.body.classList.remove('build-minimized');
    this.renderBuildPanel();
    this.game.world?.setBuildMode(true);
    this.game.world?.setBuildZonesVisible?.(true);
  }

  closeBuild() {
    this.buildOpen = false;
    this.els.buildDock.classList.add('is-hidden');
    this.els.buildDock.classList.remove('is-minimized');
    document.body.classList.remove('build-open', 'build-minimized');
    this.flushNoticeQueue();
  }

  minimizeBuildPanel() {
    if (!this.buildOpen || !this.isTouch || window.innerWidth > 900) return;
    this.els.buildDock.classList.add('is-minimized');
    document.body.classList.add('build-minimized');
    this.els.toastStack?.replaceChildren();
    this.showToast('蓝图画好了。点击地面放置建筑，底部可以展开或旋转。', { tone: 'calm', icon: 'build', duration: 3200 });
  }

  restoreBuildPanel() {
    this.els.buildDock.classList.remove('is-minimized');
    document.body.classList.remove('build-minimized');
  }

  renderBuildPanel() {
    if (!this.buildOpen) return;
    const state = this.game.state;
    const definitions = this.game.getBuildableDefinitions();
    const expansions = this.game.getExpansionDefinitions();
    const categories = BUILD_CATEGORIES;
    const filtered = definitions.filter((definition) => this.buildCategory === '全部' || definition.category === this.buildCategory);
    const expansionRows = expansions.map((expansion) => `
      <article class="expansion-card ${expansion.purchased ? 'is-owned' : ''}">
        <div class="expansion-card__art">${icon('island')}<span>+</span></div>
        <div class="expansion-card__copy">
          <div><strong>${escapeText(expansion.name)}</strong><small>${escapeText(expansion.subtitle)}</small></div>
          <p>${escapeText(expansion.description)}</p>
          ${expansion.purchased ? `<span class="owned-mark">${icon('check')} 已扩建</span>` : expansion.unlocked ? costMarkup(expansion.cost, state) : `<span class="locked-note">${icon('lock')} ${escapeText(expansion.missing)}</span>`}
        </div>
        ${expansion.purchased ? '' : `<button class="small-btn ${expansion.unlocked && expansion.affordable ? 'is-ready' : ''}" data-build-expand="${expansion.id}" type="button" ${expansion.unlocked ? '' : 'disabled'}>${expansion.affordable ? '扩建' : '材料不足'}</button>`}
      </article>
    `).join('');
    this.els.buildDock.innerHTML = `
      <div class="build-panel">
        <header class="build-panel__head">
          <div>
            <p class="eyebrow">BUILD MODE · ${this.game.rank.name}工艺</p>
            <h2>让岛再长一点</h2>
            <p class="build-rank-note">${this.game.rank.mark} · ${this.game.rank.quality}匠作 · ${this.game.rank.stage}段位</p>
          </div>
          <div class="build-head-actions">
            <button class="icon-btn build-mini-toggle" data-build-minimize type="button" aria-label="收起蓝图">${icon('arrow')}</button>
            <button class="icon-btn" data-build-close type="button" aria-label="退出建造">${icon('close')}</button>
          </div>
        </header>
        <div class="build-instructions">
          <span>${icon('compass')} 移动鼠标 / 拖动视角</span>
          <span>${icon('build')} 点击空地放置</span>
          <span>${icon('rotate')} R 旋转</span>
        </div>
        <div class="build-categories">
          ${categories.map((category) => `<button class="${this.buildCategory === category ? 'is-active' : ''}" data-build-category="${category}" type="button">${category}</button>`).join('')}
        </div>
        <div class="build-list">
          ${filtered.map((definition) => this.renderBuildCard(definition, state)).join('')}
        </div>
        <section class="build-expansions">
          <div class="build-expansions__head">
            <span>扩建岛屿</span>
            <small>把新的土地从潮水里请出来</small>
          </div>
          ${expansionRows}
        </section>
        <div class="build-panel__footer">
          <span id="build-hover-status" class="build-hover-status">${this.buildHover?.valid ? '可以放置' : '选择一个位置'}</span>
          <div class="build-footer-actions">
            <button class="text-btn" data-build-rotate type="button">${icon('rotate')} 旋转 <span class="desktop-key">R</span></button>
            <button class="small-btn build-mini-only" data-build-restore type="button">展开蓝图</button>
            <button class="small-btn build-mini-only" data-build-close type="button">退出</button>
          </div>
        </div>
      </div>
    `;
    hydrateIcons(this.els.buildDock);
    this.setBuildHover(this.buildHover);
  }

  renderBuildCard(definition, state) {
    const isSelected = definition.id === this.selectedBuildType;
    const canSelect = definition.unlocked;
    return `
      <article class="build-card ${isSelected ? 'is-selected' : ''} ${definition.unlocked ? '' : 'is-locked'} ${definition.affordable ? '' : 'is-short'}" data-build-card="${definition.id}">
        <button class="build-card__select" data-build-type="${definition.id}" type="button">
          <span class="build-icon">${icon(definition.icon)}</span>
          <span class="build-card__copy">
            <span class="build-card__top"><strong>${escapeText(definition.name)}</strong><small>${escapeText(definition.category)}</small></span>
            <span class="build-card__desc">${escapeText(definition.description)}</span>
            <span class="build-card__effect">${escapeText(definition.effect)}</span>
          </span>
          <span class="build-card__check">${isSelected ? icon('check') : definition.built ? `<small>×${definition.built}</small>` : ''}</span>
        </button>
        <div class="build-card__meta">
          ${definition.unlocked ? costMarkup(definition.cost, state) : `<span class="locked-note">${icon('lock')} ${escapeText(definition.missing)}</span>`}
          ${definition.unlocked && !definition.affordable ? '<span class="short-note">材料不足</span>' : ''}
        </div>
      </article>
    `;
  }

  markBuildSelection(type) {
    this.selectedBuildType = type;
    this.els.buildDock.querySelectorAll('[data-build-card]').forEach((card) => {
      card.classList.toggle('is-selected', card.dataset.buildCard === type);
      const check = card.querySelector('.build-card__check');
      if (check) check.innerHTML = card.dataset.buildCard === type ? icon('check') : '';
    });
  }

  setBuildHover(hover) {
    this.buildHover = hover;
    const status = document.getElementById('build-hover-status');
    if (!status) return;
    if (!hover) {
      status.textContent = '选择一个位置';
      status.className = 'build-hover-status';
    } else if (hover.valid) {
      status.textContent = '可以放置 · 点击地面';
      status.className = 'build-hover-status is-valid';
    } else {
      status.textContent = '这里放不下 · 换一片空地';
      status.className = 'build-hover-status is-invalid';
    }
  }

  refreshBuildPanel() {
    if (!this.buildOpen) return;
    this.renderBuildPanel();
  }

  handleBuildClick(event) {
    if (event.target.closest('[data-build-close]')) {
      this.game.closeBuildMode();
      return;
    }
    if (event.target.closest('[data-build-minimize]')) {
      this.minimizeBuildPanel();
      return;
    }
    if (event.target.closest('[data-build-restore]')) {
      this.restoreBuildPanel();
      return;
    }
    if (event.target.closest('[data-build-rotate]')) {
      this.game.rotateBuilding();
      return;
    }
    const category = event.target.closest('[data-build-category]');
    if (category) {
      this.buildCategory = category.dataset.buildCategory;
      this.renderBuildPanel();
      return;
    }
    const typeButton = event.target.closest('[data-build-type]');
    if (typeButton) {
      this.game.selectBuildingType(typeButton.dataset.buildType);
      return;
    }
    const expand = event.target.closest('[data-build-expand]');
    if (expand) {
      this.game.expandIsland(expand.dataset.buildExpand);
    }
  }

  // ---------------------------------------------------------------------------
  // 地图
  // ---------------------------------------------------------------------------

  openMap() {
    if (!this.game.state.flags.dockRepaired) {
      this.showToast('码头还没有修好，海图无法展开。');
      return;
    }
    this.mapSelection = this.game.state.location;
    const lines = ISLANDS.filter((island) => island.id !== 'home').map((island) => {
      const home = ISLAND_MAP.home.map;
      const dx = island.map.x - home.x;
      const dy = island.map.y - home.y;
      const curve = dx * -0.2;
      return `<path d="M${home.x} ${home.y} Q ${home.x + dx * 0.45 + curve} ${home.y + dy * 0.28 - 4}, ${island.map.x} ${island.map.y}" class="map-route" style="--route:${island.accent}"/>`;
    }).join('');
    this.mountModal({
      size: 'map',
      className: 'map-modal',
      ariaLabel: '群岛海图',
      content: `
        <header class="panel-heading map-heading">
          <div>
            <p class="eyebrow">THE ARCHIPELAGO CHART</p>
            <h2>群岛海图</h2>
            <p>七种知识，各自长成一座岛。</p>
          </div>
          <div class="map-head-meta">
            <span>${this.game.state.getStampCount()} / 7 信物</span>
            <span>${this.game.state.visitedIslands.length} / 8 到访</span>
          </div>
        </header>
        <div class="map-layout">
          <div class="map-chart">
            <div class="map-texture"></div>
            <svg class="map-routes" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M8 82 Q28 63 40 42 T72 18" class="map-contour" />
              <path d="M20 16 Q36 35 50 55 T88 83" class="map-contour" />
              <path d="M62 92 Q74 66 92 48" class="map-contour" />
              ${lines}
            </svg>
            ${ISLANDS.map((island) => {
              const isCurrent = island.id === this.game.state.location;
              const passed = island.id === 'home' || this.game.state.stamps[island.id];
              const visited = this.game.state.visitedIslands.includes(island.id);
              return `<button class="map-node ${isCurrent ? 'is-current' : ''} ${passed && island.id !== 'home' ? 'is-stamped' : ''} ${visited ? 'is-visited' : ''}" style="--x:${island.map.x}%;--y:${island.map.y}%;--island:${island.color};--accent:${island.accent}" data-map-node="${island.id}" type="button" aria-label="${island.name}">
                <span class="map-node__rings"><i></i><i></i></span>
                <span class="map-node__glyph">${island.glyph}</span>
                <span class="map-node__name">${island.name}</span>
                <small>${island.domain}</small>
                ${isCurrent ? '<span class="map-node__you">你在这里</span>' : passed && island.id !== 'home' ? `<span class="map-node__stamp">${icon('check')}</span>` : ''}
              </button>`;
            }).join('')}
            <div class="map-compass">${icon('compass')}<span>N</span></div>
            <div class="map-legend"><span><i class="dot dot--stamp"></i>已获信物</span><span><i class="dot dot--current"></i>当前位置</span><span><i class="dot dot--unvisited"></i>未到访</span></div>
            <div class="map-scale">潮汐制图 · 知屿海务司</div>
          </div>
          <aside class="map-detail" id="map-detail"></aside>
        </div>
      `,
      onMount: () => this.renderMapSelection(),
    });
  }

  renderMapSelection() {
    const detail = document.getElementById('map-detail');
    if (!detail) return;
    const island = ISLAND_MAP[this.mapSelection] ?? ISLAND_MAP.home;
    const state = this.game.state;
    const isCurrent = island.id === state.location;
    const passedMainTrials = island.trials?.filter((trial) => state.hasTrialPassed(trial.id)).length ?? 0;
    const stampPassed = island.id === 'home' || Boolean(state.stamps[island.id]);
    const resources = this.getIslandResourceLabels(island.id);
    detail.innerHTML = `
      <div class="map-detail__top">
        <div class="map-detail__glyph" style="--island:${island.color};--accent:${island.accent}">${island.glyph}</div>
        <div>
          <span class="eyebrow">${island.id === 'home' ? 'HOME ISLAND' : `${island.domain} · ISLE ${String(island.order).padStart(2, '0')}`}</span>
          <h3>${escapeText(island.name)}</h3>
          <p>${escapeText(island.tagline)}</p>
        </div>
      </div>
      <p class="map-detail__desc">${escapeText(island.description)}</p>
      <div class="map-detail__meta">
        <div><small>知识领域</small><strong>${escapeText(island.domain)}</strong></div>
        <div><small>本地物产</small><strong>${resources}</strong></div>
        <div><small>岛屿信物</small><strong>${island.id === 'home' ? '家园' : stampPassed ? '已获得' : '尚未获得'}</strong></div>
        <div><small>守岛人</small><strong>${escapeText(island.guardian.name)}</strong></div>
      </div>
      <div class="map-trials">
        <span class="block-label">可探索的试炼</span>
        ${(island.trials ?? []).map((trial) => `<div class="map-trial ${state.hasTrialPassed(trial.id) ? 'is-done' : ''}">
          <span>${state.hasTrialPassed(trial.id) ? icon('check') : icon('spark')}</span>
          <div><strong>${escapeText(trial.name)}</strong><small>${escapeText(trial.focus)} · ${state.trials?.[trial.id]?.best ?? 0}/3 最佳</small></div>
        </div>`).join('')}
      </div>
      <div class="map-node-list">
        ${[ISLAND_MAP.home, ...KNOWLEDGE_ISLANDS].map((item) => `<button data-map-node="${item.id}" class="map-mini ${item.id === island.id ? 'is-active' : ''}" type="button"><span>${item.glyph}</span>${item.shortName}</button>`).join('')}
      </div>
      <button class="primary-btn map-travel-btn" data-map-travel type="button" ${isCurrent ? 'disabled' : ''}>
        ${isCurrent ? '你正在这座岛上' : island.id === 'home' ? '乘船回栖云岛' : `启航前往 ${island.name}`}
        ${!isCurrent ? icon('arrow') : icon('anchor')}
      </button>
      <p class="map-travel-note">${isCurrent ? '岛上的风正在等你起身。' : '航行约需 25 分钟岛上时间。'}</p>
    `;
    hydrateIcons(detail);
  }

  getIslandResourceLabels(islandId) {
    const labels = {
      home: '木材 · 石料 · 食物',
      wen: '墨竹 · 洗砚石',
      shu: '白石 · 晶簇',
      wu: '磁铁矿石 · 共振晶',
      hua: '沉淀晶簇 · 试剂莓',
      sheng: '巨菇 · 生命晶',
      ying: '桅木 · 航海绳草',
      gong: '废铁 · 老梁木',
    };
    return labels[islandId] ?? '未知';
  }

  // ---------------------------------------------------------------------------
  // 通用确认 / 信息 / 暂停与设置
  // ---------------------------------------------------------------------------

  openConfirm({ eyebrow = '请确认', title, body, cost, confirmLabel = '确认', cancelLabel = '取消', danger = false, onConfirm }) {
    this.confirmCallback = onConfirm;
    const state = this.game.state;
    const costBlock = cost && state
      ? `<div class="confirm-cost"><span>所需</span>${costMarkup(cost, state)}</div>`
      : '';
    this.mountModal({
      size: 'confirm',
      className: 'confirm-modal',
      dismissable: false,
      ariaLabel: title,
      content: `
        <div class="confirm-content">
          <p class="eyebrow">${escapeText(eyebrow)}</p>
          <h2>${escapeText(title)}</h2>
          <p class="confirm-body">${body}</p>
          ${costBlock}
          <div class="confirm-actions">
            <button class="text-btn" data-confirm-action="cancel" type="button" ${danger ? 'data-autofocus' : ''}>${escapeText(cancelLabel)}</button>
            <button class="primary-btn ${danger ? 'is-danger' : ''}" data-confirm-action="confirm" type="button" ${danger ? '' : 'data-autofocus'}>${escapeText(confirmLabel)} ${icon('arrow')}</button>
          </div>
        </div>
      `,
      onClose: () => {
        if (this.confirmCallback === onConfirm) this.confirmCallback = null;
      },
    });
  }

  openInfo({ eyebrow = '岛屿手记', title, body, iconName = 'spark', footnote = '' }) {
    this.mountModal({
      size: 'info',
      className: 'info-modal',
      ariaLabel: title,
      content: `
        <div class="info-content">
          <div class="info-icon">${icon(iconName)}</div>
          <p class="eyebrow">${escapeText(eyebrow)}</p>
          <h2>${escapeText(title)}</h2>
          <p>${body}</p>
          ${footnote ? `<small>${footnote}</small>` : ''}
          <button class="primary-btn" data-info-close type="button">知道了 ${icon('arrow')}</button>
        </div>
      `,
    });
  }

  openCampfireRest({ onRest, onSleep }) {
    this.mountModal({
      size: 'info',
      className: 'campfire-modal',
      ariaLabel: '篝火旁',
      content: `
        <div class="info-content campfire-content">
          <div class="campfire-glow">${icon('campfire')}</div>
          <p class="eyebrow">岛中央 · 石圈篝火</p>
          <h2>火还没有熄</h2>
          <p>木柴在火里轻轻爆开。你可以在这里坐一会儿，也可以干脆睡到明天。</p>
          <div class="campfire-actions">
            <button class="primary-btn" data-campfire-sleep type="button">回帐篷睡到明天 ${icon('moon')}</button>
            <button class="text-btn" data-campfire-rest type="button">在火边坐半小时 · 精力 +15</button>
          </div>
        </div>
      `,
    });
  }

  openPauseMenu() {
    const state = this.game.state;
    if (!state) return;
    this.pausedMenuOpen = true;
    const quest = this.game.activeQuest;
    this.mountModal({
      size: 'pause',
      className: 'pause-modal',
      ariaLabel: '暂停菜单',
      content: `
        <div class="pause-header">
          <div class="pause-mark">屿</div>
          <div>
            <p class="eyebrow">PAUSE · ${this.game.rank.name}段位</p>
            <h2>潮声暂时停下了</h2>
            <p>${ISLAND_MAP[state.location]?.name ?? '栖云岛'} · 第 ${state.day} 日 · ${formatTime(state.timeMinutes)}</p>
          </div>
        </div>
        <div class="pause-stats">
          <div><span>${state.getStampCount()}/7</span><small>信物</small></div>
          <div><span>${state.built.length}</span><small>建筑</small></div>
          <div><span>${state.residents.length}</span><small>居民</small></div>
          <div><span>${state.tools.length + 2}</span><small>器具</small></div>
        </div>
        ${quest ? `<div class="pause-quest"><span>当前主线</span><strong>${escapeText(quest.title)}</strong><p>${escapeText(quest.objective.label)}</p></div>` : ''}
        <div class="pause-actions">
          <button class="primary-btn" data-pause-resume type="button">回到岛上 ${icon('arrow')}</button>
          <button class="text-btn" data-pause-save type="button">${icon('save')} 手动保存</button>
          <button class="text-btn" data-pause-journal type="button">${icon('quest')} 翻看手记</button>
          <button class="text-btn" data-pause-settings type="button">${icon('settings')} 声音与画质</button>
          <button class="text-btn" data-pause-help type="button">${icon('help')} 操作说明</button>
          <button class="text-btn subtle-danger" data-pause-restart type="button">重新开始旅程</button>
        </div>
        <p class="pause-footnote">所有进度都会自动保存。也可以随时合上页面，潮水会记得你。</p>
      `,
      onClose: () => { this.pausedMenuOpen = false; },
    });
  }

  // ---------------------------------------------------------------------------
  // 扩建 / 学习：两步就能抵达的核心循环
  // ---------------------------------------------------------------------------

  openExpansion() {
    const state = this.game.state;
    if (!state) return;
    const expansions = this.game.getExpansionDefinitions();
    const owned = expansions.filter((entry) => entry.purchased).length;
    const cards = expansions.map((expansion, index) => `
      <article class="expansion-hero ${expansion.purchased ? 'is-owned' : ''}">
        <div class="expansion-hero__diagram" aria-hidden="true">
          <span class="expansion-hero__main"></span>
          <span class="expansion-hero__bridge" style="--i:${index}"></span>
          <span class="expansion-hero__new ${expansion.purchased ? 'is-built' : ''}">+${Math.round(expansion.radius)}m</span>
        </div>
        <div class="expansion-hero__body">
          <header>
            <strong>${escapeText(expansion.name)}</strong>
            <small>${escapeText(expansion.subtitle)}</small>
          </header>
          <p>${escapeText(expansion.description)}</p>
          <div class="expansion-hero__meta">
            ${expansion.purchased ? `<span class="owned-mark">${icon('check')} 已成为岛的一部分</span>` : costMarkup(expansion.cost, state)}
          </div>
          ${expansion.purchased ? '' : `
            <div class="expansion-hero__actions">
              <span class="${expansion.unlocked ? 'unlock-note' : 'locked-note'}">${expansion.unlocked ? (expansion.affordable ? '材料齐了，可以动工' : '材料还不够') : `${icon('lock')} ${escapeText(expansion.missing)}`}</span>
              <button class="primary-btn expansion-go" data-expand-id="${expansion.id}" type="button" ${expansion.unlocked && expansion.affordable ? '' : 'disabled'}>
                ${expansion.unlocked ? '立刻扩建' : '尚未解锁'}
              </button>
            </div>`}
        </div>
      </article>
    `).join('');
    this.mountModal({
      size: 'wide',
      className: 'expansion-modal',
      ariaLabel: '扩建栖云岛',
      content: `
        <div class="expansion-content">
          <header class="expansion-head">
            <div>
              <p class="eyebrow">GROW THE ISLAND</p>
              <h2>把海，变成土地</h2>
              <p class="modal-lede">每扩建一块新土地，都需要材料，也需要一次知识试炼。岛屿越大，能放下的建筑、田与居民就越多。</p>
            </div>
            <div class="expansion-progress">
              <strong>${owned}<span>/${expansions.length}</span></strong>
              <small>已扩建</small>
            </div>
          </header>
          <div class="expansion-list">${cards}</div>
          <footer class="expansion-foot">
            <span>${icon('insight')} 需要材料时，去知识岛答题最快 —— 一场试炼通常能带回木材、石料与悟性。</span>
            <button class="text-btn" data-expansion-study type="button">去学习 ${icon('arrow')}</button>
          </footer>
        </div>
      `,
      onClose: () => {},
    });
  }

  openStudyGuide() {
    const state = this.game.state;
    if (!state) return;
    const islands = ISLANDS.filter((island) => island.id !== 'home');
    const dockReady = Boolean(state.flags.dockRepaired);
    const rank = this.game.rank;
    const rows = islands.map((island) => {
      const total = island.trials?.length ?? 0;
      const passed = (island.trials ?? []).filter((trial) => state.hasTrialPassed(trial.id)).length;
      const here = state.location === island.id;
      const mainTrial = island.trials?.find((trial) => trial.main) ?? island.trials?.[0];
      return `
        <article class="study-row ${here ? 'is-here' : ''}" style="--island-color:${island.color}">
          <span class="study-row__glyph">${island.glyph}</span>
          <div class="study-row__copy">
            <div class="study-row__title">
              <strong>${escapeText(island.name)}</strong>
              <small>${escapeText(island.domain)}</small>
              ${here ? '<span class="here-tag">你在这里</span>' : ''}
            </div>
            <p>${escapeText(mainTrial?.name ?? island.tagline)} · ${passed}/${total} 试炼通过</p>
            <div class="study-row__bar"><span style="width:${total ? Math.round((passed / total) * 100) : 0}%"></span></div>
          </div>
          <button class="small-btn ${here ? '' : 'is-ready'}" data-study-go="${island.id}" type="button" ${here || !dockReady ? 'disabled' : ''}>${here ? '在此岛' : '前往'}</button>
        </article>
      `;
    }).join('');
    this.mountModal({
      size: 'wide',
      className: 'study-modal',
      ariaLabel: '学科航线',
      content: `
        <div class="study-content">
          <header class="study-head">
            <div>
              <p class="eyebrow">STUDY ROUTE · ${escapeText(rank.name)}</p>
              <h2>今天想学点什么？</h2>
              <p class="modal-lede">抵达任意学科岛，走到碑前按 <b>E</b> 就能开始试炼。答对得越多，带回家的材料与信物越好。</p>
            </div>
            <span class="study-rank">${rank.mark}<small>${escapeText(rank.stage)}</small></span>
          </header>
          ${dockReady ? '' : `<p class="study-warning">${icon('lock')} 码头还没修好，暂时无法出海。回到岛上找那块倒下的木牌。</p>`}
          <div class="study-list">${rows}</div>
        </div>
      `,
      onClose: () => {},
    });
  }

  openSettings() {
    const state = this.game.state;
    if (!state) return;
    const quality = state.settings.quality ?? 'high';
    this.mountModal({
      size: 'info',
      className: 'settings-modal',
      ariaLabel: '声音与画质',
      content: `
        <div class="settings-content">
          <p class="eyebrow">SETTINGS</p>
          <h2>让海风更合你心意</h2>
          <div class="settings-row">
            <div><strong>声音</strong><small>潮声、风铃与锤击都由浏览器实时合成</small></div>
            <button class="toggle ${this.soundEnabled ? 'is-on' : ''}" data-settings-action="sound" type="button" aria-pressed="${this.soundEnabled}">${icon(this.soundEnabled ? 'sound' : 'muted')}<span>${this.soundEnabled ? '开启' : '关闭'}</span></button>
          </div>
          <div class="settings-row">
            <div><strong>画质</strong><small>低画质会关闭阴影，适合较轻薄的设备</small></div>
            <div class="quality-switch">
              ${['high', 'medium', 'low'].map((value) => `<button class="${quality === value ? 'is-active' : ''}" data-settings-action="quality" data-value="${value}" type="button">${value === 'high' ? '高' : value === 'medium' ? '中' : '低'}</button>`).join('')}
            </div>
          </div>
          <div class="settings-row">
            <div><strong>惯用手</strong><small>触屏时决定摇杆与互动键的位置</small></div>
            <div class="quality-switch">
              ${[['right', '右手'], ['left', '左手']].map(([value, label]) => `<button class="${(state.settings.hand ?? 'right') === value ? 'is-active' : ''}" data-settings-action="hand" data-value="${value}" type="button">${label}</button>`).join('')}
            </div>
          </div>
          <div class="settings-row">
            <div><strong>摇杆大小</strong><small>手小或屏幕大时都可以调</small></div>
            <div class="quality-switch">
              ${[['small', '小'], ['medium', '中'], ['large', '大']].map(([value, label]) => `<button class="${(state.settings.stickSize ?? 'medium') === value ? 'is-active' : ''}" data-settings-action="stick" data-value="${value}" type="button">${label}</button>`).join('')}
            </div>
          </div>
          ${this.isTouch ? `
          <div class="settings-row">
            <div><strong>横屏显示</strong><small>${this.isLandscapeFrame ? '手机打开时自动使用横向画面，不需要旋转手机，也不会弹出提示。' : '进入游戏时会尝试自动切换到横屏。'}</small></div>
            ${this.isLandscapeFrame
              ? '<span class="settings-auto">自动</span>'
              : `<button class="toggle ${state.settings.landscapeLock ? 'is-on' : ''}" data-settings-action="landscape" type="button" aria-pressed="${Boolean(state.settings.landscapeLock)}">${icon('rotate')}<span>${state.settings.landscapeLock ? '开启' : '关闭'}</span></button>`}
          </div>` : ''}
          <div class="settings-row">
            <div><strong>操作</strong><small>WASD / 方向键移动，拖拽环视，E 互动，B 建造，G 扩建，K 学习，M 海图，I 行囊，J 知海，Q 手记</small></div>
            <button class="text-btn" data-pause-help type="button">完整说明</button>
          </div>
          <button class="primary-btn" data-settings-action="back" type="button">回到旅程 ${icon('arrow')}</button>
        </div>
      `,
      onClose: () => {},
    });
  }

  openHelp() {
    this.mountModal({
      size: 'help',
      className: 'help-modal',
      ariaLabel: '玩法说明',
      content: `
        <div class="help-content">
          <p class="eyebrow">FIELD NOTES · 岛屿生活指南</p>
          <h2>先生活，再回答</h2>
          <p class="help-lede">栖云岛是你可以改变的地方；七座知识岛是问题生长的地方。把答案带回家，它们会变成真正能用的东西。</p>
          <div class="help-grid">
            <section>
              <span class="block-label">在岛上的动作</span>
              <ul class="key-list">
                <li><kbd>WASD</kbd><span>行走，<kbd>Shift</kbd> 奔跑</span></li>
                <li><kbd>拖拽</kbd><span>环视四周，滚轮调整远近</span></li>
                <li><kbd>E</kbd><span>采集、交谈、查看学问碑</span></li>
                <li><kbd>B</kbd><span>建造模式，选择建筑后点击地面放置</span></li>
                <li><kbd>M</kbd><span>海图旅行，<kbd>I</kbd> 行囊，<kbd>J</kbd> 知海</span></li>
                <li><kbd>Q</kbd><span>主线、委托与居民手记</span></li>
              </ul>
            </section>
            <section>
              <span class="block-label">知识的用途</span>
              <ul class="use-list">
                <li><b>语文</b><span>让信物与故事帮你打开更深的门。</span></li>
                <li><b>数学</b><span>解锁桥梁、星泉与更精确的建造。</span></li>
                <li><b>物理</b><span>让工具更利，让锻炉听懂火候。</span></li>
                <li><b>化学</b><span>理解元素，让锻造走得更远。</span></li>
                <li><b>生物</b><span>让种子与暖房回报更高。</span></li>
                <li><b>英语</b><span>点亮灯塔，读懂远方的海图。</span></li>
                <li><b>百工</b><span>把知识变成市集、房屋与可用的日常。</span></li>
              </ul>
            </section>
            <section>
              <span class="block-label">一天怎么过</span>
              <p>采集与建造会消耗精力；深夜前回帐篷休息，作物会在夜里长大，市集与磨坊也会带来收入。每次答题都会把知识卡收进「知海」，答错也算收获。</p>
              ${this.isTouch ? '<p><b>触屏操作：</b>左侧摇杆行走，拖动画面环视，点右下「互动」。右侧竖栏可打开海图、建造、行囊、知海与手记；建造时点地面放置，面板底部可旋转。</p>' : ''}
            </section>
            <section>
              <span class="block-label">关于段位</span>
              <p>在开场选择白银、黄金、钻石或王者，对应初中、高中、大学、研究生难度的题目。难度越高，题目越深，同一次试炼的信物与器具也会越华丽、更强大。</p>
            </section>
          </div>
          <button class="primary-btn" data-help-close type="button">继续生活 ${icon('arrow')}</button>
        </div>
      `,
    });
  }

  showCredits() {
    this.game.audio.click();
    this.mountModal({
      size: 'help',
      className: 'credits-modal',
      ariaLabel: '制作手记',
      content: `
        <div class="credits-content">
          <p class="eyebrow">MAKING OF · 潮声纪</p>
          <h2>知屿是怎样长出来的</h2>
          <p class="help-lede">这是一座把模拟经营、建造、锻造与跨学科学习放在同一片海上的小群岛。没有现成贴图，所有岛、角色、建筑与图标都由代码在浏览器里长出来。</p>
          <div class="credits-grid">
            <div><span>三维世界</span><strong>Three.js</strong><p>手写海浪与天空着色器、低多边形地形、程序化岛屿与建筑。</p></div>
            <div><span>界面与氛围</span><strong>HTML · CSS · 原生 JavaScript</strong><p>无框架 UI、程序化 Web Audio、每座岛独立的美术气质。</p></div>
            <div><span>知识设计</span><strong>7 学科 × 4 段位 × 112 题</strong><p>每张卡都带讲解。答错也收进知海，下一次会遇见另一种问法。</p></div>
            <div><span>灵感致意</span><strong>星露谷物语 · 动物森友会 · 文明 · 岛屿建造类游戏</strong><p>愿所有学过的知识，最后都能变成可居住的地方。</p></div>
          </div>
          <p class="credits-quote">“岛不是土地，是愿意回来的人。”<small>—— 阿岚</small></p>
          <button class="primary-btn" data-credits-close type="button">回到海面 ${icon('arrow')}</button>
        </div>
      `,
    });
  }

  // ---------------------------------------------------------------------------
  // 场景转场
  // ---------------------------------------------------------------------------

  async cover({ title = '正在航行…', subtitle = '', variant = 'sail', duration = 700 } = {}) {
    const el = this.els.transition;
    if (!el) return;
    el.classList.remove('is-hidden', 'variant-sleep', 'variant-sail');
    el.classList.add(`variant-${variant}`);
    this.els.transitionTitle.textContent = title;
    this.els.transitionSub.textContent = subtitle;
    void el.offsetWidth;
    el.classList.add('is-active');
    await new Promise((resolve) => window.setTimeout(resolve, duration));
  }

  async reveal({ duration = 700 } = {}) {
    const el = this.els.transition;
    if (!el) return;
    el.classList.remove('is-active');
    await new Promise((resolve) => window.setTimeout(resolve, duration));
    el.classList.add('is-hidden');
    el.classList.remove('variant-sleep', 'variant-sail');
  }

  // ---------------------------------------------------------------------------
  // 答题试炼
  // ---------------------------------------------------------------------------

  openQuiz(config) {
    this.quiz = {
      ...config,
      index: 0,
      answers: Array(config.questions.length).fill(null),
      answered: false,
      finished: false,
      result: null,
    };
    this.mountModal({
      size: 'quiz',
      className: 'quiz-modal',
      dismissable: false,
      type: 'quiz',
      ariaLabel: `${config.trial.name} · 知识试炼`,
      content: `
        <div class="quiz-shell" style="--island:${config.island.color};--accent:${config.island.accent}">
          <header class="quiz-header">
            <div class="quiz-header__island">
              <span class="quiz-glyph">${config.island.glyph}</span>
              <div>
                <p class="eyebrow">${escapeText(config.island.domain)} · KNOWLEDGE TRIAL</p>
                <h2>${escapeText(config.trial.name)}</h2>
              </div>
            </div>
            <div class="quiz-meta">
              <span class="difficulty-pill">${config.rank.name} · ${config.rank.stage}</span>
              <span class="quiz-focus">${escapeText(config.trial.focus)}</span>
            </div>
          </header>
          <div id="quiz-body" class="quiz-body"></div>
        </div>
      `,
      onMount: () => this.renderQuizQuestion(),
      onClose: () => {
        this.quiz = null;
      },
    });
  }

  renderQuizQuestion() {
    const quiz = this.quiz;
    if (!quiz) return;
    const body = document.getElementById('quiz-body');
    if (!body) return;
    const question = quiz.questions[quiz.index];
    const answer = quiz.answers[quiz.index];
    const answered = answer !== null && answer !== undefined;
    const isCorrect = answered && answer === question.answer;
    const pips = quiz.questions.map((item, index) => {
      const chosen = quiz.answers[index];
      let stateClass = '';
      if (chosen !== null && chosen !== undefined) stateClass = chosen === item.answer ? 'is-correct' : 'is-wrong';
      if (index === quiz.index) stateClass += ' is-current';
      return `<span class="quiz-pip ${stateClass}"></span>`;
    }).join('');
    const options = question.options.map((option, index) => {
      const letter = String.fromCharCode(65 + index);
      let optionClass = '';
      if (answered) {
        if (index === question.answer) optionClass = 'is-correct';
        else if (index === answer) optionClass = 'is-wrong';
        else optionClass = 'is-muted';
      }
      return `<button class="quiz-option ${optionClass}" data-quiz-answer="${index}" type="button" ${answered ? 'disabled' : ''}>
        <span class="quiz-option__letter">${letter}</span>
        <span>${escapeText(option)}</span>
        ${answered && index === question.answer ? `<span class="quiz-option__mark">${icon('check')}</span>` : ''}
      </button>`;
    }).join('');
    body.innerHTML = `
      <div class="quiz-progress-row">
        <div class="quiz-progress-label">第 ${quiz.index + 1} / ${quiz.questions.length} 问 <span>· ${escapeText(question.topic)}</span></div>
        <div class="quiz-pips">${pips}</div>
      </div>
      <h3 class="quiz-question">${escapeText(question.question)}</h3>
      <div class="quiz-options">${options}</div>
      ${answered ? `
        <div class="quiz-explanation ${isCorrect ? 'is-correct' : 'is-wrong'}">
          <div class="quiz-explanation__head">${icon(isCorrect ? 'check' : 'spark')} <strong>${isCorrect ? '答对了，知识已收进知海' : '这次没答对，但答案已经留在知海里'}</strong></div>
          <p>正确答案：<b>${String.fromCharCode(65 + question.answer)} · ${escapeText(question.options[question.answer])}</b></p>
          <p>${escapeText(question.explanation)}</p>
        </div>
        <div class="quiz-footer">
          <span class="quiz-footnote">答错不会离开岛屿，试炼可以重来。</span>
          <button class="primary-btn" data-quiz-next type="button" data-autofocus>
            ${quiz.index === quiz.questions.length - 1 ? '查看试炼结果' : '下一问'} ${icon('arrow')}
          </button>
        </div>
      ` : `<div class="quiz-footer quiz-footer--waiting">
        <span class="quiz-footnote">${icon('help')} 先听听问题想问什么。答题不限时。</span>
        <span class="quiz-footnote">${quiz.passedBefore ? '重温试炼 · 通过后获得少量资源' : '首次通过可获得学科信物'}</span>
      </div>`}
    `;
    body.querySelector('.quiz-question')?.scrollIntoView?.({ block: 'nearest' });
  }

  answerQuiz(index) {
    const quiz = this.quiz;
    if (!quiz || quiz.finished) return;
    const question = quiz.questions[quiz.index];
    if (quiz.answers[quiz.index] !== null && quiz.answers[quiz.index] !== undefined) return;
    quiz.answers[quiz.index] = index;
    const correct = index === question.answer;
    quiz.answered = true;
    if (correct) {
      this.game.audio.tone(660 + quiz.index * 40, 0.28, 'sine', 0.07);
      this.game.audio.tone(880 + quiz.index * 40, 0.35, 'sine', 0.04, 0.08);
    } else {
      this.game.audio.error();
    }
    this.renderQuizQuestion();
  }

  advanceQuiz() {
    const quiz = this.quiz;
    if (!quiz) return;
    if (quiz.answers[quiz.index] === null || quiz.answers[quiz.index] === undefined) return;
    if (quiz.index < quiz.questions.length - 1) {
      quiz.index += 1;
      quiz.answered = false;
      this.game.audio.click();
      this.renderQuizQuestion();
      document.getElementById('quiz-body')?.scrollTo?.({ top: 0, behavior: 'smooth' });
    } else {
      this.finishQuiz();
    }
  }

  finishQuiz() {
    const quiz = this.quiz;
    if (!quiz || quiz.finished) return;
    quiz.finished = true;
    let result = null;
    try {
      result = quiz.onFinish(quiz.answers, () => this.closeModal());
    } catch (error) {
      console.error('[知屿] 试炼结算失败', error);
      this.showToast('试炼结算时遇到了一阵逆风，请再试一次。', { tone: 'warn' });
      quiz.finished = false;
      return;
    }
    quiz.result = result;
    this.renderQuizResult(result);
    this.game.ui?.updateHUD?.(true);
  }

  renderQuizResult(result) {
    const quiz = this.quiz;
    if (!quiz || !result) return;
    const relic = result.relic;
    const stampIsland = result.stamp;
    const summary = quiz.questions.map((question, index) => {
      const chosen = quiz.answers[index];
      const correct = chosen === question.answer;
      return `<li class="${correct ? 'is-correct' : 'is-wrong'}">${icon(correct ? 'check' : 'close')}<span>${escapeText(question.topic)}</span><small>${correct ? '答对' : `正确答案 ${String.fromCharCode(65 + question.answer)}`}</small></li>`;
    }).join('');
    const resultContent = `
      <div class="quiz-result ${result.passed ? 'is-passed' : 'is-failed'}">
        <div class="result-sigil">${result.passed ? icon('spark') : icon('book')}<span></span></div>
        <p class="eyebrow">${result.passed ? 'TRIAL PASSED · 试炼通过' : 'A PAGE KEPT · 知识已留下'}</p>
        <h3>${result.passed ? '风把答案吹成了信物' : '这一次，先和问题做朋友'}</h3>
        <div class="result-score"><strong>${result.correctCount}</strong><span>/ ${result.total}</span><small>本轮答对</small></div>
        <div class="result-summary">
          <ul>${summary}</ul>
        </div>
        ${result.passed ? `
          <div class="result-rewards">
            <span class="block-label">${result.firstPass ? '带回去的收获' : '重温试炼的馈赠'}</span>
            <div class="reward-chips">${rewardChips(result.rewards ?? {})}</div>
            ${relic ? `<div class="relic-award quality-legend">
              <span class="relic-award__icon">${icon(relic.icon)}</span>
              <div><small>学科信物 · ${escapeText(relic.lore)}</small><strong>${escapeText(relic.name)}</strong><p>${escapeText(relic.desc)}</p></div>
              ${stampIsland ? `<span class="reward-stamp" style="--stamp:${stampIsland.accent}"><span>${stampIsland.glyph}</span><small>${escapeText(stampIsland.shortName)}印</small></span>` : ''}
            </div>` : ''}
            ${result.firstPass && quiz.trial.main ? `<p class="result-guardian-note">${icon('talk')} ${escapeText(quiz.island.guardian.name)}在碑影里向你点了点头。回到岛上与他们交谈，也许还会有一件小小的临别赠礼。</p>` : ''}
          </div>
          <div class="quiz-footer">
            <span class="quiz-footnote">${result.firstPass ? '知识已经变成岛上的东西。' : '每一次重温，都会让理解更稳。'}</span>
            <div class="result-actions">
              <button class="text-btn" data-quiz-retry type="button">再答一次</button>
              <button class="primary-btn" data-quiz-close type="button">带着答案回岛 ${icon('arrow')}</button>
            </div>
          </div>
        ` : `
          <div class="result-advice">
            <span class="block-label">去知海翻翻这几次的答案</span>
            <p>通过试炼需要答对 2 / 3。答错的题已经收进「知海」，随时可以重读讲解，也可以准备好后再来一次。</p>
          </div>
          <div class="quiz-footer">
            <button class="text-btn" data-quiz-close type="button">先回岛上走走</button>
            <button class="primary-btn" data-quiz-retry type="button">再试一次 ${icon('arrow')}</button>
          </div>
        `}
      </div>
    `;
    const finishedQuiz = quiz;
    this.lastQuizContext = { trial: quiz.trial, island: quiz.island };
    // Remount a fresh result view: growing a long results block inside the question
    // dialog can leave stale compositor tiles in some browsers and hides rewards.
    this.mountModal({
      size: 'quiz',
      className: 'quiz-modal quiz-result-modal',
      dismissable: false,
      type: 'quiz-result',
      ariaLabel: '试炼结果',
      content: `
        <div class="quiz-shell" style="--island:${quiz.island.color};--accent:${quiz.island.accent}">
          <header class="quiz-header">
            <div class="quiz-header__island">
              <span class="quiz-glyph">${quiz.island.glyph}</span>
              <div>
                <p class="eyebrow">${escapeText(quiz.island.domain)} · KNOWLEDGE TRIAL</p>
                <h2>${escapeText(quiz.trial.name)}</h2>
              </div>
            </div>
            <div class="quiz-meta">
              <span class="difficulty-pill">${this.game.rank.name} · ${this.game.rank.stage}</span>
              <span class="quiz-focus">${escapeText(quiz.trial.focus)}</span>
            </div>
          </header>
          <div class="quiz-body quiz-result-body">${resultContent}</div>
        </div>
      `,
      onClose: () => { this.quiz = null; },
    });
    this.quiz = finishedQuiz;
    this.game.audio[result.passed ? 'success' : 'error']?.();
  }

  // ---------------------------------------------------------------------------
  // 手记
  // ---------------------------------------------------------------------------

  openJournal(tab = 'main') {
    this.journalTab = tab;
    const state = this.game.state;
    this.mountModal({
      size: 'journal',
      className: 'journal-modal',
      ariaLabel: '手记',
      content: `
        <div class="journal-shell">
          <header class="panel-heading journal-heading">
            <div>
              <p class="eyebrow">A FIELD JOURNAL · 第 ${state.day} 日</p>
              <h2>阿岚的手记</h2>
              <p>岛不会一次长成。它只是每天，比昨天多认识你一点。</p>
            </div>
            <div class="journal-header-meta">
              <span>${this.game.rank.name} · ${this.game.rank.stage}</span>
              <span>${state.getStampCount()} / 7 信物</span>
              <span>${state.getResidentCount()} 位居民</span>
            </div>
          </header>
          <nav class="journal-tabs">
            ${[
              ['main', '主线'],
              ['daily', '今日委托'],
              ['residents', '岛民'],
              ['insights', '见闻'],
            ].map(([value, label]) => `<button class="${this.journalTab === value ? 'is-active' : ''}" data-journal-tab="${value}" type="button">${label}${value === 'daily' ? `<small>${state.daily?.claimed?.length ?? 0}/3</small>` : ''}</button>`).join('')}
          </nav>
          <div id="journal-body" class="journal-body"></div>
        </div>
      `,
      onMount: () => this.renderJournalTab(),
    });
  }

  renderJournalTab() {
    const body = document.getElementById('journal-body');
    if (!body) return;
    document.querySelectorAll('[data-journal-tab]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.journalTab === this.journalTab);
    });
    if (this.journalTab === 'main') body.innerHTML = this.renderJournalMain();
    else if (this.journalTab === 'daily') body.innerHTML = this.renderJournalDaily();
    else if (this.journalTab === 'residents') body.innerHTML = this.renderJournalResidents();
    else body.innerHTML = this.renderJournalInsights();
    hydrateIcons(body);
    body.scrollTop = 0;
  }

  renderJournalMain() {
    const state = this.game.state;
    const currentIndex = state.mainQuestIndex;
    const current = MAIN_QUESTS[currentIndex];
    const view = this.game.getQuestProgressView();
    const currentCard = current ? `
      <section class="journal-current-quest">
        <div class="journal-current-quest__top">
          <span class="eyebrow">${escapeText(current.chapter)}</span>
          <span class="soft-tag">${view.current} / ${view.target}</span>
        </div>
        <h3>${escapeText(current.title)}</h3>
        <p class="journal-current-sub">${escapeText(current.subtitle)}</p>
        <div class="journal-quest-progress"><span style="width:${Math.round(view.ratio * 100)}%"></span></div>
        <p class="journal-brief">${escapeText(current.brief)}</p>
        <div class="journal-hint">${icon('spark')}<span>${escapeText(current.hint)}</span></div>
        <div class="journal-current-footer">
          <div><span class="block-label">完成后</span>${rewardChips(current.rewards)}</div>
          <small>${escapeText(current.objective.label)}</small>
        </div>
      </section>
    ` : `
      <section class="journal-current-quest is-finished">
        <span class="eyebrow">GRAND FINALE · 群星回信</span>
        <h3>所有主线已经落成</h3>
        <p class="journal-brief">观星台的光仍在缓慢旋转。现在可以让岛按自己的方式继续生长，也可以去任何一座知识岛重温问题。</p>
        <div class="journal-current-footer"><span class="soft-tag">自由生活</span><span>信物 ${state.getStampCount()} / 7 · 建筑 ${state.built.length}</span></div>
      </section>
    `;
    const timeline = MAIN_QUESTS.map((quest, index) => {
      const done = state.completedQuests.includes(quest.id);
      const isCurrent = index === currentIndex;
      const future = index > currentIndex;
      return `<article class="journal-step ${done ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''} ${future ? 'is-future' : ''}">
        <span class="journal-step__mark">${done ? icon('check') : isCurrent ? icon('arrow') : String(index + 1).padStart(2, '0')}</span>
        <div>
          <span class="journal-step__chapter">${escapeText(quest.chapter)}</span>
          <strong>${escapeText(quest.title)}</strong>
          ${done ? `<details><summary>读过一页</summary><p>${escapeText(quest.completion)}</p></details>` : `<p>${escapeText(isCurrent ? quest.objective.label : future ? quest.subtitle : '正在发生')}</p>`}
        </div>
      </article>`;
    }).join('');
    return `
      ${currentCard}
      <div class="journal-section-head"><span class="block-label">旅程脉络</span><small>${state.completedQuests.length} / ${TOTAL_MAIN_QUESTS} 已完成</small></div>
      <div class="journal-timeline">${timeline}</div>
      <div class="journal-stamp-line">
        ${ISLANDS.map((island) => stampMark(island, island.id === 'home' || Boolean(state.stamps[island.id]))).join('')}
      </div>
    `;
  }

  renderJournalDaily() {
    const state = this.game.state;
    const tasks = state.daily?.tasks ?? [];
    return `
      <section class="journal-daily">
        <div class="journal-daily__head">
          <div><span class="eyebrow">DAY ${state.day} · TIDE COMMISSIONS</span><h3>今日的三件小事</h3></div>
          <span class="daily-refresh">${icon('sun')} 每睡一觉刷新</span>
        </div>
        <p class="journal-daily__intro">完成任意委托会自动领取奖励。不需要交给谁，岛会自己记住。</p>
        <div class="daily-list">
          ${tasks.map((task) => {
            const progress = state.daily.progress[task.id] ?? 0;
            const claimed = state.daily.claimed.includes(task.id);
            return `<article class="daily-card ${claimed ? 'is-claimed' : ''}">
              <div class="daily-card__icon">${icon(task.icon)}</div>
              <div class="daily-card__copy">
                <div><strong>${escapeText(task.label)}</strong><span>${claimed ? '已完成' : `${Math.min(progress, task.target)} / ${task.target}`}</span></div>
                <div class="daily-progress"><span style="width:${Math.min(100, (progress / task.target) * 100)}%"></span></div>
                <small>奖励 ${rewardChips(task.reward)}</small>
              </div>
              <span class="daily-check">${claimed ? icon('check') : icon('clock')}</span>
            </article>`;
          }).join('')}
        </div>
        <div class="journal-note">${icon('moon')} 夜晚回到帐篷休息后，新的委托会跟着晨雾一起出现。</div>
      </section>
    `;
  }

  renderJournalResidents() {
    const state = this.game.state;
    const capacity = state.getCapacity();
    const requirementText = (resident) => {
      const parts = [];
      if (resident.requirement?.trials?.length) {
        const trial = resident.requirement.trials[0];
        const island = KNOWLEDGE_ISLANDS.find((item) => item.trials.some((entry) => entry.id === trial));
        const trialDef = island?.trials.find((entry) => entry.id === trial);
        if (island && trialDef) parts.push(`通过「${island.name} · ${trialDef.name}」`);
      }
      if (capacity <= 0) parts.push('建一座旅人小屋');
      return parts.join('，');
    };
    return `
      <section class="residents-journal">
        <div class="residents-journal__intro">
          <div><span class="eyebrow">WHO STAYS · 岛上的灯</span><h3>愿意留下的人</h3><p>每建一座旅人小屋，就能迎接一位居民。他们会在岛上散步、说自己的故事，也会在每天第一次见面时送你一点心意。</p></div>
          <div class="capacity-orb"><span>${state.getResidentCount()}</span><small>/ ${capacity} 可容纳</small></div>
        </div>
        <div class="resident-grid">
          ${RESIDENTS.map((resident) => {
            const arrived = state.residents.includes(resident.id);
            const eligible = state.meetsRequirements(resident.requirement);
            return `<article class="resident-card ${arrived ? '' : eligible ? 'is-waiting' : 'is-locked'}">
              <div class="resident-card__portrait">${portrait(resident.avatar)}${arrived ? '<span class="resident-home-dot">在岛上</span>' : ''}</div>
              <div class="resident-card__copy">
                <span class="resident-title">${escapeText(resident.title)}</span>
                <h4>${escapeText(resident.name)}</h4>
                <p>${arrived ? escapeText(resident.greeting) : eligible ? '已经收好行李，只等你再回岛上看看。' : '这位旅人还在别处，等一个愿意落脚的理由。'}</p>
                <div class="resident-card__meta">${arrived ? `<span>${icon('gift')} 每日见面礼</span><span>${rewardChips(resident.gift)}</span>` : `<span>${icon('lock')} ${escapeText(requirementText(resident) || '继续探索群岛')}</span>`}</div>
              </div>
            </article>`;
          }).join('')}
        </div>
      </section>
    `;
  }

  renderJournalInsights() {
    const state = this.game.state;
    const achievements = ACHIEVEMENT_DEFS.map((achievement) => {
      const unlocked = state.achievements.includes(achievement.id);
      return `<div class="achievement-row ${unlocked ? 'is-earned' : ''}">
        <span class="achievement-icon">${icon(unlocked ? achievement.icon : 'lock')}</span>
        <div><strong>${escapeText(achievement.name)}</strong><small>${escapeText(achievement.desc)}</small></div>
        <span class="achievement-state">${unlocked ? '已获得' : '未解锁'}</span>
      </div>`;
    }).join('');
    return `
      <section class="insights-journal">
        <div class="stats-strip">
          <div><span>${state.stats.gathered}</span><small>采集过的资源</small></div>
          <div><span>${state.stats.built}</span><small>亲手建造</small></div>
          <div><span>${state.stats.forged}</span><small>炉火锻造</small></div>
          <div><span>${state.stats.correct}</span><small>答对的问题</small></div>
          <div><span>${state.codex.length}</span><small>知海卡片</small></div>
          <div><span>${state.residents.length}</span><small>留下的人</small></div>
        </div>
        <div class="journal-section-head"><span class="block-label">群岛印记</span><small>${state.achievements.length} / ${ACHIEVEMENT_DEFS.length}</small></div>
        <div class="achievement-list">${achievements}</div>
        <div class="journal-note">${icon('book')} 每一次答题，不论对错，都会留下一张可以反复阅读的知识卡。</div>
      </section>
    `;
  }

  // ---------------------------------------------------------------------------
  // 知海
  // ---------------------------------------------------------------------------

  openCodex() {
    this.codexFilter = 'all';
    this.codexQuery = '';
    const state = this.game.state;
    this.mountModal({
      size: 'codex',
      className: 'codex-modal',
      ariaLabel: '知海',
      content: `
        <div class="codex-shell">
          <header class="panel-heading codex-heading">
            <div>
              <p class="eyebrow">SEA OF KNOWLEDGE · ${state.codex.length} 张卡片</p>
              <h2>知海</h2>
              <p>答过的问题会变成叶子。叶子不会替你答题，但会在下次提问时轻轻响一下。</p>
            </div>
            <div class="codex-seals">
              ${ISLANDS.filter((island) => island.id !== 'home').map((island) => stampMark(island, Boolean(state.stamps[island.id]))).join('')}
            </div>
          </header>
          <div class="codex-toolbar">
            <div class="codex-filters">
              <button class="is-active" data-codex-filter="all" type="button">全部</button>
              ${KNOWLEDGE_ISLANDS.map((island) => `<button data-codex-filter="${island.id}" type="button" style="--island:${island.color}">${island.domain}</button>`).join('')}
            </div>
            <label class="codex-search">
              ${icon('search')}
              <input id="codex-search" type="search" placeholder="搜一张卡片…" autocomplete="off" value="" />
            </label>
          </div>
          <div class="codex-stats-line">
            <span>已收集 <b>${state.codex.length}</b> / 112 张</span>
            <span>答对 ${state.stats.correct} 次 · 参与 ${state.stats.quizzes} 次试炼</span>
          </div>
          <div id="codex-list" class="codex-list"></div>
        </div>
      `,
      onMount: () => this.renderCodexContent(),
    });
  }

  renderCodexContent() {
    const list = document.getElementById('codex-list');
    if (!list) return;
    const state = this.game.state;
    document.querySelectorAll('[data-codex-filter]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.codexFilter === this.codexFilter);
    });
    const query = this.codexQuery.trim().toLowerCase();
    const entries = state.codex
      .map((id) => getQuestionById(id))
      .filter(Boolean)
      .filter((question) => this.codexFilter === 'all' || question.island === this.codexFilter)
      .filter((question) => !query || `${question.question} ${question.explanation} ${question.topic}`.toLowerCase().includes(query));
    if (!entries.length) {
      list.innerHTML = `
        <div class="codex-empty">
          <span class="empty-knot">${icon('book')}</span>
          <h3>${state.codex.length ? '这一页还没有叶子' : '知海还是一片安静的水面'}</h3>
          <p>${state.codex.length ? '换一个学科或搜索词试试。' : '去任何一座知识岛的学问碑前坐下。答对或答错，都会有一张知识卡被带回来。'}</p>
          <button class="primary-btn compact" data-modal-close type="button">去岛屿上看看 ${icon('arrow')}</button>
        </div>
      `;
      return;
    }
    list.innerHTML = entries.map((question, index) => {
      const island = ISLAND_MAP[question.island];
      return `<details class="codex-card" style="--island:${island?.color ?? '#88b8a8'};--accent:${island?.accent ?? '#e2c78c'}">
        <summary>
          <span class="codex-card__index">${String(index + 1).padStart(2, '0')}</span>
          <span class="codex-card__main">
            <span class="codex-card__meta">${escapeText(island?.domain ?? '')} · ${escapeText(question.levelLabel)} · ${escapeText(question.topic)}</span>
            <strong>${escapeText(question.question)}</strong>
          </span>
          <span class="codex-card__chevron">${icon('arrow')}</span>
        </summary>
        <div class="codex-card__body">
          <p class="codex-answer">答案 <b>${String.fromCharCode(65 + question.answer)} · ${escapeText(question.options[question.answer])}</b></p>
          <p>${escapeText(question.explanation)}</p>
          <span class="codex-source">${icon(island?.glyph ? 'spark' : 'book')} 来自 ${escapeText(island?.name ?? '群岛')} · 第 ${state.day} 日之前</span>
        </div>
      </details>`;
    }).join('');
    hydrateIcons(list);
  }

  // ---------------------------------------------------------------------------
  // 行囊
  // ---------------------------------------------------------------------------

  openBag() {
    const state = this.game.state;
    const rank = this.game.rank;
    const maxEnergy = state.getEffectiveMaxEnergy();
    const equipment = state.equipment;
    const slot = (tool, kind) => {
      if (!tool) {
        return `<div class="equipment-slot is-empty"><span class="equipment-slot__icon">${icon(kind === 'weapon' ? 'sword' : kind)}</span><div><small>${TOOL_LABELS[kind] ?? '器具'}</small><strong>尚未装配</strong></div></div>`;
      }
      return `<div class="equipment-slot ${qualityClass(tool.qualityTier)}">
        <span class="equipment-slot__icon">${icon(tool.icon ?? (kind === 'weapon' ? 'sword' : kind))}</span>
        <div><small>${TOOL_LABELS[kind] ?? '器具'} · ${escapeText(tool.quality ?? '旧物')}</small><strong>${escapeText(tool.name)}</strong></div>
        <span class="equipment-stat">${kind === 'weapon' ? `精力 +${tool.energyBonus ?? 0}` : `效率 +${tool.power ?? 0}`}</span>
      </div>`;
    };
    const tools = state.tools.length ? state.tools : [];
    const seeds = CROPS.map((crop) => `<div class="seed-row ${state.meetsRequirements(crop.requirements) ? '' : 'is-locked'}">
      <span class="seed-icon" style="--seed:${crop.color}">${icon(crop.icon)}</span>
      <div><strong>${escapeText(crop.name)}种子</strong><small>${crop.days} 天成熟 · 食物 +${crop.food}${crop.crystal ? ` · 星晶 +${crop.crystal}` : ''}</small></div>
      <b>×${state.seeds[crop.id] ?? 0}</b>
    </div>`).join('');
    const relics = Object.entries(ITEM_DEFS).map(([id, item]) => {
      const owned = (state.items[id] ?? 0) > 0;
      return `<div class="relic-item ${owned ? 'is-owned' : 'is-locked'}">
        <span class="relic-item__icon">${icon(owned ? item.icon : 'lock')}</span>
        <div><strong>${escapeText(owned ? item.name : '未获信物')}</strong><small>${escapeText(owned ? item.desc : `来自${ISLAND_MAP[item.island]?.name ?? '群岛'}`)}</small></div>
      </div>`;
    }).join('');
    this.mountModal({
      size: 'bag',
      className: 'bag-modal',
      ariaLabel: '行囊',
      content: `
        <div class="bag-shell">
          <header class="panel-heading bag-heading">
            <div>
              <p class="eyebrow">TRAVELLER'S SATCHEL · ${rank.name} · ${rank.stage}</p>
              <h2>行囊</h2>
              <p>你带在身上的东西。它们大多来自岛，也终将回到岛上。</p>
            </div>
            <div class="bag-energy">
              <div class="bag-energy__copy"><span>精力</span><strong>${Math.round(state.player.energy)} / ${maxEnergy}</strong></div>
              <div class="bag-energy__bar"><span style="width:${Math.min(100, (state.player.energy / maxEnergy) * 100)}%"></span></div>
              <small>${state.player.energy / maxEnergy > 0.65 ? '还能走很远。' : state.player.energy / maxEnergy > 0.3 ? '该找地方歇歇脚了。' : '潮声也在叫你回去休息。'}</small>
            </div>
          </header>
          <div class="bag-layout">
            <section class="bag-main">
              <div class="bag-section-head"><span class="block-label">材料与日常</span><span class="bag-coin">${icon('coin')} ${formatNumber(state.coins)} 银叶币</span></div>
              <div class="materials-grid">
                ${HUD_RESOURCES.map((type) => {
                  const amount = type === 'coins' ? state.coins : type === 'insight' ? state.insight : state.resources[type];
                  return `<div class="material-card" data-resource="${type}">
                    <span class="material-icon">${icon(specialDef(type).icon)}</span>
                    <div><small>${escapeText(specialDef(type).name)}</small><strong>${formatNumber(amount ?? 0)}</strong></div>
                  </div>`;
                }).join('')}
              </div>
              <div class="bag-actions">
                <button class="text-btn" data-eat-food type="button" ${state.resources.food <= 0 ? 'disabled' : ''}>${icon('food')} 吃一份食物 · 精力 +20（剩 ${state.resources.food}）</button>
              </div>
              <div class="bag-section-head"><span class="block-label">器具与护身</span><small>${tools.length} 件亲手锻造</small></div>
              <div class="equipment-grid">
                ${slot(equipment.axe, 'axe')}
                ${slot(equipment.pickaxe, 'pickaxe')}
                ${slot(equipment.weapon, 'weapon')}
              </div>
              ${tools.length ? `<div class="owned-tools">
                ${tools.map((tool) => `<div class="tool-row ${qualityClass(tool.qualityTier)} ${equipment[tool.kind === 'pickaxe' ? 'pickaxe' : tool.kind]?.uid === tool.uid ? 'is-equipped' : ''}">
                  <span class="tool-row__icon">${icon(tool.icon ?? (tool.kind === 'pickaxe' ? 'pickaxe' : tool.kind === 'weapon' ? 'sword' : 'axe'))}</span>
                  <div class="tool-row__copy"><strong>${escapeText(tool.name)}</strong><small>${escapeText(tool.quality)} · ${tool.kind === 'weapon' ? `精力 +${tool.energyBonus}` : `采集效率 +${tool.power ?? 0}`} · 第 ${tool.forgedDay} 日铸造</small></div>
                  <button class="small-btn ${equipment[tool.kind === 'pickaxe' ? 'pickaxe' : tool.kind]?.uid === tool.uid ? 'is-current' : ''}" data-equip-tool="${tool.uid}" type="button" ${equipment[tool.kind === 'pickaxe' ? 'pickaxe' : tool.kind]?.uid === tool.uid ? 'disabled' : ''}>${equipment[tool.kind === 'pickaxe' ? 'pickaxe' : tool.kind]?.uid === tool.uid ? '已装备' : '装备'}</button>
                </div>`).join('')}
              </div>` : `<p class="bag-empty-note">还没有亲手锻造的器具。建起海风锻炉之后，去炉火边试试。</p>`}
            </section>
            <aside class="bag-side">
              <div class="bag-section-head"><span class="block-label">学科信物</span><small>${state.getStampCount()} / 7</small></div>
              <div class="relic-list">${relics}</div>
              <div class="bag-section-head"><span class="block-label">种子与花期</span><small>可在田垄或市集购买</small></div>
              <div class="seed-list">${seeds}</div>
            </aside>
          </div>
        </div>
      `,
    });
  }

  refreshBagPanel() {
    if (this.modalType === 'bag') this.openBag();
  }

  // ---------------------------------------------------------------------------
  // 田垄
  // ---------------------------------------------------------------------------

  openFarm(plotId) {
    const state = this.game.state;
    const plots = state.plots;
    this.farmFocusPlotId = plotId ?? plots[0]?.id;
    const greenhouse = state.hasBuilding('greenhouse');
    const plotMarkup = plots.map((plot) => {
      const info = plot.seed ? CROPS_BY_ID[plot.seed] : null;
      const growth = info ? this.game.getCropGrowth(plot) : null;
      const ratio = growth ? Math.round(growth.ratio * 100) : 0;
      const ready = growth?.ready;
      const availableSeeds = CROPS.filter((crop) => (state.seeds[crop.id] ?? 0) > 0 && state.meetsRequirements(crop.requirements));
      return `<article class="farm-plot-card ${ready ? 'is-ready' : ''} ${plot.seed ? 'has-crop' : 'is-empty'} ${plot.id === this.farmFocusPlotId ? 'is-focused' : ''}">
        <div class="farm-plot-card__visual ${plot.seed ? `crop-${plot.seed}` : ''}" style="--crop:${info?.color ?? '#8ea877'}">
          <div class="soil-lines"></div>
          ${plot.seed ? `<div class="crop-illustration growth-${Math.ceil((growth?.ratio ?? 0) * 3)}" style="--size:${0.55 + (growth?.ratio ?? 0) * 0.55}">
            ${Array.from({ length: 5 }, (_, i) => `<i style="--i:${i}"><span></span></i>`).join('')}
            ${ready ? `<span class="crop-fruit">${icon(info.icon)}</span>` : ''}
          </div>` : `<span class="empty-soil-mark">${icon('grow')}</span>`}
        </div>
        <div class="farm-plot-card__body">
          <div class="farm-plot-title"><div><small>田垄 ${plot.id.slice(-1)}</small><strong>${info ? info.name : '一块空田'}</strong></div>${ready ? `<span class="ready-pill">可收获</span>` : ''}</div>
          ${info ? `
            <div class="crop-progress"><span style="width:${ratio}%"></span></div>
            <p class="crop-status">${ready ? '叶子已经垂下来，果实很沉。' : `还需 ${Math.max(0, growth.days - growth.elapsed)} 天 · 成长 ${ratio}%`}</p>
            <button class="primary-btn compact" data-harvest-plot="${plot.id}" type="button" ${ready ? '' : 'disabled'}>${ready ? '收获' : '还在生长'} ${ready ? icon('grow') : icon('clock')}</button>
          ` : `
            <p class="crop-status">把种子埋进松软的土里。</p>
            <div class="seed-quick-list">
              ${availableSeeds.length ? availableSeeds.map((crop) => `<button data-plant-seed="${crop.id}" data-plot-id="${plot.id}" type="button">${icon(crop.icon)} ${crop.name}<small>×${state.seeds[crop.id]}</small></button>`).join('') : `<span class="empty-note">行囊里没有可种的种子，下面可以买。</span>`}
            </div>
          `}
        </div>
      </article>`;
    }).join('');
    const shopMarkup = CROPS.map((crop) => {
      const unlocked = state.meetsRequirements(crop.requirements);
      return `<div class="seed-shop-row ${unlocked ? '' : 'is-locked'}">
        <span class="seed-icon" style="--seed:${crop.color}">${icon(crop.icon)}</span>
        <div><strong>${escapeText(crop.name)}</strong><small>${escapeText(crop.description)}</small><em>${crop.days} 天成熟 · 食物 +${crop.food}${crop.crystal ? ` · 星晶 +${crop.crystal}` : ''}</em></div>
        <button class="small-btn" data-buy-seed="${crop.id}" type="button" ${unlocked ? '' : 'disabled'}>${unlocked ? `${crop.seedCost} ${icon('coin')}` : icon('lock')}</button>
      </div>`;
    }).join('');
    this.mountModal({
      size: 'farm',
      className: 'farm-modal',
      ariaLabel: '田垄',
      content: `
        <div class="farm-shell">
          <header class="panel-heading farm-heading">
            <div>
              <p class="eyebrow">THE TERRACES · ${greenhouse ? '玻璃暖房生效中' : '露天生长的日子'}</p>
              <h2>田垄</h2>
              <p>把种子交给时间。睡一觉，作物会替你记住这几天。${greenhouse ? '暖房让成熟时间缩短了 1 天。' : ''}</p>
            </div>
            <div class="farm-basket"><span>${icon('food')} ${state.resources.food}</span><small>行囊里的食物</small></div>
          </header>
          <div class="farm-plots">${plotMarkup}</div>
          <section class="seed-shop">
            <div class="seed-shop-head"><div><span class="block-label">种子铺</span><small>岛上的种子会记住自己的季节</small></div><span class="seed-shop-coins">${icon('coin')} ${formatNumber(state.coins)}</span></div>
            <div class="seed-shop-list">${shopMarkup}</div>
          </section>
          <div class="farm-footer">
            <span>${icon('help')} 种下种子消耗 2 精力，收获消耗 1 精力。暖房会额外给出一份食物。</span>
            <button class="primary-btn compact" data-modal-close type="button">离开田垄</button>
          </div>
        </div>
      `,
    });
  }

  refreshFarmPanel() {
    if (this.modalType === 'farm') this.openFarm(this.farmFocusPlotId);
  }

  // ---------------------------------------------------------------------------
  // 锻炉
  // ---------------------------------------------------------------------------

  openForge() {
    const state = this.game.state;
    const currentAxe = state.getAxe();
    const currentPick = state.getPickaxe();
    const currentWeapon = state.equipment.weapon;
    const groups = [
      { kind: 'axe', label: '斧 · 与木头交谈', current: currentAxe, recipes: TOOL_RECIPES.filter((recipe) => recipe.kind === 'axe') },
      { kind: 'pickaxe', label: '镐 · 与石头交谈', current: currentPick, recipes: TOOL_RECIPES.filter((recipe) => recipe.kind === 'pickaxe') },
      { kind: 'weapon', label: '护身器 · 与路交谈', current: currentWeapon, recipes: TOOL_RECIPES.filter((recipe) => recipe.kind === 'weapon') },
    ];
    const recipeMarkup = (recipe) => {
      const unlocked = state.meetsRequirements(recipe.requirements);
      const affordable = state.canAfford(recipe.cost);
      return `<article class="recipe-card ${unlocked ? '' : 'is-locked'} ${affordable ? '' : 'is-short'}">
        <div class="recipe-card__head">
          <span class="recipe-icon">${icon(recipe.icon)}</span>
          <div><strong>${escapeText(recipe.name)}</strong><small>${recipe.kind === 'weapon' ? `精力 +${recipe.energyBonus}` : `效率 +${recipe.axePower ?? recipe.pickPower}`}</small></div>
          <span class="recipe-rank">${this.game.rank.name}</span>
        </div>
        <p>${escapeText(recipe.description)}</p>
        ${unlocked ? costMarkup(recipe.cost, state) : `<span class="locked-note">${icon('lock')} ${escapeText(state.missingRequirement(recipe.requirements))}</span>`}
        <button class="small-btn recipe-forge-btn" data-forge-recipe="${recipe.id}" type="button" ${unlocked ? '' : 'disabled'}>${unlocked ? (affordable ? '放到炉边' : '材料不足') : '尚未掌握'} ${unlocked && affordable ? icon('hammer') : ''}</button>
      </article>`;
    };
    this.mountModal({
      size: 'forge',
      className: 'forge-modal',
      ariaLabel: '海风锻炉',
      content: `
        <div class="forge-shell">
          <header class="forge-heading">
            <div class="forge-heading__art"><span class="forge-ember"></span>${icon('forge')}</div>
            <div>
              <p class="eyebrow">THE SEAWIND FORGE · 今日炉火尚温</p>
              <h2>海风锻炉</h2>
              <p>选一个配方，把矿、木头和一点点知识放进火里。每一次锤击都会影响最终的品质。</p>
            </div>
            <div class="forge-rank-blessing">
              <small>${this.game.rank.name}段位炉火祝福</small>
              <strong>+${this.game.rank.tier * 4} 品质</strong>
              <span>更高段位会锻出更华丽的成品</span>
            </div>
          </header>
          <div class="forge-current">
            <span>现在手中</span>
            <div class="equip-mini">${icon(currentAxe.icon)} <b>${escapeText(currentAxe.name)}</b><small>斧 · 效率 +${currentAxe.power ?? 0}</small></div>
            <div class="equip-mini">${icon(currentPick.icon)} <b>${escapeText(currentPick.name)}</b><small>镐 · 效率 +${currentPick.power ?? 0}</small></div>
            <div class="equip-mini">${icon(currentWeapon?.icon ?? 'sword')} <b>${escapeText(currentWeapon?.name ?? '尚未装配')}</b><small>${currentWeapon ? `护身 · 精力 +${currentWeapon.energyBonus}` : '护身器'}</small></div>
          </div>
          ${groups.map((group) => `
            <section class="recipe-group">
              <div class="recipe-group__head"><span class="block-label">${group.label}</span><small>${group.recipes.length} 个配方</small></div>
              <div class="recipe-grid">${group.recipes.map(recipeMarkup).join('')}</div>
            </section>
          `).join('')}
          <div class="forge-footer">${icon('flame')} 精力消耗 4 · 每次锻造会记录进手记，也计入今日委托</div>
        </div>
      `,
    });
  }

  openForgeMinigame(recipe) {
    this.stopForgeAnimation();
    this.forgeState = {
      recipe,
      strikes: [],
      score: 0,
      done: false,
      start: performance.now(),
      position: 50,
    };
    this.mountModal({
      size: 'forge-mini',
      className: 'forge-mini-modal',
      ariaLabel: '锻造',
      dismissable: false,
      content: `
        <div class="forge-mini">
          <div class="forge-mini__head">
            <p class="eyebrow">FORGE · ${escapeText(recipe.name)}</p>
            <h2>听火候，落三锤</h2>
            <p>红色的火候带在中央。锤子最靠近它的时候点击「落锤」。</p>
          </div>
          <div class="forge-scene">
            <div class="forge-anvil">${icon('hammer')}<span class="spark spark-a"></span><span class="spark spark-b"></span></div>
            <div class="forge-meter">
              <div class="forge-meter__track">
                <span class="forge-meter__zones"></span>
                <span class="forge-meter__target"></span>
                <span class="forge-meter__marker" id="forge-marker"></span>
              </div>
              <div class="forge-meter__labels"><span>冷</span><span>恰好</span><span>过火</span></div>
            </div>
            <div class="forge-strike-dots" id="forge-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
          <div class="forge-mini-controls">
            <button class="primary-btn forge-strike-btn" data-forge-strike type="button" data-autofocus>落锤 ${icon('hammer')}</button>
            <button class="primary-btn is-hidden" data-forge-finish type="button">开炉淬火 ${icon('spark')}</button>
            <small id="forge-hint">炉温正在呼吸。瞄准中央，不必着急。</small>
          </div>
          <div id="forge-result-host"></div>
        </div>
      `,
      onMount: () => {
        this.animateForge();
        this.game.audio.tone(180, 0.9, 'triangle', 0.04);
      },
      onClose: () => {
        this.stopForgeAnimation();
        this.forgeState = null;
      },
    });
  }

  animateForge() {
    if (!this.forgeState) return;
    const state = this.forgeState;
    if (state.done) return;
    const now = performance.now();
    const elapsed = (now - state.start) / 1000;
    const position = 50 + Math.sin(elapsed * 3.6 + state.strikes.length * 0.65) * 44;
    state.position = position;
    const marker = document.getElementById('forge-marker');
    if (marker) marker.style.left = `${position}%`;
    this.forgeTimer = requestAnimationFrame(() => this.animateForge());
  }

  strikeForge() {
    const state = this.forgeState;
    if (!state || state.done) return;
    if (state.strikes.length >= 3) return;
    const distance = Math.abs(state.position - 50);
    const inTarget = distance <= 7;
    const inPerfect = distance <= 3.2;
    const score = inPerfect ? 100 : inTarget ? 92 - distance * 1.2 : Math.max(18, 88 - distance * 1.45);
    state.strikes.push({ score, position: state.position, perfect: inPerfect, target: inTarget });
    this.game.audio.hammer();
    const dots = document.querySelectorAll('#forge-dots span');
    dots[state.strikes.length - 1]?.classList.add(inPerfect ? 'is-perfect' : inTarget ? 'is-hit' : 'is-miss');
    const meter = document.querySelector('.forge-meter');
    meter?.classList.remove('is-struck');
    void meter?.offsetWidth;
    meter?.classList.add('is-struck');
    const hint = document.getElementById('forge-hint');
    if (hint) {
      hint.textContent = inPerfect ? '火星恰好落进了最亮的地方。' : inTarget ? '不错的一锤，火候在你的掌握里。' : '偏了一点，铁会记得这次教训。';
    }
    if (state.strikes.length >= 3) {
      state.done = true;
      this.stopForgeAnimation();
      document.querySelector('[data-forge-strike]')?.classList.add('is-hidden');
      document.querySelector('[data-forge-finish]')?.classList.remove('is-hidden');
      const finishButton = document.querySelector('[data-forge-finish]');
      finishButton?.focus();
      if (hint) hint.textContent = '三锤已落。现在让水与火替它定下最后的形状。';
    }
  }

  completeForgeMinigame() {
    const state = this.forgeState;
    if (!state || !state.done) return;
    const average = state.strikes.reduce((total, strike) => total + strike.score, 0) / Math.max(1, state.strikes.length);
    const tool = this.game.finishForge(state.recipe.id, average);
    const host = document.getElementById('forge-result-host');
    const mark = document.querySelector('.forge-meter');
    if (!tool) {
      if (host) host.innerHTML = `<div class="forge-failed">炉火没有给出回应。请检查材料或精力。</div>`;
      return;
    }
    if (mark) mark.classList.add('is-complete');
    const qualityClassValue = qualityClass(tool.qualityTier);
    if (host) {
      host.innerHTML = `
        <div class="forge-result ${qualityClassValue}">
          <div class="forge-result__ray"></div>
          <span class="forge-result__icon">${icon(tool.icon ?? 'hammer')}</span>
          <p class="eyebrow">FORGED · ${escapeText(tool.quality)}</p>
          <h3>${escapeText(tool.name)}</h3>
          <p>${escapeText(state.recipe.description)}</p>
          <div class="forge-result__stats">
            <div><small>品阶</small><strong>${escapeText(tool.quality)}</strong></div>
            <div><small>${tool.kind === 'weapon' ? '精力加成' : '采集效率'}</small><strong>+${tool.kind === 'weapon' ? tool.energyBonus : tool.power}</strong></div>
            <div><small>炉火评分</small><strong>${Math.round(tool.score)}</strong></div>
          </div>
          <div class="forge-result__actions">
            <button class="primary-btn" data-forge-close type="button">收起锤子 ${icon('arrow')}</button>
            <button class="text-btn" data-forge-again type="button">再锻一件</button>
          </div>
        </div>
      `;
    }
    document.querySelector('.forge-mini-controls')?.classList.add('is-hidden');
    this.game.ui.updateHUD(true);
  }

  stopForgeAnimation() {
    if (this.forgeTimer) {
      cancelAnimationFrame(this.forgeTimer);
      this.forgeTimer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // 市集
  // ---------------------------------------------------------------------------

  openMarket() {
    const state = this.game.state;
    const buyable = CROPS.map((crop) => {
      const unlocked = state.meetsRequirements(crop.requirements);
      return `<div class="market-seed-row ${unlocked ? '' : 'is-locked'}">
        <span class="seed-icon" style="--seed:${crop.color}">${icon(crop.icon)}</span>
        <div><strong>${crop.name}种子</strong><small>${crop.days} 天成熟 · 市集价 ${crop.seedCost} ${icon('coin')}</small></div>
        <button class="small-btn" data-buy-seed="${crop.id}" type="button" ${unlocked ? '' : 'disabled'}>${unlocked ? '买一包' : '未解锁'}</button>
      </div>`;
    }).join('');
    const sellable = Object.entries(SELL_PRICES).map(([type, price]) => {
      const def = RESOURCE_DEFS[type];
      const amount = state.resources[type] ?? 0;
      return `<div class="market-sell-row">
        <span class="material-icon">${icon(def.icon)}</span>
        <div><strong>${def.name}</strong><small>单价 ${price} ${icon('coin')} · 现有 ${amount}</small></div>
        <button class="small-btn" data-sell-resource="${type}" type="button" ${amount ? '' : 'disabled'}>卖 1 份</button>
      </div>`;
    }).join('');
    this.mountModal({
      size: 'market',
      className: 'market-modal',
      ariaLabel: '潮汐市集',
      content: `
        <div class="market-shell">
          <header class="market-heading">
            <div class="market-awning" aria-hidden="true"></div>
            <div>
              <p class="eyebrow">TIDAL MARKET · 岛上人声</p>
              <h2>潮汐市集</h2>
              <p>帆布下面有种子、盐、消息，以及愿意多聊两句的邻居。</p>
            </div>
            <div class="market-wallet">${icon('coin')} <strong>${formatNumber(state.coins)}</strong><small>银叶币</small></div>
          </header>
          <div class="market-grid">
            <section>
              <div class="bag-section-head"><span class="block-label">买一点春天</span><small>种子铺</small></div>
              <div class="market-seed-list">${buyable}</div>
            </section>
            <section>
              <div class="bag-section-head"><span class="block-label">让行囊轻一点</span><small>回收与交换</small></div>
              <div class="market-sell-list">${sellable}</div>
            </section>
          </div>
          <div class="market-footer">
            <span>${icon('coin')} 市集每天会为岛带来 28 银叶币收入。</span>
            <button class="primary-btn compact" data-modal-close type="button">逛够了</button>
          </div>
        </div>
      `,
    });
  }

  refreshMarketPanel() {
    if (this.modalType === 'market') this.openMarket();
  }
}
