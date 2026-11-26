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
  for (const r of ['wood', 'stone', 'iron', 'wheat', 'oil']) A.res[r] = 5000;
  run(3);
  // 6) upgrades: one model at a time
  for (const t of ['wheel', 'horses', 'carriages']) G.completeTech(t, true);
  const S = g.buildings.find(b => b.type === 'settlement' && G.owner[b.i]);
  G.showBuildingCard(S);
  const btn = () => [...document.querySelectorAll('#bc-btns button, #bcard button')].map(b => b.textContent).filter(t => /Upgrade|Buy/.test(t));
  log.push(['card buttons', btn().join(' | ')]);
  G.orderUpgrade('car');
  log.push(['target after one order', g.fleetTarget.car, 'card now', btn().join(' | ')]);
  G.orderUpgrade('car');
  log.push(['after a second order', g.fleetTarget.car]);
  const v0 = g.cars[0]; v0.tier = 0; E(`atHub(game.cars[0], game.countries[${A.id}])`);
  log.push(['a porter in the workshop climbs to', v0.tier, 'paying each step']);
  // 3) bought at a settlement: it appears there
  const Ss = g.buildings.filter(b => b.type === 'settlement' && G.countryAt(b.i) === A);
  const far = Ss.sort((p, q) => q.i - p.i)[0];
  const n0 = g.cars.length; G.buyVehicle('car', far.i);
  const nv = g.cars[g.cars.length - 1];
  log.push(['bought', g.cars.length - n0, 'at settlement', Math.hypot(nv.x - (far.i % G.W + 0.5), nv.y - (((far.i / G.W) | 0) + 0.5)).toFixed(2), 'tiles away']);
  // 8) a new road between two settlements: it swings past collectors when it's worth it
  { const cx = Math.floor(A.lx), cy = Math.floor(A.ly), M = G.arrays();
    for (let dy = -40; dy <= 40; dy++) for (let dx = -40; dx <= 40; dx++) { const i = G.idx(cx + dx, cy + dy); if (dx * dx + dy * dy < 1600 && G.isLand(i) && !M.owner[i] && !M.aiOf[i]) G.claim(i, A.id); }
    run(1);
    const S0 = g.buildings.find(b => b.type === 'settlement' && G.countryAt(b.i) === A), sx = S0.i % G.W, sy = (S0.i / G.W) | 0;
    let tgt = -1; for (const [dx, dy] of [[28, 0], [-28, 0], [0, 28], [0, -28], [20, 20], [-20, 20], [20, -20], [-20, -20]]) { const i = G.idx(sx + dx, sy + dy); if (!G.canBuild(i, 'settlement') && G.countryAt(i) === A) { tgt = i; break; } }
    const tx = tgt % G.W, ty = (tgt / G.W) | 0, len = Math.hypot(tx - sx, ty - sy), nx = -(ty - sy) / len, ny = (tx - sx) / len;
    const cabins = [];
    for (const [f, off] of [[0.3, 3.5], [0.55, -4], [0.75, 7.5]]) {
      for (let j = 0; j < 4; j++) { const x = Math.round(sx + (tx - sx) * f + nx * (off + j * 0.5)), y = Math.round(sy + (ty - sy) * f + ny * (off + j * 0.5)), i = G.idx(x, y); if (!G.canBuild(i, 'camp')) { G.tryBuild(i, 'camp'); cabins.push(i); break; } }
    }
    A.people = A.cap + 500; G.tryBuild(tgt, 'settlement');
    for (let k = 0; k < 60 && [tgt, ...cabins].some(i => G.buildingAt(i)?.site); k++) { for (const i of [tgt, ...cabins]) if (G.buildingAt(i)?.site) G.rushSite(G.buildingAt(i)); A.res.gold = 9999; run(1); }
    G.buildRoads(); run(1);
    const key = Math.min(S0.i, tgt) + ':' + Math.max(S0.i, tgt), rd = G.roadsList().find(r => r.key === key);
    log.push(['new road', !!rd, rd && Math.round(rd.len), 'straight', Math.round(len), 'collectors beside it', cabins.map(i => [G.buildingAt(i)?.type, Math.round(Math.min(...(rd ? rd.pts : [[0, 0]]).map(p => Math.hypot(p[0] - (i % G.W + 0.5), p[1] - (((i / G.W) | 0) + 0.5)))) * 10) / 10, E(`roadTouch(${i})`)])]);
    window.__road = [S0.i, tgt, cabins];
    { const r = G.roadsList().find(r => r.key === key); A.res.stone = 3000; r.busy = 1.2; for (let k = 0; k < 5; k++) G.tick(0.05); log.push(['busy road gets a second lane', r.lanes || 1, 'stone', Math.round(A.res.stone)]); }
    // the AI relays it to serve the camps
    let ci = -1; for (let r = 3; r < 20 && ci < 0; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) { const i = G.idx(sx + dx, sy + dy); if (!G.canBuild(i, 'computer') && G.countryAt(i) === A) { ci = i; break; } }
    G.completeTech('computing', true); for (const r of ['chips', 'iron', 'stone']) A.res[r] = 5000;
    E(`placeBuilding(${ci}, 'computer'); recomputeBuildings();`);
    const cb = G.buildingAt(ci); cb.lvl = 3;
    const st = G.aiState(cb); st.pct = 1; st.cmds.roads = true; st.ledger = null;
    { const r = G.roadsList().find(r => r.key === key); const bl = E(`aiRoadBlds(game.countries[${A.id}])`); const L = E(`roadServe(${r.a}, ${r.b}, ${r.side}, ${r.len * 1.5}, ${JSON.stringify(bl)})`);
      log.push(['debug', 'blds', bl.length, JSON.stringify(bl.filter(q => cabins.includes(q.i))), 'serve', L && Math.round(L.len), L && E(`roadScore(${JSON.stringify(L.pts)}, ${L.len}, ${JSON.stringify(bl)})`), E(`roadScore(${JSON.stringify(r.pts)}, ${r.len}, ${JSON.stringify(bl)})`)]); }
    for (const [cmp, tag] of [[8, 'low compute'], [40, 'high compute']]) {
      E(`aiCompute = () => ${cmp}`);
      const rd0 = G.roadsList().find(r => r.key === key); st.roadAt = -999;
      E(`aiDoRoads(buildingAt(${ci}), game.countries[${A.id}])`);
      const rd1 = G.roadsList().find(r => r.key === key);
      log.push([tag, 'stretch', E(`aiRoadStretch(game.countries[${A.id}])`), 'relaid', rd0 !== rd1, 'len', Math.round(rd1.len), 'first', Math.round(rd1.len0 || rd1.len), 'camp distances', cabins.map(i => Math.round(Math.min(...rd1.pts.map(p => Math.hypot(p[0] - (i % G.W + 0.5), p[1] - (((i / G.W) | 0) + 0.5)))) * 10) / 10), 'log', st.log[0]]);
      run(60);
    }
    st.spurs = true; st.roadAt = 0; E(`aiDoRoads(buildingAt(${ci}), game.countries[${A.id}])`); st.roadAt = 0; E(`aiDoRoads(buildingAt(${ci}), game.countries[${A.id}])`);
    log.push(['spurs', st.log.slice(0, 2).join(' / ')]);
  }
  // 2) road keeping: a porter vs a self-driving hauler, to a spot a little off a long road
  const roads = G.roadsList().filter(r => r.side > 0).sort((p, q) => q.len - p.len);
  const R = roads[0];
  log.push(['longest road', R && Math.round(R.len)]);
  if (R) {
    const P0 = R.pts[0], P1 = R.pts[R.pts.length - 1], dx = P1[0] - P0[0], dy = P1[1] - P0[1], l = Math.hypot(dx, dy), nx = -dy / l * 6, ny = dx / l * 6;
    const k0 = [P0[0] + nx + dx / l * 3, P0[1] + ny + dy / l * 3], tgt = [P1[0] + nx - dx / l * 3, P1[1] + ny - dy / l * 3];
    const route = av => { const r = G.findRoute(k0[0], k0[1], tgt[0], tgt[1], { off: 4 * 0.2, road: 4, wall: 0, land: true, avoid: av }); let off = 0; for (let k = 0; k < r.spd.length; k++) if (r.spd[k] < 1) off += Math.hypot(r.pts[k + 1][0] - r.pts[k][0], r.pts[k + 1][1] - r.pts[k][1]); return Math.round(off * 10) / 10; };
    log.push(['off-road tiles: porter', route(1), 'caravan', route(3), 'self-driving', route(30)]);
  }
  // 7) a camp right beside a road counts as connected; the hauler stops on the road
  const M = G.arrays(); let touch = null;
  for (const b of g.buildings) if (G.owner[b.i] && b.type !== 'settlement' && E(`roadTouch(${b.i})`)) { touch = b; break; }
  if (!touch && R) {                                // put a camp beside the road
    for (const p of R.pts) { const x = Math.floor(p[0]) + 1, y = Math.floor(p[1]) + 1, i = G.idx(x, y); if (G.isLand(i) && !M.building[i] && M.owner[i] && !G.canBuild(i, 'cabin')) { G.tryBuild(i, 'cabin'); for (let k = 0; k < 40 && G.buildingAt(i)?.site; k++) { G.rushSite(G.buildingAt(i)); A.res.gold = 999; run(1); } touch = G.buildingAt(i); break; } }
  }
  if (touch) {
    G.showBuildingCard(touch);
    const stop = E(`roadStop(${touch.i})`);
    log.push(['building by the road', touch.type, 'card', document.getElementById('bc-body')?.innerText.match(/On the road network|Not on a road[^.]*/)?.[0], 'stop on road', stop && stop.map(n => n.toFixed(1)).join(','), 'centre', touch.i % G.W + 0.5, ((touch.i / G.W) | 0) + 0.5]);
  }
  // 8) a new road between two settlements swings by collectors
  const before = G.roadsList().length;
  log.push(['roads', before]);
  // 4) planes: straight at any angle
  const ang = E(`(() => { const L = { kind: 'air', path: straightPath(idx(100, 100), idx(160, 130)) }, out = []; for (let t = 0; t < L.path.length - 1; t += 0.5) out.push(+vehiclePos(L, { t })[2].toFixed(3)); return [...new Set(out)]; })()`);
  log.push(['plane headings along a route', JSON.stringify(ang)]);
  // 5) zoomed in on a territory: its own stock under each total (needs two territories)
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
await page.evaluate(() => { const G = window.__game, [a, b] = window.__road; G.cam.follow = null; G.cam.anim = null; G.cam.x = ((a % G.W) + (b % G.W)) / 2; G.cam.y = (((a / G.W) | 0) + ((b / G.W) | 0)) / 2; G.cam.zoom = 9; document.querySelectorAll('.note').forEach(e => e.remove()); G.showBuildingCard(null); });
await page.waitForTimeout(600); await page.screenshot({ path: '/tmp/r13b_lanes.png' });
// diplomacy: ask for peace -> envoy -> notification
const dip = await page.evaluate(async () => {
  const G = window.__game, g = G.game, log = [];
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const n = g.nations.find(n => n.alive);
  G.setWar('P', n.id, true); n.hostile = true; n.lost = 500;
  G.openDiplomacy(n);
  document.querySelector('#diplo button[data-dp="peace"]').click();
  log.push(['panel says', document.querySelector('#diplo .dp-result.top')?.innerText, 'note', [...document.querySelectorAll('#notes .note .nt')].map(e => e.textContent).slice(0, 2).join(' / ')]);
  log.push(['still at war right away', n.hostile]);
  run(10);
  log.push(['after the envoy', 'at war', n.hostile, 'note', [...document.querySelectorAll('#notes .note')].map(e => e.innerText.replace(/\n/g, ' ')).slice(0, 2).join(' / ')]);
  G.openDiplomacy(n);
  document.querySelector('#diplo button[data-dp="ally"]')?.click();
  run(10);
  log.push(['alliance answer', [...document.querySelectorAll('#notes .note')].map(e => e.innerText.replace(/\n/g, ' ')).slice(0, 1).join(' / ')]);
  return log;
});
for (const l of dip) console.log(JSON.stringify(l));
console.log(errs.slice(0, 4).join('\n') || 'no errors');
await browser.close();
