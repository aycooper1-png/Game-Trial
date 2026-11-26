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
  const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  const r2 = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));
  run(20);
  log.push(['haul after 20s', JSON.stringify(r2(A.res)), 'cars', g.cars.length, g.cars.map(c => c.tier).join(',')]);
  // expand and add a second settlement
  G.setPct(100);
  for (let k = 0; k < 6; k++) { A.people = A.cap; G.startPush(cx + 40, cy + 5); run(12); }
  A.res.wood += 300; A.res.stone += 300;
  let spot = -1;
  for (let d = 22; d < 40 && spot < 0; d++) { const i = G.idx(cx + d, cy + 3); if (!G.canBuild(i, 'settlement') && G.countryAt(i) === A) spot = i; }
  A.people = A.cap;
  log.push(['settlement site', spot, G.tryBuild(spot, 'settlement')]);
  run(30);
  log.push(['site done?', G.buildingAt(spot) && !G.buildingAt(spot).site]);
  G.buildRoads();
  const R = G.roadsList().filter(r => r.side > 0);
  log.push(['roads mine', R.length, R.map(r => Math.round(r.len) + ' tiles, ' + r.pts.length + ' pts')]);
  // connect the starting camp
  const camp = g.buildings.find(b => b.type === 'camp' && G.owner[b.i]);
  const cp = G.connectPlan(camp);
  log.push(['connect plan', cp.why || JSON.stringify(cp.cost)]);
  if (!cp.why) { G.connectToRoad(camp); log.push(['connected', g.connects.length, 'graph nodes', G.netGraph().nodes.length]); }
  // a route that should use the road
  const s1 = g.buildings.find(b => b.type === 'settlement' && G.owner[b.i] && b.i !== spot);
  const rt = G.findRoute(...G.tileCenter(s1.i), ...G.tileCenter(spot), G.haulProf(A));
  log.push(['route via road', rt.pts.length, 'secs', rt.len.toFixed(1), 'direct secs', (Math.hypot(s1.i % G.W - spot % G.W, ((s1.i / G.W) | 0) - ((spot / G.W) | 0)) / G.haulProf(A).off).toFixed(1)]);
  // forts + wall
  for (const t of ['warrior', 'wheel', 'masonry', 'metallurgy', 'horses']) G.completeTech(t);
  A.res.stone = 600; A.res.wood = 300;
  const fs = [];
  for (let d = 4; d < 30 && fs.length < 2; d += 1) { const i = G.idx(cx + (fs.length ? d + 12 : -d + 8), cy - 6); if (!G.canBuild(i, 'fort') && G.countryAt(i) === A) { G.tryBuild(i, 'fort'); fs.push(i); d += 10; } }
  run(15);
  const forts = G.garrisons().filter(b => b.type === 'fort');
  log.push(['forts', forts.length, forts.map(f => f.i)]);
  if (forts.length >= 2) {
    const wp = G.wallPlan(forts[0], forts[1]);
    log.push(['wall plan', wp.why || JSON.stringify(wp.cost) + ' len ' + Math.round(wp.line.len)]);
    if (!wp.why) { g.wallFrom = forts[0].i; G.pickWallEnd(forts[1]); document.querySelector('#md-btns button.go').click(); log.push(['walls', g.walls.length, 'def at wall', G.defenseMult(g.walls[0].tiles[3])]); }
  }
  // far attack
  log.push(['reach', G.strikeReach()]);
  const n = g.nations.slice().sort((a, b) => Math.hypot(a.lx - cx, a.ly - cy) - Math.hypot(b.lx - cx, b.ly - cy))[0];
  for (const b of G.garrisons()) b.units = 50;
  const plan = G.strikePlan(n, Math.floor(n.lx), Math.floor(n.ly));
  log.push(['strike plan to', n.short, plan ? Math.round(plan.gap) : 'out of reach', Math.round(Math.hypot(n.lx - cx, n.ly - cy))]);
  // gold & fuel
  log.push(['gold boost', JSON.stringify(G.goldBoost(1))]);
  // zoom the camera onto the roads for a picture
  G.cam.x = cx + 12; G.cam.y = cy; G.cam.zoom = 14; G.toggleCmdMenu(false); for (let k = 0; k < 60; k++) G.tick(0.05);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
await page.waitForTimeout(800);
console.log(await page.evaluate(() => { try { window.__game.updateHud(); return 'hud ok ' + document.getElementById('val-time').textContent; } catch (e) { return 'ERR ' + e.message + ' ' + e.stack.slice(0, 400); } }));
console.log(await page.evaluate(() => { try { window.__game.tick(0.05); return 'tick ok'; } catch (e) { return 'TICK ERR ' + e.message + ' ' + e.stack.slice(0, 400); } }));
await page.screenshot({ path: 'f5.png' });
console.log(errs.join('\n') || 'no errors');
await browser.close();
