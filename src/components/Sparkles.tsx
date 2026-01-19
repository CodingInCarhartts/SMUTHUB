import { type ReactNode, useEffect, useState } from '@lynx-js/react';
import { ACTIVE_EVENT } from '../config';
import './Sparkles.css';

interface Sparkle {
  id: string;
  createdAt: number;
  color: string;
  size: number;
  style: any;
  icon: string;
  mode: 'sparkle' | 'fall' | 'drift';
}

const generateSparkle = (
  color: string,
  icon: string,
  mode: 'sparkle' | 'fall' | 'drift' = 'sparkle',
): Sparkle => {
  const isFall = mode === 'fall';

  return {
    id: Math.random().toString(36).slice(2),
    createdAt: Date.now(),
    color,
    size: Math.floor(Math.random() * 20) + 15,
    style: {
      top: isFall ? '-40px' : Math.floor(Math.random() * 100) + '%',
      left: Math.floor(Math.random() * 100) + '%',
      zIndex: 2,
    },
    icon,
    mode,
  };
};

interface Props {
  color?: string;
  icon?: string;
  mode?: 'sparkle' | 'fall' | 'drift';
  children: ReactNode;
  enabled?: boolean;
}

export const Sparkles = ({
  color = ACTIVE_EVENT.color,
  icon = ACTIVE_EVENT.icon,
  mode = ACTIVE_EVENT.mode as any,
  children,
  enabled = ACTIVE_EVENT.enabled,
}: Props) => {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

  useEffect(() => {
    if (!enabled) {
      setSparkles([]);
      return;
    }

    const interval = setInterval(
      () => {
        const now = Date.now();
        const newSparkle = generateSparkle(color, icon, mode);

        setSparkles((current) => {
          const lifetime =
            mode === 'fall' ? 3000 : mode === 'drift' ? 2000 : 750;
          const filtered = current.filter((s) => now - s.createdAt < lifetime);

          if (filtered.length >= 12) return filtered;
          return [...filtered, newSparkle];
        });
      },
      mode === 'sparkle' ? 400 : 800,
    );

    return () => clearInterval(interval);
  }, [enabled, color, icon, mode]);

  return (
    <view className="SparklesWrapper">
      {sparkles.map((sparkle) => (
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
      ))}
      <view className="SparkleChildWrapper">{children}</view>
    </view>
  );
};
