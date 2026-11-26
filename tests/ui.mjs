import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const mobile = process.argv[2] === 'mobile';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1500, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const tag = mobile ? 'm' : 'd';
await page.evaluate(() => { const G = window.__game; G.stopSaving(); for (const t of ['warrior', 'wheel', 'masonry']) G.completeTech(t); for (let k = 0; k < 400; k++) G.tick(0.05); });
await page.waitForTimeout(500);
await page.screenshot({ path: `ui-${tag}-0.png` });
// open build menu
await page.click('#btn-build');
await page.waitForTimeout(300);
await page.screenshot({ path: `ui-${tag}-build.png` });
// pick farm
await page.click('.bm-card:has-text("Farm")');
await page.waitForTimeout(300);
await page.screenshot({ path: `ui-${tag}-place.png` });
await page.click('#cf-ok');
await page.waitForTimeout(400);
await page.click('#cf-cancel');
// command menu, attack prompt
await page.evaluate(() => { const G = window.__game, g = G.game; const n = g.nations[0]; const C = G.activeCountry(); });
if (mobile) { await page.click('#btn-cmd'); await page.waitForTimeout(300); await page.screenshot({ path: `ui-${tag}-cmd.png` }); await page.click('#cm-close'); }
await page.evaluate(() => { const G = window.__game; const n = G.game.nations[0]; document.querySelector('#modal') && 0; });
await page.evaluate(() => { const G = window.__game, n = G.game.nations[0]; G.game.cmd = 'expand'; });
// fake the prompt
await page.evaluate(() => { const G = window.__game; const n = G.game.nations[0]; const ev = new Event('x'); });
await page.evaluate(() => { const G = window.__game; G.game.notes; });
await page.evaluate(() => window.__game.completeTech('sailing'));
await page.waitForTimeout(300);
await page.screenshot({ path: `ui-${tag}-note.png` });
console.log(errs.join('\n') || 'no errors');
await browser.close();
