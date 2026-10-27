const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', '..', 'shots');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 760, height: 700 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 160)); });
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(1400);

  const setup = await p.evaluate(() => {
    const g = window.__game;
    g.player.position.set(2, 0, 14);
    g.player.heading = Math.PI * 0.85;
    g.cam.yaw = Math.PI * 0.15; g.cam.pitch = 0.08; g.cam.distance = 3.2; g.cam.intro = 0;
    return { weapons: Object.keys(g.player.weapons || {}), hand: !!g.player.rig.hand_r };
  });
  console.log('setup', JSON.stringify(setup));
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(OUT, 'w0-idle.png') });

  // 剑
  await p.evaluate(() => window.__game.player.equip('sword'));
  await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(OUT, 'w1-sword.png') });

  // 枪
  await p.evaluate(() => window.__game.player.equip('gun'));
  await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(OUT, 'w2-gun.png') });

  // 蹲下（拿剑）
  await p.evaluate(() => { window.__game.player.equip('sword'); window.__game.player.setCrouch(true); });
  await p.waitForTimeout(1100);
  await p.screenshot({ path: path.join(OUT, 'w3-crouch.png') });
  const crouch = await p.evaluate(() => ({ w: +window.__game.player.crouchW.toFixed(2), drop: +window.__game.player.crouchDrop.toFixed(2) }));
  console.log('crouch', JSON.stringify(crouch));

  // 蹲着走
  await p.evaluate(() => {
    window.__forceInput = { forward: 1, strafe: 0, run: false, speedScale: 1, dirX: 0, dirZ: 1 };
  });
  await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(OUT, 'w4-crouch-walk.png') });
  const info = await p.evaluate(() => ({
    speed: +Math.hypot(window.__game.player.velocity.x, window.__game.player.velocity.z).toFixed(2),
    walkSpeed: +window.__game.player.walkSpeed.toFixed(2),
    crouchW: +window.__game.player.crouchW.toFixed(2),
  }));
  console.log('walk-crouch', JSON.stringify(info));
  await b.close();
})();
