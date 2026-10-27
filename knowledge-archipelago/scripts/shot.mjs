import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const outDir = process.argv[2] ?? 'docs/shots-v2';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on('console', (message) => {
  if (message.type() === 'error') console.log('[console.error]', message.text());
});
page.on('pageerror', (error) => console.log('[pageerror]', error.message));

await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.waitForTimeout(4500);
await page.screenshot({ path: `${outDir}/01-title.png` });

await page.click('[data-title-start]');
await page.waitForTimeout(2200);
await page.screenshot({ path: `${outDir}/02-intro.png` });

for (let i = 0; i < 14; i += 1) {
  const next = await page.$('[data-dialogue-next]');
  if (!next) break;
  await next.click();
  await page.waitForTimeout(500);
}
await page.waitForTimeout(2500);
await page.screenshot({ path: `${outDir}/03-home.png` });

await page.keyboard.press('b');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${outDir}/04-build.png` });

await page.keyboard.press('Escape');
await page.waitForTimeout(600);
await page.keyboard.press('m');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${outDir}/05-map.png` });

console.log('done');
await browser.close();
