import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
await page.evaluate(() => localStorage.clear()); await page.reload();
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  for (const t of ['wheel', 'rocketry', 'electricity', 'spaceflight', 'reusable', 'domes']) G.completeTech(t, true);
  const fill = C => { C.res.iron = 2000; C.res.stone = 2000; C.res.oil = 600; C.res.wood = 900; C.res.wheat = 600; C.res.chips = 600; C.res.silicon = 600; C.res.cobalt = 600; C.res.gold = 600; };
  fill(A);

  { G.completeTech('computing', true); fill(A); let ci = -1; for (let r = 4; r < 30 && ci < 0; r++) for (let dx = -r; dx <= r && ci < 0; dx++) for (const dy of [-r, r]) { const i = G.idx(Math.floor(A.lx) + dx, Math.floor(A.ly) + dy); if (!G.canBuild(i, 'computer') && G.countryAt(i) === A) { ci = i; break; } }
    G.tryBuild(ci, 'computer'); for (let k = 0; k < 500 && G.buildingAt(ci)?.site; k++) { fill(A); run(1); } }
  const spotIn = (C, type, r0 = 3) => { for (let r = r0; r < 14; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const i = G.idx(Math.floor(C.lx) + dx, Math.floor(C.ly) + dy); if (!G.canBuild(i, type) && G.countryAt(i) === C) return i; } return -1; };
  const pi = spotIn(A, 'pad'); G.tryBuild(pi, 'pad');
  const li = spotIn(A, 'lpad', 5); G.tryBuild(li, 'lpad');
  for (let k = 0; k < 400 && (G.buildingAt(pi).site || G.buildingAt(li).site); k++) { fill(A); run(1); }
  const pad = G.buildingAt(pi); pad.rocket = { fuel: 400 }; A.people = 140; fill(A);
  window.__sc = [G.startColony(pad, 1), document.getElementById('toast').textContent, document.querySelector('#modal.show #md-text')?.innerText.slice(0,200)];
  const M = G.arrays(); let site = -1; for (let r = 0; r < 200 && site < 0; r++) { const i = G.idx(500 + r, 500); if (M.biome[i] === 2 && M.depositOf[i] < 0) site = i; }
  G.pickColonySite(site);
  window.__dbg = [window.__sc, !!G.buildingAt(pi).site, !!G.buildingAt(li).site, g.colonyShips.length, document.getElementById('toast').textContent];
  run(35);
  G.viewWorld(1);
  const C2 = G.activeCountry(); if (!C2) return [['dbg', window.__dbg]]; fill(C2);
  const mp = spotIn(C2, 'pad', 2); G.tryBuild(mp, 'pad');
  const ml = spotIn(C2, 'lpad', 4); G.tryBuild(ml, 'lpad');
  for (let k = 0; k < 900 && (G.buildingAt(mp)?.site || G.buildingAt(ml)?.site); k++) { fill(C2); run(1); }
  log.push(['moon pads', !G.buildingAt(mp)?.site, !G.buildingAt(ml)?.site, 'moon cars', g.cars.length]);
  // the Moon base wants a refinery-sized build it can't afford: it asks to ship in from Earth
  G.viewWorld(1);
  for (const r in C2.res) C2.res[r] = 0;
  C2.res.stone = 10; C2.res.wood = 10;
  G.completeTech('electronics', true);
  const ri = spotIn(C2, 'chipfab', 3);
  const r1 = G.tryBuild(ri, 'chipfab');
  const md = document.querySelector('#modal.show #md-text')?.innerText || '';
  log.push(['ask on the moon', r1, md.replace(/\s+/g, ' ').slice(0, 260)]);
  const yes = [...document.querySelectorAll('#md-btns button')].find(x => x.textContent.startsWith('Ship in'));
  yes && yes.click();
  log.push(['ordered', JSON.stringify(g.shipIns), 'site', !!G.buildingAt(ri)?.site, JSON.stringify(G.buildingAt(ri)?.site?.need)]);
  G.showBuildingCard(G.buildingAt(ri));
  log.push(['card', document.getElementById('bc-body')?.innerText.slice(0, 200)]);
  G.viewWorld(0);
  fill(A);
  G.buyShuttle(pad);
  const sh = g.shuttles[0];
  const seen = []; let last = '', builtAt = -1;
  for (let k = 0; k < 4000 && builtAt < 0; k++) { A.res.oil = 600; G.tick(0.25); const st = sh.state + '@w' + sh.w + (sh.plan[0] ? '>' + (sh.plan[0].w ?? 'st') + (sh.plan[0].order ? '#order' : '') : ''); if (st !== last) { seen.push(st + ' t' + Math.round(k / 4) + ' cargo ' + JSON.stringify(sh.cargo)); last = st; }
    if (k % 20 === 0) { G.viewWorld(1); if (!G.buildingAt(ri)?.site) builtAt = Math.round(k / 4); G.viewWorld(0); } }
  log.push(['states', seen.join(' | ')]);
  log.push(['chip factory built on the moon at', builtAt, 'orders left', g.shipIns.length]);
  // troops by rocket: a base on the moon, troops from a home base
  G.viewWorld(1); fill(C2); const mb = spotIn(C2, 'base', 3); G.tryBuild(mb, 'base'); for (let k = 0; k < 60 && G.buildingAt(mb)?.site; k++) { fill(C2); G.rushSite(G.buildingAt(mb)); C2.res.gold = 999; G.tick(0.5); }
  const moonBase = G.buildingAt(mb); const mu0 = moonBase ? moonBase.units || 0 : -1;
  G.viewWorld(0); fill(A); const hb = spotIn(A, 'base', 5); G.tryBuild(hb, 'base'); for (let k = 0; k < 60 && G.buildingAt(hb)?.site; k++) { fill(A); G.rushSite(G.buildingAt(hb)); A.res.gold = 999; G.tick(0.5); }
  const homeBase = G.buildingAt(hb); homeBase.units = 30;
  const ok = (0, eval)(`transferTroops(${hb}, 12, 1, ${C2.id})`);
  log.push(['troops to the moon', ok, 'convoys', g.shipments.filter(S => S.troops).length]);
  let flew = false; for (let k = 0; k < 600; k++) { G.tick(0.25); if (g.troopFlights.length) flew = true; if (flew && !g.troopFlights.length && !g.shipments.some(S => S.troops)) break; }
  G.viewWorld(1);
  log.push(['flew', flew, 'moon base troops gained', (G.buildingAt(mb)?.units || 0) - mu0]);
  G.viewWorld(0);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
console.log(errs.join('\n') || 'no errors');
await browser.close();
