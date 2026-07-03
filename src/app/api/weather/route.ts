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

    // Hourly — next 24 hours starting from current hour
    const nowTs = new Date(cur.time).getTime();
    const hourlyTimes: string[] = d.hourly.time;
    let startIdx = hourlyTimes.findIndex((t: string) => new Date(t).getTime() >= nowTs);
    if (startIdx < 0) startIdx = 0;

    const hourly = hourlyTimes.slice(startIdx, startIdx + 24).map((t: string, i: number) => {
      const idx = startIdx + i;
      const isDay = d.hourly.is_day[idx] === 1;
      const code = d.hourly.weather_code[idx];
      return {
        time: i === 0 ? 'Now' : fmtHour(t),
        tempF: Math.round(d.hourly.temperature_2m[idx]),
        feelsLikeF: Math.round(d.hourly.apparent_temperature[idx]),
        precipProb: d.hourly.precipitation_probability[idx],
        weatherCode: code,
        icon: wmoIcon(code, isDay),
      };
    });

    // Daily — 8 days
    const daily = d.daily.time.map((date: string, i: number) => ({
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
    }));

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