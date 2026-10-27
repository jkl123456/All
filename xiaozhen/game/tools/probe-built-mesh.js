const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', '..', 'shots');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 820, height: 620 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(1400);
  const res = await p.evaluate(() => {
    const g = window.__game, T = g.THREE;
    g.player.position.set(0, 0, 8);
    g.cam.yaw = 0; g.cam.pitch = 0.42; g.cam.distance = 17; g.cam.intro = 0;
    window.__forceInput = { forward: 0, strafe: 0, run: false, speedScale: 0, dirX: 0, dirZ: 0 };
    g.builder.select({ piece: 'House_2', name: '民房·二', scale: 1.95 });
    const bd = g.builder;
    // 直接把预览放到空位再建
    return { ok: true };
  });
  await p.waitForTimeout(300);
  const built = await p.evaluate(() => {
    const g = window.__game, T = g.THREE, bd = g.builder;
    bd.ghost.visible = true;
    bd.ghost.position.set(-4, 0.02, -13);
    bd.valid = g.town.canPlace(-4, -13, 4.2, 4.2);
    const before = g.town.root.children.length;
    bd.place();
    // 找新建的网格
    const hits = [];
    g.town.root.traverse((o) => {
      if (!o.isMesh) return;
      const box = new T.Box3().setFromObject(o);
      const c = box.getCenter(new T.Vector3());
      if (Math.abs(c.x + 4) < 4 && Math.abs(c.z + 13) < 4) hits.push({ name: o.name, y: +box.max.y.toFixed(1) });
    });
    return { before, after: g.town.root.children.length, valid: bd.valid, hits: hits.slice(0, 4) };
  });
  console.log(JSON.stringify(built));
  // 正面看
  await p.evaluate(() => {
    const g = window.__game;
    g.player.position.set(-4, 0, -4);
    g.cam.yaw = 0; g.cam.pitch = 0.12; g.cam.distance = 9;
  });
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(OUT, 'bd10-built.png') });
  await b.close();
})();
