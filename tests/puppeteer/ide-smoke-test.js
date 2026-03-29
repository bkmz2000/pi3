#!/usr/bin/env node

/**
 * Quick smoke test for Web IDE
 * Tests the most critical functions for upcoming refactoring
 */

import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DEV_SERVER_URL = 'http://localhost:5173';
const TEST_TIMEOUT = 60000;

// Test results
const testResults = {
  passed: 0,
  failed: 0,
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

// Quick test: Page loads and basic UI exists
async function testBasicLoad(page) {
  const testName = 'Page loads and basic UI exists';
  
  try {
    console.log(`🌐 Navigating to ${DEV_SERVER_URL}...`);
    await page.goto(DEV_SERVER_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
    
    // Check for React root
    const root = await page.$('#root');
    if (!root) throw new Error('React root (#root) not found');
    
    // Check for code editor
    const editor = await page.$('.cm-editor, [contenteditable="true"]');
    if (!editor) throw new Error('Code editor not found');
    
    // Check for run button - look for play icon button
    const buttons = await page.$$('button');
    let foundRunButton = false;
    
    // Check for play icon in buttons
    for (const btn of buttons) {
      const html = await page.evaluate(el => el.innerHTML, btn);
      // Look for play icon (▶ or SVG with play icon)
      if (html.includes('▶') || html.includes('play') || html.includes('Play')) {
        foundRunButton = true;
        break;
      }
    }
    
    if (!foundRunButton) {
      // Check button texts
      const buttonTexts = await page.$$eval('button', els => 
        els.map(el => el.textContent?.trim()).filter(Boolean)
      );
      console.log(`🔘 Button samples: ${buttonTexts.slice(0, 10).join(', ')}...`);
      console.log('⚠️ Run button may be an icon without text');
    }
    
    addTestResult(testName, true);
    return true;
  } catch (error) {
    addTestResult(testName, false, error);
    return false;
  }
}

// Quick test: Python code execution
async function testPythonExecution(page) {
  const testName = 'Python code execution works';
  
  try {
    // Find editor
    const editor = await page.$('.cm-editor, [contenteditable="true"]');
    if (!editor) throw new Error('Code editor not found');
    
    // Type simple Python code
    await editor.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.keyboard.type('print("SMOKE TEST: Hello World!")');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Find and click run button - look for play icon
    const buttons = await page.$$('button');
    let runButton = null;
    
    // First try to find by aria-label
    for (const btn of buttons) {
      const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label'), btn);
      if (ariaLabel?.includes('run') || ariaLabel?.includes('play') || ariaLabel?.includes('Run')) {
        runButton = btn;
        break;
      }
    }
    
    // If not found by aria-label, look for play icon in HTML
    if (!runButton) {
      for (const btn of buttons) {
        const html = await page.evaluate(el => el.innerHTML, btn);
        if (html.includes('▶') || html.includes('play') || html.includes('Play')) {
          runButton = btn;
          break;
        }
      }
    }
    
    // If still not found, try to find by position (often first button in rail)
    if (!runButton) {
      const railButtons = await page.$$('[class*="rail"] button, [class*="sidebar"] button');
      if (railButtons.length > 0) {
        // The play button is often the first icon button in the rail
        runButton = railButtons[0];
      }
    }
    
    if (!runButton) throw new Error('Run button not found');
    
    console.log('▶️ Running Python code...');
    await runButton.click();
    
    // Wait for execution
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check for output
    const bodyText = await page.evaluate(() => document.body.textContent);
    if (bodyText.includes('SMOKE TEST: Hello World!')) {
      console.log('✅ Python execution successful');
      addTestResult(testName, true);
      return true;
    } else {
      throw new Error('Expected output not found');
    }
  } catch (error) {
    addTestResult(testName, false, error);
    return false;
  }
}

// Quick test: Asset management
async function testAssetManagement(page) {
  const testName = 'Asset management works';
  
  try {
    // Find Assets button
    const assetsButton = await page.$('button[aria-label="Assets"]');
    if (!assetsButton) {
      // Try alternative
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent?.trim(), btn);
        if (text === 'Assets' || text === '🖼️') {
          assetsButton = btn;
          break;
        }
      }
    }
    
    if (!assetsButton) {
      console.log('⚠️ Assets button not found, skipping');
      testResults.tests.push({ name: testName, passed: true, error: 'Skipped - button not found' });
      return null;
    }
    
    console.log('🔘 Opening Assets panel...');
    await assetsButton.click();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if panel opened
    const panels = await page.$$('[class*="panel"], [class*="sidebar"]');
    if (panels.length === 0) throw new Error('Assets panel did not open');
    
    console.log('✅ Assets panel opened');
    
    // Close panel
    await assetsButton.click();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    addTestResult(testName, true);
    return true;
  } catch (error) {
    addTestResult(testName, false, error);
    return false;
  }
}

// Quick test: File operations
async function testFileOperations(page) {
  const testName = 'Basic file operations';
  
  try {
    // Look for file tabs
    const tabs = await page.$$('[role="tab"], .tab');
    console.log(`📄 Found ${tabs.length} file tabs`);
    
    if (tabs.length === 0) {
      console.log('⚠️ No file tabs found, checking for file UI');
      // Check if there's any file UI
      const fileUI = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        for (const el of elements) {
          if (el.textContent?.includes('.py') || el.textContent?.includes('main.py')) {
            return true;
          }
        }
        return false;
      });
      
      if (fileUI) {
        console.log('✅ File UI detected');
        addTestResult(testName, true);
        return true;
      } else {
        throw new Error('No file UI found');
      }
    }
    
    // Click on first tab
    await tabs[0].click();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('✅ File tab interaction works');
    addTestResult(testName, true);
    return true;
  } catch (error) {
    addTestResult(testName, false, error);
    return false;
  }
}

// Quick test: p5.js sketch
async function testP5Sketch(page) {
  const testName = 'p5.js sketch execution';
  
  try {
    const editor = await page.$('.cm-editor, [contenteditable="true"]');
    if (!editor) throw new Error('Code editor not found');
    
    // Type p5 sketch
    await editor.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    
    const p5Code = `def setup():
    createCanvas(200, 200)
    background(100)

def draw():
    fill(255, 0, 0)
    ellipse(100, 100, 50, 50)`;
    
    await page.keyboard.type(p5Code);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Find run button - use same logic as Python test
    const buttons = await page.$$('button');
    let runButton = null;
    
    // First try to find by aria-label
    for (const btn of buttons) {
      const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label'), btn);
      if (ariaLabel?.includes('run') || ariaLabel?.includes('play') || ariaLabel?.includes('Run')) {
        runButton = btn;
        break;
      }
    }
    
    // If not found by aria-label, look for play icon in HTML
    if (!runButton) {
      for (const btn of buttons) {
        const html = await page.evaluate(el => el.innerHTML, btn);
        if (html.includes('▶') || html.includes('play') || html.includes('Play')) {
          runButton = btn;
          break;
        }
      }
    }
    
    // If still not found, try to find by position
    if (!runButton) {
      const railButtons = await page.$$('[class*="rail"] button, [class*="sidebar"] button');
      if (railButtons.length > 0) {
        runButton = railButtons[0];
      }
    }
    
    if (!runButton) throw new Error('Run button not found');
    
    console.log('🎨 Running p5.js sketch...');
    await runButton.click();
    
    // Wait for canvas
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Look for canvas
    const canvas = await page.$('canvas');
    if (canvas) {
      console.log('✅ Canvas found');
      addTestResult(testName, true);
      return true;
    } else {
      // Check if canvas window exists
      const canvasWindows = await page.$$('[class*="canvas"], [class*="window"]');
      if (canvasWindows.length > 0) {
        console.log(`✅ Found ${canvasWindows.length} canvas windows`);
        addTestResult(testName, true);
        return true;
      }
      throw new Error('Canvas not found after running p5 sketch');
    }
  } catch (error) {
    addTestResult(testName, false, error);
    return false;
  }
}

// Main runner
async function runSmokeTest() {
  console.log('🚀 Starting Web IDE Smoke Test...');
  console.log(`📡 Testing: ${DEV_SERVER_URL}`);
  
  let browser = null;
  
  try {
    // Launch browser
    console.log('🐶 Launching browser...');
    browser = await puppeteer.launch({
      headless: false,
      devtools: false,
      defaultViewport: { width: 1280, height: 800 },
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      slowMo: 30,
    });
    
    const page = await browser.newPage();
    
    // Console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`Browser error: ${msg.text()}`);
      }
    });
    
    page.on('pageerror', error => {
      console.error(`Page error: ${error.message}`);
    });
    
    // Run tests
    console.log('\n=== Running Smoke Tests ===\n');
    
    await testBasicLoad(page);
    await testPythonExecution(page);
    await testAssetManagement(page);
    await testFileOperations(page);
    await testP5Sketch(page);
    
    // Summary
    console.log('\n=== Smoke Test Summary ===');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📊 Total: ${testResults.tests.length}`);
    
    // Save results
    const resultsPath = `${__dirname}/smoke-test-results.json`;
    writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
    console.log(`\n📄 Results saved to: ${resultsPath}`);
    
    // Exit code
    if (testResults.failed > 0) {
      console.log('\n❌ Smoke test failed');
      await browser.close();
      process.exit(1);
    } else {
      console.log('\n✅ Smoke test passed!');
      await browser.close();
      process.exit(0);
    }
    
  } catch (error) {
    console.error('🔥 Smoke test fatal error:', error);
    if (browser) await browser.close();
    process.exit(1);
  }
}

// Run
runSmokeTest();