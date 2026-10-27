const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  p.on('pageerror', e => console.log('ERR', e.message));
  p.on('console', m => { if (m.type() === 'log') console.log('[log]', m.text().slice(0, 160)); });
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(2000);
  await p.evaluate(() => {
    const g = window.__game;
    g.player.position.set(0, 0, 8);
    g.cam.yaw = 0; g.cam.pitch = 0.42; g.cam.distance = 15; g.cam.intro = 0;
    window.__forceInput = { forward: 0, strafe: 0, run: false, speedScale: 0, dirX: 0, dirZ: 0 };
    const bd = g.builder;
    const orig = bd.place.bind(bd);
    bd.place = function () {
      console.log('PLACE valid=' + this.valid + ' vis=' + (this.ghost && this.ghost.visible) + ' pos=' + (this.ghost ? this.ghost.position.toArray().map(n=>n.toFixed(1)) : ''));
      return orig();
    };
    ['pointerdown', 'pointerup', 'pointercancel'].forEach((t) => {
      document.addEventListener(t, (e) => console.log(t + ' ' + Math.round(e.clientX) + ',' + Math.round(e.clientY) + ' target=' + (e.target.id || e.target.className)), true);
    });
  });
  await p.waitForTimeout(200);
  await p.tap('.act[data-act="build"]');
  await p.waitForTimeout(300);
  await p.tap('.build-item[data-piece="House_3"]');
  await p.waitForTimeout(300);
  await p.touchscreen.tap(195, 640);
  await p.waitForTimeout(600);
  console.log('final', JSON.stringify(await p.evaluate(() => ({ rects: window.__game.town.mapRects.length }))));
  await b.close();
})();
