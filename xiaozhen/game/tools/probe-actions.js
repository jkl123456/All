const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', '..', 'shots');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 700 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(1500);

  const clips = await p.evaluate(() => Object.keys(window.__game.player.actions));
  console.log('clips', clips.length, clips.join(','));
  console.log('loco', await p.evaluate(() => ({
    idle: !!window.__game.player.clipIdle, walk: !!window.__game.player.clipWalk, run: !!window.__game.player.clipRun,
    walkSpeed: +window.__game.player.walkSpeed.toFixed(2), runSpeed: +window.__game.player.runSpeed.toFixed(2),
    height: +window.__game.player.modelHeight?.toFixed?.(2),
  })));

  await p.evaluate(() => {
    const g = window.__game;
    g.cam.yaw = Math.PI * 0.55; g.cam.pitch = 0.06; g.cam.distance = 3.4; g.cam.intro = 0;
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(OUT, 'a0-idle.png') });

  for (const [name, act] of [['a1-punch','punch'], ['a2-slash','slash'], ['a3-wave','wave'], ['a4-roll','roll'], ['a5-kick','kick']]) {
    await p.evaluate((a) => window.__triggerAction(a), act);
    await p.waitForTimeout(320);
    await p.screenshot({ path: path.join(OUT, `${name}.png`) });
    await p.waitForTimeout(1400);
  }

  // 跳跃：抓腾空最高点
  const jump = await p.evaluate(async () => {
    const g = window.__game;
    const pl = g.player;
    pl.jump();
    await new Promise(r => setTimeout(r, 320));
    return { y: +pl.jumpY.toFixed(2), onGround: pl.onGround };
  });
  await p.screenshot({ path: path.join(OUT, 'a6-jump.png') });
  console.log('jump', JSON.stringify(jump));
  await b.close();
})();
