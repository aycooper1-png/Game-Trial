import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
for (const seed of (process.argv[2] || '42,7,1005').split(',')) {
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
  await page.goto(`http://localhost:8765/?seed=${seed}`);
  await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
  await page.evaluate(() => localStorage.clear());
  const out = await page.evaluate(() => {
    const G = window.__game, g = G.game, M = G.arrays(), log = [];
    G.stopSaving();
    const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
    const wetAt = (x, y) => { const i = G.idx(Math.floor(x), Math.floor(y)); return !G.isLand(i) && !(G.bridgeAt && G.bridgeAt[i]); };
    const seen = {};
    const check = tag => {
      for (const v of g.cars) if (wetAt(v.x, v.y)) { const k = tag + ':' + (v.job && v.job.type) + ':' + v.act; seen[k] = (seen[k] || 0) + 1; if (!seen.ex) seen.ex = [Math.round(v.x - cx), Math.round(v.y - cy), v.job && v.job.type, v.act, JSON.stringify(v.pts && v.pts.slice(0, 3))]; }
      for (const s of g.shipments || []) { const legs = s.legs || []; const L = legs[s.leg || 0]; if (L && L.mode === 'land' && s.x != null && wetAt(s.x, s.y)) { seen.ship = (seen.ship || 0) + 1; } }
    };
    for (let k = 0; k < 6; k++) { A.people = A.cap + 200; G.setPct(100); G.startPush(cx + [40, -40, 0, 0, 30, -30][k], cy + [0, 0, 40, -40, 30, -30][k]); for (let s = 0; s < 240; s++) { G.tick(0.05); if (s % 10 === 0) check('grow'); } }
    for (const r of ['wood', 'stone']) A.res[r] = 999;
    for (let k = 0; k < 6; k++) G.buyVehicle('car', 0);
    for (let s = 0; s < 20 * 400; s++) { G.tick(0.05); if (s % 10 === 0) check('run'); }
    log.push(['cars', g.cars.length, 'tiles', A.tiles, 'wet sightings', JSON.stringify(seen)]);
    return log;
  });
  console.log(seed, JSON.stringify(out));
  await page.close();
}
await browser.close();
