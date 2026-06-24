'use client';

import { useState, useEffect, useCallback } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import NewsCard from '@/components/command-center/NewsCard';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
}

function getKnoxAge() {
  const born = new Date('2026-01-14');
  const now = new Date();
  const months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (months < 1) return 'newborn';
  if (months < 24) return `${months} month${months !== 1 ? 's' : ''} old`;
  const years = Math.floor(months / 12);
  return `${years} year${years !== 1 ? 's' : ''} old`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDay() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

function dueDateColor(days: number | null): string {
  if (days === null) return '#555';
  if (days < 0) return '#ef4444';
  if (days <= 14) return '#f0a050';
  if (days <= 30) return '#f59e0b';
  return '#22c55e';
}

function fmtShortDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Health Card ───────────────────────────────────────────────────────────────
function HealthCard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    try { const c = localStorage.getItem('cc_health_v1'); if (c) setData(JSON.parse(c)); } catch {}
    fetch('/api/health/latest')
      .then(r => r.json())
      .then(d => {
        setData(d.log || null);
        try { localStorage.setItem('cc_health_v1', JSON.stringify(d.log || null)); } catch {}
      })
      .catch(() => {});
  }, []);

  const steps = data?.steps ?? 0;
  const hr = data?.resting_heart_rate ?? 0;
  const active = data?.activity_minutes ?? 0;
  const cal = data?.active_calories ?? 0;
  const stepGoal = 10000;
  const stepPct = Math.min((steps / stepGoal) * 100, 100);
  const dateStr = data?.log_date ? new Date(data.log_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

  return (
    <div onClick={() => { window.location.href = '/health'; }}
      className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4 active:opacity-70 transition-opacity cursor-pointer">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">❤️</span>
          <span className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Today's Health</span>
        </div>
        {dateStr && <span className="text-[9px] text-[#333] bg-[#1a1a1a] px-2 py-0.5 rounded-full">{dateStr}</span>}
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { val: steps > 0 ? steps.toLocaleString() : '—', label: 'Steps', color: '#60a5fa' },
          { val: hr > 0 ? `${hr}` : '—', label: 'BPM', color: '#f87171' },
          { val: active > 0 ? `${active}m` : '—', label: 'Active', color: '#f0a050' },
          { val: cal > 0 ? cal.toLocaleString() : '—', label: 'Cal', color: '#fb923c' },
        ].map(({ val, label, color }) => (
          <div key={label}>
            <div className="text-lg font-extrabold leading-none" style={{ color, fontFamily: "'Syne', sans-serif" }}>{val}</div>
            <div className="text-[9px] text-[#444] mt-1">{label}</div>
          </div>
        ))}
      </div>
      {steps > 0 && (
        <div className="mt-3">
          <div className="h-[3px] bg-[#1a1a1a] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#60a5fa] transition-all" style={{ width: `${stepPct}%` }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[8px] text-[#333]">Steps goal</span>
            <span className="text-[8px] text-[#444] font-mono">{steps.toLocaleString()} / {stepGoal.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Finance Row ───────────────────────────────────────────────────────────────
function FinanceRow() {
  const [cf, setCf] = useState<any>(null);
  const [bills, setBills] = useState<any[]>([]);

  useEffect(() => {
    try { const c = localStorage.getItem('cc_finance_v1'); if (c) { const p = JSON.parse(c); setCf(p.cf); setBills(p.bills); } } catch {}
    Promise.all([
      fetch('/api/finance/cash-flow').then(r => r.json()),
      fetch('/api/finance/bills').then(r => r.json()),
    ]).then(([cfData, blData]) => {
      const now = new Date();
      const monthName = now.toLocaleString('default', { month: 'long' });
      const cur = cfData.months?.find((m: any) => m.month?.toLowerCase().includes(monthName.toLowerCase()));
      const newCf = cur ? { income: cur.income, expenses: cur.essentials + cur.discretionary, net: cur.net } : null;
      const newBills = (blData.bills || []).slice(0, 6);
      setCf(newCf);
      setBills(newBills);
      try { localStorage.setItem('cc_finance_v1', JSON.stringify({ cf: newCf, bills: newBills })); } catch {}
    }).catch(() => {});
  }, []);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in7 = new Date(today); in7.setDate(today.getDate() + 7);
  const dueSoon = bills.filter(b => { if (!b.due_date) return false; return new Date(b.due_date + 'T00:00:00') <= in7; });
  const dueTotal = dueSoon.reduce((s, b) => s + Math.abs(b.amount || 0), 0);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div onClick={() => { window.location.href = '/finance'; }}
        className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-3 active:opacity-70 transition-opacity cursor-pointer">
        <div className="text-[9px] font-semibold text-[#444] uppercase tracking-widest mb-2">Cash Flow</div>
        {cf ? (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-[#555]">Income</span>
              <span className="text-[11px] font-bold text-[#22c55e] font-mono">{formatCurrency(cf.income)}</span>
            </div>
            <div className="h-px bg-[#1a1a1a]" />
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-[#555]">Expenses</span>
              <span className="text-[11px] font-bold text-[#ef4444] font-mono">{formatCurrency(cf.expenses)}</span>
            </div>
            <div className="h-px bg-[#1a1a1a]" />
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-[#555]">Net</span>
              <span className={`text-[11px] font-bold font-mono ${cf.net >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{formatCurrency(cf.net)}</span>
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-[#333]">Pull to sync</div>
        )}
      </div>

      <div onClick={() => { window.location.href = '/finance'; }}
        className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-3 active:opacity-70 transition-opacity cursor-pointer">
        <div className="text-[9px] font-semibold text-[#444] uppercase tracking-widest mb-2">Bills Due</div>
        <div className="text-[18px] font-extrabold text-[#f0a050] leading-none" style={{ fontFamily: "'Syne', sans-serif" }}>
          {formatCurrency(dueTotal)}
        </div>
        <div className="text-[9px] text-[#444] mb-2">{dueSoon.length} bills · 7 days</div>
        <div className="space-y-1">
          {dueSoon.slice(0, 3).map((b, i) => (
            <div key={i} className="flex justify-between items-center">
              <span className="text-[9px] text-[#555] truncate">{b.name}</span>
              <span className="text-[9px] text-[#444] font-mono ml-1 flex-shrink-0">{formatCurrency(b.amount)}</span>
            </div>
          ))}
          {dueSoon.length > 3 && <div className="text-[9px] text-[#f0a050]">+{dueSoon.length - 3} more →</div>}
        </div>
      </div>
    </div>
  );
}

// ── Investments Card ──────────────────────────────────────────────────────────
function InvestmentsCard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    try { const c = localStorage.getItem('cc_investments_v1'); if (c) setData(JSON.parse(c)); } catch {}
    fetch('/api/finance/investments')
      .then(r => r.json())
      .then(d => {
        setData(d);
        try { localStorage.setItem('cc_investments_v1', JSON.stringify(d)); } catch {}
      })
      .catch(() => {});
  }, []);

  const positions: any[] = data?.positions || [];
  const cash: any[] = data?.cash || [];

  // Handle multiple possible response shapes defensively
  const positionsValue = positions.reduce((s: number, p: any) => {
    const mv = parseFloat(String(p.market_value ?? 0));
    const computed = parseFloat(String(p.shares ?? 0)) * parseFloat(String(p.current_price ?? p.avg_cost ?? 0));
    return s + (mv || computed);
  }, 0);
  const cashValue = cash.reduce((s: number, c: any) => s + parseFloat(String(c.cash_balance ?? 0)), 0);
  const totalValue = parseFloat(String(data?.totalValue ?? data?.total_value ?? 0)) || (positionsValue + cashValue);
  const dailyChange = data?.dailyChange ?? data?.daily_change ?? data?.dailyGainLoss ?? null;
  const dailyChangePct = data?.dailyChangePct ?? data?.daily_change_pct ?? null;
  const totalGain = data?.totalGain ?? data?.total_gain ?? null;
  const totalGainPct = data?.totalGainPct ?? data?.total_gain_pct ?? null;

  // Group positions by account
  const byAccount: Record<string, number> = {};
  positions.forEach((p: any) => {
    const mv = parseFloat(String(p.market_value ?? 0)) || parseFloat(String(p.shares ?? 0)) * parseFloat(String(p.current_price ?? p.avg_cost ?? 0));
    byAccount[p.account] = (byAccount[p.account] || 0) + mv;
  });
  cash.forEach((c: any) => {
    byAccount[c.account] = (byAccount[c.account] || 0) + parseFloat(String(c.cash_balance ?? 0));
  });

  return (
    <div onClick={() => { window.location.href = '/investments'; }}
      className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4 active:opacity-70 transition-opacity cursor-pointer">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">📈</span>
          <span className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Investments</span>
        </div>
        {dailyChange !== null && (
          <span className={`text-[10px] font-semibold font-mono ${dailyChange >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {dailyChange >= 0 ? '+' : ''}{formatCurrency(dailyChange)} today
          </span>
        )}
      </div>

      <div className="text-[28px] font-extrabold text-white font-mono leading-none mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>
        {totalValue > 0 ? formatCurrency(totalValue) : '—'}
      </div>

      <div className="flex items-center gap-3 mb-3">
        {dailyChangePct !== null && (
          <span className={`text-[10px] font-semibold ${dailyChangePct >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {dailyChangePct >= 0 ? '+' : ''}{Number(dailyChangePct).toFixed(2)}% today
          </span>
        )}
        {totalGain !== null && (
          <span className={`text-[10px] text-[#555]`}>
            {totalGain >= 0 ? '+' : ''}{formatCurrency(totalGain)} total
            {totalGainPct !== null ? ` (${Number(totalGainPct).toFixed(1)}%)` : ''}
          </span>
        )}
      </div>

      {Object.keys(byAccount).length > 0 && (
        <div className="border-t border-[#1a1a1a] pt-3 space-y-1.5">
          {Object.entries(byAccount).map(([account, value]) => (
            <div key={account} className="flex justify-between items-center">
              <span className="text-[10px] text-[#555]">{account}</span>
              <span className="text-[10px] font-semibold font-mono text-[#888]">{formatCurrency(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Calendar Card ─────────────────────────────────────────────────────────────
function CalendarCard() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    try { const c = localStorage.getItem('cc_calendar_v1'); if (c) setEvents(JSON.parse(c)); } catch {}
    fetch('/api/calendar/events?days=7')
      .then(r => r.json())
      .then(d => {
        const evts = (d.events || []).slice(0, 5);
        setEvents(evts);
        try { localStorage.setItem('cc_calendar_v1', JSON.stringify(evts)); } catch {}
      })
      .catch(() => {});
  }, []);

  function fmtEventTime(e: any) {
    if (e.allDay) return 'All day';
    const d = new Date(e.start);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
    const prefix = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return e.allDay ? prefix : `${prefix} · ${time}`;
  }

  return (
    <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] overflow-hidden">
      <div onClick={() => { window.location.href = '/calendar'; }}
        className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] active:bg-[#161616] cursor-pointer">
        <div className="flex items-center gap-2">
          <span className="text-sm">📅</span>
          <span className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Calendar</span>
        </div>
        <span className="text-[9px] text-[#f0a050]">Next 7 days →</span>
      </div>
      {events.length === 0 ? (
        <div className="px-4 py-4 text-[11px] text-[#333]">No upcoming events</div>
      ) : (
        <div className="divide-y divide-[#141414]">
          {events.map((e, i) => (
            <div key={i} className="flex items-center px-4 py-2.5 gap-3">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color || '#818cf8' }} />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-[#ccc] truncate">{e.title}</div>
                <div className="text-[9px] text-[#444] mt-0.5">{fmtEventTime(e)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tasks Card ────────────────────────────────────────────────────────────────
function TasksCard() {
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    try { const c = localStorage.getItem('cc_tasks_v1'); if (c) setTasks(JSON.parse(c)); } catch {}
    fetch('/api/tasks/lists')
      .then(r => r.json())
      .then(async d => {
        const lists = d.lists || [];
        if (lists.length === 0) return;
        const preferred = lists.find((l: any) => l.title === 'Personal OS');
        const listId = (preferred || lists[0]).id;
        const res = await fetch(`/api/tasks/items?listId=${listId}&showCompleted=false`);
        const data = await res.json();
        const t = (data.tasks || []).slice(0, 4);
        setTasks(t);
        try { localStorage.setItem('cc_tasks_v1', JSON.stringify(t)); } catch {}
      })
      .catch(() => {});
  }, []);

  return (
    <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] overflow-hidden">
      <div onClick={() => { window.location.href = '/tasks'; }}
        className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] active:bg-[#161616] cursor-pointer">
        <div className="flex items-center gap-2">
          <span className="text-sm">☑</span>
          <span className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Tasks</span>
        </div>
        <span className="text-[9px] text-[#f0a050]">+{tasks.length} pending →</span>
      </div>
      {tasks.length === 0 ? (
        <div className="px-4 py-4 text-[11px] text-[#333]">No pending tasks</div>
      ) : (
        <div className="divide-y divide-[#141414]">
          {tasks.map((t, i) => (
            <div key={i} className="flex items-center px-4 py-2.5 gap-3">
              <div className="w-4 h-4 rounded-full border border-[#2a2a2a] flex-shrink-0" />
              <span className="text-[11px] text-[#888] truncate">{t.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Knox Card ─────────────────────────────────────────────────────────────────
function KnoxCard() {
  const [knox, setKnox] = useState<any>(null);
  const [nextVaccine, setNextVaccine] = useState<any>(null);

  useEffect(() => {
    try { const c = localStorage.getItem('cc_knox_v1'); if (c) setKnox(JSON.parse(c)); } catch {}
    try { const c = localStorage.getItem('cc_knox_vacc_v1'); if (c) setNextVaccine(JSON.parse(c)); } catch {}

    fetch('/api/knox/summary')
      .then(r => r.json())
      .then(d => {
        setKnox(d);
        try { localStorage.setItem('cc_knox_v1', JSON.stringify(d)); } catch {}
      })
      .catch(() => {});

    // Fetch vaccinations to find next due
    fetch('/api/knox/vaccinations')
      .then(r => r.json())
      .then(d => {
        const vaccs: any[] = d.vaccinations || [];
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const upcoming = vaccs
          .filter(v => v.next_due_date)
          .sort((a, b) => new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime());
        const next = upcoming[0] || null;
        setNextVaccine(next);
        try { localStorage.setItem('cc_knox_vacc_v1', JSON.stringify(next)); } catch {}
      })
      .catch(() => {});
  }, []);

  const nextVet = knox?.nextVet;
  const latestWeight = knox?.latestWeight;
  const nextMed = knox?.medications?.[0];

  function statusColor(dateStr: string | null | undefined) {
    const d = daysUntil(dateStr ?? null);
    return dueDateColor(d);
  }

  function fmtTime(t: string) {
    const [h, m] = t.split(':');
    const hr = parseInt(h);
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
  }

  return (
    <div onClick={() => { window.location.href = '/knox'; }}
      className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4 active:opacity-70 transition-opacity cursor-pointer w-full">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">🐺</span>
        <span className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Knox</span>
        <span className="text-[10px] text-[#333] ml-auto font-mono">{getKnoxAge()}</span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-[#555]">Weight</span>
          <span className="text-[11px] font-bold font-mono text-[#888]">
            {latestWeight ? `${latestWeight.weight_lbs} lbs` : '—'}
          </span>
        </div>
        <div className="h-px bg-[#141414]" />
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-[#555]">Next Vet Visit</span>
          {nextVet?.next_visit_date ? (
            <span className="text-[11px] font-bold font-mono" style={{ color: statusColor(nextVet.next_visit_date) }}>
              {fmtShortDate(nextVet.next_visit_date)}{nextVet.next_visit_time ? ` · ${fmtTime(nextVet.next_visit_time)}` : ''}
            </span>
          ) : (
            <span className="text-[11px] text-[#2a2a2a]">—</span>
          )}
        </div>
        <div className="h-px bg-[#141414]" />
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-[#555]">Next Vaccine</span>
          {nextVaccine?.next_due_date ? (
            <div className="text-right">
              <span className="text-[11px] font-bold font-mono" style={{ color: statusColor(nextVaccine.next_due_date) }}>
                {fmtShortDate(nextVaccine.next_due_date)}
              </span>
              <span className="text-[9px] text-[#444] block">{nextVaccine.vaccine_name}</span>
            </div>
          ) : (
            <span className="text-[11px] text-[#2a2a2a]">—</span>
          )}
        </div>
        <div className="h-px bg-[#141414]" />
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-[#555]">Next Medication</span>
          {nextMed?.next_due_date ? (
            <span className="text-[11px] font-bold font-mono" style={{ color: statusColor(nextMed.next_due_date) }}>
              {fmtShortDate(nextMed.next_due_date)}
            </span>
          ) : (
            <span className="text-[11px] text-[#2a2a2a]">—</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Vehicle Card ──────────────────────────────────────────────────────────────
function VehicleCard() {
  const [vehicle, setVehicle] = useState<any>(null);
  const [nextService, setNextService] = useState<any>(null);

  useEffect(() => {
    try { const c = localStorage.getItem('cc_vehicle_v1'); if (c) { const p = JSON.parse(c); setVehicle(p.vehicle); setNextService(p.nextService); } } catch {}
    Promise.all([
      fetch('/api/vehicle/info').then(r => r.json()).catch(() => ({})),
      fetch('/api/vehicle/maintenance').then(r => r.json()).catch(() => ({})),
    ]).then(([infoData, maintData]) => {
      const v = infoData.vehicle || infoData || null;
      const records: any[] = maintData.records || maintData.maintenance || maintData || [];
      // Find next upcoming service (most recent past service to estimate next due)
      const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const ns = sorted[0] || null;
      setVehicle(v);
      setNextService(ns);
      try { localStorage.setItem('cc_vehicle_v1', JSON.stringify({ vehicle: v, nextService: ns })); } catch {}
    });
  }, []);

  function statusLabel(days: number | null, dateStr: string | null | undefined): string {
    if (!dateStr || days === null) return '—';
    if (days < 0) return `Overdue ${Math.abs(days)}d`;
    if (days === 0) return 'Today';
    if (days <= 90) return `${days} days`;
    return fmtShortDate(dateStr);
  }

  const inspDays = daysUntil(vehicle?.inspection_expires);
  const regDays = daysUntil(vehicle?.registration_expires);

  return (
    <div onClick={() => { window.location.href = '/vehicle'; }}
      className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4 active:opacity-70 transition-opacity cursor-pointer">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">🚗</span>
        <span className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Vehicle</span>
        {vehicle?.year && (
          <span className="text-[10px] text-[#333] ml-auto">{vehicle.year} {vehicle.make} {vehicle.model}</span>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-[#555]">Inspection</span>
          <span className="text-[11px] font-bold font-mono" style={{ color: dueDateColor(inspDays) }}>
            {statusLabel(inspDays, vehicle?.inspection_expires)}
          </span>
        </div>
        <div className="h-px bg-[#141414]" />
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-[#555]">Registration</span>
          <span className="text-[11px] font-bold font-mono" style={{ color: dueDateColor(regDays) }}>
            {statusLabel(regDays, vehicle?.registration_expires)}
          </span>
        </div>
        {nextService && (
          <>
            <div className="h-px bg-[#141414]" />
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-[#555]">Last Service</span>
              <div className="text-right">
                <span className="text-[11px] font-bold font-mono text-[#888]">{fmtShortDate(nextService.date)}</span>
                {nextService.service_type && <span className="text-[9px] text-[#444] block">{nextService.service_type}</span>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Weather Widget ────────────────────────────────────────────────────────────
function WeatherWidget() {
  const [weather, setWeather] = useState<{ temp: number; icon: string } | null>(null);

  useEffect(() => {
    try { const c = localStorage.getItem('cc_weather_v1'); if (c) setWeather(JSON.parse(c)); } catch {}
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(pos => {
        fetch(`https://wttr.in/${pos.coords.latitude},${pos.coords.longitude}?format=j1`)
          .then(r => r.json())
          .then(d => {
            const w = { temp: Math.round(d.current_condition[0].temp_F), icon: '⛅' };
            setWeather(w);
            try { localStorage.setItem('cc_weather_v1', JSON.stringify(w)); } catch {}
          })
          .catch(() => {});
      });
    }
  }, []);

  if (!weather) return <div className="rounded-full bg-[#111] border border-[#1a1a1a] px-3 py-1.5 text-[11px] text-[#333]">—°</div>;

  return (
    <div className="rounded-full bg-[#111] border border-[#1a1a1a] px-3 py-1.5 flex items-center gap-1.5">
      <span className="text-sm">{weather.icon}</span>
      <span className="text-[12px] font-semibold text-[#888]">{weather.temp}°</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CommandCenterCards() {
  const [syncing, setSyncing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setSyncing(true);
    await fetch('/api/sync/sheets', { method: 'POST' });
    try {
      ['cc_health_v1','cc_finance_v1','cc_calendar_v1','cc_tasks_v1',
       'cc_weather_v1','cc_knox_v1','cc_knox_vacc_v1','cc_investments_v1','cc_vehicle_v1']
        .forEach(k => localStorage.removeItem(k));
    } catch {}
    setSyncing(false);
    window.location.reload();
  }, []);

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-black border-b border-[#1a1a1a] pt-14 px-4 pb-3 z-30">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[#444] font-medium">{formatDay()}</div>
            <div className="text-[22px] font-extrabold text-white leading-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
              {getGreeting()}, Mahlon
            </div>
            {syncing && (
              <div className="flex items-center gap-1.5 text-[10px] text-[#f0a050] mt-0.5 font-mono">
                <div className="w-2 h-2 border border-[#f0a050] border-t-transparent rounded-full animate-spin" />
                Processing Sheets…
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <WeatherWidget />
            <button
              onClick={() => { if (navigator.vibrate) navigator.vibrate(8); handleRefresh(); }}
              disabled={syncing}
              className="text-sm font-semibold text-[#f0a050] active:opacity-70 transition-opacity px-2 py-1 disabled:opacity-40"
            >
              Sync
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable cards */}
      <div className="flex-1 overflow-y-auto">
        <PullToRefresh onRefresh={handleRefresh}>
          <div className="px-4 pt-4 pb-24 space-y-3">
            <HealthCard />
            <FinanceRow />
            <InvestmentsCard />
            <CalendarCard />
            <TasksCard />
            <KnoxCard />
            <VehicleCard />
            <NewsCard />
          </div>
        </PullToRefresh>
      </div>
    </div>
  );
}