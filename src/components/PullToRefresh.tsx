'use client';

import { useState, useRef, useCallback, ReactNode } from 'react';

interface Props {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

const THRESHOLD = 80;
const MAX_PULL = 120;

export default function PullToRefresh({ onRefresh, children }: Props) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only trigger if page is scrolled to the very top
    if (window.scrollY > 0) return;
    startYRef.current = e.touches[0].clientY;
    pullingRef.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pullingRef.current || startYRef.current === null || refreshing) return;
    if (window.scrollY > 0) {
      startYRef.current = null;
      pullingRef.current = false;
      setPullDistance(0);
      return;
    }

    const delta = e.touches[0].clientY - startYRef.current;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }

    const resistance = 0.4;
    const distance = Math.min(delta * resistance, MAX_PULL);
    setPullDistance(distance);
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return;
    pullingRef.current = false;
    startYRef.current = null;

    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, onRefresh]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const isTriggered = pullDistance >= THRESHOLD;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center pointer-events-none transition-all duration-150 overflow-hidden"
        style={{
          height: `${Math.max(pullDistance, refreshing ? THRESHOLD : 0)}px`,
          opacity: Math.max(progress, refreshing ? 1 : 0),
        }}
      >
        {refreshing ? (
          <div className="w-7 h-7 rounded-full border-2 border-muted border-t-primary animate-spin" />
        ) : (
          <div
            className="w-7 h-7 rounded-full border-2 flex items-center justify-center transition-transform"
            style={{
              borderColor: isTriggered ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
              transform: `rotate(${isTriggered ? 180 : progress * 180}deg)`,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
              style={{ color: isTriggered ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
            >
              <path d="M6 2v8M3 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          transform: `translateY(${refreshing ? THRESHOLD : pullDistance}px)`,
          transition: refreshing || pullDistance === 0 ? 'transform 0.2s ease' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}