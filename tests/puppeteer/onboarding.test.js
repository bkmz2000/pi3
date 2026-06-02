#!/usr/bin/env node
/**
 * Onboarding nudge E2E test.
 * Requires the dev server running at PUPPETEER_URL (default :5173).
 *
 * Run:  node tests/puppeteer/onboarding.test.js
 */

import puppeteer from 'puppeteer';

const BASE = process.env.PUPPETEER_URL || 'http://localhost:5173';

let passed = 0;
let failed = 0;

function ok(name, cond, detail = '') {
  if (cond) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // 1. Open IDE at / with no project — nudge should be visible
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-onboarding-nudge]', { timeout: 10000 }).catch(() => null);

  const nudgeVisible = await page.$('[data-onboarding-nudge]') !== null;
  ok('nudge renders on empty editor', nudgeVisible);

  const startHereText = await page.evaluate(() => {
    const el = document.querySelector('[data-onboarding-nudge]');
    return el ? el.textContent : '';
  });
  ok('"Start Here" link present in nudge', startHereText?.includes('Start Here'));
  ok('"Next Step" link present in nudge', startHereText?.includes('Next Step'));

  // 2. Click "Start Here" → hello world should load and nudge should disappear
  await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('[data-onboarding-nudge] span'));
    const start = spans.find(s => s.textContent?.includes('Start Here'));
    if (start) start.click();
  });
  await page.waitForFunction(
    () => document.querySelector('[data-onboarding-nudge]') === null,
    { timeout: 5000 },
  ).catch(() => null);

  const nudgeGone = await page.$('[data-onboarding-nudge]') === null;
  ok('nudge disappears after clicking Start Here', nudgeGone);

  await browser.close();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
