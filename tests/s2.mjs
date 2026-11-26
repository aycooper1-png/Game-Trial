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
  A.res.wood = 300;
  let r = G.aiConsider(n, { give: { res: { wood: 100 } }, ask: { res: { stone: 50 } } });
  log.push(['100 wood for 50 stone', JSON.stringify(r)]);
  if (r.accept) G.doTrade(n, { give: { res: { wood: 100 } }, ask: { res: { stone: 50 } } });
  log.push(['opinion', G.getOp('P', n.id).toFixed(1), 'stone', Math.round(A.res.stone)]);
  r = G.aiConsider(n, { give: { res: { wood: 10 } }, ask: { res: { stone: 80 } } });
  log.push(['bad deal', JSON.stringify(r)]);
  log.push(['ally at op', G.getOp('P', n.id).toFixed(0), JSON.stringify(G.aiAlly(n, 'new'))]);
  G.addOp('P', n.id, 50);
  log.push(['ally', JSON.stringify(G.aiAlly(n, 'new')), 'alliance', JSON.stringify(G.allianceOf('P'))]);
  const theirs = g.buildings.find(b => b.type === 'settlement' && G.aiOf[b.i] === n.id + 1);
  const land = G.settlementLand(theirs).length;
  A.res.wood = 600; A.res.stone = 600;
  const offer = { give: { res: { wood: 500, stone: 500 } }, ask: { res: {}, towns: [theirs.i] } };
  r = G.aiConsider(n, offer);
  log.push(['buy a settlement (' + land + ' tiles)', JSON.stringify(r)]);
  const t0 = g.countries.reduce((a, c) => a + (c.alive ? c.tiles : 0), 0);
  if (r.accept) { G.doTrade(n, offer); run(1); log.push(['tiles gained', g.countries.reduce((a, c) => a + (c.alive ? c.tiles : 0), 0) - t0, 'owner of town', G.owner[theirs.i]]); }
  G.setPct(100);
  for (let k = 0; k < 60 && !G.frontWith(n, Math.floor(n.lx), Math.floor(n.ly)); k++) { A.people = A.cap; A.res.wheat += 50; G.startPush(Math.floor(n.lx), Math.floor(n.ly)); run(8); }
  G.completeTech('warrior'); G.completeTech('masonry');
  A.res.wood += 300; A.res.stone += 300;
  let k2 = 0;
  const [ft, ot] = G.frontWith(n, Math.floor(n.lx), Math.floor(n.ly)); const fx = ot % G.W, fy = (ot / G.W) | 0;
  for (let r = 6; r < 25 && k2 < 1; r++) for (let dy = -r; dy <= r && k2 < 1; dy++) for (let dx = -r; dx <= r && k2 < 1; dx++) { const i = G.idx(fx + dx, fy + dy); if (!G.canBuild(i, 'fort')) { G.tryBuild(i, 'fort'); k2++; log.push(['fort at dist', r]); } }
  for (const b of g.buildings) if (b.type === 'fort' && G.owner[b.i] && b.site) { b.site = null; } G.recomputeBuildings(); log.push(['fort ready', G.garrisons().length, 'after', g.time.toFixed(0)]);
  run(25);
  for (const b of G.garrisons()) b.units = 80;
  g.alliances = [];
  G.setWar('P', n.id, true); g.raids = []; n.units = 120; n.lastRaid = -999;
  G.aiThink(n);
  log.push(['raids', g.raids.map(q => q.budget)]);
  for (let s = 0; s < 10; s++) { run(4); log.push(['t', (s + 1) * 4, 'raid', g.raids.map(q => Math.round(q.budget)).join(','), 'defenders', g.attacks.filter(a => a.defend).map(a => `${Math.round(a.units)}+${Math.round(a.coming)}`).join(','), 'lost tiles', g.lost.size, 'fort units', G.garrisons().map(b => Math.round(b.units)).join(',')]); }
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
await page.evaluate(() => { const G = window.__game, n = G.game.nations[0]; G.openDiplomacy(n, Math.floor(n.lx), Math.floor(n.ly)); });
await page.waitForTimeout(500);
await page.screenshot({ path: 's2.png' });
console.log(errs.join('\n') || 'no errors');
await browser.close();
