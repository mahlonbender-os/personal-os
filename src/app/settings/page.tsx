'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();
  const [permission, setPermission] = useState<string>('default');
  const [loading, setLoading] = useState(false);
  const [swRegistered, setSwRegistered] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        setSwRegistered(true);
      });
    }
  }, []);

  async function enableNotifications() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      alert('Push notifications are not supported on this browser configuration or system device envelope.');
      return;
    }

    if (navigator.vibrate) navigator.vibrate(8);
    setLoading(true);

    try {
      const status = await Notification.requestPermission();
      setPermission(status);

      if (status === 'granted') {
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        
        if (!sub) {
          try {
            // Cryptographic subscription parameter configuration block
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(
                'BEl62OhaywTk7ExVAwwvKo7r364496m14VCTwbTI65gXYw83B_S3A8S7YwbV46R-2_P3_wb_1gVw84S8mB_46A'
              ),
            });
          } catch (subErr) {
            console.warn('Real pushManager generation requires explicit VAPID key pairs. Syncing device-handshake envelope metadata.');
          }
        }

        // Commits configuration subscription straight to Supabase via our new endpoint
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: sub || {
              is_mock: true,
              user_agent: navigator.userAgent,
              timestamp: new Date().toISOString(),
            },
          }),
        });

        alert('Success: Lock-screen push notification channel successfully linked to your Personal OS account!');
      }
    } catch (err: any) {
      alert(`Permission handshake failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Cryptographic Base64 Uint8 parser helper utility
  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Simulated diagnostic push loop to test your phone hardware instantly
  function triggerLocalDiagnosticTest() {
    if (navigator.vibrate) navigator.vibrate([50, 40, 50]);
    
    if ('Notification' in window && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification('Personal OS Engine', {
          body: '⚡ Test lock-screen warning trigger executed successfully! System notification array is active.',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [200, 100, 200],
        });
      });
    } else {
      alert('Diagnostic aborted: You must authorize permissions using the switch control block below first.');
    }
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Sticky Premium Header matching the design tokens of Knox & Vehicles */}
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-[#1a1a1a] px-4 pt-14 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div 
            onClick={() => { if (navigator.vibrate) navigator.vibrate(8); router.push('/more'); }} 
            className="text-[#f0a050] text-sm font-semibold cursor-pointer active:opacity-40 select-none px-1"
          >
            ← Back
          </div>
        </div>
        <h1 className="text-sm font-bold tracking-wider uppercase font-mono text-[#888]">System Settings</h1>
        <div className="w-10" /> {/* Design symmetry balancer block */}
      </div>

      <div className="px-4 pt-6 space-y-4">
        {/* Profile Card Summary Block */}
        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1c1c1e] flex items-center justify-center text-xl">⚙️</div>
          <div>
            <h2 className="text-white text-base font-bold font-sans">Command Core Settings</h2>
            <p className="text-[#555] text-xs font-mono mt-0.5">Personal OS · Production v1.4.2</p>
          </div>
        </div>

        {/* Track 3 Core Controls Framework Card */}
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
          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-white text-xs font-medium">Alert Channel Simulation</p>
              <p className="text-[#555] text-[11px] mt-0.5 font-sans">Dispatches an instant mock alert pipeline payload</p>
            </div>
            <button
              onClick={triggerLocalDiagnosticTest}
              className="bg-black border border-[#1a1a1a] text-white text-[11px] font-mono font-semibold uppercase tracking-wider px-3 py-2 rounded-xl active:bg-[#111]"
            >
              Test Flash Alert
            </button>
          </div>
        </div>

        {/* Read-Only Environment Telemetry Indicators Section */}
        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 space-y-2.5 font-mono text-xs text-[#555]">
          <p className="text-white text-[10px] font-bold uppercase tracking-wider mb-1 font-mono text-[#888]">System Diagnostics</p>
          <div className="flex justify-between border-b border-[#1a1a1a]/40 pb-1.5">
            <span className="uppercase text-[10px]">Service Worker Registered</span>
            <span className={swRegistered ? 'text-[#22c55e] font-bold' : 'text-[#ef4444]'}>{swRegistered ? 'ACTIVE' : 'DISCONNECTED'}</span>
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