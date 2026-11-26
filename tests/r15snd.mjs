import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
// Sound: starts muted; the mute button; zoom fade; moving haulers and fights make their kind's loop louder; builder taps in order.
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
await page.evaluate(() => localStorage.clear()); await page.reload();
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const log = [];
log.push(['starts muted', await page.evaluate(() => window.__game.SND.muted), 'button', await page.evaluate(() => document.querySelector('#cmdmenu button[data-act="mute"]').textContent)]);
await page.evaluate(() => window.__game.toggleCmdMenu(true));
await page.click('#cmdmenu button[data-act="mute"]');
await page.waitForFunction(() => window.__game.SND.ready, null, { timeout: 30000 });
log.push(['after tap: muted', await page.evaluate(() => window.__game.SND.muted), 'button', await page.evaluate(() => document.querySelector('#cmdmenu button[data-act="mute"]').textContent), 'sounds loaded', await page.evaluate(() => Object.keys(window.__game.SND.buf).length), 'context', await page.evaluate(() => window.__game.SND.ctx.state)]);
await page.screenshot({ path: '/tmp/snd-panel.png' });
await page.evaluate(() => window.__game.toggleCmdMenu(false));
const r = await page.evaluate(() => {
  const G = window.__game, g = G.game, out = [];
  G.stopSaving();
  out.push(['zoom -> volume', [10, 13, 14, 20, 25, 30, 35, 40].map(z => z + ':' + G.sndZoom(z).toFixed(2)).join(' ')]);
  const v = g.cars[0];
  // follow a moving porter, fully zoomed in
  const A = G.activeCountry(); A.res.wood = 999; A.res.stone = 999;
  for (let k = 0; k < 400 && !g.cars.some(c => c.moving); k++) G.tick(0.05);
  const mv = g.cars.find(c => c.moving);
  if (!mv) return [...out, ['no moving hauler']];
  G.cam.follow = null; G.cam.anim = null;
  const at = zoom => { G.cam.zoom = zoom; G.cam.x = mv.x; G.cam.y = mv.y; G.stepSound(); const L = G.SND.loops.porter; return L ? +L.gain.gain.value.toFixed(3) : 0; };
  out.push(['porter loop target at zoom 40', (at(40), G.SND.loops.porter ? 'playing' : 'none'), 'zoom 12', (at(12), Object.keys(G.SND.loops).join(',') || 'none')]);
  return out;
});
log.push(...r);
await page.waitForTimeout(500);
log.push(['porter gain after a moment (zoom 40)', await page.evaluate(() => { const G = window.__game, mv = G.game.cars.find(c => c.moving) || G.game.cars[0]; G.cam.zoom = 40; G.cam.x = mv.x; G.cam.y = mv.y; G.stepSound(); return new Promise(ok => setTimeout(() => { G.stepSound(); ok(G.SND.loops.porter ? G.SND.loops.porter.gain.gain.value.toFixed(3) : 'none'); }, 600)); })]);
// builders: build something, rush its materials, tap a builder repeatedly
const tap = await page.evaluate(async () => {
  const G = window.__game, g = G.game, out = [], A = G.activeCountry();
  for (const r of ['wood', 'stone']) A.res[r] = 999;
  let i = -1; for (let r = 3; r < 15 && i < 0; r++) for (let dx = -r; dx <= r; dx++) { const t = G.idx(Math.floor(A.lx) + dx, Math.floor(A.ly) + r); if (!G.canBuild(t, 'cabin') && G.countryAt(t) === A) { i = t; break; } }
  G.tryBuild(i, 'cabin');
  const b = G.buildingAt(i);
  for (let k = 0; k < 2000 && b.site && b.site.crew == null; k++) G.tick(0.05);
  if (!b.site) return ['finished too fast'];
  b.site.crew = g.time + 999; b.site.crewDur = 1000;   // keep them building for the test
  G.cam.follow = null; G.cam.zoom = 30; G.cam.x = i % G.W + 0.5; G.cam.y = Math.floor(i / G.W) + 0.5; G.render();
  const said = [];
  for (let n = 0; n < 12; n++) {
    const p = G.crewPos(b, 0, G.cam.zoom);
    G.SND.talking = null;                           // pretend he finished talking
    const hit = G.sndTapBuilder(p.bx, p.by - p.bob - p.size * 0.5);
    said.push(hit ? (G.SND.talking ? G.SND.talking.src.buffer.duration.toFixed(1) : 'silent') : 'miss');
  }
  out.push(['builder 0, 12 taps (clip lengths in s)', said.join(' ')]);
  G.SND.talking = null;
  const p1 = G.crewPos(b, 1, G.cam.zoom);
  G.sndTapBuilder(p1.bx, p1.by - p1.bob - p1.size * 0.5);
  out.push(['builder 1 first tap', G.SND.talking && G.SND.talking.src.buffer.duration.toFixed(1)]);
  G.cam.zoom = 15; G.render(); const p2 = G.crewPos(b, 1, 15);
  out.push(['tap when zoomed out (should be ignored)', G.sndTapBuilder(p2.bx, p2.by - p2.bob - p2.size * 0.5)]);
  return out;
});
log.push(...tap);
log.push(['a nations\' battle on screen, zoomed in', await page.evaluate(() => new Promise(ok => { const G = window.__game; G.cam.zoom = 38; (0, eval)(`sndClash(${G.cam.x}, ${G.cam.y})`); G.stepSound(); setTimeout(() => { G.stepSound(); ok(G.SND.loops.fight ? G.SND.loops.fight.gain.gain.value.toFixed(2) : 'none'); }, 500); }))]);
log.push(['same battle, off screen', await page.evaluate(() => new Promise(ok => { const G = window.__game; G.cam.x += 200; G.stepSound(); setTimeout(() => { G.stepSound(); ok(G.SND.loops.fight ? G.SND.loops.fight.gain.gain.value.toFixed(2) : 'stopped'); }, 800); }))]);
log.push(['mute again', await page.evaluate(() => { window.__game.toggleMute(true); return [window.__game.SND.muted, Object.keys(window.__game.SND.loops).length]; })]);
for (const l of log) console.log(JSON.stringify(l));
console.log(errs.slice(0, 4).join('\n') || 'no errors');
await browser.close();
