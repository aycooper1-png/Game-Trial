import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const touch = process.argv[2] === 'touch';
const ctx = await browser.newContext({ viewport: touch ? { width: 420, height: 860 } : { width: 1400, height: 860 }, hasTouch: touch, isMobile: touch });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const setup = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  for (const t of ['warrior', 'wheel', 'masonry', 'metallurgy', 'gunpowder', 'horses', 'carriages', 'steam']) G.completeTech(t, true);
  for (let k = 0; k < 10; k++) { A.people = A.cap + 300; G.setPct(100); G.startPush(cx + (k % 2 ? 50 : -50), cy + ((k % 3) - 1) * 8); run(12); }
  const spotNear = (x, y, type) => { for (let r = 0; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const i = G.idx(x + dx, y + dy); if (!G.canBuild(i, type) && G.countryAt(i) === A) return i; } return -1; };
  A.res.stone = 3000; A.res.wood = 3000; A.res.iron = 900;
  const f = [spotNear(cx - 16, cy + 6, 'fort'), spotNear(cx + 2, cy + 9, 'fort'), spotNear(cx + 20, cy - 4, 'fort')];
  for (const i of f) G.tryBuild(i, 'fort');
  for (let k = 0; k < 200 && f.some(i => G.buildingAt(i)?.site); k++) { for (const i of f) if (G.buildingAt(i)?.site) G.rushSite(G.buildingAt(i)); A.res.gold = 9999; run(1); }
  window.__f = f;
  return { built: f.map(i => !G.buildingAt(i)?.site), f };
});
console.log('setup', JSON.stringify(setup));
const screenOf = i => page.evaluate(i => { const G = window.__game; return G.toScreen(i % G.W + 0.5, (i / G.W | 0) + 0.5); }, i);
const f = setup.f;
let ok = 0, tries = 0;
for (const zoom of [3, 6, 12]) {
  for (const [frac, jitter] of [[0.62, 0], [0.7, 9], [0.8, 14], [1, 6], [1.15, 4]]) {
    tries++;
    await page.evaluate(({ zoom, f }) => { const G = window.__game; document.querySelectorAll('#modal').forEach(m => m.classList.remove('show')); G.closeModal?.(); G.cam.zoom = zoom; G.cam.follow = null; G.cam.anim = null; const a = f[0], b = f[1]; G.cam.x = ((a % G.W) + (b % G.W)) / 2 + 0.5; G.cam.y = ((a / G.W | 0) + (b / G.W | 0)) / 2 + 0.5; G.game.walls = []; G.showBuildingCard(G.buildingAt(a)); [...document.querySelectorAll('button')].find(x => x.textContent.startsWith('Build a wall'))?.click(); }, { zoom, f });
    await page.waitForTimeout(60);
    const [ax, ay] = await screenOf(f[0]), [bx, by] = await screenOf(f[1]);
    const x = ax + (bx - ax) * frac, y = ay + (by - ay) * frac + 5;
    if (touch) {
      await page.touchscreen.tap(x, y);
    } else {
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + jitter, y + jitter * 0.5, { steps: 3 }); await page.mouse.up();
    }
    await page.waitForTimeout(80);
    const r = await page.evaluate(() => ({ modal: document.querySelector('#modal.show .md-title')?.textContent || '', from: window.__game.game.wallFrom, toast: document.getElementById('toast').textContent }));
    const good = r.modal === 'Build a wall?';
    if (good) ok++;
    console.log(`zoom ${zoom} at ${frac} of the way, jitter ${jitter}px (${Math.round(Math.hypot(bx - ax, by - ay))}px apart):`, good ? 'OK' : 'MISS ' + JSON.stringify(r));
    await page.evaluate(() => { document.querySelectorAll('#md-btns button').forEach(b => { if (b.textContent === 'Cancel') b.click(); }); });
  }
}
console.log(`picked ${ok} of ${tries}`);
// long press keeps the pick on touch; an unreachable fort keeps the first one picked
const more = await page.evaluate(() => {
  const G = window.__game, g = G.game, f = window.__f, log = [];
  g.wallFrom = f[0]; G.wallPlan ? 0 : 0;
  // pretend the far fort is unreachable: pick it while it's in another domain's way (use a fake: too far is simplest, via range)
  const keep = G.CFG.walls.range; G.CFG.walls.range = 5;
  const [bx, by] = G.toScreen(f[2] % G.W + 0.5, (f[2] / G.W | 0) + 0.5);
  G.clickAt(0, bx, by);
  log.push(['unreachable fort: first stays picked', g.wallFrom === f[0], document.getElementById('toast').textContent.slice(0, 90), 'banner', !!document.getElementById('wall-hint')]);
  G.CFG.walls.range = keep;
  return log;
});
await page.waitForTimeout(100);
const more2 = await page.evaluate(() => {
  const G = window.__game, g = G.game, f = window.__f, log = [];
  log.push(['banner', !!document.getElementById('wall-hint')]);
  document.querySelector('#wall-hint button').click();
  log.push(['banner cancel', g.wallFrom, !document.getElementById('wall-hint')]);
  // straight walls
  const M = G.arrays();
  for (const [p, q] of [[0, 1], [1, 2], [0, 2]]) {
    const L = G.wallPlan(G.buildingAt(f[p]), G.buildingAt(f[q]));
    if (L.why) { log.push(['wall', p, q, L.why]); continue; }
    const bad = L.line.tiles.filter(t => t !== f[p] && t !== f[q] && (M.depositOf[t] >= 0 || M.building[t] || !G.isLand(t) || G.countryAt(t) !== G.countryAt(f[p]))).length;
    log.push(['wall', p, q, 'len', Math.round(L.line.len), 'straight-line dist', Math.round(Math.hypot(f[p] % G.W - f[q] % G.W, (f[p] / G.W | 0) - (f[q] / G.W | 0))), 'bends', L.line.bends, 'bad tiles', bad]);
  }
  return log;
});
for (const l of [...more, ...more2]) console.log(JSON.stringify(l));
await page.evaluate(() => { const G = window.__game, f = window.__f, g = G.game; g.walls = []; for (const [p, q] of [[0, 1], [1, 2]]) { const P = G.wallPlan(G.buildingAt(f[p]), G.buildingAt(f[q])); if (!P.why) g.walls.push({ a: f[p], b: f[q], ...P.line, dmg: 0, up: {} }); } G.markNet && G.markNet(); G.cam.zoom = 7; G.cam.x = (f[0] % G.W + f[2] % G.W) / 2; G.cam.y = (f[0] / G.W | 0) + 2; document.querySelectorAll('.note').forEach(e => e.remove()); });
await page.waitForTimeout(400);
await page.screenshot({ path: `/tmp/r8_walls${touch ? '_touch' : ''}.png` });
console.log(errs.slice(0, 5).join('\n') || 'no errors');
await browser.close();
