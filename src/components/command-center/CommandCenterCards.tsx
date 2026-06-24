'use client';

import { useState, useEffect, useCallback } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import NewsCard from '@/components/command-center/NewsCard';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
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
  return Math.round((new Date(dateStr + 'T00:00:00').getTime() - now.getTime()) / 86400000);
}

function dueDateColor(days: number | null): string {
  if (days === null) return '#555';
  if (days < 0) return '#ef4444';
  if (days <= 14) return '#f0a050';
  if (days <= 30) return '#f59e0b';
  return '#22c55e';
}

function fmtShort(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getKnoxAge() {
  const born = new Date('2026-01-14');
  const now = new Date();
  const months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  return months < 24 ? `${months}mo` : `${Math.floor(months / 12)}y ${months % 12}mo`;
}

// Maps wttr.in weatherCode to emoji — day/night aware
function weatherIcon(code: number | string, hour: number): string {
  const c = Number(code);
  const isDay = hour >= 6 && hour < 20;
  if (c === 113) return isDay ? '☀️' : '🌙';
  if (c === 116) return isDay ? '⛅' : '☁️';
  if ([119, 122].includes(c)) return '☁️';
  if ([143, 248, 260].includes(c)) return '🌫️';
  if ([176, 263, 266, 293, 296, 353].includes(c)) return '🌦️';
  if ([185, 281, 284, 299, 302, 305, 308, 311, 314, 356, 359].includes(c)) return '🌧️';
  if ([200, 386, 389, 392, 395].includes(c)) return '⛈️';
  if ([227, 230, 323, 326, 329, 332, 335, 338, 350, 362, 365, 368, 371, 374, 377].includes(c)) return '🌨️';
  if ([317, 320].includes(c)) return '🌧️';
  return isDay ? '⛅' : '🌙';
}

// ─── Activity Rings (Apple Watch style) ──────────────────────────────────────

function ActivityRings({ calories, minutes, standHours }: { calories: number; minutes: number; standHours: number }) {
  const size = 110; const cx = 55; const cy = 55; const sw = 9;
  const rings = [
    { r: 48, value: calories, goal: 500,  color: '#ef4444' },
    { r: 34, value: minutes,  goal: 30,   color: '#22c55e' },
    { r: 20, value: standHours, goal: 12, color: '#60a5fa' },
  ];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      {rings.map(({ r, value, goal, color }) => {
        const circ = 2 * Math.PI * r;
        const pct = Math.min(Math.max(value / goal, 0), 1);
        return (
          <g key={r}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw} opacity={0.15} />
            {value > 0 && (
              <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
                strokeDasharray={`${circ} ${circ}`}
                strokeDashoffset={circ * (1 - pct)}
                strokeLinecap="round"
                transform={`rotate(-90 ${cx} ${cy})`} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Section Label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-[#333] uppercase tracking-widest px-1 pt-1">{children}</p>
  );
}

// ─── Health Card ──────────────────────────────────────────────────────────────

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

  // Fix field names — health_logs uses exercise_minutes and heart_rate_avg
  const steps = data?.steps ?? 0;
  const cal = data?.active_calories ?? 0;
  const active = data?.exercise_minutes ?? data?.activity_minutes ?? 0;
  const stand = data?.stand_hours ?? 0;
  const hr = data?.heart_rate_avg ?? data?.resting_heart_rate ?? 0;
  const stepGoal = 10000;
  const stepPct = Math.min((steps / stepGoal) * 100, 100);
  const dateStr = data?.log_date ? new Date(data.log_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

  return (
    <div onClick={() => { window.location.href = '/health'; }}
      className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4 active:opacity-70 transition-opacity cursor-pointer">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">❤️</span>
          <span className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Today's Activity</span>
        </div>
        {dateStr && <span className="text-[9px] text-[#333] bg-[#1a1a1a] px-2 py-0.5 rounded-full">{dateStr}</span>}
      </div>

      <div className="flex items-center gap-4">
        <ActivityRings calories={cal} minutes={active} standHours={stand} />
        <div className="flex-1 min-w-0">
          {/* Ring stats */}
          <div className="grid grid-cols-3 gap-1 mb-3">
            {[
              { val: cal > 0 ? cal.toLocaleString() : '—', unit: 'cal', label: 'Move', color: '#ef4444' },
              { val: active > 0 ? `${active}` : '—', unit: 'min', label: 'Exercise', color: '#22c55e' },
              { val: stand > 0 ? `${stand}` : '—', unit: 'hrs', label: 'Stand', color: '#60a5fa' },
            ].map(({ val, unit, label, color }) => (
              <div key={label} className="text-center">
                <p className="text-base font-extrabold leading-none" style={{ color }}>{val}</p>
                <p className="text-[8px] text-[#444] mt-0.5">{unit}</p>
                <p className="text-[8px] text-[#333] uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
          {/* Steps bar */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[9px] text-[#555]">{steps > 0 ? steps.toLocaleString() : '—'} steps</span>
              <span className="text-[9px] text-[#333]">10k</span>
            </div>
            <div className="h-[3px] bg-[#1a1a1a] rounded-full overflow-hidden">
              <div className="h-full bg-[#60a5fa] rounded-full transition-all" style={{ width: `${stepPct}%` }} />
            </div>
          </div>
          {/* BPM */}
          {hr > 0 && (
            <div className="flex items-center gap-1 mt-2">
              <span className="text-[#f87171] text-xs">♥</span>
              <span className="text-sm font-bold text-[#888] font-mono">{hr}</span>
              <span className="text-[9px] text-[#444]">BPM resting</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Finance Row ──────────────────────────────────────────────────────────────

function FinanceRow() {
  const [cf, setCf] = useState<any>(null);
  const [bills, setBills] = useState<any[]>([]);

  useEffect(() => {
    try { const c = localStorage.getItem('cc_finance_v1'); if (c) { const p = JSON.parse(c); setCf(p.cf); setBills(p.bills); } } catch {}
    Promise.all([
      fetch('/api/finance/cash-flow').then(r => r.json()),
      fetch('/api/finance/bills').then(r => r.json()),
    ]).then(([cfData, blData]) => {
      const monthName = new Date().toLocaleString('default', { month: 'long' });
      const cur = cfData.months?.find((m: any) => m.month?.toLowerCase().includes(monthName.toLowerCase()));
      const newCf = cur ? { income: cur.income, expenses: cur.essentials + cur.discretionary, net: cur.net } : null;
      const newBills = (blData.bills || []).slice(0, 6);
      setCf(newCf); setBills(newBills);
      try { localStorage.setItem('cc_finance_v1', JSON.stringify({ cf: newCf, bills: newBills })); } catch {}
    }).catch(() => {});
  }, []);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in7 = new Date(today); in7.setDate(today.getDate() + 7);
  const dueSoon = bills.filter(b => b.due_date && new Date(b.due_date + 'T00:00:00') <= in7);
  const dueTotal = dueSoon.reduce((s, b) => s + Math.abs(b.amount || 0), 0);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div onClick={() => { window.location.href = '/finance'; }}
        className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-3 active:opacity-70 transition-opacity cursor-pointer">
        <div className="text-[9px] font-semibold text-[#444] uppercase tracking-widest mb-2">Cash Flow</div>
        {cf ? (
          <div className="space-y-1.5">
            {[{ label: 'Income', val: cf.income, color: 'text-[#22c55e]' }, { label: 'Expenses', val: cf.expenses, color: 'text-[#ef4444]' }, { label: 'Net', val: cf.net, color: cf.net >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]' }].map(({ label, val, color }) => (
              <div key={label}>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[#555]">{label}</span>
                  <span className={`text-[11px] font-bold font-mono ${color}`}>{formatCurrency(val)}</span>
                </div>
                {label !== 'Net' && <div className="h-px bg-[#1a1a1a] mt-1.5" />}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[10px] text-[#333] pt-1">Syncing…</div>
        )}
      </div>

      <div onClick={() => { window.location.href = '/finance'; }}
        className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-3 active:opacity-70 transition-opacity cursor-pointer">
        <div className="text-[9px] font-semibold text-[#444] uppercase tracking-widest mb-2">Bills Due</div>
        <div className="text-[18px] font-extrabold text-[#f0a050] leading-none mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>{formatCurrency(dueTotal)}</div>
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

// ─── Investments Card ─────────────────────────────────────────────────────────

function InvestmentsCard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try { const c = localStorage.getItem('cc_investments_v1'); if (c) { setData(JSON.parse(c)); setLoading(false); } } catch {}
    fetch('/api/cc/investments')
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
        try { localStorage.setItem('cc_investments_v1', JSON.stringify(d)); } catch {}
      })
      .catch(() => setLoading(false));
  }, []);

  const totalValue = data?.totalValue ?? 0;
  const dailyChange = data?.dailyChange ?? null;
  const dailyChangePct = data?.dailyChangePct ?? null;
  const totalGain = data?.totalGain ?? null;
  const totalGainPct = data?.totalGainPct ?? null;
  const accounts: any[] = data?.accounts ?? [];
  const hasPrices = data?.hasPrices ?? false;

  return (
    <div onClick={() => { window.location.href = '/investments'; }}
      className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4 active:opacity-70 transition-opacity cursor-pointer">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">📈</span>
          <span className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Investments</span>
        </div>
        {hasPrices && dailyChange !== null && (
          <span className={`text-[10px] font-semibold font-mono ${dailyChange >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {dailyChange >= 0 ? '+' : ''}{formatCurrency(dailyChange)} today
          </span>
        )}
      </div>

      <p className="text-[28px] font-extrabold text-white font-mono leading-none mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>
        {loading ? '—' : totalValue > 0 ? formatCurrency(totalValue) : '—'}
      </p>

      <div className="flex items-center gap-3 mb-3">
        {hasPrices && dailyChangePct !== null && (
          <span className={`text-[10px] font-semibold ${dailyChangePct >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {dailyChangePct >= 0 ? '+' : ''}{Number(dailyChangePct).toFixed(2)}% today
          </span>
        )}
        {totalGain !== null && (
          <span className="text-[10px] text-[#555]">
            {totalGain >= 0 ? '+' : ''}{formatCurrency(totalGain)} total
            {totalGainPct !== null ? ` (${Number(totalGainPct).toFixed(1)}%)` : ''}
          </span>
        )}
      </div>

      {accounts.length > 0 && (
        <div className="border-t border-[#1a1a1a] pt-3 space-y-1.5">
          {accounts.map(acct => (
            <div key={acct.name} className="flex justify-between items-center">
              <span className="text-[10px] text-[#555]">{acct.name}</span>
              <span className="text-[10px] font-semibold font-mono text-[#888]">{formatCurrency(acct.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Calendar Card ────────────────────────────────────────────────────────────

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
    const d = new Date(e.start);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
    const prefix = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (e.allDay) return prefix;
    return `${prefix} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }

  return (
    <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] overflow-hidden">
      <div onClick={() => { window.location.href = '/calendar'; }}
        className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] active:bg-[#161616] cursor-pointer">
        <div className="flex items-center gap-2">
          <span className="text-sm">📅</span>
          <span className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Calendar</span>
        </div>
        <span className="text-[9px] text-[#f0a050]">7 days →</span>
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

// ─── Tasks Card ───────────────────────────────────────────────────────────────

function TasksCard() {
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    try { const c = localStorage.getItem('cc_tasks_v1'); if (c) setTasks(JSON.parse(c)); } catch {}
    fetch('/api/tasks/lists')
      .then(r => r.json())
      .then(async d => {
        const lists = d.lists || [];
        if (!lists.length) return;
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
        <span className="text-[9px] text-[#f0a050]">{tasks.length} pending →</span>
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

// ─── Knox Card ────────────────────────────────────────────────────────────────

function KnoxCard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    try { const c = localStorage.getItem('cc_knox_v2'); if (c) setData(JSON.parse(c)); } catch {}
    fetch('/api/knox/summary')
      .then(r => r.json())
      .then(d => {
        setData(d);
        try { localStorage.setItem('cc_knox_v2', JSON.stringify(d)); } catch {}
      })
      .catch(() => {});
  }, []);

  function statusColor(dateStr: string | null | undefined) {
    return dueDateColor(daysUntil(dateStr ?? null));
  }

  function vetLabel(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    const days = daysUntil(dateStr);
    if (days === null) return fmtShort(dateStr);
    if (days < 0) return `Overdue ${Math.abs(days)}d`;
    if (days === 0) return 'Today';
    if (days <= 7) return `In ${days}d`;
    return fmtShort(dateStr);
  }

  return (
    <div onClick={() => { window.location.href = '/knox'; }}
      className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4 active:opacity-70 transition-opacity cursor-pointer">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🐺</span>
        <span className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Knox</span>
        <span className="text-[10px] text-[#333] ml-auto">{getKnoxAge()}</span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-[#555]">Weight</span>
          <span className="text-[11px] font-bold font-mono text-[#888]">
            {data?.latestWeight ? `${parseFloat(String(data.latestWeight.weight_lbs)).toFixed(1)} lbs` : '—'}
          </span>
        </div>
        <div className="h-px bg-[#141414]" />
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-[#555]">Next Vet</span>
          <span className="text-[11px] font-bold font-mono" style={{ color: statusColor(data?.nextVetDate) }}>
            {vetLabel(data?.nextVetDate)}
          </span>
        </div>
        <div className="h-px bg-[#141414]" />
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-[#555]">Next Vaccine</span>
          <div className="text-right">
            {data?.nextVaccine?.next_due_date ? (
              <>
                <span className="text-[11px] font-bold font-mono" style={{ color: statusColor(data.nextVaccine.next_due_date) }}>
                  {vetLabel(data.nextVaccine.next_due_date)}
                </span>
                <span className="text-[9px] text-[#444] block">{data.nextVaccine.vaccine_name}</span>
              </>
            ) : <span className="text-[11px] text-[#2a2a2a]">—</span>}
          </div>
        </div>
        <div className="h-px bg-[#141414]" />
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-[#555]">Next Medication</span>
          <div className="text-right">
            {data?.nextMedication?.next_due_date ? (
              <>
                <span className="text-[11px] font-bold font-mono" style={{ color: statusColor(data.nextMedication.next_due_date) }}>
                  {vetLabel(data.nextMedication.next_due_date)}
                </span>
                <span className="text-[9px] text-[#444] block">{data.nextMedication.medication_name}</span>
              </>
            ) : <span className="text-[11px] text-[#2a2a2a]">—</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Vehicle Card ─────────────────────────────────────────────────────────────

function VehicleCard() {
  const [vehicle, setVehicle] = useState<any>(null);
  const [lastService, setLastService] = useState<any>(null);

  useEffect(() => {
    try { const c = localStorage.getItem('cc_vehicle_v1'); if (c) { const p = JSON.parse(c); setVehicle(p.v); setLastService(p.s); } } catch {}
    Promise.all([
      fetch('/api/vehicle/info').then(r => r.json()).catch(() => ({})),
      fetch('/api/vehicle/maintenance').then(r => r.json()).catch(() => ({})),
    ]).then(([info, maint]) => {
      const v = info.vehicle || info || null;
      const records: any[] = maint.records || maint.maintenance || maint || [];
      const s = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] || null;
      setVehicle(v); setLastService(s);
      try { localStorage.setItem('cc_vehicle_v1', JSON.stringify({ v, s })); } catch {}
    });
  }, []);

  function daysLabel(dateStr: string | null | undefined): string {
    const days = daysUntil(dateStr ?? null);
    if (!dateStr || days === null) return '—';
    if (days < 0) return `Overdue ${Math.abs(days)}d`;
    if (days === 0) return 'Today';
    if (days <= 90) return `${days} days`;
    return fmtShort(dateStr);
  }

  const inspDays = daysUntil(vehicle?.inspection_expires);
  const regDays = daysUntil(vehicle?.registration_expires);

  return (
    <div onClick={() => { window.location.href = '/vehicle'; }}
      className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4 active:opacity-70 transition-opacity cursor-pointer">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">🚗</span>
        <span className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Vehicle</span>
        {vehicle?.year && <span className="text-[10px] text-[#333] ml-auto">{vehicle.year} {vehicle.make} {vehicle.model}</span>}
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-[#555]">Inspection</span>
          <span className="text-[11px] font-bold font-mono" style={{ color: dueDateColor(inspDays) }}>{daysLabel(vehicle?.inspection_expires)}</span>
        </div>
        <div className="h-px bg-[#141414]" />
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-[#555]">Registration</span>
          <span className="text-[11px] font-bold font-mono" style={{ color: dueDateColor(regDays) }}>{daysLabel(vehicle?.registration_expires)}</span>
        </div>
        {lastService && (
          <>
            <div className="h-px bg-[#141414]" />
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-[#555]">Last Service</span>
              <div className="text-right">
                <span className="text-[11px] font-bold font-mono text-[#888]">{fmtShort(lastService.date)}</span>
                {lastService.service_type && <span className="text-[9px] text-[#444] block">{lastService.service_type}</span>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Weather Widget ───────────────────────────────────────────────────────────

function WeatherWidget() {
  const [weather, setWeather] = useState<{ temp: number; icon: string } | null>(null);

  useEffect(() => {
    try { const c = localStorage.getItem('cc_weather_v1'); if (c) setWeather(JSON.parse(c)); } catch {}
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(pos => {
      fetch(`https://wttr.in/${pos.coords.latitude},${pos.coords.longitude}?format=j1`)
        .then(r => r.json())
        .then(d => {
          const cond = d.current_condition?.[0];
          if (!cond) return;
          const code = parseInt(cond.weatherCode || '113');
          const hour = new Date().getHours();
          const w = { temp: Math.round(parseFloat(cond.temp_F)), icon: weatherIcon(code, hour) };
          setWeather(w);
          try { localStorage.setItem('cc_weather_v1', JSON.stringify(w)); } catch {}
        })
        .catch(() => {});
    });
  }, []);

  if (!weather) return <div className="rounded-full bg-[#111] border border-[#1a1a1a] px-3 py-1.5 text-[11px] text-[#333]">—°</div>;
  return (
    <div className="rounded-full bg-[#111] border border-[#1a1a1a] px-3 py-1.5 flex items-center gap-1.5">
      <span className="text-sm">{weather.icon}</span>
      <span className="text-[12px] font-semibold text-[#888]">{weather.temp}°</span>
    </div>
  );
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

function QuickActions({ onSync }: { onSync: () => void }) {
  const actions = [
    { label: '+ Expense', action: () => { window.location.href = '/finance'; } },
    { label: '🐺 Weight', action: () => { window.location.href = '/knox'; } },
    { label: '🏋 Training', action: () => { window.location.href = '/knox'; } },
    { label: '🔄 Sync', action: onSync },
  ];
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
      {actions.map(({ label, action }) => (
        <button key={label} onClick={() => { if (navigator.vibrate) navigator.vibrate(8); action(); }}
          className="flex-shrink-0 text-[11px] font-semibold text-[#f0a050] border border-[#f0a050]/30 bg-[#f0a050]/5 px-3 py-1.5 rounded-full active:bg-[#f0a050]/15 transition-colors">
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CommandCenterCards() {
  const [syncing, setSyncing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setSyncing(true);
    await fetch('/api/sync/sheets', { method: 'POST' });
    try {
      ['cc_health_v1','cc_finance_v1','cc_calendar_v1','cc_tasks_v1',
       'cc_weather_v1','cc_knox_v2','cc_investments_v1','cc_vehicle_v1']
        .forEach(k => localStorage.removeItem(k));
    } catch {}
    setSyncing(false);
    window.location.reload();
  }, []);

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-black border-b border-[#1a1a1a] pt-14 px-4 pb-3 z-30">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[11px] text-[#444] font-medium">{formatDay()}</div>
            <div className="text-[22px] font-extrabold text-white leading-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
              {getGreeting()}, Mahlon
            </div>
            {syncing && (
              <div className="flex items-center gap-1.5 text-[10px] text-[#f0a050] mt-0.5 font-mono">
                <div className="w-2 h-2 border border-[#f0a050] border-t-transparent rounded-full animate-spin" />
                Syncing…
              </div>
            )}
          </div>
          <WeatherWidget />
        </div>
        <QuickActions onSync={handleRefresh} />
      </div>

      {/* Scrollable cards */}
      <div className="flex-1 overflow-y-auto">
        <PullToRefresh onRefresh={handleRefresh}>
          <div className="px-4 pt-4 pb-24 space-y-3">
            <SectionLabel>Health</SectionLabel>
            <HealthCard />

            <SectionLabel>Finance</SectionLabel>
            <FinanceRow />
            <InvestmentsCard />

            <SectionLabel>My Life</SectionLabel>
            <CalendarCard />
            <TasksCard />
            <KnoxCard />
            <VehicleCard />

            <SectionLabel>News</SectionLabel>
            <NewsCard />
          </div>
        </PullToRefresh>
      </div>
    </div>
  );
}