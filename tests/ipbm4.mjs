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
  const A = G.activeCountry();
  for (const t of G.CFG.techs.map(t => t.id)) G.completeTech(t, true);
  const fill = C => { for (const r of ['iron', 'stone', 'oil', 'wood', 'wheat', 'uranium', 'chips', 'silicon', 'cobalt', 'gold']) C.res[r] = 6000; };
  fill(A); A.people = 200;

  { G.completeTech('computing', true); fill(A); let ci = -1; for (let r = 4; r < 30 && ci < 0; r++) for (let dx = -r; dx <= r && ci < 0; dx++) for (const dy of [-r, r]) { const i = G.idx(Math.floor(A.lx) + dx, Math.floor(A.ly) + dy); if (!G.canBuild(i, 'computer') && G.countryAt(i) === A) { ci = i; break; } }
    G.tryBuild(ci, 'computer'); for (let k = 0; k < 120 && G.buildingAt(ci)?.site; k++) { fill(A); run(1); } }
  const spotIn = (C, type, r0 = 3) => { for (let r = r0; r < 14; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const i = G.idx(Math.floor(C.lx) + dx, Math.floor(C.ly) + dy); if (!G.canBuild(i, type) && G.countryAt(i) === C) return i; } return -1; };
  const pi = spotIn(A, 'pad'), si = spotIn(A, 'silo', 6); G.tryBuild(pi, 'pad'); G.tryBuild(si, 'silo');
  for (let k = 0; k < 90 && [pi, si].some(i => G.buildingAt(i)?.site); k++) { fill(A); run(1); }
  const pad = G.buildingAt(pi); pad.rocket = { fuel: 400 }; A.people = 200; fill(A);
  G.startColony(pad, 1);
  const M = G.arrays(); let site = -1; for (let r = 0; r < 200 && site < 0; r++) { const i = G.idx(500 + r, 500); if (M.biome[i] === 2 && M.depositOf[i] < 0) site = i; }
  G.pickColonySite(site); run(35);
  G.viewWorld(1);
  g.warhead = 'nuke';
  G.setAiming(true);
  log.push(['aiming on moon', g.aiming]);
  G.fireIPBM(520, 520);
  log.push(['ipbms', g.ipbms.length, g.ipbms[0] && Math.round(g.ipbms[0].T)]);
  const scorchBefore = g.scorch.length;
  for (let k = 0; k < 60 && g.ipbms.length; k++) run(1);
  log.push(['landed: moon scorch', g.scorch.length - scorchBefore, 'world', G.getWorld()]);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
console.log(errs.join('\n') || 'no errors');
await browser.close();
