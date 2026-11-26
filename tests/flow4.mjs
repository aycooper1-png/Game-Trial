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
  const A = G.activeCountry();
  // starvation: destroy the farm
  const farm = g.buildings.find(b => b.type === 'farm');
  const fi = farm.i;
  const rm = window.__game; // removeBuilding not exposed: shell it
  G.explode(...G.tileCenter(fi), { w: 'missile', ai: 0, x0: 0, y0: 0, x1: 0, y1: 0 });
  log.push(['farm gone?', !g.buildings.includes(farm), 'wheat prod after', A.prod.wheat]);
  A.res.wheat = 5;
  const p0 = A.people;
  run(30);
  log.push(['starving', A.hungry, 'people', Math.round(p0), '->', Math.round(A.people), 'foodCap', Math.round(A.foodCap)]);
  // rebuild a farm, upgrade it later
  A.res.wood += 400; A.res.stone += 400; A.res.iron = 140;
  const cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  const spot = (type) => { for (let r = 0; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const i = G.idx(cx + dx, cy + dy); if (!G.canBuild(i, type) && G.countryAt(i) === A) return i; } return -1; };
  const fs = spot('farm');
  G.tryBuild(fs, 'farm'); run(2);
  const w1 = A.prod.wheat;
  for (const t of ['masonry', 'irrigation']) G.completeTech(t);
  G.tryBuild(fs, 'farm2'); run(2);
  log.push(['farm prod', w1.toFixed(2), 'irrigated', A.prod.wheat.toFixed(2), G.buildingAt(fs).type]);
  run(30);
  log.push(['recovering', A.hungry, Math.round(A.people), 'growth', A.growth.toFixed(2)]);
  // oil
  const oilTiles = G.deposits.filter(d => d.type === 'oil').length;
  for (const t of ['warrior', 'wheel', 'horses', 'carriages', 'metallurgy', 'steam', 'petroleum']) G.completeTech(t);
  log.push(['oil deposits', oilTiles, 'known', G.oilKnown(), 'derrick unlocked', G.isUnlocked('derrick')]);
  // airport between two domains
  for (const t of ['automobile', 'electricity', 'flight']) G.completeTech(t);
  A.people = A.cap;
  G.launchExpedition(cx + 60, cy + 10, { auto: true }); run(8);
  const live = g.countries.filter(c => c.alive);
  const B = live.find(c => c !== A);
  if (B) {
    for (const C of [A, B]) { C.res.stone += 100; C.res.iron += 100; C.res.oil += 50; }
    const spotIn = (C, type) => { for (let r = 0; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const i = G.idx(Math.floor(C.lx) + dx, Math.floor(C.ly) + dy); if (!G.canBuild(i, type) && G.countryAt(i) === C) return i; } return -1; };
    G.tryBuild(spotIn(A, 'airport'), 'airport'); G.tryBuild(spotIn(B, 'airport'), 'airport'); run(15); for (const C of [A, B]) C.res.oil += 50;
    log.push(['links', g.links.map(L => `${L.kind}:${L.path.length}`), 'air speed', G.linkStats('air').speed, 'road', JSON.stringify(G.linkStats('road'))]);
    run(10);
    log.push(['plane cargo', g.links.map(L => L.cargo ? 'loaded' : 'empty')]);
  }
  log.push(['unit', JSON.stringify(G.unitStats())]);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
console.log(errs.join('\n') || 'no errors');
await browser.close();
