import { useState, useRef } from '@lynx-js/react';

interface Props {
  src: string;
  className?: string;
  mode?: string;
  onLoad?: (e: any) => void;
  onError?: (e: any) => void;
  style?: any;
}

interface Point {
  x: number;
  y: number;
}

export function ZoomableImage({ src, className, mode, onLoad, onError, style }: Props) {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  
  // Use refs for gesture tracking to avoid re-renders during gesture
  const gesture = useRef({
    startDistance: 0,
    startScale: 1,
    startFocal: { x: 0, y: 0 } as Point,
    initialCenter: { x: 0, y: 0 } as Point,
  });

  const handleTouchStart = (e: any) => {
    const touches = e.touches;
    if (touches.length === 2) {
      const t1 = touches[0];
      const t2 = touches[1];
      
      const dist = Math.sqrt(
        Math.pow(t2.clientX - t1.clientX, 2) + 
        Math.pow(t2.clientY - t1.clientY, 2)
      );
      
      const focalX = (t1.clientX + t2.clientX) / 2;
      const focalY = (t1.clientY + t2.clientY) / 2;

      gesture.current = {
        startDistance: dist,
        startScale: transform.scale,
        startFocal: { x: focalX, y: focalY },
        initialCenter: { x: transform.x, y: transform.y }
      };
    }
  };

  const handleTouchMove = (e: any) => {
    const touches = e.touches;
    if (touches.length === 2 && gesture.current.startDistance > 0) {
      const t1 = touches[0];
      const t2 = touches[1];
      
      const currentDist = Math.sqrt(
        Math.pow(t2.clientX - t1.clientX, 2) + 
        Math.pow(t2.clientY - t1.clientY, 2)
      );

      const scaleEffect = currentDist / gesture.current.startDistance;
      const newScale = Math.max(1, Math.min(gesture.current.startScale * scaleEffect, 4));

      // Calculate focal point movement (panning)
      const currentFocalX = (t1.clientX + t2.clientX) / 2;
      const currentFocalY = (t1.clientY + t2.clientY) / 2;
      
      // Simple pan support - tracking focal point delta
      // Note: Full rigorous matrix math is complex, this is a simplified version
      const deltaX = currentFocalX - gesture.current.startFocal.x;
      const deltaY = currentFocalY - gesture.current.startFocal.y;

      setTransform(prev => ({
        scale: newScale,
        x: prev.x + deltaX, // This might need refinement for "sticky" panning
        y: prev.y + deltaY
      }));
      
      // Update focal for next frame to avoid continuous addition
      gesture.current.startFocal = { x: currentFocalX, y: currentFocalY };
    }
  };

  const handleTouchEnd = (e: any) => {
    if (e.touches.length < 2) {
      // Reset if zoomed out too far or just cleanup
      if (transform.scale < 1.1) {
         setTransform({ scale: 1, x: 0, y: 0 });
      }
      gesture.current.startDistance = 0;
    }
  };

  return (
    <view 
      className="Zoomable-container"
      bindtouchstart={handleTouchStart}
      bindtouchmove={handleTouchMove}
      bindtouchend={handleTouchEnd}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'visible',
        zIndex: transform.scale > 1 ? 1000 : 1
      }}
    >
      <image 
        src={src}
        className={className}
        mode="aspectFit"
        bindload={onLoad}
        binderror={onError}
        style={{
          width: '100%',
          height: '100%',
          transform: `scale(${transform.scale}) translate(${transform.x}px, ${transform.y}px)`,
          transformOrigin: 'center center',
          ...style
        }}
      />
    </view>
  );
}
