import { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';

const ROCK_COLORS = ['#C19A6B', '#D2B48C', '#E1C699', '#B8956A'];
const PYRAMID_HEIGHT = 5;
const PYRAMID_BASE = 6;
const LAYERS = 8;

// Perimeter-shell layout: each of the 8 courses is a ring of blocks around
// its own (shrinking) square footprint — that taper is what actually makes
// it read as a pyramid. Block size is derived from each course's real
// footprint width divided by its block count, so stones tile edge-to-edge
// with only the 0.01 gap (touching both within a ring and between courses
// stacked on top of each other) instead of leaving daylight gaps that let
// you see straight through the shell into the hollow interior.
const GAP = 0.01;
const TARGET_STONE_SIZE = 0.46;

function buildBlockData() {
  const blocks = [];
  const courseHeight = PYRAMID_HEIGHT / LAYERS; // 0.625

  for (let layer = 0; layer < LAYERS; layer++) {
    const half = (PYRAMID_BASE / 2) * (1 - layer / LAYERS);
    const width = half * 2;
    let n = Math.max(1, Math.round(width / TARGET_STONE_SIZE));
    if (layer === LAYERS - 1) n = Math.min(n, 2); // apex cap
    const spacing = n > 1 ? width / n : width;
    const yCenter = layer * courseHeight + courseHeight / 2;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const isPerimeter = n <= 2 || i === 0 || i === n - 1 || j === 0 || j === n - 1;
        if (!isPerimeter) continue;

        const x = -half + spacing / 2 + i * spacing;
        const z = -half + spacing / 2 + j * spacing;

        blocks.push({
          position: new THREE.Vector3(x, yCenter, z),
          width: Math.max(0.1, spacing - GAP),
          height: Math.max(0.1, courseHeight - GAP),
          depth: Math.max(0.1, spacing - GAP),
          color: ROCK_COLORS[Math.floor(Math.random() * ROCK_COLORS.length)],
          seed: Math.random() * Math.PI * 2,
        });
      }
    }
  }
  return blocks;
}

function jitterGeometry(geo, amount) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + (Math.random() - 0.5) * amount,
      pos.getY(i) + (Math.random() - 0.5) * amount,
      pos.getZ(i) + (Math.random() - 0.5) * amount
    );
  }
  geo.computeVertexNormals();
  return geo;
}

const CENTER = new THREE.Vector3(0, PYRAMID_HEIGHT * 0.35, 0);

export default function PyramidBlocks({ onHoverChange }) {
  const blockData = useMemo(buildBlockData, []);

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

  const geometries = useMemo(
    () => blockData.map((b) => jitterGeometry(new THREE.BoxGeometry(b.width, b.height, b.depth), 0.02)),
    [blockData]
  );

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
          castShadow
          receiveShadow
          userData={{ index: i }}
        >
          <meshStandardMaterial
            ref={(m) => (materialRefs.current[i] = m)}
            color={b.color}
            roughness={0.9}
            metalness={0.0}
            transparent={false}
            opacity={1}
          />
        </mesh>
      ))}
    </group>
  );
}
