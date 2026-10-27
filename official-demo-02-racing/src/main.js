import * as THREE from 'three';
import { createTextureLibrary } from './textures.js';
import { Environment, setCoastShift } from './environment.js';
import { Track } from './track.js';
import { City } from './city.js';
import { Biome } from './biomes.js';
import { Scenery } from './scenery.js';
import { Trackside } from './trackside.js';
import { Effects } from './effects.js';
import { AudioSystem } from './audio.js';
import { Input } from './input.js';
import { PostFX } from './post.js';
import { Game } from './game.js';
import { savedTrackId, setTrackLayout } from './config.js';
import { preloadCarModels } from './carasset.js';

const $ = (id) => document.getElementById(id);
const wait = (ms = 24) => new Promise((resolve) => setTimeout(resolve, ms));
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

function setProgress(pct, label) {
  const bar = $('load-bar');
  const num = $('load-pct');
  const step = $('load-step');
  if (bar) bar.style.width = `${pct}%`;
  if (num) num.textContent = String(Math.round(pct)).padStart(2, '0');
  if (step && label) step.textContent = label;
}

function showError(message) {
  const error = $('webgl-error');
  if (error) {
    error.classList.add('is-visible');
    const p = error.querySelector('p');
    if (p && message) p.textContent = message;
  }
  const loading = $('screen-loading');
  if (loading) loading.classList.remove('is-active');
}

async function boot() {
  try {
    if (!('WebGL2RenderingContext' in window)) {
      showError('当前浏览器不支持 WebGL 2。请使用最新版 Chrome、Edge 或 Safari，并开启硬件加速。');
      return;
    }
    // 先在造场景之前确定赛道布局：城市、护栏、发车点都依赖它
    const layout = setTrackLayout(savedTrackId());
    const theme = layout.theme || 'city';
    // 海边主题：把海岸线整体拉近，赛道边就能看到沙滩和海
    setCoastShift(theme === 'coast' ? -140 : 0);

    const canvas = $('scene');
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.info.autoReset = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x241b16);
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.2, 22000);
    camera.position.set(0, 2, 0);

    setProgress(3, '初始化实时渲染引擎');
    await nextFrame();

    setProgress(10, '生成程序化材质与城市纹理');
    await nextFrame();
    const textures = createTextureLibrary();
    await wait(20);

    setProgress(24, '点亮赛道所在的天空');
    await nextFrame();
    const environment = new Environment(renderer, scene, textures, theme);
    await wait(20);

    setProgress(38, `铺设${layout.name}赛道`);
    await nextFrame();
    const track = new Track(textures, scene);
    await wait(20);

    setProgress(58, '生成周边环境');
    await nextFrame();
    const city = theme === 'city' || theme === 'harbor' || theme === 'market' || theme === 'port'
      ? new City(scene, textures, track)
      : null;
    const biome = new Biome(scene, textures, track, theme);
    await wait(20);

    setProgress(72, '布置路边设施与远处风景');
    await nextFrame();
    const scenery = new Scenery(scene, textures, track, city);
    await wait(20);

    setProgress(78, '搭建看台、马修站与维修区');
    await nextFrame();
    const trackside = new Trackside(scene, textures, track);
    await wait(20);

    setProgress(83, '装配高细节赛车与粒子系统');
    await nextFrame();
    const effects = new Effects(scene, camera, textures);
    const audio = new AudioSystem();
    const input = new Input();
    const postfx = new PostFX(renderer, scene, camera, 'high');
    await wait(20);

    setProgress(88, '载入四视图重建的高精度车体');
    await nextFrame();
    const glbCars = await preloadCarModels((p) => setProgress(88 + p * 4, '载入四视图重建的高精度车体'));
    if (glbCars === 0) {
      setProgress(93, '车体模型未加载 · 使用程序化车身');
      console.warn('[APEX CITY] 未载入 GLB 车体，使用程序化车身');
    }

    setProgress(97, '编译光影与电影级后期');
    await nextFrame();
    const game = new Game({
      renderer, scene, camera, textures, environment, env: environment, track, city, biome, scenery,
      trackside, effects, audio, input, postfx,
    });
    game.renderer = renderer;
    game.resize();
    await wait(60);

    setProgress(100, '准备发车');
    await nextFrame();
    game.finishLoading();

    let last = performance.now();
    let elapsed = 0;
    function frame(now) {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      elapsed += dt;
      try {
        game.tick(dt);
      } catch (err) {
        console.error('[APEX CITY] runtime error', err);
        if (elapsed < 2) {
          showError(`引擎启动失败：${err?.message || err}`);
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      showError('WebGL 上下文已丢失，请刷新页面重新开始。');
    });
  } catch (err) {
    console.error('[APEX CITY] boot error', err);
    showError(`无法初始化 3D 场景：${err?.message || err}`);
  }
}

boot();
