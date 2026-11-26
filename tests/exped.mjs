import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const mobile = process.argv[2] === 'mobile';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1500, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
await page.waitForTimeout(800);
// find a sea target: the nearest ocean tile ~30 tiles from home, and launch with the Expedition command via a real tap/click
const tgt = await page.evaluate(() => {
  const G = window.__game, A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  G.stopSaving();
  let best = null;
  for (let r = 20; r < 60 && !best; r++) for (let a = 0; a < 64 && !best; a++) { const x = Math.round(cx + Math.cos(a / 64 * 6.283) * r), y = Math.round(cy + Math.sin(a / 64 * 6.283) * r); if (G.biome[G.idx(x, y)] === G.OCEAN) best = [x, y]; }
  G.cam.x = best[0]; G.cam.y = best[1]; G.cam.zoom = 6;
  G.setCmd('expedition');
  return best;
});
await page.waitForTimeout(500);
const sc = await page.evaluate(([x, y]) => window.__game.toScreen(x + 0.5, y + 0.5), tgt);
if (mobile) await page.touchscreen.tap(sc[0], sc[1]); else await page.mouse.click(sc[0], sc[1]);
await page.waitForTimeout(500);
const s0 = await page.evaluate(() => { const g = window.__game.game, e = g.driving; return e ? { kind: e.kind, x: e.x, y: e.y, n: e.n, dpad: document.getElementById('dpad').classList.contains('show') } : { none: true, toast: document.getElementById('toast').textContent }; });
console.log('launched', JSON.stringify(s0));
await page.screenshot({ path: `exp-${mobile ? 'm' : 'd'}-1.png` });
// drive forward 2.5 s
if (mobile) {
  const box = await page.locator('#dpad [data-key="arrowup"]').boundingBox();
  await page.evaluate(() => window.__game.keys.add('arrowup'));   // pointer-hold emulation: the pad's own handler adds this key
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.__game.keys.delete('arrowup'));
  console.log('pad button at', box && Math.round(box.x), box && Math.round(box.y));
} else {
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(2500); await page.keyboard.up('ArrowUp');
}
const s1 = await page.evaluate(() => { const e = window.__game.game.driving; return e ? { x: e.x, y: e.y } : null; });
console.log('moved', s1 && Math.hypot(s1.x - s0.x, s1.y - s0.y).toFixed(1), 'tiles');
await page.screenshot({ path: `exp-${mobile ? 'm' : 'd'}-2.png` });
if (mobile) await page.click('#dp-settle', { timeout: 5000 }).catch(() => console.log('NO SETTLE BUTTON')); else await page.keyboard.press('Space');
await page.waitForTimeout(400);
console.log('after settle', await page.evaluate(() => ({ driving: !!window.__game.game.driving, exps: window.__game.game.expeditions.length, domains: window.__game.game.countries.filter(c => c.alive).length, toast: document.getElementById('toast').textContent })));
console.log(errs.join('\n') || 'no errors');
await browser.close();
