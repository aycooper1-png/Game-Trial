import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 880 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push('CONSOLE ' + m.text()); });
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
await page.evaluate(() => window.__game.toggleCmdMenu(true));
await page.click('#cmdmenu [data-act="debug"]');
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  for (let k = 0; k < 10; k++) { A.people = A.cap + 300; G.setPct(100); G.startPush(cx + ((k % 4) - 1.5) * 40, cy + ((k % 3) - 1) * 30); run(10); }
  const spotNear = (x, y, type) => { for (let r = 0; r < 20; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const i = G.idx(x + dx, y + dy); if (!G.canBuild(i, type) && G.countryAt(i) === A) return i; } return -1; };
  const list = [['computer', 0, 10], ...Array.from({ length: 16 }, (_, k) => ['datacenter', -24 + k * 3, 14 + (k % 2) * 3]), ...Array.from({ length: 6 }, (_, k) => ['burner', -12 + k * 5, -14]), ['base', 8, 4], ['fort', 20, 0], ['fort', -20, 0]];
  for (const [t, x, y] of list) G.tryBuild(spotNear(cx + x, cy + y, t), t);
  for (let k = 0; k < 3000 && g.buildings.some(b => b.site); k++) run(1);
  const cb = G.compOf(A);
  cb.lvl = 3;
  const st = G.aiState(cb); st.energy = 1; st.pct = 0.6; st.troops = 0.5;
  for (const k of ['build', 'grid', 'trade', 'logistics', 'roads', 'warning', 'gambit', 'research', 'war', 'diplo']) st.cmds[k] = true;
  for (let k = 0; k < 60; k++) run(2);
  log.push(['compute', G.aiCompute(A), 'aiMW', Math.round(A.aiMW), 'power', JSON.stringify(A.mw)]);
  for (const b of G.garrisons()) b.units = 60;
  const n = g.nations.filter(n => n.alive).sort((p, q) => Math.hypot(p.lx - A.lx, p.ly - A.ly) - Math.hypot(q.lx - A.lx, q.ly - A.ly))[0];
  for (const strat of ['pillage', 'conquest', 'guerrilla', 'defensive']) {
    st.strat = strat;
    G.setWar('P', n.id, true);
    for (let k = 0; k < 40; k++) run(2);
    log.push([strat, 'walls', g.walls.length, 'forts', g.buildings.filter(b => b.type === 'fort').length, 'attacks', g.attacks.length, 'pillage', !!st.pillage]);
  }
  log.push(['compute at end', G.aiCompute(A), 'dcs', g.buildings.filter(b => b.type === 'datacenter').length, 'plants', g.buildings.filter(b => b.type === 'burner').length]);
  log.push(['AI log', st.log.join(' | ')]);
  log.push(['bent roads', G.roadsList2().filter(r => r.bent).length]);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
console.log(errs.slice(0, 6).join('\n') || 'no errors');
await browser.close();
