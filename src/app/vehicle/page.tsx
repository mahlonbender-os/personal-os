'use client';

import { useState, useEffect, useRef } from 'react';
import PullToRefresh from '@/components/PullToRefresh';

const TABS = ['Overview', 'Fuel', 'Maintenance'];
const SERVICE_TYPES = [
  'Oil Change', 'Tire Rotation', 'Tire Replacement', 'Brake Service',
  'Air Filter', 'Cabin Filter', 'Battery Replacement', 'Transmission Service',
  'Coolant Flush', 'Inspection', 'Registration / Tags', 'Wiper Blades',
  'Detailing', 'Alignment', 'Spark Plugs', 'Other',
];
const OIL_INTERVALS = [3000, 5000, 7500, 10000];

// ─── Places autocomplete (inline) ───────────────────────────────────────────
function PlacesInput({ value, onChange, placeholder = 'Search location...' }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<any>(null);

  async function onInput(val: string) {
    onChange(val);
    if (timer.current) clearTimeout(timer.current);
    if (val.length < 2) { setPredictions([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?input=${encodeURIComponent(val)}`);
        const data = await res.json();
        const list = (data.predictions || []).map((p: any) => ({
          place_id: p.placeId || p.place_id || '',
          description: p.description,
        }));
        setPredictions(list);
        setOpen(list.length > 0);
      } catch {}
    }, 350);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={e => onInput(e.target.value)}
        onFocus={() => predictions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder}
        className="w-full bg-[#222] text-white rounded-xl px-3 py-2.5 text-sm border border-[#333] outline-none focus:border-[#f0a050] placeholder-[#555]"
      />
      {open && (
        <div className="absolute top-full left-0 right-0 bg-[#1c1c1e] border border-[#333] rounded-xl mt-1 z-[60] max-h-44 overflow-y-auto shadow-2xl">
          {predictions.map((p, i) => (
            <button
              key={p.place_id || i}
              onMouseDown={() => { onChange(p.description); setPredictions([]); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 text-sm border-b border-[#2a2a2a] last:border-0 active:bg-[#222]"
            >
              <span className="text-[#f0a050] mr-2">📍</span>
              <span className="text-[#ccc]">{p.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number | null | undefined) =>
  n == null ? '—' : `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmtDate(d: string) {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  return `${parseInt(parts[1])}/${parseInt(parts[2])}/${parts[0]}`;
}

function renewalColor(d: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(d + 'T00:00:00').getTime() - today.getTime()) / 86400000);
  return days < 0 ? '#ef4444' : days < 30 ? '#f0a050' : '#22c55e';
}

function mapsUrl(q: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(q)}`;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function VehiclePage() {
  const [activeTab, setActiveTab] = useState(0);

  // Data
  const [vehicleInfo, setVehicleInfo] = useState<any>(null);
  const [fuelEntries, setFuelEntries] = useState<any[]>([]);
  const [maintEntries, setMaintEntries] = useState<any[]>([]);

  // Setup modal
  const [showSetup, setShowSetup] = useState(false);
  const [setupForm, setSetupForm] = useState<any>({
    year: new Date().getFullYear(), make: '', model: '', trim_level: '', color: '',
    vin: '', license_plate: '', purchase_date: '', purchase_price: undefined,
    oil_change_interval: 5000, registration_expires: '', inspection_expires: '',
  });
  const [setupSaving, setSetupSaving] = useState(false);

  // Add fuel modal
  const [showAddFuel, setShowAddFuel] = useState(false);
  const [addFuel, setAddFuel] = useState({ date: '', gallons: '', price_per_gallon: '', total_cost: '', odometer: '', station: '', notes: '' });
  const [fuelAutoCalc, setFuelAutoCalc] = useState(true);
  const [fuelSaving, setFuelSaving] = useState(false);
  const [deleteFuelId, setDeleteFuelId] = useState<string | null>(null);

  // Add maintenance modal
  const [showAddMaint, setShowAddMaint] = useState(false);
  const [addMaint, setAddMaint] = useState({ date: '', service_type: 'Oil Change', mileage: '', cost: '', shop: '', notes: '' });
  const [maintSaving, setMaintSaving] = useState(false);
  const [deleteMaintId, setDeleteMaintId] = useState<string | null>(null);
  const [expandedMaint, setExpandedMaint] = useState(new Set<string>());

  // Edit fuel modal
  const [editFuelEntry, setEditFuelEntry] = useState<any | null>(null);
  const [editFuel, setEditFuel] = useState({ date: '', gallons: '', price_per_gallon: '', total_cost: '', odometer: '', station: '', notes: '' });
  const [editFuelAutoCalc, setEditFuelAutoCalc] = useState(true);
  const [editFuelSaving, setEditFuelSaving] = useState(false);

  // Edit maintenance modal
  const [editMaintEntry, setEditMaintEntry] = useState<any | null>(null);
  const [editMaint, setEditMaint] = useState({ date: '', service_type: 'Oil Change', mileage: '', cost: '', shop: '', notes: '' });
  const [editMaintSaving, setEditMaintSaving] = useState(false);

  // Screenshot import modal
  const [showImport, setShowImport] = useState(false);
  const [importType, setImportType] = useState<'fuel' | 'maintenance'>('fuel');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageType, setImageType] = useState('image/jpeg');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [importRecords, setImportRecords] = useState<any[]>([]);
  const [importSaving, setImportSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ─── Data fetching ─────────────────────────────────────────────────────────
  async function fetchAll() {
    try {
      const [ri, rf, rm] = await Promise.all([
        fetch('/api/vehicle/info'),
        fetch('/api/vehicle/fuel'),
        fetch('/api/vehicle/maintenance'),
      ]);
      if (ri.ok) { const d = await ri.json(); setVehicleInfo(d); localStorage.setItem('vehicle-info', JSON.stringify(d)); }
      if (rf.ok) { const d = await rf.json(); setFuelEntries(d); localStorage.setItem('vehicle-fuel', JSON.stringify(d)); }
      if (rm.ok) { const d = await rm.json(); setMaintEntries(d); localStorage.setItem('vehicle-maint', JSON.stringify(d)); }
    } catch {}
  }

  useEffect(() => {
    try {
      const i = localStorage.getItem('vehicle-info'); if (i) setVehicleInfo(JSON.parse(i));
      const f = localStorage.getItem('vehicle-fuel'); if (f) setFuelEntries(JSON.parse(f));
      const m = localStorage.getItem('vehicle-maint'); if (m) setMaintEntries(JSON.parse(m));
    } catch {}
    fetchAll();
  }, []);

  // ─── Derived calculations ──────────────────────────────────────────────────
  const allOdos = [...fuelEntries.map(e => e.odometer), ...maintEntries.map(e => e.mileage)].filter(Boolean);
  const currentMileage = allOdos.length > 0 ? Math.max(...allOdos) : null;

  const lastOilChange = [...maintEntries]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .find(e => e.service_type === 'Oil Change');
  const nextOilChangeMiles = lastOilChange && vehicleInfo?.oil_change_interval
    ? (lastOilChange.mileage || 0) + (vehicleInfo.oil_change_interval || 5000)
    : null;
  const milesUntilOil = nextOilChangeMiles != null && currentMileage != null
    ? nextOilChangeMiles - currentMileage
    : null;

  const fuelWithOdo = [...fuelEntries].filter(e => e.odometer && e.gallons).sort((a, b) => a.odometer - b.odometer);
  let totalMiles = 0, totalGallons = 0;
  for (let i = 1; i < fuelWithOdo.length; i++) {
    const mi = fuelWithOdo[i].odometer - fuelWithOdo[i - 1].odometer;
    if (mi > 0) { totalMiles += mi; totalGallons += fuelWithOdo[i].gallons; }
  }
  const lifetimeMPG = totalGallons > 0 ? totalMiles / totalGallons : null;

  const fuelEntriesWithMPG = [...fuelEntries]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map(e => {
      const idx = fuelWithOdo.findIndex(x => x.id === e.id);
      let mpg = null;
      if (idx > 0) {
        const mi = fuelWithOdo[idx].odometer - fuelWithOdo[idx - 1].odometer;
        if (mi > 0 && fuelWithOdo[idx].gallons > 0) mpg = mi / fuelWithOdo[idx].gallons;
      }
      return { ...e, mpg };
    });

  const yr = String(new Date().getFullYear());
  const yrFuel = fuelEntries.filter(e => e.date?.startsWith(yr));
  const yrMaint = maintEntries.filter(e => e.date?.startsWith(yr));
  const yrFuelSpend = yrFuel.reduce((s, e) => s + (e.total_cost || 0), 0);
  const yrMaintSpend = yrMaint.reduce((s, e) => s + (e.cost || 0), 0);
  const yrTotal = yrFuelSpend + yrMaintSpend;

  const yrFuelWithOdo = yrFuel.filter(e => e.odometer).sort((a, b) => b.odometer - a.odometer);
  let costPerMile = null;
  if (yrFuelWithOdo.length >= 2 && yrTotal > 0) {
    const miDriven = yrFuelWithOdo[0].odometer - yrFuelWithOdo[yrFuelWithOdo.length - 1].odometer;
    if (miDriven > 0) costPerMile = yrTotal / miDriven;
  }

  const hasSetup = !!(vehicleInfo?.make);

  // ─── Vehicle setup ─────────────────────────────────────────────────────────
  async function saveSetup() {
    setSetupSaving(true);
    try {
      await fetch('/api/vehicle/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setupForm),
      });
      await fetchAll();
      setShowSetup(false);
    } catch {} finally { setSetupSaving(false); }
  }

  function openSetup() {
    setSetupForm(vehicleInfo ? {
      year: vehicleInfo.year, make: vehicleInfo.make || '', model: vehicleInfo.model || '',
      trim_level: vehicleInfo.trim_level || '', color: vehicleInfo.color || '',
      vin: vehicleInfo.vin || '', license_plate: vehicleInfo.license_plate || '',
      purchase_date: vehicleInfo.purchase_date || '', purchase_price: vehicleInfo.purchase_price,
      oil_change_interval: vehicleInfo.oil_change_interval || 5000,
      registration_expires: vehicleInfo.registration_expires || '',
      inspection_expires: vehicleInfo.inspection_expires || '',
    } : {
      year: new Date().getFullYear(), make: '', model: '', trim_level: '', color: '',
      vin: '', license_plate: '', purchase_date: '', purchase_price: undefined,
      oil_change_interval: 5000, registration_expires: '', inspection_expires: '',
    });
    setShowSetup(true);
  }

  // ─── Fuel CRUD ─────────────────────────────────────────────────────────────
  function handleAddFuelField(field: string, val: string) {
    const next = { ...addFuel, [field]: val };
    if (fuelAutoCalc && (field === 'gallons' || field === 'price_per_gallon')) {
      const g = parseFloat(field === 'gallons' ? val : addFuel.gallons);
      const p = parseFloat(field === 'price_per_gallon' ? val : addFuel.price_per_gallon);
      if (!isNaN(g) && !isNaN(p)) next.total_cost = (g * p).toFixed(2);
    }
    setAddFuel(next);
  }

  async function saveAddFuel() {
    setFuelSaving(true);
    try {
      await fetch('/api/vehicle/fuel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: addFuel.date, gallons: parseFloat(addFuel.gallons) || null,
          price_per_gallon: parseFloat(addFuel.price_per_gallon) || null,
          total_cost: parseFloat(addFuel.total_cost) || null,
          odometer: parseInt(addFuel.odometer) || null,
          station: addFuel.station || null, notes: addFuel.notes || null,
        }),
      });
      await fetchAll();
      setShowAddFuel(false);
    } catch {} finally { setFuelSaving(false); }
  }

  function openAddFuel() {
    setAddFuel({ date: new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' }), gallons: '', price_per_gallon: '', total_cost: '', odometer: '', station: '', notes: '' });
    setFuelAutoCalc(true);
    setShowAddFuel(true);
  }

  async function deleteFuel(id: string) {
    try { await fetch(`/api/vehicle/fuel?id=${id}`, { method: 'DELETE' }); await fetchAll(); } catch {}
    setDeleteFuelId(null);
  }

  // Edit fuel
  function handleEditFuelField(field: string, val: string) {
    const next = { ...editFuel, [field]: val };
    if (editFuelAutoCalc && (field === 'gallons' || field === 'price_per_gallon')) {
      const g = parseFloat(field === 'gallons' ? val : editFuel.gallons);
      const p = parseFloat(field === 'price_per_gallon' ? val : editFuel.price_per_gallon);
      if (!isNaN(g) && !isNaN(p)) next.total_cost = (g * p).toFixed(2);
    }
    setEditFuel(next);
  }

  async function saveEditFuel() {
    if (!editFuelEntry) return;
    setEditFuelSaving(true);
    try {
      await fetch(`/api/vehicle/fuel?id=${editFuelEntry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: editFuel.date, gallons: parseFloat(editFuel.gallons) || null,
          price_per_gallon: parseFloat(editFuel.price_per_gallon) || null,
          total_cost: parseFloat(editFuel.total_cost) || null,
          odometer: parseInt(editFuel.odometer) || null,
          station: editFuel.station || null, notes: editFuel.notes || null,
        }),
      });
      await fetchAll();
      setEditFuelEntry(null);
    } catch {} finally { setEditFuelSaving(false); }
  }

  // ─── Maintenance CRUD ──────────────────────────────────────────────────────
  function openAddMaint() {
    setAddMaint({
      date: new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' }),
      service_type: 'Oil Change',
      mileage: currentMileage ? String(currentMileage) : '',
      cost: '', shop: '', notes: '',
    });
    setShowAddMaint(true);
  }

  async function saveAddMaint() {
    setMaintSaving(true);
    try {
      await fetch('/api/vehicle/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: addMaint.date, service_type: addMaint.service_type,
          mileage: parseInt(addMaint.mileage) || null,
          cost: parseFloat(addMaint.cost) || null,
          shop: addMaint.shop || null, notes: addMaint.notes || null,
        }),
      });
      await fetchAll();
      setShowAddMaint(false);
    } catch {} finally { setMaintSaving(false); }
  }

  async function deleteMaint(id: string) {
    try { await fetch(`/api/vehicle/maintenance?id=${id}`, { method: 'DELETE' }); await fetchAll(); } catch {}
    setDeleteMaintId(null);
  }

  async function saveEditMaint() {
    if (!editMaintEntry) return;
    setEditMaintSaving(true);
    try {
      await fetch(`/api/vehicle/maintenance?id=${editMaintEntry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: editMaint.date, service_type: editMaint.service_type,
          mileage: parseInt(editMaint.mileage) || null,
          cost: parseFloat(editMaint.cost) || null,
          shop: editMaint.shop || null, notes: editMaint.notes || null,
        }),
      });
      await fetchAll();
      setEditMaintEntry(null);
    } catch {} finally { setEditMaintSaving(false); }
  }

  // ─── Screenshot import ─────────────────────────────────────────────────────
  function openImport(type: 'fuel' | 'maintenance') {
    setImportType(type);
    setImageBase64(null); setImagePreview(null); setImportRecords([]);
    setShowImport(true);
  }

  async function extractRecords() {
    if (!imageBase64) return;
    setExtracting(true); setImportRecords([]);
    try {
      const res = await fetch('/api/vehicle/import-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, imageType, importType }),
      });
      const data = await res.json();
      if (data.records) {
        setImportRecords(data.records.map((r: any, i: number) => ({ ...r, _idx: i, _keep: true })));
      } else { alert(data.error || 'No records found in the image'); }
    } catch (e: any) { alert('Error extracting records: ' + e.message); }
    setExtracting(false);
  }

  async function saveImported() {
    const toSave = importRecords.filter(r => r._keep);
    if (toSave.length === 0) return;
    setImportSaving(true);
    try {
      const url = importType === 'fuel' ? '/api/vehicle/fuel' : '/api/vehicle/maintenance';
      for (const r of toSave) {
        const { _idx, _keep, ...body } = r;
        await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      }
      await fetchAll();
      setShowImport(false);
      setActiveTab(importType === 'fuel' ? 1 : 2);
      window.scrollTo(0, 0);
    } catch (e: any) { alert('Error saving records: ' + e.message); }
    setImportSaving(false);
  }

  return (
    <>
      <PullToRefresh onRefresh={fetchAll}>
        <div className="pb-24 min-h-screen bg-black">

          {/* Sticky context header row perfectly matching Knox and Investments template */}
          <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-[#1a1a1a]">
            <div className="flex items-center justify-between px-4 pt-14 pb-3">
              <div>
                <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, system-ui, sans-serif' }}>
                  {hasSetup ? `${vehicleInfo.year} ${vehicleInfo.make}` : 'Vehicle'}
                </h1>
                <p className="text-[10px] text-[#555] mt-0.5">
                  {hasSetup ? (vehicleInfo.license_plate || 'No plate set') : 'Set up vehicle metrics'}
                </p>
              </div>

              {/* Context-aware inline amber text trigger button */}
              <button
                onClick={() => {
                  navigator.vibrate && navigator.vibrate(8);
                  if (activeTab === 0) openSetup();
                  if (activeTab === 1) openAddFuel();
                  if (activeTab === 2) openAddMaint();
                }}
                className="text-sm font-semibold text-[#f0a050] active:opacity-70 transition-opacity px-2 py-1"
              >
                {activeTab === 0 ? (hasSetup ? 'Edit Info' : 'Set Up') : activeTab === 1 ? 'Log Fuel' : 'Log Service'}
              </button>
            </div>

            {/* Tab switcher bar */}
            <div className="flex border-t border-[#1a1a1a]">
              {TABS.map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(i); window.scrollTo(0, 0); navigator.vibrate && navigator.vibrate(8); }}
                  className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                    activeTab === i ? 'text-[#f0a050] border-b-2 border-[#f0a050]' : 'text-[#555]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* ─── OVERVIEW TAB ────────────────────────────────────────────── */}
          {activeTab === 0 && (
            <div className="px-4 pt-4 space-y-3">

              {/* Vehicle detailed parameters snapshot */}
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                <p className="text-[#f0a050] text-xs font-semibold uppercase tracking-wider mb-2">Specifications</p>
                {hasSetup ? (
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <div>
                      <p className="text-[#555] text-xs uppercase">Model</p>
                      <p className="text-white font-medium">{vehicleInfo.model} {vehicleInfo.trim_level && `(${vehicleInfo.trim_level})`}</p>
                    </div>
                    <div>
                      <p className="text-[#555] text-xs uppercase">Color</p>
                      <p className="text-white font-medium">{vehicleInfo.color || '—'}</p>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-[#1a1a1a]/40 mt-1">
                      <p className="text-[#555] text-xs uppercase">VIN Identifier</p>
                      <p className="text-white font-mono text-xs mt-0.5 tracking-wider">{vehicleInfo.vin || '—'}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[#555] text-sm py-2">Tap Set Up in the top header to configure details</p>
                )}
              </div>

              {/* Stats 2×2 Telemetry Block */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-[#555] text-xs uppercase tracking-wide mb-1.5">Current Odometer</p>
                  <p className="text-white text-2xl font-mono font-bold">{currentMileage ? currentMileage.toLocaleString() : '—'}</p>
                  {currentMileage != null && <p className="text-[#555] text-xs mt-0.5">total miles</p>}
                </div>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-[#555] text-xs uppercase tracking-wide mb-1.5">Next Oil Change</p>
                  {nextOilChangeMiles ? (
                    <>
                      <p className="text-white text-xl font-mono font-bold">{nextOilChangeMiles.toLocaleString()}</p>
                      {milesUntilOil != null && (
                        <p className="text-xs mt-0.5 font-mono" style={{ color: milesUntilOil < 0 ? '#ef4444' : milesUntilOil < 500 ? '#f0a050' : '#22c55e' }}>
                          {milesUntilOil > 0 ? `${milesUntilOil.toLocaleString()} mi left` : `${Math.abs(milesUntilOil).toLocaleString()} mi overdue`}
                        </p>
                      )}
                    </>
                  ) : <p className="text-[#555] text-sm mt-1">No log detected</p>}
                </div>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-[#555] text-xs uppercase tracking-wide mb-1.5">Fuel Efficiency</p>
                  {lifetimeMPG ? (
                    <>
                      <p className="text-white text-2xl font-mono font-bold">{lifetimeMPG.toFixed(1)}</p>
                      <p className="text-[#555] text-xs mt-0.5">Lifetime MPG</p>
                    </>
                  ) : <p className="text-[#555] text-sm mt-1">Requires 2+ logs</p>}
                </div>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-[#555] text-xs uppercase tracking-wide mb-1.5">{yr} Cost Matrix</p>
                  {costPerMile ? (
                    <>
                      <p className="text-white text-2xl font-mono font-bold">${costPerMile.toFixed(2)}</p>
                      <p className="text-[#555] text-xs mt-0.5">per driving mile</p>
                    </>
                  ) : <p className="text-[#555] text-sm mt-1">No calculations</p>}
                </div>
              </div>

              {/* Renewals Expirations alerts panel */}
              {(vehicleInfo?.registration_expires || vehicleInfo?.inspection_expires) && (
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-white font-semibold mb-3">Regulatory Renewals</p>
                  <div className="space-y-2">
                    {vehicleInfo.registration_expires && (
                      <div className="flex items-center justify-between">
                        <p className="text-[#ccc] text-sm">Registration Expiry</p>
                        <p className="text-sm font-mono" style={{ color: renewalColor(vehicleInfo.registration_expires) }}>{fmtDate(vehicleInfo.registration_expires)}</p>
                      </div>
                    )}
                    {vehicleInfo.inspection_expires && (
                      <div className="flex items-center justify-between">
                        <p className="text-[#ccc] text-sm">Inspection Stickers</p>
                        <p className="text-sm font-mono" style={{ color: renewalColor(vehicleInfo.inspection_expires) }}>{fmtDate(vehicleInfo.inspection_expires)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Services List module view */}
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <p className="text-white font-semibold">Recent Service Records</p>
                  {maintEntries.length > 5 && (
                    <button onClick={() => { setActiveTab(2); window.scrollTo(0, 0); }} className="text-[#f0a050] text-xs">See all</button>
                  )}
                </div>
                <div className="px-4 pb-4">
                  {maintEntries.length === 0 ? (
                    <>
                      <p className="text-[#555] text-sm">No maintenance logged yet</p>
                      <button
                        onClick={() => { setActiveTab(2); window.scrollTo(0, 0); setTimeout(openAddMaint, 50); }}
                        className="text-[#f0a050] text-sm mt-1"
                      >
                        Log your first service →
                      </button>
                    </>
                  ) : (
                    <div className="space-y-2">
                      {maintEntries.slice(0, 5).map(e => (
                        <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-[#1a1a1a] last:border-0">
                          <div>
                            <p className="text-white text-sm">{e.service_type}</p>
                            <p className="text-[#555] text-xs">{fmtDate(e.date)}{e.mileage ? ` · ${e.mileage.toLocaleString()} mi` : ''}</p>
                          </div>
                          <p className="text-[#ccc] text-sm font-mono">{e.cost ? fmt(e.cost) : '—'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Annualized Cost calculation summary */}
              {yrTotal > 0 && (
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-white font-semibold mb-3">{yr} Running Cost Summary</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <p className="text-[#ccc] text-sm">Fuel Fleet Spend</p>
                      <p className="text-[#ccc] text-sm font-mono">{fmt(yrFuelSpend)}</p>
                    </div>
                    <div className="flex justify-between">
                      <p className="text-[#ccc] text-sm">Maintenance Maintenance</p>
                      <p className="text-[#ccc] text-sm font-mono">{fmt(yrMaintSpend)}</p>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-[#1a1a1a]">
                      <p className="text-white text-sm font-semibold">Aggregate Cost Total</p>
                      <p className="text-white text-sm font-mono font-semibold">{fmt(yrTotal)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── FUEL TAB ────────────────────────────────────────────────── */}
          {activeTab === 1 && (
            <div className="px-4 pt-4 space-y-3">

              {/* Screenshot capture OCR ingestion router trigger */}
              <button
                onClick={() => openImport('fuel')}
                className="w-full py-3 rounded-xl border border-[#2a2a2a] text-[#f0a050] text-sm font-medium flex items-center justify-center gap-2 active:bg-[#111]"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Import Fill-Up History from Screenshot
              </button>

              {/* Totals Summary dashboard pill info */}
              {fuelEntries.length >= 2 && lifetimeMPG && (
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-[#555] text-xs uppercase tracking-wide">Lifetime Avg MPG</p>
                      <p className="text-white text-2xl font-mono font-bold mt-1">{lifetimeMPG.toFixed(1)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#555] text-xs uppercase tracking-wide">{yr} Total Fuel Spend</p>
                      <p className="text-white text-2xl font-mono font-bold mt-1">{fmt(yrFuelSpend)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Fill-up list rows tracking layout items */}
              {fuelEntriesWithMPG.length === 0 ? (
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 text-center">
                  <p className="text-[#555] text-sm">No fill-ups logged yet</p>
                  <p className="text-[#333] text-xs mt-1">Tap Log Fuel above to record records</p>
                </div>
              ) : (
                fuelEntriesWithMPG.map(e => (
                  <div key={e.id} className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-semibold font-mono">{fmt(e.total_cost)}</p>
                          {e.mpg && (
                            <span className="text-[#22c55e] text-xs font-mono bg-[#22c55e]/10 px-1.5 py-0.5 rounded-md">
                              {e.mpg.toFixed(1)} MPG
                            </span>
                          )}
                        </div>
                        <p className="text-[#555] text-xs mt-0.5">
                          {e.gallons ? `${Number(e.gallons).toFixed(3)} gal` : ''}
                          {e.price_per_gallon ? ` @ $${Number(e.price_per_gallon).toFixed(3)}/gal` : ''}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <p className="text-[#555] text-xs">{fmtDate(e.date)}</p>
                          {e.odometer ? <p className="text-[#555] text-xs">{e.odometer.toLocaleString()} mi</p> : null}
                        </div>
                        {e.station ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <p className="text-[#888] text-xs truncate flex-1">{e.station}</p>
                            <button onClick={() => window.open(mapsUrl(e.station), '_blank')} className="text-[#f0a050] shrink-0" aria-label="View on Google Maps">
                              <span className="text-xs">📍</span>
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <button
                          onClick={() => {
                            setEditFuelEntry(e);
                            setEditFuel({ date: e.date || '', gallons: e.gallons != null ? String(e.gallons) : '', price_per_gallon: e.price_per_gallon != null ? String(e.price_per_gallon) : '', total_cost: e.total_cost != null ? String(e.total_cost) : '', odometer: e.odometer != null ? String(e.odometer) : '', station: e.station || '', notes: e.notes || '' });
                            setEditFuelAutoCalc(false);
                          }}
                          className="text-[#555] active:text-[#f0a050] p-1"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button onClick={() => setDeleteFuelId(e.id)} className="text-[#333] active:text-[#ef4444] p-1">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ─── MAINTENANCE TAB ──────────────────────────────────────────── */}
          {activeTab === 2 && (
            <div className="px-4 pt-4 space-y-3">

              {/* Maintenance screenshot capture system */}
              <button
                onClick={() => openImport('maintenance')}
                className="w-full py-3 rounded-xl border border-[#2a2a2a] text-[#f0a050] text-sm font-medium flex items-center justify-center gap-2 active:bg-[#111]"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Import Service History from Screenshot
              </button>

              {/* Service records elements rendering loop */}
              {maintEntries.length === 0 ? (
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 text-center">
                  <p className="text-[#555] text-sm">No service records found</p>
                  <p className="text-[#333] text-xs mt-1">Tap Log Service above to save</p>
                </div>
              ) : (
                maintEntries.map(e => {
                  const expanded = expandedMaint.has(e.id);
                  return (
                    <div key={e.id} className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
                      <div
                        className="p-4 flex items-center justify-between cursor-pointer active:bg-[#161616]"
                        onClick={() => {
                          const next = new Set(expandedMaint);
                          expanded ? next.delete(e.id) : next.add(e.id);
                          setExpandedMaint(next);
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold">{e.service_type}</p>
                          <p className="text-[#555] text-xs mt-0.5">{fmtDate(e.date)}{e.mileage ? ` · ${e.mileage.toLocaleString()} mi` : ''}</p>
                        </div>
                        <div className="flex items-center gap-3 ml-2 shrink-0">
                          <p className="text-[#ccc] text-sm font-mono">{e.cost ? fmt(e.cost) : '—'}</p>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"
                            style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </div>
                      </div>
                      {expanded && (
                        <div className="px-4 pb-4 pt-3 border-t border-[#1a1a1a] space-y-2 bg-black/20">
                          {e.shop ? (
                            <div className="flex items-center gap-1.5">
                              <p className="text-[#888] text-sm flex-1 truncate">{e.shop}</p>
                              <button onClick={() => window.open(mapsUrl(e.shop), '_blank')} className="text-[#f0a050] px-1" aria-label="View on Google Maps">
                                <span className="text-xs">📍</span>
                              </button>
                            </div>
                          ) : null}
                          {e.notes ? <p className="text-[#555] text-sm bg-black/40 p-2.5 rounded-xl whitespace-pre-wrap">{e.notes}</p> : null}
                          <div className="flex items-center gap-4 pt-1">
                            <button
                              onClick={() => {
                                setEditMaintEntry(e);
                                setEditMaint({ date: e.date || '', service_type: e.service_type || 'Oil Change', mileage: e.mileage != null ? String(e.mileage) : '', cost: e.cost != null ? String(e.cost) : '', shop: e.shop || '', notes: e.notes || '' });
                              }}
                              className="text-[#f0a050] text-xs font-semibold uppercase tracking-wider"
                            >
                              Edit record
                            </button>
                            <button onClick={() => setDeleteMaintId(e.id)} className="text-[#ef4444] text-xs font-semibold uppercase tracking-wider">Delete record</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>
      </PullToRefresh>

      {/* ═══════════════════════════════════════════════════════════════
          VIEWPORT FIXED ELEMENT SPECIFICATION MODALS BOUNDED SIBLINGS
      ═══════════════════════════════════════════════════════════════ */}

      {/* Vehicle Setup modal screen */}
      {showSetup && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-[#1c1c1e] rounded-2xl max-h-[85vh] overflow-y-auto pb-6 w-full max-w-lg border border-[#2a2a2a]">
            <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-[#2a2a2a] sticky top-0 bg-[#1c1c1e] z-10">
              <p className="text-white font-semibold text-lg">Vehicle Attributes</p>
              <button onClick={() => setShowSetup(false)} className="text-[#555] text-lg p-1">✕</button>
            </div>
            <div className="px-5 pt-4 space-y-3">
              {[
                { label: 'Year', field: 'year', type: 'number', placeholder: String(new Date().getFullYear()) },
                { label: 'Make', field: 'make', placeholder: 'e.g., Chevrolet' },
                { label: 'Model', field: 'model', placeholder: 'e.g., Silverado' },
                { label: 'Trim Level', field: 'trim_level', placeholder: 'e.g., LTZ' },
                { label: 'Color', field: 'color', placeholder: 'e.g., Black' },
                { label: 'License Plate', field: 'license_plate', placeholder: 'e.g., XXXXXXX' },
                { label: 'VIN String', field: 'vin', placeholder: '17-digit VIN text string' },
              ].map(({ label, field, type, placeholder }) => (
                <div key={field}>
                  <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">{label}</label>
                  <input type={type || 'text'} value={setupForm[field] || ''} onChange={e => setSetupForm((f: any) => ({ ...f, [field]: e.target.value }))}
                    placeholder={placeholder} className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
                </div>
              ))}
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Purchase Date</label>
                <input type="date" value={setupForm.purchase_date || ''} onChange={e => setSetupForm((f: any) => ({ ...f, purchase_date: e.target.value }))}
                  className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Purchase Capital Cost</label>
                <input type="number" value={setupForm.purchase_price || ''} onChange={e => setSetupForm((f: any) => ({ ...f, purchase_price: parseFloat(e.target.value) || undefined }))}
                  placeholder="e.g., 42000" className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Oil Change Interval Tracker</label>
                <select value={setupForm.oil_change_interval || 5000} onChange={e => setSetupForm((f: any) => ({ ...f, oil_change_interval: parseInt(e.target.value) }))}
                  className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none text-left">
                  {OIL_INTERVALS.map(n => <option key={n} value={n}>{n.toLocaleString()} miles tracking</option>)}
                </select>
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Registration Expiration Date</label>
                <input type="date" value={setupForm.registration_expires || ''} onChange={e => setSetupForm((f: any) => ({ ...f, registration_expires: e.target.value }))}
                  className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Inspection Expiration Stickers</label>
                <input type="date" value={setupForm.inspection_expires || ''} onChange={e => setSetupForm((f: any) => ({ ...f, inspection_expires: e.target.value }))}
                  className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowSetup(false)} className="flex-1 py-3 rounded-xl bg-[#2a2a2a] text-white text-sm font-semibold">Cancel</button>
                <button onClick={saveSetup} disabled={setupSaving} className="flex-1 py-3 rounded-xl bg-[#f0a050] text-black text-sm font-semibold disabled:opacity-50">
                  {setupSaving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Fill-Up manual modal mapping */}
      {showAddFuel && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-[#1c1c1e] rounded-2xl max-h-[85vh] overflow-y-auto pb-6 w-full max-w-lg border border-[#2a2a2a]">
            <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-[#2a2a2a] sticky top-0 bg-[#1c1c1e] z-10">
              <p className="text-white font-semibold text-lg">Log Fuel Fill-Up</p>
              <button onClick={() => setShowAddFuel(false)} className="text-[#555] text-lg p-1">✕</button>
            </div>
            <div className="px-5 pt-4 space-y-3">
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Date</label>
                <input type="date" value={addFuel.date} onChange={e => setAddFuel(f => ({ ...f, date: e.target.value }))}
                  className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Gallons Quantity</label>
                <input type="number" step="0.001" value={addFuel.gallons} onChange={e => handleAddFuelField('gallons', e.target.value)}
                  placeholder="e.g., 24.150" className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Price Per Gallon ($)</label>
                <input type="number" step="0.001" value={addFuel.price_per_gallon} onChange={e => handleAddFuelField('price_per_gallon', e.target.value)}
                  placeholder="e.g., 3.659" className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[#888] text-xs uppercase tracking-wide font-mono">Total Capital Spend</label>
                  {!fuelAutoCalc && (
                    <button onClick={() => {
                      const g = parseFloat(addFuel.gallons), p = parseFloat(addFuel.price_per_gallon);
                      if (!isNaN(g) && !isNaN(p)) setAddFuel(f => ({ ...f, total_cost: (g * p).toFixed(2) }));
                      setFuelAutoCalc(true);
                    }} className="text-[#f0a050] text-xs">Reset to auto-calc</button>
                  )}
                  {fuelAutoCalc && <span className="text-[#555] text-xs">Calculated</span>}
                </div>
                <input type="number" step="0.01" value={addFuel.total_cost}
                  onChange={e => { setAddFuel(f => ({ ...f, total_cost: e.target.value })); setFuelAutoCalc(false); }}
                  placeholder="e.g., 88.36" className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Odometer Reading (mi)</label>
                <input type="number" value={addFuel.odometer} onChange={e => setAddFuel(f => ({ ...f, odometer: e.target.value }))}
                  placeholder="Current miles value" className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Gas Station / Vendor Location</label>
                <PlacesInput value={addFuel.station} onChange={v => setAddFuel(f => ({ ...f, station: v }))} placeholder="Search stations near origin..." />
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Notes / Reminders</label>
                <input type="text" value={addFuel.notes} onChange={e => setAddFuel(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notations" className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowAddFuel(false)} className="flex-1 py-3 rounded-xl bg-[#2a2a2a] text-white text-sm font-semibold">Cancel</button>
                <button onClick={saveAddFuel} disabled={fuelSaving || !addFuel.date} className="flex-1 py-3 rounded-xl bg-[#f0a050] text-black text-sm font-semibold disabled:opacity-50">
                  {fuelSaving ? 'Saving...' : 'Log Fill-Up'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Service maintenance modal mapping */}
      {showAddMaint && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-[#1c1c1e] rounded-2xl max-h-[85vh] overflow-y-auto pb-6 w-full max-w-lg border border-[#2a2a2a]">
            <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-[#2a2a2a] sticky top-0 bg-[#1c1c1e] z-10">
              <p className="text-white font-semibold text-lg">Log Maintenance Service</p>
              <button onClick={() => setShowAddMaint(false)} className="text-[#555] text-lg p-1">✕</button>
            </div>
            <div className="px-5 pt-4 space-y-3">
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Date</label>
                <input type="date" value={addMaint.date} onChange={e => setAddMaint(f => ({ ...f, date: e.target.value }))}
                  className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Service Classification Category</label>
                <select value={addMaint.service_type} onChange={e => setAddMaint(f => ({ ...f, service_type: e.target.value }))}
                  className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]">
                  {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Mileage Odometer Value</label>
                <input type="number" value={addMaint.mileage} onChange={e => setAddMaint(f => ({ ...f, mileage: e.target.value }))}
                  placeholder="Odometer level at service" className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Invoice Cost ($)</label>
                <input type="number" step="0.01" value={addMaint.cost} onChange={e => setAddMaint(f => ({ ...f, cost: e.target.value }))}
                  placeholder="Invoice grand total" className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Service Facility / Shop Name</label>
                <PlacesInput value={addMaint.shop} onChange={v => setAddMaint(f => ({ ...f, shop: v }))} placeholder="Search repair shops..." />
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Work Order Notes / Specific Details</label>
                <input type="text" value={addMaint.notes} onChange={e => setAddMaint(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Parts numbers, structural items notes" className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowAddMaint(false)} className="flex-1 py-3 rounded-xl bg-[#2a2a2a] text-white text-sm font-semibold">Cancel</button>
                <button onClick={saveAddMaint} disabled={maintSaving} className="flex-1 py-3 rounded-xl bg-[#f0a050] text-black text-sm font-semibold disabled:opacity-50">
                  {maintSaving ? 'Saving...' : 'Log Service Record'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Fill-Up screen modal */}
      {editFuelEntry && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-[#1c1c1e] rounded-2xl max-h-[85vh] overflow-y-auto pb-6 w-full max-w-lg border border-[#2a2a2a]">
            <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-[#2a2a2a] sticky top-0 bg-[#1c1c1e] z-10">
              <p className="text-white font-semibold text-lg">Modify Fuel Log Entry</p>
              <button onClick={() => setEditFuelEntry(null)} className="text-[#555] text-lg p-1">✕</button>
            </div>
            <div className="px-5 pt-4 space-y-3">
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Date</label>
                <input type="date" value={editFuel.date} onChange={e => setEditFuel(f => ({ ...f, date: e.target.value }))}
                  className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Gallons</label>
                <input type="number" step="0.001" value={editFuel.gallons} onChange={e => handleEditFuelField('gallons', e.target.value)}
                  className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Price per Gallon</label>
                <input type="number" step="0.001" value={editFuel.price_per_gallon} onChange={e => handleEditFuelField('price_per_gallon', e.target.value)}
                  className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[#888] text-xs uppercase tracking-wide font-mono">Total Cost ($)</label>
                  <button onClick={() => {
                    const g = parseFloat(editFuel.gallons), p = parseFloat(editFuel.price_per_gallon);
                    if (!isNaN(g) && !isNaN(p)) setEditFuel(f => ({ ...f, total_cost: (g * p).toFixed(2) }));
                    setEditFuelAutoCalc(true);
                  }} className="text-[#f0a050] text-xs">Recalculate total</button>
                </div>
                <input type="number" step="0.01" value={editFuel.total_cost}
                  onChange={e => { setEditFuel(f => ({ ...f, total_cost: e.target.value })); setEditFuelAutoCalc(false); }}
                  className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Odometer Log</label>
                <input type="number" value={editFuel.odometer} onChange={e => setEditFuel(f => ({ ...f, odometer: e.target.value }))}
                  className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Station</label>
                <PlacesInput value={editFuel.station} onChange={v => setEditFuel(f => ({ ...f, station: v }))} placeholder="Search stations..." />
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Notes</label>
                <input type="text" value={editFuel.notes} onChange={e => setEditFuel(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setEditFuelEntry(null)} className="flex-1 py-3 rounded-xl bg-[#2a2a2a] text-white text-sm font-semibold">Cancel</button>
                <button onClick={saveEditFuel} disabled={editFuelSaving} className="flex-1 py-3 rounded-xl bg-[#f0a050] text-black text-sm font-semibold disabled:opacity-50">
                  {editFuelSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Service record screen modal wrapper */}
      {editMaintEntry && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-[#1c1c1e] rounded-2xl max-h-[85vh] overflow-y-auto pb-6 w-full max-w-lg border border-[#2a2a2a]">
            <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-[#2a2a2a] sticky top-0 bg-[#1c1c1e] z-10">
              <p className="text-white font-semibold text-lg">Modify Service Record</p>
              <button onClick={() => setEditMaintEntry(null)} className="text-[#555] text-lg p-1">✕</button>
            </div>
            <div className="px-5 pt-4 space-y-3">
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Date</label>
                <input type="date" value={editMaint.date} onChange={e => setEditMaint(f => ({ ...f, date: e.target.value }))}
                  className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Service Classification</label>
                <select value={editMaint.service_type} onChange={e => setEditMaint(f => ({ ...f, service_type: e.target.value }))}
                  className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]">
                  {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Odometer Mileage</label>
                <input type="number" value={editMaint.mileage} onChange={e => setEditMaint(f => ({ ...f, mileage: e.target.value }))}
                  className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Grand Cost Total ($)</label>
                <input type="number" step="0.01" value={editMaint.cost} onChange={e => setEditMaint(f => ({ ...f, cost: e.target.value }))}
                  className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Facility Shop</label>
                <PlacesInput value={editMaint.shop} onChange={v => setEditMaint(f => ({ ...f, shop: v }))} placeholder="Search shops..." />
              </div>
              <div>
                <label className="text-[#888] text-xs mb-1 block uppercase tracking-wide font-mono">Service Order Notes</label>
                <input type="text" value={editMaint.notes} onChange={e => setEditMaint(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-black text-white rounded-xl px-3 py-2.5 text-sm border border-[#1a1a1a] outline-none focus:border-[#f0a050]" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setEditMaintEntry(null)} className="flex-1 py-3 rounded-xl bg-[#2a2a2a] text-white text-sm font-semibold">Cancel</button>
                <button onClick={saveEditMaint} disabled={editMaintSaving} className="flex-1 py-3 rounded-xl bg-[#f0a050] text-black text-sm font-semibold disabled:opacity-50">
                  {editMaintSaving ? 'Saving...' : 'Save Modifications'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot OCR import prompt modal wrapper */}
      {showImport && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-[#1c1c1e] rounded-2xl max-h-[85vh] overflow-y-auto pb-6 w-full max-w-lg border border-[#2a2a2a]">
            <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-[#2a2a2a] sticky top-0 bg-[#1c1c1e] z-10">
              <p className="text-white font-semibold text-lg">Import {importType === 'fuel' ? 'Fuel Receipts' : 'Maintenance Slips'}</p>
              <button onClick={() => setShowImport(false)} className="text-[#555] text-lg p-1">✕</button>
            </div>
            <div className="px-5 pt-4 space-y-4">
              <p className="text-[#888] text-sm leading-relaxed">
                {importType === 'fuel'
                  ? 'Upload a phone history screenshot from GasBuddy, your digital receipts, or credit records. Personal OS AI will parse it out natively.'
                  : 'Upload an invoice screenshot from Carfax, ACME shop slips, or commercial mechanics logs to parse items cleanly.'}
              </p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setImageType(file.type || 'image/jpeg');
                  const reader = new FileReader();
                  reader.onload = ev => {
                    const result = ev.target?.result as string;
                    setImagePreview(result);
                    setImageBase64(result.split(',')[1]);
                    setImportRecords([]);
                  };
                  reader.readAsDataURL(file);
                }}
              />
              <button onClick={() => { if (fileRef.current) { fileRef.current.value = ''; fileRef.current.click(); } }}
                className="w-full rounded-2xl border-2 border-dashed border-[#333] overflow-hidden bg-black/30 active:bg-black/50">
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Target file viewport preview" className="w-full max-h-48 object-contain bg-[#0a0a0a]" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-2 text-center">
                      <p className="text-[#f0a050] text-xs font-medium">Tap to swap uploaded asset file</p>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center gap-2">
                    <span className="text-3xl text-[#555]">📷</span>
                    <p className="text-[#555] text-sm font-medium">Select photo image asset file</p>
                    <p className="text-[#333] text-xs">Camera capture roll or storage media</p>
                  </div>
                )}
              </button>

              {imageBase64 && importRecords.length === 0 && (
                <button onClick={extractRecords} disabled={extracting}
                  className="w-full bg-[#f0a050] text-black font-semibold rounded-xl py-3.5 disabled:opacity-60 flex items-center justify-center gap-2">
                  {extracting ? 'Processing Extraction Framework AI...' : 'Parse Screenshot Records with AI'}
                </button>
              )}

              {importRecords.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-white font-semibold text-sm">{importRecords.filter(r => r._keep).length} selected</p>
                    <button onClick={() => { setImportRecords([]); setImagePreview(null); setImageBase64(null); }} className="text-[#555] text-xs">Clear file</button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {importRecords.map(rec => (
                      <div key={rec._idx} className={`rounded-xl p-3 border transition-opacity ${rec._keep ? 'bg-[#1a1a1a] border-[#333]' : 'bg-[#111] border-[#1a1a1a] opacity-30'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 text-xs">
                            {importType === 'fuel' ? (
                              <>
                                <p className="text-white text-sm font-semibold font-mono">{rec.total_cost != null ? fmt(rec.total_cost) : '—'}</p>
                                <p className="text-[#ccc] mt-0.5">{rec.gallons != null ? `${rec.gallons} gal` : ''}{rec.price_per_gallon != null ? ` @ $${rec.price_per_gallon}/gal` : ''}</p>
                                <p className="text-[#555] mt-0.5">{rec.date || ''}{rec.odometer != null ? ` · ${rec.odometer.toLocaleString()} mi` : ''}</p>
                              </>
                            ) : (
                              <>
                                <p className="text-white text-sm font-semibold">{rec.service_type}</p>
                                <p className="text-[#ccc] mt-0.5">{rec.date || ''}{rec.mileage != null ? ` · ${rec.mileage.toLocaleString()} mi` : ''}{rec.cost != null ? ` · ${fmt(rec.cost)}` : ''}</p>
                              </>
                            )}
                          </div>
                          <button
                            onClick={() => setImportRecords(recs => recs.map(r => r._idx === rec._idx ? { ...r, _keep: !r._keep } : r))}
                            className={`text-[10px] font-bold tracking-wider uppercase shrink-0 px-2 py-1 rounded-md ${rec._keep ? 'text-[#ef4444] bg-[#ef4444]/10' : 'text-[#22c55e] bg-[#22c55e]/10'}`}
                          >
                            {rec._keep ? 'Skip' : 'Include'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={saveImported} disabled={importSaving || importRecords.filter(r => r._keep).length === 0}
                    className="w-full bg-[#f0a050] text-black font-semibold rounded-xl py-3.5 disabled:opacity-50">
                    {importSaving ? 'Committing records up...' : `Ingest ${importRecords.filter(r => r._keep).length} Parsed Records`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete fuel confirmation bottom sheet sheet */}
      {deleteFuelId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-lg p-5 border border-[#1a1a1a]">
            <p className="text-white font-semibold text-center mb-1">Delete Fuel Log Entry?</p>
            <p className="text-[#888] text-xs text-center mb-4">This action resets the historical calculations basis</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteFuelId(null)} className="flex-1 py-3 rounded-xl bg-black border border-[#1a1a1a] text-white text-sm font-medium">Keep</button>
              <button onClick={() => deleteFuel(deleteFuelId)} className="flex-1 py-3 rounded-xl bg-[#ef4444] text-white text-sm font-medium">Delete record</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete maintenance confirmation layout item sheet */}
      {deleteMaintId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-lg p-5 border border-[#1a1a1a]">
            <p className="text-white font-semibold text-center mb-1">Delete Service Record?</p>
            <p className="text-[#888] text-xs text-center mb-4">This permanent change resets your vehicle service timeline</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteMaintId(null)} className="flex-1 py-3 rounded-xl bg-black border border-[#1a1a1a] text-white text-sm font-medium">Keep</button>
              <button onClick={() => deleteMaint(deleteMaintId)} className="flex-1 py-3 rounded-xl bg-[#ef4444] text-white text-sm font-medium">Delete record</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}