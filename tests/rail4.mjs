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
  for (const t of ['warrior', 'wheel', 'masonry', 'metallurgy', 'horses', 'carriages', 'steam']) G.completeTech(t, true);
  // a domain stretching 60 tiles east-west
  for (let k = 0; k < 10; k++) { A.people = A.cap + 300; G.setPct(100); G.startPush(cx + (k % 2 ? 45 : -45), cy + ((k % 3) - 1) * 6); run(12); }
  log.push(['tiles', A.tiles]);
  const spotNear = (x, y, type) => { for (let r = 0; r < 15; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const i = G.idx(x + dx, y + dy); if (!G.canBuild(i, type) && G.countryAt(i) === A) return i; } return -1; };
  A.res.wood = 900; A.res.stone = 900; A.res.iron = 300;
  const w = spotNear(cx - 30, cy, 'station'), e = spotNear(cx + 30, cy, 'station');
  log.push(['stations', w, e, G.tryBuild(w, 'station'), G.tryBuild(e, 'station')]);
  for (let k = 0; k < 90 && (G.buildingAt(w)?.site || G.buildingAt(e)?.site); k++) run(1);
  log.push(['links', g.links.map(L => `${L.kind} ${L.path.length} tier ${L.ships.map(V => V.tier)}`).join(' | ')]);
  // more cars
  A.res.wood += 200; for (let k = 0; k < 4; k++) G.buyVehicle('car', 0);
  // a far site: a camp out east, materials should go by train
  A.res.wood = 900; A.res.stone = 900;
  const far = spotNear(cx + 38, cy + 3, 'fort');
  log.push(['far fort', far % G.W - cx, G.tryBuild(far, 'fort')]);
  const seen = new Set(); let viaTrain = false;
  for (let k = 0; k < 300 && G.buildingAt(far)?.site; k++) { run(0.5); for (const v of g.cars) if (v.job) seen.add(v.job.type); for (const L of g.links) for (const V of L.ships) if (V.cargo && V.cargo.req && V.cargo.req.length) viaTrain = true; }
  log.push(['fort done', !G.buildingAt(far)?.site, 'car jobs seen', [...seen].join(','), 'carried by train', viaTrain, 'hubJobs', g.hubJobs.length]);
  // train tiers: give electricity and power
  G.completeTech('automobile', true); A.res.oil = 300;
  run(30);
  log.push(['after automobile', g.links.map(L => L.ships.map(V => V.tier + (V.stalled ? 'S' : '')).join()).join(' ')]);
  A.res.oil = 0; A.res.wood = 0; run(20);
  log.push(['no fuel', g.links.map(L => L.ships.map(V => V.tier + (V.stalled ? 'S' : '')).join()).join(' ')]);
  A.res.wood = 400; run(20);
  log.push(['wood back', g.links.map(L => L.ships.map(V => V.tier + (V.stalled ? 'S' : '')).join()).join(' ')]);
  // troops: a base in the west, march to a fort in the east
  window.__view = g.links[0] ? g.links[0].a : null;
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
await page.evaluate(() => { const G = window.__game, L = G.game.links[0]; if (!L) return; const V = L.ships[0]; const t = L.path[Math.floor(V.t)]; G.cam.x = t % G.W; G.cam.y = t / G.W | 0; G.toggleCmdMenu(false); });
await page.evaluate(() => { window.__game.cam.zoom = 12; });
await page.waitForTimeout(800);
await page.screenshot({ path: 'rail4.png' });
console.log(errs.join('\n') || 'no errors');
await browser.close();
