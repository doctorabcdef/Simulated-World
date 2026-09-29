import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Reconstructed from the user's supplied 瑞风穿梭 reference photograph.
// Silver two-tone body, vertical grille, integrated bumper and five-spoke alloys.
// Scene units are metres; front +Z, ground Y=0.
export function createVehicle(THREE) {
  const vehicle = new THREE.Group();
  vehicle.name = 'silver-minivan';
  const materials = {
    paint: new THREE.MeshStandardMaterial({ color: '#dce0e4', metalness: .48, roughness: .28 }),
    lowerPaint: new THREE.MeshStandardMaterial({ color: '#91959b', metalness: .46, roughness: .31 }),
    highlight: new THREE.MeshStandardMaterial({ color: '#e0e3e5', metalness: .58, roughness: .25 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#1c2225', roughness: .88 }),
    trim: new THREE.MeshStandardMaterial({ color: '#273036', metalness: .28, roughness: .47 }),
    glass: new THREE.MeshStandardMaterial({ color: '#070d13', metalness: .13, roughness: .15, envMapIntensity: .30, side: THREE.DoubleSide }),
    chrome: new THREE.MeshStandardMaterial({ color: '#c5cacf', metalness: .93, roughness: .22 }),
    red: new THREE.MeshStandardMaterial({ color: '#951c21', metalness: .15, roughness: .24, side: THREE.DoubleSide }),
    amber: new THREE.MeshStandardMaterial({ color: '#d58b3b', metalness: .12, roughness: .25, side: THREE.DoubleSide }),
    lamp: new THREE.MeshStandardMaterial({ color: '#d8e1df', metalness: .33, roughness: .16, side: THREE.DoubleSide }),
    plate: new THREE.MeshStandardMaterial({ color: '#284662', metalness: .15, roughness: .54 }),
    seam: new THREE.MeshStandardMaterial({ color: '#646d76', metalness: .36, roughness: .40 }),
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
  function smoothOutline(points, radius, material, closed = true) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), closed, 'centripetal');
    add(new THREE.TubeGeometry(curve, Math.max(24, points.length * 6), radius, 6, closed), material);
  }
  function roundCorners(points, radius = .04) {
    const rounded = [];
    for (let i = 0; i < points.length; i++) {
      const p = new THREE.Vector3(...points[i]), previous = new THREE.Vector3(...points[(i + points.length - 1) % points.length]), next = new THREE.Vector3(...points[(i + 1) % points.length]);
      const distance = Math.min(radius, p.distanceTo(previous) * .22, p.distanceTo(next) * .22);
      const a = p.clone().lerp(previous, distance / p.distanceTo(previous)), b = p.clone().lerp(next, distance / p.distanceTo(next));
      for (let step = 0; step <= 5; step++) {
        const t = step / 5;
        rounded.push(a.clone().multiplyScalar((1 - t) ** 2).addScaledVector(p, 2 * t * (1 - t)).addScaledVector(b, t * t).toArray());
      }
    }
    return rounded;
  }
  function twoToneBody(geometry, beltHeight) {
    const source = geometry.index ? geometry.toNonIndexed() : geometry;
    const positions = source.attributes.position, normals = source.attributes.normal;
    for (const upper of [true, false]) {
      const outputPositions = [], outputNormals = [];
      for (let i = 0; i < positions.count; i += 3) {
        let polygon = [0, 1, 2].map(offset => ({ p: new THREE.Vector3().fromBufferAttribute(positions, i + offset), n: new THREE.Vector3().fromBufferAttribute(normals, i + offset) }));
        const clipped = [];
        for (let k = 0; k < polygon.length; k++) {
          const a = polygon[k], b = polygon[(k + 1) % polygon.length];
          const aInside = upper ? a.p.y >= beltHeight : a.p.y <= beltHeight;
          const bInside = upper ? b.p.y >= beltHeight : b.p.y <= beltHeight;
          if (aInside) clipped.push(a);
          if (aInside !== bInside) {
            const t = (beltHeight - a.p.y) / (b.p.y - a.p.y);
            clipped.push({ p: a.p.clone().lerp(b.p, t), n: a.n.clone().lerp(b.n, t).normalize() });
          }
        }
        for (let k = 1; k < clipped.length - 1; k++) for (const vertex of [clipped[0], clipped[k], clipped[k + 1]]) {
          outputPositions.push(...vertex.p.toArray()); outputNormals.push(...vertex.n.toArray());
        }
      }
      const part = new THREE.BufferGeometry();
      part.setAttribute('position', new THREE.Float32BufferAttribute(outputPositions, 3));
      part.setAttribute('normal', new THREE.Float32BufferAttribute(outputNormals, 3));
      add(part, upper ? 'paint' : 'lowerPaint');
    }
    source.dispose(); if (source !== geometry) geometry.dispose();
  }
  // Soft bevels, rounded bonnet, and genuine cut-outs over all four tires.
  const profile = new THREE.Shape();
  profile.moveTo(-2.43, .43);
  profile.lineTo(-2.445, 1.04);
  profile.quadraticCurveTo(-2.41, 1.23, -2.22, 1.23);
  profile.lineTo(1.42, 1.23);
  profile.quadraticCurveTo(1.86, 1.22, 2.22, 1.09);
  profile.quadraticCurveTo(2.43, 1.06, 2.45, .96);
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
    if (z > 1.4 && bodyPositions.getY(i) > 1.02) bodyPositions.setY(i, bodyPositions.getY(i) + .038 * (1 - Math.pow(Math.abs(x) / .91, 2)));
    if (z > 2.20 && bodyPositions.getY(i) < .93) bodyPositions.setZ(i, bodyPositions.getZ(i) - .085 * Math.min(1, (z - 2.20) / .25));
    if (z < -2.20) bodyPositions.setZ(i, z + .063 * Math.pow(Math.abs(x) / .91, 2) * Math.min(1, (-z - 2.20) / .24));
  }
  // ExtrudeGeometry duplicates its face vertices; weld them before normal
  // generation so the bonnet and wheel-arch bevels are smoothly shaded.
  body.deleteAttribute('normal');
  body.deleteAttribute('uv');
  const smoothBody = mergeVertices(body, .0001);
  smoothBody.computeVertexNormals();
  body.dispose();
  const bodyProbe = new THREE.Mesh(smoothBody.clone()); bodyProbe.updateMatrixWorld();
  const noseRay = new THREE.Raycaster();
  function noseDepth(x, y) {
    noseRay.set(new THREE.Vector3(x, y, 3), new THREE.Vector3(0, 0, -1));
    return noseRay.intersectObject(bodyProbe, false)[0]?.point.z ?? (2.45 - .2 * (x / .91) ** 2);
  }
  function noseLens(contour) {
    const positions = [];
    const project = ([x, y]) => [x, y, noseDepth(x, y) + .008];
    function subdivide(a, b, c, level) {
      if (!level) { positions.push(...project(a), ...project(b), ...project(c)); return; }
      const ab = a.map((v, i) => (v + b[i]) / 2), bc = b.map((v, i) => (v + c[i]) / 2), ca = c.map((v, i) => (v + a[i]) / 2);
      subdivide(a, ab, ca, level - 1); subdivide(ab, b, bc, level - 1); subdivide(ca, bc, c, level - 1); subdivide(ab, bc, ca, level - 1);
    }
    for (let i = 1; i < contour.length - 1; i++) subdivide(contour[0], contour[i], contour[i + 1], 3);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const merged = mergeVertices(geometry, .0001); merged.computeVertexNormals(); geometry.dispose(); add(merged, 'lamp');
    const rounded = roundCorners(contour.map(([x, y]) => [x, y, 0]), .018);
    outline(rounded.map(([x, y]) => project([x, y])), .006, 'trim');
  }
  twoToneBody(smoothBody, 1.033);
  box(1.47, .15, 4.16, 0, .34, -.06, 'rubber');

  // Long H1-derived cabin, narrowing towards a gently crowned roof. The
  // front sections form the classic single continuous windscreen slope.
  const sections = [
    [-2.44, 1.38, .805], [-2.37, 1.69, .81], [-2.19, 1.871, .798],
    [-1.94, 1.933, .795], [-1.20, 1.949, .792], [.38, 1.949, .792],
    [.64, 1.922, .797], [.85, 1.822, .810], [1.11, 1.56, .837], [1.40, 1.302, .866], [1.54, 1.24, .876],
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

  feature = 'dark-wraparound-glazing';
  // A bowed windscreen grid follows the cabin instead of intersecting it.
  const glassPoint = (u, v) => {
    const z = .77 + v * .66 + (1 - u * u) * .035;
    return [u * (.735 + v * .094), roofHeight(z) + .040 - .045 * Math.pow(Math.abs(u), 2.8), z + .012];
  };
  curvedPanel(glassPoint, 28, 16, 'glass');
  for (const v of [0, 1]) outline(Array.from({ length: 21 }, (_, i) => glassPoint(i / 10 - 1, v)), .018, 'trim', false);
  for (const u of [-1, 1]) outline(Array.from({ length: 9 }, (_, i) => glassPoint(u, i / 8)), .021, 'trim', false);
  for (const side of [-1, 1]) {
    rod([side * .59, 1.29, 1.49], [side * .16, 1.345, 1.42], .009, 'trim');
    rod([side * .50, 1.282, 1.494], [side * .43, 1.327, 1.439], .007, 'trim');
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
    const sideX = y => side * (.905 - Math.max(0, y - 1.17) * .12);
    const panes = [
      // Two rear panes share a dark band; only the cabin B pillar is silver.
      [[-2.332, 1.271], [-2.248, 1.641], [-2.084, 1.799], [-1.87, 1.831], [-.13, 1.831], [-.13, 1.245], [-2.25, 1.245]],
      [[.016, 1.245], [.016, 1.831], [.527, 1.818], [.702, 1.748], [1.321, 1.297], [1.302, 1.246]],
    ];
    for (const pane of panes) {
      const points = roundCorners(pane.map(([z, y]) => [sideX(y), y, z]), .055);
      if (side < 0) points.reverse();
      polygon(points, 'glass');
      outline(points, .010, 'trim');
    }
    box(.023, .578, .086, sideX(1.54), 1.542, -1.23, 'trim', [0, 0, side * .119]);
    rod([sideX(1.255), 1.255, 1.085], [sideX(1.458), 1.458, 1.085], .007, 'trim');
  }

  feature = 'body-trim-and-sliding-door';
  for (const side of [-1, 1]) {
    const x = side * .916;
    outline([[x, 1.24, -.058], [x, .495, -.058], [x, .471, .86], [x, .58, 1.025], [x, .93, 1.135], [x, 1.235, 1.135]], .004, 'seam', false);
    // Broad silver character line, without the old model's black side rails.
    box(.018, .071, 4.57, side * .913, 1.065, -.07, 'highlight');
    for (const y of [.69, .77]) {
      rod([x, y, -1.04], [x, y, 1.02], .009, 'lowerPaint');
      rod([x, y, -2.33], [x, y, -2.01], .009, 'lowerPaint');
    }
    rod([x, .432, -1.04], [x, .432, 1.02], .014, 'lowerPaint');
    add(new THREE.SphereGeometry(1, 16, 10), 'trim', [side * .932, 1.166, .10], [0, 0, 0], [.012, .052, .041]);
    // One passenger-side sliding door (vehicle right = -X).
    if (side === -1) {
      outline([[x, 1.24, -1.41], [x, .50, -1.41], [x, .471, -.058]], .004, 'seam', false);
      rod([x, 1.15, -2.30], [x, 1.15, -1.01], .007, 'seam');
      add(new THREE.SphereGeometry(1, 16, 10), 'trim', [side * .933, 1.164, -1.24], [0, 0, 0], [.011, .039, .053]);
    } else {
      smoothOutline([[x, 1.221, -1.79], [x, 1.225, -1.94], [x, 1.20, -1.971], [x, 1.083, -1.971], [x, 1.066, -1.945], [x, 1.066, -1.796], [x, 1.084, -1.776], [x, 1.202, -1.776]], .004, 'seam');
    }
  }
  feature = 'silver-door-mirrors';
  for (const side of [-1, 1]) {
    rod([side * .87, 1.34, 1.17], [side * .99, 1.36, 1.17], .024, 'trim');
    add(new RoundedBoxGeometry(.172, .207, .25, 3, .046), 'trim', [side * 1.014, 1.395, 1.14], [0, side * .12, 0]);
    add(new RoundedBoxGeometry(.135, .163, .009, 3, .035), 'glass', [side * 1.017, 1.397, 1.011], [0, side * .12, 0]);
  }
  feature = 'four-alloy-wheels';
  for (const side of [-1, 1]) for (const z of [-1.54, 1.54]) {
    feature = 'four-alloy-wheels';
    add(new THREE.TorusGeometry(.255, .086, 16, 36), 'rubber', [side * .790, .341, z], [0, Math.PI / 2, 0]);
    add(new THREE.CylinderGeometry(.266, .266, .168, 36), 'rubber', [side * .795, .341, z], [0, 0, Math.PI / 2]);
    feature = 'five-spoke-alloy-centers';
    add(new THREE.CylinderGeometry(.205, .205, .010, 36), 'trim', [side * .882, .341, z], [0, 0, Math.PI / 2]);
    add(new THREE.TorusGeometry(.196, .014, 8, 40), 'chrome', [side * .904, .341, z], [0, Math.PI / 2, 0]);
    add(new THREE.SphereGeometry(1, 16, 10), 'chrome', [side * .916, .341, z], [0, 0, 0], [.021, .071, .071]);
    for (let spoke = 0; spoke < 5; spoke++) {
      const a = spoke * Math.PI * 2 / 5;
      const spokeShape = new THREE.Shape();
      spokeShape.moveTo(.040, -.028); spokeShape.bezierCurveTo(.087, -.039, .129, -.067, .185, -.020);
      spokeShape.lineTo(.196, .018); spokeShape.bezierCurveTo(.128, -.004, .104, .030, .043, .029); spokeShape.closePath();
      const spokeGeometry = new THREE.ExtrudeGeometry(spokeShape, { depth: .008, bevelEnabled: true, bevelThickness: .004, bevelSize: .003, bevelSegments: 2, curveSegments: 8 });
      const p = spokeGeometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i), v = p.getY(i), d = p.getZ(i);
        p.setXYZ(i, side * (.906 + d), .341 + Math.cos(a) * u - Math.sin(a) * v, z + Math.sin(a) * u + Math.cos(a) * v);
      }
      spokeGeometry.computeVertexNormals(); add(spokeGeometry, 'chrome');
      add(new THREE.SphereGeometry(.010, 8, 6), 'trim', [side * .94, .341 + Math.cos(a) * .047, z + Math.sin(a) * .047]);
    }
  }

  feature = 'stamped-roof-ribs';
  for (const side of [-1, 1]) {
    for (const x of [.29, .43, .57]) {
      const points = [-1.96, -1.72, -1.20, .30, .43].map(z => [side * x, roofHeight(z) + .025 - Math.pow(x / .8, 2) * .035, z]);
      outline(points, .007, 'highlight', false);
    }
    outline([-2.13, -1.93, .30, .57].map(z => [side * .790, roofHeight(z) - .050, z]), .005, 'seam', false);
  }

  feature = 'classic-shuttle-front';
  // The supplied reference has clear swept lamps and an integrated gray
  // bumper. All lenses and recesses follow the curved nose surface.
  const frontZ = x => 2.502 - .21 * Math.pow(Math.abs(x) / .91, 2);
  const bumperZ = (x, y) => 2.516 - .22 * Math.pow(Math.abs(x) / .91, 4) - .10 * Math.pow((y - .66) / .29, 2);
  curvedPanel((u, v) => { const x = u * .91, y = .39 + v * .515; return [x, y, bumperZ(x, y)]; }, 32, 16, 'lowerPaint');
  // Close the moulded bumper's returns into the body, so side views show a
  // solid bumper volume rather than a floating surface in front of the nose.
  for (const side of [-1, 1]) for (let step = 0; step < 16; step++) {
    const x = side * .91, a = .39 + step * .515 / 16, b = a + .515 / 16;
    const points = [[x, a, bumperZ(x, a)], [x, b, bumperZ(x, b)], [side * .912, b, 2.10], [side * .912, a, 2.10]];
    if (side > 0) points.reverse(); polygon(points, 'lowerPaint');
  }
  for (const y of [.39, .905]) for (let step = 0; step < 32; step++) {
    const a = -.91 + step * 1.82 / 32, b = a + 1.82 / 32;
    const points = [[a, y, bumperZ(a, y)], [b, y, bumperZ(b, y)], [b * 1.0022, y, 2.10], [a * 1.0022, y, 2.10]];
    if (y < .5) points.reverse(); polygon(points, 'lowerPaint');
  }
  smoothOutline([[-.86, .913, frontZ(.86)], [-.48, .929, frontZ(.48)], [0, .933, frontZ(0)], [.48, .929, frontZ(.48)], [.86, .913, frontZ(.86)]], .006, 'seam', false);
  for (const side of [-1, 1]) {
    const lampContour = [[.345, .954], [.387, 1.071], [.57, 1.11], [.83, 1.129], [.873, 1.10], [.867, .986], [.806, .957], [.48, .948]];
    const lensContour = lampContour.map(([x, y]) => [x * side, y - .025]);
    if (side < 0) lensContour.reverse();
    noseLens(lensContour);
    // Small flush reflector facets, rather than projecting round headlamps.
    for (const x of [.49, .66]) {
      const y = 1.006, z = noseDepth(x * side, y) + .013;
      add(new THREE.SphereGeometry(1, 16, 10), 'chrome', [x * side, y, z], [0, side * .23, 0], [.056, .035, .003]);
      for (const offset of [-.042, 0, .042]) {
        const points = Array.from({ length: 6 }, (_, i) => { const px = side * (x + offset + i * .002), py = .967 + i * .015; return [px, py, noseDepth(px, py) + .012]; });
        outline(points, .0016, 'highlight', false);
      }
    }
    const dividerX = side * .785;
    outline(Array.from({ length: 8 }, (_, i) => { const x = dividerX + side * i * .0015, y = .949 + i * .018; return [x, y, noseDepth(x, y) + .012]; }), .003, 'seam', false);
    add(new THREE.SphereGeometry(1, 12, 8), 'amber', [side * .826, 1.003, noseDepth(side * .826, 1.003) + .012], [0, side * .2, 0], [.013, .021, .002]);
  }
  for (const side of [-1, 1]) {
    const points = Array.from({ length: 24 }, (_, i) => {
      const t = i / 23, x = side * (.77 - .32 * t), z = 1.43 + .85 * t;
      noseRay.set(new THREE.Vector3(x, 3, z), new THREE.Vector3(0, -1, 0));
      const y = noseRay.intersectObject(bodyProbe, false)[0]?.point.y ?? 1.1;
      return [x, y + .003, z];
    });
    outline(points, .0018, 'seam', false);
  }
  box(.35, .145, .012, 0, .468, 2.519, 'plate');

  feature = 'vertical-slat-grille';
  const grilleContour = [[-.318, 1.062], [-.30, 1.08], [0, 1.084], [.30, 1.08], [.318, 1.062], [.287, .956], [.262, .94], [-.262, .94], [-.287, .956]];
  const grille = grilleContour.map(([x, y]) => [x, y, noseDepth(x, y) + .014]);
  curvedPanel((u, v) => { const x = u * (.266 + .046 * v), y = .943 + .138 * v; return [x, y, noseDepth(x, y) + .013]; }, 24, 10, 'trim');
  outline(roundCorners(grille, .016), .009, 'chrome');
  for (let slat = -6; slat <= 6; slat++) {
    const x = slat * .043;
    outline(Array.from({ length: 8 }, (_, i) => { const px = x * (.935 + .065 * i / 7), y = .953 + .118 * i / 7; return [px, y, noseDepth(px, y) + .022]; }), .006, 'chrome', false);
  }

  feature = 'four-opening-lower-intake';
  const intakeContour = [[-.622, .826], [-.60, .852], [.60, .852], [.622, .826], [.587, .679], [.529, .650], [-.529, .650], [-.587, .679]];
  const intake = intakeContour.map(([x, y]) => [x, y, bumperZ(x, y) + .020]);
  curvedPanel((u, v) => {
    const y = .651 + v * .20, halfWidth = .55 + .065 * Math.sin(v * Math.PI / 2);
    const x = u * halfWidth; return [x, y, bumperZ(x, y) + .027];
  }, 24, 8, 'trim');
  outline(roundCorners(intake, .03), .008, 'highlight');
  for (const x of [-.31, 0, .31]) {
    curvedPanel((u, v) => { const px = x + u * .026 - Math.sign(x) * v * .027, y = .653 + v * .198; return [px, y, bumperZ(px, y) + .034]; }, 2, 10, 'lowerPaint');
  }

  feature = 'recessed-round-fog-lamps';
  for (const side of [-1, 1]) {
    const x = side * .755, y = .696, z = bumperZ(x, y) + .016;
    const angle = side * .33;
    add(new THREE.SphereGeometry(1, 20, 12), 'trim', [x, y, z], [0, angle, 0], [.083, .098, .006]);
    add(new THREE.TorusGeometry(.058, .006, 8, 28), 'chrome', [x, y, z + .007], [0, angle, 0], [1, 1.15, 1]);
    add(new THREE.SphereGeometry(1, 20, 12), 'lamp', [x, y, z + .008], [0, angle, 0], [.051, .059, .005]);
    add(new THREE.SphereGeometry(.016, 12, 8), 'chrome', [x, y, z + .009], [0, 0, 0], [1, 1, .20]);
  }

  feature = 'rear-tailgate-and-lamps';
  box(.46, .051, .048, 0, 1.848, -2.254, 'red', [.64, 0, 0]);
  for (const side of [-1, 1]) {
    const tail = [[side * .714, 1.156, -2.482], [side * .871, 1.153, -2.43], [side * .879, .816, -2.436], [side * .718, .811, -2.485]];
    polygon(tail, 'red');
    outline(tail, .010, 'trim');
    polygon([[side * .72, 1.032, -2.495], [side * .875, 1.03, -2.448], [side * .875, .966, -2.448], [side * .72, .966, -2.495]], 'lamp');
    polygon([[side * .72, 1.142, -2.495], [side * .873, 1.14, -2.445], [side * .875, 1.078, -2.447], [side * .72, 1.078, -2.495]], 'amber');
  }
  add(new THREE.SphereGeometry(1, 24, 10), 'lowerPaint', [0, .565, -2.333], [0, 0, 0], [.9, .126, .176]);
  box(1.66, .042, .130, 0, .624, -2.397, 'lowerPaint');
  box(.416, .147, .026, 0, .84, -2.489, 'trim');
  box(.347, .111, .013, 0, .838, -2.51, 'plate');
  box(.278, .042, .034, 0, 1.071, -2.481, 'chrome');
  outline([[-.645, 1.167, -2.479], [-.654, .707, -2.476], [.654, .707, -2.476], [.645, 1.167, -2.479]], .006, 'seam', false);

  feature = 'jac-and-refine-badging';
  // Silver marque and lettering are real geometry, so exported GLBs retain it
  // without external fonts, labels or raster logo dependencies.
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
  const badgeY = 1.01;
  outline(Array.from({ length: 32 }, (_, i) => { const a = i / 32 * Math.PI * 2, x = Math.cos(a) * .055, y = badgeY + Math.sin(a) * .055; return [x, y, noseDepth(x, y) + .034]; }), .005, 'chrome');
  outline(Array.from({ length: 10 }, (_, i) => { const a = Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? .019 : .047, x = Math.cos(a) * radius, y = badgeY + Math.sin(a) * radius; return [x, y, noseDepth(x, y) + .039]; }), .004, 'chrome');
  lettering('JAC', -.56, 1.127, -2.495, .65, true);
  lettering('REFINE', .22, 1.127, -2.495, .62, true);
  bodyProbe.geometry.dispose(); bodyProbe.material.dispose();

  // Merge by feature and material; the named parts remain inspectable.
  const groups = new Map();
  const featureParents = {
    'vertical-slat-grille': 'classic-shuttle-front',
    'four-opening-lower-intake': 'classic-shuttle-front',
    'recessed-round-fog-lamps': 'classic-shuttle-front',
    'five-spoke-alloy-centers': 'four-alloy-wheels',
  };
  function featureGroup(name) {
    if (!groups.has(name)) {
      const group = new THREE.Group(); group.name = name; groups.set(name, group);
      const parent = featureParents[name] ? featureGroup(featureParents[name]) : vehicle;
      parent.add(group);
    }
    return groups.get(name);
  }
  for (const [key, geometries] of batches) {
    const [part, material] = key.split(':');
    const group = featureGroup(part);
    const mesh = new THREE.Mesh(mergeGeometries(geometries, false), materials[material]);
    mesh.name = `minivan-${part}-${material}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    for (const geometry of geometries) geometry.dispose();
  }
  vehicle.userData = {
    kind: 'silver-minivan', vehicleMake: 'JAC', vehicleModel: '瑞风穿梭',
    bodyStyle: 'silver two-tone MPV', referenceVariant: '用户提供的瑞风穿梭车型图',
    bodyColor: 'silver', grilleSlats: 13, alloyWheelSpokes: 5,
    lengthMetres: 5.035, widthMetres: 1.82, heightMetres: 1.97, wheelbaseMetres: 3.08,
    dimensions: { length: 5.035, bodyWidth: 1.82, height: 1.97, wheelbase: 3.08 },
    frontDirection: '+Z', slidingDoorSide: '-X', features: [...groups.keys()],
  };
  return vehicle;
}
