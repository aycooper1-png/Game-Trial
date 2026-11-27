import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry();
  run(5);
  // gold: stored
  A.res.gold = 200; run(1);
  log.push(['treasury', Math.round(G.treasury()), 'boost', JSON.stringify(G.goldBoost())]);
  log.push(['gold HUD', document.getElementById('val-gold').innerText.replace(/\n/g, ' ')]);
  G.showMarket();
  log.push(['market rows', document.querySelectorAll('#md-text .mk-row').length]);
  const w0 = A.res.wood; G.marketTrade(A, 'wood', 'buy'); log.push(['bought wood', Math.round(A.res.wood - w0), 'gold left', Math.round(A.res.gold)]);
  document.querySelector('#md-btns button').click();
  // rush a site
  A.res.wood = 300; A.res.stone = 300;
  const spot = (() => { for (let r = 3; r < 40; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const i = G.idx(Math.floor(A.lx) + dx, Math.floor(A.ly) + dy); if (!G.canBuild(i, 'farm') && G.countryAt(i) === A) return i; } })();
  G.tryBuild(spot, 'farm');
  const b = G.buildingAt(spot);
  log.push(['site', !!b.site, 'rush cost', G.rushCost(b)]);
  G.rushSite(b); log.push(['after rush', !b.site]);
  // nations
  const ns = g.nations.filter(n => n.alive);
  log.push(['needs of first', JSON.stringify(G.aiNeeds(ns[0]).map(([r, v]) => r + ':' + Math.round(v)))]);
  const n = ns[0];
  G.addOp('P', n.id, 60);
  log.push(['nonagg', JSON.stringify(G.aiTreaty(n, 'nonagg'))]);
  G.signTreaty(n, 'nonagg');
  log.push(['has treaty', !!G.treaty('nonagg', n.id)]);
  // breaking it
  const ops = ns.map(m => Math.round(G.getOp('P', m.id)));
  G.provoke(n);
  log.push(['broke: op with n', Math.round(G.getOp('P', n.id)), 'others before/after', ops.slice(1, 3).join(','), ns.slice(1, 3).map(m => Math.round(G.getOp('P', m.id))).join(',')]);
  // surrender: not losing
  log.push(['surrender early', JSON.stringify(G.aiSurrender(n, { res: { wood: 10 } }))]);
  // make them lose: take half their tiles away, kill troops
  let took = 0; const arr = G.arrays();
  for (let i = 0; i < 1000000 && took < n.tiles * 0.6; i++) if (arr.aiOf[i] === n.id + 1 && !G.buildingAt(i)) { arr.aiOf[i] = 0; took++; }
  n.tiles -= took; n.lost = (n.lost || 0) + n.units; n.units = Math.floor(n.units * 0.3);
  log.push(['losing', G.warLosing(n).toFixed(2), 'worth', Math.round(G.nationWorth(n))]);
  log.push(['small terms', JSON.stringify(G.aiSurrender(n, { res: { wood: 20 }, soldiers: 2 }))]);
  log.push(['total', JSON.stringify(G.aiSurrender(n, { total: true }))]);
  // ask all
  G.openDiplomacyAll();
  log.push(['all panel buttons', [...document.querySelectorAll('#diplo button[data-all]')].map(b => b.innerText.split('\n')[0]).join(' | ')]);
  G.askAll('research');
  log.push(['ask all research', document.querySelector('#diplo .dp-result').innerText.replace(/\n/g, ' / ')]);
  // single panel
  G.openDiplomacy(ns[2]);
  log.push(['nation panel treaty buttons', [...document.querySelectorAll('#diplo .dp-treat button')].map(b => b.innerText.split('\n')[0].slice(0, 30)).join(' | ')]);
  // AI offers: needs only
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
await page.evaluate(() => { window.__game.openDiplomacyAll(); });
await page.waitForTimeout(400);
await page.screenshot({ path: 'r5dip-all.png' });
await page.evaluate(() => { const G = window.__game; G.openDiplomacy(G.game.nations.filter(n => n.alive)[0]); });
await page.waitForTimeout(400);
await page.screenshot({ path: 'r5dip-one.png' });
await page.evaluate(() => { const G = window.__game; G.surrenderDialog([G.game.nations.filter(n => n.alive)[0]]); });
await page.waitForTimeout(400);
await page.screenshot({ path: 'r5dip-terms.png' });
await page.evaluate(() => { document.querySelector('#md-btns button:last-child').click(); window.__game.showMarket(); });
await page.waitForTimeout(400);
await page.screenshot({ path: 'r5market.png' });
console.log(errs.join('\n') || 'no errors');
await browser.close();
