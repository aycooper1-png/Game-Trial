import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  const r2 = o => JSON.stringify(Object.fromEntries(Object.entries(o).filter(([, v]) => v).map(([k, v]) => [k, Math.round(v)])));
  log.push(['start cars', g.cars.length, 'res', r2(A.res)]);
  for (let t = 0; t < 4; t++) { run(15); log.push(['t', (t + 1) * 15, 'res', r2(A.res), 'waiting', g.buildings.filter(b => b.buf).map(b => b.type + Math.round(Object.values(b.buf).reduce((a, c) => a + c, 0))).join(' '), 'jobs', g.cars.map(v => v.job ? v.job.type : '-').join(',')]); }
  // build a farm: a car must bring the materials
  A.res.wood += 100; A.res.stone += 100;
  let spot = -1;
  for (let r = 3; r < 10 && spot < 0; r++) for (let dx = -r; dx <= r && spot < 0; dx++) { const i = G.idx(cx + dx, cy + r); if (!G.canBuild(i, 'farm') && G.countryAt(i) === A) spot = i; }
  G.tryBuild(spot, 'farm');
  const site = G.buildingAt(spot);
  run(1); log.push(['farm site', JSON.stringify(site.site && { ready: site.site.ready, car: site.site.car })]);
  for (let t = 0; t < 6 && site.site; t++) run(2);
  log.push(['farm built', !site.site]);
  // buy a car and upgrade with the wheel
  A.res.wood += 200;
  G.buyVehicle('car', spot);
  G.completeTech('wheel');
  log.push(['summary', JSON.stringify((({ count, open, tgt, upCost }) => ({ count, open, tgt, upCost }))(G.fleetSummary('car')))]);
  G.orderUpgrade('car');
  run(40);
  log.push(['tiers after upgrade', g.cars.map(v => v.tier).join(','), 'wood', Math.round(A.res.wood)]);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
await page.evaluate(() => { const G = window.__game, A = G.activeCountry(); G.cam.x = A.lx; G.cam.y = A.ly; G.cam.zoom = 12; G.toggleCmdMenu(false); });
await page.waitForTimeout(1500);
await page.screenshot({ path: 's1.png' });
console.log(errs.join('\n') || 'no errors');
await browser.close();
