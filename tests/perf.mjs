import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 860 } })).newPage();
page.on('pageerror', e => console.log('PAGEERROR ' + e.message));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
console.log(await page.evaluate(() => {
  const G = window.__game; G.stopSaving();
  for (let k = 0; k < 600; k++) G.tick(1);
  const t = f => { const a = performance.now(); f(); return +(performance.now() - a).toFixed(1); };
  const out = {};
  out.scan = t(() => G.scanAiBorders());
  out.tick20 = t(() => { for (let k = 0; k < 20; k++) G.tick(0.05); }) / 20;
  G.genWorld(1);
  out.tick20moon = t(() => { for (let k = 0; k < 20; k++) G.tick(0.05); }) / 20;
  for (const z of [0.8, 3, 10, 30]) { G.cam.zoom = z; G.cam.x = G.activeCountry().lx; G.cam.y = G.activeCountry().ly; out['render' + z] = t(() => { for (let k = 0; k < 5; k++) G.render(); }) / 5; }
  out.save = t(() => { G.game.started = true; });
  return JSON.stringify(out);
}));
await browser.close();
