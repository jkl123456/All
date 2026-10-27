const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 500, height: 400 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(1200);
  const info = await p.evaluate(() => {
    const g = window.__game, T = g.THREE, pl = g.player;
    pl.position.set(0, 0, 12); pl.heading = 0;
    pl.model.updateMatrixWorld(true);
    const get = (n) => { const o = pl.model.getObjectByName(n) || pl.model.getObjectByName(n.replace(/\./g,'')); if(!o) return null; const v = new T.Vector3(); o.getWorldPosition(v); return v; };
    const ankleL = get('Foot.L'), toeL = get('PT.L');
    const head = get('Head'), neck = get('Neck');
    const shoulderL = get('Shoulder.L') || get('Clavicle.L');
    const r = (v) => v ? v.toArray().map(n => +n.toFixed(3)) : null;
    const dir = (a, b2) => a && b2 ? b2.clone().sub(a).normalize().toArray().map(n => +n.toFixed(2)) : null;
    return {
      head: r(head), neck: r(neck), shoulderL: r(shoulderL),
      ankleL: r(ankleL), toeL: r(toeL),
      toeDir: dir(ankleL, toeL),
      leftArmWorldX: shoulderL ? +shoulderL.x.toFixed(2) : null,
      rootQ: pl.root.quaternion.toArray().map(n => +n.toFixed(3)),
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await b.close();
})();
