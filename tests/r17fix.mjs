import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
await page.evaluate(() => localStorage.clear()); await page.reload();
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(async () => {
  const G = window.__game, g = G.game, log = [], E = s => (0, eval)(s);
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry();
  for (const t of ['warrior', 'wheel', 'masonry', 'sailing']) G.completeTech(t, true);
  A.people = A.cap + 300; A.res.wood = 999; A.res.stone = 999;

  // ---- one territory only: nothing should talk about shipping in ----
  const card = b => { G.showBuildingCard(b); return { btns: [...document.querySelectorAll('#bc-btns button')].map(x => x.textContent + (x.disabled ? ' [off]' : '')), text: document.getElementById('bc-body').innerText.replace(/\s+/g, ' ').slice(0, 260) }; };
  const modal = () => (document.querySelector('#modal.show #md-text')?.innerText.replace(/\s+/g, ' ') || '').slice(0, 330);
  const click = t => { const x = [...document.querySelectorAll('#md-btns button')].find(x => x.textContent.startsWith(t)); if (x) x.click(); return !!x; };
  const S0 = g.buildings.find(b => b.type === 'settlement' && G.owner[b.i]);
  { A.res.wood = 3; A.res.stone = 3;
    let spot = -1; for (let r = 3; r < 20 && spot < 0; r++) for (let dx = -r; dx <= r && spot < 0; dx++) { const i = G.idx(Math.floor(A.lx) + dx, Math.floor(A.ly) + r); if (!G.canBuild(i, 'fort')) spot = i; }
    G.setTool('fort'); g.ghost.i = spot; g.ghost.set = true; E('updateConfirm()');
    log.push(['1 territory, short: confirm line', document.querySelector('#cf-info .cf-line').innerText]);
    G.toggleBuildMenu(true); log.push(['build menu says', document.getElementById('bm-sub').textContent]); G.toggleBuildMenu(false);
    const r = G.tryBuild(spot, 'fort'); log.push(['build', r, 'toast', document.getElementById('toast').textContent, 'modal', modal()]);
    G.setTool(null);
    A.res.gold = 0; log.push(['buy porter, short', (A.res.wood = 0, G.buyVehicle('car', S0.i), document.getElementById('toast').textContent), 'modal', modal()]);
    log.push(['request porter, 1 settlement', (E('askPorter')(S0), modal())]); click('OK');
    log.push(['settlement card', JSON.stringify(card(S0).btns)]);
  }
  // ---- upgrades: every hauler that stops empty in a settlement refits ----
  { A.res.wood = 999; A.res.stone = 999; A.res.iron = 999;
    let spot = -1; for (let r = 6; r < 25 && spot < 0; r++) for (let dx = -r; dx <= r && spot < 0; dx++) { const i = G.idx(Math.floor(A.lx) + dx, Math.floor(A.ly) + r); if (!G.canBuild(i, 'fort')) spot = i; }
    G.tryBuild(spot, 'fort');                       // a site: haulers come in empty to load for it
    let lv = null; for (let k = 0; k < 30 * 20 && !lv; k++) { G.tick(0.05); lv = g.cars.find(v => v.act === 'loadSite' && v.pts && Math.hypot(v.x - (S0.i % G.W + 0.5), v.y - (Math.floor(S0.i / G.W) + 0.5)) > 3); }
    G.orderUpgrade('car');
    log.push(['upgrade ordered: target', G.fleetTarget('car'), 'tiers before', g.cars.map(v => v.tier).join(''), 'one is walking in empty to load for a site', !!lv]);
    if (lv) { let seen = null; for (let k = 0; k < 60 * 20 && !seen; k++) { G.tick(0.05); if (lv.act === 'deliver') seen = { tier: lv.tier, wait: +(lv.wait || 0).toFixed(1), load: Math.round(Object.values(lv.cargo).reduce((a, n) => a + n, 0)) }; } log.push(['it reached the settlement empty, and left for the site as', JSON.stringify(seen)]); }
    let waits = 0, firstAll = -1;
    for (let k = 0; k < 60 * 20; k++) { G.tick(0.05); if (g.cars.some(v => v.wait > 0)) waits++; if (firstAll < 0 && g.cars.every(v => v.tier >= 1)) firstAll = k / 20; }
    log.push(['tiers after 60 s', g.cars.map(v => v.tier).join(''), 'all refitted after s', firstAll, 'ticks spent in the workshop', waits]);
  }
  // ---- connect to road: far reach, and the option always there ----
  { const camp = g.buildings.find(b => G.owner[b.i] && ['camp', 'cabin'].includes(b.type) && !E('isConnected')(b));
    if (camp) { const was = G.CFG.roads.connectReach; G.CFG.roads.connectReach = 1; const P = G.connectPlan(camp); const far = G.CFG.roads.connectFar; G.CFG.roads.connectFar = 1; const c2 = card(camp); G.CFG.roads.connectFar = far;
      log.push(['nothing within reach 1: plan', P.why || 'ok, ' + P.cost.stone + ' stone', '| nothing within far reach either: buttons', JSON.stringify(c2.btns)]);
      G.CFG.roads.connectReach = was; E('refreshCard(true)'); log.push(['normal', JSON.stringify(card(camp).btns)]); }
    else log.push(['no unconnected camp to test']); }
  const cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  const M0 = G.arrays(), LM = E('landmass'), home = G.idx(cx, cy), size = new Map();
  for (let i = 0; i < G.W * G.W; i++) if (G.isLand(i)) size.set(LM[i], (size.get(LM[i]) || 0) + 1);
  let far = -1, fd = Infinity;
  for (let i = 0; i < G.W * G.W; i += 3) { if (!G.isLand(i) || M0.owner[i] || M0.aiOf[i] || size.get(LM[i]) < 400 || G.sameLand(i, home)) continue; const d = Math.hypot(i % G.W - cx, ((i / G.W) | 0) - cy); if (d < fd && d > 25) { fd = d; far = i; } }
  log.push(['far island at', far % G.W, Math.floor(far / G.W), Math.round(fd)]);
  G.setPct(50); G.launchExpedition(far % G.W, Math.floor(far / G.W), { auto: true });
  for (let k = 0; k < 120 && g.countries.filter(c => c.alive).length < 2; k++) run(1);
  const B = g.countries.find(c => c.alive && c !== A);
  log.push(['second territory', !!B, 'same land?', B && G.sameLand(G.idx(Math.floor(A.lx), Math.floor(A.ly)), G.idx(Math.floor(B.lx), Math.floor(B.ly)))]);
  if (!B) return log;
  for (const v of g.cars.filter(v => v.country === B.id)) v.gone = true; g.cars = g.cars.filter(v => !v.gone);
  log.push(['cars', 'A', g.cars.filter(v => v.country === A.id).length, 'B', g.cars.filter(v => v.country === B.id).length]);
  const Bs = g.buildings.find(b => b.type === 'settlement' && G.countryAt(b.i) === B).i;
  const spot = (C, type, r0 = 2) => { for (let r = r0; r < 80; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const i = G.idx(Math.floor(C.lx) + dx, Math.floor(C.ly) + dy); if (!G.canBuild(i, type) && G.countryAt(i) === C && (C !== B || G.sameLand(i, Bs))) return i; } return -1; };
  // 1) no ports yet: B can't import from A across the water
  B.res.stone = 0; B.res.wood = 0; A.res.stone = 900; A.res.wood = 900;
  document.querySelectorAll('#md-btns button').forEach(b => b.click());
  const fi = spot(B, 'fort');
  const r0 = G.tryBuild(fi, 'fort');
  log.push(['way', E(`importWay(game.countries[${A.id}], game.countries[${B.id}], ${fi})`), 'fi', fi % G.W, (fi / G.W) | 0, G.countryAt(fi)?.short, 'S', (() => { const S = E(`nearestSettlement(game.countries[${A.id}], ...tileCenter(${fi}))`); return S && [S.i % G.W, (S.i / G.W) | 0, G.sameLand(S.i, fi), G.landOf(S.i), G.landOf(fi)]; })()]);
  log.push(['no link: build?', r0, 'modal', document.querySelector('#modal.show #md-text')?.innerText.slice(0, 120), 'toast', document.getElementById('toast').textContent.slice(0, 160)]);
  // 2) ports in both: a sea route; a boat on it
  B.res.stone = 500; B.res.wood = 500;
  const portSpot = (C, T) => { let b = -1, bd = Infinity; for (let i = 0; i < G.W * G.W; i++) { if (G.countryAt(i) !== C || G.canBuild(i, 'port') || (C === B && !G.sameLand(i, Bs))) continue; const d = Math.hypot(i % G.W - T.lx, ((i / G.W) | 0) - T.ly); if (d < bd) { bd = d; b = i; } } return b; };
  // give A a strip of land out to its coast facing B
  { const home = G.idx(cx, cy); let c = -1, cd = Infinity; const M = G.arrays();
    for (let i = 0; i < G.W * G.W; i += 1) { if (!G.isLand(i) || M.aiOf[i] || !G.sameLand(i, home) || !E(`isCoastal(${i})`)) continue; const d = Math.hypot(i % G.W - B.lx, ((i / G.W) | 0) - B.ly); if (d < cd) { cd = d; c = i; } }
    const ex = c % G.W, ey = (c / G.W) | 0, n = Math.ceil(Math.hypot(ex - cx, ey - cy));
    for (let k = 0; k <= n; k++) for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]) { const x = Math.round(cx + (ex - cx) * k / n) + ox, y = Math.round(cy + (ey - cy) * k / n) + oy, i = G.idx(x, y); if (G.isLand(i) && !M.owner[i] && !M.aiOf[i]) G.claim(i, A.id); }
    run(1); log.push(['A coast', c % G.W, (c / G.W) | 0]); }
  const pa = portSpot(A, B), pb = portSpot(B, A);
  G.tryBuild(pa, 'port'); G.tryBuild(pb, 'port');
  for (let k = 0; k < 60 && [pa, pb].some(i => G.buildingAt(i)?.site); k++) { for (const i of [pa, pb]) if (G.buildingAt(i)?.site) G.rushSite(G.buildingAt(i)); A.res.gold = 999; B.res.gold = 999; run(1); }
  const L = g.links.find(L => L.kind === 'sea');
  log.push(['ports', pa, pb, 'sea link', !!L, L && [G.countryAt(L.a)?.short, G.countryAt(L.b)?.short]]);
  if (!L) return log;

  A.res.wood = 900; G.buyVehicle('boat', pa);
  log.push(['boats', L.ships.length, 'cars A', g.cars.filter(v => v.country === A.id).length, 'B', g.cars.filter(v => v.country === B.id).length]);
  document.querySelectorAll('#md-btns button').forEach(b => b.click());
  const SB = G.buildingAt(Bs);
  // ---- request porter: B has none, A's stand idle ----
  for (let k = 0; k < 20 * 20; k++) G.tick(0.05);
  log.push(['B settlement card', JSON.stringify(card(SB).btns)]);
  [...document.querySelectorAll('#bc-btns button')].find(x => x.textContent.startsWith('Request')).click();
  log.push(['request modal', modal()]);
  click('Confirm');
  log.push(['toast', document.getElementById('toast').textContent, 'called', g.cars.filter(v => v.call).length]);
  let arrived = -1, boarded = -1;
  for (let k = 0; k < 400 * 20 && arrived < 0; k++) { G.tick(0.05); if (boarded < 0 && [...L.req.a, ...L.req.b, ...L.ships.flatMap(V => (V.cargo && V.cargo.req) || [])].some(q => q.porter)) boarded = k / 20; if (g.cars.some(v => v.country === B.id && !v.call)) arrived = k / 20; }
  const vb = g.cars.find(v => v.country === B.id);
  log.push(['boarded the boat after s', boarded, 'arrived at B settlement after s', arrived, 'cars A', g.cars.filter(v => v.country === A.id).length, 'B', g.cars.filter(v => v.country === B.id).length, 'at settlement?', vb && Math.round(Math.hypot(vb.x - (Bs % G.W + 0.5), vb.y - (Math.floor(Bs / G.W) + 0.5)))]);
  // ---- buying a hauler in B, short of wood: import asked, bought on arrival ----
  const T0 = G.FLEET.car.tiers[Math.max(0, G.fleetTarget('car'))];
  for (const r in T0.cost) B.res[r] = 0; for (const r in T0.cost) A.res[r] = 900;
  const nB = g.cars.filter(v => v.country === B.id).length;
  log.push(['B card (short)', JSON.stringify(card(SB).btns)]);
  [...document.querySelectorAll('#bc-btns button')].find(x => x.textContent.startsWith('Buy')).click();
  log.push(['buy modal', modal()]);
  click('Import');
  let got = -1; for (let k = 0; k < 400 * 20 && got < 0; k++) { G.tick(0.05); if (g.cars.filter(v => v.country === B.id).length > nB) got = k / 20; }
  log.push(['hauler bought in B after s', got, 'pending', (g.pendingBuys || []).length, 'toast', document.getElementById('toast').textContent]);
  // ---- hiring troops in B, short of gold ----
  B.res.stone = 900; B.res.wood = 900; B.res.iron = 900; B.res.gold = 999;
  const fi3 = spot(B, 'fort'); G.tryBuild(fi3, 'fort');
  for (let k = 0; k < 90 && G.buildingAt(fi3)?.site; k++) { G.rushSite(G.buildingAt(fi3)); run(1); }
  const F = G.buildingAt(fi3); F.units = 0;
  B.res.gold = 0; A.res.gold = 900;
  log.push(['fort card (no gold in B)', JSON.stringify(card(F).btns)]);
  [...document.querySelectorAll('#bc-btns button')].find(x => x.textContent.startsWith('Hire')).click();
  log.push(['hire modal', modal()]);
  click('Import');
  let hired = -1; for (let k = 0; k < 1500 * 20 && hired < 0; k++) { G.tick(0.05); if ((F.units || 0) >= 10) hired = k / 20; }
  log.push(['troops hired after s', hired, 'units', Math.floor(F.units || 0), 'B gold left', Math.round(B.res.gold), 'A gold', Math.round(A.res.gold)]);
  // ---- with two territories, the build line says what will really happen ----
  B.res.stone = 0; B.res.wood = 0; A.res.stone = 900; A.res.wood = 900;
  const f2 = spot(B, 'fort', 4); G.setTool('fort'); g.ghost.i = f2; g.ghost.set = true; E('updateConfirm()');
  log.push(['2 territories, short: confirm line', document.querySelector('#cf-info .cf-line').innerText]);
  G.toggleBuildMenu(true); log.push(['build menu says', document.getElementById('bm-sub').textContent]);
  return log;
});
for (const l of out) console.log(l.join(' | '));
console.log(errs.join('\n') || 'no errors');
await browser.close();
