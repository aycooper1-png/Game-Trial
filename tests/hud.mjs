import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
for (const w of [1300, 1500, 1920]) {
  const page = await (await browser.newContext({ viewport: { width: w, height: 700 } })).newPage();
  await page.goto('http://localhost:8765/?seed=42');
  await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
  await page.evaluate(() => { const G = window.__game; G.stopSaving(); for (const t of ['petroleum', 'fission', 'electronics', 'flight', 'electricity']) G.completeTech(t, true); const A = G.activeCountry(); for (const r in A.res) A.res[r] = 2999; G.updateHud(); });
  await page.waitForTimeout(400);
  const over = await page.evaluate(() => { const els = [...document.querySelectorAll('#topbar .res:not([hidden])')]; const bad = []; for (const e of els) { if (e.scrollWidth > e.clientWidth + 2) bad.push(e.id + ':' + e.scrollWidth + '>' + e.clientWidth); } const last = els[els.length - 1].getBoundingClientRect(); return { bad, right: Math.round(last.right), vw: innerWidth }; });
  console.log(w, JSON.stringify(over));
  await page.screenshot({ path: `/tmp/hud${w}.png`, clip: { x: 0, y: 0, width: w, height: 70 } });
}
await browser.close();
