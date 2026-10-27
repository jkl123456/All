const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', '..', 'shots');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 640 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(1400);

  const pos = await p.evaluate(() => {
    const g = window.__game, T = g.THREE, pl = g.player;
    pl.position.set(0, 0, 12); pl.heading = 0;
    window.__forceInput = { forward: 0, strafe: 0, run: false, speedScale: 0, dirX: 0, dirZ: 0 };
    pl.equip('sword');
    pl.model.updateMatrixWorld(true);
    const hand = pl.rig.hand_r.bone;
    const w = new T.Vector3(); hand.getWorldPosition(w);
    const gp = new T.Vector3(); pl.weapon.getWorldPosition(gp);
    const palm = pl.palmLocal();
    // holder 的世界位置应等于掌心世界位置
    const holderWorld = new T.Vector3(); pl.weapon.getWorldPosition(holderWorld);
    // 剑身最靠下/上的一点（用网格包围盒估算）
    const mesh = pl.weapon.children[0];
    const box = new T.Box3().setFromObject(mesh);
    g.cam.targetOffset = -0.55;
    g.cam.yaw = -Math.PI * 0.42; g.cam.pitch = 0.02; g.cam.distance = 1.15;
    return {
      wrist: w.toArray().map(n => +n.toFixed(3)),
      holder: holderWorld.toArray().map(n => +n.toFixed(3)),
      palmLocal: palm.toArray().map(n => +n.toFixed(3)),
      boxMin: box.min.toArray().map(n => +n.toFixed(2)),
      boxMax: box.max.toArray().map(n => +n.toFixed(2)),
    };
  });
  console.log(JSON.stringify(pos, null, 1));
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(OUT, 'z-sword-hand.png') });
  await p.evaluate(() => { window.__game.player.equip('gun'); });
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(OUT, 'z-gun-hand.png') });
  console.log('ok');
  await b.close();
})();
