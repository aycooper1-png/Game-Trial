import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
await page.evaluate(() => localStorage.clear()); await page.reload();
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  const sig = () => G.roadsList().map(r => r.key + '@' + r.pts.length + ':' + r.pts[Math.floor(r.pts.length / 2)].map(v => v.toFixed(2)).join(',')).sort().join(' ');
  // grow and add settlements
  for (let k = 0; k < 6; k++) { A.people = A.cap; G.setPct(100); G.startPush(cx + (k % 2 ? 40 : -40), cy + (k < 3 ? 25 : -25)); run(15); }
  A.res.wood += 500; A.res.stone += 500;
  const placed = [];
  for (const [dx, dy] of [[25, 0], [-25, 0], [0, 25]]) { for (let r = 0; r < 6; r++) { const i = G.idx(cx + dx + r, cy + dy); if (!G.canBuild(i, 'settlement')) { G.tryBuild(i, 'settlement'); placed.push(i); break; } } }
  run(60);
  const s1 = sig();
  log.push(['roads', G.roadsList().length, 'settlements', g.buildings.filter(b => b.type === 'settlement').length]);
  // one more settlement: old roads must not change
  A.res.wood += 200; A.res.stone += 200;
  for (let r = 0; r < 8; r++) { const i = G.idx(cx + 15 + r, cy - 18); if (!G.canBuild(i, 'settlement')) { G.tryBuild(i, 'settlement'); break; } }
  run(40);
  const s2 = sig();
  const old = s1.split(' '), now = new Set(s2.split(' '));
  log.push(['old roads unchanged', old.every(x => now.has(x)), 'roads now', G.roadsList().length]);
  // conquest: hand the middle of the longest road to a nation
  const R = G.roadsList().filter(r => r.side > 0).sort((a, b) => b.tiles.length - a.tiles.length)[0];
  const mid = R.tiles.slice(Math.floor(R.tiles.length / 2) - 2, Math.floor(R.tiles.length / 2) + 2);
  const arr = G.arrays();
  for (const t of mid) { arr.owner[t] = 0; arr.countryOf[t] = -1; arr.aiOf[t] = 1; }
  G.buildRoads();
  const pieces = G.roadsList().filter(r => r.key === R.key);
  log.push(['after conquest pieces', pieces.length, 'any on enemy', pieces.some(p => p.tiles.some(t => arr.aiOf[t]))]);
  // mountains slow troops/cars: route across mountain vs plain
  const prof = { off: 4, road: 16, wall: 0 };
  let m = -1; for (let i = 0; i < arr.biome.length && m < 0; i++) if (arr.biome[i] === 3 && arr.biome[i + 6] === 3 && arr.biome[i - 6] === 3) m = i;
  const mx = m % G.W, my = m / G.W | 0;
  log.push(['mountain off-road time 12 tiles', G.findRoute(mx - 6, my, mx + 6, my, prof).len.toFixed(1), 'plain would be', (12 / 4).toFixed(1)]);
  G.saveGame();
  window.__sig = sig();
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
const before = await page.evaluate(() => window.__sig);
await page.reload(); await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const after = await page.evaluate(() => { const G = window.__game; return G.roadsList().map(r => r.key + '@' + r.pts.length).sort().join(' '); });
const bk = before.split(' ').map(x => x.split(':').slice(0, 2).join(':').split('@')[0]).sort().join(' ');
console.log('roads survive reload', bk === after.split(' ').map(x => x.split('@')[0]).sort().join(' '), before.split(' ').length, after.split(' ').length);
console.log(errs.join('\n') || 'no errors');
await browser.close();
