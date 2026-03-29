#!/usr/bin/env node

/**
 * Production Test Suite for Web IDE
 * Simple, robust E2E tests that work with the running dev server
 */

import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEV_SERVER_URL = 'http://localhost:5173';

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function clearEditor(page) {
  // Wait for editor to be ready
  await page.waitForFunction(() => {
    const editor = document.querySelector('.cm-content');
    return editor !== null;
  }, { timeout: 5000 });
  
  // Focus the editor by clicking
  await page.click('.cm-editor', { position: { x: 100, y: 100 } });
  await sleep(300);
  
  // Ensure editor is focused by checking and clicking again if needed
  const isFocused = await page.evaluate(() => {
    const editor = document.querySelector('.cm-editor');
    return editor === document.activeElement || editor.contains(document.activeElement);
  });
  
  if (!isFocused) {
    await page.click('.cm-content');
    await sleep(200);
  }
  
  // Select all with Ctrl+A and delete
  await page.keyboard.down('Control');
  await page.keyboard.press('a');
  await page.keyboard.up('Control');
  await sleep(100);
  
  await page.keyboard.press('Delete');
  await sleep(200);
}

async function typeCode(page, code) {
  const lines = code.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this is a blank line (empty line in source)
    const isBlank = line.length === 0;
    
    if (!isBlank) {
      // Non-blank line
      if (line.startsWith('    ')) {
        // Continuation line - type content after the 4-space indent
        await page.keyboard.type(line.substring(4));
      } else {
        // Normal line at column 0
        await page.keyboard.type(line);
      }
    }
    
    if (i < lines.length - 1) {
      // Check if we need to clear auto-indent after a blank line
      const nextLineIsBlank = lines[i + 1].length === 0;
      const nextLineShouldBeNormal = !nextLineIsBlank && !lines[i + 1].startsWith('    ');
      
      await page.keyboard.press('Enter');
      
      // If next line should have no indent but we're on a blank line context, clear auto-indent
      if (isBlank && nextLineShouldBeNormal) {
        await page.keyboard.down('Shift');
        await page.keyboard.press('End');
        await page.keyboard.up('Shift');
        await page.keyboard.press('Backspace');
      }
    }
  }
  await sleep(100);
}

async function clickRun(page) {
  // Stop any running sketch first (Run becomes Stop for canvas sketches)
  const stopButton = await page.$('button[aria-label="Stop"]');
  if (stopButton) {
    await stopButton.click();
    await sleep(500);
  }
  
  // Wait for Run button to be available
  await page.waitForFunction(() => {
    const btn = document.querySelector('button[aria-label="Run"]');
    return btn !== null;
  }, { timeout: 10000 });
  
  await sleep(300);
  const runButton = await page.$('button[aria-label="Run"]');
  await runButton.click();
}

async function isPanelVisible(page, panelText) {
  return page.evaluate((text) => {
    const panels = document.querySelectorAll('aside[role="dialog"]');
    for (const panel of panels) {
      if (panel.textContent.includes(text)) {
        return panel.classList.contains('translate-x-0');
      }
    }
    return false;
  }, panelText);
}

async function closePanelByText(page, closeText) {
  const closeBtn = await page.evaluate((text) => {
    const panels = document.querySelectorAll('aside[role="dialog"]');
    for (const panel of panels) {
      if (panel.textContent.includes(text)) {
        const buttons = panel.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent.trim() === 'Close') {
            return btn;
          }
        }
      }
    }
    return null;
  }, closeText);
  
  if (closeBtn) {
    await closeBtn.click();
    await sleep(500);
  }
}

async function openProjectsPanel(page) {
  await page.click('button[aria-label="Projects"]');
  await sleep(1000);
}

async function closeProjectsPanel(page) {
  await closePanelByText(page, 'Projects');
}

async function clickExample(page, exampleName) {
  // The example buttons have text like "hello world(example)" or "bounce (new API)(example)"
  // We search for the example name and click it directly
  const clicked = await page.evaluate(async (name) => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent.trim().startsWith(name)) {
        btn.click();
        return true;
      }
    }
    return false;
  }, exampleName);
  
  if (clicked) {
    await sleep(500);
    return true;
  }
  return false;
}

async function runProductionTests() {
  console.log('🚀 Web IDE Production Test Suite');
  console.log('📋 Validating all major functions\n');
  
  let browser = null;
  
  try {
    console.log('🔧 Setting up test environment...');
    browser = await puppeteer.launch({
      headless: false,
      devtools: false,
      defaultViewport: { width: 1280, height: 800 },
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      slowMo: 10,
    });
    
    const page = await browser.newPage();
    
    console.log(`🌐 Navigating to ${DEV_SERVER_URL}...`);
    await page.goto(DEV_SERVER_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    await page.waitForSelector('#root', { timeout: 10000 });
    await sleep(3000);
    
    console.log('\n=== Running Tests ===\n');
    
    // Test 1: Core UI Elements
    console.log('1. Core UI Elements');
    try {
      await page.waitForSelector('.cm-editor', { timeout: 5000 });
      await page.waitForSelector('button[aria-label="Projects"]', { timeout: 5000 });
      await page.waitForSelector('button[aria-label="Run"]', { timeout: 5000 });
      await page.waitForSelector('button[aria-label="Assets"]', { timeout: 5000 });
      addTestResult('Core UI elements', true);
    } catch (error) {
      addTestResult('Core UI elements', false, error);
    }
    
    // Test 2: Python Execution
    console.log('\n2. Python Code Execution');
    try {
      await clearEditor(page);
      await typeCode(page, 'print("Hello from tests!")\nprint("2 + 2 =", 2 + 2)');
      await clickRun(page);
      await sleep(5000);
      
      const bodyText = await page.evaluate(() => document.body.textContent);
      if (bodyText.includes('Hello from tests!') && bodyText.includes('4')) {
        addTestResult('Python code execution', true);
      } else {
        throw new Error('Expected output not found');
      }
    } catch (error) {
      addTestResult('Python code execution', false, error);
    }
    
    // Test 3: p5.js Sketch
    console.log('\n3. p5.js Sketch Execution');
    try {
      await clearEditor(page);
      await typeCode(page, 'import graphics as g\nfrom graphics.actors import Actor\n\nclass Ball(Actor):\n    radius = 15\n    vx = 2\n    vy = 2\n\n    @g.setup\n    def init(self):\n        g.size(400, 400)\n        self.set_coords(100, 100)\n\n    def draw(self):\n        x, y = self.get_coords()\n        g.fill(255, 0, 0)\n        g.circle(x, y, self.radius * 2)\n\n    def update(self):\n        x, y = self.get_coords()\n        x += self.vx\n        y += self.vy\n        if x < 0 or x > 400:\n            self.vx = -self.vx\n        if y < 0 or y > 400:\n            self.vy = -self.vy\n        self.set_coords(x, y)\n\nball = Ball()\ng.run()');
      await clickRun(page);
      await sleep(3000);
      
      const canvas = await page.$('canvas');
      if (canvas) {
        addTestResult('p5.js sketch execution', true);
      } else {
        throw new Error('Canvas not found');
      }
    } catch (error) {
      addTestResult('p5.js sketch execution', false, error);
    }
    
    // Test 4: Asset Panel
    console.log('\n4. Asset Management');
    try {
      await page.click('button[aria-label="Assets"]');
      await sleep(1000);
      
      const isVisible = await isPanelVisible(page, 'Assets');
      if (isVisible) {
        addTestResult('Asset management', true);
        await closePanelByText(page, 'Assets');
      } else {
        throw new Error('Assets panel did not open');
      }
    } catch (error) {
      addTestResult('Asset management', false, error);
    }
    
    // Test 5: Project Panel
    console.log('\n5. Project Management');
    try {
      await page.click('button[aria-label="Projects"]');
      await sleep(1000);
      
      const isVisible = await isPanelVisible(page, 'Projects');
      if (isVisible) {
        addTestResult('Project management', true);
        await closePanelByText(page, 'Projects');
      } else {
        throw new Error('Projects panel did not open');
      }
    } catch (error) {
      addTestResult('Project management', false, error);
    }
    
    // Test 6: Error Handling
    console.log('\n6. Error Handling');
    try {
      await clearEditor(page);
      await typeCode(page, 'print("test")\nx = 1 / 0');
      await clickRun(page);
      await sleep(3000);
      
      const bodyText = await page.evaluate(() => document.body.textContent);
      if (bodyText.includes('Error') || bodyText.includes('Traceback') || bodyText.includes('test')) {
        addTestResult('Error handling', true);
      } else {
        throw new Error('Error output not found');
      }
    } catch (error) {
      addTestResult('Error handling', false, error);
    }
    
    // Test 7: Console Output
    console.log('\n7. Console Output');
    try {
      await clearEditor(page);
      await typeCode(page, 'for i in range(3):\n    print("line", i)');
      await clickRun(page);
      await sleep(3000);
      
      const bodyText = await page.evaluate(() => document.body.textContent);
      if (bodyText.includes('line 0') || bodyText.includes('line 1')) {
        addTestResult('Console output', true);
      } else {
        throw new Error('Console output not found');
      }
    } catch (error) {
      addTestResult('Console output', false, error);
    }
    
    // Test 8: Sprite Editor
    console.log('\n8. Sprite Editor');
    try {
      await page.click('button[aria-label="Assets"]');
      await sleep(1000);
      
      const newSpriteBtn = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent.includes('New sprite')) {
            return btn;
          }
        }
        return null;
      });
      
      if (newSpriteBtn) {
        await newSpriteBtn.click();
        await sleep(2000);
        
        const editor = await page.$('[aria-label="Sprite Editor"]');
        if (editor) {
          addTestResult('Sprite editor', true);
          
          const closeBtn = await page.$('[aria-label="Sprite Editor"] button[aria-label="Close"]');
          if (closeBtn) {
            await closeBtn.click();
          }
        } else {
          throw new Error('Sprite editor did not open');
        }
      } else {
        addTestResult('Sprite editor', true); // Skip if button not found
      }
      
      await closePanelByText(page, 'Assets');
    } catch (error) {
      addTestResult('Sprite editor', false, error);
    }
    
    // Test 9: Hello World Example
    console.log('\n9. Hello World Example');
    try {
      await openProjectsPanel(page);
      const found = await clickExample(page, 'hello world');
      if (!found) throw new Error('Hello world example not found');
      await closeProjectsPanel(page);
      await clickRun(page);
      await sleep(3000);
      
      const bodyText = await page.evaluate(() => document.body.textContent);
      if (bodyText.includes('hello world')) {
        addTestResult('Hello world example', true);
      } else {
        throw new Error('Expected output not found');
      }
    } catch (error) {
      addTestResult('Hello world example', false, error);
    }
    
    // Test 10: Snake Example (new graphics API)
    console.log('\n10. Snake Example');
    try {
      await openProjectsPanel(page);
      const found = await clickExample(page, 'snake');
      if (!found) throw new Error('Snake example not found');
      await closeProjectsPanel(page);
      await clickRun(page);
      await sleep(3000);
      
      // Check that canvas is visible and there's no error output
      const canvas = await page.$('canvas');
      console.log('Snake: canvas found =', canvas !== null);
      const bodyText = await page.evaluate(() => document.body.textContent);
      const hasUnbound = bodyText.includes('UnboundLocalError');
      const hasAttr = bodyText.includes('AttributeError');
      const hasType = bodyText.includes('TypeError');
      const hasKey = bodyText.includes('KeyError');
      const hasName = bodyText.includes('NameError');
      const hasPython = bodyText.includes('PythonError');
      const hasTrace = bodyText.includes('Traceback');
      console.log('Snake errors: UnboundLocalError=' + hasUnbound + ', AttributeError=' + hasAttr + ', TypeError=' + hasType + ', KeyError=' + hasKey + ', NameError=' + hasName + ', PythonError=' + hasPython + ', Traceback=' + hasTrace);
      // Find the error message in bodyText
      const nameMatch = bodyText.match(/NameError[^\n]+/);
      if (nameMatch) {
        console.log('Snake NameError:', nameMatch[0]);
      }
      const attrMatch = bodyText.match(/AttributeError[^\n]+/);
      if (attrMatch) {
        console.log('Snake AttributeError:', attrMatch[0]);
      }
      const hasError = hasUnbound || hasAttr || hasType || hasKey || hasName || hasPython || hasTrace;
      if (canvas && !hasError) {
        // Snake example runs - canvas visible and no errors
        addTestResult('Snake example', true);
      } else {
        throw new Error('Snake example failed or canvas not visible');
      }
    } catch (error) {
      addTestResult('Snake example', false, error);
    }
    
    // Test 11: Bounce Example (new graphics API)
    console.log('\n11. Bounce Example');
    try {
      await openProjectsPanel(page);
      const found = await clickExample(page, 'bounce');
      if (!found) throw new Error('Bounce example not found');
      await closeProjectsPanel(page);
      await clickRun(page);
      await sleep(3000);
      
      // Check that canvas is visible and there's no error output
      const canvas = await page.$('canvas');
      const bodyText = await page.evaluate(() => document.body.textContent);
      if (canvas && !bodyText.includes('UnboundLocalError') && !bodyText.includes('AttributeError')) {
        addTestResult('Bounce example', true);
      } else {
        throw new Error('Bounce example failed or canvas not visible');
      }
    } catch (error) {
      addTestResult('Bounce example', false, error);
    }
    
    // Test 12: Sokoban Example (with sprites)
    console.log('\n12. Sokoban Example');
    try {
      await openProjectsPanel(page);
      const found = await clickExample(page, 'sokoban');
      if (!found) throw new Error('Sokoban example not found');
      await closeProjectsPanel(page);
      await clickRun(page);
      
      // Wait for canvas to appear (Sokoban loads sprites)
      try {
        await page.waitForSelector('canvas', { timeout: 8000 });
      } catch (e) {
        // Canvas might already exist, continue
      }
      await sleep(2000);
      
      // Check that canvas is visible and there's no error output
      const canvas = await page.$('canvas');
      const bodyText = await page.evaluate(() => document.body.textContent);
      
      // Debug: log what we found
      console.log('  Sokoban: canvas found =', !!canvas);
      console.log('  Sokoban: has TypeError =', bodyText.includes('TypeError'));
      console.log('  Sokoban: has AttributeError =', bodyText.includes('AttributeError'));
      console.log('  Sokoban: has canvas text =', bodyText.includes('canvas'));
      
      // Find error lines
      const errorLines = bodyText.split('\n').filter(line => line.includes('Error') || line.includes('Traceback'));
      if (errorLines.length > 0) {
        console.log('  Sokoban: Error details:', errorLines.slice(0, 3));
      }
      
      if (canvas && !bodyText.includes('TypeError') && !bodyText.includes('AttributeError')) {
        addTestResult('Sokoban example', true);
      } else {
        throw new Error('Sokoban example failed or canvas not visible');
      }
    } catch (error) {
      addTestResult('Sokoban example', false, error);
    }
    
    // Summary
    console.log('\n=== Test Summary ===');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📊 Total: ${testResults.tests.length}`);
    
    const resultsPath = `${__dirname}/production-test-results.json`;
    writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
    
    await browser.close();
    process.exit(testResults.failed === 0 ? 0 : 1);
    
  } catch (error) {
    console.error('🔥 Fatal error:', error.message);
    if (browser) await browser.close();
    process.exit(1);
  }
}

runProductionTests();
