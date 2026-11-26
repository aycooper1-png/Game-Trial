import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  let polar = 0; for (let i = 0; i < G.biome.length; i++) if (G.biome[i] === G.POLAR) polar++;
  log.push(['polar tiles', polar]);
  // a site with crew
  A.res.wood += 200; A.res.stone += 200;
  let spot = -1;
  for (let r = 3; r < 10 && spot < 0; r++) for (let dx = -r; dx <= r && spot < 0; dx++) { const i = G.idx(cx + dx, cy - r); if (!G.canBuild(i, 'camp') && G.countryAt(i) === A) spot = i; }
  G.tryBuild(spot, 'camp');
  let crewSeen = false;
  for (let k = 0; k < 60; k++) { run(0.5); const b = G.buildingAt(spot); if (b.site && b.site.crew != null) crewSeen = true; if (!b.site) break; }
  log.push(['crew phase seen', crewSeen, 'built', !G.buildingAt(spot).site, 'puffs', g.puffs.length]);
  // bridge: find own coast and land across
  G.completeTech('masonry');
  G.setPct(100);
  let best = null;
  for (let r = 4; r < 60 && !best; r++) for (let a = 0; a < 48 && !best; a++) {
    const x = Math.round(cx + Math.cos(a / 48 * 6.283) * r), y = Math.round(cy + Math.sin(a / 48 * 6.283) * r), i = G.idx(x, y);
    if (G.biome[i] !== G.OCEAN) continue;
    // expand to the coast near it first
    best = [x, y, a];
  }
  // claim a corridor from the capital to the nearest sea, then try bridges from there
  let sea = -1, sd = 1e9;
  for (let i = 0; i < G.biome.length; i++) if (G.biome[i] === G.OCEAN) { const d = (i % G.W - cx) ** 2 + ((i / G.W | 0) - cy) ** 2; if (d < sd) { sd = d; sea = i; } }
  const ex = sea % G.W, ey = sea / G.W | 0, steps = Math.ceil(Math.sqrt(sd));
  for (let k = 0; k <= steps; k++) for (let w = -2; w <= 2; w++) { const x = Math.round(cx + (ex - cx) * k / steps) + w, y = Math.round(cy + (ey - cy) * k / steps); const i = G.idx(x, y); if (G.isLand(i) && !G.owner[i] && !G.aiOf[i]) G.claim(i, A.id); }
  let st = -1, plan = null, tries = 0;
  outer: for (let i = 0; i < G.owner.length; i++) {
    if (!G.owner[i] || !G.isCoastal(i)) continue;
    for (let a = 0; a < 32; a++) {
      const tx = i % G.W + Math.round(Math.cos(a / 32 * 6.283) * 40), ty = ((i / G.W) | 0) + Math.round(Math.sin(a / 32 * 6.283) * 40);
      if (tx < 0 || ty < 0 || tx >= G.W || ty >= G.H) continue;
      const p = G.bridgePlan(i, G.idx(tx, ty)); tries++;
      if (!p.why && (!plan || plan.why || p.len > plan.len)) { st = i; plan = p; plan.tgt = G.idx(tx, ty); }
      if (!plan) plan = p;
    }
  }
  log.push(['coastal tries', tries, typeof G.isCoastal, G.owner.reduce((s,v)=>s+(v?1:0),0)]); if (!plan) return log;
  log.push(['bridge plan', plan.why || `${plan.len} tiles, ${plan.cost.stone} stone`]);
  if (!plan.why) { A.res.stone += plan.cost.stone; log.push(['built bridge', G.buildBridge(st, plan.tgt), 'bridges', g.bridges.length, 'far end owned', G.owner[plan.b]]); run(2);
    log.push(['domains', g.countries.filter(c => c.alive).length]); G.cam.x = (st % G.W + plan.b % G.W) / 2; G.cam.y = ((st / G.W | 0) + (plan.b / G.W | 0)) / 2; G.cam.zoom = 9; }
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
await page.evaluate(() => window.__game.toggleCmdMenu(false));
await page.waitForTimeout(1200);
await page.screenshot({ path: 's3-bridge.png' });
await page.evaluate(() => { const G = window.__game, A = G.activeCountry(); G.cam.x = A.lx; G.cam.y = A.ly; G.cam.zoom = 40; A.res.wood += 300; A.res.stone += 300; let sp = -1; for (let r = 2; r < 8 && sp < 0; r++) for (let dx = -r; dx <= r && sp < 0; dx++) { const i = G.idx(Math.floor(A.lx) + dx, Math.floor(A.ly) + r); if (!G.canBuild(i, 'cabin') && G.countryAt(i) === A) sp = i; } if (sp >= 0) { G.tryBuild(sp, 'cabin'); G.cam.x = sp % G.W + 0.5; G.cam.y = (sp / G.W | 0) + 0.5; } });
await page.waitForTimeout(1200);
await page.screenshot({ path: 's3-workers.png' });
console.log(errs.join('\n') || 'no errors');
await browser.close();
