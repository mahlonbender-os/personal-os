"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import LocationAutocomplete from '@/components/LocationAutocomplete';
import PullToRefresh from '@/components/PullToRefresh';

interface CalendarEvent {
  id: string;
  calendarId: string;
  calendarName: string;
  calendarColor: string;
  title: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string;
  allDay: boolean;
  status: string;
  htmlLink: string;
}

function formatTime(dateStr: string, allDay: boolean): string {
  if (allDay) return "All day";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const checkSame = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (checkSame(d, today)) return "Today";
  if (checkSame(d, tomorrow)) return "Tomorrow";

  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function getDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 5) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      options.push(`${hh}:${mm}`);
    }
  }

  function toDisplay(val: string): string {
    if (!val) return '';
    const [h, m] = val.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm text-blue-500 bg-transparent outline-none text-right"
    >
      {!value && <option value="">Select</option>}
      {options.map((opt) => (
        <option key={opt} value={opt}>{toDisplay(opt)}</option>
      ))}
    </select>
  );
}

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState(14);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    location: "",
    date: "",
    startTime: "",
    endTime: "",
    allDay: false,
    calendarId: "primary",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchEvents();
    }
  }, [session, selectedDays]);

  async function fetchEvents() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar/events?days=" + selectedDays);
      if (!res.ok) throw new Error("Failed to fetch events");
      const data = await res.json();
      setEvents(data.events || []);
      setCalendars(data.calendars || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddEvent() {
    if (!newEvent.title || !newEvent.date) return;
    setSaving(true);
    try {
      let start = newEvent.date;
      let end = newEvent.date;
      if (!newEvent.allDay) {
        start = newEvent.date + "T" + (newEvent.startTime || "09:00") + ":00";
        end = newEvent.date + "T" + (newEvent.endTime || "10:00") + ":00";
      } else {
        const endDate = new Date(newEvent.date);
        endDate.setDate(endDate.getDate() + 1);
        end = endDate.toISOString().split("T")[0];
      }
      const res = await fetch("/api/calendar/events/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newEvent.title,
          description: newEvent.description,
          location: newEvent.location,
          start,
          end,
          allDay: newEvent.allDay,
          calendarId: newEvent.calendarId,
        }),
      });
      if (!res.ok) throw new Error("Failed to create event");
      setShowAddModal(false);
      setNewEvent({ title: "", description: "", location: "", date: "", startTime: "", endTime: "", allDay: false, calendarId: "primary" });
      fetchEvents();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEvent(ev: CalendarEvent) {
    setDeleting(true);
    try {
      const res = await fetch(
        "/api/calendar/events/delete?eventId=" + ev.id + "&calendarId=" + ev.calendarId,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete");
      setSelectedEvent(null);
      fetchEvents();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setDeleting(false);
    }
  }

  const grouped: Record<string, CalendarEvent[]> = {};
  events.forEach((ev) => {
    const key = getDateKey(ev.start);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ev);
  });

  const today = new Date();
  const dateKeys = Object.keys(grouped).sort();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PullToRefresh onRefresh={async () => { await fetchEvents(); }}>
        <div className="pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-4 pt-12 pb-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Calendar</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{events.length} upcoming events</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex gap-2 px-4 pb-3">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDays(d)}
              className={"px-3 py-1 rounded-full text-xs font-medium " + (selectedDays === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
            >
              {d} days
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1,2,3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500 text-sm mb-2">Error loading calendar</p>
            <p className="text-muted-foreground text-xs mb-4">{error}</p>
            <button onClick={fetchEvents} className="text-primary text-sm underline">Try again</button>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-foreground font-medium">No upcoming events</p>
            <p className="text-muted-foreground text-sm mt-1">Your next {selectedDays} days are clear</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {dateKeys.map((dateKey) => {
              const dayEvents = grouped[dateKey];
              const dateObj = new Date(dayEvents[0].start);
              return (
                <div key={dateKey}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={"w-10 h-10 rounded-full flex flex-col items-center justify-center shrink-0 " + (sameDay(dateObj, today) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                      <span className="text-[10px] leading-none uppercase">{dateObj.toLocaleDateString("en-US", { weekday: "short" })}</span>
                      <span className="text-base leading-tight font-bold">{dateObj.getDate()}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{formatDateHeader(dayEvents[0].start)}</span>
                  </div>
                  <div className="flex flex-col gap-2 pl-13">
                    {dayEvents.map((ev) => (
                      <button key={ev.id} onClick={() => setSelectedEvent(ev)} className="w-full text-left bg-card border border-border rounded-xl p-3">
                        <div className="flex items-start gap-3">
                          <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: ev.calendarColor || "#4285f4" }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatTime(ev.start, ev.allDay)}
                              {!ev.allDay && ev.end ? " - " + formatTime(ev.end, false) : ""}
                              {ev.location ? "  📍 " + ev.location : ""}
                            </p>
                            {ev.calendarName ? <p className="text-[10px] text-muted-foreground mt-0.5">{ev.calendarName}</p> : null}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedEvent ? (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4" onClick={() => setSelectedEvent(null)}>
  <div className="w-full bg-background rounded-2xl p-6 pb-8 max-h-[85vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1 rounded-full mx-auto mb-6" style={{ backgroundColor: selectedEvent.calendarColor || "#4285f4" }} />
            <h2 className="text-xl font-semibold text-foreground mb-1">{selectedEvent.title}</h2>
            <p className="text-sm text-muted-foreground mb-4">{selectedEvent.calendarName}</p>
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <span className="text-base">🗓️</span>
                <div>
                  <p className="text-sm text-foreground">
                    {new Date(selectedEvent.start).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  </p>
                  {selectedEvent.allDay ? (
                    <p className="text-xs text-muted-foreground">All day</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{formatTime(selectedEvent.start, false)} - {formatTime(selectedEvent.end, false)}</p>
                  )}
                </div>
              </div>
              {selectedEvent.location ? (
                <div className="flex items-start gap-3">
                  <span className="text-base">📍</span>
                  <p className="text-sm text-foreground">{selectedEvent.location}</p>
                </div>
              ) : null}
              {selectedEvent.description ? (
                <div className="flex items-start gap-3">
                  <span className="text-base">📝</span>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{selectedEvent.description}</p>
                </div>
              ) : null}
            </div>
            <div className="flex gap-3 mt-6">
              {selectedEvent.htmlLink ? (
                <a href={selectedEvent.htmlLink} target="_blank" rel="noopener noreferrer" className="flex-1 text-center py-3 rounded-xl border border-border text-sm font-medium text-foreground">
                  Open in Google
                </a>
              ) : null}
              <button onClick={() => handleDeleteEvent(selectedEvent)} disabled={deleting} className="flex-1 py-3 rounded-xl bg-red-500/10 text-red-500 text-sm font-medium disabled:opacity-50">
                {deleting ? "Deleting" : "Delete Event"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showAddModal ? (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center" onClick={() => setShowAddModal(false)}>
          <div className="w-full bg-white rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-5 pb-4 border-b border-gray-200">
              <button
                onClick={() => setShowAddModal(false)}
                className="text-sm text-gray-500 font-medium"
              >
                Cancel
              </button>
              <h2 className="text-base font-semibold text-black">New Event</h2>
              <button
                onClick={handleAddEvent}
                disabled={saving || !newEvent.title || !newEvent.date}
                className="text-sm font-semibold text-blue-500 disabled:opacity-30"
              >
                {saving ? "Saving…" : "Add"}
              </button>
            </div>

            <div className="px-4 py-5 flex flex-col gap-4">

              {/* Title + Location group */}
              <div className="bg-gray-100 rounded-2xl overflow-hidden">
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Title"
                  className="w-full px-4 py-3.5 bg-transparent text-black text-base placeholder-gray-400 outline-none border-b border-gray-200"
                />
              </div>

              {/* Location — separate card so dropdown isn't clipped */}
              <div className="bg-gray-100 rounded-2xl">
                <LocationAutocomplete
                  value={newEvent.location}
                  onChange={(val) => setNewEvent((p) => ({ ...p, location: val }))}
                  placeholder="Location"
                />
              </div>

              {/* Date + Time group */}
              <div className="bg-gray-100 rounded-2xl overflow-hidden">
                {/* All day toggle */}
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-200">
                  <span className="text-sm text-black">All-day</span>
                  <button
                    onClick={() => setNewEvent((p) => ({ ...p, allDay: !p.allDay }))}
                    className={`w-12 h-7 rounded-full transition-colors relative ${newEvent.allDay ? 'bg-blue-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${newEvent.allDay ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {/* Date row */}
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-200">
                  <span className="text-sm text-black">Date</span>
                  <input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent((p) => ({ ...p, date: e.target.value }))}
                    className="text-sm text-blue-500 bg-transparent outline-none text-right"
                  />
                </div>

                {/* Start time */}
                {!newEvent.allDay && (
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-200">
                    <span className="text-sm text-black">Start</span>
                    <TimeSelect
                      value={newEvent.startTime}
                      onChange={(v) => setNewEvent((p) => ({ ...p, startTime: v }))}
                    />
                  </div>
                )}

                {/* End time */}
                {!newEvent.allDay && (
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <span className="text-sm text-black">End</span>
                    <TimeSelect
                      value={newEvent.endTime}
                      onChange={(v) => setNewEvent((p) => ({ ...p, endTime: v }))}
                    />
                  </div>
                )}

                {/* All day — no time rows needed, close group */}
                {newEvent.allDay && <div />}
              </div>

              {/* Description */}
              <div className="bg-gray-100 rounded-2xl overflow-hidden">
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Add notes"
                  rows={3}
                  className="w-full px-4 py-3.5 bg-transparent text-black text-sm placeholder-gray-400 outline-none resize-none"
                />
              </div>

              {/* Calendar picker */}
              {calendars.length > 0 && (
                <div className="bg-gray-100 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <span className="text-sm text-black">Calendar</span>
                    <select
                      value={newEvent.calendarId}
                      onChange={(e) => setNewEvent((p) => ({ ...p, calendarId: e.target.value }))}
                      className="text-sm text-blue-500 bg-transparent outline-none text-right max-w-[55%] truncate"
                    >
                      <option value="primary">Primary</option>
                      {calendars.map((cal: any) => (
                        <option key={cal.id} value={cal.id}>{cal.summary}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      ) : null}

      </div>
      </PullToRefresh>
      <BottomNav active="more" />
    </div>
  );
}
