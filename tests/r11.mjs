import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
await page.evaluate(() => localStorage.clear()); await page.reload();
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(async () => {
  const G = window.__game, g = G.game, log = [];
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry();
  for (const t of ['warrior', 'wheel', 'masonry', 'sailing']) G.completeTech(t, true);
  // a second territory by expedition across the water
  A.people = A.cap + 300; A.res.wood = 999; A.res.stone = 999;
  const M = G.arrays();
  let far = -1; const cx = Math.floor(A.lx), cy = Math.floor(A.ly);
  for (let r = 40; r < 400 && far < 0; r += 3) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, r]]) { const i = G.idx(cx + dx, cy + dy); if (G.isLand(i) && !M.owner[i] && !M.aiOf[i] && !G.sameLand(i, G.idx(cx, cy))) { far = i; break; } }
  G.setPct(50); G.launchExpedition(cx + 60, cy + 10, { auto: true });
  for (let k = 0; k < 120 && g.countries.filter(c => c.alive).length < 2; k++) run(1);
  const B = g.countries.find(c => c.alive && c !== A);
  log.push(['second territory', !!B, B && B.short]);
  if (!B) return log;
  // B is poor; A is rich: build a fort in B
  B.res.stone = 0; B.res.wood = 0; A.res.stone = 900; A.res.wood = 900;
  G.viewWorld(0); G.setActive && G.setActive(B.id);
  const spot = (C, type) => { for (let r = 2; r < 12; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const i = G.idx(Math.floor(C.lx) + dx, Math.floor(C.ly) + dy); if (!G.canBuild(i, type) && G.countryAt(i) === C) return i; } return -1; };
  const fi = spot(B, 'fort');
  const r1 = G.tryBuild(fi, 'fort');
  const md = document.querySelector('#modal.show #md-text')?.innerText.replace(/\s+/g, ' ') || '';
  log.push(['ask', r1, md.slice(0, 260)]);
  [...document.querySelectorAll('#md-btns button')].find(x => x.textContent.startsWith('Import'))?.click();
  log.push(['site', !!G.buildingAt(fi)?.site, 'shipments', g.shipments.length, JSON.stringify(g.shipments[0] && g.shipments[0].legs.map(L => L.kind + ':' + L.spr))]);
  for (let k = 0; k < 400 && G.buildingAt(fi)?.site; k++) run(1);
  log.push(['fort in the poor territory built', !G.buildingAt(fi)?.site]);
  // troops: a base at home with troops, transfer to B
  A.res.wood = 900; A.res.stone = 900;
  const bi = spot(A, 'base'); G.tryBuild(bi, 'base'); for (let k = 0; k < 90 && G.buildingAt(bi)?.site; k++) run(1);
  const base = G.buildingAt(bi); base.units = 20;
  G.showBuildingCard(base);
  const tbtn = [...document.querySelectorAll('button')].find(x => x.textContent.startsWith('Transfer troops'));
  log.push(['transfer button', !!tbtn]);
  tbtn && tbtn.click();
  const dlg = document.querySelector('#modal.show #md-text')?.innerText.replace(/\s+/g, ' ') || '';
  log.push(['dialog', dlg.slice(0, 200)]);
  document.querySelector('#md-text [data-c]')?.click();
  await new Promise(r => setTimeout(r, 50));
  log.push(['confirm', document.querySelector('#modal.show .md-title')?.textContent]);
  [...document.querySelectorAll('#md-btns button')].find(x => x.textContent === 'Confirm')?.click();
  log.push(['sent', base.units, 'convoys', g.shipments.filter(S => S.troops).length, JSON.stringify(g.shipments.filter(S => S.troops).map(S => S.legs.map(L => L.kind + ':' + L.spr)))]);
  const fort = G.buildingAt(fi), u0 = fort.units || 0;
  for (let k = 0; k < 300 && g.shipments.some(S => S.troops); k++) run(1);
  log.push(['arrived at B fort', (fort.units || 0) - u0]);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
console.log(errs.slice(0, 4).join('\n') || 'no errors');
await browser.close();
