import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
await page.goto(`http://localhost:8765/?seed=1005`);
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
console.log(await page.evaluate(() => {
  const G = window.__game; G.stopSaving(); for (let k = 0; k < 20 * 600; k++) G.tick(0.05);
  const t = {}; const time = (k, f) => { const a = performance.now(); f(); t[k] = Math.round(performance.now() - a); };
  const sv = G.mpSnapshot();
  for (const name of ['paintTerrain', 'buildFronts', 'recomputeNetwork', 'buildRoads', 'markNet', 'scanNationTiles']) { const f = (0, eval)(name); time(name, () => f()); }
  time('apply', () => G.mpApply(JSON.parse(JSON.stringify(sv)), false));
  return JSON.stringify(t);
}));
await browser.close();
