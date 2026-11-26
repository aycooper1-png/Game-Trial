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
  for (const n of g.nations) { n.R = new Set(); }
  const desc = () => g.shipments.map(S => S.legs.map(L => L.kind + ':' + L.spr + ':' + Math.round(L.len)).join(' > ')).join(' | ');
  // every nation, early game
  const t0 = performance.now();
  for (const n of g.nations.filter(n => n.alive)) { G.shipGoods({ side: 'P', C: A }, { side: n.id }, { wood: 10 }); G.shipGoods({ side: n.id }, { side: 'P', C: A }, { stone: 10 }); }
  log.push(['ms per shipment', ((performance.now() - t0) / g.shipments.length).toFixed(1)]);
  log.push(['early', desc()]);
  // check no land leg crosses water
  let wetLegs = 0;
  for (const S of g.shipments) for (const L of S.legs) if (L.kind === 'land') for (let k = 1; k < L.pts.length; k++) if (G.crossesWater(...L.pts[k - 1], ...L.pts[k])) wetLegs++;
  log.push(['land legs crossing water', wetLegs]);
  let t = 0; while (g.shipments.length && t < 600) { run(1); t++; }
  log.push(['all arrived after', t]);
  // flight researched by you only: your outgoing long hauls fly, theirs don't
  g.research.done.add('flight'); g.research.done.add('wheel'); g.research.done.add('sailing');
  for (const n of g.nations.filter(n => n.alive)) { G.shipGoods({ side: 'P', C: A }, { side: n.id }, { wood: 10 }); G.shipGoods({ side: n.id }, { side: 'P', C: A }, { stone: 10 }); }
  log.push(['you fly', desc()]);
  g.shipments = [];
  // car routes over water
  let bad = 0, tot = 0;
  const prof = G.haulProf(A);
  for (let k = 0; k < 40; k++) {
    const x0 = A.lx + (Math.random() - 0.5) * 60, y0 = A.ly + (Math.random() - 0.5) * 60, x1 = A.lx + (Math.random() - 0.5) * 60, y1 = A.ly + (Math.random() - 0.5) * 60;
    const i0 = G.idx(Math.floor(x0), Math.floor(y0)), i1 = G.idx(Math.floor(x1), Math.floor(y1));
    if (!G.isLand(i0) || !G.isLand(i1) || G.landmass[i0] !== G.landmass[i1]) continue;
    const r = G.findRoute(x0, y0, x1, y1, prof); tot++;
    for (let m = 1; m < r.pts.length; m++) if (r.spd[m - 1] <= prof.off * 1.01 && G.crossesWater(...r.pts[m - 1], ...r.pts[m])) { bad++; break; }
  }
  log.push(['car routes', tot, 'crossing water', bad]);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
console.log(errs.join('\n') || 'no errors');
await browser.close();
