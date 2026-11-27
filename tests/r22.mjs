// Round 22: "Send my game". A game packed into a link (or a file when too big for WhatsApp) and opened elsewhere as a
// view-only copy; the receiver's own game untouched; the Command panel button; a broken link; phone layout.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const BIG = process.argv[2];                       // optional: a big save { k, v } as JSON, to check the file route
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const errs = [];
const say = (what, ok, extra) => console.log((ok ? 'ok   ' : 'FAIL ') + what, extra === undefined ? '' : JSON.stringify(extra));
const phone = async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().split('\n')[0].slice(0, 200)); });
  return { ctx, page };
};
const loaded = p => p.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 180000 });
const state = p => p.evaluate(() => { const g = window.__game.game; return { seed: (0, eval)('SEED'), time: Math.round(g.time), blds: g.buildings.length, people: Math.round(g.countries.reduce((a, c) => a + (c.alive ? c.people : 0), 0)) }; });

// the sender: a game played a little, then Command → Send my game
const A = await phone();
await A.page.goto('http://localhost:8765/?seed=777'); await loaded(A.page);
await A.page.evaluate(() => localStorage.clear()); await A.page.reload(); await loaded(A.page);
await A.page.evaluate(() => { (0, eval)('tutEnd()'); const G = window.__game; for (let k = 0; k < 2400; k++) G.tick(0.05); (0, eval)('saveGame()'); });
const sent = await state(A.page);
await A.page.tap('#btn-cmd'); await A.page.waitForTimeout(200);
await A.page.tap('#cmdmenu button[data-act="sendsave"]');
await A.page.waitForURL(/save\.html/); await A.page.waitForFunction(() => !document.getElementById('make').disabled);
say('Command → Send my game opens the send page, which finds the game', true, await A.page.textContent('#what'));
await A.page.screenshot({ path: 'r22-send.png' });
await A.page.tap('#make'); await A.page.waitForFunction(() => !document.getElementById('out').hidden);
const link = await A.page.evaluate(() => (0, eval)('link'));
say('a small game makes a link short enough for WhatsApp', link.length < 60000 && /save\.html#g/.test(link), { length: link.length, status: await A.page.textContent('#status') });
await A.page.tap('#copy'); await A.page.waitForTimeout(200);
say('Copy puts the link on the clipboard', (await A.page.evaluate(() => navigator.clipboard.readText())) === link);
await A.page.screenshot({ path: 'r22-ready.png' });

// the receiver: has a game of their own, taps the link
const B = await phone();
await B.page.goto('http://localhost:8765/?seed=55'); await loaded(B.page);
await B.page.evaluate(() => localStorage.clear()); await B.page.reload(); await loaded(B.page);
await B.page.evaluate(() => { (0, eval)('tutEnd()'); const G = window.__game; for (let k = 0; k < 400; k++) G.tick(0.05); (0, eval)('saveGame()'); });
await B.page.goto(link.replace(/^https?:\/\/[^/]+/, 'http://localhost:8765').replace('/Game-Trial', ''));
await B.page.waitForURL(/shared=1/); await loaded(B.page);
const mine = await B.page.evaluate(() => localStorage.getItem('game-trial-save-v2'));   // (their own game saved itself as they left it)
const got = await state(B.page);
say('the link opens the very same game', got.seed === sent.seed && Math.abs(got.time - sent.time) <= 1 && got.blds === sent.blds, { sent, got });
say('…with the banner, and the way back', await B.page.isVisible('#shared-hint'), await B.page.textContent('#shared-hint'));
say('the send page shows only what applies (no greyed button, no file button for a short link)', await A.page.evaluate(() => getComputedStyle(document.getElementById('make')).display === 'none' && getComputedStyle(document.getElementById('download')).display === 'none'));
await B.page.evaluate(() => { const G = window.__game; for (let k = 0; k < 400; k++) G.tick(0.05); (0, eval)('saveGame()'); });
await B.page.waitForTimeout(500);
say("…and the receiver's own game is untouched", (await B.page.evaluate(() => localStorage.getItem('game-trial-save-v2'))) === mine);
await B.page.screenshot({ path: 'r22-shared.png' });
await B.page.tap('#shared-hint button'); await loaded(B.page);
const back = await state(B.page);
say('Back to my game: their own game again', back.seed === 55 && !(await B.page.isVisible('#shared-hint')), back);

// a broken link: a clear message, no loop
const C = await phone();
await C.page.goto('http://localhost:8765/save.html#gNOTAGAME'); await C.page.waitForTimeout(1500);
say('a broken link says so, and stays put', /Could not open it: it doesn't look like a whole/.test(await C.page.textContent('#openmsg')) && /save\.html/.test(C.page.url()), await C.page.textContent('#openmsg'));

// a big game: a file instead of a link, and the file opens
if (BIG) {
  const save = JSON.parse(fs.readFileSync(BIG, 'utf8'));
  const D = await phone();
  await D.page.goto('http://localhost:8765/save.html'); await D.page.waitForTimeout(300);
  await D.page.evaluate(s => { localStorage.clear(); localStorage.setItem('game-trial-save-v2', s.v); }, save);
  await D.page.reload(); await D.page.waitForFunction(() => !document.getElementById('make').disabled);
  await D.page.tap('#make'); await D.page.waitForFunction(() => !document.getElementById('out').hidden, null, { timeout: 60000 });
  const tooBig = /too big/.test(await D.page.textContent('#status'));
  const dl = D.page.waitForEvent('download');
  await D.page.tap('#download');
  const file = await dl; const path = '/tmp/r22-big.txt'; await file.saveAs(path);
  say('a big game: "too big for a link", saved as a file instead', tooBig && fs.statSync(path).size > 60000, { KB: Math.round(fs.statSync(path).size / 1024), saveKB: Math.round(save.v.length / 1024) });
  const E = await phone();
  await E.page.goto('http://localhost:8765/save.html');
  await E.page.setInputFiles('#file', path);
  await E.page.waitForURL(/shared=1/, { timeout: 60000 }); await loaded(E.page);
  const g2 = await state(E.page), want = JSON.parse(save.v);
  say('…and the file opens that big game', g2.seed === want.seed && g2.blds > 1000, g2);
}
console.log(errs.length ? [...new Set(errs)].join('\n') : 'no errors');
await browser.close();
