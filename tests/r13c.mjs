import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
await page.evaluate(() => localStorage.clear()); await page.reload();
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [], E = s => (0, eval)(s);
  G.stopSaving();
  const A = G.activeCountry();
  for (const t of ['warrior', 'masonry']) G.completeTech(t, true);
  for (const r of ['wood', 'stone', 'iron']) A.res[r] = 3000;
  const cx = Math.floor(A.lx), cy = Math.floor(A.ly), sites = [];
  for (const [t, dx, dy] of [['fort', 6, 0], ['fort', -6, 2], ['base', 0, 7], ['cabin', 4, -5]]) { for (let r = 0; r < 8; r++) { const i = G.idx(cx + dx + r, cy + dy); if (!G.canBuild(i, t)) { G.tryBuild(i, t); sites.push(i); break; } } }
  let worst = 0, maxCars = 0, t0 = g.time;
  for (let k = 0; k < 4000 && sites.some(i => G.buildingAt(i)?.site); k++) {
    G.tick(0.05);
    for (const v of g.cars) worst = Math.max(worst, G.boxSum ? 0 : 0, Object.values(v.cargo || {}).reduce((a, n) => a + n, 0) / E('carProf')(v).cargo);
    for (const i of sites) { const S = G.buildingAt(i)?.site; if (S) maxCars = Math.max(maxCars, S.cars || 0); }
  }
  log.push(['sites built', sites.filter(i => !G.buildingAt(i)?.site).length, 'of', sites.length, 'in', Math.round(g.time - t0), 's', 'cars', g.cars.length, 'heaviest load / capacity', worst.toFixed(2), 'most haulers on one site', maxCars]);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
console.log(errs.slice(0, 4).join('\n') || 'no errors');
await browser.close();
