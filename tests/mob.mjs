import { chromium, devices } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: undefined });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 90000 });
await page.evaluate(() => localStorage.clear());
await page.evaluate(() => {
  const G = window.__game, g = G.game; G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  for (const t of ['rocketry', 'electricity', 'spaceflight', 'reusable', 'domes', 'terraform', 'fission']) G.completeTech(t, true);
  A.res.iron = 2000; A.res.stone = 2000; A.res.oil = 600; A.res.wood = 600; A.res.wheat = 600; A.people = 120;
  let pi = -1; for (let r = 3; r < 14 && pi < 0; r++) for (let dx = -r; dx <= r && pi < 0; dx++) { const i = G.idx(cx + dx, cy - r); if (!G.canBuild(i, 'pad') && G.countryAt(i) === A) pi = i; }
  G.tryBuild(pi, 'pad'); for (let k = 0; k < 40 && G.buildingAt(pi).site; k++) run(1);
  const pad = G.buildingAt(pi); pad.rocket = { fuel: 400 }; A.people = 120;
  window.__pad = pi;
  G.cam.x = pi % G.W + 0.5; G.cam.y = (pi / G.W | 0) + 0.5; G.cam.zoom = 14;
  G.showBuildingCard(pad);
});
await page.waitForTimeout(900);
await page.screenshot({ path: 'm1-padcard.png' });
// fly
await page.evaluate(() => { const G = window.__game, pad = G.buildingAt(window.__pad); G.launchRocket(pad); });
await page.waitForTimeout(400);
await page.tap('#dp-settle');           // engine on (the middle button while flying)
await page.waitForTimeout(1500);
await page.screenshot({ path: 'm2-flight.png' });
await page.tap('#dp-park');
// colony + worlds row
await page.evaluate(() => {
  const G = window.__game, g = G.game, pad = G.buildingAt(window.__pad), A = G.activeCountry();
  pad.rocket = { fuel: 400 }; A.people = 120; A.res.iron = 2000; A.res.stone = 2000; A.res.wheat = 600; A.res.wood = 600;
  G.startColony(pad, 1);
});
await page.waitForTimeout(600);
await page.screenshot({ path: 'm3-pick.png' });
await page.touchscreen.tap(200, 420);
await page.waitForTimeout(300);
await page.evaluate(() => { const G = window.__game; for (let k = 0; k < 35 * 20; k++) G.tick(0.05); G.viewWorld(1); G.toggleCmdMenu(true); });
await page.waitForTimeout(900);
await page.screenshot({ path: 'm4-moon-cmd.png' });
await page.evaluate(() => { const G = window.__game; G.toggleCmdMenu(false); G.viewWorld(0); G.addOp('P', 0, 70); for (const n of G.game.nations) n.offerAt = -999; for (let k = 0; k < 5; k++) G.aiOffers(); });
await page.waitForTimeout(600);
await page.screenshot({ path: 'm5-offer.png' });
console.log(await page.evaluate(() => JSON.stringify({ world: window.__game.getWorld(), moon: window.__game.worldData[1] && window.__game.worldData[1].g.countries.length })));
console.log(errs.join('\n') || 'no errors');
await browser.close();
