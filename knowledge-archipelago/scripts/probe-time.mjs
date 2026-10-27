import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-title-start]', { timeout: 90000 });
await page.click('[data-title-start]');
await page.waitForTimeout(3200);
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
});
await page.waitForTimeout(900);

const read = () => page.evaluate(() => {
  const g = window.__ZHIYU__;
  return {
    day: g.state.day,
    minutes: Math.round(g.state.timeMinutes),
    worldMinutes: Math.round(g.world.timeMinutes),
    daylight: +g.world.daylight.toFixed(2),
    label: document.getElementById('hud-time')?.textContent?.trim()
      ?? document.querySelector('.hud-day')?.textContent?.trim()
      ?? null,
  };
});

console.log('BEFORE', JSON.stringify(await read()));

const button = await page.$('[data-action="time"]');
console.log('BUTTON', Boolean(button), button ? await button.innerText() : '');

for (let i = 0; i < 3; i += 1) {
  await page.click('[data-action="time"]');
  await page.waitForTimeout(700);
  console.log(`AFTER${i + 1}`, JSON.stringify(await read()));
  const toast = await page.$eval('.toast, .hud-toast, [class*="toast"]', (el) => el.textContent?.trim() ?? '').catch(() => '');
  if (toast) console.log('  toast:', toast.slice(0, 60));
}

// 键盘 T 也走一遍
await page.mouse.click(720, 420);
await page.keyboard.press('t');
await page.waitForTimeout(600);
console.log('AFTER_KEY', JSON.stringify(await read()));

await page.screenshot({ path: 'docs/shots-port/probe-time.png' });
await browser.close();
