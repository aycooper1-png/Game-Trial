import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack)); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
await page.evaluate(() => localStorage.clear()); await page.reload();
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [], M = G.arrays();
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry();
  // 1. creative on, spend, off: stock restored, map kept
  const before = JSON.stringify(Object.fromEntries(Object.entries(A.res).map(([k, v]) => [k, Math.round(v)])));
  const owned0 = g.ownedCount;
  (0, eval)('toggleDebug()');
  run(3);
  log.push(['creative on', g.debug, 'wood', Math.round(A.res.wood)]);
  (0, eval)('toggleDebug()');
  const modal = document.getElementById('md-text').innerText.slice(0, 40);
  document.querySelector('#md-btns button').click();      // "Off, keep this map"
  const after = JSON.stringify(Object.fromEntries(Object.entries(A.res).map(([k, v]) => [k, Math.round(v)])));
  log.push(['creative off', !g.debug, 'modal', modal, 'stock same', before === after, before.slice(0, 80), after.slice(0, 80), 'map kept', g.ownedCount >= owned0]);
  // 2. gradual sowing: a new farm
  const spotIn = (C, type, r0 = 3) => { for (let r = r0; r < 48; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const i = G.idx(Math.floor(C.lx) + dx, Math.floor(C.ly) + dy); if (!G.canBuild(i, type) && G.countryAt(i) === C) return i; } return -1; };
  A.res.wood = 500; A.res.stone = 500;
  const fi = spotIn(A, 'farm', 6); G.tryBuild(fi, 'farm');
  for (let k = 0; k < 90 && G.buildingAt(fi)?.site; k++) run(1);
  const fb = G.buildingAt(fi), field = () => (fb.field != null ? M.depositOf.filter ? 0 : 0 : 0);
  const count = () => { let n = 0; const d = fb.field; for (let i = 0; i < M.depositOf.length; i++) if (M.depositOf[i] === d) n++; return n; };
  const seq = [count()]; for (let k = 0; k < 6; k++) { run(2); seq.push(count()); }
  log.push(['farm built', !fb.site, 'field tiles over 12s', seq.join(','), 'still to sow', (fb.toSow || []).length]);
  // 3. new troops and vehicles with tech
  const names = [];
  for (const t of ['warrior', 'flight', 'electronics', 'computing', 'cais']) { G.completeTech(t, true); names.push(G.unitStats(new Set([...['warrior','flight','electronics','computing','cais'].slice(0, names.length + 1)])).type.name); }
  log.push(['troop line', names.join(' > ')]);
  log.push(['car/boat tiers', G.CFG ? 0 : 0]);
  // 4. a colony on Aries: domes, terraformers
  for (const t of ['wheel', 'rocketry', 'electricity', 'spaceflight', 'domes', 'terraform', 'fission']) G.completeTech(t, true);
  const fill = C => { for (const r of ['iron', 'stone', 'oil', 'wood', 'wheat', 'chips', 'silicon', 'cobalt', 'gold', 'uranium']) C.res[r] = 3000; };
  fill(A);
  let ci = spotIn(A, 'computer', 4); G.tryBuild(ci, 'computer'); for (let k = 0; k < 120 && G.buildingAt(ci)?.site; k++) { fill(A); run(1); }
  const pi = spotIn(A, 'pad'); G.tryBuild(pi, 'pad'); for (let k = 0; k < 60 && G.buildingAt(pi)?.site; k++) { fill(A); run(1); }
  const pad = G.buildingAt(pi); pad.rocket = { fuel: 400 }; A.people = 140; fill(A);
  G.startColony(pad, 2);
  let site = -1; for (let r = 0; r < 300 && site < 0; r++) { const i = G.idx(400 + r, 450); if (G.isLand(i) && M.depositOf[i] < 0) site = i; }
  log.push(['colony from', JSON.stringify(g.colonyFrom), 'site', site, 'world now', G.getWorld()]);
  G.pickColonySite(site);
  log.push(['ships', g.colonyShips.length, JSON.stringify(g.colonyShips[0] || {}).slice(0, 160)]);
  for (let k = 0; k < 240 && !(G.worldData[2] && G.worldData[2].g && G.worldData[2].g.countries.some(c => c.alive)); k++) run(1);
  G.viewWorld(2);
  const C2 = G.activeCountry();
  log.push(['on aries', G.getWorld(), 'colony', !!C2, 'terra', JSON.stringify(G.terraOf()).slice(0, 80), 'need', G.terraNeed()]);
  if (C2) {
    fill(C2); C2.people = 400;
    const cx2 = Math.floor(C2.lx), cy2 = Math.floor(C2.ly);
    for (let dy = -70; dy <= 70; dy++) for (let dx = -70; dx <= 70; dx++) { const i = G.idx(cx2 + dx, cy2 + dy); if (G.isLand(i) && !M.owner[i]) G.claim(i, C2.id); }
    const tf = [], pws = [], why = {};
    const grid = (type, list, want) => { for (let gy = -60; gy <= 60 && list.length < want; gy += 6) for (let gx = -60; gx <= 60 && list.length < want; gx += 6) { const i = G.idx(cx2 + gx, cy2 + gy); const w = G.canBuild(i, type); if (!w) { G.tryBuild(i, type); list.push(i); } else why[w] = (why[w] || 0) + 1; } };
    grid('terraformer', tf, G.terraNeed() + 1); grid('reactor', pws, 6);
    for (let k = 0; k < 60 && [...tf, ...pws].some(i => G.buildingAt(i)?.site); k++) { fill(C2); for (const i of [...tf, ...pws]) if (G.buildingAt(i)?.site) G.rushSite(G.buildingAt(i)); run(1); }
    log.push(['why not', JSON.stringify(why).slice(0, 200)]);
    fill(C2); run(3);
    const d0 = G.terraOf().desert;
    log.push(['terraformers built', tf.filter(i => G.buildingAt(i) && !G.buildingAt(i).site).length, 'powered', G.poweredTerraformers(), 'need', G.terraNeed(), 'sat', C2.sat?.toFixed(2)]);
    for (let k = 0; k < 20; k++) { fill(C2); run(1); }
    log.push(['desert 20s later', d0, '->', G.terraOf().desert, 'active', G.terraOf().active]);
    // force near-finish and check it completes and saves
    const P = G.terraOf(); const left = []; for (let i = 0; i < M.biome.length; i++) if (M.biome[i] === 3) left.push(i);
    log.push(['desert biome code check', left.length]);
  }
  window.__C2 = C2 && [C2.lx, C2.ly];
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
await page.evaluate((Z) => { const G = window.__game; G.cam.follow = null; G.cam.anim = null; G.cam.zoom = Z; G.cam.x = window.__C2[0]; G.cam.y = window.__C2[1]; document.querySelectorAll('.note').forEach(e => e.remove()); }, +(process.env.Z || 14));
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/r7a_dome.png' });
const fin = await page.evaluate(() => { const G = window.__game; const P = G.terraOf(); P.desert = 10; P.timer = 5; G.stepPlanetTerraform(0.1); return [P.done, document.querySelector('#notes .nt')?.textContent]; });
console.log('finish', JSON.stringify(fin));
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/r7a_nodome.png' });
console.log(errs.slice(0, 6).join('\n') || 'no errors');
await browser.close();
