// Round 18: the simplified market (phone and desktop): pick, amount, buy, sell, reasons, feedback
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
for (const phone of [true, false]) {
  const page = await (await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 1300, height: 850 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.goto('http://localhost:8765/?seed=42'); await page.waitForFunction(() => !document.getElementById('loading'));
  const log = await page.evaluate(() => {
    const G = window.__game, E = s => (0, eval)(s), log = []; G.stopSaving(); E('tutEnd()');
    for (const t of ['petroleum', 'electronics']) G.completeTech(t, true);
    const A = G.activeCountry(); A.res.gold = 300; A.res.wood = 120; A.res.iron = 30;
    E('showMarket()');
    const st = () => ({ line: document.querySelector('.mk-line').innerText, buy: document.querySelector('.mk-buy').innerText + (document.querySelector('.mk-buy').disabled ? ' [off]' : ''), sell: document.querySelector('.mk-sell').innerText + (document.querySelector('.mk-sell').disabled ? ' [off]' : ''), why: [...document.querySelectorAll('.mk-why')].map(x => x.innerText).join(' / '), gold: Math.round(A.res.gold) });
    log.push(['opens on', JSON.stringify(st()), 'tiles', document.querySelectorAll('.mk-tile').length]);
    document.querySelector('.mk-buy').click(); log.push(['bought', document.querySelector('.mk-msg').innerText, JSON.stringify(st()), 'wood', Math.round(A.res.wood)]);
    document.querySelector('.mk-tile[data-r="iron"]').click(); document.querySelector('.mk-chip[data-n="100"]').click();
    log.push(['iron, 100', JSON.stringify(st())]);
    window.__st = st;
    return log;
  });
  for (const l of log) console.log((phone ? 'PHONE ' : 'DESK  ') + l.join(' | '));
  await page.waitForTimeout(250);
  await page.screenshot({ path: `/tmp/market_${phone ? 'phone' : 'desk'}.png` });
  console.log(errs.join('\n') || 'no errors');
}
await browser.close();
