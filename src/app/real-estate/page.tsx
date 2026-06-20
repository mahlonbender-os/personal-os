'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PullToRefresh from '@/components/PullToRefresh';
import BottomNav from '@/components/BottomNav';

interface RealEstateData {
  homeValue: number;
  helocBalance: number;
  primaryMortgage: number;
  lastUpdated: string;
}

export default function RealEstateOptimizationPage() {
  const router = useRouter();
  const [data, setData] = useState<RealEstateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [extraPayment, setExtraPayment] = useState('500');
  const [helocRate, setHelocRate] = useState('8.25');

  async function getMetrics() {
    try {
      const res = await fetch('/api/finance/real-estate');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Failed to parse real estate data streams:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    getMetrics();
  }, []);

  const handleRefresh = async () => {
    await getMetrics();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono">
        LOADING ENGINE BALANCES...
      </div>
    );
  }

  // Real estate math calculations
  const homeValue = data?.homeValue || 425000; 
  const helocBalance = data?.helocBalance || 18450;
  const primaryMortgage = 172000;
  
  const totalDebt = primaryMortgage + helocBalance;
  const currentEquity = homeValue - totalDebt;
  
  // Max borrowable limit based on 80% LTV parameter standard
  const maxLtvValue = homeValue * 0.80;
  const borrowableEquity = Math.max(0, maxLtvValue - primaryMortgage - helocBalance);

  const extra = parseFloat(extraPayment) || 0;
  const rateFraction = (parseFloat(helocRate) || 0) / 100 / 12;
  
  // Calculate approximate monthly interest savings 
  const monthlyInterestSaved = helocBalance > 0 ? (helocBalance * (parseFloat(helocRate) || 8.25) / 100 / 12) - ((Math.max(0, helocBalance - extra)) * (parseFloat(helocRate) || 8.25) / 100 / 12) : 0;
  const yearlyInterestSaved = monthlyInterestSaved * 12;

  const fmt = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-[#f0a050]/30 pb-24">
      {/* Fixed Sticky Header Panel */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-[#1a1a1a] px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div onClick={() => router.push('/more')} className="text-[#f0a050] text-sm font-mono cursor-pointer flex items-center gap-1">
            ← BACK
          </div>
          <h1 className="text-xl font-bold tracking-tight font-display text-[#f0a050] ml-2">EQUITY OPTIMIZER</h1>
        </div>
        <span className="text-[10px] font-mono text-[#555] uppercase">SYS: LIVE</span>
      </div>

      <PullToRefresh onRefresh={handleRefresh}>
        <div className="px-4 pt-4 space-y-4 max-w-md mx-auto">
          
          {/* Real Estate Valuation Card */}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
            <div className="text-xs text-[#555] font-mono uppercase tracking-wider">Estimated Property Asset Value</div>
            <div className="text-3xl font-bold font-mono text-white mt-1">{fmt(homeValue)}</div>
            <div className="text-[11px] text-[#ccc] font-sans mt-1">
              Source Matrix: <span className="text-[#f0a050]">Accounts!Row 11 (Zestimate)</span>
            </div>
            
            <hr className="border-[#1a1a1a] my-3" />
            
            <div className="grid grid-cols-2 gap-2 text-sm font-mono">
              <div>
                <span className="text-[#555] block text-xs uppercase">Primary Mortgage:</span>
                <span className="text-white text-sm font-semibold">{fmt(primaryMortgage)}</span>
              </div>
              <div>
                <span className="text-[#555] block text-xs uppercase">HELOC Balance:</span>
                <span className="text-[#ef4444] text-sm font-semibold">{fmt(helocBalance)}</span>
              </div>
            </div>
          </div>

          {/* Real-time Equity Position Visualizer */}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 space-y-3">
            <div className="text-xs text-[#555] font-mono uppercase tracking-wider">Equity Leverage Breakdown</div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] text-[#ccc] font-sans">Net Home Equity</div>
                <div className="text-xl font-bold font-mono text-[#22c55e] mt-0.5">{fmt(currentEquity)}</div>
              </div>
              <div>
                <div className="text-[11px] text-[#ccc] font-sans">Available Equity (80% LTV)</div>
                <div className="text-xl font-bold font-mono text-[#f0a050] mt-0.5">{fmt(borrowableEquity)}</div>
              </div>
            </div>

            {/* Simulated progress visualization gauge block */}
            <div className="w-full h-3 bg-[#1a1a1a] rounded-full overflow-hidden flex">
              <div 
                className="bg-[#ef4444] h-full" 
                style={{ width: `${Math.min(100, (primaryMortgage / homeValue) * 100)}%` }} 
                title="Primary Loan Percentage"
              />
              <div 
                className="bg-[#ef4444]/60 h-full border-l border-black" 
                style={{ width: `${Math.min(100, (helocBalance / homeValue) * 100)}%` }} 
                title="HELOC Utilization Percentage"
              />
              <div 
                className="bg-[#22c55e] h-full" 
                style={{ flexGrow: 1 }} 
                title="True Equity Realized"
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-[#555]">
              <span>DEBT: {((totalDebt / homeValue) * 100).toFixed(0)}%</span>
              <span>EQUITY: {((currentEquity / homeValue) * 100).toFixed(0)}%</span>
            </div>
          </div>

          {/* HELOC Optimization Simulator Engine */}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 space-y-4">
            <div className="text-xs text-[#555] font-mono uppercase tracking-wider">HELOC Paydown Simulator</div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-[#ccc] uppercase mb-1">Variable HELOC APR (%)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={helocRate} 
                  onChange={(e) => setHelocRate(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2 font-mono text-sm text-white focus:outline-none focus:border-[#f0a050]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#ccc] uppercase mb-1">Simulated Extra Principal Payment ($)</label>
                <input 
                  type="number" 
                  value={extraPayment} 
                  onChange={(e) => setExtraPayment(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2 font-mono text-sm text-white focus:outline-none focus:border-[#f0a050]"
                />
              </div>
            </div>

            {/* Interest savings result breakdown calculation block */}
            <div className="bg-black/50 border border-[#1a1a1a] rounded-lg p-3 space-y-2">
              <div className="text-xs font-mono text-[#555] uppercase">Simulated Savings Projections:</div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#ccc]">Monthly Interest Reduced:</span>
                <span className="font-mono text-sm font-bold text-[#22c55e]">{fmt(monthlyInterestSaved)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#ccc]">Immediate Annual Savings:</span>
                <span className="font-mono text-sm font-bold text-[#22c55e]">{fmt(yearlyInterestSaved)}</span>
              </div>
            </div>
          </div>

        </div>
      </PullToRefresh>

      {/* Floating Bottom Nav Fixed Element Outside Scroll Bounds */}
      <BottomNav active="more" />
    </div>
  );
}