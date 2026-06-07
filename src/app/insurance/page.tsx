'use client';

import { useState, useEffect } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import BottomNav from '@/components/BottomNav';

const TABS = ['Active Policies', 'Coverage Stats'];
const POLICY_TYPES = ['Auto', 'Home', 'Health', 'Umbrella', 'Other'];

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function renewalStatus(date: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const renewal = new Date(date); renewal.setHours(0, 0, 0, 0);
  const days = Math.ceil((renewal.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: 'EXPIRED', color: 'text-[#ef4444] border-[#ef4444]' };
  if (days <= 45) return { label: `${days} DAYS LEFT`, color: 'text-[#f0a050] border-[#f0a050]' };
  return { label: 'SECURE', color: 'text-[#22c55e] border-[#1a1a1a]' };
}

export default function InsurancePage() {
  const [activeTab, setActiveTab] = useState(0);
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form fields
  const [provider, setProvider] = useState('');
  const [policyType, setPolicyType] = useState('Auto');
  const [premium, setPremium] = useState('');
  const [renewalDate, setRenewalDate] = useState('');
  const [notes, setNotes] = useState('');

  async function fetchPolicies() {
    try {
      const res = await fetch('/api/insurance');
      if (res.ok) {
        const data = await res.json();
        setPolicies(data);
        localStorage.setItem('insurance-data', JSON.stringify(data));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const cached = localStorage.getItem('insurance-data');
    if (cached) { setPolicies(JSON.parse(cached)); setLoading(false); }
    fetchPolicies();
  }, []);

  async function savePolicy() {
    try {
      const res = await fetch('/api/insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, policy_type: policyType, premium, renewal_date: renewalDate, notes }),
      });
      if (res.ok) {
        setShowAdd(false);
        setProvider(''); setPolicyType('Auto'); setPremium(''); setRenewalDate(''); setNotes('');
        fetchPolicies();
      }
    } catch (err) { console.error(err); }
  }

  async function deletePolicy(id: string) {
    try {
      const res = await fetch(`/api/insurance?id=${id}`, { method: 'DELETE' });
      if (res.ok) { setDeleteId(null); fetchPolicies(); }
    } catch (err) { console.error(err); }
  }

  const totalPremium = policies.reduce((sum, p) => sum + Number(p.premium), 0);

  return (
    <div className="min-h-screen bg-black text-white pb-24">

      {/* Tab bar */}
      <div className="flex border-b border-[#1a1a1a] sticky top-0 bg-black z-10">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(i); window.scrollTo(0, 0); navigator.vibrate && navigator.vibrate(8); }}
            className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === i ? 'text-[#f0a050] border-b-2 border-[#f0a050]' : 'text-[#555]'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <PullToRefresh onRefresh={fetchPolicies}>

        {/* ─── ACTIVE POLICIES TAB ─────────────────────────────────── */}
        {activeTab === 0 && (
          <div className="px-4 pt-4 space-y-3">
            {/* Tab header row — button lives here, no FAB */}
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold">Active Policies</p>
              <button onClick={() => setShowAdd(true)} className="text-[#f0a050] text-sm font-semibold">+ Policy</button>
            </div>

            {loading && policies.length === 0 ? (
              <p className="text-sm text-[#555] font-mono">Loading active policies...</p>
            ) : policies.length === 0 ? (
              <p className="text-sm text-[#555] font-mono">No active policies logged.</p>
            ) : (
              policies.map(policy => {
                const status = renewalStatus(policy.renewal_date);
                return (
                  <div key={policy.id} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-[#1c1c1e] text-[#f0a050] border border-[#1a1a1a] px-2 py-0.5 rounded-md font-mono font-bold uppercase">
                            {policy.policy_type}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${status.color.split(' ')[0]}`}>
                            {status.label}
                          </span>
                        </div>
                        <h3 className="font-semibold text-base text-white mt-2">{policy.provider}</h3>
                      </div>
                      <button onClick={() => setDeleteId(policy.id)} className="text-[#555] hover:text-[#ef4444] p-1">✕</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-[#1a1a1a]/50 text-xs font-mono">
                      <div>
                        <span className="text-[#555] block uppercase text-[10px]">Premium</span>
                        <span className="text-white font-bold">{fmtCurrency(policy.premium)}</span>
                      </div>
                      <div>
                        <span className="text-[#555] block uppercase text-[10px]">Renewal Date</span>
                        <span className={`font-bold ${status.color.split(' ')[0]}`}>{policy.renewal_date}</span>
                      </div>
                    </div>
                    {policy.notes && (
                      <div className="mt-3 bg-black/40 p-2 rounded text-xs text-[#ccc] border-l-2 border-[#f0a050] whitespace-pre-wrap">
                        {policy.notes}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ─── COVERAGE STATS TAB ──────────────────────────────────── */}
        {activeTab === 1 && (
          <div className="px-4 pt-4 space-y-4">
            <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 text-center">
              <span className="text-[#555] uppercase font-mono text-[11px] tracking-wider block">Total Premium Committed</span>
              <span className="text-3xl font-bold font-mono text-[#f0a050] mt-2 block">{fmtCurrency(totalPremium)}</span>
            </div>
            <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
              <h4 className="text-xs uppercase text-[#555] font-mono tracking-wider mb-3 border-b border-[#1a1a1a] pb-2">
                Asset Safeguard Distribution
              </h4>
              <div className="space-y-2.5 font-mono text-xs">
                {['Auto', 'Home', 'Health', 'Umbrella', 'Other'].map(type => {
                  const total = policies.filter(p => p.policy_type === type).reduce((s, p) => s + Number(p.premium), 0);
                  if (total === 0) return null;
                  return (
                    <div key={type} className="flex justify-between items-center py-1">
                      <span className="text-[#ccc]">{type} Policy</span>
                      <span className="text-white font-bold">{fmtCurrency(total)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </PullToRefresh>

      {/* ═══════════════════════════════════════════════════════
          MODALS
      ═══════════════════════════════════════════════════════ */}

      {/* Add Insurance modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6 border border-[#1a1a1a]">
            <h2 className="text-xl font-bold font-mono text-[#f0a050] mb-4 uppercase tracking-wide">Add Insurance</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Provider *</label>
                <input
                  type="text"
                  value={provider}
                  onChange={e => setProvider(e.target.value)}
                  placeholder="e.g., Progressive, State Farm"
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Policy Type *</label>
                <select
                  value={policyType}
                  onChange={e => setPolicyType(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                >
                  <option value="Auto">Auto Insurance</option>
                  <option value="Home">Home Insurance</option>
                  <option value="Health">Health Insurance</option>
                  <option value="Umbrella">Umbrella Policy</option>
                  <option value="Other">Other Coverage</option>
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Premium Amount ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={premium}
                  onChange={e => setPremium(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2.5 text-sm text-white font-mono focus:outline-none focus:border-[#f0a050]"
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Renewal Date *</label>
                <input
                  type="date"
                  value={renewalDate}
                  onChange={e => setRenewalDate(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#f0a050]"
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Coverage Notes</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Policy numbers, coverage limitations, deductible notes..."
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAdd(false)}
                  className="flex-1 bg-black border border-[#1a1a1a] text-[#555] py-3 rounded-xl font-semibold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={savePolicy}
                  className="flex-1 bg-[#f0a050] text-black py-3 rounded-xl font-semibold text-sm transition-colors"
                >
                  Save Policy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md p-5 border border-[#1a1a1a]">
            <h3 className="text-md font-bold text-white text-center">Delete this policy record?</h3>
            <p className="text-xs text-[#555] text-center mt-1">This action cannot be undone.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeleteId(null)} className="flex-1 bg-black border border-[#1a1a1a] text-white py-3 rounded-xl text-sm font-semibold">Keep</button>
              <button onClick={() => deletePolicy(deleteId)} className="flex-1 bg-[#ef4444] text-white py-3 rounded-xl text-sm font-semibold">Delete</button>
            </div>
          </div>
        </div>
      )}

      <BottomNav active="more" />
    </div>
  );
}