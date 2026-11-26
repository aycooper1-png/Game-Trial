import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
for (const [vw, vh, tag, mobile] of [[1300, 820, 'd', false], [390, 844, 'm', true]]) {
  const page = await (await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await page.goto('http://localhost:8765/?seed=42');
  await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
  const shot = async (name, fn) => { await page.evaluate(fn); await page.waitForTimeout(600); await page.screenshot({ path: `r5v-${tag}-${name}.png` }); };
  await page.evaluate(() => {
    const G = window.__game, g = G.game;
    G.stopSaving();
    const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
    const A = G.activeCountry();
    for (const t of ['wheel', 'rocketry', 'electricity']) G.completeTech(t, true);
    G.completeTech('spaceflight');
    A.res.iron = 900; A.res.stone = 900; A.res.oil = 300; A.res.gold = 250;
    const spotIn = (C, type, r0 = 3) => { for (let r = r0; r < 14; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const i = G.idx(Math.floor(C.lx) + dx, Math.floor(C.ly) + dy); if (!G.canBuild(i, type) && G.countryAt(i) === C) return i; } return -1; };
    window.__A = [A.lx, A.ly];
    const pi = spotIn(A, 'pad'); window.__pad = pi;
  });
  await shot('build', () => { const G = window.__game; G.toggleCmdMenu(false); G.toggleBuildMenu(true); });
  await page.evaluate(() => {
    const G = window.__game, g = G.game, A = G.activeCountry(), run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
    G.toggleBuildMenu(false);
    G.tryBuild(window.__pad, 'pad'); for (let k = 0; k < 60 && G.buildingAt(window.__pad).site; k++) run(1);
    G.buildingAt(window.__pad).rocket = { fuel: 400, told: true };
  });
  await shot('hint', () => { const G = window.__game, t = window.__pad; G.cam.follow = null; G.cam.anim = null; G.cam.x = t % G.W + 0.5; G.cam.y = (t / G.W | 0) + 0.5; G.cam.zoom = 14; });
  await shot('order', () => { const G = window.__game, b = G.buildingAt(window.__pad); G.orderStation(b); for (let k = 0; k < 60; k++) G.tick(0.05); G.cam.zoom = 3; });
  await shot('only', () => { const G = window.__game, b = G.buildingAt(window.__pad); for (let k = 0; k < 200; k++) G.tick(0.05); G.completeTech('reusable', true); b.shuttleOnly = true; G.cam.zoom = 14; });
  await shot('dipall', () => { const G = window.__game; G.openDiplomacyAll(); });
  await shot('dipone', () => { const G = window.__game; G.openDiplomacy(G.game.nations.find(n => n.alive)); });
  await shot('market', () => { const G = window.__game; G.showMarket(); });
  await shot('cmd', () => { const G = window.__game; document.querySelector('#md-btns button').click(); G.toggleCmdMenu(true); });
  console.log(tag, errs.join('\n') || 'no errors');
}
await browser.close();
