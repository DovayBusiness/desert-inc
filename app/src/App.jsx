import { useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import PyramidBlocks from './components/PyramidBlocks';
import SandParticles from './components/SandParticles';
import BaseDust from './components/BaseDust';
import DesertGround from './components/DesertGround';
import CameraRig from './components/CameraRig';
import CustomCursor from './components/CustomCursor';
import LoadingScreen from './components/LoadingScreen';

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [hovering, setHovering] = useState(false);

  const handleLoaded = useCallback(() => setLoaded(true), []);
  const handleIntroDone = useCallback(() => setIntroDone(true), []);
  const handleHoverChange = useCallback((h) => setHovering(h), []);

  return (
    <>
      {!loaded && <LoadingScreen onDone={handleLoaded} />}

      <Canvas shadows camera={{ fov: 35, position: [0, 5.8, 0.3] }} gl={{ antialias: true }}>
        <color attach="background" args={['#D9C5A5']} />
        <fogExp2 attach="fog" args={['#E8D5B5', 0.028]} />

        <ambientLight color="#FFEEDD" intensity={0.7} />
        <directionalLight
          color="#FFD9A8"
          intensity={1.8}
          position={[6, 8, 4]}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />

        <DesertGround />
        <PyramidBlocks onHoverChange={handleHoverChange} />
        <BaseDust />
        <SandParticles />
        <CameraRig startIntro={loaded} onIntroDone={handleIntroDone} />
      </Canvas>

      <div className="vignette" />
      <CustomCursor hovering={hovering && introDone} />
    </>
  );
}
