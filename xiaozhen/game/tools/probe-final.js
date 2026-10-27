const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', '..', 'shots');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 780, height: 640 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(1400);
  await p.evaluate(() => {
    const g = window.__game;
    g.player.position.set(0, 0, 12);
    g.player.heading = 0;
    g.cam.yaw = 0; g.cam.pitch = 0.05; g.cam.distance = 2.6; g.cam.intro = 0;
    window.__forceInput = { forward: 0, strafe: 0, run: false, speedScale: 0, dirX: 0, dirZ: 0 };
  });
  await p.evaluate(() => { window.__game.player.equip('sword'); });
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(OUT, 'demo-sword.png') });
  await p.evaluate(() => { window.__game.player.equip('gun'); });
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(OUT, 'demo-gun.png') });
  await p.evaluate(() => { window.__game.player.equip('sword'); window.__game.player.setCrouch(true); });
  await p.waitForTimeout(1000);
  await p.screenshot({ path: path.join(OUT, 'demo-crouch.png') });
  console.log('ok');
  await b.close();
})();
