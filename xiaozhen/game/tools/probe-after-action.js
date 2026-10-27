const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', '..', 'shots');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 700 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(1200);

  await p.evaluate(() => {
    const g = window.__game;
    g.cam.yaw = Math.PI * 0.5; g.cam.pitch = 0.05; g.cam.distance = 4.0; g.cam.intro = 0;
  });

  // 播一个动作
  await p.evaluate(() => window.__triggerAction('punch'));
  await p.waitForTimeout(500);
  const during = await p.evaluate(() => ({
    action: window.__game.player.action && window.__game.player.action.getClip().name,
    w: +window.__game.player.actionW.toFixed(2),
  }));

  // 等动作结束
  await p.waitForTimeout(7000);
  const after = await p.evaluate(() => {
    const pl = window.__game.player;
    return {
      action: pl.action ? pl.action.getClip().name : null,
      actionW: +pl.actionW.toFixed(3),
      playing: pl.actionPlaying,
      idleW: +pl.clipIdle.getEffectiveWeight().toFixed(2),
      walkW: +pl.clipWalk.getEffectiveWeight().toFixed(2),
      runW: pl.clipRun ? +pl.clipRun.getEffectiveWeight().toFixed(2) : null,
    };
  });
  console.log('during', JSON.stringify(during));
  console.log('after ', JSON.stringify(after));

  // 动作结束后立刻走，看步态是否正常
  await p.evaluate(() => {
    window.__forceInput = { forward: 1, strafe: 0, run: false, speedScale: 1, dirX: 0, dirZ: 1 };
  });
  for (let i = 0; i < 4; i++) {
    await p.waitForTimeout(170);
    await p.screenshot({ path: path.join(OUT, `f-walk-${i}.png`) });
  }
  const walking = await p.evaluate(() => {
    const pl = window.__game.player;
    return { idleW: +pl.clipIdle.getEffectiveWeight().toFixed(2), walkW: +pl.clipWalk.getEffectiveWeight().toFixed(2), speed: +Math.hypot(pl.velocity.x, pl.velocity.z).toFixed(2) };
  });
  console.log('walking', JSON.stringify(walking));
  await b.close();
})();
