// Round 18: tapping a road (expand to three lanes, delete, rebuild), bridges (turns, troops first, upgrade, connect,
// deconstruct), the harvest placement rule, idle-collector marks, desert wheat, gold for automatic models, space gear
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 850 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42'); await page.waitForFunction(() => !document.getElementById('loading'));
await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForFunction(() => !document.getElementById('loading'));
if (process.argv[2] === 'shot') await page.evaluate(() => { window.__shot = true; });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, E = s => (0, eval)(s), log = []; G.stopSaving(); E('tutEnd()');
  const A = G.activeCountry(); for (const t of ['warrior', 'wheel', 'masonry']) G.completeTech(t, true);
  A.people = A.cap + 300; for (const r of ['wood', 'stone', 'gold', 'wheat', 'iron']) A.res[r] = 600;
  const run = s => { for (let k = 0; k < s * 20; k++) G.tick(0.05); };
  const modal = () => (document.querySelector('#modal.show #md-text')?.innerText.replace(/\s+/g, ' ') || '').slice(0, 300);
  const mbtns = () => [...document.querySelectorAll('#modal.show #md-btns button')].map(x => x.textContent + (x.disabled ? ' [off]' : ''));
  const cbtns = () => [...document.querySelectorAll('#bc-btns button')].map(x => x.textContent + (x.disabled ? ' [off]' : ''));
  const card = () => document.getElementById('bc-title').textContent + ': ' + document.getElementById('bc-body').innerText.replace(/\s+/g, ' ');
  const cclick = t => { const x = [...document.querySelectorAll('#bc-btns button')].find(x => x.textContent.startsWith(t)); if (x) x.click(); return !!x; };
  const click = t => { const x = [...document.querySelectorAll('#md-btns button')].find(x => x.textContent.startsWith(t)); if (x) x.click(); return !!x; };
  // --- placement: collectors need something to harvest ---
  const cx = Math.floor(A.lx), cy = Math.floor(A.ly), res = [];
  let none = -1, ok = -1;
  for (let r = 1; r < 25 && (none < 0 || ok < 0); r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const i = G.idx(cx + dx, cy + dy); if (!G.owner[i] || G.buildingAt(i)) continue; const w = G.canBuild(i, 'camp');
    if (none < 0 && w && /Nothing to harvest/.test(w)) none = i; if (ok < 0 && !w) ok = i;
  }
  log.push(['camp where nothing is in reach', none >= 0 ? G.canBuild(none, 'camp') : 'no such spot found', '| a good spot', ok >= 0 ? 'allowed' : 'none']);
  if (ok >= 0) { G.tryBuild(ok, 'camp'); let twin = -1; for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]]) { const i = ok + dx + dy * G.W; if (G.owner[i] && !G.buildingAt(i) && G.isLand(i)) { twin = i; break; } }
    log.push(['camp right next to a camp still under construction', twin >= 0 ? (G.canBuild(twin, 'camp') || 'allowed') : 'no spot']); }
  G.setTool('camp'); if (none >= 0) { g.ghost.i = none; g.ghost.set = true; E('updateConfirm()'); log.push(['confirm button off', document.getElementById('cf-ok').disabled, document.querySelector('#cf-info .cf-line').innerText]); } G.setTool(null);
  let farmNone = 'n/a'; for (let r = 1; r < 25; r++) { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const i = G.idx(cx + dx, cy + dy); const w = G.owner[i] && !G.buildingAt(i) && G.isLand(i) ? G.canBuild(i, 'farm') : null; if (w && /farm/i.test(w)) { farmNone = w; r = 99; dy = dx = 99; } } }
  log.push(['a farm with no land to sow', farmNone]);
  // --- desert wheat ---
  log.push(['desert rule', JSON.stringify(E('DESERT_WHEAT'))]);
  // --- roads: tap, expand to 3 lanes, delete, rebuild --- (a second settlement first, so there's a road)
  { const S0 = g.buildings.find(b => b.type === 'settlement' && G.owner[b.i]), sx = S0.i % G.W, sy = (S0.i / G.W) | 0, M = G.arrays();
    let spot = -1;
    for (let d = 22; d < 50 && spot < 0; d++) for (const [ox, oy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) { const i = G.idx(sx + ox, sy + oy); if (!G.isLand(i) || M.aiOf[i] || !G.sameLand(i, S0.i)) continue;
      let okk = true; for (let k = 0; k <= d; k++) { const j = G.idx(sx + Math.round(ox * k / d), sy + Math.round(oy * k / d)); if (!G.isLand(j) || M.aiOf[j]) okk = false; } if (!okk) continue;
      for (let k = 0; k <= d + 3; k++) for (let w = -3; w <= 3; w++) { const j = G.idx(sx + Math.round(ox * k / d) + (oy ? w : 0), sy + Math.round(oy * k / d) + (ox ? w : 0)); if (G.isLand(j) && !M.owner[j] && !M.aiOf[j]) G.claim(j, A.id); }
      for (let r = 0; r < 4 && spot < 0; r++) for (let w = -r; w <= r; w++) { const j = G.idx(sx + ox + (oy ? w : -r), sy + oy + (ox ? w : -r)); if (!G.canBuild(j, 'settlement')) { spot = j; break; } } if (spot >= 0) break; }
    A.res.wood = A.res.stone = 600; G.tryBuild(spot, 'settlement');
    for (let k = 0; k < 200 && G.buildingAt(spot)?.site; k++) { G.rushSite(G.buildingAt(spot)); run(0.5); } }
  run(5);
  const R = E('roads').find(r => r.side > 0);
  if (R && window.__shot) { const m = R.pts[(R.pts.length / 2) | 0]; R.lanes = 3; G.cam.x = m[0]; G.cam.y = m[1]; G.cam.zoom = 9; window.__R = R; return [['shot']]; }
  if (R) {
    const m = R.pts[(R.pts.length / 2) | 0];
    E('showRoadCard')(E('roadNear')(m[0], m[1]));
    log.push(['road card', card(), JSON.stringify(cbtns())]);
    cclick('Expand'); E('roadExpandAt')('road', R.key);
    log.push(['lanes after two expands', R.lanes, 'stone left', Math.round(A.res.stone)]);
    E('showRoadCard')(E('roadNear')(m[0], m[1])); log.push(['at three lanes', JSON.stringify(cbtns())]);
    cclick('Delete'); log.push(['delete ask', modal()]); click('Yes');
    run(3); log.push(['road gone and stays gone', !E('roads').some(r => r.key === R.key), 'noRoad', JSON.stringify(g.noRoad)]);
    E('roadsDirty = true'); run(5); log.push(['still gone after the road builder ran', !E('roads').some(r => r.key === R.key)]);
    E('roadRebuild')(R.key); run(5); log.push(['rebuilt', E('roads').some(r => r.key === R.key)]);
  } else log.push(['no road between settlements on this map yet']);
  // --- bridges --- (claim a stretch of coast somewhere if there's none near the start)
  let coast = -1, far = -1;
  { const M = G.arrays(); let found = false;
    for (let i = 0; i < G.W * G.W && !found; i += 7) { if (!G.isLand(i) || M.aiOf[i] || M.owner[i]) continue; const x = i % G.W, y = (i / G.W) | 0;
      for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const p = E('bridgePlan')(i, G.idx(x + ex * 12, y + ey * 12)); if (p.s != null && p.tiles && p.tiles.length >= 2 && p.tiles.length <= 8 && /own land/.test(p.why || '')) {
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const j = G.idx((p.s % G.W) + dx, ((p.s / G.W) | 0) + dy); if (G.isLand(j) && !M.owner[j] && !M.aiOf[j]) G.claim(j, A.id); }
        const p2 = E('bridgePlan')(p.s, G.idx(x + ex * 12, y + ey * 12)); if (M.owner[p.s] && !p2.why) { coast = p.s; far = G.idx(x + ex * 12, y + ey * 12); found = true; break; } } } } }
  for (let r = 3; r < 40 && coast < 0; r++) for (let dy = -r; dy <= r && coast < 0; dy++) for (let dx = -r; dx <= r && coast < 0; dx++) {
    const i = G.idx(cx + dx, cy + dy); if (!G.owner[i] || !G.isLand(i)) continue;
    for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const p = E('bridgePlan')(i, G.idx(cx + dx + ex * 12, cy + dy + ey * 12)); if (!p.why && p.len >= 2 && p.len <= 10) { coast = i; far = G.idx(cx + dx + ex * 12, cy + dy + ey * 12); break; } }
  }
  if (coast >= 0) {
    A.res.stone = 2000; A.res.iron = 500;
    E('buildBridge')(coast, far); const br = g.bridges[g.bridges.length - 1];
    log.push(['bridge built', !!br, 'len', br && br.len]);
    // turns: a hauler and a train; troops first
    br.on = { road: 1, rail: 0, troops: 0 };
    log.push(['train may enter while a hauler is on it', E('canCross')('rail', br), '| another hauler may', E('canCross')('road', br)]);
    br.on = { road: 0, rail: 0, troops: 0 }; br.want = { troops: g.time }; br.wantSeen = { troops: g.time };
    log.push(['hauler may enter while troops wait', E('canCross')('road', br), '| troops may', E('canCross')('troops', br)]);
    br.want = {}; br.wantSeen = {}; br.on = { road: 1, rail: 0, troops: 0 }; E('canCross')('rail', br); br.want.rail = g.time - 25;
    br.on = { road: 0, rail: 0, troops: 0 };
    log.push(['a train waiting 25 s: new haulers wait for it', !E('canCross')('road', br), '| the train goes', E('canCross')('rail', br)]);
    // the bridge card
    E('showBridgeCard')(br); log.push(['bridge card', card(), JSON.stringify(cbtns())]); G.showBuildingCard(null);
    E('bridgeUpgrade')(E('bridgeKey')(br)); br.on = { road: 1, rail: 0, troops: 0 };
    log.push(['upgraded: a train may enter alongside haulers', E('canCross')('rail', br)]);
    A.res.stone = 100; const before = A.res.stone; E('bridgeClose')(E('bridgeKey')(br)); run(6);
    log.push(['bridge deconstructed', !g.bridges.includes(br), 'stone back', Math.round(A.res.stone - before)]);
  } else log.push(['no coast for a bridge near the start on this map']);
  // --- automatic models cost a little gold now ---
  log.push(['electric truck price', JSON.stringify(G.FLEET.car.tiers.find(t => t.id === 'etruck').cost)]);
  // --- space gear: a hauler on an airless world ---
  log.push(['home is airless?', E('airless')()]);
  return log;
});
for (const l of out) console.log(l.join(' | '));
if (process.argv[2] === 'shot') { await page.evaluate(() => { const E = s => (0, eval)(s); E('showRoadCard')({ L: window.__R, kind: 'road' }); const G = window.__game, m = window.__R.pts[(window.__R.pts.length / 2) | 0]; G.cam.x = m[0]; G.cam.y = m[1]; G.cam.zoom = 9; G.cam.follow = null; }); await page.waitForTimeout(400); await page.screenshot({ path: '/tmp/road_sel.png' }); }
console.log(errs.join('\n') || 'no errors');
await browser.close();
