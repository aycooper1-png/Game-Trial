import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  for (const t of ['rocketry', 'electricity', 'spaceflight', 'reusable', 'domes']) G.completeTech(t, true);
  A.res.iron = 2000; A.res.stone = 2000; A.res.oil = 600; A.res.wood = 600; A.res.wheat = 600;
  let pi = -1; for (let r = 3; r < 14 && pi < 0; r++) for (let dx = -r; dx <= r && pi < 0; dx++) { const i = G.idx(cx + dx, cy - r); if (!G.canBuild(i, 'pad') && G.countryAt(i) === A) pi = i; }
  G.tryBuild(pi, 'pad'); for (let k = 0; k < 40 && G.buildingAt(pi).site; k++) run(1);
  const pad = G.buildingAt(pi); pad.rocket = { fuel: 400 }; A.people = 140; A.res.iron = 2000; A.res.stone = 2000; A.res.wheat = 600;
  G.startColony(pad, 2);
  const M = G.arrays(); let site = -1; for (let r = 0; r < 200 && site < 0; r++) { const i = G.idx(500 + r, 500); if (M.biome[i] === 2 && M.depositOf[i] < 0) site = i; }
  G.pickColonySite(site);
  run(85);
  const ar = G.worldData[2];
  log.push(['aries colony', ar.g.countries.map(c => c.short + ' p' + Math.round(c.people)).join(','), 'ocean', (() => { let o = 0; for (const b of ar.biome) if (b === 0) o++; return o; })()]);
  // landing pad on Aries
  G.viewWorld(2);
  const C2 = G.activeCountry(); C2.res.stone += 200; C2.res.iron += 200;
  let li = -1; for (let r = 2; r < 8 && li < 0; r++) for (let dx = -r; dx <= r && li < 0; dx++) { const i = G.idx(Math.floor(C2.lx) + dx, Math.floor(C2.ly) + r); if (!G.canBuild(i, 'lpad') && G.countryAt(i) === C2) li = i; }
  G.tryBuild(li, 'lpad'); for (let k = 0; k < 60 && G.buildingAt(li) && G.buildingAt(li).site; k++) run(1);
  log.push(['aries lpad built', !!G.buildingAt(li) && !G.buildingAt(li).site, 'wood before', Math.round(C2.res.wood)]);
  G.viewWorld(0);
  A.res.iron = 2000; A.res.stone = 2000; A.res.oil = 600; A.res.wood = 900;
  G.buyShuttle(pad); const sh = g.shuttles[0]; sh.fuel = 300; sh.runs = 1;
  const seen = new Set();
  for (let k = 0; k < 600 && sh.runs < 2; k++) { A.res.oil = 600; G.tick(0.25); seen.add(sh.state + ':' + (sh.leg || '') + (sh.plan[0] && sh.plan[0].w ? '@w' + sh.plan[0].w : '')); }
  log.push(['states', [...seen].join(' '), 'runs', sh.runs, 'aries wood after', Math.round(C2.res.wood), 'aries res', JSON.stringify(Object.fromEntries(Object.entries(C2.res).map(([k, v]) => [k, Math.round(v)])))]);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
await page.evaluate(() => { const G = window.__game; G.viewWorld(2); const C = G.activeCountry(); G.cam.x = C.lx; G.cam.y = C.ly; G.cam.zoom = 3; G.toggleCmdMenu(false); });
await page.waitForTimeout(900);
await page.screenshot({ path: 's5-aries.png' });
console.log(errs.join('\n') || 'no errors');
await browser.close();
