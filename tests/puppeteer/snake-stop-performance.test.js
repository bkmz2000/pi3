#!/usr/bin/env node
// Local regression: PUPPETEER_URL=http://127.0.0.1:4173 node tests/puppeteer/snake-stop-performance.test.js
// Use SNAKE_IDLE_MS=3000 for a quick smoke; default includes two idle minutes.
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const url = new URL('/ide', process.env.PUPPETEER_URL || 'http://127.0.0.1:4173').toString();
const idleMs = Number(process.env.SNAKE_IDLE_MS ?? 120000);
const code = `from graphics import *
size(600, 600)
snake = State(x=0, y=5, score=16)
tail = []
stroke(None)
def splash():
    background(Colors.black)
    fill(Colors.red)
    text_size(50)
    text('Вы погибли :(', Window.center())
def main():
    background(Colors.black)
    for p in tail:
        if snake.x == p.x and snake.y == p.y:
            print('SPLASH')
            run(splash)
        fill(Colors.lime)
        rect(p.x * 50, p.y * 50, 50, 50)
    tail.append(State(x=snake.x, y=snake.y))
    watch(tail)
    if len(tail) > snake.score:
        del tail[0]
    snake.x = (snake.x + 1) % 12
run(main, fps=5)`;

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    window.__watchPackets = [];
    const original = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage');
    Object.defineProperty(Worker.prototype, 'onmessage', {
      ...original,
      set(handler) {
        original.set.call(this, (event) => {
          if (event.data?.type === 'watch') window.__watchPackets.push(event.data);
          handler(event);
        });
      },
    });
  });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.25 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.cm-editor', { timeout: 60000 });
  await page.click('.cm-editor', { offset: { x: 70, y: 70 } });
  await page.keyboard.down('Control');
  await page.keyboard.press('a');
  await page.keyboard.up('Control');
  await page.keyboard.sendCharacter(code);
  await page.click('button[aria-label="Run"]');
  await page.waitForSelector('button[aria-label="Stop"]', { timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.split('SPLASH').length > 2 &&
    [...document.querySelectorAll('span')].some((s) => s.textContent === 'tail' &&
      s.parentElement?.textContent?.includes('State(') &&
      [...s.parentElement.querySelectorAll('span')].some((part) => part.textContent?.startsWith('stale · frame '))),
    { timeout: 20000 });
  const packetsAtStale = await page.evaluate(() => window.__watchPackets.length);
  assert.ok(packetsAtStale >= 2, 'expected live watch updates followed by one stale transition');
  if (process.env.SNAKE_SCREENSHOT) await page.screenshot({ path: process.env.SNAKE_SCREENSHOT });

  await page.evaluate(() => {
    window.__snakeLongTasks = [];
    new PerformanceObserver((list) => {
      window.__snakeLongTasks.push(...list.getEntries().map((e) => e.duration));
    }).observe({ entryTypes: ['longtask'] });
  });
  await new Promise((resolve) => setTimeout(resolve, idleMs));
  const { longTasks, packetsAfterIdle } = await page.evaluate(() => ({
    longTasks: window.__snakeLongTasks,
    packetsAfterIdle: window.__watchPackets.length,
  }));
  assert.equal(packetsAfterIdle, packetsAtStale, 'stale watch must not emit on idle splash frames');
  const before = performance.now();
  await page.click('button[aria-label="Stop"]');
  await page.waitForSelector('button[aria-label="Run"]', { timeout: 5000 });
  const stopMs = Math.round(performance.now() - before);
  assert.equal(errors.length, 0, `unexpected page errors: ${errors.join('; ')}`);
  assert.ok(longTasks.length < 10, `death-screen UI churn: ${longTasks.length} long tasks`);
  assert.ok(stopMs < 2000, `Stop UI transition took ${stopMs}ms`);
  console.log(`Snake death screen ${idleMs}ms: ${longTasks.length} long tasks, Stop UI ${stopMs}ms`);
} finally {
  await browser.close();
}
