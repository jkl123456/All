const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 420, height: 360 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(1200);

  const solve = async (move, barrelWorld) => {
    await p.evaluate((move) => {
      const pl = window.__game.player;
      pl.position.set(0, 0, 12);
      pl.heading = 0;
      pl.root.rotation.y = 0;
      pl.equip('gun');
      window.__forceInput = move
        ? { forward: 1, strafe: 0, run: true, speedScale: 1, dirX: 0, dirZ: 1 }
        : { forward: 0, strafe: 0, run: false, speedScale: 0, dirX: 0, dirZ: 0 };
    }, move);
    await p.waitForTimeout(1300);
    return p.evaluate((barrelWorld) => {
      const g = window.__game, T = g.THREE, pl = g.player;
      pl.model.updateMatrixWorld(true);
      const hand = pl.rig.hand_r.bone;
      const hq = new T.Quaternion(); hand.getWorldQuaternion(hq);

      const barrel = new T.Vector3(...barrelWorld).normalize();
      const z = barrel.clone().negate();                 // 武器 +Z = -枪管
      const y = new T.Vector3(0, 1, 0);
      y.addScaledVector(z, -z.dot(y)).normalize();
      const x = new T.Vector3().crossVectors(y, z).normalize();
      const W = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));

      const L = hq.clone().invert().multiply(W);
      const m = new T.Matrix4().makeRotationFromQuaternion(L).elements;
      // 列优先：第 0 列 = 武器 X 轴在手骨空间的方向
      const col = (i) => [m[i * 4], m[i * 4 + 1], m[i * 4 + 2]].map((n) => +n.toFixed(3));
      return { basis: [col(0), col(1), col(2)] };
    }, barrelWorld);
  };

  console.log('idle', JSON.stringify(await solve(false, [0, -0.22, 0.98])));
  console.log('run ', JSON.stringify(await solve(true, [0, -0.08, 1])));
  await b.close();
})();
