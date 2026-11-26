import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
for (const [vw, vh, tag, mobile] of [[1400, 860, 'd', false], [390, 844, 'm', true]]) {
  const page = await (await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await page.goto('http://localhost:8765/?seed=42');
  await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
  await page.evaluate(() => {
    const G = window.__game, g = G.game, A = G.activeCountry();
    G.stopSaving();
    for (const t of ['electricity', 'electronics', 'batteries', 'computing']) G.completeTech(t, true);
    Object.assign(A.res, { silicon: 42, cobalt: 17, chips: 9, batteries: 3 });
    const d = G.deposits.find(d => d.type === 'silicon'); window.__dep = d.tiles[0];
    const c = G.deposits.find(d => d.type === 'cobalt'); window.__dep2 = c ? c.tiles[0] : d.tiles[0];
  });
  const shot = async (name, fn) => { await page.evaluate(fn); await page.waitForTimeout(700); await page.screenshot({ path: `r6v-${tag}-${name}.png` }); };
  await shot('hud', () => { const G = window.__game; for (let k = 0; k < 20; k++) G.tick(0.05); });
  await shot('silicon', () => { const G = window.__game, t = window.__dep; G.cam.follow = null; G.cam.anim = null; G.cam.x = t % G.W; G.cam.y = (t / G.W | 0); G.cam.zoom = 16; });
  await shot('cobalt', () => { const G = window.__game, t = window.__dep2; G.cam.x = t % G.W; G.cam.y = (t / G.W | 0); G.cam.zoom = 16; });
  await shot('craft', () => { const G = window.__game; G.toggleBuildMenu(true); const el = [...document.querySelectorAll('.bm-cat')].find(e => e.textContent === 'Crafting'); el && el.scrollIntoView(); });
  await shot('compcat', () => { const el = [...document.querySelectorAll('.bm-cat')].find(e => e.textContent === 'Computing'); el && el.scrollIntoView(); });
  await shot('modes', () => { const G = window.__game; G.toggleBuildMenu(false); G.modePicker('Start a new map?', 'Pick how the nations play:', () => {}); });
  console.log(tag, errs.join('\n') || 'no errors');
}
await browser.close();
