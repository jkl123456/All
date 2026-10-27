import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const logs = [];
page.on('console', (msg) => {
  const text = msg.text();
  if (/知屿|动作/.test(text)) logs.push(text.slice(0, 200));
});
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-title-start]', { timeout: 90000 });
await page.click('[data-title-start]');
await page.waitForTimeout(3000);
for (let i = 0; i < 40; i += 1) {
  const next = await page.$('[data-dialogue-next]');
  if (!next) break;
  await next.click({ force: true });
  await page.waitForTimeout(180);
}
await page.evaluate(() => {
  const g = window.__ZHIYU__;
  g.world.uiPaused = false;
  g.ui.closeModal?.();
  // 测试期间关掉碰撞，免得量到撞墙的半速
  g.world.isWalkable = () => true;
  g.world.player.setPosition(0, 18, Math.PI);
  g.world.cameraOrbit.yaw = 0;
  g.world.cameraOrbit.pitch = 0.3;
  g.world.cameraOrbit.distance = 6.6;
  g.world.snapCamera?.();
});
await page.waitForTimeout(600);

const base = await page.evaluate(() => {
  const impl = window.__ZHIYU__.world.player.impl;
  return {
    actions: Object.keys(impl.actions),
    duration: Object.fromEntries(Object.entries(impl.actions).map(([k, a]) => [k, +a.getClip().duration.toFixed(3)])),
    modelScale: +impl.model.scale.x.toFixed(3),
    walkSpeed: +impl.walkSpeed.toFixed(2),
    runSpeed: +impl.runSpeed.toFixed(2),
    naturalWalk: +(impl.naturalWalk ?? 0).toFixed(2),
    naturalRun: +(impl.naturalRun ?? 0).toFixed(2),
  };
});
console.log('BASE', JSON.stringify(base));

const install = () => page.evaluate(() => {
  const impl = window.__ZHIYU__.world.player.impl;
  const find = (re) => {
    let hit = null;
    impl.model.traverse((o) => { if (!hit && o.isBone && re.test(o.name)) hit = o; });
    return hit;
  };
  const bones = { l: find(/LeftFoot$/i), r: find(/RightFoot$/i), hips: find(/Hips$/i) };
  const v = new bones.l.position.constructor();
  window.__SAMPLES__ = [];
  window.__SAMPLING__ = true;
  const loop = () => {
    if (!window.__SAMPLING__) return;
    const stamp = performance.now();
    bones.l.getWorldPosition(v); const lx = v.x, ly = v.y, lz = v.z;
    bones.r.getWorldPosition(v); const rx = v.x, ry = v.y, rz = v.z;
    bones.hips.getWorldPosition(v); const hy = v.y;
    const p = impl.root.position;
    window.__SAMPLES__.push({
      t: stamp, lx, ly, lz, rx, ry, rz, hy,
      px: p.x, pz: p.z, speed: Math.hypot(impl.velocity.x, impl.velocity.z),
    });
    requestAnimationFrame(loop);
  };
  loop();
});

const startSample = () => page.evaluate(() => { window.__SAMPLES__ = []; window.__SAMPLING__ = true; });
const stopSample = () => page.evaluate(() => { window.__SAMPLING__ = false; return window.__SAMPLES__; });

const analyse = (rows) => {
  if (!rows.length) return null;
  const speedList = rows.map((r) => r.speed).filter((s) => s > 0.5);
  const legL = [];
  const legR = [];
  for (let i = 1; i < rows.length; i += 1) {
    const dt = (rows[i].t - rows[i - 1].t) / 1000;
    if (dt <= 0.001) continue;
    legL.push({ v: (rows[i].lz - rows[i - 1].lz) / dt, y: rows[i].ly });
    legR.push({ v: (rows[i].rz - rows[i - 1].rz) / dt, y: rows[i].ry });
  }
  const stance = (list) => {
    const sorted = [...list].sort((a, b) => a.y - b.y);
    const cut = sorted[Math.floor(sorted.length * 0.4)].y;
    const v = list.filter((x) => x.y <= cut).map((x) => x.v).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length * 0.5)] : null;
  };
  const avg = speedList.reduce((a, b) => a + b, 0) / Math.max(1, speedList.length);
  return {
    avgSpeed: +avg.toFixed(2),
    stanceL: +(stance(legL) ?? 0).toFixed(2),
    stanceR: +(stance(legR) ?? 0).toFixed(2),
    footLift: +(Math.max(...rows.map((r) => Math.max(r.ly, r.ry))) - Math.min(...rows.map((r) => Math.min(r.ly, r.ry)))).toFixed(3),
    hipsBob: +(Math.max(...rows.map((r) => r.hy)) - Math.min(...rows.map((r) => r.hy))).toFixed(3),
  };
};

await page.mouse.click(450, 300);
await install();
await page.keyboard.down('w');
await page.waitForTimeout(600);
await startSample();
await page.waitForTimeout(2400);
const walk = await stopSample();
await page.keyboard.up('w');
console.log('WALK', JSON.stringify(analyse(walk)));

await page.waitForTimeout(500);
await page.keyboard.down('Shift');
await page.keyboard.down('w');
await page.waitForTimeout(700);
await startSample();
await page.waitForTimeout(2400);
const run = await stopSample();
await page.keyboard.up('w');
await page.keyboard.up('Shift');
console.log('RUN', JSON.stringify(analyse(run)));

await page.waitForTimeout(1200);
const idle = await page.evaluate(() => {
  const impl = window.__ZHIYU__.world.player.impl;
  const read = (a) => (a ? { w: +a.getEffectiveWeight().toFixed(2), ts: +a.getEffectiveTimeScale().toFixed(2) } : null);
  return {
    weights: { walk: read(impl.clipWalk), run: read(impl.clipRun), idle: read(impl.clipIdle) },
    speed: +Math.hypot(impl.velocity.x, impl.velocity.z).toFixed(2),
  };
});
console.log('IDLE', JSON.stringify(idle));
console.log('LOGS', JSON.stringify(logs.filter((l) => l.includes('动作'))));
await page.screenshot({ path: 'docs/shots-port/probe-anim.png' });
await browser.close();
