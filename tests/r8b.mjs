import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 860 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  for (const t of ['warrior', 'wheel', 'masonry', 'metallurgy', 'horses', 'carriages', 'steam']) G.completeTech(t, true);
  log.push(['road tiers', G.FLEET.car.tiers.map(t => t.name).join(' > ')]);
  log.push(['rail tiers', G.FLEET.rail.tiers.map(t => t.name).join(' > ')]);
  for (let k = 0; k < 14; k++) { A.people = A.cap + 300; G.setPct(100); G.startPush(cx + (k % 2 ? 60 : -60), cy + ((k % 3) - 1) * 6); run(12); }
  const spotNear = (x, y, type) => { for (let r = 0; r < 15; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const i = G.idx(x + dx, y + dy); if (!G.canBuild(i, type) && G.countryAt(i) === A) return i; } return -1; };
  const fill = () => { for (const r of ['wood', 'stone', 'iron', 'oil', 'wheat']) A.res[r] = 3000; A.res.gold = 9999; };
  fill();
  const st = [spotNear(cx - 40, cy, 'station'), spotNear(cx + 2, cy, 'station')];
  for (const i of st) G.tryBuild(i, 'station');
  for (let k = 0; k < 120 && st.some(i => G.buildingAt(i)?.site); k++) { fill(); for (const i of st) if (G.buildingAt(i)?.site) G.rushSite(G.buildingAt(i)); run(1); }
  const trains = () => g.links.filter(L => L.kind === 'rail').flatMap(L => L.ships).map(v => `${G.FLEET.rail.tiers[Math.max(0, v.tier)].id}/paid${v.paid}`).join(' ');
  log.push(['rail lines', g.links.filter(L => L.kind === 'rail').length, 'trains', trains()]);
  G.completeTech('petroleum', true); G.completeTech('automobile', true); fill(); run(20);
  log.push(['diesel known, not ordered: still', trains()]);
  G.showBuildingCard(G.buildingAt(st[0]));
  const btn = [...document.querySelectorAll('#card button, .card button, button')].find(b => b.textContent.startsWith('Upgrade all trains'));
  log.push(['station button', btn && btn.textContent]);
  const iron0 = A.res.iron; btn && btn.click(); run(30); fill();
  log.push(['after ordering diesel', trains(), 'iron spent', Math.round(iron0 - A.res.iron)]);
  G.completeTech('electricity', true); run(5);
  G.orderUpgrade('rail'); fill(); run(30);
  log.push(['bullet ordered (no spare power)', trains(), 'card', G.fleetSummary('rail').up?.name || 'none']);
  // caravans
  G.completeTech('caravans', true);
  const F = G.fleetSummary('car');
  log.push(['caravans: car fleet can upgrade to', F.up && F.up.name, 'open', G.tierOpen('car')]);
  G.orderUpgrade('car'); fill(); run(40);
  log.push(['cars now', g.cars.map(v => G.FLEET.car.tiers[v.tier].id).join(',')]);
  // an old save: tier 4 meant trucks, trains ran at whatever fuel allowed
  const sv = JSON.parse(JSON.stringify(G.worldSave()));
  delete sv.tv; sv.cars.forEach(c => c.tier = 4); sv.links.forEach(L => L.ships.forEach(V => delete V.paid)); sv.fleetTarget = { car: 4, boat: 0, plane: 0 };
  G.loadGame(sv);
  log.push(['old save: cars', g.cars.map(v => G.FLEET.car.tiers[v.tier].id).join(','), 'car target', g.fleetTarget.car, 'train paid', g.links.flatMap(L => L.ships).map(v => v.paid).join(',')]);
  // and a fresh save round trip
  const sv2 = JSON.parse(JSON.stringify(G.worldSave())); G.loadGame(sv2);
  log.push(['new save: cars', g.cars.map(v => G.FLEET.car.tiers[v.tier].id).join(','), 'train paid', g.links.flatMap(L => L.ships).map(v => v.paid).join(',')]);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
console.log(errs.slice(0, 5).join('\n') || 'no errors');
await browser.close();
