const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', '..', 'shots');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 700, height: 640 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(1400);

  const geo = await p.evaluate(() => {
    const g = window.__game, T = g.THREE, pl = g.player;
    pl.model.updateMatrixWorld(true);
    const hand = pl.rig.hand_r.bone;
    const wrist = new T.Vector3(); hand.getWorldPosition(wrist);
    const q = new T.Quaternion(); hand.getWorldQuaternion(q);
    const find = (n) => pl.model.getObjectByName(n) || pl.model.getObjectByName(n.replace(/\./g, ''));
    const idx = find('Index1.R'), mid = find('Middle1.R'), pinky = find('Pinky1.R');
    const pos = (o) => { const v = new T.Vector3(); o.getWorldPosition(v); return v; };
    const axes = {};
    for (const [k, v] of Object.entries({ x: [1,0,0], y: [0,1,0], z: [0,0,1] })) {
      axes[k] = new T.Vector3(...v).applyQuaternion(q).toArray().map(n => +n.toFixed(2));
    }
    return {
      modelScale: +pl.model.scale.x.toFixed(4),
      modelHeight: +pl.modelHeight?.toFixed?.(2),
      wristWorld: wrist.toArray().map(n => +n.toFixed(3)),
      indexWorld: idx ? pos(idx).toArray().map(n => +n.toFixed(3)) : null,
      middleWorld: mid ? pos(mid).toArray().map(n => +n.toFixed(3)) : null,
      pinkyWorld: pinky ? pos(pinky).toArray().map(n => +n.toFixed(3)) : null,
      handAxesWorld: axes,
      handLocalFingerY: idx ? +hand.worldToLocal(pos(idx).clone()).y.toFixed(3) : null,
    };
  });
  console.log('GEO', JSON.stringify(geo, null, 1));

  // 从侧后方贴近右手拍
  await p.evaluate(() => {
    const g = window.__game;
    g.player.position.set(0, 0, 12);
    g.player.heading = 0;
    g.cam.yaw = -Math.PI * 0.5; g.cam.pitch = 0.02; g.cam.distance = 1.5; g.cam.intro = 0;
    window.__forceInput = { forward: 0, strafe: 0, run: false, speedScale: 0, dirX: 0, dirZ: 0 };
  });
  await p.evaluate(() => window.__game.player.equip('sword'));
  await p.waitForTimeout(800);
  const info = await p.evaluate(() => {
    const g = window.__game, T = g.THREE, pl = g.player;
    pl.model.updateMatrixWorld(true);
    const w = new T.Vector3(); pl.weapon.getWorldPosition(w);
    const ws = new T.Vector3(); pl.weapon.getWorldScale(ws);
    return { gripWorld: w.toArray().map(n => +n.toFixed(3)), worldScale: ws.toArray().map(n => +n.toFixed(3)),
             holderPos: pl.weapon.position.toArray() };
  });
  console.log('SWORD', JSON.stringify(info));
  await p.screenshot({ path: path.join(OUT, 'r-sword-side.png') });

  await p.evaluate(() => { const g = window.__game; g.player.equip('gun'); });
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(OUT, 'r-gun-side.png') });

  await p.evaluate(() => { const g = window.__game; g.player.equip('sword'); g.player.setCrouch(true); });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(OUT, 'r-crouch-side.png') });
  await p.evaluate(() => { const g = window.__game; g.cam.yaw = 0; g.cam.pitch = 0.05; g.cam.distance = 2.4; });
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(OUT, 'r-crouch-front.png') });
  console.log('ok');
  await b.close();
})();
