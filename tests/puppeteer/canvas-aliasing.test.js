#!/usr/bin/env node
// Run against a local dev server: PUPPETEER_URL=http://127.0.0.1:5173 node tests/puppeteer/canvas-aliasing.test.js
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const base = process.env.PUPPETEER_URL || 'http://127.0.0.1:5173';
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const code = `from graphics import *
size(600, 600)
stroke(None)
def main():
    background(Colors.black)
    fill(Colors.lime)
    rect(100, 100, 50, 50)
    rect(150, 100, 50, 50)
    fill(Colors.red)
    text_size(50)
    text('Вы погибли :(', Window.center())
    watch('pointer', (Mouse.x, Mouse.y))
run(main, fps=5)`;

try {
  for (const dpr of [1, 1.25]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: dpr });
    await page.goto(`${base}/ide`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.cm-editor');
    await page.click('.cm-editor', { offset: { x: 70, y: 70 } });
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.keyboard.sendCharacter(code);
    await page.waitForSelector('button[aria-label="Run"]');
    await page.click('button[aria-label="Run"]');
    await page.waitForSelector('button[aria-label="Stop"]', { timeout: 60000 });

    const expected = Math.round(600 * dpr);
    await page.waitForFunction((pixels) => {
      const canvas = [...document.querySelectorAll('canvas')].find((c) => c.getBoundingClientRect().width === 600);
      return canvas?.width === pixels;
    }, { timeout: 30000 }, expected);
    const display = await page.evaluate(() => {
      const canvas = [...document.querySelectorAll('canvas')].find((c) => c.getBoundingClientRect().width === 600);
      const rect = canvas.getBoundingClientRect();
      return { backing: [canvas.width, canvas.height], css: [rect.width, rect.height],
        rendering: getComputedStyle(canvas).imageRendering,
        parentRendering: getComputedStyle(canvas.parentElement).imageRendering };
    });
    assert.deepEqual(display, {
      backing: [expected, expected], css: [600, 600], rendering: 'auto', parentRendering: 'auto',
    });

    const rect = await page.evaluate(() => {
      const canvas = [...document.querySelectorAll('canvas')].find((c) => c.getBoundingClientRect().width === 600);
      const box = canvas.getBoundingClientRect();
      return { x: box.x, y: box.y };
    });
    await page.mouse.move(rect.x + 200, rect.y + 250);
    await page.waitForFunction(() => [...document.querySelectorAll('span')].some((s) =>
      s.textContent === 'pointer' && s.parentElement?.textContent?.includes('(200.0, 250.0)'),
    ), { timeout: 10000 });

    await page.click('button[title^="Take screenshot"]');
    await page.waitForSelector('button[title="Recent screenshots"]');
    await page.click('button[title="Recent screenshots"]');
    const snapshot = await page.waitForFunction(async () => {
      const img = document.querySelector('img[src^="blob:"]');
      if (!img) return null;
      const bitmap = await createImageBitmap(await fetch(img.src).then((r) => r.blob()));
      const pixels = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = pixels.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      const x = Math.round(150 * devicePixelRatio);
      const y = Math.round(125 * devicePixelRatio);
      const rgb = (px) => [...ctx.getImageData(px, y, 1, 1).data];
      const result = { dimensions: [bitmap.width, bitmap.height], edge: rgb(x - 1),
        neighbor: rgb(x), interior: rgb(x + 5) };
      bitmap.close();
      return result;
    }, { timeout: 15000 });
    const pixels = await snapshot.jsonValue();
    assert.deepEqual(pixels.dimensions, [expected, expected]);
    assert.deepEqual(pixels.edge, pixels.interior, 'tiles should not have a dark seam');
    assert.deepEqual(pixels.neighbor, pixels.interior, 'neighboring tile should share the edge color');
    await page.click('button[aria-label="Stop"]');
    await page.waitForSelector('button[aria-label="Run"]', { timeout: 5000 });
    await page.close();
    console.log(`Canvas DPR ${dpr}: ${expected}×${expected} backing, 600×600 display, screenshot OK`);
  }
} finally {
  await browser.close();
}
