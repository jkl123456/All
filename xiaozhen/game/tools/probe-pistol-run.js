const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', '..', 'shots');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 720, height: 660 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(1400);

  const info = await p.evaluate(() => {
    const g = window.__game;
    g.player.position.set(0, 0, 12);
    g.player.heading = 0;
    g.cam.yaw = -Math.PI * 0.42; g.cam.pitch = 0.05; g.cam.distance = 3.6; g.cam.intro = 0;
    g.cam.targetOffset = -0.15;
    g.player.equip('gun');
    window.__forceInput = { forward: 1, strafe: 0, run: true, speedScale: 1, dirX: 0, dirZ: 1 };
    return {
      hasPistol: !!g.player.clipPistol,
      clips: Object.keys(g.player.actions).length,
      naturalSpeed: g.player.clipPistol?.getClip()?.userData?.naturalSpeed,
    };
  });
  console.log(JSON.stringify(info));
  await p.waitForTimeout(1200);
  for (let i = 0; i < 4; i++) {
    await p.waitForTimeout(110);
    await p.screenshot({ path: path.join(OUT, `p-run-${i}.png`) });
  }
  const st = await p.evaluate(() => {
    const pl = window.__game.player;
    return {
      pistolW: +pl.clipPistol.getEffectiveWeight().toFixed(2),
      walkW: +pl.clipWalk.getEffectiveWeight().toFixed(2),
      idleW: +pl.clipIdle.getEffectiveWeight().toFixed(2),
      speed: +Math.hypot(pl.velocity.x, pl.velocity.z).toFixed(2),
      ts: +pl.clipPistol.getEffectiveTimeScale().toFixed(2),
    };
  });
  console.log('state', JSON.stringify(st));
  await b.close();
})();
