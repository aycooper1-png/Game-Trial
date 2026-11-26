import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
console.log(await page.evaluate(() => {
  const G = window.__game, g = G.game, A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  for (const t of ['rocketry', 'electricity', 'spaceflight', 'reusable']) G.completeTech(t, true);
  A.res.iron = 2000; A.res.stone = 2000; A.res.oil = 600;
  let pi = -1; for (let r = 3; r < 14 && pi < 0; r++) for (let dx = -r; dx <= r && pi < 0; dx++) { const i = G.idx(cx + dx, cy - r); if (!G.canBuild(i, 'pad') && G.countryAt(i) === A) pi = i; }
  G.tryBuild(pi, 'pad');
  for (let k = 0; k < 40 && G.buildingAt(pi).site; k++) run(1);
  const pad = G.buildingAt(pi); pad.rocket = { fuel: 250 };
  const f = { x: G.DISK.cx + 700, y: G.DISK.cy, vx: 0, vy: Math.sqrt(G.CFG.rocket.flight.mu / 700), a: 0, fuel: 50, throttle: 1, engine: false, landed: false, orbit: true, t: 5, trail: [[0, 0]], n: 7, pad: pi, home: A.id };
  g.flights.push(f); G.makeStation(f);
  A.res.iron = 2000; G.buyShuttle(pad); g.shuttles[0].fuel = 120;
  g.started = true; G.saveGame();
  return JSON.stringify({ st: g.orbitals.length, sh: g.shuttles.length, saved: !!localStorage.getItem(G.SAVE_KEY) });
}));
await page.reload();
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
console.log(await page.evaluate(() => {
  const G = window.__game, g = G.game, pad = g.buildings.find(b => b.type === 'pad');
  for (let k = 0; k < 40; k++) G.tick(0.05);
  return JSON.stringify({ st: g.orbitals.map(s => [s.n, Math.round(Math.hypot(s.x - G.DISK.cx, s.y - G.DISK.cy))]), sh: g.shuttles.map(s => [s.state, Math.round(s.fuel)]), pad: pad && pad.rocket, supply: pad && pad.supply });
}));
console.log(errs.join('\n') || 'no errors');
await browser.close();
