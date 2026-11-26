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
  log.push(['boats', L.ships.length]);
  B.res.stone = 0; B.res.wood = 0; A.res.stone = 900; A.res.wood = 900;
  const r1 = G.tryBuild(fi, 'fort');
  const md = document.querySelector('#modal.show #md-text')?.innerText.replace(/\s+/g, ' ') || '';
  log.push(['ask', r1, md.slice(0, 300)]);
  [...document.querySelectorAll('#md-btns button')].find(x => x.textContent.startsWith('Import'))?.click();
  log.push(['site', !!G.buildingAt(fi)?.site, 'shipments (phantom porters)', g.shipments.length, 'yard jobs', g.hubJobs.length, JSON.stringify(g.hubJobs.map(H => [H.c, H.then.type, Math.round(G.boxSum ? 0 : 0)]))]);
  // follow it
  const seen = new Set(); let rider = false, bAtPort = 0, onBoat = 0, carOnWater = 0;
  for (let k = 0; k < 900 && G.buildingAt(fi)?.site; k++) {
    G.tick(0.05);
    for (const v of g.cars) { if (v.job) seen.add(v.country + ':' + v.job.type); if (!G.isLand(G.idx(Math.floor(v.x), Math.floor(v.y)))) carOnWater++; }
    if (L.ships.some(V => V.cargo && (V.cargo.req || []).some(q => q.rider))) rider = true;
    if (L.ships.some(V => V.cargo && (V.cargo.req || []).length)) onBoat++;
    if (k % 20 === 0) { /* */ }
  }
  for (let k = 0; k < 2500 && G.buildingAt(fi)?.site; k++) { run(1); for (const v of g.cars) if (v.job) seen.add(v.country + ':' + v.job.type); if (L.ships.some(V => V.cargo && (V.cargo.req || []).some(q => q.rider))) rider = true; }
  log.push(['jobs seen', [...seen].join(' '), 'rider aboard', rider, 'ticks with goods aboard', onBoat, 'car ticks on water', carOnWater]);
  log.push(['B cars now', g.cars.filter(v => v.country === B.id).length, 'fort built', !G.buildingAt(fi)?.site, 'shipments', g.shipments.length]);
  const st = G.buildingAt(fi)?.site;
  log.push(['site state', st && JSON.stringify({ need: st.need, imported: st.imported, ready: st.ready, car: st.car, crew: st.crew, imp: st.imp }), 'hubJobs', JSON.stringify(g.hubJobs.map(H => [H.c, H.at, H.then.type, H.car])), 'req', JSON.stringify(L.req), 'boat', JSON.stringify(L.ships.map(V => [V.t, V.dir, V.cargo && (V.cargo.req || []).length]))]);
  log.push(['B cars', JSON.stringify(g.cars.filter(v => v.country === B.id).map(v => [Math.round(v.x), Math.round(v.y), v.job && v.job.type, v.act, v.idle]))]);
  window.__AB = [A.id, B.id, pa, pb];
  // troops from A to B's fort: march to the port, by boat, march on
  A.res.wood = 900; A.res.stone = 900;
  const bi = spot(A, 'base'); G.tryBuild(bi, 'base'); for (let k = 0; k < 60 && G.buildingAt(bi)?.site; k++) { G.rushSite(G.buildingAt(bi)); A.res.gold = 999; run(1); }
  const base = G.buildingAt(bi), fort = G.buildingAt(fi);
  const sendAndWatch = (n) => {
    base.units = 40; fort.units = 0; const u0 = 0; window.__t0 = E('garrisons()').map(b => [b.type, Math.round(b.units || 0)]);
    const ok = E(`transferTroops(${bi}, ${n}, 0, ${B.id})`);
    const kinds = new Set(); let onBoat = false;
    for (let k = 0; k < 6000 && ((fort.units || 0) - u0 < n - 0.5 || g.shipments.some(S => S.troops)); k++) { G.tick(0.05); for (const S of g.shipments) if (S.troops) kinds.add(S.legs[S.li].kind); if (L.ships.some(V => V.cargo && (V.cargo.req || []).some(q => q.troops))) onBoat = true; }
    const tot = () => E('garrisons()').reduce((a, b) => a + (b.units || 0), 0) + g.shipments.reduce((a, S) => a + (S.troops || 0), 0) + g.links.reduce((a, L2) => a + [...L2.req.a, ...L2.req.b].reduce((x, q) => x + (q.troops || 0), 0) + L2.ships.reduce((x, V) => x + ((V.cargo && V.cargo.req) || []).reduce((y, q) => y + (q.troops || 0), 0), 0), 0);
    return [ok, 'troops in all now', Math.round(tot()), 'legs seen', [...kinds].join(','), 'on a real boat', onBoat, 'arrived', Math.round((fort.units || 0) - u0), 'time', Math.round(g.time)];
  };
  log.push(['troops by boat', ...sendAndWatch(10), JSON.stringify(window.__t0)]);
  L.ships.length = 0;
  G.completeTech('electronics', true);
  log.push(['troops, no boat, mechanized', ...sendAndWatch(10)]);
  // trade with a nation over the water: into B's port yard; and out of B through its port
  const nat = g.nations.filter(n => n.alive).sort((p, q) => Math.hypot(p.lx - B.lx, p.ly - B.ly) - Math.hypot(q.lx - B.lx, q.ly - B.ly)).find(n => !G.sameLand(G.idx(Math.floor(n.lx), Math.floor(n.ly)), Bs));
  if (nat) {
    g.shipments.length = 0; nat.R.delete('flight'); g.research.done.delete('flight');
    E(`shipGoods({ side: ${nat.id} }, { side: 'P', C: game.countries[${B.id}] }, { stone: 30 })`);
    const S = g.shipments[0];
    log.push(['nation -> B', S && S.legs.map(l => l.kind).join(','), S && S.on && S.on.kind, S && S.on && S.on.hub === pb]);
    for (let k = 0; k < 4000 && g.shipments.length; k++) G.tick(0.05);
    log.push(['landed in B port yard?', JSON.stringify(g.hubJobs.filter(H => H.at === pb).map(H => H.res))]);
    E(`shipGoods({ side: 'P', C: game.countries[${B.id}] }, { side: ${nat.id} }, { wood: 20 })`);
    log.push(['B -> nation: hauler job to port', JSON.stringify(g.hubJobs.filter(H => H.then.type === 'tradeOut').map(H => [H.at === Bs, H.then.port === pb]))]);
    for (let k = 0; k < 3000 && !g.shipments.length; k++) G.tick(0.05);
    log.push(['then the boat leaves', g.shipments[0] && g.shipments[0].legs.map(l => l.kind).join(',')]);
  } else log.push(['no nation across water']);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
const hud = await page.evaluate(() => { const G = window.__game, g = G.game, B = g.countries.find(c => c.alive && c.id !== 0) || g.countries[1]; G.cam.follow = null; G.cam.anim = null; G.cam.x = B.lx; G.cam.y = B.ly; G.cam.zoom = G.CFG.cityZoom + 1; G.updateHud(); return [...document.querySelectorAll('#topbar .terrn')].map(e => e.textContent).join(' | '); });
console.log('zoomed on territory:', hud);
await page.screenshot({ path: '/tmp/r13_hud.png', clip: { x: 0, y: 0, width: 1300, height: 90 } });
console.log(errs.slice(0, 4).join('\n') || 'no errors');
await browser.close();
