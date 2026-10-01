#!/usr/bin/env node
// Run against a local dev server: PUPPETEER_URL=http://127.0.0.1:5173 node tests/puppeteer/canvas-line-rasterization.test.js
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const base = process.env.PUPPETEER_URL || 'http://127.0.0.1:5173';
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

async function runAndCapture(page, code, dpr, browserMessages) {
  await page.click('.cm-editor', { offset: { x: 70, y: 70 } });
  await page.keyboard.down('Control');
  await page.keyboard.press('a');
  await page.keyboard.up('Control');
  await page.keyboard.sendCharacter(code);
  const expectedLines = code.split('\n').filter(Boolean);
  await page.waitForFunction((lines) => {
    const text = document.querySelector('.cm-content')?.innerText ?? '';
    return lines.every((line) => text.includes(line));
  }, { timeout: 10000 }, expectedLines);
  await page.waitForFunction(() => {
    const run = document.querySelector('button[aria-label="Run"]');
    return run && !run.disabled;
  }, { timeout: 60000 });
  await page.click('button[aria-label="Run"]');
  await page.waitForSelector('button[aria-label="Stop"]', { timeout: 60000 });
  const backingWidth = Math.round(200 * dpr);
  try {
    await page.waitForFunction((pixels) => [...document.querySelectorAll('canvas')].some((canvas) =>
      canvas.width === pixels && Math.abs(canvas.getBoundingClientRect().width - 200) < 0.5,
    ), { timeout: 30000 }, backingWidth);
  } catch (error) {
    const state = await page.evaluate(() => ({
      canvases: [...document.querySelectorAll('canvas')].map((canvas) => ({
        width: canvas.width, height: canvas.height, rect: canvas.getBoundingClientRect().toJSON(),
      })),
      buttons: [...document.querySelectorAll('button')].map((button) => ({
        aria: button.getAttribute('aria-label'), title: button.title, disabled: button.disabled,
      })),
      editor: document.querySelector('.cm-content')?.innerText,
      output: document.body.innerText.slice(-1500),
    }));
    await page.screenshot({ path: `/tmp/canvas-line-rasterization-timeout-${dpr}.png`, fullPage: true });
    throw new Error(`${error.message}; canvas wait state: ${JSON.stringify(state)}; browser messages: ${browserMessages.join(' | ')}`);
  }
  await page.click('button[title^="Take screenshot"]');
  await page.waitForSelector('button[title="Recent screenshots"]');
  await page.click('button[title="Recent screenshots"]');
  await page.waitForFunction(() => document.querySelector('img[src^="blob:"]'));
  return page.evaluate(async () => {
    const images = [...document.querySelectorAll('img[src^="blob:"]')];
    const bitmap = await createImageBitmap(await fetch(images.at(-1).src).then((response) => response.blob()));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    const colors = new Map();
    const alpha = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const color = `${data[i]},${data[i + 1]},${data[i + 2]}`;
      colors.set(color, (colors.get(color) ?? 0) + 1);
      alpha.set(data[i + 3], (alpha.get(data[i + 3]) ?? 0) + 1);
    }
    bitmap.close();
    return { dimensions: [canvas.width, canvas.height], colors: Object.fromEntries(colors), alpha: Object.fromEntries(alpha) };
  });
}

try {
  const expectedPixels = {
    1: { background: 39419, stroke: 581 },
    1.25: { background: 61779, stroke: 721 },
    2: { background: 157696, stroke: 2304 },
  };
  for (const dpr of [1, 1.25, 2]) {
    const lines = `line(0,90,200,110)
line(20,30,180,30)
line(25,20,25,80)
line(20,100,180,80)
show()`;
    for (const background of ['white', 'transparent']) {
      const page = await browser.newPage();
      const browserMessages = [];
      page.on('console', (message) => browserMessages.push(`${message.type()}: ${message.text()}`));
      page.on('pageerror', (error) => browserMessages.push(`pageerror: ${error.message}`));
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: dpr });
      await page.goto(`${base}/ide`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.cm-editor');
      const bgCode = background === 'white' ? 'background(Colors.white)\n' : '';
      const pixels = await runAndCapture(page, `from graphics import *\nsize(200,200)\n${bgCode}${lines}`, dpr, browserMessages);
      assert.deepEqual(pixels.dimensions, [Math.round(200 * dpr), Math.round(200 * dpr)]);
      if (background === 'white') {
        assert.ok(Object.keys(pixels.colors).length <= 2, `white background must contain only background and stroke colors at DPR ${dpr}: ${JSON.stringify(pixels.colors)}`);
        assert.deepEqual(pixels.colors, { '244,244,244': expectedPixels[dpr].background, '0,0,0': expectedPixels[dpr].stroke }, `binary line mask at DPR ${dpr}`);
        console.log(`DPR ${dpr} white: ${JSON.stringify(pixels.colors)}`);
      } else {
        assert.deepEqual(pixels.alpha, { '0': expectedPixels[dpr].background, '255': expectedPixels[dpr].stroke }, `binary transparent line mask at DPR ${dpr}`);
        console.log(`DPR ${dpr} transparent alpha counts: ${JSON.stringify(pixels.alpha)}`);
      }
      await page.close();
    }
    console.log(`Solid line raster DPR ${dpr}: white uses background/stroke colors only; transparent alpha is 0/255`);
  }
} finally {
  await browser.close();
}
