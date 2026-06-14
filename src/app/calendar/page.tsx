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
        <option key={opt} value={opt} className="bg-[#1c1c1e] text-white">{toDisplay(opt)}</option>
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
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  
  // Overlay Sheet Action View States
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirmEntry, setDeleteConfirmEntry] = useState<CalendarEvent | null>(null);
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
    } finaly {
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
      await fetchEvents();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finaly {
      setSaving(false);
    }
  }

  async function handleDeleteEvent() {
    if (!deleteConfirmEntry) return;
    setDeleting(true);
    try {
      const res = await fetch(
        "/api/calendar/events/delete?eventId=" + deleteConfirmEntry.id + "&calendarId=" + deleteConfirmEntry.calendarId,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete remote event line");
      
      const next = new Set(expandedEvents);
      next.delete(deleteConfirmEntry.id);
      setExpandedEvents(next);
      setDeleteConfirmEntry(null);
      await fetchEvents();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finaly {
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
        <div className="text-[#555] text-sm font-mono">Loading data routes...</div>
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
                <p className="text-[10px] text-[#555] mt-0.5">{events.length} Operational Events Active</p>
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
                  className={"px-3 py-1.5 rounded-full text-xs font-medium font-mono uppercase tracking-wider transition-colors " + (selectedDays === d ? "bg-[#f0a050] text-black font-bold" : "bg-[#111] text-[#555] border border-[#1a1a1a]")}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>

          {/* Agenda Grid layout loops */}
          <div className="px-4 pt-4">
            {loading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-[#111] border border-[#1a1a1a] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12 bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                <p className="text-[#ef4444] text-sm mb-2 font-mono">Error syncing cloud calendar</p>
                <p className="text-[#555] text-xs mb-4 font-mono">{error}</p>
                <button onClick={fetchEvents} className="text-[#f0a050] text-sm underline font-mono uppercase">Retry Handshake</button>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-16 bg-[#111] border border-[#1a1a1a] rounded-2xl">
                <div className="text-4xl mb-3">📅</div>
                <p className="text-white font-medium">No upcoming events found</p>
                <p className="text-[#555] text-sm mt-1 font-mono">Your next {selectedDays} days are clear</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {dateKeys.map((dateKey) => {
                  const dayEvents = grouped[dateKey];
                  const dateObj = new Date(dayEvents[0].start);
                  return (
                    <div key={dateKey} className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className={"w-10 h-10 rounded-full flex flex-col items-center justify-center shrink-0 font-mono " + (sameDay(dateObj, today) ? "bg-[#f0a050] text-black font-bold" : "bg-[#111] border border-[#1a1a1a] text-[#ccc]")}>
                          <span className="text-[9px] leading-none uppercase">{dateObj.toLocaleDateString("en-US", { weekday: "short" })}</span>
                          <span className="text-base leading-tight font-bold">{dateObj.getDate()}</span>
                        </div>
                        <span className="text-sm font-semibold text-[#ccc]">{formatDateHeader(dayEvents[0].start)}</span>
                      </div>
                      
                      {/* Premium Accordion Rows Stack */}
                      <div className="flex flex-col gap-2 pl-12">
                        {dayEvents.map((ev) => {
                          const expanded = expandedEvents.has(ev.id);
                          return (
                            <div 
                              key={ev.id} 
                              className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden transition-all"
                            >
                              {/* Tappable Expand Element Container */}
                              <div
                                onClick={() => {
                                  const next = new Set(expandedEvents);
                                  expanded ? next.delete(ev.id) : next.add(ev.id);
                                  setExpandedEvents(next);
                                }}
                                className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[#161616]"
                              >
                                <div className="flex items-start gap-3 flex-1 min-w-0 pr-2">
                                  <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: ev.calendarColor || "#f0a050" }} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{ev.title}</p>
                                    <p className="text-xs text-[#555] font-mono mt-0.5">
                                      {formatTime(ev.start, ev.allDay)}
                                      {!ev.allDay && ev.end ? " - " + formatTime(ev.end, false) : ""}
                                    </p>
                                  </div>
                                </div>

                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"
                                  style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                  <path d="M6 9l6 6 6-6" />
                                </svg>
                              </div>

                              {/* Accordion Content Panel Box */}
                              {expanded && (
                                <div className="px-4 pb-4 pt-3 border-t border-[#1a1a1a] bg-black/20 space-y-3">
                                  <div className="text-xs font-mono text-[#555] space-y-1.5">
                                    <div>
                                      <span className="text-[9px] uppercase tracking-wider block text-[#444]">Timeline Frame</span>
                                      <p className="text-[#ccc] font-semibold font-sans mt-0.5">
                                        {new Date(ev.start).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                        {ev.allDay ? ' (All Day Event)' : ` @ ${formatTime(ev.start, false)} – ${formatTime(ev.end, false)}`}
                                      </p>
                                    </div>

                                    {ev.calendarName && (
                                      <div className="pt-1">
                                        <span className="text-[9px] uppercase tracking-wider block text-[#444]">Target Calendar Ledger</span>
                                        <p className="text-[#888] font-sans mt-0.5">{ev.calendarName}</p>
                                      </div>
                                    )}

                                    {ev.location && (
                                      <div className="pt-1">
                                        <span className="text-[9px] uppercase tracking-wider block text-[#444]">Location Node</span>
                                        <p className="text-white font-sans mt-0.5">📍 {ev.location}</p>
                                      </div>
                                    )}
                                  </div>

                                  {ev.description && (
                                    <div>
                                      <span className="text-[9px] font-mono uppercase tracking-wider block text-[#444] mb-1">Agenda Notes</span>
                                      <p className="text-[#ccc] text-xs bg-black/40 p-2.5 rounded-xl whitespace-pre-wrap font-sans leading-relaxed">{ev.description}</p>
                                    </div>
                                  )}

                                  {/* Actions Triggers Section */}
                                  <div className="flex items-center gap-4 pt-1.5 border-t border-[#1a1a1a]/40">
                                    {ev.htmlLink && (
                                      <button 
                                        onClick={() => window.open(ev.htmlLink, '_blank')}
                                        className="text-[#f0a050] text-xs font-semibold uppercase tracking-wider"
                                      >
                                        Open in Google
                                      </button>
                                    )}
                                    <button 
                                      onClick={() => setDeleteConfirmEntry(ev)}
                                      className="text-[#ef4444] text-xs font-semibold uppercase tracking-wider"
                                    >
                                      Delete Event
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </PullToRefresh>

      <BottomNav activeTab="more" />

      {/* ═══════════════════════════════════════════════════════════════
          VIEWPORT FIXED ELEMENT SPECIFICATION MODALS BOUNDED SIBLINGS
      ═══════════════════════════════════════════════════════════════ */}

      {/* Add New Event Popup Card Overlay */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-[#1c1c1e] border border-[#1a1a1a] w-full max-w-md rounded-2xl max-h-[85vh] overflow-y-auto pb-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#1a1a1a] sticky top-0 bg-[#1c1c1e] z-10">
              <button onClick={() => setShowAddModal(false)} className="text-[#555] text-sm font-semibold">Cancel</button>
              <h2 className="text-base font-bold font-mono text-white uppercase tracking-wide">New Event</h2>
              <button onClick={handleAddEvent} disabled={saving || !newEvent.title || !newEvent.date}
                className="text-[#f0a050] text-sm font-bold uppercase tracking-wider disabled:opacity-30">
                {saving ? 'Saving…' : 'Add'}
              </button>
            </div>
            
            <div className="px-5 py-4 space-y-4 pb-8">
              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Event Title Statement *</label>
                <input type="text" value={newEvent.title}
                  onChange={(e) => setNewEvent(p => ({ ...p, title: e.target.value }))}
                  placeholder="What is scheduled?"
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Geographic Location</label>
                <div className="rounded-xl bg-black overflow-hidden border border-[#1a1a1a]">
                  <LocationAutocomplete
                    value={newEvent.location}
                    onChange={(val) => setNewEvent(p => ({ ...p, location: val }))}
                    placeholder="Search destination nodes..."
                  />
                </div>
              </div>
              
              <div className="rounded-xl bg-black border border-[#1a1a1a] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#1a1a1a]/60">
                  <span className="text-sm text-white font-mono uppercase tracking-wide text-xs">All-day Event</span>
                  <button onClick={() => setNewEvent(p => ({ ...p, allDay: !p.allDay }))}
                    className={`w-12 h-6 rounded-full transition-colors relative ${newEvent.allDay ? 'bg-[#f0a050]' : 'bg-[#222] border border-[#333]'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${newEvent.allDay ? 'left-6' : 'left-0.5'}`} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#1a1a1a]/60">
                  <span className="text-sm text-white font-mono uppercase tracking-wide text-xs">Date Input</span>
                  <input type="date" value={newEvent.date}
                    onChange={(e) => setNewEvent(p => ({ ...p, date: e.target.value }))}
                    className="text-sm text-[#f0a050] bg-transparent outline-none text-right font-mono"
                  />
                </div>
                
                {!newEvent.allDay && (
                  <>
                    <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#1a1a1a]/60">
                      <span className="text-sm text-white font-mono uppercase tracking-wide text-xs">Start Time</span>
                      <TimeSelect value={newEvent.startTime} onChange={(v) => setNewEvent(p => ({ ...p, startTime: v }))} />
                    </div>
                    <div className="flex items-center justify-between px-4 py-3.5">
                      <span className="text-sm text-white font-mono uppercase tracking-wide text-xs">End Time</span>
                      <TimeSelect value={newEvent.endTime} onChange={(v) => setNewEvent(p => ({ ...p, endTime: v }))} />
                    </div>
                  </>
                )}
              </div>
              
              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Agenda Notes / Details</label>
                <textarea value={newEvent.description}
                  onChange={(e) => setNewEvent(p => ({ ...p, description: e.target.value }))}
                  placeholder="Optional details..." rows={3}
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#f0a050] resize-none"
                />
              </div>
              
              {calendars.length > 0 && (
                <div>
                  <label className="block text-xs uppercase text-[#555] font-mono mb-1">Select Target Ledger</label>
                  <div className="rounded-xl bg-black border border-[#1a1a1a] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3.5">
                      <span className="text-xs font-mono text-white uppercase tracking-wider">Calendar</span>
                      <select value={newEvent.calendarId}
                        onChange={(e) => setNewEvent(p => ({ ...p, calendarId: e.target.value }))}
                        className="text-sm text-[#f0a050] bg-transparent outline-none text-right max-w-[55%] truncate font-medium">
                        <option value="primary" className="bg-[#1c1c1e] text-white">Primary</option>
                        {calendars.map((cal: any) => (
                          <option key={cal.id} value={cal.id} className="bg-[#1c1c1e] text-white">{cal.summary}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Viewport Fixed Delete Confirmation Sheet */}
      {deleteConfirmEntry && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md p-5 border border-[#1a1a1a] space-y-4 shadow-2xl">
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white font-mono uppercase tracking-wide">Drop Calendar Event?</h3>
              <p className="text-xs text-[#555]">This action will permanently erase this schedule entry from Google servers.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirmEntry(null)} 
                disabled={deleting}
                className="flex-1 bg-black border border-[#1a1a1a] text-white py-3 rounded-xl text-sm font-medium transition-opacity disabled:opacity-40"
              >
                Keep
              </button>
              <button 
                onClick={handleDeleteEvent} 
                disabled={deleting}
                className="flex-1 bg-[#ef4444] text-white py-3 rounded-xl text-sm font-bold transition-opacity disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}