import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Classic long-wheelbase 瑞风穿梭, using the photographed car and 2011–2012
// Shuttle body: 5035 × 1820 × 1970 mm; 3080 mm wheelbase. Front +Z, ground Y=0.
export function createVehicle(THREE) {
  const vehicle = new THREE.Group();
  vehicle.name = 'silver-minivan';
  const materials = {
    paint: new THREE.MeshStandardMaterial({ color: '#aeb9c5', metalness: .68, roughness: .29 }),
    highlight: new THREE.MeshStandardMaterial({ color: '#c5cdd3', metalness: .72, roughness: .28 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#1c2225', roughness: .88 }),
    trim: new THREE.MeshStandardMaterial({ color: '#273036', metalness: .28, roughness: .47 }),
    glass: new THREE.MeshStandardMaterial({ color: '#173e38', metalness: .23, roughness: .18, envMapIntensity: .48, side: THREE.DoubleSide }),
    chrome: new THREE.MeshStandardMaterial({ color: '#c5cacf', metalness: .93, roughness: .22 }),
    red: new THREE.MeshStandardMaterial({ color: '#951c21', metalness: .15, roughness: .24, side: THREE.DoubleSide }),
    amber: new THREE.MeshStandardMaterial({ color: '#d58b3b', metalness: .12, roughness: .25, side: THREE.DoubleSide }),
    lamp: new THREE.MeshStandardMaterial({ color: '#d8e1df', metalness: .33, roughness: .16, side: THREE.DoubleSide }),
    plate: new THREE.MeshStandardMaterial({ color: '#284662', metalness: .15, roughness: .54 }),
    seam: new THREE.MeshStandardMaterial({ color: '#66747d', metalness: .46, roughness: .40 }),
  };
  const batches = new Map();
  let feature = 'sculpted-body';
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  function add(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
    const source = geometry.index ? geometry.toNonIndexed() : geometry;
    if (source !== geometry) geometry.dispose();
    for (const name of Object.keys(source.attributes)) if (name !== 'position' && name !== 'normal') source.deleteAttribute(name);
    if (!source.attributes.normal) source.computeVertexNormals();
    quaternion.setFromEuler(new THREE.Euler(...rotation));
    matrix.compose(new THREE.Vector3(...position), quaternion, new THREE.Vector3(...scale));
    source.applyMatrix4(matrix);
    const key = `${feature}:${material}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(source);
  }
  function box(w, h, d, x, y, z, material, rotation = [0, 0, 0]) {
    add(new THREE.BoxGeometry(w, h, d), material, [x, y, z], rotation);
  }
  function rod(a, b, radius, material, segments = 6) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.clone().sub(start);
    const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), segments);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, direction.normalize()));
    add(geometry, material, start.add(end).multiplyScalar(.5).toArray());
  }
  function polygon(points, material) {
    const vertices = [];
    for (let i = 1; i < points.length - 1; i++) vertices.push(...points[0], ...points[i], ...points[i + 1]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    add(geometry, material);
  }
  function outline(points, radius, material, closed = true) {
    for (let i = 1; i < points.length; i++) rod(points[i - 1], points[i], radius, material);
    if (closed) rod(points.at(-1), points[0], radius, material);
  }
  function curvedPanel(point, columns, rows, material) {
    const positions = [], indices = [];
    for (let v = 0; v <= rows; v++) for (let u = 0; u <= columns; u++) positions.push(...point(u / columns * 2 - 1, v / rows));
    for (let v = 0; v < rows; v++) for (let u = 0; u < columns; u++) {
      const a = v * (columns + 1) + u, b = a + 1, c = a + columns + 1, d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    add(geometry, material);
  }
  // Soft bevels, rounded bonnet, and genuine cut-outs over all four tires.
  const profile = new THREE.Shape();
  profile.moveTo(-2.43, .43);
  profile.lineTo(-2.445, 1.04);
  profile.quadraticCurveTo(-2.41, 1.17, -2.22, 1.17);
  profile.lineTo(1.56, 1.17);
  profile.quadraticCurveTo(1.98, 1.165, 2.27, 1.06);
  profile.quadraticCurveTo(2.43, 1.02, 2.45, .88);
  profile.lineTo(2.455, .50);
  profile.quadraticCurveTo(2.45, .44, 2.00, .43);
  profile.lineTo(1.94, .43);
  profile.bezierCurveTo(1.93, .97, 1.13, .97, 1.11, .43);
  profile.lineTo(-1.12, .43);
  profile.bezierCurveTo(-1.13, .97, -1.92, .97, -1.94, .43);
  profile.closePath();
  const body = new THREE.ExtrudeGeometry(profile, { depth: 1.71, bevelEnabled: true, bevelThickness: .045, bevelSize: .035, bevelSegments: 4, steps: 1, curveSegments: 10 });
  body.rotateY(-Math.PI / 2);
  body.translate(.855, 0, 0);
  // Wrap the nose around the front corners instead of leaving an extruded
  // flat front face behind the swept headlamp lenses.
  const bodyPositions = body.getAttribute('position');
  for (let i = 0; i < bodyPositions.count; i++) {
    const x = bodyPositions.getX(i), z = bodyPositions.getZ(i);
    if (z > 1.90) bodyPositions.setZ(i, z - .20 * Math.pow(Math.abs(x) / .91, 2) * Math.min(1, (z - 1.90) / .52));
    if (z < -2.20) bodyPositions.setZ(i, z + .063 * Math.pow(Math.abs(x) / .91, 2) * Math.min(1, (-z - 2.20) / .24));
  }
  // ExtrudeGeometry duplicates its face vertices; weld them before normal
  // generation so the bonnet and wheel-arch bevels are smoothly shaded.
  body.deleteAttribute('normal');
  body.deleteAttribute('uv');
  const smoothBody = mergeVertices(body, .0001);
  smoothBody.computeVertexNormals();
  body.dispose();
  add(smoothBody, 'paint');
  box(1.47, .15, 4.16, 0, .34, -.06, 'rubber');

  // Long H1-derived cabin, narrowing towards a gently crowned roof. The
  // front sections form the classic single continuous windscreen slope.
  const sections = [
    [-2.44, 1.36, .805], [-2.37, 1.67, .81], [-2.19, 1.865, .808],
    [-1.94, 1.933, .802], [-1.20, 1.949, .798], [.61, 1.949, .798],
    [.92, 1.921, .800], [1.16, 1.821, .810], [1.43, 1.539, .827], [1.84, 1.15, .861],
  ];
  const vertices = [], indices = [], ringSize = 13;
  for (const [z, top, roofWidth] of sections) {
    const ring = [
      [-.895, 1.10], [-.882, 1.17], [-roofWidth, top - .066],
      [-roofWidth + .018, top - .035], [-roofWidth + .065, top - .013],
      [-roofWidth * .60, top + .010], [0, top + .021],
      [roofWidth * .60, top + .010], [roofWidth - .065, top - .013],
      [roofWidth - .018, top - .035], [roofWidth, top - .066], [.882, 1.17], [.895, 1.10],
    ];
    for (const [x, y] of ring) vertices.push(x, y, z);
  }
  for (let s = 0; s < sections.length - 1; s++) for (let i = 0; i < ringSize; i++) {
    const a = s * ringSize + i, b = s * ringSize + (i + 1) % ringSize, c = a + ringSize, d = b + ringSize;
    indices.push(a, c, b, b, c, d);
  }
  for (let i = 1; i < ringSize - 1; i++) indices.push(0, i, i + 1);
  const last = (sections.length - 1) * ringSize;
  for (let i = 1; i < ringSize - 1; i++) indices.push(last, last + i + 1, last + i);
  const cabin = new THREE.BufferGeometry();
  cabin.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  cabin.setIndex(indices);
  cabin.computeVertexNormals();
  add(cabin, 'paint');
  function roofHeight(z) {
    for (let i = 1; i < sections.length; i++) if (z <= sections[i][0]) {
      const previous = sections[i - 1], next = sections[i];
      return THREE.MathUtils.lerp(previous[1], next[1], (z - previous[0]) / (next[0] - previous[0]));
    }
    return sections.at(-1)[1];
  }

  feature = 'green-wraparound-glazing';
  // A bowed windscreen grid follows the cabin instead of intersecting it.
  const glassPoint = (u, v) => {
    const z = 1.155 + v * .638 + (1 - u * u) * .035;
    return [u * (.747 + v * .082), roofHeight(z) + .040 - .045 * Math.pow(Math.abs(u), 2.8), z + .012];
  };
  curvedPanel(glassPoint, 28, 16, 'glass');
  for (const v of [0, 1]) outline(Array.from({ length: 21 }, (_, i) => glassPoint(i / 10 - 1, v)), .018, 'trim', false);
  for (const u of [-1, 1]) outline(Array.from({ length: 9 }, (_, i) => glassPoint(u, i / 8)), .021, 'trim', false);
  for (const side of [-1, 1]) {
    rod([side * .59, 1.244, 1.807], [side * .18, 1.302, 1.749], .010, 'trim');
    rod([side * .50, 1.236, 1.812], [side * .44, 1.284, 1.762], .008, 'trim');
  }
  // The rear window must bend around the rounded tail, too. A flat fan
  // between its top and sill would cut through the metal tailgate at mid-height.
  const rearPoint = (u, v) => {
    const y = 1.218 + v * .606;
    let z = sections[0][0];
    for (let i = 1; i < 4; i++) {
      const previous = sections[i - 1], next = sections[i];
      if (y <= next[1] + .021) {
        z = THREE.MathUtils.lerp(previous[0], next[0], THREE.MathUtils.clamp((y - previous[1] - .021) / (next[1] - previous[1]), 0, 1));
        break;
      }
    }
    return [u * (.835 - v * .104), y, z - .034 - .012 * (1 - u * u)];
  };
  curvedPanel(rearPoint, 24, 20, 'glass');
  for (const v of [0, 1]) outline(Array.from({ length: 25 }, (_, i) => rearPoint(i / 12 - 1, v)), .022, 'trim', false);
  for (const u of [-1, 1]) outline(Array.from({ length: 21 }, (_, i) => rearPoint(u, i / 20)), .022, 'trim', false);
  rod([-.43, 1.273, -2.501], [.16, 1.343, -2.501], .013, 'trim');
  box(.082, .045, .04, 0, 1.251, -2.502, 'trim');
  for (const side of [-1, 1]) {
    const sideX = y => side * (.894 - Math.max(0, y - 1.17) * .12);
    const panes = [
      [[-2.337, 1.237], [-2.252, 1.622], [-2.065, 1.787], [-1.421, 1.797], [-1.421, 1.222]],
      [[-1.326, 1.222], [-1.326, 1.798], [-.091, 1.798], [-.091, 1.222]],
      [[.010, 1.222], [.010, 1.798], [.942, 1.779], [1.141, 1.70], [1.617, 1.222]],
    ];
    for (const pane of panes) {
      const points = pane.map(([z, y]) => [sideX(y), y, z]);
      if (side < 0) points.reverse();
      polygon(points, 'glass');
      outline(points, .018, 'trim');
    }
    rod([sideX(1.732), 1.732, 1.11], [sideX(1.229), 1.229, 1.11], .013, 'trim');
    rod([sideX(1.789), 1.789, -.72], [sideX(1.232), 1.232, -.72], .009, 'trim');
  }

  feature = 'body-trim-and-sliding-door';
  for (const side of [-1, 1]) {
    const x = side * .907;
    outline([[x, 1.195, -.025], [x, .566, -.025], [x, .491, .91], [x, .55, 1.05], [x, .92, 1.30]], .006, 'seam', false);
    rod([x, 1.181, -2.31], [x, 1.181, 1.56], .012, 'highlight');
    rod([x, .701, -1.05], [x, .701, 1.02], .029, 'trim');
    rod([x, .705, -2.32], [x, .705, -1.99], .029, 'trim');
    box(.035, .075, 2.08, side * .906, .46, -.03, 'paint');
    box(.024, .041, .166, side * .916, 1.092, .20, 'trim');
    rod([side * .939, 1.109, .14], [side * .939, 1.109, .27], .012, 'chrome');
    // One passenger-side sliding door (vehicle right = -X).
    if (side === -1) {
      outline([[x, 1.19, -1.38], [x, .55, -1.38], [x, .493, -.078]], .006, 'seam', false);
      rod([x, 1.067, -2.29], [x, 1.067, -.89], .017, 'trim');
      rod([x - .006, 1.079, -2.27], [x - .006, 1.079, -.93], .006, 'chrome');
      box(.027, .046, .166, side * .920, 1.124, -1.16, 'trim');
      rod([side * .944, 1.142, -1.23], [side * .944, 1.142, -1.10], .012, 'chrome');
    } else {
      outline([[x, 1.02, -1.80], [x, 1.02, -2.10], [x, .82, -2.10], [x, .82, -1.80]], .005, 'seam');
    }
  }
  feature = 'silver-door-mirrors';
  for (const side of [-1, 1]) {
    rod([side * .873, 1.271, 1.29], [side * 1.00, 1.282, 1.34], .035, 'trim');
    add(new THREE.SphereGeometry(1, 14, 10), 'paint', [side * 1.015, 1.315, 1.34], [0, side * .18, 0], [.10, .10, .148]);
    add(new THREE.SphereGeometry(1, 12, 8), 'glass', [side * 1.021, 1.316, 1.213], [0, side * .18, 0], [.073, .074, .019]);
  }
  feature = 'four-steel-wheels';
  for (const side of [-1, 1]) for (const z of [-1.54, 1.54]) {
    add(new THREE.TorusGeometry(.255, .086, 12, 28), 'rubber', [side * .790, .341, z], [0, Math.PI / 2, 0]);
    add(new THREE.CylinderGeometry(.266, .266, .168, 28), 'rubber', [side * .795, .341, z], [0, 0, Math.PI / 2]);
    add(new THREE.CylinderGeometry(.199, .199, .018, 28), 'chrome', [side * .89, .341, z], [0, 0, Math.PI / 2]);
    add(new THREE.TorusGeometry(.174, .015, 6, 28), 'chrome', [side * .902, .341, z], [0, Math.PI / 2, 0]);
    add(new THREE.SphereGeometry(1, 12, 8), 'chrome', [side * .911, .341, z], [0, 0, 0], [.028, .069, .069]);
    for (let hole = 0; hole < 8; hole++) {
      const a = hole * Math.PI / 4;
      add(new THREE.SphereGeometry(1, 8, 4), 'trim', [side * .905, .341 + Math.sin(a) * .132, z + Math.cos(a) * .132], [a, 0, 0], [.005, .032, .018]);
    }
  }

  feature = 'stamped-roof-ribs';
  for (const side of [-1, 1]) {
    for (const x of [.29, .43, .57]) {
      const points = [-1.96, -1.72, -1.20, .50, .70].map(z => [side * x, roofHeight(z) + .025 - Math.pow(x / .8, 2) * .035, z]);
      outline(points, .007, 'highlight', false);
    }
    outline([[-2.13, 1.86], [-1.93, 1.906], [.66, 1.916], [.98, 1.876]].map(([z, y]) => [side * .792, y, z]), .011, 'trim', false);
  }

  feature = 'classic-shuttle-front';
  // Original rounded horizontal lights and narrow two-bar grille, distinct
  // from the bigger grille and twin round optics of the later 祥和.
  const frontZ = x => 2.486 - .19 * Math.pow(Math.abs(x) / .91, 2);
  for (const side of [-1, 1]) {
    const lampContour = [[.435, .927], [.455, 1.014], [.673, 1.038], [.858, 1.087], [.89, 1.041], [.893, .948], [.827, .872], [.504, .867]];
    const points = lampContour.map(([x, y]) => [x * side, y, frontZ(x) + .012]);
    if (side < 0) points.reverse();
    polygon(points, 'lamp');
    outline(points, .012, 'trim');
    for (const x of [.55, .714]) add(new THREE.SphereGeometry(1, 12, 8), 'chrome', [x * side, .948, frontZ(x) + .025], [0, side * .12, 0], [.069, .061, .02]);
    polygon([[side * .837, .89, frontZ(.837) + .028], [side * .889, .953, frontZ(.889) + .028], [side * .884, 1.025, frontZ(.884) + .028], [side * .846, 1.04, frontZ(.846) + .028]], 'amber');
    add(new THREE.SphereGeometry(1, 12, 8), 'trim', [side * .65, .50, 2.446], [0, side * .13, 0], [.094, .064, .034]);
    add(new THREE.SphereGeometry(1, 12, 8), 'lamp', [side * .65, .502, 2.472], [0, side * .13, 0], [.065, .043, .015]);
  }
  const grille = [[-.421, 1.007, 2.459], [.421, 1.007, 2.459], [.407, .842, 2.489], [-.407, .842, 2.489]];
  polygon([...grille].reverse(), 'trim');
  outline(grille, .015, 'chrome');
  for (const y of [.896, .965]) box(.783, .015, .017, 0, y, 2.499, 'chrome');
  add(new THREE.SphereGeometry(1, 24, 10), 'paint', [0, .639, 2.327], [0, 0, 0], [.898, .125, .191]);
  box(.895, .075, .038, 0, .488, 2.493, 'trim');
  rod([-.795, .761, 2.393], [0, .772, 2.488], .024, 'trim');
  rod([0, .772, 2.488], [.795, .761, 2.393], .024, 'trim');
  for (const side of [-1, 1]) outline([[side * .76, 1.175, 1.83], [side * .695, 1.124, 2.02], [side * .58, 1.083, 2.31]], .005, 'seam', false);
  box(.345, .115, .012, 0, .647, 2.520, 'plate');

  feature = 'rear-tailgate-and-lamps';
  box(.46, .051, .048, 0, 1.848, -2.254, 'red', [.64, 0, 0]);
  for (const side of [-1, 1]) {
    const tail = [[side * .714, 1.156, -2.482], [side * .871, 1.153, -2.43], [side * .879, .816, -2.436], [side * .718, .811, -2.485]];
    polygon(tail, 'red');
    outline(tail, .010, 'trim');
    polygon([[side * .72, 1.032, -2.495], [side * .875, 1.03, -2.448], [side * .875, .966, -2.448], [side * .72, .966, -2.495]], 'lamp');
    polygon([[side * .72, 1.142, -2.495], [side * .873, 1.14, -2.445], [side * .875, 1.078, -2.447], [side * .72, 1.078, -2.495]], 'amber');
  }
  add(new THREE.SphereGeometry(1, 24, 10), 'paint', [0, .565, -2.333], [0, 0, 0], [.9, .126, .176]);
  box(1.66, .063, .162, 0, .624, -2.397, 'trim');
  box(.416, .147, .026, 0, .84, -2.489, 'trim');
  box(.347, .111, .013, 0, .838, -2.51, 'plate');
  box(.278, .042, .034, 0, 1.071, -2.481, 'chrome');
  outline([[-.645, 1.167, -2.479], [-.654, .707, -2.476], [.654, .707, -2.476], [.645, 1.167, -2.479]], .006, 'seam', false);

  feature = 'jac-and-refine-badging';
  // Silver marque and lettering are real geometry, so exported GLBs retain it
  // without external fonts, labels or raster logo dependencies.
  outline(Array.from({ length: 32 }, (_, i) => {
    const a = i / 32 * Math.PI * 2;
    return [Math.cos(a) * .102, .93 + Math.sin(a) * .055, 2.519];
  }), .010, 'chrome');
  const letters = {
    J: [[[.05, .05], [.05, -.023], [.034, -.042], [.006, -.042], [-.006, -.025]]],
    A: [[[-.035, -.045], [0, .05], [.035, -.045]], [[-.021, -.008], [.021, -.008]]],
    C: [[[.030, .035], [.012, .05], [-.021, .05], [-.039, .024], [-.039, -.025], [-.018, -.044], [.017, -.044], [.033, -.026]]],
    R: [[[-.03, -.046], [-.03, .046], [.018, .046], [.035, .025], [.031, .003], [-.03, .003]], [[0, .003], [.04, -.046]]],
    E: [[[.035, .046], [-.03, .046], [-.03, -.046], [.035, -.046]], [[-.03, 0], [.025, 0]]],
    F: [[[-.03, -.046], [-.03, .046], [.035, .046]], [[-.03, .001], [.022, .001]]],
    I: [[[0, -.046], [0, .046]]],
    N: [[[-.03, -.046], [-.03, .046], [.03, -.046], [.03, .046]]],
  };
  function lettering(text, x, y, z, scale, rear = false) {
    for (let i = 0; i < text.length; i++) for (const stroke of letters[text[i]] || []) {
      outline(stroke.map(([px, py]) => [(x + i * .09 * scale + px * scale) * (rear ? -1 : 1), y + py * scale, z]), .0045 * scale, 'chrome', false);
    }
  }
  lettering('JAC', -.06, .93, 2.53, .60);
  lettering('JAC', -.56, 1.127, -2.495, .65, true);
  lettering('REFINE', .22, 1.127, -2.495, .62, true);

  // Merge by feature and material; the named parts remain inspectable.
  const groups = new Map();
  for (const [key, geometries] of batches) {
    const [part, material] = key.split(':');
    if (!groups.has(part)) {
      const group = new THREE.Group();
      group.name = part;
      groups.set(part, group);
      vehicle.add(group);
    }
    const mesh = new THREE.Mesh(mergeGeometries(geometries, false), materials[material]);
    mesh.name = `minivan-${part}-${material}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    groups.get(part).add(mesh);
    for (const geometry of geometries) geometry.dispose();
  }
  vehicle.userData = {
    kind: 'silver-minivan', vehicleMake: 'JAC', vehicleModel: '瑞风穿梭',
    bodyStyle: 'classic long-wheelbase MPV', referenceVariant: '2011–2012 穿梭长轴版',
    lengthMetres: 5.035, widthMetres: 1.82, heightMetres: 1.97, wheelbaseMetres: 3.08,
    dimensions: { length: 5.035, bodyWidth: 1.82, height: 1.97, wheelbase: 3.08 },
    frontDirection: '+Z', slidingDoorSide: '-X', features: [...groups.keys()],
  };
  return vehicle;
}
