// Speed benchmark (round 24): the same deterministic setup as perf_eq.mjs; prints ms per game step (haulers' thinking
// budget lifted, so it is repeatable) and ms per frame at several zooms with a still camera, and while panning ("pan").
// Usage: node perf_bench.mjs <save.json {k,v} | payload.txt> <port> [steps]   (frame times include waiting for the GPU)
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const [saveFile, port = 8765, STEPS = 300] = process.argv.slice(2);
import zlib from 'zlib';
// a save as {k, v} JSON, or a "Send my game" payload (g… / j…, like tests/fixtures/friend-freeze.txt)
const raw = fs.readFileSync(saveFile, 'utf8').trim();
const save = raw[0] === '{' ? JSON.parse(raw) : { k: 'game-trial-save-v2', v: raw[0] === 'g' ? zlib.gunzipSync(Buffer.from(raw.slice(1).replace(/-/g, '+').replace(/_/g, '/'), 'base64')).toString() : Buffer.from(raw.slice(1).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString() };
const seed = JSON.parse(save.v).seed;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', ...(process.env.CPU2D ? ['--disable-accelerated-2d-canvas'] : [])] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  let a = 12345; Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  if (sessionStorage.getItem('eq-norf')) window.requestAnimationFrame = () => 0;
  sessionStorage.setItem('gt-fresh', '1');
});
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
const load = () => page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 240000 });
await page.goto(`http://localhost:${port}/?seed=${seed}`); await load();
await page.evaluate(s => { window.__game.stopSaving(); localStorage.clear(); localStorage.setItem(s.k, s.v); sessionStorage.setItem('eq-norf', '1'); }, save);
await page.reload(); await load();
const r = await page.evaluate(STEPS => {
  const G = window.__game, E = s => (0, eval)(s); G.stopSaving(); try { E('CAR_THINK_MS = 1e9'); } catch (e) {} E('tutEnd()');
  for (let k = 0; k < 60; k++) E('tickAll(0.05)');
  const t0 = performance.now(); let worst = 0;
  for (let k = 0; k < STEPS; k++) { const t = performance.now(); E('tickAll(0.05)'); worst = Math.max(worst, performance.now() - t); }
  const step = (performance.now() - t0) / STEPS;
  const C = G.activeCountry(), out = { step: +step.toFixed(2), worstStep: Math.round(worst) };
  for (const z of (STEPS > 0 && window.__noRender ? [] : [0.3, 1, 3, 6, 12, 25])) { G.cam.zoom = z; G.cam.x = C.lx; G.cam.y = C.ly; E('render()'); const ts = []; for (let k = 0; k < 9; k++) { const t = performance.now(); E('render()'); E('ctx').getImageData(0, 0, 1, 1); ts.push(performance.now() - t); } ts.sort((p, q) => p - q); out['z' + z] = +ts[4].toFixed(1); }
  for (const z of [1, 3, 6]) { G.cam.zoom = z; G.cam.x = C.lx; G.cam.y = C.ly; E('render()'); const ts = []; for (let k = 0; k < 9; k++) { G.cam.x += 3 / z; const t = performance.now(); E('render()'); E('ctx').getImageData(0, 0, 1, 1); ts.push(performance.now() - t); } ts.sort((p, q) => p - q); out['pan' + z] = +ts[4].toFixed(1); }
  return out;
}, +STEPS);
console.log(port, JSON.stringify(r));
await browser.close();
