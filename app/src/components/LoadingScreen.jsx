import { useEffect, useState } from 'react';

// The scene here is entirely procedural (no textures/models to fetch), so
// there's no real network progress to track — this simulates the loading
// beat while the pyramid's ~180 blocks and their jittered geometry are
// generated, then hands off to the camera intro.
export default function LoadingScreen({ onDone }) {
  const [percent, setPercent] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let raf;
    const start = performance.now();
    const DURATION = 900;

    function tick() {
      const elapsed = performance.now() - start;
      const p = Math.min(100, Math.round((elapsed / DURATION) * 100));
      setPercent(p);
      if (p < 100) {
        raf = requestAnimationFrame(tick);
      } else {
        setHidden(true);
        onDone();
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <div className={`loading-screen ${hidden ? 'hidden' : ''}`}>
      <div className="loading-percent">{percent}%</div>
    </div>
  );
}
