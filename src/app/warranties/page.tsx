'use client';

import { useState, useEffect } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import BottomNav from '@/components/BottomNav';

interface Warranty {
  id: string;
  item_name: string;
  purchase_date: string | null;
  expiration_date: string | null;
  vendor: string | null;
  cost: number | null;
  notes: string | null;
}

const TABS = ['Active', 'Expired', 'All Items'];

export default function WarrantiesPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWarranties, setExpandedWarranties] = useState<Set<string>>(new Set());
  
  // Modal & Confirmation Layout States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedWarranty, setSelectedWarranty] = useState<Warranty | null>(null);

  // Form State Vectors
  const [itemName, setItemName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [vendor, setVendor] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  const fetchWarranties = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/warranties');
      if (res.ok) {
        const data = await res.json();
        setWarranties(Array.isArray(data) ? data : []);
        localStorage.setItem('warranties-data', JSON.stringify(data));
      }
    } catch (err) {
      console.error('Error fetching warranties index registry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = localStorage.getItem('warranties-data');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setWarranties(Array.isArray(parsed) ? parsed : []);
      } catch {
        setWarranties([]);
      }
      setLoading(false);
    }
    fetchWarranties();
  }, []);

  const handleRefresh = async () => {
    await fetchWarranties();
  };

  const openAddModal = () => {
    setSelectedWarranty(null);
    setItemName('');
    setPurchaseDate('');
    setExpirationDate('');
    setVendor('');
    setCost('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (w: Warranty) => {
    setSelectedWarranty(w);
    setItemName(w.item_name);
    setPurchaseDate(w.purchase_date || '');
    setExpirationDate(w.expiration_date || '');
    setVendor(w.vendor || '');
    setCost(w.cost ? w.cost.toString() : '');
    setNotes(w.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!itemName.trim()) {
      alert('Please fill out the required Item Name (*) field.');
      return;
    }

    try {
      const payload = {
        id: selectedWarranty?.id,
        itemName: itemName.trim(),
        purchaseDate: purchaseDate || null,
        expirationDate: expirationDate || null,
        vendor: vendor.trim() || null,
        cost: cost ? parseFloat(cost) : null,
        notes: notes.trim() || null
      };

      const res = await fetch('/api/warranties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsModalOpen(false);
        await fetchWarranties();
      } else {
        alert('Failed to save warranty record to Supabase.');
      }
    } catch (err) {
      console.error('Error saving warranty data entry parameters:', err);
    }
  };

  const handleDelete = async () => {
    if (!selectedWarranty) return;
    try {
      const res = await fetch(`/api/warranties?id=${selectedWarranty.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setIsDeleteConfirmOpen(false);
        setIsModalOpen(false);
        // Clean out of expanded targets
        const next = new Set(expandedWarranties);
        next.delete(selectedWarranty.id);
        setExpandedWarranties(next);
        await fetchWarranties();
      } else {
        alert('Failed to delete warranty record.');
      }
    } catch (err) {
      console.error('Error hard dropping specified ledger line:', err);
    }
  };

  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });
  
  const getExpirationStatus = (dateStr: string | null) => {
    if (!dateStr) return { label: 'No Expiry', color: 'text-[#555] bg-[#1a1a1a] border border-[#1a1a1a]' };
    if (dateStr < todayStr) return { label: 'Expired', color: 'text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20' };
    
    const today = new Date(todayStr + 'T12:00:00');
    const expiry = new Date(dateStr + 'T12:00:00');
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 90) return { label: `Expiring (${diffDays}d)`, color: 'text-[#f0a050] bg-[#f0a050]/10 border border-[#f0a050]/20' };
    return { label: 'Active', color: 'text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/20' };
  };

  const filteredWarranties = warranties.filter((w) => {
    if (activeTab === 0) return !w.expiration_date || w.expiration_date >= todayStr;
    if (activeTab === 1) return w.expiration_date && w.expiration_date < todayStr;
    return true;
  });

  const formatCurrency = (val: number | null) => {
    if (val === null || val === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  return (
    <>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="min-h-screen bg-black text-white pb-24">
          
          {/* Sticky context header row perfectly matching Knox and Investments template */}
          <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-[#1a1a1a]">
            <div className="flex items-center justify-between px-4 pt-14 pb-3">
              <div>
                <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, system-ui, sans-serif' }}>
                  Warranties
                </h1>
                <p className="text-[10px] text-[#555] mt-0.5">
                  Asset Structural Parameters & Coverage Profiles
                </p>
              </div>

              {/* Standardised inline amber header text button layout */}
              <button
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(8);
                  openAddModal();
                }}
                className="text-sm font-semibold text-[#f0a050] active:opacity-70 transition-opacity px-2 py-1"
              >
                Add Asset
              </button>
            </div>

            {/* Sticky Sub-tab Bar switcher row */}
            <div className="flex border-t border-[#1a1a1a]">
              {TABS.map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(i);
                    window.scrollTo(0, 0);
                    if (navigator.vibrate) navigator.vibrate(8);
                  }}
                  className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                    activeTab === i ? 'text-[#f0a050] border-b-2 border-[#f0a050]' : 'text-[#555]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Warranty coverage loops mapping premium accordion layout */}
          <div className="px-4 pt-4 space-y-3">
            {loading && warranties.length === 0 ? (
              <div className="text-center py-12 text-[#555] text-sm font-mono">Loading warranty matrix logs...</div>
            ) : filteredWarranties.length === 0 ? (
              <div className="text-center py-12 text-[#555] text-sm font-mono">No recorded coverage instances found.</div>
            ) : (
              filteredWarranties.map((w) => {
                const status = getExpirationStatus(w.expiration_date);
                const expanded = expandedWarranties.has(w.id);
                return (
                  <div
                    key={w.id}
                    className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden transition-all"
                  >
                    {/* Tappable core header container row */}
                    <div
                      onClick={() => {
                        const next = new Set(expandedWarranties);
                        expanded ? next.delete(w.id) : next.add(w.id);
                        setExpandedWarranties(next);
                      }}
                      className="p-4 flex items-center justify-between cursor-pointer active:bg-[#161616]"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${status.color.split(' ')[0]} ${status.color.split(' ')[1] || ''}`}>
                            {status.label}
                          </span>
                          <span className="text-[#555] text-[10px] font-mono truncate">{w.vendor || 'Retailer Unspecified'}</span>
                        </div>
                        <h3 className="font-semibold text-white text-base mt-1.5 truncate tracking-tight">{w.item_name}</h3>
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        <span className="font-mono text-white text-sm font-semibold tracking-tight">
                          {formatCurrency(w.cost)}
                        </span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"
                          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </div>
                    </div>

                    {/* Collapsible content section parameters block layout */}
                    {expanded && (
                      <div className="px-4 pb-4 pt-3 border-t border-[#1a1a1a] space-y-3 bg-black/20">
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono text-[#555]">
                          {w.purchase_date && (
                            <div>
                              <span className="text-[#555] block uppercase text-[10px] tracking-wider">Purchase Log</span>
                              <span className="text-[#ccc] font-bold">{w.purchase_date}</span>
                            </div>
                          )}
                          {w.expiration_date && (
                            <div>
                              <span className="text-[#555] block uppercase text-[10px] tracking-wider">Expiration Date</span>
                              <span className="text-[#ccc] font-bold">{w.expiration_date}</span>
                            </div>
                          )}
                        </div>

                        {w.notes && (
                          <div>
                            <span className="text-[#555] block uppercase font-mono text-[10px] tracking-wider mb-1">Coverage Parameters</span>
                            <div className="bg-black/40 p-2.5 rounded-xl text-xs text-[#ccc] border-l-2 border-[#f0a050] whitespace-pre-wrap font-sans">
                              {w.notes}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-4 pt-1">
                          <button
                            onClick={() => openEditModal(w)}
                            className="text-[#f0a050] text-xs font-semibold uppercase tracking-wider"
                          >
                            Edit item
                          </button>
                          <button
                            onClick={() => {
                              setSelectedWarranty(w);
                              setIsDeleteConfirmOpen(true);
                            }}
                            className="text-[#ef4444] text-xs font-semibold uppercase tracking-wider"
                          >
                            Delete item
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </div>
      </PullToRefresh>

      <BottomNav activeTab="more" />

      {/* ═══════════════════════════════════════════════════════════════
          VIEWPORT FIXED ELEMENT SPECIFICATION MODALS BOUNDED SIBLINGS
      ═══════════════════════════════════════════════════════════════ */}

      {/* Modal Configuration Sheet */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto pb-6 text-white border border-[#1a1a1a]">
            <div className="flex justify-between items-center px-5 py-4 border-b border-[#1a1a1a] sticky top-0 bg-[#1c1c1e] z-10">
              <h2 className="text-base font-bold text-white font-mono uppercase tracking-wide">
                {selectedWarranty ? 'Modify Asset Profile' : 'Log New Warranty'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[#f0a050] text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#555] uppercase tracking-wider mb-1 font-mono">Item Name *</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Living Room TV"
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#555] uppercase tracking-wider mb-1 font-mono">Retail Vendor</label>
                  <input
                    type="text"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="e.g. Best Buy"
                    className="w-full bg-black border border-[#1a1a1a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#555] uppercase tracking-wider mb-1 font-mono">Purchase Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-black border border-[#1a1a1a] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-[#f0a050]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#555] uppercase tracking-wider mb-1 font-mono">Purchase Date</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full bg-black border border-[#1a1a1a] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-[#f0a050]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#555] uppercase tracking-wider mb-1 font-mono">Expiration Date</label>
                  <input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="w-full bg-black border border-[#1a1a1a] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-[#f0a050]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#555] uppercase tracking-wider mb-1 font-mono">Coverage Notes</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Exemptions, protection limits, structural extensions notes..."
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#f0a050] resize-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-black border border-[#1a1a1a] text-[#555] py-3 rounded-xl font-semibold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 bg-[#f0a050] text-black py-3 rounded-xl font-semibold text-sm transition-colors"
                >
                  Save Asset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Sheet */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md p-5 border border-[#1a1a1a] space-y-4">
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Permanently Remove Entry?</h3>
              <p className="text-xs text-[#555]">This action cannot be undone. This row item index will be dropped.</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="flex-1 bg-black border border-[#1a1a1a] text-white py-3 rounded-xl text-sm font-medium"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 bg-[#ef4444] text-white py-3 rounded-xl text-sm font-bold"
              >
                Delete Asset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}