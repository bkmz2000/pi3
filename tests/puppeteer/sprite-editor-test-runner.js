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

async function runTests() {
  console.log('🚀 Starting Sprite Editor E2E tests...');
  console.log(`📡 Using dev server: ${DEV_SERVER_URL}`);

  let browser = null;

  try {
    console.log('🐶 Launching browser...');
    browser = await puppeteer.launch({
      headless: false,
      devtools: false,
      defaultViewport: { width: 1280, height: 800 },
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      slowMo: 30,
    });

    const page = await browser.newPage();

    console.log(`🌐 Navigating to ${DEV_SERVER_URL}...`);
    await page.goto(DEV_SERVER_URL, { waitUntil: 'networkidle0', timeout: DEFAULT_TIMEOUT });
    await sleep(2000);

    console.log('\n=== Running Sprite Editor Tests ===\n');

    // Test: Open sprite editor from assets panel
    console.log('1. Open sprite editor from assets panel');
    try {
      await waitForElement(page, 'button[aria-label="Assets"]', { timeout: 5000 });
      await page.click('button[aria-label="Assets"]');
      
      await waitForFn(
        page,
        () => page.evaluate(() => {
          const panel = document.querySelector('dialog[aria-label="Assets"]');
          if (!panel) return false;
          const style = window.getComputedStyle(panel);
          return style.display !== 'none' && style.visibility !== 'hidden';
        }),
        { timeout: 5000, errorMessage: 'Assets panel not visible' }
      );
      
      console.log('✅ Assets panel opened successfully');
      
      const newSpriteButton = await waitForElement(
        page,
        'button:has-text("New sprite"), button:has-text("+ New sprite")',
        { timeout: 5000 }
      );
      
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
        'dialog[aria-label="Assets"] button[aria-label="Close"]',
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
        () => page.evaluate(() => document.querySelector('dialog[aria-label="Assets"]')),
        { timeout: 5000, errorMessage: 'Assets panel did not open' }
      );
      
      const newSpriteButton = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent?.includes('New sprite')) return btn;
        }
        return null;
      });
      
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
      
      const assetsCloseBtn = await waitForElement(page, 'dialog[aria-label="Assets"] button[aria-label="Close"]', { timeout: 5000 });
      await assetsCloseBtn.click();
      await sleep(500);
      
      addTestResult('Drawing tools functionality', true);
    } catch (error) {
      addTestResult('Drawing tools functionality', false, error);
    }

    // Test: Fill color toggle
    console.log('\n3. Fill color toggle functionality');
    try {
      await page.click('button[aria-label="Assets"]');
      
      await waitForFn(
        page,
        () => page.evaluate(() => document.querySelector('dialog[aria-label="Assets"]')),
        { timeout: 5000, errorMessage: 'Assets panel did not open' }
      );
      
      const newSpriteButton = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent?.includes('New sprite')) return btn;
        }
        return null;
      });
      
      await newSpriteButton.click();
      await waitForElement(page, '[aria-label="Sprite Editor"]', { timeout: 5000 });
      
      const fillToggleButton = await waitForElement(
        page,
        '[aria-label="Sprite Editor"] button[title="Enable fill"], [aria-label="Sprite Editor"] button[title="Disable fill"], [aria-label="Sprite Editor"] button[aria-label="Toggle fill"]',
        { timeout: 5000 }
      );
      
      const fillColorInput = await waitForElement(
        page,
        '[aria-label="Sprite Editor"] input[type="color"]',
        { timeout: 5000 }
      );
      
      let isDisabled = await page.evaluate(el => el.hasAttribute('disabled'), fillColorInput);
      if (isDisabled) throw new Error('Fill color input should not be disabled initially');
      
      console.log('   🎨 Initial fill state: enabled');
      
      // Toggle off
      await fillToggleButton.click();
      await sleep(300);
      
      isDisabled = await page.evaluate(el => el.hasAttribute('disabled'), fillColorInput);
      if (!isDisabled) throw new Error('Fill color input should be disabled after toggling off');
      
      console.log('   ✅ Fill disabled (transparent)');
      
      // Toggle on
      await fillToggleButton.click();
      await sleep(300);
      
      isDisabled = await page.evaluate(el => el.hasAttribute('disabled'), fillColorInput);
      if (isDisabled) throw new Error('Fill color input should be enabled after toggling on');
      
      console.log('   ✅ Fill enabled');
      
      // Close
      const closeBtn = await waitForElement(page, '[aria-label="Sprite Editor"] button[aria-label="Close"]', { timeout: 5000 });
      await closeBtn.click();
      await sleep(500);
      
      const assetsCloseBtn = await waitForElement(page, 'dialog[aria-label="Assets"] button[aria-label="Close"]', { timeout: 5000 });
      await assetsCloseBtn.click();
      await sleep(500);
      
      addTestResult('Fill color toggle functionality', true);
    } catch (error) {
      addTestResult('Fill color toggle functionality', false, error);
    }

    // Test: Polygon tool with keyboard shortcuts
    console.log('\n4. Polygon tool with keyboard shortcuts');
    try {
      await page.click('button[aria-label="Assets"]');
      
      await waitForFn(
        page,
        () => page.evaluate(() => document.querySelector('dialog[aria-label="Assets"]')),
        { timeout: 5000, errorMessage: 'Assets panel did not open' }
      );
      
      const newSpriteButton = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent?.includes('New sprite')) return btn;
        }
        return null;
      });
      
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
      
      const assetsCloseBtn = await waitForElement(page, 'dialog[aria-label="Assets"] button[aria-label="Close"]', { timeout: 5000 });
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
        () => page.evaluate(() => document.querySelector('dialog[aria-label="Assets"]')),
        { timeout: 5000, errorMessage: 'Assets panel did not open' }
      );
      
      const newSpriteButton = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent?.includes('New sprite')) return btn;
        }
        return null;
      });
      
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
      const savePngButton = await waitForElement(page, '[aria-label="Sprite Editor"] button:has-text("Save as PNG")', { timeout: 5000 });
      await savePngButton.click();
      
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
      const assetsCloseBtn = await waitForElement(page, 'dialog[aria-label="Assets"] button[aria-label="Close"]', { timeout: 5000 });
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
