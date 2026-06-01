'use client';

import { useState, useRef, useCallback, ReactNode } from 'react';

interface Props {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

const THRESHOLD = 80; // px to pull before triggering
const MAX_PULL = 120; // max px the indicator travels

export default function PullToRefresh({ onRefresh, children }: Props) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;
    // Only start pull if already at the top of the scroll
    if (container.scrollTop > 0) return;
    startYRef.current = e.touches[0].clientY;
    pullingRef.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pullingRef.current || startYRef.current === null || refreshing) return;
    const container = containerRef.current;
    if (!container) return;
    if (container.scrollTop > 0) {
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

    // Apply resistance so it feels natural
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
      setPullDistance(THRESHOLD); // hold at threshold while refreshing
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
      ref={containerRef}
      className="relative overflow-y-auto h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ overflowY: 'auto' }}
    >
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center z-20 pointer-events-none transition-all duration-150"
        style={{
          top: 0,
          height: `${Math.max(pullDistance, refreshing ? THRESHOLD : 0)}px`,
          opacity: Math.max(progress, refreshing ? 1 : 0),
        }}
      >
        {refreshing ? (
          // Spinning loader
          <div className="w-7 h-7 rounded-full border-2 border-muted border-t-primary animate-spin" />
        ) : (
          // Arrow that rotates as you pull
          <div
            className="w-7 h-7 rounded-full border-2 flex items-center justify-center transition-transform"
            style={{
              borderColor: isTriggered ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
              transform: `rotate(${isTriggered ? 180 : progress * 180}deg)`,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{ color: isTriggered ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
            >
              <path
                d="M6 2v8M3 7l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Page content — shifts down as you pull */}
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