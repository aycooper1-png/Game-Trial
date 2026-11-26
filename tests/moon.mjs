import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext()).newPage();
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
console.log(await page.evaluate(() => { const G = window.__game; G.stopSaving(); const r = []; for (const w of [1, 2]) { G.genWorld(w); G.onWorld(w, () => r.push([w, G.game.landTiles, G.terraNeed()])); } return JSON.stringify(r); }));
await browser.close();
