import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.type() + ' ' + m.text()); });
await page.goto('http://localhost:8765/?seed=7');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  const toasts = [];
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry();
  const cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  const t0 = performance.now();
  // a lazy player: expands in rings every 20s and builds farms/settlements when it can
  for (let m = 0; m < 20; m++) {
    for (let k = 0; k < 3; k++) {
      const a = Math.random() * Math.PI * 2;
      G.startPush(Math.floor(A.lx + Math.cos(a) * 40), Math.floor(A.ly + Math.sin(a) * 40));
      run(20);
    }
    const n = document.getElementById('toast').textContent; if (n && !toasts.includes(n)) toasts.push(n);
    log.push([`min ${m + 1}`, 'pop', Math.round(g.population), 'cap', Math.round(A.cap), 'food', Math.round(A.foodCap), 'wheat', Math.round(A.res.wheat), A.hungry ? 'HUNGRY' : '', 'tech', g.research.done.size, g.research.cur,
      'AI', g.nations.map(n => `${n.pers.id[0]}${n.R.size}/${Math.round(n.units)}${n.hostile ? '!' : ''}`).join(' '), 'raids', g.raids.length]);
  }
  log.push(['sim ms', Math.round(performance.now() - t0), 'worst road rebuild ms', Math.round(g.roadMs || 0), 'roads', G.roadsList().length, 'cars', g.cars.length]);
  const t1 = performance.now(); for (let k = 0; k < 20; k++) G.render(); log.push(['render ms/frame', ((performance.now() - t1) / 20).toFixed(1)]);
  log.push(['toasts', toasts.slice(-8)]);
  G.saveGame = G.saveGame; // keep
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
// save + reload
await page.evaluate(() => window.__game.saveGame());
const before = await page.evaluate(() => { const g = window.__game.game; return { t: Math.round(g.time), dom: g.countries.filter(c => c.alive).length, done: [...g.research.done].length, b: g.buildings.length }; });
await page.goto('http://localhost:8765/');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
await page.waitForTimeout(1000);
const after = await page.evaluate(() => { const g = window.__game.game; return { t: Math.round(g.time), dom: g.countries.filter(c => c.alive).length, done: [...g.research.done].length, b: g.buildings.length }; });
console.log('save', JSON.stringify(before), 'load', JSON.stringify(after));
await page.screenshot({ path: 'shot-long.png' });
console.log(errs.join('\n') || 'no errors');
await browser.close();
