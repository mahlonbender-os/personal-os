'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import BottomNav from '@/components/BottomNav';
import PullToRefresh from '@/components/PullToRefresh';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeightLog { id: string; log_date: string; weight_lbs: number; notes: string | null; }
interface VetVisit { id: string; visit_date: string; reason: string; vet_name: string; cost: number; notes: string | null; }
interface Vaccination { id: string; vaccine_name: string; administered_date: string; next_due_date: string | null; expiration_date: string | null; administered_by: string | null; notes: string | null; }
interface Medication { id: string; medication_name: string; medication_type: string | null; dosage: string | null; frequency: string | null; cost_per_dose: number | null; next_due_date: string | null; last_given_date: string | null; is_active: boolean; notes: string | null; }
interface Milestone { id: string; milestone_date: string; title: string; description: string | null; }
interface TrainingSession { id: string; log_date: string; skill: string; duration_minutes: number | null; notes: string | null; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';
const KNOX_BIRTH = new Date('2026-01-14');

function knoxAge() {
  const now = new Date();
  const months = (now.getFullYear() - KNOX_BIRTH.getFullYear()) * 12 + (now.getMonth() - KNOX_BIRTH.getMonth());
  if (months < 12) return `${months}mo`;
  const yrs = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${yrs}y ${rem}mo` : `${yrs}y`;
}

function fmtDate(s: string) {
  if (!s) return '';
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function today() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });
}

function vaccineDaysUntil(due: string | null) {
  if (!due) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  const d = new Date(due + 'T00:00:00');
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

function Spinner() {
  return <div className="w-5 h-5 border-2 border-[#f0a050] border-t-transparent rounded-full animate-spin" />;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-[#111] border border-[#1a1a1a] ${className}`}>{children}</div>;
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-center text-[#333] text-sm py-10">{msg}</p>;
}

function DeleteSheet({ onCancel, onConfirm, deleting }: { onCancel: () => void; onConfirm: () => void; deleting: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
      <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-lg p-5 border border-[#1a1a1a]">
        <p className="text-base font-semibold text-white text-center mb-4">Delete this entry?</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-[#2a2a2a] text-white text-sm font-semibold">Cancel</button>
          <button onClick={onConfirm} disabled={deleting} className="flex-1 py-3 rounded-xl bg-[#ef4444] text-white text-sm font-semibold disabled:opacity-40">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab components ────────────────────────────────────────────────────────────

function WeightTab({ refresh }: { refresh: number }) {
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch('/api/knox/weight').then(r => r.json());
      setLogs(d.weights || d || []);
    } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load, refresh]);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/knox/weight?id=${deleteId}`, { method: 'DELETE' });
    setDeleting(false); setDeleteId(null); load();
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (!logs.length) return <Empty msg="No weight entries yet — tap Log Weight" />;

  const latest = logs[0];
  const prev = logs[1];
  const delta = prev ? parseFloat(String(latest.weight_lbs)) - parseFloat(String(prev.weight_lbs)) : null;

  return (
    <>
      <div className="space-y-4">
        <Card className="p-4">
          <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-1">Latest Weight</p>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold text-white font-mono">{parseFloat(String(latest.weight_lbs)).toFixed(1)}</p>
            <p className="text-base text-[#555] mb-0.5">lbs</p>
            {delta !== null && (
              <p className={`text-sm font-semibold mb-0.5 ${delta > 0 ? 'text-[#f0a050]' : 'text-[#22c55e]'}`}>
                {delta > 0 ? '+' : ''}{delta.toFixed(1)} since last
              </p>
            )}
          </div>
          <p className="text-[10px] text-[#444] mt-1">{fmtDate(latest.log_date)}</p>
        </Card>

        <div>
          <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-2 px-1">History</p>
          <Card className="overflow-hidden">
            {logs.map((log, idx) => (
              <div key={log.id}
                className={`flex items-center px-4 py-3 gap-3 cursor-pointer active:bg-[#161616] transition-colors ${idx !== logs.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}
                onClick={() => setDeleteId(log.id)}
              >
                <div className="flex-1">
                  <p className="text-sm text-[#ccc]">{fmtDate(log.log_date)}</p>
                  {log.notes && <p className="text-[10px] text-[#444]">{log.notes}</p>}
                </div>
                <p className="text-sm font-semibold text-[#f0a050] font-mono">{parseFloat(String(log.weight_lbs)).toFixed(1)} lbs</p>
              </div>
            ))}
          </Card>
          <p className="text-[10px] text-[#333] px-1 mt-1.5">Tap entry to delete</p>
        </div>
      </div>
      {deleteId && <DeleteSheet onCancel={() => setDeleteId(null)} onConfirm={handleDelete} deleting={deleting} />}
    </>
  );
}

function VetTab({ refresh }: { refresh: number }) {
  const [visits, setVisits] = useState<VetVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch('/api/knox/vet').then(r => r.json());
      setVisits(d.visits || d || []);
    } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load, refresh]);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/knox/vet?id=${deleteId}`, { method: 'DELETE' });
    setDeleting(false); setDeleteId(null); load();
  }

  const totalSpent = visits.reduce((s, v) => s + parseFloat(String(v.cost || 0)), 0);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (!visits.length) return <Empty msg="No vet visits yet — tap Add Visit" />;

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-[10px] text-[#444] mb-1">Total Visits</p>
            <p className="text-2xl font-bold text-white">{visits.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-[10px] text-[#444] mb-1">Total Spent</p>
            <p className="text-2xl font-bold text-[#f0a050] font-mono">${totalSpent.toFixed(0)}</p>
          </Card>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-2 px-1">Visit History</p>
          <Card className="overflow-hidden">
            {visits.map((v, idx) => (
              <div key={v.id}
                className={`flex items-start px-4 py-3 gap-3 cursor-pointer active:bg-[#161616] transition-colors ${idx !== visits.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}
                onClick={() => setDeleteId(v.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#ccc]">{v.reason}</p>
                  <p className="text-[10px] text-[#444]">{v.vet_name} · {fmtDate(v.visit_date)}</p>
                  {v.notes && <p className="text-[10px] text-[#333] mt-0.5 truncate">{v.notes}</p>}
                </div>
                <p className="text-sm font-semibold text-[#f0a050] font-mono flex-shrink-0">${parseFloat(String(v.cost || 0)).toFixed(2)}</p>
              </div>
            ))}
          </Card>
          <p className="text-[10px] text-[#333] px-1 mt-1.5">Tap entry to delete</p>
        </div>
      </div>
      {deleteId && <DeleteSheet onCancel={() => setDeleteId(null)} onConfirm={handleDelete} deleting={deleting} />}
    </>
  );
}

function VaccinesTab({ refresh }: { refresh: number }) {
  const [vaccines, setVaccines] = useState<Vaccination[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch('/api/knox/vaccinations').then(r => r.json());
      setVaccines(d.vaccinations || []);
    } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load, refresh]);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/knox/vaccinations?id=${deleteId}`, { method: 'DELETE' });
    setDeleting(false); setDeleteId(null); load();
  }

  function statusInfo(due: string | null) {
    const days = vaccineDaysUntil(due);
    if (days === null) return { label: 'No due date', color: '#555' };
    if (days < 0) return { label: `Overdue ${Math.abs(days)}d`, color: '#ef4444' };
    if (days <= 30) return { label: `Due in ${days}d`, color: '#f0a050' };
    return { label: `Due ${fmtDate(due!)}`, color: '#22c55e' };
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (!vaccines.length) return <Empty msg="No vaccines logged — tap Add Vaccine" />;

  return (
    <>
      <div className="space-y-4">
        <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-2 px-1">Vaccine Records</p>
        <Card className="overflow-hidden">
          {vaccines.map((v, idx) => {
            const { label, color } = statusInfo(v.next_due_date);
            return (
              <div key={v.id}
                className={`flex items-start px-4 py-3 gap-3 cursor-pointer active:bg-[#161616] transition-colors ${idx !== vaccines.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}
                onClick={() => setDeleteId(v.id)}
              >
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#ccc]">{v.vaccine_name}</p>
                  <p className="text-[10px] text-[#444]">Given {fmtDate(v.administered_date)}{v.administered_by ? ` · ${v.administered_by}` : ''}</p>
                  {v.notes && <p className="text-[10px] text-[#333] mt-0.5">{v.notes}</p>}
                </div>
                <p className="text-[10px] font-semibold flex-shrink-0" style={{ color }}>{label}</p>
              </div>
            );
          })}
        </Card>
        <p className="text-[10px] text-[#333] px-1">Tap entry to delete</p>
      </div>
      {deleteId && <DeleteSheet onCancel={() => setDeleteId(null)} onConfirm={handleDelete} deleting={deleting} />}
    </>
  );
}

function MedsTab({ refresh }: { refresh: number }) {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch('/api/knox/medications').then(r => r.json());
      setMeds(d.medications || []);
    } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load, refresh]);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/knox/medications?id=${deleteId}`, { method: 'DELETE' });
    setDeleting(false); setDeleteId(null); load();
  }

  async function handleToggle(med: Medication) {
    setTogglingId(med.id);
    await fetch(`/api/knox/medications?id=${med.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !med.is_active }),
    });
    setTogglingId(null); load();
  }

  const active = meds.filter(m => m.is_active);
  const inactive = meds.filter(m => !m.is_active);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (!meds.length) return <Empty msg="No medications logged — tap Add Med" />;

  function MedRow({ med, idx, total }: { med: Medication; idx: number; total: number }) {
    const daysUntil = vaccineDaysUntil(med.next_due_date);
    return (
      <div className={`px-4 py-3 ${idx !== total - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#ccc]">{med.medication_name}</p>
            <div className="flex flex-wrap gap-x-2 mt-0.5">
              {med.dosage && <p className="text-[10px] text-[#444]">{med.dosage}</p>}
              {med.frequency && <p className="text-[10px] text-[#444]">{med.frequency}</p>}
              {med.medication_type && <p className="text-[10px] text-[#444]">{med.medication_type}</p>}
            </div>
            {med.next_due_date && (
              <p className={`text-[10px] mt-0.5 ${daysUntil !== null && daysUntil < 0 ? 'text-[#ef4444]' : daysUntil !== null && daysUntil <= 7 ? 'text-[#f0a050]' : 'text-[#444]'}`}>
                Next due {fmtDate(med.next_due_date)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => handleToggle(med)}
              disabled={togglingId === med.id}
              className="text-xs font-semibold text-[#f0a050] px-2.5 py-1.5 rounded-lg bg-[#f0a050]/10 disabled:opacity-40"
            >
              {togglingId === med.id ? '…' : med.is_active ? 'Deactivate' : 'Activate'}
            </button>
            <button onClick={() => setDeleteId(med.id)} className="text-xs font-semibold text-[#ef4444] px-2.5 py-1.5 rounded-lg bg-[#ef4444]/10">Delete</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {active.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-2 px-1">Active</p>
            <Card className="overflow-hidden">{active.map((m, i) => <MedRow key={m.id} med={m} idx={i} total={active.length} />)}</Card>
          </div>
        )}
        {inactive.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-2 px-1">Inactive</p>
            <Card className="overflow-hidden">{inactive.map((m, i) => <MedRow key={m.id} med={m} idx={i} total={inactive.length} />)}</Card>
          </div>
        )}
      </div>
      {deleteId && <DeleteSheet onCancel={() => setDeleteId(null)} onConfirm={handleDelete} deleting={deleting} />}
    </>
  );
}

function MilestonesTab({ refresh }: { refresh: number }) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch('/api/knox/milestones').then(r => r.json());
      setMilestones(d.milestones || []);
    } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load, refresh]);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/knox/milestones?id=${deleteId}`, { method: 'DELETE' });
    setDeleting(false); setDeleteId(null); load();
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (!milestones.length) return <Empty msg="No milestones yet — tap Add Milestone" />;

  return (
    <>
      <div className="space-y-3">
        {milestones.map((m, idx) => (
          <div key={m.id}
            className="flex gap-3 cursor-pointer active:opacity-70 transition-opacity"
            onClick={() => setDeleteId(m.id)}
          >
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-[#f0a050] flex-shrink-0 mt-1" />
              {idx !== milestones.length - 1 && <div className="w-px flex-1 bg-[#1a1a1a] mt-1" />}
            </div>
            <div className="flex-1 pb-3">
              <p className="text-[10px] text-[#555] mb-0.5">{fmtDate(m.milestone_date)}</p>
              <p className="text-sm font-semibold text-white">{m.title}</p>
              {m.description && <p className="text-[11px] text-[#555] mt-0.5">{m.description}</p>}
            </div>
          </div>
        ))}
        <p className="text-[10px] text-[#333] px-1 pt-1">Tap entry to delete</p>
      </div>
      {deleteId && <DeleteSheet onCancel={() => setDeleteId(null)} onConfirm={handleDelete} deleting={deleting} />}
    </>
  );
}

function TrainingTab({ refresh }: { refresh: number }) {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch('/api/knox/training').then(r => r.json());
      setSessions(d.sessions || []);
    } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load, refresh]);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/knox/training?id=${deleteId}`, { method: 'DELETE' });
    setDeleting(false); setDeleteId(null); load();
  }

  const totalMinutes = sessions.reduce((s, t) => s + (t.duration_minutes || 0), 0);
  const skills = [...new Set(sessions.map(s => s.skill))].length;

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (!sessions.length) return <Empty msg="No training sessions yet — tap Log Session" />;

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <p className="text-[10px] text-[#444] mb-1">Sessions</p>
            <p className="text-xl font-bold text-white">{sessions.length}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-[10px] text-[#444] mb-1">Minutes</p>
            <p className="text-xl font-bold text-white">{totalMinutes}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-[10px] text-[#444] mb-1">Skills</p>
            <p className="text-xl font-bold text-white">{skills}</p>
          </Card>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-2 px-1">Sessions</p>
          <Card className="overflow-hidden">
            {sessions.map((s, idx) => (
              <div key={s.id}
                className={`flex items-start px-4 py-3 gap-3 cursor-pointer active:bg-[#161616] transition-colors ${idx !== sessions.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}
                onClick={() => setDeleteId(s.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#ccc]">{s.skill}</p>
                  <p className="text-[10px] text-[#444]">{fmtDate(s.log_date)}{s.duration_minutes ? ` · ${s.duration_minutes} min` : ''}</p>
                  {s.notes && <p className="text-[10px] text-[#333] mt-0.5">{s.notes}</p>}
                </div>
                {s.duration_minutes && (
                  <p className="text-xs font-semibold text-[#f0a050] flex-shrink-0">{s.duration_minutes}m</p>
                )}
              </div>
            ))}
          </Card>
          <p className="text-[10px] text-[#333] px-1 mt-1.5">Tap entry to delete</p>
        </div>
      </div>
      {deleteId && <DeleteSheet onCancel={() => setDeleteId(null)} onConfirm={handleDelete} deleting={deleting} />}
    </>
  );
}

// ─── Add Modal ────────────────────────────────────────────────────────────────

const TABS = ['Weight', 'Vet', 'Vaccines', 'Meds', 'Milestones', 'Training'] as const;
type TabName = typeof TABS[number];

function AddModal({ tab, onClose, onSaved }: { tab: TabName; onClose: () => void; onSaved: () => void }) {
  const t = today();
  const [form, setForm] = useState<Record<string, string>>({
    date: t, log_date: t, visit_date: t, administered_date: t, milestone_date: t,
    weight_lbs: '', reason: '', vet_name: '', cost: '', vaccine_name: '',
    next_due_date: '', administered_by: '', medication_name: '', medication_type: '',
    dosage: '', frequency: '', last_given_date: '', title: '', skill: '', duration_minutes: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function Field({ label, field, type = 'text', placeholder = '' }: { label: string; field: string; type?: string; placeholder?: string }) {
    return (
      <div className="flex items-center px-4 py-3 border-b border-white/10 last:border-0">
        <span className="text-sm text-[#888] w-28 flex-shrink-0">{label}</span>
        <input type={type} value={form[field]} placeholder={placeholder}
          onChange={e => set(field, e.target.value)}
          className="flex-1 bg-transparent text-sm text-white text-right outline-none placeholder-[#444]" />
      </div>
    );
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      let url = ''; let body: Record<string, unknown> = {};
      switch (tab) {
        case 'Weight':
          if (!form.weight_lbs) throw new Error('Weight is required');
          url = '/api/knox/weight';
          body = { log_date: form.log_date, weight_lbs: parseFloat(form.weight_lbs), user_id: USER_ID, notes: form.notes || null };
          break;
        case 'Vet':
          if (!form.reason || !form.vet_name) throw new Error('Reason and vet name are required');
          url = '/api/knox/vet';
          body = { visit_date: form.visit_date, reason: form.reason, vet_name: form.vet_name, cost: parseFloat(form.cost) || 0, user_id: USER_ID, notes: form.notes || null };
          break;
        case 'Vaccines':
          if (!form.vaccine_name || !form.administered_date) throw new Error('Vaccine name and date are required');
          url = '/api/knox/vaccinations';
          body = { vaccine_name: form.vaccine_name, administered_date: form.administered_date, next_due_date: form.next_due_date || null, administered_by: form.administered_by || null, notes: form.notes || null };
          break;
        case 'Meds':
          if (!form.medication_name) throw new Error('Medication name is required');
          url = '/api/knox/medications';
          body = { medication_name: form.medication_name, medication_type: form.medication_type || null, dosage: form.dosage || null, frequency: form.frequency || null, last_given_date: form.last_given_date || null, next_due_date: form.next_due_date || null, is_active: true, notes: form.notes || null };
          break;
        case 'Milestones':
          if (!form.title) throw new Error('Title is required');
          url = '/api/knox/milestones';
          body = { title: form.title, milestone_date: form.milestone_date, description: form.notes || null };
          break;
        case 'Training':
          if (!form.skill) throw new Error('Skill is required');
          url = '/api/knox/training';
          body = { log_date: form.log_date, skill: form.skill, duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null, notes: form.notes || null };
          break;
      }
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      onSaved();
      onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  const titles: Record<TabName, string> = { Weight: 'Log Weight', Vet: 'Add Visit', Vaccines: 'Add Vaccine', Meds: 'Add Medication', Milestones: 'Add Milestone', Training: 'Log Session' };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-[#1c1c1e] w-full max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto pb-6 border border-[#1a1a1a]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10 sticky top-0 bg-[#1c1c1e] z-10">
          <button onClick={onClose} className="text-[#f0a050] text-sm">Cancel</button>
          <h2 className="text-base font-semibold text-white">{titles[tab]}</h2>
          <button onClick={handleSave} disabled={saving} className="text-[#f0a050] text-sm font-semibold disabled:opacity-40">{saving ? 'Saving…' : 'Save'}</button>
        </div>
        <div className="px-4 pt-4">
          <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
            {tab === 'Weight' && (<><Field label="Date" field="log_date" type="date" /><Field label="Weight (lbs)" field="weight_lbs" type="number" placeholder="0.0" /><Field label="Notes" field="notes" placeholder="Optional" /></>)}
            {tab === 'Vet' && (<><Field label="Date" field="visit_date" type="date" /><Field label="Reason" field="reason" placeholder="Annual checkup, injury…" /><Field label="Vet Name" field="vet_name" placeholder="Dr. Smith" /><Field label="Cost" field="cost" type="number" placeholder="0.00" /><Field label="Notes" field="notes" placeholder="Optional" /></>)}
            {tab === 'Vaccines' && (<><Field label="Vaccine" field="vaccine_name" placeholder="Rabies, DHPP…" /><Field label="Given" field="administered_date" type="date" /><Field label="Next Due" field="next_due_date" type="date" /><Field label="Given By" field="administered_by" placeholder="Dr. Smith" /><Field label="Notes" field="notes" placeholder="Optional" /></>)}
            {tab === 'Meds' && (<><Field label="Medication" field="medication_name" placeholder="Heartgard, NexGard…" /><Field label="Type" field="medication_type" placeholder="Preventative, Treatment…" /><Field label="Dosage" field="dosage" placeholder="1 tablet" /><Field label="Frequency" field="frequency" placeholder="Monthly, Daily…" /><Field label="Last Given" field="last_given_date" type="date" /><Field label="Next Due" field="next_due_date" type="date" /><Field label="Notes" field="notes" placeholder="Optional" /></>)}
            {tab === 'Milestones' && (<><Field label="Title" field="title" placeholder="First sit, First hike…" /><Field label="Date" field="milestone_date" type="date" /><Field label="Description" field="notes" placeholder="Optional details" /></>)}
            {tab === 'Training' && (<><Field label="Date" field="log_date" type="date" /><Field label="Skill" field="skill" placeholder="Sit, Stay, Heel…" /><Field label="Duration (min)" field="duration_minutes" type="number" placeholder="15" /><Field label="Notes" field="notes" placeholder="Progress, notes…" /></>)}
          </div>
          {error && <p className="text-[#ef4444] text-xs px-1 mt-3 font-mono">{error}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KnoxPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  const headerButtons: Record<number, string> = { 0: 'Log Weight', 1: 'Add Visit', 2: 'Add Vaccine', 3: 'Add Med', 4: 'Add Milestone', 5: 'Log Session' };

  if (status === 'loading') return <div className="min-h-screen bg-black flex items-center justify-center"><Spinner /></div>;
  if (!session) return <div className="min-h-screen bg-black flex items-center justify-center"><p className="text-[#555]">Please sign in</p></div>;

  return (
    <>
      <div className="fixed inset-0 bg-black flex flex-col overflow-hidden select-none">
        {/* Header */}
        <div className="flex-shrink-0 bg-black border-b border-[#1a1a1a] pt-14 px-4 z-30">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-white">Knox 🐺</h1>
              <p className="text-[11px] text-[#444]">Siberian Husky · {knoxAge()} old</p>
            </div>
            <button
              onClick={() => { if (navigator.vibrate) navigator.vibrate(8); setShowAdd(true); }}
              className="text-sm font-semibold text-[#f0a050] active:opacity-70 px-2 py-1"
            >
              {headerButtons[activeTab]}
            </button>
          </div>
          <div className="flex overflow-x-auto scrollbar-hide gap-0 -mx-4 px-4">
            {TABS.map((tab, i) => (
              <button key={tab} onClick={() => { setActiveTab(i); if (navigator.vibrate) navigator.vibrate(8); }}
                className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${activeTab === i ? 'border-[#f0a050] text-[#f0a050]' : 'border-transparent text-[#555]'}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 scrollbar-hide">
          <PullToRefresh onRefresh={async () => setRefreshCount(c => c + 1)}>
            <div className="space-y-4">
              {activeTab === 0 && <WeightTab refresh={refreshCount} />}
              {activeTab === 1 && <VetTab refresh={refreshCount} />}
              {activeTab === 2 && <VaccinesTab refresh={refreshCount} />}
              {activeTab === 3 && <MedsTab refresh={refreshCount} />}
              {activeTab === 4 && <MilestonesTab refresh={refreshCount} />}
              {activeTab === 5 && <TrainingTab refresh={refreshCount} />}
            </div>
          </PullToRefresh>
        </div>

        <BottomNav active="more" />
      </div>

      {showAdd && (
        <AddModal
          tab={TABS[activeTab]}
          onClose={() => setShowAdd(false)}
          onSaved={() => setRefreshCount(c => c + 1)}
        />
      )}
    </>
  );
}