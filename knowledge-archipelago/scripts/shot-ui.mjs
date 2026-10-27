import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const outDir = process.argv[2] ?? 'docs/shots-ui';
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
  await page.waitForTimeout(1500);
  for (let i = 0; i < 14; i += 1) {
    const next = await page.$('[data-dialogue-next]');
    if (!next) break;
    await next.click();
    await page.waitForTimeout(420);
  }
  await page.waitForTimeout(3200);
}

// 桌面：扩建 / 学习 / 设置
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (error) => console.log('[pageerror]', error.message));
page.on('console', (message) => {
  if (message.type() === 'error') console.log('[error]', message.text());
});
await enterGame(page);
await page.keyboard.press('g');
await page.waitForTimeout(900);
await page.screenshot({ path: `${outDir}/desktop-expansion.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.keyboard.press('k');
await page.waitForTimeout(900);
await page.screenshot({ path: `${outDir}/desktop-study.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// 手机横屏：直接以横向视口截图
const mobile = await browser.newPage({
  viewport: { width: 844, height: 390 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
});
mobile.on('pageerror', (error) => console.log('[mobile pageerror]', error.message));
await enterGame(mobile, 'http://localhost:5199/?landscape-frame=1');
await mobile.screenshot({ path: `${outDir}/mobile-landscape.png` });

// 手机竖屏：自动横向容器，不应该再出现转屏提示
const portrait = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
});
await portrait.goto('http://localhost:5199/', { waitUntil: 'domcontentloaded' });
await portrait.waitForSelector('html.landscape-shell', { timeout: 20000 });
await portrait.waitForTimeout(2800);
await portrait.screenshot({ path: `${outDir}/mobile-portrait.png` });

console.log('ui shots done');
await browser.close();
