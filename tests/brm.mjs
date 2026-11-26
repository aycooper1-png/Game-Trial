import { chromium, devices } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const mobile = process.argv[2] === 'm';
const page = await (await browser.newContext(mobile ? devices['iPhone 13'] : { viewport: { width: 1300, height: 820 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 90000 });
// put the camera on a coast of ours
const pts = await page.evaluate(() => {
  localStorage.clear(); const G = window.__game; G.stopSaving(); G.completeTech('masonry', true);
  const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  let sea = -1, sd = 1e9;
  for (let i = 0; i < G.biome.length; i++) if (G.biome[i] === G.OCEAN) { const d = (i % G.W - cx) ** 2 + ((i / G.W | 0) - cy) ** 2; if (d < sd) { sd = d; sea = i; } }
  const ex = sea % G.W, ey = sea / G.W | 0, steps = Math.ceil(Math.sqrt(sd));
  for (let k = 0; k <= steps + 2; k++) for (let w = -2; w <= 2; w++) { const x = Math.round(cx + (ex - cx) * k / steps) + w, y = Math.round(cy + (ey - cy) * k / steps); const i = G.idx(x, y); if (G.isLand(i) && !G.owner[i] && !G.aiOf[i]) G.claim(i, A.id); }
  for (let k = 0; k < 20; k++) G.tick(0.05);
  // find coastal owned tile with a valid plan
  for (let i = 0; i < G.owner.length; i++) { if (!G.owner[i] || !G.isCoastal(i)) continue;
    for (let a = 0; a < 32; a++) { const tx = i % G.W + Math.round(Math.cos(a / 32 * 6.283) * 14), ty = (i / G.W | 0) + Math.round(Math.sin(a / 32 * 6.283) * 14); const p = G.bridgePlan(i, G.idx(tx, ty));
      if (!p.why) { G.cam.x = (i % G.W + tx) / 2; G.cam.y = ((i / G.W | 0) + ty) / 2; G.cam.zoom = 14; return { a: [i % G.W + 0.5, (i / G.W | 0) + 0.5], b: [tx + 0.5, ty + 0.5] }; } } }
  return null;
});
console.log('plan pts', JSON.stringify(pts));
await page.waitForTimeout(400);
const scr = await page.evaluate(p => { const G = window.__game; return [G.toScreen(...p.a), G.toScreen(...p.b)]; }, pts);
await page.evaluate(() => window.__game.toggleBuildMenu(true));
await page.waitForTimeout(400);
const card = await page.evaluateHandle(() => [...document.querySelectorAll('.bm-card')].find(e => e.querySelector('.bm-name').textContent === 'Bridge'));
if (mobile) await card.asElement().tap(); else await card.asElement().click();
await page.waitForTimeout(500);
const tap = async ([x, y]) => { if (mobile) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); await page.waitForTimeout(400); };
await tap(scr[0]);
console.log('after tap 1', await page.evaluate(() => JSON.stringify(window.__game.game.ghost) + ' | ' + document.getElementById('cf-info').innerText.replace(/\n/g, ' / ')));
await tap(scr[1]);
console.log('after tap 2', await page.evaluate(() => JSON.stringify(window.__game.game.ghost) + ' | ' + document.getElementById('cf-info').innerText.replace(/\n/g, ' / ')));
await page.screenshot({ path: 'brm-' + (mobile ? 'm' : 'd') + '.png' });
const ok = await page.$('#cf-ok');
if (mobile) await ok.tap(); else await ok.click();
await page.waitForTimeout(500);
console.log('bridges', await page.evaluate(() => window.__game.game.bridges.length + ' tool ' + window.__game.game.tool));
const r = await page.evaluate(() => { const a = performance.now(); return new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - a)))); });
console.log('frames', Math.round(r));
await page.screenshot({ path: 'brm2-' + (mobile ? 'm' : 'd') + '.png' });
console.log(errs.join('\n') || 'no errors');
await browser.close();
