'use client';

import { useEffect, useRef, useState, ReactNode } from 'react';

interface Props {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

const THRESHOLD = 72;
const MAX_PULL = 120;
const INDICATOR = 44;

function nearestScrollTop(start: HTMLElement | null): number {
  let node = start?.parentElement ?? null;
  while (node && node !== document.body && node !== document.documentElement) {
    const overflowY = window.getComputedStyle(node).overflowY;
    const canScroll = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
    if (canScroll && node.scrollHeight > node.clientHeight + 1) return node.scrollTop;
    node = node.parentElement;
  }
  return window.scrollY || document.documentElement.scrollTop || 0;
}

export default function PullToRefresh({ onRefresh, children }: Props) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const resetPull = () => {
      pullingRef.current = false;
      startYRef.current = null;
      pullRef.current = 0;
      setPullDistance(0);
    };

    const onStart = (event: TouchEvent) => {
      if (refreshingRef.current || event.touches.length !== 1) return;
      if (nearestScrollTop(el) > 1) return;
      startYRef.current = event.touches[0].clientY;
      pullingRef.current = true;
    };

    const onMove = (event: TouchEvent) => {
      if (!pullingRef.current || startYRef.current === null || refreshingRef.current) return;
      if (nearestScrollTop(el) > 1) {
        resetPull();
        return;
      }
      const delta = event.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        pullRef.current = 0;
        setPullDistance(0);
        return;
      }
      if (event.cancelable) event.preventDefault();
      const distance = Math.min(delta * 0.45, MAX_PULL);
      pullRef.current = distance;
      setPullDistance(distance);
    };

    const onEnd = () => {
      if (!pullingRef.current) return;
      const distance = pullRef.current;
      pullingRef.current = false;
      startYRef.current = null;
      if (distance < THRESHOLD) {
        pullRef.current = 0;
        setPullDistance(0);
        return;
      }
      refreshingRef.current = true;
      pullRef.current = INDICATOR;
      setPullDistance(INDICATOR);
      setRefreshing(true);
      Promise.resolve(onRefreshRef.current()).finally(() => {
        refreshingRef.current = false;
        pullRef.current = 0;
        setRefreshing(false);
        setPullDistance(0);
      });
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const height = refreshing ? INDICATOR : pullDistance;
  const triggered = pullDistance >= THRESHOLD;

  return (
    <div ref={rootRef}>
      <div
        className="flex items-center justify-center gap-2 overflow-hidden pointer-events-none"
        style={{ height, opacity: refreshing ? 1 : progress }}
        aria-live="polite"
      >
        {refreshing ? (
          <>
            <div className="w-4 h-4 rounded-full border-2 border-[#f0a050] border-t-transparent animate-spin" />
            <span className="text-[11px] font-semibold text-[#f0a050]">Refreshing…</span>
          </>
        ) : (
          <div
            className="w-7 h-7 rounded-full border-2 flex items-center justify-center"
            style={{
              borderColor: triggered ? '#f0a050' : '#555',
              transform: `rotate(${triggered ? 180 : progress * 180}deg)`,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M6 2v8M3 7l3 3 3-3"
                stroke={triggered ? '#f0a050' : '#888'}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
