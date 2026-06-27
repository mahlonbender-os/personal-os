'use client';

import React, { createContext, useContext } from 'react';

type HapticType = 'light' | 'success' | 'heavy';

interface HapticContextType {
  triggerHaptic: (type: HapticType) => void;
}

const HapticContext = createContext<HapticContextType | undefined>(undefined);

export function HapticProvider({ children }: { children: React.ReactNode }) {
  const triggerHaptic = (type: HapticType) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        if (type === 'light') {
          navigator.vibrate(10);
        } else if (type === 'success') {
          navigator.vibrate([15, 30, 15]);
        } else if (type === 'heavy') {
          navigator.vibrate(35);
        }
      }
      // iOS Safari does not support navigator.vibrate — no workaround exists for PWAs.
      // The above gracefully does nothing on iPhone; it works on Android Chrome.
    } catch {
      // Silently ignore — vibration is enhancement-only
    }
  };

  return (
    <HapticContext.Provider value={{ triggerHaptic }}>
      {children}
    </HapticContext.Provider>
  );
}

export function useHaptics() {
  const context = useContext(HapticContext);
  if (!context) {
    throw new Error('useHaptics must be used inside a HapticProvider');
  }
  return context;
}