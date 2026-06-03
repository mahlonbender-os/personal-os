'use client';

import { useState, useEffect, useCallback } from 'react';
import PullToRefresh from '@/components/PullToRefresh';

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

// ── Health Card ───────────────────────────────────────────────────────────────
function HealthCard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    try {
      const c = localStorage.getItem('cc_health_v1');
      if (c) setData(JSON.parse(c));
    } catch {}
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
    <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Today's Health</span>
        {dateStr && <span className="text-[9px] text-[#333] bg-[#1a1a1a] px-2 py-0.5 rounded-full">{dateStr}</span>}
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { val: steps.toLocaleString(), label: 'Steps', color: '#60a5fa' },
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
    try {
      const c = localStorage.getItem('cc_finance_v1');
      if (c) { const p = JSON.parse(c); setCf(p.cf); setBills(p.bills); }
    } catch {}
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

  const today = new Date(); today.setHours(0,0,0,0);
  const in7 = new Date(today); in7.setDate(today.getDate() + 7);
  const dueSoon = bills.filter(b => { if (!b.due_date) return false; const d = new Date(b.due_date + 'T00:00:00'); return d <= in7; });
  const dueTotal = dueSoon.reduce((s, b) => s + Math.abs(b.amount || 0), 0);

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Cash Flow */}
      <a href="/finance?tab=budget" className="block rounded-2xl bg-[#111] border border-[#1a1a1a] p-3 active:opacity-70 transition-opacity">
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
      </a>

      {/* Bills Due */}
      <a href="/finance?tab=bills" className="block rounded-2xl bg-[#111] border border-[#1a1a1a] p-3 active:opacity-70 transition-opacity">
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
          {dueSoon.length > 3 && (
            <div className="text-[9px] text-[#f0a050]">+{dueSoon.length - 3} more →</div>
          )}
        </div>
      </a>
    </div>
  );
}

// ── Calendar Card ─────────────────────────────────────────────────────────────
function CalendarCard() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    try {
      const c = localStorage.getItem('cc_calendar_v1');
      if (c) setEvents(JSON.parse(c));
    } catch {}
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
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
    const prefix = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return e.allDay ? prefix : `${prefix} · ${time}`;
  }

  return (
    <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] overflow-hidden">
      <a href="/more" className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] active:bg-[#161616]">
        <div className="flex items-center gap-2">
          <span className="text-sm">📅</span>
          <span className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Calendar</span>
        </div>
        <span className="text-[9px] text-[#f0a050]">Next 7 days →</span>
      </a>
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
    try {
      const c = localStorage.getItem('cc_tasks_v1');
      if (c) setTasks(JSON.parse(c));
    } catch {}
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
      <a href="/tasks" className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] active:bg-[#161616]">
        <div className="flex items-center gap-2">
          <span className="text-sm">☑</span>
          <span className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Tasks</span>
        </div>
        <span className="text-[9px] text-[#f0a050]">{tasks.length} pending →</span>
      </a>
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

// ── Knox + Home Row ───────────────────────────────────────────────────────────
function KnoxHomeRow() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <a href="/more" className="block rounded-2xl bg-[#111] border border-[#1a1a1a] p-3 active:opacity-70 transition-opacity">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🐺</span>
          <span className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Knox</span>
        </div>
        <div className="text-[12px] font-bold text-[#ccc]">Siberian Husky</div>
        <div className="text-[10px] text-[#555] mb-2">{getKnoxAge()}</div>
        <div className="space-y-1">
          {['Next Vet', 'Meds Due', 'Weight'].map(k => (
            <div key={k} className="flex justify-between">
              <span className="text-[9px] text-[#444]">{k}</span>
              <span className="text-[9px] text-[#2a2a2a]">—</span>
            </div>
          ))}
        </div>
      </a>
      <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-3">
        <div className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-2">Home</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs">🌡️</span>
            <div>
              <div className="text-[10px] text-[#666]">Nest</div>
              <div className="text-[9px] text-[#333]">Not connected</div>
            </div>
          </div>
          <div className="h-px bg-[#1a1a1a]" />
          <div className="flex items-center gap-2">
            <span className="text-xs">🔔</span>
            <div>
              <div className="text-[10px] text-[#666]">Ring</div>
              <div className="text-[9px] text-[#333]">Not connected</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Spotify Card ──────────────────────────────────────────────────────────────
function SpotifyCard() {
  return (
    <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-[#1db954] flex items-center justify-center flex-shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 14.36a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 01-.277-1.215c3.809-.87 7.076-.496 9.712 1.115.294.181.387.565.207.857zm1.24-2.759a.779.779 0 01-1.071.257c-2.687-1.652-6.785-2.131-9.965-1.166a.779.779 0 01-.973-.519.78.78 0 01.519-.972c3.632-1.102 8.147-.568 11.234 1.329a.78.78 0 01.256 1.071zm.106-2.871C14.692 8.95 9.375 8.775 6.227 9.71a.935.935 0 11-.543-1.79c3.632-1.102 9.672-.888 13.48 1.322a.935.935 0 01-.354 1.724z"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium text-[#888]">Not playing</div>
        <div className="text-[9px] text-[#333]">Connect Spotify to see now playing</div>
      </div>
      <div className="w-7 h-7 rounded-full border border-[#2a2a2a] flex items-center justify-center flex-shrink-0">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="#444">
          <polygon points="3,1 9,5 3,9"/>
        </svg>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CommandCenterCards() {
  const handleRefresh = useCallback(async () => {
    await fetch('/api/sync/sheets', { method: 'POST' });
    try {
      ['cc_health_v1','cc_finance_v1','cc_calendar_v1','cc_tasks_v1','cc_weather_v1']
        .forEach(k => localStorage.removeItem(k));
    } catch {}
    window.location.reload();
  }, []);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen bg-black pb-24">
        <div className="px-4 pt-12 pb-4 space-y-3">
          <div className="flex items-start justify-between mb-1">
            <div>
              <div className="text-[11px] text-[#444] font-medium">{formatDay()}</div>
              <div className="text-[26px] font-extrabold text-white leading-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
                {getGreeting()},<br />Mahlon
              </div>
            </div>
            <WeatherWidget />
          </div>
          <HealthCard />
          <FinanceRow />
          <CalendarCard />
          <TasksCard />
          <KnoxHomeRow />
          <SpotifyCard />
        </div>
      </div>
    </PullToRefresh>
  );
}

// ── Weather Widget ────────────────────────────────────────────────────────────
function WeatherWidget() {
  const [weather, setWeather] = useState<{ temp: number; icon: string } | null>(null);

  useEffect(() => {
    try {
      const c = localStorage.getItem('cc_weather_v1');
      if (c) setWeather(JSON.parse(c));
    } catch {}
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

  if (!weather) return (
    <div className="rounded-full bg-[#111] border border-[#1a1a1a] px-3 py-1.5 text-[11px] text-[#333]">—°</div>
  );

  return (
    <div className="rounded-full bg-[#111] border border-[#1a1a1a] px-3 py-1.5 flex items-center gap-1.5">
      <span className="text-sm">{weather.icon}</span>
      <span className="text-[12px] font-semibold text-[#888]">{weather.temp}°</span>
    </div>
  );
}