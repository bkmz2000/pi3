import puppeteer from "puppeteer";

const URL = "http://localhost:5173/";

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1480, height: 900 });

// Helper to wait and screenshot
async function snap(name) {
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: false });
  console.log(`✓ ${name}`);
}

// Helper to close any open panel
async function closePanel() {
  await page.evaluate(() => {
    const backdrop = document.querySelector('[style*="z-index: 5"]');
    if (backdrop) backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 300));
}

// Helper to click by aria-label
async function clickButton(label) {
  await page.evaluate((lbl) => {
    const btn = document.querySelector(`button[aria-label="${lbl}"]`);
    if (btn) btn.click();
  }, label);
  await new Promise(r => setTimeout(r, 400));
}

// ── Midnight (default) ──
await page.goto(URL, { waitUntil: "networkidle0", timeout: 15000 });
await page.waitForSelector(".cm-editor", { timeout: 15000 });
await new Promise(r => setTimeout(r, 2000));
await snap("01-midnight-editor");

await clickButton("Projects");
await snap("02-midnight-projects");
await closePanel();

await clickButton("Settings");
await snap("03-midnight-settings");
await closePanel();

await clickButton("Assets");
await snap("04-midnight-assets");
await closePanel();

await browser.close();
