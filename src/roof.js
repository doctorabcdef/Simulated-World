// A real, corrugated tile surface: the overlapping rows and rolled crests are
// geometry, so the roof keeps its silhouette and self-shadowing as it is orbited.
export function createRoof(THREE) {
  const roof = new THREE.Group();
  roof.name = 'Blue glazed country-house tile roof';

  const roofWidth = 12.9;
  const roofRun = 4.85;
  const roofRise = 2.05;
  const ridgeHeight = 10.15;
  const slopeLength = Math.hypot(roofRun, roofRise);
  const slopeAngle = Math.atan2(roofRise, roofRun);
  const columns = 48;
  const rows = 14;
  const columnPitch = roofWidth / columns;
  const rowPitch = slopeLength / rows;
  const tileWidth = columnPitch - 0.0025;
  const tileLength = rowPitch + 0.033;
  const random = mulberry32(93142);

  const tileMaterial = new THREE.MeshStandardMaterial({
    color: 0x405c76,
    roughness: 0.46,
    metalness: 0.31,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  const tileGeometry = makeTileGeometry(THREE, tileWidth, tileLength);
  const underMaterial = new THREE.MeshStandardMaterial({ color: 0x273139, roughness: 0.9 });
  const fasciaMaterial = new THREE.MeshStandardMaterial({
    color: 0xb8a379, roughness: 0.66, metalness: 0.22,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x6a747a, roughness: 0.49, metalness: 0.44,
  });
  const darkJointMaterial = new THREE.MeshStandardMaterial({
    color: 0x40474b, roughness: 0.88,
  });
  const dummy = new THREE.Object3D();
  const tileTint = new THREE.Color();

  for (const side of [1, -1]) {
    const slope = new THREE.Group();
    slope.name = side === 1 ? 'Front overlapping roof tiles' : 'Rear overlapping roof tiles';
    slope.position.y = ridgeHeight;
    slope.rotation.set(slopeAngle, side === 1 ? 0 : Math.PI, 0, 'YXZ');
    roof.add(slope);

    const sheathing = new THREE.Mesh(
      new THREE.BoxGeometry(roofWidth, 0.065, slopeLength), underMaterial,
    );
    sheathing.position.set(0, -0.036, slopeLength / 2);
    sheathing.castShadow = sheathing.receiveShadow = true;
    slope.add(sheathing);

    const tiles = new THREE.InstancedMesh(tileGeometry, tileMaterial, rows * columns);
    tiles.name = 'Individually curved interlocking ceramic tiles';
    let index = 0;
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        // The head of each course lies under the foot of the previous course.
        dummy.position.set(
          -roofWidth / 2 + columnPitch * (column + 0.5),
          (rows - row) * 0.0032 + random() * 0.0015,
          row * rowPitch,
        );
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        tiles.setMatrixAt(index, dummy.matrix);
        const shade = 0.78 + random() * 0.24;
        tileTint.setRGB(shade * 0.92, shade * 0.975, shade);
        tiles.setColorAt(index++, tileTint);
      }
    }
    tiles.instanceMatrix.needsUpdate = true;
    tiles.instanceColor.needsUpdate = true;
    tiles.castShadow = tiles.receiveShadow = true;
    slope.add(tiles);

    // A narrow warm, weathered eaves board is visible in the photograph.
    addBox(slope, roofWidth + 0.11, 0.095, 0.10,
      0, -0.03, slopeLength + 0.012, fasciaMaterial);
    addBox(slope, roofWidth + 0.14, 0.024, 0.043,
      0, 0.028, slopeLength + 0.039, trimMaterial);
    addBox(slope, roofWidth + 0.04, 0.017, 0.017,
      0, -0.079, slopeLength + 0.041, darkJointMaterial);

    // Small exposed joints and streaks break the otherwise perfect fascia.
    for (let joint = 0; joint < 11; joint++) {
      const x = -roofWidth / 2 + (joint + 0.5) * roofWidth / 11;
      addBox(slope, 0.016 + random() * 0.014, 0.078, 0.007,
        x, -0.028, slopeLength + 0.066, darkJointMaterial);
    }
    for (const x of [-roofWidth / 2 - 0.028, roofWidth / 2 + 0.028]) {
      addBox(slope, 0.085, 0.09, slopeLength + 0.04,
        x, -0.006, slopeLength / 2 + 0.012, trimMaterial);
      addBox(slope, 0.014, 0.014, slopeLength + 0.04,
        x + Math.sign(x) * 0.036, 0.043, slopeLength / 2 + 0.012, fasciaMaterial);
    }
  }

  const capMaterial = new THREE.MeshStandardMaterial({
    color: 0x40586a, roughness: 0.41, metalness: 0.34,
  });
  const capCount = 30;
  const capPitch = roofWidth / capCount;
  // Rotating a half-cylinder around Z puts its curved, closed side above the ridge.
  const capGeometry = new THREE.CylinderGeometry(
    0.108, 0.102, capPitch + 0.014, 16, 1, false, 0, Math.PI,
  );
  const caps = new THREE.InstancedMesh(capGeometry, capMaterial, capCount);
  caps.name = 'Overlapping rounded ridge caps';
  for (let i = 0; i < capCount; i++) {
    dummy.position.set(-roofWidth / 2 + capPitch * (i + 0.5), ridgeHeight + 0.076, 0);
    dummy.rotation.set(0, 0, Math.PI / 2);
    dummy.updateMatrix();
    caps.setMatrixAt(i, dummy.matrix);
    const shade = 0.84 + random() * 0.16;
    tileTint.setRGB(shade, shade, shade);
    caps.setColorAt(i, tileTint);
  }
  caps.castShadow = caps.receiveShadow = true;
  caps.instanceMatrix.needsUpdate = true;
  roof.add(caps);

  return roof;

  function addBox(parent, width, height, depth, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
}

function makeTileGeometry(THREE, width, length) {
  const nx = 16;
  const nz = 8;
  const positions = [];
  const colors = [];
  const uv = [];
  const indices = [];
  for (let j = 0; j <= nz; j++) {
    const v = j / nz;
    for (let i = 0; i <= nx; i++) {
      const u = i / nx;
      // Broad concave pan, a smooth raised roll at every longitudinal join,
      // and a small downturned nose at the eaveward end of each tile.
      const roll = Math.pow((1 + Math.cos(u * Math.PI * 2)) / 2, 2.3);
      const crossSection = 0.009 + 0.047 * roll;
      const nose = 0.010 * Math.exp(-Math.pow((v - 0.85) / 0.16, 2));
      const bow = 0.003 * Math.sin(v * Math.PI);
      positions.push((u - 0.5) * width, crossSection + nose + bow, v * length);
      const brightness = 0.87 + 0.13 * roll - (j === nz ? 0.13 : 0);
      colors.push(brightness, brightness, brightness);
      uv.push(u, v);
    }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + nx + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  // A closed dark lip makes every course readable without painted-on stripes.
  const lastRow = nz * (nx + 1);
  const skirtStart = positions.length / 3;
  for (let i = 0; i <= nx; i++) {
    const p = (lastRow + i) * 3;
    positions.push(positions[p], positions[p + 1] - 0.018, positions[p + 2]);
    colors.push(0.54, 0.58, 0.62);
    uv.push(i / nx, 1);
  }
  for (let i = 0; i < nx; i++) {
    indices.push(lastRow + i, skirtStart + i, lastRow + i + 1);
    indices.push(lastRow + i + 1, skirtStart + i, skirtStart + i + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function mulberry32(seed) {
  return function () {
    let value = seed += 0x6d2b79f5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
