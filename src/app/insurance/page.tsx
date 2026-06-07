'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

const TABS = ['Policies', 'Stats Summary'];
const POLICY_TYPES = ['Auto', 'Home', 'Health', 'Umbrella', 'Other'];

export default function InsurancePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal & Action Sheet States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<InsurancePolicy | null>(null);

  // Form Field States
  const [provider, setProvider] = useState('');
  const [policyType, setPolicyType] = useState('Auto');
  const [premium, setPremium] = useState('');
  const [renewalDate, setRenewalDate] = useState('');
  const [notes, setNotes] = useState('');

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/insurance');
      if (res.ok) {
        const data = await res.json();
        setPolicies(data);
        localStorage.setItem('insurance-data', JSON.stringify(data));
      }
    } catch (err) {
      console.error('Error fetching insurance index parameters:', err);
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

  const openAddModal = () => {
    setSelectedPolicy(null);
    setProvider('');
    setPolicyType('Auto');
    setPremium('');
    setRenewalDate('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (p: InsurancePolicy) => {
    setSelectedPolicy(p);
    setProvider(p.provider);
    setPolicyType(p.policy_type);
    setPremium(p.premium ? p.premium.toString() : '');
    setRenewalDate(p.renewal_date || '');
    setNotes(p.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!provider.trim() || !policyType) return;

    try {
      const payload = {
        id: selectedPolicy?.id,
        provider,
        policyType,
        premium: premium ? parseFloat(premium) : 0,
        renewalDate,
        notes
      };

      const res = await fetch('/api/insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchPolicies();
      }
    } catch (err) {
      console.error('Error preserving policy profile indices:', err);
    }
  };

  const handleDelete = async () => {
    if (!selectedPolicy) return;
    try {
      const res = await fetch(`/api/insurance?id=${selectedPolicy.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setIsDeleteConfirmOpen(false);
        setIsModalOpen(false);
        fetchPolicies();
      }
    } catch (err) {
      console.error('Error pruning policy metrics trace:', err);
    }
  };

  // Safe Midday Local Target Timezone Matching Parsing
  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });

  const getRenewalStatus = (dateStr: string | null) => {
    if (!dateStr) return { label: 'No Date', color: 'text-[#555] bg-[#1a1a1a]' };
    if (dateStr < todayStr) return { label: 'Lapsed', color: 'text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20' };

    // Explicit Noon Context Initialization to Eradicate Device Time Shift Anomalies
    const today = new Date(todayStr + 'T12:00:00');
    const renewal = new Date(dateStr + 'T12:00:00');
    const diffTime = renewal.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 45) return { label: `Renew in (${diffDays}d)`, color: 'text-[#f0a050] bg-[#f0a050]/10 border border-[#f0a050]/20' };
    return { label: 'Current', color: 'text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/20' };
  };

  const formatCurrency = (val: number | null) => {
    if (val === null || val === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  // Aggregate stats logic safely protecting against sparse entries
  const totalPremiumCost = policies.reduce((acc, p) => acc + (p.premium || 0), 0);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="bg-black min-h-screen text-white pb-24">
        
        {/* Core Aligned Heading Strip with Header Add Action Icon */}
        <div className="px-4 pt-6 pb-2 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-display text-white">Insurance</h1>
            <p className="text-xs text-[#555] mt-0.5">Coverage rules & operational risk policies</p>
          </div>
          <button
            onClick={openAddModal}
            className="text-[#f0a050] p-2 hover:opacity-80 active:scale-95 transition-transform"
            aria-label="Log New Policy"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Tab Selection Interface Component */}
        <div className="flex border-b border-[#1a1a1a] sticky top-0 bg-black z-10">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(i);
                window.scrollTo(0, 0);
                if (navigator.vibrate) navigator.vibrate(8);
              }}
              className={`flex-1 py-4 text-xs font-semibold transition-colors ${
                activeTab === i ? 'text-[#f0a050] border-b-2 border-[#f0a050]' : 'text-[#555]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Dynamic Display Panels */}
        <div className="px-4 pt-4 space-y-3">
          {loading && policies.length === 0 ? (
            <div className="text-center py-12 text-[#555] text-sm font-medium">Loading asset safety indices...</div>
          ) : activeTab === 0 ? (
            /* Tab 0: Policy Records Summary Feed */
            policies.length === 0 ? (
              <div className="text-center py-12 text-[#555] text-sm">No coverage contracts found in database ledger.</div>
            ) : (
              policies.map((p) => {
                const status = getRenewalStatus(p.renewal_date);
                return (
                  <div
                    key={p.id}
                    onClick={() => openEditModal(p)}
                    className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 flex flex-col justify-between space-y-3 active:scale-[0.99] transition-transform cursor-pointer"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1 max-w-[70%]">
                        <h3 className="font-semibold text-white text-base truncate tracking-tight">{p.provider}</h3>
                        <p className="text-xs text-[#f0a050] font-semibold tracking-wide uppercase text-[10px]">{p.policy_type} Protection</p>
                      </div>
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${status.color}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="flex justify-between items-end pt-2 border-t border-[#1a1a1a]/60 text-xs text-[#555]">
                      <div>
                        {p.renewal_date && (
                          <p>Renewal Date: <span className="text-[#ccc] font-mono">{p.renewal_date}</span></p>
                        )}
                        {p.notes && <p className="text-[#555] mt-0.5 truncate max-w-[180px]">{p.notes}</p>}
                      </div>
                      <span className="font-mono text-[#22c55e] text-sm font-semibold tracking-tight">
                        {formatCurrency(p.premium)}
                      </span>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            /* Tab 1: Aggregated Financial Allocation Outlays */
            <div className="space-y-4">
              <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5 text-center">
                <p className="text-xs uppercase font-bold tracking-wider text-[#555] mb-1">Total Annual Premium Liability</p>
                <h2 className="text-2xl font-bold font-mono text-[#ef4444]">
                  {formatCurrency(totalPremiumCost)}
                </h2>
              </div>

              <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#ccc] border-b border-[#1a1a1a] pb-2">Line Breakdown</h3>
                {POLICY_TYPES.map((type) => {
                  const subTotal = policies.filter(p => p.policy_type === type).reduce((sum, p) => sum + (p.premium || 0), 0);
                  return (
                    <div key={type} className="flex justify-between items-center text-sm">
                      <span className="text-[#ccc] font-medium">{type} Coverage</span>
                      <span className="font-mono text-white font-semibold">{formatCurrency(subTotal)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Pure layout configuration modal (No interactive form constraints) */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
            <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto pb-6 text-white border border-[#2c2c2e]">
              <div className="flex justify-between items-center px-5 py-4 border-b border-[#2c2c2e] sticky top-0 bg-[#1c1c1e] z-10">
                <h2 className="text-base font-bold text-white">
                  {selectedPolicy ? 'Modify Policy Matrix' : 'Log New Risk Contract'}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-[#555] hover:text-white text-sm font-semibold p-1"
                >
                  Cancel
                </button>
              </div>

              {/* Input Group Structure */}
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#ccc] uppercase tracking-wider mb-1">Insurance Provider *</label>
                  <input
                    type="text"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    placeholder="e.g. Progressive"
                    className="w-full bg-[#2c2c2e] border border-[#3a3a3c] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#ccc] uppercase tracking-wider mb-1">Policy Sector Type</label>
                    <select
                      value={policyType}
                      onChange={(e) => setPolicyType(e.target.value)}
                      className="w-full bg-[#2c2c2e] border border-[#3a3a3c] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                    >
                      {POLICY_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#ccc] uppercase tracking-wider mb-1">Premium Rate (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={premium}
                      onChange={(e) => setPremium(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#2c2c2e] border border-[#3a3a3c] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-[#f0a050]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#ccc] uppercase tracking-wider mb-1">Renewal Expiration Date</label>
                  <input
                    type="date"
                    value={renewalDate}
                    onChange={(e) => setRenewalDate(e.target.value)}
                    className="w-full bg-[#2c2c2e] border border-[#3a3a3c] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-[#f0a050]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#ccc] uppercase tracking-wider mb-1">Coverage Notes</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Deductibles, policy bounds, claim contacts..."
                    className="w-full bg-[#2c2c2e] border border-[#3a3a3c] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#f0a050] resize-none"
                  />
                </div>

                {/* Streamlined Side-by-Side Horizontal Action Row */}
                <div className="pt-3 flex gap-3">
                  {selectedPolicy ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsDeleteConfirmOpen(true)}
                        className="flex-1 bg-[#2c2c2e] text-[#ef4444] border border-[#ef4444]/10 font-semibold py-3.5 rounded-xl text-sm active:scale-[0.98] transition-transform"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        className="flex-1 bg-[#f0a050] text-black font-bold py-3.5 rounded-xl text-sm active:scale-[0.98] transition-transform"
                      >
                        Save
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="flex-1 bg-[#2c2c2e] text-white font-semibold py-3.5 rounded-xl text-sm active:scale-[0.98] transition-transform"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        className="flex-1 bg-[#f0a050] text-black font-bold py-3.5 rounded-xl text-sm active:scale-[0.98] transition-transform"
                      >
                        Save
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Sheet */}
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
            <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md p-5 border border-[#2c2c2e] space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-white">Permanently Remove Entry?</h3>
                <p className="text-xs text-[#555]">This action cannot be undone. This row item index will be dropped.</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="flex-1 bg-[#2c2c2e] text-white py-3 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex-1 bg-[#ef4444] text-white py-3 rounded-xl text-sm font-bold"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Fixed PWA Navigation Context Footer */}
        <BottomNav activeTab="more" />
      </div>
    </PullToRefresh>
  );
}