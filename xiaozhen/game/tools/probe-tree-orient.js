// 逐个物种把模型单独摆到原点，检查朝向是否正确
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', '..', 'shots');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 560, height: 620 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(1200);

  const names = await p.evaluate(() => {
    const g = window.__game;
    g.player.model.visible = false;
    g.herd.animals.forEach(a => { a.root.visible = false; });
    g.town.root.visible = false;
    g.cam.yaw = 0.9; g.cam.pitch = 0.2; g.cam.distance = 16; g.cam.intro = 0;
    return [...new Set(g.forestInfo.root.children.map(c => c.userData.species))];
  });

  for (const name of names) {
    await p.evaluate((nm) => {
      const g = window.__game;
      g.player.position.set(0, 0, 0);
      const m = new g.THREE.Matrix4();
      for (const mesh of g.forestInfo.root.children) {
        const mine = mesh.userData.species === nm;
        mesh.visible = mine;
        if (!mine) continue;
        const sc = mesh.userData.leaf ? 1 : 1;
        m.makeScale(sc, sc, sc);
        mesh.setMatrixAt(0, m);
        mesh.count = 1;
        mesh.instanceMatrix.needsUpdate = true;
      }
      g.cam.distance = 16;
    }, name);
    await p.waitForTimeout(600);
    await p.screenshot({ path: path.join(OUT, `o-${name}.png`) });
    console.log('shot', name);
  }
  await b.close();
})();
