import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const errs = [];
const mk = async (url, tag) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(tag + ' PAGEERROR ' + e.message + '\n' + e.stack)); p.on('console', m => { if (m.type() === 'error' || m.text().startsWith('mp')) errs.push(tag + ' CONSOLE ' + m.text()); }); await p.goto(url); await p.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 }); return p; };
const host = await mk(`http://localhost:8765/?mp=host&style=rivals&room=atk&seed=778&tr=bc`, 'H');
const guest = await mk(`http://localhost:8765/?join=atk&seed=778&style=rivals&tr=bc`, 'G');
await guest.waitForTimeout(3000);
await host.evaluate(() => { const G = window.__game; G.game.nations[G.MP.nid].units = 60; });
await guest.waitForTimeout(2500);
const r = await guest.evaluate(() => { const G = window.__game, g = G.game, n = g.nations[G.MP.nid]; G.MP.ui = true; return String((0, eval)(`launchAttack(window.__game.game.nations[${G.MP.nid}], ${Math.round(n.lx)}, ${Math.round(n.ly)})`)); });
console.log('attack', r);
await guest.waitForTimeout(1500);
console.log('host', JSON.stringify(await host.evaluate(() => { const G = window.__game, n = G.game.nations[G.MP.nid]; return { hostile: n.hostile, raids: G.game.raids.length, notes: [...document.querySelectorAll('#notes .nt')].map(e => e.textContent).join(' | ') }; })));
// a trade offer to the host
await guest.evaluate(() => { const G = window.__game; G.MP.ui = true; (0, eval)(`dipDraft = { give: { res: { wood: 5 }, towns: [] }, ask: { res: { stone: 5 }, towns: [] } }`); (0, eval)(`dipAction(window.__game.game.nations[${G.MP.nid}], 'peace')`); });
await guest.waitForTimeout(1500);
console.log('host offers', await host.evaluate(() => [...document.querySelectorAll('#notes .note')].map(e => e.innerText.replace(/\n/g, ' ')).join(' || ')));
// the guest's rejected actions
console.log('blocked', await guest.evaluate(() => { const G = window.__game; G.MP.ui = true; return String((0, eval)(`buyVehicle ? buyVehicle('car') : 'x'`)); }));
// PeerJS path with no network: does it fail gracefully?
const p3 = await mk(`http://localhost:8765/?mp=host&style=coop&room=zz&seed=5`, 'P');
await p3.waitForTimeout(6000);
console.log('peer status', await p3.evaluate(() => document.getElementById('mp-status')?.textContent));
console.log(errs.slice(0, 8).join('\n') || 'no errors');
await browser.close();
