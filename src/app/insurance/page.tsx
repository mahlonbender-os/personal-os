'use client';

import { useState, useEffect } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import BottomNav from '@/components/BottomNav';

interface InsurancePolicy {
  id: string;
  provider: string;
  policy_type: string;
  premium: number;
  renewal_date: string;
  notes: string | null;
}

const TABS = ['Active Policies', 'Coverage Stats'];

export default function InsurancePage() {
  const [activeTab, setActiveTab] = useState(0);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form States
  const [provider, setProvider] = useState('');
  const [policyType, setPolicyType] = useState('Auto');
  const [premium, setPremium] = useState('');
  const [renewalDate, setRenewalDate] = useState('');
  const [notes, setNotes] = useState('');

  const fetchPolicies = async () => {
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
  };

  useEffect(() => {
    const cached = localStorage.getItem('insurance-data');
    if (cached) {
      setPolicies(JSON.parse(cached));
      setLoading(false);
    }
    fetchPolicies();
  }, []);

  const handleRefresh = async () => {
    await fetchPolicies();
  };

  const handleSubmit = async () => {
    try {
      const res = await fetch('/api/insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          policy_type: policyType,
          premium,
          renewal_date: renewalDate,
          notes
        })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setProvider('');
        setPolicyType('Auto');
        setPremium('');
        setRenewalDate('');
        setNotes('');
        fetchPolicies();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/insurance?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirmId(null);
        fetchPolicies();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getRenewalStatus = (dateStr: string) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const renewal = new Date(dateStr);
    renewal.setHours(0,0,0,0);

    const diffTime = renewal.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: 'EXPIRED', color: 'text-[#ef4444] border-[#ef4444]' };
    if (diffDays <= 45) return { label: `${diffDays} DAYS LEFT`, color: 'text-[#f0a050] border-[#f0a050]' };
    return { label: 'SECURE', color: 'text-[#22c55e] border-[#1a1a1a]' };
  };

  const totalAnnualPremium = policies.reduce((sum, p) => sum + Number(p.premium), 0);

  return (
    <>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="min-h-screen bg-black text-white pb-24">
          
          {/* Sticky context header row perfectly matching Knox and Investments template */}
          <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-[#1a1a1a]">
            <div className="flex items-center justify-between px-4 pt-14 pb-3">
              <div>
                <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, system-ui, sans-serif' }}>
                  Insurance
                </h1>
                <p className="text-[10px] text-[#555] mt-0.5">
                  {policies.length} Active Policies Safeguarded
                </p>
              </div>

              {/* Context header action link button */}
              <button
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(8);
                  setRenewalDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' }));
                  setIsModalOpen(true);
                }}
                className="text-sm font-semibold text-[#f0a050] active:opacity-70 transition-opacity px-2 py-1"
              >
                Add Policy
              </button>
            </div>

            {/* Tab switcher bar */}
            <div className="flex border-t border-[#1a1a1a]">
              {TABS.map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(i); window.scrollTo(0,0); if (navigator.vibrate) navigator.vibrate(8); }}
                  className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    activeTab === i ? 'text-[#f0a050] border-b-2 border-[#f0a050]' : 'text-[#555]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Tab 0: Active Policies List */}
          {activeTab === 0 && (
            <div className="px-4 pt-4 space-y-3">
              {loading && policies.length === 0 ? (
                <p className="text-sm text-[#555] font-mono">Loading active policies...</p>
              ) : policies.length === 0 ? (
                <p className="text-sm text-[#555] font-mono">No active policies logged.</p>
              ) : (
                policies.map((p) => {
                  const status = getRenewalStatus(p.renewal_date);
                  return (
                    <div 
                      key={p.id} 
                      className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 transition-all"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-[#1c1c1e] text-[#f0a050] border border-[#1a1a1a] px-2 py-0.5 rounded-md font-mono font-bold uppercase">
                              {p.policy_type}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${status.color.split(' ')[0]}`}>
                              {status.label}
                            </span>
                          </div>
                          <h3 className="font-semibold text-base text-white mt-2">{p.provider}</h3>
                        </div>
                        <button 
                          onClick={() => setDeleteConfirmId(p.id)}
                          className="text-[#555] hover:text-[#ef4444] p-1"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-[#1a1a1a]/50 text-xs font-mono">
                        <div>
                          <span className="text-[#555] block uppercase text-[10px]">Premium</span>
                          <span className="text-white font-bold">{formatCurrency(p.premium)}</span>
                        </div>
                        <div>
                          <span className="text-[#555] block uppercase text-[10px]">Renewal Date</span>
                          <span className={`font-bold ${status.color.split(' ')[0]}`}>{p.renewal_date}</span>
                        </div>
                      </div>

                      {p.notes && (
                        <div className="mt-3 bg-black/40 p-2 rounded text-xs text-[#ccc] border-l-2 border-[#f0a050] whitespace-pre-wrap">
                          {p.notes}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Tab 1: Coverage Summary Insights */}
          {activeTab === 1 && (
            <div className="px-4 pt-4 space-y-4">
              <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 text-center">
                <span className="text-[#555] uppercase font-mono text-[11px] tracking-wider block">Total Premium Committed</span>
                <span className="text-3xl font-bold font-mono text-[#f0a050] mt-2 block">
                  {formatCurrency(totalAnnualPremium)}
                </span>
              </div>

              <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
                <h4 className="text-xs uppercase text-[#555] font-mono tracking-wider mb-3 border-b border-[#1a1a1a] pb-2">
                  Asset Safeguard Distribution
                </h4>
                <div className="space-y-2.5 font-mono text-xs">
                  {['Auto', 'Home', 'Health', 'Umbrella', 'Other'].map((type) => {
                    const matches = policies.filter(p => p.policy_type === type);
                    const total = matches.reduce((sum, p) => sum + Number(p.premium), 0);
                    if (total === 0) return null;
                    return (
                      <div key={type} className="flex justify-between items-center py-1">
                        <span className="text-[#ccc]">{type} Policy</span>
                        <span className="text-white font-bold">{formatCurrency(total)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </PullToRefresh>

      <BottomNav activeTab="more" />

      {/* ═══════════════════════════════════════════════════════════════
          VIEWPORT FIXED ELEMENT SPECIFICATION MODALS BOUNDED SIBLINGS
      ═══════════════════════════════════════════════════════════════ */}

      {/* Centered Form Popup Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6 border border-[#1a1a1a]">
            <h2 className="text-xl font-bold font-mono text-[#f0a050] mb-4 uppercase tracking-wide">Add Insurance</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Provider *</label>
                <input
                  type="text"
                  required
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                  placeholder="e.g., Progressive, State Farm"
                />
              </div>

              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Policy Type *</label>
                <select
                  value={policyType}
                  onChange={(e) => setPolicyType(e.target.value)}
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
                  required
                  value={premium}
                  onChange={(e) => setPremium(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2.5 text-sm text-white font-mono focus:outline-none focus:border-[#f0a050]"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Renewal Date *</label>
                <input
                  type="date"
                  required
                  value={renewalDate}
                  onChange={(e) => setRenewalDate(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#f0a050]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Coverage Notes</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                  placeholder="Policy numbers, coverage limitations, deductible notes..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-black border border-[#1a1a1a] text-[#555] py-3 rounded-xl font-semibold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex-1 bg-[#f0a050] text-black py-3 rounded-xl font-semibold text-sm transition-colors"
                >
                  Save Policy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sheet Delete Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md p-5 border border-[#1a1a1a]">
            <h3 className="text-md font-bold text-white text-center">Delete this policy record?</h3>
            <p className="text-xs text-[#555] text-center mt-1">This action cannot be undone.</p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 bg-black border border-[#1a1a1a] text-white py-3 rounded-xl text-sm font-semibold"
              >
                Keep
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 bg-[#ef4444] text-white py-3 rounded-xl text-sm font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}