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
  for (const t of ['warrior', 'wheel', 'masonry', 'metallurgy', 'gunpowder']) G.completeTech(t, true);
  for (let k = 0; k < 6; k++) { A.people = A.cap + 200; G.setPct(100); G.startPush(cx + (k % 2 ? 30 : -30), cy + 10); run(12); }
  const spotNear = (x, y, type) => { for (let r = 0; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const i = G.idx(x + dx, y + dy); if (!G.canBuild(i, type) && G.countryAt(i) === A) return i; } return -1; };
  A.res.stone = 900; A.res.wood = 900; A.res.iron = 600;
  const f = [spotNear(cx - 14, cy + 6, 'fort'), spotNear(cx, cy + 8, 'fort'), spotNear(cx + 14, cy + 6, 'fort')];
  for (const i of f) G.tryBuild(i, 'fort');
  for (let k = 0; k < 160 && f.some(i => G.buildingAt(i)?.site); k++) run(1);
  log.push(['forts built', f.map(i => !G.buildingAt(i)?.site)]);
  // easy picking: click near (not on) the second fort
  g.wallFrom = f[0];
  const [fx, fy] = [f[1] % G.W + 0.5 + 1.6, (f[1] / G.W | 0) + 0.5 + 1.2];
  G.cam.zoom = 8; G.cam.follow = null; G.cam.anim = null; G.cam.x = fx; G.cam.y = fy;
  const [sx, sy] = G.toScreen(fx, fy);
  G.mouse.x = sx; G.mouse.y = sy;
  G.clickAt(0, sx, sy);
  const md = document.querySelector('#modal.show .md-title, .modal.show .md-title');
  log.push(['click 2 tiles off the fort opens the wall prompt', !!md, md && md.textContent]);
  const go = [...document.querySelectorAll('button')].find(b => b.textContent === 'Build the wall'); if (go) go.click();
  const P = G.wallPlan(G.buildingAt(f[1]), G.buildingAt(f[2])); if (!P.why) g.walls.push({ a: f[1], b: f[2], ...P.line, dmg: 0, up: {} });
  G.buildRoads();
  log.push(['walls', g.walls.length, 'states', g.walls.map(G.wallState).join(','), 'max', g.walls.map(w => Math.round(G.wallMax(w))).join(',')]);
  const B = f.map(i => G.buildingAt(i));
  B[0].units = 40; B[1].units = 40; B[2].units = 40;
  // damage the first stretch: cracked, then breached
  const w0 = g.walls[0], w1 = g.walls[1];
  G.damageWall(w0, G.wallMax(w0) * 0.5);
  log.push(['after half damage', G.wallState(w0), 'NET wall bit at mid', G.NET[w0.tiles[Math.floor(w0.tiles.length / 2)]] & 2]);
  G.damageWall(w0, G.wallMax(w0));
  log.push(['after full damage', G.wallState(w0), 'NET bit', G.NET[w0.tiles[Math.floor(w0.tiles.length / 2)]] & 2, 'other stretch', G.wallState(w1)]);
  G.damageFort(B[2], G.fortMax(B[2]) * 0.6);
  log.push(['fort 3', G.fortState(B[2])]);
  // peacetime mending: crews go out; haulers bring stone
  for (let k = 0; k < 3; k++) G.buyVehicle('car', 0);
  A.res.stone = 500;
  let crewSeen = 0, mendJob = false;
  for (let k = 0; k < 240 && (w0.dmg > 0.01 || B[2].dmg > 0.01); k++) { run(1); crewSeen = Math.max(crewSeen, g.armies.filter(a => a.rep).length); if (g.cars.some(v => v.job && v.job.type === 'mend')) mendJob = true; }
  log.push(['peace mend: crews', crewSeen, 'hauler mend job', mendJob, 'wall', G.wallState(w0), Math.round(w0.dmg * 10) / 10, 'fort', G.fortState(B[2])]);
  // war: soldiers fetch stone themselves
  const n = g.nations.find(n => n.alive); n.hostile = true;
  G.damageWall(w1, G.wallMax(w1) * 0.7);
  let fetchSeen = false;
  for (let k = 0; k < 240 && w1.dmg > 0.01; k++) { run(1); if (g.armies.some(a => a.rep && (a.purpose === 'fetch' || a.carry > 0))) fetchSeen = true; if (g.cars.some(v => v.job && v.job.type === 'mend')) mendJob = 'WAR'; }
  log.push(['war mend: soldiers fetched stone', fetchSeen, 'haulers used in war?', mendJob === 'WAR', 'wall', G.wallState(w1)]);
  // upgrades
  A.res.iron = 2000; A.res.stone = 2000; A.res.oil = 500;
  const G0 = G.wallGroupOf(w0);
  log.push(['group size', G0.length, 'turret cost', JSON.stringify(G.upgradeCost(G0, 'turret'))]);
  G.buyWallUpgrade(w0, 'turret');
  log.push(['turrets on both', g.walls.map(w => !!(w.up && w.up.turret)).join(',')]);
  G.completeTech('steam', true); G.completeTech('electricity', true);
  const max0 = G.wallMax(w0); G.buyWallUpgrade(w0, 'iron'); log.push(['iron wall: max x', (G.wallMax(w0) / max0).toFixed(2)]);
  // iron wall stops a missile that crosses it
  const [ax, ay] = w0.pts[Math.floor(w0.pts.length / 2)];
  const cross = G.ironWallCross(ax, ay - 20, ax, ay + 20), round = G.ironWallCross(ax + 200, ay - 20, ax + 200, ay + 20);
  log.push(['missile across iron wall crosses at', cross.toFixed(2), 'one going round', round]);
  // a wall split: remove the middle fort -> two walls, upgrades kept separately
  g.walls.push({ ...w1, a: f[2], b: f[2] }); g.walls.pop();
  // card
  G.showWallCard(w0);
  log.push(['card', document.getElementById('bc-title').textContent, document.getElementById('bc-body').innerText.slice(0, 300)]);
  log.push(['buttons', [...document.querySelectorAll('#bc-btns button')].map(b => b.textContent).join(' | ')]);
  // war ends with a fort lost: wall gone for good
  G.aiTake(n, f[2]); G.buildRoads();
  log.push(['fort 3 lost: walls still', g.walls.length]);
  G.setWar('P', n.id, false);
  log.push(['peace: walls', g.walls.length, 'fort 3 exists', !!G.buildingAt(f[2])]);
  window.__wpos = [ax, ay];
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
await page.evaluate(() => { const G = window.__game; G.cam.x = window.__wpos[0]; G.cam.y = window.__wpos[1]; G.cam.zoom = 9; G.damageWall(G.game.walls[0], G.wallMax(G.game.walls[0]) * 0.5); G.showWallCard(G.game.walls[0]); });
await page.waitForTimeout(700);
await page.screenshot({ path: 'r5wall.png' });
console.log(errs.join('\n') || 'no errors');
await browser.close();
