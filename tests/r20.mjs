// Round 20 (the big debug): the friend's "stuck in space / not responding" on a phone.
// Pinch far out and pan away; Command > Map and Home bring the world back AND get the panel out of the way; Map never
// returns to a view of empty space; a game saved far out in space reopens over your land; a finger whose "lifted"
// event was lost doesn't turn every later touch into a pinch; the page itself can't be pinch-zoomed.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 300)); });
const load = () => page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 120000 });
await page.goto('http://localhost:8765/?seed=42'); await load();
await page.evaluate(() => localStorage.clear()); await page.reload(); await load();
const cdp = await ctx.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, k) => ({ x: p[0], y: p[1], id: k })) });
const pinch = async (from, to) => {
  const cx = 195, cy = 420;
  await touch('touchStart', [[cx - from / 2, cy], [cx + from / 2, cy]]);
  for (let k = 1; k <= 8; k++) { const d = from + (to - from) * k / 8; await touch('touchMove', [[cx - d / 2, cy], [cx + d / 2, cy]]); }
  await touch('touchEnd', []);
};
const st = () => page.evaluate(() => { const G = window.__game; return { zoom: +G.cam.zoom.toPrecision(3), view: G.viewingWorld(), cmd: document.getElementById('cmdmenu').classList.contains('show'), fingers: (0, eval)('fingers.size') }; });
const say = (what, ok, extra) => console.log((ok ? 'ok   ' : 'FAIL ') + what, extra === undefined ? '' : JSON.stringify(extra));
await page.evaluate(() => { const E = s => (0, eval)(s); E('tutEnd()'); E('toggleDebug()'); const G = window.__game; for (let k = 0; k < 600; k++) G.tick(0.05); });
for (let k = 0; k < 14; k++) await pinch(300, 40);
// (each swipe ends with the finger resting: otherwise Chrome's touch simulator treats it as a fling and swallows the next tap)
for (let k = 0; k < 4; k++) { await touch('touchStart', [[300, 600]]); for (let j = 1; j <= 6; j++) await touch('touchMove', [[300 - j * 40, 600 - j * 60]]); await page.waitForTimeout(150); await touch('touchMove', [[60, 240]]); await page.waitForTimeout(150); await touch('touchEnd', []); }
let s = await st(); say('pinched out and panned away: lost in space', !s.view && s.zoom < 0.01, s);
// Command > Map: the world, and the panel gone
await page.tap('#btn-cmd'); await page.waitForTimeout(150);
await page.tap('#cmdmenu button[data-act="map"]'); await page.waitForTimeout(150);
s = await st(); say('Map shows the world and closes the panel on a phone', s.view && !s.cmd, s);
await pinch(100, 300); const z1 = (await st()).zoom; say('pinching in on the map zooms in', z1 > s.zoom * 1.5, [s.zoom, z1]);
for (let k = 0; k < 3; k++) { await page.tap('#btn-cmd'); await page.waitForTimeout(100); await page.tap('#cmdmenu button[data-act="map"]'); await page.waitForTimeout(100); }
s = await st(); say('Map, round the cycle: ends over your land, not back in empty space', s.view && s.zoom >= 3, s);
// Home from far out
await page.evaluate(() => { const c = window.__game.cam; c.zoom = 0.0001; c.x = 3e6; c.y = -2e6; });
await page.tap('#btn-cmd'); await page.waitForTimeout(150); await page.tap('#cmdmenu button[data-act="home"]'); await page.waitForTimeout(150);
s = await st(); say('Home from deep space: over your land, zoomed in, panel gone', s.view && s.zoom >= 3 && !s.cmd, s);
// saved far out in space, small zoom: reopens over your land
await page.evaluate(() => { const G = window.__game, c = G.cam; c.zoom = 0.0001; c.x = 3e6; c.y = 3e6; G.saveGame(); });
await page.reload(); await load();
s = await st(); say('a game saved in deep space (tiny zoom) reopens over your land', s.view && s.zoom >= 3, s);
// a finger that was never lifted (lost event)
await page.evaluate(() => { (0, eval)('fingers').set(99, { x: 10, y: 10 }); });
const before = await page.evaluate(() => window.__game.cam.x);
await touch('touchStart', [[200, 500]]); for (let j = 1; j <= 5; j++) await touch('touchMove', [[200 + j * 25, 500]]); await page.waitForTimeout(150); await touch('touchEnd', []);
const after = await page.evaluate(() => window.__game.cam.x);
s = await st(); say('a stuck finger is forgotten: one finger still pans', Math.abs(after - before) > 1 && s.fingers === 0, [before, after, s.fingers]);
await page.evaluate(() => { (0, eval)('fingers').set(98, { x: 10, y: 10 }); (0, eval)('keys').add('a'); window.dispatchEvent(new Event('blur')); });
say('leaving the page forgets held fingers and keys', await page.evaluate(() => (0, eval)('fingers.size + keys.size')) === 0);
say('the page itself cannot be pinch-zoomed', await page.evaluate(() => getComputedStyle(document.body).touchAction) === 'pan-x pan-y');
console.log(errs.length ? errs.join('\n') : 'no errors');
await browser.close();
