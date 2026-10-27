import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGE ' + String(e).slice(0, 180)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CON ' + m.text().slice(0, 180)); });
await page.goto('http://127.0.0.1:4280/#enter', { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 3000));
const out = await page.evaluate(async () => {
  const z = window.__zhiyu;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  let maxSteps = 0;
  for (const p of z.ALL_POINTS) {
    try {
      z.openLesson(p);
      await wait(80);
      let guard = 0;
      while (guard < 30 && !document.querySelector('.lesson.is-reward')) {
        const opt = document.querySelector('.quiz-option:not([disabled])');
        if (opt) opt.click();
        const nx = document.getElementById('lesson-next');
        if (!nx) break;
        nx.click();
        await wait(50);
        guard += 1;
      }
      if (!document.querySelector('.lesson.is-reward')) fails.push('NO_REWARD ' + p.id + ' g=' + guard);
      maxSteps = Math.max(maxSteps, guard);
      document.querySelector('[data-action="close"]')?.click();
      document.querySelector('[data-close]')?.click();
      await wait(50);
    } catch (e) {
      fails.push('ERR ' + p.id + ' ' + String(e).slice(0, 90));
    }
  }
  return { total: z.ALL_POINTS.length, fails, maxSteps };
});
console.log(JSON.stringify(out, null, 1));
console.log('errors', JSON.stringify(errors.slice(0, 6)));
await browser.close();
