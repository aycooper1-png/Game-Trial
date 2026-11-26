import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack)); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const shot = async (name, fn) => { await page.evaluate(fn); await page.waitForTimeout(600); await page.screenshot({ path: name }); };
await page.evaluate(() => {
  const G = window.__game, g = G.game;
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  for (const t of ['warrior', 'wheel', 'masonry', 'metallurgy', 'gunpowder', 'sailing']) G.completeTech(t, true);
  for (let k = 0; k < 6; k++) { A.people = A.cap + 200; G.setPct(100); G.startPush(cx + (k % 2 ? 30 : -30), cy + 10); run(12); }
  const spotNear = (x, y, type) => { for (let r = 0; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const i = G.idx(x + dx, y + dy); if (!G.canBuild(i, type) && G.countryAt(i) === A) return i; } return -1; };
  A.res.stone = 900; A.res.wood = 900; A.res.iron = 900; A.res.oil = 300;
  const f = [spotNear(cx - 14, cy + 6, 'fort'), spotNear(cx, cy + 8, 'fort'), spotNear(cx + 14, cy + 6, 'fort')];
  for (const i of f) G.tryBuild(i, 'fort');
  for (let k = 0; k < 160 && f.some(i => G.buildingAt(i)?.site); k++) run(1);
  for (const [a, b] of [[0, 1], [1, 2]]) { const P = G.wallPlan(G.buildingAt(f[a]), G.buildingAt(f[b])); if (!P.why) g.walls.push({ a: f[a], b: f[b], ...P.line, dmg: 0, up: {} }); }
  G.buildRoads();
  const B = f.map(i => G.buildingAt(i)); B.forEach(b => b.units = 30);
  G.buyWallUpgrade(g.walls[1], 'turret');
  G.damageWall(g.walls[0], G.wallMax(g.walls[0]) * 0.6);
  G.damageFort(B[2], G.fortMax(B[2]) * 1.2);
  G.damageFort(B[0], G.fortMax(B[0]) * 0.5);
  run(3);
  // a trade shipment, early tech
  const n = g.nations.find(n => n.alive);
  G.shipGoods({ side: n.id }, { side: 'P', C: A }, { stone: 40 });
  window.__f = f; window.__n = n.id;
});
await shot('r5s-walls.png', () => { const G = window.__game, f = window.__f; G.cam.follow = null; G.cam.anim = null; G.cam.x = f[1] % G.W; G.cam.y = (f[1] / G.W | 0); G.cam.zoom = 11; G.toggleCmdMenu(false); G.showBuildingCard(null); });
await shot('r5s-wallsfar.png', () => { const G = window.__game; G.cam.zoom = 5; });
await shot('r5s-ship.png', () => { const G = window.__game, S = G.game.shipments[0]; for (let k = 0; k < 200; k++) G.tick(0.05); const L = S.legs[S.li]; let k = 1; while (k < L.cum.length - 1 && L.cum[k] < S.d) k++; const p = L.pts[k]; G.cam.x = p[0]; G.cam.y = p[1]; G.cam.zoom = 9; });
await shot('r5s-pick.png', () => { const G = window.__game, f = window.__f; G.game.wallFrom = f[2]; G.cam.x = f[1] % G.W; G.cam.y = (f[1] / G.W | 0); G.cam.zoom = 6; });
console.log('render err', await page.evaluate(() => { try { window.__game.game.wallFrom = window.__f[2]; window.__game.render(); return 'ok'; } catch (e) { return e.message + ' ' + e.stack.split('\n').slice(0, 3).join(' | '); } }));
console.log('wallFrom after', await page.evaluate(() => window.__game.game.wallFrom), 'forts', await page.evaluate(() => window.__f.join(',')));
await shot('r5s-close.png', () => { const G = window.__game, f = window.__f; G.game.wallFrom = -1; G.cam.x = (f[0] % G.W + f[1] % G.W) / 2; G.cam.y = ((f[0] / G.W | 0) + (f[1] / G.W | 0)) / 2; G.cam.zoom = 34; });
await shot('r5s-close2.png', () => { const G = window.__game, f = window.__f; G.cam.x = f[2] % G.W; G.cam.y = (f[2] / G.W | 0); G.cam.zoom = 34; });
console.log(errs.join('\n') || 'no errors');
await browser.close();
