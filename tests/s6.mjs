import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 860 } })).newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await page.goto('http://localhost:8765/?seed=7');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const G = window.__game, g = G.game, log = [];
  G.stopSaving();
  const snap = () => g.nations.map(n => `${n.short}(${n.pers.id}) t${n.tiles} u${Math.round(n.units)} ${n.alive ? '' : 'DEAD'}`).join(' | ');
  log.push(['start', snap()]);
  // let the world run for 20 game-minutes in coarse steps
  const notes = [];
  const orig = document.getElementById('notes');
  const obs = new MutationObserver(m => { for (const r of m) for (const nd of r.addedNodes) notes.push(nd.innerText.replace(/\n/g, ' / ').slice(0, 140)); });
  obs.observe(orig, { childList: true });
  for (let k = 0; k < 1200; k++) { G.tick(0.5); G.tick(0.5); }
  log.push(['after 20 min', snap()]);
  log.push(['wars', [...g.dip.wars].join(' '), 'alliances', g.alliances.map(a => a.name + ':' + a.members.join(',')).join(' ; ')]);
  log.push(['ops with you', g.nations.map(n => `${n.short}:${Math.round(G.getOp('P', n.id))}${n.hostile ? '!' : ''}`).join(' ')]);
  log.push(['notes', g.notes.length, g.notes.slice(-12).map(n => n.title + ': ' + n.body.replace(/<[^>]+>/g, '')).join('  ||  ')]);
  return log;
});
for (const l of out) console.log(JSON.stringify(l));
await page.evaluate(() => { const G = window.__game; G.cam.x = 500; G.cam.y = 500; G.cam.zoom = 0.85; G.toggleCmdMenu(false); });
await page.waitForTimeout(800);
await page.screenshot({ path: 's6-world.png' });
console.log(errs.join('\n') || 'no errors');
await browser.close();
