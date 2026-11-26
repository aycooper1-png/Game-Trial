import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const errs = [];
const mk = async (url, tag) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(tag + ' PAGEERROR ' + e.message + '\n' + e.stack)); p.on('console', m => { if (m.type() === 'error' || m.text().startsWith('mp')) errs.push(tag + ' CONSOLE ' + m.text()); }); await p.goto(url); await p.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 }); return p; };
const room = 'rv' + Date.now() % 100000;
const host = await mk(`http://localhost:8765/?mp=host&style=rivals&room=${room}&seed=4242&tr=bc`, 'H');
await host.evaluate(() => localStorage.clear());
const guest = await mk(`http://localhost:8765/?join=${room}&seed=4242&style=rivals&tr=bc`, 'G');
await guest.waitForTimeout(2500);
// both run: tick each game for s seconds, alternating so messages flow
const run = async s => { for (let k = 0; k < s * 4; k++) { await host.evaluate(() => { for (let j = 0; j < 5; j++) (0, eval)('tickAll(0.05)'); }); await guest.evaluate(() => { for (let j = 0; j < 5; j++) (0, eval)('tickAll(0.05)'); }); } };
const G = (p, f, a) => p.evaluate(f, a);
const log = (...a) => console.log(...a.map(x => typeof x === 'string' ? x : JSON.stringify(x)));
await run(3);
const st = p => G(p, () => { const G = window.__game, g = G.game, C = g.countries.find(c => c.alive); const M = G.arrays(); let mine = 0, nid = 0; for (let i = 0; i < M.owner.length; i++) { if (M.owner[i]) mine++; if (M.aiOf[i] === G.MP.nid + 1) nid++; } return { role: G.MP.role, nid: G.MP.nid, myTiles: mine, otherTiles: nid, wheat: C && Math.round(C.res.wheat), wood: C && Math.round(C.res.wood), people: C && Math.round(C.people), techs: g.research.done.size, rpts: Math.round(g.research.pts), cars: g.cars.length, farms: g.buildings.filter(b => b.type === 'farm' && M.owner[b.i]).length, fields: M.depositOf.filter ? 0 : 0, otherName: g.nations[G.MP.nid] && g.nations[G.MP.nid].short, human: g.nations[G.MP.nid] && g.nations[G.MP.nid].human, hostile: g.nations[G.MP.nid] && !!g.nations[G.MP.nid].hostile }; });
log('host ', await st(host)); log('guest', await st(guest));
// 1) the friend's farms make wheat
const w0 = await G(guest, () => { const C = window.__game.activeCountry(); C.res.wheat = 0; return 0; });
await run(20);
log('guest wheat after 20s from 0:', (await st(guest)).wheat, 'research pts', (await st(guest)).rpts);
// fields actually sown
log('guest farm fields', await G(guest, () => { const G = window.__game, M = G.arrays(); return G.game.buildings.filter(b => b.type === 'farm' && M.owner[b.i]).map(b => { let n = 0; for (let i = 0; i < M.depositOf.length; i++) if (M.depositOf[i] === b.field) n++; return n; }); }));
// 2) the friend expands, builds, buys a car
const r2 = await G(guest, () => { const G = window.__game, g = G.game, C = G.activeCountry(); C.people = C.cap + 200; C.res.wood = 500; C.res.stone = 500; G.MP.ui = true; G.setPct(100); const f = [...(0, eval)('frontier')].find(i => !G.arrays().aiOf[i]); if (f != null) G.startPush(f % G.W, (f / G.W) | 0); const pushes = g.pushes.length; const cars0 = g.cars.length; G.buyVehicle && G.buyVehicle('car'); let spot = -1; const M = G.arrays(); for (let r = 3; r < 14 && spot < 0; r++) for (let dx = -r; dx <= r && spot < 0; dx++) { const i = G.idx(Math.floor(C.lx) + dx, Math.floor(C.ly) + r); if (!G.canBuild(i, 'cabin')) spot = i; } const ok = G.tryBuild(spot, 'cabin'); return { pushes, cars0, cars1: g.cars.length, spot, ok }; });
log('guest orders', r2);
await run(15);
log('host ', await st(host)); log('guest', await st(guest));
log('host sees guest cabin', await G(host, s => { const b = window.__game.buildingAt(s); return b && b.type; }, r2.spot));
// 3) war: the friend declares war on the host
await G(guest, () => { const G = window.__game; G.provoke(G.game.nations[G.MP.nid]); });
await run(3);
log('host at war with friend', (await st(host)).hostile, 'guest', (await st(guest)).hostile);
// 4) the host takes a tile of the friend's: the friend loses it
const take = await G(host, () => { const G = window.__game, M = G.arrays(), nid1 = G.MP.nid + 1, A = G.activeCountry(); for (let i = 0; i < M.aiOf.length; i++) if (M.aiOf[i] === nid1) { const x = i % G.W, y = (i / G.W) | 0; G.claim(i, A.id, true); return i; } return -1; });
await run(5);
log('host took', take, 'guest still owns it?', await G(guest, i => !!window.__game.arrays().owner[i], take));
// 5) the friend takes an AI nation's tile: the host sees it as theirs
const take2 = await G(guest, () => { const G = window.__game, M = G.arrays(), nid1 = G.MP.nid + 1; for (let i = 0; i < M.aiOf.length; i++) if (M.aiOf[i] && M.aiOf[i] !== nid1) { const x = i % G.W, y = (i / G.W) | 0; const by = M.aiOf[i] - 1; G.claim(i, G.activeCountry().id, true); return [i, by]; } return [-1, -1]; });
await run(5);
log('guest took AI tile', take2, 'host shows it as friend', await G(host, i => window.__game.arrays().aiOf[i] === window.__game.MP.nid + 1, take2[0]));
// 6) peace offer from the friend, accepted by the host
await G(guest, () => { const G = window.__game; (0, eval)('dipAction(window.__game.game.nations[window.__game.MP.nid], "peace")'); });
await run(2);
const offered = await G(host, () => [...document.querySelectorAll('#notes .note')].map(e => e.innerText.replace(/\n/g, ' ')).find(t => /peace/i.test(t)) || '');
log('host sees offer', offered.slice(0, 100));
await G(host, () => { const b = [...document.querySelectorAll('#notes .note button')].find(b => b.textContent === 'Make peace'); b && b.click(); });
await run(3);
log('after peace: host hostile', (await st(host)).hostile, 'guest hostile', (await st(guest)).hostile);
// 7) a trade: the friend offers 50 wood for 30 stone
const tw = await G(guest, () => { const G = window.__game, C = G.activeCountry(); C.res.wood = 300; (0, eval)('dipDraft = { give: { res: { wood: 50 }, towns: [] }, ask: { res: { stone: 30 }, towns: [] } }'); (0, eval)('dipAction(window.__game.game.nations[window.__game.MP.nid], "trade")'); return Math.round(C.res.wood); });
await run(2);
const hs0 = await G(host, () => { const C = window.__game.activeCountry(); C.res.stone = 200; return [Math.round(C.res.wood), Math.round(C.res.stone)]; });
await G(host, () => { const b = [...document.querySelectorAll('#notes .note button')].find(b => b.textContent === 'Accept'); b && b.click(); });
await run(2);
log('trade: host wood/stone before', hs0, 'after', await G(host, () => { const C = window.__game.activeCountry(); return [Math.round(C.res.wood), Math.round(C.res.stone)]; }), 'guest wood before', tw, 'after', await G(guest, () => Math.round(window.__game.activeCountry().res.wood)));
// 9) the host shells one of the friend's buildings: the friend loses it
const hit = await G(host, () => { const G = window.__game, M = G.arrays(), nid1 = G.MP.nid + 1; const b = G.game.buildings.find(b => M.aiOf[b.i] === nid1 && b.type !== 'settlement'); if (!b) return -1; G.removeBuilding(b.i); return b.i; });
await run(5);
log('host destroyed friend building at', hit, 'friend still has it?', await G(guest, i => !!window.__game.buildingAt(i), hit), 'host shows it again?', await G(host, i => !!window.__game.buildingAt(i), hit));
// 10) a battle worked out on the host wins land for the friend (their war with a nation): the friend gets it
const won = await G(host, () => { const G = window.__game, M = G.arrays(), g = G.game, nid = G.MP.nid; for (let i = 0; i < M.aiOf.length; i++) if (M.aiOf[i] && M.aiOf[i] !== nid + 1) { const k = M.aiOf[i] - 1; (0, eval)(`aiSeize(window.__game.game.nations[${nid}], window.__game.game.nations[${k}], ${i})`); return i; } return -1; });
await run(5);
log('host gave the friend tile', won, 'friend owns it now?', await G(guest, i => !!window.__game.arrays().owner[i], won), 'host still shows friend?', await G(host, i => window.__game.arrays().aiOf[i] === window.__game.MP.nid + 1, won));
// 11) troops: the host's fight kills some of the friend's troops (mirror units drop): the friend's garrisons lose them
const tr = await G(guest, () => { const G = window.__game, g = G.game, C = G.activeCountry(); let b = g.buildings.find(b => G.arrays().owner[b.i] && (b.type === 'base' || b.type === 'fort')); if (!b) { const S = g.buildings.find(b => G.arrays().owner[b.i] && b.type === 'settlement'); b = S; S.type0 = 1; } return b ? b.type : 'none'; });
log('friend garrison type', tr);
// 8) the friend reloads: their realm comes back from their own save
const before = await st(guest);
await G(guest, () => window.__game.saveGame());
await guest.reload(); await guest.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
await guest.waitForTimeout(2000); await run(4);
const after = await st(guest);
log('reload: tiles', before.myTiles, '->', after.myTiles, 'techs', before.techs, '->', after.techs, 'cars', before.cars, '->', after.cars);
await host.screenshot({ path: '/tmp/riv_host.png' }); await guest.screenshot({ path: '/tmp/riv_guest.png' });
console.log(errs.slice(0, 8).join('\n') || 'no errors');
await browser.close();
