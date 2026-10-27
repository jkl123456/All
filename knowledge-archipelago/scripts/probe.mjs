import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-title-start]', { timeout: 90000 });
await page.click('[data-title-start]');
await page.waitForTimeout(3000);
for (let i=0;i<40;i++){ const n=await page.$('[data-dialogue-next]'); if(!n) break; await n.click({force:true}); await page.waitForTimeout(200);} 
await page.evaluate(() => { window.__ZHIYU__.world.uiPaused = false; window.__ZHIYU__.ui.closeModal?.(); });
await page.waitForTimeout(600);
await page.mouse.click(450, 300);
await page.keyboard.down('w');
await page.waitForTimeout(1400);
const moving = await page.evaluate(() => {
  const impl = window.__ZHIYU__.world.player.impl;
  return { speed: Math.hypot(impl.velocity.x, impl.velocity.z).toFixed(2), pos: [impl.root.position.x.toFixed(2), impl.root.position.z.toFixed(2)], walkW: impl.clipWalk?.getEffectiveWeight?.().toFixed(2), uiPaused: window.__ZHIYU__.world.uiPaused };
});
console.log(JSON.stringify(moving));
await page.screenshot({ path: 'docs/shots-port/probe-walk.png' });
await page.keyboard.up('w');
await browser.close();
