import assert from 'node:assert/strict';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const output = path.resolve('artifacts');
const candidates = [
  process.env.CHROME_PATH,
  'C:\\Users\\23636\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
let executablePath;
for (const candidate of candidates) {
  try { await access(candidate); executablePath = candidate; break; } catch { /* Try the next installed browser. */ }
}
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, acceptDownloads: true, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(120000);
const errors = [];
const warnings = [];
const checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
  if (message.type() === 'warning') warnings.push(message.text());
});
function passed(name, detail) {
  checks.push({ name, passed: true, ...(detail ? { detail } : {}) });
  console.log(`PASS ${name}${detail ? `: ${detail}` : ''}`);
}
async function state() {
  return page.evaluate(() => {
    const { camera, controls, landscape, house, scene } = window.__scene;
    let meshCount = 0, wireframeCount = 0;
    house.traverse(object => {
      if (object.isMesh) {
        meshCount++;
        if ([].concat(object.material).every(material => material.wireframe)) wireframeCount++;
      }
    });
    const sun = scene.children.find(object => object.isDirectionalLight);
    return { position: camera.position.toArray(), target: controls.target.toArray(), autoRotate: controls.autoRotate, landscape: landscape.visible, meshCount, wireframeCount, sunlight: { position: sun.position.toArray(), intensity: sun.intensity, color: sun.color.getHex() } };
  });
}
async function noOverflow(label) {
  const result = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, height: innerHeight, scrollHeight: document.documentElement.scrollHeight }));
  assert.ok(result.scroll <= result.width + 1, `${label}: horizontal overflow ${JSON.stringify(result)}`);
  assert.ok(result.scrollHeight <= result.height + 1, `${label}: vertical overflow ${JSON.stringify(result)}`);
  passed(`${label} has no page overflow`, `${result.width} × ${result.height}`);
}

try {
  console.log(`Checking ${baseURL}`);
  await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction(() => window.__scene?.ready === true, null, { timeout: 120000 });
  await page.locator('#loading').waitFor({ state: 'hidden' });
  const initial = await state();
  assert.ok(initial.meshCount > 20, 'Building should contain a complete collection of architectural meshes');
  assert.ok(initial.landscape, 'Forest is shown initially');
  const imageLoaded = await page.locator('#reference-panel img').evaluate(img => img.complete && img.naturalWidth > 1000);
  assert.ok(imageLoaded, 'Reference photograph should be available locally');
  passed('3D scene and reference photograph load', `${initial.meshCount} building meshes`);
  await noOverflow('Desktop');
  await page.screenshot({ path: path.join(output, 'desktop.png') });

  for (const name of ['orbit', 'front', 'top', 'reference']) {
    const before = await state();
    await page.locator(`[data-view="${name}"]`).click();
    await page.waitForFunction(view => document.querySelector(`[data-view="${view}"]`).getAttribute('aria-pressed') === 'true', name);
    const after = await state();
    assert.notDeepEqual(after.position, before.position, `${name} should change camera position`);
    assert.equal(after.autoRotate, false);
    if (name === 'front') assert.ok(Math.abs(after.position[0] - after.target[0]) < 0.01, 'Front view should face the front elevation');
    if (name === 'top') assert.ok(after.position[1] - after.target[1] > 20, 'Aerial view should rise over the roof');
    passed(`Camera preset: ${name}`);
  }

  await page.locator('#reference-toggle').click();
  assert.equal(await page.locator('#reference-panel').isVisible(), false);
  await page.locator('#reference-toggle').click();
  assert.equal(await page.locator('#reference-panel').isVisible(), true);
  await page.locator('#reference-close').click();
  assert.equal(await page.locator('#reference-toggle').getAttribute('aria-pressed'), 'false');
  await page.locator('#reference-toggle').click();
  passed('Reference photograph toggle and close');

  await page.locator('#settings-toggle').click();
  assert.equal(await page.locator('#settings-panel').isVisible(), true);
  await page.locator('label[for="show-landscape"]').click();
  assert.equal((await state()).landscape, false);
  await page.locator('label[for="show-landscape"]').click();
  assert.equal((await state()).landscape, true);
  passed('Forest visibility toggle');

  await page.locator('label[for="wireframe"]').click();
  const wireState = await state();
  assert.equal(wireState.wireframeCount, wireState.meshCount, 'Wireframe applies to every architectural mesh');
  await page.locator('label[for="wireframe"]').click();
  assert.equal((await state()).wireframeCount, 0);
  passed('Building wireframe toggle');

  const sunlightBefore = (await state()).sunlight;
  await page.locator('#light-time').fill('0.1');
  await page.locator('#light-time').dispatchEvent('input');
  const sunlightAfter = (await state()).sunlight;
  assert.notDeepEqual(sunlightAfter.position, sunlightBefore.position);
  assert.notEqual(sunlightAfter.color, sunlightBefore.color);
  passed('Lighting slider changes sun position and color');

  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#settings-panel').isVisible(), false);
  await page.locator('#auto-rotate').click();
  assert.equal((await state()).autoRotate, true);
  const startPosition = (await state()).position;
  await page.waitForFunction(position => window.__scene.camera.position.toArray().some((value, index) => Math.abs(value - position[index]) > .004), startPosition);
  await page.locator('#auto-rotate').click();
  assert.equal((await state()).autoRotate, false);
  passed('Automatic orbit changes camera position');

  await page.locator('#settings-toggle').click();
  await page.locator('label[for="show-landscape"]').click();
  await page.locator('label[for="wireframe"]').click();
  await page.locator('#reset-scene').click();
  const reset = await state();
  assert.equal(reset.landscape, true);
  assert.equal(reset.wireframeCount, 0);
  assert.equal(reset.autoRotate, false);
  assert.equal(await page.locator('#light-time').inputValue(), '0.62');
  assert.ok(reset.position.every((value, index) => Math.abs(value - initial.position[index]) < .001), `Reset camera differs: initial=${JSON.stringify(initial.position)}, reset=${JSON.stringify(reset.position)}`);
  assert.equal(await page.locator('#settings-panel').isVisible(), false);
  passed('Reset restores view, forest, solid surfaces, and daylight');

  const pngEvent = page.waitForEvent('download', { timeout: 60000 });
  await page.locator('#capture').click();
  const pngDownload = await pngEvent;
  const pngPath = path.join(output, 'scene.png');
  await pngDownload.saveAs(pngPath);
  const png = await readFile(pngPath);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.ok(png.length > 25000, 'Scene PNG should contain rendered image data');
  assert.equal(png.readUInt32BE(16), 1280);
  assert.equal(png.readUInt32BE(20), 800);
  passed('Scene screenshot download', `${Math.round(png.length / 1024)} KB PNG`);

  console.log('Exporting architecture GLB…');
  const glbEvent = page.waitForEvent('download', { timeout: 180000 });
  await page.locator('#export-model').click();
  const glbDownload = await glbEvent;
  const glbPath = path.join(output, 'mountain-home.glb');
  await glbDownload.saveAs(glbPath);
  const glb = await readFile(glbPath);
  assert.equal(glb.toString('ascii', 0, 4), 'glTF');
  assert.equal(glb.readUInt32LE(4), 2);
  assert.equal(glb.readUInt32LE(8), glb.length);
  assert.equal(glb.toString('ascii', 16, 20), 'JSON');
  const jsonLength = glb.readUInt32LE(12);
  const gltf = JSON.parse(glb.toString('utf8', 20, 20 + jsonLength).trim());
  assert.equal(gltf.asset.version, '2.0');
  assert.ok(gltf.meshes.length > 20 && gltf.nodes.length > 20);
  assert.ok(gltf.buffers[0].byteLength > 0);
  assert.ok(gltf.images?.length > 0, 'Model should embed its architectural textures');
  assert.ok(gltf.images.every(image => Number.isInteger(image.bufferView)), 'GLB textures should be embedded for portable downloads');
  assert.equal(await page.locator('#export-model').isDisabled(), false);
  passed('GLB model download and binary structure', `${gltf.nodes.length} nodes, ${gltf.meshes.length} meshes, ${gltf.images.length} textures, ${(glb.length / 1024 / 1024).toFixed(2)} MB`);

  await page.waitForFunction(() => !document.getElementById('toast').classList.contains('is-visible'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await noOverflow('Mobile');
  for (const selector of ['#capture', '#export-model', '#auto-rotate', '#settings-toggle', '[data-view="reference"]', '[data-view="top"]']) {
    const box = await page.locator(selector).boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= 391 && box.y >= 0 && box.y + box.height <= 845, `Mobile control should remain on-screen: ${selector}`);
  }
  await page.screenshot({ path: path.join(output, 'mobile.png') });
  await page.locator('#settings-toggle').click();
  assert.equal(await page.locator('#settings-panel').isVisible(), true);
  await noOverflow('Mobile settings');
  await page.screenshot({ path: path.join(output, 'mobile-settings.png') });
  await page.locator('#reset-scene').click();
  passed('Mobile controls remain visible and settings work');

  assert.deepEqual(errors, [], 'Browser should report no JavaScript or rendering errors');
  passed('No browser errors');
  const report = { baseURL, checkedAt: new Date().toISOString(), browser: browser.version(), checks, errors, warnings: [...new Set(warnings)], artifacts: ['desktop.png', 'mobile.png', 'mobile-settings.png', 'scene.png', 'mountain-home.glb'] };
  await writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(`Verified ${checks.length} checks. Artifacts saved to ${output}`);
} catch (error) {
  await page.screenshot({ path: path.join(output, 'verification-failure.png') }).catch(() => {});
  await writeFile(path.join(output, 'verification.json'), JSON.stringify({ baseURL, checkedAt: new Date().toISOString(), checks, errors, warnings: [...new Set(warnings)], failure: error.stack }, null, 2));
  throw error;
} finally {
  await browser.close();
}
