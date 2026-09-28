import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.getElementById('scene-canvas');
const loaderEl = document.getElementById('loader');
const hintPill = document.getElementById('hint-pill');
const hero = document.getElementById('hero');

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ---------- Scene / Fog / Sky ----------
const scene = new THREE.Scene();
const skyTop = new THREE.Color('#F7DFA8');
const skyBottom = new THREE.Color('#E3A85C');
scene.background = skyTop;
scene.fog = new THREE.Fog(skyBottom.getHex(), 20, 90);

// ---------- Camera ----------
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(14, 7, 18);

// ---------- Controls ----------
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2.5, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 8;
controls.maxDistance = 34;
controls.maxPolarAngle = Math.PI / 2.05;
controls.minPolarAngle = 0.35;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
controls.enablePan = false;
// Zoom is driven by scroll (see onScroll below), not the wheel — leaving
// enableZoom on would make OrbitControls swallow wheel events and trap
// the page from scrolling past the hero.
controls.enableZoom = false;

let userInteracted = false;
['pointerdown', 'touchstart'].forEach(evt => {
  controls.domElement.addEventListener(evt, () => {
    if (!userInteracted) {
      userInteracted = true;
      hintPill.style.opacity = '0';
    }
    controls.autoRotate = false;
  }, { passive: true });
});

// ---------- Lighting ----------
const hemi = new THREE.HemisphereLight('#FFE7B8', '#7A4E23', 0.65);
scene.add(hemi);

const sun = new THREE.DirectionalLight('#FFF1D0', 3.2);
sun.position.set(-18, 22, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 60;
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
sun.shadow.bias = -0.0015;
scene.add(sun);

const rim = new THREE.DirectionalLight('#FF9E4A', 0.6);
rim.position.set(16, 6, -14);
scene.add(rim);

// ---------- Texture loading ----------
const texLoader = new THREE.TextureLoader();
function loadTex(path, { srgb = false, repeat = 1 } = {}) {
  const t = texLoader.load(path);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const sandAlbedo = loadTex('assets/textures/sand/albedo.jpg', { srgb: true, repeat: 40 });
const sandNormal = loadTex('assets/textures/sand/normal.jpg', { repeat: 40 });
const earthAlbedo = loadTex('assets/textures/earth/albedo.jpg', { srgb: true, repeat: 6 });
const earthNormal = loadTex('assets/textures/earth/normal.jpg', { repeat: 6 });
const earthRough = loadTex('assets/textures/earth/roughness.jpg', { repeat: 6 });

// ---------- Ground plane (fallback / base dune bed) ----------
const groundGeo = new THREE.PlaneGeometry(160, 160, 128, 128);
groundGeo.rotateX(-Math.PI / 2);
// gentle procedural undulation so the plane doesn't read as perfectly flat
const posAttr = groundGeo.attributes.position;
for (let i = 0; i < posAttr.count; i++) {
  const x = posAttr.getX(i);
  const z = posAttr.getZ(i);
  const y = Math.sin(x * 0.06) * 0.9 + Math.cos(z * 0.08) * 0.7 + Math.sin((x + z) * 0.03) * 1.4;
  posAttr.setY(i, y - 1.2);
}
groundGeo.computeVertexNormals();

const groundMat = new THREE.MeshStandardMaterial({
  map: sandAlbedo,
  normalMap: sandNormal,
  roughness: 0.95,
  metalness: 0.0,
  color: new THREE.Color('#E9C48C'),
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.receiveShadow = true;
scene.add(ground);

// ---------- GLTF loader ----------
const gltfLoader = new GLTFLoader();
let assetsToLoad = 2;
function assetLoaded() {
  assetsToLoad -= 1;
  if (assetsToLoad <= 0) {
    loaderEl.classList.add('hidden');
  }
}

function applyShadowsAndMaterial(root, { useEarthTexture = false } = {}) {
  root.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (useEarthTexture) {
        child.material = new THREE.MeshStandardMaterial({
          map: earthAlbedo,
          normalMap: earthNormal,
          roughnessMap: earthRough,
          roughness: 1,
          metalness: 0,
          color: new THREE.Color('#D9A85E'),
        });
      }
    }
  });
}

// Pyramid
gltfLoader.load(
  'assets/models/pyramid.glb',
  (gltf) => {
    const pyramid = gltf.scene;
    applyShadowsAndMaterial(pyramid, { useEarthTexture: true });
    pyramid.position.set(0, 0.4, 0);
    pyramid.scale.setScalar(0.85);
    scene.add(pyramid);
    assetLoaded();
  },
  undefined,
  (err) => { console.error('pyramid.glb failed to load', err); assetLoaded(); }
);

// Dune terrain (optimized web mesh) — layered on top of the base ground plane
gltfLoader.load(
  'assets/models/dune.glb',
  (gltf) => {
    const dune = gltf.scene;
    dune.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = true;
        child.material = groundMat.clone();
      }
    });
    dune.position.set(0, -0.05, 0);
    scene.add(dune);
    assetLoaded();
  },
  undefined,
  (err) => { console.warn('dune.glb failed to load, relying on procedural ground', err); assetLoaded(); }
);

// ---------- Resize ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Scroll parallax: camera drifts as hero scrolls out of view ----------
function onScroll() {
  const heroHeight = hero.offsetHeight;
  const progress = Math.min(Math.max(window.scrollY / heroHeight, 0), 1);
  camera.position.y = 7 + progress * 4;
  camera.position.z = 18 - progress * 4;
  hero.style.opacity = String(1 - progress * 0.9);
}
window.addEventListener('scroll', onScroll, { passive: true });

// ---------- Render loop ----------
const clock = new THREE.Clock();
function animate() {
  const dt = clock.getDelta();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// Safety: hide loader even if an asset silently hangs
setTimeout(() => loaderEl.classList.add('hidden'), 6000);
