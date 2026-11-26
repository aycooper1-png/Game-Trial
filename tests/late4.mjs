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
  for (const t of G.CFG.techs.map(t => t.id)) G.completeTech(t, true);
  const fill = C => { for (const r of ['iron', 'stone', 'oil', 'wood', 'wheat', 'uranium', 'chips', 'silicon', 'cobalt', 'gold']) C.res[r] = 6000; };
  fill(A);

  { G.completeTech('computing', true); fill(A); let ci = -1; for (let r = 4; r < 30 && ci < 0; r++) for (let dx = -r; dx <= r && ci < 0; dx++) for (const dy of [-r, r]) { const i = G.idx(Math.floor(A.lx) + dx, Math.floor(A.ly) + dy); if (!G.canBuild(i, 'computer') && G.countryAt(i) === A) { ci = i; break; } }
    G.tryBuild(ci, 'computer'); for (let k = 0; k < 120 && G.buildingAt(ci)?.site; k++) { fill(A); run(1); } }
  const spotIn = (C, type, r0 = 3) => { for (let r = r0; r < 14; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const i = G.idx(Math.floor(C.lx) + dx, Math.floor(C.ly) + dy); if (!G.canBuild(i, type) && G.countryAt(i) === A) return i; } return -1; };
  const pi = spotIn(A, 'pad'); G.tryBuild(pi, 'pad');
  const ri = spotIn(A, 'receiver', 5); G.tryBuild(ri, 'receiver');
  const ai = spotIn(A, 'airport', 7); G.tryBuild(ai, 'airport');
  for (let k = 0; k < 90 && [pi, ri, ai].some(i => G.buildingAt(i)?.site); k++) { fill(A); run(1); }
  log.push(['built', [pi, ri, ai].map(i => !G.buildingAt(i)?.site)]);
  fill(A); G.buildDysonRocket(G.buildingAt(pi));
  log.push(['dyson', g.dyson && g.dyson.stage]);
  run(92); log.push(['after build', g.dyson.stage]);
  G.launchDyson(); run(41); log.push(['after flight', g.dyson.stage]);
  run(60); log.push(['half swarm power', G.dysonPower().toFixed(2), 'MW', JSON.stringify(A.mw)]);
  run(62); log.push(['done', g.dyson.stage, 'MW', JSON.stringify(A.mw)]);
  // bomber at the nearest nation's settlement
  const n = g.nations.find(n => n.alive);
  const tgt = g.buildings.find(b => b.type === 'settlement' && G.arrays().aiOf[b.i] === n.id + 1);
  fill(A);
  G.sendBomber(tgt.i % G.W, tgt.i / G.W | 0);
  log.push(['bombers', g.bombers.length, 'len', Math.round(g.bombers[0]?.len)]);
  const before = n.people; let downed = false;
  let _p = n.people; window.__trap = [];
  Object.defineProperty(n, 'people', { get() { return _p; }, set(v) { if (typeof v !== 'number' || !isFinite(v)) window.__trap.push(String(v) + ' ' + new Error().stack.split('\n').slice(1, 5).join(' <- ')); _p = v; }, configurable: true });
  for (let k = 0; k < 80 && g.bombers.length; k++) { run(0.5); if (g.bombers.some(b => b.down)) downed = true; }
  log.push(['trap', window.__trap.slice(0, 2)]);
  log.push(['nation after', n.people, n.cap, n.tiles, n.units, JSON.stringify(Object.keys(n).filter(k => typeof n[k] === 'number' && isNaN(n[k])))]);
  log.push(['bomber outcome', downed ? 'shot down' : 'dropped', 'nation people', Math.round(before), '->', Math.round(n.people), 'war', n.hostile]);
  window.__bomb = 1;
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
// screenshot of the swarm
await page.evaluate(() => { const G = window.__game; G.cam.follow = null; const S = G.game; G.toggleCmdMenu(false); });
await page.evaluate(() => { const G = window.__game; G.followBody ? 0 : 0; });
console.log(errs.join('\n') || 'no errors');
await browser.close();
