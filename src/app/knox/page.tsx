'use client';

import { useState, useEffect } from 'react';
import PullToRefresh from '@/components/PullToRefresh';

const TABS = ['Overview', 'Vet Visits', 'Medications'];
const MED_TYPES = ['Flea & Tick', 'Heartworm', 'Dewormer', 'Antibiotic', 'Supplement', 'Vaccine', 'Other'];
const MED_FREQUENCIES = ['Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Every 3 months', 'Every 6 months', 'Yearly', 'As needed'];
const WEIGHT_CACHE = 'knox-weight-v1';
const VET_CACHE = 'knox-vet-v1';
const MEDS_CACHE = 'knox-meds-v1';

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
  
  // Universal Interactive Expansion States
  const [expandedWeight, setExpandedWeight] = useState<Set<string>>(new Set());
  const [expandedVet, setExpandedVet] = useState<Set<string>>(new Set());
  const [expandedMed, setExpandedMed] = useState<Set<string>>(new Set());

  // Weight Log Parameters
  const [weights, setWeights] = useState<any[]>([]);
  const [weightLoading, setWeightLoading] = useState(true);
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [editWeightEntry, setEditWeightEntry] = useState<any | null>(null);
  const [wDate, setWDate] = useState('');
  const [wLbs, setWLbs] = useState('');
  const [wNotes, setWNotes] = useState('');
  const [weightSaving, setWeightSaving] = useState(false);
  const [deleteWeightId, setDeleteWeightId] = useState<string | null>(null);

  // Veterinary Appointment Parameters
  const [vetVisits, setVetVisits] = useState<any[]>([]);
  const [vetLoading, setVetLoading] = useState(true);
  const [showAddVet, setShowAddVet] = useState(false);
  const [editVetEntry, setEditVetEntry] = useState<any | null>(null);
  const [vDate, setVDate] = useState('');
  const [vType, setVType] = useState('');
  const [vVet, setVVet] = useState('VCA Sinking Spring');
  const [vCost, setVCost] = useState('');
  const [vNotes, setVNotes] = useState('');
  const [vNextDate, setVNextDate] = useState('');
  const [vNextTime, setVNextTime] = useState('');
  const [vetSaving, setVetSaving] = useState(false);
  const [deleteVetId, setDeleteVetId] = useState<string | null>(null);

  // Medications Logistics
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

  // Knox Dynamic Metrics
  const knoxBirth = new Date('2026-01-14');
  const now = new Date();
  
  // Calculate months and remaining weeks accurately
  const totalDays = Math.floor((now.getTime() - knoxBirth.getTime()) / 86400000);
  const weeks = Math.floor(totalDays / 7);
  const months = Math.floor(weeks / 4.345);

  const latestWeight = weights[0];
  const nextVet = [...vetVisits]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .find(v => v.next_visit_date);
  const upcomingMeds = meds.filter(m => m.is_active && m.next_due_date);

  // Reading PA Weather Mitigation (Checks if current date falls within historical summer heat months)
  const currentMonthIdx = now.getMonth(); 
  const isSummerSeason = currentMonthIdx >= 4 && currentMonthIdx <= 7; // May - August

  async function fetchWeights() {
    setWeightLoading(true);
    try {
      const res = await fetch('/api/knox/weight');
      if (res.ok) {
        const data = await res.json();
        setWeights(data);
        localStorage.setItem(WEIGHT_CACHE, JSON.stringify(data));
      }
    } catch (e) {
      console.error('Weight fetch error:', e);
    } finally { 
      setWeightLoading(false); 
    }
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
    } catch (e) {
      console.error('Vet fetch error:', e);
    } finally { 
      setVetLoading(false); 
    }
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
    } catch (e) {
      console.error('Meds fetch error:', e);
    } finally { 
      setMedsLoading(false); 
    }
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
      const body = { log_date: wDate, weight_lbs: parseFloat(wLbs), notes: wNotes.trim() || null };
      const url = editWeightEntry ? `/api/knox/weight/${editWeightEntry.id}` : '/api/knox/weight';
      const res = await fetch(url, {
        method: editWeightEntry ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowAddWeight(false);
        setEditWeightEntry(null);
        setWDate(''); setWLbs(''); setWNotes('');
        await fetchWeights();
      }
    } catch (err) {
      console.error('Error saving weight data:', err);
    } finally { 
      setWeightSaving(false); 
    }
  }

  async function deleteWeight(id: string) {
    try {
      const res = await fetch(`/api/knox/weight/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteWeightId(null);
        const next = new Set(expandedWeight);
        next.delete(id);
        setExpandedWeight(next);
        await fetchWeights();
      }
    } catch (e) {
      console.error('Delete weight error:', e);
    }
  }

  async function saveVet() {
    if (!vDate || !vType) return;
    setVetSaving(true);
    try {
      const body = {
        date: vDate, visit_type: vType.trim(), vet_name: vVet.trim() || 'VCA Sinking Spring',
        cost: vCost ? parseFloat(vCost) : null,
        notes: vNotes.trim() || null,
        next_visit_date: vNextDate || null,
        next_visit_time: vNextTime || null,
      };
      const url = editVetEntry ? `/api/knox/vet-visits/${editVetEntry.id}` : '/api/knox/vet-visits';
      const res = await fetch(url, {
        method: editVetEntry ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowAddVet(false);
        setEditVetEntry(null);
        setVDate(''); setVType(''); setVVet('VCA Sinking Spring');
        setVCost(''); setVNotes(''); setVNextDate(''); setVNextTime('');
        await fetchVets();
      }
    } catch (err) {
      console.error('Error saving clinic metrics:', err);
    } finally { 
      setVetSaving(false); 
    }
  }

  async function deleteVet(id: string) {
    try {
      const res = await fetch(`/api/knox/vet-visits/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteVetId(null);
        const next = new Set(expandedVet);
        next.delete(id);
        setExpandedVet(next);
        await fetchVets();
      }
    } catch (e) {
      console.error('Delete vet error:', e);
    }
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
    if (!mName.trim()) return;
    setMedSaving(true);
    try {
      const body = {
        medication_name: mName.trim(), medication_type: mType || null,
        dosage: mDosage.trim() || null, frequency: mFreq || null,
        cost_per_dose: mCost ? parseFloat(mCost) : null,
        next_due_date: mNextDue || null, last_given_date: mLastGiven || null,
        is_active: mActive, notes: mNotes.trim() || null,
      };
      const url = editMed ? `/api/knox/medications/${editMed.id}` : '/api/knox/medications';
      const res = await fetch(url, {
        method: editMed ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) { 
        setShowAddMed(false); 
        setEditMed(null); 
        if (editMed) {
          const next = new Set(expandedMed);
          next.delete(editMed.id);
          setExpandedMed(next);
        }
        await fetchMeds(); 
      }
    } catch (err) {
      console.error('Network error saving medication:', err);
    } finally { 
      setMedSaving(false); 
    }
  }

  async function deleteMed(id: string) {
    try {
      const res = await fetch(`/api/knox/medications/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteMedId(null);
        const next = new Set(expandedMed);
        next.delete(id);
        setExpandedMed(next);
        await fetchMeds();
      }
    } catch (e) {
      console.error('Delete medication error:', e);
    }
  }

  return (
    <>
      <PullToRefresh onRefresh={refreshAll}>
        <div className="pb-24 bg-black min-h-screen">

          {/* Page header */}
          <div className="px-4 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center text-2xl">🐺</div>
              <div>
                <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Knox</h1>
                <p className="text-[#888] text-xs font-mono">Siberian Husky · {months}M ({weeks}W) · Jan 14, 2026</p>
              </div>
            </div>
          </div>

          {/* Sticky Tab Bar Container */}
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

              {/* Local Reading, PA Climate Safety Widget */}
              {isSummerSeason && (
                <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-2xl p-4 flex items-start gap-3">
                  <span className="text-xl pt-0.5">☀️</span>
                  <div>
                    <p className="text-white text-xs font-bold font-mono uppercase tracking-wide text-[#ef4444]">Reading, PA Heat Advisory</p>
                    <p className="text-[#ccc] text-xs mt-1 leading-relaxed">
                      Huskies overheat quickly. Cap strenuous daytime outdoor tracking workouts. Exercise early or late when pavement surfaces match cool thresholds.
                    </p>
                  </div>
                </div>
              )}

              {/* Husky Developmental Target Blueprint Engine */}
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-2">
                  <p className="text-white text-xs font-bold font-mono uppercase tracking-wider text-[#f0a050]">Development Strategy</p>
                  <span className="text-[10px] font-mono bg-[#1c1c1e] text-[#ccc] px-2 py-0.5 rounded border border-[#2a2a2a]">
                    Phase: {weeks < 24 ? 'Rapid Growth' : weeks < 52 ? 'Consolidation' : 'Adult'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-0.5">
                  <div>
                    <span className="text-[#555] block uppercase font-mono text-[9px] tracking-wider">Exercise Blueprint</span>
                    <p className="text-white text-xs font-semibold mt-0.5">
                      {weeks < 24 ? 'Max 20-25m structured' : weeks < 52 ? 'Max 45-60m structured' : 'Sustained endurance'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#555] block uppercase font-mono text-[9px] tracking-wider">Skeletal Safeguard</span>
                    <p className="text-[#ccc] text-xs mt-0.5">
                      {weeks < 52 ? 'Avoid heavy vertical jumps' : 'Joint plates fully fused'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Telemetry Quick Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-[#555] text-xs mb-1">Current Weight</p>
                  {latestWeight ? (
                    <>
                      <p className="text-white text-2xl font-mono font-bold">
                        {latestWeight.weight_lbs}<span className="text-sm text-[#888] ml-1">lbs</span>
                      </p>
                      <p className="text-[#555] text-xs mt-1 font-mono">{fmtDate(latestWeight.log_date)}</p>
                    </>
                  ) : <p className="text-[#555] text-sm font-mono">No telemetry</p>}
                </div>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-[#555] text-xs mb-1">Next Vet Visit</p>
                  {nextVet?.next_visit_date ? (
                    <>
                      <p className="text-white text-sm font-semibold truncate font-mono">{fmtDate(nextVet.next_visit_date)}</p>
                      {nextVet.next_visit_time && (
                        <p className="text-[#f0a050] text-xs mt-0.5 font-mono">{fmtTime(nextVet.next_visit_time)}</p>
                      )}
                      <p className="text-xs mt-1 font-mono font-bold" style={{ color: dateColor(nextVet.next_visit_date) }}>
                        {(() => {
                          const d = daysUntil(nextVet.next_visit_date);
                          return d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Today' : `${d}d away`;
                        })()}
                      </p>
                    </>
                  ) : <p className="text-[#555] text-sm font-mono">Not scheduled</p>}
                </div>
              </div>

              {/* Upcoming Medications Alert Log */}
              {upcomingMeds.length > 0 && (
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-[#555] text-xs mb-3 font-mono uppercase tracking-wider">Upcoming Prophylaxis</p>
                  <div className="space-y-2.5">
                    {upcomingMeds.slice(0, 3).map(med => {
                      const color = dateColor(med.next_due_date);
                      const days = daysUntil(med.next_due_date);
                      return (
                        <div key={med.id} className="flex items-center justify-between py-0.5 last:border-0">
                          <div>
                            <p className="text-white text-sm font-medium">{med.medication_name}</p>
                            {med.medication_type && <p className="text-[#555] text-xs mt-0.5">{med.medication_type}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-mono font-semibold" style={{ color }}>{fmtDate(med.next_due_date)}</p>
                            <p className="text-[10px] uppercase font-bold font-mono" style={{ color }}>{days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Expandable Weight Log Cards Container */}
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white text-sm font-semibold">Weight Telemetry Ledger</p>
                  <button
                    onClick={() => {
                      setEditWeightEntry(null);
                      setWDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' }));
                      setWLbs('');
                      setWNotes('');
                      setShowAddWeight(true);
                    }}
                    className="text-[#f0a050] text-xs font-semibold px-1.5 py-0.5"
                  >
                    + Log Weight
                  </button>
                </div>
                {weightLoading && weights.length === 0 ? (
                  <p className="text-[#555] text-sm font-mono">Syncing metrics...</p>
                ) : weights.length === 0 ? (
                  <p className="text-[#555] text-sm italic font-sans">No entries recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {weights.map((w, i) => {
                      const expanded = expandedWeight.has(w.id);
                      return (
                        <div key={w.id} className="bg-black/30 border border-[#1a1a1a]/40 rounded-xl overflow-hidden">
                          <div 
                            onClick={() => {
                              const next = new Set(expandedWeight);
                              expanded ? next.delete(w.id) : next.add(w.id);
                              setExpandedWeight(next);
                            }}
                            className="p-3 flex items-center justify-between cursor-pointer active:bg-black/10"
                          >
                            <div>
                              <p className="text-white text-sm font-mono font-semibold">{w.weight_lbs} lbs</p>
                              <p className="text-[#555] text-[11px] mt-0.5 font-mono">{fmtDate(w.log_date)}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-2">
                              {i < weights.length - 1 && (
                                <p className="text-xs font-mono font-bold" style={{ color: w.weight_lbs > weights[i + 1]?.weight_lbs ? '#22c55e' : '#f0a050' }}>
                                  {w.weight_lbs > weights[i + 1]?.weight_lbs ? '+' : ''}{(w.weight_lbs - weights[i + 1]?.weight_lbs).toFixed(1)} lbs
                                </p>
                              )}
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"
                                style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                <path d="M6 9l6 6 6-6" />
                              </svg>
                            </div>
                          </div>
                          {expanded && (
                            <div className="px-3 pb-3 pt-2 border-t border-[#1a1a1a]/60 bg-black/20 space-y-2">
                              {w.notes ? (
                                <p className="text-[#ccc] text-xs bg-black/40 p-2 rounded-lg whitespace-pre-wrap font-sans">{w.notes}</p>
                              ) : (
                                <p className="text-[#444] text-[11px] italic font-sans px-1">No notes logged for this entry.</p>
                              )}
                              <div className="flex items-center gap-4 pt-1">
                                <button
                                  onClick={() => {
                                    setEditWeightEntry(w);
                                    setWDate(w.log_date || '');
                                    setWLbs(String(w.weight_lbs));
                                    setWNotes(w.notes || '');
                                    setShowAddWeight(true);
                                  }}
                                  className="text-[#f0a050] text-xs font-semibold uppercase tracking-wider font-mono"
                                >
                                  Edit Entry
                                </button>
                                <button 
                                  onClick={() => setDeleteWeightId(w.id)}
                                  className="text-[#ef4444] text-xs font-semibold uppercase tracking-wider font-mono"
                                >
                                  Delete Entry
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── VET VISITS TAB ─── */}
          {activeTab === 1 && (
            <div className="px-4 pt-4 space-y-3">
              <div className="flex items-center justify-between pb-1">
                <p className="text-white font-semibold">Clinical Records</p>
                <button
                  onClick={() => {
                    setEditVetEntry(null);
                    setVDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' }));
                    setVType('');
                    setVVet('VCA Sinking Spring');
                    setVCost('');
                    setVNotes('');
                    setVNextDate('');
                    setVNextTime('');
                    setShowAddVet(true);
                  }}
                  className="text-sm font-semibold text-[#f0a050] px-1 py-0.5"
                >
                  + Log Visit
                </button>
              </div>

              {vetLoading && vetVisits.length === 0 ? (
                <p className="text-[#555] text-sm font-mono px-1">Loading clinical files...</p>
              ) : vetVisits.length === 0 ? (
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 text-center">
                  <p className="text-[#555] text-sm">No clinical milestones logged yet.</p>
                </div>
              ) : (
                vetVisits.map(v => {
                  const expanded = expandedVet.has(v.id);
                  return (
                    <div key={v.id} className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
                      <div
                        onClick={() => {
                          const next = new Set(expandedVet);
                          expanded ? next.delete(v.id) : next.add(v.id);
                          setExpandedVet(next);
                        }}
                        className="p-4 flex items-center justify-between cursor-pointer active:bg-[#161616]"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-white text-sm font-semibold truncate">{v.visit_type}</p>
                          <p className="text-[#555] text-xs mt-0.5 font-mono">{fmtDate(v.date)} · {v.vet_name}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          {v.cost != null && (
                            <p className="text-[#f0a050] text-xs font-mono font-semibold">${parseFloat(v.cost).toFixed(2)}</p>
                          )}
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"
                            style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </div>
                      </div>

                      {expanded && (
                        <div className="px-4 pb-4 pt-3 border-t border-[#1a1a1a] bg-black/20 space-y-3">
                          {v.notes && (
                            <div>
                              <span className="text-[#555] block uppercase font-mono text-[9px] tracking-wider mb-0.5">Clinical Annotations</span>
                              <p className="text-[#ccc] text-xs bg-black/40 p-2.5 rounded-xl whitespace-pre-line font-sans leading-relaxed">{v.notes}</p>
                            </div>
                          )}
                          
                          {v.next_visit_date && (
                            <div className="pt-1 font-mono text-xs">
                              <span className="text-[#555] block uppercase text-[9px] tracking-wider mb-0.5">Next Appointment Sequence</span>
                              <p style={{ color: dateColor(v.next_visit_date) }} className="font-bold">
                                {fmtDate(v.next_visit_date)}
                                {v.next_visit_time ? ` at ${fmtTime(v.next_visit_time)}` : ''} · {(() => {
                                  const d = daysUntil(v.next_visit_date);
                                  return d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Today' : `${d}d away`;
                                })()}
                              </p>
                            </div>
                          )}

                          <div className="flex items-center gap-4 pt-1">
                            <button
                              onClick={() => {
                                setEditVetEntry(v);
                                setVDate(v.date || '');
                                setVType(v.visit_type || '');
                                setVVet(v.vet_name || 'VCA Sinking Spring');
                                setVCost(v.cost ? String(v.cost) : '');
                                setVNotes(v.notes || '');
                                setVNextDate(v.next_visit_date || '');
                                setVNextTime(v.next_visit_time || '');
                                setShowAddVet(true);
                              }}
                              className="text-[#f0a050] text-xs font-semibold uppercase tracking-wider font-mono"
                            >
                              Edit Visit
                            </button>
                            <button
                              onClick={() => setDeleteVetId(v.id)}
                              className="text-[#ef4444] text-xs font-semibold uppercase tracking-wider font-mono"
                            >
                              Delete Visit
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ─── MEDICATIONS TAB ─── */}
          {activeTab === 2 && (
            <div className="px-4 pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-white font-semibold">Prophylaxis & Coverages</p>
                <button onClick={openAddMed} className="text-[#f0a050] text-sm font-semibold px-1 py-0.5">+ Add Med</button>
              </div>

              {medsLoading && meds.length === 0 ? (
                <p className="text-[#555] text-sm font-mono px-1">Syncing matrix...</p>
              ) : meds.length === 0 ? (
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 text-center">
                  <p className="text-[#555] text-sm">No medication metrics configured.</p>
                  <p className="text-[#333] text-xs mt-1">Record core heartworm, flea/tick controls, or seasonal supplements.</p>
                </div>
              ) : (
                <>
                  {meds.filter(m => m.is_active).length > 0 && (
                    <div>
                      <p className="text-[#555] text-[10px] font-bold uppercase tracking-wider px-1 mb-2 font-mono">Active Defenses</p>
                      <div className="space-y-2">
                        {meds.filter(m => m.is_active).map(med => {
                          const expanded = expandedMed.has(med.id);
                          const color = med.next_due_date ? dateColor(med.next_due_date) : '#888';
                          const days = med.next_due_date ? daysUntil(med.next_due_date) : null;
                          return (
                            <div key={med.id} className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
                              <div
                                onClick={() => {
                                  const next = new Set(expandedMed);
                                  expanded ? next.delete(med.id) : next.add(med.id);
                                  setExpandedMed(next);
                                }}
                                className="p-4 flex items-center justify-between cursor-pointer active:bg-[#161616]"
                              >
                                <div className="flex-1 min-w-0 pr-2">
                                  <div className="flex items-center gap-2">
                                    <p className="text-white text-sm font-semibold truncate">{med.medication_name}</p>
                                    {med.medication_type && (
                                      <span className="text-[9px] bg-[#1c1c1e] text-[#f0a050] border border-[#1a1a1a]/60 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider shrink-0">
                                        {med.medication_type}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[#555] text-xs mt-1 font-medium truncate">
                                    {med.dosage ? med.dosage : 'No dosage specification'}{med.frequency ? ` · ${med.frequency}` : ''}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 ml-2">
                                  {med.next_due_date && (
                                    <span style={{ color }} className="text-xs font-mono font-bold">
                                      {days !== null && (days < 0 ? 'Overdue' : days === 0 ? 'Today' : `${days}d`)}
                                    </span>
                                  )}
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"
                                    style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                    <path d="M6 9l6 6 6-6" />
                                  </svg>
                                </div>
                              </div>

                              {expanded && (
                                <div className="px-4 pb-4 pt-3 border-t border-[#1a1a1a] bg-black/20 space-y-3">
                                  <div className="grid grid-cols-2 gap-2 text-xs font-mono text-[#555]">
                                    {med.last_given_date && (
                                      <div>
                                        <span className="text-[9px] tracking-wider uppercase block text-[#444]">Administered Date</span>
                                        <span className="text-[#ccc] font-bold">{fmtDate(med.last_given_date)}</span>
                                      </div>
                                    )}
                                    {med.next_due_date && (
                                      <div>
                                        <span className="text-[9px] tracking-wider uppercase block text-[#444]">Target Expiry Due</span>
                                        <span style={{ color }} className="font-bold">{fmtDate(med.next_due_date)}</span>
                                      </div>
                                    )}
                                    {med.cost_per_dose != null && (
                                      <div className="col-span-2 pt-1 border-t border-[#1a1a1a]/30 mt-1">
                                        <span className="text-[9px] tracking-wider uppercase block text-[#444]">Amortized Unit Cost</span>
                                        <span className="text-white font-bold">${parseFloat(med.cost_per_dose).toFixed(2)} / dose</span>
                                      </div>
                                    )}
                                  </div>

                                  {med.notes && (
                                    <div>
                                      <span className="text-[#444] block uppercase font-mono text-[9px] tracking-wider mb-0.5">Administration Directives</span>
                                      <p className="text-[#ccc] text-xs bg-black/40 p-2.5 rounded-xl font-sans leading-relaxed">{med.notes}</p>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-4 pt-1">
                                    <button
                                      onClick={() => openEditMed(med)}
                                      className="text-[#f0a050] text-xs font-semibold uppercase tracking-wider font-mono"
                                    >
                                      Edit Strategy
                                    </button>
                                    <button
                                      onClick={() => setDeleteMedId(med.id)}
                                      className="text-[#ef4444] text-xs font-semibold uppercase tracking-wider font-mono"
                                    >
                                      Delete Record
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {meds.filter(m => !m.is_active).length > 0 && (
                    <div>
                      <p className="text-[#555] text-[10px] font-bold uppercase tracking-wider px-1 mb-2 font-mono mt-2">Historical Sequences</p>
                      <div className="space-y-2 opacity-40">
                        {meds.filter(m => !m.is_active).map(med => {
                          const expanded = expandedMed.has(med.id);
                          return (
                            <div key={med.id} className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
                              <div
                                onClick={() => {
                                  const next = new Set(expandedMed);
                                  expanded ? next.delete(med.id) : next.add(med.id);
                                  setExpandedMed(next);
                                }}
                                className="p-4 flex items-center justify-between cursor-pointer active:bg-[#161616]"
                              >
                                <div className="flex-1 min-w-0 pr-2">
                                  <p className="text-white text-sm font-semibold truncate">{med.medication_name}</p>
                                  {med.medication_type && <p className="text-[#555] text-xs font-mono mt-0.5">{med.medication_type}</p>}
                                </div>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"
                                  style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                  <path d="M6 9l6 6 6-6" />
                                </svg>
                              </div>

                              {expanded && (
                                <div className="px-4 pb-4 pt-3 border-t border-[#1a1a1a] bg-black/20 space-y-3">
                                  <p className="text-[#888] text-xs italic font-sans px-0.5">Treatment parameter marked dormant or completed.</p>
                                  <div className="flex items-center gap-4 pt-1">
                                    <button
                                      onClick={() => openEditMed(med)}
                                      className="text-[#f0a050] text-xs font-semibold uppercase tracking-wider font-mono"
                                    >
                                      Edit Med
                                    </button>
                                    <button
                                      onClick={() => setDeleteMedId(med.id)}
                                      className="text-[#ef4444] text-xs font-semibold uppercase tracking-wider font-mono"
                                    >
                                      Delete Med
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </div>
      </PullToRefresh>

      {/* ═══════════════════════════════════════
          MODALS & VIEWPORT OVERLAYS SIBLINGS
      ═══════════════════════════════════════ */}

      {/* Weight Overlay Modal */}
      {showAddWeight && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto pb-6 border border-[#1a1a1a]">
            <div className="p-5 border-b border-[#1a1a1a] sticky top-0 bg-[#1c1c1e] z-10">
              <h2 className="text-white text-lg font-bold font-mono uppercase tracking-wide">
                {editWeightEntry ? 'Modify Weight Log' : 'Log Weight Parameter'}
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[#555] text-xs block mb-1 font-mono uppercase tracking-wide">Date Entry *</label>
                <input type="date" value={wDate} onChange={e => setWDate(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-white text-sm font-mono focus:border-[#f0a050] outline-none" />
              </div>
              <div>
                <label className="text-[#555] text-xs block mb-1 font-mono uppercase tracking-wide">Weight Metric (lbs) *</label>
                <input type="number" step="0.1" value={wLbs} onChange={e => setWLbs(e.target.value)}
                  placeholder="e.g. 45.2" className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-white text-sm font-mono focus:border-[#f0a050] outline-none" />
              </div>
              <div>
                <label className="text-[#555] text-xs block mb-1 font-mono uppercase tracking-wide">Log Annotations</label>
                <input type="text" value={wNotes} onChange={e => setWNotes(e.target.value)}
                  placeholder="Measured at morning clinic check" className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-white text-sm focus:border-[#f0a050] outline-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowAddWeight(false); setEditWeightEntry(null); }}
                  className="flex-1 py-3 rounded-xl bg-black border border-[#1a1a1a] text-[#555] text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={saveWeight}
                  disabled={weightSaving || !wDate || !wLbs}
                  className="flex-1 py-3 rounded-xl bg-[#f0a050] text-black text-sm font-semibold disabled:opacity-40"
                >
                  {weightSaving ? 'Saving...' : 'Save Log'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vet Overlay Modal */}
      {showAddVet && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto pb-6 border border-[#1a1a1a]">
            <div className="p-5 border-b border-[#1a1a1a] sticky top-0 bg-[#1c1c1e] z-10">
              <h2 className="text-white text-lg font-bold font-mono uppercase tracking-wide">
                {editVetEntry ? 'Modify Vet Session' : 'Log Vet Appointment'}
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[#555] text-xs block mb-1 font-mono uppercase tracking-wide">Visit Date *</label>
                <input type="date" value={vDate} onChange={e => setVDate(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-white text-sm font-mono focus:border-[#f0a050] outline-none" />
              </div>
              <div>
                <label className="text-[#555] text-xs block mb-1 font-mono uppercase tracking-wide">Visit Reason / Classification *</label>
                <input type="text" value={vType} onChange={e => setVType(e.target.value)}
                  placeholder="e.g. Rabies Vaccine Booster"
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-white text-sm focus:border-[#f0a050] outline-none" />
              </div>
              <div>
                <label className="text-[#555] text-xs block mb-1 font-mono uppercase tracking-wide">Vet Clinic Location</label>
                <input type="text" value={vVet} onChange={e => setVVet(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-white text-sm focus:border-[#f0a050] outline-none" />
              </div>
              <div>
                <label className="text-[#555] text-xs block mb-1 font-mono uppercase tracking-wide">Invoice Cost ($)</label>
                <input type="number" step="0.01" value={vCost} onChange={e => setVCost(e.target.value)}
                  placeholder="0.00" className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-white text-sm font-mono focus:border-[#f0a050] outline-none" />
              </div>
              <div>
                <label className="text-[#555] text-xs block mb-1 font-mono uppercase tracking-wide">Clinical Observations</label>
                <textarea value={vNotes} onChange={e => setVNotes(e.target.value)} rows={3}
                  placeholder="Notes, recommendations, or timeline updates..."
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-white text-sm resize-none focus:border-[#f0a050] outline-none" />
              </div>
              <div className="border-t border-[#1a1a1a] pt-3">
                <p className="text-[#f0a050] text-xs font-semibold mb-3 uppercase font-mono tracking-wider">Next Target Recall</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-[#555] text-xs block mb-1 font-mono uppercase tracking-wide">Date</label>
                    <input type="date" value={vNextDate} onChange={e => setVNextDate(e.target.value)}
                      className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-white text-sm font-mono focus:border-[#f0a050] outline-none" />
                  </div>
                  <div>
                    <label className="text-[#555] text-xs block mb-1 font-mono uppercase tracking-wide">Time Allocation</label>
                    <input type="time" value={vNextTime} onChange={e => setVNextTime(e.target.value)}
                      className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-white text-sm font-mono focus:border-[#f0a050] outline-none" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowAddVet(false); setEditVetEntry(null); }}
                  className="flex-1 py-3 rounded-xl bg-black border border-[#1a1a1a] text-[#555] text-sm font-semibold"
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

      {/* Medication Overlay Modal */}
      {showAddMed && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto pb-6 border border-[#1a1a1a]">
            <div className="p-5 border-b border-[#1a1a1a] sticky top-0 bg-[#1c1c1e] z-10">
              <h2 className="text-white text-lg font-bold font-mono uppercase tracking-wide">
                {editMed ? 'Modify Treatment' : 'Add Medication Profile'}
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[#555] text-xs block mb-1 font-mono uppercase tracking-wide">Medication Name *</label>
                <input type="text" value={mName} onChange={e => setMName(e.target.value)}
                  placeholder="e.g. Heartgard, NexGard"
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-white text-sm focus:border-[#f0a050] outline-none" />
              </div>
              <div>
                <label className="text-[#555] text-xs block mb-1 font-mono uppercase tracking-wide">Classification Type</label>
                <select value={mType} onChange={e => setMType(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-white text-sm focus:border-[#f0a050] outline-none text-left bg-no-repeat">
                  <option value="">Select type options...</option>
                  {MED_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[#555] text-xs block mb-1 font-mono uppercase tracking-wide">Dosage Parameter</label>
                <input type="text" value={mDosage} onChange={e => setMDosage(e.target.value)}
                  placeholder="e.g. 1 chewable tablet"
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-white text-sm focus:border-[#f0a050] outline-none" />
              </div>
              <div>
                <label className="text-[#555] text-xs block mb-1 font-mono uppercase tracking-wide">Frequency Cadence</label>
                <select value={mFreq} onChange={e => setMFreq(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-white text-sm focus:border-[#f0a050] outline-none text-left bg-no-repeat">
                  <option value="">Select frequency...</option>
                  {MED_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[#555] text-xs block mb-1 font-mono uppercase tracking-wide">Cost Per Dose ($)</label>
                <input type="number" step="0.01" value={mCost} onChange={e => setMCost(e.target.value)}
                  placeholder="0.00" className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-white text-sm font-mono focus:border-[#f0a050] outline-none" />
              </div>
              <div>
                <label className="text-[#555] text-xs block mb-1 font-mono uppercase tracking-wide">Next Target Due Date</label>
                <input type="date" value={mNextDue} onChange={e => setMNextDue(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-white text-sm font-mono focus:border-[#f0a050] outline-none" />
              </div>
              <div>
                <label className="text-[#555] text-xs block mb-1 font-mono uppercase tracking-wide">Last Given Date</label>
                <input type="date" value={mLastGiven} onChange={e => setMLastGiven(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-white text-sm font-mono focus:border-[#f0a050] outline-none" />
              </div>
              <div>
                <label className="text-[#555] text-xs block mb-1 font-mono uppercase tracking-wide">Administration Notes</label>
                <input type="text" value={mNotes} onChange={e => setMNotes(e.target.value)}
                  placeholder="Administer with standard morning meal"
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-white text-sm focus:border-[#f0a050] outline-none" />
              </div>
              <div className="flex items-center justify-between pt-1">
                <label className="text-[#555] text-xs font-mono uppercase tracking-wide">Operational State</label>
                <button
                  onClick={() => setMActive(!mActive)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${mActive ? 'bg-[#f0a050]' : 'bg-[#222] border border-[#333]'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${mActive ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="flex gap-3 pt-3">
                <button
                  onClick={() => { setShowAddMed(false); setEditMed(null); }}
                  className="flex-1 py-3 rounded-xl bg-black border border-[#1a1a1a] text-[#555] text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={saveMed}
                  disabled={medSaving || !mName}
                  className="flex-1 py-3 rounded-xl bg-[#f0a050] text-black text-sm font-semibold disabled:opacity-40"
                >
                  {medSaving ? 'Saving...' : editMed ? 'Save Changes' : 'Add Medication'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Weight Confirmation Sheet */}
      {deleteWeightId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm p-5 border border-[#1a1a1a] space-y-4">
            <div className="text-center space-y-1">
              <p className="text-white font-semibold">Permanently drop weight snapshot?</p>
              <p className="text-xs text-[#555]">This action updates immediate metric tracking histories.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteWeightId(null)} className="flex-1 py-3 rounded-xl bg-black border border-[#1a1a1a] text-white text-sm font-medium">Keep</button>
              <button onClick={() => deleteWeight(deleteWeightId)} className="flex-1 bg-[#ef4444] text-white rounded-xl py-3 text-sm font-bold font-mono">Delete Log</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Vet Confirmation Sheet */}
      {deleteVetId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm p-5 border border-[#1a1a1a] space-y-4">
            <div className="text-center space-y-1">
              <p className="text-white font-semibold">Purge selected clinical entry?</p>
              <p className="text-xs text-[#555]">This action permanently clears the structural cost ledger record.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteVetId(null)} className="flex-1 py-3 rounded-xl bg-black border border-[#1a1a1a] text-white text-sm font-medium">Keep</button>
              <button onClick={() => deleteVet(deleteVetId)} className="flex-1 bg-[#ef4444] text-white rounded-xl py-3 text-sm font-bold font-mono">Delete Visit</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Medication Confirmation Sheet */}
      {deleteMedId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm p-5 border border-[#1a1a1a] space-y-4">
            <div className="text-center space-y-1">
              <p className="text-white font-semibold">Remove treatment checklist item?</p>
              <p className="text-xs text-[#555]">Schedule metrics associated with this compliance tracker will be dropped.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteMedId(null)} className="flex-1 py-3 rounded-xl bg-black border border-[#1a1a1a] text-white text-sm font-medium">Keep</button>
              <button onClick={() => deleteMed(deleteMedId)} className="flex-1 bg-[#ef4444] text-white rounded-xl py-3 text-sm font-bold font-mono">Delete Med</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}