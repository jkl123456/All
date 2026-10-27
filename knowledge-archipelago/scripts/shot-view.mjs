import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const outDir = process.argv[2] ?? 'docs/shots-port';
const island = process.argv[3] ?? 'home';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (error) => console.log('[pageerror]', error.message));

await page.goto('http://localhost:5199/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('[data-title-start]', { timeout: 90000 });
await page.click('[data-title-start]');
await page.waitForTimeout(2000);

for (let round = 0; round < 6; round += 1) {
  for (let i = 0; i < 30; i += 1) {
    const next = await page.$('[data-dialogue-next]');
    if (!next) break;
    await next.click({ force: true });
    await page.waitForTimeout(200);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  const still = await page.$('[data-dialogue-next]');
  if (!still) break;
}

if (island !== 'home') {
  await page.evaluate((id) => {
    const game = window.__ZHIYU__;
    if (!game?.world) return;
    game.state.flags.dockRepaired = true;
    game.state.location = id;
    game.world.loadIsland(id, game.state, {});
    game.world.setTimeOfDay?.(16 * 60 + 10);
  }, island);
  await page.waitForTimeout(2400);
}

await page.evaluate(() => {
  const game = window.__ZHIYU__;
  if (!game?.world) return;
  game.world.setTimeOfDay(16 * 60 + 10);
  game.world.uiPaused = false;
});

// 远景
await page.evaluate(() => {
  const game = window.__ZHIYU__;
  game.world.player.setPosition(0, 13.5, Math.PI);
  game.world.cameraOrbit.yaw = 0;
  game.world.cameraOrbit.pitch = 0.32;
  game.world.cameraOrbit.distance = 18;
  game.world.snapCamera?.();
});
await page.waitForTimeout(1400);
await page.screenshot({ path: `${outDir}/${island}-wide.png` });

// 广场近景
await page.evaluate(() => {
  const game = window.__ZHIYU__;
  game.world.player.setPosition(0, 6.5, Math.PI);
  game.world.cameraOrbit.yaw = 0;
  game.world.cameraOrbit.pitch = 0.2;
  game.world.cameraOrbit.distance = 8;
  game.world.snapCamera?.();
});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${outDir}/${island}-plaza.png` });

// 角色近景
await page.evaluate(() => {
  const game = window.__ZHIYU__;
  game.world.cameraOrbit.pitch = 0.1;
  game.world.cameraOrbit.distance = 4.2;
  game.world.snapCamera?.();
});
await page.waitForTimeout(1000);
await page.screenshot({ path: `${outDir}/${island}-player.png` });

// 俯视
await page.evaluate(() => {
  const game = window.__ZHIYU__;
  game.world.player.setPosition(0, 4, Math.PI);
  game.world.cameraOrbit.yaw = 0.9;
  game.world.cameraOrbit.pitch = 0.95;
  game.world.cameraOrbit.distance = 26;
  game.world.snapCamera?.();
});
await page.waitForTimeout(1000);
await page.screenshot({ path: `${outDir}/${island}-top.png` });

await browser.close();
console.log('captured', island);
