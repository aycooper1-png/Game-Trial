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
  const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  for (const t of ['warrior', 'wheel', 'masonry', 'metallurgy']) G.completeTech(t, true);
  for (let k = 0; k < 6; k++) { A.people = A.cap + 200; G.setPct(100); G.startPush(cx + (k % 2 ? 30 : -30), cy + 10); run(12); }
  const spotNear = (x, y, type) => { for (let r = 0; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const i = G.idx(x + dx, y + dy); if (!G.canBuild(i, type) && G.countryAt(i) === A) return i; } return -1; };
  A.res.stone = 900; A.res.wood = 900; A.res.iron = 300;
  const f = [spotNear(cx - 14, cy + 6, 'fort'), spotNear(cx, cy + 8, 'fort'), spotNear(cx + 14, cy + 6, 'fort')];
  for (const i of f) G.tryBuild(i, 'fort');
  for (let k = 0; k < 120 && f.some(i => G.buildingAt(i)?.site); k++) run(1);
  log.push(['forts built', f.map(i => !G.buildingAt(i)?.site)]);
  for (const [a, b] of [[0, 1], [1, 2]]) { const P = G.wallPlan(G.buildingAt(f[a]), G.buildingAt(f[b])); log.push(['wall', P.why || Math.round(P.line.len)]); if (!P.why) { g.walls.push({ a: f[a], b: f[b], ...P.line }); } }
  G.buildRoads(); // markNet
  const B = f.map(i => G.buildingAt(i));
  B[0].units = 60; B[1].units = 0; B[2].units = 0;
  const snap = () => B.map(b => Math.round(b.units)).join('/') + ' marching ' + g.armies.reduce((t, a) => t + a.n, 0);
  for (let k = 0; k < 4; k++) { run(10); log.push(['quiet t' + (k + 1) * 10, snap()]); }
  // a raid near fort 2
  const n = g.nations.find(n => n.alive);
  const [rx, ry] = [B[2].i % G.W + 12, (B[2].i / G.W | 0) + 4];
  g.raids.push({ n: n.id, budget: 30, start: 30, work: 0, tx: rx, ty: ry, lx: rx, ly: ry });
  for (let k = 0; k < 3; k++) G.wallGarrisons();
  log.push(['threat near fort 3: armies', g.armies.map(a => `${a.n}->${f.indexOf(a.dest)}`).join(' ')]);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
console.log(errs.join('\n') || 'no errors');
await browser.close();
