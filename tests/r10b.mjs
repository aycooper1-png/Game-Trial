import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const errs = [];
for (const mode of ['press', 'fallback', 'oldguns']) {
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
  await page.goto('http://localhost:8765/?seed=42');
  await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
  const r = await page.evaluate(mode => {
    const G = window.__game, g = G.game;
    G.stopSaving();
    const techs = mode === 'oldguns' ? ['warrior', 'masonry', 'metallurgy'] : ['warrior', 'masonry', 'metallurgy', 'gunpowder', 'firearms', 'electricity', 'electronics', 'computing', 'mccs', 'qca', 'cais'];
    for (const t of techs) G.completeTech(t, true);
    const A = G.activeCountry();
    // a neighbour, at war, with an army; our fortress full of troops
    for (let k = 0; k < 10; k++) { A.people = A.cap + 300; G.setPct(100); G.startPush(Math.floor(A.lx) + (k % 2 ? 70 : -70), Math.floor(A.ly) + ((k % 3) - 1) * 30); for (let s = 0; s < 240; s++) G.tick(0.05); }
    const n = g.nations.filter(n => n.alive && n.tiles && G.frontWith(n, n.lx, n.ly))[0];
    if (!n) return { mode, err: 'no neighbour' };
    n.units = 400; n.R = new Set(['warrior', 'metallurgy']); G.setWar('P', n.id, true);
    const fw = G.frontWith(n, n.lx, n.ly), ours = fw ? fw[1] : G.idx(Math.floor(A.lx), Math.floor(A.ly));
    const S = g.buildings.find(b => b.type === 'settlement' && G.countryAt(b.i) === A);
    G.setFallBack; 
    g.attacks.push({ id: 999, nation: n.id, tx: n.lx, ty: n.ly, units: 150, coming: 0, work: 0, lx: ours % G.W + 0.5, ly: (ours / G.W | 0) + 0.5, country: A.id, start: 150, kite: mode === 'fallback', home: S.i });
    const at = g.attacks[0], n0 = n.units;
    let tt = 0; for (let k = 0; k < 20 * 30; k++) { G.tick(0.05); tt += 0.05; if (at.done) break; }
    return { mode, range: G.gunRange(), ourLeft: Math.round(at.units), lost: Math.round(at.lost || 0), killed: Math.round(at.killed || 0), theirsLeft: Math.round(n.units), done: !!at.done, secs: Math.round(tt), dist: Math.round(Math.hypot(at.lx - (S.i % G.W), at.ly - (S.i / G.W | 0))), canFallBack: mode };
  }, mode);
  console.log(JSON.stringify(r));
  await page.close();
}
console.log(errs.slice(0, 3).join('\n') || 'no errors');
await browser.close();
