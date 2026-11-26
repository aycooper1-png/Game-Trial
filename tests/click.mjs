import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const mobile = process.argv[2] === 'mobile';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1500, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const tag = mobile ? 'm' : 'd';
// expand to the nearest nation, give us troops
const pos = await page.evaluate(() => {
  const G = window.__game, g = G.game; G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  const n = g.nations.slice().sort((a, b) => Math.hypot(a.lx - cx, a.ly - cy) - Math.hypot(b.lx - cx, b.ly - cy))[0];
  for (const t of ['warrior', 'wheel', 'masonry']) G.completeTech(t);
  G.setPct(100);
  for (let k = 0; k < 90 && !G.frontWith(n, Math.floor(n.lx), Math.floor(n.ly)); k++) { A.people = A.cap; A.res.wheat += 50; G.startPush(Math.floor(n.lx), Math.floor(n.ly)); run(12); }
  A.res.wood += 500; A.res.stone += 500;
  let k = 0;
  for (let dy = -10; dy <= 10 && k < 2; dy++) for (let dx = -10; dx <= 10 && k < 2; dx++) { const i = G.idx(cx + dx, cy + dy); if (!G.canBuild(i, 'base')) { G.tryBuild(i, k ? 'fort' : 'base'); k++; dx += 3; } }
  run(25); for (const b of G.garrisons()) b.units = 40;
  const fw = G.frontWith(n, Math.floor(n.lx), Math.floor(n.ly)); if (!fw) return { err: 'no front ' + n.full + ' ' + Math.round(Math.hypot(n.lx - cx, n.ly - cy)) + ' tiles ' + A.tiles }; const [f] = fw;
  const [fx, fy] = G.tileCenter(f);
  // the enemy tile two steps into their land from the front
  G.cam.x = fx; G.cam.y = fy; G.cam.zoom = 8;
  return { f, n: n.full };
});
if (pos.err) { console.log(pos.err); process.exit(0); }
await page.waitForTimeout(400);
const sc = await page.evaluate(({ f }) => { const G = window.__game; const W = G.W; let best = f;
  const x = f % W, y = (f / W) | 0; for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const i = G.idx(x + dx * 2, y + dy * 2); if (G.aiOf[i] === G.aiOf[f]) best = i; }
  return G.toScreen(...G.tileCenter(best)); }, pos);
if (mobile) await page.touchscreen.tap(sc[0], sc[1]); else await page.mouse.click(sc[0], sc[1]);
await page.waitForTimeout(400);
await page.screenshot({ path: `click-${tag}-modal.png` });
const modal = await page.evaluate(() => document.getElementById('modal').classList.contains('show'));
if (modal) await page.click('#md-btns button.danger');
await page.waitForTimeout(300);
const st = await page.evaluate(() => { const g = window.__game.game; return { armies: g.armies.length, attacks: g.attacks.length }; });
await page.evaluate(() => { const G = window.__game; for (let k = 0; k < 20 * 25; k++) G.tick(0.05); });
await page.waitForTimeout(400);
await page.screenshot({ path: `click-${tag}-battle.png` });
// build via clicks: open Build, pick Military base, tap map to move, confirm
await page.click('#btn-build');
await page.waitForTimeout(200);
await page.click('.bm-card:has-text("Settlement")');
await page.waitForTimeout(200);
const g0 = await page.evaluate(() => window.__game.game.ghost.i);
if (mobile) await page.touchscreen.tap(200, 300); else { await page.mouse.move(700, 300); await page.mouse.click(700, 300); }
await page.waitForTimeout(200);
const g1 = await page.evaluate(() => ({ i: window.__game.game.ghost.i, set: window.__game.game.ghost.set, ok: document.getElementById('cf-ok').disabled, info: document.getElementById('cf-info').innerText }));
console.log('modal', modal, JSON.stringify(st), 'ghost moved', g0 !== g1.i, JSON.stringify(g1));
await page.screenshot({ path: `click-${tag}-ghost.png` });
console.log(errs.join('\n') || 'no errors');
await browser.close();
