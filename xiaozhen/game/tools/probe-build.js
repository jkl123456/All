const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', '..', 'shots');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 660 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 160)); });
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(1500);

  await p.evaluate(() => {
    const g = window.__game;
    g.player.position.set(0, 0, 6);
    g.cam.yaw = 0; g.cam.pitch = 0.42; g.cam.distance = 17; g.cam.intro = 0;
    window.__forceInput = { forward: 0, strafe: 0, run: false, speedScale: 0, dirX: 0, dirZ: 0 };
  });
  await p.waitForTimeout(600);

  // 打开建造面板
  await p.click('.act[data-act="build"]');
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(OUT, 'bd1-panel.png') });

  // 选“民房·一”
  await p.click('.build-item[data-piece="House_1"]');
  await p.waitForTimeout(300);

  // 把鼠标移到广场空地上，出现预览
  await p.mouse.move(450, 330);
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(OUT, 'bd2-ghost.png') });

  const before = await p.evaluate(() => ({ colliders: window.__game.town.colliders.length, houses: window.__game.town.mapRects.length }));
  await p.mouse.down();
  await p.mouse.up();
  await p.waitForTimeout(600);

  const after = await p.evaluate(() => ({
    colliders: window.__game.town.colliders.length,
    houses: window.__game.town.mapRects.length,
    barVisible: !document.getElementById('build-bar').hidden,
    name: document.getElementById('build-name').textContent,
  }));
  console.log('before', JSON.stringify(before), 'after', JSON.stringify(after));
  await p.screenshot({ path: path.join(OUT, 'bd3-placed.png') });

  // 旋转再放一栋
  await p.keyboard.press('KeyR');
  await p.mouse.move(560, 300);
  await p.waitForTimeout(300);
  await p.mouse.down();
  await p.mouse.up();
  await p.waitForTimeout(500);
  const after2 = await p.evaluate(() => ({ colliders: window.__game.town.colliders.length }));
  console.log('after2', JSON.stringify(after2));
  await p.screenshot({ path: path.join(OUT, 'bd4-two.png') });

  // 拖一下视角验证不会误放
  await p.mouse.move(300, 300);
  await p.mouse.down();
  await p.mouse.move(360, 310);
  await p.mouse.up();
  await p.waitForTimeout(300);
  const after3 = await p.evaluate(() => ({ colliders: window.__game.town.colliders.length }));
  console.log('after3(drag)', JSON.stringify(after3));
  await b.close();
})();
