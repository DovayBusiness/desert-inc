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
const hemi = new THREE.HemisphereLight('#FFE9C2', '#8A5A2E', 0.75);
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

const rim = new THREE.DirectionalLight('#FF9E4A', 0.7);
rim.position.set(16, 6, -14);
scene.add(rim);

// Soft bounce light from the ground up, as if sunlight is reflecting off hot sand
const bounce = new THREE.DirectionalLight('#E8B77A', 0.35);
bounce.position.set(0, -4, 6);
scene.add(bounce);

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

// Pyramid stone: coarser tiling so the cracked-earth texture reads as large
// weathered slabs rather than a busy repeating pattern on each small block.
const earthAlbedo = loadTex('assets/textures/earth/albedo.jpg', { srgb: true, repeat: 2.5 });
const earthNormal = loadTex('assets/textures/earth/normal.jpg', { repeat: 2.5 });
const earthRough = loadTex('assets/textures/earth/roughness.jpg', { repeat: 2.5 });

// Separate texture instances (own repeat) for the small scattered rocks
const rockAlbedo = loadTex('assets/textures/earth/albedo.jpg', { srgb: true, repeat: 1 });
const rockNormal = loadTex('assets/textures/earth/normal.jpg', { repeat: 1 });
const rockRough = loadTex('assets/textures/earth/roughness.jpg', { repeat: 1 });

// ---------- Shared terrain height function ----------
// Both the ground mesh and the scattered rocks use this so rocks sit
// naturally in the sand instead of floating or sinking.
function duneHeight(x, z) {
  return Math.sin(x * 0.06) * 0.9 + Math.cos(z * 0.08) * 0.7 + Math.sin((x + z) * 0.03) * 1.4 - 1.2;
}

// ---------- Ground plane (fallback / base dune bed) ----------
const groundGeo = new THREE.PlaneGeometry(160, 160, 128, 128);
groundGeo.rotateX(-Math.PI / 2);
const posAttr = groundGeo.attributes.position;
for (let i = 0; i < posAttr.count; i++) {
  posAttr.setY(i, duneHeight(posAttr.getX(i), posAttr.getZ(i)));
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
          normalScale: new THREE.Vector2(1.4, 1.4),
          roughnessMap: earthRough,
          roughness: 1,
          metalness: 0,
          // Near-white so the photographed albedo carries the color —
          // a strong tint here is what makes stone read as flat plastic.
          color: new THREE.Color('#F3E4C8'),
        });
      }
    }
  });
}

// Pyramid
let pyramidRoot = null;
gltfLoader.load(
  'assets/models/pyramid.glb',
  (gltf) => {
    pyramidRoot = gltf.scene;
    applyShadowsAndMaterial(pyramidRoot, { useEarthTexture: true });
    pyramidRoot.position.set(0, 0.4, 0);
    pyramidRoot.scale.setScalar(0.85);
    scene.add(pyramidRoot);
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

// ---------- Scattered rocks around the pyramid base ----------
// A handful of irregular, hand-varied rock shapes (not perfect spheres) so
// they read as weathered debris rather than props. Each rock remembers its
// resting spot and drifts back to it when the pointer moves away.
function makeRockGeometry() {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    const bump = 0.72 + Math.random() * 0.55;
    v.copy(n.multiplyScalar(bump));
    pos.setXYZ(i, v.x, v.y * 0.62, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

const rockGeometries = Array.from({ length: 5 }, makeRockGeometry);
const rockMaterial = new THREE.MeshStandardMaterial({
  map: rockAlbedo,
  normalMap: rockNormal,
  normalScale: new THREE.Vector2(1.2, 1.2),
  roughnessMap: rockRough,
  roughness: 1,
  metalness: 0,
  color: new THREE.Color('#E7D2AC'),
});

const rocks = [];
const ROCK_COUNT = 26;
const rocksGroup = new THREE.Group();
for (let i = 0; i < ROCK_COUNT; i++) {
  const angle = (i / ROCK_COUNT) * Math.PI * 2 + Math.random() * 0.5;
  const radius = 3.4 + Math.random() * 4.2;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const y = duneHeight(x, z);

  const geo = rockGeometries[i % rockGeometries.length];
  const mesh = new THREE.Mesh(geo, rockMaterial);
  const scale = 0.12 + Math.random() * 0.22;
  mesh.scale.set(scale, scale * (0.8 + Math.random() * 0.5), scale);
  mesh.position.set(x, y + scale * 0.3, z);
  mesh.rotation.y = Math.random() * Math.PI * 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  rocksGroup.add(mesh);

  rocks.push({
    mesh,
    base: new THREE.Vector3(x, y + scale * 0.3, z),
    spin: (Math.random() - 0.5) * 0.6,
  });
}
scene.add(rocksGroup);

// ---------- Pointer tracking for the rock "scatter on hover" effect ----------
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2(9999, 9999);
// THREE.Plane(normal, constant) sits where normal·p + constant = 0, i.e.
// at y = -constant for a (0,1,0) normal — use -0.3 to place it at y = 0.3,
// roughly the rocks' resting height.
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3);
const hoverPoint = new THREE.Vector3();
let hasHover = false;

function updatePointer(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
}
canvas.addEventListener('pointermove', (e) => updatePointer(e.clientX, e.clientY), { passive: true });
canvas.addEventListener('pointerleave', () => { pointerNDC.set(9999, 9999); }, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  if (e.touches[0]) updatePointer(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });

const ROCK_INFLUENCE = 2.6;
const ROCK_PUSH = 1.7;
const tmpTarget = new THREE.Vector3();
function updateRocks(dt) {
  hasHover = false;
  if (pointerNDC.x <= 2) {
    raycaster.setFromCamera(pointerNDC, camera);
    hasHover = raycaster.ray.intersectPlane(groundPlane, hoverPoint) !== null;
  }

  for (const rock of rocks) {
    tmpTarget.copy(rock.base);
    if (hasHover) {
      const dx = rock.base.x - hoverPoint.x;
      const dz = rock.base.z - hoverPoint.z;
      const dist = Math.hypot(dx, dz);
      if (dist < ROCK_INFLUENCE) {
        const strength = 1 - dist / ROCK_INFLUENCE;
        const push = strength * strength * ROCK_PUSH;
        const nx = dist > 0.001 ? dx / dist : 1;
        const nz = dist > 0.001 ? dz / dist : 0;
        tmpTarget.x += nx * push;
        tmpTarget.z += nz * push;
      }
    }
    rock.mesh.position.lerp(tmpTarget, 1 - Math.pow(0.001, dt));
    const displaced = rock.mesh.position.distanceTo(rock.base);
    rock.mesh.rotation.y += (rock.spin * 0.4 + displaced * 1.5) * dt;
  }
}

// ---------- Big sandstorm: dense drifting dust + streaking sand + rolling gust walls ----------
function makeSoftDustTexture() {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,238,205,0.9)');
  grad.addColorStop(0.5, 'rgba(255,230,190,0.4)');
  grad.addColorStop(1, 'rgba(255,230,190,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
// An elongated, horizontally-streaked sprite for fast low sand — reads as
// motion-blurred grains being dragged by the wind rather than round dots.
function makeStreakTexture() {
  const w = 128, h = 32;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, 'rgba(255,232,195,0)');
  grad.addColorStop(0.5, 'rgba(255,232,195,0.75)');
  grad.addColorStop(1, 'rgba(255,232,195,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  return new THREE.CanvasTexture(c);
}
const dustSprite = makeSoftDustTexture();
const streakSprite = makeStreakTexture();

// Wind blows mostly along +X, with turbulence — this is now a proper storm:
// dense, fast, and tall enough to wash over the pyramid.
const WIND_DIR = new THREE.Vector2(1, 0.22).normalize();
const WIND_ANGLE = Math.atan2(WIND_DIR.y, WIND_DIR.x);
const WIND_SPEED = 6.5;
const FIELD = 32; // half-extent of the particle field, centered on the pyramid

const PARTICLE_COUNT = 3600;
const particleGeo = new THREE.BufferGeometry();
const particlePos = new Float32Array(PARTICLE_COUNT * 3);
const particleSeed = new Float32Array(PARTICLE_COUNT * 3); // speed, phase, freq
for (let i = 0; i < PARTICLE_COUNT; i++) {
  const x = (Math.random() * 2 - 1) * FIELD;
  // Bias density toward the ground, with a thinner haze rising higher —
  // that's what makes it read as a storm rolling across the dunes.
  const y = Math.pow(Math.random(), 2.2) * 9;
  const z = (Math.random() * 2 - 1) * FIELD;
  particlePos.set([x, y, z], i * 3);
  particleSeed.set([0.5 + Math.random() * 1.8, Math.random() * Math.PI * 2, 0.4 + Math.random() * 1.4], i * 3);
}
particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));

const particleMat = new THREE.PointsMaterial({
  map: dustSprite,
  size: 0.55,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.6,
  depthWrite: false,
  color: new THREE.Color('#E9CE9E'),
});
const dustParticles = new THREE.Points(particleGeo, particleMat);
scene.add(dustParticles);

// Fast, low, wind-aligned sand streaks for the "grains dragging past the
// camera" close-in feel.
const STREAK_COUNT = 90;
const streaks = [];
for (let i = 0; i < STREAK_COUNT; i++) {
  const mat = new THREE.SpriteMaterial({
    map: streakSprite,
    transparent: true,
    opacity: 0.35 + Math.random() * 0.25,
    depthWrite: false,
    color: new THREE.Color('#F0DFB8'),
    rotation: WIND_ANGLE,
  });
  const sprite = new THREE.Sprite(mat);
  const len = 1.4 + Math.random() * 2.6;
  sprite.scale.set(len, len * 0.16, 1);
  sprite.position.set((Math.random() * 2 - 1) * FIELD, 0.1 + Math.random() * 2.2, (Math.random() * 2 - 1) * FIELD);
  scene.add(sprite);
  streaks.push({ sprite, speed: WIND_SPEED * (1.4 + Math.random() * 1.2) });
}

// Large, rolling gust walls — big soft sheets that sweep across the whole
// scene, thick enough to partially veil the pyramid as they pass.
const gustSprites = [];
const GUST_COUNT = 11;
for (let i = 0; i < GUST_COUNT; i++) {
  const mat = new THREE.SpriteMaterial({
    map: dustSprite,
    transparent: true,
    opacity: 0.16 + Math.random() * 0.16,
    depthWrite: false,
    color: new THREE.Color('#D9A868'),
  });
  const sprite = new THREE.Sprite(mat);
  const scale = 20 + Math.random() * 22;
  sprite.scale.set(scale, scale * 0.6, 1);
  sprite.position.set((Math.random() * 2 - 1) * FIELD, 0.4 + Math.random() * 5, (Math.random() * 2 - 1) * FIELD);
  scene.add(sprite);
  gustSprites.push({ sprite, speed: WIND_SPEED * (0.5 + Math.random() * 0.6) });
}

// Storm atmosphere: the sky/fog tint pulses between clear and hazy as gusts
// roll through, instead of sitting at one flat color.
const skyClear = new THREE.Color('#F7DFA8');
const skyHazy = new THREE.Color('#C98A4A');
const fogClear = new THREE.Color('#E3A85C');
const fogHazy = new THREE.Color('#B87A3E');
const tmpColor = new THREE.Color();

function updateSandstorm(elapsed, dt) {
  const positions = particleGeo.attributes.position.array;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const idx = i * 3;
    const speed = particleSeed[idx];
    const phase = particleSeed[idx + 1];
    const freq = particleSeed[idx + 2];

    positions[idx] += WIND_DIR.x * speed * WIND_SPEED * dt;
    positions[idx + 2] += WIND_DIR.y * speed * WIND_SPEED * dt;
    positions[idx + 1] += Math.sin(elapsed * freq + phase) * 0.12 * dt;

    // Wrap around so the storm loops seamlessly against the wind direction
    if (positions[idx] > FIELD) {
      positions[idx] -= FIELD * 2;
      positions[idx + 2] = (Math.random() * 2 - 1) * FIELD;
      positions[idx + 1] = Math.pow(Math.random(), 2.2) * 9;
    }
    if (positions[idx + 2] > FIELD) positions[idx + 2] -= FIELD * 2;
    if (positions[idx + 2] < -FIELD) positions[idx + 2] += FIELD * 2;
  }
  particleGeo.attributes.position.needsUpdate = true;

  for (const s of streaks) {
    s.sprite.position.x += WIND_DIR.x * s.speed * dt;
    s.sprite.position.z += WIND_DIR.y * s.speed * dt;
    if (s.sprite.position.x > FIELD) s.sprite.position.x -= FIELD * 2;
    if (s.sprite.position.z > FIELD) s.sprite.position.z -= FIELD * 2;
  }

  for (const g of gustSprites) {
    g.sprite.position.x += WIND_DIR.x * g.speed * dt;
    g.sprite.position.z += WIND_DIR.y * g.speed * dt;
    if (g.sprite.position.x > FIELD) g.sprite.position.x -= FIELD * 2;
    if (g.sprite.position.z > FIELD) g.sprite.position.z -= FIELD * 2;
  }

  // Gust breathing — sky/fog swing between clear and hazy as the storm rolls
  const gust = (Math.sin(elapsed * 0.18) + 1) / 2;
  scene.background = tmpColor.copy(skyClear).lerp(skyHazy, gust * 0.6);
  scene.fog.color.copy(fogClear).lerp(fogHazy, gust * 0.6);
  scene.fog.far = 55 - gust * 20;
  scene.fog.near = 6;
}

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
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.getElapsedTime();
  controls.update();
  updateRocks(dt);
  updateSandstorm(elapsed, dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// Safety: hide loader even if an asset silently hangs
setTimeout(() => loaderEl.classList.add('hidden'), 6000);
