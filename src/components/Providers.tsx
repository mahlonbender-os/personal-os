'use client';

import React from 'react';
import { SessionProvider } from 'next-auth/react';
import { HapticProvider } from '@/context/HapticContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <HapticProvider>
        {children}
      </HapticProvider>
    </SessionProvider>
  );
}