import { useEffect, useState, type ReactNode } from '@lynx-js/react';
import './Sparkles.css';

const DEFAULT_COLOR = '#FFC000';

const generateSparkle = (color: string) => {
  return {
    id: String(Math.random()),
    createdAt: Date.now(),
    color,
    size: Math.floor(Math.random() * 20) + 10,
    style: {
      top: Math.floor(Math.random() * 100) + '%',
      left: Math.floor(Math.random() * 100) + '%',
      zIndex: 2,
    },
  };
};

interface Sparkle {
  id: string;
  createdAt: Date;
  color: string;
  size: number;
  style: any;
}

interface Props {
  color?: string;
  children: ReactNode;
  enabled?: boolean;
}

export const Sparkles = ({ color = DEFAULT_COLOR, children, enabled = true }: Props) => {
  const [sparkles, setSparkles] = useState<any[]>([]);

  useEffect(() => {
    if (!enabled) {
      setSparkles([]);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const newSparkle = generateSparkle(color);
      
      setSparkles(current => {
        // Filter out old sparkles (lifetime 750ms)
        const filtered = current.filter(s => (now - s.createdAt) < 750);
        // Cap max sparkles at 10 to prevent DOM overload
        if (filtered.length >= 10) return filtered;
        return [...filtered, newSparkle];
      });
    }, 400); // Optimized for performance: 2.5 sparkles/sec

    return () => clearInterval(interval);
  }, [enabled, color]);

  return (
    <view className="SparklesWrapper">
      {sparkles.map(sparkle => (
        <text
          key={sparkle.id}
          className="SparkleInstance"
          style={{
            ...sparkle.style,
            fontSize: sparkle.size + 'px',
            color: sparkle.color,
          }}
        >
          ✦
        </text>
      ))}
      <view className="SparkleChildWrapper">
        {children}
      </view>
    </view>
  );
};
