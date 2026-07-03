'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import PullToRefresh from '@/components/PullToRefresh';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CurrentWeather {
  tempF: number; feelsLikeF: number; humidity: number;
  windMph: number; windGustMph: number; windDir: string;
  pressureInHg: string; uvIndex: number;
  weatherCode: number; desc: string; icon: string; isDay: boolean;
}
interface HourlyEntry {
  time: string; tempF: number; feelsLikeF: number;
  precipProb: number; weatherCode: number; icon: string;
}
interface DailyEntry {
  date: string; dayLabel: string; maxF: number; minF: number;
  weatherCode: number; icon: string; desc: string;
  precipProbMax: number; uvIndexMax: number; sunrise: string; sunset: string;
}
interface WeatherData {
  current: CurrentWeather;
  hourly: HourlyEntry[];
  daily: DailyEntry[];
  todaySunrise: string;
  todaySunset: string;
  updatedAt: string;
}

const CACHE_KEY = 'weather_page_v1';
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

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-5 h-5 border-2 border-[#f0a050] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ─── Precip Chance Chart ────────────────────────────────────────────────────

function PrecipChart({ hourly }: { hourly: HourlyEntry[] }) {
  const points = hourly.slice(0, 12);
  const w = 700, h = 90, pad = 4;
  const barW = (w - pad * 2) / points.length;
  const maxVal = 100;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[70px]">
      {points.map((p, i) => {
        const barH = Math.max((p.precipProb / maxVal) * (h - 24), p.precipProb > 0 ? 3 : 0);
        const x = pad + i * barW;
        return (
          <g key={i}>
            <rect
              x={x + barW * 0.15}
              y={h - 20 - barH}
              width={barW * 0.7}
              height={barH}
              rx={2}
              fill={p.precipProb >= 50 ? '#3b82f6' : p.precipProb > 0 ? '#3b82f680' : '#1a1a1a'}
            />
            {p.precipProb > 0 && (
              <text x={x + barW / 2} y={h - 20 - barH - 4} textAnchor="middle" fontSize="10" fill="#3b82f6" fontFamily="monospace">
                {p.precipProb}%
              </text>
            )}
            <text x={x + barW / 2} y={h - 6} textAnchor="middle" fontSize="9" fill="#555" fontFamily="monospace">
              {i === 0 ? 'Now' : p.time.replace(' ', '')}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WeatherPage() {
  const router = useRouter();
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [locLabel, setLocLabel] = useState('Reading, PA');
  const [error, setError] = useState('');

  const fetchWeather = useCallback((lat: number, lon: number) => {
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

  const loadAll = useCallback(() => {
    setLoading(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setLocLabel('Current Location');
          fetchWeather(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          setLocLabel('Reading, PA');
          fetchWeather(DEFAULT_LAT, DEFAULT_LON);
        },
        { timeout: 8000 }
      );
    } else {
      fetchWeather(DEFAULT_LAT, DEFAULT_LON);
    }
  }, [fetchWeather]);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) { setData(JSON.parse(cached)); setLoading(false); }
    } catch {}
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const c = data?.current;

  return (
    <>
      <PullToRefresh onRefresh={async () => loadAll()}>
        <div className="min-h-screen bg-black pb-24">
          {/* Header */}
          <div className="px-4 pt-6 pb-2">
            <p className="text-[#555] text-xs font-semibold uppercase tracking-wider">{locLabel}</p>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, system-ui, sans-serif' }}>
              Weather
            </h1>
          </div>

          {loading && !data && <Spinner />}

          {error && !data && (
            <div className="px-4 pt-8 text-center">
              <p className="text-[#555] text-sm">{error}</p>
            </div>
          )}

          {c && data && (
            <div className="px-4 pt-2 space-y-3">

              {/* Current conditions hero */}
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 text-center">
                <p className="text-6xl mb-1">{c.icon}</p>
                <p className="text-white text-6xl font-mono font-bold leading-none mt-2">{c.tempF}°</p>
                <p className="text-[#ccc] text-sm mt-2">{c.desc}</p>
                <p className="text-[#555] text-xs mt-1 font-mono">
                  Feels like {c.feelsLikeF}° · H:{data.daily[0]?.maxF}° L:{data.daily[0]?.minF}°
                </p>
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

              {/* Precip chance chart */}
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                <p className="text-[10px] font-bold text-[#333] uppercase tracking-widest mb-2">Chance of Rain — Next 12h</p>
                <PrecipChart hourly={data.hourly} />
              </div>

              {/* 8-day forecast */}
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
                        className={`flex items-center gap-3 py-2.5 ${i < data.daily.length - 1 ? 'border-b border-[#1a1a1a]/60' : ''}`}
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
                  <p className="text-[10px] font-bold text-[#333] uppercase tracking-widest mb-2">Pressure</p>
                  <p className="text-white text-2xl font-mono font-bold">{c.pressureInHg}</p>
                  <p className="text-[#555] text-[11px] mt-1">inHg</p>
                </div>

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

              <p className="text-center text-[#333] text-[10px] font-mono pt-1">
                Data via Open-Meteo · Updated {new Date(data.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          )}
        </div>
      </PullToRefresh>
      <BottomNav active="more" />
    </>
  );
}