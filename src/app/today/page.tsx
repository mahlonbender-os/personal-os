'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PullToRefresh from '@/components/PullToRefresh';
import { freshFetch } from '@/lib/freshFetch';

interface CalendarEvent {
  id?: string;
  title: string;
  start: string;
  allDay?: boolean;
  color?: string;
}

interface TaskItem {
  id: string;
  title: string;
  due?: string;
  status?: string;
}

function formatWhen(start: string, allDay?: boolean): string {
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return start;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - now.getTime()) / 86400000);
  const label = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  });
  if (allDay) return label;
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });
  return `${label} · ${time}`;
}

export default function TodayPage() {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (fresh = false) => {
    try {
      const [eventRes, listRes] = await Promise.all([
        freshFetch('/api/calendar/events?days=7', { fresh }),
        freshFetch('/api/tasks/lists', { fresh }),
      ]);
      const eventJson = await eventRes.json();
      setEvents(Array.isArray(eventJson.events) ? eventJson.events.slice(0, 8) : []);

      const listJson = await listRes.json();
      const lists = Array.isArray(listJson.lists) ? listJson.lists : [];
      if (!lists.length) {
        setTasks([]);
        return;
      }
      const preferred = lists.find((list: { title?: string }) => list.title === 'Personal OS') || lists[0];
      const taskRes = await freshFetch(`/api/tasks/items?listId=${preferred.id}&showCompleted=false`, { fresh });
      const taskJson = await taskRes.json();
      setTasks(Array.isArray(taskJson.tasks) ? taskJson.tasks.slice(0, 8) : []);
    } catch (err) {
      console.error('Today load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  });

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="sticky top-0 z-30 bg-black border-b border-[#1a1a1a] px-4 pt-14 pb-3">
        <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, system-ui, sans-serif' }}>Today</h1>
        {refreshing ? (
          <p className="flex items-center gap-1.5 text-[11px] text-[#f0a050] mt-0.5">
            <span className="w-2.5 h-2.5 border-2 border-[#f0a050] border-t-transparent rounded-full animate-spin" />
            Refreshing…
          </p>
        ) : (
          <p className="text-[11px] text-[#555] mt-0.5">{todayLabel}</p>
        )}
      </div>
      <PullToRefresh onRefresh={async () => {
        setRefreshing(true);
        try { await load(true); }
        finally { setRefreshing(false); }
      }}>
        <div className="px-4 pt-4 space-y-4">
          <section className="rounded-2xl bg-[#111] border border-[#1a1a1a] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
              <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Calendar</p>
              <button type="button" onClick={() => router.push('/calendar')} className="text-[11px] font-semibold text-[#f0a050]">Open</button>
            </div>
            {loading && events.length === 0 ? (
              <p className="px-4 py-4 text-[11px] text-[#333]">Loading…</p>
            ) : events.length === 0 ? (
              <p className="px-4 py-4 text-[11px] text-[#333]">Nothing on the calendar this week</p>
            ) : (
              <div className="divide-y divide-[#141414]">
                {events.map((event, index) => (
                  <div key={event.id || index} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: event.color || '#f0a050' }} />
                    <div className="min-w-0">
                      <p className="text-[13px] text-[#ddd] truncate">{event.title}</p>
                      <p className="text-[10px] text-[#555]">{formatWhen(event.start, event.allDay)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-[#111] border border-[#1a1a1a] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
              <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Tasks</p>
              <button type="button" onClick={() => router.push('/tasks')} className="text-[11px] font-semibold text-[#f0a050]">Open</button>
            </div>
            {loading && tasks.length === 0 ? (
              <p className="px-4 py-4 text-[11px] text-[#333]">Loading…</p>
            ) : tasks.length === 0 ? (
              <p className="px-4 py-4 text-[11px] text-[#333]">No open tasks</p>
            ) : (
              <div className="divide-y divide-[#141414]">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-4 h-4 rounded-full border border-[#2a2a2a] flex-shrink-0" />
                    <p className="text-[13px] text-[#ccc] truncate">{task.title}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </PullToRefresh>
    </div>
  );
}
