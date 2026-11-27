// Needs a matchmaking server of your own: `npm i peer`, then `node peerserver.cjs` (port 9000), and the game served on 8765.
// real connection test: Host a game -> code -> Join a game with the code -> play -> line drops -> comes back by itself
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const style = process.argv[2] || 'coop';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const errs = [];
const B = 'http://localhost:8765/?ps=127.0.0.1:9000';
const mk = async (tag, vp) => { const ctx = await browser.newContext({ viewport: vp || { width: 1200, height: 800 } }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(tag + ' PAGEERROR ' + e.message + '\n' + e.stack)); p.on('console', m => { if (m.type() === 'error' || m.text().startsWith('mp')) errs.push(tag + ' CONSOLE ' + m.text()); }); await p.goto(B); await p.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 }); return p; };
const ready = p => p.waitForFunction(() => !document.getElementById('loading') && window.__game && window.__game.MP.role, null, { timeout: 60000 });
const host = await mk('H');
await host.evaluate(() => { (0, eval)('tutEnd()'); window.__game.mpSetup(); });
await host.click('#mp-go-host');
await host.click(`#md-text [data-style="${style}"]`);
await host.screenshot({ path: '/tmp/mp_hostsetup.png' });
await Promise.all([host.waitForNavigation(), host.click('#md-btns button.go')]);
await ready(host);
await host.waitForSelector('#mp-code');
const code = await host.evaluate(() => document.getElementById('mp-code').textContent);
console.log('code', code, 'url', host.url());
await host.waitForFunction(() => /Room open/.test(document.getElementById('mp-status').textContent), null, { timeout: 20000 });
await host.screenshot({ path: '/tmp/mp_waiting.png' });
const guest = await mk('G', { width: 390, height: 844 });
await guest.evaluate(() => { (0, eval)('tutEnd()'); window.__game.mpSetup(); });
await guest.screenshot({ path: '/tmp/mp_menu_phone.png' });
await guest.click('#mp-go-join');
await guest.fill('#mp-code-in', 'zzz');
await guest.click('#md-btns button.go');
console.log('bad code says:', await guest.evaluate(() => document.getElementById('mp-join-msg').textContent));
await guest.fill('#mp-code-in', code.toLowerCase().slice(0, 3) + ' ' + code.toLowerCase().slice(3));
await guest.screenshot({ path: '/tmp/mp_join_phone.png' });
await Promise.all([guest.waitForNavigation(), guest.click('#md-btns button.go')]);
await ready(guest);
console.log('guest url', guest.url());
await guest.waitForFunction(() => window.__game.MP.joined, null, { timeout: 30000 });
const st = p => p.evaluate(() => { const G = window.__game, g = G.game; return { role: G.MP.role, style: G.MP.style, up: G.LINK.up, seed: G.SEED, mode: g.gmode, time: +g.time.toFixed(1), owned: g.ownedCount, banner: (document.getElementById('mp-net') || {}).textContent || '-', modal: document.getElementById('modal').classList.contains('show') ? document.getElementById('md-text').innerText.slice(0, 60) : '-' }; });
await host.waitForTimeout(4000);
console.log('host ', JSON.stringify(await st(host))); console.log('guest', JSON.stringify(await st(guest)));
// 1. the line drops (the data connection dies without a goodbye on the guest's side)
await guest.evaluate(() => { const c = window.__game.MP.conn; c.peerConnection.close(); });
await guest.waitForTimeout(1500);
console.log('after drop: guest', JSON.stringify(await st(guest)));
await guest.waitForFunction(() => window.__game.LINK.up, null, { timeout: 30000 });
await host.waitForTimeout(3000);
console.log('reconnected: host ', JSON.stringify(await st(host))); console.log('reconnected: guest', JSON.stringify(await st(guest)));
// 2. the guest goes silent (as a frozen phone): the host notices by the heartbeat
await guest.evaluate(() => { const G = window.__game; G.MP.conn.send = () => {}; });
const t0 = Date.now();
await host.waitForFunction(() => !!document.getElementById('mp-net'), null, { timeout: 30000 });
console.log('host noticed silence after', Math.round((Date.now() - t0) / 1000), 's:', await host.evaluate(() => document.getElementById('mp-net').textContent));
await host.screenshot({ path: '/tmp/mp_banner.png' });
await guest.evaluate(() => { const G = window.__game; G.mpDrop(G.MP.conn); });
await host.waitForFunction(() => window.__game.LINK.up && !document.getElementById('mp-net'), null, { timeout: 30000 });
console.log('back again: host', JSON.stringify(await st(host)));
// 3. the host reloads their page: the guest stays, and is taken back in without touching anything
const gt = (await st(guest)).owned;
await host.reload(); await ready(host);
await host.waitForFunction(() => !window.__game.MP.waiting && window.__game.LINK.up, null, { timeout: 60000 });
await guest.waitForFunction(() => window.__game.LINK.up, null, { timeout: 30000 });
await host.waitForTimeout(5000);
console.log('host reloaded: host ', JSON.stringify(await st(host))); console.log('host reloaded: guest', JSON.stringify(await st(guest)), 'owned before', gt);
// 4. the guest reloads
await guest.reload(); await ready(guest);
await guest.waitForFunction(() => window.__game.MP.joined && window.__game.LINK.up, null, { timeout: 60000 });
await guest.waitForTimeout(3000);
const a = await st(host), b = await st(guest);
console.log('guest reloaded: host ', JSON.stringify(a)); console.log('guest reloaded: guest', JSON.stringify(b));
// 5. the game is still running on both
await host.waitForTimeout(4000);
const a2 = await st(host), b2 = await st(guest);
console.log('time moves: host', a.time, '->', a2.time, ' guest', b.time, '->', b2.time);
await guest.screenshot({ path: '/tmp/mp_guest_end.png' });
console.log(errs.slice(0, 10).join('\n') || 'no errors');
await browser.close();
