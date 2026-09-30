#!/usr/bin/env node
// Regression for transferring the OffscreenCanvas when the IDE route remounts
// CanvasWindow while the module-level worker survives SPA navigation.
// Usage: PUPPETEER_URL=http://127.0.0.1:4173 npm run test:canvas-spa
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const base = process.env.PUPPETEER_URL || 'http://127.0.0.1:4173';
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRun(page) {
  await page.waitForFunction(() => {
    const button = document.querySelector('button[aria-label="Run"]');
    return button && !button.disabled;
  }, { timeout: 60000 });
}

async function runExample(page, label, { green = false, cyan = false } = {}) {
  const previousStarts = await page.evaluate(() => window.__canvasDiag.events.filter((event) => event.type === 'start').length);
  await page.click('button[aria-label="Run"]');
  await page.waitForFunction((count) => window.__canvasDiag.events.filter((event) => event.type === 'start').length > count,
    { timeout: 60000 }, previousStarts);
  await page.waitForSelector('button[aria-label="Stop"]', { timeout: 10000 });
  await sleep(2500);

  const screenshot = await page.screenshot({ path: `/tmp/pi3-canvas-spa-${label.replaceAll(' ', '-')}.png` });
  const pixels = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const context = new OffscreenCanvas(image.width, image.height).getContext('2d');
    context.drawImage(image, 0, 0);
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const ratio = devicePixelRatio;
    const left = Math.round(rect.left * ratio);
    const top = Math.round(rect.top * ratio);
    const width = Math.round(rect.width * ratio);
    const height = Math.round(rect.height * ratio);
    let greenCount = 0;
    let cyanCount = 0;
    const data = context.getImageData(left, top, width, height).data;
    for (let index = 0; index < data.length; index += 4) {
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      if (red > 35 && red < 100 && green > 145 && green < 210 && blue > 65 && blue < 145) greenCount++;
      if (red > 35 && red < 145 && green > 145 && blue > 175) cyanCount++;
    }
    image.close();
    return { greenCount, cyanCount, canvasSize: [canvas.width, canvas.height], cssSize: [rect.width, rect.height] };
  }, Buffer.from(screenshot).toString('base64'));
  if (green) assert.ok(pixels.greenCount > 50, `${label}: expected visible green snake pixels, got ${pixels.greenCount}`);
  if (cyan) assert.ok(pixels.cyanCount > 50, `${label}: expected visible cyan ball pixels, got ${pixels.cyanCount}; screenshot=/tmp/pi3-canvas-spa-${label.replaceAll(' ', '-')}.png`);
  return pixels;
}

async function stopExample(page) {
  if (await page.$('button[aria-label="Stop"]')) {
    const previousAcks = await page.evaluate(() => window.__canvasDiag.events.filter((event) => event.type === 'interrupt_ack').length);
    await page.click('button[aria-label="Stop"]');
    await page.waitForSelector('button[aria-label="Run"]', { timeout: 10000 });
    await page.waitForFunction((count) => window.__canvasDiag.events.filter((event) => event.type === 'interrupt_ack').length > count,
      { timeout: 10000 }, previousAcks);
  }
}

try {
  for (const dpr of [1, 1.25]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: dpr });
    await page.evaluateOnNewDocument(() => {
      window.__canvasDiag = { commands: [], events: [], workers: 0 };
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        constructor(...args) {
          super(...args);
          window.__canvasDiag.workers++;
          this.addEventListener('message', (event) => {
            const message = event.data || {};
            window.__canvasDiag.events.push({ type: message.type, canvasActive: message.canvasActive, width: message.width, height: message.height });
          });
          const post = NativeWorker.prototype.postMessage;
          this.postMessage = function (message, ...rest) {
            if (message?.cmd) window.__canvasDiag.commands.push({ cmd: message.cmd, entry: message.entry, pixelRatio: message.pixelRatio });
            return post.call(this, message, ...rest);
          };
        }
      };
    });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method().toUpperCase())) void request.abort('blockedbyclient');
      else void request.continue();
    });

    await page.goto(`${base}/ide/example/snake`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('.cm-editor', { timeout: 60000 });
    await waitForRun(page);
    await page.evaluate(() => {
      window.__firstCanvas = document.querySelector('canvas');
      window.__firstTimeOrigin = performance.timeOrigin;
    });
    const snakePixels = await runExample(page, `DPR ${dpr} direct snake route`, { green: true });
    await stopExample(page);

    await page.click('button[aria-label="Examples"]');
    await page.waitForFunction(() => location.pathname === '/projects' && document.body.innerText.includes('Bouncing Actor'), { timeout: 30000 });
    const allButtons = await page.$$('button');
    let bouncingCard;
    for (const button of allButtons) {
      const text = await button.evaluate((element) => element.innerText.trim());
      if (text.startsWith('Bouncing Actor')) {
        bouncingCard = button;
        break;
      }
    }
    assert.ok(bouncingCard, 'could not locate the Bouncing Actor example card');
    await bouncingCard.click();
    await page.waitForFunction(() => location.pathname.startsWith('/ide/example/bouncing'), { timeout: 30000 });
    await page.waitForSelector('.cm-editor', { timeout: 60000 });
    await waitForRun(page);

    const beforeSpaRun = await page.evaluate(() => ({
      sameDocument: performance.timeOrigin === window.__firstTimeOrigin,
      newCanvas: document.querySelector('canvas') !== window.__firstCanvas,
      workers: window.__canvasDiag.workers,
      attachCommands: window.__canvasDiag.commands.filter((command) => command.cmd === 'attach_canvas').length,
    }));
    assert.equal(beforeSpaRun.sameDocument, true, 'example selection should use SPA navigation without reloading the document');
    assert.equal(beforeSpaRun.newCanvas, true, 'the IDE route should mount a new HTMLCanvasElement');
    assert.equal(beforeSpaRun.workers, 1, 'the module-level worker should survive SPA navigation');
    assert.equal(beforeSpaRun.attachCommands, 2, 'the remounted canvas must be attached before running the new example');

    const bouncingPixels = await runExample(page, `DPR ${dpr} Bouncing Actor after SPA navigation`, { cyan: true });
    const afterSpaRun = await page.evaluate(() => ({
      workers: window.__canvasDiag.workers,
      attachCommands: window.__canvasDiag.commands.filter((command) => command.cmd === 'attach_canvas').length,
      starts: window.__canvasDiag.events.filter((event) => event.type === 'start').length,
      canvasResize: window.__canvasDiag.events.filter((event) => event.type === 'canvas_resize').at(-1),
    }));
    assert.equal(afterSpaRun.workers, 1, 'SPA navigation should keep the same worker');
    assert.equal(afterSpaRun.attachCommands, 2, 'each distinct HTMLCanvasElement must be transferred to the persistent worker');
    assert.equal(afterSpaRun.canvasResize?.width, 400, 'Bouncing Actor should initialize its 400px canvas');
    assert.equal(afterSpaRun.canvasResize?.height, 400, 'Bouncing Actor should initialize its 400px canvas');
    assert.ok(afterSpaRun.starts >= 2, 'both examples should start in the same worker');
    const activeStarts = await page.evaluate(() => window.__canvasDiag.events.filter((event) => event.type === 'start').at(-1)?.canvasActive);
    assert.equal(activeStarts, true, 'the worker must activate the remounted canvas');
    await stopExample(page);

    await page._client().send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('.cm-editor', { timeout: 60000 });
    await waitForRun(page);
    const reloadPixels = await runExample(page, `DPR ${dpr} Bouncing Actor after hard reload`, { cyan: true });
    const afterReload = await page.evaluate(() => ({
      workers: window.__canvasDiag.workers,
      attachCommands: window.__canvasDiag.commands.filter((command) => command.cmd === 'attach_canvas').length,
    }));
    assert.equal(afterReload.workers, 1, 'hard reload should initialize a fresh worker');
    assert.equal(afterReload.attachCommands, 1, 'fresh worker should attach the newly mounted canvas once');
    assert.equal(pageErrors.length, 0, `unexpected page errors: ${pageErrors.join('; ')}`);
    console.log(`Canvas SPA remount DPR ${dpr}: snake green=${snakePixels.greenCount}, Bouncing cyan=${bouncingPixels.cyanCount}, after reload cyan=${reloadPixels.cyanCount}`);
    await context.close();
  }
} finally {
  await browser.close();
}
