'use client';

import { useState, useEffect, useCallback } from 'react';
import PullToRefresh from '@/components/PullToRefresh';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RiskFlag { label: string; color: string; }
interface CurrentWeather {
  tempF: number; feelsLikeF: number; humidity: number; dewPointF: number;
  windMph: number; windGustMph: number; windDir: string;
  pressureInHg: string; uvIndex: number; visibilityMiles: number | null; precipNowIn: number;
  weatherCode: number; desc: string; icon: string; isDay: boolean; risk: RiskFlag | null;
}
interface HourlyEntry {
  time: string; tempF: number; feelsLikeF: number;
  precipProb: number; weatherCode: number; icon: string;
}
interface PeriodDetail {
  icon: string; desc: string; precipProb: number; feelsF: number;
}
interface DailyEntry {
  date: string; dayLabel: string; maxF: number; minF: number;
  weatherCode: number; icon: string; desc: string;
  precipProbMax: number; precipSumIn: number; snowSumIn: number;
  uvIndexMax: number; sunrise: string; sunset: string;
  day: PeriodDetail; night: PeriodDetail;
}
interface WxAlert {
  event: string; headline: string; severity: string;
  description: string; instruction: string; effective: string; expires: string;
}
interface AirQuality {
  aqi: number; pm25: number; pm10: number; ozone: number;
  label: string; color: string; advice: string;
}
interface WeatherData {
  current: CurrentWeather;
  hourly: HourlyEntry[];
  daily: DailyEntry[];
  alerts: WxAlert[];
  airQuality: AirQuality | null;
  todaySunrise: string;
  todaySunset: string;
  updatedAt: string;
}
interface LocResult { name: string; lat: number; lon: number; }
interface SelectedLocation { lat: number; lon: number; label: string; }

// Bumped from v1 — v1 cached responses don't have alerts/airQuality and will crash on read
const CACHE_KEY = 'weather_page_v2';
const DEFAULT_LAT = 40.3356;
const DEFAULT_LON = -75.9269;

function uvLabel(uv: number): string {
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'Very High';
  return 'Extreme';
}
function uvColor(uv: number): string {
  if (uv <= 2) return '#22c55e';
  if (uv <= 5) return '#f0a050';
  if (uv <= 7) return '#f59e0b';
  if (uv <= 10) return '#ef4444';
  return '#a855f7';
}
function severityColor(sev: string): string {
  if (sev === 'Extreme') return '#7f1d1d';
  if (sev === 'Severe') return '#ef4444';
  if (sev === 'Moderate') return '#f59e0b';
  return '#eab308';
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    const d = await res.json();
    const city = d.city || d.locality || d.principalSubdivision || 'Current Location';
    const stateCode = d.principalSubdivisionCode?.includes('-') ? d.principalSubdivisionCode.split('-')[1] : d.principalSubdivision;
    return stateCode ? `${city}, ${stateCode}` : city;
  } catch {
    return 'Current Location';
  }
}

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-5 h-5 border-2 border-[#f0a050] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ─── Rain Chance Scroll ─────────────────────────────────────────────────────────

function RainScroll({ hourly }: { hourly: HourlyEntry[] }) {
  const maxBarH = 46;
  return (
    <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
      {hourly.map((h, i) => {
        const barH = Math.max((h.precipProb / 100) * maxBarH, h.precipProb > 0 ? 3 : 0);
        return (
          <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 w-11">
            <p className="text-[10px] text-[#3b82f6] font-mono h-3">{h.precipProb > 0 ? `${h.precipProb}%` : ''}</p>
            <div className="flex items-end" style={{ height: maxBarH }}>
              <div
                className="w-2.5 rounded-full"
                style={{
                  height: barH || 2,
                  background: h.precipProb >= 50 ? '#3b82f6' : h.precipProb > 0 ? '#3b82f680' : '#1a1a1a',
                }}
              />
            </div>
            <p className="text-[10px] text-[#555] font-mono">{h.time}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Alerts Banner ──────────────────────────────────────────────────────────────

function AlertsBanner({ alerts, onTap }: { alerts: WxAlert[]; onTap: (a: WxAlert) => void }) {
  return (
    <div className="space-y-2">
      {alerts.map((a, i) => (
        <div
          key={i}
          onClick={() => onTap(a)}
          className="rounded-2xl p-4 active:opacity-80 cursor-pointer border"
          style={{ background: `${severityColor(a.severity)}15`, borderColor: `${severityColor(a.severity)}50` }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: severityColor(a.severity) }}>
              {a.event}
            </p>
          </div>
          <p className="text-white text-sm mt-1 leading-snug">{a.headline}</p>
          <p className="text-[#888] text-[11px] mt-1">Tap for details</p>
        </div>
      ))}
    </div>
  );
}

function AlertDetailModal({ alert, onClose }: { alert: WxAlert; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-[#1c1c1e] w-full max-w-lg rounded-2xl max-h-[90dvh] overflow-y-auto overscroll-contain pb-6 border border-[#1a1a1a]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10 sticky top-0 bg-[#1c1c1e] z-10">
          <button onClick={onClose} className="text-[#f0a050] text-sm">Close</button>
          <h2 className="text-base font-semibold text-white">{alert.event}</h2>
          <div className="w-10" />
        </div>
        <div className="px-5 pt-4 space-y-3">
          <div className="rounded-2xl p-3 border" style={{ background: `${severityColor(alert.severity)}15`, borderColor: `${severityColor(alert.severity)}50` }}>
            <p className="text-white text-sm font-semibold">{alert.headline}</p>
            <p className="text-[11px] mt-1" style={{ color: severityColor(alert.severity) }}>{alert.severity} Severity</p>
          </div>
          <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
            <p className="text-[10px] font-bold text-[#333] uppercase tracking-widest mb-2">Details</p>
            <p className="text-[#ccc] text-[13px] leading-relaxed whitespace-pre-line">{alert.description}</p>
          </div>
          {alert.instruction && (
            <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
              <p className="text-[10px] font-bold text-[#f0a050] uppercase tracking-widest mb-2">What To Do</p>
              <p className="text-[#ccc] text-[13px] leading-relaxed whitespace-pre-line">{alert.instruction}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Day/Night Detail Modal ────────────────────────────────────────────────────

function DayDetailModal({ day, onClose }: { day: DailyEntry; onClose: () => void }) {
  const dateLabel = day.dayLabel === 'Today'
    ? 'Today'
    : new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-[#1c1c1e] w-full max-w-lg rounded-2xl max-h-[90dvh] overflow-y-auto overscroll-contain pb-6 border border-[#1a1a1a]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10 sticky top-0 bg-[#1c1c1e] z-10">
          <button onClick={onClose} className="text-[#f0a050] text-sm">Close</button>
          <h2 className="text-base font-semibold text-white">{dateLabel}</h2>
          <div className="w-10" />
        </div>

        <div className="px-5 pt-4 space-y-3">
          <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{day.day.icon}</span>
              <div>
                <p className="text-[10px] font-bold text-[#f0a050] uppercase tracking-widest">Day</p>
                <p className="text-white text-lg font-semibold leading-tight">{day.day.desc}</p>
              </div>
              <p className="ml-auto text-white text-2xl font-mono font-bold">{day.maxF}°</p>
            </div>
            <div className="flex justify-between text-[12px] text-[#888] font-mono pt-3 mt-3 border-t border-[#1a1a1a]">
              <span>Feels {day.day.feelsF}°</span>
              <span>{day.day.precipProb > 0 ? `${day.day.precipProb}% chance of rain` : 'No rain expected'}</span>
            </div>
          </div>

          <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{day.night.icon}</span>
              <div>
                <p className="text-[10px] font-bold text-[#60a5fa] uppercase tracking-widest">Night</p>
                <p className="text-white text-lg font-semibold leading-tight">{day.night.desc}</p>
              </div>
              <p className="ml-auto text-white text-2xl font-mono font-bold">{day.minF}°</p>
            </div>
            <div className="flex justify-between text-[12px] text-[#888] font-mono pt-3 mt-3 border-t border-[#1a1a1a]">
              <span>Feels {day.night.feelsF}°</span>
              <span>{day.night.precipProb > 0 ? `${day.night.precipProb}% chance of rain` : 'No rain expected'}</span>
            </div>
          </div>

          {(day.precipSumIn > 0 || day.snowSumIn > 0) && (
            <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 flex justify-around text-center">
              {day.precipSumIn > 0 && (
                <div>
                  <p className="text-[10px] text-[#555] uppercase tracking-wide">Rain Total</p>
                  <p className="text-[#3b82f6] font-mono font-bold text-lg mt-0.5">{day.precipSumIn}&quot;</p>
                </div>
              )}
              {day.snowSumIn > 0 && (
                <div>
                  <p className="text-[10px] text-[#555] uppercase tracking-wide">Snow Total</p>
                  <p className="text-white font-mono font-bold text-lg mt-0.5">{day.snowSumIn}&quot;</p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-3">
              <p className="text-[10px] text-[#555] uppercase tracking-wide">Sunrise</p>
              <p className="text-white font-mono font-semibold mt-0.5">{day.sunrise}</p>
            </div>
            <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-3">
              <p className="text-[10px] text-[#555] uppercase tracking-wide">Sunset</p>
              <p className="text-white font-mono font-semibold mt-0.5">{day.sunset}</p>
            </div>
          </div>

          <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-3 flex items-center justify-between">
            <p className="text-[10px] text-[#555] uppercase tracking-wide">Max UV Index</p>
            <p className="font-mono font-semibold" style={{ color: uvColor(day.uvIndexMax) }}>
              {day.uvIndexMax} · {uvLabel(day.uvIndexMax)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Location Search Modal ─────────────────────────────────────────────────────

function LocationModal({
  onClose, onSelect, onUseCurrent,
}: {
  onClose: () => void;
  onSelect: (r: LocResult) => void;
  onUseCurrent: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState('');

  async function runSearch() {
    const q = query.trim();
    if (!q) return;
    setSearching(true); setErr(''); setResults([]);
    try {
      if (/^\d{5}$/.test(q)) {
        const res = await fetch(`https://api.zippopotam.us/us/${q}`);
        if (!res.ok) throw new Error('ZIP code not found');
        const d = await res.json();
        setResults(
          d.places.map((p: { 'place name': string; 'state abbreviation': string; latitude: string; longitude: string }) => ({
            name: `${p['place name']}, ${p['state abbreviation']} ${d['post code']}`,
            lat: parseFloat(p.latitude),
            lon: parseFloat(p.longitude),
          }))
        );
      } else {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`);
        const d = await res.json();
        if (!d.results || d.results.length === 0) throw new Error('No matches found');
        setResults(
          d.results.map((r: { name: string; admin1?: string; country_code?: string; latitude: number; longitude: number }) => ({
            name: `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}${r.country_code ? ' ' + r.country_code : ''}`,
            lat: r.latitude,
            lon: r.longitude,
          }))
        );
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-[#1c1c1e] w-full max-w-lg rounded-2xl max-h-[90dvh] overflow-y-auto overscroll-contain pb-6 border border-[#1a1a1a]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10 sticky top-0 bg-[#1c1c1e] z-10">
          <button onClick={onClose} className="text-[#f0a050] text-sm">Cancel</button>
          <h2 className="text-base font-semibold text-white">Search Location</h2>
          <div className="w-10" />
        </div>

        <div className="px-5 pt-4 space-y-3">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
              placeholder="City or ZIP code"
              className="flex-1 bg-[#111] border border-[#1a1a1a] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#f0a050]"
            />
            <button
              onClick={runSearch}
              disabled={searching}
              className="bg-[#f0a050] text-black text-sm font-semibold px-4 rounded-xl disabled:opacity-40"
            >
              {searching ? '···' : 'Go'}
            </button>
          </div>

          <div
            onClick={onUseCurrent}
            className="flex items-center gap-2 bg-[#111] border border-[#1a1a1a] rounded-xl px-3 py-3 active:opacity-70 cursor-pointer"
          >
            <span>📍</span>
            <span className="text-[#f0a050] text-sm font-semibold">Use My Current Location</span>
          </div>

          {err && <p className="text-[#ef4444] text-xs text-center py-2">{err}</p>}

          {results.length > 0 && (
            <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
              {results.map((r, i) => (
                <div
                  key={i}
                  onClick={() => onSelect(r)}
                  className={`px-4 py-3 active:bg-[#1a1a1a] cursor-pointer ${i < results.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}
                >
                  <p className="text-white text-sm">{r.name}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WeatherPage() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [locLabel, setLocLabel] = useState('Locating…');
  const [error, setError] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [expandedDay, setExpandedDay] = useState<DailyEntry | null>(null);
  const [expandedAlert, setExpandedAlert] = useState<WxAlert | null>(null);

  const fetchForCoords = useCallback((lat: number, lon: number) => {
    setLoading(true);
    fetch(`/api/weather?lat=${lat}&lon=${lon}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setData(d);
        setError('');
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch {}
      })
      .catch(() => setError('Could not load weather'))
      .finally(() => setLoading(false));
  }, []);

  const detectAndLoad = useCallback(() => {
    setLocLabel('Locating…');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const { latitude, longitude } = pos.coords;
          fetchForCoords(latitude, longitude);
          const label = await reverseGeocode(latitude, longitude);
          setLocLabel(label);
        },
        () => {
          setLocLabel('Reading, PA');
          fetchForCoords(DEFAULT_LAT, DEFAULT_LON);
        },
        { timeout: 8000 }
      );
    } else {
      setLocLabel('Reading, PA');
      fetchForCoords(DEFAULT_LAT, DEFAULT_LON);
    }
  }, [fetchForCoords]);

  const refresh = useCallback(() => {
    if (selectedLocation) fetchForCoords(selectedLocation.lat, selectedLocation.lon);
    else detectAndLoad();
  }, [selectedLocation, fetchForCoords, detectAndLoad]);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.current && Array.isArray(parsed.daily) && Array.isArray(parsed.hourly)) {
          setData(parsed);
          setLoading(false);
        } else {
          localStorage.removeItem(CACHE_KEY);
        }
      }
    } catch {
      try { localStorage.removeItem(CACHE_KEY); } catch {}
    }
    detectAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSelectLocation(r: LocResult) {
    setSelectedLocation({ lat: r.lat, lon: r.lon, label: r.name });
    setLocLabel(r.name);
    setShowLocationModal(false);
    fetchForCoords(r.lat, r.lon);
  }

  function handleUseCurrent() {
    setSelectedLocation(null);
    setShowLocationModal(false);
    detectAndLoad();
  }

  const c = data?.current;

  return (
    <>
      <PullToRefresh onRefresh={async () => refresh()}>
        <div className="min-h-screen bg-black pb-24">
          {/* Header */}
          <div className="px-4 pt-6 pb-2 flex items-center justify-between">
            <div>
              <p className="text-[#555] text-xs font-semibold uppercase tracking-wider">{locLabel}</p>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, system-ui, sans-serif' }}>
                Weather
              </h1>
            </div>
            <div
              onClick={() => setShowLocationModal(true)}
              className="w-9 h-9 rounded-full bg-[#111] border border-[#1a1a1a] flex items-center justify-center active:opacity-70 cursor-pointer"
            >
              <span className="text-base">🔍</span>
            </div>
          </div>

          {loading && !data && <Spinner />}

          {error && !data && (
            <div className="px-4 pt-8 text-center">
              <p className="text-[#555] text-sm">{error}</p>
            </div>
          )}

          {c && data && (
            <div className="px-4 pt-2 space-y-3">

              {/* NWS alerts */}
              {data.alerts && data.alerts.length > 0 && (
                <AlertsBanner alerts={data.alerts} onTap={setExpandedAlert} />
              )}

              {/* Current conditions hero */}
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 text-center">
                <p className="text-6xl mb-1">{c.icon}</p>
                <p className="text-white text-6xl font-mono font-bold leading-none mt-2">{c.tempF}°</p>
                <p className="text-[#ccc] text-sm mt-2">{c.desc}</p>
                <p className="text-[#555] text-xs mt-1 font-mono">
                  Feels like {c.feelsLikeF}° · H:{data.daily[0]?.maxF}° L:{data.daily[0]?.minF}°
                </p>
                {c.risk && (
                  <div
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border"
                    style={{ background: `${c.risk.color}15`, borderColor: `${c.risk.color}50` }}
                  >
                    <span className="text-sm">{c.risk.color === '#3b82f6' || c.risk.color === '#60a5fa' ? '🥶' : '🥵'}</span>
                    <span className="text-[11px] font-semibold" style={{ color: c.risk.color }}>{c.risk.label}</span>
                  </div>
                )}
              </div>

              {/* Hourly scroll */}
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                <p className="text-[10px] font-bold text-[#333] uppercase tracking-widest mb-3">24-Hour Forecast</p>
                <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {data.hourly.map((h, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 w-11">
                      <p className="text-[10px] text-[#555] font-mono">{h.time}</p>
                      <p className="text-xl">{h.icon}</p>
                      {h.precipProb > 0 ? (
                        <p className="text-[9px] text-[#3b82f6] font-mono">{h.precipProb}%</p>
                      ) : (
                        <div className="h-[13px]" />
                      )}
                      <p className="text-[13px] text-white font-mono font-semibold">{h.tempF}°</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rain chance — scrollable, full 24h */}
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                <p className="text-[10px] font-bold text-[#333] uppercase tracking-widest mb-3">Chance of Rain — Next 24h</p>
                <RainScroll hourly={data.hourly} />
              </div>

              {/* 8-day forecast — tap a row for day/night detail */}
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
                <p className="text-[10px] font-bold text-[#333] uppercase tracking-widest px-4 pt-4 pb-2">8-Day Forecast</p>
                <div className="px-4 pb-2">
                  {data.daily.map((d, i) => {
                    const globalMax = Math.max(...data.daily.map(x => x.maxF));
                    const globalMin = Math.min(...data.daily.map(x => x.minF));
                    const range = Math.max(globalMax - globalMin, 1);
                    const leftPct = ((d.minF - globalMin) / range) * 100;
                    const widthPct = ((d.maxF - d.minF) / range) * 100;
                    return (
                      <div
                        key={d.date}
                        onClick={() => setExpandedDay(d)}
                        className={`flex items-center gap-3 py-2.5 active:opacity-60 cursor-pointer ${i < data.daily.length - 1 ? 'border-b border-[#1a1a1a]/60' : ''}`}
                      >
                        <p className="text-[13px] text-white font-medium w-10 shrink-0">{d.dayLabel}</p>
                        <div className="flex items-center gap-1 w-11 shrink-0">
                          <span className="text-base">{d.icon}</span>
                        </div>
                        <p className="text-[11px] text-[#3b82f6] font-mono w-9 shrink-0">
                          {d.precipProbMax > 0 ? `${d.precipProbMax}%` : ''}
                        </p>
                        <p className="text-[12px] text-[#555] font-mono w-7 text-right shrink-0">{d.minF}°</p>
                        <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full relative mx-1">
                          <div
                            className="absolute h-1.5 rounded-full"
                            style={{
                              left: `${leftPct}%`,
                              width: `${Math.max(widthPct, 6)}%`,
                              background: 'linear-gradient(90deg, #60a5fa, #f0a050)',
                            }}
                          />
                        </div>
                        <p className="text-[12px] text-white font-mono font-semibold w-7 shrink-0">{d.maxF}°</p>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" className="shrink-0 ml-0.5">
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detail tiles grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-[#333] uppercase tracking-widest mb-2">Feels Like</p>
                  <p className="text-white text-2xl font-mono font-bold">{c.feelsLikeF}°</p>
                  <p className="text-[#555] text-[11px] mt-1">
                    {c.feelsLikeF < c.tempF ? 'Wind is making it feel cooler' : c.feelsLikeF > c.tempF ? 'Humidity is making it feel warmer' : 'Similar to actual temperature'}
                  </p>
                </div>

                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-[#333] uppercase tracking-widest mb-2">UV Index</p>
                  <p className="text-2xl font-mono font-bold" style={{ color: uvColor(c.uvIndex) }}>{c.uvIndex}</p>
                  <p className="text-[#555] text-[11px] mt-1">{uvLabel(c.uvIndex)}</p>
                </div>

                {data.airQuality && (
                  <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-[#333] uppercase tracking-widest mb-2">Air Quality</p>
                    <p className="text-2xl font-mono font-bold" style={{ color: data.airQuality.color }}>{data.airQuality.aqi}</p>
                    <p className="text-[11px] mt-1" style={{ color: data.airQuality.color }}>{data.airQuality.label}</p>
                  </div>
                )}

                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-[#333] uppercase tracking-widest mb-2">Wind</p>
                  <p className="text-white text-2xl font-mono font-bold">{c.windMph} <span className="text-sm text-[#555]">mph</span></p>
                  <p className="text-[#555] text-[11px] mt-1">{c.windDir} · Gusts {c.windGustMph} mph</p>
                </div>

                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-[#333] uppercase tracking-widest mb-2">Humidity</p>
                  <p className="text-white text-2xl font-mono font-bold">{c.humidity}%</p>
                  <p className="text-[#555] text-[11px] mt-1">
                    {c.humidity >= 70 ? 'Muggy conditions' : c.humidity <= 30 ? 'Dry air' : 'Comfortable'}
                  </p>
                </div>

                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-[#333] uppercase tracking-widest mb-2">Dew Point</p>
                  <p className="text-white text-2xl font-mono font-bold">{c.dewPointF}°</p>
                  <p className="text-[#555] text-[11px] mt-1">
                    {c.dewPointF >= 65 ? 'Muggy' : c.dewPointF >= 55 ? 'Somewhat humid' : 'Comfortable'}
                  </p>
                </div>

                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-[#333] uppercase tracking-widest mb-2">Visibility</p>
                  <p className="text-white text-2xl font-mono font-bold">{c.visibilityMiles != null ? c.visibilityMiles : '—'} <span className="text-sm text-[#555]">mi</span></p>
                  <p className="text-[#555] text-[11px] mt-1">
                    {c.visibilityMiles != null ? (c.visibilityMiles >= 6 ? 'Clear conditions' : c.visibilityMiles >= 2 ? 'Reduced visibility' : 'Low visibility') : ''}
                  </p>
                </div>

                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-[#333] uppercase tracking-widest mb-2">Pressure</p>
                  <p className="text-white text-2xl font-mono font-bold">{c.pressureInHg}</p>
                  <p className="text-[#555] text-[11px] mt-1">inHg</p>
                </div>

                {(data.daily[0]?.precipSumIn > 0 || data.daily[0]?.snowSumIn > 0 || c.precipNowIn > 0) && (
                  <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-[#333] uppercase tracking-widest mb-2">Today&apos;s Precip</p>
                    <p className="text-2xl font-mono font-bold text-[#3b82f6]">
                      {data.daily[0].snowSumIn > 0 ? `${data.daily[0].snowSumIn}"` : `${data.daily[0].precipSumIn}"`}
                    </p>
                    <p className="text-[#555] text-[11px] mt-1">{data.daily[0].snowSumIn > 0 ? 'Snow expected' : 'Rain expected'}</p>
                  </div>
                )}

                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-[#333] uppercase tracking-widest mb-2">Sun</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <div>
                      <p className="text-[#555] text-[10px]">Rise</p>
                      <p className="text-white text-sm font-mono font-semibold">{data.todaySunrise}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#555] text-[10px]">Set</p>
                      <p className="text-white text-sm font-mono font-semibold">{data.todaySunset}</p>
                    </div>
                  </div>
                </div>
              </div>

              {data.airQuality && (
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-[#333] uppercase tracking-widest mb-2">Air Quality Guidance</p>
                  <p className="text-[#ccc] text-[13px] leading-relaxed">{data.airQuality.advice}</p>
                  <div className="flex gap-4 mt-3 pt-3 border-t border-[#1a1a1a] text-[11px] text-[#555] font-mono">
                    <span>PM2.5 {data.airQuality.pm25}</span>
                    <span>PM10 {data.airQuality.pm10}</span>
                    <span>Ozone {data.airQuality.ozone}</span>
                  </div>
                </div>
              )}

              <p className="text-center text-[#333] text-[10px] font-mono pt-1">
                Weather via Open-Meteo · Alerts via NWS · Updated {new Date(data.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          )}
        </div>
      </PullToRefresh>


      {expandedDay && <DayDetailModal day={expandedDay} onClose={() => setExpandedDay(null)} />}
      {expandedAlert && <AlertDetailModal alert={expandedAlert} onClose={() => setExpandedAlert(null)} />}
      {showLocationModal && (
        <LocationModal
          onClose={() => setShowLocationModal(false)}
          onSelect={handleSelectLocation}
          onUseCurrent={handleUseCurrent}
        />
      )}
    </>
  );
}