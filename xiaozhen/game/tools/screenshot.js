/**
 * 用 Playwright 抓几张游戏截图，方便快速核对模型、动作与移动端布局。
 * 用法： node game/tools/screenshot.js
 * 需要先启动 node game/server.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', '..', 'shots');
const URL = process.env.GAME_URL || 'http://localhost:5173/';

async function ready(page) {
  await page.goto(`${URL}?nointro`, { waitUntil: 'load' });
  await page.waitForFunction(
    () => document.getElementById('loading')?.classList.contains('done'),
    null,
    { timeout: 180000 }
  );
  await page.waitForTimeout(1400);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });

  const logs = [];
  const page = await browser.newPage({ viewport: { width: 1360, height: 760 } });
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await ready(page);

  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log('shot', name);
  };

  await shot('01-plaza');

  // 侧面看站姿
  await page.evaluate(() => {
    const g = window.__game;
    g.cam.yaw = Math.PI * 0.5;
    g.cam.pitch = 0.08;
    g.cam.distance = 3.6;
    g.cam.intro = 0;
  });
  await page.waitForTimeout(700);
  await shot('02-idle-side');

  // 近一点看走路细节
  await page.evaluate(() => {
    const g = window.__game;
    g.cam.distance = 4.2;
    g.cam.pitch = 0.06;
  });

  // 侧面看走路：锁定世界方向，相机保持侧向
  await page.evaluate(() => {
    window.__forceInput = { forward: 1, strafe: 0, run: false, speedScale: 1, dirX: 0, dirZ: 1 };
  });
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(150);
    await shot(`03-walk-${i}`);
  }

  // 奔跑
  await page.evaluate(() => {
    window.__forceInput = { forward: 1, strafe: 0, run: true, speedScale: 1, dirX: 0, dirZ: 1 };
  });
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(120);
    await shot(`04-run-${i}`);
  }
  await page.evaluate(() => {
    window.__forceInput = null;
  });

  // 雨林远景
  await page.evaluate(() => {
    const g = window.__game;
    g.player.position.set(-4, 0, 26);
    g.cam.yaw = Math.PI * 0.1;
    g.cam.pitch = 0.3;
    g.cam.distance = 11;
    g.cam.intro = 0;
  });
  await page.waitForTimeout(900);
  await shot('05-jungle');

  // 树冠特写：挑一棵棕榈，站到它斜前方
  const tree = await page.evaluate(() => {
    const g = window.__game;
    const p = g.forestInfo.placements.find((x) => x.species === 'cecropia') ||
      g.forestInfo.placements.find((x) => x.species === 'palm_a');
    g.player.position.set(p.x + 1.2, 0, p.z + 9);
    g.player.heading = Math.PI;
    g.cam.yaw = 0;
    g.cam.pitch = 0.42;
    g.cam.distance = 6;
    g.cam.intro = 0;
    return { species: p.species, x: p.x, z: p.z, scale: p.scale };
  });
  console.log('tree', JSON.stringify(tree));
  await page.waitForTimeout(900);
  await shot('06-tree');

  // 动物：把一只牵到镜头前
  const info = await page.evaluate(() => {
    const g = window.__game;
    const a = g.herd.animals.find((x) => x.spec.file === 'deer') || g.herd.animals[0];
    a.spec.shy = 0;
    g.player.position.set(0, 0, 20);
    a.position.set(0.6, 0, 24.5);
    a.target.copy(a.position);
    a.state = 'idle';
    a.timer = 60;
    a.desired = 0;
    a.speed = 0;
    a.heading = Math.PI;
    g.cam.yaw = 0.1;
    g.cam.pitch = 0.14;
    g.cam.distance = 4.5;
    return g.herd.animals.map((x) => `${x.spec.file}@${x.position.x.toFixed(1)},${x.position.z.toFixed(1)}`);
  });
  console.log('animals', info.join(' | '));
  await page.waitForTimeout(1200);
  await shot('07-animal');

  const stats = await page.evaluate(() => {
    const r = window.__game.renderer.info.render;
    const f = window.__game.forestInfo;
    return { calls: r.calls, triangles: r.triangles, instances: f && f.count, meshes: f && f.meshes };
  });
  console.log('stats', JSON.stringify(stats));

  // 手机端
  const mob = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  mob.on('console', (m) => logs.push(`[m ${m.type()}] ${m.text()}`));
  mob.on('pageerror', (e) => logs.push(`[mobile pageerror] ${e.message}`));
  await ready(mob);
  await mob.screenshot({ path: path.join(OUT, '08-mobile.png'), timeout: 120000 });
  console.log('shot 08-mobile');

  const mobileStats = await mob.evaluate(() => {
    const r = window.__game.renderer.info.render;
    return { calls: r.calls, triangles: r.triangles, dpr: window.devicePixelRatio };
  });
  console.log('mobile stats', JSON.stringify(mobileStats));

  fs.writeFileSync(path.join(OUT, 'console.log'), logs.join('\n'), 'utf-8');
  const bad = logs.filter((l) => /pageerror|\[error\]|Failed|404/.test(l));
  console.log(bad.length ? `CONSOLE ISSUES (${bad.length}):\n${bad.slice(0, 20).join('\n')}` : 'console clean');

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
