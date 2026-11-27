// Round 21 ("still frozen" on a friend's iPhone): older iPhones, very big realms, and safety nets.
// 1. as on iOS 15 (no canvas roundRect, no Array.at): no errors at any zoom, labels drawn
// 2. an error repeating every frame brings up a lasting notice with its message
// 3. very slow game steps: the screen still refreshes often, and a "runs slower" note appears once
// 4. a newer version online: the game reloads once (and never loops)
// 5. a circle of merged territories (old saves) can't hang the game, and is cut on load
// 6. the by-type building index and the per-step site list always match a full scan (creative game, builds, upgrades, removals)
// 7. storage full when saving: one warning
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const errs = [];
const say = (what, ok, extra) => console.log((ok ? 'ok   ' : 'FAIL ') + what, extra === undefined ? '' : JSON.stringify(extra));
const open = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  if (opts.ios15) await ctx.addInitScript(() => { delete CanvasRenderingContext2D.prototype.roundRect; delete Array.prototype.at; });
  if (opts.route) await ctx.route(opts.route.url, opts.route.fn);
  const page = await ctx.newPage();
  const mine = []; page.on('pageerror', e => mine.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error') mine.push('CONSOLE ' + m.text().split('\n')[0].slice(0, 200)); });
  const load = () => page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 120000 });
  await page.goto('http://localhost:8765/?seed=42'); await load();
  await page.evaluate(() => localStorage.clear()); await page.reload(); await load();
  await page.evaluate(() => { (0, eval)('tutEnd()'); });
  return { ctx, page, mine, load };
};
// 1
{
  const { ctx, page, mine } = await open({ ios15: true });
  await page.evaluate(() => { (0, eval)('toggleDebug()'); const G = window.__game, C = G.activeCountry(); for (let r = 3; r < 14; r++) for (let dx = -r; dx <= r; dx++) { const i = G.idx(Math.floor(C.lx) + dx, Math.floor(C.ly) + r); if (!G.canBuild(i, 'base') && G.countryAt(i) === C) { G.tryBuild(i, 'base'); return; } } });
  for (const z of [0.35, 0.05, 0.01, 0.002, 8, 30]) { await page.evaluate(z => { const G = window.__game, C = G.activeCountry(); G.cam.zoom = z; G.cam.x = C.lx; G.cam.y = C.ly; }, z); await page.waitForTimeout(500); }
  const lbl = await page.evaluate(() => { let n = 0; const g = document.getElementById('game').getContext('2d'), f = g.roundRect; g.roundRect = function (...a) { n++; return f.apply(this, a); }; (0, eval)('render()'); g.roundRect = f; return n; });
  say('as on iOS 15: every zoom draws without errors, and rounded labels are drawn', mine.length === 0 && lbl > 0, { errors: mine.slice(0, 3), labels: lbl });
  errs.push(...mine); await ctx.close();
}
// 2
{
  const { ctx, page, mine } = await open();
  await page.evaluate(() => { const real = (0, eval)('stepLostView'); window.stepLostView = () => { throw new Error('test problem'); }; window.__realLV = real; });
  await page.waitForTimeout(2500);
  const note = await page.evaluate(() => [...document.querySelectorAll('#notes .note')].map(n => n.innerText).find(t => /keeps going wrong/.test(t)) || null);
  await page.evaluate(() => { window.stepLostView = window.__realLV; });
  say('an error repeating every frame brings a lasting notice with its message', !!note && /test problem/.test(note), note && note.slice(0, 90));
  errs.push(...mine.filter(m => !/test problem/.test(m))); await ctx.close();
}
// 3
{
  const { ctx, page, mine } = await open();
  await page.evaluate(() => { const real = (0, eval)('tickAll'); window.tickAll = dt => { const t = performance.now(); while (performance.now() - t < 80) {} return real(dt); }; });
  const r = await page.evaluate(() => new Promise(res => { let n = 0, worst = 0, prev = performance.now(); const t0 = prev; const f = now => { n++; worst = Math.max(worst, now - prev); prev = now; if (now - t0 < 11500) requestAnimationFrame(f); else res({ fps: +(n / ((now - t0) / 1000)).toFixed(1), worstGapMs: Math.round(worst) }); }; requestAnimationFrame(f); }));
  const toastSeen = await page.evaluate(() => document.getElementById('toast').textContent);
  say('80 ms game steps (a huge realm): at most one runs per frame, so the screen keeps refreshing', r.fps >= 7 && r.worstGapMs < 250, r);
  say('…and the game says once that it runs slower', /runs slower than real time/.test(toastSeen), toastSeen.slice(0, 80));
  errs.push(...mine); await ctx.close();
}
// 4
{
  let served = 0;
  const { ctx, page, mine } = await open({ route: { url: /\/index\.html(\?.*)?$/, fn: async route => { served++; const r = await route.fetch(); const body = (await r.text()).replace(/game\.js\?v=\d+/, 'game.js?v=99999'); route.fulfill({ response: r, body }); } } });
  let loads = 0; page.on('load', () => loads++);
  await page.waitForTimeout(9000);
  const after = loads;
  await page.waitForTimeout(6000);
  say('a newer version online: the game reloads once, and only once', after === 1 && loads === 1 && served >= 1, { loads, served });
  errs.push(...mine); await ctx.close();
}
// 5
{
  const { ctx, page, mine } = await open();
  const r = await page.evaluate(() => {
    const G = window.__game, g = G.game, E = s => (0, eval)(s);
    const a = E('newCountry()'), b = E('newCountry()');
    a.alive = false; b.alive = false; a.mergedInto = b.id; b.mergedInto = a.id;
    const t = performance.now(), got = E('liveCountry')(a.id), ms = performance.now() - t;
    E('saveGame()'); const sv = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('game-trial-save'))));
    G.stopSaving(); E('noSave = true');
    E('loadGame')(sv);
    const a2 = g.countries[a.id], b2 = g.countries[b.id];
    return { got: got === null, ms: +ms.toFixed(2), cut: a2.mergedInto === -1 || b2.mergedInto === -1 };
  });
  say('a circle of merged territories returns no territory at once, and is cut on load', r.got && r.ms < 5 && r.cut, r);
  errs.push(...mine); await ctx.close();
}
// 6
{
  const { ctx, page, mine } = await open();
  const r = await page.evaluate(() => {
    const G = window.__game, g = G.game, E = s => (0, eval)(s), A = G.arrays();
    E('toggleDebug()'); G.stopSaving();
    const types = Object.keys(E('CFG').buildings), byType = E('byType'), siteBlds = E('siteBlds');
    let checks = 0, bad = [];
    const check = tag => {
      for (const t of types) { const want = g.buildings.filter(b => b.type === t), got = byType(t); checks++; if (want.length !== got.length || want.some((b, k) => b !== got[k])) bad.push(tag + ':' + t); }
      const ws = g.buildings.filter(b => b.site), gs = siteBlds(); checks++; if (ws.length !== gs.length || ws.some((b, k) => b !== gs[k])) bad.push(tag + ':sites');
    };
    for (let m = 0; m < 8; m++) {
      const C = G.activeCountry();
      for (let k = 0; k < 400; k++) { const i = G.idx(Math.round(C.lx + (Math.random() - 0.5) * 50), Math.round(C.ly + (Math.random() - 0.5) * 50)); if (i < 0 || !A.owner[i]) continue; const t = types[Math.floor(Math.random() * types.length)]; try { if (!G.canBuild(i, t)) G.tryBuild(i, t); } catch (e) {} }
      check('built' + m);
      const mine2 = g.buildings.filter(b => A.owner[b.i] && !b.site && b.type !== 'settlement');
      for (const b of mine2.slice(0, 3)) { try { E('removeBuilding')(b.i); } catch (e) {} }
      check('removed' + m);
      for (let k = 0; k < 200; k++) { E('tickAll(0.05)'); if (k % 50 === 0) check('tick' + m + '.' + k); }
    }
    E('viewWorld(1)'); check('moon'); E('viewWorld(0)'); check('home again');
    return { checks, bad: bad.slice(0, 8), blds: g.buildings.length };
  });
  say('the building index and site list always match a full scan', r.bad.length === 0 && r.checks > 300, r);
  errs.push(...mine); await ctx.close();
}
// 7
{
  const { ctx, page, mine } = await open();
  const r = await page.evaluate(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function () { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e; };
    (0, eval)('saveGame()'); (0, eval)('saveGame()');
    Storage.prototype.setItem = real;
    return [...document.querySelectorAll('#notes .note')].filter(n => /could not be saved/.test(n.innerText)).length;
  });
  say('storage full: one warning, not one per autosave', r === 1, r);
  errs.push(...mine.filter(m => !/Autosave failed|quota/i.test(m))); await ctx.close();
}
console.log(errs.length ? errs.join('\n') : 'no errors');
await browser.close();
