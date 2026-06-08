'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import BottomNav from '@/components/BottomNav';
import PullToRefresh from '@/components/PullToRefresh';

interface Warranty {
  id: string;
  item_name: string;
  purchase_date: string | null;
  expiration_date: string | null;
  vendor: string | null;
  notes: string | null;
}

export default function WarrantiesPage() {
  const { data: session, status } = useSession();
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);

  const loadWarranties = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/warranties', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        // Since the API returns a direct array, map it safely with a fallback
        setWarranties(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to load warranties dataset:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) {
      loadWarranties();
    }
  }, [session, loadWarranties, refreshCount]);

  const handleRefresh = async () => {
    setRefreshCount(c => c + 1);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#f0a050] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-[#555] text-sm">Please sign in</p>
      </div>
    );
  }

  const fmtDate = (s: string | null) => {
    if (!s) return '—';
    return new Date(s + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const isExpired = (s: string | null) => {
    if (!s) return false;
    const today = new Date();
    today.setHours(0,0,0,0);
    return new Date(s + 'T00:00:00') < today;
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col overflow-hidden select-none">
      
      {/* HEADER - Locked directly to the top edge */}
      <div className="flex-shrink-0 bg-black border-b border-[#1a1a1a] pt-14 px-4 pb-4 z-30">
        <h1 className="text-xl font-bold text-white">Warranties</h1>
        <p className="text-[10px] text-[#555] font-semibold uppercase tracking-wider mt-0.5">
          Active Coverage Protection
        </p>
      </div>

      {/* INDEPENDENT SCROLL VIEWPORT CONTAINER */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 scrollbar-hide">
        <PullToRefresh onRefresh={handleRefresh}>
          {loading && warranties.length === 0 ? (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 border-2 border-[#f0a050] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : warranties.length === 0 ? (
            <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-6 text-center text-[#444] text-xs font-mono">
              No asset warranties configured inside Supabase.
            </div>
          ) : (
            <div className="space-y-3">
              {warranties.map((w) => {
                const expired = isExpired(w.expiration_date);
                return (
                  <div key={w.id} className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4 flex flex-col gap-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-semibold text-[#e0e0e0] truncate">{w.item_name}</h2>
                        {w.vendor && <p className="text-[11px] text-[#555] mt-0.5">{w.vendor}</p>}
                      </div>
                      {w.expiration_date && (
                        <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-mono uppercase tracking-wider flex-shrink-0 border ${
                          expired 
                            ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20' 
                            : 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20'
                        }`}>
                          {expired ? 'Expired' : 'Active'}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-[#161616] pt-2 mt-1">
                      <div>
                        <p className="text-[#444] text-[9px] uppercase tracking-wider font-semibold">Purchased</p>
                        <p className="text-[#ccc] font-mono mt-0.5">{fmtDate(w.purchase_date)}</p>
                      </div>
                      <div>
                        <p className="text-[#444] text-[9px] uppercase tracking-wider font-semibold">Expires</p>
                        <p className="text-[#ccc] font-mono mt-0.5">{fmtDate(w.expiration_date)}</p>
                      </div>
                    </div>

                    {w.notes && (
                      <div className="bg-black/40 rounded-xl p-2.5 text-[11px] text-[#777] mt-1 border border-[#161616]/40">
                        {w.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </PullToRefresh>
      </div>

      {/* FIXED FOOTER NAVIGATION - Permanently locked to the bottom edge */}
      <BottomNav active="more" />
    </div>
  );
}