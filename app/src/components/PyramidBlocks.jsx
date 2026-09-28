import { memo, useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as THREE from 'three';
import gsap from 'gsap';

const ROCK_COLORS = ['#C19A6B', '#D2B48C', '#E1C699', '#B8956A'];
const PYRAMID_HEIGHT = 5;
const PYRAMID_BASE = 6;
// Real pyramid faces are many shallow courses of stones that are wider than
// they are tall — 8 tall courses read as stacked boxes, 18 short ones read
// as masonry.
const LAYERS = 18;
const GAP = 0.012;
const TARGET_STONE_SIZE = 0.42;

// Deterministic per-position noise: face vertices of a box that share a
// corner get the same displacement, so erosion never opens seams.
function hash(x, y, z, seed) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453;
  return s - Math.floor(s);
}

function buildBlockData() {
  const blocks = [];
  const courseHeight = PYRAMID_HEIGHT / LAYERS;

  for (let layer = 0; layer < LAYERS; layer++) {
    const half = (PYRAMID_BASE / 2) * (1 - layer / LAYERS);
    const width = half * 2;
    const n = Math.max(1, Math.round(width / TARGET_STONE_SIZE));
    const spacing = width / n;
    const yCenter = layer * courseHeight + courseHeight / 2;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        // Hollow shell for big courses; small top courses are filled so you
        // can't see down into the core from above.
        const isPerimeter = n <= 3 || i === 0 || i === n - 1 || j === 0 || j === n - 1;
        if (!isPerimeter) continue;

        const x = -half + spacing / 2 + i * spacing;
        const z = -half + spacing / 2 + j * spacing;
        // Ragged face: outer stones sit slightly proud or recessed at random
        const outward = new THREE.Vector3(Math.sign(x) * (i === 0 || i === n - 1 ? 1 : 0), 0, Math.sign(z) * (j === 0 || j === n - 1 ? 1 : 0));
        const proud = (Math.random() - 0.35) * 0.035;

        blocks.push({
          position: new THREE.Vector3(x + outward.x * proud, yCenter - Math.random() * 0.006, z + outward.z * proud),
          yaw: (Math.random() - 0.5) * 0.05,
          width: spacing - GAP - Math.random() * 0.025,
          height: courseHeight - GAP - Math.random() * 0.012,
          depth: spacing - GAP - Math.random() * 0.025,
          color: ROCK_COLORS[Math.floor(Math.random() * ROCK_COLORS.length)],
          seed: Math.random() * 1000,
        });
      }
    }
  }
  return blocks;
}

// Weathered limestone: rounded base shape, corners and edges eroded
// inward more than face centres, fine surface pitting, randomized texture
// placement per stone, and baked darkening in the joints/underside so each
// course reads with depth even in flat light.
function makeStoneGeometry(b) {
  const radius = Math.min(0.045, b.height * 0.2);
  const geo = new RoundedBoxGeometry(b.width, b.height, b.depth, 2, radius);
  const pos = geo.attributes.position;
  const hw = b.width / 2, hh = b.height / 2, hd = b.depth / 2;
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color(b.color);
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const nx = Math.abs(v.x / hw), ny = Math.abs(v.y / hh), nz = Math.abs(v.z / hd);
    const edge = Math.max(nx * ny, ny * nz, nx * nz); // ~1 on edges/corners
    const corner = nx * ny * nz;
    const qx = Math.round(v.x * 1e4) / 1e4, qy = Math.round(v.y * 1e4) / 1e4, qz = Math.round(v.z * 1e4) / 1e4;
    const r1 = hash(qx, qy, qz, b.seed);
    const r2 = hash(qz, qx, qy, b.seed + 7);

    const erosion = 1 - (edge * edge * 0.035 + corner * 0.1) * (0.4 + r1);
    const pit = 1 - r2 * 0.012;
    v.multiplyScalar(erosion * pit);
    pos.setXYZ(i, v.x, v.y, v.z);

    // Joint/underside occlusion + slight per-vertex tonal variation
    const up = (v.y / hh + 1) / 2;
    const shade = (0.72 + 0.28 * up) * (1 - edge * 0.12) * (0.94 + r1 * 0.1);
    // The source texture is orange cracked earth; boosting blue/green in
    // the tint neutralizes it toward pale limestone instead of brick.
    colors[i * 3] = base.r * shade * 1.2;
    colors[i * 3 + 1] = base.g * shade * 1.3;
    colors[i * 3 + 2] = base.b * shade * 1.55;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const uv = geo.attributes.uv;
  const s = 0.35 + Math.random() * 0.3;
  const ou = Math.random(), ov = Math.random();
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s + ou, uv.getY(i) * s + ov);

  geo.computeVertexNormals();
  return geo;
}

const CENTER = new THREE.Vector3(0, PYRAMID_HEIGHT * 0.35, 0);

function PyramidBlocks({ onHoverChange }) {
  const blockData = useMemo(buildBlockData, []);
  const [albedo, normal, rough] = useTexture([
    './assets/textures/earth/albedo.jpg',
    './assets/textures/earth/normal.jpg',
    './assets/textures/earth/roughness.jpg',
  ]);
  useMemo(() => {
    for (const t of [albedo, normal, rough]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
    }
    albedo.colorSpace = THREE.SRGBColorSpace;
  }, [albedo, normal, rough]);
  const normalScale = useMemo(() => new THREE.Vector2(1.3, 1.3), []);

  // Precompute each block's 2 nearest neighbors once — used to grow the
  // hovered block into a group of 3 for the pop-out effect.
  const neighbors = useMemo(() => {
    return blockData.map((b, i) => {
      const dists = blockData
        .map((other, j) => (j === i ? null : { j, d: b.position.distanceTo(other.position) }))
        .filter(Boolean)
        .sort((a, b2) => a.d - b2.d);
      return [dists[0]?.j, dists[1]?.j].filter((v) => v !== undefined);
    });
  }, [blockData]);

  const geometries = useMemo(() => blockData.map(makeStoneGeometry), [blockData]);

  const meshRefs = useRef([]);
  const materialRefs = useRef([]);
  const stateRefs = useRef(blockData.map(() => 'idle')); // 'idle' | 'active'
  const activeSetRef = useRef(new Set());
  const { camera, raycaster, pointer } = useThree();

  useEffect(() => {
    return () => {
      meshRefs.current.forEach((m) => m && gsap.killTweensOf([m.position, m.scale, m.rotation]));
      materialRefs.current.forEach((mat) => mat && gsap.killTweensOf(mat));
    };
  }, []);

  function popOut(index) {
    const mesh = meshRefs.current[index];
    const mat = materialRefs.current[index];
    if (!mesh || !mat) return;
    const dir = blockData[index].position.clone().sub(CENTER).normalize();
    const target = blockData[index].position.clone().add(dir.multiplyScalar(0.6));

    gsap.killTweensOf([mesh.position, mesh.scale, mesh.rotation, mat]);
    // Only pay the cost (and depth-sort risk) of a transparent material
    // while a block is actually mid-fade. ~200 blocks permanently flagged
    // transparent, even at opacity 1, breaks Three's depth sort once enough
    // of them overlap on screen — the whole pyramid rendered as ghostly,
    // overlapping glass. Keeping blocks opaque at rest fixes that.
    mat.transparent = true;
    mat.depthWrite = false;
    mat.needsUpdate = true;

    gsap.to(mesh.position, { x: target.x, y: target.y, z: target.z, duration: 0.4, ease: 'power2.out' });
    gsap.to(mesh.scale, { x: 0.15, y: 0.15, z: 0.15, duration: 0.4, ease: 'power2.out' });
    gsap.to(mesh.rotation, {
      x: (Math.random() - 0.5) * THREE.MathUtils.degToRad(15),
      z: (Math.random() - 0.5) * THREE.MathUtils.degToRad(15),
      duration: 0.4,
      ease: 'power2.out',
    });
    gsap.to(mat, { opacity: 0, duration: 0.4, ease: 'power2.out' });
  }

  function popIn(index) {
    const mesh = meshRefs.current[index];
    const mat = materialRefs.current[index];
    if (!mesh || !mat) return;
    const home = blockData[index].position;

    gsap.killTweensOf([mesh.position, mesh.scale, mesh.rotation, mat]);
    gsap.to(mesh.position, { x: home.x, y: home.y, z: home.z, duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    gsap.to(mesh.scale, { x: 1, z: 1, duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    // Y gets its own rubber-band stretch — overshoot to 1.5 then settle,
    // distinct from the X/Z elastic bounce, for that squash-and-stretch feel.
    gsap
      .timeline()
      .to(mesh.scale, { y: 1.5, duration: 0.32, ease: 'power2.out' })
      .to(mesh.scale, { y: 1, duration: 0.48, ease: 'power2.inOut' });
    gsap.to(mesh.rotation, { x: 0, z: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    gsap.to(mat, {
      opacity: 1,
      duration: 0.6,
      ease: 'power2.out',
      onComplete: () => {
        // Back to fully opaque, reliably-sorted rendering once at rest.
        mat.transparent = false;
        mat.depthWrite = true;
        mat.needsUpdate = true;
      },
    });
  }

  // R3F's `pointer` defaults to (0,0) — screen center — before the user has
  // ever moved the mouse, which would otherwise make whatever block sits at
  // frame-center look permanently "hovered" (popped out) on load. Gate
  // hover detection behind a real pointer-move.
  const hasPointerMoved = useRef(false);
  useEffect(() => {
    const mark = () => { hasPointerMoved.current = true; };
    window.addEventListener('pointermove', mark, { once: true });
    return () => window.removeEventListener('pointermove', mark);
  }, []);

  useFrame((state) => {
    let hits = [];
    if (hasPointerMoved.current) {
      raycaster.setFromCamera(pointer, camera);
      hits = raycaster.intersectObjects(meshRefs.current.filter(Boolean), false);
    }
    const hoveredMesh = hits[0]?.object;
    const hoveredIndex = hoveredMesh ? hoveredMesh.userData.index : null;

    const nextActive = new Set();
    if (hoveredIndex !== null && hoveredIndex !== undefined) {
      nextActive.add(hoveredIndex);
      for (const n of neighbors[hoveredIndex]) nextActive.add(n);
    }

    for (const idx of nextActive) {
      if (!activeSetRef.current.has(idx)) {
        stateRefs.current[idx] = 'active';
        popOut(idx);
      }
    }
    for (const idx of activeSetRef.current) {
      if (!nextActive.has(idx)) {
        stateRefs.current[idx] = 'idle';
        popIn(idx);
      }
    }
    activeSetRef.current = nextActive;
    onHoverChange(nextActive.size > 0);

    // Idle breathing for every block currently at rest
    const t = state.clock.elapsedTime;
    blockData.forEach((b, i) => {
      if (stateRefs.current[i] !== 'idle') return;
      const mesh = meshRefs.current[i];
      if (!mesh) return;
      mesh.position.y = b.position.y + Math.sin(t + b.seed) * 0.005;
    });
  });

  return (
    <group>
      {blockData.map((b, i) => (
        <mesh
          key={i}
          ref={(m) => (meshRefs.current[i] = m)}
          geometry={geometries[i]}
          position={b.position}
          rotation={[0, b.yaw, 0]}
          castShadow
          receiveShadow
          userData={{ index: i }}
        >
          <meshStandardMaterial
            ref={(m) => (materialRefs.current[i] = m)}
            vertexColors
            map={albedo}
            normalMap={normal}
            normalScale={normalScale}
            roughnessMap={rough}
            roughness={1}
            metalness={0}
            transparent={false}
            opacity={1}
          />
        </mesh>
      ))}
    </group>
  );
}

export default memo(PyramidBlocks);
