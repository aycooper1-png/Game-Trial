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
  const C0 = G.activeCountry();
  const cx = Math.floor(C0.lx), cy = Math.floor(C0.ly);
  // nearest nation
  const n = g.nations.slice().sort((a, b) => Math.hypot(a.lx - cx, a.ly - cy) - Math.hypot(b.lx - cx, b.ly - cy))[0];
  log.push(['target', n.full, n.pers.name, Math.round(Math.hypot(n.lx - cx, n.ly - cy)), Math.round(n.units)]);
  for (const t of ['warrior', 'wheel', 'masonry', 'metallurgy']) G.completeTech(t);
  G.setPct(100);
  for (let k = 0; k < 40 && !G.frontWith(n, Math.floor(n.lx), Math.floor(n.ly)); k++) { C0.people = C0.cap; C0.res.wheat += 50; G.startPush(Math.floor(n.lx), Math.floor(n.ly)); run(12); }
  log.push(['touching', !!G.frontWith(n, Math.floor(n.lx), Math.floor(n.ly)), C0.tiles]);
  // army
  C0.res.wood += 500; C0.res.stone += 500;
  const free = [];
  for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) { const i = G.idx(cx + dx, cy + dy); if (!G.canBuild(i, 'base')) free.push(i); }
  G.tryBuild(free[0], 'base'); G.tryBuild(free[7], 'fort');
  for (const b of G.garrisons()) b.units = b.type === 'fort' ? 80 : 20;
  const tilesBefore = n.tiles;
  G.setTroopPct(100);
  const ok = G.launchAttack(n, Math.floor(n.lx), Math.floor(n.ly));
  log.push(['attack launched', ok, g.armies.length, g.attacks.map(a => a.coming)]);
  for (let s = 0; s < 12; s++) { run(5); log.push(['t', s * 5 + 5, 'armies', g.armies.map(a => Math.round(a.n)).join(','), 'attack', g.attacks.map(a => `${Math.round(a.units)}+${Math.round(a.coming)}`).join(','), 'their units', Math.round(n.units), 'their tiles', n.tiles]); }
  log.push(['conquered', tilesBefore - n.tiles]);
  // raid against us
  n.hostile = true; n.units = 60; n.lastRaid = -999;
  for (const b of G.garrisons()) b.units = 30;
  G.aiThink(n);
  log.push(['raids', g.raids.map(r => r.budget)]);
  for (let s = 0; s < 6; s++) { run(5); log.push(['raid t', s * 5 + 5, g.raids.map(r => Math.round(r.budget)).join(','), 'our units', G.garrisons().map(b => Math.round(b.units)).join(','), 'our tiles', C0.tiles]); }
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
console.log(errs.join('\n') || 'no errors');
await page.screenshot({ path: 'shot-attack.png' });
await browser.close();
