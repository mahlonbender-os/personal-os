'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PullToRefresh from '@/components/PullToRefresh';

const TABS = ['Overview', 'Vet Visits', 'Medications'];

const WEIGHT_CACHE = 'knox-weight';
const VET_CACHE = 'knox-vet';
const MEDS_CACHE = 'knox-meds';

const MED_TYPES = ['Flea & Tick', 'Heartworm', 'Dewormer', 'Antibiotic', 'Supplement', 'Vaccine', 'Other'];
const FREQ_OPTIONS = ['Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Every 3 months', 'Every 6 months', 'Yearly', 'As needed'];

function formatDate(d: string) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
}

function formatTime(t: string) {
  if (!t) return '';
  const [h, min] = t.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${min} ${ampm}`;
}

function daysUntil(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function dueDateColor(dateStr: string) {
  if (!dateStr) return '#888';
  const days = daysUntil(dateStr);
  if (days < 0) return '#ef4444';
  if (days <= 7) return '#f0a050';
  return '#22c55e';
}

export default function KnoxPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);

  // Weight
  const [weights, setWeights] = useState<any[]>([]);
  const [loadingWeights, setLoadingWeights] = useState(true);
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [weightDate, setWeightDate] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [weightNotes, setWeightNotes] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [deleteWeightId, setDeleteWeightId] = useState<string | null>(null);

  // Vet Visits
  const [vets, setVets] = useState<any[]>([]);
  const [loadingVets, setLoadingVets] = useState(true);
  const [showAddVet, setShowAddVet] = useState(false);
  const [vetDate, setVetDate] = useState('');
  const [vetType, setVetType] = useState('');
  const [vetName, setVetName] = useState('VCA Sinking Spring');
  const [vetCost, setVetCost] = useState('');
  const [vetNotes, setVetNotes] = useState('');
  const [nextVetDate, setNextVetDate] = useState('');
  const [nextVetTime, setNextVetTime] = useState('');
  const [savingVet, setSavingVet] = useState(false);
  const [deleteVetId, setDeleteVetId] = useState<string | null>(null);

  // Medications
  const [meds, setMeds] = useState<any[]>([]);
  const [loadingMeds, setLoadingMeds] = useState(true);
  const [showAddMed, setShowAddMed] = useState(false);
  const [editMed, setEditMed] = useState<any>(null);
  const [deleteMedId, setDeleteMedId] = useState<string | null>(null);
  const [medName, setMedName] = useState('');
  const [medType, setMedType] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFreq, setMedFreq] = useState('');
  const [medCost, setMedCost] = useState('');
  const [medNextDue, setMedNextDue] = useState('');
  const [medLastGiven, setMedLastGiven] = useState('');
  const [medNotes, setMedNotes] = useState('');
  const [savingMed, setSavingMed] = useState(false);
  const [medIsActive, setMedIsActive] = useState(true);

  useEffect(() => {
    try {
      const cw = localStorage.getItem(WEIGHT_CACHE);
      if (cw) setWeights(JSON.parse(cw));
      const cv = localStorage.getItem(VET_CACHE);
      if (cv) setVets(JSON.parse(cv));
      const cm = localStorage.getItem(MEDS_CACHE);
      if (cm) setMeds(JSON.parse(cm));
    } catch {}
    fetchWeights();
    fetchVets();
    fetchMeds();
  }, []);

  async function fetchWeights() {
    setLoadingWeights(true);
    try {
      const res = await fetch('/api/knox/weight');
      if (res.ok) {
        const d = await res.json();
        setWeights(d);
        localStorage.setItem(WEIGHT_CACHE, JSON.stringify(d));
      }
    } finally {
      setLoadingWeights(false);
    }
  }

  async function fetchVets() {
    setLoadingVets(true);
    try {
      const res = await fetch('/api/knox/vet-visits');
      if (res.ok) {
        const d = await res.json();
        setVets(d);
        localStorage.setItem(VET_CACHE, JSON.stringify(d));
      }
    } finally {
      setLoadingVets(false);
    }
  }

  async function fetchMeds() {
    setLoadingMeds(true);
    try {
      const res = await fetch('/api/knox/medications');
      if (res.ok) {
        const d = await res.json();
        setMeds(d);
        localStorage.setItem(MEDS_CACHE, JSON.stringify(d));
      }
    } finally {
      setLoadingMeds(false);
    }
  }

  async function handleRefresh() {
    await Promise.all([fetchWeights(), fetchVets(), fetchMeds()]);
  }

  async function saveWeight() {
    if (!weightDate || !weightLbs) return;
    setSavingWeight(true);
    try {
      const res = await fetch('/api/knox/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_date: weightDate, weight_lbs: parseFloat(weightLbs), notes: weightNotes }),
      });
      if (res.ok) {
        setShowAddWeight(false);
        setWeightDate(''); setWeightLbs(''); setWeightNotes('');
        fetchWeights();
      }
    } finally {
      setSavingWeight(false);
    }
  }

  async function deleteWeight(id: string) {
    await fetch(`/api/knox/weight/${id}`, { method: 'DELETE' });
    setDeleteWeightId(null);
    fetchWeights();
  }

  async function saveVet() {
    if (!vetDate || !vetType) return;
    setSavingVet(true);
    try {
      const res = await fetch('/api/knox/vet-visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: vetDate,
          visit_type: vetType,
          vet_name: vetName,
          cost: vetCost ? parseFloat(vetCost) : null,
          notes: vetNotes,
          next_visit_date: nextVetDate || null,
          next_visit_time: nextVetTime || null,
        }),
      });
      if (res.ok) {
        setShowAddVet(false);
        setVetDate(''); setVetType(''); setVetName('VCA Sinking Spring');
        setVetCost(''); setVetNotes(''); setNextVetDate(''); setNextVetTime('');
        fetchVets();
      }
    } finally {
      setSavingVet(false);
    }
  }

  async function deleteVet(id: string) {
    await fetch(`/api/knox/vet-visits/${id}`, { method: 'DELETE' });
    setDeleteVetId(null);
    fetchVets();
  }

  function openAddMed() {
    setEditMed(null);
    setMedName(''); setMedType(''); setMedDosage(''); setMedFreq('');
    setMedCost(''); setMedNextDue(''); setMedLastGiven(''); setMedNotes('');
    setMedIsActive(true);
    setShowAddMed(true);
  }

  function openEditMed(med: any) {
    setEditMed(med);
    setMedName(med.medication_name || '');
    setMedType(med.medication_type || '');
    setMedDosage(med.dosage || '');
    setMedFreq(med.frequency || '');
    setMedCost(med.cost_per_dose ? String(med.cost_per_dose) : '');
    setMedNextDue(med.next_due_date || '');
    setMedLastGiven(med.last_given_date || '');
    setMedNotes(med.notes || '');
    setMedIsActive(med.is_active !== false);
    setShowAddMed(true);
  }

  async function saveMed() {
    if (!medName) return;
    setSavingMed(true);
    try {
      const payload = {
        medication_name: medName,
        medication_type: medType || null,
        dosage: medDosage || null,
        frequency: medFreq || null,
        cost_per_dose: medCost ? parseFloat(medCost) : null,
        next_due_date: medNextDue || null,
        last_given_date: medLastGiven || null,
        is_active: medIsActive,
        notes: medNotes || null,
      };
      const url = editMed ? `/api/knox/medications/${editMed.id}` : '/api/knox/medications';
      const method = editMed ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowAddMed(false);
        setEditMed(null);
        fetchMeds();
      }
    } finally {
      setSavingMed(false);
    }
  }

  async function deleteMed(id: string) {
    await fetch(`/api/knox/medications/${id}`, { method: 'DELETE' });
    setDeleteMedId(null);
    fetchMeds();
  }

  const birthDate = new Date('2026-01-14');
  const now = new Date();
  const ageMonths = Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  const ageWeeks = Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 7));

  const latestWeight = weights[0];
  const nextVetFromDB = [...vets]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .find(v => v.next_visit_date);
  const upcomingMeds = meds.filter(m => m.is_active && m.next_due_date);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="pb-24 bg-black min-h-screen">

        <div className="px-4 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center text-2xl">🐺</div>
            <div>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Knox</h1>
              <p className="text-[#888] text-xs">Siberian Husky · {ageMonths}mo ({ageWeeks}wk) · Jan 14, 2026</p>
            </div>
          </div>
        </div>

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

        {/* OVERVIEW */}
        {activeTab === 0 && (
          <div className="px-4 pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                <p className="text-[#555] text-xs mb-1">Current Weight</p>
                {latestWeight ? (
                  <>
                    <p className="text-white text-2xl font-mono font-bold">{latestWeight.weight_lbs}<span className="text-sm text-[#888] ml-1">lbs</span></p>
                    <p className="text-[#555] text-xs mt-1">{formatDate(latestWeight.log_date)}</p>
                  </>
                ) : (
                  <p className="text-[#555] text-sm">No data</p>
                )}
              </div>
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                <p className="text-[#555] text-xs mb-1">Next Vet</p>
                {nextVetFromDB?.next_visit_date ? (
                  <>
                    <p className="text-white text-sm font-semibold">{formatDate(nextVetFromDB.next_visit_date)}</p>
                    {nextVetFromDB.next_visit_time && (
                      <p className="text-[#f0a050] text-xs mt-0.5">{formatTime(nextVetFromDB.next_visit_time)}</p>
                    )}
                    <p className="text-xs mt-1" style={{ color: dueDateColor(nextVetFromDB.next_visit_date) }}>
                      {(() => { const d = daysUntil(nextVetFromDB.next_visit_date); return d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Today' : `${d}d away`; })()}
                    </p>
                  </>
                ) : (
                  <p className="text-[#555] text-sm">Not scheduled</p>
                )}
              </div>
            </div>

            {upcomingMeds.length > 0 && (
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                <p className="text-[#555] text-xs mb-3">Upcoming Medications</p>
                <div className="space-y-2">
                  {upcomingMeds.slice(0, 3).map(med => {
                    const days = daysUntil(med.next_due_date);
                    const color = dueDateColor(med.next_due_date);
                    return (
                      <div key={med.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-white text-sm font-medium">{med.medication_name}</p>
                          {med.medication_type && <p className="text-[#555] text-xs">{med.medication_type}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-mono" style={{ color }}>{formatDate(med.next_due_date)}</p>
                          <p className="text-xs" style={{ color }}>{days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white text-sm font-semibold">Weight Log</p>
                <button
                  onClick={() => { setShowAddWeight(true); setWeightDate(new Date().toISOString().split('T')[0]); }}
                  className="text-[#f0a050] text-xs font-semibold"
                >+ Log</button>
              </div>
              {loadingWeights && weights.length === 0 ? (
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
                        <p className="text-[#888] text-xs">{formatDate(w.log_date)}</p>
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

        {/* VET VISITS */}
        {activeTab === 1 && (
          <div className="px-4 pt-4 space-y-3">
            {loadingVets && vets.length === 0 ? (
              <p className="text-[#555] text-sm px-1">Loading...</p>
            ) : vets.length === 0 ? (
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 text-center">
                <p className="text-[#555] text-sm">No vet visits yet</p>
              </div>
            ) : (
              vets.map(v => (
                <div key={v.id} className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold">{v.visit_type}</p>
                      <p className="text-[#888] text-xs">{v.vet_name} · {formatDate(v.date)}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      {v.cost != null && <p className="text-[#f0a050] text-xs font-mono">${parseFloat(v.cost).toFixed(2)}</p>}
                      <button onClick={() => setDeleteVetId(v.id)} className="text-[#333] text-xs p-1">✕</button>
                    </div>
                  </div>
                  {v.notes && <p className="text-[#555] text-xs mt-2 whitespace-pre-line">{v.notes}</p>}
                  {v.next_visit_date && (
                    <div className="mt-2 pt-2 border-t border-[#1a1a1a]">
                      <p className="text-xs" style={{ color: dueDateColor(v.next_visit_date) }}>
                        Next: {formatDate(v.next_visit_date)}{v.next_visit_time ? ` at ${formatTime(v.next_visit_time)}` : ''}
                        {' · '}{(() => { const d = daysUntil(v.next_visit_date); return d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Today' : `${d}d away`; })()}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* MEDICATIONS */}
        {activeTab === 2 && (
          <div className="px-4 pt-4 space-y-3">
            {loadingMeds && meds.length === 0 ? (
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
                        const color = med.next_due_date ? dueDateColor(med.next_due_date) : '#888';
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
                                    Next due: {formatDate(med.next_due_date)}
                                    {days !== null && ` · ${days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}`}
                                  </p>
                                )}
                                {med.last_given_date && (
                                  <p className="text-[#555] text-xs mt-0.5">Last given: {formatDate(med.last_given_date)}</p>
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

        {/* FABs */}
        {activeTab === 0 && (
          <button onClick={() => { setShowAddWeight(true); setWeightDate(new Date().toISOString().split('T')[0]); }}
            className="fixed bottom-24 right-5 w-14 h-14 bg-[#f0a050] rounded-full flex items-center justify-center z-40 shadow-lg text-black text-2xl font-bold">+</button>
        )}
        {activeTab === 1 && (
          <button onClick={() => { setShowAddVet(true); setVetDate(new Date().toISOString().split('T')[0]); }}
            className="fixed bottom-24 right-5 w-14 h-14 bg-[#f0a050] rounded-full flex items-center justify-center z-40 shadow-lg text-black text-2xl font-bold">+</button>
        )}
        {activeTab === 2 && (
          <button onClick={openAddMed}
            className="fixed bottom-24 right-5 w-14 h-14 bg-[#f0a050] rounded-full flex items-center justify-center z-40 shadow-lg text-black text-2xl font-bold">+</button>
        )}

        {/* ADD WEIGHT MODAL */}
        {showAddWeight && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={() => setShowAddWeight(false)}>
            <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto pb-6" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-[#2a2a2a]">
                <h2 className="text-white text-lg font-bold">Log Weight</h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-[#888] text-xs block mb-1">Date</label>
                  <input type="date" value={weightDate} onChange={e => setWeightDate(e.target.value)}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Weight (lbs)</label>
                  <input type="number" step="0.1" value={weightLbs} onChange={e => setWeightLbs(e.target.value)}
                    placeholder="33.4"
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Notes (optional)</label>
                  <input type="text" value={weightNotes} onChange={e => setWeightNotes(e.target.value)}
                    placeholder="e.g. 20 weeks"
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <button onClick={saveWeight} disabled={savingWeight || !weightDate || !weightLbs}
                  className="w-full bg-[#f0a050] text-black rounded-xl p-3 font-semibold disabled:opacity-40">
                  {savingWeight ? 'Saving...' : 'Save Weight'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADD VET MODAL */}
        {showAddVet && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={() => setShowAddVet(false)}>
            <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto pb-6" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-[#2a2a2a]">
                <h2 className="text-white text-lg font-bold">Log Vet Visit</h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-[#888] text-xs block mb-1">Visit Date</label>
                  <input type="date" value={vetDate} onChange={e => setVetDate(e.target.value)}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Visit Type</label>
                  <input type="text" value={vetType} onChange={e => setVetType(e.target.value)}
                    placeholder="e.g. Wellness Exam, Vaccines"
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Vet / Clinic</label>
                  <input type="text" value={vetName} onChange={e => setVetName(e.target.value)}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Cost</label>
                  <input type="number" step="0.01" value={vetCost} onChange={e => setVetCost(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Notes</label>
                  <textarea value={vetNotes} onChange={e => setVetNotes(e.target.value)}
                    rows={3} placeholder="Vaccines given, observations..."
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm resize-none" />
                </div>
                <div className="border-t border-[#2a2a2a] pt-3">
                  <p className="text-[#f0a050] text-xs font-semibold mb-3">Next Appointment</p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[#888] text-xs block mb-1">Date</label>
                      <input type="date" value={nextVetDate} onChange={e => setNextVetDate(e.target.value)}
                        className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                    </div>
                    <div>
                      <label className="text-[#888] text-xs block mb-1">Time (optional)</label>
                      <input type="time" value={nextVetTime} onChange={e => setNextVetTime(e.target.value)}
                        className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                    </div>
                  </div>
                </div>
                <button onClick={saveVet} disabled={savingVet || !vetDate || !vetType}
                  className="w-full bg-[#f0a050] text-black rounded-xl p-3 font-semibold disabled:opacity-40">
                  {savingVet ? 'Saving...' : 'Save Visit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADD/EDIT MED MODAL */}
        {showAddMed && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={() => setShowAddMed(false)}>
            <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto pb-6" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-[#2a2a2a]">
                <h2 className="text-white text-lg font-bold">{editMed ? 'Edit Medication' : 'Add Medication'}</h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-[#888] text-xs block mb-1">Medication Name</label>
                  <input type="text" value={medName} onChange={e => setMedName(e.target.value)}
                    placeholder="e.g. Heartgard, NexGard"
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Type</label>
                  <select value={medType} onChange={e => setMedType(e.target.value)}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm">
                    <option value="">Select type...</option>
                    {MED_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Dosage</label>
                  <input type="text" value={medDosage} onChange={e => setMedDosage(e.target.value)}
                    placeholder="e.g. 25-50kg, 1 chew"
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Frequency</label>
                  <select value={medFreq} onChange={e => setMedFreq(e.target.value)}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm">
                    <option value="">Select frequency...</option>
                    {FREQ_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Cost per dose</label>
                  <input type="number" step="0.01" value={medCost} onChange={e => setMedCost(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Next Due Date</label>
                  <input type="date" value={medNextDue} onChange={e => setMedNextDue(e.target.value)}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Last Given Date</label>
                  <input type="date" value={medLastGiven} onChange={e => setMedLastGiven(e.target.value)}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[#888] text-xs block mb-1">Notes</label>
                  <input type="text" value={medNotes} onChange={e => setMedNotes(e.target.value)}
                    placeholder="Any notes..."
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-white text-sm" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-[#888] text-xs">Active</label>
                  <button
                    onClick={() => setMedIsActive(!medIsActive)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${medIsActive ? 'bg-[#f0a050]' : 'bg-[#333]'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${medIsActive ? 'left-6' : 'left-0.5'}`} />
                  </button>
                </div>
                <button onClick={saveMed} disabled={savingMed || !medName}
                  className="w-full bg-[#f0a050] text-black rounded-xl p-3 font-semibold disabled:opacity-40">
                  {savingMed ? 'Saving...' : editMed ? 'Update Medication' : 'Add Medication'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DELETE CONFIRMS */}
        {deleteWeightId && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
            <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm p-5 space-y-3">
              <p className="text-white text-center font-semibold">Delete this weight entry?</p>
              <button onClick={() => deleteWeight(deleteWeightId)} className="w-full bg-[#ef4444] text-white rounded-xl p-3 font-semibold">Delete</button>
              <button onClick={() => setDeleteWeightId(null)} className="w-full bg-[#1a1a1a] text-[#888] rounded-xl p-3">Cancel</button>
            </div>
          </div>
        )}
        {deleteVetId && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
            <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm p-5 space-y-3">
              <p className="text-white text-center font-semibold">Delete this vet visit?</p>
              <button onClick={() => deleteVet(deleteVetId)} className="w-full bg-[#ef4444] text-white rounded-xl p-3 font-semibold">Delete</button>
              <button onClick={() => setDeleteVetId(null)} className="w-full bg-[#1a1a1a] text-[#888] rounded-xl p-3">Cancel</button>
            </div>
          </div>
        )}
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