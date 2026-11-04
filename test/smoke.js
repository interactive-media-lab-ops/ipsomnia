#!/usr/bin/env node
/* =====================================================================
   IPSOMNIA · SMOKE TEST  (test/smoke.js)
   EN · Headless end-to-end playthrough with Playwright: serves the repo
   root, walks title → cutscene → role → map → briefing → feed (+ OSINT) →
   technique → counter → after-action report → map → language switch →
   finale → creator, and fails on any console error or page error.
   It drives a few steps through the engine's public functions
   (selectOp, pickTech, pickCounter) instead of clicks, because map pins
   overlap at phone width and hint panels intercept pointer events;
   that is deliberate, the test checks screens and errors, not pixels.
   Run: npm test   (needs: npm install && npx playwright install chromium)
   UA · Headless-прохід повного циклу гри. Падає на будь-якій помилці в
   консолі браузера.
   ===================================================================== */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8731;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.json': 'application/json' };

/* Tiny static server so the test has no dependency on python or npx serve. */
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(ROOT, url === '/' ? 'index.html' : url);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end(); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(PORT, () => resolve(srv));
  });
}

function assert(cond, msg) { if (!cond) throw new Error('ASSERT: ' + msg); }

(async () => {
  const srv = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    // Missing optional assets (sound, art) are allowed; everything else is a failure.
    if (m.type() === 'error' && !/404/.test(m.text())) errors.push('console: ' + m.text());
  });
  const text = async () => (await page.locator('#app').innerText()).replace(/\s+/g, ' ');
  const wait = async ms => {
    await page.waitForTimeout(ms);
    await page.evaluate(() => document.querySelectorAll('.hint-panel').forEach(h => h.click()));
  };
  const nextBtn = () => page.locator('.screen > .btn:visible').last().click();
  const step = (name) => console.log('  ✓ ' + name);

  try {
    await page.goto(`http://localhost:${PORT}/index.html`);
    await page.waitForFunction(() => !document.getElementById('ipso-boot'), null, { timeout: 10000 });
    assert(/ІНФОСТІЙКІСТЬ/.test(await text()), 'mode select rendered'); step('intro splash → mode select');

    await page.click('.mode.hero'); await wait(400);
    assert(await page.locator('.dialogue-box').count() === 1, 'cutscene rendered'); step('cutscene');

    await page.click('.intro-skip'); await wait(400);
    assert(await page.locator('.role-card').count() === 3, 'three roles'); step('role select');

    await page.click('.role-card >> nth=1'); await wait(500);
    await page.evaluate(() => { tutorialDone = true; });
    assert(await page.locator('.gnode').count() === 13, '13 pins on the map'); step('campaign map (13 pins)');

    await page.evaluate(() => document.querySelector('.gnode.available').onclick()); await wait(500);
    assert(/ОПЕРАЦІЯ 1/.test(await text()), 'briefing'); step('briefing');

    await page.click('.btn'); await wait(300);
    await page.waitForSelector('#confirmBtn:not([disabled])', { timeout: 15000 }).catch(() => {});
    const hostile = await page.locator('.msg[data-hostile="1"]').all();
    assert(hostile.length > 0, 'feed has hostile posts'); step('feed revealed');

    await page.click('.osint-btn >> nth=0'); await wait(200);
    assert(await page.locator('.osint-modal').count() === 1, 'OSINT modal'); step('OSINT dossier');
    await page.click('.osint-x'); await wait(100);

    for (const h of hostile) { await h.click(); await wait(60); }
    await page.click('#confirmBtn'); await wait(600);
    assert(await page.locator('.msg.hit').count() === hostile.length, 'all hostile posts marked hit'); step('feed resolved');

    await page.evaluate(() => { S.usedWild = WILD.map(w => w.id); });   // deterministic: no wildcard
    await nextBtn(); await wait(500);
    assert(/ФАЗА 2/.test(await text()), 'technique phase'); step('technique phase');
    await page.evaluate(() => { const sc = SCENARIOS[S.i]; pickTech(sc.techniques.opts.findIndex(o => o.ok)); }); await wait(200);

    await nextBtn(); await wait(500);
    if (await page.locator('.ph-aud').count()) { await page.click('.opt >> nth=0'); await wait(400); }
    assert(await page.locator('#timerT').count() === 1, 'counter timer'); step('counter phase (timer running)');
    await page.waitForTimeout(2200);
    const left = await page.evaluate(() => S._timeLeft);
    assert(left > 0 && left < 60, 'timer ticks: ' + left);
    await page.evaluate(() => {
      const sc = SCENARIOS[S.i]; const c = sc.audiences ? sc.audiences[S.audience].counters : sc.counters;
      pickCounter(c.opts.findIndex(o => o.best));
    }); await wait(200);

    await nextBtn(); await wait(600);
    assert(/ЗВІТ ПРО ОПЕРАЦІЮ/.test(await text()), 'AAR'); step('after-action report');
    await page.click('.aar-detail-toggle'); await wait(100);
    await page.click('.aar-btns .btn >> nth=0'); await wait(600);
    assert((await page.locator('#prog').innerText()) === '1/13', 'progress 1/13'); step('back on map, progress 1/13');

    await page.click('#langFab'); await wait(300);
    assert(/CAMPAIGN MAP/.test(await text()), 'EN map'); step('language switch → EN');
    await page.click('#langFab'); await wait(200);

    await page.evaluate(() => { S.results.push({ tech: 'x', techOK: true, counterGood: true }); finale(); }); await wait(600);
    assert(/ПІДСУМОК КАМПАНІЇ/.test(await text()), 'finale'); step('finale');

    await page.goto(`http://localhost:${PORT}/creator.html`); await page.waitForTimeout(500);
    assert(/КРІЕЙТОР/.test(await page.locator('body').innerText()), 'creator'); step('creator loads');

    if (errors.length) throw new Error('Browser errors:\n' + errors.join('\n'));
    console.log('PASS: full cycle, no console errors');
  } catch (e) {
    console.error('FAIL: ' + e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    srv.close();
  }
})();
