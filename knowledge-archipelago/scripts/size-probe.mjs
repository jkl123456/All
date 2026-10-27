import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.goto('http://localhost:5199/', { waitUntil: 'domcontentloaded', timeout: 60000 });
const info = await page.evaluate(async () => {
  const mod = await import('/src/engine/rtsAssets.js');
  await mod.preloadRtsAssets();
  const keys = ['TownCenter_FirstAge_Level1','TownCenter_FirstAge_Level2','TownCenter_FirstAge_Level3','Houses_FirstAge_1_Level1','Houses_FirstAge_1_Level2','Houses_FirstAge_1_Level3','Market_FirstAge_Level1','Storage_FirstAge_Level1','Windmill_FirstAge','WatchTower_FirstAge_Level3'];
  return keys.map((k) => {
    const s = mod.rts.getSize(k);
    return { k, x: +s.x.toFixed(2), y: +s.y.toFixed(2), z: +s.z.toFixed(2) };
  });
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
