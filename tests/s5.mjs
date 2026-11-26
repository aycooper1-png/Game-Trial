import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  for (const t of ['rocketry', 'electricity', 'fission', 'spaceflight', 'reusable', 'domes', 'terraform']) G.completeTech(t, true);
  A.res.iron = 2000; A.res.stone = 2000; A.res.oil = 600; A.res.wood = 600; A.res.wheat = 600; A.people = A.cap;
  let pi = -1; for (let r = 3; r < 14 && pi < 0; r++) for (let dx = -r; dx <= r && pi < 0; dx++) { const i = G.idx(cx + dx, cy - r); if (!G.canBuild(i, 'pad') && G.countryAt(i) === A) pi = i; }
  G.tryBuild(pi, 'pad');
  for (let k = 0; k < 40 && G.buildingAt(pi).site; k++) run(1);
  const pad = G.buildingAt(pi); pad.rocket = { fuel: 400 };
  A.people = Math.max(A.people, 120); A.res.iron = 2000; A.res.stone = 2000; A.res.wheat = 600;
  const t0 = performance.now();
  G.startColony(pad, 1);
  log.push(['gen moon ms', Math.round(performance.now() - t0), 'world now', G.getWorld(), 'pick', g.colonyPick]);
  const M = G.arrays();
  let land = 0, polar = 0, mtn = 0, grass = 0; for (let i = 0; i < M.biome.length; i++) { const b = M.biome[i]; if (b === 2) land++; if (b === 6) polar++; if (b === 3) mtn++; if (b === 1) grass++; }
  log.push(['moon biomes desert/mtn/polar/grass', land, mtn, polar, grass, 'deposits', G.CFG && 0]);
  // pick a spot near the middle
  let site = -1; for (let r = 0; r < 100 && site < 0; r++) { const i = G.idx(500 + r, 500); if (M.biome[i] === 2 && M.depositOf[i] < 0) site = i; }
  G.pickColonySite(site);
  log.push(['back home', G.getWorld(), 'ships', g.colonyShips.length, 'people', Math.round(A.people)]);
  run(32);
  log.push(['ships after', g.colonyShips.length]);
  const moon = G.worldData[1];
  log.push(['moon countries', moon.g.countries.map(c => `${c.short} p${Math.round(c.people)} alive${c.alive}`).join(';'), 'buildings', moon.g.buildings.map(b => b.type).join(',')]);
  run(30);
  log.push(['moon after 30s', moon.g.countries.map(c => `p${Math.round(c.people)}/cap${Math.round(c.cap)} wheat${Math.round(c.res.wheat)} food${Math.round(c.foodCap)}`).join(';'), 'home pop', Math.round(G.activeCountry().people)]);
  // go there, expand, terraform
  G.viewWorld(1);
  const MC = G.activeCountry();
  log.push(['viewing', G.getWorld(), 'active', MC && MC.short, 'cars', g.cars.length]);
  MC.res.iron += 400; MC.res.stone += 400; MC.res.uranium = 50;
  const mx = Math.floor(MC.lx), my = Math.floor(MC.ly);
  let ti = -1; for (let r = 2; r < 8 && ti < 0; r++) for (let dx = -r; dx <= r && ti < 0; dx++) { const i = G.idx(mx + dx, my + r); if (!G.canBuild(i, 'terraformer') && G.countryAt(i) === MC) ti = i; }
  let si = -1; for (let r = 2; r < 8 && si < 0; r++) for (let dx = -r; dx <= r && si < 0; dx++) { const i = G.idx(mx + dx, my - r); if (!G.canBuild(i, 'solar') && G.countryAt(i) === MC) si = i; }
  G.tryBuild(ti, 'terraformer');
  log.push(['terraformer site', ti, 'solar spot', si]);
  for (let k = 0; k < 60 && G.buildingAt(ti) && G.buildingAt(ti).site; k++) run(1);
  log.push(['terraformer built', G.buildingAt(ti) && !G.buildingAt(ti).site, 'power', JSON.stringify(MC.mw)]);
  // give it power: reactor-free test: pretend power with many solars
  for (let k = 0; k < 4; k++) { let j = -1; for (let r = 2; r < 10 && j < 0; r++) for (let dx = -r; dx <= r && j < 0; dx++) { const i = G.idx(mx - r, my + dx); if (!G.canBuild(i, 'solar') && G.countryAt(i) === MC) j = i; } if (j >= 0) { MC.res.iron += 50; MC.res.stone += 50; G.tryBuild(j, 'solar'); } }
  run(40);
  const M2 = G.arrays(); let g2 = 0; for (let i = 0; i < M2.biome.length; i++) if (M2.biome[i] === 1) g2++;
  log.push(['green tiles on the moon', g2, 'sat', MC.sat]);
  // AI outposts
  G.viewWorld(0);
  for (const n of g.nations) { n.R.add('domes'); n.R.add('spaceflight'); n.people = Math.max(n.people, 600); }
  for (let k = 0; k < 30; k++) G.tick(2);
  log.push(['outposts', g.nations.filter(n => n.outposts && n.outposts[1]).map(n => `${n.short}:${n.outposts[1].tiles}`).join(' ')]);
  G.saveGame();
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
await page.evaluate(() => { const G = window.__game; G.viewWorld(1); const C = G.activeCountry(); G.cam.x = C.lx; G.cam.y = C.ly; G.cam.zoom = 16; G.toggleCmdMenu(false); });
await page.waitForTimeout(1000);
await page.screenshot({ path: 's5-moon.png' });
await page.evaluate(() => { const G = window.__game; G.cam.x = 500; G.cam.y = 500; G.cam.zoom = 0.8; });
await page.waitForTimeout(800);
await page.screenshot({ path: 's5-moonfar.png' });
await page.evaluate(() => { window.__game.saveGame(); });
await page.reload();
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
console.log(await page.evaluate(() => { const G = window.__game; const d = G.worldData[1]; return JSON.stringify({ moon: !!d, countries: d && d.g.countries.map(c => c.short + ':' + Math.round(c.people)), bld: d && d.g.buildings.length, world: G.getWorld() }); }));
console.log(errs.join('\n') || 'no errors');
await browser.close();
