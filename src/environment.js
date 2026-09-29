// Deterministic, self-contained scenery. All textures are drawn at runtime;
// the scene needs no image CDN, network request, or downloaded model.
export function buildEnvironment({ THREE, scene, renderer }) {
  const root = new THREE.Group();
  root.name = 'photo-reference-environment';
  root.userData.noInteract = true;
  scene.add(root);
  const resources = new Set();
  const own = resource => (resources.add(resource), resource);
  let seed = 19670803;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const range = (lo, hi) => lo + (hi - lo) * random();
  const clamp = THREE.MathUtils.clamp;
  const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
  function canvas(width, height = width) {
    const element = document.createElement('canvas');
    element.width = width;
    element.height = height;
    return [element, element.getContext('2d')];
  }
  function texture(element, repeat = 1) {
    const result = own(new THREE.CanvasTexture(element));
    result.colorSpace = THREE.SRGBColorSpace;
    result.wrapS = result.wrapT = THREE.RepeatWrapping;
    result.repeat.set(repeat, repeat);
    result.anisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() ?? 4);
    return result;
  }
  function add(mesh) {
    mesh.userData.noInteract = true;
    // Decorative foliage must neither obscure pickup raycasts nor spend CPU
    // intersecting thousands of leaves for an interaction that cannot use them.
    mesh.raycast = () => {};
    root.add(mesh);
    return mesh;
  }
  function grain(ctx, size, count, light, dark) {
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = i % 3 ? dark : light;
      const scale = range(.35, 1.8);
      ctx.fillRect(random() * size, random() * size, scale, scale);
    }
  }

  // One unique courtyard texture gives the slab long, irregular hairline
  // cracks and damp edges without creating a repeated paving pattern.
  const [slabCanvas, slab] = canvas(1536);
  slab.fillStyle = '#a7a9a1';
  slab.fillRect(0, 0, 1536, 1536);
  for (let i = 0; i < 160; i++) {
    const x = range(0, 1536), y = range(0, 1536), radius = range(30, 280);
    const gradient = slab.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, i % 3 ? 'rgba(220,219,203,.09)' : 'rgba(71,79,64,.08)');
    gradient.addColorStop(1, 'rgba(110,113,104,0)');
    slab.fillStyle = gradient;
    slab.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  grain(slab, 1536, 110000, 'rgba(237,233,215,.11)', 'rgba(49,58,46,.10)');
  function crack(x, y, angle, length, depth = 0) {
    slab.beginPath(); slab.moveTo(x, y);
    const steps = Math.ceil(length / 11);
    for (let j = 0; j < steps; j++) {
      angle += range(-.37, .37);
      x += Math.cos(angle) * range(5, 14);
      y += Math.sin(angle) * range(5, 14);
      slab.lineTo(x, y);
    }
    slab.lineWidth = depth ? .55 : range(.65, 1.7);
    slab.strokeStyle = depth ? 'rgba(65,69,57,.14)' : 'rgba(54,61,49,.23)';
    slab.stroke();
    if (!depth) crack(x, y, angle + range(-1.3, 1.3), length * .4, 1);
  }
  for (let i = 0; i < 13; i++) crack(range(0, 1536), range(0, 1536), range(0, Math.PI * 2), range(130, 370));
  // A few old poured-concrete construction joints, deliberately not a tile grid.
  for (const [x, y, dx, dy] of [[0, 475, 510, 58], [509, 531, 523, 26], [996, 0, -21, 536]]) {
    slab.strokeStyle = 'rgba(67,72,61,.15)'; slab.lineWidth = 2;
    slab.beginPath(); slab.moveTo(x, y); slab.lineTo(x + dx, y + dy); slab.stroke();
  }
  const concreteMap = texture(slabCanvas);
  const groundMaterial = own(new THREE.MeshStandardMaterial({ map: concreteMap, roughness: .98, bumpMap: concreteMap, bumpScale: .014, color: '#deded5' }));
  const outline = [[-10.5,-6.7],[-10.7,2],[-10.35,8],[-10.65,13.4],[-9.9,18.1],[-7.4,20.2],[-2.2,20.7],[3.3,20.3],[8.4,21],[11.1,18.5],[11.45,12.5],[11.15,6],[11.55,-2],[10.3,-6.7]];
  const courtPositions = [], courtUvs = [];
  function courtVertex(x, z) { courtPositions.push(x, -.012, z); courtUvs.push((x + 11) / 23, (z + 7) / 29); }
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    courtVertex(0, 6); courtVertex(a[0], a[1]); courtVertex(b[0], b[1]);
  }
  const courtGeometry = own(new THREE.BufferGeometry());
  courtGeometry.setAttribute('position', new THREE.Float32BufferAttribute(courtPositions, 3));
  courtGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(courtUvs, 2));
  courtGeometry.computeVertexNormals();
  const court = add(new THREE.Mesh(courtGeometry, groundMaterial));
  court.name = 'weathered-concrete-courtyard';
  court.receiveShadow = true;

  const [earthCanvas, earth] = canvas(512);
  earth.fillStyle = '#465433'; earth.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2200; i++) {
    earth.fillStyle = ['#55653f', '#4b5833', '#455b39', '#64684a', '#4c6038'][i % 5];
    earth.globalAlpha = .24;
    earth.beginPath(); earth.ellipse(range(0,512), range(0,512), range(1,18), range(1,10), range(0,6), 0, Math.PI * 2); earth.fill();
  }
  earth.globalAlpha = 1;
  grain(earth, 512, 14000, 'rgba(168,162,118,.10)', 'rgba(25,43,24,.12)');
  const earthMap = texture(earthCanvas, 48);
  const earthMaterial = own(new THREE.MeshStandardMaterial({ map: earthMap, color: '#a2b68d', vertexColors: true, roughness: 1 }));
  function terrainHeight(x, z) {
    // The house, stairs, and walking courtyard stay exactly at ground level.
    const distance = Math.max(-12 - x, x - 13, -8 - z, z - 25, 0);
    const blend = smooth(distance / 30);
    const hill = (cx, cz, width, height) => Math.exp(-((x-cx)**2 + (z-cz)**2) / (width * width)) * height;
    const ridges = hill(-55,-46,34,22) + hill(49,-61,37,27) + hill(-5,-105,39,29) + hill(-82,35,32,11) + hill(79,20,42,13);
    const detail = Math.sin(x*.113+z*.041)*1.6 + Math.sin(z*.157-x*.039)*1.1 + Math.sin(x*.32+z*.26)*.4;
    return -.045 + blend * Math.max(.1, ridges + detail);
  }
  function makeTerrainGeometry(segments) {
    const geometry = own(new THREE.PlaneGeometry(240, 240, segments, segments));
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3), tint = new THREE.Color();
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), z = position.getZ(i), y = terrainHeight(x, z);
      position.setY(i, y);
      const variation = .92 + Math.sin(x*.23+z*.09)*.035 + Math.sin(z*.36)*.025;
      tint.setRGB(variation*.97, variation, variation*.89);
      tint.toArray(colors, i*3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }
  const terrainGeometry = makeTerrainGeometry(96), lowTerrainGeometry = makeTerrainGeometry(40);
  const terrain = add(new THREE.Mesh(terrainGeometry, earthMaterial));
  terrain.name = 'continuous-wooded-hillside'; terrain.receiveShadow = true;

  // The image on each card is an actual branching spray of dozens of leaves,
  // with open space between them. Multiple angled cards form rounded canopies.
  const [leavesCanvas, leaves] = canvas(1024);
  const leafColors = ['#587438','#668344','#466434','#59773c','#72884b','#3e5c2e'];
  function leaf(x, y, length, angle, color) {
    leaves.save(); leaves.translate(x, y); leaves.rotate(angle);
    leaves.beginPath(); leaves.moveTo(-length*.47,0);
    leaves.bezierCurveTo(-length*.2,-length*.28,length*.30,-length*.29,length*.54,0);
    leaves.bezierCurveTo(length*.14,length*.25,-length*.22,length*.25,-length*.47,0);
    leaves.fillStyle=color; leaves.fill();
    leaves.strokeStyle='rgba(190,200,121,.27)'; leaves.lineWidth=.85;
    leaves.beginPath(); leaves.moveTo(-length*.38,0); leaves.lineTo(length*.42,0); leaves.stroke();
    leaves.restore();
  }
  for (let spray = 0; spray < 13; spray++) {
    const theta = spray * 2.399963 + range(-.2,.2), radial = 85 + Math.sqrt(spray/13)*250;
    const tx = 512 + Math.cos(theta)*radial, ty = 515 + Math.sin(theta)*radial;
    leaves.strokeStyle = 'rgba(83,88,45,.8)'; leaves.lineWidth = range(2,4);
    leaves.beginPath(); leaves.moveTo(512,665); leaves.quadraticCurveTo((512+tx)*.5,ty+60,tx,ty); leaves.stroke();
    for (let j = 0; j < 42; j++) {
      const a = range(0,Math.PI*2), r = Math.sqrt(random())*range(75,132);
      const x = tx + Math.cos(a)*r, y = ty + Math.sin(a)*r*.7;
      leaves.strokeStyle='rgba(92,98,53,.65)'; leaves.lineWidth=1.2;
      leaves.beginPath(); leaves.moveTo(tx,ty); leaves.lineTo(x,y); leaves.stroke();
      leaf(x,y,range(49,94),a+range(-.5,.5),leafColors[Math.floor(random()*leafColors.length)]);
    }
  }
  const leafMap = texture(leavesCanvas);
  leafMap.wrapS = leafMap.wrapT = THREE.ClampToEdgeWrapping;
  const leafMaterial = own(new THREE.MeshStandardMaterial({ map: leafMap, alphaTest: .24, side: THREE.DoubleSide, roughness: .96, color: '#e4e5bb' }));
  leafMaterial.alphaToCoverage = true;

  const [barkCanvas, bark] = canvas(128,512);
  bark.fillStyle = '#686353'; bark.fillRect(0,0,128,512);
  for (let i=0;i<230;i++) {
    const x = range(0,128), y = range(0,512);
    bark.strokeStyle = i%3?'rgba(39,42,31,.3)':'rgba(164,160,133,.27)';
    bark.lineWidth = range(.5,2.5);
    bark.beginPath(); bark.moveTo(x,y); bark.lineTo(x+range(-3,3),y+range(6,96)); bark.stroke();
  }
  const barkMap = texture(barkCanvas);
  const barkMaterial = own(new THREE.MeshStandardMaterial({ map: barkMap, roughness: 1, color:'#b5b2a0' }));
  const trunkGeometry = own(new THREE.CylinderGeometry(.3,1,1,6,1));
  const cardGeometry = own(new THREE.PlaneGeometry(1,1));
  const trunks = [], cards = [], lowTrunks = [], lowCards = [];
  const dummy = new THREE.Object3D(), direction = new THREE.Vector3(), up = new THREE.Vector3(0,1,0);
  function branch(x1,y1,z1,x2,y2,z2,radius,keepLow=false) {
    direction.set(x2-x1,y2-y1,z2-z1);
    const length=direction.length();
    dummy.position.set((x1+x2)*.5,(y1+y2)*.5,(z1+z2)*.5);
    dummy.quaternion.setFromUnitVectors(up,direction.normalize()); dummy.scale.set(radius,length,radius); dummy.updateMatrix();
    const entry={matrix:dummy.matrix.clone(),color:new THREE.Color().setHSL(range(.10,.14),range(.08,.16),range(.48,.66))};
    trunks.push(entry);
    if(keepLow) lowTrunks.push(entry);
  }
  function foliageCard(x,y,z,width,height,shade=1,lowScale=0) {
    dummy.position.set(x,y,z); dummy.rotation.set(range(-1.1,1.1),range(-Math.PI,Math.PI),range(-.9,.9));
    dummy.scale.set(width,height,1); dummy.updateMatrix();
    const entry={matrix:dummy.matrix.clone(),color:new THREE.Color().setHSL(range(.20,.26),range(.16,.29),range(.65,.9)*shade)};
    cards.push(entry);
    if(lowScale) lowCards.push({matrix:entry.matrix.clone().scale(new THREE.Vector3(lowScale,lowScale,1)),color:entry.color});
  }
  function tree(x,z,height,crownRadius,detail=1) {
    const ground=terrainHeight(x,z), leanX=range(-.35,.35), leanZ=range(-.35,.35), fork=height*range(.39,.53);
    const trunkRadius=height*range(.022,.032);
    branch(x,ground,z,x+leanX,ground+height*.82,z+leanZ,trunkRadius,detail===1);
    const count=detail===1?6:4;
    for(let j=0;j<count;j++) {
      const angle=j/count*Math.PI*2+range(-.45,.45), reach=crownRadius*range(.5,.92);
      branch(x+leanX*.5,ground+fork+j*.12,z+leanZ*.5,x+Math.cos(angle)*reach,ground+height*range(.72,.95),z+Math.sin(angle)*reach,trunkRadius*range(.25,.45),detail===1&&j%2===0);
    }
    const leafCount=detail===1?68:34;
    for(let j=0;j<leafCount;j++) {
      const a=j*2.399963, h=range(-1,1), radial=Math.sqrt(1-h*h)*Math.sqrt(random());
      const width=crownRadius*range(.83,1.22);
      // Select cards within every crown, never by cutting off the global
      // instance array. The broader low-detail cards keep each tree covered.
      const lowScale=detail===1?(j%4===0?1.43:0):(j%7===0?1.72:0);
      foliageCard(x+Math.cos(a)*radial*crownRadius,ground+height*.83+h*crownRadius*.70,z+Math.sin(a)*radial*crownRadius,width,width*range(.69,.98),j%7===0?.8:1,lowScale);
    }
  }
  // Close woodland lies beyond the veranda and courtyard, not in the usable
  // walking rectangle. Jitter, irregular heights, and understory hide rows.
  for(let i=0;i<44;i++) tree(range(-31,-13),range(-27,29),range(5.2,10.3),range(2.1,3.6));
  for(let i=0;i<44;i++) tree(range(15.8,34),range(-28,29),range(5.5,10.5),range(2.1,3.8));
  for(let i=0;i<46;i++) tree(range(-29,31),range(-35,-12.8),range(6.0,11.3),range(2.1,3.5));
  let farCount=0, attempts=0;
  while(farCount<245&&attempts++<2500) {
    const x=range(-102,102),z=range(-112,78);
    if(Math.hypot(x,z)<34 || (Math.abs(x)<19&&z>16)) continue;
    tree(x,z,range(5,10.5),range(2.9,4.5),.5); farCount++;
  }
  // Interlocking lower crowns make the distant mountain a continuous forest,
  // rather than isolated park trees standing on exposed grass. They share the
  // same instanced foliage batch and cost only a few thousand extra triangles.
  for(let gx=-109;gx<111;gx+=6.5) for(let gz=-109;gz<69;gz+=6.5) {
    const x=gx+range(-2.5,2.5),z=gz+range(-2.5,2.5);
    if(Math.hypot(x,z)<31 || (Math.abs(x)<20&&z>15)) continue;
    const y=terrainHeight(x,z)+range(2.4,4.2),width=range(7.2,10.5);
    for(let j=0;j<5;j++) foliageCard(x+range(-1,1),y+range(-.6,.6),z+range(-1,1),width,width*range(.56,.74),range(.77,.91),j===0||j===3?1.28:0);
  }
  for(let i=0;i<95;i++) {
    let x,z;
    if(i<32){x=range(-29,-14);z=range(-26,25);}
    else if(i<64){x=range(16.5,31);z=range(-26,25);}
    else{x=range(-29,30);z=range(-32,-14);}
    const ground=terrainHeight(x,z),height=range(1.8,3.8);
    for(let j=0;j<10;j++) foliageCard(x+range(-1.5,1.5),ground+range(.4,height),z+range(-1.5,1.5),range(2,3.1),range(1.6,2.7),range(.78,.95),j%3===0?1.3:0);
  }
  // Brambles and dense broadleaf shrubs soften the concrete/woodland boundary.
  for(let i=0;i<185;i++) {
    let x,z;
    if(i<58){x=range(-14.8,-11.2);z=range(-7,24);}
    else if(i<116){x=range(13.0,16.4);z=range(-9,25);}
    else{x=range(-29,32);z=range(-27,-10.2);}
    const ground=terrainHeight(x,z), height=range(.7,1.8), radius=range(.7,1.45);
    for(let j=0;j<11;j++) {
      const angle=j*2.39996,radial=Math.sqrt(random())*radius;
      foliageCard(x+Math.cos(angle)*radial,ground+range(.25,height),z+Math.sin(angle)*radial,range(.7,1.3),range(.55,1.05),range(.73,.95),j%3===0?1.28:0);
    }
  }
  const trunkMesh=add(new THREE.InstancedMesh(trunkGeometry,barkMaterial,trunks.length));
  trunkMesh.name='woodland-trunks-and-branches';
  trunks.forEach((entry,i)=>{trunkMesh.setMatrixAt(i,entry.matrix);trunkMesh.setColorAt(i,entry.color);});
  trunkMesh.castShadow=true; trunkMesh.receiveShadow=true;
  const leavesMesh=add(new THREE.InstancedMesh(cardGeometry,leafMaterial,cards.length));
  leavesMesh.name='fine-broadleaf-canopies-and-understory';
  cards.forEach((entry,i)=>{leavesMesh.setMatrixAt(i,entry.matrix);leavesMesh.setColorAt(i,entry.color);});
  leavesMesh.castShadow=true; leavesMesh.receiveShadow=true;
  trunkMesh.computeBoundingSphere(); leavesMesh.computeBoundingSphere();
  const lowTrunkGeometry=own(new THREE.CylinderGeometry(.3,1,1,4,1));
  const lowTrunkMesh=add(new THREE.InstancedMesh(lowTrunkGeometry,barkMaterial,lowTrunks.length));
  lowTrunkMesh.name='near-tree-branches-low-detail';
  lowTrunks.forEach((entry,i)=>{lowTrunkMesh.setMatrixAt(i,entry.matrix);lowTrunkMesh.setColorAt(i,entry.color);});
  const lowLeavesMesh=add(new THREE.InstancedMesh(cardGeometry,leafMaterial,lowCards.length));
  lowLeavesMesh.name='complete-woodland-canopies-low-detail';
  lowCards.forEach((entry,i)=>{lowLeavesMesh.setMatrixAt(i,entry.matrix);lowLeavesMesh.setColorAt(i,entry.color);});
  lowTrunkMesh.receiveShadow=true;lowLeavesMesh.receiveShadow=true;
  lowTrunkMesh.computeBoundingSphere();lowLeavesMesh.computeBoundingSphere();

  // Very small weeds and stones collect at rough slab edges; the centre of the
  // courtyard remains uncluttered so first-person movement is unobstructed.
  const [weedCanvas, weeds]=canvas(256);
  for(let i=0;i<36;i++) {
    const x=range(35,220),top=range(12,165);
    weeds.strokeStyle=['#7c8950','#737e44','#8b945e'][i%3]; weeds.lineWidth=range(1.5,3);
    weeds.beginPath();weeds.moveTo(128,256);weeds.quadraticCurveTo(x,150,x,top);weeds.stroke();
  }
  const weedMap=texture(weedCanvas);
  const weedMaterial=own(new THREE.MeshStandardMaterial({map:weedMap,alphaTest:.42,side:THREE.DoubleSide,roughness:1,color:'#bdc99c'}));
  const weedMesh=add(new THREE.InstancedMesh(cardGeometry,weedMaterial,280));
  weedMesh.name='sparse-grass-at-concrete-edge';
  for(let i=0;i<280;i++) {
    const side=i%2?-1:1,x=side<0?range(-11.2,-10.45):range(11.55,12.6),z=range(-4,20),height=range(.13,.41);
    dummy.position.set(x,terrainHeight(x,z)+height*.5,z);dummy.rotation.set(0,range(0,Math.PI),range(-.12,.12));dummy.scale.set(range(.17,.39),height,1);dummy.updateMatrix();weedMesh.setMatrixAt(i,dummy.matrix);
  }
  weedMesh.receiveShadow=true; weedMesh.computeBoundingSphere();
  const pebbleGeometry=own(new THREE.IcosahedronGeometry(1,0));
  const pebbleMaterial=own(new THREE.MeshStandardMaterial({color:'#8e9182',roughness:1}));
  const pebbleMesh=add(new THREE.InstancedMesh(pebbleGeometry,pebbleMaterial,180));
  pebbleMesh.name='small-stones-at-yard-edge';
  for(let i=0;i<180;i++) {
    const side=i%2?-1:1,x=side<0?range(-11.05,-9.9):range(10.9,12.5),z=range(3,20),size=range(.018,.075);
    dummy.position.set(x,.008,z);dummy.rotation.set(random(),random(),random());dummy.scale.set(size,range(.3,.6)*size,size*range(.6,1.6));dummy.updateMatrix();pebbleMesh.setMatrixAt(i,dummy.matrix);
    pebbleMesh.setColorAt(i,new THREE.Color().setHSL(range(.1,.17),range(.04,.14),range(.65,.95)));
  }
  pebbleMesh.receiveShadow=true; pebbleMesh.computeBoundingSphere();
  const highTriangles=trunks.length*24+cards.length*2+96*96*2+280*2+180*20+outline.length;
  const lowTriangles=lowTrunks.length*16+lowCards.length*2+40*40*2+90*2+45*20+outline.length;
  const stats={trees:134+farCount,foliageCards:cards.length,branches:trunks.length,drawCalls:6,highTriangles,lowTriangles};
  function setQuality(high) {
    high=Boolean(high);
    trunkMesh.visible=leavesMesh.visible=high;
    lowTrunkMesh.visible=lowLeavesMesh.visible=!high;
    terrain.geometry=high?terrainGeometry:lowTerrainGeometry;
    // Debris instances are distributed randomly from the start, so reducing
    // their counts does not erase one entire edge of the courtyard.
    weedMesh.count=high?280:90;
    pebbleMesh.count=high?180:45;
    stats.quality=high?'high':'low';
    stats.triangles=high?highTriangles:lowTriangles;
    stats.activeFoliageCards=high?cards.length:lowCards.length;
    stats.activeBranches=high?trunks.length:lowTrunks.length;
  }
  setQuality(!globalThis.matchMedia?.('(pointer:coarse)').matches);
  return {
    root, groundMaterial, terrainHeight, setQuality, stats,
    dispose() {
      scene.remove(root);
      root.traverse(object=>{if(object.isInstancedMesh)object.dispose();});
      resources.forEach(resource=>resource.dispose());
    }
  };
}
