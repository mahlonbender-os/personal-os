'use client';

import { useState, useMemo, useEffect } from 'react';
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
  // Financial metrics synced via your Sheets script
  balance?: number;
  limit?: number;
  usage?: number;
  multipliers: {
    dining: number;
    groceries: number;
    gas: number;
    travel: number;
    catchAll: number;
  };
  perks: string[];
}

// ── MAHLON'S AUTHENTIC PORTFOLIO (ALPHABETICAL ORDER) ───────────────────────
const INITIAL_CARDS: CreditCard[] = [
  {
    id: '1stfinancial',
    name: '1st Financial Card',
    bank: '1st Financial Bank',
    lastFour: '••••',
    bgClass: 'bg-gradient-to-br from-[#1e3a8a] to-[#0f172a] border border-[#2563eb]/20',
    textColorClass: 'text-white',
    metaColorClass: 'text-blue-400',
    multipliers: { dining: 1, groceries: 1, gas: 1, travel: 1, catchAll: 1 },
    perks: ['Standard line of credit protection', 'Custom repayment timeline vectors'],
  },
  {
    id: 'amex_bcp',
    name: 'Blue Cash Preferred',
    bank: 'American Express',
    lastFour: '••••',
    bgClass: 'bg-gradient-to-br from-[#0a2540] to-[#001020] border border-[#1e3a5f]',
    textColorClass: 'text-white',
    metaColorClass: 'text-sky-400',
    multipliers: { dining: 1, groceries: 6, gas: 3, travel: 1, catchAll: 1 },
    perks: ['6% on U.S. Supermarkets up to $6k/yr', '6% on Select U.S. Streaming', '3% on Transit (Uber, Tolls, Parking)'],
  },
  {
    id: 'capone_bjs',
    name: "BJ's One Mastercard",
    bank: 'Capital One',
    lastFour: '••••',
    bgClass: 'bg-gradient-to-br from-[#b91c1c] via-[#0f172a] to-[#0f172a] border border-[#dc2626]/20',
    textColorClass: 'text-white',
    metaColorClass: 'text-red-400',
    multipliers: { dining: 1.5, groceries: 1.5, gas: 1.5, travel: 1.5, catchAll: 1.5 },
    perks: ["3% back on most purchases inside BJ's Wholesale", '10¢ off per gallon at BJ\'s Gas stations permanently'],
  },
  {
    id: 'apple_gs',
    name: 'Apple Card',
    bank: 'Goldman Sachs',
    lastFour: '••••',
    bgClass: 'bg-gradient-to-br from-[#f5f5f7] via-[#ffffff] to-[#e8e8ed] border border-[#d1d5db]',
    textColorClass: 'text-black', // Clean high-contrast crisp text format
    metaColorClass: 'text-neutral-500',
    multipliers: { dining: 2, groceries: 1, gas: 1, travel: 1, catchAll: 2 },
    perks: ['2% Cash Back on all transactions using Apple Pay via phone', '3% back on Apple products and select merchants'],
  },
  {
    id: 'capone_savor',
    name: 'SavorOne Cash Rewards',
    bank: 'Capital One',
    lastFour: '••••',
    bgClass: 'bg-gradient-to-br from-[#7c2d12] to-[#1c1917] border border-[#ea580c]/20',
    textColorClass: 'text-white',
    metaColorClass: 'text-orange-400',
    multipliers: { dining: 3, groceries: 3, gas: 1, travel: 1, catchAll: 1 },
    perks: ['3% back on Dining, Entertainment, and Popular Streaming services', '8% back on Capital One Entertainment purchases'],
  },
  {
    id: 'chase_csp',
    name: 'Sapphire Preferred',
    bank: 'Chase',
    lastFour: '••••',
    bgClass: 'bg-gradient-to-br from-[#0284c7] via-[#0f172a] to-[#0f172a] border border-[#0369a1]/30',
    textColorClass: 'text-white',
    metaColorClass: 'text-sky-300',
    multipliers: { dining: 3, groceries: 1, gas: 1, travel: 2, catchAll: 1 },
    perks: ['Points worth 25% more when redeemed for Chase travel portal bookings', '1:1 point conversion transfer values across leading partner airlines'],
  },
];

export default function DigitalWalletPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'rates' | 'perks'>('rates');
  const [cards, setCards] = useState<CreditCard[]>(INITIAL_CARDS);

  // Read accounts summary from local storage populated by your Sheet loop
  useEffect(() => {
    try {
      const storedFinance = localStorage.getItem('cc_finance_v1');
      if (storedFinance) {
        const parsed = JSON.parse(storedFinance);
        // Map any spreadsheet cells matching your account names
        if (parsed.bills) {
          // If you have account rows mapped in sheets, we bind them down here
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const activeCategory = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return null;
    
    if (q.includes('eat') || q.includes('food') || q.includes('rest') || q.includes('din') || q.includes('bar') || q.includes('cafe') || q.includes('savor')) {
      return 'dining';
    }
    if (q.includes('groc') || q.includes('store') || q.includes('walm') || q.includes('super') || q.includes('bj') || q.includes('whole')) {
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

  const processedCards = useMemo(() => {
    if (!activeCategory) return cards; // Preserves strict Alphabetical base array setup
    return [...cards].sort((a, b) => b.multipliers[activeCategory] - a.multipliers[activeCategory]);
  }, [activeCategory, cards]);

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden text-white">
      
      {/* Fixed Sticky Header Panel */}
      <div className="pt-6 pb-4 px-4 bg-black border-b border-[#1a1a1a] z-30 flex-shrink-0">
        <button 
          onClick={() => router.push('/more')}
          className="text-[10px] text-[#555] font-bold tracking-wider uppercase mb-3 flex items-center gap-1 active:text-[#f0a050]"
        >
          ← System Core
        </button>
        
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: 'Syne, system-ui, sans-serif' }}>
              DIGITAL WALLET
            </h1>
            <p className="text-[10px] text-[#555] font-medium tracking-wider uppercase mt-0.5">
              Portfolio Optimization Loop
            </p>
          </div>

          {/* Core View Switcher Component */}
          <div className="bg-[#111] p-0.5 rounded-lg border border-[#1a1a1a] flex">
            <button
              onClick={() => setActiveTab('rates')}
              className={`px-3 py-1 text-[10px] font-bold tracking-wider uppercase rounded-md transition-all ${
                activeTab === 'rates' ? 'bg-[#f0a050] text-black' : 'text-[#555]'
              }`}
            >
              Rates
            </button>
            <button
              onClick={() => setActiveTab('perks')}
              className={`px-3 py-1 text-[10px] font-bold tracking-wider uppercase rounded-md transition-all ${
                activeTab === 'perks' ? 'bg-[#f0a050] text-black' : 'text-[#555]'
              }`}
            >
              Perks
            </button>
          </div>
        </div>

        {/* Dynamic Spend Parameter Search */}
        <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3 shadow-2xl">
          <input
            type="text"
            placeholder="Search spend category (e.g., Gas, Savor, Groceries)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white placeholder-[#444] focus:outline-none focus:border-[#f0a050] transition-colors font-medium"
          />
          {activeCategory && (
            <div className="mt-2 flex items-center justify-between text-[10px] bg-black border border-[#1a1a1a] px-2 py-1 rounded-md">
              <span className="text-[#555]">Active Spend Category:</span>
              <span className="text-[#f0a050] font-bold uppercase font-mono tracking-wider">
                {activeCategory === 'catchAll' ? 'Flat Base Rate' : activeCategory}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Container Viewport (Scrollable View) */}
      <div className="flex-1 overflow-y-auto pb-24">
        <PullToRefresh onRefresh={async () => { window.location.reload(); }}>
          <div className="p-4 space-y-4">
            <p className="text-[#444] text-[10px] font-bold uppercase tracking-widest px-1">
              {activeCategory ? '🔥 Optimized Recommendation Sequence' : 'Alpha Credit Portfolio'}
            </p>
            
            {processedCards.map((card, index) => {
              const SevernWinner = activeCategory && index === 0;
              const rate = activeCategory ? card.multipliers[activeCategory] : null;

              // Mock-Fallbacks for variables that will pull dynamically from your Sheet logic rows
              const balance = card.balance ?? 0;
              const limit = card.limit ?? 5000;
              const usage = card.limit ? Math.round((balance / card.limit) * 100) : 0;

              return (
                <div
                  key={card.id}
                  className={`rounded-2xl p-4 ${card.bgClass} relative overflow-hidden transition-all duration-300 ${card.textColorClass} ${
                    SevernWinner ? 'ring-2 ring-[#f0a050] scale-[1.01]' : searchQuery ? 'opacity-30' : ''
                  }`}
                >
                  {/* Dynamic Best Recommendation Badge */}
                  {SevernWinner && (
                    <div className="absolute top-0 right-0 bg-[#f0a050] text-black font-extrabold text-[9px] uppercase tracking-widest px-3 py-1 rounded-bl-xl font-mono shadow-md animate-pulse">
                      USE THIS CARD ({rate}%)
                    </div>
                  )}

                  {/* Card Title Details Block */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className={`text-[9px] font-bold uppercase tracking-wider ${card.metaColorClass}`}>
                        {card.bank}
                      </p>
                      <h2 className="text-sm font-extrabold tracking-tight mt-0.5">
                        {card.name}
                      </h2>
                    </div>
                    <span className="text-[10px] font-mono font-bold tracking-widest opacity-60">
                      {card.lastFour}
                    </span>
                  </div>

                  {/* Dynamic Google Sheets Operational Account Telemetry */}
                  <div className={`grid grid-cols-3 gap-2 px-3 py-2 rounded-xl mb-4 text-left text-[10px] border font-mono ${
                    card.id === 'apple_gs' ? 'bg-black/5 border-black/10' : 'bg-black/30 border-white/5'
                  }`}>
                    <div>
                      <div className="opacity-40 text-[8px] uppercase tracking-wider font-sans font-bold">Balance</div>
                      <div className="font-bold mt-0.5">${balance.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="opacity-40 text-[8px] uppercase tracking-wider font-sans font-bold">Available Credit</div>
                      <div className="opacity-80 mt-0.5">${limit.toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="opacity-40 text-[8px] uppercase tracking-wider font-sans font-bold">Usage</div>
                      <div className={`font-bold mt-0.5 ${usage > 30 ? 'text-red-500' : 'opacity-80'}`}>{usage}%</div>
                    </div>
                  </div>

                  {/* Tab Controlled Display Section */}
                  {activeTab === 'rates' ? (
                    /* Cash Back Rates Grid View */
                    <div className={`grid grid-cols-5 gap-1 pt-3 border-t text-center ${
                      card.id === 'apple_gs' ? 'border-black/10' : 'border-white/10'
                    }`}>
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
                  ) : (
                    /* Additional Perks Bullet Points View */
                    <div className={`pt-2 border-t text-[10px] space-y-1 opacity-80 ${
                      card.id === 'apple_gs' ? 'border-black/10' : 'border-white/10'
                    }`}>
                      {card.perks.map((perk, pIdx) => (
                        <div key={pIdx} className="flex items-start gap-1.5">
                          <span className="text-[#f0a050] font-bold select-none">•</span>
                          <p className="leading-tight">{perk}</p>
                        </div>
                      ))}
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