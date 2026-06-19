'use client';

import { useState, useEffect, ReactNode } from 'react';

interface OfflineStatusWrapperProps {
  children: ReactNode;
}

export default function OfflineStatusWrapper({ children }: OfflineStatusWrapperProps) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Determine the initial hardware connection layout state on mount
    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
      // Trigger a light PWA envelope vibration notification when dropping connection
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <>
      {/* Premium Sticky Amber Connection Warning Banner */}
      {!isOnline && (
        <div 
          className="w-full bg-[#f0a050] text-black text-center text-[11px] font-mono py-2 font-bold sticky top-0 z-50 shadow-lg flex items-center justify-center gap-1.5 uppercase tracking-wider animate-pulse"
          style={{ fontFamily: 'monospace' }}
        >
          <span>⚠️</span> Offline Mode — Displaying Cached local Telemetry
        </div>
      )}
      {children}
    </>
  );
}