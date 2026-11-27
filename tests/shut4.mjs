import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
await page.evaluate(() => localStorage.clear()); await page.reload();
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  for (const t of ['wheel', 'rocketry', 'electricity', 'spaceflight', 'reusable', 'domes']) G.completeTech(t, true);
  const fill = C => { C.res.iron = 2000; C.res.stone = 2000; C.res.oil = 600; C.res.wood = 900; C.res.wheat = 600; C.res.chips = 600; C.res.silicon = 600; C.res.cobalt = 600; C.res.gold = 600; };
  fill(A);

  { G.completeTech('computing', true); fill(A); let ci = -1; for (let r = 4; r < 30 && ci < 0; r++) for (let dx = -r; dx <= r && ci < 0; dx++) for (const dy of [-r, r]) { const i = G.idx(Math.floor(A.lx) + dx, Math.floor(A.ly) + dy); if (!G.canBuild(i, 'computer') && G.countryAt(i) === A) { ci = i; break; } }
    G.tryBuild(ci, 'computer'); for (let k = 0; k < 900 && G.buildingAt(ci)?.site; k++) { fill(A); run(1); } }
  const spotIn = (C, type, r0 = 3) => { for (let r = r0; r < 14; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const i = G.idx(Math.floor(C.lx) + dx, Math.floor(C.ly) + dy); if (!G.canBuild(i, type) && G.countryAt(i) === C) return i; } return -1; };
  const pi = spotIn(A, 'pad'); G.tryBuild(pi, 'pad');
  const li = spotIn(A, 'lpad', 5); G.tryBuild(li, 'lpad');
  for (let k = 0; k < 900 && (G.buildingAt(pi).site || G.buildingAt(li).site); k++) run(1);
  const pad = G.buildingAt(pi); pad.rocket = { fuel: 400 }; A.people = 140; fill(A);
  G.startColony(pad, 1);
  const M = G.arrays(); let site = -1; for (let r = 0; r < 200 && site < 0; r++) { const i = G.idx(500 + r, 500); if (M.biome[i] === 2 && M.depositOf[i] < 0) site = i; }
  G.pickColonySite(site);
  run(35);
  G.viewWorld(1);
  const C2 = G.activeCountry(); fill(C2);
  const mp = spotIn(C2, 'pad', 2); G.tryBuild(mp, 'pad');
  const ml = spotIn(C2, 'lpad', 4); G.tryBuild(ml, 'lpad');
  for (let k = 0; k < 900 && (G.buildingAt(mp)?.site || G.buildingAt(ml)?.site); k++) run(1);
  log.push(['moon pads', !G.buildingAt(mp)?.site, !G.buildingAt(ml)?.site, 'moon cars', g.cars.length]);
  C2.res.wood = 5; C2.res.stone = 20; C2.res.iron = 30;   // the colony is short
  G.viewWorld(0);
  fill(A);
  G.buyShuttle(pad);
  const sh = g.shuttles[0];
  const seen = []; let last = '';
  for (let k = 0; k < 900; k++) { A.res.oil = 600; G.tick(0.25); const st = sh.state + '@w' + sh.w + (sh.plan[0] ? '>' + (sh.plan[0].w ?? 'st') : ''); if (st !== last) { seen.push(st + ' t' + Math.round(k / 4) + ' cargo ' + Math.round(Object.values(sh.cargo).reduce((a, b) => a + b, 0))); last = st; } if (sh.runs >= 2 && sh.state === 'docked' && sh.w === 0) break; }
  log.push(['states', seen.join(' | ')]);
  log.push(['moon stock now', JSON.stringify(Object.fromEntries(Object.entries(C2.res).map(([k, v]) => [k, Math.round(v)]))), 'runs', sh.runs]);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
console.log(errs.join('\n') || 'no errors');
await browser.close();
