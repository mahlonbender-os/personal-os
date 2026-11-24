'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();
  const [permission, setPermission] = useState<string>('default');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  async function enableNotifications() {
    if (!('Notification' in window)) {
      alert('This phone does not support notifications.');
      return;
    }
    if (navigator.vibrate) navigator.vibrate(8);
    setLoading(true);
    try {
      const status = await Notification.requestPermission();
      setPermission(status);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Permission failed';
      alert(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Sticky Premium Header matching the design tokens of Knox & Vehicles */}
      <div className="sticky top-0 z-30 bg-black border-b border-[#1a1a1a] px-4 pt-14 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div 
            onClick={() => { if (navigator.vibrate) navigator.vibrate(8); router.push('/more'); }} 
            className="text-[#f0a050] text-sm font-semibold cursor-pointer active:opacity-40 select-none px-1"
          >
            ← Back
          </div>
        </div>
        <h1 className="text-sm font-bold tracking-wider uppercase font-mono text-[#888]">System Settings</h1>
        <div className="w-10" />
      </div>

      <div className="px-4 pt-6 space-y-4">
        {/* Profile Card Summary Block */}
        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1c1c1e] flex items-center justify-center text-xl">⚙️</div>
          <div>
            <h2 className="text-white text-base font-bold font-sans">Command Core Settings</h2>
            <p className="text-[#555] text-xs font-mono mt-0.5">Personal OS · Production v1.4.3</p>
          </div>
        </div>

        {/* Controls Framework Card */}
        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1a1a1a]/60 pb-3">
            <div>
              <p className="text-white text-sm font-semibold">Lock-Screen Push Notifications</p>
              <p className="text-[#555] text-xs mt-0.5">Authorize real-time cross-module warning loops</p>
            </div>
            <button
              onClick={enableNotifications}
              disabled={loading || permission === 'granted'}
              className={`text-xs font-mono font-bold px-3 py-2 rounded-xl transition-all border tracking-wide uppercase shrink-0 ${
                permission === 'granted'
                  ? 'border-[#22c55e]/30 bg-[#22c55e]/10 text-[#22c55e]'
                  : permission === 'denied'
                  ? 'border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]'
                  : 'border-[#f0a050]/40 bg-[#f0a050]/10 text-[#f0a050] active:bg-[#f0a050]/20'
              }`}
            >
              {loading ? 'Syncing...' : permission === 'granted' ? 'Enabled' : permission === 'denied' ? 'Blocked' : 'Authorize'}
            </button>
          </div>

          {/* Diagnostic Action Block Row Element */}
          <p className="text-[#555] text-[11px]">Lock-screen alerts stayed tied to the old offline cache, so that channel is off.</p>
        </div>

        {/* Read-Only Environment Telemetry Indicators Section */}
        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 space-y-2.5 font-mono text-xs text-[#555]">
          <p className="text-white text-[10px] font-bold uppercase tracking-wider mb-1 font-mono text-[#888]">System Diagnostics</p>
          <div className="flex justify-between border-b border-[#1a1a1a]/40 pb-1.5">
            <span className="uppercase text-[10px]">Offline cache</span>
            <span className="text-[#888] font-bold">OFF</span>
          </div>
          <div className="flex justify-between border-b border-[#1a1a1a]/40 pb-1.5">
            <span className="uppercase text-[10px]">Notification Handshake State</span>
            <span className="text-white uppercase font-bold">{permission}</span>
          </div>
          <div className="flex justify-between pt-0.5">
            <span className="uppercase text-[10px]">Hardware Engine Target</span>
            <span className="text-white text-right truncate max-w-[50%]">PWA Mobile Webkit</span>
          </div>
        </div>
      </div>
    </div>
  );
}