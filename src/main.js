import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createHouse } from './house.js';
import { createLandscape } from './landscape.js';
import './style.css';

const $ = id => document.getElementById(id);
const canvas = $('scene');
let needsRender = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#bdcfd0');
scene.fog = new THREE.FogExp2('#bdcfd0', .008);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
} catch (error) {
  document.querySelector('.loading-content p').textContent = '无法启动 3D，请启用浏览器硬件加速后刷新。';
  $('loading-progress').textContent = '';
  throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(39, innerWidth / innerHeight, .1, 320);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = .075;
controls.minDistance = 8;
controls.maxDistance = 90;
controls.maxPolarAngle = Math.PI * .48;
controls.minPolarAngle = .025;
controls.autoRotateSpeed = .6;
controls.screenSpacePanning = true;
controls.target.set(0, 4.6, .8);

// A soft studio environment supplies natural reflections on glass and steel.
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const reflectionMap = pmrem.fromScene(room, .04);
scene.environment = reflectionMap.texture;
scene.environmentIntensity = .42;
room.dispose(); pmrem.dispose();
const hemisphere = new THREE.HemisphereLight('#dbeef4', '#5f6549', 2.0);
scene.add(hemisphere);
const sunlight = new THREE.DirectionalLight('#fff4df', 3.0);
sunlight.position.set(-12, 24, 17);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048, 2048);
Object.assign(sunlight.shadow.camera, { left: -24, right: 24, top: 23, bottom: -23, near: 1, far: 85 });
sunlight.shadow.bias = -.00018;
sunlight.shadow.normalBias = .024;
sunlight.shadow.radius = 2;
sunlight.target.position.set(0, 3, 0);
scene.add(sunlight, sunlight.target);

// Atmospheric dome adds a natural horizon, while the forest stays fully 3D.
const sky = new THREE.Mesh(new THREE.SphereGeometry(145, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { top: { value: new THREE.Color('#86b5cc') }, horizon: { value: new THREE.Color('#d5ded6') } },
  vertexShader: 'varying vec3 vPosition; void main(){vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vPosition; void main(){float h=normalize(vPosition).y; gl_FragColor=vec4(mix(horizon,top,pow(max(h,0.0),0.55)),1.0); #include <tonemapping_fragment>\n #include <colorspace_fragment>\n }',
}));
sky.material.fragmentShader = sky.material.fragmentShader.replace('; #include', ';\n #include');
sky.position.y = -4;
scene.add(sky);

$('loading-progress').textContent = '35%';
await new Promise(resolve => requestAnimationFrame(resolve));
const house = createHouse();
scene.add(house);
$('loading-progress').textContent = '70%';
await new Promise(resolve => requestAnimationFrame(resolve));
const landscape = createLandscape(THREE);
scene.add(landscape);
// A neutral ground remains available when the surrounding landscape is hidden.
const studyGround = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshStandardMaterial({ color: '#dbded3', roughness: 1 }));
studyGround.rotation.x = -Math.PI / 2;
studyGround.position.y = -.12;
studyGround.receiveShadow = true;
studyGround.visible = false;
scene.add(studyGround);

const views = {
  reference: { position: [15.6, 14.5, 27.4], target: [0, 4.7, .6], fov: 36 },
  orbit: { position: [22, 14.4, 29], target: [0, 4.3, .3], fov: 41 },
  front: { position: [0, 7.7, 32], target: [0, 4.8, 0], fov: 39 },
  top: { position: [15, 32, 17], target: [0, 2, 0], fov: 42 },
};
let tween = null, currentView = 'reference', toastTimer, lastFrame = 0;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function cameraPosition(view) {
  const position = new THREE.Vector3(...view.position);
  const target = new THREE.Vector3(...view.target);
  const factor = innerWidth < 600 ? 2.05 : innerWidth < 1000 ? 1.18 : 1;
  return position.sub(target).multiplyScalar(factor).add(target);
}
function setView(name, immediate = false) {
  const view = views[name]; currentView = name;
  setAutoRotate(false);
  // Clear residual OrbitControls inertia before applying an exact preset.
  const damping = controls.enableDamping;
  controls.enableDamping = false; controls.update(); controls.enableDamping = damping;
  document.querySelectorAll('[data-view]').forEach(button => {
    button.classList.toggle('is-active', button.dataset.view === name);
    button.setAttribute('aria-pressed', String(button.dataset.view === name));
  });
  if (immediate || reduceMotion) {
    camera.position.copy(cameraPosition(view)); controls.target.set(...view.target);
    camera.fov = view.fov; camera.updateProjectionMatrix(); controls.update(); tween = null;
  } else {
    tween = { start: performance.now(), position: camera.position.clone(), target: controls.target.clone(), fov: camera.fov, end: cameraPosition(view), endTarget: new THREE.Vector3(...view.target), endFov: view.fov };
  }
}
function setAutoRotate(value) {
  controls.autoRotate = value;
  $('auto-rotate').classList.toggle('is-active', value);
  $('auto-rotate').setAttribute('aria-pressed', String(value));
}
function notify(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.add('is-visible');
  toastTimer = setTimeout(() => $('toast').classList.remove('is-visible'), 3200);
}
function setReference(visible) {
  $('reference-panel').hidden = !visible;
  $('reference-toggle').classList.toggle('is-active', visible);
  $('reference-toggle').setAttribute('aria-pressed', String(visible));
}
function setSettings(visible) {
  $('settings-panel').hidden = !visible;
  $('settings-toggle').setAttribute('aria-expanded', String(visible));
}
function setLighting(value) {
  needsRender = true;
  renderer.shadowMap.needsUpdate = true;
  const angle = (.2 + value * .65) * Math.PI;
  sunlight.position.set(Math.cos(angle) * 26, 9 + Math.sin(angle) * 22, 20);
  sunlight.color.set(value < .22 ? '#ffd6aa' : '#fff4df');
  sunlight.intensity = 2.0 + Math.sin(angle) * .7;
  hemisphere.intensity = 1.35 + Math.sin(angle) * .35;
}
function setLandscape(visible) {
  needsRender = true;
  renderer.shadowMap.needsUpdate = true;
  landscape.visible = visible; studyGround.visible = !visible;
  sky.visible = visible;
  scene.background.set(visible ? '#bdcfd0' : '#e3e6dc');
  scene.fog.color.copy(scene.background);
}
function setWireframe(value) {
  needsRender = true;
  renderer.shadowMap.needsUpdate = true;
  house.traverse(object => {
    if (object.isMesh) for (const material of [].concat(object.material)) material.wireframe = value;
  });
}
function download(blob, filename) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
$('auto-rotate').addEventListener('click', () => { tween = null; setAutoRotate(!controls.autoRotate); });
$('reference-toggle').addEventListener('click', () => setReference($('reference-panel').hidden));
$('reference-close').addEventListener('click', () => setReference(false));
$('settings-toggle').addEventListener('click', () => setSettings($('settings-panel').hidden));
$('show-landscape').addEventListener('change', event => setLandscape(event.target.checked));
$('wireframe').addEventListener('change', event => setWireframe(event.target.checked));
$('light-time').addEventListener('input', event => setLighting(Number(event.target.value)));
$('reset-scene').addEventListener('click', () => {
  $('show-landscape').checked = true; setLandscape(true);
  $('wireframe').checked = false; setWireframe(false);
  $('light-time').value = '.62'; setLighting(.62);
  setView('reference'); setSettings(false); notify('已回到初始场景');
});
controls.addEventListener('start', () => { tween = null; setAutoRotate(false); });
controls.addEventListener('change', () => { needsRender = true; });
window.addEventListener('keydown', event => { if (event.key === 'Escape') setSettings(false); });
$('capture').addEventListener('click', () => {
  renderer.render(scene, camera);
  canvas.toBlob(blob => {
    if (blob) { download(blob, '山居-场景截图.png'); notify('场景截图已保存'); }
    else notify('截图未生成，请重试');
  }, 'image/png');
});
$('export-model').addEventListener('click', async () => {
  const button = $('export-model'); button.disabled = true;
  notify('正在打包建筑模型…');
  try {
    // Expand instances for compatibility with Blender and common GLB viewers.
    const exportGroup = new THREE.Group(); exportGroup.name = house.name;
    house.updateWorldMatrix(true, true);
    house.traverse(object => {
      if (!object.isMesh) return;
      if (object.isInstancedMesh) {
        const instanceMatrix = new THREE.Matrix4();
        for (let i = 0; i < object.count; i++) {
          object.getMatrixAt(i, instanceMatrix);
          const material = object.material.clone();
          if (object.instanceColor) { const color = new THREE.Color(); object.getColorAt(i, color); material.color.multiply(color); }
          material.wireframe = false;
          const mesh = new THREE.Mesh(object.geometry, material);
          mesh.applyMatrix4(object.matrixWorld.clone().multiply(instanceMatrix));
          exportGroup.add(mesh);
        }
      } else {
        const mesh = new THREE.Mesh(object.geometry, object.material.clone());
        mesh.material.wireframe = false; mesh.applyMatrix4(object.matrixWorld); exportGroup.add(mesh);
      }
    });
    const buffer = await new GLTFExporter().parseAsync(exportGroup, { binary: true, maxTextureSize: 1024 });
    download(new Blob([buffer], { type: 'model/gltf-binary' }), '山居-建筑模型.glb');
    exportGroup.traverse(object => { if (object.isMesh) object.material.dispose(); });
    notify('建筑模型已导出 · GLB 格式');
  } catch (error) { console.error(error); notify('模型导出失败，请重试'); }
  finally { button.disabled = false; }
});

let resizeTimer;
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  needsRender = true;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => setView(currentView, true), 150);
});
setView('reference', true); setLighting(.62);
function animate(now) {
  requestAnimationFrame(animate);
  const delta = Math.min((now - lastFrame) / 1000, .05); lastFrame = now;
  if (tween) {
    needsRender = true;
    const t = Math.min(1, (now - tween.start) / 1000);
    const eased = t * t * (3 - 2 * t);
    camera.position.lerpVectors(tween.position, tween.end, eased);
    controls.target.lerpVectors(tween.target, tween.endTarget, eased);
    camera.fov = THREE.MathUtils.lerp(tween.fov, tween.endFov, eased);
    camera.updateProjectionMatrix();
    if (t === 1) tween = null;
  }
  controls.update(delta);
  if (needsRender) { renderer.render(scene, camera); needsRender = false; }
}
await renderer.compileAsync(scene, camera);
$('loading-progress').textContent = '100%';
requestAnimationFrame(animate);
setTimeout(() => $('loading').classList.add('is-hidden'), 180);
// Inspectable state is useful for validating the scene without modifying its UI.
window.__scene = { scene, camera, renderer, house, landscape, controls, setView, ready: true };
