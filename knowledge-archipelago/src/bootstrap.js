/**
 * 移动端自动横屏引导层。
 *
 * 很多手机浏览器（尤其 iOS Safari 与内嵌 WebView）不允许网页调用
 * Screen Orientation Lock。与其在竖屏上盖一层“请把手机横过来”，
 * 不如把整个游戏装进一个固定横向尺寸的 iframe，再在竖屏中把该
 * 横向视口旋转铺满屏幕：
 *
 *   - 竖屏：iframe 为 844 × 390 的横屏视口，外层旋转 90° 填满屏幕；
 *   - 横屏：iframe 保持同样的横屏尺寸，不再旋转。
 *
 * 这样游戏内部的 CSS 媒体查询、触摸坐标和相机取景始终按横屏工作，
 * 不需要用户点击任何提示，也不会出现“请旋转手机”的遮罩。
 */

const FRAME_PARAM = 'landscape-frame';
const NO_SHELL_PARAM = 'no-shell';

const params = new URLSearchParams(window.location.search);
const root = document.documentElement;
const isLandscapeFrame = params.get(FRAME_PARAM) === '1';
const shellDisabled = params.has(NO_SHELL_PARAM);
const pendingShell = root.classList.contains('landscape-shell-pending');

function isPhoneSizedTouchDevice() {
  const touch = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  if (!touch) return false;
  const shortSide = Math.min(
    window.innerWidth || window.screen?.width || 0,
    window.innerHeight || window.screen?.height || 0,
  );
  return shortSide > 0 && shortSide <= 820;
}

function loadGame() {
  root.classList.remove('landscape-shell-pending');
  import('./main.js').catch((error) => {
    console.error('[知屿] 启动模块加载失败', error);
    const fatal = document.getElementById('fatal-error');
    if (fatal) {
      fatal.classList.remove('is-hidden');
      fatal.innerHTML = '<p>海图没有展开。请刷新页面再试一次。</p>';
    }
  });
}

function mountLandscapeShell() {
  root.classList.remove('landscape-shell-pending');
  root.classList.add('landscape-shell');

  const style = document.createElement('style');
  style.id = 'zhiyu-landscape-shell-style';
  style.textContent = `
    html.landscape-shell,
    html.landscape-shell body {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #06181a;
      overscroll-behavior: none;
    }
    html.landscape-shell #app {
      display: none !important;
    }
    #zhiyu-landscape-frame {
      position: fixed;
      z-index: 2147483647;
      display: block;
      border: 0;
      background: #06181a;
      box-shadow: none;
      color-scheme: dark;
      will-change: transform;
    }
    @media (orientation: portrait) {
      #zhiyu-landscape-frame {
        top: 0;
        left: 100vw;
        left: 100dvw;
        width: 100vh;
        width: 100dvh;
        height: 100vw;
        height: 100dvw;
        transform: rotate(90deg);
        transform-origin: top left;
      }
    }
    @media (orientation: landscape) {
      #zhiyu-landscape-frame {
        inset: 0;
        width: 100vw;
        width: 100dvw;
        height: 100vh;
        height: 100dvh;
        transform: none;
      }
    }
  `;
  document.head.appendChild(style);

  const frame = document.createElement('iframe');
  frame.id = 'zhiyu-landscape-frame';
  frame.title = '知屿 · 知识群岛';
  frame.setAttribute('allow', 'autoplay; fullscreen; gamepad; accelerometer; gyroscope');
  frame.setAttribute('referrerpolicy', 'same-origin');

  const frameUrl = new URL(window.location.href);
  frameUrl.searchParams.set(FRAME_PARAM, '1');
  frameUrl.searchParams.delete(NO_SHELL_PARAM);
  frame.src = frameUrl.toString();

  // 支持的浏览器（主要是 Android Chrome）可以在用户点“进入群岛”的同一手势里
  // 请求原生全屏 + 横屏锁定，让设备真正转到横屏；不支持时保持旋转容器兜底。
  // 不论成功与否，都不显示任何“请旋转手机”的提示。
  let nativeAttempted = false;
  const tryNativeLandscape = (event) => {
    if (nativeAttempted) return;
    if (!matchMedia('(orientation: portrait)').matches) return;
    if (!event.target?.closest?.('[data-title-start], [data-title-continue]')) return;
    if (typeof screen.orientation?.lock !== 'function') return;
    nativeAttempted = true;
    try {
      const fullscreenRequest = document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
      if (fullscreenRequest?.then) {
        fullscreenRequest
          .then(() => screen.orientation.lock('landscape'))
          .catch(() => {});
      } else {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } catch {
      // 原生转屏不可用：iframe 依然是横向布局，不需要提示用户。
    }
  };

  frame.addEventListener('load', () => {
    root.classList.add('landscape-shell-ready');
    document.getElementById('zhiyu-landscape-loader')?.remove();
    try {
      frame.contentDocument?.addEventListener('pointerdown', tryNativeLandscape, {
        capture: true,
        passive: true,
      });
    } catch {
      // 同源 iframe 正常可用；若被浏览器隔离则只使用旋转容器。
    }
  });

  // 极短的启动占位，避免 iframe 首帧出现之前露出竖屏 DOM。
  const loader = document.createElement('div');
  loader.id = 'zhiyu-landscape-loader';
  loader.setAttribute('aria-hidden', 'true');
  loader.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:#06181a;';
  document.body.appendChild(loader);
  document.body.appendChild(frame);
}

if (isLandscapeFrame || shellDisabled) {
  loadGame();
} else if (root.classList.contains('landscape-shell-pending') || isPhoneSizedTouchDevice()) {
  mountLandscapeShell();
} else {
  loadGame();
}
