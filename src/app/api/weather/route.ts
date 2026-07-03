import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Reading, PA fallback (home location) if geolocation isn't available
const DEFAULT_LAT = 40.3356;
const DEFAULT_LON = -75.9269;

const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];

function compassDir(deg: number): string {
  return COMPASS[Math.round(deg / 22.5) % 16];
}

function wmoIcon(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? '☀️' : '🌙';
  if ([1, 2].includes(code)) return isDay ? '⛅' : '☁️';
  if (code === 3) return '☁️';
  if ([45, 48].includes(code)) return '🌫️';
  if ([51, 53, 55, 56, 57].includes(code)) return '🌦️';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧️';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '🌨️';
  if ([95, 96, 99].includes(code)) return '⛈️';
  return isDay ? '⛅' : '☁️';
}

function wmoDesc(code: number): string {
  const map: Record<number, string> = {
    0: 'Clear', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Cloudy',
    45: 'Fog', 48: 'Freezing Fog',
    51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
    56: 'Freezing Drizzle', 57: 'Freezing Drizzle',
    61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
    66: 'Freezing Rain', 67: 'Freezing Rain',
    71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow', 77: 'Snow Grains',
    80: 'Rain Showers', 81: 'Rain Showers', 82: 'Heavy Showers',
    85: 'Snow Showers', 86: 'Snow Showers',
    95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Severe Thunderstorm',
  };
  return map[code] || 'Unknown';
}

function hourOf(t: string): number { return parseInt(t.substring(11, 13), 10); }
function dateOf(t: string): string { return t.substring(0, 10); }

function mode(arr: number[]): number {
  if (arr.length === 0) return 0;
  const counts: Record<number, number> = {};
  let best = arr[0], bestCount = 0;
  for (const v of arr) {
    counts[v] = (counts[v] || 0) + 1;
    if (counts[v] > bestCount) { bestCount = counts[v]; best = v; }
  }
  return best;
}

function fmtHour(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
}

function fmtDayLabel(iso: string, idx: number): string {
  if (idx === 0) return 'Today';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function fmtClock(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat') || String(DEFAULT_LAT);
    const lon = searchParams.get('lon') || String(DEFAULT_LON);

    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,uv_index,is_day',
      hourly: 'temperature_2m,precipitation_probability,weather_code,apparent_temperature,is_day',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max',
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      precipitation_unit: 'inch',
      timezone: 'auto',
      forecast_days: '8',
    });

    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error('Weather service unavailable');
    const d = await res.json();

    const cur = d.current;
    const isDayNow = cur.is_day === 1;

    // Current conditions
    const current = {
      tempF: Math.round(cur.temperature_2m),
      feelsLikeF: Math.round(cur.apparent_temperature),
      humidity: Math.round(cur.relative_humidity_2m),
      windMph: Math.round(cur.wind_speed_10m),
      windGustMph: Math.round(cur.wind_gusts_10m),
      windDir: compassDir(cur.wind_direction_10m),
      pressureInHg: (cur.pressure_msl * 0.02953).toFixed(2),
      uvIndex: Math.round(cur.uv_index),
      weatherCode: cur.weather_code,
      desc: wmoDesc(cur.weather_code),
      icon: wmoIcon(cur.weather_code, isDayNow),
      isDay: isDayNow,
    };

    const hourlyTimes: string[] = d.hourly.time;
    const hourlyCodes: number[] = d.hourly.weather_code;
    const hourlyFeels: number[] = d.hourly.apparent_temperature;
    const hourlyPrecip: number[] = d.hourly.precipitation_probability;
    const hourlyIsDay: number[] = d.hourly.is_day;
    const hourlyTemp: number[] = d.hourly.temperature_2m;

    // Hourly — next 24 hours starting from current hour (for the scroll strip + rain chance strip)
    const nowTs = new Date(cur.time).getTime();
    let startIdx = hourlyTimes.findIndex((t: string) => new Date(t).getTime() >= nowTs);
    if (startIdx < 0) startIdx = 0;

    const hourly = hourlyTimes.slice(startIdx, startIdx + 24).map((t: string, i: number) => {
      const idx = startIdx + i;
      const isDay = hourlyIsDay[idx] === 1;
      const code = hourlyCodes[idx];
      return {
        time: i === 0 ? 'Now' : fmtHour(t),
        tempF: Math.round(hourlyTemp[idx]),
        feelsLikeF: Math.round(hourlyFeels[idx]),
        precipProb: hourlyPrecip[idx],
        weatherCode: code,
        icon: wmoIcon(code, isDay),
      };
    });

    // Daily — 8 days, with day/night breakdown computed from the full hourly set
    const daily = d.daily.time.map((date: string, i: number) => {
      const dayIdxs: number[] = [];
      const nightIdxs: number[] = [];
      hourlyTimes.forEach((t, idx) => {
        if (dateOf(t) !== date) return;
        const h = hourOf(t);
        if (h >= 6 && h <= 17) dayIdxs.push(idx);
        else if (h >= 18 && h <= 23) nightIdxs.push(idx);
      });

      const dCode = dayIdxs.length ? mode(dayIdxs.map(idx => hourlyCodes[idx])) : d.daily.weather_code[i];
      const dPrecip = dayIdxs.length ? Math.max(...dayIdxs.map(idx => hourlyPrecip[idx])) : d.daily.precipitation_probability_max[i];
      const dFeels = dayIdxs.length ? Math.round(dayIdxs.reduce((s, idx) => s + hourlyFeels[idx], 0) / dayIdxs.length) : Math.round(d.daily.temperature_2m_max[i]);

      const nCode = nightIdxs.length ? mode(nightIdxs.map(idx => hourlyCodes[idx])) : dCode;
      const nPrecip = nightIdxs.length ? Math.max(...nightIdxs.map(idx => hourlyPrecip[idx])) : dPrecip;
      const nFeels = nightIdxs.length ? Math.round(nightIdxs.reduce((s, idx) => s + hourlyFeels[idx], 0) / nightIdxs.length) : Math.round(d.daily.temperature_2m_min[i]);

      return {
        date,
        dayLabel: fmtDayLabel(date, i),
        maxF: Math.round(d.daily.temperature_2m_max[i]),
        minF: Math.round(d.daily.temperature_2m_min[i]),
        weatherCode: d.daily.weather_code[i],
        icon: wmoIcon(d.daily.weather_code[i], true),
        desc: wmoDesc(d.daily.weather_code[i]),
        precipProbMax: d.daily.precipitation_probability_max[i],
        uvIndexMax: Math.round(d.daily.uv_index_max[i]),
        sunrise: fmtClock(d.daily.sunrise[i]),
        sunset: fmtClock(d.daily.sunset[i]),
        day: { icon: wmoIcon(dCode, true), desc: wmoDesc(dCode), precipProb: dPrecip, feelsF: dFeels },
        night: { icon: wmoIcon(nCode, false), desc: wmoDesc(nCode), precipProb: nPrecip, feelsF: nFeels },
      };
    });

    return NextResponse.json({
      current,
      hourly,
      daily,
      todaySunrise: daily[0]?.sunrise,
      todaySunset: daily[0]?.sunset,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}