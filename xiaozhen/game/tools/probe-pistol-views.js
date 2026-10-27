const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join('H:/minimax/youxi2/xiaozhen', 'shots');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 700, height: 660 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(1400);
  for (const [nm, yaw, dist] of [['front', 0.15, 3.0], ['side', Math.PI * 0.5, 3.0], ['back', Math.PI, 3.0]]) {
    await p.evaluate(({ yaw, dist }) => {
      const g = window.__game;
      g.player.position.set(0, 0, 12);
      g.player.heading = 0;
      g.cam.yaw = yaw; g.cam.pitch = 0.06; g.cam.distance = dist; g.cam.intro = 0;
      g.cam.targetOffset = -0.05;
      g.player.equip('gun');
      window.__forceInput = { forward: 1, strafe: 0, run: true, speedScale: 1, dirX: 0, dirZ: 1 };
    }, { yaw, dist });
    await p.waitForTimeout(1400);
    await p.screenshot({ path: path.join(OUT, `r-${nm}.png`) });
  }
  console.log('ok');
  await b.close();
})();
