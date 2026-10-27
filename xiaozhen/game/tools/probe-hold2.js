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
    g.cam.yaw = -Math.PI * 0.5; g.cam.pitch = 0.0; g.cam.distance = 3.0; g.cam.intro = 0;
  });

  for (const [name, kind] of [['k0', null], ['k1-sword', 'sword'], ['k2-gun', 'gun']]) {
    await p.evaluate((k) => window.__game.player.equip(k), kind);
    await p.waitForTimeout(650);
    await p.screenshot({ path: path.join(OUT, `${name}-right.png`) });
  }

  // 蹲姿：右侧、目标下移看脚
  await p.evaluate(() => {
    const g = window.__game;
    const T = g.THREE;
    g.player.equip(null);
    g.player.setCrouch(true);
    g.cam.yaw = -Math.PI * 0.5; g.cam.pitch = 0.05; g.cam.distance = 2.9;
  });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(OUT, 'k3-crouch-right.png') });

  // 近距离看脚（把相机目标临时压低：改玩家位置为负高度，用 cam.target 覆盖）
  await p.evaluate(() => {
    const g = window.__game;
    const legTarget = () => { g.cam.target.y = 0.55; };
    window.__legCam = setInterval(legTarget, 30);
    g.cam.distance = 1.6; g.cam.pitch = -0.05;
  });
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(OUT, 'k4-feet.png') });
  await p.evaluate(() => clearInterval(window.__legCam));
  console.log('ok');
  await b.close();
})();
