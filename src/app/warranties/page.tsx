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

const TABS = ['Active', 'Expired', 'Warranty Stats'];

export default function WarrantiesPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedWarranty, setSelectedWarranty] = useState<Warranty | null>(null);

  // Form States
  const [itemName, setItemName] = useState('');
  const [vendor, setVendor] = useState('');
  const [cost, setCost] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [notes, setNotes] = useState('');

  const fetchWarranties = async () => {
    try {
      const res = await fetch('/api/warranties');
      if (res.ok) {
        const data = await res.json();
        setWarranties(data);
        localStorage.setItem('warranties-data', JSON.stringify(data));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = localStorage.getItem('warranties-data');
    if (cached) {
      setWarranties(JSON.parse(cached));
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
    setVendor('');
    setCost('');
    setPurchaseDate('');
    setExpirationDate('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (w: Warranty) => {
    setSelectedWarranty(w);
    setItemName(w.item_name);
    setVendor(w.vendor || '');
    setCost(w.cost ? w.cost.toString() : '');
    setPurchaseDate(w.purchase_date || '');
    setExpirationDate(w.expiration_date || '');
    setNotes(w.notes || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!itemName.trim()) return;
    try {
      const res = await fetch('/api/warranties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedWarranty?.id,
          itemName,
          vendor,
          cost: cost ? parseFloat(cost) : null,
          purchaseDate,
          expirationDate,
          notes
        })
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchWarranties();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/warranties?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirmId(null);
        setIsModalOpen(false);
        fetchWarranties();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Safe server-client timezone-aligned conversion math
  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });

  const getExpirationStatus = (dateStr: string | null) => {
    if (!dateStr) return { label: 'NO EXPIRY', color: 'text-[#555] border-[#1a1a1a]' };
    
    // Middle of day mid-lock to bypass hosting server shifts
    const today = new Date(todayStr + 'T12:00:00');
    const expiration = new Date(dateStr + 'T12:00:00');

    const diffTime = expiration.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: 'EXPIRED', color: 'text-[#ef4444] border-[#ef4444]' };
    if (diffDays <= 90) return { label: `${diffDays} DAYS LEFT`, color: 'text-[#f0a050] border-[#f0a050]' };
    return { label: 'SECURE', color: 'text-[#22c55e] border-[#1a1a1a]' };
  };

  const activeWarranties = warranties.filter(w => !w.expiration_date || w.expiration_date >= todayStr);
  const expiredWarranties = warranties.filter(w => w.expiration_date && w.expiration_date < todayStr);
  const totalAssetCost = warranties.reduce((sum, w) => sum + Number(w.cost || 0), 0);

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Sticky Tab Bar */}
      <div className="flex border-b border-[#1a1a1a] sticky top-0 bg-black z-10">
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

      <PullToRefresh onRefresh={handleRefresh}>
        {/* Tab 0: Active Items List */}
        {activeTab === 0 && (
          <div className="px-4 pt-4 space-y-3">
            {loading && activeWarranties.length === 0 ? (
              <p className="text-sm text-[#555] font-mono">Loading active items...</p>
            ) : activeWarranties.length === 0 ? (
              <p className="text-sm text-[#555] font-mono">No active protected items found.</p>
            ) : (
              activeWarranties.map((w) => {
                const status = getExpirationStatus(w.expiration_date);
                return (
                  <div 
                    key={w.id} 
                    onClick={() => openEditModal(w)}
                    className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 transition-all active:scale-[0.99] cursor-pointer"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-[#1c1c1e] text-[#f0a050] border border-[#1a1a1a] px-2 py-0.5 rounded-md font-mono font-bold uppercase">
                            {w.vendor || 'Retailer'}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${status.color.split(' ')[0]}`}>
                            {status.label}
                          </span>
                        </div>
                        <h3 className="font-semibold text-base text-white mt-2">{w.item_name}</h3>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(w.id); }}
                        className="text-[#555] hover:text-[#ef4444] p-1"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-[#1a1a1a]/50 text-xs font-mono">
                      <div>
                        <span className="text-[#555] block uppercase text-[10px]">Cost</span>
                        <span className="text-white font-bold">{formatCurrency(w.cost)}</span>
                      </div>
                      <div>
                        <span className="text-[#555] block uppercase text-[10px]">Expiration</span>
                        <span className={`font-bold ${status.color.split(' ')[0]}`}>{w.expiration_date || 'N/A'}</span>
                      </div>
                    </div>

                    {w.notes && (
                      <div className="mt-3 bg-black/40 p-2 rounded text-xs text-[#ccc] border-l-2 border-[#f0a050] whitespace-pre-wrap">
                        {w.notes}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 1: Expired Items List */}
        {activeTab === 1 && (
          <div className="px-4 pt-4 space-y-3">
            {loading && expiredWarranties.length === 0 ? (
              <p className="text-sm text-[#555] font-mono">Loading expired items...</p>
            ) : expiredWarranties.length === 0 ? (
              <p className="text-sm text-[#555] font-mono">No expired warranty entries logged.</p>
            ) : (
              expiredWarranties.map((w) => {
                const status = getExpirationStatus(w.expiration_date);
                return (
                  <div 
                    key={w.id} 
                    onClick={() => openEditModal(w)}
                    className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 transition-all active:scale-[0.99] cursor-pointer opacity-60"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-[#1c1c1e] text-[#555] border border-[#1a1a1a] px-2 py-0.5 rounded-md font-mono font-bold uppercase">
                            {w.vendor || 'Retailer'}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${status.color.split(' ')[0]}`}>
                            {status.label}
                          </span>
                        </div>
                        <h3 className="font-semibold text-base text-white mt-2">{w.item_name}</h3>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(w.id); }}
                        className="text-[#555] hover:text-[#ef4444] p-1"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-[#1a1a1a]/50 text-xs font-mono">
                      <div>
                        <span className="text-[#555] block uppercase text-[10px]">Cost</span>
                        <span className="text-white font-bold">{formatCurrency(w.cost)}</span>
                      </div>
                      <div>
                        <span className="text-[#555] block uppercase text-[10px]">Expired On</span>
                        <span className={`font-bold ${status.color.split(' ')[0]}`}>{w.expiration_date}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 2: Insights Financial Allocation Summary */}
        {activeTab === 2 && (
          <div className="px-4 pt-4 space-y-4">
            <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 text-center">
              <span className="text-[#555] uppercase font-mono text-[11px] tracking-wider block">Total Protected Asset Value</span>
              <span className="text-3xl font-bold font-mono text-[#f0a050] mt-2 block">
                {formatCurrency(totalAssetCost)}
              </span>
            </div>

            <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
              <h4 className="text-xs uppercase text-[#555] font-mono tracking-wider mb-3 border-b border-[#1a1a1a] pb-2">
                Active Covered Parameters
              </h4>
              <div className="space-y-2.5 font-mono text-xs">
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#ccc]">Active Protection Items</span>
                  <span className="text-white font-bold">{activeWarranties.length}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#ccc]">Expired Protection Items</span>
                  <span className="text-white font-bold">{expiredWarranties.length}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </PullToRefresh>

      {/* Floating Action Button (Perfect Insurance Alignment) */}
      <button
        onClick={() => { if (navigator.vibrate) navigator.vibrate(8); openAddModal(); }}
        className="fixed bottom-24 right-5 w-14 h-14 bg-[#f0a050] rounded-full z-40 flex items-center justify-center text-black text-2xl font-bold shadow-lg"
      >
        ＋
      </button>

      {/* Centered Popup Layout Modal Box (No form tags) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6 border border-[#1a1a1a]">
            <h2 className="text-xl font-bold font-mono text-[#f0a050] mb-4 uppercase tracking-wide">
              {selectedWarranty ? 'Edit Warranty' : 'Add Warranty'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Item Name *</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                  placeholder="e.g., Living Room TV, MacBook Pro"
                />
              </div>

              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Vendor / Retailer</label>
                <input
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                  placeholder="e.g., Best Buy, Apple"
                />
              </div>

              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Purchase Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2.5 text-sm text-white font-mono focus:outline-none focus:border-[#f0a050]"
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase text-[#555] font-mono mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#f0a050]"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase text-[#555] font-mono mb-1">Expiration Date</label>
                  <input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#f0a050]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Coverage Notes</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                  placeholder="Serial numbers, technical support contract extensions..."
                />
              </div>

              {/* Side-by-Side Horizontal Action Rows */}
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
                  Save Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sheet Delete Dialog Box */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md p-5 border border-[#1a1a1a]">
            <h3 className="text-md font-bold text-white text-center">Delete this warranty record?</h3>
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

      <BottomNav activeTab="more" />
    </div>
  );
}