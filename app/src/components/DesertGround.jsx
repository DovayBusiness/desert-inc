import { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

export default function DesertGround() {
  const [albedo, normal] = useTexture([
    './assets/textures/sand/albedo.jpg',
    './assets/textures/sand/normal.jpg',
  ]);
  useMemo(() => {
    for (const t of [albedo, normal]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(28, 28);
      t.anisotropy = 8;
    }
    albedo.colorSpace = THREE.SRGBColorSpace;
  }, [albedo, normal]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial map={albedo} normalMap={normal} color="#E6CFA0" roughness={1} metalness={0} />
    </mesh>
  );
}
