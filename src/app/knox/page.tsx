'use client';

import { useState, useEffect } from 'react';
import PullToRefresh from '@/components/PullToRefresh';

const TABS = ['Overview', 'Vet Visits', 'Medications'];
const MED_TYPES = ['Flea & Tick', 'Heartworm', 'Dewormer', 'Antibiotic', 'Supplement', 'Vaccine', 'Other'];
const MED_FREQUENCIES = ['Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Every 3 months', 'Every 6 months', 'Yearly', 'As needed'];
const WEIGHT_CACHE = 'knox-weight';
const VET_CACHE = 'knox-vet';
const MEDS_CACHE = 'knox-meds';

function fmtDate(d: string) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
}

function fmtTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function daysUntil(d: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d + 'T00:00:00');
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function dateColor(d: string) {
  if (!d) return '#888';
  const days = daysUntil(d);
  if (days < 0) return '#ef4444';
  if (days <= 7) return '#f0a050';
  return '#22c55e';
}

export default function KnoxPage() {
  const [activeTab, setActiveTab] = useState(0);

  // Weight
  const [weights, setWeights] = useState<any[]>([]);
  const [weightLoading, setWeightLoading] = useState(true);
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [wDate, setWDate] = useState('');
  const [wLbs, setWLbs] = useState('');
  const [wNotes, setWNotes] = useState('');
  const [weightSaving, setWeightSaving] = useState(false);
  const [deleteWeightId, setDeleteWeightId] = useState<string | null>(null);

  // Vet
  const [vetVisits, setVetVisits] = useState<any[]>([]);
  const [vetLoading, setVetLoading] = useState(true);
  const [showAddVet, setShowAddVet] = useState(false);
  const [vDate, setVDate] = useState('');
  const [vType, setVType] = useState('');
  const [vVet, setVVet] = useState('VCA Sinking Spring');
  const [vCost, setVCost] = useState('');
  const [vNotes, setVNotes] = useState('');
  const [vNextDate, setVNextDate] = useState('');
  const [vNextTime, setVNextTime] = useState('');
  const [vetSaving, setVetSaving] = useState(false);
  const [deleteVetId, setDeleteVetId] = useState<string | null>(null);

  // Meds
  const [meds, setMeds] = useState<any[]>([]);
  const [medsLoading, setMedsLoading] = useState(true);
  const [showAddMed, setShowAddMed] = useState(false);
  const [editMed, setEditMed] = useState<any | null>(null);
  const [deleteMedId, setDeleteMedId] = useState<string | null>(null);
  const [mName, setMName] = useState('');
  const [mType, setMType] = useState('');
  const [mDosage, setMDosage] = useState('');
  const [mFreq, setMFreq] = useState('');
  const [mCost, setMCost] = useState('');
  const [mNextDue, setMNextDue] = useState('');
  const [mLastGiven, setMLastGiven] = useState('');
  const [mNotes, setMNotes] = useState('');
  const [mActive, setMActive] = useState(true);
  const [medSaving, setMedSaving] = useState(false);

  const knoxBirth = new Date('2026-01-14');
  const now = new Date();
  const months = Math.floor((now.getTime() - knoxBirth.getTime()) / 2630016000);
  const weeks = Math.floor((now.getTime() - knoxBirth.getTime()) / 604800000);
  const latestWeight = weights[0];
  const nextVet = [...vetVisits]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .find(v => v.next_visit_date);
  const upcomingMeds = meds.filter(m => m.is_active && m.next_due_date);

  async function fetchWeights() {
    setWeightLoading(true);
    try {
      const res = await fetch('/api/knox/weight');
      if (res.ok) {
        const data = await res.json();
        setWeights(data);
        localStorage.setItem(WEIGHT_CACHE, JSON.stringify(data));
      }
    } finally { setWeightLoading(false); }
  }

  async function fetchVets() {
    setVetLoading(true);
    try {
      const res = await fetch('/api/knox/vet-visits');
      if (res.ok) {
        const data = await res.json();
        setVetVisits(data);
        localStorage.setItem(VET_CACHE, JSON.stringify(data));
      }
    } finally { setVetLoading(false); }
  }

  async function fetchMeds() {
    setMedsLoading(true);
    try {
      const res = await fetch('/api/knox/medications');
      if (res.ok) {
        const data = await res.json();
        setMeds(data);
        localStorage.setItem(MEDS_CACHE, JSON.stringify(data));
      }
    } finally { setMedsLoading(false); }
  }

  async function refreshAll() {
    await Promise.all([fetchWeights(), fetchVets(), fetchMeds()]);
  }

  useEffect(() => {
    try {
      const w = localStorage.getItem(WEIGHT_CACHE);
      if (w) setWeights(JSON.parse(w));
      const v = localStorage.getItem(VET_CACHE);
      if (v) setVetVisits(JSON.parse(v));
      const m = localStorage.getItem(MEDS_CACHE);
      if (m) setMeds(JSON.parse(m));
    } catch {}
    fetchWeights(); fetchVets(); fetchMeds();
  }, []);

  async function saveWeight() {
    if (!wDate || !wLbs) return;
    setWeightSaving(true);
    try {
      const res = await fetch('/api/knox/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_date: wDate, weight_lbs: parseFloat(wLbs), notes: wNotes }),
      });
      if (res.ok) {
        setShowAddWeight(false);
        setWDate(''); setWLbs(''); setWNotes('');
        fetchWeights();
      }
    } finally { setWeightSaving(false); }
  }

  async function deleteWeight(id: string) {
    await fetch(`/api/knox/weight/${id}`, { method: 'DELETE' });
    setDeleteWeightId(null);
    fetchWeights();
  }

  async function saveVet() {
    if (!vDate || !vType) return;
    setVetSaving(true);
    try {
      const res = await fetch('/api/knox/vet-visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: vDate, visit_type: vType, vet_name: vVet,
          cost: vCost ? parseFloat(vCost) : null,
          notes: vNotes,
          next_visit_date: vNextDate || null,
          next_visit_time: vNextTime || null,
        }),
      });
      if (res.ok) {
        setShowAddVet(false);
        setVDate(''); setVType(''); setVVet('VCA Sinking Spring');
        setVCost(''); setVNotes(''); setVNextDate(''); setVNextTime('');
        fetchVets();
      }
    } finally { setVetSaving(false); }
  }

  async function deleteVet(id: string) {
    await fetch(`/api/knox/vet-visits/${id}`, { method: 'DELETE' });
    setDeleteVetId(null);
    fetchVets();
  }

  function openEditMed(med: any) {
    setEditMed(med);
    setMName(med.medication_name || '');
    setMType(med.medication_type || '');
    setMDosage(med.dosage || '');
    setMFreq(med.frequency || '');
    setMCost(med.cost_per_dose ? String(med.cost_per_dose) : '');
    setMNextDue(med.next_due_date || '');
    setMLastGiven(med.last_given_date || '');
    setMNotes(med.notes || '');
    setMActive(med.is_active !== false);
    setShowAddMed(true);
  }

  function openAddMed() {
    setEditMed(null);
    setMName(''); setMType(''); setMDosage(''); setMFreq(''); setMCost('');
    setMNextDue(''); setMLastGiven(''); setMNotes(''); setMActive(true);
    setShowAddMed(true);
  }

  async function saveMed() {
    if (!mName) return;
    setMedSaving(true);
    try {
      const body = {
        medication_name: mName, medication_type: mType || null,
        dosage: mDosage || null, frequency: mFreq || null,
        cost_per_dose: mCost ? parseFloat(mCost) : null,
        next_due_date: mNextDue || null, last_given_date: mLastGiven || null,
        is_active: mActive, notes: mNotes || null,
      };
      const url = editMed ? `/api/knox/medications/${editMed.id}` : '/api/knox/medications';
      const res = await fetch(url, {
        method: editMed ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) { setShowAddMed(false); setEditMed(null); fetchMeds(); }
    } finally { setMedSaving(false); }
  }

  async function deleteMed(id: string) {
    await fetch(`/api/knox/medications/${id}`, { method: 'DELETE' });
    setDeleteMedId(null);
    fetchMeds();
  }

  return (
    <PullToRefresh onRefresh={refreshAll}>
      <div className="pb-24 bg-black min-h-screen">

        {/* Page header */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center text-2xl">🐺</div>
            <div>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Knox</h1>
              <p className="text-[#888] text-xs">Siberian Husky · {months}mo ({weeks}wk) · Jan 14, 2026</p>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[#1a1a1a] sticky top-0 bg-black z-10">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(i); window.scrollTo(0, 0); navigator.vibrate && navigator.vibrate(8); }}
              className={`flex-1 py-3 text-xs font-semibold transition-colors ${activeTab === i ? 'text-[#f0a050] border-b-2 border-[#f0a050]' : 'text-[#555]'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ─── OVERVIEW TAB ─── */}
        {activeTab === 0 && (
          <div className="px-4 pt-4 space-y-3">

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                <p className="text-[#555] text-xs mb-1">Current Weight</p>
                {latestWeight ? (
                  <>
                    <p className="text-white text-2xl font-mono font-bold">
                      {latestWeight.weight_lbs}<span className="text-sm text-[#888] ml-1">lbs</span>
                    </p>
                    <p className="text-[#555] text-xs mt-1">{fmtDate(latestWeight.log_date)}</p>
                  </>
                ) : <p className="text-[#555] text-sm">No data</p>}
              </div>
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                <p className="text-[#555] text-xs mb-1">Next Vet</p>
                {nextVet?.next_visit_date ? (
                  <>
                    <p className="text-white text-sm font-semibold">{fmtDate(nextVet.next_visit_date)}</p>
                    {nextVet.next_visit_time && (
                      <p className="text-[#f0a050] text-xs mt-0.5">{fmtTime(nextVet.next_visit_time)}</p>
                    )}
                    <p className="text-xs mt-1" style={{ color: dateColor(nextVet.next_visit_date) }}>
                      {(() => {
                        const d = daysUntil(nextVet.next_visit_date);
                        return d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Today' : `${d}d away`;
                      })()}
                    </p>
                  </>
                ) : <p className="text-[#555] text-sm">Not scheduled</p>}
              </div>
            </div>

            {/* Upcoming meds */}
            {upcomingMeds.length > 0 && (
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                <p className="text-[#555] text-xs mb-3">Upcoming Medications</p>
                <div className="space-y-2">
                  {upcomingMeds.slice(0, 3).map(med => {
                    const color = dateColor(med.next_due_date);
                    const days = daysUntil(med.next_due_date);
                    return (
                      <div key={med.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-white text-sm font-medium">{med.medication_name}</p>
                          {med.medication_type && <p className="text-[#555] text-xs">{med.medication_type}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-mono" style={{ color }}>{fmtDate(med.next_due_date)}</p>
                          <p className="text-xs" style={{ color }}>{days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Weight log card — button lives in the card header */}
            <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white text-sm font-semibold">Weight Log</p>
                <button
                  onClick={() => { setShowAddWeight(true); setWDate(new Date().toISOString().split('T')[0]); }}
                  className="text-[#f0a050] text-xs font-semibold"
                >
                  + Log
                </button>
              </div>
              {weightLoading && weights.length === 0 ? (
                <p className="text-[#555] text-sm">Loading...</p>
              ) : weights.length === 0 ? (
                <p className="text-[#555] text-sm">No entries yet</p>
              ) : (
                <div className="space-y-3">
                  {weights.map((w, i) => (
                    <div key={w.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-mono font-semibold">{w.weight_lbs} lbs</p>
                        {w.notes && <p className="text-[#555] text-xs">{w.notes}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-[#888] text-xs">{fmtDate(w.log_date)}</p>
                        {i < weights.length - 1 && (
                          <p className="text-xs font-mono" style={{ color: w.weight_lbs > weights[i + 1]?.weight_lbs ? '#22c55e' : '#f0a050' }}>
                            +{(w.weight_lbs - weights[i + 1]?.weight_lbs).toFixed(1)}
                          </p>
                        )}
                        <button onClick={() => setDeleteWeightId(w.id)} className="text-[#333] text-xs p-1">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── VET VISITS TAB ─── */}
        {activeTab === 1 && (
          <div className="px-4 pt-4 space-y-3">
            {/* Tab header row with button */}
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold">Vet Visits</p>
              <button
                onClick={() => { setShowAddVet(true); setVDate(new Date().toISOString().split('T')[0]); }}
                className="text-[#f0a050] text-sm font-semibold"
              >
                + Visit
              </button>
            </div>
            {vetLoading && vetVisits.length === 0 ? (
              <p className="text-[#555] text-sm px-1">Loading...</p>
            ) : vetVisits.length === 0 ? (
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 text-center">
                <p className="text-[#555] text-sm">No vet visits yet</p>
              </div>
            ) : (
              vetVisits.map(v => (
                <div key={v.id} className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold">{v.visit_type}</p>
                      <p className="text-[#888] text-xs">{v.vet_name} · {fmtDate(v.date)}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      {v.cost != null && (
                        <p className="text-[#f0a050] text-xs font-mono">${parseFloat(v.cost).toFixed(2)}</p>
                      )}
                      <button onClick={() => setDeleteVetId(v.id)} className="text-[#333] text-xs p-1">✕</button>
                    </div>
                  </div>
                  {v.notes && <p className="text-[#555] text-xs mt-2 whitespace-pre-line">{v.notes}</p>}
                  {v.next_visit_date && (
                    <div className="mt-2 pt-2 border-t border-[#1a1a1a]">
                      <p className="text-xs" style={{ color: dateColor(v.next_visit_date) }}>
                        Next: {fmtDate(v.next_visit_date)}
                        {v.next_visit_time ? ` at ${fmtTime(v.next_visit_time)}` : ''} · {(() => {
                          const d = daysUntil(v.next_visit_date);
                          return d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Today' : `${d}d away`;
                        })()}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── MEDICATIONS TAB ─── */}
        {activeTab === 2 && (
          <div className="px-4 pt-4 space-y-3">
            {/* Tab header row with button */}
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold">Medications</p>
              <button onClick={openAddMed} className="text-[#f0a050] text-sm font-semibold">+ Add</button>
            </div>
            {medsLoading && meds.length === 0 ? (
              <p className="text-[#555] text-sm px-1">Loading...</p>
            ) : meds.length === 0 ? (
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 text-center">
                <p className="text-[#555] text-sm">No medications added yet</p>
                <p className="text-[#333] text-xs mt-1">Tap + to add heartworm, flea prevention, etc.</p>
              </div>
            ) : (
              <>
                {meds.filter(m => m.is_active).length > 0 && (
                  <div>
                    <p className="text-[#555] text-xs font-semibold uppercase tracking-wider px-1 mb-2">Active</p>
                    <div className="space-y-2">
                      {meds.filter(m => m.is_active).map(med => {
                        const color = med.next_due_date ? dateColor(med.next_due_date) : '#888';
                        const days = med.next_due_date ? daysUntil(med.next_due_date) : null;
                        return (
                          <div key={med.id} className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-semibold">{med.medication_name}</p>
                                <div className="flex flex-wrap gap-x-3 mt-1">
                                  {med.medication_type && <p className="text-[#888] text-xs">{med.medication_type}</p>}
                                  {med.dosage && <p className="text-[#888] text-xs">{med.dosage}</p>}
                                  {med.frequency && <p className="text-[#888] text-xs">{med.frequency}</p>}
                                </div>
                                {med.next_due_date && (
                                  <p className="text-xs mt-2" style={{ color }}>
                                    Next due: {fmtDate(med.next_due_date)}
                                    {days !== null && ` · ${days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}`}
                                  </p>
                                )}
                                {med.last_given_date && (
                                  <p className="text-[#555] text-xs mt-0.5">Last given: {fmtDate(med.last_given_date)}</p>
                                )}
                                {med.notes && <p className="text-[#555] text-xs mt-1">{med.notes}</p>}
                              </div>
                              <div className="flex gap-2 ml-2">
                                <button onClick={() => openEditMed(med)} className="text-[#f0a050] text-xs p-1">✏️</button>
                                <button onClick={() => setDeleteMedId(med.id)} className="text-[#333] text-xs p-1">✕</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {meds.filter(m => !m.is_active).length > 0 && (
                  <div>
                    <p className="text-[#555] text-xs font-semibold uppercase tracking-wider px-1 mb-2 mt-4">Inactive</p>
                    <div className="space-y-2 opacity-50">
                      {meds.filter(m => !m.is_active).map(med => (
                        <div key={med.id} className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-white text-sm">{med.medication_name}</p>
                              {med.medication_type && <p className="text-[#555] text-xs">{med.medication_type}</p>}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => openEditMed(med)} className="text-[#f0a050] text-xs p-1">✏️</button>
                              <button onClick={() => setDeleteMedId(med.id)} className="text-[#333] text-xs p-1">✕</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════
            MODALS
        ═══════════════════════════════════════ */}

        {/* Log Weight modal */}
        {showAddWeight && (
          <div
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
            onClick={() => setShowAddWeight(false)}
          >
            <div
              className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto pb-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 border-b border-[#2a2a2a]">
                <h2 className="text-white text-lg font-bold">Log Weight</h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-[#888] text-xs block mb-1">Date</label>
                  <input type="date" value={wDate} onChange={e => setWDate(e.target.value)}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Weight (lbs)</label>
                  <input type="number" step="0.1" value={wLbs} onChange={e => setWLbs(e.target.value)}
                    placeholder="33.4" className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Notes (optional)</label>
                  <input type="text" value={wNotes} onChange={e => setWNotes(e.target.value)}
                    placeholder="e.g. 20 weeks" className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowAddWeight(false)}
                    className="flex-1 py-3 rounded-xl bg-[#2a2a2a] text-white text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveWeight}
                    disabled={weightSaving || !wDate || !wLbs}
                    className="flex-1 py-3 rounded-xl bg-[#f0a050] text-black text-sm font-semibold disabled:opacity-40"
                  >
                    {weightSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Log Vet Visit modal */}
        {showAddVet && (
          <div
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
            onClick={() => setShowAddVet(false)}
          >
            <div
              className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto pb-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 border-b border-[#2a2a2a]">
                <h2 className="text-white text-lg font-bold">Log Vet Visit</h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-[#888] text-xs block mb-1">Visit Date</label>
                  <input type="date" value={vDate} onChange={e => setVDate(e.target.value)}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Visit Type</label>
                  <input type="text" value={vType} onChange={e => setVType(e.target.value)}
                    placeholder="e.g. Wellness Exam, Vaccines"
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Vet / Clinic</label>
                  <input type="text" value={vVet} onChange={e => setVVet(e.target.value)}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Cost</label>
                  <input type="number" step="0.01" value={vCost} onChange={e => setVCost(e.target.value)}
                    placeholder="0.00" className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Notes</label>
                  <textarea value={vNotes} onChange={e => setVNotes(e.target.value)} rows={3}
                    placeholder="Vaccines given, observations..."
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm resize-none" />
                </div>
                <div className="border-t border-[#2a2a2a] pt-3">
                  <p className="text-[#f0a050] text-xs font-semibold mb-3">Next Appointment</p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[#888] text-xs block mb-1">Date</label>
                      <input type="date" value={vNextDate} onChange={e => setVNextDate(e.target.value)}
                        className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                    </div>
                    <div>
                      <label className="text-[#888] text-xs block mb-1">Time (optional)</label>
                      <input type="time" value={vNextTime} onChange={e => setVNextTime(e.target.value)}
                        className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowAddVet(false)}
                    className="flex-1 py-3 rounded-xl bg-[#2a2a2a] text-white text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveVet}
                    disabled={vetSaving || !vDate || !vType}
                    className="flex-1 py-3 rounded-xl bg-[#f0a050] text-black text-sm font-semibold disabled:opacity-40"
                  >
                    {vetSaving ? 'Saving...' : 'Save Visit'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add / Edit Medication modal */}
        {showAddMed && (
          <div
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
            onClick={() => setShowAddMed(false)}
          >
            <div
              className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto pb-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 border-b border-[#2a2a2a]">
                <h2 className="text-white text-lg font-bold">{editMed ? 'Edit Medication' : 'Add Medication'}</h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-[#888] text-xs block mb-1">Medication Name</label>
                  <input type="text" value={mName} onChange={e => setMName(e.target.value)}
                    placeholder="e.g. Heartgard, NexGard"
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Type</label>
                  <select value={mType} onChange={e => setMType(e.target.value)}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm">
                    <option value="">Select type...</option>
                    {MED_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Dosage</label>
                  <input type="text" value={mDosage} onChange={e => setMDosage(e.target.value)}
                    placeholder="e.g. 25-50kg, 1 chew"
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Frequency</label>
                  <select value={mFreq} onChange={e => setMFreq(e.target.value)}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm">
                    <option value="">Select frequency...</option>
                    {MED_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Cost per dose</label>
                  <input type="number" step="0.01" value={mCost} onChange={e => setMCost(e.target.value)}
                    placeholder="0.00" className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Next Due Date</label>
                  <input type="date" value={mNextDue} onChange={e => setMNextDue(e.target.value)}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Last Given Date</label>
                  <input type="date" value={mLastGiven} onChange={e => setMLastGiven(e.target.value)}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Notes</label>
                  <input type="text" value={mNotes} onChange={e => setMNotes(e.target.value)}
                    placeholder="Any notes..."
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-[#888] text-xs">Active</label>
                  <button
                    onClick={() => setMActive(!mActive)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${mActive ? 'bg-[#f0a050]' : 'bg-[#333]'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${mActive ? 'left-6' : 'left-0.5'}`} />
                  </button>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowAddMed(false)}
                    className="flex-1 py-3 rounded-xl bg-[#2a2a2a] text-white text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveMed}
                    disabled={medSaving || !mName}
                    className="flex-1 py-3 rounded-xl bg-[#f0a050] text-black text-sm font-semibold disabled:opacity-40"
                  >
                    {medSaving ? 'Saving...' : editMed ? 'Update' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Weight confirm */}
        {deleteWeightId && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
            <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm p-5 space-y-3">
              <p className="text-white text-center font-semibold">Delete this weight entry?</p>
              <button onClick={() => deleteWeight(deleteWeightId)} className="w-full bg-[#ef4444] text-white rounded-xl p-3 font-semibold">Delete</button>
              <button onClick={() => setDeleteWeightId(null)} className="w-full bg-[#1a1a1a] text-[#888] rounded-xl p-3">Cancel</button>
            </div>
          </div>
        )}

        {/* Delete Vet confirm */}
        {deleteVetId && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
            <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm p-5 space-y-3">
              <p className="text-white text-center font-semibold">Delete this vet visit?</p>
              <button onClick={() => deleteVet(deleteVetId)} className="w-full bg-[#ef4444] text-white rounded-xl p-3 font-semibold">Delete</button>
              <button onClick={() => setDeleteVetId(null)} className="w-full bg-[#1a1a1a] text-[#888] rounded-xl p-3">Cancel</button>
            </div>
          </div>
        )}

        {/* Delete Med confirm */}
        {deleteMedId && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
            <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm p-5 space-y-3">
              <p className="text-white text-center font-semibold">Delete this medication?</p>
              <button onClick={() => deleteMed(deleteMedId)} className="w-full bg-[#ef4444] text-white rounded-xl p-3 font-semibold">Delete</button>
              <button onClick={() => setDeleteMedId(null)} className="w-full bg-[#1a1a1a] text-[#888] rounded-xl p-3">Cancel</button>
            </div>
          </div>
        )}

      </div>
    </PullToRefresh>
  );
}