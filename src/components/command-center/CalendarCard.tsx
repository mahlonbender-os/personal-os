"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  calendarColor: string;
  calendarName: string;
  location: string | null;
}

function formatEventTime(dateStr: string, allDay: boolean): string {
  if (allDay) return "All day";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const isSame = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSame(d, today)) return "Today";
  if (isSame(d, tomorrow)) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function CalendarCard() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) fetchEvents();
  }, [session]);

  async function fetchEvents() {
    try {
      const res = await fetch("/api/calendar/events?days=7");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setEvents((data.events || []).slice(0, 5));
    } catch (e) {
      // Silently fail on command center
    } finally {
      setLoading(false);
    }
  }

  return (
    <Link href="/calendar" className="block">
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📅</span>
            <span className="text-sm font-semibold text-foreground">Calendar</span>
          </div>
          <span className="text-xs text-muted-foreground">Next 7 days →</span>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">
            No upcoming events
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 py-1"
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: event.calendarColor || "#4285f4" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {event.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {getDayLabel(event.start)} · {formatEventTime(event.start, event.allDay)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}