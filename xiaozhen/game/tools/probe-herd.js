const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', '..', 'shots');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 640 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 200)); });
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(1500);

  const info = await p.evaluate(() => {
    const h = window.__game.herd;
    const byKind = {};
    for (const a of h.animals) byKind[a.spec.file] = (byKind[a.spec.file] || 0) + 1;
    const xs = h.animals.map(a => a.position.x), zs = h.animals.map(a => a.position.z);
    return { total: h.animals.length, byKind,
      spread: { x: [Math.min(...xs).toFixed(1), Math.max(...xs).toFixed(1)], z: [Math.min(...zs).toFixed(1), Math.max(...zs).toFixed(1)] },
      calls: window.__game.renderer.info.render.calls,
      tris: window.__game.renderer.info.render.triangles };
  });
  console.log(JSON.stringify(info));

  // 找一个动物多的方向拍一张
  const spot = await p.evaluate(() => {
    const g = window.__game;
    const a = g.herd.animals[0];
    g.player.position.set(a.position.x, 0, a.position.z + 9);
    a.timer = 30; a.desired = 0; a.state = 'idle'; a.speed = 0;
    g.cam.yaw = 0; g.cam.pitch = 0.2; g.cam.distance = 7; g.cam.intro = 0;
    return a.spec.file;
  });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(OUT, 'h-group.png') });
  console.log('spot', spot);

  // 俯瞰看分布
  await p.evaluate(() => {
    const g = window.__game;
    g.player.position.set(0, 0, 0);
    g.player.model.visible = false;
    g.cam.pitch = 0.72; g.cam.distance = 60; g.cam.yaw = 0.8;
  });
  await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(OUT, 'h-overview.png') });
  console.log('ok');
  await b.close();
})();
