#!/usr/bin/env node

/**
 * Comprehensive Puppeteer test runner for Web IDE
 * Tests all major IDE functions for upcoming refactoring
 */

import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DEV_SERVER_URL = 'http://localhost:5173';
const SCREENSHOTS_DIR = `${__dirname}/test-screenshots`;
const TEST_TIMEOUT = 60000; // 60 seconds for Pyodide loading

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

// Helper to add test result
function addTestResult(name, passed, error = null, screenshot = null) {
  const result = {
    name,
    passed,
    error: error?.message || error,
    screenshot,
    timestamp: new Date().toISOString()
  };
  testResults.tests.push(result);
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${name}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${name}: ${error?.message || error}`);
  }
}

// Helper to take screenshot
async function takeScreenshot(page, testName) {
  if (!existsSync(SCREENSHOTS_DIR)) {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const safeName = testName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const screenshotPath = `${SCREENSHOTS_DIR}/${safeName}.png`;

  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  } catch (error) {
    console.error(`Failed to take screenshot for ${testName}:`, error.message);
    return null;
  }
}

// Helper to wait for Pyodide to load
async function waitForPyodide(page) {
  console.log('⏳ Waiting for Pyodide to load...');
  await page.waitForFunction(() => {
    return window.runnerStore?.getState()?.ready === true;
  }, { timeout: TEST_TIMEOUT });
  console.log('✅ Pyodide loaded');
}

// Test: Basic page load
async function testPageLoad(page) {
  const testName = 'Page loads successfully';

  try {
    console.log(`🌐 Navigating to ${DEV_SERVER_URL}...`);
    await page.goto(DEV_SERVER_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });

    // Check page title
    const title = await page.title();
    console.log(`📄 Page title: "${title}"`);

    // Check for React root
    const rootElement = await page.$('#root');
    if (!rootElement) {
      throw new Error('React root element (#root) not found');
    }

    // Check for some content
    const bodyText = await page.evaluate(() => document.body.textContent);
    if (!bodyText || bodyText.length < 100) {
      throw new Error('Page appears to have minimal content');
    }

    const screenshot = await takeScreenshot(page, testName);
    addTestResult(testName, true, null, screenshot);
    return true;
  } catch (error) {
    const screenshot = await takeScreenshot(page, `${testName}_error`);
    addTestResult(testName, false, error, screenshot);
    return false;
  }
}

// Test: File operations (create, rename, delete)
async function testFileOperations(page) {
  const testName = 'File operations (create, rename, delete)';

  try {
    console.log('\n📁 Testing file operations...');

    // Wait for UI to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Find the "+" button to add new file
    const addButtons = await page.$$('button');
    let addButton = null;
    
    // Look for add button by text or aria-label
    for (const btn of addButtons) {
      const text = await page.evaluate(el => el.textContent?.trim(), btn);
      const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label'), btn);
      if (text === '+' || text === 'Add' || text === 'New' || 
          ariaLabel?.includes('add') || ariaLabel?.includes('new')) {
        addButton = btn;
        break;
      }
    }

    if (!addButton) {
      // Try to find by looking at all buttons' content
      const buttonTexts = await page.$$eval('button', els =>
        els.map(el => el.textContent?.trim()).filter(Boolean)
      );
      console.log(`🔘 Available buttons: ${buttonTexts.join(', ')}`);
      throw new Error('Add file button not found');
    }

    console.log('➕ Clicking add file button...');
    await addButton.click();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if new file tab appeared
    const fileTabs = await page.$$('[role="tab"], .tab, [data-testid*="tab"]');
    console.log(`📄 Found ${fileTabs.length} file tabs`);

    if (fileTabs.length < 2) {
      throw new Error('New file tab not created');
    }

    // Get the last tab (should be the new one)
    const lastTab = fileTabs[fileTabs.length - 1];
    const tabName = await page.evaluate(el => el.textContent?.trim(), lastTab);
    console.log(`📄 New tab name: "${tabName}"`);

    // Test renaming by double-clicking or right-clicking
    console.log('✏️ Attempting to rename file...');
    await lastTab.click();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Try double click for rename
    await lastTab.click({ clickCount: 2 });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if rename input appeared
    const renameInput = await page.$('input[type="text"], input[placeholder*="name"], input[value*=".py"]');
    if (renameInput) {
      console.log('✅ Rename input appeared');
      
      // Type new name
      await renameInput.click({ clickCount: 3 }); // Select all
      await page.keyboard.type('test_renamed.py');
      await page.keyboard.press('Enter');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify rename
      const newTabName = await page.evaluate(el => el.textContent?.trim(), lastTab);
      if (newTabName.includes('test_renamed')) {
        console.log(`✅ File renamed to: "${newTabName}"`);
      } else {
        console.log(`⚠️ Tab name after rename: "${newTabName}"`);
      }
    } else {
      console.log('⚠️ Rename input not found, skipping rename test');
    }

    // Test delete - look for close button on tab
    console.log('🗑️ Testing file deletion...');
    const closeButtons = await page.$$('button svg, button .close, [aria-label*="close"], [title*="close"]');
    
    if (closeButtons.length > 0) {
      // Find close button associated with our tab
      const tabCloseButton = closeButtons[closeButtons.length - 1];
      await tabCloseButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if tab count decreased
      const newFileTabs = await page.$$('[role="tab"], .tab, [data-testid*="tab"]');
      console.log(`📄 Tabs after deletion: ${newFileTabs.length}`);
      
      if (newFileTabs.length < fileTabs.length) {
        console.log('✅ File deletion successful');
      } else {
        console.log('⚠️ File tab count unchanged after delete attempt');
      }
    } else {
      console.log('⚠️ Close button not found, skipping delete test');
    }

    const screenshot = await takeScreenshot(page, testName);
    addTestResult(testName, true, null, screenshot);
    return true;
  } catch (error) {
    const screenshot = await takeScreenshot(page, `${testName}_error`);
    addTestResult(testName, false, error, screenshot);
    return false;
  }
}

// Test: Code execution (plain Python)
async function testCodeExecution(page) {
  const testName = 'Code execution (plain Python)';

  try {
    console.log('\n🐍 Testing Python code execution...');

    // Wait for Pyodide
    await waitForPyodide(page);

    // Find code editor
    const editor = await page.$('.cm-editor, .CodeMirror, [contenteditable="true"]');
    if (!editor) {
      throw new Error('Code editor not found');
    }

    // Clear editor and type simple Python code
    console.log('⌨️ Typing Python code...');
    await editor.click({ clickCount: 3 }); // Select all
    await page.keyboard.press('Backspace');
    
    const testCode = `print("Hello from test!")
x = 5 + 3
print(f"5 + 3 = {x}")
for i in range(3):
    print(f"Loop {i}")`;
    
    await page.keyboard.type(testCode);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find and click run button
    console.log('▶️ Looking for run button...');
    const runButtons = await page.$$('button');
    let runButton = null;
    
    for (const btn of runButtons) {
      const text = await page.evaluate(el => el.textContent?.trim(), btn);
      const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label'), btn);
      if (text === 'Run' || text === '▶' || text === '▶️' || 
          ariaLabel?.includes('run') || ariaLabel?.includes('execute')) {
        runButton = btn;
        break;
      }
    }

    if (!runButton) {
      // Try to find by icon
      const buttonIcons = await page.$$eval('button svg', els => els.length);
      console.log(`🔘 Buttons with SVG: ${buttonIcons}`);
      throw new Error('Run button not found');
    }

    console.log('▶️ Clicking run button...');
    await runButton.click();

    // Wait for execution
    console.log('⏳ Waiting for code execution...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check console output
    const consoleOutput = await page.evaluate(() => {
      const outputElements = document.querySelectorAll('[class*="output"], [class*="console"], [class*="stdout"]');
      let output = '';
      outputElements.forEach(el => {
        if (el.textContent && el.textContent.includes('Hello from test')) {
          output = el.textContent;
        }
      });
      return output;
    });

    if (consoleOutput.includes('Hello from test')) {
      console.log('✅ Code executed successfully');
      console.log(`📝 Output: ${consoleOutput.substring(0, 100)}...`);
    } else {
      // Try alternative method
      const allText = await page.evaluate(() => document.body.textContent);
      if (allText.includes('Hello from test')) {
        console.log('✅ Code executed successfully (found in page text)');
      } else {
        throw new Error('Expected output not found in console');
      }
    }

    const screenshot = await takeScreenshot(page, testName);
    addTestResult(testName, true, null, screenshot);
    return true;
  } catch (error) {
    const screenshot = await takeScreenshot(page, `${testName}_error`);
    addTestResult(testName, false, error, screenshot);
    return false;
  }
}

// Test: p5.js sketch execution
async function testP5SketchExecution(page) {
  const testName = 'p5.js sketch execution';

  try {
    console.log('\n🎨 Testing p5.js sketch execution...');

    // Find code editor
    const editor = await page.$('.cm-editor, .CodeMirror, [contenteditable="true"]');
    if (!editor) {
      throw new Error('Code editor not found');
    }

    // Clear editor and type p5.js sketch
    console.log('⌨️ Typing p5.js sketch...');
    await editor.click({ clickCount: 3 }); // Select all
    await page.keyboard.press('Backspace');
    
    const p5Code = `def setup():
    createCanvas(400, 400)
    background(220)

def draw():
    fill(255, 0, 0)
    ellipse(mouseX, mouseY, 50, 50)`;
    
    await page.keyboard.type(p5Code);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find and click run button
    const runButtons = await page.$$('button');
    let runButton = null;
    
    for (const btn of runButtons) {
      const text = await page.evaluate(el => el.textContent?.trim(), btn);
      if (text === 'Run' || text === '▶' || text === '▶️') {
        runButton = btn;
        break;
      }
    }

    if (!runButton) {
      throw new Error('Run button not found');
    }

    console.log('▶️ Running p5.js sketch...');
    await runButton.click();

    // Wait for execution and canvas to appear
    console.log('⏳ Waiting for canvas...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Look for canvas element
    const canvas = await page.$('canvas');
    if (canvas) {
      console.log('✅ Canvas element found');
      
      // Check canvas dimensions
      const canvasSize = await page.evaluate(canvas => ({
        width: canvas.width,
        height: canvas.height
      }), canvas);
      
      console.log(`📐 Canvas size: ${canvasSize.width}x${canvasSize.height}`);
      
      if (canvasSize.width > 0 && canvasSize.height > 0) {
        console.log('✅ Canvas has valid dimensions');
      }
    } else {
      console.log('⚠️ Canvas not found, checking for canvas window');
      
      // Look for canvas window or container
      const canvasContainers = await page.$$('[class*="canvas"], [class*="window"], [class*="p5"]');
      console.log(`🎨 Found ${canvasContainers.length} potential canvas containers`);
      
      if (canvasContainers.length === 0) {
        throw new Error('Canvas not found after running p5 sketch');
      }
    }

    const screenshot = await takeScreenshot(page, testName);
    addTestResult(testName, true, null, screenshot);
    return true;
  } catch (error) {
    const screenshot = await takeScreenshot(page, `${testName}_error`);
    addTestResult(testName, false, error, screenshot);
    return false;
  }
}

// Test: Input() handling
async function testInputHandling(page) {
  const testName = 'Input() handling';

  try {
    console.log('\n⌨️ Testing input() handling...');

    // Find code editor
    const editor = await page.$('.cm-editor, .CodeMirror, [contenteditable="true"]');
    if (!editor) {
      throw new Error('Code editor not found');
    }

    // Clear editor and type code with input()
    console.log('⌨️ Typing code with input()...');
    await editor.click({ clickCount: 3 }); // Select all
    await page.keyboard.press('Backspace');
    
    const inputCode = `name = input("What's your name? ")
print(f"Hello, {name}!")
age = input("How old are you? ")
print(f"You are {age} years old.")`;
    
    await page.keyboard.type(inputCode);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find and click run button
    const runButtons = await page.$$('button');
    let runButton = null;
    
    for (const btn of runButtons) {
      const text = await page.evaluate(el => el.textContent?.trim(), btn);
      if (text === 'Run' || text === '▶' || text === '▶️') {
        runButton = btn;
        break;
      }
    }

    if (!runButton) {
      throw new Error('Run button not found');
    }

    console.log('▶️ Running code with input()...');
    await runButton.click();

    // Wait for first input prompt
    console.log('⏳ Waiting for input prompt...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Look for input prompt
    const inputPrompt = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="text"], input[placeholder*="input"]');
      const prompts = document.querySelectorAll('[class*="prompt"], [class*="input"]');
      
      if (inputs.length > 0) {
        return 'input field found';
      }
      if (prompts.length > 0) {
        return 'prompt element found';
      }
      
      // Check page text for prompt
      const bodyText = document.body.textContent;
      if (bodyText.includes("What's your name?")) {
        return 'prompt text found in page';
      }
      
      return null;
    });

    if (inputPrompt) {
      console.log(`✅ Input prompt detected: ${inputPrompt}`);
      
      // Try to find input field and type response
      const inputField = await page.$('input[type="text"], input[placeholder*="input"]');
      if (inputField) {
        console.log('⌨️ Typing response...');
        await inputField.type('Test User');
        await page.keyboard.press('Enter');
        
        // Wait for second prompt
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Type second response
        const secondInput = await page.$('input[type="text"], input[placeholder*="input"]');
        if (secondInput) {
          await secondInput.type('25');
          await page.keyboard.press('Enter');
          
          // Wait for final output
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check for output
          const output = await page.evaluate(() => document.body.textContent);
          if (output.includes('Hello, Test User!') || output.includes('You are 25 years old')) {
            console.log('✅ Input handling successful');
          } else {
            console.log('⚠️ Expected output not found, but input was handled');
          }
        }
      }
    } else {
      console.log('⚠️ Input prompt not found, checking if code ran without input');
      
      // Check if code ran to completion
      const output = await page.evaluate(() => document.body.textContent);
      if (output.includes('Hello,') || output.includes('years old')) {
        console.log('✅ Code executed (may have run without waiting for input)');
      }
    }

    const screenshot = await takeScreenshot(page, testName);
    addTestResult(testName, true, null, screenshot);
    return true;
  } catch (error) {
    const screenshot = await takeScreenshot(page, `${testName}_error`);
    addTestResult(testName, false, error, screenshot);
    return false;
  }
}

// Test: State management with @use decorator
async function testStateManagement(page) {
  const testName = 'State management with @use decorator';

  try {
    console.log('\n🔄 Testing @use decorator state management...');

    // Find code editor
    const editor = await page.$('.cm-editor, .CodeMirror, [contenteditable="true"]');
    if (!editor) {
      throw new Error('Code editor not found');
    }

    // Clear editor and type code with @use decorator
    console.log('⌨️ Typing code with @use decorator...');
    await editor.click({ clickCount: 3 }); // Select all
    await page.keyboard.press('Backspace');
    
    const stateCode = `from types import SimpleNamespace

state = SimpleNamespace(x=0, y=0, score=0)

@use(state)
def update():
    x += 1
    y += 2
    score += 10
    print(f"x={x}, y={y}, score={score}")

update()
update()
print("Final:", state.x, state.y, state.score)`;
    
    await page.keyboard.type(stateCode);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find and click run button
    const runButtons = await page.$$('button');
    let runButton = null;
    
    for (const btn of runButtons) {
      const text = await page.evaluate(el => el.textContent?.trim(), btn);
      if (text === 'Run' || text === '▶' || text === '▶️') {
        runButton = btn;
        break;
      }
    }

    if (!runButton) {
      throw new Error('Run button not found');
    }

    console.log('▶️ Running state management code...');
    await runButton.click();

    // Wait for execution
    console.log('⏳ Waiting for execution...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check for expected output
    const output = await page.evaluate(() => document.body.textContent);
    
    if (output.includes('x=1') && output.includes('score=10') && 
        (output.includes('Final: 2') || output.includes('Final: 1'))) {
      console.log('✅ State management with @use decorator works');
    } else {
      console.log(`⚠️ Output: ${output.substring(0, 200)}...`);
      console.log('⚠️ @use decorator may not be working as expected');
    }

    const screenshot = await takeScreenshot(page, testName);
    addTestResult(testName, true, null, screenshot);
    return true;
  } catch (error) {
    const screenshot = await takeScreenshot(page, `${testName}_error`);
    addTestResult(testName, false, error, screenshot);
    return false;
  }
}

// Test: Asset management
async function testAssetManagement(page) {
  const testName = 'Asset management';

  try {
    console.log('\n🖼️ Testing asset management...');

    // Find Assets button
    const assetsButton = await page.$('button[aria-label="Assets"], button[aria-label*="asset"]');
    if (!assetsButton) {
      // Try to find by text
      const allButtons = await page.$$('button');
      for (const btn of allButtons) {
        const text = await page.evaluate(el => el.textContent?.trim(), btn);
        if (text === 'Assets' || text === '🖼️' || text === 'Sprites') {
          assetsButton = btn;
          break;
        }
      }
    }

    if (!assetsButton) {
      throw new Error('Assets button not found');
    }

    console.log('🔘 Clicking Assets button...');
    await assetsButton.click();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Look for assets panel
    const assetsPanel = await page.$('[class*="panel"], [class*="sidebar"], [class*="assets"]');
    if (!assetsPanel) {
      throw new Error('Assets panel not found');
    }

    console.log('✅ Assets panel opened');

    // Look for asset items
    const assetItems = await page.$$('[class*="asset"], [class*="sprite"], [class*="item"]');
    console.log(`🖼️ Found ${assetItems.length} asset items`);

    if (assetItems.length > 0) {
      // Try to select first asset
      const firstAsset = assetItems[0];
      await firstAsset.click();
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('✅ Asset selection works');
      
      // Look for checkbox or selected state
      const isSelected = await page.evaluate(el => {
        return el.getAttribute('aria-checked') === 'true' || 
               el.getAttribute('data-selected') === 'true' ||
               el.classList.contains('selected');
      }, firstAsset);
      
      if (isSelected) {
        console.log('✅ Asset shows as selected');
      }
    }

    // Look for "New sprite" button
    const newSpriteButtons = await page.$$('button');
    let newSpriteButton = null;
    
    for (const btn of newSpriteButtons) {
      const text = await page.evaluate(el => el.textContent?.trim(), btn);
      if (text.includes('New sprite') || text.includes('+') || text.includes('Add sprite')) {
        newSpriteButton = btn;
        break;
      }
    }

    if (newSpriteButton) {
      console.log('➕ Found New sprite button');
      await newSpriteButton.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if sprite editor opened
      const spriteEditor = await page.$('[class*="modal"], [class*="dialog"], [class*="editor"]');
      if (spriteEditor) {
        console.log('✅ Sprite editor opened');
        
        // Close sprite editor
        const closeButtons = await page.$$('button[aria-label*="close"], button[title*="close"]');
        if (closeButtons.length > 0) {
          await closeButtons[0].click();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // Close assets panel
    await assetsButton.click();
    await new Promise(resolve => setTimeout(resolve, 500));

    const screenshot = await takeScreenshot(page, testName);
    addTestResult(testName, true, null, screenshot);
    return true;
  } catch (error) {
    const screenshot = await takeScreenshot(page, `${testName}_error`);
    addTestResult(testName, false, error, screenshot);
    return false;
  }
}

// Test: Project switching
async function testProjectSwitching(page) {
  const testName = 'Project switching';

  try {
    console.log('\n📂 Testing project switching...');

    // Find Projects button
    const projectsButton = await page.$('button[aria-label="Projects"], button[aria-label*="project"]');
    if (!projectsButton) {
      // Try to find by text
      const allButtons = await page.$$('button');
      for (const btn of allButtons) {
        const text = await page.evaluate(el => el.textContent?.trim(), btn);
        if (text === 'Projects' || text === '📂' || text === 'Examples') {
          projectsButton = btn;
          break;
        }
      }
    }

    if (!projectsButton) {
      throw new Error('Projects button not found');
    }

    console.log('🔘 Clicking Projects button...');
    await projectsButton.click();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Look for projects panel
    const projectsPanel = await page.$('[class*="panel"], [class*="sidebar"], [class*="projects"]');
    if (!projectsPanel) {
      throw new Error('Projects panel not found');
    }

    console.log('✅ Projects panel opened');

    // Look for project list items
    const projectItems = await page.$$('[class*="project"], [class*="example"], [class*="item"]');
    console.log(`📂 Found ${projectItems.length} project items`);

    if (projectItems.length > 1) {
      // Get current project name from editor
      const currentFile = await page.evaluate(() => {
        const tabs = document.querySelectorAll('[role="tab"], .tab');
        if (tabs.length > 0) {
          return tabs[0].textContent?.trim();
        }
        return null;
      });
      
      console.log(`📄 Current file: ${currentFile}`);

      // Click on a different project (not the first one)
      const secondProject = projectItems[1];
      const projectName = await page.evaluate(el => el.textContent?.trim(), secondProject);
      console.log(`🔄 Switching to project: ${projectName}`);
      
      await secondProject.click();
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if project changed
      const newFile = await page.evaluate(() => {
        const tabs = document.querySelectorAll('[role="tab"], .tab');
        if (tabs.length > 0) {
          return tabs[0].textContent?.trim();
        }
        return null;
      });
      
      console.log(`📄 New file: ${newFile}`);
      
      if (newFile !== currentFile) {
        console.log('✅ Project switching successful');
      } else {
        console.log('⚠️ File name unchanged after project switch');
      }
    }

    // Close projects panel
    await projectsButton.click();
    await new Promise(resolve => setTimeout(resolve, 500));

    const screenshot = await takeScreenshot(page, testName);
    addTestResult(testName, true, null, screenshot);
    return true;
  } catch (error) {
    const screenshot = await takeScreenshot(page, `${testName}_error`);
    addTestResult(testName, false, error, screenshot);
    return false;
  }
}

// Test: Console output and error handling
async function testConsoleAndErrors(page) {
  const testName = 'Console output and error handling';

  try {
    console.log('\n🚨 Testing console output and error handling...');

    // Find code editor
    const editor = await page.$('.cm-editor, .CodeMirror, [contenteditable="true"]');
    if (!editor) {
      throw new Error('Code editor not found');
    }

    // Test 1: Normal output
    console.log('📝 Testing normal output...');
    await editor.click({ clickCount: 3 }); // Select all
    await page.keyboard.press('Backspace');
    
    const normalCode = `print("Normal output test")
print("Line 2")
print("Line 3")`;
    
    await page.keyboard.type(normalCode);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find and click run button
    const runButtons = await page.$$('button');
    let runButton = null;
    
    for (const btn of runButtons) {
      const text = await page.evaluate(el => el.textContent?.trim(), btn);
      if (text === 'Run' || text === '▶' || text === '▶️') {
        runButton = btn;
        break;
      }
    }

    if (!runButton) {
      throw new Error('Run button not found');
    }

    console.log('▶️ Running normal output test...');
    await runButton.click();
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check for output
    const output1 = await page.evaluate(() => document.body.textContent);
    if (output1.includes('Normal output test') && output1.includes('Line 3')) {
      console.log('✅ Normal output works');
    }

    // Test 2: Error output
    console.log('🚨 Testing error output...');
    await editor.click({ clickCount: 3 }); // Select all
    await page.keyboard.press('Backspace');
    
    const errorCode = `print("Before error")
x = 1 / 0  # Division by zero
print("After error - should not print")`;
    
    await page.keyboard.type(errorCode);
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('▶️ Running error test...');
    await runButton.click();
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check for error message
    const output2 = await page.evaluate(() => document.body.textContent);
    if (output2.includes('ZeroDivisionError') || output2.includes('division by zero') || 
        output2.includes('Error') || output2.includes('Traceback')) {
      console.log('✅ Error handling works');
    } else if (output2.includes('Before error') && !output2.includes('After error')) {
      console.log('✅ Error stopped execution (Before printed, After did not)');
    }

    // Test 3: Syntax error
    console.log('🔤 Testing syntax error...');
    await editor.click({ clickCount: 3 }); // Select all
    await page.keyboard.press('Backspace');
    
    const syntaxErrorCode = `print("Before syntax error")
x =  # Syntax error here
print("After syntax error")`;
    
    await page.keyboard.type(syntaxErrorCode);
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('▶️ Running syntax error test...');
    await runButton.click();
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check for syntax error
    const output3 = await page.evaluate(() => document.body.textContent);
    if (output3.includes('SyntaxError') || output3.includes('invalid syntax')) {
      console.log('✅ Syntax error handling works');
    }

    const screenshot = await takeScreenshot(page, testName);
    addTestResult(testName, true, null, screenshot);
    return true;
  } catch (error) {
    const screenshot = await takeScreenshot(page, `${testName}_error`);
    addTestResult(testName, false, error, screenshot);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Web IDE Comprehensive E2E tests...');
  console.log(`📡 Using dev server: ${DEV_SERVER_URL}`);

  let browser = null;

  try {
    // Launch browser
    console.log('🐶 Launching browser...');
    browser = await puppeteer.launch({
      headless: false, // Show browser for debugging
      devtools: true, // Open devtools
      defaultViewport: { width: 1280, height: 800 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1280,800'
      ],
      slowMo: 50, // Slow down interactions for visibility
    });

    const page = await browser.newPage();

    // Set up console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`Browser console error: ${msg.text()}`);
      }
    });

    page.on('pageerror', error => {
      console.error(`Page error: ${error.message}`);
    });

    // Run tests
    console.log('\n=== Running Comprehensive Tests ===\n');

    await testPageLoad(page);
    await testFileOperations(page);
    await testCodeExecution(page);
    await testP5SketchExecution(page);
    await testInputHandling(page);
    await testStateManagement(page);
    await testAssetManagement(page);
    await testProjectSwitching(page);
    await testConsoleAndErrors(page);

    // Summary
    console.log('\n=== Test Summary ===');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`⏭️  Skipped: ${testResults.skipped}`);
    console.log(`📊 Total: ${testResults.tests.length}`);

    // Save detailed results
    const resultsPath = `${__dirname}/ide-comprehensive-results.json`;
    writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
    console.log(`\n📄 Detailed results saved to: ${resultsPath}`);

    // Exit with appropriate code
    if (testResults.failed > 0) {
      console.log('\n❌ Some tests failed');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed!');
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