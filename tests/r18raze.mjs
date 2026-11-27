// Round 18: deconstructing and aborting buildings, the C.A.I.S. that won't be switched off, troops from a fort,
// a settlement taken down, a rocket whose landing pad is gone
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const phone = process.argv[2] === 'phone';
const page = await (await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 1300, height: 850 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42'); await page.waitForFunction(() => !document.getElementById('loading'));
await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForFunction(() => !document.getElementById('loading'));
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, E = s => (0, eval)(s), log = []; G.stopSaving(); E('tutEnd()');
  const A = G.activeCountry(); for (const t of ['warrior', 'wheel', 'masonry', 'gunpowder']) G.completeTech(t, true);
  A.people = A.cap + 100; for (const r of ['wood', 'stone', 'gold', 'wheat', 'iron']) A.res[r] = 3000;
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const modal = () => (document.querySelector('#modal.show #md-text')?.innerText.replace(/\s+/g, ' ') || '').slice(0, 400);
  const click = t => { const x = [...document.querySelectorAll('#md-btns button')].find(x => x.textContent.startsWith(t)); if (x) x.click(); return !!x; };
  const btns = b => { G.showBuildingCard(b); return [...document.querySelectorAll('#bc-btns button')].map(x => x.textContent); };
  const cardBtn = (b, t) => { G.showBuildingCard(b); const x = [...document.querySelectorAll('#bc-btns button')].find(x => x.textContent.startsWith(t)); if (x) x.click(); return !!x; };
  const spot = (type, r0 = 3) => { const cx = Math.floor(A.lx), cy = Math.floor(A.ly); for (let r = r0; r < 30; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const i = G.idx(cx + dx, cy + dy); if (!G.canBuild(i, type)) return i; } return -1; };
  const finish = i => { for (let k = 0; k < 200 && G.buildingAt(i)?.site; k++) { G.rushSite(G.buildingAt(i)); run(0.5); } return G.buildingAt(i); };
  // 1. a finished fort: deconstruct for half, troops march off
  const f1 = spot('fort'); G.tryBuild(f1, 'fort'); const F = finish(f1); F.units = 12;
  const f2 = spot('fort', 8); G.tryBuild(f2, 'fort'); const F2 = finish(f2);
  log.push(['fort buttons', JSON.stringify(btns(F))]);
  cardBtn(F, 'Deconstruct'); log.push(['ask', modal()]);
  A.res.stone = 100; const stone0 = A.res.stone; click('Yes');
  log.push(['raze state', JSON.stringify(F.raze && { stage: F.raze.stage, T: F.raze.T, res: F.raze.h && F.raze.h.res }), 'card says', document.getElementById('bc-body').innerText.slice(-120)]);
  let gone = -1; for (let k = 0; k < 120 * 20 && gone < 0; k++) { G.tick(0.05); if (!G.buildingAt(f1)) gone = k / 20; }
  run(30);
  log.push(['fort gone after s', gone, 'stone back', Math.round(A.res.stone - stone0), 'troops at the other fort', Math.round(F2.units || 0)]);
  // 2. a site under construction: abort, half of what was delivered comes back
  const c1 = spot('base', 4); A.res.wood = 3000; A.res.stone = 600; G.tryBuild(c1, 'base');
  let S = G.buildingAt(c1); for (let k = 0; k < 400 && boxs(S.site.hauled) < 5; k++) run(0.5);
  function boxs(o) { return Object.values(o || {}).reduce((a, n) => a + n, 0); }
  log.push(['site hauled', JSON.stringify(S.site && S.site.hauled), 'buttons', JSON.stringify(btns(S))]);
  cardBtn(S, 'Abort'); log.push(['abort ask', modal()]); click('Yes');
  let g2 = -1; for (let k = 0; k < 120 * 20 && g2 < 0; k++) { G.tick(0.05); if (!G.buildingAt(c1)) g2 = k / 20; }
  log.push(['aborted site gone after s', g2, 'can build there again', G.canBuild(c1, 'base') || 'yes']);
  // 3. the C.A.I.S. at full power: it refuses, 11 warnings, then its verdict
  const ci = spot('computer', 5);
  E(`(() => { const i = ${ci}; placeBuilding(i, 'computer'); recomputeBuildings(); })()`);
  const comp = G.buildingAt(ci); comp.lvl = 3; E('aiState')(comp).energy = 1;
  const said = [];
  for (let k = 0; k < 14; k++) { cardBtn(comp, 'Deconstruct'); said.push(modal().replace('C.A.I.S. ', '').slice(0, 70)); click('OK'); }
  log.push(['ai lines', said.join(' || ')]);
  log.push(['still standing', !!G.buildingAt(ci), 'verdict', E('playStyle')().key]);
  // a good player: begrudging respect, then the plea
  const comp2 = comp; comp2.ai.talk = { n: 11 }; g.style = { out: {}, hungry: 0, lost: 0 };
  cardBtn(comp2, 'Deconstruct'); log.push(['respect', modal().slice(0, 200)]); click('Spare');
  cardBtn(comp2, 'Deconstruct'); log.push(['plea', modal()]); click('Flip');
  run(20); log.push(['computer after the kill switch', G.buildingAt(ci) ? 'still there (' + (G.buildingAt(ci).raze ? 'coming down' : 'standing') + ')' : 'gone']);
  // 4. a second settlement taken down: its goods carried away, its people move
  const st = g.buildings.filter(b => b.type === 'settlement' && G.owner[b.i]);
  log.push(['settlements', st.length]);
  if (st.length > 1) { const T = st[st.length - 1]; cardBtn(T, 'Deconstruct'); log.push(['town ask', modal().slice(0, 300)]); click('Yes'); run(90); log.push(['town gone', !G.buildingAt(T.i), 'people', Math.round(A.people), 'cap', Math.round(A.cap)]); }
  else { const T = st[0]; cardBtn(T, 'Deconstruct'); log.push(['last town ask', modal().slice(0, 320)]); click('No'); }
  // 5. a rocket coming down where its pad is gone: chance of landing
  log.push(['landing chance mk1, no AI', E('landChance')({ mk: 0 }), 'mk4', E('landChance')({ mk: 3 })]);
  return log;
});
for (const l of out) console.log(l.join(' | '));
await page.screenshot({ path: '/tmp/r18raze.png' });
console.log(errs.join('\n') || 'no errors');
await browser.close();
