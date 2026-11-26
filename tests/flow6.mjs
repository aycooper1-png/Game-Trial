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
  const n = g.nations.slice().sort((a, b) => Math.hypot(a.lx - cx, a.ly - cy) - Math.hypot(b.lx - cx, b.ly - cy))[0];
  // expand toward the nation but stop ~20 tiles short
  G.setPct(100);
  for (let k = 0; k < 60; k++) { const p = G.strikePlan(n, Math.floor(n.lx), Math.floor(n.ly)); if (p) break; A.people = A.cap; A.res.wheat += 50; G.startPush(Math.floor(n.lx), Math.floor(n.ly)); run(10); }
  for (const t of ['warrior', 'wheel', 'masonry', 'metallurgy', 'horses', 'carriages', 'steam', 'petroleum', 'automobile']) G.completeTech(t);
  log.push(['reach', G.strikeReach(), 'plan', JSON.stringify(G.strikePlan(n, Math.floor(n.lx), Math.floor(n.ly)))]);
  A.res.wood += 500; A.res.stone += 500; A.res.iron = 100;
  let k = 0;
  for (let dy = -10; dy <= 10 && k < 1; dy++) for (let dx = -10; dx <= 10 && k < 1; dx++) { const i = G.idx(cx + dx, cy + dy); if (!G.canBuild(i, 'fort')) { G.tryBuild(i, 'fort'); k++; } }
  run(20);
  for (const b of G.garrisons()) b.units = 80;
  // fuel: motorized units burn oil; give some oil then run dry
  A.res.oil = 5;
  run(2);
  log.push(['oil rate', A.rates.oil.toFixed(2), 'fuel', A.fuel.toFixed(2), 'unit', G.unitStats().type.name]);
  run(20);
  log.push(['after 20s oil', A.res.oil.toFixed(1), 'noOil', A.noOil, 'unit now', G.unitStats().type.name, 'speed', G.unitStats().speed.toFixed(1), 'hauler', G.roadTierName]);
  // far attack
  const ok = G.launchAttack(n, Math.floor(n.lx), Math.floor(n.ly));
  const at = g.attacks[0];
  log.push(['far attack', ok, at && at.far, at && at.coming]);
  const a0 = g.armies[0];
  if (a0) log.push(['army', a0.n, 'pts', a0.pts.length, 'spd', a0.spd.slice(0, 8).map(v => v.toFixed(1)).join(','), 'from', JSON.stringify(a0.pts[0]), 'to', JSON.stringify(a0.pts[a0.pts.length - 1])]);
  run(3); if (a0) log.push(['after 3s', a0.k, a0.x.toFixed(1), a0.y.toFixed(1), a0.done, 'armies', g.armies.length]);
  const t0 = n.tiles;
  for (let s = 0; s < 14; s++) { run(5); const a = g.attacks[0]; log.push(['t', (s + 1) * 5, a ? `${Math.round(a.units)}+${Math.round(a.coming)} landed ${!!a.landed}` : 'over', 'their tiles', n.tiles]); }
  log.push(['taken', t0 - n.tiles]);
  // nukes
  for (const t of ['electricity', 'flight', 'rocketry', 'fission', 'nukes']) G.completeTech(t);
  A.res.stone = 500; A.res.iron = 200; A.res.oil = 100; A.res.uranium = 40;
  let si = -1;
  for (let dy = -12; dy <= 12 && si < 0; dy++) for (let dx = -12; dx <= 12 && si < 0; dx++) { const i = G.idx(cx + dx, cy + dy); if (!G.canBuild(i, 'silo')) si = i; }
  G.tryBuild(si, 'silo'); run(15);
  A.res.iron = 200; A.res.oil = 100; A.res.uranium = 40;
  const p0 = n.people;
  g.warhead = 'nuke';
  const sp = G.strikePlan(n, Math.floor(n.lx), Math.floor(n.ly)) || G.strikePlan(n, cx, cy);
  let tgt = -1, td = 1e9;
  for (let i = 0; i < G.W * G.W; i += 1) { if (G.aiOf[i] !== n.id + 1) continue; const d = Math.hypot(i % G.W - si % G.W, ((i / G.W) | 0) - ((si / G.W) | 0)); if (d > 40 && d < 100 && d < td) { td = d; tgt = i; } }
  const [tx, ty] = tgt >= 0 ? [tgt % G.W, (tgt / G.W) | 0] : [si % G.W + 60, (si / G.W) | 0];
  G.fireMissile(tx, ty);
  log.push(['fire toast', document.getElementById('toast').textContent, 'dist', Math.round(td)]);
  log.push(['missiles', g.missiles.length, g.missiles.map(m => m.nuke)]);
  run(8);
  log.push(['after launch: uranium left', A.res.uranium, 'blasts', g.blasts.length]);
  const p1 = n.people, u1 = n.units;
  G.explode(n.lx, n.ly, { w: 'missile', ai: -1, nuke: true });
  log.push(['direct nuke on their capital: people', Math.round(p1), '->', Math.round(n.people), 'units', Math.round(u1), '->', Math.round(n.units), 'hostile', n.hostile]);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
console.log(errs.join('\n') || 'no errors');
await browser.close();
