import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';

export default function LoadingScreen({ onDone }) {
  const { progress, active } = useProgress();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (hidden) return;
    const finish = () => { setHidden(true); onDone(); };
    if (progress >= 100 && !active) {
      const t = setTimeout(finish, 300);
      return () => clearTimeout(t);
    }
    // Never strand the visitor on a black screen if a texture stalls
    const fallback = setTimeout(finish, 10000);
    return () => clearTimeout(fallback);
  }, [progress, active, hidden, onDone]);

  return (
    <div className={`loading-screen ${hidden ? 'hidden' : ''}`}>
      <div className="loading-percent">{Math.round(progress)}%</div>
    </div>
  );
}
