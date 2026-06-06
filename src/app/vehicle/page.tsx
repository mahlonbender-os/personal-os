'use client';

import { useState, useEffect, useRef } from 'react';
import PullToRefresh from '@/components/PullToRefresh';

// ─── Types ───────────────────────────────────────────────────────────────────

interface VehicleInfo {
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
  oil_change_interval?: number;
  registration_expires?: string;
  inspection_expires?: string;
}

interface FuelLog {
  id: string;
  date: string;
  gallons: number;
  price_per_gallon: number;
  total_cost: number;
  odometer: number;
  station: string;
  notes: string;
}

interface MaintenanceLog {
  id: string;
  date: string;
  service_type: string;
  mileage: number;
  cost: number;
  shop: string;
  notes: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Fuel', 'Maintenance'];

const SERVICE_TYPES = [
  'Oil Change', 'Tire Rotation', 'Tire Replacement', 'Brake Service',
  'Air Filter', 'Cabin Filter', 'Battery Replacement', 'Transmission Service',
  'Coolant Flush', 'Inspection', 'Registration / Tags', 'Wiper Blades',
  'Detailing', 'Alignment', 'Spark Plugs', 'Other',
];

const OIL_INTERVALS = [3000, 5000, 7500, 10000];

// ─── Inline Places Autocomplete ──────────────────────────────────────────────

function PlacesInput({
  value,
  onChange,
  placeholder = 'Search location...',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<Array<{ place_id: string; description: string }>>([]);
  const [showDrop, setShowDrop] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  function handleInput(v: string) {
    onChange(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (v.length < 2) { setSuggestions([]); setShowDrop(false); return; }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?input=${encodeURIComponent(v)}`);
        const data = await res.json();
        const preds: Array<{ place_id: string; description: string }> = data.predictions || [];
        setSuggestions(preds);
        setShowDrop(preds.length > 0);
      } catch { /* ignore */ }
    }, 350);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => suggestions.length > 0 && setShowDrop(true)}
        onBlur={() => setTimeout(() => setShowDrop(false), 200)}
        placeholder={placeholder}
        className="w-full bg-[#222] text-white rounded-xl px-3 py-2.5 text-sm border border-[#333] outline-none focus:border-[#f0a050] placeholder-[#555]"
      />
      {showDrop && (
        <div className="absolute top-full left-0 right-0 bg-[#1c1c1e] border border-[#333] rounded-xl mt-1 z-[60] max-h-44 overflow-y-auto shadow-2xl">
          {suggestions.map((s, i) => (
            <button
              key={s.place_id || i}
              onMouseDown={() => { onChange(s.description); setSuggestions([]); setShowDrop(false); }}
              className="w-full text-left px-3 py-2.5 text-sm border-b border-[#2a2a2a] last:border-0 active:bg-[#222]"
            >
              <span className="text-[#f0a050] mr-2">📍</span>
              <span className="text-[#ccc]">{s.description}</span>
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

function formatDate(d: string) {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  return `${parseInt(parts[1])}/${parseInt(parts[2])}/${parts[0]}`;
}

function daysUntil(dateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function expiryColor(dateStr: string) {
  const d = daysUntil(dateStr);
  if (d < 0) return '#ef4444';
  if (d < 30) return '#f0a050';
  return '#22c55e';
}

function mapsUrl(location: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(location)}`;
}

// ─── Map Pin Icon ─────────────────────────────────────────────────────────────

function MapPinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VehiclePage() {
  const [activeTab, setActiveTab] = useState(0);

  // Data
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [maintLogs, setMaintLogs] = useState<MaintenanceLog[]>([]);

  // Setup modal
  const [showSetup, setShowSetup] = useState(false);
  const [setupForm, setSetupForm] = useState<VehicleInfo>({
    year: new Date().getFullYear(), make: '', model: '', trim_level: '',
    color: '', vin: '', license_plate: '', purchase_date: '',
    purchase_price: undefined, oil_change_interval: 5000,
    registration_expires: '', inspection_expires: '',
  });
  const [setupLoading, setSetupLoading] = useState(false);

  // Fuel modal
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [fuelForm, setFuelForm] = useState({ date: '', gallons: '', price_per_gallon: '', total_cost: '', odometer: '', station: '', notes: '' });
  const [fuelAutoCalc, setFuelAutoCalc] = useState(true);
  const [fuelLoading, setFuelLoading] = useState(false);
  const [deletingFuel, setDeletingFuel] = useState<string | null>(null);

  // Maintenance modal
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [maintForm, setMaintForm] = useState({ date: '', service_type: 'Oil Change', mileage: '', cost: '', shop: '', notes: '' });
  const [maintLoading, setMaintLoading] = useState(false);
  const [deletingMaint, setDeletingMaint] = useState<string | null>(null);
  const [expandedMaint, setExpandedMaint] = useState<Set<string>>(new Set());

  // Screenshot import
  const [showImport, setShowImport] = useState(false);
  const [importType, setImportType] = useState<'fuel' | 'maintenance'>('fuel');
  const [importImageB64, setImportImageB64] = useState<string | null>(null);
  const [importImageType, setImportImageType] = useState('image/jpeg');
  const [importImagePreview, setImportImagePreview] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResults, setImportResults] = useState<any[]>([]);
  const [importSaving, setImportSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Data fetching ────────────────────────────────────────────────────────

  useEffect(() => {
    const ci = localStorage.getItem('vehicle-info');
    const cf = localStorage.getItem('vehicle-fuel');
    const cm = localStorage.getItem('vehicle-maint');
    if (ci) try { setVehicleInfo(JSON.parse(ci)); } catch { /* ignore */ }
    if (cf) try { setFuelLogs(JSON.parse(cf)); } catch { /* ignore */ }
    if (cm) try { setMaintLogs(JSON.parse(cm)); } catch { /* ignore */ }
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      const [iRes, fRes, mRes] = await Promise.all([
        fetch('/api/vehicle/info'),
        fetch('/api/vehicle/fuel'),
        fetch('/api/vehicle/maintenance'),
      ]);
      if (iRes.ok) { const d = await iRes.json(); setVehicleInfo(d); localStorage.setItem('vehicle-info', JSON.stringify(d)); }
      if (fRes.ok) { const d = await fRes.json(); setFuelLogs(d); localStorage.setItem('vehicle-fuel', JSON.stringify(d)); }
      if (mRes.ok) { const d = await mRes.json(); setMaintLogs(d); localStorage.setItem('vehicle-maint', JSON.stringify(d)); }
    } catch { /* ignore */ }
  }

  // ── Derived values ───────────────────────────────────────────────────────

  const currentMileage = (() => {
    const all = [
      ...fuelLogs.map(f => f.odometer).filter(Boolean),
      ...maintLogs.map(m => m.mileage).filter(Boolean),
    ];
    return all.length > 0 ? Math.max(...all) : null;
  })();

  const lastOilChange = [...maintLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .find(m => m.service_type === 'Oil Change');
  const nextOilMiles = lastOilChange && vehicleInfo?.oil_change_interval
    ? (lastOilChange.mileage || 0) + (vehicleInfo.oil_change_interval || 5000)
    : null;
  const milesTilOil = nextOilMiles != null && currentMileage != null ? nextOilMiles - currentMileage : null;
  const oilColor = milesTilOil == null ? '#555' : milesTilOil < 0 ? '#ef4444' : milesTilOil < 500 ? '#f0a050' : '#22c55e';

  // MPG calculation across all fill-ups
  const fuelByOdo = [...fuelLogs].filter(f => f.odometer && f.gallons).sort((a, b) => a.odometer - b.odometer);
  let lifetimeMiles = 0, lifetimeGallons = 0;
  for (let i = 1; i < fuelByOdo.length; i++) {
    const mi = fuelByOdo[i].odometer - fuelByOdo[i - 1].odometer;
    if (mi > 0) { lifetimeMiles += mi; lifetimeGallons += fuelByOdo[i].gallons; }
  }
  const avgMpg = lifetimeGallons > 0 ? lifetimeMiles / lifetimeGallons : null;

  // Per-fill-up MPG (for Fuel tab cards)
  const fuelDesc = [...fuelLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const fuelWithMpg = fuelDesc.map((log) => {
    const idx = fuelByOdo.findIndex(f => f.id === log.id);
    let mpg: number | null = null;
    if (idx > 0) {
      const mi = fuelByOdo[idx].odometer - fuelByOdo[idx - 1].odometer;
      if (mi > 0 && fuelByOdo[idx].gallons > 0) mpg = mi / fuelByOdo[idx].gallons;
    }
    return { ...log, mpg };
  });

  // Year costs
  const nowYear = String(new Date().getFullYear());
  const yearFuel = fuelLogs.filter(f => f.date?.startsWith(nowYear));
  const yearMaint = maintLogs.filter(m => m.date?.startsWith(nowYear));
  const yearFuelCost = yearFuel.reduce((s, f) => s + (f.total_cost || 0), 0);
  const yearMaintCost = yearMaint.reduce((s, m) => s + (m.cost || 0), 0);
  const yearTotalCost = yearFuelCost + yearMaintCost;

  // Cost per mile
  const yearFuelOdo = yearFuel.filter(f => f.odometer).sort((a, b) => b.odometer - a.odometer);
  let costPerMile: number | null = null;
  if (yearFuelOdo.length >= 2 && yearTotalCost > 0) {
    const driven = yearFuelOdo[0].odometer - yearFuelOdo[yearFuelOdo.length - 1].odometer;
    if (driven > 0) costPerMile = yearTotalCost / driven;
  }

  const hasVehicle = !!(vehicleInfo?.make);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function openSetup() {
    setSetupForm(vehicleInfo ? {
      year: vehicleInfo.year, make: vehicleInfo.make || '', model: vehicleInfo.model || '',
      trim_level: vehicleInfo.trim_level || '', color: vehicleInfo.color || '',
      vin: vehicleInfo.vin || '', license_plate: vehicleInfo.license_plate || '',
      purchase_date: vehicleInfo.purchase_date || '', purchase_price: vehicleInfo.purchase_price,
      oil_change_interval: vehicleInfo.oil_change_interval || 5000,
      registration_expires: vehicleInfo.registration_expires || '',
      inspection_expires: vehicleInfo.inspection_expires || '',
    } : { year: new Date().getFullYear(), make: '', model: '', trim_level: '', color: '', vin: '', license_plate: '', purchase_date: '', purchase_price: undefined, oil_change_interval: 5000, registration_expires: '', inspection_expires: '' });
    setShowSetup(true);
  }

  async function saveSetup() {
    setSetupLoading(true);
    try {
      await fetch('/api/vehicle/info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(setupForm) });
      await fetchAll();
      setShowSetup(false);
    } catch { /* ignore */ }
    setSetupLoading(false);
  }

  function openFuelModal() {
    setFuelForm({ date: new Date().toISOString().split('T')[0], gallons: '', price_per_gallon: '', total_cost: '', odometer: '', station: '', notes: '' });
    setFuelAutoCalc(true);
    setShowFuelModal(true);
  }

  function handleFuelInput(field: string, val: string) {
    const updated = { ...fuelForm, [field]: val };
    if (fuelAutoCalc && (field === 'gallons' || field === 'price_per_gallon')) {
      const g = parseFloat(field === 'gallons' ? val : fuelForm.gallons);
      const p = parseFloat(field === 'price_per_gallon' ? val : fuelForm.price_per_gallon);
      if (!isNaN(g) && !isNaN(p)) updated.total_cost = (g * p).toFixed(2);
    }
    setFuelForm(updated);
  }

  async function saveFuel() {
    setFuelLoading(true);
    try {
      await fetch('/api/vehicle/fuel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: fuelForm.date,
          gallons: parseFloat(fuelForm.gallons) || null,
          price_per_gallon: parseFloat(fuelForm.price_per_gallon) || null,
          total_cost: parseFloat(fuelForm.total_cost) || null,
          odometer: parseInt(fuelForm.odometer) || null,
          station: fuelForm.station || null,
          notes: fuelForm.notes || null,
        }),
      });
      await fetchAll();
      setShowFuelModal(false);
    } catch { /* ignore */ }
    setFuelLoading(false);
  }

  async function deleteFuel(id: string) {
    try {
      await fetch(`/api/vehicle/fuel?id=${id}`, { method: 'DELETE' });
      await fetchAll();
    } catch { /* ignore */ }
    setDeletingFuel(null);
  }

  function openMaintModal() {
    setMaintForm({ date: new Date().toISOString().split('T')[0], service_type: 'Oil Change', mileage: currentMileage ? String(currentMileage) : '', cost: '', shop: '', notes: '' });
    setShowMaintModal(true);
  }

  async function saveMaint() {
    setMaintLoading(true);
    try {
      await fetch('/api/vehicle/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: maintForm.date,
          service_type: maintForm.service_type,
          mileage: parseInt(maintForm.mileage) || null,
          cost: parseFloat(maintForm.cost) || null,
          shop: maintForm.shop || null,
          notes: maintForm.notes || null,
        }),
      });
      await fetchAll();
      setShowMaintModal(false);
    } catch { /* ignore */ }
    setMaintLoading(false);
  }

  async function deleteMaint(id: string) {
    try {
      await fetch(`/api/vehicle/maintenance?id=${id}`, { method: 'DELETE' });
      await fetchAll();
    } catch { /* ignore */ }
    setDeletingMaint(null);
  }

  function openImport(type: 'fuel' | 'maintenance') {
    setImportType(type);
    setImportImageB64(null);
    setImportImagePreview(null);
    setImportResults([]);
    setShowImport(true);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportImageType(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImportImagePreview(dataUrl);
      setImportImageB64(dataUrl.split(',')[1]);
      // Reset results when a new image is picked
      setImportResults([]);
    };
    reader.readAsDataURL(file);
  }

  async function runImport() {
    if (!importImageB64) return;
    setImportLoading(true);
    setImportResults([]);
    try {
      const res = await fetch('/api/vehicle/import-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: importImageB64, imageType: importImageType, importType }),
      });
      const data = await res.json();
      if (data.records) {
        setImportResults(data.records.map((r: any, i: number) => ({ ...r, _idx: i, _keep: true })));
      } else {
        alert(data.error || 'No records found in the image');
      }
    } catch (err: any) {
      alert('Error extracting records: ' + err.message);
    }
    setImportLoading(false);
  }

  async function saveImportedRecords() {
    const toSave = importResults.filter(r => r._keep);
    if (toSave.length === 0) return;
    setImportSaving(true);
    try {
      const endpoint = importType === 'fuel' ? '/api/vehicle/fuel' : '/api/vehicle/maintenance';
      for (const record of toSave) {
        const { _idx, _keep, ...body } = record;
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      await fetchAll();
      setShowImport(false);
      setActiveTab(importType === 'fuel' ? 1 : 2);
      window.scrollTo(0, 0);
    } catch (err: any) {
      alert('Error saving records: ' + err.message);
    }
    setImportSaving(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PullToRefresh onRefresh={fetchAll}>
      <div className="pb-24 min-h-screen bg-black">

        {/* Header */}
        <div className="px-4 pt-6 pb-2">
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, system-ui, sans-serif' }}>
            {hasVehicle ? `${vehicleInfo!.year} ${vehicleInfo!.make} ${vehicleInfo!.model}` : 'Vehicle'}
          </h1>
          <p className="text-[#555] text-sm mt-0.5">
            {hasVehicle ? (vehicleInfo!.license_plate || 'No plate set') : 'Set up your vehicle'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1a1a1a] sticky top-0 bg-black z-10">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(i); window.scrollTo(0, 0); if (navigator.vibrate) navigator.vibrate(8); }}
              className={`flex-1 py-3 text-xs font-semibold transition-colors ${activeTab === i ? 'text-[#f0a050] border-b-2 border-[#f0a050]' : 'text-[#555]'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ═══════════════════ OVERVIEW TAB ═══════════════════ */}
        {activeTab === 0 && (
          <div className="px-4 pt-4 space-y-3">
            {/* Vehicle Card */}
            <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-[#f0a050] text-xs font-semibold uppercase tracking-wider mb-1">My Vehicle</p>
                  {hasVehicle ? (
                    <>
                      <p className="text-white font-semibold">{vehicleInfo!.year} {vehicleInfo!.make} {vehicleInfo!.model}</p>
                      {vehicleInfo!.trim_level && <p className="text-[#888] text-sm">{vehicleInfo!.trim_level}</p>}
                      <div className="mt-2 space-y-0.5">
                        {vehicleInfo!.color && <p className="text-[#888] text-xs">Color: {vehicleInfo!.color}</p>}
                        {vehicleInfo!.license_plate && <p className="text-[#888] text-xs">Plate: {vehicleInfo!.license_plate}</p>}
                        {vehicleInfo!.vin && <p className="text-[#888] text-xs font-mono">VIN: {vehicleInfo!.vin}</p>}
                      </div>
                    </>
                  ) : (
                    <p className="text-[#555] text-sm mt-1">Tap Set Up to add your vehicle details</p>
                  )}
                </div>
                <button onClick={openSetup} className="text-[#f0a050] text-sm font-medium ml-3 shrink-0">
                  {hasVehicle ? 'Edit' : 'Set Up'}
                </button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                <p className="text-[#555] text-xs uppercase tracking-wide mb-1.5">Current Mileage</p>
                <p className="text-white text-2xl font-mono font-bold">{currentMileage ? currentMileage.toLocaleString() : '—'}</p>
                {currentMileage != null && <p className="text-[#555] text-xs mt-0.5">miles</p>}
              </div>

              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                <p className="text-[#555] text-xs uppercase tracking-wide mb-1.5">Next Oil Change</p>
                {nextOilMiles ? (
                  <>
                    <p className="text-white text-xl font-mono font-bold">{nextOilMiles.toLocaleString()}</p>
                    {milesTilOil != null && (
                      <p className="text-xs mt-0.5 font-mono" style={{ color: oilColor }}>
                        {milesTilOil > 0 ? `${milesTilOil.toLocaleString()} mi away` : `${Math.abs(milesTilOil).toLocaleString()} mi overdue`}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-[#555] text-sm mt-1">Log an oil change</p>
                )}
              </div>

              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                <p className="text-[#555] text-xs uppercase tracking-wide mb-1.5">Avg Fuel Economy</p>
                {avgMpg ? (
                  <>
                    <p className="text-white text-2xl font-mono font-bold">{avgMpg.toFixed(1)}</p>
                    <p className="text-[#555] text-xs mt-0.5">MPG lifetime</p>
                  </>
                ) : (
                  <p className="text-[#555] text-sm mt-1">Log 2+ fill-ups</p>
                )}
              </div>

              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                <p className="text-[#555] text-xs uppercase tracking-wide mb-1.5">{nowYear} Cost / Mile</p>
                {costPerMile ? (
                  <>
                    <p className="text-white text-2xl font-mono font-bold">${costPerMile.toFixed(2)}</p>
                    <p className="text-[#555] text-xs mt-0.5">per mile</p>
                  </>
                ) : (
                  <p className="text-[#555] text-sm mt-1">No spend logged</p>
                )}
              </div>
            </div>

            {/* Renewals */}
            {(vehicleInfo?.registration_expires || vehicleInfo?.inspection_expires) && (
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                <p className="text-white font-semibold mb-3">Renewals</p>
                <div className="space-y-2">
                  {vehicleInfo.registration_expires && (
                    <div className="flex items-center justify-between">
                      <p className="text-[#ccc] text-sm">Registration</p>
                      <p className="text-sm font-mono" style={{ color: expiryColor(vehicleInfo.registration_expires) }}>
                        {formatDate(vehicleInfo.registration_expires)}
                      </p>
                    </div>
                  )}
                  {vehicleInfo.inspection_expires && (
                    <div className="flex items-center justify-between">
                      <p className="text-[#ccc] text-sm">Inspection</p>
                      <p className="text-sm font-mono" style={{ color: expiryColor(vehicleInfo.inspection_expires) }}>
                        {formatDate(vehicleInfo.inspection_expires)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recent Services */}
            <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
              <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <p className="text-white font-semibold">Recent Services</p>
                {maintLogs.length > 5 && (
                  <button onClick={() => { setActiveTab(2); window.scrollTo(0, 0); }} className="text-[#f0a050] text-xs">See all</button>
                )}
              </div>
              <div className="px-4 pb-4">
                {maintLogs.length === 0 ? (
                  <>
                    <p className="text-[#555] text-sm">No maintenance logged yet</p>
                    <button onClick={() => { setActiveTab(2); window.scrollTo(0, 0); setTimeout(openMaintModal, 50); }} className="text-[#f0a050] text-sm mt-1">
                      Log your first service →
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    {maintLogs.slice(0, 5).map((m) => (
                      <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-[#1a1a1a] last:border-0">
                        <div>
                          <p className="text-white text-sm">{m.service_type}</p>
                          <p className="text-[#555] text-xs">{formatDate(m.date)}{m.mileage ? ` · ${m.mileage.toLocaleString()} mi` : ''}</p>
                        </div>
                        <p className="text-[#ccc] text-sm font-mono">{m.cost ? fmt(m.cost) : '—'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Year Cost Summary */}
            {yearTotalCost > 0 && (
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                <p className="text-white font-semibold mb-3">{nowYear} Cost Summary</p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <p className="text-[#ccc] text-sm">Fuel</p>
                    <p className="text-[#ccc] text-sm font-mono">{fmt(yearFuelCost)}</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-[#ccc] text-sm">Maintenance</p>
                    <p className="text-[#ccc] text-sm font-mono">{fmt(yearMaintCost)}</p>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#1a1a1a]">
                    <p className="text-white text-sm font-semibold">Total</p>
                    <p className="text-white text-sm font-mono font-semibold">{fmt(yearTotalCost)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════ FUEL TAB ═══════════════════ */}
        {activeTab === 1 && (
          <div className="px-4 pt-4 space-y-3">
            {/* Import button */}
            <button
              onClick={() => openImport('fuel')}
              className="w-full py-3 rounded-xl border border-[#2a2a2a] text-[#f0a050] text-sm font-medium flex items-center justify-center gap-2"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Import from Screenshot
            </button>

            {/* Summary bar */}
            {fuelLogs.length >= 2 && avgMpg && (
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                <div className="flex justify-between">
                  <div>
                    <p className="text-[#555] text-xs uppercase tracking-wide">Lifetime Avg MPG</p>
                    <p className="text-white text-2xl font-mono font-bold mt-1">{avgMpg.toFixed(1)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#555] text-xs uppercase tracking-wide">{nowYear} Fuel Cost</p>
                    <p className="text-white text-2xl font-mono font-bold mt-1">{fmt(yearFuelCost)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Fuel cards */}
            {fuelWithMpg.length === 0 ? (
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 text-center">
                <p className="text-[#555] text-sm">No fill-ups logged yet</p>
                <p className="text-[#333] text-xs mt-1">Tap + to log your first fill-up</p>
              </div>
            ) : (
              fuelWithMpg.map((log) => (
                <div key={log.id} className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-semibold font-mono">{fmt(log.total_cost)}</p>
                        {log.mpg && (
                          <span className="text-[#22c55e] text-xs font-mono bg-[#22c55e]/10 px-1.5 py-0.5 rounded-md">
                            {log.mpg.toFixed(1)} MPG
                          </span>
                        )}
                      </div>
                      <p className="text-[#555] text-xs mt-0.5">
                        {log.gallons ? `${Number(log.gallons).toFixed(3)} gal` : ''}
                        {log.price_per_gallon ? ` @ $${Number(log.price_per_gallon).toFixed(3)}/gal` : ''}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <p className="text-[#555] text-xs">{formatDate(log.date)}</p>
                        {log.odometer ? <p className="text-[#555] text-xs">{log.odometer.toLocaleString()} mi</p> : null}
                      </div>
                      {log.station ? (
                        <div className="flex items-center gap-1.5 mt-1">
                          <p className="text-[#888] text-xs">{log.station}</p>
                          <button
                            onClick={() => window.open(mapsUrl(log.station), '_blank')}
                            className="text-[#f0a050] shrink-0"
                            aria-label="View on Google Maps"
                          >
                            <MapPinIcon />
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <button onClick={() => setDeletingFuel(log.id)} className="text-[#333] ml-2 shrink-0 active:text-[#ef4444]">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ═══════════════════ MAINTENANCE TAB ═══════════════════ */}
        {activeTab === 2 && (
          <div className="px-4 pt-4 space-y-3">
            {/* Import button */}
            <button
              onClick={() => openImport('maintenance')}
              className="w-full py-3 rounded-xl border border-[#2a2a2a] text-[#f0a050] text-sm font-medium flex items-center justify-center gap-2"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Import from Screenshot
            </button>

            {/* Maintenance cards */}
            {maintLogs.length === 0 ? (
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 text-center">
                <p className="text-[#555] text-sm">No services logged yet</p>
                <p className="text-[#333] text-xs mt-1">Tap + to log your first service</p>
              </div>
            ) : (
              maintLogs.map((m) => {
                const expanded = expandedMaint.has(m.id);
                return (
                  <div key={m.id} className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
                    <div
                      className="p-4 flex items-center justify-between cursor-pointer"
                      onClick={() => {
                        const next = new Set(expandedMaint);
                        expanded ? next.delete(m.id) : next.add(m.id);
                        setExpandedMaint(next);
                      }}
                    >
                      <div className="flex-1">
                        <p className="text-white font-semibold">{m.service_type}</p>
                        <p className="text-[#555] text-xs mt-0.5">
                          {formatDate(m.date)}{m.mileage ? ` · ${m.mileage.toLocaleString()} mi` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-[#ccc] text-sm font-mono">{m.cost ? fmt(m.cost) : '—'}</p>
                        <svg
                          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"
                          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </div>
                    </div>
                    {expanded && (
                      <div className="px-4 pb-4 pt-3 border-t border-[#1a1a1a] space-y-2">
                        {m.shop ? (
                          <div className="flex items-center gap-1.5">
                            <p className="text-[#888] text-sm">{m.shop}</p>
                            <button
                              onClick={() => window.open(mapsUrl(m.shop), '_blank')}
                              className="text-[#f0a050]"
                              aria-label="View on Google Maps"
                            >
                              <MapPinIcon />
                            </button>
                          </div>
                        ) : null}
                        {m.notes ? <p className="text-[#555] text-sm">{m.notes}</p> : null}
                        <button onClick={() => setDeletingMaint(m.id)} className="text-[#ef4444] text-sm font-medium">
                          Delete record
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ═══════════════════ FIXED FABs ═══════════════════ */}
        {activeTab === 1 && !showFuelModal && !showImport && !deletingFuel && (
          <button
            onClick={openFuelModal}
            className="fixed bottom-24 right-5 w-14 h-14 bg-[#f0a050] rounded-full z-40 flex items-center justify-center"
            style={{ boxShadow: '0 4px 20px rgba(240,160,80,0.45)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}
        {activeTab === 2 && !showMaintModal && !showImport && !deletingMaint && (
          <button
            onClick={openMaintModal}
            className="fixed bottom-24 right-5 w-14 h-14 bg-[#f0a050] rounded-full z-40 flex items-center justify-center"
            style={{ boxShadow: '0 4px 20px rgba(240,160,80,0.45)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}

        {/* ═══════════════════ MODALS ═══════════════════ */}

        {/* Vehicle Setup Modal */}
        {showSetup && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
            <div className="bg-[#1c1c1e] rounded-2xl max-h-[85vh] overflow-y-auto pb-6 w-full max-w-lg">
              <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-[#2a2a2a] sticky top-0 bg-[#1c1c1e] z-10">
                <p className="text-white font-semibold text-lg">Vehicle Setup</p>
                <button onClick={() => setShowSetup(false)} className="text-[#555] text-2xl leading-none w-8 h-8 flex items-center justify-center">✕</button>
              </div>
              <div className="px-5 pt-4 space-y-3">
                {([
                  { label: 'Year', field: 'year', type: 'number', placeholder: String(new Date().getFullYear()) },
                  { label: 'Make', field: 'make', placeholder: 'Honda' },
                  { label: 'Model', field: 'model', placeholder: 'Civic' },
                  { label: 'Trim', field: 'trim_level', placeholder: 'Sport' },
                  { label: 'Color', field: 'color', placeholder: 'Silver' },
                  { label: 'License Plate', field: 'license_plate', placeholder: 'ABC 1234' },
                  { label: 'VIN', field: 'vin', placeholder: '1HGBH41JXMN109186' },
                ] as const).map(({ label, field, type, placeholder }) => (
                  <div key={field}>
                    <label className="text-[#888] text-xs mb-1 block">{label}</label>
                    <input
                      type={type || 'text'}
                      value={(setupForm as any)[field] || ''}
                      onChange={(e) => setSetupForm(f => ({ ...f, [field]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full bg-[#222] text-white rounded-xl px-3 py-2.5 text-sm border border-[#333] outline-none focus:border-[#f0a050]"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-[#888] text-xs mb-1 block">Purchase Date</label>
                  <input type="date" value={setupForm.purchase_date || ''} onChange={(e) => setSetupForm(f => ({ ...f, purchase_date: e.target.value }))} className="w-full bg-[#222] text-white rounded-xl px-3 py-2.5 text-sm border border-[#333] outline-none focus:border-[#f0a050]" />
                </div>
                <div>
                  <label className="text-[#888] text-xs mb-1 block">Purchase Price</label>
                  <input type="number" value={setupForm.purchase_price || ''} onChange={(e) => setSetupForm(f => ({ ...f, purchase_price: parseFloat(e.target.value) || undefined }))} placeholder="25000" className="w-full bg-[#222] text-white rounded-xl px-3 py-2.5 text-sm border border-[#333] outline-none focus:border-[#f0a050]" />
                </div>
                <div>
                  <label className="text-[#888] text-xs mb-1 block">Oil Change Interval</label>
                  <select value={setupForm.oil_change_interval || 5000} onChange={(e) => setSetupForm(f => ({ ...f, oil_change_interval: parseInt(e.target.value) }))} className="w-full bg-[#222] text-white rounded-xl px-3 py-2.5 text-sm border border-[#333] outline-none">
                    {OIL_INTERVALS.map(v => <option key={v} value={v}>{v.toLocaleString()} miles</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[#888] text-xs mb-1 block">Registration Expires</label>
                  <input type="date" value={setupForm.registration_expires || ''} onChange={(e) => setSetupForm(f => ({ ...f, registration_expires: e.target.value }))} className="w-full bg-[#222] text-white rounded-xl px-3 py-2.5 text-sm border border-[#333] outline-none focus:border-[#f0a050]" />
                </div>
                <div>
                  <label className="text-[#888] text-xs mb-1 block">Inspection Expires</label>
                  <input type="date" value={setupForm.inspection_expires || ''} onChange={(e) => setSetupForm(f => ({ ...f, inspection_expires: e.target.value }))} className="w-full bg-[#222] text-white rounded-xl px-3 py-2.5 text-sm border border-[#333] outline-none focus:border-[#f0a050]" />
                </div>
                <button onClick={saveSetup} disabled={setupLoading} className="w-full bg-[#f0a050] text-black font-semibold rounded-xl py-3 mt-2 disabled:opacity-50">
                  {setupLoading ? 'Saving...' : 'Save Vehicle'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Log Fill-Up Modal */}
        {showFuelModal && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
            <div className="bg-[#1c1c1e] rounded-2xl max-h-[85vh] overflow-y-auto pb-6 w-full max-w-lg">
              <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-[#2a2a2a] sticky top-0 bg-[#1c1c1e] z-10">
                <p className="text-white font-semibold text-lg">Log Fill-Up</p>
                <button onClick={() => setShowFuelModal(false)} className="text-[#555] text-2xl leading-none w-8 h-8 flex items-center justify-center">✕</button>
              </div>
              <div className="px-5 pt-4 space-y-3">
                <div>
                  <label className="text-[#888] text-xs mb-1 block">Date</label>
                  <input type="date" value={fuelForm.date} onChange={(e) => setFuelForm(f => ({ ...f, date: e.target.value }))} className="w-full bg-[#222] text-white rounded-xl px-3 py-2.5 text-sm border border-[#333] outline-none focus:border-[#f0a050]" />
                </div>
                <div>
                  <label className="text-[#888] text-xs mb-1 block">Gallons</label>
                  <input type="number" step="0.001" value={fuelForm.gallons} onChange={(e) => handleFuelInput('gallons', e.target.value)} placeholder="12.543" className="w-full bg-[#222] text-white rounded-xl px-3 py-2.5 text-sm border border-[#333] outline-none focus:border-[#f0a050]" />
                </div>
                <div>
                  <label className="text-[#888] text-xs mb-1 block">Price per Gallon</label>
                  <input type="number" step="0.001" value={fuelForm.price_per_gallon} onChange={(e) => handleFuelInput('price_per_gallon', e.target.value)} placeholder="3.459" className="w-full bg-[#222] text-white rounded-xl px-3 py-2.5 text-sm border border-[#333] outline-none focus:border-[#f0a050]" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[#888] text-xs">Total Cost</label>
                    {!fuelAutoCalc && (
                      <button onClick={() => {
                        const g = parseFloat(fuelForm.gallons), p = parseFloat(fuelForm.price_per_gallon);
                        if (!isNaN(g) && !isNaN(p)) setFuelForm(f => ({ ...f, total_cost: (g * p).toFixed(2) }));
                        setFuelAutoCalc(true);
                      }} className="text-[#f0a050] text-xs">↩ Reset to calculated</button>
                    )}
                    {fuelAutoCalc && <span className="text-[#555] text-xs">Auto-calculated</span>}
                  </div>
                  <input type="number" step="0.01" value={fuelForm.total_cost} onChange={(e) => { setFuelForm(f => ({ ...f, total_cost: e.target.value })); setFuelAutoCalc(false); }} placeholder="43.38" className="w-full bg-[#222] text-white rounded-xl px-3 py-2.5 text-sm border border-[#333] outline-none focus:border-[#f0a050]" />
                </div>
                <div>
                  <label className="text-[#888] text-xs mb-1 block">Odometer (mi)</label>
                  <input type="number" value={fuelForm.odometer} onChange={(e) => setFuelForm(f => ({ ...f, odometer: e.target.value }))} placeholder="45231" className="w-full bg-[#222] text-white rounded-xl px-3 py-2.5 text-sm border border-[#333] outline-none focus:border-[#f0a050]" />
                </div>
                <div>
                  <label className="text-[#888] text-xs mb-1 block">Station</label>
                  <PlacesInput
                    value={fuelForm.station}
                    onChange={(v) => setFuelForm(f => ({ ...f, station: v }))}
                    placeholder="Search gas stations..."
                  />
                </div>
                <div>
                  <label className="text-[#888] text-xs mb-1 block">Notes</label>
                  <input type="text" value={fuelForm.notes} onChange={(e) => setFuelForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" className="w-full bg-[#222] text-white rounded-xl px-3 py-2.5 text-sm border border-[#333] outline-none focus:border-[#f0a050]" />
                </div>
                <button onClick={saveFuel} disabled={fuelLoading || !fuelForm.date} className="w-full bg-[#f0a050] text-black font-semibold rounded-xl py-3 mt-2 disabled:opacity-50">
                  {fuelLoading ? 'Saving...' : 'Log Fill-Up'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Log Service Modal */}
        {showMaintModal && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
            <div className="bg-[#1c1c1e] rounded-2xl max-h-[85vh] overflow-y-auto pb-6 w-full max-w-lg">
              <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-[#2a2a2a] sticky top-0 bg-[#1c1c1e] z-10">
                <p className="text-white font-semibold text-lg">Log Service</p>
                <button onClick={() => setShowMaintModal(false)} className="text-[#555] text-2xl leading-none w-8 h-8 flex items-center justify-center">✕</button>
              </div>
              <div className="px-5 pt-4 space-y-3">
                <div>
                  <label className="text-[#888] text-xs mb-1 block">Date</label>
                  <input type="date" value={maintForm.date} onChange={(e) => setMaintForm(f => ({ ...f, date: e.target.value }))} className="w-full bg-[#222] text-white rounded-xl px-3 py-2.5 text-sm border border-[#333] outline-none focus:border-[#f0a050]" />
                </div>
                <div>
                  <label className="text-[#888] text-xs mb-1 block">Service Type</label>
                  <select value={maintForm.service_type} onChange={(e) => setMaintForm(f => ({ ...f, service_type: e.target.value }))} className="w-full bg-[#222] text-white rounded-xl px-3 py-2.5 text-sm border border-[#333] outline-none focus:border-[#f0a050]">
                    {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[#888] text-xs mb-1 block">Mileage</label>
                  <input type="number" value={maintForm.mileage} onChange={(e) => setMaintForm(f => ({ ...f, mileage: e.target.value }))} placeholder="45231" className="w-full bg-[#222] text-white rounded-xl px-3 py-2.5 text-sm border border-[#333] outline-none focus:border-[#f0a050]" />
                </div>
                <div>
                  <label className="text-[#888] text-xs mb-1 block">Cost</label>
                  <input type="number" step="0.01" value={maintForm.cost} onChange={(e) => setMaintForm(f => ({ ...f, cost: e.target.value }))} placeholder="89.99" className="w-full bg-[#222] text-white rounded-xl px-3 py-2.5 text-sm border border-[#333] outline-none focus:border-[#f0a050]" />
                </div>
                <div>
                  <label className="text-[#888] text-xs mb-1 block">Shop</label>
                  <PlacesInput
                    value={maintForm.shop}
                    onChange={(v) => setMaintForm(f => ({ ...f, shop: v }))}
                    placeholder="Search auto shops..."
                  />
                </div>
                <div>
                  <label className="text-[#888] text-xs mb-1 block">Notes</label>
                  <input type="text" value={maintForm.notes} onChange={(e) => setMaintForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" className="w-full bg-[#222] text-white rounded-xl px-3 py-2.5 text-sm border border-[#333] outline-none focus:border-[#f0a050]" />
                </div>
                <button onClick={saveMaint} disabled={maintLoading} className="w-full bg-[#f0a050] text-black font-semibold rounded-xl py-3 mt-2 disabled:opacity-50">
                  {maintLoading ? 'Saving...' : 'Log Service'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Screenshot Import Modal */}
        {showImport && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
            <div className="bg-[#1c1c1e] rounded-2xl max-h-[85vh] overflow-y-auto pb-6 w-full max-w-lg">
              <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-[#2a2a2a] sticky top-0 bg-[#1c1c1e] z-10">
                <p className="text-white font-semibold text-lg">
                  Import {importType === 'fuel' ? 'Fuel Records' : 'Service Records'}
                </p>
                <button onClick={() => setShowImport(false)} className="text-[#555] text-2xl leading-none w-8 h-8 flex items-center justify-center">✕</button>
              </div>
              <div className="px-5 pt-4 space-y-4">
                <p className="text-[#888] text-sm leading-relaxed">
                  {importType === 'fuel'
                    ? 'Upload a screenshot from GasBuddy, your fuel log app, or any fuel history. AI will read it and extract your fill-up records.'
                    : 'Upload a screenshot from Carfax, a dealership service history page, or any maintenance app. AI will extract your service records.'}
                </p>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />

                {/* Image picker area */}
                <button
                  onClick={() => { if (fileInputRef.current) { fileInputRef.current.value = ''; fileInputRef.current.click(); } }}
                  className="w-full rounded-2xl border-2 border-dashed border-[#333] overflow-hidden"
                >
                  {importImagePreview ? (
                    <div className="relative">
                      <img src={importImagePreview} alt="Selected screenshot" className="w-full max-h-48 object-contain bg-[#0a0a0a]" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-1.5 text-center">
                        <p className="text-[#f0a050] text-xs font-medium">Tap to change image</p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-10 flex flex-col items-center justify-center gap-2">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                      <p className="text-[#555] text-sm">Tap to choose screenshot</p>
                      <p className="text-[#333] text-xs">Camera or photo library</p>
                    </div>
                  )}
                </button>

                {/* Extract button — shown after image selected, before results */}
                {importImageB64 && importResults.length === 0 && (
                  <button
                    onClick={runImport}
                    disabled={importLoading}
                    className="w-full bg-[#f0a050] text-black font-semibold rounded-xl py-3 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {importLoading ? (
                      <>
                        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                        </svg>
                        Extracting records...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                        </svg>
                        Extract Records with AI
                      </>
                    )}
                  </button>
                )}

                {/* Review extracted records */}
                {importResults.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-white font-semibold text-sm">
                        {importResults.filter(r => r._keep).length} of {importResults.length} records selected
                      </p>
                      <button onClick={() => { setImportResults([]); setImportImagePreview(null); setImportImageB64(null); }} className="text-[#555] text-xs">
                        Try again
                      </button>
                    </div>

                    {importResults.map((record) => (
                      <div
                        key={record._idx}
                        className={`rounded-xl p-3 border transition-opacity ${record._keep ? 'bg-[#1a1a1a] border-[#333]' : 'bg-[#111] border-[#1a1a1a] opacity-40'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {importType === 'fuel' ? (
                              <>
                                <p className="text-white text-sm font-semibold">{record.total_cost != null ? fmt(record.total_cost) : '—'}</p>
                                <p className="text-[#ccc] text-xs mt-0.5">
                                  {record.gallons != null ? `${record.gallons} gal` : ''}
                                  {record.price_per_gallon != null ? ` @ $${record.price_per_gallon}/gal` : ''}
                                </p>
                                <p className="text-[#555] text-xs mt-0.5">
                                  {record.date || ''}
                                  {record.odometer != null ? ` · ${record.odometer.toLocaleString()} mi` : ''}
                                </p>
                                {record.station && <p className="text-[#555] text-xs mt-0.5 truncate">{record.station}</p>}
                              </>
                            ) : (
                              <>
                                <p className="text-white text-sm font-semibold">{record.service_type}</p>
                                <p className="text-[#ccc] text-xs mt-0.5">
                                  {record.date || ''}
                                  {record.mileage != null ? ` · ${record.mileage.toLocaleString()} mi` : ''}
                                  {record.cost != null ? ` · ${fmt(record.cost)}` : ''}
                                </p>
                                {record.shop && <p className="text-[#555] text-xs mt-0.5 truncate">{record.shop}</p>}
                                {record.notes && <p className="text-[#555] text-xs mt-0.5 truncate">{record.notes}</p>}
                              </>
                            )}
                          </div>
                          <button
                            onClick={() => setImportResults(rs => rs.map(r => r._idx === record._idx ? { ...r, _keep: !r._keep } : r))}
                            className={`text-xs font-semibold shrink-0 px-2 py-1 rounded-lg ${record._keep ? 'text-[#ef4444] bg-[#ef4444]/10' : 'text-[#22c55e] bg-[#22c55e]/10'}`}
                          >
                            {record._keep ? 'Remove' : 'Add'}
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={saveImportedRecords}
                      disabled={importSaving || importResults.filter(r => r._keep).length === 0}
                      className="w-full bg-[#f0a050] text-black font-semibold rounded-xl py-3 disabled:opacity-50"
                    >
                      {importSaving
                        ? 'Saving...'
                        : `Save ${importResults.filter(r => r._keep).length} Record${importResults.filter(r => r._keep).length !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Fuel Confirm */}
        {deletingFuel && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
            <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-lg p-5">
              <p className="text-white font-semibold text-center mb-1">Delete Fill-Up?</p>
              <p className="text-[#888] text-sm text-center mb-4">This cannot be undone</p>
              <div className="flex gap-3">
                <button onClick={() => setDeletingFuel(null)} className="flex-1 py-3 rounded-xl bg-[#222] text-white text-sm font-medium">Cancel</button>
                <button onClick={() => deleteFuel(deletingFuel)} className="flex-1 py-3 rounded-xl bg-[#ef4444] text-white text-sm font-medium">Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Maintenance Confirm */}
        {deletingMaint && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
            <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-lg p-5">
              <p className="text-white font-semibold text-center mb-1">Delete Service Record?</p>
              <p className="text-[#888] text-sm text-center mb-4">This cannot be undone</p>
              <div className="flex gap-3">
                <button onClick={() => setDeletingMaint(null)} className="flex-1 py-3 rounded-xl bg-[#222] text-white text-sm font-medium">Cancel</button>
                <button onClick={() => deleteMaint(deletingMaint)} className="flex-1 py-3 rounded-xl bg-[#ef4444] text-white text-sm font-medium">Delete</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PullToRefresh>
  );
}