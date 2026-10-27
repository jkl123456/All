import './styles/main.css';
import './styles/xiaozhen-hud.css';
import { Game } from './game/Game.js';

const start = () => {
  const stage = document.getElementById('stage');
  if (!stage) throw new Error('Missing stage element');
  const game = new Game(stage);
  game.boot();
  // 开发期调试入口：控制台可用 window.__ZHIYU__ 检查状态、跳过流程
  if (import.meta.env?.DEV) window.__ZHIYU__ = game;
  window.addEventListener('error', (event) => {
    if (game.mode === 'boot') {
      game.showFatal?.(event.message || '未知的启动错误');
    }
    console.error('[知屿] Runtime error:', event.error || event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[知屿] Unhandled promise rejection:', event.reason);
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
