import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 90000 });
await page.evaluate(() => localStorage.clear()); await page.reload();
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 90000 });
await page.evaluate(() => {
  const G = window.__game, g = G.game;
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry();
  for (const t of G.CFG.techs.map(t => t.id)) G.completeTech(t, true);
  const fill = C => { for (const r of ['iron', 'stone', 'oil', 'wood', 'wheat', 'uranium']) C.res[r] = 8000; };
  fill(A); A.people = 200;
  const spotIn = (C, type, r0 = 3) => { for (let r = r0; r < 14; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const i = G.idx(Math.floor(C.lx) + dx, Math.floor(C.ly) + dy); if (!G.canBuild(i, type) && G.countryAt(i) === C) return i; } return -1; };
  const pi = spotIn(A, 'pad'), ai = spotIn(A, 'airport', 6), li = spotIn(A, 'lpad', 8);
  G.tryBuild(pi, 'pad'); G.tryBuild(ai, 'airport'); G.tryBuild(li, 'lpad');
  for (let k = 0; k < 90 && [pi, ai, li].some(i => G.buildingAt(i)?.site); k++) { fill(A); run(1); }
  const pad = G.buildingAt(pi); pad.rocket = { fuel: 400 }; A.people = 200; fill(A);
  G.startColony(pad, 1);
  const M = G.arrays(); let site = -1; for (let r = 0; r < 200 && site < 0; r++) { const i = G.idx(500 + r, 500); if (M.biome[i] === 2 && M.depositOf[i] < 0) site = i; }
  G.pickColonySite(site); run(35);
  G.viewWorld(1); const C2 = G.activeCountry(); fill(C2);
  const mp = spotIn(C2, 'pad', 2), ml = spotIn(C2, 'lpad', 4), mt = spotIn(C2, 'terraformer', 5), mr = spotIn(C2, 'receiver', 6);
  G.tryBuild(mp, 'pad'); G.tryBuild(ml, 'lpad'); G.tryBuild(mt, 'terraformer'); G.tryBuild(mr, 'receiver');
  for (let k = 0; k < 120 && [mp, ml, mt, mr].some(i => G.buildingAt(i)?.site); k++) { fill(C2); run(1); }
  G.viewWorld(0); fill(A);
  G.buildDysonRocket(pad); run(92); G.launchDyson(); run(41 + 125);
  G.buyShuttle(pad);
  for (let k = 0; k < 400; k++) { fill(A); G.tick(0.25); const sh = g.shuttles[0]; if (sh.state === 'tow' && sh.w === 1 && sh.towing != null) break; }
  window.__moonCam = [C2.lx, C2.ly];
  const n = g.nations.find(n => n.alive); const tgt = g.buildings.find(b => b.type === 'settlement' && G.arrays().aiOf[b.i] === n.id + 1);
  window.__tgt = tgt.i;
});
// 1: the moon colony with its rocket being towed
await page.evaluate(() => { const G = window.__game; G.viewWorld(1); const sh = G.game.shuttles[0]; const car = G.game.cars.find(v => v.id === sh.towing); const [x, y] = car ? [car.x, car.y] : window.__moonCam; G.cam.follow = null; G.cam.x = x; G.cam.y = y; G.cam.zoom = 30; G.toggleCmdMenu(false); document.querySelectorAll('#notes .note').forEach(n => n.remove()); });
await page.waitForTimeout(900);
await page.screenshot({ path: 'sp-moon.png' });
// 2: the sun with the swarm
await page.evaluate(() => { const G = window.__game; G.viewWorld(0); G.followBody('sun', { quiet: true }); G.cam.zoom *= 7; document.querySelectorAll('#notes .note').forEach(n => n.remove()); });
await page.waitForTimeout(900);
await page.screenshot({ path: 'sp-sun.png' });
// 3: a bomber on its way
await page.evaluate(() => { const G = window.__game, g = G.game; G.stopFollow && G.stopFollow(); g.cam = g.cam; for (const r of ['iron', 'oil', 'uranium']) G.activeCountry().res[r] = 8000; G.sendBomber(window.__tgt % G.W, window.__tgt / G.W | 0); for (let k = 0; k < 40; k++) G.tick(0.05); const B = g.bombers[0]; if (B) { const u = B.d / B.len; G.cam.follow = null; G.cam.x = B.x0 + (B.x1 - B.x0) * u; G.cam.y = B.y0 + (B.y1 - B.y0) * u; G.cam.zoom = 14; } });
await page.waitForTimeout(900);
await page.screenshot({ path: 'sp-bomber.png' });
console.log(errs.join('\n') || 'no errors');
await browser.close();
