import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 880 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push('CONSOLE ' + m.text()); });
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  log.push(['rare deposits at home', G.deposits.filter(d => d.type === 'silicon').length, G.deposits.filter(d => d.type === 'cobalt').length]);
  for (const t of ['warrior', 'wheel', 'masonry', 'metallurgy', 'horses', 'carriages', 'steam', 'electricity', 'electronics', 'batteries', 'computing']) G.completeTech(t, true);
  for (let k = 0; k < 8; k++) { A.people = A.cap + 300; G.setPct(100); G.startPush(cx + (k % 2 ? 40 : -40), cy + ((k % 3) - 1) * 10); run(12); }
  const fill = () => Object.assign(A.res, { wood: 2000, stone: 2000, iron: 900, silicon: 300, cobalt: 200, chips: 300, gold: 400, oil: 300 });
  fill();
  const spotNear = (x, y, type) => { for (let r = 0; r < 16; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const i = G.idx(x + dx, y + dy); if (!G.canBuild(i, type) && G.countryAt(i) === A) return i; } return -1; };
  const built = {};
  for (const [t, x, y] of [['burner', 6, -6], ['burner', 8, -6], ['burner', 10, -6], ['burner', 12, -6], ['solar', -6, -8], ['chipfab', -10, 6], ['computer', 4, 8], ['datacenter', 10, 8], ['datacenter', 12, 8]]) { const i = spotNear(cx + x, cy + y, t); built[t + i] = G.tryBuild(i, t); }
  log.push(['build attempts', Object.values(built).join(',')]);
  for (let k = 0; k < 900 && g.buildings.some(b => b.site); k++) { fill(); run(1); }
  log.push(['sites left', g.buildings.filter(b => b.site).length, 'second computer?', G.canBuild(spotNear(cx - 4, cy - 10, 'computer'), 'computer')]);
  const chips0 = A.res.chips; A.res.chips = 0; run(30);
  log.push(['chips made in 30s', A.res.chips.toFixed(2), 'silicon used', (300 - A.res.silicon).toFixed(1)]);
  const fx = G.compFx(A);
  log.push(['computer fx', JSON.stringify(fx, (k, v) => k === 'b' ? undefined : typeof v === 'number' ? Math.round(v * 100) / 100 : v), 'sat', A.sat, 'power', JSON.stringify(A.mw)]);
  // batteries
  G.craft('battery', 5); run(20);
  log.push(['batteries', A.res.batteries, 'charge', Math.round(A.charge || 0)]);
  // rockets need a computer: we have one. Marks + range
  G.completeTech('rocketry', true); G.completeTech('spaceflight', true); G.completeTech('reusable', true);
  fill();
  const pi = spotNear(cx - 12, cy - 12, 'pad'); G.tryBuild(pi, 'pad'); for (let k = 0; k < 900 && G.buildingAt(pi).site; k++) { fill(); run(1); }
  G.buyShuttle(G.buildingAt(pi));
  const sh = g.shuttles[0];
  log.push(['shuttle', !!sh, sh && G.shRange(sh), 'reach moon', sh && G.canReachWorld(sh, 1), 'reach aries', sh && G.canReachWorld(sh, 2)]);
  G.upgradeShuttle(sh, A);
  log.push(['after Mk II', sh.mk, G.shRange(sh), 'aries', G.canReachWorld(sh, 2)]);
  // computer upgrades to the AI
  const cb = G.compOf(A);
  for (const t of ['mccs', 'qca', 'cais']) { G.completeTech(t, true); fill(); Object.assign(A.res, { chips: 900, silicon: 600, cobalt: 300, gold: 900 }); G.upgradeComputer(cb); }
  log.push(['computer level', cb.lvl, 'range now', G.shRange(sh)]);
  const st = G.aiState(cb); st.energy = 0.8; st.pct = 0.5;
  for (const k of ['build', 'grid', 'trade', 'logistics', 'roads', 'warning', 'gambit', 'research', 'war', 'diplo']) st.cmds[k] = true;
  run(5);
  log.push(['AI compute', G.aiCompute(A), 'aiMW', Math.round(A.aiMW || 0)]);
  for (let k = 0; k < 60; k++) { Object.assign(A.res, { stone: 1500, wood: 1500, iron: 700 }); run(2); }
  log.push(['AI log', st.log.join(' | ')]);
  // settlement inventories
  const S = g.buildings.filter(b => b.type === 'settlement' && G.countryAt(b.i) === A);
  log.push(['settlements', S.length, 'inv sums wood', Math.round(S.reduce((t, b) => t + ((b.inv || {}).wood || 0), 0)), 'vs master', Math.round(A.res.wood)]);
  log.push(['pull', S.map(b => G.invPull(b, A).w.toFixed(2)).join(',')]);
  G.showBuildingCard(cb);
  log.push(['computer card', document.getElementById('bc-body').innerText.slice(0, 260)]);
  G.showAIPanel(cb);
  log.push(['AI panel', document.querySelector('#md-text').innerText.slice(0, 200)]);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
await page.waitForTimeout(300);
await page.screenshot({ path: 'r6-ai.png' });
await page.evaluate(() => { document.querySelector('#md-text [data-tab="war"]').click(); });
await page.waitForTimeout(300);
await page.screenshot({ path: 'r6-ai-war.png' });
await page.evaluate(() => { document.querySelector('#md-btns button').click(); const G = window.__game; G.toggleBuildMenu(true); document.querySelector('#bm-grid').scrollTop = 99999; });
await page.waitForTimeout(400);
await page.screenshot({ path: 'r6-craft.png' });
console.log(errs.join('\n') || 'no errors');
await browser.close();
