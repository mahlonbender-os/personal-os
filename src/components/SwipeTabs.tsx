'use client';

import { useState, useRef, useCallback, ReactNode, useEffect } from 'react';

interface Tab {
  id: string;
  label: string;
}

interface Props {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children: ReactNode[];
}

const SWIPE_THRESHOLD = 0.15;
const SWIPE_VELOCITY_THRESHOLD = 0.1;

export default function SwipeTabs({ tabs, activeTab, onTabChange, children }: Props) {
  const activeIndex = tabs.findIndex((t) => t.id === activeTab);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number | null>(null);
  const isHorizontal = useRef<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Scroll active panel to top whenever tab changes
  useEffect(() => {
    window.scrollTo(0, 0);
    const panel = panelRefs.current[activeIndex];
    if (panel) panel.scrollTop = 0;
  }, [activeIndex]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    isHorizontal.current = null;
    setIsDragging(false);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    if (isHorizontal.current === null) {
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 3) {
        isHorizontal.current = true;
      } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 3) {
        isHorizontal.current = false;
        return;
      } else {
        return;
      }
    }

    if (!isHorizontal.current) return;

    e.preventDefault();

    if (dx > 0 && activeIndex === 0) return;
    if (dx < 0 && activeIndex === tabs.length - 1) return;

    setIsDragging(true);
    setDragOffset(dx);
  }, [activeIndex, tabs.length]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isHorizontal.current || touchStartX.current === null) {
      setDragOffset(0);
      setIsDragging(false);
      return;
    }

    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dt = Date.now() - (touchStartTime.current || Date.now());
    const velocity = Math.abs(dx) / dt;
    const screenWidth = window.innerWidth;
    const isFlick = velocity > SWIPE_VELOCITY_THRESHOLD;
    const isPastThreshold = Math.abs(dx) > screenWidth * SWIPE_THRESHOLD;

    if ((isPastThreshold || isFlick) && Math.abs(dx) > 5) {
      if (dx < 0 && activeIndex < tabs.length - 1) {
        if (navigator.vibrate) navigator.vibrate(8);
        onTabChange(tabs[activeIndex + 1].id);
      } else if (dx > 0 && activeIndex > 0) {
        if (navigator.vibrate) navigator.vibrate(8);
        onTabChange(tabs[activeIndex - 1].id);
      }
    }

    setDragOffset(0);
    setIsDragging(false);
    touchStartX.current = null;
    touchStartY.current = null;
    isHorizontal.current = null;
  }, [activeIndex, tabs, onTabChange]);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      <div
        className="flex"
        style={{
          width: `${tabs.length * 100}%`,
          transform: `translateX(calc(${-activeIndex * (100 / tabs.length)}% + ${dragOffset / tabs.length}px))`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      >
        {children.map((child, idx) => (
          <div
            key={tabs[idx]?.id || idx}
            ref={(el) => { panelRefs.current[idx] = el; }}
            style={{ width: `${100 / tabs.length}%` }}
            className="flex-shrink-0 min-w-0"
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}