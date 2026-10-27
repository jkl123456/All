const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', '..', 'shots');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(2200);
  await p.evaluate(() => {
    const g = window.__game;
    g.player.position.set(0, 0, 8);
    g.cam.yaw = 0; g.cam.pitch = 0.42; g.cam.distance = 15; g.cam.intro = 0;
    window.__forceInput = { forward: 0, strafe: 0, run: false, speedScale: 0, dirX: 0, dirZ: 0 };
  });
  await p.waitForTimeout(400);
  await p.tap('.act[data-act="build"]');
  await p.waitForTimeout(350);
  await p.tap('.build-item[data-piece="House_3"]');
  await p.waitForTimeout(350);
  const before = await p.evaluate(() => ({ rects: window.__game.town.mapRects.length, ghost: !!window.__game.builder.ghost }));
  await p.touchscreen.tap(195, 640);
  await p.waitForTimeout(600);
  const after = await p.evaluate(() => ({
    rects: window.__game.town.mapRects.length,
    ghost: !!window.__game.builder.ghost,
    bar: !document.getElementById('build-bar').hidden,
  }));
  console.log('before', JSON.stringify(before), 'after', JSON.stringify(after));
  await p.screenshot({ path: path.join(OUT, 'bm3-once.png') });
  await b.close();
})();
