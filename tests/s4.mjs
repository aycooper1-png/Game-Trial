import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 860 } })).newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  for (const t of ['wheel', 'masonry', 'warrior', 'metallurgy', 'horses', 'carriages', 'steam', 'petroleum', 'electricity', 'automobile', 'flight', 'rocketry', 'spaceflight', 'reusable']) G.completeTech(t, true);
  A.res.iron = 2000; A.res.stone = 2000; A.res.oil = 600; A.res.wood = 600;
  const spot = type => { for (let r = 3; r < 14; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const i = G.idx(cx + dx, cy + dy); if (!G.canBuild(i, type) && G.countryAt(i) === A) return i; } return -1; };
  const pi = spot('pad'); G.tryBuild(pi, 'pad');
  const li = spot('lpad'); G.tryBuild(li, 'lpad');
  log.push(['drill on grass', G.canBuild(spot('camp'), 'drill')]);
  for (let k = 0; k < 40 && (G.buildingAt(pi).site || G.buildingAt(li).site); k++) run(1);
  const pad = G.buildingAt(pi);
  log.push(['pad built', !pad.site, 'lpad built', !G.buildingAt(li).site]);
  A.res.iron = 2000; A.res.oil = 600;
  run(2);
  log.push(['rocket', JSON.stringify(pad.rocket), 'oil', Math.round(A.res.oil)]);
  for (let k = 0; k < 30 && pad.rocket && pad.rocket.fuel < 399.9; k++) { A.res.oil = 600; run(5); }
  log.push(['fuelled', Math.round(pad.rocket.fuel)]);
  G.launchRocket(pad);
  const f = g.flying, D = G.DISK, F = G.CFG.rocket.flight;
  log.push(['flying', !!f, 'r0', Math.round(Math.hypot(f.x - D.cx, f.y - D.cy)), 'R', D.R]);
  G.toggleEngine(f);
  // autopilot: straight out, then pitch over past the rim; cut at apoapsis target; circularize at apoapsis
  let phase = 'climb', tmax = 0;
  for (let k = 0; k < 20 * 400 && !f.done; k++) {
    const dx = f.x - D.cx, dy = f.y - D.cy, r = Math.hypot(dx, dy), rad = Math.atan2(dy, dx);
    const o = G.orbitOf(f.x, f.y, f.vx, f.vy);
    if (phase === 'climb') {
      const p = Math.max(0, Math.min(1, (r - D.R + 100) / (F.atm * 0.9 + 100)));
      f.a = rad + p * Math.PI / 2 * 0.95;
      f.engine = !(r < D.R - 40 && Math.hypot(f.vx, f.vy) > 45);
      if (r > D.R && !o.escape && o.ap > D.R + F.atm + 70) { phase = 'coast'; f.engine = false; log.push(['cut', Math.round(f.t), 'ap', Math.round(o.ap - D.R), 'fuel', Math.round(f.fuel)]); }
    } else if (phase === 'coast') {
      const vr = (dx * f.vx + dy * f.vy) / r;
      if (vr < 0.5) { phase = 'circ'; f.engine = true; f.throttle = 1; }
    } else if (phase === 'circ') {
      f.a = Math.atan2(f.vy, f.vx);
      if (f.orbit || f.fuel <= 0) { f.engine = false; phase = 'done'; }
    }
    G.tick(0.05);
    if (phase === 'done' && f.orbit) break;
  }
  const o = G.orbitOf(f.x, f.y, f.vx, f.vy);
  log.push(['phase', phase, 'orbit', f.orbit, 'pe', Math.round(o.pe - D.R), 'ap', Math.round(o.ap - D.R), 'fuel', Math.round(f.fuel), 'done', !!f.done]);
  if (f.orbit) { G.makeStation(f); log.push(['stations', g.orbitals.length, 'supply', pad.supply]); }
  // one-way supply
  for (let k = 0; k < 40; k++) { A.res.oil = 600; A.res.iron = 2000; run(5); if (g.orbitals[0] && g.orbitals[0].runs) break; }
  if (!g.orbitals[0]) return log;
  log.push(['station after one-way', g.orbitals[0] && JSON.stringify({ p: g.orbitals[0].people, res: g.orbitals[0].res, runs: g.orbitals[0].runs })]);
  // reusable
  A.res.iron = 2000; A.res.stone = 2000; A.res.oil = 600;
  G.buyShuttle(pad);
  log.push(['shuttles', g.shuttles.length, 'pad supply now', pad.supply]);
  const seen = new Set();
  for (let k = 0; k < 400; k++) { A.res.oil = 600; G.tick(0.25); const sh = g.shuttles[0]; seen.add(sh.state + ':' + (sh.leg || '')); if (sh.runs >= 1) break; }
  if (!g.orbitals[0]) return log;
  log.push(['shuttle states', [...seen].join(' '), 'runs', g.shuttles[0].runs, 'station', JSON.stringify({ p: g.orbitals[0].people, runs: g.orbitals[0].runs })]);
  G.showBuildingCard(pad);
  log.push(['card', document.getElementById('bc-body').innerText.replace(/\n/g, ' | ')]);
  // AI stations
  for (const n of g.nations) { n.R.add('spaceflight'); n.people = Math.max(n.people, 500); }
  for (let k = 0; k < 15; k++) G.tick(5);
  log.push(['ai stations', g.orbitals.filter(s => s.nation != null).length]);
  window.__f = f;
  G.cam.x = G.DISK.cx; G.cam.y = G.DISK.cy; G.cam.zoom = 0.9;
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
await page.waitForTimeout(800);
await page.screenshot({ path: 's4-orbit.png' });
// fly a fresh rocket on screen for a picture
await page.evaluate(() => { const G = window.__game, g = G.game, pad = g.buildings.find(b => b.type === 'pad'); pad.rocket = { fuel: 400 }; G.launchRocket(pad); G.toggleEngine(g.flying); for (let k = 0; k < 60; k++) G.tick(0.05); G.cam.zoom = 4; });
await page.waitForTimeout(800);
await page.screenshot({ path: 's4-flight.png' });
// save and reload
const saved = await page.evaluate(() => { const G = window.__game; G.game.flying = null; localStorage.clear(); const k = G.SAVE_KEY; G.game.started = true; window.__noSaveWas = 1; return true; });
console.log(errs.join('\n') || 'no errors');
await browser.close();
