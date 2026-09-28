import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// A low, dense haze hugging the pyramid's base — distinct from the wider
// SandParticles field, this is the "dust kicked up around the stones" layer.
const COUNT = 260;
const RADIUS = 4.2;

export default function BaseDust() {
  const pointsRef = useRef();

  const [positions, seeds] = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT * 2); // phase, freq
    for (let i = 0; i < COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * RADIUS;
      pos[i * 3] = Math.cos(angle) * r;
      pos[i * 3 + 1] = Math.random() * 0.6;
      pos[i * 3 + 2] = Math.sin(angle) * r;
      seed[i * 2] = Math.random() * Math.PI * 2;
      seed[i * 2 + 1] = 0.3 + Math.random() * 0.5;
    }
    return [pos, seed];
  }, []);

  useFrame((state) => {
    const arr = pointsRef.current.geometry.attributes.position.array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      const idx = i * 3;
      arr[idx + 1] = Math.abs(Math.sin(t * seeds[i * 2 + 1] + seeds[i * 2])) * 0.6;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#E8D5B5"
        transparent
        opacity={0.25}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}
