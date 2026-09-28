import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';

// Pulled back from the brief's literal (0, 1.3, 6.8): at fov 35 that distance
// only fit a handful of the bottom courses on screen — the pyramid (5 tall,
// 6 wide) needs real room to read as a whole shape, not a wall of oversized
// blocks. This distance/height frames the full pyramid with margin.
const REST_POSITION = new THREE.Vector3(0, 2.6, 13);
const REST_LOOKAT_Y = 2.2;

export default function CameraRig({ startIntro, onIntroDone }) {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0 });
  const introDoneRef = useRef(false);
  const lookAtY = useRef(5);

  useEffect(() => {
    const onMove = (e) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useEffect(() => {
    if (!startIntro) return;

    camera.fov = 35;
    camera.position.set(0, 5.8, 0.3);
    camera.updateProjectionMatrix();
    camera.lookAt(0, 5, 0);
    lookAtY.current = 5;

    const progress = { t: 0 };
    const tl = gsap.timeline({
      onComplete: () => {
        // 3.5s-4s: settle with a small shake before handing off to parallax
        const shake = { x: 0, y: 0, z: 0 };
        gsap.to(shake, {
          x: (Math.random() - 0.5) * 0.15,
          y: (Math.random() - 0.5) * 0.1,
          z: (Math.random() - 0.5) * 0.15,
          duration: 0.18,
          ease: 'power2.out',
          onUpdate: () => {
            camera.position.set(REST_POSITION.x + shake.x, REST_POSITION.y + shake.y, REST_POSITION.z + shake.z);
          },
          onComplete: () => {
            gsap.to(shake, {
              x: 0,
              y: 0,
              z: 0,
              duration: 0.32,
              ease: 'elastic.out(1, 0.5)',
              onUpdate: () => {
                camera.position.set(REST_POSITION.x + shake.x, REST_POSITION.y + shake.y, REST_POSITION.z + shake.z);
              },
              onComplete: () => {
                introDoneRef.current = true;
                onIntroDone();
              },
            });
          },
        });
      },
    });

    // 0s-0.5s: hold at the top tip
    tl.to(progress, { t: 0, duration: 0.5 });
    // 0.5s-3.5s: spiral down 360° around Y while descending to the front view
    tl.to(progress, {
      t: 1,
      duration: 3.0,
      ease: 'power3.inOut',
      onUpdate: () => {
        const p = progress.t;
        const angle = p * Math.PI * 2;
        const radius = THREE.MathUtils.lerp(0.3, REST_POSITION.z, p);
        const y = THREE.MathUtils.lerp(5.8, REST_POSITION.y, p);
        camera.position.set(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
        lookAtY.current = THREE.MathUtils.lerp(5, REST_LOOKAT_Y, p);
        camera.lookAt(0, lookAtY.current, 0);
      },
    });

    return () => tl.kill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startIntro]);

  useFrame(() => {
    if (!introDoneRef.current) return;
    // Post-intro mouse parallax: gentle offset around the resting position
    const target = REST_POSITION.clone().add(
      new THREE.Vector3(mouse.current.x * 0.35, -mouse.current.y * 0.35, 0)
    );
    camera.position.lerp(target, 0.04);
    camera.lookAt(0, REST_LOOKAT_Y, 0);
  });

  return null;
}
