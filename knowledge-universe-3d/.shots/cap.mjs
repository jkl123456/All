import puppeteer from 'puppeteer-core';
const [url, out, wait, script] = [process.argv[2], process.argv[3], Number(process.argv[4] || 1600), process.argv[5] || ''];
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--hide-scrollbars'],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
await new Promise((r) => setTimeout(r, wait));
let result = null;
try { result = await page.evaluate(script); } catch (e) { result = 'ERR ' + String(e).slice(0, 200); }
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: out });
console.log(JSON.stringify({ result, errors: errors.slice(0, 4) }));
await browser.close();
