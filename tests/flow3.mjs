import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.type() + ' ' + m.text()); });
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry();
  const cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  for (const t of ['warrior', 'wheel', 'masonry', 'metallurgy', 'horses', 'carriages', 'steam', 'petroleum', 'automobile', 'electricity', 'flight']) G.completeTech(t);
  A.people = A.cap;
  // auto expedition 35 tiles west on land
  let tx = cx - 35, ty = cy;
  for (let d = 0; d < 30 && G.biome[G.idx(tx, ty)] !== 1; d++) tx++;
  G.setPct(50);
  G.launchExpedition(tx, ty, { auto: true });
  run(10);
  const live = g.countries.filter(c => c.alive);
  log.push(['domains', live.map(c => [c.short, c.tiles, Math.round(c.people), JSON.stringify(Object.fromEntries(Object.entries(c.res).map(([k, v]) => [k, Math.round(v)])))])]);
  const B = live.find(c => c !== A);
  // caravan posts in both
  A.res.stone += 200; A.res.iron += 100; A.res.oil += 60; B.res.stone += 60; B.res.iron += 40; B.res.oil += 30;
  const spot = (C, type) => { for (let r = 0; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const i = G.idx(Math.floor(C.lx) + dx, Math.floor(C.ly) + dy); if (!G.canBuild(i, type) && G.countryAt(i) === C) return i; } return -1; };
  log.push(['airA', G.tryBuild(spot(A, 'airport'), 'airport'), 'airB', G.tryBuild(spot(B, 'airport'), 'airport')]); run(25); A.res.iron += 60; A.res.oil += 30; G.buyVehicle('plane', 0); log.push(['links', g.links.length, g.links.map(L => L.kind + ':' + L.path.length + ' ships ' + L.ships.length)]);
  // now B is broke; build a fort in B (50 stone, 10 wood)
  B.res.stone = 0; B.res.wood = 0;
  A.res.stone = 300; A.res.wood = 300;
  const ok = G.tryBuild(spot(B, 'fort'), 'fort');
  const site = g.buildings.find(b => b.site);
  log.push(['fort in B', ok, site && JSON.stringify(site.site.need)]);
  for (let s = 0; s < 12 && site.site; s++) { run(5); log.push(['t', s * 5 + 5, site.site ? JSON.stringify(Object.fromEntries(Object.entries(site.site.need).map(([k, v]) => [k, Math.round(v)]))) : 'DONE', 'carts', g.links.map(L => L.cargo ? JSON.stringify({ req: (L.cargo.req || []).length, stone: L.cargo.stone, wood: L.cargo.wood }) : '-').join(' '), 'queued', g.links.map(L => L.req.a.length + '/' + L.req.b.length).join(' ')]); }
  log.push(['site finished?', !site.site, site.type, G.garrisons().length]);
  // troops from A's base to B's fort
  G.tryBuild(spot(A, 'base'), 'base');
  for (const b of G.garrisons()) if (b.type === 'base') b.units = 25;
  run(40);
  log.push(['troops', G.garrisons().map(b => [b.type, G.countryAt(b.i).short, Math.round(b.units)]), 'armies', g.armies.map(a => [a.n, a.riding])]);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
for (const [k, z] of [[0, 2.5], [1, 14]]) {
  await page.evaluate(([k, z]) => { const G = window.__game, L = G.game.links.find(L => L.kind === 'air'); const V = L.ships[0]; if (k) { G.completeTech('rocketry', true); } const [x, y] = [L.path[Math.floor(V.t)] % G.W, (L.path[Math.floor(V.t)] / G.W) | 0]; G.cam.x = x; G.cam.y = y; G.cam.zoom = z; G.cam.follow = null; G.toggleCmdMenu(false); }, [k, z]); await page.evaluate(z => { window.__game.cam.zoom = z; }, z);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'plane' + k + '.png' });
}
console.log(errs.join('\n') || 'no errors');
await browser.close();
