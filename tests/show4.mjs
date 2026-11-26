import { chromium, devices } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const mobile = process.argv[2] === 'm';
const page = await (await browser.newContext(mobile ? devices['iPhone 13'] : { viewport: { width: 1440, height: 900 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 90000 });
await page.evaluate(() => localStorage.clear()); await page.reload();
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 90000 });
await page.evaluate(() => {
  const G = window.__game, g = G.game;
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  for (const t of ['warrior', 'wheel', 'masonry', 'metallurgy', 'horses', 'carriages', 'steam', 'sailing', 'firearms', 'electricity']) G.completeTech(t, true);
  const fill = () => { for (const r of ['iron', 'stone', 'oil', 'wood', 'wheat']) A.res[r] = 3000; };
  for (let k = 0; k < 8; k++) { A.people = A.cap + 300; G.setPct(100); G.startPush(cx + Math.round(Math.cos(k) * 40), cy + Math.round(Math.sin(k) * 30)); run(10); }
  fill();
  const spot = (x, y, type) => { for (let r = 0; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const i = G.idx(x + dx, y + dy); if (!G.canBuild(i, type) && G.countryAt(i) === A) return i; } return -1; };
  const plan = [['settlement', 25, 0], ['settlement', -25, 5], ['settlement', 5, 22], ['farm', 10, 6], ['farm', -14, 9], ['cabin', -8, -8], ['camp', 9, -9], ['station', -30, 0], ['station', 30, 2], ['fort', 14, 14], ['fort', -12, 16], ['base', 0, 12], ['solar', 4, -4], ['port', 0, -20]];
  for (const [t, dx, dy] of plan) { const i = spot(cx + dx, cy + dy, t); if (i >= 0) G.tryBuild(i, t); }
  for (const t of ['car', 'car', 'car', 'car']) G.buyVehicle(t, 0);
  for (let k = 0; k < 6; k++) { fill(); run(15); }
  const forts = g.buildings.filter(b => b.type === 'fort' && !b.site);
  if (forts.length >= 2) { const P = G.wallPlan(forts[0], forts[1]); if (!P.why) g.walls.push({ a: forts[0].i, b: forts[1].i, ...P.line }); forts[0].units = 30; G.buildRoads(); }
  run(20);
  window.__c = [cx, cy];
});
const shots = [[1.2, 'region'], [8, 'town'], [30, 'detail'], [55, 'close']];
for (const [z, name] of shots) {
  await page.evaluate(z => { const G = window.__game, [cx, cy] = window.__c; G.cam.follow = null; G.cam.anim = null; G.cam.x = cx; G.cam.y = cy; G.cam.zoom = z; G.toggleCmdMenu(false); G.toggleBuildMenu(false); document.querySelectorAll('#notes .note').forEach(n => n.remove()); }, z);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `show-${mobile ? 'm' : 'd'}-${name}.png` });
}
console.log(errs.join('\n') || 'no errors');
await browser.close();
