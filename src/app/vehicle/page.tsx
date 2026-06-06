'use client';

import { useState, useEffect } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import SwipeTabs from '@/components/SwipeTabs';

const TABS = ['Overview', 'Maintenance', 'Mileage', 'Fuel'];

const SERVICE_TYPES = [
  'Oil Change',
  'Tire Rotation',
  'Tire Replacement',
  'Brake Service',
  'Air Filter',
  'Cabin Filter',
  'Battery Replacement',
  'Transmission Service',
  'Coolant Flush',
  'Inspection',
  'Registration / Tags',
  'Wiper Blades',
  'Detailing',
  'Alignment',
  'Spark Plugs',
  'Other',
];

type VehicleInfo = {
  id?: string;
  year?: number;
  make?: string;
  model?: string;
  trim_level?: string;
  color?: string;
  vin?: string;
  license_plate?: string;
  purchase_date?: string;
  purchase_price?: number;
};

type MaintenanceRecord = {
  id: string;
  date: string;
  service_type: string;
  mileage?: number;
  cost?: number;
  shop?: string;
  notes?: string;
};

type MileageRecord = {
  id: string;
  date: string;
  odometer: number;
  notes?: string;
};

type FuelRecord = {
  id: string;
  date: string;
  gallons: number;
  price_per_gallon: number;
  total_cost: number;
  odometer?: number;
  station?: string;
  notes?: string;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// fuel is sorted date DESC, so index 0 = most recent
// MPG = miles since last fill-up / gallons this fill-up
function calcMPG(fuel: FuelRecord[], index: number): number | null {
  const current = fuel[index];
  const prev = fuel[index + 1];
  if (!current?.odometer || !prev?.odometer) return null;
  const miles = current.odometer - prev.odometer;
  if (miles <= 0 || current.gallons <= 0) return null;
  return Math.round((miles / current.gallons) * 10) / 10;
}

export default function VehiclePage() {
  const [activeTab, setActiveTab] = useState(0);
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [mileage, setMileage] = useState<MileageRecord[]>([]);
  const [fuel, setFuel] = useState<FuelRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal visibility
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [showMileageModal, setShowMileageModal] = useState(false);
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [showDeleteMaint, setShowDeleteMaint] = useState<string | null>(null);
  const [showDeleteMileage, setShowDeleteMileage] = useState<string | null>(null);
  const [showDeleteFuel, setShowDeleteFuel] = useState<string | null>(null);
  const [expandedMaint, setExpandedMaint] = useState<string | null>(null);

  // Form states
  const [vehicleForm, setVehicleForm] = useState<VehicleInfo>({});
  const [maintForm, setMaintForm] = useState({
    date: todayStr(), service_type: 'Oil Change', mileage: '', cost: '', shop: '', notes: '',
  });
  const [mileageForm, setMileageForm] = useState({
    date: todayStr(), odometer: '', notes: '',
  });
  const [fuelForm, setFuelForm] = useState({
    date: todayStr(), gallons: '', price_per_gallon: '', total_cost: '', odometer: '', station: '', notes: '',
  });
  const [totalManual, setTotalManual] = useState(false);

  const [saving, setSaving] = useState(false);

  // Auto-calculate total cost from gallons × price (unless user typed total manually)
  useEffect(() => {
    if (totalManual) return;
    const g = parseFloat(fuelForm.gallons);
    const p = parseFloat(fuelForm.price_per_gallon);
    if (!isNaN(g) && !isNaN(p) && g > 0 && p > 0) {
      setFuelForm(f => ({ ...f, total_cost: (g * p).toFixed(2) }));
    }
  }, [fuelForm.gallons, fuelForm.price_per_gallon, totalManual]);

  useEffect(() => {
    try {
      const ci = localStorage.getItem('vehicle-info');
      if (ci) setVehicleInfo(JSON.parse(ci));
      const cm = localStorage.getItem('vehicle-maintenance');
      if (cm) setMaintenance(JSON.parse(cm));
      const cml = localStorage.getItem('vehicle-mileage');
      if (cml) setMileage(JSON.parse(cml));
      const cf = localStorage.getItem('vehicle-fuel');
      if (cf) setFuel(JSON.parse(cf));
    } catch {}
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [infoRes, maintRes, mileRes, fuelRes] = await Promise.all([
        fetch('/api/vehicle/info'),
        fetch('/api/vehicle/maintenance'),
        fetch('/api/vehicle/mileage'),
        fetch('/api/vehicle/fuel'),
      ]);

      const info = await infoRes.json();
      const maint = await maintRes.json();
      const mile = await mileRes.json();
      const fuelData = await fuelRes.json();

      const infoData = info && !info.error ? info : null;
      const maintData = Array.isArray(maint) ? maint : [];
      const mileData = Array.isArray(mile) ? mile : [];
      const fuelArr = Array.isArray(fuelData) ? fuelData : [];

      setVehicleInfo(infoData);
      setMaintenance(maintData);
      setMileage(mileData);
      setFuel(fuelArr);

      if (infoData) localStorage.setItem('vehicle-info', JSON.stringify(infoData));
      localStorage.setItem('vehicle-maintenance', JSON.stringify(maintData));
      localStorage.setItem('vehicle-mileage', JSON.stringify(mileData));
      localStorage.setItem('vehicle-fuel', JSON.stringify(fuelArr));
    } catch {}
    setLoading(false);
  }

  async function saveVehicleInfo() {
    setSaving(true);
    try {
      await fetch('/api/vehicle/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vehicleForm),
      });
      setShowVehicleModal(false);
      await fetchAll();
    } catch {}
    setSaving(false);
  }

  async function saveMaintenance() {
    if (!maintForm.date || !maintForm.service_type) return;
    setSaving(true);
    try {
      await fetch('/api/vehicle/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: maintForm.date,
          service_type: maintForm.service_type,
          mileage: maintForm.mileage ? parseInt(maintForm.mileage) : null,
          cost: maintForm.cost ? parseFloat(maintForm.cost) : null,
          shop: maintForm.shop || null,
          notes: maintForm.notes || null,
        }),
      });
      setShowMaintModal(false);
      setMaintForm({ date: todayStr(), service_type: 'Oil Change', mileage: '', cost: '', shop: '', notes: '' });
      await fetchAll();
    } catch {}
    setSaving(false);
  }

  async function deleteMaintenance(id: string) {
    try {
      await fetch(`/api/vehicle/maintenance?id=${id}`, { method: 'DELETE' });
      setShowDeleteMaint(null);
      setExpandedMaint(null);
      await fetchAll();
    } catch {}
  }

  async function saveMileage() {
    if (!mileageForm.date || !mileageForm.odometer) return;
    setSaving(true);
    try {
      await fetch('/api/vehicle/mileage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: mileageForm.date,
          odometer: parseInt(mileageForm.odometer),
          notes: mileageForm.notes || null,
        }),
      });
      setShowMileageModal(false);
      setMileageForm({ date: todayStr(), odometer: '', notes: '' });
      await fetchAll();
    } catch {}
    setSaving(false);
  }

  async function deleteMileage(id: string) {
    try {
      await fetch(`/api/vehicle/mileage?id=${id}`, { method: 'DELETE' });
      setShowDeleteMileage(null);
      await fetchAll();
    } catch {}
  }

  async function saveFuel() {
    if (!fuelForm.date || !fuelForm.gallons || !fuelForm.price_per_gallon || !fuelForm.total_cost) return;
    setSaving(true);
    try {
      await fetch('/api/vehicle/fuel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: fuelForm.date,
          gallons: parseFloat(fuelForm.gallons),
          price_per_gallon: parseFloat(fuelForm.price_per_gallon),
          total_cost: parseFloat(fuelForm.total_cost),
          odometer: fuelForm.odometer ? parseInt(fuelForm.odometer) : null,
          station: fuelForm.station || null,
          notes: fuelForm.notes || null,
        }),
      });
      setShowFuelModal(false);
      setFuelForm({ date: todayStr(), gallons: '', price_per_gallon: '', total_cost: '', odometer: '', station: '', notes: '' });
      setTotalManual(false);
      await fetchAll();
    } catch {}
    setSaving(false);
  }

  async function deleteFuel(id: string) {
    try {
      await fetch(`/api/vehicle/fuel?id=${id}`, { method: 'DELETE' });
      setShowDeleteFuel(null);
      await fetchAll();
    } catch {}
  }

  // Derived values
  const lastOilChange = maintenance.find(m => m.service_type === 'Oil Change');
  const latestMileage = mileage[0];
  const thisYear = new Date().getFullYear();
  const yearMaint = maintenance.filter(m => m.date.startsWith(thisYear.toString()));
  const yearMaintCost = yearMaint.reduce((sum, m) => sum + (m.cost || 0), 0);
  const yearFuel = fuel.filter(f => f.date.startsWith(thisYear.toString()));
  const yearFuelCost = yearFuel.reduce((sum, f) => sum + (f.total_cost || 0), 0);

  const allMPGs = fuel.map((_, i) => calcMPG(fuel, i)).filter((m): m is number => m !== null);
  const avgMPG = allMPGs.length > 0
    ? Math.round((allMPGs.reduce((s, m) => s + m, 0) / allMPGs.length) * 10) / 10
    : null;

  const vehicleName = vehicleInfo?.year && vehicleInfo?.make && vehicleInfo?.model
    ? `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}`
    : null;

  const fuelCanSave = fuelForm.date && fuelForm.gallons && fuelForm.price_per_gallon && fuelForm.total_cost;

  return (
    <PullToRefresh onRefresh={fetchAll}>
      <div className="pb-24 min-h-screen bg-black">

        {/* Header */}
        <div className="px-4 pt-6 pb-2">
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, system-ui, sans-serif' }}>
            Vehicle
          </h1>
          <p className="text-[#555] text-sm mt-0.5">
            {vehicleName || 'Set up your vehicle'}
          </p>
        </div>

        <SwipeTabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 0 && (
            <div className="px-4 pt-2 space-y-3">

              {/* Vehicle card */}
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-[#f0a050] text-xs font-semibold uppercase tracking-wider mb-1">My Vehicle</p>
                    {vehicleName ? (
                      <>
                        <p className="text-white text-xl font-bold leading-tight">{vehicleName}</p>
                        {vehicleInfo?.trim_level && (
                          <p className="text-[#888] text-sm">{vehicleInfo.trim_level}</p>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
                          {vehicleInfo?.color && <span className="text-[#ccc] text-sm">{vehicleInfo.color}</span>}
                          {vehicleInfo?.license_plate && (
                            <span className="text-[#ccc] text-sm font-mono tracking-wide">{vehicleInfo.license_plate}</span>
                          )}
                        </div>
                        {vehicleInfo?.vin && (
                          <p className="text-[#333] text-xs font-mono mt-1.5 break-all">VIN: {vehicleInfo.vin}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-[#555] text-sm mt-1">Tap Set Up to add your vehicle details</p>
                    )}
                  </div>
                  <button
                    onClick={() => { setVehicleForm(vehicleInfo || {}); setShowVehicleModal(true); }}
                    className="text-[#f0a050] text-sm font-medium ml-3 shrink-0"
                  >
                    {vehicleName ? 'Edit' : 'Set Up'}
                  </button>
                </div>
              </div>

              {/* Quick stats — 2×2 grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-[#555] text-xs uppercase tracking-wide mb-1.5">Current Mileage</p>
                  <p className="text-white text-2xl font-mono font-bold">
                    {latestMileage ? latestMileage.odometer.toLocaleString() : '—'}
                  </p>
                  {latestMileage && <p className="text-[#555] text-xs mt-0.5">{formatDate(latestMileage.date)}</p>}
                </div>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-[#555] text-xs uppercase tracking-wide mb-1.5">Last Oil Change</p>
                  {lastOilChange ? (
                    <>
                      <p className="text-white text-2xl font-mono font-bold">
                        {lastOilChange.mileage ? lastOilChange.mileage.toLocaleString() : '—'}
                        <span className="text-base font-normal text-[#555]"> mi</span>
                      </p>
                      <p className="text-[#555] text-xs mt-0.5">{formatDate(lastOilChange.date)}</p>
                    </>
                  ) : (
                    <p className="text-[#555] text-sm mt-1">None logged</p>
                  )}
                </div>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-[#555] text-xs uppercase tracking-wide mb-1.5">Avg Fuel Economy</p>
                  {avgMPG !== null ? (
                    <>
                      <p className="text-white text-2xl font-mono font-bold">
                        {avgMPG}
                        <span className="text-base font-normal text-[#555]"> mpg</span>
                      </p>
                      <p className="text-[#555] text-xs mt-0.5">lifetime average</p>
                    </>
                  ) : (
                    <p className="text-[#555] text-sm mt-1">Log 2+ fill-ups</p>
                  )}
                </div>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-[#555] text-xs uppercase tracking-wide mb-1.5">{thisYear} Fuel Spend</p>
                  {yearFuelCost > 0 ? (
                    <>
                      <p className="text-[#ef4444] text-2xl font-mono font-bold">
                        ${yearFuelCost.toFixed(2)}
                      </p>
                      <p className="text-[#555] text-xs mt-0.5">{yearFuel.length} fill-ups</p>
                    </>
                  ) : (
                    <p className="text-[#555] text-sm mt-1">No data yet</p>
                  )}
                </div>
              </div>

              {/* Recent services */}
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <p className="text-white font-semibold">Recent Services</p>
                  {maintenance.length > 3 && (
                    <button onClick={() => setActiveTab(1)} className="text-[#f0a050] text-sm">See all</button>
                  )}
                </div>
                {maintenance.length === 0 ? (
                  <div className="px-4 pb-4">
                    <p className="text-[#555] text-sm">No maintenance logged yet</p>
                    <button
                      onClick={() => { setActiveTab(1); setShowMaintModal(true); }}
                      className="text-[#f0a050] text-sm mt-1"
                    >
                      Log your first service →
                    </button>
                  </div>
                ) : (
                  maintenance.slice(0, 5).map((m, i) => (
                    <div key={m.id} className={`px-4 py-3 ${i < Math.min(maintenance.length, 5) - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white text-sm font-medium">{m.service_type}</p>
                          <p className="text-[#555] text-xs">
                            {formatDate(m.date)}
                            {m.mileage ? ` · ${m.mileage.toLocaleString()} mi` : ''}
                            {m.shop ? ` · ${m.shop}` : ''}
                          </p>
                        </div>
                        {m.cost != null && m.cost > 0 && (
                          <p className="text-[#ccc] text-sm font-mono">${m.cost.toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Year cost summary */}
              {(yearMaint.length > 0 || yearFuel.length > 0) && (
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-[#555] text-xs uppercase tracking-wide mb-3">{thisYear} Cost Summary</p>
                  <div className="space-y-2">
                    {yearMaint.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#888] text-sm">Maintenance ({yearMaint.length} records)</span>
                        <span className="text-[#ef4444] text-sm font-mono">${yearMaintCost.toFixed(2)}</span>
                      </div>
                    )}
                    {yearFuel.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#888] text-sm">Fuel ({yearFuel.length} fill-ups)</span>
                        <span className="text-[#ef4444] text-sm font-mono">${yearFuelCost.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t border-[#1a1a1a] pt-2 flex justify-between">
                      <span className="text-white text-sm font-medium">Total</span>
                      <span className="text-[#ef4444] text-sm font-mono font-bold">
                        ${(yearMaintCost + yearFuelCost).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── MAINTENANCE TAB ── */}
          {activeTab === 1 && (
            <div className="px-4 pt-2 space-y-3">
              {loading && maintenance.length === 0 ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="bg-[#111] border border-[#1a1a1a] rounded-2xl h-16 animate-pulse" />)}
                </div>
              ) : maintenance.length === 0 ? (
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-8 text-center">
                  <p className="text-4xl mb-3">🔧</p>
                  <p className="text-[#ccc] font-medium">No service records yet</p>
                  <p className="text-[#555] text-sm mt-1">Tap + to log your first service</p>
                </div>
              ) : (
                maintenance.map(m => (
                  <div key={m.id} className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setExpandedMaint(expandedMaint === m.id ? null : m.id)}
                      className="w-full px-4 py-3.5 flex items-center justify-between"
                    >
                      <div className="text-left">
                        <p className="text-white font-medium">{m.service_type}</p>
                        <p className="text-[#555] text-xs mt-0.5">
                          {formatDate(m.date)}
                          {m.mileage ? ` · ${m.mileage.toLocaleString()} mi` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {m.cost != null ? (
                          m.cost > 0
                            ? <p className="text-[#ccc] font-mono text-sm">${m.cost.toFixed(2)}</p>
                            : <p className="text-[#555] font-mono text-sm">Free</p>
                        ) : null}
                        <svg className={`w-4 h-4 text-[#333] transition-transform duration-200 ${expandedMaint === m.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>
                    {expandedMaint === m.id && (
                      <div className="px-4 pb-4 pt-1 border-t border-[#1a1a1a] space-y-1.5">
                        {m.shop && <p className="text-[#ccc] text-sm">📍 {m.shop}</p>}
                        {m.notes && <p className="text-[#888] text-sm">{m.notes}</p>}
                        {!m.shop && !m.notes && <p className="text-[#333] text-sm">No additional details</p>}
                        <button onClick={() => setShowDeleteMaint(m.id)} className="text-[#ef4444] text-sm mt-1">
                          Delete record
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── MILEAGE TAB ── */}
          {activeTab === 2 && (
            <div className="px-4 pt-2 space-y-3">
              {loading && mileage.length === 0 ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="bg-[#111] border border-[#1a1a1a] rounded-2xl h-20 animate-pulse" />)}
                </div>
              ) : mileage.length === 0 ? (
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-8 text-center">
                  <p className="text-4xl mb-3">🛣️</p>
                  <p className="text-[#ccc] font-medium">No mileage logged yet</p>
                  <p className="text-[#555] text-sm mt-1">Tap + to log your odometer reading</p>
                </div>
              ) : (
                mileage.map((m, i) => {
                  const prev = mileage[i + 1];
                  const diff = prev ? m.odometer - prev.odometer : null;
                  return (
                    <div key={m.id} className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-white text-xl font-mono font-bold">
                            {m.odometer.toLocaleString()}
                            <span className="text-[#555] text-sm font-normal ml-1">mi</span>
                          </p>
                          <p className="text-[#555] text-sm">{formatDate(m.date)}</p>
                          {diff !== null && diff > 0 && (
                            <p className="text-[#22c55e] text-xs mt-0.5">+{diff.toLocaleString()} mi since previous entry</p>
                          )}
                          {m.notes && <p className="text-[#888] text-xs mt-1">{m.notes}</p>}
                        </div>
                        <button
                          onClick={() => setShowDeleteMileage(m.id)}
                          className="text-[#333] text-sm ml-3 mt-0.5 hover:text-[#ef4444] transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── FUEL TAB ── */}
          {activeTab === 3 && (
            <div className="px-4 pt-2 space-y-3">
              {/* Summary bar */}
              {fuel.length >= 2 && (
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[#555] text-xs uppercase tracking-wide">Lifetime Avg MPG</p>
                      <p className="text-white text-2xl font-mono font-bold mt-0.5">
                        {avgMPG ?? '—'}
                        {avgMPG && <span className="text-[#555] text-base font-normal"> mpg</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#555] text-xs uppercase tracking-wide">{thisYear} Fuel Cost</p>
                      <p className="text-[#ef4444] text-2xl font-mono font-bold mt-0.5">
                        ${yearFuelCost.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {loading && fuel.length === 0 ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="bg-[#111] border border-[#1a1a1a] rounded-2xl h-24 animate-pulse" />)}
                </div>
              ) : fuel.length === 0 ? (
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-8 text-center">
                  <p className="text-4xl mb-3">⛽</p>
                  <p className="text-[#ccc] font-medium">No fuel logs yet</p>
                  <p className="text-[#555] text-sm mt-1">Tap + to log your first fill-up</p>
                </div>
              ) : (
                fuel.map((f, i) => {
                  const mpg = calcMPG(fuel, i);
                  return (
                    <div key={f.id} className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {/* Top row: date + total cost */}
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[#555] text-sm">{formatDate(f.date)}</p>
                            <p className="text-[#ef4444] text-base font-mono font-bold">${f.total_cost.toFixed(2)}</p>
                          </div>
                          {/* Gallons and price */}
                          <p className="text-white font-medium">
                            {Number(f.gallons).toFixed(3)} gal
                            <span className="text-[#555] font-normal"> @ </span>
                            ${Number(f.price_per_gallon).toFixed(3)}/gal
                          </p>
                          {/* Odometer + MPG */}
                          <div className="flex gap-3 mt-1">
                            {f.odometer && (
                              <span className="text-[#555] text-xs">{f.odometer.toLocaleString()} mi</span>
                            )}
                            {mpg !== null && (
                              <span className="text-[#22c55e] text-xs font-mono font-semibold">{mpg} mpg</span>
                            )}
                            {mpg === null && f.odometer && i === fuel.length - 1 && (
                              <span className="text-[#333] text-xs">log another fill-up to calc mpg</span>
                            )}
                          </div>
                          {/* Station */}
                          {f.station && <p className="text-[#555] text-xs mt-0.5">📍 {f.station}</p>}
                          {f.notes && <p className="text-[#888] text-xs mt-0.5">{f.notes}</p>}
                        </div>
                        <button
                          onClick={() => setShowDeleteFuel(f.id)}
                          className="text-[#333] text-sm ml-3 mt-0.5 hover:text-[#ef4444] transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

        </SwipeTabs>

        {/* ── FABs ── */}
        {activeTab === 1 && (
          <button
            onClick={() => { setMaintForm({ date: todayStr(), service_type: 'Oil Change', mileage: '', cost: '', shop: '', notes: '' }); setShowMaintModal(true); }}
            className="fixed bottom-24 right-5 w-14 h-14 bg-[#f0a050] rounded-full flex items-center justify-center shadow-lg z-40 active:scale-95 transition-transform"
          >
            <svg className="w-7 h-7 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
        {activeTab === 2 && (
          <button
            onClick={() => { setMileageForm({ date: todayStr(), odometer: '', notes: '' }); setShowMileageModal(true); }}
            className="fixed bottom-24 right-5 w-14 h-14 bg-[#f0a050] rounded-full flex items-center justify-center shadow-lg z-40 active:scale-95 transition-transform"
          >
            <svg className="w-7 h-7 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
        {activeTab === 3 && (
          <button
            onClick={() => { setFuelForm({ date: todayStr(), gallons: '', price_per_gallon: '', total_cost: '', odometer: '', station: '', notes: '' }); setTotalManual(false); setShowFuelModal(true); }}
            className="fixed bottom-24 right-5 w-14 h-14 bg-[#f0a050] rounded-full flex items-center justify-center shadow-lg z-40 active:scale-95 transition-transform"
          >
            <svg className="w-7 h-7 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}

        {/* ── VEHICLE SETUP MODAL ── */}
        {showVehicleModal && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
            <div className="bg-[#1c1c1e] rounded-2xl w-full max-h-[85vh] overflow-y-auto pb-6">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-[#2a2a2a]">
                <h2 className="text-white font-semibold text-lg">Vehicle Info</h2>
                <button onClick={() => setShowVehicleModal(false)} className="text-[#555] text-2xl leading-none w-8 h-8 flex items-center justify-center">✕</button>
              </div>
              <div className="px-5 pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Year</label>
                    <input type="number" value={vehicleForm.year || ''} onChange={e => setVehicleForm(f => ({ ...f, year: parseInt(e.target.value) || undefined }))} placeholder="2019" className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#f0a050]" />
                  </div>
                  <div>
                    <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Make</label>
                    <input type="text" value={vehicleForm.make || ''} onChange={e => setVehicleForm(f => ({ ...f, make: e.target.value }))} placeholder="Honda" className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#f0a050]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Model</label>
                    <input type="text" value={vehicleForm.model || ''} onChange={e => setVehicleForm(f => ({ ...f, model: e.target.value }))} placeholder="CR-V" className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#f0a050]" />
                  </div>
                  <div>
                    <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Trim</label>
                    <input type="text" value={vehicleForm.trim_level || ''} onChange={e => setVehicleForm(f => ({ ...f, trim_level: e.target.value }))} placeholder="EX-L" className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#f0a050]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Color</label>
                    <input type="text" value={vehicleForm.color || ''} onChange={e => setVehicleForm(f => ({ ...f, color: e.target.value }))} placeholder="White" className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#f0a050]" />
                  </div>
                  <div>
                    <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">License Plate</label>
                    <input type="text" value={vehicleForm.license_plate || ''} onChange={e => setVehicleForm(f => ({ ...f, license_plate: e.target.value }))} placeholder="ABC-1234" className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-[#f0a050]" />
                  </div>
                </div>
                <div>
                  <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">VIN</label>
                  <input type="text" value={vehicleForm.vin || ''} onChange={e => setVehicleForm(f => ({ ...f, vin: e.target.value }))} placeholder="1HGBH41JXMN109186" className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-[#f0a050]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Purchase Date</label>
                    <input type="date" value={vehicleForm.purchase_date || ''} onChange={e => setVehicleForm(f => ({ ...f, purchase_date: e.target.value }))} className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#f0a050]" />
                  </div>
                  <div>
                    <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Purchase Price</label>
                    <input type="number" value={vehicleForm.purchase_price || ''} onChange={e => setVehicleForm(f => ({ ...f, purchase_price: parseFloat(e.target.value) || undefined }))} placeholder="25000" className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#f0a050]" />
                  </div>
                </div>
                <button onClick={saveVehicleInfo} disabled={saving} className="w-full bg-[#f0a050] text-black font-semibold py-3 rounded-xl disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Vehicle'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── LOG SERVICE MODAL ── */}
        {showMaintModal && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
            <div className="bg-[#1c1c1e] rounded-2xl w-full max-h-[85vh] overflow-y-auto pb-6">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-[#2a2a2a]">
                <h2 className="text-white font-semibold text-lg">Log Service</h2>
                <button onClick={() => setShowMaintModal(false)} className="text-[#555] text-2xl leading-none w-8 h-8 flex items-center justify-center">✕</button>
              </div>
              <div className="px-5 pt-4 space-y-4">
                <div>
                  <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Service Type</label>
                  <select value={maintForm.service_type} onChange={e => setMaintForm(f => ({ ...f, service_type: e.target.value }))} className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#f0a050]">
                    {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Date</label>
                  <input type="date" value={maintForm.date} onChange={e => setMaintForm(f => ({ ...f, date: e.target.value }))} className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#f0a050]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Mileage</label>
                    <input type="number" value={maintForm.mileage} onChange={e => setMaintForm(f => ({ ...f, mileage: e.target.value }))} placeholder="45231" className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-[#f0a050]" />
                  </div>
                  <div>
                    <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Cost ($)</label>
                    <input type="number" value={maintForm.cost} onChange={e => setMaintForm(f => ({ ...f, cost: e.target.value }))} placeholder="45.00" step="0.01" className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-[#f0a050]" />
                  </div>
                </div>
                <div>
                  <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Shop / Location</label>
                  <input type="text" value={maintForm.shop} onChange={e => setMaintForm(f => ({ ...f, shop: e.target.value }))} placeholder="Jiffy Lube, Dealer, DIY..." className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#f0a050]" />
                </div>
                <div>
                  <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Notes</label>
                  <textarea value={maintForm.notes} onChange={e => setMaintForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." rows={2} className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm outline-none resize-none focus:border-[#f0a050]" />
                </div>
                <button onClick={saveMaintenance} disabled={saving || !maintForm.date || !maintForm.service_type} className="w-full bg-[#f0a050] text-black font-semibold py-3 rounded-xl disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Service Record'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── LOG MILEAGE MODAL ── */}
        {showMileageModal && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
            <div className="bg-[#1c1c1e] rounded-2xl w-full max-h-[85vh] overflow-y-auto pb-6">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-[#2a2a2a]">
                <h2 className="text-white font-semibold text-lg">Log Mileage</h2>
                <button onClick={() => setShowMileageModal(false)} className="text-[#555] text-2xl leading-none w-8 h-8 flex items-center justify-center">✕</button>
              </div>
              <div className="px-5 pt-4 space-y-4">
                <div>
                  <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Date</label>
                  <input type="date" value={mileageForm.date} onChange={e => setMileageForm(f => ({ ...f, date: e.target.value }))} className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#f0a050]" />
                </div>
                <div>
                  <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Odometer Reading (miles)</label>
                  <input type="number" value={mileageForm.odometer} onChange={e => setMileageForm(f => ({ ...f, odometer: e.target.value }))} placeholder="45231" className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-2xl font-mono outline-none focus:border-[#f0a050]" />
                </div>
                <div>
                  <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Notes (optional)</label>
                  <input type="text" value={mileageForm.notes} onChange={e => setMileageForm(f => ({ ...f, notes: e.target.value }))} placeholder="Before trip, after oil change..." className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#f0a050]" />
                </div>
                <button onClick={saveMileage} disabled={saving || !mileageForm.date || !mileageForm.odometer} className="w-full bg-[#f0a050] text-black font-semibold py-3 rounded-xl disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Mileage'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── LOG FUEL MODAL ── */}
        {showFuelModal && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
            <div className="bg-[#1c1c1e] rounded-2xl w-full max-h-[85vh] overflow-y-auto pb-6">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-[#2a2a2a]">
                <h2 className="text-white font-semibold text-lg">Log Fill-Up</h2>
                <button onClick={() => setShowFuelModal(false)} className="text-[#555] text-2xl leading-none w-8 h-8 flex items-center justify-center">✕</button>
              </div>
              <div className="px-5 pt-4 space-y-4">
                <div>
                  <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Date</label>
                  <input type="date" value={fuelForm.date} onChange={e => setFuelForm(f => ({ ...f, date: e.target.value }))} className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#f0a050]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Gallons</label>
                    <input
                      type="number"
                      value={fuelForm.gallons}
                      onChange={e => setFuelForm(f => ({ ...f, gallons: e.target.value }))}
                      placeholder="12.345"
                      step="0.001"
                      className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-[#f0a050]"
                    />
                  </div>
                  <div>
                    <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Price / Gal</label>
                    <input
                      type="number"
                      value={fuelForm.price_per_gallon}
                      onChange={e => setFuelForm(f => ({ ...f, price_per_gallon: e.target.value }))}
                      placeholder="3.459"
                      step="0.001"
                      className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-[#f0a050]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">
                    Total Cost
                    {!totalManual && fuelForm.gallons && fuelForm.price_per_gallon && (
                      <span className="text-[#f0a050] ml-2 normal-case">auto-calculated</span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={fuelForm.total_cost}
                    onChange={e => { setTotalManual(true); setFuelForm(f => ({ ...f, total_cost: e.target.value })); }}
                    placeholder="42.67"
                    step="0.01"
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-xl font-mono font-bold outline-none focus:border-[#f0a050]"
                  />
                  {totalManual && (
                    <button
                      onClick={() => { setTotalManual(false); }}
                      className="text-[#f0a050] text-xs mt-1"
                    >
                      ↺ Reset to calculated
                    </button>
                  )}
                </div>
                <div>
                  <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Odometer (optional)</label>
                  <input type="number" value={fuelForm.odometer} onChange={e => setFuelForm(f => ({ ...f, odometer: e.target.value }))} placeholder="45231" className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-[#f0a050]" />
                  <p className="text-[#333] text-xs mt-1">Required to calculate MPG between fill-ups</p>
                </div>
                <div>
                  <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Station (optional)</label>
                  <input type="text" value={fuelForm.station} onChange={e => setFuelForm(f => ({ ...f, station: e.target.value }))} placeholder="Wawa, Shell, Sheetz..." className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#f0a050]" />
                </div>
                <div>
                  <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Notes (optional)</label>
                  <input type="text" value={fuelForm.notes} onChange={e => setFuelForm(f => ({ ...f, notes: e.target.value }))} placeholder="Premium, highway trip..." className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#f0a050]" />
                </div>
                <button
                  onClick={saveFuel}
                  disabled={saving || !fuelCanSave}
                  className="w-full bg-[#f0a050] text-black font-semibold py-3 rounded-xl disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Fill-Up'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── DELETE MAINTENANCE CONFIRM ── */}
        {showDeleteMaint && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
            <div className="bg-[#1c1c1e] rounded-2xl w-full p-5 space-y-3">
              <p className="text-white font-semibold text-center">Delete this service record?</p>
              <p className="text-[#555] text-sm text-center">This cannot be undone.</p>
              <button onClick={() => deleteMaintenance(showDeleteMaint)} className="w-full bg-[#ef4444] text-white font-semibold py-3 rounded-xl">Delete</button>
              <button onClick={() => setShowDeleteMaint(null)} className="w-full bg-[#1a1a1a] text-[#ccc] font-medium py-3 rounded-xl">Cancel</button>
            </div>
          </div>
        )}

        {/* ── DELETE MILEAGE CONFIRM ── */}
        {showDeleteMileage && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
            <div className="bg-[#1c1c1e] rounded-2xl w-full p-5 space-y-3">
              <p className="text-white font-semibold text-center">Delete this mileage entry?</p>
              <p className="text-[#555] text-sm text-center">This cannot be undone.</p>
              <button onClick={() => deleteMileage(showDeleteMileage)} className="w-full bg-[#ef4444] text-white font-semibold py-3 rounded-xl">Delete</button>
              <button onClick={() => setShowDeleteMileage(null)} className="w-full bg-[#1a1a1a] text-[#ccc] font-medium py-3 rounded-xl">Cancel</button>
            </div>
          </div>
        )}

        {/* ── DELETE FUEL CONFIRM ── */}
        {showDeleteFuel && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
            <div className="bg-[#1c1c1e] rounded-2xl w-full p-5 space-y-3">
              <p className="text-white font-semibold text-center">Delete this fill-up?</p>
              <p className="text-[#555] text-sm text-center">This cannot be undone.</p>
              <button onClick={() => deleteFuel(showDeleteFuel)} className="w-full bg-[#ef4444] text-white font-semibold py-3 rounded-xl">Delete</button>
              <button onClick={() => setShowDeleteFuel(null)} className="w-full bg-[#1a1a1a] text-[#ccc] font-medium py-3 rounded-xl">Cancel</button>
            </div>
          </div>
        )}

      </div>
    </PullToRefresh>
  );
}