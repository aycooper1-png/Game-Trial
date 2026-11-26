import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 860 } })).newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  G.stopSaving();
  for (let k = 0; k < 2400; k++) G.tick(0.5);
  log.push(['after 20 min', g.nations.map(n => `${n.short}(${n.pers.id}) t${n.tiles} u${Math.round(n.units)}${n.alive ? '' : ' DEAD'}`).join(' | ')]);
  log.push(['wars', [...g.dip.wars].join(' '), 'alliances', g.alliances.map(a => a.name + ':' + a.members.join(',')).join(' ; ')]);
  log.push(['gaps', G.dbgAI().gaps.join(' ')]);
  log.push(['news', g.notes.filter(n => !n.title.includes('discovered')).map(n => n.title).join(' | ')]);
  // offers: make one nation friendly, one hostile-ish and strong
  const A = G.activeCountry(); A.res.iron = 300; A.res.stone = 300; A.res.wood = 300;
  const fr = g.nations.find(n => n.alive), foe = g.nations.find(n => n.alive && n !== fr);
  G.addOp('P', fr.id, 80); fr.offerAt = -999;
  const before = document.querySelectorAll('#notes .nbtns').length;
  for (let k = 0; k < 40; k++) { for (const n of g.nations) n.offerAt = -999; G.aiOffers(); }
  const btns = [...document.querySelectorAll('#notes .note')].filter(e => e.querySelector('.nbtns')).map(e => e.innerText.replace(/\n/g, ' / '));
  log.push(['offers shown', btns.length, btns.slice(0, 6).join('  ||  ')]);
  // accept the first offer
  const b0 = document.querySelector('#notes .nbtns button.go');
  if (b0) { b0.click(); log.push(['accepted, alliances', g.alliances.map(a => a.name + ':' + a.members.join(',')).join(' ; ')]); }
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
await page.waitForTimeout(500);
await page.screenshot({ path: 's6-offers.png' });
console.log(errs.join('\n') || 'no errors');
await browser.close();
