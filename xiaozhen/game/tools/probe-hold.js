const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', '..', 'shots');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 700, height: 700 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(1400);

  await p.evaluate(() => {
    const g = window.__game;
    g.player.position.set(0, 0, 12);
    g.player.heading = 0;
    window.__forceInput = { forward: 0, strafe: 0, run: false, speedScale: 0, dirX: 0, dirZ: 0 };
    g.cam.yaw = Math.PI * 0.55; g.cam.pitch = 0.02; g.cam.distance = 3.2; g.cam.intro = 0;
  });

  const shots = [
    ['h0-none', null, null],
    ['h1-sword', 'sword', null],
    ['h2-gun', 'gun', null],
  ];
  for (const [name, kind] of shots) {
    await p.evaluate((k) => { window.__game.player.equip(k); }, kind);
    await p.waitForTimeout(600);
    await p.screenshot({ path: path.join(OUT, `${name}-side.png`) });
  }

  // 正面
  await p.evaluate(() => { const g = window.__game; g.cam.yaw = 0; g.cam.pitch = 0.0; g.cam.distance = 3.0; });
  await p.evaluate(() => window.__game.player.equip('sword'));
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(OUT, 'h1-sword-front.png') });
  await p.evaluate(() => window.__game.player.equip('gun'));
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(OUT, 'h2-gun-front.png') });

  // 枪的四种朝向
  const rots = [['g-a', [Math.PI/2,0,0]], ['g-b', [-Math.PI/2,0,0]], ['g-c', [0,0,Math.PI/2]], ['g-d', [0,0,-Math.PI/2]]];
  for (const [nm, r] of rots) {
    await p.evaluate((rr) => { const pl = window.__game.player; pl.equip('gun'); pl.weapon.rotation.set(rr[0], rr[1], rr[2]); pl.weapon.children[0].position.set(0,0,0); }, r);
    await p.waitForTimeout(450);
    await p.screenshot({ path: path.join(OUT, `h-${nm}.png`) });
  }

  // 蹲下：侧视看脚
  await p.evaluate(() => {
    const g = window.__game;
    g.player.equip('sword');
    g.player.setCrouch(true);
    g.cam.yaw = Math.PI * 0.5; g.cam.pitch = -0.02; g.cam.distance = 3.4;
  });
  await p.waitForTimeout(1400);
  await p.screenshot({ path: path.join(OUT, 'h3-crouch-side.png') });
  await p.evaluate(() => { const g = window.__game; g.cam.yaw = 0; g.cam.pitch = 0.0; g.cam.distance = 3.2; });
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(OUT, 'h3-crouch-front.png') });
  console.log('ok');
  await b.close();
})();
