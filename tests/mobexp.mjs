import { chromium, devices } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack)); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
await page.evaluate(() => localStorage.clear()); await page.reload();
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const t = () => page.evaluate(() => window.__game.game.time.toFixed(2));
await page.waitForTimeout(1000);
console.log('time', await t());
await page.tap('#btn-cmd'); await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/mx1.png' });
await page.tap('[data-cmd="expedition"]'); await page.waitForTimeout(600);
console.log('after tapping Expedition: time', await t(), 'cmd', await page.evaluate(() => window.__game.game.cmd));
await page.screenshot({ path: '/tmp/mx2.png' });
console.log('panel open after picking Expedition', await page.evaluate(() => document.getElementById('cmdmenu').classList.contains('show')));
// tap a spot on the map outside the border
const vp = page.viewportSize();
for (const [x, y] of [[vp.width * 0.85, vp.height * 0.3], [vp.width * 0.15, vp.height * 0.55]]) {
  await page.touchscreen.tap(x, y); await page.waitForTimeout(800);
  console.log('tap', Math.round(x), Math.round(y), 'time', await t(), 'cmd', await page.evaluate(() => window.__game.game.cmd), 'exps', await page.evaluate(() => window.__game.game.expeditions.length));
}
await page.waitForTimeout(2000);
console.log('time later', await t());
await page.screenshot({ path: '/tmp/mx3.png' });
console.log(errs.slice(0, 5).join('\n') || 'no errors');
await browser.close();
