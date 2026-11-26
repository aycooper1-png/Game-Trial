import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const modes = (process.argv[2] || 'peaceful,murder,hard').split(',');
for (const mode of modes) {
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n'))); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 300)); });
  await page.goto(`http://localhost:8765/?seed=${1000 + mode.length}&mode=${mode}`);
  await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
  await page.evaluate(() => localStorage.clear());
  const out = await page.evaluate(() => {
    const G = window.__game, g = G.game, log = [], M = G.arrays();
    G.stopSaving();
    const bad = [];
    const check = tag => {
      for (const c of g.countries) { if (!Number.isFinite(c.people)) bad.push(tag + ' people NaN ' + c.short); for (const r in c.res) if (!Number.isFinite(c.res[r])) bad.push(tag + ' ' + r + ' NaN ' + c.short); }
      for (const n of g.nations) { if (!Number.isFinite(n.people) || !Number.isFinite(n.units)) bad.push(tag + ' nation NaN ' + n.short); }
      if (!Number.isFinite(g.goldStock)) bad.push(tag + ' goldStock');
    };
    const rnd = k => Math.floor(Math.random() * k);
    const types = ['farm', 'cabin', 'camp', 'settlement', 'base', 'fort', 'burner', 'port', 'mortar'];
    let t0 = performance.now(), actions = 0;
    for (let min = 0; min < 25; min++) {
      // a minute of play with random orders
      for (let s = 0; s < 60; s++) {
        for (let k = 0; k < 20; k++) G.tick(0.05);
        if (s % 6 === 0) {
          const A = G.activeCountry(); if (!A) continue;
          const roll = rnd(5);
          try {
            if (roll === 0) { G.startPush(Math.round(A.lx + rnd(80) - 40), Math.round(A.ly + rnd(80) - 40)); actions++; }
            else if (roll === 1) { const i = G.idx(Math.round(A.lx + rnd(30) - 15), Math.round(A.ly + rnd(30) - 15)); const ty = types[rnd(types.length)]; if (G.isUnlocked(ty) && !G.canBuild(i, ty)) { G.tryBuild(i, ty); actions++; } }
            else if (roll === 2 && min > 10) { const n = g.nations.find(n => n.alive && n.tiles && G.atWar('P', n.id)); if (n) { G.launchAttack(n, n.lx, n.ly); actions++; } }
            else if (roll === 3) { G.setPct([10, 25, 50, 100][rnd(4)]); }
          } catch (e) { bad.push('action ' + e.message); }
        }
      }
      check('min' + min);
      if (min === 12) {                        // save and load mid-game
        const s1 = JSON.stringify({ o: g.ownedCount, b: g.buildings.length, r: [...g.research.done].length });
        G.saveNow ? G.saveNow() : 0;
      }
    }
    log.push(['sim 25 min', Math.round(performance.now() - t0) + 'ms', 'actions', actions, 'owned', g.ownedCount, 'blds', g.buildings.length, 'techs', g.research.done.size, 'nations alive', g.nations.filter(n => n.alive).length, 'cars', g.cars.length, 'over', !!g.over]);
    log.push(['bad', bad.slice(0, 6).join(' | ') || 'none', 'deposits', G.deposits ? G.deposits.length : '?']);
    // creative on/off twice
    (0, eval)('toggleDebug()'); for (let k = 0; k < 60; k++) G.tick(0.05); G.debugOff(); (0, eval)('toggleDebug()'); G.debugOff();
    check('creative'); log.push(['after creative cycles', bad.length, 'debug', g.debug]);
    // snapshot round trip, as a multiplayer friend would get it
    const t1 = performance.now(); const snap = G.mpSnapshot(); const t2 = performance.now();
    const before = { o: g.ownedCount, b: g.buildings.length, ppl: Math.round(g.countries.reduce((a, c) => a + (c.alive ? c.people : 0), 0)) };
    const size = JSON.stringify(snap).length;
    const t3 = performance.now(); G.mpApply(JSON.parse(JSON.stringify(snap)), false); const t4 = performance.now();
    const after = { o: g.ownedCount, b: g.buildings.length, ppl: Math.round(g.countries.reduce((a, c) => a + (c.alive ? c.people : 0), 0)) };
    log.push(['snapshot', Math.round(t2 - t1) + 'ms', Math.round(size / 1024) + 'KB', 'apply', Math.round(t4 - t3) + 'ms', JSON.stringify(before), JSON.stringify(after)]);
    for (let k = 0; k < 200; k++) G.tick(0.05); check('after apply');
    log.push(['final bad', bad.slice(0, 6).join(' | ') || 'none']);
    return log;
  });
  console.log('=== ' + mode); for (const l of out) console.log(JSON.stringify(l).slice(0, 400));
  console.log(errs.slice(0, 6).join('\n') || 'no errors');
  await page.close();
}
await browser.close();
