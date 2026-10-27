const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', '..', 'shots');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 620 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 200)); });
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(1500);

  const info = await p.evaluate(() => {
    const g = window.__game;
    let meshes = 0, tris = 0;
    g.town.root.traverse(o => {
      if (o.isMesh) {
        meshes++;
        const geo = o.geometry;
        tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
      }
    });
    return { townMeshes: meshes, townTris: Math.round(tris), calls: g.renderer.info.render.calls,
             colliders: g.town.colliders.length };
  });
  console.log(JSON.stringify(info));

  const views = [['aerial', 0.85, 0.30, 42, -2], ['street', 0.1, 0.12, 16, -0.4], ['plaza', 2.2, 0.16, 14, -0.3]];
  for (const [nm, yaw, pitch, dist, off] of views) {
    await p.evaluate(({ yaw, pitch, dist, off }) => {
      const g = window.__game;
      g.player.position.set(0, 0, 6);
      g.cam.yaw = yaw; g.cam.pitch = pitch; g.cam.distance = dist; g.cam.intro = 0;
      g.cam.targetOffset = off;
      window.__forceInput = { forward: 0, strafe: 0, run: false, speedScale: 0, dirX: 0, dirZ: 0 };
    }, { yaw, pitch, dist, off });
    await p.waitForTimeout(700);
    await p.screenshot({ path: path.join(OUT, `vt-${nm}.png`) });
  }
  console.log('ok');
  await b.close();
})();
