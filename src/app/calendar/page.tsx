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
      className="text-sm text-[#f0a050] bg-transparent outline-none text-right"
    >
      {!value && <option value="">Select</option>}
      {options.map((opt) => (
        <option key={opt} value={opt} className="bg-[#2c2c2e] text-white">{toDisplay(opt)}</option>
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
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-[#555] text-sm font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <PullToRefresh onRefresh={async () => { await fetchEvents(); }}>
        <div className="pb-24 min-h-screen bg-black text-white">
          
          {/* Aligned Top Lock Header */}
          <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-[#1a1a1a]">
            <div className="flex items-center justify-between px-4 pt-14 pb-3">
              <div>
                <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, system-ui, sans-serif' }}>Calendar</h1>
                <p className="text-[10px] text-[#555] mt-0.5">{events.length} upcoming events</p>
              </div>
              
              {/* Premium inline header action link trigger */}
              <button
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(8);
                  setNewEvent(p => ({
                    ...p,
                    date: new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' })
                  }));
                  setShowAddModal(true);
                }}
                className="text-sm font-semibold text-[#f0a050] active:opacity-70 transition-opacity px-2 py-1"
              >
                Add Event
              </button>
            </div>
            
            {/* Range chips section */}
            <div className="flex gap-2 px-4 pb-3 border-t border-[#1a1a1a] pt-2.5">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDays(d)}
                  className={"px-3 py-1.5 rounded-full text-xs font-medium font-mono transition-colors " + (selectedDays === d ? "bg-[#f0a050] text-black" : "bg-[#111] text-[#555] border border-[#1a1a1a]")}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>

          {/* Agenda Grid layout */}
          <div className="px-4 pt-4">
            {loading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-[#111] border border-[#1a1a1a] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-[#ef4444] text-sm mb-2 font-mono">Error loading calendar</p>
                <p className="text-[#555] text-xs mb-4 font-mono">{error}</p>
                <button onClick={fetchEvents} className="text-[#f0a050] text-sm underline">Try again</button>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">📅</div>
                <p className="text-white font-medium">No upcoming events</p>
                <p className="text-[#555] text-sm mt-1">Your next {selectedDays} days are clear</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {dateKeys.map((dateKey) => {
                  const dayEvents = grouped[dateKey];
                  const dateObj = new Date(dayEvents[0].start);
                  return (
                    <div key={dateKey}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={"w-10 h-10 rounded-full flex flex-col items-center justify-center shrink-0 font-mono " + (sameDay(dateObj, today) ? "bg-[#f0a050] text-black font-bold" : "bg-[#111] border border-[#1a1a1a] text-[#ccc]")}>
                          <span className="text-[9px] leading-none uppercase">{dateObj.toLocaleDateString("en-US", { weekday: "short" })}</span>
                          <span className="text-base leading-tight font-bold">{dateObj.getDate()}</span>
                        </div>
                        <span className="text-sm font-semibold text-[#ccc]">{formatDateHeader(dayEvents[0].start)}</span>
                      </div>
                      
                      <div className="flex flex-col gap-2 pl-12">
                        {dayEvents.map((ev) => (
                          <button key={ev.id} onClick={() => setSelectedEvent(ev)} className="w-full text-left bg-[#111] border border-[#1a1a1a] rounded-xl p-3 active:scale-[0.99] transition-transform">
                            <div className="flex items-start gap-3">
                              <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: ev.calendarColor || "#f0a050" }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{ev.title}</p>
                                <p className="text-xs text-[#555] mt-0.5">
                                  {formatTime(ev.start, ev.allDay)}
                                  {!ev.allDay && ev.end ? " - " + formatTime(ev.end, false) : ""}
                                  {ev.location ? "  📍 " + ev.location : ""}
                                </p>
                                {ev.calendarName ? <p className="text-[10px] text-[#333] mt-0.5">{ev.calendarName}</p> : null}
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
        </div>
      </PullToRefresh>

      <BottomNav active="more" />

      {/* ═══════════════════════════════════════════════════════════════
          VIEWPORT FIXED ELEMENT SPECIFICATION MODALS BOUNDED SIBLINGS
      ═══════════════════════════════════════════════════════════════ */}

      {/* Event Details View Overlay */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4" onClick={() => setSelectedEvent(null)}>
          <div className="w-full bg-[#1c1c1e] border border-[#1a1a1a] rounded-2xl p-6 pb-8 max-h-[85vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1 rounded-full mx-auto mb-6" style={{ backgroundColor: selectedEvent.calendarColor || '#818cf8' }} />
            <h2 className="text-xl font-semibold text-white mb-1">{selectedEvent.title}</h2>
            <p className="text-sm text-[#555] mb-4 font-mono">{selectedEvent.calendarName}</p>
            
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <span className="text-base">🗓️</span>
                <div>
                  <p className="text-sm text-white">
                    {new Date(selectedEvent.start).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                  {selectedEvent.allDay ? (
                    <p className="text-xs text-[#555] font-mono">All day</p>
                  ) : (
                    <p className="text-xs text-[#555] font-mono">{formatTime(selectedEvent.start, false)} – {formatTime(selectedEvent.end, false)}</p>
                  )}
                </div>
              </div>
              {selectedEvent.location && (
                <div className="flex items-start gap-3">
                  <span className="text-base">📍</span>
                  <p className="text-sm text-white">{selectedEvent.location}</p>
                </div>
              )}
              {selectedEvent.description && (
                <div className="flex items-start gap-3">
                  <span className="text-base">📝</span>
                  <p className="text-sm text-white whitespace-pre-wrap">{selectedEvent.description}</p>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              {selectedEvent.htmlLink && (
                <div onClick={() => window.open(selectedEvent.htmlLink, '_blank')}
                  className="flex-1 text-center py-3 rounded-xl border border-[#2a2a2a] text-sm font-semibold text-white cursor-pointer active:bg-[#2c2c2e]">
                  Open in Google
                </div>
              )}
              <button onClick={() => handleDeleteEvent(selectedEvent)} disabled={deleting}
                className="flex-1 py-3 rounded-xl bg-red-500/10 text-red-500 text-sm font-semibold disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Event Popup Card Overlay */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-[#1c1c1e] border border-[#1a1a1a] w-full max-w-md rounded-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10 sticky top-0 bg-[#1c1c1e] z-10">
              <button onClick={() => setShowAddModal(false)} className="text-[#f0a050] text-sm font-medium">Cancel</button>
              <h2 className="text-base font-semibold text-white">New Event</h2>
              <button onClick={handleAddEvent} disabled={saving || !newEvent.title || !newEvent.date}
                className="text-[#f0a050] text-sm font-semibold disabled:opacity-30">
                {saving ? 'Saving…' : 'Add'}
              </button>
            </div>
            
            <div className="px-4 py-4 space-y-3 pb-12">
              <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
                <input type="text" value={newEvent.title}
                  onChange={(e) => setNewEvent(p => ({ ...p, title: e.target.value }))}
                  placeholder="Title"
                  className="w-full px-4 py-3.5 bg-transparent text-white text-base placeholder-[#555] outline-none"
                  autoFocus
                />
              </div>
              
              <div className="rounded-xl bg-[#2c2c2e]">
                <LocationAutocomplete
                  value={newEvent.location}
                  onChange={(val) => setNewEvent(p => ({ ...p, location: val }))}
                  placeholder="Location"
                />
              </div>
              
              <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10">
                  <span className="text-sm text-white">All-day</span>
                  <button onClick={() => setNewEvent(p => ({ ...p, allDay: !p.allDay }))}
                    className={`w-12 h-7 rounded-full transition-colors relative ${newEvent.allDay ? 'bg-[#f0a050]' : 'bg-[#3a3a3c]'}`}>
                    <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${newEvent.allDay ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10">
                  <span className="text-sm text-white">Date</span>
                  <input type="date" value={newEvent.date}
                    onChange={(e) => setNewEvent(p => ({ ...p, date: e.target.value }))}
                    className="text-sm text-[#f0a050] bg-transparent outline-none text-right"
                  />
                </div>
                
                {!newEvent.allDay && (
                  <>
                    <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10">
                      <span className="text-sm text-white">Start</span>
                      <TimeSelect value={newEvent.startTime} onChange={(v) => setNewEvent(p => ({ ...p, startTime: v }))} />
                    </div>
                    <div className="flex items-center justify-between px-4 py-3.5">
                      <span className="text-sm text-white">End</span>
                      <TimeSelect value={newEvent.endTime} onChange={(v) => setNewEvent(p => ({ ...p, endTime: v }))} />
                    </div>
                  </>
                )}
              </div>
              
              <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
                <textarea value={newEvent.description}
                  onChange={(e) => setNewEvent(p => ({ ...p, description: e.target.value }))}
                  placeholder="Add notes" rows={3}
                  className="w-full px-4 py-3.5 bg-transparent text-white text-sm placeholder-[#555] outline-none resize-none"
                />
              </div>
              
              {calendars.length > 0 && (
                <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <span className="text-sm text-white">Calendar</span>
                    <select value={newEvent.calendarId}
                      onChange={(e) => setNewEvent(p => ({ ...p, calendarId: e.target.value }))}
                      className="text-sm text-[#f0a050] bg-transparent outline-none text-right max-w-[55%] truncate">
                      <option value="primary" className="bg-[#2c2c2e] text-white">Primary</option>
                      {calendars.map((cal: any) => (
                        <option key={cal.id} value={cal.id} className="bg-[#2c2c2e] text-white">{cal.summary}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}