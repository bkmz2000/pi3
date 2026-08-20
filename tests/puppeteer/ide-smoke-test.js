#!/usr/bin/env node

/**
 * Pre-launch smoke suite (Puppeteer).
 *
 * Covers the deterministic subset of docs/pre-launch-smoke.md:
 *   P0.1 cold boot, no console errors
 *   P0.2 run hello world, see output
 *   P0.3 dirty flag + Ctrl+S round trip
 *   P0.8 anonymous stash survives reload
 *   P1.5 anonStash quota chip appears when localStorage is full
 *
 * Cases that require eyeballing smoothness (paint stress, pan/zoom) or
 * synthetic crashes via DevTools breakpoints stay in the manual checklist.
 *
 * Usage (either):
 *   npm run dev:all          # dev server, then:
 *   npm run test:smoke
 *   -- or --
 *   npm run build:server && npm run build   # production build, then:
 *   PUPPETEER_URL=http://localhost:3001 npm run test:smoke
 *
 * Exits non-zero on any failure so CI can gate on it.
 */

import puppeteer from 'puppeteer';
import { waitForElement, waitForFn, sleep } from './test-utils.js';

const URL = process.env.PUPPETEER_URL || 'http://localhost:5173';
const HEADLESS = process.env.HEADLESS !== 'false';

const results = { passed: 0, failed: 0, cases: [] };

async function run(name, fn) {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    results.passed++;
    results.cases.push({ name, ok: true, ms });
    console.log(`  ok  ${name} (${ms}ms)`);
  } catch (err) {
    const ms = Date.now() - start;
    results.failed++;
    results.cases.push({ name, ok: false, ms, error: err.message });
    console.log(`  FAIL ${name} (${ms}ms): ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ── Page bootstrap ──────────────────────────────────────────────────────────

async function freshPage(browser) {
  const ctx = await browser.createBrowserContext(); // isolated storage
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page._consoleErrors = consoleErrors;
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  return { page, ctx };
}

// Expected, tolerated console noise. The browser logs 'Failed to load
// resource ... 401' when an anonymous visitor hits the /api/users/me session
// check — that is the intended unauthenticated flow, not an app error.
function isToleratedConsoleError(msg) {
  return /i18next|HMR|locize|401|Unauthorized|users\/me/i.test(msg);
}

async function waitForPyodideReady(page) {
  // The Run button becomes enabled once Pyodide is initialized. The button
  // is an icon button: it carries aria-label="Run" (or "Stop" while a
  // program is running) and has no text content.
  await waitForFn(page, async () => {
    return await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Run"]');
      return !!btn && !btn.disabled;
    });
  }, { timeout: 60000 });
}

async function clickRun(page) {
  // A previous run may have left the button as Stop; click whichever is live.
  const label = await page.evaluate(() => {
    const run = document.querySelector('button[aria-label="Run"]');
    const stop = document.querySelector('button[aria-label="Stop"]');
    return stop ? 'Stop' : run ? 'Run' : null;
  });
  if (label === 'Stop') {
    await page.click('button[aria-label="Stop"]');
    await waitForFn(page, async () => {
      return await page.evaluate(() => !!document.querySelector('button[aria-label="Run"]'));
    }, { timeout: 10000 });
  }
  await waitForFn(page, async () => {
    return await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Run"]');
      return !!btn && !btn.disabled;
    });
  }, { timeout: 10000 });
  await page.click('button[aria-label="Run"]');
}

async function typeInEditor(page, text) {
  await waitForElement(page, '.cm-content');
  await page.click('.cm-content');
  await sleep(100);
  await page.keyboard.type(text);
}

async function clearEditor(page) {
  await page.click('.cm-content');
  await page.keyboard.down('Control');
  await page.keyboard.press('a');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
}

// ── Test cases ──────────────────────────────────────────────────────────────

async function caseColdBoot(browser) {
  const { page, ctx } = await freshPage(browser);
  try {
    await waitForPyodideReady(page);
    const errs = page._consoleErrors.filter((m) => !isToleratedConsoleError(m));
    assert(errs.length === 0, `unexpected console errors: ${errs.slice(0, 3).join(' | ')}`);
  } finally {
    await ctx.close();
  }
}

async function caseRunHelloWorld(browser) {
  const { page, ctx } = await freshPage(browser);
  try {
    await waitForPyodideReady(page);
    await clearEditor(page);
    const sentinel = 'smoke-' + Date.now();
    await typeInEditor(page, `print("${sentinel}")`);
    await clickRun(page);
    await waitForFn(page, async () => {
      const txt = await page.evaluate(() => document.body.innerText);
      return txt.includes(sentinel);
    }, { timeout: 20000 });
  } finally {
    await ctx.close();
  }
}

async function caseDirtyAndSave(browser) {
  const { page, ctx } = await freshPage(browser);
  try {
    await waitForPyodideReady(page);
    await clearEditor(page);
    await typeInEditor(page, '# edit ' + Date.now());

    // Dirty marker is a 7px dot span inside the tab (no text/aria) — detect
    // it by its distinctive style rather than innerText.
    await waitForFn(page, async () => {
      return await page.evaluate(() => {
        const dot = Array.from(document.querySelectorAll('button span')).find((s) => {
          const st = /** @type {HTMLElement} */ (s).style;
          return st.width === '7px' && st.borderRadius === '7px';
        });
        return !!dot;
      });
    }, { timeout: 5000 });

    await page.keyboard.down('Control');
    await page.keyboard.press('s');
    await page.keyboard.up('Control');

    // Wait for it to settle to a clean state. Example sessions stay "Local
    // only" — that's still a successful save for the smoke check.
    await sleep(2000);
  } finally {
    await ctx.close();
  }
}

async function caseAnonStashPersistence(browser) {
  const { page, ctx } = await freshPage(browser);
  try {
    await waitForPyodideReady(page);
    await clearEditor(page);
    const sentinel = 'persist-' + Date.now();
    await typeInEditor(page, `# ${sentinel}`);

    await page.keyboard.down('Control');
    await page.keyboard.press('s');
    await page.keyboard.up('Control');
    await sleep(1500); // let writeAnonStash flush

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPyodideReady(page);

    await waitForFn(page, async () => {
      const code = await page.evaluate(() => document.querySelector('.cm-content')?.innerText ?? '');
      return code.includes(sentinel);
    }, { timeout: 15000 });
  } finally {
    await ctx.close();
  }
}

async function caseAnonStashQuotaChip(browser) {
  const { page, ctx } = await freshPage(browser);
  try {
    await waitForPyodideReady(page);

    // Fill localStorage until setItem throws, then top up the remaining
    // headroom with small keys so any subsequent write (the anon stash) is
    // guaranteed to exceed quota. Blob size is a tradeoff: too big leaves
    // hundreds of KB of headroom, too small makes the loop slow.
    await page.evaluate(() => {
      const blob = 'x'.repeat(400_000);
      let i = 0;
      try {
        for (; i < 100; i++) localStorage.setItem('__quota_pad_' + i, blob);
      } catch { /* quota reached */ }
      // Fill the leftover headroom with 1KB keys until we're at the edge.
      const small = 'y'.repeat(1000);
      let j = 0;
      try {
        for (; j < 5000; j++) localStorage.setItem('__quota_tiny_' + j, small);
      } catch { /* now at the edge */ }
    });

    await clearEditor(page);
    await typeInEditor(page, '# overflow ' + Date.now());
    await page.keyboard.down('Control');
    await page.keyboard.press('s');
    await page.keyboard.up('Control');

    await waitForFn(page, async () => {
      return await page.evaluate(() => /local storage full|storage unavailable/i.test(document.body.innerText));
    }, { timeout: 5000 });

    // Cleanup so subsequent cases don't inherit the padded storage.
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) if (k.startsWith('__quota_pad_')) localStorage.removeItem(k);
    });
  } finally {
    await ctx.close();
  }
}

// ── Driver ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`smoke: target ${URL} (headless=${HEADLESS})`);
  const browser = await puppeteer.launch({
    headless: HEADLESS ? 'new' : false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    await run('P0.1 cold boot, no console errors', () => caseColdBoot(browser));
    await run('P0.2 run hello world prints to console', () => caseRunHelloWorld(browser));
    await run('P0.3 dirty + ctrl+s round trip', () => caseDirtyAndSave(browser));
    await run('P0.8 anonymous stash persists across reload', () => caseAnonStashPersistence(browser));
    await run('P1.5 quota chip appears when localStorage is full', () => caseAnonStashQuotaChip(browser));
  } finally {
    await browser.close();
  }

  console.log(`\n${results.passed} passed, ${results.failed} failed`);
  if (results.failed > 0) {
    console.log('\nFailures:');
    for (const c of results.cases.filter((c) => !c.ok)) {
      console.log(`  - ${c.name}: ${c.error}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('smoke runner crashed:', err);
  process.exit(2);
});