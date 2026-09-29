import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Dimensions are proportion estimates from one photograph, not a measured survey.
export const HOUSE = { halfWidth: 6.3, front: 1.55, back: -5, upperFloor: 3.3, eave: 6.7, balconyFront: 3.15, balconyRight: 9.35 };

export function buildHouse(scene, renderer) {
  const colliders = [], interactables = [], doors = [], staticRoot = new THREE.Group();
  staticRoot.name = 'Reconstructed house'; scene.add(staticRoot);
  const cache = new Map();
  const material = (color, roughness = .8, metalness = 0) => {
    const key = `${color}/${roughness}/${metalness}`;
    if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    return cache.get(key);
  };
  let seed = 1249;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  function texture(base, speckle, count, size = 512) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < count; i++) { ctx.fillStyle = `rgba(${speckle},${random() * .09})`; const s = random() * 2 + .2; ctx.fillRect(random() * size, random() * size, s, s); }
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); return t;
  }
  const plaster = new THREE.MeshStandardMaterial({ color: '#e3e6e5', map: texture('#e7e9e6', '43,49,42', 62000), roughness: .94 });
  const cement = new THREE.MeshStandardMaterial({ color: '#c4c5bf', map: texture('#bbbcb7', '25,30,24', 85000), roughness: .97 });
  const floor = new THREE.MeshStandardMaterial({ color: '#c3c4bf', map: texture('#c3c4c0', '31,35,29', 100000), roughness: .95 });
  const steel = new THREE.MeshStandardMaterial({ color: '#bbc2c7', roughness: .2, metalness: .88 });
  const dark = material('#302f2c', .38, .32), glass = material('#182a2b', .12, .5), wood = material('#8f785e');
  const boxGeometry = new THREE.BoxGeometry();
  function solid(x, y, z, w, h, d) { const collider = { minX:x-w/2, maxX:x+w/2, minY:y-h/2, maxY:y+h/2, minZ:z-d/2, maxZ:z+d/2 }; colliders.push(collider); return collider; }
  function box(x,y,z,w,h,d,mat,collision=false,parent=staticRoot) {
    const m = new THREE.Mesh(boxGeometry, typeof mat === 'string' ? material(mat) : mat); m.position.set(x,y,z); m.scale.set(w,h,d); m.castShadow = m.receiveShadow = true; parent.add(m); if(collision) solid(x,y,z,w,h,d); return m;
  }
  function cylinder(x,y,z,r,h,mat,parent=staticRoot,rTop=r,segments=12) {
    const m=new THREE.Mesh(new THREE.CylinderGeometry(rTop,r,h,segments),typeof mat==='string'?material(mat):mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;
  }
  function ball(x,y,z,r,mat,parent=staticRoot) { const m=new THREE.Mesh(new THREE.SphereGeometry(r,12,8),typeof mat==='string'?material(mat):mat);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m; }
  function pipe(a,b,r=.024,mat=steel,parent=staticRoot) {
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
    const m=cylinder(0,0,0,r,delta.length(),mat,parent);m.position.copy(start.add(end).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;
  }

  // Use selected image regions directly as UVs. The reference remains a single local texture.
  const photo=new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}reference-house.png`);
  photo.colorSpace=THREE.SRGBColorSpace;photo.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const photoMaterial=new THREE.MeshStandardMaterial({map:photo,roughness:.55,metalness:.06});
  function quadMap(quad,u,v) {
    const [p0,p1,p2,p3]=quad,dx1=p1[0]-p2[0],dx2=p3[0]-p2[0],dx3=p0[0]-p1[0]+p2[0]-p3[0];
    const dy1=p1[1]-p2[1],dy2=p3[1]-p2[1],dy3=p0[1]-p1[1]+p2[1]-p3[1],den=dx1*dy2-dx2*dy1;
    const g=(dx3*dy2-dx2*dy3)/den,h=(dx1*dy3-dx3*dy1)/den;
    return [((p1[0]-p0[0]+g*p1[0])*u+(p3[0]-p0[0]+h*p3[0])*v+p0[0])/(g*u+h*v+1),((p1[1]-p0[1]+g*p1[1])*u+(p3[1]-p0[1]+h*p3[1])*v+p0[1])/(g*u+h*v+1)];
  }
  function photoPlane(x,y,z,w,h,quad,parent=staticRoot,rotation=0,range=[0,1]) {
    const geo=new THREE.PlaneGeometry(w,h,12,12),uv=geo.attributes.uv;
    for(let i=0;i<uv.count;i++){const u=range[0]+uv.getX(i)*(range[1]-range[0]),v=1-uv.getY(i),p=quadMap(quad,u,v);uv.setXY(i,p[0]/2048,1-p[1]/1152);}
    const m=new THREE.Mesh(geo,photoMaterial);m.position.set(x,y,z);m.rotation.y=rotation;m.receiveShadow=true;parent.add(m);return m;
  }
  const patches={
    left:[[377,322],[478,337],[495,508],[397,478]],
    right:[[977,407],[1224,440],[1225,686],[978,643]],
    door:[[610,351],[785,379],[803,724],[639,659]],
    atticLeft:[[365,130],[461,127],[465,196],[367,192]],
    atticMid:[[604,121],[746,119],[749,203],[606,199]],
    atticRight:[[978,117],[1228,121],[1229,227],[979,214]],
    side:[[1409,530],[1468,497],[1434,830],[1386,873]],
    board:[[1237,672],[1338,697],[1306,936],[1222,901]],
  };

  function frontWall(y0,height,z,openings,mat=plaster,left=-6.3,right=6.3) {
    let x=left;
    for(const o of [...openings].sort((a,b)=>a.x-b.x)){
      const l=o.x-o.w/2,r=o.x+o.w/2;
      if(l>x)box((l+x)/2,y0+height/2,z,l-x,height,.26,mat,true);
      if(o.bottom>0)box(o.x,y0+o.bottom/2,z,o.w,o.bottom,.26,mat,true);
      if(o.bottom+o.h<height){const h=height-o.bottom-o.h;box(o.x,y0+height-h/2,z,o.w,h,.26,mat,true);}
      x=r;
    }
    if(x<right)box((x+right)/2,y0+height/2,z,right-x,height,.26,mat,true);
  }
  function window(x,y,z,w,h,patch,side=false) {
    if(side)solid(x,y,z,.2,h,w);else solid(x,y,z,w,h,.2);
    const g=new THREE.Group();g.position.set(x,y,z);if(side)g.rotation.y=Math.PI/2;staticRoot.add(g);
    box(0,0,-.04,w+.16,h+.16,.16,cement,false,g);
    box(0,0,.035,w,h,.13,dark,false,g);
    if(patch)photoPlane(0,0,.108,w-.09,h-.09,patch,g);else box(0,0,.11,w-.08,h-.08,.025,glass,false,g);
    for(const dx of [-w/2,0,w/2])box(dx,0,.13,.045,h,.065,dark,false,g);
    for(const dy of [-h/2,h/2])box(0,dy,.13,w,.045,.065,dark,false,g);
    box(0,-h/2-.085,.08,w+.22,.12,.28,cement,false,g);
  }
  // Narrow front balcony, deeper side terrace, and the thick continuous white fascia.
  box(0,-.12,-1.7,12.9,.24,6.9,cement);
  box(0,3.14,-1.35,14.6,.32,9,plaster);
  box(8.22,3.14,-1.35,2.26,.32,9,plaster);
  box(0,3.307,-1.35,14.48,.02,8.83,floor);
  box(8.21,3.307,-1.35,2.14,.02,8.83,floor);
  box(.75,6.64,-1.35,16.6,.34,9.45,plaster);
  box(.75,6.817,-1.35,16.45,.025,9.3,floor);
  // Shallow roof-terrace curb and flashing visible in the source.
  for(const z of [-6.03,3.3])box(.75,6.86,z,16.6,.14,.085,cement);
  for(const x of [-7.5,9])box(x,6.86,-1.35,.085,.14,9.4,cement);

  // Different ground and upper floors, rather than a repeated facade.
  frontWall(0,3.1,1.55,[{x:-4.55,w:1.7,bottom:.65,h:2.05},{x:-.6,w:4.1,bottom:0,h:2.85},{x:4.25,w:1.8,bottom:.6,h:2.05}]);
  window(-4.55,1.675,1.7,1.7,2.05,patches.left);window(4.25,1.625,1.7,1.8,2.05,patches.right);
  frontWall(3.3,3.17,1.55,[{x:-4.65,w:1.55,bottom:.72,h:2.16},{x:-1.25,w:2.2,bottom:0,h:2.88},{x:3.18,w:2.98,bottom:.69,h:2.2}]);
  window(-4.65,5.1,1.7,1.55,2.16,patches.left);window(3.18,5.09,1.7,2.98,2.2,patches.right);
  for(const base of [0,3.3]){
    box(-6.3,base+1.59,-1.75,.26,3.18,6.6,plaster,true);
    box(0,base+1.59,-5,12.8,3.18,.26,base===0?cement:plaster,true);
    if(base===0)box(6.3,1.55,-1.75,.26,3.1,6.6,plaster,true);
    // Interior is intentionally simple; only the visible exterior is photo constrained.
    box(0,base+1.55,-2.55,.18,3.1,4.75,plaster,true);
    box(-3,base+.71,-2.2,1.7,.12,1.2,wood,true);
    for(const x of [-3.7,-2.3])for(const z of [-2.65,-1.75])box(x,base+.34,z,.08,.68,.08,wood);
    box(3.7,base+.28,-3.9,3,.55,1.5,'#6e786a',true);
    box(3.7,base+.7,-4.6,3,.6,.16,'#879184');
  }
  // Right side wall with a real door opening at the front and two rear windows.
  box(6.3,4.885,-2.76,.26,3.17,4.48,plaster,true);
  box(6.3,4.885,1.28,.26,3.17,.54,plaster,true);
  box(6.3,6.28,.25,.26,.39,1.5,plaster,true);
  window(6.45,5.1,-2.3,1.1,1.95,null,true);window(6.45,5.1,-4.25,.85,1.95,null,true);

  function makeDoor({x,y,z,width=2.2,height=2.88,rotation=0,patch=patches.door,double=true,name='木门'}) {
    const group=new THREE.Group();group.position.set(x,y,z);group.rotation.y=rotation;scene.add(group);
    const pivot=new THREE.Group();pivot.position.x=-width/2;group.add(pivot);
    const leaf=double?width/2:width;
    box(leaf/2,height/2,0,leaf,height,.105,dark,false,pivot);
    photoPlane(leaf/2,height/2,.059,leaf-.035,height-.035,patch,pivot,0,double?[0,.5]:[0,1]);
    for(const dy of [.3,.91])box(leaf/2,dy,.073,leaf-.18,.032,.028,dark,false,pivot);
    pipe([leaf-.13,1.13,.105],[leaf-.13,1.39,.105],.02,steel,pivot);
    let barrier;
    if(rotation===0)barrier=solid(x-width/2+leaf/2,y+height/2,z,leaf,height,.19);
    else barrier=solid(x,y+height/2,z+width/2-leaf/2,.19,height,leaf);
    if(double){box(width/4,height/2,0,width/2,height,.105,dark,false,group);photoPlane(width/4,height/2,.059,width/2-.035,height-.035,patch,group,0,[.5,1]);pipe([.11,1.13,.105],[.11,1.39,.105],.02,steel,group);solid(x+width/4,y+height/2,z,width/2,height,.19);}
    const target={type:'door',name,root:group,pivot,barrier,open:false,angle:0};doors.push(target);interactables.push(target);group.traverse(o=>o.userData.target=target);return target;
  }
  // A single inset ground-floor door keeps the visible ground floor open as in the photograph.
  makeDoor({x:-.6,y:0,z:.88,width:2.2,height:2.8});
  makeDoor({x:-1.25,y:3.3,z:1.69});
  makeDoor({x:6.45,y:3.3,z:.25,width:1.45,height:2.77,rotation:Math.PI/2,double:false,patch:patches.side,name:'侧门'});
  // Remaining open storage bay gets its frame, not a fictitious symmetric second entrance.
  box(-2.52,1.43,1.51,.12,2.86,.15,dark);box(1.45,1.43,1.51,.12,2.86,.15,dark);

  function writing(text,w,h,bg,fg,size=80) {
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${size}px KaiTi, STKaiti, serif`;
    [...text].forEach((ch,i)=>ctx.fillText(ch,w/2,(i+.5)*h/text.length));
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshStandardMaterial({map,roughness:.95});
  }
  const coupletA=writing('平安如意人多福',96,768,'#a22935','#281e17'),coupletB=writing('富贵吉祥家兴旺',96,768,'#a9323a','#281e17');
  box(-2.49,4.78,1.707,.22,2.8,.018,coupletA);box(-.01,4.78,1.707,.22,2.8,.018,coupletB);
  const blessing=box(-1.25,6.02,1.785,.27,.27,.012,writing('福',256,256,'#a72e40','#181916',185));blessing.rotation.z=Math.PI/4;
  box(.35,4.15,1.71,.15,.11,.025,'#b3b7ad');

  // Set-back unfinished attic. Gables close the roof volumes at both ends.
  frontWall(6.84,1.37,.7,[{x:-4.72,w:1.35,bottom:.29,h:.81},{x:-1.56,w:1.9,bottom:.23,h:.91},{x:3.22,w:3.05,bottom:.17,h:1.02}],cement,-6.2,6.2);
  window(-4.72,7.535,.85,1.35,.81,patches.atticLeft);window(-1.56,7.525,.85,1.9,.91,patches.atticMid);window(3.22,7.52,.85,3.05,1.02,patches.atticRight);
  box(0,7.525,-4.8,12.5,1.37,.22,cement);
  for(const x of [-6.2,6.2])box(x,7.525,-2.05,.22,1.37,5.7,cement);
  const ridgeY=9.57,eaveY=8.21,ridgeZ=-2.05,frontZ=1.12,backZ=-5.22;
  for(const x of [-6.21,6.21]){
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([x,eaveY,frontZ,x,ridgeY,ridgeZ,x,eaveY,backZ],3));geo.computeVertexNormals();const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:'#acafa9',map:cement.map,roughness:.97,side:THREE.DoubleSide}));staticRoot.add(m);
  }
  box(6.33,7.39,-3.5,.04,1.12,.77,dark);
  pipe([6.42,6.86,-3.48],[6.42,8.2,-3.48],.042,plaster);pipe([6.42,6.86,-3.48],[6.78,6.86,-3.48],.042,plaster);

  // Corrugated blue-grey tiles: continuous curved troughs and overlapping horizontal courses.
  const roofMats=['#4d6575','#526a7a','#566f7d','#526b79'].map(c=>material(c,.46,.2));
  for(const side of [-1,1]){
    const depth=3.32,tiles=52,rows=10,step=depth/rows;
    for(let col=0;col<tiles;col++)for(let row=0;row<rows;row++){
      const positions=[],uvs=[],indices=[];const x0=-6.72+col*.26;
      for(let j=0;j<=2;j++)for(let i=0;i<=6;i++){
        const t=i/6,dist=(row+j/2)*step;
        positions.push(x0+t*.26,ridgeY-dist*(ridgeY-eaveY)/3.17+Math.sin(t*Math.PI)*.045+.02+(j===0?.013:0),ridgeZ+side*dist);uvs.push(t,j/2);
      }
      for(let j=0;j<2;j++)for(let i=0;i<6;i++){const a=j*7+i,b=a+7;if(side>0)indices.push(a,b,a+1,a+1,b,b+1);else indices.push(a,a+1,b,a+1,b+1,b);}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();const m=new THREE.Mesh(geo,roofMats[Math.floor(random()*roofMats.length)]);m.castShadow=m.receiveShadow=true;staticRoot.add(m);
      // A curved narrow lip makes the transverse tile overlaps visible, not a flat metal sheet.
      const lipPositions=[],lipUV=[],lipIndices=[];
      for(let j=0;j<2;j++)for(let i=0;i<=6;i++){const t=i/6,dist=(row+1)*step-j*.022;lipPositions.push(x0+t*.26,ridgeY-dist*(ridgeY-eaveY)/3.17+Math.sin(t*Math.PI)*.045+.043,ridgeZ+side*dist);lipUV.push(t,j);}
      for(let i=0;i<6;i++){const a=i,b=i+7;if(side<0)lipIndices.push(a,b,a+1,a+1,b,b+1);else lipIndices.push(a,a+1,b,a+1,b+1,b);}
      const lipGeo=new THREE.BufferGeometry();lipGeo.setAttribute('position',new THREE.Float32BufferAttribute(lipPositions,3));lipGeo.setAttribute('uv',new THREE.Float32BufferAttribute(lipUV,2));lipGeo.setIndex(lipIndices);lipGeo.computeVertexNormals();const lip=new THREE.Mesh(lipGeo,material('#425d6d',.6,.13));lip.castShadow=lip.receiveShadow=true;staticRoot.add(lip);
    }
    const z=ridgeZ+side*3.32;pipe([-6.77,eaveY-.03,z],[6.83,eaveY-.03,z],.047,material('#bbaf82',.55,.25));
  }
  pipe([-6.8,ridgeY+.035,ridgeZ],[6.86,ridgeY+.035,ridgeZ],.075,roofMats[1]);

  function railing(x1,z1,x2,z2,y1,y2=y1,{collision=true}={}){
    const len=Math.hypot(x2-x1,z2-z1),segments=Math.ceil(len/1.8);
    for(let i=0;i<=segments;i++){
      const t=i/segments,x=THREE.MathUtils.lerp(x1,x2,t),z=THREE.MathUtils.lerp(z1,z2,t),y=THREE.MathUtils.lerp(y1,y2,t);
      cylinder(x,y+.52,z,.038,1.04,steel);cylinder(x,y+.03,z,.075,.06,steel);cylinder(x,y+1.08,z,.052,.1,steel);ball(x,y+1.19,z,.088,steel);
    }
    for(const h of [.16,.4,.98])pipe([x1,y1+h,z1],[x2,y2+h,z2],h===.98?.033:.021,steel);
    const bars=Math.floor(len/.19);
    for(let i=1;i<bars;i++){const t=i/bars,x=THREE.MathUtils.lerp(x1,x2,t),z=THREE.MathUtils.lerp(z1,z2,t),y=THREE.MathUtils.lerp(y1,y2,t);pipe([x,y+.18,z],[x,y+.96,z],.011,steel);}
    if(collision&&Math.abs(y1-y2)<.01)solid((x1+x2)/2,y1+.52,(z1+z2)/2,Math.abs(x2-x1)+.055,1.04,Math.abs(z2-z1)+.055);
  }
  railing(-7.2,3.04,7.48,3.04,3.3);railing(-7.2,3.04,-7.2,-5.72,3.3);
  railing(9.24,-5.72,9.24,3.15,3.3);railing(-7.2,-5.72,9.24,-5.72,3.3);
  // Twenty-two physical stair treads with matching collision height in physics.js.
  for(let i=0;i<22;i++){const h=(i+1)*3.3/22,z=11.15-(i+.5)*8/22;box(8.4,h/2,z,1.8,h,8/22,floor);box(8.4,h+.012,z+.15,1.8,.025,.055,cement);}
  railing(7.48,11.15,7.48,3.15,0,3.3,{collision:false});railing(9.32,11.15,9.32,3.15,0,3.3,{collision:false});
  // Utility wires pass behind the right-side trees as in the photographed setting.
  const cableMat=material('#383d35',.9);for(let i=0;i<3;i++){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(10.8,7.2-i*.12,-6),new THREE.Vector3(13.1,5.9-i*.12,1),new THREE.Vector3(16,5.6-i*.12,9)]);const cable=new THREE.Mesh(new THREE.TubeGeometry(curve,18,.012,4,false),cableMat);staticRoot.add(cable);}
  // Left exterior drying frame.
  pipe([-7.15,4.29,2.25],[-8.22,4.29,2.25]);pipe([-7.15,4.29,-.8],[-8.22,4.29,-.8]);pipe([-8.22,4.29,2.25],[-8.22,4.29,-.8]);

  // The two door panels leaning beside the wide front window.
  for(const [x,w,h] of [[4.94,.92,1.87],[5.95,1.06,2.1]]){
    const group=new THREE.Group();group.position.set(x,3.3+h/2,2);group.rotation.x=-.07;staticRoot.add(group);
    box(0,0,0,w,h,.065,'#a59c8b',false,group);photoPlane(0,0,.034,w-.09,h-.11,patches.board,group);
    for(const dx of [-w/2,w/2])box(dx,0,.042,.03,h,.035,'#cac5b9',false,group);
    for(const dy of [-h/2,h/2])box(0,dy,.042,w,.035,.035,'#c3bdae',false,group);
    solid(x,3.3+h/2,2,w,h,.18);
  }
  // Circular wall hanging beside the side door.
  const hanging=new THREE.Mesh(new THREE.CircleGeometry(.29,32),material('#282724'));hanging.position.set(6.451,4.88,-.92);hanging.rotation.y=Math.PI/2;staticRoot.add(hanging);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.29,.018,6,32),steel);ring.position.copy(hanging.position);ring.rotation.copy(hanging.rotation);staticRoot.add(ring);
  ball(6.48,4.85,-.92,.05,'#613332');
  // Timber, broom, slippers, sacks and a doormat along the side passage.
  for(let i=0;i<5;i++){const board=box(6.68+i*.055,4.28,-2.8+i*.2,.14,2.1,.07,i%2?'#877052':'#ad926c');board.rotation.z=-.11-i*.012;}
  pipe([6.8,3.45,1.13],[6.48,4.4,1.13],.018,wood);for(let i=0;i<18;i++)pipe([6.85+(random()-.5)*.23,3.33,1.13+(random()-.5)*.08],[6.75,3.64,1.13],.009,wood);
  for(let i=0;i<3;i++){const sack=ball(7.03+i*.27,3.51,-3.12+(i%2)*.42,.26,i===1?'#91a3a1':'#b9b8a5');sack.scale.set(.7,1,.8);}
  box(7.09,3.335,.3,.52,.018,.37,'#7e7669');for(const z of [.55,.8]){const shoe=box(6.84,3.355,z,.22,.07,.105,'#514f40');shoe.rotation.y=.3;}
  // Reference-ground-floor clutter: brick wall, old washing machine, leaning frame, planters.
  for(let row=0;row<6;row++)for(let i=0;i<6;i++)box(-6.25+i*.24+(row%2)*.1,.055+row*.115,2.9,.225,.105,.22,i%3?'#a75f3c':'#ba7750');
  box(-4.64,.57,2.32,.76,1.14,.65,'#c5c7bf',true);box(-4.64,1.15,2.32,.78,.055,.67,'#b0b5ac');
  box(-4.64,1.182,2.33,.6,.018,.45,material('#737e7a',.23,.25));box(-4.62,.85,2.65,.55,.025,.012,'#aaa99b');
  const lean=box(-5.49,.9,2.25,.83,1.8,.09,wood);lean.rotation.z=.15;
  for(let i=0;i<4;i++){const timber=box(-2.23+i*.11,1.05,.35,.08,2.1,.1,'#998168');timber.rotation.z=.04+i*.01;}
  function planter(x,y,z,size=.22){cylinder(x,y+size*.55,z,size*.8,size*1.1,'#b9b9a5',staticRoot,size);cylinder(x,y+size*1.12,z,size*.86,.015,'#41452e');for(let i=0;i<12;i++){const a=i*2.4,end=[x+Math.cos(a)*size*.85,y+size*(1.5+random()),z+Math.sin(a)*size*.85];pipe([x,y+size,z],end,.012,material('#3c6334'));const leaf=new THREE.Mesh(new THREE.SphereGeometry(.1,6,4),material('#426c3d'));leaf.position.set(...end);leaf.scale.set(.3,.9,1.6);leaf.rotation.set(random(),a,.7);staticRoot.add(leaf);}}
  planter(-3.3,0,2.6);planter(-2.85,0,2.5,.26);planter(7.8,3.3,-4.5,.23);
  box(-5.9,.38,6,1.45,.12,.65,wood,true);for(const x of [-6.43,-5.37])box(x,.17,6,.12,.34,.5,'#7b7769');
  // Repeated dirt along wall bases is geometry-attached and has no facade-wide baked shadows.
  const dirtCanvas=document.createElement('canvas');dirtCanvas.width=256;dirtCanvas.height=64;const dc=dirtCanvas.getContext('2d');const grad=dc.createLinearGradient(0,0,0,64);grad.addColorStop(0,'rgba(57,66,52,0)');grad.addColorStop(1,'rgba(57,66,52,.3)');dc.fillStyle=grad;dc.fillRect(0,0,256,64);const dirtMap=new THREE.CanvasTexture(dirtCanvas);const dirtMat=new THREE.MeshStandardMaterial({map:dirtMap,transparent:true,depthWrite:false,roughness:1});
  for(const [x,w] of [[-4.2,3.7],[3.1,5.8]]){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,.18),dirtMat);m.position.set(x,3.4,1.687);staticRoot.add(m);}

  // Pickup models retain the existing game loop and target semantics.
  function item(name,x,y,z,kind){
    const g=new THREE.Group();g.position.set(x,y,z);scene.add(g);
    if(kind==='basket'){
      cylinder(0,.18,0,.24,.35,'#ac864d',g,.32);for(let i=0;i<9;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.24+i*.009,.011,4,32),material('#6e542f'));ring.rotation.x=Math.PI/2;ring.position.y=.025+i*.038;g.add(ring);}for(let i=0;i<20;i++){const a=i*Math.PI/10;pipe([Math.cos(a)*.24,.01,Math.sin(a)*.24],[Math.cos(a)*.32,.35,Math.sin(a)*.32],.008,wood,g);}const handle=new THREE.Mesh(new THREE.TorusGeometry(.29,.025,6,24,Math.PI),wood);handle.position.y=.35;g.add(handle);
    }else if(kind==='wood'){for(let i=0;i<3;i++){const log=cylinder((i-1)*.13,.13,0,.087,.65,wood,g);log.rotation.x=Math.PI/2;}}
    else{cylinder(0,.12,0,.11,.24,material('#cbccc1',.24),g);cylinder(0,.246,0,.082,.008,'#46493d',g);const h=new THREE.Mesh(new THREE.TorusGeometry(.077,.021,8,16),material('#cbccc1',.24));h.position.set(.12,.14,0);g.add(h);}
    const target={type:'item',name,root:g,picked:false};g.traverse(o=>o.userData.target=target);interactables.push(target);
  }
  item('竹篮',-5.8,.46,6,'basket');item('柴木',3.5,.04,5,'wood');item('陶杯',-3,.79,-2.2,'cup');

  // Merge only static meshes, preserving dynamic doors and pickup targets.
  staticRoot.updateMatrixWorld(true);const batches=new Map();
  staticRoot.traverse(mesh=>{if(!mesh.isMesh)return;const geo=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),list=batches.get(mesh.material)??[];list.push(geo.index?geo.toNonIndexed():geo);batches.set(mesh.material,list);});
  staticRoot.clear();for(const [mat,geos]of batches){const merged=new THREE.Mesh(mergeGeometries(geos),mat);merged.castShadow=!mat.transparent;merged.receiveShadow=true;staticRoot.add(merged);geos.forEach(g=>g.dispose());}
  return {colliders,interactables,doors,materials:[...cache.values(),plaster,cement,floor,steel],raycastRoots:[staticRoot,...interactables.map(i=>i.root)]};
}
