// Round 20, co-op parity: the second player's expedition (it finds its own way on the host's game, and the host's
// camera is left alone), the defence toggles, the warhead choice and a C.A.I.S. setting all reach the host.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const errs = [];
const mk = async (url, tag) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(tag + ' PAGEERROR ' + e.message + '\n' + e.stack)); p.on('console', m => { if (m.type() === 'error') errs.push(tag + ' CONSOLE ' + m.text().slice(0, 300)); }); await p.goto(url); await p.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 120000 }); return p; };
const host = await mk('http://localhost:8765/?mp=host&style=coop&room=tr20&seed=777&tr=bc', 'H');
const link = (await host.evaluate(() => document.getElementById('mp-link')?.value)).replace(/^https?:\/\/[^/]+/, 'http://localhost:8765');
const guest = await mk(link, 'G');
await guest.waitForTimeout(3000);
await guest.evaluate(() => (0, eval)('tutEnd()')); await host.evaluate(() => (0, eval)('tutEnd()'));
const say = (what, ok, extra) => console.log((ok ? 'ok   ' : 'FAIL ') + what, extra === undefined ? '' : JSON.stringify(extra));
const hs = () => host.evaluate(() => { const g = window.__game.game; return { driving: !!g.driving, exp: g.expeditions.filter(e => !e.done).length, auto: g.expeditions.some(e => e.auto), countries: g.countries.filter(c => c.alive).length, recruit: g.recruit, autoDefend: g.autoDefend, warhead: g.warhead }; });
// a free land tile some way off
const spot = await guest.evaluate(() => { const G = window.__game, A = G.arrays(), C = G.activeCountry(); for (let r = 14; r < 60; r++) for (let a = 0; a < 16; a++) { const x = Math.round(C.lx + Math.cos(a / 16 * 6.283) * r), y = Math.round(C.ly + Math.sin(a / 16 * 6.283) * r), i = G.idx(x, y); if (G.isLand(i) && !A.owner[i] && !A.aiOf[i]) { let free = true; for (let dy = -3; dy <= 3 && free; dy++) for (let dx = -3; dx <= 3; dx++) { const j = G.idx(x + dx, y + dy); if (!G.isLand(j) || A.owner[j] || A.aiOf[j]) { free = false; break; } } if (free) return [x, y]; } } return null; });
const g1 = await guest.evaluate(([x, y]) => { const G = window.__game; G.MP.ui = true; (0, eval)(`launchExpedition(${x}, ${y})`); G.MP.ui = false; return { driving: !!G.game.driving, exp: G.game.expeditions.length }; }, spot);
await guest.waitForTimeout(2500);
let h = await hs();
say('guest sends an expedition: the host runs it, self-steering, and the host is not put at the wheel', (h.countries === 2 || (h.exp === 1 && h.auto)) && !h.driving && !g1.driving, { guest: g1, host: h });
await host.waitForTimeout(25000);
h = await hs(); const gc = await guest.evaluate(() => window.__game.game.countries.filter(c => c.alive).length);
say('it settles by itself: both players see the new territory', h.countries === 2 && gc === 2, { host: h.countries, guest: gc });
await guest.evaluate(() => { const G = window.__game; G.toggleCmdMenu(true); document.getElementById('recruit').click(); document.getElementById('autodef').click(); });
await guest.evaluate(() => { const G = window.__game; G.MP.ui = true; (0, eval)("setWarhead('nuke')"); G.MP.ui = false; });
await guest.waitForTimeout(2500);
h = await hs(); say('guest switches off training and auto-defence, picks the nuclear warhead: the host has all three', h.recruit === false && h.autoDefend === false && h.warhead === 'nuke', h);
// a C.A.I.S. setting
const ci = await host.evaluate(() => { const G = window.__game, g = G.game, C = G.activeCountry(); for (const t of ['electronics', 'computing']) G.completeTech(t, true); for (let r = 3; r < 20; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const i = G.idx(Math.floor(C.lx) + dx, Math.floor(C.ly) + dy); if (!G.canBuild(i, 'computer') && G.countryAt(i) === C) { for (const r2 of ['wood', 'stone', 'iron', 'gold', 'silicon', 'cobalt', 'chips']) C.res[r2] = 5000; G.tryBuild(i, 'computer'); const b = G.buildingAt(i); if (b) { b.site = null; b.lvl = 3; G.recomputeBuildings(); return i; } } } return -1; });
await guest.waitForFunction(i => !!window.__game.buildingAt(i), ci, { timeout: 30000 }).catch(() => {});
const sent = await guest.evaluate(i => { const G = window.__game, b = G.buildingAt(i); if (!b) return 'guest has no computer'; G.MP.ui = true; (0, eval)('aiSet')(b, 'cmds', true, 'roads'); (0, eval)('aiSet')(b, 'pct', 0.6); G.MP.ui = false; return 'sent'; }, ci);
await guest.waitForTimeout(2500);
const ai = await host.evaluate(i => { const b = window.__game.buildingAt(i); return b && b.ai ? { roads: !!b.ai.cmds.roads, pct: b.ai.pct } : null; }, ci);
say('guest changes the C.A.I.S. (a command on, resources 60%): the host has it', !!ai && ai.roads && Math.abs(ai.pct - 0.6) < 0.01, { sent, ai });
console.log(errs.length ? errs.join('\n') : 'no errors');
await browser.close();
