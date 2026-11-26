import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry();
  for (const t of ['wheel', 'rocketry', 'electricity', 'spaceflight']) G.completeTech(t, true);
  const fill = C => { C.res.iron = 2000; C.res.stone = 2000; C.res.oil = 600; C.res.wood = 900; C.res.wheat = 600; C.res.chips = 600; C.res.silicon = 600; C.res.cobalt = 600; C.res.gold = 600; };
  fill(A);

  { G.completeTech('computing', true); fill(A); let ci = -1; for (let r = 4; r < 30 && ci < 0; r++) for (let dx = -r; dx <= r && ci < 0; dx++) for (const dy of [-r, r]) { const i = G.idx(Math.floor(A.lx) + dx, Math.floor(A.ly) + dy); if (!G.canBuild(i, 'computer') && G.countryAt(i) === A) { ci = i; break; } }
    G.tryBuild(ci, 'computer'); for (let k = 0; k < 900 && G.buildingAt(ci)?.site; k++) { fill(A); run(1); } }
  const spotIn = (C, type, r0 = 3) => { for (let r = r0; r < 14; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const i = G.idx(Math.floor(C.lx) + dx, Math.floor(C.ly) + dy); if (!G.canBuild(i, type) && G.countryAt(i) === C) return i; } return -1; };
  const pi = spotIn(A, 'pad'); G.tryBuild(pi, 'pad');
  for (let k = 0; k < 900 && G.buildingAt(pi).site; k++) { fill(A); run(1); }
  const pad = G.buildingAt(pi);
  const btns = () => [...document.querySelectorAll('#bc-btns button')].map(b => b.textContent + (b.disabled ? ' [off]' : ''));
  G.showBuildingCard(pad);
  log.push(['card before fuel', btns().join(' | ')]);
  pad.rocket = { fuel: 400, told: true };
  G.refreshCard(true);
  log.push(['card fuelled', btns().join(' | ')]);
  log.push(['hint line', document.getElementById('bc-body').innerText.split('\n').filter(l => l.includes('station')).join(' / ')]);
  const btn = [...document.querySelectorAll('#bc-btns button')].find(b => b.textContent.includes('Build a space station'));
  btn.click();
  log.push(['orders', g.stationOrders.length]);
  run(10);
  log.push(['stations after', G.myStations().length, 'pad supplies', pad.supply]);
  // reusable: duplicates, lock, mode
  G.completeTech('reusable', true); G.completeTech('domes', true); G.completeTech('dyson', true);
  fill(A); pad.rocket = { fuel: 100 };
  G.refreshCard(true);
  const b1 = btns(); log.push(['card w/ reusable', b1.join(' | ')]);
  log.push(['duplicates', b1.filter((x, i) => b1.indexOf(x) !== i).length]);
  G.buyShuttle(pad);
  const f0 = pad.rocket.fuel; run(5);
  log.push(['busy', G.padBusy(pad), 'own rocket fuel unchanged', pad.rocket.fuel === f0]);
  G.refreshCard(true);
  log.push(['card busy', btns().join(' | ')]);
  // reusable-only mode
  const tog = [...document.querySelectorAll('#bc-btns button')].find(b => b.textContent.includes('reusable rockets only')); tog.click();
  log.push(['card only', btns().join(' | ')]);
  window.__pad = pi;
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
await page.evaluate(() => { const G = window.__game, t = window.__pad; G.cam.follow = null; G.cam.anim = null; G.cam.x = t % G.W + 0.5; G.cam.y = (t / G.W | 0) + 0.5; G.cam.zoom = 14; G.toggleCmdMenu(false); });
await page.waitForTimeout(700);
await page.screenshot({ path: 'r5pad.png' });
console.log(errs.join('\n') || 'no errors');
await browser.close();
