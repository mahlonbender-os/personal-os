'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PullToRefresh from '@/components/PullToRefresh';

interface CreditCard {
  id: string;
  name: string;
  bank: string;
  lastFour: string;
  bgClass: string;
  textColorClass: string;
  metaColorClass: string;
  multipliers: {
    dining: number;
    groceries: number;
    gas: number;
    travel: number;
    catchAll: number;
  };
  notes?: string;
}

// ── MAHLON'S ACTUAL CASH BACK PORTFOLIO ──────────────────────────────────────
const MY_CARDS: CreditCard[] = [
  {
    id: 'bcp',
    name: 'Blue Cash Preferred',
    bank: 'American Express',
    lastFour: '••••',
    bgClass: 'bg-gradient-to-br from-[#0a2540] to-[#001020] border border-[#1e3a5f]',
    textColorClass: 'text-white',
    metaColorClass: 'text-blue-400',
    multipliers: { dining: 1, groceries: 6, gas: 3, travel: 1, catchAll: 1 },
    notes: '6% Cash Back on Groceries, 3% on Gas stations',
  },
  {
    id: 'capone1',
    name: 'Capital One Card Alpha',
    bank: 'Capital One',
    lastFour: '••••',
    bgClass: 'bg-gradient-to-br from-[#031c33] to-[#010e1a] border border-[#0b3c5d]',
    textColorClass: 'text-white',
    metaColorClass: 'text-slate-400',
    multipliers: { dining: 3, groceries: 3, gas: 1, travel: 1, catchAll: 1.5 },
    notes: 'Cash back rewards tier',
  },
  {
    id: 'capone2',
    name: 'Capital One Card Beta',
    bank: 'Capital One',
    lastFour: '••••',
    bgClass: 'bg-gradient-to-br from-[#1c2833] to-[#111822] border border-[#2c3e50]',
    textColorClass: 'text-white',
    metaColorClass: 'text-slate-400',
    multipliers: { dining: 1, groceries: 1, gas: 1, travel: 5, catchAll: 1.5 },
    notes: 'Secondary cash back asset vector',
  },
  {
    id: 'apple',
    name: 'Apple Card',
    bank: 'Goldman Sachs',
    lastFour: '••••',
    bgClass: 'bg-gradient-to-br from-[#f5f5f7] via-[#ffffff] to-[#e8e8ed] border border-[#d1d5db]',
    textColorClass: 'text-black', // High-contrast crisp black text for readability
    metaColorClass: 'text-neutral-600',
    multipliers: { dining: 2, groceries: 1, gas: 1, travel: 1, catchAll: 2 },
    notes: '2% Cash Back explicitly via Apple Pay mobile transactions',
  },
];

export default function DigitalWalletPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const activeCategory = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return null;
    
    if (q.includes('eat') || q.includes('food') || q.includes('rest') || q.includes('din') || q.includes('bar') || q.includes('cafe')) {
      return 'dining';
    }
    if (q.includes('groc') || q.includes('store') || q.includes('walm') || q.includes('super') || q.includes('food')) {
      return 'groceries';
    }
    if (q.includes('gas') || q.includes('fuel') || q.includes('pump') || q.includes('exxon') || q.includes('shell') || q.includes('wawa')) {
      return 'gas';
    }
    if (q.includes('flight') || q.includes('hotel') || q.includes('air') || q.includes('trip') || q.includes('uber') || q.includes('stay')) {
      return 'travel';
    }
    return 'catchAll';
  }, [searchQuery]);

  const sortedCards = useMemo(() => {
    if (!activeCategory) return MY_CARDS;
    return [...MY_CARDS].sort((a, b) => b.multipliers[activeCategory] - a.multipliers[activeCategory]);
  }, [activeCategory]);

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden text-white">
      
      {/* Sticky Top Header Block (Stays Fixed on Scroll) */}
      <div className="pt-6 pb-4 px-4 bg-black border-b border-[#1a1a1a] z-30 flex-shrink-0">
        <button 
          onClick={() => router.push('/more')}
          className="text-[10px] text-[#555] font-bold tracking-wider uppercase mb-3 flex items-center gap-1 active:text-[#f0a050]"
        >
          ← System Core
        </button>
        
        <div className="mb-4">
          <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: 'Syne, system-ui, sans-serif' }}>
            DIGITAL WALLET
          </h1>
          <p className="text-[10px] text-[#555] font-medium tracking-wider uppercase mt-0.5">
            Cashback Optimization Matrix
          </p>
        </div>

        {/* Dynamic Lookup Bar */}
        <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3 shadow-2xl">
          <input
            type="text"
            placeholder="Where are you shopping? (e.g., Gas, Dining)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white placeholder-[#444] focus:outline-none focus:border-[#f0a050] transition-colors font-medium"
          />
          {activeCategory && (
            <div className="mt-2 flex items-center justify-between text-[10px] bg-black border border-[#1a1a1a] px-2 py-1 rounded-md">
              <span className="text-[#555]">Active Spend Vector:</span>
              <span className="text-[#f0a050] font-bold uppercase font-mono tracking-wider">
                {activeCategory === 'catchAll' ? 'Flat Base (Catch-All)' : activeCategory}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Card Stack Area */}
      <div className="flex-1 overflow-y-auto pb-24">
        <PullToRefresh onRefresh={async () => { window.location.reload(); }}>
          <div className="p-4 space-y-4">
            <p className="text-[#444] text-[10px] font-bold uppercase tracking-widest px-1">
              {activeCategory ? '🔥 Optimized Best Strategy' : 'Card Inventory Stack'}
            </p>
            
            {sortedCards.map((card, index) => {
              const isWinner = activeCategory && index === 0;
              const rate = activeCategory ? card.multipliers[activeCategory] : null;

              return (
                <div
                  key={card.id}
                  className={`rounded-2xl p-4 ${card.bgClass} relative overflow-hidden transition-all duration-300 ${card.textColorClass} ${
                    isWinner ? 'ring-2 ring-[#f0a050] scale-[1.01]' : searchQuery ? 'opacity-30' : ''
                  }`}
                >
                  {/* Winner Badge Notification */}
                  {isWinner && (
                    <div className="absolute top-0 right-0 bg-[#f0a050] text-black font-extrabold text-[9px] uppercase tracking-widest px-3 py-1 rounded-bl-xl font-mono shadow-md animate-pulse">
                      SWIPE THIS ({rate}%)
                    </div>
                  )}

                  {/* Top Header Card Data */}
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className={`text-[9px] font-bold uppercase tracking-wider ${card.metaColorClass}`}>
                        {card.bank}
                      </p>
                      <h2 className="text-sm font-extrabold tracking-tight mt-0.5">
                        {card.name}
                      </h2>
                    </div>
                    <span className={`text-[10px] font-mono font-bold tracking-widest opacity-60`}>
                      {card.lastFour}
                    </span>
                  </div>

                  {/* Cash Back Multipliers Row */}
                  <div className={`grid grid-cols-5 gap-1 pt-3 border-t text-center ${card.id === 'apple' ? 'border-black/10' : 'border-white/10'}`}>
                    {[
                      { l: 'DINING', v: card.multipliers.dining, key: 'dining' },
                      { l: 'GROC', v: card.multipliers.groceries, key: 'groceries' },
                      { l: 'GAS', v: card.multipliers.gas, key: 'gas' },
                      { l: 'TRAVEL', v: card.multipliers.travel, key: 'travel' },
                      { l: 'BASE', v: card.multipliers.catchAll, key: 'catchAll' },
                    ].map((m) => {
                      const isTargetField = activeCategory === m.key;
                      return (
                        <div 
                          key={m.l} 
                          className={`py-1 rounded-md transition-colors ${
                            isTargetField ? 'bg-[#f0a050]/20 border border-[#f0a050]/30' : ''
                          }`}
                        >
                          <div className="text-[8px] font-bold tracking-tighter opacity-40">{m.l}</div>
                          <div className={`text-xs font-extrabold font-mono mt-0.5 ${isTargetField ? 'text-[#f0a050]' : ''}`}>
                            {m.v}%
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* User Rules Footer Notes */}
                  {card.notes && (
                    <div className={`mt-3 text-[9px] opacity-40 italic border-t pt-2 ${card.id === 'apple' ? 'border-black/5' : 'border-white/5'}`}>
                      {card.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </PullToRefresh>
      </div>

    </div>
  );
}