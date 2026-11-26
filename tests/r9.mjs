import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
await page.evaluate(() => localStorage.clear()); await page.reload();
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
// 3) the flag
await page.click('#topbar .flag');
await page.waitForTimeout(150);
console.log('insignia modal', await page.evaluate(() => document.querySelector('#modal.show .md-title')?.textContent));
await page.click('[data-sign="star"]'); await page.click('[data-col="#d94a4a"]');
await page.click('#md-btns button.go');
await page.waitForTimeout(300);
const ins = await page.evaluate(() => { const G = window.__game, A = G.activeCountry(), M = G.arrays(); let i = -1; for (let k = 0; k < M.owner.length; k++) if (M.owner[k]) { i = k; break; } return { hex: A.hex, sign: A.sign, flag: document.querySelector('#topbar .flag svg') ? 'svg' : 'none', modal: document.getElementById('modal').classList.contains('show') }; });
console.log('insignia', JSON.stringify(ins));
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [], M = G.arrays();
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const sv = JSON.parse(JSON.stringify(G.worldSave())); G.loadGame(sv);   // save/load keeps the flag
  const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  log.push(['flag after load', G.activeCountry().hex, G.activeCountry().sign]);
  // 4) settlement card
  const S = g.buildings.find(b => b.type === 'settlement' && G.countryAt(b.i) === A); G.showBuildingCard(S);
  log.push(['settlement stock grid', document.querySelectorAll('#bc-body .inv-res').length, document.querySelector('#bc-body .inv-grid')?.innerText.replace(/\n/g, ' ').slice(0, 80)]);
  // 1) water: two land points on different land, a porter asked to go across
  let far = -1, wetTile = -1;
  for (let r = 3; r < 600 && far < 0; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) { const i = G.idx(cx + dx, cy + dy); if (!G.isLand(i)) wetTile = i; else if (wetTile >= 0 && !G.sameLand(i, G.idx(cx, cy))) { far = i; break; } }
  const v = G.addCar(A, S, 0);
  const ok = far >= 0 ? G.carGo(v, far % G.W + 0.5, (far / G.W | 0) + 0.5, 'park') : 'no far land found';
  log.push(['porter told to cross water', ok, 'moving', !!v.pts]);
  // 7) road works: close a road and see it reopen
  for (const t of ['wheel', 'masonry', 'steam', 'metallurgy', 'horses', 'carriages']) G.completeTech(t, true);
  for (let k = 0; k < 14; k++) { A.people = A.cap + 300; G.setPct(100); G.startPush(cx + (k % 2 ? 60 : -60), cy + ((k % 3) - 1) * 6); run(12); }
  A.res.wood = 3000; A.res.stone = 3000; A.res.iron = 900;
  const spotNear = (x, y, type) => { for (let r = 0; r < 15; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const i = G.idx(x + dx, y + dy); if (!G.canBuild(i, type) && G.countryAt(i) === A) return i; } return -1; };
  A.people = A.cap + 400; const s2 = spotNear(cx + 30, cy, 'settlement'); G.tryBuild(s2, 'settlement');
  for (let k = 0; k < 60 && G.buildingAt(s2)?.site; k++) { G.rushSite(G.buildingAt(s2)); A.res.gold = 999; run(1); }
  G.buildRoads(); G.markNet();
  const R = G.roadsList().filter(r => r.side > 0);
  log.push(['roads', R.length, 'tiles', A.tiles, 's2', s2, G.buildingAt(s2)?.type, !!G.buildingAt(s2)?.site, 'setts', g.buildings.filter(b => b.type === 'settlement').length]);
  if (R.length) {
    const r = R[0], t = r.tiles[(r.tiles.length / 2) | 0];
    r.works = g.time + 6; G.markNet();
    log.push(['closed: road tile in network', G.NET[t] & 1]);
    run(8);
    log.push(['reopened', G.NET[t] & 1, 'works', r.works]);
    r.works = g.time + 30; G.markNet();
    window.__works = r.pts[(r.pts.length / 2) | 0];
  }
  // 2) a car rides the train: stations east and west, a trip end to end
  const sw = spotNear(cx - 48, cy, 'station'), se = spotNear(cx + 48, cy, 'station');
  for (const i of [sw, se]) G.tryBuild(i, 'station');
  for (let k = 0; k < 60 && [sw, se].some(i => G.buildingAt(i)?.site); k++) { for (const i of [sw, se]) if (G.buildingAt(i)?.site) G.rushSite(G.buildingAt(i)); A.res.gold = 999; run(1); }
  log.push(['stations', sw, se, G.canBuild(sw, 'station'), JSON.stringify(g.buildings.filter(b => b.type === 'station').map(b => !!b.site)), 'rail lines', g.links.filter(L => L.kind === 'rail').length]);
  const v2 = G.addCar(A, S, 0);
  v2.x = sw % G.W - 3 + 0.5; v2.y = (sw / G.W | 0) + 0.5;
  G.carGo(v2, se % G.W + 4.5, (se / G.W | 0) + 0.5, 'park'); v2.job = { type: 'park' };
  log.push(['car route rides the train', !!(v2.ride && v2.ride.some(Boolean)), 'legs', v2.pts && v2.pts.length]);
  let rode = 0; for (let k = 0; k < 400 && v2.pts; k++) { G.tick(0.1); if (v2.ride && v2.ride[v2.k]) rode++; if (rode === 30) { window.__ride = [v2.x, v2.y]; break; } }
  log.push(['ticks on the train', rode]);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
for (const [name, key] of [['works', '__works'], ['ride', '__ride']]) {
  const ok = await page.evaluate(k => { const G = window.__game; const p = window[k]; if (!p) return false; G.cam.follow = null; G.cam.anim = null; G.cam.zoom = 22; G.cam.x = p[0]; G.cam.y = p[1]; document.querySelectorAll('.note').forEach(e => e.remove()); G.showBuildingCard(null); window.__game.game.paused = true; return true; }, key);
  if (ok) { await page.waitForTimeout(300); await page.screenshot({ path: `/tmp/r9_${name}.png` }); }
}
await page.evaluate(() => { const G = window.__game; const S = G.game.buildings.find(b => b.type === 'settlement'); G.cam.x = S.i % G.W; G.cam.y = (S.i / G.W | 0); G.cam.zoom = 6; G.showBuildingCard(S); });
await page.waitForTimeout(300); await page.screenshot({ path: '/tmp/r9_card.png' });
console.log(errs.slice(0, 5).join('\n') || 'no errors');
await browser.close();
