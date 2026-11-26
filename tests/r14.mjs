import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
await page.evaluate(() => localStorage.clear()); await page.reload();
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [], E = s => (0, eval)(s);
  G.stopSaving();
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const A = G.activeCountry(); run(2);
  const notes = () => [...document.querySelectorAll('#notes .note')].map(e => e.innerText.replace(/\n/g, ' ')).slice(0, 1).join('');
  // 1) a trade asking too much: a counter-offer with three buttons
  const n = g.nations.filter(n => n.alive).sort((p, q) => Math.hypot(p.lx - A.lx, p.ly - A.ly) - Math.hypot(q.lx - A.lx, q.ly - A.ly))[0];
  n.stock.stone = 500; A.res.wood = 300;
  G.openDiplomacy(n);
  E(`dipDraft = { give: { res: { wood: 50 }, towns: [] }, ask: { res: { stone: 120 }, towns: [] } }`);
  document.querySelector('#diplo button[data-dp="trade"]').click();
  run(30);
  const note = [...document.querySelectorAll('#notes .note')].find(e => /counters/.test(e.innerText));
  log.push(['trade answer', notes(), 'buttons', note ? [...note.querySelectorAll('button')].map(b => b.textContent).join('/') : '-']);
  if (note) { const st0 = A.res.stone, w0 = A.res.wood; [...note.querySelectorAll('button')].find(b => b.textContent === 'Accept').click(); log.push(['wood right after accepting', Math.round(w0), '->', Math.round(A.res.wood), 'shipments', g.shipments.length]); run(60); log.push(['accepted the counter: wood', Math.round(A.res.wood), 'stone gained (on its way or in)', Math.round(A.res.stone - st0)]); }
  // 2) a treaty they won't sign: countered with gold
  A.res.gold = 500;
  G.openDiplomacy(n); document.querySelector('#diplo button[data-dp="t:research"]')?.click(); run(30);
  log.push(['research pact', [...document.querySelectorAll('#notes .note')].map(e => e.innerText.replace(/\n/g, ' ')).find(t => /esearch/.test(t) && !/discovered/.test(t))]);
  // 3) envoy delay grows with distance
  const far = g.nations.filter(m => m.alive).sort((p, q) => Math.hypot(q.lx - A.lx, q.ly - A.ly) - Math.hypot(p.lx - A.lx, p.ly - A.ly))[0];
  G.openDiplomacy(far); document.querySelector('#diplo button[data-dp="t:nonagg"]')?.click();
  const e1 = g.envoys.find(e => e.n === far.id);
  log.push(['envoy to the nearest takes', Math.round(2 + Math.hypot(n.lx - A.lx, n.ly - A.ly) / 20), 's; to the farthest', e1 && Math.round(e1.at - g.time), 's']);
  // 4) a nation's offer has Counter…
  E(`offerTo(game.nations[${n.id}], 'a trade', 'test', () => {}, () => {})`);
  log.push(['their offer buttons', [...document.querySelector('#notes .note .nbtns').querySelectorAll('button')].map(b => b.textContent).join('/')]);
  // 5) upkeep: haulers and troops eat
  const C = A; run(1);
  log.push(['upkeep wheat/s', (C.feedWheat || 0).toFixed(3), 'people eat', (C.people * 0.01).toFixed(2), 'bar', document.getElementById('bar-note').innerText]);
  // 6) traffic: put many haulers on one road
  const r = G.roadsList().find(r => r.side > 0);
  A.res.stone = 3000; if (r) { log.push(['road side', r.side, 'len', Math.round(r.len), 'country', G.countryAt(r.a)?.short]); r.busy = 1.2; for (let k = 0; k < 10; k++) G.tick(0.05); log.push(['busy road lanes', r.lanes || 1, 'stone left', Math.round(A.res.stone)]); }
  // 7) speed by load
  log.push(['speed empty / half / full', [0, 0.5, 1].map(f => E(`loadSpeed(${f})`).toFixed(2)).join(' / '), 'goods per trip-time', [0.5, 1].map(f => (f * E(`loadSpeed(${f})`)).toFixed(2)).join(' / ')]);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
console.log(errs.slice(0, 4).join('\n') || 'no errors');
await browser.close();
