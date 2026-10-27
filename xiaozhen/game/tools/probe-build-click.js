const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 660 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  p.on('console', m => { if (m.type() === 'log') console.log('[log]', m.text().slice(0, 200)); });
  await p.goto('http://localhost:5173/?nointro', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 240000 });
  await p.waitForTimeout(1500);

  await p.evaluate(() => {
    const g = window.__game;
    g.player.position.set(0, 0, 6);
    g.cam.yaw = 0; g.cam.pitch = 0.42; g.cam.distance = 17; g.cam.intro = 0;
    window.__forceInput = { forward: 0, strafe: 0, run: false, speedScale: 0, dirX: 0, dirZ: 0 };
    // 打点：记录 place 调用与 pointerup 时的状态
    const bd = g.builder;
    const orig = bd.place.bind(bd);
    bd.place = function () {
      console.log('PLACE type=' + (this.type && this.type.piece) + ' valid=' + this.valid +
        ' vis=' + (this.ghost && this.ghost.visible) + ' pos=' + (this.ghost ? this.ghost.position.toArray().map(n=>n.toFixed(1)) : ''));
      return orig();
    };
    document.addEventListener('pointerup', (e) => {
      console.log('UP at ' + e.clientX + ',' + e.clientY + ' type=' + (bd.type && bd.type.piece));
    }, true);
  });
  await p.waitForTimeout(300);

  await p.click('.act[data-act="build"]');
  await p.waitForTimeout(250);
  await p.click('.build-item[data-piece="House_1"]');
  await p.waitForTimeout(250);

  // 先算出世界点 (-4,0,-9) 对应的屏幕坐标
  const pt = await p.evaluate(() => {
    const g = window.__game, T = g.THREE;
    const rect = g.renderer.domElement.getBoundingClientRect();
    const v = new T.Vector3(-4, 0, -9).project(g.camera);
    return { x: rect.left + (v.x * 0.5 + 0.5) * rect.width, y: rect.top + (-v.y * 0.5 + 0.5) * rect.height };
  });
  console.log('screen point', JSON.stringify(pt));

  await p.mouse.move(pt.x, pt.y);
  await p.waitForTimeout(300);
  console.log('before click', JSON.stringify(await p.evaluate(() => ({ valid: window.__game.builder.valid, vis: window.__game.builder.ghost.visible }))));

  await p.mouse.down();
  await p.waitForTimeout(60);
  await p.mouse.up();
  await p.waitForTimeout(500);
  console.log('after click', JSON.stringify(await p.evaluate(() => ({ colliders: window.__game.town.colliders.length }))));

  // 第二次点击同一位置
  await p.mouse.down();
  await p.mouse.up();
  await p.waitForTimeout(500);
  console.log('after 2nd click', JSON.stringify(await p.evaluate(() => ({ colliders: window.__game.town.colliders.length }))));
  await b.close();
})();
