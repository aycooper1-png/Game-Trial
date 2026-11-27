// Equality check for speed work (round 24): the same game, with the same random numbers and no frame loop, run for N
// steps on the old code (port 8766) and the new code (port 8765); prints IDENTICAL or the first differences.
// Serve the old code with:  git archive HEAD | tar -x -C /tmp/old && cd /tmp/old && python3 -m http.server 8766
// Usage: node perf_eq.mjs <save.json {k,v} | payload.txt> [steps]
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const [saveFile, STEPS = 600] = process.argv.slice(2);
import zlib from 'zlib';
// a save as {k, v} JSON, or a "Send my game" payload (g… / j…, like tests/fixtures/friend-freeze.txt)
const raw = fs.readFileSync(saveFile, 'utf8').trim();
const save = raw[0] === '{' ? JSON.parse(raw) : { k: 'game-trial-save-v2', v: raw[0] === 'g' ? zlib.gunzipSync(Buffer.from(raw.slice(1).replace(/-/g, '+').replace(/_/g, '/'), 'base64')).toString() : Buffer.from(raw.slice(1).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString() };
const seed = JSON.parse(save.v).seed;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
async function run(port) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    let a = 12345; Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    if (sessionStorage.getItem('eq-norf')) window.requestAnimationFrame = () => 0;
    sessionStorage.setItem('gt-fresh', '1');
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const load = () => page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 240000 });
  await page.goto(`http://localhost:${port}/?seed=${seed}`); await load();
  await page.evaluate(s => { window.__game.stopSaving(); localStorage.clear(); localStorage.setItem(s.k, s.v); sessionStorage.setItem('eq-norf', '1'); }, save);
  await page.reload(); await load();
  const t0 = Date.now();
  const d = await page.evaluate(STEPS => {
    const E = s => (0, eval)(s); window.__game.stopSaving();
    try { E('CAR_THINK_MS = 1e9'); } catch (e) {}
    E('tutEnd()');
    const r6 = x => (typeof x === 'number' ? Math.round(x * 1e4) / 1e4 : x);
    const snap = () => { const o = {}; E('forWorlds')(() => { const g = window.__game.game, w = E('WORLD');
      o['w' + w] = { cars: g.cars.map(v => [v.id, r6(v.x), r6(v.y), v.tier, JSON.stringify(v.cargo), v.act || '', v.job ? v.job.type : '']),
        blds: g.buildings.map(b => [b.i, b.type, r6(b.dmg || 0), b.site ? JSON.stringify(b.site.need) : '', r6(b.base || 0), r6(b.units || 0)]),
        cts: g.countries.map(c => [c.alive, r6(c.people), JSON.stringify(Object.fromEntries(Object.entries(c.res).map(([k, v]) => [k, r6(v)]))), c.tiles]),
        links: g.links.map(L => [L.kind, (L.ships || []).map(V => [r6(V.t), V.dir, JSON.stringify(V.cargo || {})])]),
        roads: E('roads').length, nations: g.nations ? g.nations.map(n => [r6(n.people), n.tiles, r6(n.units || 0)]) : [] }; });
      o.time = r6(window.__game.game.time); return o; };
    for (let k = 0; k < STEPS; k++) E('tickAll(0.05)');
    return snap();
  }, +STEPS);
  const ms = Date.now() - t0;
  await ctx.close();
  return { d, errs, ms };
}
const A = await run(8766), B = await run(8765);
console.log('old', A.ms, 'ms', A.errs.slice(0, 3), '| new', B.ms, 'ms', B.errs.slice(0, 3));
let diffs = 0;
for (const w of Object.keys(A.d)) {
  if (w === 'time') { if (A.d.time !== B.d.time) console.log('time differs', A.d.time, B.d.time); continue; }
  for (const part of Object.keys(A.d[w])) {
    const a = A.d[w][part], b = B.d[w][part];
    const sa = JSON.stringify(a), sb = JSON.stringify(b);
    if (sa === sb) continue;
    diffs++;
    let first = -1; if (Array.isArray(a)) for (let k = 0; k < Math.max(a.length, b.length); k++) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) { first = k; break; }
    console.log(`DIFF ${w}.${part}: len ${a.length ?? '-'} vs ${b.length ?? '-'}; first at ${first}:`, JSON.stringify(a[first] ?? a).slice(0, 220), '<->', JSON.stringify(b[first] ?? b).slice(0, 220));
  }
}
console.log(diffs ? diffs + ' parts differ' : 'IDENTICAL');
await browser.close();
