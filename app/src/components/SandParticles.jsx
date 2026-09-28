import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COUNT = 2000;
const FIELD = 30;

export default function SandParticles() {
  const pointsRef = useRef();

  const [positions, seeds] = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT); // per-particle wind speed
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * FIELD;
      pos[i * 3 + 1] = Math.random() * 3.5;
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * FIELD;
      seed[i] = 0.4 + Math.random() * 0.8;
    }
    return [pos, seed];
  }, []);

  useFrame((_, delta) => {
    const arr = pointsRef.current.geometry.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      const idx = i * 3;
      arr[idx] += seeds[i] * delta; // wind drifts along +X
      if (arr[idx] > FIELD) {
        arr[idx] -= FIELD * 2;
        arr[idx + 2] = (Math.random() * 2 - 1) * FIELD;
      }
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color="#DDC9A0"
        transparent
        opacity={0.35}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}
