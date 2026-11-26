import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
await page.evaluate(() => localStorage.clear()); await page.reload();
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const c = await page.evaluate(() => {
  const G = window.__game, g = G.game; G.stopSaving();
  (0, eval)('toggleDebug()');
  const A = G.activeCountry(), cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  for (let k = 0; k < 6; k++) { A.people = A.cap + 400; G.setPct(100); G.startPush(cx + [30, -30, 0, 0, 25, -25][k], cy + [0, 0, 30, -30, 25, -25][k]); for (let s = 0; s < 240; s++) G.tick(0.05); }
  const types = ['farm', 'cabin', 'camp', 'base', 'fort', 'turret', 'mortar', 'airdef', 'station', 'port', 'airport', 'burner', 'oilplant', 'reactor', 'solar', 'chipfab', 'datacenter', 'computer', 'pad', 'lpad', 'silo', 'refinery', 'derrick', 'receiver', 'settlement'];
  const placed = [];
  let k = 0;
  for (let r = 3; r < 16 && k < types.length; r += 2) for (let dx = -r; dx <= r && k < types.length; dx += 2) for (const dy of [-r, r]) { if (k >= types.length) break; const i = G.idx(cx + dx, cy + dy); if (!G.canBuild(i, types[k])) { G.tryBuild(i, types[k]); placed.push(types[k]); k++; } }
  for (let s = 0; s < 60; s++) { for (const b of g.buildings) if (b.site) G.rushSite(b); G.tick(0.05); }
  for (const b of g.buildings) if (b.site) G.rushSite(b);
  for (let s = 0; s < 200; s++) G.tick(0.05);
  const comp = g.buildings.find(b => b.type === 'computer'); if (comp) comp.lvl = 2;
  const farm = g.buildings.find(b => b.type === 'farm');
  document.querySelectorAll('.note').forEach(e => e.remove());
  G.cam.follow = null; G.cam.anim = null; G.cam.x = cx + 0.5; G.cam.y = cy + 0.5; G.cam.zoom = 22;
  return placed.length;
});
console.log('placed', c);
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/art_game1.png' });
await page.evaluate(() => { window.__game.cam.zoom = 34; });
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/art_game2.png' });
console.log(errs.join('\n') || 'no errors');
await browser.close();
