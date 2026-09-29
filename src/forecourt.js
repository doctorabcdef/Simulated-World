// The extra references look outward from the balcony (+Z). Their left edge is +X.
// Everything here uses the same metre scale as the house and is generated locally.
export function createForecourt(THREE) {
  const court = new THREE.Group();
  court.name = 'forecourt';
  let seed = 630219;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const range = (a, b) => a + (b - a) * random();
  const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .95, ...extra });
  const wood = material(0x69513b);
  const mortar = material(0x938b7b);
  const dark = material(0x262c24);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  function mesh(name, geometry, mat, position = [0, 0, 0], parent = court) {
    const object = new THREE.Mesh(geometry, mat);
    object.name = name;
    object.position.set(...position);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  const box = (name, size, mat, position, parent) => mesh(name, new THREE.BoxGeometry(...size), mat, position, parent);
  function batch(name, geometry, mat, instances, shadows = true) {
    const object = new THREE.InstancedMesh(geometry, mat, instances.length);
    object.name = name;
    instances.forEach((item, i) => {
      dummy.position.set(...item.position);
      dummy.rotation.set(...(item.rotation || [0, 0, 0]));
      dummy.scale.set(...(item.scale || [1, 1, 1]));
      dummy.updateMatrix();
      object.setMatrixAt(i, dummy.matrix);
      if (item.color !== undefined) object.setColorAt(i, tint.set(item.color));
    });
    object.castShadow = shadows;
    object.receiveShadow = true;
    object.instanceMatrix.needsUpdate = true;
    court.add(object);
    return object;
  }
  function paintedTexture(size, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    draw(canvas.getContext('2d'), size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    return texture;
  }
  const concreteMap = paintedTexture(1024, (ctx, s) => {
    ctx.fillStyle = '#b0ab99'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 210; i++) {
      const x = range(0, s), y = range(0, s), radius = range(18, 240);
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
        const px = x + ox, py = y + oy;
        if (px + radius < 0 || px - radius > s || py + radius < 0 || py - radius > s) continue;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
        grad.addColorStop(0, i % 3 ? 'rgba(95,86,63,.14)' : 'rgba(223,219,199,.27)');
        grad.addColorStop(1, 'rgba(150,145,126,0)');
        ctx.fillStyle = grad; ctx.fillRect(px - radius, py - radius, radius * 2, radius * 2);
      }
    }
    // Broad irregular gray wear and ochre damp marks continue across texture edges.
    ctx.save();
    ctx.filter = 'blur(18px)';
    for (let i = 0; i < 13; i++) {
      const x = range(0, s), y = range(0, s), rx = range(65, 180), ry = range(90, 270);
      const outline = Array.from({ length: 48 }, (_, n) => {
        const a = n / 48 * Math.PI * 2, r = 1 + .13 * Math.sin(a * 5 + i) + .065 * Math.cos(a * 11 + i);
        return [Math.cos(a) * rx * r, Math.sin(a) * ry * r];
      });
      ctx.fillStyle = i % 3 ? 'rgba(90,97,91,.105)' : 'rgba(137,97,47,.10)';
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
        ctx.beginPath(); outline.forEach(([px, py], n) => n ? ctx.lineTo(x + ox + px, y + oy + py) : ctx.moveTo(x + ox + px, y + oy + py));
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
    const pixels = ctx.getImageData(0, 0, s, s);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const n = range(-13, 13);
      pixels.data[i] += n; pixels.data[i + 1] += n; pixels.data[i + 2] += n;
    }
    ctx.putImageData(pixels, 0, 0);
    for (let i = 0; i < 6500; i++) {
      ctx.fillStyle = i % 3 ? 'rgba(62,65,54,.12)' : 'rgba(238,235,217,.22)';
      ctx.fillRect(range(0, s), range(0, s), range(.4, 1.8), range(.4, 1.8));
    }
  });
  function groundShape(name, polygon, mat, height = .047) {
    const shape = new THREE.Shape();
    polygon.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    const p = geometry.attributes.position, uv = geometry.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 12, p.getZ(i) / 16);
    const object = mesh(name, geometry, mat, [0, height, 0]);
    object.castShadow = false;
    return object;
  }
  const cement = material(0xe0dace, { map: concreteMap, bumpMap: concreteMap, bumpScale: .027 });
  // Broad stair landing, then the long forecourt and a narrower village lane.
  groundShape('weathered-concrete-courtyard', [
    [-8.8, 4.35], [9.8, 4.35], [9.8, 10.8], [7.2, 11.1], [5.4, 13.1],
    [5.4, 21.8], [4.9, 24], [3.1, 27], [.9, 28], [-2.5, 27], [-4.3, 24],
    [-5.55, 21.5], [-5.55, 12], [-8.8, 11.1],
  ], cement);
  groundShape('winding-village-lane', [
    [-2.5, 27], [.9, 28], [.9, 30.5], [2.2, 33.1], [3.5, 35.6],
    [3.7, 40], [3.1, 44], [2.4, 48.5], [-.5, 48.5], [.1, 43.8],
    [.6, 40.1], [.5, 36.1], [-.6, 34.2], [-2.3, 31.4],
  ], material(0xd5d7cc, { map: concreteMap, bumpMap: concreteMap, bumpScale: .022 }));
  groundShape('red-soil-road-shoulder', [
    [-5.55, 11.8], [-5.55, 21.5], [-4.3, 24], [-2.5, 27], [-2.3, 31.4],
    [-4.2, 32.8], [-5.2, 27.5], [-6.7, 24.2], [-7.7, 20], [-7.5, 12],
  ], material(0x9d6446, { map: concreteMap, bumpMap: concreteMap, bumpScale: .065 }), .043);

  // A flat, irregular sealant ribbon (not a raised cable) follows the repaired crack.
  const repairs = new THREE.Group(); repairs.name = 'off-white-repaired-cracks'; court.add(repairs);
  function ribbon(name, points, width, mat, parent = repairs, y = .054) {
    if (parent === repairs) {
      const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', .22);
      points = curve.getPoints((points.length - 1) * 5).map(p => [p.x + range(-.012, .012), p.z]);
    }
    const positions = [], indices = [];
    points.forEach(([x, z], i) => {
      const previous = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
      const dx = next[0] - previous[0], dz = next[1] - previous[1];
      const length = Math.hypot(dx, dz) || 1, radius = width * range(.36, .64);
      positions.push(x - dz / length * radius, y, z + dx / length * radius, x + dz / length * radius, y, z - dx / length * radius);
      if (i) { const j = i * 2; indices.push(j - 2, j, j - 1, j - 1, j, j + 1); }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const object = mesh(name, geometry, mat, [0, 0, 0], parent); object.castShadow = false;
  }
  const sealant = material(0xdfe3ca, { side: THREE.DoubleSide });
  const mainCrack = [[-.9, 8.9], [-.8, 10.3], [-.6, 11.1], [-.8, 11.8], [-.3, 12.7], [-.5, 13.4], [-.2, 14], [-.1, 14.8], [.13, 15.6], [-.05, 16.3], [.18, 17.1], [.38, 17.7], [.18, 18.5], [.45, 19.2], [.52, 20.1], [.8, 21.1], [.74, 21.9], [1.18, 22.8], [1.7, 23.8], [1.35, 24.4], [1.75, 25.2], [1.8, 26.6]];
  // A little sub-metre wandering gives the characteristic hand-filled edges.
  const jagged = mainCrack.flatMap((p, i) => i === mainCrack.length - 1 ? [p] : [p, [(p[0] + mainCrack[i + 1][0]) / 2 + range(-.07, .07), (p[1] + mainCrack[i + 1][1]) / 2]]);
  ribbon('central-repair-seam', jagged, .083, sealant);
  ribbon('repair-branch-near-van', [[-.5, 13.4], [-1.0, 13.8], [-1.1, 14.4], [-1.65, 14.7], [-1.9, 14.1], [-1.55, 13.6], [-.5, 13.4]], .064, sealant);
  ribbon('repair-branch-mid-court', [[.38, 17.7], [.76, 18], [.8, 18.5], [.45, 19.2]], .065, sealant);
  ribbon('repair-branch-under-tree', [[.8, 21.1], [-.1, 21.6], [-.6, 22.3], [-.75, 23], [-1.3, 23.3], [-1.35, 22.4], [-.9, 22.3], [-.75, 21.8]], .075, sealant);
  const joint = material(0x777b6e, { side: THREE.DoubleSide });
  for (const z of [11.3, 16.4, 21.5]) ribbon('concrete-expansion-joint', [[-5.5, z], [5.35, z + .13]], .012, joint, court, .052);

  const brickGroup = new THREE.Group(); brickGroup.name = 'red-brick-boundary-wall'; court.add(brickGroup);
  box('old-mortar-core', [.34, 1.4, 11.5], mortar, [5.63, .74, 18.5], brickGroup);
  const bricks = [];
  const brickColors = [0x995d48, 0xa56b53, 0x8f5744, 0xad755e, 0x825944, 0xa0644c, 0xb57f65];
  for (let row = 0; row < 13; row++) {
    for (let column = 0; column < 39; column++) {
      if (row > 10 && column > 17 && column < 25) continue;
      const z = 12.85 + column * .292 + (row % 2) * .143;
      bricks.push({ position: [5.63 + range(-.017, .017), .105 + row * .115, z], scale: [.385, .102, .277], color: brickColors[Math.floor(random() * brickColors.length)] });
    }
  }
  for (const z of [12.9, 18.25, 24.1]) {
    box('brick-pier-mortar', [.53, 1.75, .53], mortar, [5.66, .91, z], brickGroup);
    for (let row = 0; row < 15; row++) {
      for (let n = 0; n < 2; n++) bricks.push({ position: [5.66 + (row % 2 ? (n - .5) * .28 : 0), .11 + row * .115, z + (row % 2 ? 0 : (n - .5) * .28)], scale: row % 2 ? [.26, .102, .57] : [.57, .102, .26], color: brickColors[Math.floor(random() * brickColors.length)] });
    }
  }
  for (let row = 0; row < 6; row++) for (let n = 0; n < 6 - Math.floor(row / 2); n++) {
    bricks.push({ position: [5.07 + (n % 2) * .29, .115 + row * .115, 18.92 + Math.floor(n / 2) * .3], scale: [.27, .105, .27], color: brickColors[Math.floor(random() * brickColors.length)] });
  }
  for (let i = 0; i < 24; i++) bricks.push({ position: [range(-7, -5.85), .1, range(14, 24)], scale: [.26, .105, .14], rotation: [0, range(0, 3), range(-.08, .08)], color: brickColors[Math.floor(random() * brickColors.length)] });
  const brickMesh = batch('individual-weathered-red-bricks', new THREE.BoxGeometry(1, 1, 1), material(0xffffff), bricks);
  brickGroup.attach(brickMesh);
  const sheetGeo = new THREE.PlaneGeometry(.92, 6.8, 24, 1);
  const sp = sheetGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) sp.setZ(i, Math.sin(sp.getX(i) * 90) * .017);
  sheetGeo.rotateX(-Math.PI / 2); sheetGeo.computeVertexNormals();
  const cover = mesh('blue-corrugated-wall-cover', sheetGeo, material(0x4c788b, { metalness: .25, roughness: .8, side: THREE.DoubleSide }), [5.88, 1.87, 15.9]);
  cover.rotation.z = -.06;
  box('board-on-blue-sheet', [.12, .055, 2.4], wood, [5.84, 1.96, 16.2]);

  const tarpMap = paintedTexture(512, (ctx, s) => {
    ctx.fillStyle = '#c8c9bf'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 680; i++) {
      const x = range(0, s), y = range(0, s);
      ctx.strokeStyle = i % 2 ? 'rgba(55,60,52,.27)' : 'rgba(255,255,240,.45)';
      ctx.lineWidth = range(.4, 2.1); ctx.beginPath(); ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + range(-15, 15), y + 15, x + range(-20, 20), y + 35, x + range(-30, 30), y + range(45, 120)); ctx.stroke();
    }
  });
  const pileGeo = new THREE.SphereGeometry(1, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  const pileP = pileGeo.attributes.position;
  for (let i = 0; i < pileP.count; i++) {
    const x = pileP.getX(i), y = pileP.getY(i), z = pileP.getZ(i);
    const fold = 1 + .035 * Math.sin(Math.atan2(z, x) * 19) * (1 - y);
    pileP.setXYZ(i, x * fold, y + .016 * Math.sin(x * 13 + z * 8) * Math.min(1, y * 7), z * fold);
  }
  pileGeo.computeVertexNormals();
  const pile = mesh('white-tarp-covered-material-pile', pileGeo, material(0xe1e0d6, { map: tarpMap, bumpMap: tarpMap, bumpScale: .075, side: THREE.DoubleSide }), [3.98, .058, 16.7]);
  pile.scale.set(1.2, .5, 1.55);
  const board = box('brown-board-on-tarp', [.26, .05, 1.25], wood, [3.92, .59, 16.74]); board.rotation.y = .65; board.rotation.z = -.06;
  box('rusty-pile-backboard', [1.65, .67, .055], material(0x7e3f2b), [4.25, .37, 18.29]);

  const bin = new THREE.Group(); bin.name = 'open-green-rubbish-bin'; bin.position.set(4.69, .06, 14.77); bin.rotation.y = -.13; court.add(bin);
  const green = material(0x087b61, { roughness: .7 });
  box('bin-front', [.66, .85, .065], green, [0, .46, -.31], bin);
  box('bin-back', [.66, .85, .065], green, [0, .46, .31], bin);
  for (const x of [-.3, .3]) box('bin-side', [.065, .85, .59], green, [x, .46, 0], bin);
  box('bin-inner-floor', [.6, .045, .6], material(0x164137), [0, .12, 0], bin);
  box('bin-upper-front-rim', [.73, .055, .085], green, [0, .9, -.32], bin);
  box('bin-upper-back-rim', [.73, .055, .085], green, [0, .9, .32], bin);
  for (const x of [-.34, .34]) box('bin-side-rim', [.065, .055, .68], green, [x, .9, 0], bin);
  const lid = box('bin-open-lid', [.73, .065, .65], green, [0, .97, .63], bin); lid.rotation.x = -.35;
  const binLabel = paintedTexture(128, ctx => {
    ctx.clearRect(0, 0, 128, 128); ctx.fillStyle = '#b1d4c1'; ctx.font = '68px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('♻', 64, 74); ctx.font = '16px sans-serif'; ctx.fillText('保持清洁', 64, 108);
  });
  mesh('bin-recycling-mark', new THREE.PlaneGeometry(.33, .36), material(0xffffff, { map: binLabel, transparent: true }), [0, .5, -.345], bin).rotation.y = Math.PI;
  for (const x of [-.26, .26]) mesh('bin-wheel', new THREE.CylinderGeometry(.085, .085, .055, 10), dark, [x, .09, .29], bin).rotation.z = Math.PI / 2;

  // Wrinkled green tarpaulin hangs at the opposite road shoulder.
  const greenSheet = new THREE.PlaneGeometry(1.8, 2.15, 14, 15);
  const gp = greenSheet.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setZ(i, Math.sin(gp.getX(i) * 11 + gp.getY(i) * 2) * .1 + Math.sin(gp.getY(i) * 16) * .018);
  greenSheet.computeVertexNormals();
  const greenTarp = mesh('roadside-green-tarpaulin', greenSheet, material(0x138c76, { side: THREE.DoubleSide, roughness: .78, map: tarpMap, bumpMap: tarpMap, bumpScale: .025 }), [-4.93, 1.19, 25.06]);
  greenTarp.rotation.y = 1.04;
  for (const [x, z] of [[-5.65, 25.55], [-4.13, 24.6]]) box('tarpaulin-support-post', [.085, 2.65, .085], wood, [x, 1.26, z]);
  groundShape('roadside-drain', [[-5.57, 12.5], [-5.57, 21.4], [-4.35, 23.95], [-4.65, 24.08], [-5.86, 21.5], [-5.86, 12.5]], dark, .047);
  for (let i = 0; i < 4; i++) box('drain-cover-slab', [.74, .1, .29], mortar, [-5.77, .094, 12.9 + i * .34]);

  // Bamboo culms mixed with hanging broad-leaf vines, above the brick wall.
  const stems = [], narrowLeaves = [], vineLeaves = [], vineStems = [];
  for (let i = 0; i < 25; i++) {
    const x = range(5.8, 7.15), z = range(19.3, 24.3), height = range(5, 7.4), lean = range(-.13, .13);
    stems.push({ position: [x, height / 2, z], scale: [.026, height, .026], rotation: [lean, 0, lean * .4] });
    for (let j = 0; j < 28; j++) {
      const angle = range(0, Math.PI * 2), radius = range(.2, 1.6), y = range(height * .55, height);
      narrowLeaves.push({ position: [x + Math.cos(angle) * radius, y, z + Math.sin(angle) * radius], scale: [range(.17, .32), .012, range(.025, .045)], rotation: [range(-.7, .7), angle, range(-.7, .7)], color: [0x385d36, 0x4b6935, 0x426530][j % 3] });
    }
  }
  batch('courtyard-bamboo-culms', new THREE.CylinderGeometry(.8, 1, 1, 5), material(0x737a49), stems);
  batch('courtyard-bamboo-leaves', new THREE.SphereGeometry(1, 5, 3), material(0xffffff), narrowLeaves, false);
  const vineShape = new THREE.Shape();
  [[0,.5],[-.11,.22],[-.36,.3],[-.3,.04],[-.5,-.05],[-.2,-.19],[-.23,-.4],[0,-.25],[.23,-.4],[.2,-.19],[.5,-.05],[.3,.04],[.36,.3],[.11,.22]].forEach(([x, y], i) => i ? vineShape.lineTo(x, y) : vineShape.moveTo(x, y));
  vineShape.closePath();
  for (let n = 0; n < 21; n++) {
    const x = range(4.95, 7.6), z = range(19, 24.8), top = range(5.4, 7.1), bottom = range(1.3, 4.3);
    const path = [];
    for (let y = bottom; y < top; y += .28) {
      const vx = x + Math.sin(y * 2 + n) * .14, vz = z + Math.cos(y * 1.4 + n) * .13;
      path.push(new THREE.Vector3(vx, y, vz));
      vineLeaves.push({ position: [vx + Math.sin(y * 8) * .15, y, vz], scale: [range(.24, .4), range(.29, .42), 1], rotation: [range(-.8, .8), n * 1.7 + y, range(-.7, .7)], color: [0x346847, 0x3d7551, 0x4d7d48, 0x426b3f][n % 4] });
    }
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], direction = b.clone().sub(a), midpoint = a.clone().add(b).multiplyScalar(.5);
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
      vineStems.push({ position: midpoint.toArray(), scale: [.008, direction.length(), .008], rotation: [dummy.rotation.x, dummy.rotation.y, dummy.rotation.z] });
    }
  }
  batch('hanging-vine-stems', new THREE.CylinderGeometry(1, 1, 1, 4), material(0x6c6d3c), vineStems, false);
  batch('hanging-lobed-vine-leaves', new THREE.ShapeGeometry(vineShape), material(0xffffff, { side: THREE.DoubleSide }), vineLeaves, false);

  const roofMap = paintedTexture(256, ctx => {
    ctx.fillStyle = '#695d50'; ctx.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 16; row++) for (let col = 0; col < 12; col++) {
      const x = col * 24 + (row % 2) * 12, y = row * 16;
      ctx.fillStyle = ['#736254', '#847467', '#62584e', '#958274'][Math.floor(random() * 4)];
      ctx.fillRect(x, y, 22, 14); ctx.strokeStyle = '#453f37'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.quadraticCurveTo(x + 11, y + 18, x + 22, y + 14); ctx.stroke();
    }
  });
  const roofMat = material(0xb0a498, { map: roofMap, bumpMap: roofMap, bumpScale: .09 });
  const plaster = material(0xdddcd0, { map: concreteMap, bumpMap: concreteMap, bumpScale: .022 });
  function neighbor(x, z, width, depth, height, rotation) {
    const home = new THREE.Group(); home.name = 'neighbor-whitewashed-tile-roof-house'; home.position.set(x, .01, z); home.rotation.y = rotation; court.add(home);
    box('neighbor-walls', [width, height, depth], plaster, [0, height / 2, 0], home);
    const rise = depth * .29, slope = Math.atan2(rise, depth / 2), roofLength = Math.hypot(depth / 2 + .35, rise + .16);
    for (const side of [-1, 1]) {
      const roof = box('neighbor-tiled-roof', [width + .75, .12, roofLength], roofMat, [0, height + rise / 2, side * (depth / 4 + .09)], home); roof.rotation.x = side * slope;
    }
    const gableShape = new THREE.Shape(); gableShape.moveTo(-depth / 2, 0); gableShape.lineTo(depth / 2, 0); gableShape.lineTo(0, rise); gableShape.closePath();
    for (const side of [-1, 1]) {
      const gable = mesh('neighbor-gable', new THREE.ShapeGeometry(gableShape), material(0xd9d9d1, { side: THREE.DoubleSide }), [side * width / 2, height, 0], home); gable.rotation.y = Math.PI / 2;
    }
    box('neighbor-ridge', [width + .85, .14, .19], material(0x796556), [0, height + rise + .02, 0], home);
    for (const wx of [-width * .3, width * .27]) {
      box('neighbor-window-frame', [1.04, 1.35, .1], material(0x787a70), [wx, height * .64, -depth / 2 - .04], home);
      box('neighbor-window-glass', [.86, 1.16, .025], material(0x384c48, { roughness: .26 }), [wx, height * .64, -depth / 2 - .105], home);
      box('neighbor-window-mullion', [.045, 1.16, .04], material(0xb0b5a8), [wx, height * .64, -depth / 2 - .13], home);
    }
    box('neighbor-door', [.96, 2.05, .07], material(0x696253), [.2, 1.04, -depth / 2 - .05], home);
  }
  neighbor(10.8, 35.5, 7.4, 5.4, 4.7, -.12);
  neighbor(-10.5, 39, 8.6, 6.4, 5.3, .09);
  neighbor(2.8, 53, 8.3, 5.7, 6.2, -.05);
  neighbor(19.2, 46.5, 6.8, 5.3, 4.5, .08);

  const utility = new THREE.Group(); utility.name = 'village-pole-lamp-and-overhead-wires'; court.add(utility);
  function cable(name, coords, radius, mat, parent = utility) {
    return mesh(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coords.map(p => new THREE.Vector3(...p))), 28, radius, 5, false), mat, [0, 0, 0], parent);
  }
  mesh('concrete-utility-pole', new THREE.CylinderGeometry(.11, .19, 10.2, 12), mortar, [-6.7, 5.06, 31], utility);
  box('utility-crossbar', [1.65, .1, .1], material(0x585e57), [-6.7, 9.82, 31], utility);
  for (let i = 0; i < 4; i++) {
    const x = -7.26 + i * .38;
    mesh('wire-insulator', new THREE.CylinderGeometry(.075, .075, .22, 8), material(0xb6c3bc), [x, 9.98, 31], utility);
    cable('overhead-power-line', [[-23, 9.7 + i * .04, 30], [-15, 8.9 + i * .035, 30.45], [x, 10.07, 31], [4, 9.0 + i * .025, 32], [16, 10 + i * .04, 34]], .016, dark);
  }
  cable('house-service-wire', [[-6.7, 9.55, 31], [-6.1, 6.3, 18], [-5.8, 7.3, 4.9]], .023, dark);
  const coil = mesh('coiled-cable-on-pole', new THREE.TorusGeometry(.39, .021, 5, 30), dark, [-6.76, 9.15, 30.8], utility); coil.rotation.y = -.45;
  const lampWhite = material(0xc4d6d3, { metalness: .25, roughness: .46 });
  mesh('white-village-streetlamp-post', new THREE.CylinderGeometry(.068, .1, 7.2, 10), lampWhite, [6.85, 3.6, 28.5], utility);
  cable('streetlamp-curved-arm', [[6.85, 6.6, 28.5], [6.75, 7.4, 28.5], [6.15, 8, 28.5], [5.55, 8.02, 28.5]], .057, lampWhite);
  cable('streetlamp-brace', [[6.85, 5.8, 28.5], [7.13, 6.5, 28.5], [6.85, 7.2, 28.5]], .033, lampWhite);
  const lamp = mesh('streetlamp-pale-blue-head', new THREE.SphereGeometry(1, 12, 8), lampWhite, [5.43, 7.99, 28.5], utility); lamp.scale.set(.4, .14, .2);
  return court;
}
