'use client';

import { useState, useEffect } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import BottomNav from '@/components/BottomNav';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HomeProfile {
  id?: string;
  address?: string;
  purchase_date?: string;
  purchase_price?: number | string;
  heloc_lender?: string;
  heloc_credit_limit?: number | string;
  heloc_interest_rate?: number | string;
  heloc_draw_period_end?: string;
  notes?: string;
}

interface HomeBalances {
  home_value: number;
  heloc_balance: number;
  mortgage_balance: number;
  equity: number;
}

interface Maintenance {
  id: string;
  title: string;
  category?: string;
  description?: string;
  completed_date?: string;
  due_date?: string;
  cost?: number | string;
  contractor?: string;
  is_complete?: boolean;
  is_recurring?: boolean;
  recurrence_months?: number;
  notes?: string;
}

interface Project {
  id: string;
  title: string;
  description?: string;
  status?: string;
  estimated_cost?: number | string;
  actual_cost?: number | string;
  start_date?: string;
  completion_date?: string;
  funded_by?: string;
  notes?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ['Profile', 'Maintenance', 'Projects'];
const CACHE_PROFILE = 'home-profile-v1';
const CACHE_BALANCES = 'home-balances-v1';
const CACHE_MAINTENANCE = 'home-maintenance-v1';
const CACHE_PROJECTS = 'home-projects-v1';

const MAINTENANCE_CATEGORIES = [
  'HVAC', 'Plumbing', 'Electrical', 'Roofing', 'Landscaping',
  'Appliances', 'Painting', 'Flooring', 'Windows & Doors', 'Pest Control',
  'Cleaning', 'Other',
];

const PROJECT_STATUSES = ['planned', 'in-progress', 'complete'];

const STATUS_COLORS: Record<string, string> = {
  planned: '#888',
  'in-progress': '#f0a050',
  complete: '#22c55e',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number | string | undefined) => {
  if (n === undefined || n === null || n === '') return '—';
  const v = parseFloat(String(n));
  if (isNaN(v)) return '—';
  return `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtPct = (n: number | string | undefined) => {
  if (n === undefined || n === null || n === '') return '—';
  const v = parseFloat(String(n));
  if (isNaN(v)) return '—';
  return `${v.toFixed(2)}%`;
};

const fmtDate = (d?: string) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${parseInt(m)}/${parseInt(day)}/${y}`;
};

const today = () =>
  new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });

// ─── Main Component ──────────────────────────────────────────────────────────

export default function HomePage() {
  const [activeTab, setActiveTab] = useState(0);

  // Profile
  const [profile, setProfile] = useState<HomeProfile | null>(null);
  const [balances, setBalances] = useState<HomeBalances | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState<HomeProfile>({});

  // Maintenance
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [showMaintenanceFilter, setShowMaintenanceFilter] = useState<'all' | 'upcoming' | 'complete'>('all');
  const [showAddMaintenance, setShowAddMaintenance] = useState(false);
  const [editMaintenance, setEditMaintenance] = useState<Maintenance | null>(null);
  const [deleteMaintenanceId, setDeleteMaintenanceId] = useState<string | null>(null);
  const [maintenanceForm, setMaintenanceForm] = useState<Partial<Maintenance>>({});

  // Projects
  const [projects, setProjects] = useState<Project[]>([]);
  const [showAddProject, setShowAddProject] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState<Partial<Project>>({});

  const [saving, setSaving] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const cp = localStorage.getItem(CACHE_PROFILE);
      if (cp) setProfile(JSON.parse(cp));
      const cb = localStorage.getItem(CACHE_BALANCES);
      if (cb) { setBalances(JSON.parse(cb)); setBalancesLoading(false); }
      const cm = localStorage.getItem(CACHE_MAINTENANCE);
      if (cm) setMaintenance(JSON.parse(cm));
      const cpr = localStorage.getItem(CACHE_PROJECTS);
      if (cpr) setProjects(JSON.parse(cpr));
    } catch {}
    fetchAll();
  }, []);

  async function fetchAll() {
    await Promise.all([fetchProfile(), fetchBalances(), fetchMaintenance(), fetchProjects()]);
  }

  async function fetchProfile() {
    try {
      const res = await fetch('/api/home/profile');
      const data = await res.json();
      if (data && !data.error) {
        setProfile(data);
        localStorage.setItem(CACHE_PROFILE, JSON.stringify(data));
      }
    } catch {}
  }

  async function fetchBalances() {
    setBalancesLoading(true);
    try {
      const res = await fetch('/api/home/balances');
      const data = await res.json();
      if (data && !data.error) {
        setBalances(data);
        localStorage.setItem(CACHE_BALANCES, JSON.stringify(data));
      }
    } catch {}
    setBalancesLoading(false);
  }

  async function fetchMaintenance() {
    try {
      const res = await fetch('/api/home/maintenance');
      const data = await res.json();
      if (Array.isArray(data)) {
        setMaintenance(data);
        localStorage.setItem(CACHE_MAINTENANCE, JSON.stringify(data));
      }
    } catch {}
  }

  async function fetchProjects() {
    try {
      const res = await fetch('/api/home/projects');
      const data = await res.json();
      if (Array.isArray(data)) {
        setProjects(data);
        localStorage.setItem(CACHE_PROJECTS, JSON.stringify(data));
      }
    } catch {}
  }

  // ── Profile actions ────────────────────────────────────────────────────────

  function openEditProfile() {
    setEditProfileForm(profile ?? {});
    setShowEditProfile(true);
  }

  async function saveProfile() {
    setSaving(true);
    try {
      await fetch('/api/home/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editProfileForm),
      });
      await fetchProfile();
      setShowEditProfile(false);
    } finally {
      setSaving(false);
    }
  }

  // ── Maintenance actions ────────────────────────────────────────────────────

  function openAddMaintenance() {
    setMaintenanceForm({ due_date: today(), is_complete: false, is_recurring: false });
    setEditMaintenance(null);
    setShowAddMaintenance(true);
  }

  function openEditMaintenance(item: Maintenance) {
    setMaintenanceForm({ ...item });
    setEditMaintenance(item);
    setShowAddMaintenance(true);
  }

  async function saveMaintenance() {
    setSaving(true);
    try {
      const method = editMaintenance ? 'PUT' : 'POST';
      const body = editMaintenance
        ? { id: editMaintenance.id, ...maintenanceForm }
        : maintenanceForm;
      await fetch('/api/home/maintenance', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await fetchMaintenance();
      setShowAddMaintenance(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggleMaintenanceComplete(item: Maintenance) {
    const nowComplete = !item.is_complete;
    await fetch('/api/home/maintenance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.id,
        is_complete: nowComplete,
        completed_date: nowComplete ? today() : null,
      }),
    });
    await fetchMaintenance();
  }

  async function deleteMaintenance() {
    if (!deleteMaintenanceId) return;
    setSaving(true);
    try {
      await fetch('/api/home/maintenance', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteMaintenanceId }),
      });
      await fetchMaintenance();
      setDeleteMaintenanceId(null);
    } finally {
      setSaving(false);
    }
  }

  // ── Projects actions ───────────────────────────────────────────────────────

  function openAddProject() {
    setProjectForm({ status: 'planned' });
    setEditProject(null);
    setShowAddProject(true);
  }

  function openEditProject(p: Project) {
    setProjectForm({ ...p });
    setEditProject(p);
    setShowAddProject(true);
  }

  async function saveProject() {
    setSaving(true);
    try {
      const method = editProject ? 'PUT' : 'POST';
      const body = editProject
        ? { id: editProject.id, ...projectForm }
        : projectForm;
      await fetch('/api/home/projects', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await fetchProjects();
      setShowAddProject(false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject() {
    if (!deleteProjectId) return;
    setSaving(true);
    try {
      await fetch('/api/home/projects', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteProjectId }),
      });
      await fetchProjects();
      setDeleteProjectId(null);
    } finally {
      setSaving(false);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const filteredMaintenance = maintenance.filter((m) => {
    if (showMaintenanceFilter === 'upcoming') return !m.is_complete;
    if (showMaintenanceFilter === 'complete') return m.is_complete;
    return true;
  });

  const totalProjectEstimated = projects.reduce(
    (s, p) => s + (parseFloat(String(p.estimated_cost)) || 0), 0
  );
  const totalProjectActual = projects.reduce(
    (s, p) => s + (parseFloat(String(p.actual_cost)) || 0), 0
  );

  const helocUtil =
    balances && profile?.heloc_credit_limit
      ? Math.min((balances.heloc_balance / parseFloat(String(profile.heloc_credit_limit))) * 100, 100)
      : null;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="min-h-screen bg-black">
        <PullToRefresh onRefresh={fetchAll}>
          <div className="pb-24">

            {/* Header */}
            <div className="px-4 pt-6 pb-4">
              <h1
                className="text-2xl font-bold text-white"
                style={{ fontFamily: 'Syne, system-ui, sans-serif' }}
              >
                Home
              </h1>
              <p className="text-[#555] text-sm mt-0.5">
                {profile?.address ?? 'Property overview'}
              </p>
            </div>

            {/* Live equity summary bar */}
            <div className="mx-4 mb-4 bg-[#111] border border-[#1a1a1a] rounded-2xl px-4 py-3">
              {balancesLoading && !balances ? (
                <p className="text-[#555] text-xs text-center py-1">Loading balances…</p>
              ) : balances ? (
                <>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-[#555] text-xs mb-0.5">Est. Equity</p>
                      <p
                        className="font-mono text-xl font-bold"
                        style={{ color: balances.equity >= 0 ? '#22c55e' : '#ef4444' }}
                      >
                        {fmt(balances.equity)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#555] text-xs mb-0.5">Home Value</p>
                      <p className="text-[#f0a050] font-mono text-sm font-semibold">
                        {fmt(balances.home_value)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 bg-[#1a1a1a] rounded-xl px-3 py-2">
                      <p className="text-[#555] text-xs mb-0.5">HELOC</p>
                      <p className="text-[#ef4444] font-mono text-sm">{fmt(balances.heloc_balance)}</p>
                    </div>
                    <div className="flex-1 bg-[#1a1a1a] rounded-xl px-3 py-2">
                      <p className="text-[#555] text-xs mb-0.5">Mortgage</p>
                      <p className="text-[#ef4444] font-mono text-sm">{fmt(balances.mortgage_balance)}</p>
                    </div>
                  </div>
                  <p className="text-[#333] text-xs text-center mt-2">Live from Finance · pulls on refresh</p>
                </>
              ) : (
                <p className="text-[#555] text-xs text-center py-1">Could not load balances</p>
              )}
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-[#1a1a1a] sticky top-0 bg-black z-10">
              {TABS.map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(i);
                    window.scrollTo(0, 0);
                    if (navigator.vibrate) navigator.vibrate(8);
                  }}
                  className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                    activeTab === i
                      ? 'text-[#f0a050] border-b-2 border-[#f0a050]'
                      : 'text-[#555]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* ── TAB 0: Profile ── */}
            {activeTab === 0 && (
              <div className="px-4 pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-[#555] text-xs font-semibold uppercase tracking-wider">Property Info</p>
                  <button onClick={openEditProfile} className="text-[#f0a050] text-sm font-semibold">Edit</button>
                </div>

                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
                  {[
                    { label: 'Address', value: profile?.address },
                    { label: 'Purchase Date', value: fmtDate(profile?.purchase_date) },
                    { label: 'Purchase Price', value: fmt(profile?.purchase_price) },
                  ].map((row, i, arr) => (
                    <div
                      key={row.label}
                      className={`flex justify-between items-center px-4 py-3.5 ${i < arr.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}
                    >
                      <span className="text-[#888] text-sm">{row.label}</span>
                      <span className="text-white text-sm font-medium text-right max-w-[60%]">{row.value ?? '—'}</span>
                    </div>
                  ))}
                </div>

                <p className="text-[#555] text-xs font-semibold uppercase tracking-wider pt-2">HELOC Terms</p>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
                  {[
                    { label: 'Lender', value: profile?.heloc_lender, live: false },
                    { label: 'Credit Limit', value: fmt(profile?.heloc_credit_limit), live: false },
                    { label: 'Current Balance', value: balances ? fmt(balances.heloc_balance) : '—', live: true },
                    { label: 'Interest Rate', value: fmtPct(profile?.heloc_interest_rate), live: false },
                    { label: 'Draw Period Ends', value: fmtDate(profile?.heloc_draw_period_end), live: false },
                  ].map((row, i, arr) => (
                    <div
                      key={row.label}
                      className={`flex justify-between items-center px-4 py-3.5 ${i < arr.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}
                    >
                      <span className="text-[#888] text-sm">{row.label}</span>
                      <div className="flex items-center gap-1.5">
                        {row.live && <span className="text-[#22c55e] text-xs">live</span>}
                        <span className="text-white text-sm font-medium font-mono">{row.value ?? '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {helocUtil !== null && (
                  <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl px-4 py-3">
                    <div className="flex justify-between mb-2">
                      <span className="text-[#888] text-xs">HELOC Utilization</span>
                      <span className="text-white text-xs font-mono">{helocUtil.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-[#222] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${helocUtil}%`,
                          backgroundColor: helocUtil > 80 ? '#ef4444' : helocUtil > 50 ? '#f0a050' : '#22c55e',
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[#555] text-xs font-mono">{balances ? fmt(balances.heloc_balance) : '—'} used</span>
                      <span className="text-[#555] text-xs font-mono">
                        {balances && profile?.heloc_credit_limit
                          ? fmt(parseFloat(String(profile.heloc_credit_limit)) - balances.heloc_balance)
                          : '—'} available
                      </span>
                    </div>
                  </div>
                )}

                <p className="text-[#555] text-xs font-semibold uppercase tracking-wider pt-2">Mortgage</p>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
                  <div className="flex justify-between items-center px-4 py-3.5">
                    <span className="text-[#888] text-sm">Wells Fargo Balance</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#22c55e] text-xs">live</span>
                      <span className="text-white text-sm font-medium font-mono">
                        {balances ? fmt(balances.mortgage_balance) : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {profile?.notes && (
                  <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl px-4 py-3">
                    <p className="text-[#555] text-xs mb-1">Notes</p>
                    <p className="text-[#ccc] text-sm">{profile.notes}</p>
                  </div>
                )}

                {!profile && (
                  <div className="text-center py-10">
                    <p className="text-[#555] text-sm">No profile data yet.</p>
                    <button onClick={openEditProfile} className="mt-3 text-[#f0a050] text-sm font-semibold">Add Profile Info</button>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 1: Maintenance ── */}
            {activeTab === 1 && (
              <div className="px-4 pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    {(['all', 'upcoming', 'complete'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setShowMaintenanceFilter(f)}
                        className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
                          showMaintenanceFilter === f ? 'bg-[#f0a050] text-black' : 'bg-[#1a1a1a] text-[#888]'
                        }`}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                  <button onClick={openAddMaintenance} className="text-[#f0a050] text-sm font-semibold">+ Add</button>
                </div>

                {filteredMaintenance.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-[#555] text-sm">No maintenance records.</p>
                  </div>
                ) : (
                  <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
                    {filteredMaintenance.map((item, i) => (
                      <div
                        key={item.id}
                        className={`px-4 py-3.5 ${i < filteredMaintenance.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggleMaintenanceComplete(item)}
                            className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                              item.is_complete ? 'border-[#22c55e] bg-[#22c55e]' : 'border-[#333]'
                            }`}
                          >
                            {item.is_complete && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className={`text-sm font-medium ${item.is_complete ? 'text-[#555] line-through' : 'text-white'}`}>
                                {item.title}
                              </p>
                              {item.cost && <span className="text-[#888] text-xs font-mono flex-shrink-0">{fmt(item.cost)}</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {item.category && <span className="text-[#f0a050] text-xs">{item.category}</span>}
                              {item.due_date && !item.is_complete && <span className="text-[#555] text-xs">Due {fmtDate(item.due_date)}</span>}
                              {item.completed_date && item.is_complete && <span className="text-[#22c55e] text-xs">Done {fmtDate(item.completed_date)}</span>}
                              {item.contractor && <span className="text-[#555] text-xs">· {item.contractor}</span>}
                              {item.is_recurring && <span className="text-[#888] text-xs">↻ {item.recurrence_months}mo</span>}
                            </div>
                          </div>
                          <div className="flex gap-3 flex-shrink-0">
                            <button onClick={() => openEditMaintenance(item)} className="text-[#555] text-xs">Edit</button>
                            <button onClick={() => setDeleteMaintenanceId(item.id)} className="text-[#ef4444] text-xs">Del</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 2: Projects ── */}
            {activeTab === 2 && (
              <div className="px-4 pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-[#555] text-xs font-semibold uppercase tracking-wider">
                    {projects.length} project{projects.length !== 1 ? 's' : ''}
                  </p>
                  <button onClick={openAddProject} className="text-[#f0a050] text-sm font-semibold">+ Add</button>
                </div>

                {projects.length > 0 && (
                  <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl px-4 py-3 flex justify-between">
                    <div>
                      <p className="text-[#555] text-xs">Total Estimated</p>
                      <p className="text-white font-mono text-sm">{fmt(totalProjectEstimated)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#555] text-xs">Total Actual</p>
                      <p className="text-white font-mono text-sm">{fmt(totalProjectActual)}</p>
                    </div>
                  </div>
                )}

                {projects.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-[#555] text-sm">No projects yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projects.map((p) => (
                      <div key={p.id} className="bg-[#111] border border-[#1a1a1a] rounded-2xl px-4 py-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{
                                  color: STATUS_COLORS[p.status ?? 'planned'],
                                  backgroundColor: STATUS_COLORS[p.status ?? 'planned'] + '22',
                                }}
                              >
                                {p.status ?? 'planned'}
                              </span>
                              {p.funded_by && <span className="text-[#555] text-xs">{p.funded_by}</span>}
                            </div>
                            <p className="text-white text-sm font-medium">{p.title}</p>
                            {p.description && <p className="text-[#555] text-xs mt-0.5">{p.description}</p>}
                            <div className="flex gap-3 mt-1.5 flex-wrap">
                              {p.estimated_cost && <span className="text-[#888] text-xs font-mono">Est: {fmt(p.estimated_cost)}</span>}
                              {p.actual_cost && <span className="text-[#f0a050] text-xs font-mono">Actual: {fmt(p.actual_cost)}</span>}
                              {p.start_date && <span className="text-[#555] text-xs">Start: {fmtDate(p.start_date)}</span>}
                              {p.completion_date && <span className="text-[#555] text-xs">Done: {fmtDate(p.completion_date)}</span>}
                            </div>
                          </div>
                          <div className="flex gap-3 flex-shrink-0">
                            <button onClick={() => openEditProject(p)} className="text-[#555] text-xs">Edit</button>
                            <button onClick={() => setDeleteProjectId(p.id)} className="text-[#ef4444] text-xs">Del</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </PullToRefresh>

        <BottomNav active="more" />
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODALS — outside PullToRefresh                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto pb-6">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#2a2a2a]">
              <h2 className="text-white font-semibold">Edit Home Profile</h2>
              <button onClick={() => setShowEditProfile(false)} className="text-[#555] text-sm">Cancel</button>
            </div>
            <div className="px-5 pt-4 space-y-3">
              {[
                { key: 'address', label: 'Address', type: 'text' },
                { key: 'purchase_date', label: 'Purchase Date', type: 'date' },
                { key: 'purchase_price', label: 'Purchase Price', type: 'number' },
                { key: 'heloc_lender', label: 'HELOC Lender', type: 'text' },
                { key: 'heloc_credit_limit', label: 'HELOC Credit Limit', type: 'number' },
                { key: 'heloc_interest_rate', label: 'Interest Rate (%)', type: 'number' },
                { key: 'heloc_draw_period_end', label: 'Draw Period End', type: 'date' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="text-[#888] text-xs block mb-1">{label}</label>
                  <input
                    type={type}
                    value={(editProfileForm as any)[key] ?? ''}
                    onChange={(e) => setEditProfileForm({ ...editProfileForm, [key]: e.target.value })}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#f0a050]"
                  />
                </div>
              ))}
              <p className="text-[#333] text-xs">
                HELOC balance, mortgage balance, and home value pull live from Finance.
              </p>
              <div>
                <label className="text-[#888] text-xs block mb-1">Notes</label>
                <textarea
                  value={editProfileForm.notes ?? ''}
                  onChange={(e) => setEditProfileForm({ ...editProfileForm, notes: e.target.value })}
                  rows={3}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#f0a050] resize-none"
                />
              </div>
              <button
                onClick={saveProfile}
                disabled={saving}
                className="w-full py-3 rounded-xl bg-[#f0a050] text-black font-semibold text-sm disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Maintenance Modal */}
      {showAddMaintenance && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto pb-6">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#2a2a2a]">
              <h2 className="text-white font-semibold">{editMaintenance ? 'Edit Maintenance' : 'Add Maintenance'}</h2>
              <button onClick={() => setShowAddMaintenance(false)} className="text-[#555] text-sm">Cancel</button>
            </div>
            <div className="px-5 pt-4 space-y-3">
              <div>
                <label className="text-[#888] text-xs block mb-1">Title *</label>
                <input
                  type="text"
                  value={maintenanceForm.title ?? ''}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, title: e.target.value })}
                  placeholder="e.g. Replace HVAC filter"
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#f0a050]"
                />
              </div>
              <div>
                <label className="text-[#888] text-xs block mb-1">Category</label>
                <select
                  value={maintenanceForm.category ?? ''}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, category: e.target.value })}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#f0a050]"
                >
                  <option value="">Select category</option>
                  {MAINTENANCE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {[
                { key: 'due_date', label: 'Due Date', type: 'date' },
                { key: 'completed_date', label: 'Completed Date', type: 'date' },
                { key: 'cost', label: 'Cost', type: 'number' },
                { key: 'contractor', label: 'Contractor / Shop', type: 'text' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="text-[#888] text-xs block mb-1">{label}</label>
                  <input
                    type={type}
                    value={(maintenanceForm as any)[key] ?? ''}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, [key]: e.target.value })}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#f0a050]"
                  />
                </div>
              ))}
              <div>
                <label className="text-[#888] text-xs block mb-1">Notes</label>
                <textarea
                  value={maintenanceForm.notes ?? ''}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#f0a050] resize-none"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#888] text-sm">Mark Complete</span>
                <button
                  onClick={() => setMaintenanceForm({ ...maintenanceForm, is_complete: !maintenanceForm.is_complete })}
                  className={`w-11 h-6 rounded-full transition-colors ${maintenanceForm.is_complete ? 'bg-[#22c55e]' : 'bg-[#333]'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full mx-0.5 transition-transform ${maintenanceForm.is_complete ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#888] text-sm">Recurring</span>
                <button
                  onClick={() => setMaintenanceForm({ ...maintenanceForm, is_recurring: !maintenanceForm.is_recurring })}
                  className={`w-11 h-6 rounded-full transition-colors ${maintenanceForm.is_recurring ? 'bg-[#f0a050]' : 'bg-[#333]'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full mx-0.5 transition-transform ${maintenanceForm.is_recurring ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              {maintenanceForm.is_recurring && (
                <div>
                  <label className="text-[#888] text-xs block mb-1">Recurrence (months)</label>
                  <input
                    type="number"
                    value={maintenanceForm.recurrence_months ?? ''}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, recurrence_months: parseInt(e.target.value) })}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#f0a050]"
                  />
                </div>
              )}
              <button
                onClick={saveMaintenance}
                disabled={saving || !maintenanceForm.title}
                className="w-full py-3 rounded-xl bg-[#f0a050] text-black font-semibold text-sm disabled:opacity-50"
              >
                {saving ? 'Saving…' : editMaintenance ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Project Modal */}
      {showAddProject && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto pb-6">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#2a2a2a]">
              <h2 className="text-white font-semibold">{editProject ? 'Edit Project' : 'Add Project'}</h2>
              <button onClick={() => setShowAddProject(false)} className="text-[#555] text-sm">Cancel</button>
            </div>
            <div className="px-5 pt-4 space-y-3">
              <div>
                <label className="text-[#888] text-xs block mb-1">Title *</label>
                <input
                  type="text"
                  value={projectForm.title ?? ''}
                  onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                  placeholder="e.g. Kitchen remodel"
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#f0a050]"
                />
              </div>
              <div>
                <label className="text-[#888] text-xs block mb-1">Status</label>
                <div className="flex gap-2">
                  {PROJECT_STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setProjectForm({ ...projectForm, status: s })}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                        projectForm.status === s ? 'bg-[#f0a050] text-black' : 'bg-[#1a1a1a] text-[#888]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[#888] text-xs block mb-1">Description</label>
                <textarea
                  value={projectForm.description ?? ''}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  rows={2}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#f0a050] resize-none"
                />
              </div>
              {[
                { key: 'estimated_cost', label: 'Estimated Cost', type: 'number' },
                { key: 'actual_cost', label: 'Actual Cost', type: 'number' },
                { key: 'start_date', label: 'Start Date', type: 'date' },
                { key: 'completion_date', label: 'Completion Date', type: 'date' },
                { key: 'funded_by', label: 'Funded By (e.g. HELOC, Cash)', type: 'text' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="text-[#888] text-xs block mb-1">{label}</label>
                  <input
                    type={type}
                    value={(projectForm as any)[key] ?? ''}
                    onChange={(e) => setProjectForm({ ...projectForm, [key]: e.target.value })}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#f0a050]"
                  />
                </div>
              ))}
              <div>
                <label className="text-[#888] text-xs block mb-1">Notes</label>
                <textarea
                  value={projectForm.notes ?? ''}
                  onChange={(e) => setProjectForm({ ...projectForm, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#f0a050] resize-none"
                />
              </div>
              <button
                onClick={saveProject}
                disabled={saving || !projectForm.title}
                className="w-full py-3 rounded-xl bg-[#f0a050] text-black font-semibold text-sm disabled:opacity-50"
              >
                {saving ? 'Saving…' : editProject ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Maintenance Confirm */}
      {deleteMaintenanceId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm p-5">
            <p className="text-white font-semibold text-center mb-1">Delete Entry?</p>
            <p className="text-[#888] text-sm text-center mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteMaintenanceId(null)} className="flex-1 py-3 rounded-xl bg-[#1a1a1a] text-white text-sm font-semibold">Cancel</button>
              <button onClick={deleteMaintenance} disabled={saving} className="flex-1 py-3 rounded-xl bg-[#ef4444] text-white text-sm font-semibold disabled:opacity-50">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Confirm */}
      {deleteProjectId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm p-5">
            <p className="text-white font-semibold text-center mb-1">Delete Project?</p>
            <p className="text-[#888] text-sm text-center mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteProjectId(null)} className="flex-1 py-3 rounded-xl bg-[#1a1a1a] text-white text-sm font-semibold">Cancel</button>
              <button onClick={deleteProject} disabled={saving} className="flex-1 py-3 rounded-xl bg-[#ef4444] text-white text-sm font-semibold disabled:opacity-50">Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}