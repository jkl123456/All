import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const outDir = process.argv[2] ?? 'docs/screenshots';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});

async function enterGame(page, url = 'http://localhost:5199/') {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-title-start]', { timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.click('[data-title-start]');
  await page.waitForTimeout(1600);
  for (let i = 0; i < 14; i += 1) {
    const next = await page.$('[data-dialogue-next]');
    if (!next) break;
    await next.click({ force: true });
    await page.waitForTimeout(380);
  }
  await page.waitForTimeout(2600);
}

// ---------- 桌面 ----------
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (error) => console.log('[pageerror]', error.message));
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-title-start]', { timeout: 60000 });
await page.waitForTimeout(4200);
await page.screenshot({ path: `${outDir}/title.png` });
await page.click('[data-title-start]');
await page.waitForTimeout(1600);
for (let i = 0; i < 14; i += 1) {
  const next = await page.$('[data-dialogue-next]');
  if (!next) break;
  await next.click({ force: true });
  await page.waitForTimeout(380);
}
await page.waitForTimeout(2800);
await page.screenshot({ path: `${outDir}/home.png` });

await page.keyboard.press('g');
await page.waitForTimeout(900);
await page.screenshot({ path: `${outDir}/expansion.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

await page.evaluate(() => window.__ZHIYU__.repairDock());
await page.waitForTimeout(600);
const confirm = await page.$('[data-confirm-action="confirm"]');
if (confirm) await confirm.click({ force: true });
await page.waitForTimeout(1400);
await page.keyboard.press('m');
await page.waitForTimeout(1000);
await page.screenshot({ path: `${outDir}/map.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

await page.evaluate(() => window.__ZHIYU__.travel('wen'));
await page.waitForTimeout(2400);
await page.screenshot({ path: `${outDir}/island-wen.png` });
await page.evaluate(() => window.__ZHIYU__.startTrial('wen_main'));
await page.waitForTimeout(1400);
const option = await page.$('[data-quiz-option="0"]');
if (option) await option.click({ force: true });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${outDir}/trial.png` });

await page.close();

// ---------- 手机横屏 ----------
// landscape-frame=1 直接渲染横向视口，方便截取真实横屏画面；
// 真正的移动端入口会自动套上旋转容器，无需旋转提示。
const mobile = await browser.newPage({
  viewport: { width: 844, height: 390 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
});
mobile.on('pageerror', (error) => console.log('[mobile pageerror]', error.message));
await enterGame(mobile, 'http://localhost:5199/?landscape-frame=1');
await mobile.screenshot({ path: `${outDir}/mobile-landscape.png` });
await mobile.evaluate(() => window.__ZHIYU__.openBuildMode());
await mobile.waitForTimeout(1400);
await mobile.screenshot({ path: `${outDir}/mobile-build.png` });
await mobile.evaluate(() => window.__ZHIYU__.openStudyGuide());
await mobile.waitForTimeout(900);
await mobile.screenshot({ path: `${outDir}/mobile-study.png` });

console.log('captured to', outDir);
await browser.close();
