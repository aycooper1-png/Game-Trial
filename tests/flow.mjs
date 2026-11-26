import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.type() + ' ' + m.text()); });
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const C = () => G.activeCountry();
  // 1) expand a few times toward the east
  const cx = Math.floor(C().lx), cy = Math.floor(C().ly);
  G.setPct(100);
  for (let k = 0; k < 6; k++) { G.startPush(cx + 30, cy); run(15); }
  log.push(['after expand', C().tiles, Math.round(C().people), Math.round(C().cap), JSON.stringify(Object.fromEntries(Object.entries(C().res).map(([k, v]) => [k, Math.round(v)])))]);
  // 2) research all early techs instantly
  for (const t of ['warrior', 'wheel', 'masonry']) G.completeTech(t);
  log.push(['research now', g.research.cur, G.isUnlocked('base'), G.isUnlocked('fort')]);
  // 3) place a base with the ghost + confirm
  C().res.wood += 300; C().res.stone += 300;
  const free = [];
  for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) { const i = G.idx(cx + dx, cy + dy); if (!G.canBuild(i, 'base')) free.push(i); }
  G.setTool('base'); g.ghost.i = free[0]; g.ghost.set = true; G.confirmGhost();
  G.setTool('fort'); g.ghost.i = free[5]; g.ghost.set = true; G.confirmGhost(); G.setTool(null);
  log.push(['garrisons', G.garrisons().map(b => b.type)]);
  run(60);
  log.push(['units after 60s', G.garrisons().map(b => [b.type, Math.round(b.units)]), 'armies', g.armies.length, 'people', Math.round(C().people)]);
  run(60);
  log.push(['units after 120s', G.garrisons().map(b => [b.type, Math.round(b.units)]), 'people', Math.round(C().people)]);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
console.log(errs.join('\n') || 'no errors');
await browser.close();
