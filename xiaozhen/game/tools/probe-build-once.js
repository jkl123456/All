const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', '..', 'shots');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 660 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    const g = window.__game;
    g.player.position.set(0, 0, 8);
    g.cam.yaw = 0; g.cam.pitch = 0.42; g.cam.distance = 17; g.cam.intro = 0;
    window.__forceInput = { forward: 0, strafe: 0, run: false, speedScale: 0, dirX: 0, dirZ: 0 };
  });
  await p.waitForTimeout(400);
  await p.click('.act[data-act="build"]');
  await p.waitForTimeout(250);
  await p.click('.build-item[data-piece="House_2"]');
  await p.waitForTimeout(250);

  const pt = await p.evaluate(() => {
    const g = window.__game, T = g.THREE, bd = g.builder;
    const rect = g.renderer.domElement.getBoundingClientRect();
    const toScreen = (x, z) => {
      const v = new T.Vector3(x, 0, z).project(g.camera);
      return { x: rect.left + (v.x * 0.5 + 0.5) * rect.width, y: rect.top + (-v.y * 0.5 + 0.5) * rect.height };
    };
    // 找一个真正能放的点
    for (const [x, z] of [[-4, -13], [4, -13], [0, -16], [10, -3], [-12, 2], [0, 16]]) {
      const p = toScreen(x, z);
      bd.move(p.x, p.y);
      if (bd.valid) return { x: p.x, y: p.y, world: [x, z] };
    }
    const p = toScreen(0, -16);
    return { x: p.x, y: p.y, world: [0, -16] };
  });
  console.log('target', JSON.stringify(pt));
  await p.mouse.move(pt.x, pt.y);
  await p.waitForTimeout(250);
  const before = await p.evaluate(() => ({ ghost: !!window.__game.builder.ghost, bar: !document.getElementById('build-bar').hidden }));
  await p.mouse.down(); await p.mouse.up();
  await p.waitForTimeout(400);
  const after = await p.evaluate(() => ({
    ghost: !!window.__game.builder.ghost, type: window.__game.builder.type,
    bar: !document.getElementById('build-bar').hidden,
    panel: !document.getElementById('build-panel').hidden,
    colliders: window.__game.town.colliders.length,
  }));
  console.log('before', JSON.stringify(before), 'after', JSON.stringify(after));

  // 建完再移动鼠标，确认不再有预览跟着
  await p.mouse.move(pt.x + 120, pt.y + 40);
  await p.waitForTimeout(300);
  const moved = await p.evaluate(() => ({ ghost: !!window.__game.builder.ghost }));
  console.log('after move', JSON.stringify(moved));
  await p.screenshot({ path: path.join(OUT, 'bd9-after-place.png') });
  await b.close();
})();
