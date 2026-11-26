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
  for (const t of ['warrior', 'wheel', 'masonry', 'metallurgy', 'horses', 'carriages', 'steam']) G.completeTech(t, true);
  for (let k = 0; k < 14; k++) { A.people = A.cap + 300; G.setPct(100); G.startPush(cx + (k % 2 ? 60 : -60), cy + ((k % 3) - 1) * 6); run(12); }
  log.push(['tiles', A.tiles]);
  const spotNear = (x, y, type) => { for (let r = 0; r < 15; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const i = G.idx(x + dx, y + dy); if (!G.canBuild(i, type) && G.countryAt(i) === A) return i; } return -1; };
  A.res.wood = 2000; A.res.stone = 2000; A.res.iron = 600;
  const sw = spotNear(cx - 45, cy, 'station'); G.tryBuild(sw, 'station'); for (let k = 0; k < 60 && G.buildingAt(sw)?.site; k++) run(1);
  const sm = spotNear(cx - 2, cy, 'station'); G.tryBuild(sm, 'station'); for (let k = 0; k < 60 && G.buildingAt(sm)?.site; k++) run(1);
  A.res.wood = 2000; A.res.stone = 2000; A.res.iron = 600;
  const se = spotNear(cx + 45, cy, 'station'); G.tryBuild(se, 'station'); for (let k = 0; k < 300 && G.buildingAt(se)?.site; k++) run(1);
  log.push(['se site', !!G.buildingAt(se)?.site, G.buildingAt(se)?.type]);
  log.push(['stations x', [sw, sm, se].map(t => t % G.W - cx), 'links', g.links.map(L => `${L.a % G.W - cx}->${L.b % G.W - cx}`).join(' ')]);
  const prof = G.haulProf(A);
  const via = G.viaLink(A, cx - 50, cy, cx + 50, cy, prof);
  log.push(['route west->east', via && [via.from % G.W - cx, via.to % G.W - cx, via.hops.length]]);
  const via2 = G.viaLink(A, cx - 50, cy, cx + 5, cy, prof, true);
  log.push(['to stock from far west', via2 && [via2.from % G.W - cx, via2.to % G.W - cx, via2.hops.length, 'near settlement', G.stationNearSettlement(A, via2.to)]]);
  // a consignment from the far west to the far east: rides one line, changes at the middle station, rides the next
  if (via) {
    const L0 = via.L; (L0.req || (L0.req = { a: [], b: [] }))[via.end].push({ intra: true, res: { stone: 77 }, then: { type: 'stock' }, hops: via.hops });
    let onSecond = false, done = false, stone0 = A.res.stone;
    for (let k = 0; k < 600 && !done; k++) { run(0.25);
      for (const L of g.links) for (const V of L.ships) if (L !== L0 && V.cargo && V.cargo.req) for (const q of V.cargo.req) if (q.res.stone > 70) onSecond = true;
      const inLinks = g.links.some(L => ['a','b'].some(e => ((L.req || {})[e] || []).some(q => q.res.stone > 70)) || L.ships.some(V => V.cargo && V.cargo.req && V.cargo.req.some(q => q.res.stone > 70)));
      if (onSecond && !inLinks) done = true; }
    log.push(['consignment changed trains', onSecond, 'finished', done, 'yard at east?', g.hubJobs.map(H => H.at % G.W - cx + ':' + JSON.stringify(H.res)).join(' ')]);
  }
  // a far east fort built from the west: materials ride both lines
  for (let k = 0; k < 4; k++) G.buyVehicle('car', 0);
  A.res.wood = 900; A.res.stone = 900;
  const far = spotNear(cx + 52, cy + 3, 'fort');
  log.push(['far fort', far % G.W - cx, G.tryBuild(far, 'fort')]);
  let changed = false, maxHops = 0;
  for (let k = 0; k < 2400 && G.buildingAt(far)?.site; k++) { run(0.5); for (const L of g.links) for (const e of ['a', 'b']) for (const q of (L.req || {})[e] || []) if (q.intra) maxHops = Math.max(maxHops, (q.hops || []).length); for (const L of g.links) for (const V of L.ships) if (V.cargo && V.cargo.req) for (const q of V.cargo.req) if (q.hops && q.hops.length) changed = true; }
  { const S = G.buildingAt(far)?.site; log.push(['site', S && JSON.stringify({ need: S.need, hauled: S.hauled, cost: S.cost, cars: S.cars, claim: S.claim, pending: S.pending, ready: S.ready, crew: S.crew }), 'hub', JSON.stringify(g.hubJobs.map(H => [H.at, H.then.type, H.cars, H.claim, H.res])), 'cars', JSON.stringify(g.cars.map(v => [v.job && v.job.type, v.act])), 't', Math.round(g.time)]); }
  log.push(['fort done', !G.buildingAt(far)?.site, 'consignment with a change of train seen', changed || maxHops > 0, 'yard jobs', g.hubJobs.length]);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
console.log(errs.join('\n') || 'no errors');
await browser.close();
