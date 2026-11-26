import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
await page.evaluate(() => localStorage.clear()); await page.reload();
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const shot = async (name, fn) => { await page.evaluate(fn); await page.waitForTimeout(500); await page.screenshot({ path: `/tmp/r10_${name}.png` }); };
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry();
  for (const t of ['wheel', 'rocketry', 'electricity', 'spaceflight', 'reusable', 'domes', 'computing', 'mccs', 'qca', 'casimir', 'dyson', 'fission', 'terraform']) G.completeTech(t, true);
  const fill = C => { for (const r of ['iron', 'stone', 'oil', 'wood', 'wheat', 'chips', 'silicon', 'cobalt', 'gold', 'uranium']) C.res[r] = 9000; };
  fill(A);
  const spotIn = (C, type, r0 = 3) => { for (let r = r0; r < 30; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const i = G.idx(Math.floor(C.lx) + dx, Math.floor(C.ly) + dy); if (!G.canBuild(i, type) && G.countryAt(i) === C) return i; } return -1; };
  const ci = spotIn(A, 'computer', 4); G.tryBuild(ci, 'computer');
  const pi = spotIn(A, 'pad'); G.tryBuild(pi, 'pad');
  const p2 = spotIn(A, 'pad', 8); G.tryBuild(p2, 'pad');
  const ri = spotIn(A, 'receiver', 6); window.__why = [ri, G.canBuild(G.idx(Math.floor(A.lx) + 7, Math.floor(A.ly)), 'receiver')]; G.tryBuild(ri, 'receiver');
  for (let k = 0; k < 60 && [ci, pi, p2, ri].some(i => G.buildingAt(i)?.site); k++) { fill(A); for (const i of [ci, pi, p2, ri]) if (G.buildingAt(i)?.site) G.rushSite(G.buildingAt(i)); run(1); }
  // start both megaprojects
  G.showBuildingCard(G.buildingAt(pi));
  log.push(['pad card', document.getElementById('bc-body').innerText.replace(/\n/g, ' | ').slice(-360)]);
  G.startMega('warp', G.buildingAt(pi)); G.startMega('dyson', G.buildingAt(p2));
  for (let k = 0; k < 40; k++) { fill(A); run(1); }
  log.push(['after 40s', 'warp', JSON.stringify({ st: g.warp.stage, runs: g.warp.runs, run: g.warp.run && g.warp.run.leg }), 'dyson', JSON.stringify({ st: g.dyson.stage, runs: g.dyson.runs }), 'power', G.dysonPower().toFixed(2)]);
  window.__mid = true;
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
await shot('building', () => { const G = window.__game, p = G.megaOf('warp'); G.cam.follow = null; G.cam.anim = null; const [x, y] = (() => { const D = G.DISK; return [D.cx + D.R * 1.16, D.cy]; })(); G.cam.zoom = 0.5; document.querySelectorAll('.note').forEach(e => e.remove()); G.showBuildingCard(null); });
const out2 = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry(), fill = C => { for (const r of ['iron', 'stone', 'oil', 'wood', 'wheat', 'chips', 'silicon', 'cobalt', 'gold', 'uranium']) C.res[r] = 9000; };
  for (let k = 0; k < 400 && (g.warp.stage !== 'ready' || g.dyson.stage !== 'done'); k++) { fill(A); run(1); }
  log.push(['finished', g.warp.stage, g.dyson.stage, 'power', G.dysonPower()]);
  // a colony ship to Aries goes through the drive
  const pad = g.buildings.find(b => b.type === 'pad' && G.owner[b.i]); pad.rocket = { fuel: 400 }; A.people = 400; fill(A);
  G.startColony(pad, 2);
  const M = G.arrays(); let site = -1; for (let r = 0; r < 300 && site < 0; r++) { const i = G.idx(400 + r, 450); if (G.isLand(i) && M.depositOf[i] < 0) site = i; }
  G.pickColonySite(site);
  const cs = g.colonyShips[0];
  log.push(['colony ship', !!cs, cs && cs.warp, cs && cs.T]);
  let jumped = -1; for (let k = 0; k < 60 && g.colonyShips.length; k++) { run(0.25); if (jumped < 0 && g.warp.w === 2) jumped = k; if (k === 18) window.__dock = true; }
  log.push(['drive now over', g.warp.w, 'jumped at tick', jumped, 'colony ships left', g.colonyShips.length]);
  return log;
});
for (const l of out2) console.log(JSON.stringify(l));
await shot('done', () => { const G = window.__game; G.viewWorld(0); G.followBody('sun'); window.__rc = G.game.buildings.filter(b => b.type === 'receiver').map(b => [!!G.owner[b.i], !!b.site]); document.querySelectorAll('.note').forEach(e => e.remove()); G.showBuildingCard(null); });
// close-ups of the drive art, drawn straight onto a canvas at three stages
const art = await page.evaluate(() => {
  const G = window.__game, c = document.createElement('canvas'); c.width = 900; c.height = 300; const g = c.getContext('2d');
  g.fillStyle = '#05070d'; g.fillRect(0, 0, 900, 300);
  for (let k = 0; k < 120; k++) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(Math.random() * 900, Math.random() * 300, 1, 1); }
  G.drawWarpDrive(g, 150, 150, 220, { frac: 0.45, ready: false, clamp: 0, docked: null, t: 3, jump: 99 });
  G.drawWarpDrive(g, 450, 150, 220, { frac: 1, ready: true, clamp: 1, docked: 'shuttle', t: 3, jump: 99 });
  G.drawWarpDrive(g, 750, 150, 220, { frac: 1, ready: true, clamp: 1, docked: 'shuttle', t: 3, jump: 0.35 });
  return c.toDataURL();
});
console.log('receivers', JSON.stringify(await page.evaluate(() => [window.__rc, window.__why])));
const fs = await import('fs'); fs.writeFileSync('/tmp/r10_drive.png', Buffer.from(art.split(',')[1], 'base64'));
console.log(errs.slice(0, 5).join('\n') || 'no errors');
await browser.close();
