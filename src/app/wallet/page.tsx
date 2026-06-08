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
  sheetName: string; // exact name as it appears in Accounts tab column B
  multipliers: {
    dining: number;
    groceries: number;
    gas: number;
    travel: number;
    catchAll: number;
  };
  perks: string[];
}

const CORE_CARDS: CreditCard[] = [
  {
    id: '1stfinancial',
    name: '1st Financial Card',
    bank: '1st Financial Bank',
    lastFour: '••••',
    bgClass: 'bg-gradient-to-br from-[#1e3a8a] to-[#0f172a] border border-[#2563eb]/20',
    textColorClass: 'text-white',
    metaColorClass: 'text-blue-400',
    sheetName: '1stFinancial',
    multipliers: { dining: 1, groceries: 1, gas: 1, travel: 1, catchAll: 1 },
    perks: ['Standard personal line credit protection framework'],
  },
  {
    id: 'apple_gs',
    name: 'Apple Card',
    bank: 'Goldman Sachs',
    lastFour: '••••',
    bgClass: 'bg-gradient-to-br from-[#f5f5f7] via-[#ffffff] to-[#e8e8ed] border border-[#d1d5db]',
    textColorClass: 'text-black',
    metaColorClass: 'text-neutral-500',
    sheetName: 'Apple',
    multipliers: { dining: 2, groceries: 1, gas: 1, travel: 1, catchAll: 2 },
    perks: ['2% Cash Back on all purchases via Apple Pay on iPhone', '3% back on Apple store & select merchants'],
  },
  {
    id: 'amex_bcp',
    name: 'Blue Cash Preferred',
    bank: 'American Express',
    lastFour: '••••',
    bgClass: 'bg-gradient-to-br from-[#0a2540] to-[#001020] border border-[#1e3a5f]',
    textColorClass: 'text-white',
    metaColorClass: 'text-sky-400',
    sheetName: 'American Express Blue Cash Preferred',
    multipliers: { dining: 1, groceries: 6, gas: 3, travel: 1, catchAll: 1 },
    perks: ['6% Cash Back on U.S. Supermarkets up to $6k/yr', '6% on Select U.S. Streaming services', '3% on Transit (Uber, Tolls, Parking)'],
  },
  {
    id: 'capone_bjs',
    name: "BJ's One Mastercard",
    bank: 'Capital One',
    lastFour: '••••',
    bgClass: 'bg-gradient-to-br from-[#b91c1c] via-[#0f172a] to-[#0f172a] border border-[#dc2626]/20',
    textColorClass: 'text-white',
    metaColorClass: 'text-red-400',
    sheetName: "Capital One BJ's",
    multipliers: { dining: 1.5, groceries: 1.5, gas: 1.5, travel: 1.5, catchAll: 1.5 },
    perks: ["15¢ off per gallon at BJ's Gas stations permanently", "3% back on purchases inside BJ's Wholesale store"],
  },
  {
    id: 'capone_savor',
    name: 'SavorOne Cash Rewards',
    bank: 'Capital One',
    lastFour: '••••',
    bgClass: 'bg-gradient-to-br from-[#7c2d12] to-[#1c1917] border border-[#ea580c]/20',
    textColorClass: 'text-white',
    metaColorClass: 'text-orange-400',
    sheetName: 'Capital One Savor',
    multipliers: { dining: 3, groceries: 3, gas: 1, travel: 1, catchAll: 1 },
    perks: ['3% back on Dining, Entertainment, and Popular Streaming services', '8% back on Capital One Entertainment tickets'],
  },
  {
    id: 'chase_csp',
    name: 'Sapphire Preferred',
    bank: 'Chase',
    lastFour: '••••',
    bgClass: 'bg-gradient-to-br from-[#0284c7] via-[#0f172a] to-[#0f172a] border border-[#0369a1]/30',
    textColorClass: 'text-white',
    metaColorClass: 'text-sky-300',
    sheetName: 'Chase Sapphire Preferred',
    multipliers: { dining: 3, groceries: 1, gas: 1, travel: 2, catchAll: 1 },
    perks: ['Points worth 25% more via Chase travel portal', '1:1 point transfers to partner airlines & hotels'],
  },
];

const CACHE_KEY = 'wallet-accounts-v1';

export default function DigitalWalletPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'rates' | 'perks'>('rates');
  const [accountData, setAccountData] = useState<Record<string, { balance: number; limit: number }>>({});
  const [loading, setLoading] = useState(true);

  async function fetchAccounts() {
    try {
      const res = await fetch('/api/finance/accounts');
      if (!res.ok) return;
      const json = await res.json();
      const map: Record<string, { balance: number; limit: number }> = {};
      for (const card of CORE_CARDS) {
        const match = json.accounts?.find((a: any) =>
          a.name.toLowerCase().trim() === card.sheetName.toLowerCase().trim()
        );
        if (match) {
          map[card.id] = { balance: match.balance, limit: match.limit };
        }
      }
      setAccountData(map);
      localStorage.setItem(CACHE_KEY, JSON.stringify(map));
    } catch (e) {
      console.error('Wallet fetch error:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try { setAccountData(JSON.parse(cached)); } catch {}
    }
    fetchAccounts();
  }, []);

  const activeCategory = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return null;
    if (q.includes('eat') || q.includes('food') || q.includes('rest') || q.includes('din') || q.includes('bar') || q.includes('cafe') || q.includes('savor')) return 'dining';
    if (q.includes('groc') || q.includes('store') || q.includes('walm') || q.includes('super') || q.includes('bj') || q.includes('whole')) return 'groceries';
    if (q.includes('gas') || q.includes('fuel') || q.includes('pump') || q.includes('exxon') || q.includes('shell') || q.includes('wawa')) return 'gas';
    if (q.includes('flight') || q.includes('hotel') || q.includes('air') || q.includes('trip') || q.includes('uber') || q.includes('stay') || q.includes('travel')) return 'travel';
    return 'catchAll';
  }, [searchQuery]);

  const processedCards = useMemo(() => {
    if (!activeCategory) return CORE_CARDS;
    return [...CORE_CARDS].sort((a, b) => b.multipliers[activeCategory as keyof typeof a.multipliers] - a.multipliers[activeCategory as keyof typeof a.multipliers]);
  }, [activeCategory]);

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden text-white">

      {/* Header */}
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

          <div className="bg-[#111] p-0.5 rounded-lg border border-[#1a1a1a] flex">
            <button
              onClick={() => setActiveTab('rates')}
              className={`px-3 py-1 text-[10px] font-bold tracking-wider uppercase rounded-md transition-all ${activeTab === 'rates' ? 'bg-[#f0a050] text-black' : 'text-[#555]'}`}
            >
              Rates
            </button>
            <button
              onClick={() => setActiveTab('perks')}
              className={`px-3 py-1 text-[10px] font-bold tracking-wider uppercase rounded-md transition-all ${activeTab === 'perks' ? 'bg-[#f0a050] text-black' : 'text-[#555]'}`}
            >
              Perks
            </button>
          </div>
        </div>

        <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3 shadow-2xl">
          <input
            type="text"
            placeholder="Search spend category (e.g., Gas, Groceries, Dining)..."
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

      {/* Cards */}
      <div className="flex-1 overflow-y-auto pb-24">
        <PullToRefresh onRefresh={fetchAccounts}>
          <div className="p-4 space-y-4">
            <p className="text-[#444] text-[10px] font-bold uppercase tracking-widest px-1">
              {activeCategory ? '🔥 Optimized Recommendation Sequence' : 'Alpha Credit Portfolio'}
            </p>

            {processedCards.map((card, index) => {
              const isWinner = activeCategory && index === 0;
              const rate = activeCategory ? card.multipliers[activeCategory as keyof typeof card.multipliers] : null;
              const acct = accountData[card.id];
              const balance = acct?.balance ?? 0;
              const limit = acct?.limit ?? 0;
              const usagePct = limit > 0 ? ((balance / limit) * 100) : 0;
              const usageStr = limit > 0 ? usagePct.toFixed(2) : '—';
              const usageHigh = usagePct > 30;

              return (
                <div
                  key={card.id}
                  className={`rounded-2xl p-4 ${card.bgClass} relative overflow-hidden transition-all duration-300 ${card.textColorClass} ${
                    isWinner ? 'ring-2 ring-[#f0a050] scale-[1.01]' : searchQuery && !isWinner ? 'opacity-30' : ''
                  }`}
                >
                  {isWinner && (
                    <div className="absolute top-0 right-0 bg-[#f0a050] text-black font-extrabold text-[9px] uppercase tracking-widest px-3 py-1 rounded-bl-xl font-mono shadow-md animate-pulse">
                      USE THIS CARD ({rate}%)
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className={`text-[9px] font-bold uppercase tracking-wider ${card.metaColorClass}`}>{card.bank}</p>
                      <h2 className="text-sm font-extrabold tracking-tight mt-0.5">{card.name}</h2>
                    </div>
                    <span className="text-[10px] font-mono font-bold tracking-widest opacity-60">{card.lastFour}</span>
                  </div>

                  {/* Balance / Limit / Usage */}
                  <div className={`grid grid-cols-3 gap-2 px-3 py-2 rounded-xl mb-4 text-left text-[10px] border border-dashed font-mono ${
                    card.id === 'apple_gs' ? 'bg-black/5 border-black/20' : 'bg-black/30 border-white/10'
                  }`}>
                    <div>
                      <div className="opacity-40 text-[8px] uppercase tracking-wider font-sans font-bold">Balance</div>
                      <div className="font-bold mt-0.5">
                        {loading && !accountData[card.id]
                          ? <span className="opacity-30">—</span>
                          : `$${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        }
                      </div>
                    </div>
                    <div>
                      <div className="opacity-40 text-[8px] uppercase tracking-wider font-sans font-bold">Credit Limit</div>
                      <div className="opacity-80 mt-0.5">
                        {limit > 0 ? `$${limit.toLocaleString()}` : <span className="opacity-30">—</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="opacity-40 text-[8px] uppercase tracking-wider font-sans font-bold">Usage</div>
                      <div className={`font-bold mt-0.5 ${usageHigh ? 'text-red-500 font-extrabold' : 'opacity-80'}`}>
                        {usageStr}{limit > 0 ? '%' : ''}
                      </div>
                    </div>
                  </div>

                  {activeTab === 'rates' ? (
                    <div className={`grid grid-cols-5 gap-1 pt-3 border-t text-center ${
                      card.id === 'apple_gs' ? 'border-black/10' : 'border-white/10'
                    }`}>
                      {[
                        { l: 'DINING', key: 'dining' },
                        { l: 'GROC', key: 'groceries' },
                        { l: 'GAS', key: 'gas' },
                        { l: 'TRAVEL', key: 'travel' },
                        { l: 'BASE', key: 'catchAll' },
                      ].map((m) => {
                        const v = card.multipliers[m.key as keyof typeof card.multipliers];
                        const isTarget = activeCategory === m.key;
                        return (
                          <div key={m.l} className={`py-1 rounded-md transition-colors ${isTarget ? 'bg-[#f0a050]/20 border border-[#f0a050]/30' : ''}`}>
                            <div className="text-[8px] font-bold tracking-tighter opacity-40">{m.l}</div>
                            <div className={`text-xs font-extrabold font-mono mt-0.5 ${isTarget ? 'text-[#f0a050]' : ''}`}>
                              {v}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={`pt-2 border-t text-[10px] space-y-1 opacity-80 ${
                      card.id === 'apple_gs' ? 'border-black/10' : 'border-white/10'
                    }`}>
                      {card.perks.map((perk, i) => (
                        <div key={i} className="flex items-start gap-1.5">
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