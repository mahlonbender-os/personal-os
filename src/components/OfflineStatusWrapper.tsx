'use client';

import { useState, useEffect, ReactNode } from 'react';

interface OfflineStatusWrapperProps {
  children: ReactNode;
}

export default function OfflineStatusWrapper({ children }: OfflineStatusWrapperProps) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Determine the initial hardware connection state on mount
    setIsOnline(navigator.onLine);

    // Automatically register the background PWA service worker script
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('Service Worker successfully registered onto device array:', reg.scope);
        })
        .catch((err) => {
          console.error('Service Worker registration failed:', err);
        });
    }

    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
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
          <span>⚠️</span> Offline Mode — Displaying Cached Local Telemetry
        </div>
      )}
      {children}
    </>
  );
}