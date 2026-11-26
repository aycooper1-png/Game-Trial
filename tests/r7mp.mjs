import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const style = process.argv[2] || 'coop';
const errs = [];
const mk = async (url, tag) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(tag + ' PAGEERROR ' + e.message + '\n' + e.stack)); p.on('console', m => { if (m.type() === 'error' || m.text().startsWith('mp')) errs.push(tag + ' CONSOLE ' + m.text()); }); await p.goto(url); await p.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 }); return p; };
const host = await mk(`http://localhost:8765/?mp=host&style=${style}&room=t${style}&seed=777&tr=bc`, 'H');
const wait = await host.evaluate(() => ({ modal: document.getElementById('md-text').innerText.slice(0, 200), link: document.getElementById('mp-link')?.value }));
console.log('waiting room:', JSON.stringify(wait));
const link = wait.link.replace(/^https?:\/\/[^/]+/, 'http://localhost:8765');
const guest = await mk(link, 'G');
await guest.waitForTimeout(3000);
const st = async p => p.evaluate(() => { const G = window.__game, g = G.game; G.updateHud(); return { role: G.MP.role, style: G.MP.style, nid: G.MP.nid, owned: g.ownedCount, bld: g.buildings.length, ppl: Math.round(g.countries.reduce((a, c) => a + (c.alive ? c.people : 0), 0)), wood: Math.round(g.countries[0].res.wood), time: Math.round(g.time), modal: document.getElementById('modal').classList.contains('show') ? document.getElementById('md-text').innerText.slice(0, 80) : '-', notes: [...document.querySelectorAll('#notes .nt')].map(e => e.textContent).join(' | ') }; });
console.log('host ', JSON.stringify(await st(host)));
console.log('guest', JSON.stringify(await st(guest)));
// the guest gives an order as if clicked: expand toward somewhere
const order = await guest.evaluate(() => {
  const G = window.__game, g = G.game, C = g.countries[0];
  G.MP.ui = true;
  const r = style => 0;
  const tx = Math.round(C.lx + 14), ty = Math.round(C.ly);
  const res = G.startPush ? 'push' : 'none';
  window.startPush ? 0 : 0;
  return { tx, ty };
});
await guest.evaluate(({ tx, ty }) => { const G = window.__game; G.MP.ui = true; G.clickAt ? 0 : 0; window.__game.dispatchPush = 1; }, order);
// use a real wrapped call: the global startPush is reachable from page scope via eval
const sent = await guest.evaluate(({ tx, ty }) => { window.__game.MP.ui = true; const r = (0, eval)('typeof startPush') === 'function' ? (0, eval)(`startPush(${tx}, ${ty})`) : 'nofn'; return String(r); }, order);
console.log('guest push result', sent);
await guest.waitForTimeout(4500);
console.log('host after', JSON.stringify(await st(host)));
console.log('guest after', JSON.stringify(await st(guest)));
if (style === 'rivals') {
  const b = await guest.evaluate(() => { const G = window.__game, g = G.game; window.__game.MP.ui = true; const C = g.countries[0]; let spot = -1; for (let r = 2; r < 15 && spot < 0; r++) for (let dx = -r; dx <= r && spot < 0; dx++) { const i = G.idx(Math.round(C.lx) + dx, Math.round(C.ly) + r); if (G.owner[i] && !G.building[i] && G.isLand(i)) spot = i; } return { spot, r: String((0, eval)(`tryBuild(${spot}, 'farm')`)) }; }).catch(e => 'err ' + e.message);
  console.log('rival build', JSON.stringify(b));
  await guest.waitForTimeout(3000);
  const hn = await host.evaluate(() => { const G = window.__game, n = G.game.nations[G.MP.nid]; return { name: n.short, human: n.human, tiles: n.tiles, people: Math.round(n.people), blds: G.game.buildings.filter(b => G.arrays().aiOf[b.i] === n.id + 1).map(b => b.type).join(',') }; });
  console.log('host sees friend nation', JSON.stringify(hn));
  const gv = await guest.evaluate(() => { const G = window.__game, g = G.game; return { mine: g.ownedCount, hostNation: g.nations[G.MP.nid].short, hostTiles: g.nations[G.MP.nid].tiles, res: g.research.done.size, farms: g.buildings.filter(b => b.type === 'farm' && G.arrays().owner[b.i]).length }; });
  console.log('guest view', JSON.stringify(gv));
}
await host.screenshot({ path: `/tmp/mp_host_${style}.png` }); await guest.screenshot({ path: `/tmp/mp_guest_${style}.png` });
console.log(errs.slice(0, 8).join('\n') || 'no errors');
await browser.close();
