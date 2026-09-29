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

  const architecture = await page.evaluate(() => {
    const { house } = window.__scene;
    house.updateWorldMatrix(true, true);
    const shutter = house.getObjectByName('ground-floor-roller-shutter');
    const upperDoor = house.getObjectByName('second-floor-front-door');
    const slats = shutter?.getObjectByName('galvanized-slats');
    const firstSlat = house.matrix.clone();
    slats?.getMatrixAt(0, firstSlat);
    const windowRecesses = [];
    house.traverse(object => {
      if (!object.isInstancedMesh || object.geometry.type !== 'BoxGeometry') return;
      const matrix = house.matrix.clone();
      for (let index = 0; index < object.count; index++) {
        object.getMatrixAt(index, matrix);
        const e = matrix.elements;
        // Window recess boxes have a .065 m front depth or a .10 m side depth.
        // Extract actual transforms, independently of the window schedule.
        if ((Math.abs(e[10] - .065) < .0001 && e[0] > 1 && e[5] > .7)
          || (Math.abs(e[0] - .10) < .0001 && e[10] > 1 && e[5] > .7)) {
          windowRecesses.push({ center: [e[12], e[13], e[14]], size: [e[0], e[5], e[10]] });
        }
      }
    });
    return {
      windows: house.userData.windowSchedule,
      doors: house.userData.doorSchedule,
      windowRecesses,
      doorPositions: [shutter, upperDoor].map(door => door && {
        floor: door.userData.floor,
        position: door.getWorldPosition(house.position.clone()).toArray(),
      }),
      shutter: shutter && {
        ...shutter.userData,
        actualSlatCount: slats?.count,
        actualSlatWidth: firstSlat.elements[0],
        guides: shutter.children.filter(object => object.name === 'vertical-guide-track').length,
        hasHood: !!shutter.getObjectByName('rolled-curtain-hood'),
        hasHandle: !!shutter.getObjectByName('pull-handle'),
        hasBottomBar: !!shutter.getObjectByName('weighted-bottom-bar'),
      },
    };
  });
  assert.equal(architecture.windows?.length, 14, 'All 14 architectural windows must be recorded');
  const floorSizes = [];
  for (const floor of [1, 2, 3]) {
    const windows = architecture.windows.filter(window => window.floor === floor);
    assert.equal(windows.length, { 1: 3, 2: 7, 3: 4 }[floor]);
    const { width, height } = windows[0];
    assert.ok(windows.every(window => window.width === width && window.height === height), `Floor ${floor}: every elevation must use the same window size`);
    assert.ok(windows.every(window => window.center.length === 3 && window.center.every(Number.isFinite)));
    assert.ok(windows.some(window => window.facade === 'front') && windows.some(window => window.facade === 'right'));
    floorSizes.push({ floor, width, height });
  }
  assert.equal(new Set(floorSizes.map(size => size.height)).size, 3, 'Different floors retain their different window proportions');
  passed('Windows share dimensions within each floor', floorSizes.map(({ floor, width, height }) => `F${floor} ${width} × ${height} m`).join('; '));
  const closeTo = (actual, expected, label, tolerance = .0001) => assert.ok(Math.abs(actual - expected) < tolerance, `${label}: expected ${expected}, got ${actual}`);
  for (const floor of [1, 2, 3]) {
    const front = architecture.windows.filter(window => window.floor === floor && window.facade === 'front').sort((a, b) => a.center[0] - b.center[0]);
    const expectedAxes = floor === 3 ? [-4.1, 0, 4.1] : [-4.1, 4.1];
    assert.deepEqual(front.map(window => window.center[0]), expectedAxes, `Floor ${floor}: front windows must align with shared facade axes`);
    closeTo(front[0].center[0] + front.at(-1).center[0], 0, `Floor ${floor}: left/right windows are symmetric`);
    assert.ok(front.every(window => window.center[1] === front[0].center[1]), `Floor ${floor}: windows have equal sill heights`);
    if (floor === 3) closeTo(front[1].center[0] - front[0].center[0], front[2].center[0] - front[1].center[0], 'Third-floor window spacing');
    const side = architecture.windows.filter(window => window.floor === floor && window.facade === 'right').sort((a, b) => a.center[2] - b.center[2]);
    assert.equal(side.length, floor === 2 ? 2 : 1);
    closeTo((side[0].center[2] + side.at(-1).center[2]) / 2, -1.8, `Floor ${floor}: side windows share a symmetric centerline`);
  }
  for (const window of architecture.windows) {
    const side = window.facade === 'right';
    const facing = window.facade === 'rear' ? -1 : 1;
    const expectedCenter = side
      ? [window.center[0] + .04, window.center[1], window.center[2]]
      : [window.center[0], window.center[1], window.center[2] + facing * .02];
    const expectedSize = side ? [.10, window.height, window.width] : [window.width, window.height, .065];
    assert.ok(architecture.windowRecesses.some(recess => recess.center.every((value, axis) => Math.abs(value - expectedCenter[axis]) < .0001)
      && recess.size.every((value, axis) => Math.abs(value - expectedSize[axis]) < .0001)), `Floor ${window.floor} ${window.facade}: scheduled window at ${window.center} must have matching rendered geometry`);
  }
  passed('Windows align symmetrically across floors with evenly spaced attic windows', 'Front axes −4.10 / 0 / +4.10 m; actual recess geometry verified');
  assert.equal(architecture.doors?.length, 2, 'Both principal entrances must be recorded');
  for (const floor of [1, 2]) {
    const door = architecture.doors.find(door => door.floor === floor);
    const actual = architecture.doorPositions.find(door => door?.floor === floor);
    assert.ok(door && actual, `Floor ${floor}: principal entrance must exist as geometry and schedule`);
    closeTo(door.center[0], 0, `Floor ${floor}: scheduled door centered on facade`);
    closeTo(actual.position[0], 0, `Floor ${floor}: rendered door centered on facade`);
    assert.ok(actual.position[2] > 4.3 && actual.position[2] < 4.7, `Floor ${floor}: entrance lies on the front facade`);
    closeTo(actual.position[2], door.center[2], `Floor ${floor}: schedule matches actual entrance depth`);
  }
  passed('First- and second-floor entrances are centered and vertically aligned', 'Both actual entrance groups share x = 0');
  assert.ok(architecture.shutter, 'Ground entrance must have a roller shutter');
  assert.equal(architecture.shutter.state, 'closed');
  assert.equal(architecture.shutter.actualSlatCount, 39);
  assert.equal(architecture.shutter.slatCount, 39);
  assert.ok(Math.abs(architecture.shutter.actualSlatWidth - 4.62) < .001);
  assert.equal(architecture.shutter.height, 2.62);
  assert.equal(architecture.shutter.guides, 2);
  assert.ok(architecture.shutter.hasHood && architecture.shutter.hasHandle && architecture.shutter.hasBottomBar);
  passed('Ground entrance is a complete closed roller shutter', '39 slats, 4.62 × 2.62 m, tracks, hood, pull handle and bottom bar');

  const forecourtState = await page.evaluate(() => {
    const { landscape } = window.__scene;
    const forecourt = landscape.getObjectByName('forecourt');
    const vehicle = landscape.getObjectByName('silver-minivan');
    const landmarkNames = [
      'weathered-concrete-courtyard',
      'winding-village-lane',
      'off-white-repaired-cracks',
      'red-brick-boundary-wall',
      'open-green-rubbish-bin',
      'white-tarp-covered-material-pile',
      'roadside-green-tarpaulin',
      'village-pole-lamp-and-overhead-wires',
    ];
    const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    const localBounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    vehicle?.updateWorldMatrix(true, true);
    const inverseVehicleMatrix = vehicle?.matrixWorld.clone().invert();
    let vehicleMeshes = 0;
    const vehicleFeatures = [];
    vehicle?.traverse(object => {
      if (!object.isMesh) return;
      vehicleMeshes++;
      object.geometry.computeBoundingBox();
      for (let instance = 0; instance < (object.isInstancedMesh ? object.count : 1); instance++) {
        const worldMatrix = object.matrixWorld.clone();
        if (object.isInstancedMesh) {
          const instanceMatrix = object.matrix.clone();
          object.getMatrixAt(instance, instanceMatrix);
          worldMatrix.multiply(instanceMatrix);
        }
        const box = object.geometry.boundingBox.clone().applyMatrix4(worldMatrix);
        box.min.toArray().forEach((value, index) => { bounds.min[index] = Math.min(bounds.min[index], value); });
        box.max.toArray().forEach((value, index) => { bounds.max[index] = Math.max(bounds.max[index], value); });
        const localBox = object.geometry.boundingBox.clone().applyMatrix4(inverseVehicleMatrix.clone().multiply(worldMatrix));
        localBox.min.toArray().forEach((value, index) => { localBounds.min[index] = Math.min(localBounds.min[index], value); });
        localBox.max.toArray().forEach((value, index) => { localBounds.max[index] = Math.max(localBounds.max[index], value); });
      }
    });
    for (const name of [
      'sculpted-body', 'dark-wraparound-glazing', 'body-trim-and-sliding-door', 'silver-door-mirrors',
      'four-alloy-wheels', 'stamped-roof-ribs', 'classic-shuttle-front', 'rear-tailgate-and-lamps', 'jac-and-refine-badging',
      'vertical-slat-grille', 'four-opening-lower-intake', 'recessed-round-fog-lamps', 'five-spoke-alloy-centers',
    ]) {
      const feature = vehicle?.getObjectByName(name);
      const featureBounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      let meshCount = 0;
      feature?.traverse(object => {
        if (!object.isMesh) return;
        meshCount++;
        object.geometry.computeBoundingBox();
        const box = object.geometry.boundingBox.clone().applyMatrix4(inverseVehicleMatrix.clone().multiply(object.matrixWorld));
        box.min.toArray().forEach((value, axis) => { featureBounds.min[axis] = Math.min(featureBounds.min[axis], value); });
        box.max.toArray().forEach((value, axis) => { featureBounds.max[axis] = Math.max(featureBounds.max[axis], value); });
      });
      vehicleFeatures.push({ name, meshCount, bounds: featureBounds });
    }
    return {
      forecourtVisible: forecourt?.visible,
      landmarks: landmarkNames.map(name => ({ name, present: !!forecourt?.getObjectByName(name) })),
      vehiclePosition: vehicle?.position.toArray(),
      vehicleMeshes,
      vehicleBounds: bounds,
      vehicleDimensions: localBounds.max.map((value, axis) => value - localBounds.min[axis]),
      vehicleMetadata: vehicle?.userData,
      vehicleFeatures,
    };
  });
  assert.ok(forecourtState.forecourtVisible, 'The courtyard must be visible with the surrounding environment');
  for (const landmark of forecourtState.landmarks) {
    assert.ok(landmark.present, `The courtyard must include the photographed landmark: ${landmark.name}`);
  }
  assert.ok(forecourtState.vehicleMeshes > 8, 'The silver minivan must contain body, glazing and wheel geometry');
  assert.equal(forecourtState.vehiclePosition[0], -3.2);
  assert.equal(forecourtState.vehiclePosition[2], 14.5);
  assert.ok(forecourtState.vehicleBounds.max[0] < 6.08, 'Parked vehicle must clear the exterior staircase');
  assert.ok(forecourtState.vehicleBounds.min[2] > 10.78, 'Parked vehicle must remain beyond the staircase landing');
  passed('Forecourt environment and parked silver minivan', `${forecourtState.landmarks.length} photographed landmarks; vehicle clear of stairs`);
  assert.equal(forecourtState.vehicleMetadata?.vehicleMake, 'JAC');
  assert.equal(forecourtState.vehicleMetadata?.vehicleModel, '瑞风穿梭');
  const [vehicleWidth, vehicleHeight, vehicleLength] = forecourtState.vehicleDimensions;
  assert.ok(vehicleWidth > 2 && vehicleWidth < 2.3, `JAC width including mirrors must be plausible: ${vehicleWidth}`);
  assert.ok(vehicleHeight > 1.9 && vehicleHeight < 2.1, `JAC high roof must have a plausible height: ${vehicleHeight}`);
  assert.ok(vehicleLength > 4.95 && vehicleLength < 5.15, `JAC classic Shuttle body must have a plausible length: ${vehicleLength}`);
  passed('Parked vehicle matches JAC Refine Chuansuo proportions', `${vehicleLength.toFixed(3)} m long × ${vehicleWidth.toFixed(3)} m wide including mirrors × ${vehicleHeight.toFixed(3)} m high`);
  for (const feature of forecourtState.vehicleFeatures) {
    assert.ok(feature.meshCount > 0, `JAC recognizable feature must contain actual geometry: ${feature.name}`);
  }
  const featureBounds = name => forecourtState.vehicleFeatures.find(feature => feature.name === name).bounds;
  // This group also includes the longer bonnet seams back to z ≈ 1.43 m.
  assert.ok(featureBounds('classic-shuttle-front').min[2] > 1.3 && featureBounds('classic-shuttle-front').max[2] > 2.45, 'Classic JAC front details must remain ahead of the cabin and extend to the nose');
  assert.ok(featureBounds('rear-tailgate-and-lamps').max[2] < -2, 'Tailgate and rear lamps must sit at the rear of the vehicle');
  assert.ok(featureBounds('stamped-roof-ribs').min[1] > 1.8, 'Stamped ribs must be on the high roof');
  assert.ok(featureBounds('four-alloy-wheels').max[1] < .85, 'Wheels must stay below the passenger cabin');
  assert.ok(featureBounds('silver-door-mirrors').min[0] < -.95 && featureBounds('silver-door-mirrors').max[0] > .95, 'Both door mirrors must extend beyond the body');
  passed('JAC Chuansuo body details are modeled as visible geometry', 'High ribbed roof, side sliding door, mirrors, four wheels, classic front, tailgate and badging');
  const grille = featureBounds('vertical-slat-grille');
  const intake = featureBounds('four-opening-lower-intake');
  const fogLamps = featureBounds('recessed-round-fog-lamps');
  const alloyCenters = featureBounds('five-spoke-alloy-centers');
  for (const name of ['vertical-slat-grille', 'four-opening-lower-intake', 'recessed-round-fog-lamps']) {
    const bounds = featureBounds(name);
    assert.ok(bounds.min[2] > 2, `${name}: front detail must be mounted on the nose`);
    closeTo((bounds.min[0] + bounds.max[0]) / 2, 0, `${name}: front details must be symmetric`, .03);
  }
  assert.ok(intake.max[1] < grille.min[1], 'Broad lower intake must sit below the vertical-slat upper grille');
  assert.ok(intake.max[0] - intake.min[0] > grille.max[0] - grille.min[0], 'Lower bumper intake must be wider than the small upper grille');
  assert.ok(fogLamps.max[1] < grille.min[1] && fogLamps.min[0] < -.5 && fogLamps.max[0] > .5, 'Round fog lamps must occupy both lower bumper corners');
  assert.ok(alloyCenters.max[1] < .85 && alloyCenters.min[0] < -.75 && alloyCenters.max[0] > .75, 'Alloy centers must appear on wheels on both sides below the cabin');
  assert.ok(alloyCenters.min[2] < -1.3 && alloyCenters.max[2] > 1.3, 'Alloy centers must appear on both wheel axles');
  passed('Vehicle reference features occupy the correct body locations', 'Symmetric vertical grille, wider lower intake, recessed bumper fog lamps and alloy centers on all four wheels');

  for (const name of ['orbit', 'front', 'top', 'courtyard', 'reference']) {
    const before = await state();
    await page.locator(`[data-view="${name}"]`).click();
    await page.waitForFunction(view => document.querySelector(`[data-view="${view}"]`).getAttribute('aria-pressed') === 'true', name);
    const after = await state();
    assert.notDeepEqual(after.position, before.position, `${name} should change camera position`);
    assert.equal(after.autoRotate, false);
    if (name === 'front') {
      assert.ok(Math.abs(after.position[0] - after.target[0]) < 0.01, 'Front view should face the front elevation');
      await page.screenshot({ path: path.join(output, 'facade-aligned.png') });
    }
    if (name === 'top') assert.ok(after.position[1] - after.target[1] > 20, 'Aerial view should rise over the roof');
    if (name === 'courtyard') {
      assert.ok(after.target[2] - after.position[2] > 10, 'Courtyard view should look outward from the house along +Z');
      assert.ok(after.position[1] > after.target[1] + 5, 'Courtyard view should look down over the lane');
      await page.locator('[data-reference="1"]').click();
      await page.waitForFunction(() => {
        const img = document.getElementById('reference-image');
        return img.complete && img.naturalWidth > 1000 && img.currentSrc.endsWith('/references/courtyard.jpg');
      });
      await page.screenshot({ path: path.join(output, 'courtyard.png') });
      await page.locator('[data-reference="0"]').click();
    }
    passed(`Camera preset: ${name}`);
  }

  const photoPaths = ['reference.jpg', 'references/courtyard.jpg', 'references/boundary.jpg', 'references/lane.jpg'];
  const photoSources = [];
  for (let index = 0; index < photoPaths.length; index++) {
    await page.locator(`[data-reference="${index}"]`).click();
    await page.waitForFunction(({ index, path }) => {
      const img = document.getElementById('reference-image');
      return document.querySelector(`[data-reference="${index}"]`).getAttribute('aria-pressed') === 'true'
        && img.complete && img.naturalWidth > 1000 && img.currentSrc.endsWith(`/${path}`);
    }, { index, path: photoPaths[index] });
    const src = await page.locator('#reference-image').evaluate(img => img.currentSrc);
    photoSources.push(src);
    await page.locator('#reference-expand').click();
    assert.ok(await page.locator('#reference-dialog').evaluate(dialog => dialog.open && dialog.matches(':modal')), 'Reference should open in a native modal dialog');
    await page.waitForFunction(src => {
      const img = document.getElementById('reference-dialog-image');
      return img.complete && img.naturalWidth > 1000 && img.currentSrc === src;
    }, src);
    await page.locator('#reference-dialog-close').click();
    assert.equal(await page.locator('#reference-dialog').evaluate(dialog => dialog.open), false);
  }
  assert.equal(new Set(photoSources).size, 4, 'Each gallery tab must load a distinct photograph');
  await page.locator('[data-reference="0"]').click();
  passed('Four reference photographs switch, enlarge and close', 'Original building plus courtyard, boundary and village lane');

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
  const mobileControls = ['#capture', '#export-model', '#auto-rotate', '#settings-toggle', ...['reference', 'orbit', 'front', 'courtyard', 'top'].map(name => `[data-view="${name}"]`)];
  for (const selector of mobileControls) {
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
  const report = { baseURL, checkedAt: new Date().toISOString(), browser: browser.version(), checks, errors, warnings: [...new Set(warnings)], artifacts: ['desktop.png', 'facade-aligned.png', 'courtyard.png', 'mobile.png', 'mobile-settings.png', 'scene.png', 'mountain-home.glb'] };
  await writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(`Verified ${checks.length} checks. Artifacts saved to ${output}`);
} catch (error) {
  await page.screenshot({ path: path.join(output, 'verification-failure.png') }).catch(() => {});
  await writeFile(path.join(output, 'verification.json'), JSON.stringify({ baseURL, checkedAt: new Date().toISOString(), checks, errors, warnings: [...new Set(warnings)], failure: error.stack }, null, 2));
  throw error;
} finally {
  await browser.close();
}
