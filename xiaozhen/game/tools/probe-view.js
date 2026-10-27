// 通用取景探针：node probe-view.js out.png kind yaw pitch distance targetOffset [crouch]
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', '..', 'shots');
const [outName, kind, yaw, pitch, dist, off, crouch] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 660, height: 660 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(1300);
  await p.evaluate(({ kind, yaw, pitch, dist, off, crouch }) => {
    const g = window.__game;
    g.player.position.set(0, 0, 12);
    g.player.heading = 0;
    window.__forceInput = { forward: 0, strafe: 0, run: false, speedScale: 0, dirX: 0, dirZ: 0 };
    g.cam.yaw = yaw; g.cam.pitch = pitch; g.cam.distance = dist; g.cam.intro = 0;
    g.cam.targetOffset = off;
    if (kind !== 'none') g.player.equip(kind === 'sword' ? 'sword' : 'gun');
    if (crouch === '1') g.player.setCrouch(true);
  }, { kind, yaw: +yaw, pitch: +pitch, dist: +dist, off: +off, crouch });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(OUT, outName) });
  console.log('shot', outName);
  await b.close();
})();
