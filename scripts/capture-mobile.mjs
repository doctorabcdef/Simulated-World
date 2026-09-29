import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:\\Users\\23636\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__scene?.ready);
  await page.locator('#loading').waitFor({ state: 'hidden' });
  async function settlePaint() {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForTimeout(500);
  }
  await settlePaint();
  assert.equal(await page.locator('#settings-panel').isVisible(), false);
  assert.equal(await page.locator('#toast').evaluate(element => getComputedStyle(element).opacity), '0');
  await page.screenshot({ path: 'artifacts/mobile.png', animations: 'disabled' });
  await page.locator('#settings-toggle').click();
  await page.waitForFunction(() => {
    const panel = document.getElementById('settings-panel');
    return !panel.hidden && getComputedStyle(panel).opacity === '1';
  });
  await settlePaint();
  await page.screenshot({ path: 'artifacts/mobile-settings.png', animations: 'disabled' });
  const normal = await readFile('artifacts/mobile.png');
  const settings = await readFile('artifacts/mobile-settings.png');
  assert.notEqual(normal.toString('base64'), settings.toString('base64'), 'Visible settings must change the mobile screenshot');
  const bounds = await page.locator('#settings-panel').boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ verified: 'mobile framing and visible settings', settingsBounds: bounds, screenshotBytes: [normal.length, settings.length], camera: await page.evaluate(() => window.__scene.camera.position.toArray()) }));
} finally {
  await browser.close();
}
