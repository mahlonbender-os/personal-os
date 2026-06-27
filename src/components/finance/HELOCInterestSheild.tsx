'use client';

import { useState, useEffect } from 'react';

interface ShieldMetrics {
  helocRate: number;
  currentBalance: number;
  creditLimit: number;
  totalIncomeDeposited: number;
  interestShieldedThisMonth: number;
  estimatedDailyAccrual: number;
  cycleDateRange: { start: string; end: string };
}

export default function HELOCInterestShield() {
  const [data, setData] = useState<ShieldMetrics | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchShieldData() {
      try {
        const res = await fetch('/api/finance/heloc/interest-shield');
        if (res.ok) {
          const payload = await res.json();
          setData(payload);
        }
      } catch (err) {
        console.error('Failed processing velocity pipeline metrics read', err);
      } finally {
        setLoading(false);
      }
    }
    fetchShieldData();
  }, []);

  const handleToggleExpand = () => {
    // Premium standardized micro-tick accordion haptic signature (5ms)
    if (navigator.vibrate) navigator.vibrate(5);
    setExpanded(!expanded);
  };

  if (loading) {
    return (
      <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-5 animate-pulse space-y-3">
        <div className="h-4 bg-[#222] rounded w-1/3" />
        <div className="h-8 bg-[#222] rounded w-2/3" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden transition-all duration-300">
      
      {/* Header Activation Row Layout */}
      <div 
        onClick={handleToggleExpand}
        className="p-5 flex items-center justify-between cursor-pointer active:bg-[#161616] transition-colors"
      >
        <div>
          <div className="text-xs font-semibold tracking-wider text-[#555] uppercase flex items-center gap-2">
            <span>🛡️ Velocity Banking Core</span>
            <span className="bg-[#f0a050]/10 text-[#f0a050] text-[10px] px-1.5 py-0.5 rounded font-mono font-normal">
              {data.helocRate.toFixed(2)}% APR
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-[#22c55e] mt-1">
            ${data.interestShieldedThisMonth.toFixed(2)}
          </div>
          <div className="text-[11px] text-[#555] mt-0.5">Avoided Interest This Cycle</div>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-[#f0a050]">
            {expanded ? 'HIDE DETAILS ↑' : 'VIEW ENGINE ↓'}
          </span>
        </div>
      </div>

      {/* Expandable Data Matrix Drawer */}
      {expanded && (
        <div className="px-5 pb-5 pt-2 border-t border-[#161616] bg-black/40 space-y-4">
          
          {/* Visual Progress Stack Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black/60 border border-[#1a1a1a] rounded-xl p-3">
              <span className="text-[10px] text-[#555] block uppercase font-medium">Monthly Injections</span>
              <span className="text-sm font-bold font-mono text-white mt-1 block">
                ${data.totalIncomeDeposited.toFixed(2)}
              </span>
            </div>
            <div className="bg-black/60 border border-[#1a1a1a] rounded-xl p-3">
              <span className="text-[10px] text-[#555] block uppercase font-medium">Daily Debt Accrual</span>
              <span className="text-sm font-bold font-mono text-[#ef4444] mt-1 block">
                ${data.estimatedDailyAccrual.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Strategic Insight Text Callout Box */}
          <div className="bg-[#1c1c1e]/40 rounded-xl p-3 border border-[#1a1a1a] text-xs text-[#ccc] leading-relaxed">
            <p>
              By sweeping direct deposits immediately to your <span className="text-[#f0a050] font-medium">Members 1st HELOC</span>, you compress daily principal drag. Every dollar held inside the line compounds interest mitigation back into net asset equity.
            </p>
          </div>

          {/* Bounds Date Window Label */}
          <div className="text-[10px] font-mono text-[#333] text-center tracking-tight uppercase">
            Active Cycle Ledger: {data.cycleDateRange.start} → {data.cycleDateRange.end}
          </div>
          
        </div>
      )}
    </div>
  );
}