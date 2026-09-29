import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createForecourt } from './forecourt.js';

// The clearing continues into a wooded slope; all foliage is drawn in batches.
export function createLandscape(THREE) {
  const group = new THREE.Group();
  group.name = 'landscape';
  let state = 41973;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const between = (a, b) => a + random() * (b - a);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  function noiseTexture(base, spread, size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const pixels = ctx.createImageData(size, size);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const n = between(-spread, spread);
      pixels.data[i] = base[0] + n;
      pixels.data[i + 1] = base[1] + n;
      pixels.data[i + 2] = base[2] + n;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.colorSpace = THREE.SRGBColorSpace;
    map.repeat.set(26, 26);
    return map;
  }

  const earthMap = noiseTexture([90, 91, 62], 24);
  const earthMaterial = new THREE.MeshStandardMaterial({ map: earthMap, roughness: 1, color: 0xa4aa89 });
  const terrainGeo = new THREE.PlaneGeometry(180, 180, 110, 110);
  terrainGeo.rotateX(-Math.PI / 2);
  const terrainPositions = terrainGeo.attributes.position;
  for (let i = 0; i < terrainPositions.count; i++) {
    const x = terrainPositions.getX(i), z = terrainPositions.getZ(i);
    const distance = Math.max(Math.abs(x) - 9, Math.abs(z - 2) - 12, 0);
    let y = -0.15 - Math.min(2.4, distance * 0.07);
    y += Math.min(distance * 0.04, 1.4) * (Math.sin(x * 0.19) * Math.cos(z * 0.14));
    const villageClearing = Math.max(0, Math.min(1, (z - 3) / 6, (59 - z) / 6, (27 - Math.abs(x)) / 4));
    y += (-.15 - y) * villageClearing;
    terrainPositions.setY(i, y);
  }
  terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeo, earthMaterial);
  terrain.receiveShadow = true;
  group.add(terrain);

  // Weathered cement around the house, with fine aggregate and long faint seams.
  const cementMap = noiseTexture([166, 164, 150], 15, 512);
  cementMap.repeat.set(5, 6);
  const cementMaterial = new THREE.MeshStandardMaterial({ color: 0xc9c8bb, map: cementMap, roughness: 0.97, bumpMap: cementMap, bumpScale: 0.025 });
  const courtyard = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.14, 11.4), cementMaterial);
  courtyard.name = 'house-side-concrete-apron';
  courtyard.position.set(0.5, -0.03, -1.35);
  courtyard.receiveShadow = true;
  group.add(courtyard);
  group.add(createForecourt(THREE));

  // A broad, distant ridge, partially hidden by the nearer treeline.
  function ridge(x, z, width, depth, height, phase) {
    const geo = new THREE.PlaneGeometry(width, depth, 40, 22);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), pz = p.getZ(i);
      const envelopeX = Math.max(0, Math.cos(px / width * Math.PI));
      const envelopeZ = Math.max(0, Math.cos(pz / depth * Math.PI));
      p.setY(i, -3 + height * Math.pow(envelopeX, 0.85) * Math.pow(envelopeZ, 0.75) + Math.sin(px * 0.13 + phase) * 0.9 * envelopeZ);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x486445, roughness: 1, map: earthMap }));
    mesh.position.set(x, 0, z);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  ridge(-22, -52, 115, 72, 13, 1.2);
  ridge(43, -66, 92, 80, 16, 4.1);

  function instanced(geometry, material, data, shadows = true) {
    if (!data.length) return;
    const mesh = new THREE.InstancedMesh(geometry, material, data.length);
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      dummy.position.set(...item.position);
      dummy.rotation.set(...(item.rotation || [0, 0, 0]));
      dummy.scale.set(...(item.scale || [1, 1, 1]));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (item.color) mesh.setColorAt(i, color.set(item.color));
    }
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
    return mesh;
  }

  const trunks = [], branches = [], crowns = [], leaves = [];
  const bark = new THREE.MeshStandardMaterial({ color: 0x363b2c, roughness: 1 });
  // Dappled leaf-sized detail keeps the continuous crown from reading as a ball.
  // This reusable atlas is generated locally, with no downloaded foliage assets.
  const canopyCanvas = document.createElement('canvas');
  canopyCanvas.width = canopyCanvas.height = 512;
  const canopyCtx = canopyCanvas.getContext('2d');
  canopyCtx.fillStyle = '#727b64';
  canopyCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 170; i++) {
    const x = between(0, 512), y = between(0, 512), radius = between(10, 48);
    const shadow = canopyCtx.createRadialGradient(x, y, 0, x, y, radius);
    shadow.addColorStop(0, 'rgba(22,29,18,0.70)');
    shadow.addColorStop(1, 'rgba(34,42,26,0)');
    canopyCtx.fillStyle = shadow;
    canopyCtx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  for (let i = 0; i < 14500; i++) {
    const x = between(0, 512), y = between(0, 512);
    const shade = Math.floor(between(92, 214));
    const length = between(1.7, 5.0), width = length * between(.35, .62);
    const angle = between(0, Math.PI);
    canopyCtx.fillStyle = `rgb(${shade - 7},${shade},${shade - 15})`;
    canopyCtx.beginPath();
    canopyCtx.ellipse(x, y, length, width, angle, 0, Math.PI * 2);
    canopyCtx.fill();
    if (i % 3 === 0) {
      canopyCtx.fillStyle = `rgba(226,235,208,${between(.10, .22)})`;
      canopyCtx.beginPath();
      canopyCtx.ellipse(x - .6, y - .65, length * .7, width * .36, angle, 0, Math.PI * 2);
      canopyCtx.fill();
    }
  }
  const canopyMap = new THREE.CanvasTexture(canopyCanvas);
  canopyMap.colorSpace = THREE.SRGBColorSpace;
  canopyMap.wrapS = canopyMap.wrapT = THREE.RepeatWrapping;
  canopyMap.repeat.set(2, 1);
  canopyMap.anisotropy = 8;
  const canopyBump = canopyMap.clone();
  canopyBump.colorSpace = THREE.NoColorSpace;
  const canopyMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: canopyMap, bumpMap: canopyBump,
    bumpScale: .095, roughness: .98,
  });
  const treePalette = [0x294426, 0x304b29, 0x3b532b, 0x354e2a, 0x30542c, 0x253f29, 0x455b31, 0x344b2a];
  const twigGeometry = new THREE.CylinderGeometry(0.7, 1, 1, 5);
  const canopySource = new THREE.IcosahedronGeometry(1, 2);
  canopySource.deleteAttribute('normal');
  const canopyGeometry = mergeVertices(canopySource);
  canopySource.dispose();
  const cpos = canopyGeometry.attributes.position;
  for (let i = 0; i < cpos.count; i++) {
    const x = cpos.getX(i), y = cpos.getY(i), z = cpos.getZ(i);
    const r = 1 + 0.11 * Math.sin(x * 5.7 + z * 4.8) * Math.cos(y * 6.2 - z * 4.1) + 0.035 * Math.sin(x * 19 + y * 13);
    cpos.setXYZ(i, x * r, y * r, z * r);
  }
  // Weld shared vertices before averaging; a nonindexed shell would shade
  // every triangle separately. A radial blend also hides the UV seam.
  canopyGeometry.computeVertexNormals();
  const canopyNormals = canopyGeometry.attributes.normal;
  const smoothNormal = new THREE.Vector3();
  for (let i = 0; i < cpos.count; i++) {
    const x = cpos.getX(i), y = cpos.getY(i), z = cpos.getZ(i);
    const length = Math.hypot(x, y, z);
    smoothNormal.set(
      x / length * .65 + canopyNormals.getX(i) * .35,
      y / length * .65 + canopyNormals.getY(i) * .35,
      z / length * .65 + canopyNormals.getZ(i) * .35,
    ).normalize();
    canopyNormals.setXYZ(i, smoothNormal.x, smoothNormal.y, smoothNormal.z);
  }

  // Leaf clusters cut out from a small, hand-drawn atlas make canopy silhouettes ragged.
  const leafCanvas = document.createElement('canvas');
  leafCanvas.width = leafCanvas.height = 128;
  const lctx = leafCanvas.getContext('2d');
  for (let i = 0; i < 105; i++) {
    const angle = between(0, Math.PI * 2), radius = Math.sqrt(random()) * 47;
    const px = 64 + Math.cos(angle) * radius, py = 64 + Math.sin(angle) * radius;
    lctx.save();
    lctx.translate(px, py);
    lctx.rotate(between(0, Math.PI));
    const shade = Math.floor(between(134, 222));
    lctx.fillStyle = `rgb(${shade - 9},${shade},${shade - 20})`;
    lctx.beginPath();
    lctx.ellipse(0, 0, between(2.5, 6.3), between(1.2, 3.0), 0, 0, Math.PI * 2);
    lctx.fill();
    lctx.restore();
  }
  const leafMap = new THREE.CanvasTexture(leafCanvas);
  leafMap.colorSpace = THREE.SRGBColorSpace;
  const leafMaterial = new THREE.MeshStandardMaterial({ map: leafMap, color: 0xffffff, alphaTest: 0.5, roughness: 1, side: THREE.DoubleSide });

  function tree(x, z, height, radius, distant = false) {
    const y = distant ? -0.8 + Math.max(0, -z - 25) * 0.12 : -0.7;
    const treeColor = treePalette[Math.floor(random() * treePalette.length)];
    trunks.push({ position: [x, y + height * 0.44, z], scale: [height * 0.026, height * 0.88, height * 0.026], rotation: [between(-0.06, 0.06), 0, between(-0.07, 0.07)] });
    for (let b = 0; b < 3; b++) {
      const angle = b * Math.PI * 2 / 3 + random();
      branches.push({ position: [x + Math.cos(angle) * radius * 0.27, y + height * 0.61, z + Math.sin(angle) * radius * 0.27], scale: [height * 0.013, height * 0.35, height * 0.013], rotation: [Math.sin(angle) * 0.65, 0, -Math.cos(angle) * 0.65] });
    }
    for (let c = 0; c < (distant ? 7 : 16); c++) {
      const angle = random() * Math.PI * 2;
      const r = radius * Math.sqrt(random()) * 0.75;
      const cx = x + Math.cos(angle) * r, cz = z + Math.sin(angle) * r;
      const cy = y + height * 0.78 + between(-0.32, 0.27) * radius;
      const scale = radius * between(0.34, 0.58);
      color.setHex(treeColor).multiplyScalar(between(0.84, 1.12));
      crowns.push({ position: [cx, cy, cz], scale: [scale * between(0.9, 1.3), scale * between(0.67, 0.92), scale], rotation: [random(), random() * 3, random()], color: color.getHex() });
      if (!distant) {
        for (let k = 0; k < 10; k++) {
          const a = random() * Math.PI * 2;
          const elevation = between(-0.6, 1);
          color.setHex(treeColor).multiplyScalar(between(1.05, 1.4));
          leaves.push({ position: [cx + Math.cos(a) * scale * 0.91, cy + elevation * scale * 0.65, cz + Math.sin(a) * scale * 0.91], scale: [scale * .95, scale * .95, 1], rotation: [between(-1.3, 1.3), a, between(-0.8, 0.8)], color: color.getHex() });
        }
      }
    }
  }

  // Front and stair access remain open; forest hugs the remaining three sides.
  for (let i = 0; i < 72; i++) {
    let x, z;
    if (i < 24) { x = between(-30, -11); z = between(-23, 12); }
    else if (i < 51) { x = between(-20, 24); z = between(-31, -9); }
    else { x = between(13.2, 32); z = between(-26, 5); }
    tree(x, z, between(6.5, 11.6), between(2, 3.8));
  }
  for (let i = 0; i < 90; i++) {
    tree(between(-58, 64), between(-65, -28), between(5.5, 9.5), between(2.1, 4), true);
  }
  // The reference photographs show a green corridor around the entrance lane.
  // Keep the closest east-side trees below the original elevated house camera.
  for (const [x, z, height, radius] of [
    [8.6, 16.9, 5.5, 2.3], [8.8, 21.7, 6.4, 2.7], [10.2, 26.5, 6.8, 3.0],
    [-8.3, 17.8, 6.5, 2.6], [-8.7, 22.8, 7.7, 3.1], [-7.1, 27.2, 7.2, 2.5],
    [6.8, 30.7, 8.1, 2.8], [-5.2, 34.3, 7.7, 2.7], [7.2, 37.1, 7.0, 2.6],
    [-5.6, 41.3, 7.1, 2.6], [7.3, 44.9, 6.4, 2.7],
  ]) tree(x, z, height, radius);
  for (let i = 0; i < 28; i++) {
    const side = i % 2 ? -1 : 1;
    tree(side * between(12, 25), between(19, 53), between(6.3, 9.5), between(2.3, 3.5), true);
  }
  instanced(twigGeometry, bark, trunks);
  instanced(twigGeometry, bark, branches);
  instanced(canopyGeometry, canopyMaterial, crowns);
  instanced(new THREE.PlaneGeometry(1, 1), leafMaterial, leaves, false);

  // Bamboo at the right edge: straight jointed culms and sprays of thin leaves.
  const bambooStems = [], bambooRings = [], bambooLeaves = [];
  const bambooPalette = [0x2f4a2d, 0x3c542f, 0x2c4429, 0x455c32];
  const bambooLeafGeo = new THREE.SphereGeometry(1, 5, 3);
  for (let i = 0; i < 54; i++) {
    const x = between(13.4, 18.2), z = between(-9, 9.3);
    const height = z > 2.5 ? between(3.8, 6.5) : between(5.5, 9);
    const lean = between(-0.12, 0.12);
    bambooStems.push({ position: [x, height * 0.5 - 1, z], scale: [0.026, height, 0.026], rotation: [lean * 0.6, 0, lean] });
    for (let y = 0.8; y < height - 0.4; y += 0.55) {
      bambooRings.push({ position: [x - Math.sin(lean) * (y - height * 0.5), y - 1, z], scale: [0.031, 0.028, 0.031] });
    }
    for (let j = 0; j < 42; j++) {
      const y = between(height * 0.4, height), angle = random() * Math.PI * 2, reach = between(0.2, 1.5);
      bambooLeaves.push({ position: [x + Math.cos(angle) * reach - Math.sin(lean) * height * 0.3, y - 1, z + Math.sin(angle) * reach], scale: [between(0.18, 0.37), 0.01, between(0.027, 0.05)], rotation: [between(-0.7, 0.7), angle, between(-0.65, 0.65)], color: bambooPalette[Math.floor(random() * bambooPalette.length)] });
    }
  }
  instanced(new THREE.CylinderGeometry(1, 1.1, 1, 5), new THREE.MeshStandardMaterial({ color: 0x30462b, roughness: 0.93 }), bambooStems);
  instanced(new THREE.CylinderGeometry(1, 1, 1, 5), new THREE.MeshStandardMaterial({ color: 0x496044, roughness: 0.95 }), bambooRings, false);
  instanced(bambooLeafGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96 }), bambooLeaves, false);

  const lowBushes = [];
  for (let i = 0; i < 165; i++) {
    const side = random() < 0.5 ? -1 : 1;
    const x = side < 0 ? between(-13.5, -9.2) : between(10.2, 14.7);
    const z = between(-3, 14), size = between(0.35, 0.95);
    lowBushes.push({ position: [x, size * 0.3 - 0.12, z], scale: [size * 1.3, size, size], rotation: [0, random() * 6, 0], color: treePalette[Math.floor(random() * treePalette.length)] });
  }
  // Young trees fill the space below the crowns, as in an unmanaged hillside.
  for (let i = 0; i < 205; i++) {
    let x, z;
    if (i < 90) { x = between(-24, -10.5); z = between(-19, 11); }
    else if (i < 156) { x = between(-21, 24); z = between(-22, -8.2); }
    else { x = between(12.7, 23); z = between(-17, 7); }
    const size = between(0.9, 1.95);
    lowBushes.push({ position: [x, between(0.5, 3.1), z], scale: [size * 1.2, size, size], rotation: [between(-0.3, 0.3), random() * 6, 0], color: treePalette[Math.floor(random() * treePalette.length)] });
  }
  for (let i = 0; i < 64; i++) {
    const side = i % 2 ? -1 : 1, z = between(15, 47);
    const edge = z < 26 ? between(7.1, 10) : between(5, 8.5);
    const size = between(.45, 1.25);
    lowBushes.push({ position: [side * edge, size * .6 - .18, z], scale: [size * 1.2, size, size], rotation: [0, random() * 6, 0], color: treePalette[Math.floor(random() * treePalette.length)] });
  }
  instanced(canopyGeometry, canopyMaterial, lowBushes);

  // Small signs of an occupied rural house: stacked red bricks, planks, and pots.
  const bricks = [];
  for (let layer = 0; layer < 7; layer++) {
    for (let row = 0; row < 3; row++) {
      for (let n = 0; n < 5; n++) {
        if (layer > 4 && random() > 0.66) continue;
        color.setHex([0x995e43, 0xa66c50, 0xb27b5b, 0x89503c][Math.floor(random() * 4)]);
        bricks.push({ position: [-6.95 + n * 0.28 + (layer % 2) * 0.13, 0.11 + layer * 0.11, 6.3 + row * 0.16], scale: [0.265, 0.10, 0.145], rotation: [0, between(-0.03, 0.03), 0], color: color.getHex() });
      }
    }
  }
  for (let i = 0; i < 12; i++) bricks.push({ position: [between(-7.8, -5.6), 0.1, between(7, 8.4)], scale: [0.26, 0.11, 0.15], rotation: [0, random() * 4, 0], color: 0xa26c50 });
  instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), bricks);
  const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x9b8255, roughness: 1 });
  for (let i = 0; i < 5; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.055, 2.4 + random()), woodMaterial);
    plank.position.set(-6.55 + i * 0.16, 0.08 + i * 0.02, 8.9);
    plank.rotation.y = -0.35;
    plank.castShadow = true;
    group.add(plank);
  }
  for (const [x, z, radius] of [[-4.5, 5.3, 0.24], [-4.0, 5.4, 0.18], [4.8, 5.2, 0.2]]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.72, radius * 1.5, 10), new THREE.MeshStandardMaterial({ color: 0x888878, roughness: 0.95 }));
    pot.position.set(x, 0.08 + radius * 0.75, z);
    pot.castShadow = true;
    group.add(pot);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.88, radius * 0.88, 0.025, 10), new THREE.MeshStandardMaterial({ color: 0x39362a, roughness: 1 }));
    soil.position.set(x, 0.09 + radius * 1.5, z);
    group.add(soil);
    const plant = new THREE.Mesh(canopyGeometry, new THREE.MeshStandardMaterial({ color: 0x435b32, roughness: 1 }));
    plant.scale.set(radius * 1.1, radius * 1.8, radius);
    plant.position.set(x, radius * 2.6, z);
    group.add(plant);
  }
  return group;
}
