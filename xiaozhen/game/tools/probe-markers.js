const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', '..', 'shots');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 760, height: 700 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(1400);

  const out = await p.evaluate(() => {
    const g = window.__game, T = g.THREE, pl = g.player;
    pl.position.set(0, 0, 12);
    pl.heading = 0;
    pl.model.updateMatrixWorld(true);
    const hand = pl.rig.hand_r.bone;
    const find = (n) => pl.model.getObjectByName(n) || pl.model.getObjectByName(n.replace(/\./g, ''));
    const pos = (o) => { const v = new T.Vector3(); o.getWorldPosition(v); return v; };
    const wrist = pos(hand);
    const idx = find('Index1.R');
    const mid = find('Middle1.R');
    const finger = pos(idx);
    const palm = wrist.clone().lerp(finger, 0.55);

    const mk = (v, color, r = 0.016) => {
      const m = new T.Mesh(new T.SphereGeometry(r, 8, 6), new T.MeshBasicMaterial({ color, depthTest: false }));
      m.position.copy(v); m.renderOrder = 999; m.frustumCulled = false;
      g.scene.add(m); return m;
    };
    mk(wrist, 0xff2222);
    mk(palm, 0x22ff44);
    mk(pos(mid), 0x2266ff, 0.012);

    pl.equip('sword');
    pl.model.updateMatrixWorld(true);
    mk(pos(pl.weapon), 0xffcc00, 0.02);

    g.cam.yaw = Math.PI * 0.42; g.cam.pitch = 0.03; g.cam.distance = 4.6; g.cam.intro = 0;
    return {
      modelScale: +pl.model.scale.x.toFixed(3),
      wrist: wrist.toArray().map(n => +n.toFixed(3)),
      finger: finger.toArray().map(n => +n.toFixed(3)),
      palm: palm.toArray().map(n => +n.toFixed(3)),
      grip: pos(pl.weapon).toArray().map(n => +n.toFixed(3)),
    };
  });
  console.log(JSON.stringify(out));
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(OUT, 'm-hand.png') });

  // 换个角度（正面）
  await p.evaluate(() => { const g = window.__game; g.cam.yaw = 0; g.cam.pitch = 0.02; g.cam.distance = 4.2; });
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(OUT, 'm-hand-front.png') });
  await b.close();
})();
