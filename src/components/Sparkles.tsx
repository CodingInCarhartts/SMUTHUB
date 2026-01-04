import { useEffect, useState, type ReactNode } from '@lynx-js/react';
import { ACTIVE_EVENT } from '../config';
import './Sparkles.css';

const generateSparkle = (color: string, icon: string, mode: string, image?: string) => {
  const isFall = mode === 'fall';
  const isDrift = mode === 'drift';
  
  return {
    id: String(Math.random()),
    createdAt: Date.now(),
    color,
    icon,
    image,
    mode,
    size: Math.floor(Math.random() * (image ? 40 : 20)) + 15,
    style: {
      top: isFall ? '-40px' : (Math.floor(Math.random() * 100) + '%'),
      left: Math.floor(Math.random() * 100) + '%',
      zIndex: 2,
    },
  };
};

interface Props {
  color?: string;
  icon?: string;
  image?: string;
  mode?: 'sparkle' | 'fall' | 'drift';
  children: ReactNode;
  enabled?: boolean;
}

export const Sparkles = ({ 
  color = ACTIVE_EVENT.color, 
  icon = ACTIVE_EVENT.icon,
  image = (ACTIVE_EVENT as any).image,
  mode = ACTIVE_EVENT.mode as any,
  children, 
  enabled = ACTIVE_EVENT.enabled 
}: Props) => {
  const [sparkles, setSparkles] = useState<any[]>([]);

  useEffect(() => {
    console.log('[Sparkles] Component Mounted inside useEffect. Enabled:', enabled);
    if (!enabled) {
      setSparkles([]);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const newSparkle = generateSparkle(color, icon, mode, image);
      console.log(`[Sparkles] Spawning id=${newSparkle.id} icon=${newSparkle.icon} mode=${mode}`);
      
      setSparkles(current => {
        const lifetime = mode === 'fall' ? 3000 : (mode === 'drift' ? 2000 : 750);
        const filtered = current.filter(s => (now - s.createdAt) < lifetime);
        
        const max = image ? 20 : 12;
        if (filtered.length >= max) return filtered;
        return [...filtered, newSparkle];
      });
    }, image ? 300 : 600);

    return () => clearInterval(interval);
  }, [enabled, color, icon, mode, image]);

  console.log('[Sparkles] Rendering. Active count:', sparkles.length);

  return (
    <view className="SparklesWrapper">
      {sparkles.map(sparkle => (
        sparkle.image ? (
          <image
            key={sparkle.id}
            src={sparkle.image}
            className={`SparkleInstance mode-${sparkle.mode}`}
            style={{
              ...sparkle.style,
              width: sparkle.size + 'px',
              height: sparkle.size + 'px',
            }}
            mode="aspectFit"
          />
        ) : (
          <text
            key={sparkle.id}
            className={`SparkleInstance mode-${sparkle.mode}`}
            style={{
              ...sparkle.style,
              fontSize: sparkle.size + 'px',
              color: sparkle.color,
            }}
          >
            {sparkle.icon}
          </text>
        )
      ))}
      <view className="SparkleChildWrapper">
        {children}
      </view>
    </view>
  );
};
