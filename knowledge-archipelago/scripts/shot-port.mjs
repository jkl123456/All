import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const outDir = process.argv[2] ?? 'docs/shots-port';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (error) => logs.push(`[pageerror] ${error.message}`));

await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-title-start]', { timeout: 90000 });
await page.waitForTimeout(3500);
await page.screenshot({ path: `${outDir}/title.png` });
await page.click('[data-title-start]');
await page.waitForTimeout(1600);
for (let i = 0; i < 40; i += 1) {
  const next = await page.$('[data-dialogue-next]');
  if (!next) break;
  await next.click({ force: true });
  await page.waitForTimeout(260);
}
await page.keyboard.press('Escape');
await page.waitForTimeout(800);
await page.evaluate(() => {
  const game = window.__ZHIYU__;
  if (!game?.world) return;
  game.world.setTimeOfDay(16 * 60 + 20);
  game.world.player.setPosition(0, 15.2, Math.PI);
  game.world.cameraOrbit.yaw = 0;
  game.world.cameraOrbit.pitch = 0.34;
  game.world.cameraOrbit.distance = 19;
  game.world.snapCamera?.();
});
await page.waitForTimeout(1800);
await page.screenshot({ path: `${outDir}/home.png` });

await page.evaluate(() => {
  const game = window.__ZHIYU__;
  if (game?.world) {
    game.world.cameraOrbit.yaw = 2.4;
    game.world.cameraOrbit.pitch = 0.42;
    game.world.cameraOrbit.distance = 16;
  }
});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${outDir}/home-back.png` });

await page.evaluate(() => window.__ZHIYU__?.travel?.('wen'));
await page.waitForTimeout(3200);
await page.screenshot({ path: `${outDir}/wen.png` });

const state = await page.evaluate(() => {
  const game = window.__ZHIYU__;
  if (!game?.world) return { ok: false };
  const world = game.world;
  return {
    ok: true,
    playerMode: world.player.mode,
    playerPos: [world.player.root.position.x.toFixed(2), world.player.root.position.z.toFixed(2)],
    interactions: world.interactions.length,
    solids: world.solidBlockers?.length ?? 0,
  };
});
console.log(JSON.stringify(state, null, 2));
console.log(logs.filter((line) => /error|warn|知屿|village|town/i.test(line)).slice(-25).join('\n'));
await browser.close();
