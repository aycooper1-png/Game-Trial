import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 860 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry();
  // hunger: fields feed fewer than eat, but stores exist
  A.people = A.cap; A.res.wheat = 200;
  const farms = g.buildings.filter(b => b.type === 'farm');
  for (const f of farms) G.removeBuilding(f.i);
  run(5);
  log.push(['no farms, wheat', Math.round(A.res.wheat), 'hungry', A.hungry, 'growth', A.growth.toFixed(2), 'note', document.getElementById('bar-note').innerText]);
  A.res.wheat = 0.5; run(3);
  log.push(['out of wheat: hungry', A.hungry, 'growth', A.growth.toFixed(2)]);
  // trade
  const n = g.nations.find(n => n.alive);
  A.res.wood = 300; n.stock.stone = 200;
  G.doTrade(n, { give: { res: { wood: 50 } }, ask: { res: { stone: 40 } } });
  log.push(['shipments', g.shipments.map(S => S.kind + ' ' + Math.round(S.len) + ' tiles ' + JSON.stringify(S.res)).join(' | ')]);
  const st0 = A.res.stone;
  let t = 0; while (g.shipments.length && t < 200) { run(1); t++; }
  log.push(['arrived after', t, 's', 'stone gained', Math.round(A.res.stone - st0)]);
  window.__n = n.id;
  G.doTrade(n, { give: { res: { wood: 30 } }, ask: { res: { stone: 30 } } });
  run(2);
  const S = g.shipments[0]; window.__sh = S ? (() => { const f = S.d / S.len, a = S.pts[0], b = S.pts[S.pts.length - 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; })() : null;
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
await page.evaluate(() => { const G = window.__game, p = window.__sh; G.cam.follow = null; G.cam.anim = null; if (p) { G.cam.x = p[0]; G.cam.y = p[1]; } G.toggleCmdMenu(false); G.cam.zoom = 6; });
await page.waitForTimeout(700);
await page.screenshot({ path: 'trade4.png' });
console.log(errs.join('\n') || 'no errors');
await browser.close();
