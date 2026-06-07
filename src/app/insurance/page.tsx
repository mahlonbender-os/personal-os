'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal & Action Sheet States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedWarranty, setSelectedWarranty] = useState<Warranty | null>(null);

  // Unified Form Inputs State
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
        setWarranties(data);
        localStorage.setItem('warranties-data', JSON.stringify(data));
      }
    } catch (err) {
      console.error('Error reading warranty inventory index:', err);
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
    if (!itemName.trim()) return;

    try {
      const payload = {
        id: selectedWarranty?.id,
        itemName,
        purchaseDate,
        expirationDate,
        vendor,
        cost: cost ? parseFloat(cost) : null,
        notes
      };

      const res = await fetch('/api/warranties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchWarranties();
      }
    } catch (err) {
      console.error('Error saving warranty record parameters:', err);
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
        fetchWarranties();
      }
    } catch (err) {
      console.error('Error dropping asset ledger index item:', err);
    }
  };

  // Safe Local Timezone Context Calculations
  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });
  
  const getExpirationStatus = (dateStr: string | null) => {
    if (!dateStr) return { label: 'No Expiry', color: 'text-[#555] bg-[#1a1a1a]' };
    if (dateStr < todayStr) return { label: 'Expired', color: 'text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20' };
    
    // Explicit Midday Timestamp Append to Bypass Host Translation Offsets
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
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="bg-black min-h-screen text-white pb-24">
        
        {/* Core Header Section with Top-Right Inline Add Button */}
        <div className="px-4 pt-6 pb-2 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-display text-white">Warranties</h1>
            <p className="text-xs text-[#555] mt-0.5">Asset structural parameters & coverage profiles</p>
          </div>
          <button
            onClick={openAddModal}
            className="w-10 h-10 bg-[#f0a050] text-black rounded-xl flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Add Warranty Asset"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Aligned Sub-tab Container Loop */}
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

        {/* Dynamic Card Display Layout */}
        <div className="px-4 pt-4 space-y-3">
          {loading && warranties.length === 0 ? (
            <div className="text-center py-12 text-[#555] text-sm font-medium">Loading warranty indexes...</div>
          ) : filteredWarranties.length === 0 ? (
            <div className="text-center py-12 text-[#555] text-sm">No recorded coverage instances found.</div>
          ) : (
            filteredWarranties.map((w) => {
              const status = getExpirationStatus(w.expiration_date);
              return (
                <div
                  key={w.id}
                  onClick={() => openEditModal(w)}
                  className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 flex flex-col justify-between space-y-3 active:scale-[0.99] transition-transform cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1 max-w-[70%]">
                      <h3 className="font-semibold text-white text-base truncate tracking-tight">{w.item_name}</h3>
                      <p className="text-xs text-[#ccc] font-medium truncate">{w.vendor || 'Unspecified Retailer'}</p>
                    </div>
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${status.color}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="flex justify-between items-end pt-2 border-t border-[#1a1a1a]/60 text-xs text-[#555]">
                    <div className="space-y-0.5">
                      {w.expiration_date && (
                        <p>Expires: <span className="text-[#ccc] font-mono">{w.expiration_date}</span></p>
                      )}
                      {w.purchase_date && (
                        <p>Purchased: <span className="text-[#555] font-mono">{w.purchase_date}</span></p>
                      )}
                    </div>
                    <span className="font-mono text-white text-sm font-semibold tracking-tight">
                      {formatCurrency(w.cost)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Centered Entry Form Modal (Clean <div> architecture) */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
            <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto pb-6 text-white border border-[#2c2c2e]">
              <div className="flex justify-between items-center px-5 py-4 border-b border-[#2c2c2e] sticky top-0 bg-[#1c1c1e] z-10">
                <h2 className="text-base font-bold text-white">
                  {selectedWarranty ? 'Edit Coverage Settings' : 'Log New Warranty Asset'}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-[#555] hover:text-white text-sm font-semibold p-1"
                >
                  Cancel
                </button>
              </div>

              {/* Form Layout Elements Container */}
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#ccc] uppercase tracking-wider mb-1">Item Name *</label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g. Living Room TV"
                    className="w-full bg-[#2c2c2e] border border-[#3a3a3c] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#ccc] uppercase tracking-wider mb-1">Retail Vendor</label>
                    <input
                      type="text"
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
                      placeholder="e.g. Best Buy"
                      className="w-full bg-[#2c2c2e] border border-[#3a3a3c] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#ccc] uppercase tracking-wider mb-1">Purchase Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#2c2c2e] border border-[#3a3a3c] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-[#f0a050]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#ccc] uppercase tracking-wider mb-1">Purchase Date</label>
                    <input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="w-full bg-[#2c2c2e] border border-[#3a3a3c] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-[#f0a050]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#ccc] uppercase tracking-wider mb-1">Expiration Date</label>
                    <input
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      className="w-full bg-[#2c2c2e] border border-[#3a3a3c] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-[#f0a050]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#ccc] uppercase tracking-wider mb-1">Coverage Notes</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Coverage structural exemptions, protection parameters, policy extensions..."
                    className="w-full bg-[#2c2c2e] border border-[#3a3a3c] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#f0a050] resize-none"
                  />
                </div>

                {/* Aligned Horizontal Action Row Button Layout Configuration */}
                <div className="pt-3 flex gap-3">
                  {selectedWarranty ? (
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

        {/* Bottom Sheet Action Sheet For Deletions */}
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

        {/* Fixed Active Layout Footer Navigation Baseline Context */}
        <BottomNav activeTab="more" />
      </div>
    </PullToRefresh>
  );
}