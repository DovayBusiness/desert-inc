import { useState, useCallback, Suspense } from 'react';
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

        {/* Lower flat fill + sky/ground bounce and a stronger low sun, so the
            stone relief and course shadows actually read */}
        <ambientLight color="#FFEEDD" intensity={0.3} />
        <hemisphereLight args={['#FFE9C8', '#9C7448', 0.55]} />
        <directionalLight
          color="#FFD9A8"
          intensity={2.6}
          position={[6, 8, 4]}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-9}
          shadow-camera-right={9}
          shadow-camera-top={9}
          shadow-camera-bottom={-9}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
        />

        <Suspense fallback={null}>
          <DesertGround />
          <PyramidBlocks onHoverChange={handleHoverChange} />
        </Suspense>
        <BaseDust />
        <SandParticles />
        <CameraRig startIntro={loaded} onIntroDone={handleIntroDone} />
      </Canvas>

      <div className="vignette" />
      <CustomCursor hovering={hovering && introDone} />
    </>
  );
}
