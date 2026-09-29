import * as THREE from 'three';
import { createRoof } from './roof.js';

// Measured by proportion from the supplied front/right photograph; units are metres.
export function createHouse() {
  const house = new THREE.Group();
  house.name = '山居 · 建筑复刻';
  const batches = new Map();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const rodGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
  const ballGeo = new THREE.SphereGeometry(1, 14, 10);
  const dummy = new THREE.Object3D();
  let seed = 9371;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  function surface(base, scale, grit = 18, streaks = false) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d'); ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 22000; i++) {
      const n = Math.floor(random() * 130);
      ctx.fillStyle = `rgba(${n},${n},${n},${random() * grit / 100})`;
      ctx.fillRect(random() * 256, random() * 256, random() * 2 + .3, random() * 2 + .3);
    }
    if (streaks) for (let i = 0; i < 180; i++) {
      ctx.fillStyle = `rgba(38,43,35,${random() * .045})`;
      ctx.fillRect(random() * 256, random() * 256, random() * 5, random() * 60);
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(scale, scale);
    tex.anisotropy = 8;
    return tex;
  }
  function reflectedTrees() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 512;
    const ctx = c.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#51666a'); gradient.addColorStop(.4, '#1c302d'); gradient.addColorStop(1, '#172324');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 2400; i++) {
      const x = random() * 256, y = 55 + random() * 425;
      ctx.fillStyle = `rgba(${26 + Math.floor(random() * 30)},${41 + Math.floor(random() * 36)},${31 + Math.floor(random() * 28)},.23)`;
      ctx.beginPath(); ctx.ellipse(x, y, 1 + random() * 5, 1 + random() * 3, random() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#94aca21c'; ctx.fillRect(8, 0, 3, 512); ctx.fillRect(170, 0, 2, 512);
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  const reflection = reflectedTrees();
  const mat = {
    white: new THREE.MeshStandardMaterial({ color: '#e8e8de', roughness: .89, map: surface('#f8f7ef', 3, 8) }),
    trim: new THREE.MeshStandardMaterial({ color: '#f2f3eb', roughness: .62 }),
    concrete: new THREE.MeshStandardMaterial({ color: '#a6a69c', roughness: .95, map: surface('#c0c0b5', 2, 21, true) }),
    floor: new THREE.MeshStandardMaterial({ color: '#bebfb3', roughness: .92, map: surface('#ccc9ba', 3, 24, true) }),
    dark: new THREE.MeshStandardMaterial({ color: '#282d2c', roughness: .49, metalness: .48 }),
    recess: new THREE.MeshStandardMaterial({ color: '#101c1b', roughness: .95 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#c5d5d2', map: reflection, roughness: .16, metalness: .31, clearcoat: .75, envMapIntensity: .6 }),
    glassLight: new THREE.MeshPhysicalMaterial({ color: '#e0e4dd', map: reflection, roughness: .22, metalness: .3, clearcoat: .65, envMapIntensity: .6 }),
    steel: new THREE.MeshStandardMaterial({ color: '#d5dcda', roughness: .2, metalness: .95, envMapIntensity: 1.8 }),
    steelDark: new THREE.MeshStandardMaterial({ color: '#8a9490', roughness: .3, metalness: .8 }),
    wood: new THREE.MeshStandardMaterial({ color: '#7e623c', roughness: .92, map: surface('#b0a38a', 1, 24, true) }),
    panel: new THREE.MeshStandardMaterial({ color: '#a79d8b', roughness: .75, map: surface('#ddd4c1', 1, 12, true) }),
    red: new THREE.MeshStandardMaterial({ color: '#9e2530', roughness: .85 }),
    interior: new THREE.MeshBasicMaterial({ color: '#202621' }),
  };
  function instance(geometry, material, position, scale, rotation) {
    const key = `${geometry.uuid}:${material.uuid}`;
    if (!batches.has(key)) batches.set(key, { geometry, material, matrices: [] });
    dummy.position.set(...position); dummy.scale.set(...scale);
    dummy.rotation.set(0, 0, 0); if (rotation) dummy.rotation.set(...rotation);
    dummy.updateMatrix(); batches.get(key).matrices.push(dummy.matrix.clone());
  }
  function box(w, h, d, x, y, z, material = mat.white, rotation) {
    instance(boxGeo, material, [x, y, z], [w, h, d], rotation);
  }
  function rod(a, b, radius = .025, material = mat.steel) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const dir = end.clone().sub(start); dummy.position.copy(start).add(end).multiplyScalar(.5);
    dummy.scale.set(radius, dir.length(), radius);
    dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    dummy.updateMatrix();
    const key = `${rodGeo.uuid}:${material.uuid}`;
    if (!batches.has(key)) batches.set(key, { geometry: rodGeo, material, matrices: [] });
    batches.get(key).matrices.push(dummy.matrix.clone());
  }
  function ball(x, y, z, radius) { instance(ballGeo, mat.steel, [x, y, z], [radius, radius, radius]); }

  // Reinforced concrete floors, deep projecting eaves and balcony fascia.
  box(12, .20, 8.8, 0, .03, 0, mat.floor);
  box(14.2, .26, 10.45, .15, 3.15, .28, mat.trim);
  box(14.12, .06, 10.38, .15, 3.31, .28, mat.floor);
  box(14.5, .35, 10.75, .20, 6.61, .18, mat.trim);
  box(14.43, .07, 10.68, .20, 6.82, .18, mat.floor);
  box(14.5, .13, .075, .20, 6.90, 5.54, mat.trim);
  box(.075, .13, 10.75, 7.41, 6.90, .18, mat.trim);
  box(.075, .13, 10.75, -7.01, 6.90, .18, mat.trim);
  box(14.5, .13, .075, .20, 6.90, -5.18, mat.trim);
  // The front is +Z. Thin returns at edges give real reveal depth.
  box(12, 3.0, .24, 0, 4.9, 4.28);
  box(.25, 3.0, 8.7, -5.88, 4.9, 0);
  box(.25, 3.0, 8.7, 5.88, 4.9, 0, mat.concrete);
  box(.28, 3.0, 3.2, 5.90, 4.9, 2.75);
  box(12, 3.0, .23, 0, 4.9, -4.28, mat.concrete);
  // Ground floor includes the open storage bay visible in the photograph.
  box(12, 3, .25, 0, 1.6, -4.28, mat.concrete);
  box(.27, 3, 8.8, -5.88, 1.6, 0);
  box(.27, 3, 8.8, 5.88, 1.6, 0, mat.concrete);
  box(3.9, 3, .26, -3.95, 1.6, 4.28);
  box(2.4, 3, .26, 4.75, 1.6, 4.28);
  box(.36, 3.1, .4, -1.81, 1.63, 4.28);
  box(.42, 3.1, .4, 3.32, 1.63, 4.28);
  box(5.1, .34, .3, .8, 2.98, 4.28);
  box(5.1, 2.72, .13, .8, 1.48, -1.3, mat.interior);
  box(5.1, .06, 5.4, .8, .19, 1.4, mat.floor);
  box(.15, 2.7, 5.5, -1.69, 1.48, 1.5, mat.interior);
  box(.15, 2.7, 5.5, 3.10, 1.48, 1.5, mat.interior);

  function frontWindow(cx, cy, width, height, z = 4.432, divisions = 2, material = mat.glass) {
    box(width + .15, height + .15, .055, cx, cy, z - .022, mat.concrete);
    box(width, height, .065, cx, cy, z + .02, mat.recess);
    const paneW = (width - .13) / divisions;
    for (let i = 0; i < divisions; i++) {
      const px = cx - width / 2 + .065 + paneW * (i + .5);
      box(paneW - .045, height - .15, .045, px, cy, z + .06, i % 2 ? mat.glassLight : material);
      box(.048, height, .075, px - paneW / 2, cy, z + .1, mat.dark);
      box(paneW - .04, .035, .05, px, cy - height * .25, z + .105, mat.dark);
    }
    for (const dx of [-width / 2, width / 2]) box(.065, height + .04, .12, cx + dx, cy, z + .07, mat.dark);
    for (const dy of [-height / 2, height / 2]) box(width + .07, .065, .12, cx, cy + dy, z + .07, mat.dark);
    box(width + .22, .075, .24, cx, cy - height / 2 - .07, z + .05, mat.concrete);
  }
  frontWindow(-4.62, 4.94, 1.35, 2.05);
  frontWindow(2.35, 4.91, 2.72, 2.04);
  // Narrow top lights and sliding double leaf window frames.
  box(2.72, .055, .12, 2.35, 5.58, 4.53, mat.dark);
  frontWindow(-4.23, 1.65, 2.08, 1.85);
  frontWindow(4.75, 1.63, 1.37, 2.18);

  function inscription(text, w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#a53038'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#b98b56'; ctx.lineWidth = 3; ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.fillStyle = '#322b26'; ctx.font = `bold ${w * .70}px "KaiTi", "Microsoft YaHei", serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [...text].forEach((char, i) => ctx.fillText(char, w / 2, (i + .5) * h / text.length));
    const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map, roughness: .9 });
  }
  const doorX = -1.53, doorY = 4.78, doorW = 2.03, doorH = 2.85;
  box(doorW + .26, doorH + .15, .14, doorX, doorY, 4.46, mat.concrete);
  box(doorW, doorH, .15, doorX, doorY, 4.57, mat.dark);
  for (const sign of [-1, 1]) {
    const x = doorX + sign * .50;
    box(.88, 1.55, .07, x, 5.21, 4.675, mat.glass);
    box(.77, .70, .07, x, 3.95, 4.675, mat.dark);
    for (const dx of [-.42, .42]) box(.035, 2.54, .075, x + dx, 4.74, 4.72, mat.dark);
    for (const yy of [3.53, 4.32, 4.40, 5.99]) box(.87, .035, .065, x, yy, 4.72, mat.dark);
    rod([doorX + sign * .10, 4.24, 4.82], [doorX + sign * .10, 4.63, 4.82], .025, mat.steelDark);
    box(.075, .12, .08, doorX + sign * .10, 4.4, 4.78, mat.steelDark);
    box(.24, 2.17, .018, doorX + sign * 1.23, 5.04, 4.437,
      inscription(sign < 0 ? '家和人兴百福来' : '平安富贵满堂春', 96, 768));
  }
  box(2.25, .10, .43, doorX, 3.37, 4.68, mat.concrete);
  box(.35, .35, .018, doorX, 6.07, 4.69, inscription('福', 192, 192), [0, 0, Math.PI / 4]);
  box(.15, .12, .03, -.02, 4.28, 4.448, mat.steelDark);

  // Low unfinished attic, with three dark paired windows.
  box(12, 1.52, .22, 0, 7.585, 4.28, mat.concrete);
  box(12, 1.52, .22, 0, 7.585, -4.28, mat.concrete);
  box(.25, 1.37, 8.6, 5.88, 7.51, 0, mat.concrete);
  box(.25, 1.37, 8.6, -5.88, 7.51, 0, mat.concrete);
  for (const [x, width] of [[-4.74, 1.25], [-1.72, 1.9], [2.43, 2.50]]) frontWindow(x, 7.56, width, .86, 4.41);
  // Solid triangular gable ends.
  const gable = new THREE.Shape(); gable.moveTo(-4.3, 8.10); gable.lineTo(4.3, 8.10); gable.lineTo(4.3, 8.34); gable.lineTo(0, 10.15); gable.lineTo(-4.3, 8.34); gable.closePath();
  const gableGeo = new THREE.ShapeGeometry(gable);
  for (const x of [-6.01, 6.01]) {
    const wall = new THREE.Mesh(gableGeo, new THREE.MeshStandardMaterial({ color: '#aaa99c', roughness: .97, side: THREE.DoubleSide }));
    wall.rotation.y = Math.PI / 2; wall.position.x = x;
    wall.castShadow = wall.receiveShadow = true; house.add(wall);
  }
  house.add(createRoof(THREE));

  // Side windows, the open balcony door and a small attic access.
  function sideWindow(z, y, w, h, x = 6.05) {
    box(.07, h + .15, w + .15, x, y, z, mat.concrete);
    box(.10, h, w, x + .04, y, z, mat.recess);
    box(.055, h - .14, w - .14, x + .10, y, z, mat.glass);
    for (const zz of [z - w / 2, z, z + w / 2]) box(.12, h, .055, x + .11, y, zz, mat.dark);
    for (const yy of [y - h / 2, y + h / 2]) box(.12, .07, w + .08, x + .11, yy, z, mat.dark);
    box(.21, .07, w + .24, x + .08, y - h / 2 - .07, z, mat.concrete);
  }
  sideWindow(-1.2, 5.0, 1.32, 1.75);
  sideWindow(-3.45, 5.0, .9, 1.75);
  sideWindow(-2.0, 1.65, 1.4, 1.85);
  sideWindow(-1.5, 7.48, .78, 1.12);
  box(.08, 2.48, .96, 6.075, 4.64, 2.95, mat.recess);
  box(.14, 2.58, .055, 6.12, 4.65, 3.44, mat.dark);
  box(.14, 2.58, .055, 6.12, 4.65, 2.45, mat.dark);
  box(.14, .07, 1.06, 6.12, 5.93, 2.95, mat.dark);
  box(.1, 2.46, .84, 6.38, 4.64, 3.38, mat.dark, [0, -.63, 0]);
  box(.11, 1.53, .59, 6.45, 4.88, 3.37, mat.glass, [0, -.63, 0]);
  rod([6.63, 4.45, 3.53], [6.63, 4.67, 3.53], .022);
  const ornament = new THREE.Mesh(new THREE.TorusGeometry(.26, .032, 8, 32), mat.dark);
  ornament.position.set(6.09, 5.05, 4.04); ornament.rotation.y = Math.PI / 2; house.add(ornament);
  box(.016, .19, .16, 6.1, 5.05, 4.04, mat.red, [.4, 0, 0]);

  // Stainless steel railing: individual rods, cross rails, collars and finials.
  function railing(a, b, baseY, sections, slope = 0) {
    const start = new THREE.Vector3(a[0], baseY, a[1]);
    const end = new THREE.Vector3(b[0], baseY + slope, b[1]);
    const at = t => start.clone().lerp(end, t);
    for (const height of [.15, .36, .87, 1.02]) {
      const aa = at(0), bb = at(1); aa.y += height; bb.y += height;
      rod(aa.toArray(), bb.toArray(), height === 1.02 ? .034 : .022);
    }
    for (let i = 0; i <= sections; i++) {
      const p = at(i / sections);
      rod([p.x, p.y, p.z], [p.x, p.y + 1.14, p.z], .046);
      box(.14, .045, .14, p.x, p.y + .025, p.z, mat.steel);
      ball(p.x, p.y + 1.19, p.z, .082);
      rod([p.x, p.y + 1.03, p.z], [p.x, p.y + 1.10, p.z], .067);
      if (i < sections) {
        const length = start.distanceTo(end) / sections;
        const count = Math.max(2, Math.floor(length / .16));
        for (let k = 1; k < count; k++) {
          const q = at((i + k / count) / sections);
          rod([q.x, q.y + .16, q.z], [q.x, q.y + .86, q.z], .014);
        }
      }
    }
  }
  railing([-6.67, 5.38], [6.07, 5.38], 3.36, 8);
  railing([-6.67, 5.38], [-6.67, -3.9], 3.36, 6);
  railing([7.07, 4.12], [7.07, -4.7], 3.36, 6);
  railing([6.08, 5.38], [6.08, 6.48], 3.36, 1);
  railing([7.07, -4.7], [5.99, -4.7], 3.36, 1);
  // Exterior stair descending toward the camera along the right hand side.
  const steps = 18, rise = 3.36 / steps, tread = .255, stairZ = 6.30;
  box(1.08, .20, 1.05, 6.61, 3.24, 5.9, mat.floor);
  for (let i = 0; i < steps; i++) {
    const height = 3.36 - (i + 1) * rise;
    box(1.06, .18 + height, tread + .013, 6.61, (height + .18) / 2 - .15, stairZ + (i + .5) * tread, mat.concrete);
    box(1.06, .025, .075, 6.61, height + .032, stairZ + (i + 1) * tread - .045, mat.floor);
  }
  railing([6.08, 6.37], [6.08, 10.78], 3.34, 4, -3.34);
  railing([7.15, 4.08], [7.15, 6.37], 3.34, 2);
  railing([7.15, 6.37], [7.15, 10.78], 3.34, 4, -3.34);

  // Stored screen doors, timber, doormats, conduit and daily-life details.
  for (const [x, w, tilt] of [[4.15, .88, -.09], [5.21, .94, -.035]]) {
    box(w, 2.1, .065, x, 4.42, 4.93, mat.panel, [tilt, 0, 0]);
    for (const dx of [-w / 2, w / 2]) box(.027, 2.15, .082, x + dx, 4.42, 4.94, mat.steelDark, [tilt, 0, 0]);
    for (const yy of [3.37, 5.46]) box(w, .037, .083, x, yy, 4.94, mat.steelDark);
  }
  box(.55, .012, .30, 3.11, 3.37, 4.81, mat.panel);
  box(.58, .018, .36, 6.56, 3.37, 3.19, mat.red, [0, -.3, 0]);
  for (let i = 0; i < 7; i++) box(.12, 2.5 + random() * .45, .065, 6.30 + random() * .27, 4.55, -.3 + random() * .7, mat.wood, [random() * .13, 0, -.14]);
  for (let i = 0; i < 8; i++) box(.11, 2.1 + random() * .5, .065, -1.23 + random() * .6, 1.32, 3.82, mat.wood, [0, 0, .2]);
  rod([6.15, 3.38, -3.85], [6.15, 6.85, -3.85], .027, mat.concrete);
  rod([6.15, 6.85, -3.85], [5.99, 6.97, -3.85], .027, mat.concrete);
  // Rear elevations are inferred because only two sides appear in the source.
  for (const x of [-3.8, 0, 3.8]) {
    box(1.75, 1.6, .075, x, 4.85, -4.44, mat.dark);
    box(1.61, 1.46, .08, x, 4.85, -4.485, mat.glass);
    box(.05, 1.6, .09, x, 4.85, -4.5, mat.dark);
  }
  for (const { geometry, material, matrices } of batches.values()) {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.castShadow = mesh.receiveShadow = true; mesh.name = '建筑构件';
    mesh.computeBoundingSphere(); house.add(mesh);
  }
  return house;
}
