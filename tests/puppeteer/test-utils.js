/**
 * Test utilities for E2E tests
 * Provides consistent wait functions and assertion helpers
 */

export const DEFAULT_TIMEOUT = 60000;
export const DEFAULT_INTERVAL = 100;

export async function waitFor(
  conditionFn,
  { timeout = DEFAULT_TIMEOUT, interval = DEFAULT_INTERVAL, errorMessage = 'Timeout' } = {}
) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const result = await conditionFn();
    if (result) return result;
    await sleep(interval);
  }
  throw new Error(`${errorMessage} after ${timeout}ms`);
}

export async function waitForElement(page, selector, { timeout = DEFAULT_TIMEOUT } = {}) {
  return waitFor(
    async () => await page.$(selector),
    { timeout, errorMessage: `Element ${selector} not found` }
  );
}

export async function waitForElements(page, selector, { timeout = DEFAULT_TIMEOUT } = {}) {
  return waitFor(
    async () => {
      const elements = await page.$$(selector);
      return elements.length > 0 ? elements : null;
    },
    { timeout, errorMessage: `Elements ${selector} not found` }
  );
}

export async function waitForText(page, text, { timeout = DEFAULT_TIMEOUT } = {}) {
  return waitFor(
    async () => {
      const content = await page.content();
      return content.includes(text) ? text : null;
    },
    { timeout, errorMessage: `Text "${text}" not found` }
  );
}

export async function waitForFn(
  page,
  fn,
  { timeout = DEFAULT_TIMEOUT, interval = DEFAULT_INTERVAL } = {}
) {
  return waitFor(fn, { timeout, interval, errorMessage: 'Function condition not met' });
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitForPyodide(page, { timeout = DEFAULT_TIMEOUT } = {}) {
  console.log('⏳ Waiting for Pyodide to load...');
  await waitForFn(
    page,
    () => page.evaluate(() => window.runnerStore?.getState()?.ready === true),
    { timeout, errorMessage: 'Pyodide did not load' }
  );
  console.log('✅ Pyodide loaded');
}

export async function clickButtonByText(page, text) {
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const btnText = await page.evaluate(el => el.textContent?.trim(), btn);
    if (btnText === text) {
      await btn.click();
      return true;
    }
  }
  return false;
}

export async function findButton(page, text) {
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const btnText = await page.evaluate(el => el.textContent?.trim(), btn);
    if (btnText === text) {
      return btn;
    }
  }
  return null;
}

export async function typeInEditor(page, text) {
  const editor = await page.$('.cm-editor');
  if (!editor) throw new Error('Code editor not found');
  
  await editor.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.keyboard.type(text);
}

export async function clickRunButton(page) {
  const runButton = await findButton(page, 'Run');
  if (!runButton) throw new Error('Run button not found');
  await runButton.click();
}

export async function getConsoleOutput(page) {
  return page.evaluate(() => {
    const output = [];
    const elements = document.querySelectorAll('[class*="output"], [class*="console"]');
    elements.forEach(el => {
      if (el.textContent) output.push(el.textContent);
    });
    return output.join('\n');
  });
}

export function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`Expected "${expected}" but got "${actual}" ${message}`.trim());
  }
}

export function assertContains(text, substring, message = '') {
  if (!text.includes(substring)) {
    throw new Error(`Expected text to contain "${substring}" ${message}`.trim());
  }
}

export function assertNotContains(text, substring, message = '') {
  if (text.includes(substring)) {
    throw new Error(`Expected text not to contain "${substring}" ${message}`.trim());
  }
}
