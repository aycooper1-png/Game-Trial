// the art audit: every sprite, at the sizes the game draws it, on land and on water
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const names = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
await page.goto('http://localhost:8765/?seed=42');
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
await page.waitForTimeout(800);
await page.evaluate(names => {
  const G = window.__game, list = names.length ? names : Object.keys(G.SPR);
  const c = document.createElement('canvas'); c.width = 1400; c.height = 1000;
  Object.assign(c.style, { position: 'fixed', left: 0, top: 0, zIndex: 99999, background: '#7fae5c' });
  document.body.appendChild(c);
  const x = c.getContext('2d'); x.font = '10px sans-serif';
  const cols = 10, cw = 140, ch = 120;
  list.forEach((n, k) => {
    const cx = (k % cols) * cw, cy = Math.floor(k / cols) * ch;
    x.fillStyle = k % 2 ? '#86b663' : '#7aa858'; x.fillRect(cx, cy, cw / 2, ch);
    x.fillStyle = '#3a7fc0'; x.fillRect(cx + cw / 2, cy, cw / 2, ch);
    const img = G.SPR[n];
    if (img && img.complete) { x.drawImage(img, cx + 4, cy + 4, 64, 64); x.drawImage(img, cx + 74, cy + 4, 64, 64); x.drawImage(img, cx + 10, cy + 74, 22, 22); x.drawImage(img, cx + 84, cy + 74, 22, 22); x.drawImage(img, cx + 44, cy + 78, 14, 14); }
    x.fillStyle = '#000'; x.fillText(n, cx + 4, cy + 112);
  });
}, names);
await page.waitForTimeout(300);
await page.screenshot({ path: '/home/claude/tests/sheet.png' });
await browser.close();
