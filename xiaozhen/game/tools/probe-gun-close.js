const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', '..', 'shots');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 620, height: 620 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(1300);

  // 跑动中（3/4 近景）
  await p.evaluate(() => {
    const g = window.__game;
    g.player.position.set(0, 0, 12);
    g.player.heading = 0;
    g.cam.yaw = 0.9; g.cam.pitch = 0.05; g.cam.distance = 2.2; g.cam.intro = 0;
    g.cam.targetOffset = -0.25;
    g.player.equip('gun');
    window.__forceInput = { forward: 1, strafe: 0, run: true, speedScale: 1, dirX: 0, dirZ: 1 };
  });
  await p.waitForTimeout(1300);
  await p.screenshot({ path: path.join(OUT, 'gc-run.png') });

  // 站定（待机姿势）
  await p.evaluate(() => {
    window.__forceInput = { forward: 0, strafe: 0, run: false, speedScale: 0, dirX: 0, dirZ: 0 };
    const g = window.__game;
    g.cam.yaw = 0.9; g.cam.distance = 2.2;
  });
  await p.waitForTimeout(1600);
  await p.screenshot({ path: path.join(OUT, 'gc-idle.png') });

  const st = await p.evaluate(() => {
    const pl = window.__game.player;
    return { move: +pl.move.toFixed(2), idle: pl.clipIdle?.getClip().name };
  });
  console.log(JSON.stringify(st));
  await b.close();
})();
