#!/usr/bin/env node

/**
 * Sprite Editor E2E Test Runner (current pixel sheet editor).
 *
 * Opens the sheet editor via Projects panel → "New sprite" (+), then
 * exercises tool selection and pointer drawing on the pixel canvas.
 * Uses proper wait utilities instead of fixed timeouts.
 */

import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  waitFor,
  waitForElement,
  waitForFn,
  sleep,
  assert,
  findButton,
  DEFAULT_TIMEOUT
} from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEV_SERVER_URL = process.env.PUPPETEER_URL || 'http://localhost:5173';

const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

function addTestResult(name, passed, error = null) {
  const result = { name, passed, error: error?.message || error };
  testResults.tests.push(result);
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${name}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${name}: ${error?.message || error}`);
  }
}

function skipTestResult(name, reason) {
  testResults.tests.push({ name, skipped: true, reason });
  testResults.skipped++;
  console.log(`⏭️  ${name} (skipped: ${reason})`);
}

async function openSheetEditor(page) {
  // Projects panel → Sprites section "+" (title="New sprite").
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Projects"]');
    if (btn) btn.click();
  });
  await waitForFn(page, async () => {
    return await page.evaluate(() => {
      const region = document.querySelector('div[role="region"]');
      return !!region && (region.getAttribute('style') || '').includes('left: 60');
    });
  }, { timeout: 5000 });
  await sleep(500);

  const plusClicked = await page.evaluate(() => {
    const btn = document.querySelector('button[title="New sprite"]');
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!plusClicked) throw new Error('New sprite button not found');
  await waitForFn(page, async () => {
    return await page.evaluate(() => document.querySelectorAll('canvas').length > 0);
  }, { timeout: 10000 });
  await sleep(800);
}

async function closeSheetEditor(page) {
  await page.evaluate(() => {
    const btn = document.querySelector('button[title="Close"]');
    if (btn) btn.click();
  });
  await sleep(800);
  // Close the Projects panel too.
  await page.evaluate(() => {
    const region = document.querySelector('div[role="region"]');
    if (region) {
      const btn = region.querySelector('button[title="Close"]');
      if (btn) btn.click();
    }
  });
  await sleep(500);
}

async function selectTool(page, title) {
  const btn = await waitForElement(page, `button[title="${title}"]`, { timeout: 5000 });
  await btn.click();
  await sleep(200);
}

async function dragOnCanvas(page, x1, y1, x2, y2) {
  const canvas = await waitForElement(page, 'canvas', { timeout: 5000 });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no bounding box');
  await page.mouse.move(box.x + x1, box.y + y1);
  await page.mouse.down();
  await page.mouse.move(box.x + x2, box.y + y2, { steps: 8 });
  await page.mouse.up();
  await sleep(300);
}

async function runTests() {
  console.log('🚀 Starting Sprite Editor E2E tests...');
  console.log(`📡 Target: ${DEV_SERVER_URL}`);

  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      devtools: false,
      defaultViewport: { width: 1280, height: 800 },
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();

    page.on('error', err => console.error('Page error:', err));
    page.on('console', msg => {
      if (msg.type() === 'error') console.log('Browser console error:', msg.text());
    });

    console.log(`🌐 Navigating to ${DEV_SERVER_URL}...`);
    try {
      await page.goto(DEV_SERVER_URL, { waitUntil: 'domcontentloaded', timeout: DEFAULT_TIMEOUT });
    } catch (navError) {
      throw new Error(`Failed to navigate to ${DEV_SERVER_URL}: ${navError.message}`);
    }
    await sleep(2000);

    // Wait for the IDE (Run button enabled means Pyodide loaded).
    await waitForFn(page, async () => {
      return await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label="Run"]');
        return !!btn && !btn.disabled;
      });
    }, { timeout: 60000 });

    console.log('\n=== Running Sprite Editor Tests ===\n');

    // Test 1: Open sheet editor
    console.log('1. Open sheet editor from Projects panel');
    try {
      await openSheetEditor(page);
      const hasCanvas = await page.evaluate(() => document.querySelectorAll('canvas').length > 0);
      if (!hasCanvas) throw new Error('sheet editor canvas not found');
      await closeSheetEditor(page);
      addTestResult('Open sprite editor', true);
    } catch (error) {
      addTestResult('Open sprite editor', false, error);
    }

    // Test 2: Drawing tools (pencil, rect, ellipse, line) + undo/redo
    console.log('\n2. Drawing tools functionality');
    try {
      await openSheetEditor(page);

      console.log('   ✏️ Pencil stroke...');
      await selectTool(page, 'Pencil');
      await dragOnCanvas(page, 40, 40, 90, 90);

      console.log('   🟦 Rect...');
      await selectTool(page, 'Rect');
      await dragOnCanvas(page, 120, 40, 220, 100);

      console.log('   ⭕ Ellipse...');
      await selectTool(page, 'Ellipse');
      await dragOnCanvas(page, 260, 40, 360, 100);

      console.log('   📏 Line...');
      await selectTool(page, 'Line');
      await dragOnCanvas(page, 40, 160, 140, 220);

      console.log('   ↩️ Undo (Ctrl+Z) / ↪️ Redo (Ctrl+Y)...');
      // Undo/redo are keyboard shortcuts in the current editor.
      await page.keyboard.down('Control');
      await page.keyboard.press('z');
      await page.keyboard.up('Control');
      await sleep(300);
      await page.keyboard.down('Control');
      await page.keyboard.press('y');
      await page.keyboard.up('Control');
      await sleep(300);

      await closeSheetEditor(page);
      addTestResult('Drawing tools functionality', true);
    } catch (error) {
      addTestResult('Drawing tools functionality', false, error);
    }

    // Test 3: Fill color toggle — SKIPPED.
    // The current editor uses a color-picker popover with a "none /
    // transparent" swatch as the disable mechanism, not a toggle button.
    skipTestResult('Fill color toggle functionality', 'color picker popover, not a toggle button');

    // Test 4: Tool switching does not crash the editor
    console.log('\n4. Tool switching');
    try {
      await openSheetEditor(page);
      for (const t of ['Pencil', 'Eraser', 'Fill', 'Line', 'Rect', 'Ellipse', 'Select / Move']) {
        await selectTool(page, t);
      }
      // Draw one pixel with the pencil to confirm the canvas stays live.
      await selectTool(page, 'Pencil');
      await dragOnCanvas(page, 50, 50, 55, 55);
      await closeSheetEditor(page);
      addTestResult('Tool switching', true);
    } catch (error) {
      addTestResult('Tool switching', false, error);
    }

    // Test 5: Sprite edits persist after closing (sheet pixels survive)
    console.log('\n5. Sprite edit persistence');
    try {
      await openSheetEditor(page);
      await selectTool(page, 'Pencil');
      await dragOnCanvas(page, 60, 60, 120, 120);
      await closeSheetEditor(page);

      // Re-open: the pixels should still be there (sheet persisted to store).
      await openSheetEditor(page);
      const pixelSet = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        if (!c || !c.width) return -1;
        const ctx = c.getContext('2d');
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        let set = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) set++;
        return set;
      });
      await closeSheetEditor(page);
      if (pixelSet <= 0) throw new Error('no pixels persisted after re-open');
      addTestResult('Sprite edit persistence', true);
    } catch (error) {
      addTestResult('Sprite edit persistence', false, error);
    }

    // Summary
    console.log('\n=== Test Summary ===');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`⏭️  Skipped: ${testResults.skipped}`);
    console.log(`📊 Total: ${testResults.tests.length}`);

    const resultsPath = `${__dirname}/sprite-editor-test-results.json`;
    writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
    console.log(`\n📄 Detailed results saved to: ${resultsPath}`);

    if (testResults.failed > 0) {
      console.log('\n❌ Some tests failed');
      process.exit(1);
    } else {
      console.log('\n✅ All sprite editor tests passed!');
      process.exit(0);
    }

  } catch (error) {
    console.error('🔥 Test runner fatal error:', error);
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
}

// Run tests
runTests();