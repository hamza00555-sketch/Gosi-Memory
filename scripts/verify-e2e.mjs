/**
 * End-to-end verification in headless Chromium (no camera, no printed cards):
 *
 * 1. Plays a FULL solo round through the real UI in simulation mode —
 *    home -> start -> mock mode -> match all 8 pairs -> results screen.
 * 2. Plays a pass&play round far enough to verify turn passing on a miss.
 * 3. Optionally (--compile) runs the real MindAR compiler on the set faces
 *    and saves the resulting targets.mind into the set folder.
 *
 * Usage: node scripts/verify-e2e.mjs [--compile] [--shots DIR]
 * Requires a built dist/ (npm run build) — serves it with `vite preview`.
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const PORT = 4200 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}`;
const DO_COMPILE = process.argv.includes('--compile');
const shotsIdx = process.argv.indexOf('--shots');
const SHOTS_DIR = shotsIdx > -1 ? process.argv[shotsIdx + 1] : null;
if (SHOTS_DIR) mkdirSync(SHOTS_DIR, { recursive: true });

// Spawn vite directly (not via npx) so preview.kill() kills the real server.
const preview = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: 'pipe' },
);
await new Promise((resolve, reject) => {
  preview.stdout.on('data', (d) => d.toString().includes('Local') && resolve());
  preview.stderr.on('data', (d) => process.stderr.write(d));
  setTimeout(() => reject(new Error('preview server did not start')), 15000);
});

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: [
    '--enable-unsafe-swiftshader',
    // Fake camera so the REAL AR boot path (getUserMedia -> QR loop -> MindAR
    // controller with the compiled .mind) can be exercised headlessly.
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
  ],
});

let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? '  ✓' : '  ✗ FAIL'} ${name}`);
  if (!cond) failures++;
};
const shot = async (page, name) => {
  if (SHOTS_DIR) await page.screenshot({ path: join(SHOTS_DIR, `${name}.png`) });
};

const PAIRS = ['crab', 'palm', 'ball', 'boat', 'sun', 'shell', 'seagull', 'icecream'];

async function startMockGame(page, mode, playerCount = 2) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  if (mode === 'pass_play') {
    await page.click('text=تناوب');
    void playerCount;
  }
  await page.click('text=ابدأ اللعب');
  await page.waitForURL('**/play');
  await page.click('text=اللعب بوضع المحاكاة');
  await page.waitForSelector('[data-card-id]');
}

// ---------------------------------------------------------------- solo round
{
  const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
  page.on('pageerror', (e) => console.log('  page error:', e.message));
  await startMockGame(page, 'solo');
  await shot(page, '01-mock-game-start');

  for (const pair of PAIRS) {
    await page.click(`[data-card-id="${pair}:a"]`);
    await page.click(`[data-card-id="${pair}:b"]`);
    // Wait for the match resolution (END_REVEAL fires after matchRevealMs).
    await page.waitForFunction(
      (id) => document.querySelector(`[data-card-id="${id}"]`)?.hasAttribute('disabled'),
      `${pair}:a`,
      { timeout: 8000 },
    );
  }
  await page.waitForURL('**/results', { timeout: 10000 });
  const body = await page.textContent('body');
  check('solo round reaches results', body.includes('انتهت الجولة'));
  check('solo perfect run detected', body.includes('أداء مثالي'));
  await shot(page, '02-solo-results');
  await page.close();
}

// ------------------------------------------------------- pass&play turn pass
{
  const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
  await startMockGame(page, 'pass_play');

  const turnBadge = async () => (await page.textContent('body')).includes('اللاعب 1');
  check('player 1 starts', await turnBadge());

  // Deliberate miss: two cards from different pairs -> turn must pass.
  await page.click('[data-card-id="crab:a"]');
  await page.click('[data-card-id="palm:a"]');
  await shot(page, '03-pass-play-miss');
  await page.waitForFunction(
    () => document.body.textContent.includes('اللاعب 2'),
    undefined,
    { timeout: 8000 },
  );
  check('turn passes to player 2 after a miss', true);

  // Player 2 matches -> keeps turn and scores.
  await page.click('[data-card-id="sun:a"]');
  await page.click('[data-card-id="sun:b"]');
  await page.waitForFunction(
    () => document.querySelector('[data-card-id="sun:a"]')?.hasAttribute('disabled'),
    undefined,
    { timeout: 8000 },
  );
  const stillP2 = (await page.textContent('body')).includes('اللاعب 2');
  check('player 2 keeps turn after a match', stillP2);
  await shot(page, '04-pass-play-after-match');
  await page.close();
}

// ----------------------------------------- real AR boot path (fake camera)
{
  const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
  await page.context().grantPermissions(['camera']);
  page.on('pageerror', (e) => console.log('  page error:', e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.click('text=ابدأ اللعب');
  await page.waitForURL('**/play');
  await page.click('text=ابدأ الكاميرا');
  // Success signal: either toast — image tracking booted, or explicit QR-only
  // fallback. Anything else (stuck overlay / denied) is a failure.
  const outcome = await Promise.race([
    page
      .waitForSelector('text=التعرف على الصور يعمل', { timeout: 120000 })
      .then(() => 'image-tracking'),
    page
      .waitForSelector('text=سيعمل مسح QR فقط', { timeout: 120000 })
      .then(() => 'qr-only'),
    page
      .waitForSelector('text=الكاميرا غير متاحة', { timeout: 120000 })
      .then(() => 'denied'),
  ]).catch(() => 'timeout');
  check(`camera AR path boots (got: ${outcome})`, outcome === 'image-tracking');
  await shot(page, '05-camera-ar-boot');
  await page.close();
}

// ----------------------------------------------------------- targets compile
if (DO_COMPILE) {
  console.log('  compiling targets.mind in-browser (this can take a few minutes)...');
  const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
  page.on('console', (m) => m.type() === 'error' && console.log('  console:', m.text()));
  await page.goto(`${BASE}/tools/compile`, { waitUntil: 'networkidle' });
  await page.click('text=ابدأ التجميع');
  await page.waitForSelector('text=اكتمل التجميع', { timeout: 600000 });

  // Pull the compiled buffer out through the download blob.
  const base64 = await page.evaluate(async () => {
    const link = document.querySelector('a[download]');
    if (link) {
      const res = await fetch(link.href);
      const buf = await res.arrayBuffer();
      return btoa(String.fromCharCode(...new Uint8Array(buf)));
    }
    return null;
  });
  if (base64) {
    writeFileSync('public/sets/beach-day/targets.mind', Buffer.from(base64, 'base64'));
    console.log('  ✓ targets.mind saved to public/sets/beach-day/');
  } else {
    // Fallback: trigger the real download event.
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await page.click('text=تنزيل targets.mind');
    const download = await downloadPromise;
    await download.saveAs('public/sets/beach-day/targets.mind');
    console.log('  ✓ targets.mind saved via download event');
  }
  await shot(page, '05-compile-done');
  await page.close();
}

await browser.close();
preview.kill();
console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
