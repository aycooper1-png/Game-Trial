// Round 24: the speed-ups give exactly the same game. Checks each faster piece against the slow way it replaced:
// the tile path search, the nearest settlement, the land recount it may now reuse, the per-world building indexes,
// and that the still picture of the route lines follows every change. Uses the friend's big game (fixtures).
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
import zlib from 'zlib';
const p = fs.readFileSync(new URL('./fixtures/friend-freeze.txt', import.meta.url), 'utf8').trim();
const json = zlib.gunzipSync(Buffer.from(p.slice(1).replace(/-/g, '+').replace(/_/g, '/'), 'base64')).toString();
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().split('\n')[0].slice(0, 200)); });
const say = (what, ok, extra) => console.log((ok ? 'ok   ' : 'FAIL ') + what, extra === undefined ? '' : JSON.stringify(extra));
const load = () => page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 180000 });
await page.goto(`http://localhost:8765/?seed=${JSON.parse(json).seed}`); await load();
await page.evaluate(v => { window.__game.stopSaving(); (0, eval)('noSave = true'); localStorage.clear(); localStorage.setItem('game-trial-save-v2', v); }, json);
await page.reload(); await load();
const r = await page.evaluate(() => {
  const E = s => (0, eval)(s), G = window.__game, g = G.game, out = {};
  G.stopSaving(); E('noSave = true; tutEnd()');
  const W = G.W, N = E('N'), H = N / W;
  // 1) the tile path search, against the old one written out here (plain arrays, cost asked every time)
  const old = (a, b, cost, maxExp) => {
    const AG = new Float64Array(N), ST = new Int32Array(N), FR = new Int32Array(N); const hI = [], hF = [];
    const push = (i, f) => { let k = hI.length; hI.push(i); hF.push(f); while (k > 0) { const p = (k - 1) >> 1; if (hF[p] <= f) break; hI[k] = hI[p]; hF[k] = hF[p]; k = p; } hI[k] = i; hF[k] = f; };
    const pop = () => { const top = hI[0], li = hI.pop(), lf = hF.pop(); if (hI.length) { let k = 0; for (;;) { let c = 2 * k + 1; if (c >= hI.length) break; if (c + 1 < hI.length && hF[c + 1] < hF[c]) c++; if (hF[c] >= lf) break; hI[k] = hI[c]; hF[k] = hF[c]; k = c; } hI[k] = li; hF[k] = lf; } return top; };
    const bx = b % W, by = (b / W) | 0; ST[a] = 1; AG[a] = 0; FR[a] = -1; push(a, Math.hypot(a % W - bx, ((a / W) | 0) - by)); let exp = 0;
    const D8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (hI.length && exp < maxExp) { const f0 = hF[0], i = pop(); if (i === b) break; const x = i % W, y = (i / W) | 0, g = AG[i]; if (f0 > g + Math.hypot(x - bx, y - by) + 1e-9 * (1 + f0)) continue; exp++;
      for (const [dx, dy, d] of D8) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const n = ny * W + nx, c = n === b ? 1 : cost(n); if (c === Infinity) continue; if (dx && dy && (cost(y * W + nx) === Infinity || cost(ny * W + x) === Infinity)) continue; const ng = g + d * c; if (ST[n] && AG[n] <= ng) continue; ST[n] = 1; AG[n] = ng; FR[n] = i; push(n, ng + Math.hypot(nx - bx, ny - by)); } }
    if (!ST[b]) return null; const o = []; for (let i = b; i >= 0; i = FR[i]) o.push(i); return o.reverse(); };
  const wet = E('wet'), terr = E('terrSpeed'), cost = i => (wet(i) ? Infinity : 1 / terr(i));
  let rnd = 7; const R = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  const land = []; for (let k = 0; land.length < 40 && k < 200000; k++) { const i = Math.floor(R() * N); if (G.isLand(i)) land.push(i); }
  let same = 0, tries = 0, found = 0;
  for (let k = 0; k + 1 < land.length; k += 2) { tries++; const A = E('tilePath')(land[k], land[k + 1], cost, 60000), B = old(land[k], land[k + 1], cost, 60000); if (JSON.stringify(A) === JSON.stringify(B)) same++; if (A) found++; }
  out.paths = { tries, same, found };
  // 2) the nearest settlement, against a plain look at every settlement
  const C = G.activeCountry(), ns = E('nearestSettlement'), lg = E('landGroup'), under = E('underway');
  let nsSame = 0; const nsTries = 300;
  for (let k = 0; k < nsTries; k++) { const x = R() * W, y = R() * H; const t0 = Math.floor(y) * W + Math.floor(x), g0 = !wet(t0) ? lg(t0) : null;
    let best = null, bd = Infinity; for (const b of g.buildings) { if (b.type !== 'settlement' || under(b) || G.countryAt(b.i) !== C) continue; const d = Math.hypot(b.i % W + 0.5 - x, ((b.i / W) | 0) + 0.5 - y) + (g0 != null && lg(b.i) !== g0 ? 400 : 0); if (d < bd) { bd = d; best = b; } }
    if (ns(C, x, y) === best) nsSame++; }
  out.nearest = { tries: nsTries, same: nsSame };
  // 3) the land recount it reuses, against a full recount, through a minute of shelling and building (every 2 s)
  let checks = 0, bad = 0, reused = 0;
  for (let k = 0; k < 1200; k++) {
    E('tickAll(0.05)');
    if (k % 40) continue;
    E('recomputeLand()'); const before = E('landKey'); E('recomputeLand()'); if (E('landKey') === before) reused++;
    const a = g.buildings.filter(b => b.type === 'settlement').map(b => [b.base, b.tiles, b.full]);
    E('landKey = null; recomputeLand()');
    const b2 = g.buildings.filter(b => b.type === 'settlement').map(b => [b.base, b.tiles, b.full]);
    checks++; if (JSON.stringify(a) !== JSON.stringify(b2)) bad++;
  }
  out.land = { checks, bad, reused };
  // 4) a claimed tile, and a tile lost, make the next recount a full one
  const Tl = g.buildings.find(b => b.type === 'settlement' && G.countryAt(b.i) === C);
  E('recomputeLand()'); const k0 = E('landKey'); E('paintTerr')(Tl.i); E('recomputeLand()');
  out.landVer = E('landKey') !== k0;
  return out;
});
say('the faster tile path search finds exactly the same paths as the old one', r.paths.same === r.paths.tries && r.paths.found > 5, r.paths);
say('the nearest settlement is the same as looking at every settlement', r.nearest.same === r.nearest.tries, r.nearest);
say('a reused land count always equals a full recount (shelling and building for a minute)', r.land.bad === 0 && r.land.checks >= 25 && r.land.reused === r.land.checks, r.land);
say('any change of a tile makes the next land count a full one', r.landVer);
// 5) other worlds: each keeps its own building index, which always matches a full scan
const w = await page.evaluate(() => {
  const E = s => (0, eval)(s), G = window.__game, g = G.game;
  E('genWorld')(1);
  g.colonyShips.push({ w: 1, tx: E('DISK').cx + 0.5, ty: E('DISK').cy + 0.5, n: 40, kit: { iron: 80, stone: 80, wood: 40, wheat: 120 }, t: 0, T: 0.05, fx: 0, fy: 0, from: 0 });
  let bad = 0, checks = 0;
  for (let k = 0; k < 400; k++) {
    E('tickAll(0.05)');
    if (k % 20) continue;
    for (const ww of [0, 1, 0]) E(`onWorld(${ww}, () => { for (const t of ['settlement', 'fort', 'farm', 'airport', 'mortar']) { const a = byType(t), b = game.buildings.filter(x => x.type === t); window.__c = (window.__c || 0) + 1; if (a.length !== b.length || a.some((x, j) => x !== b[j])) window.__bad = (window.__bad || 0) + 1; } for (const x of game.buildings.slice(0, 50)) if (buildingAt(x.i) !== x) window.__bad = (window.__bad || 0) + 1; })`);
  }
  return { checks: window.__c, bad: window.__bad || 0, moon: E('onWorld(1, () => game.buildings.length)') };
});
say('each world keeps its own building index, always the same as a full scan', w.bad === 0 && w.checks > 100 && w.moon > 0, w);
// 6) the still picture of the routes: made when the camera stays put, and follows a new route at once
const pic = await page.evaluate(() => {
  const E = s => (0, eval)(s), G = window.__game, g = G.game, C = G.activeCountry();
  E('viewWorld(0)'); G.cam.zoom = 3; G.cam.x = C.lx; G.cam.y = C.ly; E('render()'); E('render()'); E('render()');
  const L = E('linkLayer'), had = !!L.c && L.key !== '';
  const before = L.key;
  const a = g.buildings.find(b => b.type === 'settlement' && G.countryAt(b.i) === C), b = g.buildings.filter(x => x.type === 'settlement' && G.countryAt(x.i) === C)[1];
  g.links.push({ kind: 'air', a: a.i, b: b.i, path: [a.i, b.i], ships: [], req: { a: [], b: [] }, out: { a: {}, b: {} }, owe: { a: {}, b: {} } });
  E('render()'); const straight = L.last !== before && L.key === before; E('render()'); const changed = straight && L.key !== before;   // the first frame draws it straight, the next keeps the new picture
  g.links.pop(); E('render()'); E('render()');
  return { had, changed, back: L.key === before };
});
say('the route lines are kept as a still picture, and a new route shows at once', pic.had && pic.changed && pic.back, pic);
// 7) labels wholly off screen aren't drawn (they used to pile up on the screen's edges)
const lab = await page.evaluate(() => { const E = s => (0, eval)(s), c = E('ctx'); let n = 0; const f = c.fillText; c.fillText = function (...a) { n++; return f.apply(this, a); }; E('pill')(-500, 300, 'far left'); E('pill')(200, 300, 'on screen'); E('pill')(200, 5000, 'far below'); c.fillText = f; return n; });
say('a label wholly off screen is not drawn; one on screen is', lab === 1, lab);
console.log(errs.length ? [...new Set(errs)].join('\n') : 'no errors');
await browser.close();
