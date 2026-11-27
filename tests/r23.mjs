// Round 23: the friend's frozen game (tests/fixtures/friend-freeze.txt, as sent by "Send my game": 1,788 porters,
// 185 settlements, creative mode). Before: one step took 91 s (all porters searching routes that the search, by a
// rounding bug, could never find), then 0.5-0.7 s stalls every few seconds. Now: no step over 1.5 s, routes found.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
import zlib from 'zlib';
const p = fs.readFileSync(new URL('./fixtures/friend-freeze.txt', import.meta.url), 'utf8').trim();
const json = zlib.gunzipSync(Buffer.from(p.slice(1).replace(/-/g, '+').replace(/_/g, '/'), 'base64')).toString();
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().split('\n')[0].slice(0, 200)); });
const say = (what, ok, extra) => console.log((ok ? 'ok   ' : 'FAIL ') + what, extra === undefined ? '' : JSON.stringify(extra));
const load = () => page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 180000 });
const seed = JSON.parse(json).seed;
await page.goto(`http://localhost:8765/?seed=${seed}`); await load();
await page.evaluate(v => { window.__game.stopSaving(); (0, eval)('noSave = true'); localStorage.clear(); localStorage.setItem('game-trial-save-v2', v); }, json);
await page.reload(); await load();
const st = await page.evaluate(() => { const g = window.__game.game; return { blds: g.buildings.length, cars: g.cars.length }; });
say('the friend\'s game loads', st.cars === 1788 && st.blds === 770, st);
const routes = await page.evaluate(() => {
  const E = s => (0, eval)(s), wet = E('wet'), cost = i => (wet(i) ? Infinity : 1 / E('terrSpeed')(i));
  return [[493469, 715418], [387264, 196668], [444277, 715418], [474527, 196668], [497467, 648427]].map(([a, b]) => { const t = performance.now(), r = E('tilePath')(a, b, cost, 400000); return { found: !!r, ms: Math.round(performance.now() - t) }; });
});
say('routes round the coast that used to be "unreachable" are found, quickly', routes.every(r => r.found && r.ms < 1000), routes);
const r = await page.evaluate(() => { window.__game.stopSaving(); (0, eval)('tutEnd()'); const E = s => (0, eval)(s); let worst = 0, sum = 0; const slow = []; for (let k = 0; k < 1200; k++) { const t = performance.now(); E('tickAll(0.05)'); const d = performance.now() - t; sum += d; worst = Math.max(worst, d); if (d > 300) slow.push(k); } const g = window.__game.game; return { worstMs: Math.round(worst), avgMs: +(sum / 1200).toFixed(1), slowSteps: slow.length, moving: g.cars.filter(v => v.pts).length }; });
say('a minute of his game: no step over 1.5 s, at most a few over 0.3 s, and porters on the move', r.worstMs < 1500 && r.slowSteps <= 5 && r.moving > 50, r);
console.log(errs.length ? [...new Set(errs)].join('\n') : 'no errors');
await browser.close();
