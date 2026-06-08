'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PullToRefresh from '@/components/PullToRefresh';

interface CreditCard {
  id: string;
  name: string;
  bank: string;
  lastFour: string;
  bgClass: string; // Tailwind styling mix
  textColor: string;
  multipliers: {
    dining: number;
    groceries: number;
    gas: number;
    travel: number;
    catchAll: number;
  };
  notes?: string;
}

// ── HARDCODED CARD STACK ─────────────────────────────────────────────────────
// Customize the lastFour, names, or values here to match your exact portfolio!
const MY_CARDS: CreditCard[] = [
  {
    id: 'bcp',
    name: 'Blue Cash Preferred',
    bank: 'American Express',
    lastFour: '1004',
    bgClass: 'bg-gradient-to-br from-[#0a2540] to-[#001020] border border-[#1e3a5f]',
    textColor: 'text-blue-400',
    multipliers: { dining: 1, groceries: 6, gas: 3, travel: 1, catchAll: 1 },
    notes: '6% Groceries cap at $6k/yr, 3% Gas stations',
  },
  {
    id: 'csr',
    name: 'Sapphire Reserve',
    bank: 'Chase',
    lastFour: '8821',
    bgClass: 'bg-gradient-to-br from-[#111827] via-[#1f2937] to-[#111827] border border-[#374151]',
    textColor: 'text-slate-200',
    multipliers: { dining: 3, groceries: 1, gas: 1, travel: 3, catchAll: 1 },
    notes: 'Points worth 1.5x on Chase Travel portal',
  },
  {
    id: 'bofaw',
    name: 'Customized Cash',
    bank: 'Bank of America',
    lastFour: '4590',
    bgClass: 'bg-gradient-to-br from-[#b91c1c] to-[#7f1d1d] border border-[#dc2626]/30',
    textColor: 'text-red-200',
    multipliers: { dining: 1, groceries: 2, gas: 3, travel: 1, catchAll: 1 },
    notes: '3% category set permanently to Gas/Fleet fill-ups',
  },
  {
    id: 'apple',
    name: 'Apple Card',
    bank: 'Goldman Sachs',
    lastFour: '9982',
    bgClass: 'bg-gradient-to-br from-[#f3f4f6] via-[#ffffff] to-[#e5e7eb] border border-[#d1d5db]',
    textColor: 'text-black',
    multipliers: { dining: 2, groceries: 1, gas: 1, travel: 1, catchAll: 2 },
    notes: '2% back strictly via Apple Pay transactions',
  },
];

export default function DigitalWalletPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  // Determine the best spending category based on what you type
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

  // Sort portfolio instantly to bring the highest-yielding option to the peak
  const sortedCards = useMemo(() => {
    if (!activeCategory) return MY_CARDS;
    return [...MY_CARDS].sort((a, b) => b.multipliers[activeCategory] - a.multipliers[activeCategory]);
  }, [activeCategory]);

  return (
    <div className="min-h-screen bg-black text-white">
      <PullToRefresh onRefresh={async () => { window.location.reload(); }}>
        <div className="px-4 pt-6 pb-24">
          
          {/* Back Layout Navigation */}
          <button 
            onClick={() => router.push('/more')}
            className="text-xs text-[#555] font-semibold tracking-wider uppercase mb-4 flex items-center gap-1 active:text-[#f0a050]"
          >
            ← System Core
          </button>

          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Syne, system-ui, sans-serif' }}>
              Digital Wallet
            </h1>
            <p className="text-[#555] text-sm mt-0.5">Cashback Matrix & Optimization</p>
          </div>

          {/* Sticky Quick-Lookup Checkout Optimizer */}
          <div className="mb-6 bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 sticky top-2 z-20 shadow-xl shadow-black/80">
            <label className="block text-[10px] font-bold text-[#444] uppercase tracking-widest mb-2">
              Checkout lookup
            </label>
            <input
              type="text"
              placeholder="Where are you spending? (e.g., Gas, Dining, Exxon)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#f0a050] transition-colors"
            />
            {activeCategory && (
              <div className="mt-3 flex items-center justify-between text-xs bg-black border border-[#1a1a1a] px-3 py-2 rounded-xl">
                <span className="text-[#555]">Detected Core Vector:</span>
                <span className="text-[#f0a050] font-bold uppercase font-mono tracking-wider">
                  {activeCategory === 'catchAll' ? 'Flat Catch-All (2% base)' : activeCategory}
                </span>
              </div>
            )}
          </div>

          {/* Credit Card Stack Grid */}
          <div className="space-y-4">
            <p className="text-[#555] text-xs font-semibold uppercase tracking-wider px-1">
              {activeCategory ? '🔥 Optimized Recommendation Strategy' : 'Card Inventory Stack'}
            </p>
            
            {sortedCards.map((card, index) => {
              const isWinner = activeCategory && index === 0;
              const rate = activeCategory ? card.multipliers[activeCategory] : null;

              return (
                <div
                  key={card.id}
                  className={`rounded-2xl p-5 ${card.bgClass} relative overflow-hidden transition-all duration-300 ${
                    isWinner ? 'ring-2 ring-[#f0a050] scale-[1.01]' : searchQuery ? 'opacity-40' : ''
                  }`}
                >
                  {/* Visual Glow Layer for Winning Recommendation */}
                  {isWinner && (
                    <div className="absolute top-0 right-0 bg-[#f0a050] text-black font-extrabold text-[9px] uppercase tracking-widest px-3 py-1 rounded-bl-xl font-mono shadow-md animate-pulse">
                      USE THIS CARD ({rate}x)
                    </div>
                  )}

                  {/* Top Meta Info */}
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 filter contrast-125">
                        {card.bank}
                      </p>
                      <h2 className="text-base font-extrabold tracking-tight mt-0.5">
                        {card.name}
                      </h2>
                    </div>
                    <span className="text-xs font-mono font-bold tracking-widest opacity-80">
                      •••• {card.lastFour}
                    </span>
                  </div>

                  {/* Multiplier Rows Footer */}
                  <div className="grid grid-cols-5 gap-1 pt-3 border-t border-white/10 text-center">
                    {[
                      { l: 'DIN', v: card.multipliers.dining, key: 'dining' },
                      { l: 'GROC', v: card.multipliers.groceries, key: 'groceries' },
                      { l: 'GAS', v: card.multipliers.gas, key: 'gas' },
                      { l: 'TRAV', v: card.multipliers.travel, key: 'travel' },
                      { l: 'BASE', v: card.multipliers.catchAll, key: 'catchAll' },
                    ].map((m) => {
                      const isTargetField = activeCategory === m.key;
                      return (
                        <div 
                          key={m.l} 
                          className={`py-1 rounded-lg transition-colors ${
                            isTargetField ? 'bg-[#f0a050]/20 border border-[#f0a050]/30' : ''
                          }`}
                        >
                          <div className={`text-[9px] font-medium tracking-tighter opacity-50`}>{m.l}</div>
                          <div className={`text-xs font-extrabold font-mono mt-0.5 ${isTargetField ? 'text-[#f0a050]' : ''}`}>
                            {m.v}x
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Dynamic Notes */}
                  {card.notes && (
                    <div className="mt-3 text-[10px] opacity-40 italic border-t border-white/5 pt-2">
                      {card.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </PullToRefresh>
    </div>
  );
}