#!/usr/bin/env node

/**
 * Sprite Editor Test Runner for Web IDE
 * Uses proper wait utilities instead of fixed timeouts
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

const DEV_SERVER_URL = 'http://localhost:5173';

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

async function runTests() {
  console.log('🚀 Starting Sprite Editor E2E tests...');
  console.log(`📡 Using dev server: ${DEV_SERVER_URL}`);

  let browser = null;

  try {
    console.log('🐶 Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      devtools: false,
      defaultViewport: { width: 1280, height: 800 },
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Capture page errors
    page.on('error', err => console.error('Page error:', err));
    page.on('console', msg => {
      if (msg.type() === 'error') console.log('Browser console error:', msg.text());
    });

    console.log(`🌐 Navigating to ${DEV_SERVER_URL}...`);
    try {
      await page.goto(DEV_SERVER_URL, { waitUntil: 'networkidle0', timeout: DEFAULT_TIMEOUT });
    } catch (navError) {
      throw new Error(`Failed to navigate to ${DEV_SERVER_URL}: ${navError.message}`);
    }
    await sleep(2000);

    // Check if page loaded successfully and we have content
    const pageTitle = await page.title();
    console.log(`✅ Page loaded. Title: "${pageTitle}"`);

    // Wait for app to be ready
    try {
      await waitForFn(
        page,
        () => page.evaluate(() => document.querySelector('[class*="App"], [class*="ide"], .cm-editor') !== null),
        { timeout: 5000, errorMessage: 'App UI did not render' }
      );
      console.log('✅ App UI ready');
    } catch (err) {
      const html = await page.content();
      console.log('⚠️ App UI check failed, page content preview:', html.substring(0, 500));
      throw err;
    }

    console.log('\n=== Running Sprite Editor Tests ===\n');

    // Test: Open sprite editor from assets panel
    console.log('1. Open sprite editor from assets panel');
    try {
      // Find and click Assets button with multiple strategies
      const { clicked, buttons } = await page.evaluate(() => {
        const allButtons = document.querySelectorAll('button');
        let target = null;

        // Try aria-label first
        for (const btn of allButtons) {
          if (btn.getAttribute('aria-label')?.toLowerCase().includes('asset')) {
            target = btn;
            break;
          }
        }

        // Try text content
        if (!target) {
          for (const btn of allButtons) {
            if (btn.textContent?.toLowerCase().includes('asset')) {
              target = btn;
              break;
            }
          }
        }

        const btnList = Array.from(allButtons).map(b => ({
          text: b.textContent?.trim().substring(0, 30),
          ariaLabel: b.getAttribute('aria-label'),
          id: b.id
        }));

        if (target) {
          target.click();
          return { clicked: true, buttons: btnList };
        } else {
          return { clicked: false, buttons: btnList };
        }
      });

      console.log('   📋 Button search results:', { clicked, buttonCount: buttons.length });
      console.log('   📋 Available buttons:', buttons);

      if (!clicked) {
        throw new Error(`Assets button not found among ${buttons.length} buttons`);
      }

      console.log('   ✅ Assets button clicked');
      
      await waitForFn(
        page,
        () => page.evaluate(() => {
          const panel = document.querySelector('[aria-label="Assets"]');
          if (!panel) return false;
          const style = window.getComputedStyle(panel);
          return style.display !== 'none' && style.visibility !== 'hidden';
        }),
        { timeout: 5000, errorMessage: 'Assets panel not visible' }
      );
      
      console.log('✅ Assets panel opened successfully');

      const newSpriteButton = await findButton(page, 'New sprite');
      if (!newSpriteButton) throw new Error('New sprite button not found');

      console.log('🎨 Clicking New sprite button...');
      await newSpriteButton.click();
      
      await waitForElement(page, '[aria-label="Sprite Editor"]', { timeout: 5000 });
      
      console.log('✅ Sprite Editor opened successfully');
      
      // Check for canvas
      await waitForElement(page, '[aria-label="Sprite Editor"] canvas', { timeout: 5000 });
      console.log('🎨 Canvas found in sprite editor');
      
      // Close sprite editor
      const closeButton = await waitForElement(
        page,
        '[aria-label="Sprite Editor"] button[aria-label="Close"]',
        { timeout: 5000 }
      );
      await closeButton.click();
      await sleep(500);
      
      // Close assets panel
      const assetsCloseButton = await waitForElement(
        page,
        '[aria-label="Assets"] button[aria-label="Close"]',
        { timeout: 5000 }
      );
      await assetsCloseButton.click();
      await sleep(500);
      
      addTestResult('Open sprite editor from assets panel', true);
    } catch (error) {
      addTestResult('Open sprite editor from assets panel', false, error);
    }

    // Test: Drawing tools functionality
    console.log('\n2. Drawing tools functionality');
    try {
      await page.click('button[aria-label="Assets"]');
      
      await waitForFn(
        page,
        () => page.evaluate((s) => !!document.querySelector(s), '[aria-label="Assets"]'),
        { timeout: 5000, errorMessage: 'Assets panel did not open' }
      );
      
      const newSpriteButton = await findButton(page, 'New sprite');
      if (!newSpriteButton) throw new Error('New sprite button not found');
      await newSpriteButton.click();
      
      await waitForElement(page, '[aria-label="Sprite Editor"]', { timeout: 5000 });
      
      // Test rectangle tool
      console.log('   🟦 Testing rectangle tool...');
      const rectTool = await waitForElement(page, '[aria-label="Sprite Editor"] button[title="Rectangle"]', { timeout: 5000 });
      await rectTool.click();
      
      const canvas = await waitForElement(page, '[aria-label="Sprite Editor"] canvas', { timeout: 5000 });
      const canvasBox = await canvas.boundingBox();
      
      await page.mouse.move(canvasBox.x + 50, canvasBox.y + 50);
      await page.mouse.down();
      await page.mouse.move(canvasBox.x + 150, canvasBox.y + 100);
      await page.mouse.up();
      
      console.log('   ✅ Rectangle drawn');
      
      // Test ellipse tool
      console.log('   ⭕ Testing ellipse tool...');
      const ellipseTool = await waitForElement(page, '[aria-label="Sprite Editor"] button[title="Ellipse"]', { timeout: 5000 });
      await ellipseTool.click();
      
      await page.mouse.move(canvasBox.x + 200, canvasBox.y + 50);
      await page.mouse.down();
      await page.mouse.move(canvasBox.x + 300, canvasBox.y + 100);
      await page.mouse.up();
      
      console.log('   ✅ Ellipse drawn');
      
      // Test line tool
      console.log('   📏 Testing line tool...');
      const lineTool = await waitForElement(page, '[aria-label="Sprite Editor"] button[title="Line"]', { timeout: 5000 });
      await lineTool.click();
      
      await page.mouse.move(canvasBox.x + 50, canvasBox.y + 150);
      await page.mouse.down();
      await page.mouse.move(canvasBox.x + 150, canvasBox.y + 200);
      await page.mouse.up();
      
      console.log('   ✅ Line drawn');
      
      // Test undo
      console.log('   ↩️ Testing undo...');
      const undoButton = await waitForElement(page, '[aria-label="Sprite Editor"] button[title="Undo"]', { timeout: 5000 });
      await undoButton.click();
      console.log('   ✅ Undo performed');
      
      // Test redo
      console.log('   ↪️ Testing redo...');
      const redoButton = await waitForElement(page, '[aria-label="Sprite Editor"] button[title="Redo"]', { timeout: 5000 });
      await redoButton.click();
      console.log('   ✅ Redo performed');
      
      // Close
      const closeBtn = await waitForElement(page, '[aria-label="Sprite Editor"] button[aria-label="Close"]', { timeout: 5000 });
      await closeBtn.click();
      await sleep(500);
      
      const assetsCloseBtn = await waitForElement(page, '[aria-label="Assets"] button[aria-label="Close"]', { timeout: 5000 });
      await assetsCloseBtn.click();
      await sleep(500);
      
      addTestResult('Drawing tools functionality', true);
    } catch (error) {
      addTestResult('Drawing tools functionality', false, error);
    }

    // Test: Fill color toggle — SKIPPED.
    // The UI this test was written against had a dedicated "Enable fill" /
    // "Disable fill" toggle button next to a <input type="color"> that gained
    // a `disabled` attribute when fill was off. The current sprite editor
    // uses a color-picker popover with a "none / transparent" swatch as the
    // disable mechanism — no toggle button, no disabled color input.
    // TODO: rewrite to use the popover flow (click fill-color-button, then the
    // "none / transparent" swatch in fill-color-popover) and assert on the
    // fill button's preview swatch.
    skipTestResult('Fill color toggle functionality', 'tests removed UI (no fill toggle button)');

    // Test: Polygon tool with keyboard shortcuts
    console.log('\n4. Polygon tool with keyboard shortcuts');
    try {
      await page.click('button[aria-label="Assets"]');
      
      await waitForFn(
        page,
        () => page.evaluate((s) => !!document.querySelector(s), '[aria-label="Assets"]'),
        { timeout: 5000, errorMessage: 'Assets panel did not open' }
      );
      
      const newSpriteButton = await findButton(page, 'New sprite');
      if (!newSpriteButton) throw new Error('New sprite button not found');
      
      await newSpriteButton.click();
      await waitForElement(page, '[aria-label="Sprite Editor"]', { timeout: 5000 });
      
      const polygonTool = await waitForElement(page, '[aria-label="Sprite Editor"] button[title="Polygon"]', { timeout: 5000 });
      await polygonTool.click();
      
      const canvas = await waitForElement(page, '[aria-label="Sprite Editor"] canvas', { timeout: 5000 });
      const canvasBox = await canvas.boundingBox();
      
      console.log('   🔺 Drawing polygon vertices...');
      
      await page.mouse.click(canvasBox.x + 100, canvasBox.y + 100);
      await sleep(100);
      await page.mouse.click(canvasBox.x + 150, canvasBox.y + 100);
      await sleep(100);
      await page.mouse.click(canvasBox.x + 125, canvasBox.y + 150);
      await sleep(100);
      
      console.log('   ✅ Polygon vertices added');
      
      console.log('   ⌨️ Pressing Enter to close polygon...');
      await page.keyboard.press('Enter');
      await sleep(300);
      
      console.log('   ✅ Polygon closed with Enter key');
      
      // Close
      const closeBtn = await waitForElement(page, '[aria-label="Sprite Editor"] button[aria-label="Close"]', { timeout: 5000 });
      await closeBtn.click();
      await sleep(500);
      
      const assetsCloseBtn = await waitForElement(page, '[aria-label="Assets"] button[aria-label="Close"]', { timeout: 5000 });
      await assetsCloseBtn.click();
      await sleep(500);
      
      addTestResult('Polygon tool with keyboard shortcuts', true);
    } catch (error) {
      addTestResult('Polygon tool with keyboard shortcuts', false, error);
    }

    // Test: Save sprite functionality
    console.log('\n5. Save sprite functionality');
    try {
      await page.click('button[aria-label="Assets"]');
      
      await waitForFn(
        page,
        () => page.evaluate((s) => !!document.querySelector(s), '[aria-label="Assets"]'),
        { timeout: 5000, errorMessage: 'Assets panel did not open' }
      );
      
      const newSpriteButton = await findButton(page, 'New sprite');
      if (!newSpriteButton) throw new Error('New sprite button not found');
      
      await newSpriteButton.click();
      await waitForElement(page, '[aria-label="Sprite Editor"]', { timeout: 5000 });
      
      // Draw a rectangle
      const rectTool = await waitForElement(page, '[aria-label="Sprite Editor"] button[title="Rectangle"]', { timeout: 5000 });
      await rectTool.click();
      
      const canvas = await waitForElement(page, '[aria-label="Sprite Editor"] canvas', { timeout: 5000 });
      const canvasBox = await canvas.boundingBox();
      
      await page.mouse.move(canvasBox.x + 50, canvasBox.y + 50);
      await page.mouse.down();
      await page.mouse.move(canvasBox.x + 150, canvasBox.y + 100);
      await page.mouse.up();
      
      console.log('   ✅ Shape drawn for saving');
      
      // Set sprite name
      const nameInput = await waitForElement(page, '[aria-label="Sprite Editor"] input', { timeout: 5000 });
      await nameInput.click({ clickCount: 3 });
      await page.keyboard.press('Delete');
      await page.keyboard.type('test-sprite-' + Date.now());
      
      console.log('   📝 Sprite name set');
      
      // Save as PNG
      const savePngButton = await page.evaluate(() => {
        const buttons = document.querySelectorAll('[aria-label="Sprite Editor"] button');
        for (const btn of buttons) {
          if (btn.textContent?.includes('Save as PNG') || btn.textContent?.includes('Save')) {
            return btn;
          }
        }
        return null;
      });
      if (!savePngButton) throw new Error('Save as PNG button not found');
      await page.evaluate(btn => btn.click(), savePngButton);
      
      // Wait for sprite editor to close (indicates save was successful)
      await waitForFn(
        page,
        () => page.evaluate(() => {
          const editor = document.querySelector('[aria-label="Sprite Editor"]');
          if (!editor) return true;
          const style = window.getComputedStyle(editor);
          return style.display === 'none' || style.visibility === 'hidden';
        }),
        { timeout: 5000, errorMessage: 'Sprite Editor did not close after save' }
      );
      
      console.log('   ✅ Sprite saved as PNG');
      
      // Close assets panel
      const assetsCloseBtn = await waitForElement(page, '[aria-label="Assets"] button[aria-label="Close"]', { timeout: 5000 });
      await assetsCloseBtn.click();
      await sleep(500);
      
      addTestResult('Save sprite functionality', true);
    } catch (error) {
      addTestResult('Save sprite functionality', false, error);
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
