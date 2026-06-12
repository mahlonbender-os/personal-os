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
        fetchWarranties();
      }
    } catch (err) {
      console.error('Error hard dropping specified ledger line:', err);
    }
  };

  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });
  
  const getExpirationStatus = (dateStr: string | null) => {
    if (!dateStr) return { label: 'No Expiry', color: 'text-[#555] bg-[#1a1a1a]' };
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

          {/* Warranty coverage loops */}
          <div className="px-4 pt-4 space-y-3">
            {loading && warranties.length === 0 ? (
              <div className="text-center py-12 text-[#555] text-sm font-mono">Loading warranty indexes...</div>
            ) : filteredWarranties.length === 0 ? (
              <div className="text-center py-12 text-[#555] text-sm font-mono">No recorded coverage instances found.</div>
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

        </div>
      </PullToRefresh>

      <BottomNav active="more" />

      {/* ═══════════════════════════════════════════════════════════════
          VIEWPORT FIXED ELEMENT SPECIFICATION MODALS BOUNDED SIBLINGS
      ═══════════════════════════════════════════════════════════════ */}

      {/* Modal Configuration Sheet */}
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
                className="text-[#f0a050] text-sm font-semibold p-1"
              >
                Cancel
              </button>
            </div>

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
    </>
  );
}