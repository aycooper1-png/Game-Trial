// Round 19: creative mode switched off from the bottom bar, the tutorial step about porters, the congratulations when
// every rival is gone (four wordings by aggression), "Return to map" after 30 s away from the world, and a saved
// camera looking at empty space put back over your land on load
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42'); await page.waitForFunction(() => !document.getElementById('loading'));
await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForFunction(() => !document.getElementById('loading'));
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, E = s => (0, eval)(s), log = [];
  const steps = E('TUT_STEPS').core; log.push(['tutorial steps', steps.length, 'porter step', steps.findIndex(s => s.title === 'More porters') + 1]);
  E('tutEnd()'); G.stopSaving();
  E('toggleDebug()'); E('updateHud()');
  const b = document.querySelector('#people-rate .dbg-off'); log.push(['bottom-bar button', b ? b.textContent : 'none']);
  b.click(); log.push(['it asks', document.querySelector('#modal.show .md-title')?.textContent]);
  [...document.querySelectorAll('#md-btns button')].find(x => x.textContent.startsWith('Off, keep')).click();
  log.push(['creative mode now', g.debug ? 'on' : 'off']);
  // victory: four wordings
  const said = [];
  for (const st of [{}, { wars: 4, betray: 1 }, { wars: 6, missiles: 10, betray: 2 }, { wars: 10, nukes: 4, betray: 3 }]) {
    g.style = { out: {}, hungry: 0, lost: 0, ...st }; g.time = Math.max(g.time, 100);
    for (const n of g.nations) { n.alive = false; n.tiles = 0; }
    E('checkVictory()');
    said.push(Math.round(E('aggression()')) + ': ' + (document.querySelector('#modal.show #md-text')?.innerText.replace(/\s+/g, ' ').slice(0, 230)));
    document.querySelectorAll('#md-btns button').forEach(x => x.click());
  }
  log.push(['victory', '\n  ' + said.join('\n  ')]);
  g.style.won = 1; E('checkVictory()'); log.push(['only once', !document.querySelector('#modal.show')]);
  return log;
});
for (const l of out) console.log(l.join(' | '));
// lost in space: pan far away, wait 30 s of frames, the button shows; press it: back over the land
await page.evaluate(() => { const c = (0, eval)('cam'); c.x += 5000; c.y += 3000; });
await page.waitForTimeout(5000);
console.log('after 5 s away: button', await page.evaluate(() => document.getElementById('lost-view').classList.contains('show')));
await page.evaluate(() => { window.__game.LV.off = 29; });
await page.waitForTimeout(1500);
console.log('after 30 s away: button', await page.evaluate(() => document.getElementById('lost-view').classList.contains('show')));
await page.screenshot({ path: '/tmp/lost_view.png' });
await page.tap('#lost-view');
await page.waitForTimeout(400);
console.log('after Return to map:', await page.evaluate(() => ({ viewing: window.__game.viewingWorld(), button: document.getElementById('lost-view').classList.contains('show') })));
// tiny on screen also counts as away
await page.evaluate(() => { (0, eval)('cam').zoom = 0.01; window.__game.LV.off = 29.5; });
await page.waitForTimeout(1200);
console.log('world a dot on screen: button', await page.evaluate(() => document.getElementById('lost-view').classList.contains('show')));
// a save looking at empty space: back over the land on load
await page.evaluate(() => { const c = (0, eval)('cam'); c.zoom = 14; c.x += 9000; (0, eval)('noSave = false; saveGame()'); });
await page.reload(); await page.waitForFunction(() => !document.getElementById('loading'));
console.log('reloaded: viewing the world', await page.evaluate(() => window.__game.viewingWorld()));
console.log(errs.join('\n') || 'no errors');
await browser.close();
