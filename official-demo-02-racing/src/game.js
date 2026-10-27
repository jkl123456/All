import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CARS, DEFAULT_SETTINGS, MODES, TRACK_LAYOUTS, clearMapPreview, readMapPreview, setMapPreview, trackLayout,
} from './config.js';
import { Race } from './race.js';
import { CarModel } from './car.js';
import { applyBodyStance, getBodyStance, setBodyStance } from './carasset.js';
import { clamp, damp, formatTime } from './utils.js';

const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const SETTINGS_KEY = 'apex-city-settings-v1';
const BEST_LAP_KEY = 'apex-city-best-lap-v1';

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const settings = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    // 旧版本可能存着已下线的赛道 id（哈维利 / 港口 / 山谷），统一回落到默认赛道
    if (!TRACK_LAYOUTS[settings.track]) settings.track = DEFAULT_SETTINGS.track;
    return settings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function safeName(s) {
  return String(s).replace(/[<>&"]/g, '');
}

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx);
    this.settings = loadSettings();
    this.isCoarse = window.matchMedia('(pointer: coarse)').matches;
    let hasSavedSettings = false;
    try { hasSavedSettings = !!localStorage.getItem(SETTINGS_KEY); } catch { /* file:// or private mode */ }
    if (this.isCoarse && !hasSavedSettings) {
      // 手机默认降一档：低端机（核心数/内存偏小）直接进流畅模式，
      // 否则手机首次进入会因 2048 阴影 + 泛光而掉帧。
      const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
      this.settings.quality = lowEnd ? 'low' : 'medium';
    }
    this.mode = MODES[this.settings.mode] ? this.settings.mode : 'gp';
    this.state = 'menu';
    this.time = 0;
    this.race = null;
    this.hero = null;
    this.heroDef = null;
    this.heroPaint = null;
    this.raceCameraPositioned = false;
    this.menuOrbit = 0;
    this.resultsAngle = 0;
    this.photo = { angle: 0, pitch: 0.22, dist: 7 };
    this.photoDragging = false;
    this.lastPointer = { x: 0, y: 0 };
    this.prevSpeed = 0;
    this.boostActive = false;
    this.prevBoost = false;
    this.hudCache = {};
    this.lastHudUpdate = 0;
    this.standingsUpdate = 0;
    this.mapUpdate = 0;
    this.fpsTimer = 0;
    this.fpsFrames = 0;
    this.fpsValue = 60;
    this.countdownHideTimer = null;
    this.toastTimer = null;
    this.impactTimer = null;
    this.bestLap = this.loadBestLap();
    this.cameraLook = new THREE.Vector3();
    this.cameraTargetFov = 55;
    this.tempVec = new THREE.Vector3();
    this.showroomEnv = null;
    this.raceIntro = 0;
    this.photoTarget = new THREE.Vector3();
    // 展厅里用鼠标拖动车身
    this.heroSpin = 0;
    this.heroSpinVel = 0;
    this.heroLift = 0;
    this.heroBaseYaw = 0;
    this.heroDragging = false;
    // 每个视角记住自己的俯仰角（弧度）：0=远追尾 1=近追尾 2=引擎盖
    this.cameraPitch = [0, 0, 0];
    this.cameraOffset = new THREE.Vector3();
    this.cameraLookOffset = new THREE.Vector3();
    this._cursor = undefined;
    // 全屏赛道地图：预览赛道会在启动时先按它铺设完整场景
    this.mapPreviewId = readMapPreview();
    this.mapTrackId = null;
    this.mapViewMode = 'overview';
    this.mapAzimuth = -0.9;
    this.mapPolar = 0.86;
    this.mapZoom = 1;
    this.mapBaseDist = 600;
    this.mapFitDist = 0;
    this.mapLookShift = 0;
    this.mapRadius = 200;
    this.mapCenter = new THREE.Vector3();
    this.mapFocus = new THREE.Vector3();
    this.mapDragging = false;
    this.mapPointers = new Map();
    this.mapPinchStart = null;
    this.mapPinchZoom = 1;
    this.mapLastPointer = { x: 0, y: 0 };
    this.mapShadowRestore = null;
    this.boundResize = () => this.resize();
    this.initDOM();
    this.bindUI();
    this.bindMapView();
    this.bindStance();
    this.applySettings(true);
    // 读回上次调好的车体比例（每台车一份），先灌进渲染层再建车
    const savedStance = this.normalizeStance(this.settings.stance);
    CARS.forEach((c) => {
      const style = c.model?.style;
      if (style && savedStance[style]) setBodyStance(style, savedStance[style]);
    });
    this.createHero();
    this.buildRpmLights();
    this.updateMenuUI();
    window.addEventListener('resize', this.boundResize);
    // 横竖屏切换 / 手机地址栏收放都会改变可视高度，延迟再量一次避免拿到过渡尺寸
    window.addEventListener('orientationchange', () => setTimeout(this.boundResize, 240));
    window.visualViewport?.addEventListener('resize', this.boundResize);
    this.bindPhoto();
    this.bindHeroOrbit();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'racing') this.pauseRace();
    });
    window.__APEX_GAME__ = this;
  }

  initDOM() {
    this.canvas = $('scene');
    this.screens = {
      loading: $('screen-loading'),
      menu: $('screen-menu'),
      garage: $('screen-garage'),
      settings: $('screen-settings'),
      help: $('screen-help'),
      pause: $('screen-pause'),
      results: $('screen-results'),
    };
    this.hud = $('race-hud');
    this.countdownEl = $('countdown');
    this.countdownText = $('countdown-text');
    this.countdownLights = $$('#countdown-lights i');
    this.photoHint = $('photo-hint');
    this.perf = $('perf-monitor');
    this.perfFps = $('fps-num');
    this.perfDraw = $('draw-num');
    this.menuColorWrap = $('menu-colors');
    this.garageColorWrap = $('garage-paint');
    this.garageList = $('garage-list');
    this.minimap = $('minimap');
    this.mapCtx = this.minimap.getContext('2d');
    this.mapView = $('map-view');
    this.mapName = $('map-name');
    this.mapEn = $('map-en');
    this.mapKm = $('map-km');
    this.mapWidth = $('map-width');
    this.mapCorners = $('map-corners');
    this.mapNote = $('map-note');
    this.mapConfirmLabel = $('map-confirm-label');
    this.mapConfirmEn = $('map-confirm-en');
    this.mapViewButtons = $$('[data-map-view]');
    this.toast = $('race-toast');
    this.toastKicker = $('toast-kicker');
    this.toastTitle = $('toast-title');
    this.toastSub = $('toast-sub');
    this.rpmLightsEl = $('rpm-lights');
  }

  /** 每条赛道各存一份最快圈。 */
  bestLapKey() {
    return `${BEST_LAP_KEY}:${this.settings.track}`;
  }

  loadBestLap() {
    try {
      const v = parseFloat(localStorage.getItem(this.bestLapKey()) || 'NaN');
      return Number.isFinite(v) ? v : Infinity;
    } catch {
      return Infinity;
    }
  }

  saveBestLap(time) {
    try { localStorage.setItem(this.bestLapKey(), String(time)); } catch { /* ignored */ }
  }

  /** 旧版本存的是全局单份 {l,w,h}，这里迁成按车型的 { gt3:{...}, lm:{...} }。 */
  normalizeStance(raw) {
    const st = raw || {};
    if (typeof st.h !== 'number') return st;
    const legacy = { l: st.l ?? 1, w: st.w ?? 1, h: st.h };
    const next = {};
    CARS.forEach((c) => {
      const style = c.model?.style;
      if (style) next[style] = { ...legacy };
    });
    this.settings.stance = next;
    this.saveSettings();
    return next;
  }

  saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* ignored */ }
  }

  get selectedDef() {
    return CARS.find((c) => c.id === this.settings.selectedCar) || CARS[0];
  }

  get selectedPaint() {
    const def = this.selectedDef;
    return def.palette.includes(this.settings.paint) ? this.settings.paint : def.paint;
  }

  bindUI() {
    // Nav / route buttons
    $$('[data-nav]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.state === 'racing' || this.state === 'paused' || this.state === 'photo' || this.state === 'map') return;
        const dest = el.dataset.nav;
        if (dest === 'menu' || dest === 'garage' || dest === 'settings' || dest === 'help') {
          this.audio.init();
          this.navigate(dest);
        }
      });
    });

    // Primary action buttons
    $$('[data-action]').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.init();
        this.audio.click();
        this.handleAction(el.dataset.action);
      });
    });

    // Mode selector
    $$('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.audio.click();
        this.mode = btn.dataset.mode;
        this.settings.mode = this.mode;
        this.saveSettings();
        $$('.mode-btn').forEach((b) => b.classList.toggle('is-active', b === btn));
        this.updateModeUI();
      });
    });

    // Garage cards
    this.garageList.addEventListener('click', (e) => {
      const card = e.target.closest('[data-car]');
      if (!card) return;
      this.audio.click();
      this.selectCar(card.dataset.car);
    });
    this.menuColorWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-paint]');
      if (!btn) return;
      this.audio.click();
      this.setPaint(btn.dataset.paint);
    });
    this.garageColorWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-paint]');
      if (!btn) return;
      this.audio.click();
      this.setPaint(btn.dataset.paint);
    });

    // Settings
    $$('[data-setting]').forEach((group) => {
      group.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-value]');
        if (!btn) return;
        const key = group.dataset.setting;
        this.settings[key] = btn.dataset.value;
        this.saveSettings();
        this.audio.click();
        this.updateSettingsUI();
        if (key === 'quality') this.applyQuality();
        if (key === 'camera') this.raceCameraPositioned = false;
      });
    });
    $$('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.toggle;
        this.settings[key] = !this.settings[key];
        this.audio.click();
        this.saveSettings();
        this.updateSettingsUI();
        this.applyToggles();
      });
    });
    $$('[data-track]').forEach((btn) => {
      btn.addEventListener('click', () => this.enterTrackMap(btn.dataset.track));
    });
    const padSens = $('pad-sensitivity');
    padSens.addEventListener('input', () => {
      this.settings.padSensitivity = Number(padSens.value);
      $('pad-sensitivity-val').textContent = String(this.settings.padSensitivity);
      this.applyInputTuning();
      this.saveSettings();
    });
    const padDead = $('pad-deadzone');
    padDead.addEventListener('input', () => {
      this.settings.padDeadzone = Number(padDead.value);
      $('pad-deadzone-val').textContent = String(this.settings.padDeadzone);
      this.applyInputTuning();
      this.saveSettings();
    });
    this.input?.on('gamepad', () => this.updatePadStatus());
    const vol = $('volume');
    vol.addEventListener('input', () => {
      this.settings.volume = Number(vol.value);
      $('volume-val').textContent = String(this.settings.volume);
      this.audio.setVolume(this.settings.volume / 100);
      this.saveSettings();
    });
    $('btn-reset-settings').addEventListener('click', () => {
      const currentCar = this.settings.selectedCar;
      const currentPaint = this.settings.paint;
      const currentMode = this.settings.mode;
      this.settings = { ...DEFAULT_SETTINGS, selectedCar: currentCar, paint: currentPaint, mode: currentMode };
      this.saveSettings();
      this.updateSettingsUI();
      this.applyToggles();
      this.applyQuality();
      this.audio.setVolume(this.settings.volume / 100);
    });

    // Keyboard shortcuts that are game-level
    this.input.on('pause', () => {
      if (this.state === 'racing') this.pauseRace();
      else if (this.state === 'paused') this.resumeRace();
      else if (this.state === 'photo') this.exitPhoto();
      else if (this.state === 'map') this.exitMapView();
    });
    this.input.on('camera', () => this.cycleCamera());
    this.input.on('reset', () => {
      if (this.state === 'racing' && this.race) {
        this.race.resetPlayerToTrack();
        this.audio.beep(320, 0.08, 0.05);
      }
    });
    this.input.on('mute', () => {
      this.settings.sound = !this.settings.sound;
      this.saveSettings();
      this.applyToggles();
      this.updateSettingsUI();
    });
    this.input.on('photo', () => {
      if (this.state === 'results') this.enterPhoto();
      else if (this.state === 'photo') this.exitPhoto();
    });
    this.input.on('enter', () => {
      if (this.state === 'menu') this.startRace();
      else if (this.state === 'map') this.confirmMapView();
    });

    // First gesture enables WebAudio (browser autoplay policy).
    const unlock = () => {
      this.audio.init();
      this.audio.setMuted(!this.settings.sound);
      this.audio.setVolume(this.settings.volume / 100);
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });

    $('photo-exit').addEventListener('click', () => this.exitPhoto());
    $('hud-pause').addEventListener('click', () => {
      if (this.state === 'racing') this.pauseRace();
      else if (this.state === 'paused') this.resumeRace();
    });
    $('hud-camera').addEventListener('click', () => {
      this.cycleCamera();
      this.audio.click();
    });
  }

  /** 点赛道卡片：当前赛道直接进全屏地图；其它赛道先按它重铺完整场景，再进地图。 */
  enterTrackMap(id) {
    const def = TRACK_LAYOUTS[id];
    if (!def) return;
    if (['racing', 'paused', 'photo', 'map'].includes(this.state)) return;
    this.audio.init();
    this.audio.click();
    if (id === this.settings.track && id === trackLayout().id) {
      clearMapPreview();
      this.enterMapView(id);
      return;
    }
    setMapPreview(id);
    document.body.classList.add('is-switching');
    setTimeout(() => location.reload(), 220);
  }

  bindMapView() {
    if (!this.mapView) return;
    const back = () => {
      this.audio.click();
      this.exitMapView();
    };
    $('map-close')?.addEventListener('click', back);
    $('map-back')?.addEventListener('click', back);
    $('map-confirm')?.addEventListener('click', () => {
      this.audio.click();
      this.confirmMapView();
    });
    this.mapViewButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.state !== 'map') return;
        this.audio.click();
        this.setMapView(btn.dataset.mapView);
      });
    });
    this.bindMapOrbit();
  }

  bindMapOrbit() {
    const spread = () => {
      const [a, b] = [...this.mapPointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.state !== 'map') return;
      e.preventDefault();
      this.mapPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.canvas.setPointerCapture?.(e.pointerId);
      if (this.mapPointers.size === 1) {
        this.mapDragging = true;
        this.mapLastPointer = { x: e.clientX, y: e.clientY };
      } else if (this.mapPointers.size === 2) {
        this.mapDragging = false;
        this.mapPinchStart = Math.max(1, spread());
        this.mapPinchZoom = this.mapZoom;
      }
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.mapPointers.has(e.pointerId)) return;
      this.mapPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.mapPointers.size >= 2) {
        this.mapZoom = clamp(this.mapPinchZoom * (this.mapPinchStart / Math.max(1, spread())), 0.35, 3.2);
        return;
      }
      if (!this.mapDragging) return;
      const dx = e.clientX - this.mapLastPointer.x;
      const dy = e.clientY - this.mapLastPointer.y;
      this.mapLastPointer = { x: e.clientX, y: e.clientY };
      this.mapAzimuth -= dx * 0.0055;
      this.mapPolar = clamp(this.mapPolar - dy * 0.0045, 0.1, 1.42);
    });
    const release = (e) => {
      if (e?.pointerId != null) this.mapPointers.delete(e.pointerId);
      else this.mapPointers.clear();
      if (this.mapPointers.size === 1) {
        const p = [...this.mapPointers.values()][0];
        this.mapLastPointer = { x: p.x, y: p.y };
        this.mapDragging = true;
      } else {
        this.mapDragging = false;
      }
      if (this.mapPointers.size < 2) this.mapPinchStart = null;
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', () => release());
    this.canvas.addEventListener('wheel', (e) => {
      if (this.state !== 'map') return;
      e.preventDefault();
      this.mapZoom = clamp(this.mapZoom * (1 + Math.sign(e.deltaY) * 0.08), 0.35, 3.2);
    }, { passive: false });
  }

  enterMapView(id) {
    if (!this.mapView) return;
    this.mapTrackId = id;
    this.mapViewMode = 'overview';
    this.mapZoom = 1;
    this.mapDragging = false;
    this.mapPointers.clear();
    this.mapPinchStart = null;
    this.state = 'map';
    this.countdownEl.classList.remove('is-active');
    this.photoHint.classList.remove('is-active');
    Object.values(this.screens).forEach((el) => el?.classList.remove('is-active'));
    this.screens.pause?.classList.remove('is-active');
    this.screens.results?.classList.remove('is-active');
    this.hud.classList.remove('is-active', 'is-free', 'is-timeattack');
    document.body.classList.remove('is-racing', 'is-photo');
    document.body.classList.add('is-map');
    this.mapView.classList.add('is-active');
    this.mapView.setAttribute('aria-hidden', 'false');
    if (this.hero) this.hero.root.visible = false;
    this.input.setActive(false);
    this.applyMapGroundOffsets();
    this.computeMapBounds();
    this.setMapView('overview', true);
  }

  exitMapView() {
    if (this.state !== 'map') return;
    const previewingOther = this.mapTrackId !== this.settings.track;
    this.mapView?.classList.remove('is-active');
    this.mapView?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-map');
    this.mapPointers.clear();
    this.mapDragging = false;
    this.mapPinchStart = null;
    clearMapPreview();
    this.restoreMapShadow();
    this.restoreMapGroundOffsets();
    this.state = 'menu';
    this.mapPreviewId = null;
    if (previewingOther) {
      document.body.classList.add('is-switching');
      setTimeout(() => location.reload(), 220);
      return;
    }
    this.screens.menu.classList.add('is-active');
    if (this.hero) this.hero.root.visible = true;
    this.camera.fov = 38;
    this.camera.near = 0.2;
    this.camera.far = 22000;
    this.camera.updateProjectionMatrix();
    this.raceCameraPositioned = false;
    this.updateMenuUI();
  }

  confirmMapView() {
    if (this.state !== 'map' || !this.mapTrackId) return;
    const id = this.mapTrackId;
    const different = id !== this.settings.track;
    if (different) {
      // 地图里的场景已经按这条赛道完整铺好，直接把它设为当前赛道即可，
      // 不需要再重新加载一次城市和地形。
      this.settings.track = id;
      this.saveSettings();
      this.bestLap = this.loadBestLap();
    }
    this.exitMapView();
    if (!different) this.startRace();
  }

  computeMapBounds() {
    const b = this.track.mapBounds;
    this.mapCenter.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
    this.mapRadius = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 0.5;
    this.mapBaseDist = this.mapRadius * 2.45 + 40;
    this.mapLookShift = this.mapRadius * 0.09;
  }

  setMapView(mode, force = false) {
    if (!mode || (mode !== 'overview' && mode !== 'detail')) return;
    if (!force && mode === this.mapViewMode) return;
    this.mapViewMode = mode;
    this.mapZoom = 1;
    const start = this.track.samples[0];
    if (mode === 'detail') {
      this.mapCenter.copy(start.position);
      this.mapFocus.copy(start.position);
      this.mapBaseDist = this.camera.aspect < 1 ? 88 : 64;
      this.mapLookShift = 0;
      this.mapAzimuth = Math.atan2(-start.tangent.x, -start.tangent.z);
      this.mapPolar = 0.44;
      this.mapFitDist = 0;
    } else {
      const b = this.track.mapBounds;
      this.mapCenter.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
      this.mapFocus.copy(this.mapCenter);
      this.mapBaseDist = this.mapRadius * 2.45 + 40;
      this.mapLookShift = this.mapRadius * 0.09;
      this.mapAzimuth = Math.atan2(start.position.x - this.mapCenter.x, start.position.z - this.mapCenter.z) + 0.95;
      this.mapPolar = 0.95;
      this.computeMapFit();
    }
    this.updateMapUI();
  }

  computeMapFit() {
    const vTan = Math.tan(THREE.MathUtils.degToRad(50) / 2);
    // 赛道外围还有看台、马修站、维修区和地标建筑，不能只按路面外接框取景。
    this.mapFitDist = (this.mapRadius * 1.3) / (vTan * Math.max(0.3, this.camera.aspect));
  }

  updateMapCamera(dt) {
    if (!this.mapDragging) this.mapAzimuth += dt * (this.mapViewMode === 'detail' ? 0.035 : 0.07);
    if (this.mapViewMode === 'overview') this.computeMapFit();
    const dist = Math.max(this.mapBaseDist, this.mapFitDist) * this.mapZoom;
    this.camera.fov = damp(this.camera.fov, 50, 3, dt);
    // 高空看整张地图时，0.2m 的近平面会让深度精度严重不足，
    // 路面 / 路肩 / 地形贴得太近就会一直闪。按观察距离抬高近平面。
    this.camera.near = this.mapViewMode === 'detail' ? 1 : clamp(dist * 0.02, 2, 60);
    this.camera.far = 22000;
    this.camera.updateProjectionMatrix();
    const horizontal = Math.cos(this.mapPolar) * dist;
    this.camera.position.set(
      this.mapCenter.x + Math.sin(this.mapAzimuth) * horizontal,
      Math.sin(this.mapPolar) * dist,
      this.mapCenter.z + Math.cos(this.mapAzimuth) * horizontal,
    );
    this.camera.lookAt(
      this.mapCenter.x + Math.sin(this.mapAzimuth) * this.mapLookShift,
      0,
      this.mapCenter.z + Math.cos(this.mapAzimuth) * this.mapLookShift,
    );
    this.updateMapShadow();
  }

  updateMapShadow() {
    const sun = this.environment?.sun;
    if (!sun) return;
    const shadow = sun.shadow;
    const cam = shadow.camera;
    if (!this.mapShadowRestore) {
      this.mapShadowRestore = {
        left: cam.left,
        right: cam.right,
        top: cam.top,
        bottom: cam.bottom,
        near: cam.near,
        far: cam.far,
        bias: shadow.bias,
        normalBias: shadow.normalBias,
        castShadow: sun.castShadow,
      };
    }
    // 整体机位覆盖范围太大，2048 阴影贴图会在平坦地面上产生闪烁的阴影痤疮；
    // 整体视图直接关掉实时阴影，发车区细节再打开。
    const detail = this.mapViewMode === 'detail';
    sun.castShadow = detail;
    if (!detail) return;
    const span = 120;
    cam.left = -span;
    cam.right = span;
    cam.top = span;
    cam.bottom = -span;
    cam.near = 1;
    cam.far = 800;
    shadow.bias = -0.0006;
    shadow.normalBias = 0.12;
    cam.updateProjectionMatrix();
  }

  restoreMapShadow() {
    const sun = this.environment?.sun;
    if (!sun || !this.mapShadowRestore) return;
    const saved = this.mapShadowRestore;
    const cam = sun.shadow.camera;
    cam.left = saved.left;
    cam.right = saved.right;
    cam.top = saved.top;
    cam.bottom = saved.bottom;
    cam.near = saved.near;
    cam.far = saved.far;
    sun.shadow.bias = saved.bias;
    sun.shadow.normalBias = saved.normalBias;
    sun.castShadow = saved.castShadow;
    cam.updateProjectionMatrix();
    this.mapShadowRestore = null;
  }

  /** 高空地图里把大地面稍微压后一点，防止和赛道 / 路肩在深度上打架。 */
  mapGroundMaterials() {
    const list = [];
    const add = (mat) => {
      if (!mat) return;
      const mats = Array.isArray(mat) ? mat : [mat];
      for (const m of mats) if (m && !list.includes(m)) list.push(m);
    };
    add(this.city?.ground?.material);
    add(this.biome?.ground?.material);
    return list;
  }

  applyMapGroundOffsets() {
    for (const mat of this.mapGroundMaterials()) {
      if (mat.userData.__mapPoly) continue;
      mat.userData.__mapPoly = {
        polygonOffset: mat.polygonOffset,
        factor: mat.polygonOffsetFactor,
        units: mat.polygonOffsetUnits,
      };
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = 1;
      mat.polygonOffsetUnits = 1;
      mat.needsUpdate = true;
    }
  }

  restoreMapGroundOffsets() {
    for (const mat of this.mapGroundMaterials()) {
      const saved = mat.userData.__mapPoly;
      if (!saved) continue;
      mat.polygonOffset = saved.polygonOffset;
      mat.polygonOffsetFactor = saved.factor;
      mat.polygonOffsetUnits = saved.units;
      delete mat.userData.__mapPoly;
      mat.needsUpdate = true;
    }
  }

  updateMapUI() {
    const def = trackLayout(this.mapTrackId);
    if (!def) return;
    const current = this.mapTrackId === this.settings.track;
    if (this.mapName) this.mapName.textContent = def.name;
    if (this.mapEn) this.mapEn.textContent = def.en;
    if (this.mapKm) this.mapKm.innerHTML = `${Number(def.km || 0).toFixed(2)}<em>KM</em>`;
    if (this.mapWidth) this.mapWidth.innerHTML = `${Number(def.width ?? 16).toFixed(1)}<em>M</em>`;
    if (this.mapNote) {
      this.mapNote.textContent = `${def.note || ''} · ${this.mapViewMode === 'detail' ? '发车区细节' : '整条环道'}`;
    }
    if (this.mapConfirmLabel) this.mapConfirmLabel.textContent = current ? '开始比赛' : '载入赛道';
    if (this.mapConfirmEn) this.mapConfirmEn.textContent = current ? 'START RACE' : 'LOAD CIRCUIT';
    if (this.mapCorners) {
      let corners = 0;
      let inCorner = false;
      for (const s of this.track.samples) {
        const tight = Math.abs(s.curvature) > 0.0045;
        if (tight && !inCorner) corners++;
        inCorner = tight;
      }
      this.mapCorners.innerHTML = `${corners}<em>CORNERS</em>`;
    }
    for (const btn of this.mapViewButtons) {
      btn.classList.toggle('is-active', btn.dataset.mapView === this.mapViewMode);
    }
  }

  buildRpmLights() {
    this.rpmLightsEl.innerHTML = '';
    for (let i = 0; i < 14; i++) {
      const el = document.createElement('i');
      if (i >= 11) el.classList.add('is-red');
      this.rpmLightsEl.appendChild(el);
    }
    this.rpmSegments = $$('#rpm-lights i');
  }

  buildGarage() {
    this.garageList.innerHTML = CARS.map((car, i) => `
      <button class="car-card ${car.id === this.settings.selectedCar ? 'is-active' : ''}" data-car="${car.id}">
        <span class="car-card-index">${String(i + 1).padStart(2, '0')}</span>
        <span class="car-card-name"><b>${safeName(car.name)}</b><small>${safeName(car.brand)} · ${safeName(car.className.split('·')[0].trim())}</small></span>
        <span class="car-card-class"><em>${car.hp}</em>HP</span>
      </button>
    `).join('');
  }

  updateCarSelectUI() {
    const def = this.selectedDef;
    const paint = this.selectedPaint;
    if (this.settings.paint !== paint) this.settings.paint = paint;
    $('menu-car-index').textContent = def.index;
    $('menu-car-brand').textContent = def.brand;
    $('menu-car-name').textContent = def.name;
    $('menu-car-class').textContent = def.className;
    $('stat-speed').style.width = `${def.stats.speed}%`;
    $('stat-grip').style.width = `${def.stats.grip}%`;
    $('stat-accel').style.width = `${def.stats.accel}%`;
    $('stat-speed-val').textContent = def.topSpeed;
    $('stat-grip-val').textContent = def.stats.grip;
    $('stat-accel-val').textContent = def.accelTime.toFixed(1);
    this.menuColorWrap.innerHTML = def.palette.map((color) => `
      <button data-paint="${color}" style="background:${color}" class="${color === paint ? 'is-active' : ''}" aria-label="${color}"></button>
    `).join('') + `<span>PAINT / 车漆</span>`;
    // Garage card active
    $$('.car-card', this.garageList).forEach((c) => c.classList.toggle('is-active', c.dataset.car === def.id));

    // Garage detail
    $('garage-brand').textContent = def.brand;
    $('garage-name').textContent = def.name;
    $('garage-class').textContent = def.className;
    $('garage-desc').textContent = def.description;
    const statRows = [
      ['极速', def.stats.speed, `${def.topSpeed} km/h`],
      ['操控', def.stats.grip, `${def.stats.grip} / 100`],
      ['加速', def.stats.accel, `${def.accelTime.toFixed(1)} s`],
      ['制动', def.stats.brake, `${def.stats.brake} / 100`],
    ];
    $('garage-stats').innerHTML = statRows.map(([label, val, text]) => `
      <div class="garage-stat"><span>${label}</span><i><b style="width:${val}%"></b></i><em>${text}</em></div>
    `).join('');
    this.garageColorWrap.innerHTML = `<span>车漆</span>` + def.palette.map((color) => `
      <button data-paint="${color}" style="background:${color}" class="${color === paint ? 'is-active' : ''}" aria-label="${color}"></button>
    `).join('');
    this.settings.selectedCar = def.id;
    this.settings.paint = paint;
    this.updateStanceUI();
    this.saveSettings();
  }

  /** 车体比例滑杆：只作用于当前这台车（同款 AI 车一起变），设置按车型持久保存。 */
  bindStance() {
    const wrap = $('garage-stance');
    if (!wrap) return;
    const styleOf = () => this.selectedDef.model?.style || 'gt3';
    const apply = (next) => {
      const style = styleOf();
      setBodyStance(style, next);
      this.settings.stance = { ...(this.settings.stance || {}), [style]: getBodyStance(style) };
      this.saveSettings();
      if (this.hero?.style === style) applyBodyStance(this.hero.glbBody, style);
      if (this.race) {
        for (const r of this.race.racers) {
          if (r.car?.style === style) applyBodyStance(r.car.glbBody, style);
        }
      }
      this.updateStanceUI();
    };
    wrap.addEventListener('input', (e) => {
      const key = e.target?.dataset?.stance;
      if (!key) return;
      const v = clamp(parseFloat(e.target.value) || 1, 0.8, 1.4);
      apply({ ...getBodyStance(styleOf()), [key]: v });
    });
    wrap.addEventListener('click', (e) => {
      if (!e.target.closest('[data-stance-reset]')) return;
      apply({ l: 1, w: 1, h: 1 });
    });
  }

  updateStanceUI() {
    const wrap = $('garage-stance');
    if (!wrap) return;
    const style = this.selectedDef.model?.style || 'gt3';
    const stance = getBodyStance(style);
    const name = $('stance-car');
    if (name) name.textContent = this.selectedDef.name;
    for (const key of ['h', 'l', 'w']) {
      const input = wrap.querySelector(`[data-stance="${key}"]`);
      const label = wrap.querySelector(`[data-stance-val="${key}"]`);
      if (input) input.value = String(stance[key]);
      if (label) label.textContent = stance[key].toFixed(2);
    }
  }

  /** 菜单里的赛道文案 / 里程 / 弯数都跟着当前布局走。 */
  updateTrackUI() {
    const layout = trackLayout(this.settings.track);
    if (!layout) return;
    const eyebrow = $('menu-track-eyebrow');
    if (eyebrow) eyebrow.textContent = `${layout.en} · 官方演示`;
    const name = $('menu-track-name');
    if (name) name.textContent = layout.name;
    const en = $('menu-track-en');
    if (en) en.textContent = layout.en;
    const mapName = $('minimap-name');
    if (mapName) mapName.textContent = layout.en;
    const pauseTrack = $('pause-track');
    if (pauseTrack) pauseTrack.textContent = layout.en;
    const note = $('menu-track-note');
    if (note) note.innerHTML = `${layout.note}。<br />四视图重建 GT 赛车，真实光影，六车同场竞速。`;
    document.title = `APEX CITY · 极速都市 — ${layout.name}`;
    $$('[data-track]').forEach((btn) => {
      const def = TRACK_LAYOUTS[btn.dataset.track];
      const small = btn.querySelector('small');
      if (def?.km && small) small.textContent = `${def.km.toFixed(2)} KM`;
      btn.classList.toggle('is-active', btn.dataset.track === this.settings.track);
    });
    // 用中心线曲率数一下弯道，避免写死「13 CORNERS」
    let corners = 0;
    let inCorner = false;
    for (const s of this.track.samples) {
      const tight = Math.abs(s.curvature) > 0.0045;
      if (tight && !inCorner) corners++;
      inCorner = tight;
    }
    const cornerEl = $('stat-corners');
    if (cornerEl) cornerEl.textContent = `${corners} CORNERS`;
  }

  updateMenuUI() {
    this.buildGarage();
    this.updateCarSelectUI();
    this.updateTrackUI();
    $('stat-length').innerHTML = `${(this.track.totalLength / 1000).toFixed(2)}<em>KM</em>`;
    $('menu-best').textContent = formatTime(this.bestLap);
    $$('.mode-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.mode === this.mode));
    const modeMeta = {
      gp: ['开始比赛', 'START ENGINE'],
      tt: ['开始计时', 'TIME ATTACK'],
      free: ['自由驾驶', 'FREE DRIVE'],
    }[this.mode];
    const label = $('btn-start').querySelector('.btn-label');
    label.querySelector('b').textContent = modeMeta[0];
    label.querySelector('small').textContent = modeMeta[1];
    this.updateModeUI();
  }

  updateModeUI() {
    const mode = MODES[this.mode];
    if (this.race && this.state === 'racing') return;
  }

  updateSettingsUI() {
    $$('[data-setting="quality"] button').forEach((b) => b.classList.toggle('is-active', b.dataset.value === this.settings.quality));
    $$('[data-setting="camera"] button').forEach((b) => b.classList.toggle('is-active', b.dataset.value === this.settings.camera));
    $$('[data-track]').forEach((b) => b.classList.toggle('is-active', b.dataset.track === this.settings.track));
    $$('[data-toggle]').forEach((b) => {
      const key = b.dataset.toggle;
      b.classList.toggle('is-on', !!this.settings[key]);
    });
    $('volume').value = this.settings.volume;
    $('volume-val').textContent = String(this.settings.volume);
    $('pad-sensitivity').value = this.settings.padSensitivity;
    $('pad-sensitivity-val').textContent = String(this.settings.padSensitivity);
    $('pad-deadzone').value = this.settings.padDeadzone;
    $('pad-deadzone-val').textContent = String(this.settings.padDeadzone);
    this.updatePadStatus();
    this.perf.classList.toggle('is-visible', !!this.settings.fps);
  }

  applySettings(initial = false) {
    this.updateSettingsUI();
    this.applyToggles();
    if (initial) {
      this.applyQuality();
      this.audio.setVolume(this.settings.volume / 100);
    } else {
      this.applyQuality();
      this.audio.setVolume(this.settings.volume / 100);
    }
  }

  applyToggles() {
    document.body.classList.toggle('motion-off', !this.settings.motion);
    this.perf.classList.toggle('is-visible', !!this.settings.fps);
    this.audio.setMuted(!this.settings.sound);
    this.applyInputTuning();
  }

  /** 把设置里的手柄/转向参数灌进输入层。 */
  applyInputTuning() {
    this.input?.setTuning({
      sensitivity: this.settings.padSensitivity / 100,
      deadzone: this.settings.padDeadzone / 100,
      invertStick: this.settings.padInvert,
      rumble: this.settings.rumble,
    });
  }

  updatePadStatus() {
    const el = $('pad-status');
    if (!el) return;
    const on = this.input?.padConnected;
    el.textContent = on
      ? `已连接 · ${(this.input.padId || 'GAMEPAD').slice(0, 46)}`
      : '未检测到手柄 · 连接后自动识别';
    el.style.color = on ? 'var(--green)' : '';
  }

  applyQuality() {
    const quality = this.settings.quality;
    this.env.applyQuality(quality);
    this.postfx.setMood(this.environment?.theme?.id || 'city');
    this.postfx.setQuality(quality);
    this.resize();
  }

  resize() {
    if (!this.renderer) return;
    const dpr = this.settings.quality === 'high'
      ? Math.min(window.devicePixelRatio || 1, 1.6)
      : this.settings.quality === 'medium'
        ? Math.min(window.devicePixelRatio || 1, 1.2)
        : 1;
    this.postfx.setSize(window.innerWidth, window.innerHeight, dpr);
    this.effects?.resize();
    this.minimap.width = 0; // force minimap resize next draw
  }

  /** 展厅机位：海边主题挑朝向大海的一段，其它主题用环线 2/3 处。 */
  menuPose() {
    if (this.env?.theme?.id === 'coast') {
      let best = null;
      let bestScore = -Infinity;
      for (const s of this.track.samples) {
        // 海边主题的机位在车尾方向，越过车顶看海：挑朝向大海的一段
        const score = s.tangent.z + s.position.z / 500;
        if (score > bestScore) { bestScore = score; best = s; }
      }
      return { position: best.position, right: best.right, yaw: best.yaw, tangent: best.tangent };
    }
    return this.track.getPoseAt(900);
  }

  createHero() {
    if (this.hero) {
      this.scene.remove(this.hero.root);
      this.hero = null;
    }
    const def = this.selectedDef;
    const paint = this.selectedPaint;
    this.hero = new CarModel(def, paint, { isPlayer: true, quality: 'high' });
    const pose = this.menuPose();
    this.hero.root.position.copy(pose.position).addScaledVector(pose.right, 0.4);
    this.hero.root.rotation.y = pose.yaw;
    this.hero.root.visible = true;
    // 展厅里的车不吃建筑/树木的投影，否则停在哪段赛道上都可能整台车压黑。
    // 车本身仍然投射阴影，落地关系不变。
    this.hero.root.traverse((o) => {
      if (o.isMesh) o.receiveShadow = false;
    });
    this.applyShowroomMaterials(paint);
    this.scene.add(this.hero.root);
    this.heroDef = def.id;
    this.heroPaint = paint;
    this.heroPose = pose;
    this.heroBaseYaw = pose.yaw;
  }

  /** 棚拍环境贴图：只给展厅主角车用，避免车漆去反射暗街和建筑阴影。 */
  buildShowroomEnv() {
    if (this.showroomEnv) return this.showroomEnv;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.showroomEnv = pmrem.fromScene(room, 0.04).texture;
    pmrem.dispose();
    room.dispose?.();
    return this.showroomEnv;
  }

  /**
   * 展厅车漆提亮：换一套明亮的棚拍反射环境，并按车漆明度补一点反照率。
   * 深色车多加、白色车少加，避免白车糊成一片。
   */
  applyShowroomMaterials(paintHex) {
    const body = this.hero?.glbBody;
    if (!body) return;
    const env = this.buildShowroomEnv();
    const paint = new THREE.Color(paintHex);
    const lum = paint.r * 0.2126 + paint.g * 0.7152 + paint.b * 0.0722;
    const lightPaint = lum > 0.4;
    const night = this.env?.theme?.id === 'market';
    let boost = clamp(1.85 - lum * 0.9, 1.08, 1.85);
    // 夜街本身有泛光，棚拍反射再拉满会把车头烧成一团白光
    if (night) boost = Math.max(1, boost * 0.85);
    body.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mat of mats) {
        if (!mat) continue;
        mat.envMap = env;
        mat.envMapIntensity = night ? (lightPaint ? 0.4 : 0.55) : lightPaint ? 0.72 : 1.2;
        if (mat.color) mat.color.setRGB(1, 1, 1).multiplyScalar(boost);
        if (mat.clearcoat != null) {
          mat.clearcoat = Math.max(mat.clearcoat, 0.9);
          mat.clearcoatRoughness = Math.min(mat.clearcoatRoughness ?? 0.08, 0.04);
        }
        mat.needsUpdate = true;
      }
    });
  }

  selectCar(id) {
    if (!CARS.some((c) => c.id === id)) return;
    const def = CARS.find((c) => c.id === id);
    this.settings.selectedCar = id;
    this.settings.paint = def.paint;
    this.saveSettings();
    this.createHero();
    this.updateMenuUI();
  }

  setPaint(color) {
    const def = this.selectedDef;
    if (!def.palette.includes(color)) return;
    this.settings.paint = color;
    this.saveSettings();
    if (this.hero && this.heroDef === def.id) {
      this.hero.setPaint(color);
      this.applyShowroomMaterials(color);
      this.heroPaint = color;
    } else {
      this.createHero();
    }
    this.updateCarSelectUI();
  }

  navigate(dest) {
    if (this.state === 'racing' || this.state === 'paused' || this.state === 'photo' || this.state === 'map') return;
    this.state = dest;
    Object.entries(this.screens).forEach(([name, el]) => {
      if (!el) return;
      el.classList.toggle('is-active', name === dest);
    });
    this.hud.classList.remove('is-active');
    this.countdownEl.classList.remove('is-active');
    this.photoHint.classList.remove('is-active');
    document.body.classList.remove('is-photo');
    if (this.hero) this.hero.root.visible = dest === 'menu' || dest === 'garage';
    $$('.nav-link').forEach((b) => b.classList.toggle('is-current', b.dataset.nav === dest));
    // reset camera when coming back from a paused/results state
    this.raceCameraPositioned = false;
    this.updateMenuUI();
  }

  handleAction(action) {
    switch (action) {
      case 'start': this.startRace(); break;
      case 'resume': this.resumeRace(); break;
      case 'restart': this.restartRace(); break;
      case 'garage':
        this.quitRace();
        this.navigate('garage');
        break;
      case 'quit':
        this.quitRace();
        this.navigate('menu');
        break;
      case 'again': this.restartRace(); break;
      case 'photo': this.enterPhoto(); break;
      default: break;
    }
  }

  startRace() {
    if (this.state !== 'menu') return;
    this.audio.init();
    this.audio.setMuted(!this.settings.sound);
    this.audio.setVolume(this.settings.volume / 100);
    this.audio.startEngine();
    this.createRace();
    this.race.begin();
    this.state = 'racing';
    this.raceIntro = 0;
    this.raceCameraPositioned = false;
    this.hud.classList.add('is-active');
    this.hud.classList.toggle('is-free', this.mode === 'free');
    this.hud.classList.toggle('is-timeattack', this.mode === 'tt');
    this.screens.menu.classList.remove('is-active');
    this.screens.garage.classList.remove('is-active');
    this.screens.settings.classList.remove('is-active');
    this.screens.help.classList.remove('is-active');
    this.screens.pause.classList.remove('is-active');
    this.screens.results.classList.remove('is-active');
    if (this.hero) this.hero.root.visible = false;
    document.body.classList.add('is-racing');
    document.body.classList.remove('is-photo');
    this.photoHint.classList.remove('is-active');
    this.input.setActive(true);
    this.showCountdown();
    this.hudCache = {};
    this.lastHudUpdate = 0;
    this.updateSettingsUI();
  }

  createRace() {
    if (this.race) {
      this.race.dispose();
      this.race = null;
    }
    const callbacks = {
      onCountdown: (payload) => this.onCountdown(payload),
      onCountdownBeep: (stage) => {
        const freq = stage === '1' ? 780 : 600;
        this.audio.beep(freq, 0.1, 0.08);
      },
      onGo: () => {
        this.audio.beep(980, 0.22, 0.12);
        this.raceIntro = 0.6;
        clearTimeout(this.countdownHideTimer);
        this.countdownHideTimer = setTimeout(() => {
          this.countdownEl.classList.remove('is-active');
        }, 1100);
      },
      onLap: (data) => this.onLap(data),
      onImpact: (strength) => this.onImpact(strength),
      onPlayerFinish: () => {
        this.audio.beep(760, 0.25, 0.1);
      },
      onFinish: (results) => this.showResults(results),
      onPause: () => {},
    };
    this.race = new Race({
      scene: this.scene,
      track: this.track,
      effects: this.effects,
      audio: this.audio,
      mode: this.mode,
      carDef: this.selectedDef,
      paint: this.selectedPaint,
      night: this.env?.theme?.id === 'market',
      callbacks,
    });
    this.raceIntro = 0;
    this.raceCameraPositioned = false;
  }

  showCountdown() {
    this.countdownEl.classList.add('is-active');
    this.countdownText.textContent = 'READY';
    this.countdownText.classList.remove('is-go');
    this.countdownLights.forEach((l) => { l.classList.remove('is-on', 'is-green'); });
  }

  onCountdown(payload) {
    if (!payload) return;
    const { lights = 0, display = 'READY', go = false } = payload;
    this.countdownEl.classList.add('is-active');
    this.countdownText.textContent = display;
    this.countdownText.classList.toggle('is-go', go);
    if (go) {
      this.countdownLights.forEach((l) => { l.classList.remove('is-on'); l.classList.add('is-green'); });
    } else {
      this.countdownLights.forEach((l, i) => {
        l.classList.remove('is-green');
        l.classList.toggle('is-on', i < lights);
      });
    }
    // restart pop animation
    this.countdownText.style.animation = 'none';
    void this.countdownText.offsetWidth;
    this.countdownText.style.animation = '';
  }

  onLap(data) {
    const { lap, time, totalLaps, best } = data;
    const isFinal = lap >= totalLaps;
    this.setToast(
      isFinal ? 'FINAL LAP COMPLETE' : `LAP ${lap} / ${totalLaps} COMPLETE`,
      formatTime(time),
      best ? 'PERSONAL BEST · 个人最快圈' : 'LAP TIME',
      3.2,
    );
    if (time < this.bestLap) {
      this.bestLap = time;
      this.saveBestLap(time);
      $('menu-best').textContent = formatTime(time);
    }
    this.audio.beep(best ? 760 : 560, 0.12, 0.07);
  }

  setToast(kicker, title, sub, duration = 2.8) {
    this.toastKicker.textContent = kicker;
    this.toastTitle.textContent = title;
    this.toastSub.textContent = sub;
    this.toast.classList.add('is-visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.classList.remove('is-visible'), duration * 1000);
  }

  onImpact(strength) {
    if (strength < 0.12) return;
    document.body.classList.add('is-impact');
    clearTimeout(this.impactTimer);
    this.impactTimer = setTimeout(() => document.body.classList.remove('is-impact'), 110);
    if (navigator.vibrate) navigator.vibrate(Math.min(40, 12 + strength * 22));
  }

  pauseRace() {
    if (!this.race || this.state !== 'racing') return;
    if (!['running', 'free', 'countdown', 'finishing'].includes(this.race.phase)) return;
    this.race.setPaused(true);
    this.state = 'paused';
    this.audio.setPaused(true);
    document.body.classList.remove('is-racing');
    this.screens.pause.classList.add('is-active');
    $('pause-mode').textContent = `${MODES[this.mode].en} · LAP ${this.hudCache.lap || 1}/${MODES[this.mode].laps || '∞'}`;
    this.input.setActive(false);
  }

  resumeRace() {
    if (this.state !== 'paused' || !this.race) return;
    this.race.setPaused(false);
    this.state = 'racing';
    this.audio.setPaused(false);
    this.audio.startEngine();
    document.body.classList.add('is-racing');
    this.screens.pause.classList.remove('is-active');
    this.input.setActive(true);
  }

  restartRace() {
    if (!this.race) {
      this.startRace();
      return;
    }
    this.screens.pause.classList.remove('is-active');
    this.screens.results.classList.remove('is-active');
    this.countdownEl.classList.remove('is-active');
    this.setToast('', '', '', 0.01);
    this.toast.classList.remove('is-visible');
    this.state = 'racing';
    this.audio.setPaused(false);
    this.audio.startEngine();
    this.race.begin();
    this.hud.classList.add('is-active');
    this.hud.classList.toggle('is-free', this.mode === 'free');
    this.hud.classList.toggle('is-timeattack', this.mode === 'tt');
    this.raceIntro = 0;
    this.raceCameraPositioned = false;
    document.body.classList.add('is-racing');
    document.body.classList.remove('is-photo');
    this.screens.results.classList.remove('is-active');
    this.photoHint.classList.remove('is-active');
    if (this.hero) this.hero.root.visible = false;
    this.input.setActive(true);
    this.showCountdown();
    this.hudCache = {};
    this.lastHudUpdate = 0;
  }

  quitRace() {
    if (this.race) {
      this.race.dispose();
      this.race = null;
    }
    this.state = 'menu';
    this.audio.stopEngine();
    this.audio.setPaused(false);
    this.hud.classList.remove('is-active');
    this.countdownEl.classList.remove('is-active');
    this.screens.pause.classList.remove('is-active');
    this.screens.results.classList.remove('is-active');
    this.photoHint.classList.remove('is-active');
    this.hud.classList.remove('is-free', 'is-timeattack');
    document.body.classList.remove('is-racing', 'is-photo', 'is-boosting');
    this.input.setActive(false);
    if (this.hero) this.hero.root.visible = true;
    this.raceCameraPositioned = false;
    this.updateMenuUI();
  }

  showResults(results) {
    if (!this.race) return;
    this.state = 'results';
    this.results = results;
    this.hud.classList.remove('is-active');
    document.body.classList.remove('is-racing');
    this.input.setActive(false);
    this.audio.stopEngine();
    this.audio.setPaused(false);
    if (results.bestLap < this.bestLap) {
      this.bestLap = results.bestLap;
      this.saveBestLap(results.bestLap);
      $('menu-best').textContent = formatTime(this.bestLap);
    }
    const titles = results.mode.id === 'tt'
      ? ['计时结束', 'TIME ATTACK']
      : results.position === 1 ? ['冠军', 'CHAMPION']
        : results.position <= 3 ? ['登上领奖台', 'PODIUM FINISH']
          : ['比赛结束', 'CHEQUERED FLAG'];
    $('results-title').innerHTML = `${titles[0]}<br /><span>${titles[1]}</span>`;
    $('result-pos').textContent = `P${results.position}`;
    $('result-time').textContent = formatTime(results.totalTime);
    $('result-best').textContent = formatTime(results.bestLap);
    const winner = results.classification[0];
    $('results-table').innerHTML = results.classification.map((entry) => {
      let gap = '—';
      if (entry.position === 1) gap = formatTime(entry.time ?? results.totalTime);
      else if (entry.finished && entry.time != null && winner?.time != null) gap = `+${Math.max(0, entry.time - winner.time).toFixed(3)}`;
      else gap = `+${Math.max(0.1, entry.gap).toFixed(1)}s`;
      return `
        <div class="result-row ${entry.isPlayer ? 'is-player' : ''}">
          <span class="result-pos">${String(entry.position).padStart(2, '0')}</span>
          <span class="result-driver"><em style="background:${entry.color}"></em><span>${safeName(entry.name)}<small>${entry.isPlayer ? 'YOU · PLAYER' : 'AI · ' + safeName(entry.def.brand)}</small></span></span>
          <span class="result-car">${safeName(entry.def.name)}</span>
          <span class="result-time">${gap}</span>
          <span class="result-best">${formatTime(entry.bestLap)}</span>
        </div>`;
    }).join('');
    this.screens.results.classList.add('is-active');
    this.resultsAngle = 0;
    this.updateMenuUI();
  }

  enterPhoto() {
    if (!this.race || !this.race.player) return;
    this.state = 'photo';
    this.screens.results.classList.remove('is-active');
    this.hud.classList.remove('is-active');
    document.body.classList.add('is-photo');
    document.body.classList.remove('is-racing');
    this.photoHint.classList.add('is-active');
    const p = this.race.player.position;
    this.photoTarget.set(p.x, p.y + 0.62, p.z);
    const dx = this.camera.position.x - this.photoTarget.x;
    const dz = this.camera.position.z - this.photoTarget.z;
    this.photo.angle = Math.atan2(dx, dz);
    this.photo.dist = clamp(Math.hypot(dx, dz), 4.5, 11);
    this.photo.pitch = 0.25;
    this.audio.click();
  }

  exitPhoto() {
    if (this.state !== 'photo') return;
    this.state = 'results';
    this.photoHint.classList.remove('is-active');
    document.body.classList.remove('is-photo');
    this.screens.results.classList.add('is-active');
  }

  bindPhoto() {
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.state !== 'photo') return;
      this.photoDragging = true;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture?.(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.state !== 'photo' || !this.photoDragging) return;
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.photo.angle -= dx * 0.005;
      this.photo.pitch = clamp(this.photo.pitch + dy * 0.0035, 0.06, 1.15);
    });
    window.addEventListener('pointerup', () => { this.photoDragging = false; });
    this.canvas.addEventListener('wheel', (e) => {
      if (this.state !== 'photo') return;
      e.preventDefault();
      this.photo.dist = clamp(this.photo.dist + Math.sign(e.deltaY) * 0.7, 3.5, 14);
    }, { passive: false });
  }

  /** 展厅（菜单/车库）里拖动鼠标旋转车身：横向转本体，纵向抬降机位，松手带惯性。 */
  bindHeroOrbit() {
    const orbitable = () => this.state === 'menu' || this.state === 'garage';
    // UI 覆盖层在 canvas 之上，所以监听 window，再排除掉真正的控件
    const blocked = 'button, a, input, select, .garage-list, .garage-detail, .nav-link';
    window.addEventListener('pointerdown', (e) => {
      if (!orbitable()) return;
      if (e.pointerType === 'touch') return; // 触屏保留滚动
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target instanceof Element && e.target.closest(blocked)) return;
      this.heroDragging = true;
      this.heroSpinVel = 0;
      this.lastPointer = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.heroDragging || !orbitable()) return;
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.heroSpin += dx * 0.011;
      this.heroSpinVel = dx * 0.19;
      // 向上拖 = 抬高机位俯视，向下拖 = 贴地仰视
      this.heroLift = clamp(this.heroLift - dy * 0.008, -0.85, 1.45);
    });
    const release = () => {
      if (!this.heroDragging) return;
      this.heroDragging = false;
      // 松手后惯性滑行，很快停在原位
      if (Math.abs(this.heroSpinVel) > 3) this.heroSpinVel = Math.sign(this.heroSpinVel) * 3;
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
  }

  beginRaceFromResults() {
    this.restartRace();
  }

  update(dt) {
    this.time += dt;
    this.input.update(dt);
    if (this.state === 'racing' && this.race) {
      this.race.update(dt, this.input.input);
      this.updateHaptics();
      this.updateAudio();
      this.updateHud(dt);
      this.updateBoost();
    } else if (this.state === 'paused') {
      this.updateAudioPaused();
    }
    this.updateCamera(dt);
    this.scenery.update(dt, this.time);
    this.trackside?.update(dt, this.time);
    this.environment.update(dt, this.getFocusPoint());
    this.effects.update(dt);
    const speed = this.race && (this.state === 'racing' || this.state === 'paused' || this.state === 'results')
      ? this.race.playerSpeed * 3.6 : 0;
    this.postfx.update(dt, speed, this.boostActive);
    this.updatePerf(dt);
    this.input.endFrame();
  }
  render() {
    this.postfx.render();
  }

  getFocusPoint() {
    if (this.state === 'map') return this.mapFocus;
    if (this.race && (this.state === 'racing' || this.state === 'paused' || this.state === 'results' || this.state === 'photo')) {
      return this.race.player.position;
    }
    if (this.hero) return this.hero.root.position;
    return new THREE.Vector3();
  }

  updateAudio() {
    if (!this.race) return;
    const p = this.race.player;
    this.audio.updateCar({
      speed: p.speed,
      rpm: p.rpm,
      throttle: p.throttle,
      brake: p.brake,
      slip: p.slip,
      boosting: this.boostActive,
    });
  }

  updateAudioPaused() {
    if (!this.race) return;
    const p = this.race.player;
    this.audio.updateCar({ speed: 0, rpm: p.rpm * 0.5, throttle: 0, brake: 1, slip: 0 });
  }

  updateBoost() {
    if (!this.race) return;
    const p = this.race.player;
    const active = this.input.nitro && p.nitro > 0.5 && this.race.phase === 'running';
    document.body.classList.toggle('is-boosting', active);
    if (active && !this.prevBoost) this.audio.boost();
    this.prevBoost = active;
    this.boostActive = active;
  }

  updateHud(dt) {
    if (!this.race) return;
    const hud = this.race.getHudState();
    const prev = this.hudCache || {};
    this.hudCache = hud;
    const p = this.race.player;
    const isFree = hud.free;
    this.hud.classList.toggle('is-free', isFree);
    this.hud.classList.toggle('is-timeattack', this.mode === 'tt');

    const speed = Math.round(hud.speed);
    $('hud-speed').textContent = speed;
    $('hud-gear').textContent = hud.gear;
    $('hud-throttle').textContent = `THROTTLE ${String(Math.round((p.throttle || 0) * 100)).padStart(3, '0')}%`;

    const nitro = clamp(hud.nitro, 0, 100);
    $('nitro-fill').style.width = `${nitro}%`;
    $('nitro-pct').textContent = `${Math.round(nitro)}%`;
    $('nitro-fill').classList.toggle('is-firing', this.boostActive);
    $('drift-panel').classList.toggle('is-active', hud.slip > 0.3 && hud.speed > 20);
    $('drift-score').textContent = String(Math.round(hud.driftScore)).padStart(3, '0');
    $('hud-race-time').textContent = formatTime(hud.raceTime);
    $('hud-lap-time').textContent = formatTime(hud.lapTime);
    $('hud-pos').textContent = `P${hud.position}`;
    $('hud-pos-total').textContent = `/ ${hud.totalRacers}`;
    $('hud-lap').textContent = String(hud.lap || 1).padStart(2, '0');
    $('hud-lap').parentElement.querySelector('span').textContent = `/ ${String(hud.totalLaps || 0).padStart(2, '0')}`;
    const mapLap = isFree ? 'FREE DRIVE' : `LAP ${hud.lap || 1} / ${hud.totalLaps}`;
    $('map-lap').textContent = mapLap;

    // RPM lights
    const lit = Math.round(hud.rpm * this.rpmSegments.length);
    if (!prev.lit || prev.lit !== lit) {
      this.rpmSegments.forEach((el, i) => el.classList.toggle('is-lit', i < lit));
    }
    // Show the benchmark rather than a fake live delta against a completed lap.
    const deltaEl = $('delta-line');
    if (Number.isFinite(hud.bestLap)) {
      deltaEl.classList.add('is-best');
      deltaEl.classList.remove('is-slow');
      deltaEl.innerHTML = `<span>BEST ${formatTime(hud.bestLap)}</span>`;
    } else {
      deltaEl.innerHTML = '<span>BEST --:--.---</span>';
      deltaEl.classList.remove('is-slow', 'is-best');
    }

    this.lastHudUpdate += dt;
    this.mapUpdate += dt;
    this.standingsUpdate += dt;
    if (this.mapUpdate > 0.055) {
      this.mapUpdate = 0;
      this.drawMinimap(hud);
    }
    if (this.standingsUpdate > 0.25 && !isFree) {
      this.standingsUpdate = 0;
      this.updateStandings(hud);
    }
  }

  updateStandings(hud) {
    const standings = hud.standings || [];
    $('standings').innerHTML = standings.slice(0, 6).map((s) => `
      <div class="standing-row ${s.isPlayer ? 'is-player' : ''}">
        <span class="standing-pos">${s.position}</span>
        <span class="standing-name"><em style="background:${s.color}"></em>${safeName(s.name)}</span>
        <span class="standing-gap">${s.position === 1 ? 'LEADER' : `+${(s.gap || 0).toFixed(1)}`}</span>
      </div>
    `).join('');
  }

  drawMinimap(hud) {
    const canvas = this.minimap;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = this.mapCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    const pad = Math.min(rect.width, rect.height) * 0.13;
    const bw = this.track.mapBounds;
    const worldW = bw.maxX - bw.minX;
    const worldH = bw.maxZ - bw.minZ;
    const scale = Math.min((rect.width - pad * 2) / worldW, (rect.height - pad * 2) / worldH);
    const ox = (rect.width - worldW * scale) / 2 - bw.minX * scale;
    const oy = (rect.height - worldH * scale) / 2 - bw.minZ * scale;
    const px = (x) => ox + x * scale;
    const py = (z) => oy + z * scale;

    // route underlay
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    this.track.mapPoints.forEach((p, i) => {
      const x = ox + (bw.minX + p.x * worldW) * scale;
      const y = oy + (bw.minZ + p.y * worldH) * scale;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(8, 7, 5, 0.75)';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(233, 226, 213, 0.7)';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // start/finish tick
    const start = this.track.samples[0];
    if (start) {
      ctx.save();
      ctx.translate(px(start.position.x), py(start.position.z));
      ctx.rotate(-start.yaw);
      ctx.fillStyle = '#f3ecdf';
      ctx.fillRect(-4, -1.1, 8, 2.2);
      ctx.fillStyle = '#ff5a1f';
      ctx.fillRect(-4, -2.4, 8, 1.2);
      ctx.restore();
    }

    const cars = this.race?.getMinimapCars() || [];
    for (const car of cars) {
      const x = px(car.x);
      const y = py(car.z);
      if (car.isPlayer) {
        ctx.save();
        ctx.translate(x, y);
        const angle = Math.atan2(Math.cos(car.yaw), Math.sin(car.yaw));
        ctx.rotate(angle);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ff5a1f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(8, 0); ctx.lineTo(-5, 5); ctx.lineTo(-2.4, 0); ctx.lineTo(-5, -5);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = car.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    void hud;
  }

  updatePerf(dt) {
    this.fpsFrames++;
    this.fpsTimer += dt;
    if (this.fpsTimer > 0.5) {
      this.fpsValue = Math.round(this.fpsFrames / this.fpsTimer);
      this.fpsFrames = 0;
      this.fpsTimer = 0;
      if (this.settings.fps) {
        this.perfFps.textContent = String(this.fpsValue);
        this.perfDraw.textContent = String(this.renderer.info.render.calls);
      }
    }
  }

  /** 三个视角循环：远追尾 → 近追尾 → 引擎盖。 */
  cycleCamera() {
    if (this.state !== 'racing') return;
    const order = ['chase', 'near', 'hood'];
    const i = order.indexOf(this.settings.camera);
    this.settings.camera = order[(i + 1) % order.length];
    this.saveSettings();
    this.updateSettingsUI();
    this.raceCameraPositioned = false;
  }

  /** 手柄震动：氮气起步、碰撞、路肩。 */
  updateHaptics() {
    if (!this.race || this.state !== 'racing') return;
    const boosting = Boolean(this.race.player?.boosting);
    if (boosting && !this._wasBoosting) this.input.rumble(0.3, 220);
    this._wasBoosting = boosting;
    const shake = this.race.cameraShake || 0;
    if (shake > 0.14 && shake > (this._lastShake || 0) + 0.04) {
      this.input.rumble(Math.min(0.75, shake * 1.4), 120);
    }
    this._lastShake = shake;
  }

  updateCamera(dt) {
    const motion = this.settings.motion;
    const rt = this.race;
    // 展厅可拖动时给抓手光标
    const orbitable = this.state === 'menu' || this.state === 'garage';
    const wantCursor = orbitable ? (this.heroDragging ? 'grabbing' : 'grab') : '';
    if (this._cursor !== wantCursor) {
      this._cursor = wantCursor;
      document.body.style.cursor = wantCursor;
    }
    if (this.state === 'map') {
      this.updateMapCamera(dt);
      return;
    }
    if (this.state === 'menu' || this.state === 'garage' || this.state === 'settings' || this.state === 'help') {
      this.updateMenuCamera(dt);
      return;
    }
    if (this.state === 'photo') {
      this.updatePhotoCamera(dt);
      return;
    }
    if (this.state === 'results') {
      this.updateResultsCamera(dt);
      return;
    }
    if (!rt) { this.updateMenuCamera(dt); return; }
    if (this.state === 'paused') return;

    const p = rt.player;
    if (!p) return;
    const forward = this.tempVec.set(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const pos = p.position;
    const speedN = clamp(p.speed / 90, 0, 1);
    let desiredPos = new THREE.Vector3();
    let look = new THREE.Vector3();
    let fov = 55;
    // 竖屏手机画面很窄：把机位拉远、视场放大，否则车会占掉半个屏幕
    const aspect = this.camera.aspect || 1.6;
    const portrait = clamp((0.95 - aspect) / 0.45, 0, 1);

    // 视角：0=远追尾 1=近追尾 2=引擎盖（对应设置里的三个选项）
    const viewKey = this.settings.camera === 'hood' ? 2 : this.settings.camera === 'near' ? 1 : 0;
    const pitchIn = this.input.pitch || 0;
    if (pitchIn) {
      const lo = viewKey === 2 ? -0.15 : -0.18;
      const hi = viewKey === 2 ? 0.15 : 0.72;
      this.cameraPitch[viewKey] = clamp(this.cameraPitch[viewKey] + pitchIn * 0.36 * dt, lo, hi);
    }
    const pitch = this.cameraPitch[viewKey];
    const boost = this.boostActive ? 1 : 0;
    const PIVOT_Y = 0.55;
    // 视场变宽时按比例拉近，避免高速时车明显变小
    const dollyFor = (baseFov, fovNow) =>
      Math.tan((baseFov * Math.PI) / 360) / Math.tan((fovNow * Math.PI) / 360);

    const countdown = rt.phase === 'countdown' || (rt.phase === 'running' && rt.raceTime < 0.6);
    if (countdown) {
      const angle = 0.38;
      const swing = (6.4 + speedN * 1.2) * (1 + portrait * 0.3);
      desiredPos.copy(pos)
        .addScaledVector(forward, Math.cos(angle) * swing)
        .addScaledVector(right, -Math.sin(angle) * swing)
        .add(new THREE.Vector3(0, 2.25 + portrait * 0.35, 0));
      look.copy(pos).addScaledVector(forward, 1.5).add(new THREE.Vector3(0, 0.68, 0));
      fov = 44 + portrait * 8;
    } else if (viewKey === 2) {
      const pitchLift = Math.tan(pitch) * 24;
      desiredPos.copy(pos).addScaledVector(forward, 0.5).add(new THREE.Vector3(0, 1.2, 0)).addScaledVector(right, p.steer * -0.045);
      look.copy(pos).addScaledVector(forward, 26).add(new THREE.Vector3(0, 1.12 + pitchLift, 0));
      fov = 72 + speedN * 6 + boost * 10 + portrait * 12;
    } else {
      const near = viewKey === 1;
      const baseFov = near ? 70 : 64;
      fov = baseFov + speedN * (near ? 0 : 5) + boost * 10 + portrait * 10;
      const dolly = dollyFor(baseFov, fov);
      const dist = ((near ? 4.2 : 6.6) + speedN * (near ? 0.5 : 1.1)) * dolly * (1 + portrait * 0.34);
      const height = (near ? 1.45 : 1.58) + speedN * 0.12;
      // 绕车辆俯仰：以车身为轴旋转，俯仰时车始终留在画面里
      const radius = Math.hypot(dist, height - PIVOT_Y);
      const phi = Math.atan2(height - PIVOT_Y, dist) + pitch;
      const back = Math.cos(phi) * radius;
      const up = PIVOT_Y + Math.sin(phi) * radius;
      const driftCam = clamp(p.lateralSpeed * (near ? 0.012 : 0.021), -0.4, 0.4);
      desiredPos.copy(pos).addScaledVector(forward, -back).addScaledVector(right, driftCam).add(new THREE.Vector3(0, up, 0));
      look.copy(pos)
        .addScaledVector(forward, near ? 3.4 + speedN * 5 : 4.8 + speedN * 8.2)
        .add(new THREE.Vector3(0, (near ? 1.06 : 1.0) - speedN * 0.06, 0));
    }

    const posLambda = countdown ? 4.2 : 7.5;
    const lookLambda = countdown ? 5 : 9;
    // 平滑做在「相对车身的偏移」上，而不是世界坐标：
    // 否则高速时目标每秒移动几十米，lerp 会稳定落后 v/k 米，车越跑越远、越看越小。
    desiredPos.sub(pos);
    look.sub(pos);
    if (!this.raceCameraPositioned) {
      this.cameraOffset.copy(desiredPos);
      this.cameraLookOffset.copy(look);
      this.raceCameraPositioned = true;
    } else {
      this.cameraOffset.lerp(desiredPos, 1 - Math.exp(-posLambda * dt));
      this.cameraLookOffset.lerp(look, 1 - Math.exp(-lookLambda * dt));
    }
    this.camera.position.copy(pos).add(this.cameraOffset);
    this.cameraLook.copy(pos).add(this.cameraLookOffset);

    let shakeX = 0, shakeY = 0;
    if (motion) {
      const shake = rt.cameraShake * 0.08 + Math.max(0, speedN - 0.75) * 0.012 + rt.rumble * 0.012 + boost * 0.008;
      shakeX = (Math.random() - 0.5) * shake;
      shakeY = (Math.random() - 0.5) * shake;
    }
    this.camera.position.x += shakeX;
    this.camera.position.y += shakeY;
    this.camera.lookAt(this.cameraLook);
    this.camera.fov = damp(this.camera.fov, fov, 4, dt);
    this.camera.updateProjectionMatrix();
  }

  updateMenuCamera(dt) {
    if (!this.hero) return;
    // 拖动惯性：松手后继续转一小段再停
    if (!this.heroDragging) {
      this.heroSpin += this.heroSpinVel * dt;
      this.heroSpinVel *= Math.exp(-3.6 * dt);
      if (Math.abs(this.heroSpinVel) < 0.012) this.heroSpinVel = 0;
    }
    this.hero.root.rotation.y = this.heroBaseYaw + this.heroSpin;
    const carPos = this.hero.root.position;
    const yaw = this.heroBaseYaw;
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const inGarage = this.state === 'garage';
    const inSubPanel = this.state === 'settings' || this.state === 'help';
    const narrow = window.innerWidth < 900;
    // 海边主菜单把机位挪到车尾，越过车顶就是大海
    const coastMenu = !inGarage && !inSubPanel && this.env?.theme?.id === 'coast';
    const theta = (inGarage ? 0.74 : coastMenu ? 2.95 : 0.55) + Math.sin(this.time * 0.065) * 0.05;
    const dist = narrow ? (inGarage ? 16.2 : 16.8) : inGarage ? 8.6 : inSubPanel ? 9.8 : 7.9;
    const baseHeight = narrow
      ? (inGarage ? 3.5 : coastMenu ? 5.4 : 3.2)
      : inGarage ? 1.85 : inSubPanel ? 3.2 : coastMenu ? 4.5 : 1.95;
    const lift = this.state === 'menu' || inGarage ? this.heroLift : 0;
    const height = Math.max(0.55, baseHeight + lift);
    const lookOffset = new THREE.Vector3(0, 0.62, 0).addScaledVector(forward, 0.4);
    if (inGarage) lookOffset.addScaledVector(right, 0.2);
    const target = carPos.clone().add(lookOffset);
    const desired = carPos.clone()
      .addScaledVector(forward, Math.cos(theta) * dist)
      .addScaledVector(right, -Math.sin(theta) * dist)
      .add(new THREE.Vector3(0, height, 0));
    // Shift the car toward the right third of the frame, leaving the
    // editorial menu copy on the left clean.
    const viewDir = target.clone().sub(desired).normalize();
    const camRight = viewDir.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    target.addScaledVector(camRight, narrow ? 0 : inGarage ? -0.1 : -0.05);
    if (!this.menuCameraInit || this.stateChanged) {
      this.camera.position.copy(desired);
      this.cameraLook.copy(target);
      this.menuCameraInit = true;
      this.stateChanged = false;
    } else {
      this.camera.position.lerp(desired, 1 - Math.exp(-3.2 * dt));
      this.cameraLook.lerp(target, 1 - Math.exp(-4 * dt));
    }
    this.camera.lookAt(this.cameraLook);
    const fov = narrow ? 38 : inGarage ? 34 : inSubPanel ? 42 : 38;
    this.camera.fov = damp(this.camera.fov, fov, 3, dt);
    this.camera.updateProjectionMatrix();
    // Idle car showcase
    this.hero.updateVisual(dt, { speed: 0, steer: 0, braking: false, throttle: 0, yawRate: 0, slip: 0 });
  }

  updateResultsCamera(dt) {
    if (!this.race) return;
    const p = this.race.player;
    const target = this.tempVec.set(p.position.x, 0.85, p.position.z);
    this.resultsAngle += dt * 0.065;
    const dist = 8.2;
    const desired = new THREE.Vector3(
      p.position.x + Math.sin(this.resultsAngle) * dist,
      2.75,
      p.position.z + Math.cos(this.resultsAngle) * dist,
    );
    this.camera.position.lerp(desired, 1 - Math.exp(-1.8 * dt));
    this.cameraLook.lerp(target, 1 - Math.exp(-2.4 * dt));
    this.camera.lookAt(this.cameraLook);
    this.camera.fov = damp(this.camera.fov, 41, 2, dt);
    this.camera.updateProjectionMatrix();
  }

  updatePhotoCamera(dt) {
    if (!this.race) return;
    const p = this.race.player;
    this.photoTarget.set(p.position.x, 0.62, p.position.z);
    const cp = Math.cos(this.photo.pitch) * this.photo.dist;
    const desired = new THREE.Vector3(
      this.photoTarget.x + Math.sin(this.photo.angle) * cp,
      this.photoTarget.y + Math.sin(this.photo.pitch) * this.photo.dist + 0.25,
      this.photoTarget.z + Math.cos(this.photo.angle) * cp,
    );
    this.camera.position.lerp(desired, 1 - Math.exp(-7 * dt));
    this.cameraLook.lerp(this.photoTarget, 1 - Math.exp(-9 * dt));
    this.camera.lookAt(this.cameraLook);
    this.camera.fov = damp(this.camera.fov, 42, 2, dt);
    this.camera.updateProjectionMatrix();
    this.race.player.car.updateVisual(dt, { speed: 0, steer: 0, braking: false, throttle: 0, yawRate: 0, slip: 0 });
    this.photoDragging = this.photoDragging;
  }

  finishLoading() {
    const loading = this.screens.loading;
    loading.classList.remove('is-active');
    if (this.mapPreviewId && this.mapPreviewId === trackLayout().id) {
      this.enterMapView(this.mapPreviewId);
      return;
    }
    setTimeout(() => {
      this.state = 'menu';
      this.screens.menu.classList.add('is-active');
      this.menuCameraInit = false;
      this.updateMenuUI();
    }, 450);
  }

  tick(dt) {
    this.update(dt);
    this.render();
  }
}
