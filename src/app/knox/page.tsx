'use client';

import { useState, useEffect } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import SwipeTabs from '@/components/SwipeTabs';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeightEntry {
  id: string;
  date: string;
  weight_lbs: number;
  notes: string | null;
}

interface VetVisit {
  id: string;
  date: string;
  visit_type: string;
  vet_name: string | null;
  notes: string | null;
  cost: number | null;
  next_visit_date: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ['Profile', 'Weight', 'Vet'];
const KNOX_BIRTHDAY = new Date('2026-01-14');

const VISIT_TYPES = [
  'Wellness Exam',
  'Vaccination',
  'Sick Visit',
  'Grooming',
  'Dental',
  'Emergency',
  'Other',
];

const VISIT_TYPE_COLORS: Record<string, string> = {
  'Wellness Exam': 'bg-green-500/20 text-green-400',
  'Vaccination':   'bg-blue-500/20 text-blue-400',
  'Sick Visit':    'bg-red-500/20 text-red-400',
  'Grooming':      'bg-purple-500/20 text-purple-400',
  'Dental':        'bg-yellow-500/20 text-yellow-400',
  'Emergency':     'bg-red-600/30 text-red-300',
  'Other':         'bg-[#333] text-[#ccc]',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAge(birthday: Date): string {
  const now = new Date();
  const totalDays = Math.floor((now.getTime() - birthday.getTime()) / 86400000);
  const months = Math.floor(totalDays / 30.44);
  const days = Math.floor(totalDays % 30.44);
  if (months === 0) return `${totalDays} days old`;
  if (months < 12) return `${months}mo ${days}d old`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return `${years}yr ${remMonths}mo old`;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtCurrency(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── VetCard (outside parent to preserve its own useState) ───────────────────

function VetCard({
  visit,
  onDelete,
}: {
  visit: VetVisit;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const badgeClass = VISIT_TYPE_COLORS[visit.visit_type] || 'bg-[#333] text-[#ccc]';

  return (
    <div
      className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 cursor-pointer active:opacity-80"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
            {visit.visit_type}
          </span>
          <p className="text-white font-medium mt-1">{formatDate(visit.date)}</p>
          {visit.vet_name && (
            <p className="text-[#888] text-xs mt-0.5 truncate">{visit.vet_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {visit.cost !== null && (
            <p className="text-[#888] text-sm font-mono">{fmtCurrency(visit.cost)}</p>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this vet visit?')) onDelete(visit.id);
            }}
            className="text-[#444] hover:text-red-400 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>
      </div>

      {expanded && (visit.notes || visit.next_visit_date) && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a] space-y-1.5">
          {visit.notes && (
            <p className="text-[#888] text-sm leading-relaxed">{visit.notes}</p>
          )}
          {visit.next_visit_date && (
            <p className="text-[#f0a050] text-xs">
              Next visit: {formatDate(visit.next_visit_date)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KnoxPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [vetVisits, setVetVisits] = useState<VetVisit[]>([]);
  const [age, setAge] = useState('');

  // Weight modal
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [wDate, setWDate] = useState('');
  const [wLbs, setWLbs] = useState('');
  const [wNotes, setWNotes] = useState('');
  const [savingW, setSavingW] = useState(false);

  // Vet modal
  const [showVetModal, setShowVetModal] = useState(false);
  const [vDate, setVDate] = useState('');
  const [vType, setVType] = useState('Wellness Exam');
  const [vVet, setVVet] = useState('');
  const [vNotes, setVNotes] = useState('');
  const [vCost, setVCost] = useState('');
  const [vNext, setVNext] = useState('');
  const [savingV, setSavingV] = useState(false);

  useEffect(() => {
    // Age updates client-side only (avoids UTC mismatch)
    setAge(getAge(KNOX_BIRTHDAY));

    const today = new Date().toISOString().split('T')[0];
    setWDate(today);
    setVDate(today);

    // Load from cache immediately
    try {
      const cw = localStorage.getItem('knox_weights_v1');
      const cv = localStorage.getItem('knox_vets_v1');
      if (cw) setWeights(JSON.parse(cw));
      if (cv) setVetVisits(JSON.parse(cv));
    } catch {}

    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      const [wRes, vRes] = await Promise.all([
        fetch('/api/knox/weight'),
        fetch('/api/knox/vet'),
      ]);
      const [wData, vData] = await Promise.all([wRes.json(), vRes.json()]);
      if (Array.isArray(wData)) {
        setWeights(wData);
        localStorage.setItem('knox_weights_v1', JSON.stringify(wData));
      }
      if (Array.isArray(vData)) {
        setVetVisits(vData);
        localStorage.setItem('knox_vets_v1', JSON.stringify(vData));
      }
    } catch (e) {
      console.error('Knox fetch error:', e);
    }
  }

  function openWeightModal() {
    setWDate(new Date().toISOString().split('T')[0]);
    setWLbs('');
    setWNotes('');
    setShowWeightModal(true);
  }

  function openVetModal() {
    setVDate(new Date().toISOString().split('T')[0]);
    setVType('Wellness Exam');
    setVVet('');
    setVNotes('');
    setVCost('');
    setVNext('');
    setShowVetModal(true);
  }

  async function saveWeight() {
    if (!wLbs || !wDate) return;
    setSavingW(true);
    try {
      const res = await fetch('/api/knox/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: wDate, weight_lbs: wLbs, notes: wNotes || null }),
      });
      if (res.ok) {
        setShowWeightModal(false);
        await fetchAll();
      }
    } finally {
      setSavingW(false);
    }
  }

  async function deleteWeight(id: string) {
    if (!confirm('Delete this weight entry?')) return;
    await fetch(`/api/knox/weight?id=${id}`, { method: 'DELETE' });
    await fetchAll();
  }

  async function saveVet() {
    if (!vDate || !vType) return;
    setSavingV(true);
    try {
      const res = await fetch('/api/knox/vet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: vDate,
          visit_type: vType,
          vet_name: vVet || null,
          notes: vNotes || null,
          cost: vCost !== '' ? vCost : null,
          next_visit_date: vNext || null,
        }),
      });
      if (res.ok) {
        setShowVetModal(false);
        await fetchAll();
      }
    } finally {
      setSavingV(false);
    }
  }

  async function deleteVet(id: string) {
    await fetch(`/api/knox/vet?id=${id}`, { method: 'DELETE' });
    await fetchAll();
  }

  // ── Derived ──
  const today = new Date().toISOString().split('T')[0];
  const currentWeight = weights.length > 0 ? weights[0] : null;

  const nextVetDate = vetVisits
    .flatMap((v) => (v.next_visit_date && v.next_visit_date >= today ? [v.next_visit_date] : []))
    .sort()[0];

  const upcomingVets = vetVisits
    .filter((v) => v.date > today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const pastVets = vetVisits
    .filter((v) => v.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));

  // ── Profile Tab ──────────────────────────────────────────────────────────

  function ProfileTab() {
    return (
      <div className="px-4 pt-4 space-y-4">
        {/* Hero */}
        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#1a1a1a] border border-[#222] flex items-center justify-center text-3xl">
              🐺
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Knox</h2>
              <p className="text-[#ccc] text-sm">Siberian Husky</p>
              {age && <p className="text-[#555] text-xs mt-0.5">{age}</p>}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[#1a1a1a] grid grid-cols-3 gap-0">
            <div className="text-center">
              <p className="text-[#555] text-xs mb-1">Birthday</p>
              <p className="text-white text-sm font-medium">Jan 14, 2026</p>
            </div>
            <div className="text-center border-x border-[#1a1a1a]">
              <p className="text-[#555] text-xs mb-1">Weight</p>
              <p className="text-white text-sm font-medium font-mono">
                {currentWeight ? `${currentWeight.weight_lbs} lbs` : '—'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[#555] text-xs mb-1">Next Vet</p>
              <p className="text-[#f0a050] text-sm font-medium">
                {nextVetDate ? formatDate(nextVetDate) : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Breed info */}
        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-5">
          <h3 className="text-xs text-[#555] font-semibold uppercase tracking-wider mb-3">
            Breed Info
          </h3>
          {[
            { label: 'Group', value: 'Working Group' },
            { label: 'Adult weight (male)', value: '35–60 lbs' },
            { label: 'Lifespan', value: '12–14 years' },
            { label: 'Energy level', value: 'Very High' },
            { label: 'Exercise needed', value: '2+ hrs/day' },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex justify-between items-center py-2.5 border-b border-[#1a1a1a] last:border-0"
            >
              <span className="text-[#888] text-sm">{label}</span>
              <span className="text-white text-sm">{value}</span>
            </div>
          ))}
        </div>

        {/* Quick stats */}
        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-5">
          <h3 className="text-xs text-[#555] font-semibold uppercase tracking-wider mb-3">
            Log Stats
          </h3>
          {[
            { label: 'Weight entries', value: weights.length },
            { label: 'Vet visits logged', value: vetVisits.length },
            { label: 'Vet visits this year', value: vetVisits.filter((v) => v.date.startsWith('2026')).length },
            {
              label: 'Total vet spend',
              value: vetVisits.reduce((sum, v) => sum + (v.cost || 0), 0) > 0
                ? fmtCurrency(vetVisits.reduce((sum, v) => sum + (v.cost || 0), 0))
                : '—',
            },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex justify-between items-center py-2.5 border-b border-[#1a1a1a] last:border-0"
            >
              <span className="text-[#888] text-sm">{label}</span>
              <span className="text-white text-sm font-mono">{value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Weight Tab ───────────────────────────────────────────────────────────

  function WeightTab() {
    return (
      <div className="px-4 pt-4">
        {weights.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-3">⚖️</p>
            <p className="text-[#555] text-sm">No weight entries yet</p>
            <p className="text-[#333] text-xs mt-1">Tap + to log Knox&apos;s weight</p>
          </div>
        ) : (
          <div className="space-y-2">
            {weights.map((entry, i) => {
              const prev = weights[i + 1];
              const change = prev ? entry.weight_lbs - prev.weight_lbs : null;
              return (
                <div
                  key={entry.id}
                  className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="text-white font-medium">{formatDate(entry.date)}</p>
                    {entry.notes && (
                      <p className="text-[#555] text-xs mt-0.5">{entry.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-white font-mono font-semibold">
                        {entry.weight_lbs} lbs
                      </p>
                      {change !== null && (
                        <p
                          className={`text-xs font-mono ${
                            change > 0
                              ? 'text-green-400'
                              : change < 0
                              ? 'text-red-400'
                              : 'text-[#555]'
                          }`}
                        >
                          {change > 0 ? '+' : ''}
                          {change.toFixed(1)} lbs
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteWeight(entry.id)}
                      className="text-[#444] hover:text-red-400 transition-colors text-xl leading-none"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Vet Tab ──────────────────────────────────────────────────────────────

  function VetTab() {
    return (
      <div className="px-4 pt-4">
        {vetVisits.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-3">🏥</p>
            <p className="text-[#555] text-sm">No vet visits logged yet</p>
            <p className="text-[#333] text-xs mt-1">Tap + to add a visit</p>
          </div>
        ) : (
          <div className="space-y-5">
            {upcomingVets.length > 0 && (
              <div>
                <p className="text-xs text-[#f0a050] font-semibold uppercase tracking-wider mb-2">
                  Upcoming
                </p>
                <div className="space-y-2">
                  {upcomingVets.map((v) => (
                    <VetCard key={v.id} visit={v} onDelete={deleteVet} />
                  ))}
                </div>
              </div>
            )}
            {pastVets.length > 0 && (
              <div>
                <p className="text-xs text-[#555] font-semibold uppercase tracking-wider mb-2">
                  Past Visits
                </p>
                <div className="space-y-2">
                  {pastVets.map((v) => (
                    <VetCard key={v.id} visit={v} onDelete={deleteVet} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <PullToRefresh onRefresh={fetchAll}>
        <div className="pb-24 min-h-screen bg-black">
          {/* Page header */}
          <div className="px-4 pt-6 pb-2">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">Knox</h1>
              <span className="text-xl">🐾</span>
            </div>
            {age && (
              <p className="text-[#555] text-sm mt-0.5">
                {age} · Siberian Husky
              </p>
            )}
          </div>

          <SwipeTabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
            {activeTab === 0 && <ProfileTab />}
            {activeTab === 1 && <WeightTab />}
            {activeTab === 2 && <VetTab />}
          </SwipeTabs>
        </div>
      </PullToRefresh>

      {/* FAB — only on Weight or Vet tab */}
      {activeTab === 1 && (
        <button
          onClick={openWeightModal}
          className="fixed bottom-28 right-4 w-14 h-14 rounded-full bg-[#f0a050] text-black text-2xl font-bold shadow-lg flex items-center justify-center z-40 active:scale-95 transition-transform"
        >
          +
        </button>
      )}
      {activeTab === 2 && (
        <button
          onClick={openVetModal}
          className="fixed bottom-28 right-4 w-14 h-14 rounded-full bg-[#f0a050] text-black text-2xl font-bold shadow-lg flex items-center justify-center z-40 active:scale-95 transition-transform"
        >
          +
        </button>
      )}

      {/* ── Log Weight Modal ─────────────────────────────────────────────── */}
      {showWeightModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
          onClick={() => setShowWeightModal(false)}
        >
          <div
            className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-white text-lg font-semibold mb-5">Log Weight</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={wDate}
                  onChange={(e) => setWDate(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">
                  Weight (lbs)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g. 32.5"
                  value={wLbs}
                  onChange={(e) => setWLbs(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. After morning meal"
                  value={wNotes}
                  onChange={(e) => setWNotes(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowWeightModal(false)}
                className="flex-1 py-3 rounded-xl border border-[#333] text-[#888] text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveWeight}
                disabled={savingW || !wLbs || !wDate}
                className="flex-1 py-3 rounded-xl bg-[#f0a050] text-black text-sm font-semibold disabled:opacity-40 active:scale-95 transition-transform"
              >
                {savingW ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Vet Visit Modal ──────────────────────────────────────────── */}
      {showVetModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
          onClick={() => setShowVetModal(false)}
        >
          <div
            className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-4">
              <h2 className="text-white text-lg font-semibold">Add Vet Visit</h2>

              <div>
                <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Date</label>
                <input
                  type="date"
                  value={vDate}
                  onChange={(e) => setVDate(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white text-sm"
                />
              </div>

              <div>
                <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Visit Type</label>
                <select
                  value={vType}
                  onChange={(e) => setVType(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white text-sm"
                >
                  {VISIT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Vet / Clinic</label>
                <input
                  type="text"
                  placeholder="e.g. Berks Animal Hospital"
                  value={vVet}
                  onChange={(e) => setVVet(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white text-sm"
                />
              </div>

              <div>
                <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Notes</label>
                <textarea
                  placeholder="Vaccines given, medications, findings…"
                  value={vNotes}
                  onChange={(e) => setVNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white text-sm resize-none"
                />
              </div>

              <div>
                <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={vCost}
                  onChange={(e) => setVCost(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white text-sm"
                />
              </div>

              <div>
                <label className="text-[#555] text-xs uppercase tracking-wide block mb-1">
                  Next Visit Date (optional)
                </label>
                <input
                  type="date"
                  value={vNext}
                  onChange={(e) => setVNext(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white text-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowVetModal(false)}
                  className="flex-1 py-3 rounded-xl border border-[#333] text-[#888] text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={saveVet}
                  disabled={savingV || !vDate || !vType}
                  className="flex-1 py-3 rounded-xl bg-[#f0a050] text-black text-sm font-semibold disabled:opacity-40 active:scale-95 transition-transform"
                >
                  {savingV ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}