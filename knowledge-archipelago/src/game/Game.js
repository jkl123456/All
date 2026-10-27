import {
  ACHIEVEMENT_DEFS,
  BUILDINGS_BY_ID,
  CAMP_UPGRADES,
  CROPS_BY_ID,
  DAILY_POOL,
  EXPANSIONS,
  EXPANSIONS_BY_ID,
  ISLAND_MAP,
  ITEM_DEFS,
  RANKS,
  RESIDENTS,
  RESIDENTS_BY_ID,
  RESOURCE_DEFS,
  STORY_INTRO,
  TOOL_RECIPES_BY_ID,
} from '../data/gameData.js';
import { MAIN_QUESTS } from '../data/quests.js';
import { drawQuestions } from '../data/questions.js';
import { GameState } from './GameState.js';
import { clamp, deepClone, formatTime, hashString, mulberry32, shuffle, timePeriod, uid } from '../core/utils.js';
import { World } from '../engine/World.js';
import { preloadTropicalAssets } from '../engine/tropicalAssets.js';
import { preloadVillageAssets } from '../engine/villageAssets.js';
import { preloadJungleAssets } from '../engine/jungleAssets.js';
import { preloadCharacterAssets } from '../engine/characterAssets.js';
import { preloadBeachAssets } from '../engine/beachAssets.js';
import { preloadGroundTextures } from '../engine/meadow.js';
import { preloadMegakitAssets, preloadNatureAssets } from '../engine/natureAssets.js';
import { preloadRtsAssets } from '../engine/rtsAssets.js';
import { AudioEngine } from '../core/audio.js';
import { UI } from '../ui/UI.js';

const REPAIR_DOCK_COST = { wood: 8, fiber: 4, coins: 30 };
const TIME_RATE = 1.45;

function escapeLine(text) {
  return String(text ?? '').replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));
}

// 每座知识岛的主试炼会给一点本地物产，让答题与种植、锻造真正连在一起。
const TRIAL_BIOME_REWARDS = {
  wen: { crystal: 1 },
  shu: { stone: 6 },
  wu: { ore: 5 },
  hua: { crystal: 3, ore: 2 },
  sheng: { food: 3, seeds: { moonberry: 1 } },
  ying: { food: 2 },
  gong: { fiber: 4, coins: 60 },
};

function trialBiomeBonus(islandId, main = true) {
  const source = TRIAL_BIOME_REWARDS[islandId] ?? {};
  const result = {};
  Object.entries(source).forEach(([key, value]) => {
    if (key === 'seeds') {
      if (main) {
        result.seeds = { ...(result.seeds ?? {}), ...Object.fromEntries(Object.entries(value).map(([seed, amount]) => [seed, amount])) };
      }
      return;
    }
    const amount = main ? value : Math.max(1, Math.ceil(value * 0.55));
    result[key] = amount;
  });
  return result;
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export class Game {
  constructor(container) {
    this.container = container;
    this.mode = 'boot';
    this.state = null;
    this.world = null;
    this.ui = null;
    this.audio = new AudioEngine();
    this.busy = false;
    this.timeNoticeShown = false;
    this.hudTimer = 0;
    this.promptTimer = 0;
    this.mapTimer = 0;
    this.saveTimer = 0;
    this.positionTimer = 0;
    this.timePaused = false;
    this.lastPromptId = null;
    this.pendingFinale = false;
    this.autoSaveInterval = 28;
    this.introPlayed = false;
  }

  async boot() {
    const setStatus = (text) => {
      const status = document.getElementById('boot-status');
      if (status) status.textContent = text;
    };
    try {
      setStatus('正在把苔溪镇的村子搬上岛…');
      const villagePromise = preloadVillageAssets((done, total) => {
        setStatus(`正在搬房子… ${done}/${total}`);
      });
      const junglePromise = preloadJungleAssets();
      const characterPromise = preloadCharacterAssets();
      const beachPromise = preloadBeachAssets();
      const groundPromise = preloadGroundTextures();
      const naturePromise = preloadNatureAssets();
      const megakitPromise = preloadMegakitAssets();
      const rtsPromise = preloadRtsAssets((done, total) => {
        setStatus(done >= total ? '正在把房子搬上岛…' : `正在搭房子… ${done}/${total}`);
      });
      const tropicalPromise = preloadTropicalAssets((done, total) => {
        setStatus(done >= total ? '正在把热带海岸种回岛上…' : `正在种回热带海岸… ${done}/${total}`);
      });
      // 村子、植物、主角要先到位：岛屿是照着它们的尺寸拼起来的
      await Promise.all([villagePromise, junglePromise, characterPromise, beachPromise, groundPromise, naturePromise, megakitPromise, rtsPromise]);
      await nextFrame();
      setStatus('正在铺开海面…');
      this.world = new World(document.getElementById('stage'), {
        onFatal: (message) => this.showFatal(message),
        onInteract: (interaction) => this.handleInteraction(interaction),
        onPlaceBuilding: (payload) => this.placeBuilding(payload),
        onBuildHover: (hover) => this.ui?.setBuildHover?.(hover),
        onMessage: (message) => this.ui?.showToast(message),
        onEmptyInteract: () => this.ui?.showToast('海风经过，什么也没有发生。'),
        onFootstep: () => this.audio.footstep(),
        onFrame: (dt) => this.tick(dt),
      });
      if (this.world.failed) {
        this.showFatal('无法创建 3D 场景。请检查浏览器的 WebGL 与硬件加速设置。');
        return;
      }
      setStatus('正在唤醒岛上的潮汐…');
      await nextFrame();
      this.ui = new UI(this);
      this.ui.bind();
      await tropicalPromise;
      setStatus('正在把星图折进你的口袋…');
      const demoState = GameState.create('silver');
      demoState.flags.dockRepaired = false;
      this.world.loadIsland('home', demoState, { spawn: { x: 0, z: 2.0 } });
      this.world.setTimeOfDay(15 * 60 + 40);
      this.world.setTitleMode(true);
      this.world.updateEnvironment(15 * 60 + 40);
      this.world.setQuality(this.getStoredQuality());
      this.mode = 'title';
      await nextFrame();
      await delay(420);
      const saveMeta = GameState.peekSave();
      this.ui.showTitle(saveMeta);
      this.ui.setSoundIcon(this.getStoredSoundPref());
      this.hideBootScreen();
      document.documentElement.dataset.gameReady = 'true';
      window.dispatchEvent(new CustomEvent('zhiyu:ready'));
      this.setupGlobalEvents();
      this.audio.enabled = this.getStoredSoundPref();
      if (this.audio.enabled) {
        const unlockAudio = () => {
          this.audio.unlock();
          window.removeEventListener('pointerdown', unlockAudio);
          window.removeEventListener('keydown', unlockAudio);
        };
        window.addEventListener('pointerdown', unlockAudio);
        window.addEventListener('keydown', unlockAudio);
      }
    } catch (error) {
      console.error('[知屿] 启动失败', error);
      this.showFatal(`游戏启动失败：${error.message}`);
    }
  }

  hideBootScreen() {
    const boot = document.getElementById('boot-screen');
    if (!boot) return;
    boot.classList.add('is-leaving');
    window.setTimeout(() => {
      boot.classList.add('is-hidden');
      boot.setAttribute('aria-hidden', 'true');
    }, 800);
  }

  showFatal(message) {
    const element = document.getElementById('fatal-error');
    if (!element) return;
    element.innerHTML = `
      <div class="fatal-card">
        <p class="eyebrow">THE TIDE IS OUT</p>
        <h2>潮水暂时退去了</h2>
        <p>${message}</p>
        <button class="primary-btn" onclick="window.location.reload()">重新试一次</button>
      </div>
    `;
    element.classList.remove('is-hidden');
    document.getElementById('boot-screen')?.classList.add('is-hidden');
  }

  getStoredQuality() {
    try {
      const save = GameState.peekSave();
      const raw = JSON.parse(window.localStorage.getItem('zhiyu-archipelago-save-v1') || 'null');
      return raw?.settings?.quality ?? (window.devicePixelRatio > 2 ? 'medium' : 'high');
    } catch {
      return 'high';
    }
  }

  getStoredSoundPref() {
    try {
      const raw = JSON.parse(window.localStorage.getItem('zhiyu-archipelago-save-v1') || 'null');
      if (raw?.settings && typeof raw.settings.sound === 'boolean') return raw.settings.sound;
    } catch {
      // Fall through.
    }
    return true;
  }

  setupGlobalEvents() {
    this._keyHandler = (event) => this.handleGlobalKey(event);
    this._pageHide = () => {
      if (this.state && this.mode !== 'title') this.persistState();
    };
    window.addEventListener('keydown', this._keyHandler);
    window.addEventListener('pagehide', this._pageHide);
    window.addEventListener('beforeunload', this._pageHide);
    window.__ZHIYU__ = this;
  }

  handleGlobalKey(event) {
    if (this.mode !== 'play' || !this.ui) return;
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    const key = event.key.toLowerCase();
    if (key === 'escape') {
      if (this.ui.hasModalOpen()) {
        event.preventDefault();
        this.ui.closeModal();
      } else if (this.ui.isBuildOpen()) {
        event.preventDefault();
        this.closeBuildMode();
      } else if (this.ui.isPausedMenuOpen?.()) {
        this.ui.closeModal();
      }
      return;
    }
    if (this.ui.hasModalOpen()) return;
    if (key === 'h') {
      event.preventDefault();
      document.getElementById('hud')?.classList.toggle('hud-hidden');
      return;
    }
    if (key === 'b') {
      event.preventDefault();
      if (this.ui.isBuildOpen()) this.closeBuildMode();
      else this.openBuildMode();
    } else if (key === 'm') {
      event.preventDefault();
      this.openMap();
    } else if (key === 'g') {
      event.preventDefault();
      this.openExpansionPanel();
    } else if (key === 'k') {
      event.preventDefault();
      this.openStudyGuide();
    } else if (key === 'i') {
      event.preventDefault();
      this.openBag();
    } else if (key === 'j') {
      event.preventDefault();
      this.openCodex();
    } else if (key === 'q') {
      event.preventDefault();
      this.openJournal();
    } else if (key === 't') {
      event.preventDefault();
      this.skipHours(6);
    } else if (key === 'h' || key === '?') {
      event.preventDefault();
      this.openHelp();
    }
  }

  async startNewGame(rankId) {
    if (!RANKS[rankId]) rankId = 'silver';
    this.audio.unlock();
    this.mode = 'loading';
    this.ui?.hideTitle();
    this.state = GameState.create(rankId);
    this.state.flags.introSeen = false;
    this.ensureDaily();
    this.world.setInputEnabled(false);
    this.world.setTitleMode(false);
    this.world.loadIsland('home', this.state, { spawn: { x: 0, z: 2.0 } });
    this.world.setTimeOfDay(this.state.timeMinutes);
    this.world.setInputEnabled(true);
    this.world.beginGameplay();
    this.mode = 'play';
    this.state.settings.sound = this.audio.enabled;
    if (this.state.settings.sound) this.audio.setEnabled(true);
    this.ui.startGame({ isNew: true });
    this.ui.setSoundIcon(this.state.settings.sound);
    this.persistState();
    this.showHUD();
    window.setTimeout(() => this.playIntro(), 1000);
  }

  async continueGame() {
    const loaded = GameState.load();
    if (!loaded) {
      this.ui?.showToast('没有找到可继续的旅程，从一个新的清晨开始吧。');
      return;
    }
    this.audio.unlock();
    this.state = loaded;
    this.mode = 'loading';
    this.ui?.hideTitle();
    this.world.setInputEnabled(false);
    this.world.setTitleMode(false);
    this.world.loadIsland(this.state.location, this.state);
    this.world.setTimeOfDay(this.state.timeMinutes);
    this.ensureDaily();
    this.world.setInputEnabled(true);
    this.world.beginGameplay();
    this.world.setQuality(this.state.settings.quality ?? 'high');
    this.audio.setEnabled(this.state.settings.sound !== false);
    this.mode = 'play';
    this.ui.startGame({ isNew: false });
    this.ui.setSoundIcon(this.state.settings.sound !== false);
    this.persistState();
    this.showHUD();
    if (!this.state.flags.introSeen) window.setTimeout(() => this.playIntro(), 800);
    else {
      this.ui.showToast('欢迎回来。潮声一直替你留着位置。', { tone: 'calm', icon: 'sun' });
      this.checkQuest('auto');
    }
  }

  showHUD() {
    document.getElementById('hud')?.classList.remove('is-hidden');
    this.ui.updateHUD(true);
    this.ui.updateInteraction(this.world.getNearestInteraction());
    this.ui.drawMinimap();
  }

  async playIntro() {
    if (this.introPlayed || !this.state || this.state.flags.introSeen) return;
    this.introPlayed = true;
    this.ui.playDialogueSequence(
      STORY_INTRO.map((line) => ({
        ...line,
        avatar: line.avatar ?? 'alan',
      })),
      {
        eyebrow: '序章 · 潮水送来的信',
        onComplete: () => {
          this.state.flags.introSeen = true;
          this.checkResidents();
          this.persistState();
          const hint = this.ui.isTouch
            ? '用左侧摇杆行走，靠近目标后点「互动」。点右侧「建造」打开工坊蓝图。'
            : '按 B 打开建造，收集木材后建一座「木作工坊」。';
          this.ui.showToast(hint, { tone: 'quest', icon: 'build', duration: 5600 });
        },
      },
    );
  }

  tick(dt) {
    if (!this.state || !this.ui) return;
    if (this.mode !== 'play') return;
    const uiBlocking = this.ui.hasModalOpen();
    const buildOpen = this.ui.isBuildOpen();
    this.world.setUiPaused(uiBlocking || buildOpen);
    const paused = uiBlocking || buildOpen || this.busy;
    this.timePaused = paused;
    if (!paused) {
      const previous = this.state.timeMinutes;
      this.state.timeMinutes += dt * TIME_RATE;
      if (this.state.timeMinutes >= 24 * 60) {
        this.state.timeMinutes = 24 * 60 - 0.01;
        if (!this.timeNoticeShown) {
          this.timeNoticeShown = true;
          this.ui.showToast('夜深了。回到帐篷休息，让新的一天开始。', { tone: 'calm', icon: 'moon', duration: 5000 });
        }
      }
      if (previous < 23 * 60 + 30 && this.state.timeMinutes >= 23 * 60 + 30 && !this.timeNoticeShown) {
        this.timeNoticeShown = true;
        this.ui.showToast('海面已经映出星光。回帐篷休息，明天作物也会长大。', { tone: 'calm', icon: 'moon', duration: 4600 });
      }
      this.world.setTimeOfDay(this.state.timeMinutes);
    }

    this.hudTimer += dt;
    this.promptTimer += dt;
    this.mapTimer += dt;
    this.saveTimer += dt;
    this.positionTimer += dt;

    if (this.hudTimer > 0.24) {
      this.hudTimer = 0;
      this.ui.updateHUD();
    }
    if (this.promptTimer > 0.1) {
      this.promptTimer = 0;
      const nearest = this.world.getNearestInteraction();
      if (uiBlocking) this.ui.updateInteraction(null);
      else this.ui.updateInteraction(nearest);
    }
    if (this.mapTimer > 0.32) {
      this.mapTimer = 0;
      this.ui.drawMinimap();
    }
    if (this.positionTimer > 0.8) {
      this.positionTimer = 0;
      this.state.updatePlayerPosition(
        this.world.player.root.position.x,
        this.world.player.root.position.z,
        this.state.player.energy,
      );
    }
    if (this.saveTimer > this.autoSaveInterval) {
      this.saveTimer = 0;
      this.persistState();
    }
    if (this.pendingHomeRefresh && !this.busy && this.state.location === 'home' && !this.ui.hasModalOpen() && !this.world.buildMode) {
      this.pendingHomeRefresh = false;
      this.world.loadIsland('home', this.state, { preservePlayer: true });
      this.world.setTimeOfDay(this.state.timeMinutes);
      this.world.setInputEnabled(true);
      this.ui.updateHUD(true);
      this.ui.drawMinimap();
    }
  }

  persistState() {
    if (!this.state) return;
    if (this.world?.player) {
      this.state.updatePlayerPosition(
        this.world.player.root.position.x,
        this.world.player.root.position.z,
        this.state.player.energy,
      );
    }
    this.state.save();
  }

  get rank() {
    return this.state?.getRank() ?? RANKS.silver;
  }

  get activeQuest() {
    if (!this.state) return null;
    return MAIN_QUESTS[this.state.mainQuestIndex] ?? null;
  }

  get nextQuest() {
    if (!this.state) return null;
    return MAIN_QUESTS[this.state.mainQuestIndex + 1] ?? null;
  }

  // ---------------------------------------------------------------------------
  // 交互分发
  // ---------------------------------------------------------------------------

  handleInteraction(interaction) {
    if (!interaction || this.mode !== 'play' || this.busy) return;
    this.audio.click();
    const action = interaction.action ?? '';
    if (action === 'gather') return this.gather(interaction);
    if (action === 'sleep') return this.openSleepConfirm();
    if (action === 'upgrade-camp') return this.upgradeCamp();
    if (action === 'farm') return this.openFarm(interaction.data?.plotId);
    if (action === 'codex') return this.openCodex();
    if (action === 'mailbox') return this.openJournal('main');
    if (action === 'repair-dock') return this.repairDock();
    if (action === 'open-map') return this.openMap();
    if (action.startsWith('trial:')) return this.startTrial(action.slice(6), interaction);
    if (action.startsWith('expand:')) return this.confirmExpansion(action.slice(7));
    if (action.startsWith('npc:')) return this.talkToGuardian(action.slice(4));
    if (action.startsWith('resident:')) return this.talkToResident(action.slice(9), interaction);
    if (action.startsWith('station:')) return this.handleStation(action.slice(8), interaction);
    return this.ui.showToast('这里暂时没有更多故事。');
  }

  gather(interaction) {
    if (!this.state.spendEnergy(4)) {
      this.ui.showToast('精力不太够。吃点东西，或者回帐篷休息。', { tone: 'warn', icon: 'energy' });
      return;
    }
    const kind = interaction.data?.gatherKind ?? 'tree';
    const baseYields = { ...(interaction.data?.yields ?? {}) };
    const toolPower = this.state.getGatherPower(kind);
    const isTree = ['tree', 'bamboo', 'broadleaf', 'pine', 'palm', 'giant'].includes(kind);
    const isStone = ['rock', 'crystal'].includes(kind);
    if (isTree && baseYields.wood) {
      baseYields.wood += toolPower;
    }
    if (isStone && (baseYields.stone || baseYields.ore || baseYields.crystal)) {
      if (baseYields.stone) baseYields.stone += toolPower;
      else if (baseYields.ore) baseYields.ore += toolPower;
    }
    const granted = this.state.grantRewards(baseYields);
    const units = Object.entries(baseYields)
      .filter(([key]) => key !== 'insight')
      .reduce((total, [, amount]) => total + amount, 0);
    this.state.recordGather(units);
    this.trackEvent('gather', units);
    this.world.gatherEffect(interaction);
    this.audio.gather();
    this.ui.showLoot(granted, { title: `采集 · ${interaction.data?.label ?? interaction.label}` });
    this.ui.updateHUD(true);
    this.checkQuest('gather');
    this.hintExpansionReady();
    this.persistState();
  }

  openSleepConfirm() {
    const readyCrops = this.getReadyCropCount();
    this.ui.openConfirm({
      eyebrow: this.state.day > 0 ? `第 ${this.state.day} 日 · ${timePeriod(this.state.timeMinutes)}` : '夜晚',
      title: '要回帐篷休息吗？',
      body: `时间会来到明天清晨 06:30，精力完全恢复。${readyCrops ? `<br><small>田里有 <b>${readyCrops}</b> 株作物可以收获了。</small>` : '<br><small>潮声会继续替你看守岛屿。</small>'}`,
      confirmLabel: '睡到清晨',
      cancelLabel: '再走走',
      icon: 'moon',
      onConfirm: () => this.performSleep(),
    });
    this.audio.click();
  }

  async performSleep() {
    if (this.busy) return;
    if (this.state.location !== 'home') {
      this.ui.showToast('只有在栖云岛的帐篷里，才能真正睡一觉。');
      return;
    }
    this.ui.closeModal();
    this.busy = true;
    this.world.setInputEnabled(false);
    this.audio.sleep();
    await this.ui.cover({
      title: '安睡到清晨',
      subtitle: '潮声替你翻过一页',
      variant: 'sleep',
      duration: 650,
    });
    const marketCount = this.state.getBuildingCount('market');
    const windmillCount = this.state.getBuildingCount('windmill');
    const income = marketCount * 28;
    const foodInc = windmillCount;
    this.state.day += 1;
    this.state.timeMinutes = 6 * 60 + 30;
    this.timeNoticeShown = false;
    this.state.player.energy = this.state.getEffectiveMaxEnergy();
    if (income) this.state.addResource('coins', income);
    if (foodInc) this.state.addResource('food', foodInc);
    this.ensureDaily(true);
    this.checkResidents(true);
    this.state.updatePlayerPosition(this.world.player.root.position.x, this.world.player.root.position.z, this.state.player.energy);
    this.world.loadIsland('home', this.state, { preservePlayer: true });
    this.world.setTimeOfDay(this.state.timeMinutes);
    this.state.save();
    await delay(600);
    await this.ui.reveal({ duration: 550 });
    this.busy = false;
    this.world.setInputEnabled(true);
    this.ui.updateHUD(true);
    this.ui.drawMinimap();
    this.saveTimer = 0;
    this.ui.showDaySummary({
      day: this.state.day,
      income,
      foodInc,
      readyCrops: this.getReadyCropCount(),
      activeQuest: this.activeQuest,
      dailyTasks: this.state.daily.tasks,
      weather: this.getWeatherForDay(this.state.day),
    });
    this.audio.success();
  }

  /** 扩建岛心营地：草棚 → 木寨 → 石厅，答完对应题目才开放 */
  upgradeCamp() {
    const level = this.state.flags.campLevel ?? 1;
    const next = CAMP_UPGRADES[level + 1];
    if (!next) {
      this.ui.showToast('营地已经是岛上最气派的建筑了。', { tone: 'calm', icon: 'cottage' });
      return;
    }
    if (!this.state.meetsRequirements(next.requirements)) {
      this.ui.showToast(this.state.missingRequirement(next.requirements), { tone: 'warn', icon: 'lock' });
      return;
    }
    if (!this.state.canAfford(next.cost)) {
      this.ui.showToast('材料不够，先把木石备齐再动工。', { tone: 'warn', icon: 'wood' });
      return;
    }
    this.state.spend(next.cost);
    this.state.flags.campLevel = level + 1;
    this.world.loadIsland('home', this.state, { preservePlayer: true });
    this.world.setTimeOfDay(this.state.timeMinutes);
    this.audio.place?.();
    this.ui.showToast(`${next.name} 落成了。`, { tone: 'reward', icon: 'cottage', duration: 3600 });
    this.ui.updateHUD(true);
    this.persistState();
  }

  getWeatherForDay(day) {
    const seed = hashString(`${day}-weather`);
    const options = [
      { name: '晴潮', desc: '海面很亮，适合出海。', icon: 'sun' },
      { name: '薄雾', desc: '远岛被雾折成一幅淡墨。', icon: 'cloud' },
      { name: '微风', desc: '风把花种带到了新的地方。', icon: 'leaf' },
      { name: '细雨', desc: '田垄会很高兴。', icon: 'rain' },
    ];
    return options[seed % options.length];
  }

  repairDock() {
    if (this.state.flags.dockRepaired) return this.openMap();
    if (!this.state.canAfford(REPAIR_DOCK_COST)) {
      this.ui.showToast('修复码头需要 木材 8 · 纤维 4 · 银叶币 30。再去收集一些吧。', { tone: 'warn', icon: 'boat', duration: 5000 });
      return;
    }
    this.ui.openConfirm({
      eyebrow: '南岸 · 旧码头',
      title: '把断掉的木桩重新接上',
      body: `修复后，你就能展开海图前往七座学科岛。`,
      cost: REPAIR_DOCK_COST,
      confirmLabel: '修复码头',
      onConfirm: () => {
        if (!this.state.spend(REPAIR_DOCK_COST)) return;
        this.state.flags.dockRepaired = true;
        this.world.loadIsland('home', this.state, { preservePlayer: true });
        this.audio.place();
        this.ui.closeModal();
        this.ui.showToast('码头修好了。海图上的墨点开始发亮。', { tone: 'reward', icon: 'boat', duration: 4200 });
        this.ui.updateHUD(true);
        this.unlockAchievement('dock_fixed');
        this.trackEvent('repair', 1);
        this.checkQuest('repair');
        this.persistState();
      },
    });
  }

  startTrial(trialId, interaction) {
    const islandId = interaction?.data?.islandId ?? this.state.location;
    const island = ISLAND_MAP[islandId];
    const trial = island?.trials?.find((entry) => entry.id === trialId);
    if (!island || !trial) {
      this.ui.showToast('这块碑暂时沉默着。');
      return;
    }
    if (trial.kind === 'codex') return this.openCodex();
    if (this.busy) return;
    const questions = drawQuestions(island.id, this.rank.level, 3);
    const passedBefore = this.state.hasTrialPassed(trial.id);
    this.ui.openQuiz({
      island,
      trial,
      questions,
      passedBefore,
      rank: this.rank,
      onFinish: (answers, closeQuiz) => this.finishTrial({ island, trial, questions, answers, closeQuiz }),
    });
    this.audio.click();
  }

  finishTrial({ island, trial, questions, answers, closeQuiz }) {
    const correctCount = answers.reduce((total, answer, index) => total + (answer === questions[index].answer ? 1 : 0), 0);
    const passed = correctCount >= 2;
    const firstPass = passed && !this.state.hasTrialPassed(trial.id);
    questions.forEach((question) => this.state.recordCodex(question.id));
    this.state.stats.quizzes += 1;
    this.state.stats.correct += correctCount;
    const previous = this.state.recordTrial(trial.id, { passed, score: correctCount, total: questions.length });
    const rewards = {};
    let relicId = null;
    let newStamp = false;
    if (firstPass) {
      const bonus = trialBiomeBonus(island.id, Boolean(trial.main));
      Object.assign(rewards, bonus);
      if (trial.main) {
        relicId = island.rewardRelic;
        this.state.addItem(relicId, 1);
        newStamp = this.state.awardStamp(island.id);
        rewards.coins = (rewards.coins ?? 0) + Math.round(110 * this.rank.multiplier);
        rewards.insight = Math.round(35 * this.rank.multiplier);
        rewards.crystal = (rewards.crystal ?? 0) + 2 + this.rank.tier;
        this.state.residentGifts[`trial-${trial.id}`] = this.state.day;
      } else {
        rewards.coins = (rewards.coins ?? 0) + Math.round(60 * this.rank.multiplier);
        rewards.insight = Math.round(18 * this.rank.multiplier);
        rewards.crystal = (rewards.crystal ?? 0) + 2;
      }
      this.state.grantRewards(rewards);
      this.audio.success();
      this.unlockAchievement('first_trial');
      if (this.state.getStampCount() >= 7) this.unlockAchievement('seven_stamps');
    } else if (passed) {
      rewards.coins = Math.round(25 * this.rank.multiplier);
      rewards.insight = 6;
      this.state.grantRewards(rewards);
      this.audio.success();
    } else {
      rewards.insight = 4;
      this.state.addInsight(4);
      this.audio.error();
    }
    this.trackEvent('quiz', 1);
    this.checkQuest('trial');
    this.checkResidents();
    this.checkAchievements();
    this.persistState();
    this.ui.updateHUD(true);
    return {
      passed,
      correctCount,
      total: questions.length,
      firstPass,
      rewards,
      relicId,
      relic: relicId ? ITEM_DEFS[relicId] : null,
      stamp: newStamp ? island : null,
      previousBest: previous.best,
      nextQuest: this.activeQuest,
      needed: passed ? null : '2 / 3',
    };
  }

  talkToGuardian(islandId) {
    if (islandId === 'alan') return this.talkToAlan();
    const island = ISLAND_MAP[islandId];
    if (!island?.guardian) return;
    const mainTrial = island.trials.find((trial) => trial.main);
    const passed = mainTrial ? this.state.hasTrialPassed(mainTrial.id) : false;
    const firstMeeting = !this.state.flags[`met_${island.id}`];
    const giftKey = `guardianGift_${island.id}`;
    const canGift = passed && !this.state.flags[giftKey];
    if (firstMeeting) {
      this.state.flags[`met_${island.id}`] = true;
      this.state.addInsight(6);
    }
    const lore = island.lore[Math.floor(Math.random() * island.lore.length)];
    const lines = passed
      ? [
        {
          speaker: island.guardian.name,
          title: island.guardian.title,
          avatar: island.guardian.avatar,
          text: lore,
        },
        {
          speaker: island.guardian.name,
          title: island.guardian.title,
          avatar: island.guardian.avatar,
          text: `你已经带走过这里的答案。但问题会继续长出来——想重温的话，${mainTrial?.name ?? '学问碑'}随时都在。`,
        },
      ]
      : [
        {
          speaker: island.guardian.name,
          title: island.guardian.title,
          avatar: island.guardian.avatar,
          text: lore,
        },
        {
          speaker: island.guardian.name,
          title: island.guardian.title,
          avatar: island.guardian.avatar,
          text: `这座岛用「${island.domain}」说话。别急着答对，先听听问题想问什么。${firstMeeting ? '（获得悟性 +6）' : ''}`,
        },
      ];
    if (canGift) {
      lines.push({
        speaker: island.guardian.name,
        title: island.guardian.title,
        avatar: island.guardian.avatar,
        text: '收下这个小玩意儿吧。它不是答案，只是一枚提醒：你曾经认真问过一个问题。',
      });
    }
    this.ui.playDialogueSequence(lines, {
      eyebrow: `${island.name} · ${island.tagline}`,
      onComplete: () => {
        if (canGift) {
          this.state.flags[giftKey] = true;
          const gift = { crystal: 1, insight: 4 };
          this.state.grantRewards(gift);
          this.audio.coin();
          this.ui.showLoot([
            { type: 'crystal', amount: 1, label: '星晶' },
            { type: 'insight', amount: 4, label: '悟性' },
          ], { title: `${island.guardian.name}送的小道具` });
          this.ui.updateHUD(true);
          this.persistState();
        }
      },
    });
    this.audio.quest();
  }

  talkToAlan() {
    const quest = this.activeQuest;
    const hint = quest?.hint ?? '七枚信物已经齐了。岛会自己继续长下去。';
    const hasForge = this.state.hasBuilding('forge');
    const hasCottage = this.state.hasBuilding('cottage');
    const lines = [
      {
        speaker: '阿岚',
        title: '守岛人',
        avatar: 'alan',
        text: this.state.getStampCount() >= 7
          ? '七座岛的风都来过这里了。你听，栖云岛现在有自己的声音。'
          : hasForge
            ? '炉火很稳。岛上的东西开始像样了——不过别忘了，屋子得先有人，才算家。'
            : '木头要一根一根砍，房子要一块一块垒。慢一点没有关系。',
      },
      {
        speaker: '阿岚',
        title: '守岛人',
        avatar: 'alan',
        text: hasCottage
          ? `当前要做的事：${quest?.brief ?? '继续让岛按你的方式生长。'}`
          : `当前要做的事：${quest?.brief ?? '去建一座旅人小屋吧。'} 之后再盖一间旅人小屋，也许会有人愿意留下。`,
      },
    ];
    this.ui.playDialogueSequence(lines, {
      eyebrow: `${this.state.getStampCount()} / 7 枚信物 · ${this.state.getResidentCount()} 位居民`,
      onComplete: () => {
        if (!hasCottage && this.state.getStampCount() >= 1) {
          this.ui.showToast('小提示：先建「旅人小屋」，才有机会迎接居民。', { icon: 'home', tone: 'calm' });
        }
      },
    });
  }

  talkToResident(residentId, interaction) {
    const resident = RESIDENTS_BY_ID[residentId];
    if (!resident) return;
    const firstToday = this.state.residentGifts[residentId] !== this.state.day;
    const lines = [
      {
        speaker: resident.name,
        title: resident.title,
        avatar: resident.avatar,
        text: resident.greeting,
      },
      {
        speaker: resident.name,
        title: resident.title,
        avatar: resident.avatar,
        text: resident.lines[Math.floor(Math.random() * resident.lines.length)],
      },
    ];
    this.ui.playDialogueSequence(lines, {
      eyebrow: firstToday ? `${resident.name} · 今日初见` : `${resident.name} · 老朋友`,
      onComplete: () => {
        if (firstToday) {
          this.state.grantRewards(resident.gift);
          this.state.residentGifts[residentId] = this.state.day;
          this.ui.showLoot(Object.entries(resident.gift).map(([type, amount]) => ({
            type,
            amount,
            label: type === 'coins' ? '银叶币' : RESOURCE_DEFS[type]?.name ?? '心意',
          })), { title: `${resident.name} 送给你一点心意` });
          this.audio.coin();
        }
        this.state.stats.talked += 1;
        this.trackEvent('talk', 1);
        this.persistState();
        this.ui.updateHUD(true);
      },
    });
    this.audio.click();
  }

  handleStation(type, interaction) {
    if (type === 'forge') {
      if (!this.state.hasBuilding('forge')) {
        this.ui.showToast('需要先建造一座海风锻炉。');
        return;
      }
      return this.openForge();
    }
    if (type === 'workshop') return this.openBuildMode();
    if (type === 'market') return this.openMarket();
    if (type === 'greenhouse') return this.openGreenhouseInfo();
    if (type === 'cottage') return this.openResidents();
    if (type === 'campfire') {
      return this.ui.openCampfireRest({
        onRest: () => this.restAtCampfire(),
        onSleep: () => this.openSleepConfirm(),
      });
    }
    if (type === 'pavilion') {
      if (this.state.flags.teaDay === this.state.day) {
        this.ui.showToast('茶已经喝过了。再坐一会儿也无妨，只是风会替你结账。');
        return;
      }
      this.state.flags.teaDay = this.state.day;
      this.state.restoreEnergy(12);
      this.advanceTime(20);
      this.ui.showToast('茶亭小憩 · 精力 +12，时间 +20 分钟。', { tone: 'calm', icon: 'tea' });
      this.ui.updateHUD(true);
      this.persistState();
      return;
    }
    if (type === 'fountain') {
      if (this.state.flags.fountainDay === this.state.day) {
        this.ui.showToast('泉水今天已经吻过你的指尖一次了。');
        return;
      }
      this.state.flags.fountainDay = this.state.day;
      this.state.restoreEnergy(8);
      this.state.addInsight(2);
      this.ui.showToast('星泉 · 精力 +8，悟性 +2。', { tone: 'calm', icon: 'fountain' });
      this.audio.playChime();
      this.ui.updateHUD(true);
      this.persistState();
      return;
    }
    if (type === 'lighthouse') {
      const lines = [{
        speaker: '灯塔',
        title: '夜里归航的人',
        avatar: 'sailor',
        text: '灯每晚亮起十三次，间隔恰好够一艘小船把“我回来了”想三遍。你的海图不再有空白，但海永远会有。',
      }];
      return this.ui.playDialogueSequence(lines, { eyebrow: '守望灯塔 · 夜航许可' });
    }
    if (type === 'windmill') {
      return this.ui.openInfo({
        eyebrow: '风语磨坊 · 每日产出',
        title: '风把谷物磨成了日子',
        body: '每天清晨会自动产出 1 份食物。若你有多座磨坊，它们会在同一阵风里一起工作。',
        icon: 'windmill',
      });
    }
    if (type === 'observatory') {
      if (this.state.flags.endingSeen) return this.ui.showFinale(this.getEndingData());
      return this.ui.openInfo({
        eyebrow: '星辉观星台',
        title: '镜片已经对准了问题',
        body: '还需要完成主线，并集齐七座知识岛的信物。',
        icon: 'observatory',
      });
    }
    if (type === 'bridge') {
      return this.ui.openInfo({
        eyebrow: '月拱桥',
        title: '一小段被认真跨过的海',
        body: '桥并不长，但站在这里时，能听见岛两边不同的风声。',
        icon: 'bridge',
      });
    }
    if (type === 'flower_arch') {
      return this.ui.openInfo({
        eyebrow: '花蔓拱门',
        title: '出门也可以是一件值得庆祝的事',
        body: '藤蔓每天都会多绕一圈，像在给归来的你写信。',
        icon: 'flower',
      });
    }
    this.ui.showToast('这里很安静，只有风。');
  }

  restAtCampfire() {
    if (this.state.player.energy >= this.state.getEffectiveMaxEnergy()) {
      this.ui.showToast('你现在的精力已经满满当当了。');
      return;
    }
    this.state.restoreEnergy(15);
    this.advanceTime(30);
    this.ui.showToast('篝火旁坐了一会儿 · 精力 +15，时间 +30 分钟。', { tone: 'calm', icon: 'campfire' });
    this.ui.updateHUD(true);
    this.ui.drawMinimap();
    this.persistState();
  }

  advanceTime(minutes) {
    this.state.timeMinutes = Math.min(23 * 60 + 59, this.state.timeMinutes + minutes);
    this.world.setTimeOfDay(this.state.timeMinutes);
  }

  /**
   * 时光快进：按钮每点一次前进 6 小时。
   * 跨过午夜就顺延到下一天，作物与每日委托按新的一天刷新——
   * 和睡一觉的结果一致，只是不补精力。
   */
  skipHours(hours = 6) {
    if (!this.state || this.busy || this.mode !== 'play') return;
    if (this.ui.hasModalOpen()) return;
    const total = this.state.timeMinutes + hours * 60;
    const days = Math.floor(total / (24 * 60));
    const next = total - days * 24 * 60;
    this.state.timeMinutes = next;
    this.timeNoticeShown = false;
    this.world.setTimeOfDay(next);
    if (days > 0) {
      this.state.day += days;
      this.ensureDaily(true);
      this.checkResidents(true);
    }
    this.ui.showToast(`时光快进 ${hours} 小时 · 现在 ${formatTime(next)}`, {
      tone: 'calm',
      icon: 'clock',
      duration: 2800,
    });
    this.ui.updateHUD(true);
    this.ui.drawMinimap();
    this.audio.click();
    this.persistState();
  }

  openGreenhouseInfo() {
    this.ui.openInfo({
      eyebrow: '玻璃暖房',
      title: '这里永远比外面早一天春天',
      body: '暖房会让所有作物的成长时间缩短 1 天，并且每次收获额外 +1 份食物。多雨的夜里有玻璃替你挡着。',
      icon: 'greenhouse',
    });
  }

  // ---------------------------------------------------------------------------
  // 建造与扩建
  // ---------------------------------------------------------------------------

  /** 材料刚够扩建时提醒一次：不用等玩家自己翻面板。 */
  hintExpansionReady() {
    if (this.state.flags.expandHintShown) return;
    const ready = EXPANSIONS.find((expansion) => (
      !this.state.expansions.includes(expansion.id)
      && this.state.meetsRequirements(expansion.requirements)
      && this.state.canAfford(expansion.cost)
    ));
    if (!ready) return;
    this.state.flags.expandHintShown = true;
    window.setTimeout(() => {
      if (this.mode !== 'play' || this.ui.hasModalOpen()) return;
      this.ui.showToast(`材料够了。按 G（或走到岛边的石碑）把「${ready.name}」拉上岸。`, {
        tone: 'reward',
        icon: 'island',
        duration: 6400,
      });
    }, 1800);
  }

  openExpansionPanel() {
    if (!this.state) return;
    if (!this.state.isAtHome()) {
      this.ui.showToast('扩建只能在栖云岛进行。先回岛上看看缺哪块土地。', { icon: 'home' });
    }
    this.audio.click();
    this.ui.openExpansion();
  }

  openStudyGuide() {
    if (!this.state) return;
    this.audio.click();
    this.ui.openStudyGuide();
  }

  openBuildMode() {
    if (!this.state.isAtHome()) {
      this.ui.showToast('只能在自己的栖云岛上建造。先乘船回家吧。', { icon: 'home' });
      return;
    }
    if (this.ui.hasModalOpen()) this.ui.closeModal();
    this.world.setBuildMode(true);
    const firstAvailable = this.getBuildableDefinitions().find((definition) => (
      this.state.meetsRequirements(definition.requirements) && this.state.canAfford(definition.cost)
    ));
    const defaultType = !this.state.hasBuilding('workshop') ? 'workshop' : firstAvailable?.id ?? 'campfire';
    this.ui.openBuild({
      selectedType: defaultType,
      definitions: this.getBuildableDefinitions(),
      expansions: this.getExpansionDefinitions(),
    });
    this.world.setBuildType(defaultType, this.rank.tier);
    // 触屏：直接把蓝图收进角落，玩家可以立刻点地面放置
    if (this.ui.isTouch) this.ui.minimizeBuildPanel();
    this.audio.click();
  }

  closeBuildMode() {
    this.world.setBuildMode(false);
    this.ui.closeBuild();
    this.persistState();
  }

  selectBuildingType(type) {
    const definition = BUILDINGS_BY_ID[type];
    if (!definition) return;
    if (!this.state.meetsRequirements(definition.requirements)) {
      this.ui.showToast(this.state.missingRequirement(definition.requirements), { tone: 'warn', icon: 'lock' });
      return;
    }
    this.world.setBuildType(type, this.rank.tier);
    this.ui.markBuildSelection(type);
    if (this.ui.isTouch) this.ui.minimizeBuildPanel();
    this.audio.hover();
  }

  rotateBuilding() {
    this.world.rotateBuildGhost();
    this.audio.click();
  }

  placeBuilding(payload) {
    if (!this.world.buildMode || !this.state.isAtHome()) return;
    const definition = BUILDINGS_BY_ID[payload.type];
    if (!definition) return;
    if (!this.state.meetsRequirements(definition.requirements)) {
      this.ui.showToast(this.state.missingRequirement(definition.requirements), { tone: 'warn', icon: 'lock' });
      return;
    }
    if (!this.state.canAfford(definition.cost)) {
      this.ui.showToast('材料不够。再去砍点木头、敲点石头吧。', { tone: 'warn', icon: 'wood' });
      return;
    }
    if (!this.world.isPlacementValid(payload.x, payload.z, payload.type)) {
      this.ui.showToast('这里放不下，换一个更开阔的位置。');
      return;
    }
    if (!this.state.spend(definition.cost)) return;
    if (!this.state.spendEnergy(2)) {
      this.state.grantRewards(definition.cost);
      this.ui.showToast('精力不足，先歇一会儿再动工。', { tone: 'warn', icon: 'energy' });
      return;
    }
    const building = {
      uid: uid('building'),
      type: payload.type,
      x: payload.x,
      z: payload.z,
      rotation: payload.rotation ?? 0,
      placedDay: this.state.day,
    };
    this.state.built.push(building);
    this.state.stats.built += 1;
    this.world.addPlacedBuilding(building);
    this.audio.place();
    this.unlockAchievement('first_build');
    if (payload.type === 'observatory') this.unlockAchievement('observatory');
    this.ui.showToast(`${definition.name} 建好了。`, { tone: 'reward', icon: definition.icon, duration: 3200 });
    this.trackEvent('build', 1);
    this.checkQuest('build');
    this.checkResidents();
    this.ui.updateHUD(true);
    this.ui.refreshBuildPanel();
    this.persistState();
  }

  confirmExpansion(expansionId) {
    const expansion = EXPANSIONS_BY_ID[expansionId];
    if (!expansion) return;
    if (this.state.expansions.includes(expansion.id)) return;
    if (!this.state.isAtHome()) {
      this.ui.showToast('只能在自己的栖云岛上扩建。', { icon: 'home' });
      return;
    }
    const unlocked = this.state.meetsRequirements(expansion.requirements);
    const affordable = this.state.canAfford(expansion.cost);
    const missing = this.state.missingRequirement(expansion.requirements);
    const ready = unlocked && affordable;
    this.ui.openConfirm({
      eyebrow: `岛屿扩建 · ${expansion.name}`,
      title: unlocked ? `把 ${expansion.name} 拉上岸？` : `${expansion.name} 还在雾里`,
      body: `${escapeLine(expansion.description)}<br><br>${
        unlocked
          ? (affordable ? '动工后，新的土地会立刻从潮水里升起来。' : '材料还不够 —— 去砍点木头、敲点石头，或者到知识岛答一场试炼。')
          : `还差一步：${escapeLine(missing)}。`
      }`,
      cost: expansion.cost,
      confirmLabel: ready ? '开始填海' : '知道了',
      cancelLabel: ready ? '再等等' : '关闭',
      onConfirm: () => {
        if (!ready) {
          this.ui.closeModal();
          return;
        }
        this.expandIsland(expansion.id);
      },
    });
  }

  expandIsland(expansionId) {
    const expansion = EXPANSIONS_BY_ID[expansionId];
    if (!expansion) return;
    if (!this.state.isAtHome()) {
      this.ui.showToast('只能扩建栖云岛。');
      return;
    }
    if (this.state.expansions.includes(expansion.id)) return;
    if (!this.state.meetsRequirements(expansion.requirements)) {
      this.ui.showToast(this.state.missingRequirement(expansion.requirements), { tone: 'warn', icon: 'lock' });
      return;
    }
    if (!this.state.canAfford(expansion.cost)) {
      this.ui.showToast('扩建材料还不够。', { tone: 'warn', icon: 'stone' });
      return;
    }
    this.state.spend(expansion.cost);
    this.state.expansions.push(expansion.id);
    if (expansion.reward?.insight) this.state.addInsight(expansion.reward.insight);
    const position = {
      x: this.world.player.root.position.x,
      z: this.world.player.root.position.z,
    };
    this.world.setBuildMode(false);
    this.ui.closeBuild();
    this.world.loadIsland('home', this.state, { preservePlayer: true });
    this.world.player.setPosition(position.x, position.z);
    this.ui.updateHUD(true);
    this.ui.drawMinimap();
    this.ui.showToast(`${expansion.name} 从潮水间升起来了。新的土地可以建造。`, { tone: 'reward', icon: 'island', duration: 4800 });
    this.audio.success();
    this.trackEvent('expand', 1);
    this.checkQuest('expand');
    this.persistState();
  }

  getBuildableDefinitions() {
    return Object.values(BUILDINGS_BY_ID).map((definition) => ({
      ...definition,
      unlocked: this.state.meetsRequirements(definition.requirements),
      affordable: this.state.canAfford(definition.cost),
      missing: this.state.missingRequirement(definition.requirements),
      built: this.state.getBuildingCount(definition.id),
      tier: this.rank.tier,
    }));
  }

  getExpansionDefinitions() {
    return EXPANSIONS.map((expansion) => ({
      ...expansion,
      purchased: this.state.expansions.includes(expansion.id),
      unlocked: this.state.meetsRequirements(expansion.requirements),
      affordable: this.state.canAfford(expansion.cost),
      missing: this.state.missingRequirement(expansion.requirements),
    }));
  }

  // ---------------------------------------------------------------------------
  // 农耕 / 锻造 / 市集
  // ---------------------------------------------------------------------------

  getCropGrowth(plot) {
    if (!plot?.seed) return { ratio: 0, ready: false, days: 0 };
    const info = CROPS_BY_ID[plot.seed];
    if (!info) return { ratio: 0, ready: false, days: 0 };
    const greenhouse = this.state.hasBuilding('greenhouse');
    const growDays = Math.max(1, info.days - (greenhouse ? 1 : 0));
    const elapsed = Math.max(0, this.state.day - plot.plantedDay);
    return { ratio: clamp(elapsed / growDays, 0, 1), ready: elapsed >= growDays, days: growDays, elapsed };
  }

  getReadyCropCount() {
    return this.state.plots.filter((plot) => plot.seed && this.getCropGrowth(plot).ready).length;
  }

  openFarm(plotId) {
    if (!this.state.isAtHome()) return;
    this.ui.openFarm(plotId);
  }

  plantSeed(plotId, seedId) {
    const plot = this.state.plots.find((entry) => entry.id === plotId);
    const crop = CROPS_BY_ID[seedId];
    if (!plot || !crop) return false;
    if (plot.seed) {
      this.ui.showToast('这块田已经种了东西。');
      return false;
    }
    if ((this.state.seeds[seedId] ?? 0) <= 0) {
      this.ui.showToast('没有这种种子了。可以在市集或种子铺购买。', { tone: 'warn', icon: 'seed' });
      return false;
    }
    if (!this.state.meetsRequirements(crop.requirements)) {
      this.ui.showToast('这种种子还需要更多与植物相处的经验。', { tone: 'warn', icon: 'lock' });
      return false;
    }
    if (!this.state.spendEnergy(2)) {
      this.ui.showToast('精力不足，先休息一下。', { tone: 'warn', icon: 'energy' });
      return false;
    }
    this.state.seeds[seedId] = Math.max(0, this.state.seeds[seedId] - 1);
    plot.seed = seedId;
    plot.plantedDay = this.state.day;
    this.world.refreshFarmPlot(plotId, this.state);
    this.ui.refreshFarmPanel();
    this.ui.updateHUD(true);
    this.ui.showToast(`${crop.name} 种下了。${crop.days} 天后可以收获。`, { icon: crop.icon, tone: 'calm' });
    this.audio.harvest();
    this.persistState();
    return true;
  }

  harvestPlot(plotId) {
    const plot = this.state.plots.find((entry) => entry.id === plotId);
    if (!plot?.seed) return false;
    const growth = this.getCropGrowth(plot);
    if (!growth.ready) {
      this.ui.showToast(`还没有成熟，再等 ${Math.max(0, growth.days - growth.elapsed)} 天。`, { tone: 'warn', icon: 'grow' });
      return false;
    }
    const crop = CROPS_BY_ID[plot.seed];
    if (!this.state.spendEnergy(1)) {
      this.ui.showToast('精力不足，无法收获。', { tone: 'warn', icon: 'energy' });
      return false;
    }
    const greenhouse = this.state.hasBuilding('greenhouse');
    const rewards = {
      food: crop.food + (greenhouse ? 1 : 0),
      coins: Math.round(crop.coins * this.rank.multiplier),
    };
    if (crop.crystal) rewards.crystal = crop.crystal + (greenhouse ? 1 : 0);
    const granted = this.state.grantRewards(rewards);
    this.state.addSeeds(plot.seed, 1);
    plot.seed = null;
    plot.plantedDay = null;
    this.state.recordHarvest();
    this.unlockAchievement('green_thumb');
    this.world.refreshFarmPlot(plotId, this.state);
    this.audio.harvest();
    this.ui.showLoot([...granted, { type: 'seed', seedId: crop.id, amount: 1 }], { title: `收获 · ${crop.name}` });
    this.trackEvent('harvest', 1);
    this.checkQuest('harvest');
    this.ui.refreshFarmPanel();
    this.ui.updateHUD(true);
    this.persistState();
    return true;
  }

  buySeed(seedId) {
    const crop = CROPS_BY_ID[seedId];
    if (!crop) return;
    if (!this.state.meetsRequirements(crop.requirements)) {
      this.ui.showToast('目前还没有途径获得这种种子。', { tone: 'warn', icon: 'lock' });
      return;
    }
    const cost = crop.seedCost;
    if (this.state.coins < cost) {
      this.ui.showToast('银叶币不够。', { tone: 'warn', icon: 'coin' });
      return;
    }
    this.state.coins -= cost;
    this.state.addSeeds(seedId, 1);
    this.audio.coin();
    this.ui.refreshFarmPanel();
    this.ui.updateHUD(true);
    this.persistState();
  }

  openForge() {
    if (!this.state.hasBuilding('forge')) {
      this.ui.showToast('需要先建造一座海风锻炉。');
      return;
    }
    this.ui.openForge();
    this.audio.click();
  }

  startForge(recipeId) {
    const recipe = TOOL_RECIPES_BY_ID[recipeId];
    if (!recipe) return;
    if (!this.state.meetsRequirements(recipe.requirements)) {
      this.ui.showToast(this.state.missingRequirement(recipe.requirements), { tone: 'warn', icon: 'lock' });
      return;
    }
    if (!this.state.canAfford(recipe.cost)) {
      this.ui.showToast('材料不够，无法开始锻造。', { tone: 'warn', icon: 'ore' });
      return;
    }
    this.ui.openForgeMinigame(recipe);
  }

  finishForge(recipeId, score) {
    const recipe = TOOL_RECIPES_BY_ID[recipeId];
    if (!recipe) return null;
    if (!this.state.canAfford(recipe.cost)) {
      this.ui.showToast('材料在锻造过程中不够了。', { tone: 'warn' });
      return null;
    }
    if (!this.state.spendEnergy(4)) {
      this.ui.showToast('精力不足，锤子举不起来。', { tone: 'warn', icon: 'energy' });
      return null;
    }
    this.state.spend(recipe.cost);
    const rankBonus = this.rank.tier * 4;
    const finalScore = clamp(Math.round(score + rankBonus + (Math.random() * 6 - 3)), 20, 100);
    const quality = finalScore >= 86
      ? { name: '传世', prefix: '传世', tier: 4 }
      : finalScore >= 68
        ? { name: '精工', prefix: '精工', tier: 3 }
        : finalScore >= 44
          ? { name: '良作', prefix: '良作', tier: 2 }
          : { name: '粗制', prefix: '粗制', tier: 1 };
    const tool = this.state.createTool(recipe, quality, finalScore);
    if (!tool) return null;
    if (tool.kind === 'axe' && tool.power >= (this.state.getAxe().power ?? 0)) this.state.equipTool(tool);
    if (tool.kind === 'pickaxe' && tool.power >= (this.state.getPickaxe().power ?? 0)) this.state.equipTool(tool);
    if (tool.kind === 'weapon') this.state.equipTool(tool);
    if (quality.name === '传世') this.unlockAchievement('master_forge');
    this.audio.hammer();
    window.setTimeout(() => this.audio.success(), 160);
    this.trackEvent('forge', 1);
    this.checkQuest('forge');
    this.ui.updateHUD(true);
    this.persistState();
    return tool;
  }

  openMarket() {
    if (!this.state.hasBuilding('market')) {
      this.ui.showToast('岛上还没有潮汐市集。');
      return;
    }
    this.ui.openMarket();
  }

  sellResource(key, amount = 1) {
    const prices = { food: 4, wood: 2, stone: 2, fiber: 2, ore: 5, crystal: 12 };
    if (!(key in prices)) return;
    const available = this.state.resources[key] ?? 0;
    const actual = Math.min(amount, available);
    if (actual <= 0) return;
    this.state.resources[key] -= actual;
    this.state.addResource('coins', prices[key] * actual);
    this.audio.coin();
    this.ui.showToast(`卖出 ${RESOURCE_DEFS[key]?.name ?? key} ×${actual}，获得银叶币 ${prices[key] * actual}。`, { icon: 'coin', tone: 'reward' });
    this.ui.refreshMarketPanel?.();
    this.ui.updateHUD(true);
    this.persistState();
  }

  // ---------------------------------------------------------------------------
  // 旅行 / UI 面板
  // ---------------------------------------------------------------------------

  openMap() {
    if (this.ui?.isBuildOpen()) this.closeBuildMode();
    if (!this.state.flags.dockRepaired) {
      this.ui.showToast('码头还没有修好。先回到南岸把它修好吧。', { icon: 'boat', tone: 'warn' });
      return;
    }
    this.ui.openMap();
    this.audio.click();
  }

  async travel(islandId) {
    const target = ISLAND_MAP[islandId];
    if (!target) return;
    if (!this.state.flags.dockRepaired && islandId !== 'home') {
      this.ui.showToast('码头还没有修好。', { icon: 'boat', tone: 'warn' });
      return;
    }
    if (islandId === this.state.location) {
      this.ui.closeModal();
      return;
    }
    this.ui.closeModal();
    this.busy = true;
    this.world.setInputEnabled(false);
    this.audio.sail();
    await this.ui.cover({
      title: target.id === 'home' ? '正在驶回栖云岛' : `正在驶向 · ${target.name}`,
      subtitle: target.id === 'home' ? '家里的炊烟会认得你' : '把陆地的声音留在身后',
      variant: 'sail',
      duration: 900,
    });
    this.state.location = islandId;
    this.state.timeMinutes = Math.min(23 * 60 + 50, this.state.timeMinutes + 25);
    this.state.markVisited(islandId);
    this.state.stats.traveled += 1;
    const spawn = target.spawn;
    this.state.updatePlayerPosition(spawn.x, spawn.z, this.state.player.energy);
    this.world.loadIsland(islandId, this.state, { spawn });
    this.world.setTimeOfDay(this.state.timeMinutes);
    this.trackEvent('travel', 1);
    this.checkResidents();
    await delay(480);
    await this.ui.reveal({ duration: 700 });
    this.world.setInputEnabled(true);
    this.busy = false;
    this.ui.updateHUD(true);
    this.ui.drawMinimap();
    this.ui.updateInteraction(this.world.getNearestInteraction());
    this.ui.showToast(`${target.name} · ${target.tagline}`, { tone: 'calm', icon: 'island', duration: 4200 });
    if (target.id !== 'home') {
      window.setTimeout(() => {
        if (!this.ui.hasModalOpen()) {
          this.ui.showToast(target.description, { tone: 'story', duration: 5600 });
        }
      }, 1500);
      // 到岛之后立刻告诉玩家「下一步做什么」
      window.setTimeout(() => {
        if (!this.ui.hasModalOpen()) {
          this.ui.showToast('走到发光的试炼碑前按 E（手机点「互动」）就能开始答题。', { tone: 'reward', icon: 'spark', duration: 6200 });
        }
      }, 3200);
    }
    this.persistState();
  }

  openBag() {
    if (this.ui?.isBuildOpen()) this.closeBuildMode();
    if (this.state) this.ui.openBag();
  }

  openCodex() {
    if (this.ui?.isBuildOpen()) this.closeBuildMode();
    if (this.state) this.ui.openCodex();
  }

  openJournal(tab = 'main') {
    if (this.ui?.isBuildOpen()) this.closeBuildMode();
    if (this.state) this.ui.openJournal(tab);
  }

  openHelp() {
    if (this.ui?.isBuildOpen()) this.closeBuildMode();
    this.ui.openHelp();
  }

  openSettings() {
    if (this.ui?.isBuildOpen()) this.closeBuildMode();
    this.ui.openSettings();
  }

  toggleSound() {
    this.audio.unlock();
    const next = !this.audio.enabled;
    this.audio.setEnabled(next);
    if (this.state) {
      this.state.settings.sound = next;
      this.persistState();
    }
    try {
      const raw = JSON.parse(window.localStorage.getItem('zhiyu-archipelago-save-v1') || '{}');
      raw.settings = { ...(raw.settings ?? {}), sound: next };
      window.localStorage.setItem('zhiyu-archipelago-save-v1', JSON.stringify(raw));
    } catch {
      // Ignore.
    }
    this.ui.setSoundIcon(next);
    this.ui.showToast(next ? '潮声重新响起来了。' : '世界安静下来。', { icon: next ? 'sound' : 'muted', tone: 'calm' });
  }

  setQuality(quality) {
    if (!['high', 'medium', 'low'].includes(quality)) return;
    if (this.state) this.state.settings.quality = quality;
    this.world.setQuality(quality);
    this.persistState();
    this.ui.showToast('画质已调整。', { icon: 'settings' });
  }

  eatFood() {
    if ((this.state.resources.food ?? 0) <= 0) {
      this.ui.showToast('行囊里没有食物了。', { tone: 'warn', icon: 'food' });
      return;
    }
    if (this.state.player.energy >= this.state.getEffectiveMaxEnergy()) {
      this.ui.showToast('现在不饿。');
      return;
    }
    this.state.resources.food -= 1;
    this.state.restoreEnergy(20);
    this.audio.harvest();
    this.ui.showToast('吃了一份岛上食物 · 精力 +20。', { icon: 'food', tone: 'calm' });
    this.ui.updateHUD(true);
    this.ui.refreshBagPanel?.();
    this.persistState();
  }

  equipTool(uidValue) {
    const tool = this.state.tools.find((entry) => entry.uid === uidValue);
    if (!tool) return;
    this.state.equipTool(tool);
    this.audio.coin();
    this.ui.showToast(`已装备「${tool.name}」。`, { icon: tool.icon ?? 'hammer', tone: 'reward' });
    this.ui.refreshBagPanel?.();
    this.persistState();
  }

  // ---------------------------------------------------------------------------
  // 每日任务、主线与成就
  // ---------------------------------------------------------------------------

  ensureDaily(force = false) {
    if (!this.state) return;
    const valid = this.state.daily?.day === this.state.day && this.state.daily.tasks?.length === 3;
    if (valid && !force) return;
    const hasDock = this.state.flags.dockRepaired;
    const hasForge = this.state.hasBuilding('forge');
    const hasResidents = this.state.residents.length > 0;
    const available = DAILY_POOL.filter((task) => {
      if (task.type === 'quiz' && !hasDock) return false;
      if (task.type === 'travel' && !hasDock) return false;
      if (task.type === 'forge' && !hasForge) return false;
      if (task.type === 'talk' && !hasResidents) return false;
      return true;
    });
    const seed = hashString(`${this.state.day}-${this.state.rank}-daily`);
    const tasks = shuffle(available, mulberry32(seed)).slice(0, 3).map((task, index) => ({
      ...deepClone(task),
      id: `day-${this.state.day}-task-${index}`,
      label: task.label.replace('{target}', String(task.target)),
      progress: 0,
    }));
    this.state.daily = {
      day: this.state.day,
      tasks,
      progress: Object.fromEntries(tasks.map((task) => [task.id, 0])),
      claimed: [],
    };
  }

  trackEvent(type, amount = 1, meta = {}) {
    if (!this.state) return;
    // 今日委托
    if (this.state.daily?.day === this.state.day) {
      for (const task of this.state.daily.tasks) {
        if (task.type !== type || this.state.daily.claimed.includes(task.id)) continue;
        this.state.daily.progress[task.id] = (this.state.daily.progress[task.id] ?? 0) + amount;
        if (this.state.daily.progress[task.id] >= task.target) {
          this.state.daily.claimed.push(task.id);
          const scaledReward = { ...task.reward };
          if (scaledReward.coins) scaledReward.coins = Math.round(scaledReward.coins * this.rank.multiplier);
          if (scaledReward.insight) scaledReward.insight = Math.round(scaledReward.insight * this.rank.multiplier);
          this.state.grantRewards(scaledReward);
          this.audio.quest();
          this.ui.showToast(`今日委托完成 · ${task.label}`, { tone: 'reward', icon: 'quest', duration: 4200 });
        }
      }
    }
    // 需要计数的主线
    const quest = this.activeQuest;
    if (quest && ['harvest', 'forge', 'quiz', 'gather'].includes(quest.objective.type)) {
      if (quest.objective.type === type) {
        this.state.questProgress += amount;
      }
    }
    this.checkQuest(type, meta);
    this.ui.updateHUD(true);
  }

  checkQuest(trigger = '', meta = {}) {
    const quest = this.activeQuest;
    if (!quest) return;
    const objective = quest.objective;
    let current = 0;
    let target = objective.count ?? 1;
    if (objective.type === 'build') {
      current = this.state.getBuildingCount(objective.building);
    } else if (objective.type === 'repair') {
      current = this.state.flags.dockRepaired ? 1 : 0;
    } else if (objective.type === 'trial') {
      current = this.state.hasTrialPassed(objective.trial) ? 1 : 0;
    } else if (objective.type === 'expand') {
      current = this.state.expansions.length;
    } else {
      current = this.state.questProgress;
      target = objective.count ?? 1;
    }
    if (current >= target) {
      this.completeQuest(quest);
    }
  }

  completeQuest(quest) {
    if (!quest || this.state.completedQuests.includes(quest.id)) return;
    const nextQuest = MAIN_QUESTS[this.state.mainQuestIndex + 1] ?? null;
    this.state.completedQuests.push(quest.id);
    this.state.mainQuestIndex = Math.min(this.state.mainQuestIndex + 1, MAIN_QUESTS.length);
    this.state.questProgress = 0;
    const granted = this.state.grantRewards(quest.rewards ?? {});
    this.audio.quest();
    if (quest.autoResident) {
      const resident = RESIDENTS_BY_ID[quest.autoResident];
      if (resident && this.state.canAcceptResident() && !this.state.residents.includes(resident.id)) {
        this.state.addResident(resident.id);
        this.unlockAchievement('first_resident');
      }
    }
    this.checkResidents();
    this.checkAchievements();
    this.ui.showQuestComplete(quest, nextQuest, granted);
    this.persistState();
    if (quest.finale) {
      this.state.flags.endingSeen = true;
      this.pendingFinale = true;
      window.setTimeout(() => {
        this.ui.showFinale(this.getEndingData());
      }, 1400);
    } else if (nextQuest) {
      window.setTimeout(() => {
        if (!this.busy) this.ui.showToast(`新主线 · ${nextQuest.title}`, { tone: 'story', icon: 'quest', duration: 4000 });
      }, 900);
      // 如果新主线的前置已经在此前的自由探索中完成，让它立刻接上，而不是卡住。
      window.setTimeout(() => this.checkQuest('auto'), 300);
    }
    this.ui.updateHUD(true);
  }

  checkAchievements() {
    if (!this.state) return;
    if (this.state.built.length >= 1) this.unlockAchievement('first_build');
    if (this.state.flags.dockRepaired) this.unlockAchievement('dock_fixed');
    if (this.state.getStampCount() >= 1) this.unlockAchievement('first_trial');
    if (this.state.getStampCount() >= 7) this.unlockAchievement('seven_stamps');
    if (this.state.residents.length >= 1) this.unlockAchievement('first_resident');
    if (this.state.stats.harvested >= 1) this.unlockAchievement('green_thumb');
    if (this.state.hasBuilding('observatory')) this.unlockAchievement('observatory');
    if (this.state.tools.some((tool) => tool.qualityTier === 4)) this.unlockAchievement('master_forge');
  }

  unlockAchievement(id) {
    const definition = ACHIEVEMENT_DEFS.find((achievement) => achievement.id === id);
    if (!definition) return;
    const isNew = this.state?.unlockAchievement(id);
    if (!isNew) return;
    this.audio.quest();
    this.ui.showAchievement(definition);
  }

  checkResidents(force = false) {
    if (!this.state) return [];
    const available = this.state.getCapacity() - this.state.residents.length;
    if (available <= 0) return [];
    const newcomers = [];
    for (const resident of RESIDENTS) {
      if (this.state.residents.includes(resident.id)) continue;
      if (!this.state.meetsRequirements(resident.requirement)) continue;
      if (!this.state.canAcceptResident()) break;
      this.state.addResident(resident.id);
      this.unlockAchievement('first_resident');
      newcomers.push(resident);
      this.state.grantRewards({ insight: 8 });
      this.ui.showToast(`${resident.name} 搬进了栖云岛。${resident.title} · 去小屋附近和他们聊聊吧。`, {
        tone: 'reward',
        icon: 'people',
        duration: 5600,
      });
    }
    if (newcomers.length) {
      if (this.state.location === 'home') this.pendingHomeRefresh = true;
      this.persistState();
      this.ui.updateHUD(true);
    }
    return newcomers;
  }

  getQuestProgressView() {
    const quest = this.activeQuest;
    if (!quest) return { quest: null, current: 1, target: 1, ratio: 1 };
    const objective = quest.objective;
    let current = 0;
    let target = objective.count ?? 1;
    if (objective.type === 'build') current = this.state.getBuildingCount(objective.building);
    else if (objective.type === 'repair') current = this.state.flags.dockRepaired ? 1 : 0;
    else if (objective.type === 'trial') current = this.state.hasTrialPassed(objective.trial) ? 1 : 0;
    else if (objective.type === 'expand') current = this.state.expansions.length;
    else current = this.state.questProgress;
    return { quest, current: Math.min(current, target), target, ratio: clamp(current / Math.max(1, target), 0, 1) };
  }

  hasSave() {
    return GameState.hasSave();
  }

  restartGame() {
    GameState.clearSave();
    try { window.localStorage.removeItem('zhiyu-archipelago-save-v1'); } catch { /* ignore */ }
    window.location.reload();
  }

  getEndingData() {
    return {
      rank: this.rank,
      days: this.state.day,
      stamps: this.state.getStampCount(),
      residents: this.state.residents.length,
      buildings: this.state.built.length,
      tools: this.state.tools.length,
      codex: this.state.codex.length,
      islands: this.state.visitedIslands.length,
      coins: this.state.coins,
    };
  }

  getObjectiveText(quest = this.activeQuest) {
    if (!quest) return '没有未完成的主线。让岛自己继续生长吧。';
    return quest.objective.label;
  }

  getTimeLabel() {
    return formatTime(this.state?.timeMinutes ?? 390);
  }

  getLocationLabel() {
    return ISLAND_MAP[this.state?.location]?.name ?? '栖云岛';
  }

  getPlayerName() {
    return '旅人';
  }

  // Called by UI when a modal opens or closes to coordinate pausing and queued notices.
  onUiModalChanged(open) {
    this.world?.setUiPaused(open);
    if (!open) {
      this.ui?.updateHUD(true);
      if (this.pendingFinale && this.state?.flags.endingSeen) {
        // The finale is displayed through UI's queue; keep this flag for freeplay.
        this.pendingFinale = false;
      }
    }
  }
}

export { TIME_RATE };
