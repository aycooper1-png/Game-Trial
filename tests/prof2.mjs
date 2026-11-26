import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`http://localhost:8765/?seed=1005`);
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
console.log(await page.evaluate(() => {
  const G = window.__game, g = G.game; G.stopSaving(); for (let k = 0; k < 20 * 600; k++) G.tick(0.05);
  const sv = G.mpSnapshot(), t = [];
  for (let k = 0; k < 4; k++) { const a = performance.now(); G.mpApply(JSON.parse(JSON.stringify(sv)), k === 0); t.push(Math.round(performance.now() - a)); }
  const before = g.countries[0].res.wood;
  const sv2 = JSON.parse(JSON.stringify(sv)); sv2.countries[0].res.wood = 777; sv2.nations[0].units = 55;
  G.mpApply(sv2, false);
  return JSON.stringify({ ms: t, wood: Math.round(g.countries[0].res.wood), units: g.nations[0].units, owned: g.ownedCount });
}));
console.log(errs.join('\n') || 'no errors');
await browser.close();
