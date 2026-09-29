import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A small, tall-roof silver MPV. Front is +Z, rear is -Z; the tires meet Y = 0.
// Static pieces are merged by material so the complete vehicle uses 11 draws.
export function createVehicle(THREE) {
  const vehicle = new THREE.Group();
  vehicle.name = 'silver-minivan';
  const materials = {
    paint: new THREE.MeshStandardMaterial({ color: '#aeb9c4', metalness: .75, roughness: .28 }),
    highlight: new THREE.MeshStandardMaterial({ color: '#cad1d8', metalness: .76, roughness: .27 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#202526', roughness: .88 }),
    trim: new THREE.MeshStandardMaterial({ color: '#343e43', metalness: .32, roughness: .46 }),
    glass: new THREE.MeshStandardMaterial({ color: '#173632', metalness: .20, roughness: .22, envMapIntensity: .20, side: THREE.DoubleSide }),
    chrome: new THREE.MeshStandardMaterial({ color: '#b9c1c6', metalness: .96, roughness: .2 }),
    red: new THREE.MeshStandardMaterial({ color: '#8d1717', metalness: .14, roughness: .23 }),
    amber: new THREE.MeshStandardMaterial({ color: '#bb652c', metalness: .1, roughness: .26 }),
    lamp: new THREE.MeshStandardMaterial({ color: '#d4dbcc', metalness: .2, roughness: .17 }),
    plate: new THREE.MeshStandardMaterial({ color: '#354d64', metalness: .2, roughness: .5 }),
    seam: new THREE.MeshStandardMaterial({ color: '#64717b', metalness: .55, roughness: .43 }),
  };
  const batches = new Map(Object.keys(materials).map(key => [key, []]));
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  function add(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
    const source = geometry.index ? geometry.toNonIndexed() : geometry;
    if (source !== geometry) geometry.dispose();
    for (const name of Object.keys(source.attributes)) {
      if (name !== 'position' && name !== 'normal') source.deleteAttribute(name);
    }
    if (!source.attributes.normal) source.computeVertexNormals();
    quaternion.setFromEuler(new THREE.Euler(...rotation));
    matrix.compose(new THREE.Vector3(...position), quaternion, new THREE.Vector3(...scale));
    source.applyMatrix4(matrix);
    batches.get(material).push(source);
  }
  function box(w, h, d, x, y, z, material, rotation = [0, 0, 0]) {
    add(new THREE.BoxGeometry(w, h, d), material, [x, y, z], rotation);
  }
  function rod(a, b, radius, material, segments = 6) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
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

  // Sculpted lower body, with actual wheel-arch cutouts and softly rounded edges.
  const profile = new THREE.Shape();
  profile.moveTo(-2.12, .47);
  profile.lineTo(-2.13, .92);
  profile.quadraticCurveTo(-2.1, 1.055, -1.91, 1.055);
  profile.lineTo(1.51, 1.055);
  profile.quadraticCurveTo(1.92, 1.055, 2.12, .96);
  profile.lineTo(2.17, .56);
  profile.quadraticCurveTo(2.13, .45, 1.72, .44);
  profile.lineTo(1.70, .45);
  profile.bezierCurveTo(1.68, .96, .95, .96, .93, .45);
  profile.lineTo(-.94, .45);
  profile.bezierCurveTo(-.96, .96, -1.71, .96, -1.73, .45);
  profile.closePath();
  const body = new THREE.ExtrudeGeometry(profile, { depth: 1.53, bevelEnabled: true, bevelThickness: .045, bevelSize: .035, bevelSegments: 3, steps: 1, curveSegments: 9 });
  body.rotateY(-Math.PI / 2);
  body.translate(.765, 0, 0);
  add(body, 'paint');
  box(1.40, .17, 3.6, 0, .43, -.02, 'rubber');

  // Lofted cabin: narrow roof shoulders, curved crown, and a short sloping nose.
  const sections = [
    [-2.10, 1.20, .73], [-2.035, 1.52, .74], [-1.93, 1.72, .735],
    [-1.73, 1.81, .73], [-.85, 1.845, .73], [.65, 1.84, .725],
    [1.10, 1.79, .715], [1.30, 1.54, .72], [1.61, 1.105, .765],
  ];
  const vertices = [], indices = [];
  for (const [z, top, roofWidth] of sections) {
    const ring = [
      [-.795, 1.00], [-.793, 1.075], [-roofWidth, top - .073],
      [-roofWidth + .045, top - .018], [-roofWidth * .65, top + .007],
      [0, top + .019], [roofWidth * .65, top + .007],
      [roofWidth - .045, top - .018], [roofWidth, top - .073],
      [.793, 1.075], [.795, 1.00],
    ];
    for (const [x, y] of ring) vertices.push(x, y, z);
  }
  const n = 11;
  for (let s = 0; s < sections.length - 1; s++) {
    for (let i = 0; i < n; i++) {
      const a = s * n + i, b = s * n + (i + 1) % n, c = (s + 1) * n + i, d = (s + 1) * n + (i + 1) % n;
      indices.push(a, c, b, b, c, d);
    }
  }
  // End caps face outward; they are mostly concealed by the glass and bonnet.
  for (let i = 1; i < n - 1; i++) indices.push(0, i, i + 1);
  const last = (sections.length - 1) * n;
  for (let i = 1; i < n - 1; i++) indices.push(last, last + i + 1, last + i);
  const cabin = new THREE.BufferGeometry();
  cabin.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  cabin.setIndex(indices);
  cabin.computeVertexNormals();
  add(cabin, 'paint');

  // The broad, lightly green windshield and thin dark gaskets.
  const windshield = [[-.724, 1.73, 1.19], [.724, 1.73, 1.19], [.784, 1.124, 1.651], [-.784, 1.124, 1.651]];
  polygon(windshield, 'glass');
  outline(windshield, .021, 'trim');
  rod([-.59, 1.145, 1.655], [-.16, 1.21, 1.603], .009, 'rubber');
  rod([.1, 1.145, 1.655], [.54, 1.21, 1.603], .009, 'rubber');
  box(1.39, .026, .09, 0, 1.104, 1.65, 'trim', [-.09, 0, 0]);
  const rearGlass = [[-.702, 1.64, -2.029], [.702, 1.64, -2.029], [.765, 1.122, -2.155], [-.765, 1.122, -2.155]];
  polygon(rearGlass, 'glass');
  outline(rearGlass, .023, 'trim');
  rod([-.45, 1.161, -2.158], [.12, 1.222, -2.144], .011, 'rubber');
  box(.40, .05, .06, 0, 1.744, -1.904, 'red', [.43, 0, 0]);

  for (const side of [-1, 1]) {
    // Windows follow the taper of the cabin; painted posts separate each pane.
    const sideX = y => side * (.803 - Math.max(0, y - 1.06) * .097);
    const sidePolygon = coords => coords.map(([z, y]) => [sideX(y), y, z]);
    const panes = [
      [[-1.965, 1.112], [-1.842, 1.635], [-1.225, 1.707], [-1.225, 1.112]],
      [[-1.135, 1.112], [-1.135, 1.709], [-.155, 1.710], [-.155, 1.112]],
      [[-.065, 1.112], [-.065, 1.711], [1.076, 1.663], [1.484, 1.112]],
    ];
    for (const pane of panes) {
      const points = sidePolygon(pane);
      polygon(points, 'glass');
      outline(points, .017, 'trim');
    }
    rod([sideX(1.66), 1.66, .965], [sideX(1.12), 1.12, .965], .011, 'trim');
    // Door boundaries, pressed body crease, sill and sliding-door runner.
    outline([[side * .813, 1.045, -.12], [side * .822, .57, -.12], [side * .819, .535, .79], [side * .809, .93, 1.00]], .006, 'seam', false);
    outline([[side * .813, 1.048, -1.20], [side * .822, .57, -1.20], [side * .822, .535, -.22]], .006, 'seam', false);
    rod([side * .819, 1.025, -1.97], [side * .819, 1.025, 1.61], .010, 'highlight');
    box(.024, .047, 1.91, side * .827, .70, -.045, 'trim');
    box(.035, .073, 1.72, side * .826, .43, .01, 'paint');
    box(.018, .018, .79, side * .822, .905, -1.38, 'trim');
    for (const z of [.105, -.925]) {
      box(.015, .040, .16, side * .827, .994, z, 'trim');
      rod([side * .852, 1.009, z - .064], [side * .852, 1.009, z + .064], .012, 'chrome');
    }
    // Mirrors have a separate black mounting arm and a silver outer shell.
    rod([side * .808, 1.154, 1.12], [side * .933, 1.16, 1.13], .031, 'trim');
    add(new THREE.SphereGeometry(1, 12, 8), 'paint', [side * .968, 1.192, 1.145], [0, side * .16, 0], [.090, .090, .135]);
    add(new THREE.SphereGeometry(1, 10, 6), 'glass', [side * .968, 1.194, 1.033], [0, side * .16, 0], [.069, .066, .018]);

    for (const z of [-1.34, 1.315]) {
      // The torus shoulders remain rounded in the elevated reference view.
      add(new THREE.TorusGeometry(.252, .081, 10, 24), 'rubber', [side * .782, .334, z], [0, Math.PI / 2, 0]);
      add(new THREE.CylinderGeometry(.255, .255, .125, 24), 'rubber', [side * .79, .334, z], [0, 0, Math.PI / 2]);
      add(new THREE.CylinderGeometry(.195, .195, .014, 24), 'chrome', [side * .864, .334, z], [0, 0, Math.PI / 2]);
      add(new THREE.TorusGeometry(.17, .012, 6, 24), 'highlight', [side * .875, .334, z], [0, Math.PI / 2, 0]);
      add(new THREE.CylinderGeometry(.054, .054, .026, 14), 'chrome', [side * .885, .334, z], [0, 0, Math.PI / 2]);
      for (let spoke = 0; spoke < 7; spoke++) {
        const angle = spoke * Math.PI * 2 / 7;
        add(new THREE.SphereGeometry(1, 6, 4), 'trim', [side * .881, .334 + Math.sin(angle) * .122, z + Math.cos(angle) * .122], [angle, 0, 0], [.005, .035, .023]);
      }
    }
    // Long stamped roof ribs and drainage edges, visible from the balcony.
    for (const x of [.30, .47, .61]) {
      const height = x > .55 ? 1.851 : 1.87;
      rod([side * x, height - .025, -1.45], [side * x, height, -.8], .008, 'highlight');
      rod([side * x, height, -.8], [side * x, height - .004, .72], .008, 'highlight');
      rod([side * x, height - .004, .72], [side * x, height - .025, .90], .008, 'highlight');
    }
    rod([side * .715, 1.770, -1.71], [side * .714, 1.794, .89], .011, 'trim');
  }

  // Low bumpers, inset grille and lights make the short nose read as a van.
  box(1.57, .18, .15, 0, .515, 2.13, 'trim');
  box(1.58, .09, .15, 0, .636, 2.133, 'paint');
  box(.81, .17, .04, 0, .841, 2.15, 'trim');
  for (const y of [.80, .848, .896]) box(.77, .012, .047, 0, y, 2.176, 'chrome');
  for (const side of [-1, 1]) {
    box(.350, .183, .034, side * .604, .865, 2.183, 'trim', [0, side * .12, 0]);
    box(.326, .16, .027, side * .604, .865, 2.205, 'lamp', [0, side * .12, 0]);
    box(.072, .125, .038, side * .751, .846, 2.184, 'amber', [0, side * .12, 0]);
    box(.10, .064, .022, side * .587, .511, 2.212, 'lamp');
    box(.11, .31, .05, side * .725, .925, -2.13, 'red');
    box(.104, .073, .056, side * .725, .944, -2.134, 'lamp');
    box(.106, .054, .054, side * .725, 1.045, -2.132, 'amber');
  }
  box(1.60, .165, .155, 0, .506, -2.128, 'trim');
  box(1.57, .065, .159, 0, .623, -2.128, 'paint');
  box(.38, .098, .023, 0, .745, -2.175, 'trim');
  box(.282, .034, .028, 0, .928, -2.143, 'chrome');
  outline([[-.588, 1.056, -2.131], [-.588, .678, -2.136], [.588, .678, -2.136], [.588, 1.056, -2.131]], .006, 'seam', false);
  for (const z of [-2.193, 2.217]) {
    box(.32, .107, .015, 0, .728, z, 'plate');
    // A blank generic plate avoids inventing an identifiable registration.
    box(.27, .008, .019, 0, .737, z, 'highlight');
    box(.21, .005, .019, 0, .71, z, 'highlight');
  }
  for (const [name, geometries] of batches) {
    const merged = mergeGeometries(geometries, false);
    const mesh = new THREE.Mesh(merged, materials[name]);
    mesh.name = `minivan-${name}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    vehicle.add(mesh);
    for (const geometry of geometries) geometry.dispose();
  }
  vehicle.userData = { kind: 'silver-minivan', lengthMetres: 4.45, widthMetres: 1.75, heightMetres: 1.88, frontDirection: '+Z' };
  return vehicle;
}
