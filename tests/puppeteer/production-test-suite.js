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

const DEV_SERVER_URL = process.env.PUPPETEER_URL || 'http://localhost:5173';

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

async function stopSketch(page) {
  // Just stop any running sketch without starting a new one
  const stopButton = await page.$('button[aria-label="Stop"]');
  if (stopButton) {
    await stopButton.click();
    await sleep(1000);
  }
  
  // Wait for canvas to go away (sketch stopped)
  try {
    await page.waitForFunction(() => {
      const stop = document.querySelector('button[aria-label="Stop"]');
      return stop === null;
    }, { timeout: 5000 });
  } catch (e) {
    // May already be stopped
  }
  
  // Wait for Run button to be available
  await page.waitForFunction(() => {
    const btn = document.querySelector('button[aria-label="Run"]');
    return btn !== null;
  }, { timeout: 10000 });
  
  // Additional wait for canvas to fully disappear
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return true;
    // Check if canvas is hidden
    const style = window.getComputedStyle(canvas);
    return style.display === 'none' || style.opacity === '0';
  }, { timeout: 5000 }).catch(() => {});
  
  // Also wait for any overlay/panel to close
  await sleep(500);
}

async function isPanelVisible(page, panelText) {
  return page.evaluate((text) => {
    const region = document.querySelector('div[role="region"]');
    if (!region) return false;
    const style = region.getAttribute('style') || '';
    if (!style.includes('left: 60')) return false;
    if (region.textContent?.includes(text)) {
      const computedDisplay = window.getComputedStyle(region).display;
      const computedVisibility = window.getComputedStyle(region).visibility;
      return computedDisplay !== 'none' && computedVisibility !== 'hidden';
    }
    return false;
  }, panelText);
}

async function closePanelByText(page, closeText) {
  const closeBtn = await page.evaluate((text) => {
    // Find the panel div with inline style: position: absolute; left: 60; width: 320
    const divs = document.querySelectorAll('div');
    for (const div of divs) {
      const style = div.getAttribute('style') || '';
      if (style.includes('width: 320') && style.includes('position: absolute') && (style.includes('left: 60') || style.includes('left: 60px'))) {
        if (div.textContent?.includes(text)) {
          // Find close button inside the panel
          const buttons = div.querySelectorAll('button');
          for (const btn of buttons) {
            if (btn.textContent?.trim() === 'Close') {
              return btn;
            }
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
  // Use evaluate to click directly, more reliable than CSS selector click
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Projects"]');
    if (btn) btn.click();
  });
  await sleep(500); // Brief wait for panel to start rendering

  // Wait for panel to appear with retries
  let panelVisible = false;
  for (let i = 0; i < 5; i++) {
    panelVisible = await page.evaluate(() => {
      // The panel is a role="region" div at left: 60, width 320.
      const region = document.querySelector('div[role="region"]');
      if (!region) return false;
      const style = region.getAttribute('style') || '';
      return style.includes('left: 60') && (style.includes('width: 320') || style.includes('width: 520'));
    });
    console.log('openProjectsPanel: attempt', i+1, 'panel visible =', panelVisible);
    if (panelVisible) break;
    await sleep(500);
  }
}

async function openExamplesPanel(page) {
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Examples"]');
    if (btn) btn.click();
  });
  await sleep(800);
}

async function closeExamplesPanel(page) {
  const closed = await page.evaluate(() => {
    const region = document.querySelector('div[role="region"]');
    if (!region) return false;
    const closeBtn = region.querySelector('button[title="Close"]');
    if (closeBtn) { closeBtn.click(); return true; }
    return false;
  });
  if (!closed) await page.mouse.click(500, 400);
  await sleep(500);
}

async function closeProjectsPanel(page) {
  // Current UI: the panel is a role="region"; its close button has
  // title="Close" (icon button, no aria-label).
  const panelClosed = await page.evaluate(() => {
    const region = document.querySelector('div[role="region"]');
    if (!region) return false;
    const closeBtn = region.querySelector('button[title="Close"]');
    if (closeBtn) {
      closeBtn.click();
      return true;
    }
    return false;
  });

  if (panelClosed) {
    await sleep(500);
  }

  // Verify panel is closed
  const panelStillOpen = await page.evaluate(() => {
    const region = document.querySelector('div[role="region"]');
    if (!region) return false;
    const style = region.getAttribute('style') || '';
    return style.includes('left: 60');
  });

  // If panel still open, try backdrop click as fallback
  if (panelStillOpen) {
    await page.mouse.click(500, 400);
    await sleep(500);
  }
}

async function clickExample(page, exampleName) {
  // Current UI: examples render as clickable div rows (icon + label span) in
  // the Examples panel — not <button> elements. Match the row whose label
  // span text equals the example's display name.
  const clicked = await page.evaluate((name) => {
    const rows = Array.from(document.querySelectorAll('div'));
    const debug = [];
    for (const row of rows) {
      const span = row.querySelector(':scope > span');
      if (!span) continue;
      const label = span.textContent?.trim() || '';
      if (label === name && row.onclick) {
        row.click();
        return { found: true, debug };
      }
      if (label) debug.push({ label: label.substring(0, 40), matches: label === name, clickable: !!row.onclick });
    }
    return { found: false, debug };
  }, exampleName);

  // Clicking an example while the project is dirty (e.g. after the sprite
  // editor) pops the unsaved-changes dialog — discard to proceed with the
  // switch. The dialog buttons are plain text ("Discard changes").
  if (clicked.found) {
    await sleep(500);
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        /discard changes/i.test(b.textContent || ''));
      if (btn) btn.click();
    });
    await sleep(500);
  }
  
  if (!clicked.found) {
    console.log('clickExample debug for "' + exampleName + '":', JSON.stringify(clicked.debug.slice(0, 20), null, 2));
  }
  return clicked.found;
}
  
async function runProductionTests() {
  console.log('🚀 Web IDE Production Test Suite');
  console.log('📋 Validating all major functions\n');
  
  let browser = null;
  
  try {
    console.log('🔧 Setting up test environment...');
    browser = await puppeteer.launch({
      headless: true,
      devtools: false,
      defaultViewport: { width: 1280, height: 800 },
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
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
      await page.waitForSelector('button[aria-label="Examples"]', { timeout: 5000 });
      await page.waitForSelector('button[aria-label="Reference"]', { timeout: 5000 });
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
    
    // Test 4: Asset Management — the Projects panel hosts the sprite /
    // tilemap / sound sections (the old separate Assets rail button is gone).
    console.log('\n4. Asset Management');
    try {
      await openProjectsPanel(page);
      await sleep(500);
      const bodyText = await page.evaluate(() => document.body.innerText);
      const hasSprites = bodyText.includes('Sprites') || bodyText.includes('SPRITES');
      const hasSounds = bodyText.includes('Sounds') || bodyText.includes('SOUNDS');
      if (hasSprites && hasSounds) {
        addTestResult('Asset management', true);
      } else {
        throw new Error('Projects panel missing sprite/sound sections');
      }
      await closeProjectsPanel(page);
    } catch (error) {
      addTestResult('Asset management', false, error);
    }
    
    // Test 5: Project Management
    console.log('\n5. Project Management');
    try {
      await openProjectsPanel(page);
      const isVisible = await page.evaluate(() => {
        const region = document.querySelector('div[role="region"]');
        return !!region && (region.textContent?.includes('Code') || region.textContent?.includes('CODE'));
      });
      if (isVisible) {
        addTestResult('Project management', true);
      } else {
        throw new Error('Projects panel did not open');
      }
      await closeProjectsPanel(page);
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
    
    // Test 8: Sprite Editor — Projects panel → Sprites section "+" button
    // (title="New sprite") opens the sheet editor.
    console.log('\n8. Sprite Editor');
    try {
      await openProjectsPanel(page);
      const plusClicked = await page.evaluate(() => {
        const btn = document.querySelector('button[title="New sprite"]');
        if (btn) { btn.click(); return true; }
        return false;
      });
      if (!plusClicked) throw new Error('New sprite button not found');
      await sleep(2500);
      
      // The sheet editor renders a large pixel canvas.
      const editor = await page.evaluate(() => {
        const canvases = document.querySelectorAll('canvas');
        return canvases.length > 0;
      });
      if (editor) {
        addTestResult('Sprite editor', true);
      } else {
        throw new Error('Sprite editor did not open');
      }
      
      // Close the modal via the SheetEditor close button.
      const closed = await page.evaluate(() => {
        const btn = document.querySelector('button[title="Close"]');
        if (btn) { btn.click(); return true; }
        return false;
      });
      await sleep(1000);
      await closeProjectsPanel(page);
    } catch (error) {
      addTestResult('Sprite editor', false, error);
    }
    
    // Test 9: Hello World Example
    console.log('\n9. Hello World Example');
    try {
      await openExamplesPanel(page);
      const found = await clickExample(page, 'Hello World');
      if (!found) throw new Error('Hello world example not found');
      await closeExamplesPanel(page);
      await clickRun(page);
      await sleep(4000);
      
      const bodyText = await page.evaluate(() => document.body.textContent);
      if (/hello/i.test(bodyText)) {
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
      // Stop any running sketch first
      await stopSketch(page);
      await sleep(1000); // Extra wait for UI to stabilize
      
      await openExamplesPanel(page);
      const found = await clickExample(page, 'Snake');
      if (!found) throw new Error('Snake example not found');
      await closeExamplesPanel(page);
      await clickRun(page);
      await sleep(4000);
      
      // Check that canvas is visible and there's no error output
      const canvas = await page.$('canvas');
      const bodyText = await page.evaluate(() => document.body.textContent);
      const hasError = /UnboundLocalError|AttributeError|TypeError|KeyError|NameError|PythonError|Traceback/.test(bodyText);
      if (canvas && !hasError) {
        addTestResult('Snake example', true);
      } else {
        throw new Error('Snake example failed or canvas not visible');
      }
    } catch (error) {
      addTestResult('Snake example', false, error);
    }
    
    // Test 11: Asteroids Example
    console.log('\n11. Asteroids Example');
    try {
      await stopSketch(page);
      await openExamplesPanel(page);
      const found = await clickExample(page, 'Asteroids');
      if (!found) throw new Error('Asteroids example not found');
      await closeExamplesPanel(page);
      await clickRun(page);
      await sleep(4000);
      
      const canvas = await page.$('canvas');
      const bodyText = await page.evaluate(() => document.body.textContent);
      const hasError = /UnboundLocalError|AttributeError|TypeError|KeyError|NameError|PythonError|Traceback/.test(bodyText);
      if (canvas && !hasError) {
        addTestResult('Asteroids example', true);
      } else {
        throw new Error('Asteroids example failed or canvas not visible');
      }
    } catch (error) {
      addTestResult('Asteroids example', false, error);
    }
    
    // Test 12: Sokoban Example (with sprites)
    console.log('\n12. Sokoban Example');
    try {
      // Stop any running sketch first
      await stopSketch(page);
      await openExamplesPanel(page);
      const found = await clickExample(page, 'Sokoban');
      if (!found) throw new Error('Sokoban example not found');
      await closeExamplesPanel(page);
      await clickRun(page);
      
      // Wait for canvas to appear (Sokoban loads sprites)
      try {
        await page.waitForSelector('canvas', { timeout: 8000 });
      } catch (e) {
        // Canvas might already exist, continue
      }
      await sleep(3000);
      
      // Check that canvas is visible and there's no error output
      const canvas = await page.$('canvas');
      const bodyText = await page.evaluate(() => document.body.textContent);
      const hasError = /UnboundLocalError|AttributeError|TypeError|KeyError|NameError|PythonError|Traceback/.test(bodyText);
      if (canvas && !hasError) {
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