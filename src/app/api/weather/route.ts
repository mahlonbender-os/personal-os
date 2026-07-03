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

function fmtClock(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function moonPhaseLabel(phase: number): string {
  if (phase < 0.03 || phase > 0.97) return 'New Moon';
  if (phase < 0.22) return 'Waxing Crescent';
  if (phase < 0.28) return 'First Quarter';
  if (phase < 0.47) return 'Waxing Gibbous';
  if (phase < 0.53) return 'Full Moon';
  if (phase < 0.72) return 'Waning Gibbous';
  if (phase < 0.78) return 'Last Quarter';
  return 'Waning Crescent';
}
function moonPhaseIcon(phase: number): string {
  if (phase < 0.03 || phase > 0.97) return '🌑';
  if (phase < 0.22) return '🌒';
  if (phase < 0.28) return '🌓';
  if (phase < 0.47) return '🌔';
  if (phase < 0.53) return '🌕';
  if (phase < 0.72) return '🌖';
  if (phase < 0.78) return '🌗';
  return '🌘';
}

function aqiCategory(aqi: number): { label: string; color: string; advice: string } {
  if (aqi <= 50) return { label: 'Good', color: '#22c55e', advice: 'Air quality is satisfactory for everyone.' };
  if (aqi <= 100) return { label: 'Moderate', color: '#eab308', advice: 'Acceptable air quality. Unusually sensitive people should consider limiting prolonged outdoor exertion.' };
  if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', color: '#f59e0b', advice: 'People with heart or lung disease, older adults, and children should reduce prolonged outdoor exertion.' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#ef4444', advice: 'Everyone may begin to experience health effects; sensitive groups may experience more serious effects.' };
  if (aqi <= 300) return { label: 'Very Unhealthy', color: '#a855f7', advice: 'Health alert — everyone may experience more serious health effects.' };
  return { label: 'Hazardous', color: '#7f1d1d', advice: 'Health warning of emergency conditions. The entire population is likely affected.' };
}

function heatColdRisk(feelsLikeF: number): { label: string; color: string } | null {
  if (feelsLikeF >= 125) return { label: 'Extreme Danger — Heat Stroke Likely', color: '#7f1d1d' };
  if (feelsLikeF >= 103) return { label: 'Danger — Heat Exhaustion Likely', color: '#ef4444' };
  if (feelsLikeF >= 90) return { label: 'Extreme Caution — Heat Cramps Possible', color: '#f59e0b' };
  if (feelsLikeF >= 80) return { label: 'Caution — Fatigue Possible with Exertion', color: '#eab308' };
  if (feelsLikeF <= 0) return { label: 'Danger — Frostbite Risk in Minutes', color: '#7f1d1d' };
  if (feelsLikeF <= 15) return { label: 'Extreme Cold — Limit Time Outdoors', color: '#3b82f6' };
  if (feelsLikeF <= 32) return { label: 'Cold — Dress in Layers', color: '#60a5fa' };
  return null;
}

interface AlertOut {
  event: string; headline: string; severity: string;
  description: string; instruction: string; effective: string; expires: string;
}

async function fetchAlerts(lat: number, lon: number): Promise<AlertOut[]> {
  // NWS only covers the US and territories — skip the call entirely outside that rough bounding box
  if (lat < 15 || lat > 72 || lon < -180 || lon > -60) return [];
  try {
    const res = await fetch(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`, {
      headers: {
        'User-Agent': '(Personal OS weather page, contact: mahlonbender-os on GitHub)',
        'Accept': 'application/geo+json',
      },
    });
    if (!res.ok) return [];
    const d = await res.json();
    interface NWSFeature { properties: { event: string; headline: string; severity: string; description: string; instruction: string; effective: string; expires: string } }
    return (d.features || []).slice(0, 5).map((f: NWSFeature) => ({
      event: f.properties.event,
      headline: f.properties.headline,
      severity: f.properties.severity,
      description: (f.properties.description || '').slice(0, 600),
      instruction: f.properties.instruction || '',
      effective: f.properties.effective,
      expires: f.properties.expires,
    }));
  } catch {
    return [];
  }
}

async function fetchAirQuality(lat: number, lon: number) {
  try {
    const params = new URLSearchParams({
      latitude: String(lat), longitude: String(lon),
      current: 'us_aqi,pm2_5,pm10,ozone',
      timezone: 'auto',
    });
    const res = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`);
    if (!res.ok) return null;
    const d = await res.json();
    const c = d.current;
    if (!c || c.us_aqi == null) return null;
    const aqi = Math.round(c.us_aqi);
    const cat = aqiCategory(aqi);
    return { aqi, pm25: Math.round(c.pm2_5), pm10: Math.round(c.pm10), ozone: Math.round(c.ozone), ...cat };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || String(DEFAULT_LAT));
    const lon = parseFloat(searchParams.get('lon') || String(DEFAULT_LON));

    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,uv_index,is_day,dew_point_2m',
      hourly: 'temperature_2m,precipitation_probability,weather_code,apparent_temperature,is_day,dew_point_2m,visibility',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,precipitation_sum,rain_sum,snowfall_sum,moon_phase,moonrise,moonset',
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      precipitation_unit: 'inch',
      timezone: 'auto',
      forecast_days: '8',
    });

    const [forecastRes, alerts, airQuality] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?${params}`),
      fetchAlerts(lat, lon),
      fetchAirQuality(lat, lon),
    ]);

    if (!forecastRes.ok) throw new Error('Weather service unavailable');
    const d = await forecastRes.json();

    const cur = d.current;
    const isDayNow = cur.is_day === 1;

    const hourlyTimes: string[] = d.hourly.time;
    const hourlyCodes: number[] = d.hourly.weather_code;
    const hourlyFeels: number[] = d.hourly.apparent_temperature;
    const hourlyPrecip: number[] = d.hourly.precipitation_probability;
    const hourlyIsDay: number[] = d.hourly.is_day;
    const hourlyTemp: number[] = d.hourly.temperature_2m;
    const hourlyVisibility: number[] = d.hourly.visibility;

    const nowTs = new Date(cur.time).getTime();
    let startIdx = hourlyTimes.findIndex((t: string) => new Date(t).getTime() >= nowTs);
    if (startIdx < 0) startIdx = 0;

    const feelsLikeF = Math.round(cur.apparent_temperature);

    // Current conditions
    const current = {
      tempF: Math.round(cur.temperature_2m),
      feelsLikeF,
      humidity: Math.round(cur.relative_humidity_2m),
      dewPointF: Math.round(cur.dew_point_2m),
      windMph: Math.round(cur.wind_speed_10m),
      windGustMph: Math.round(cur.wind_gusts_10m),
      windDir: compassDir(cur.wind_direction_10m),
      pressureInHg: (cur.pressure_msl * 0.02953).toFixed(2),
      uvIndex: Math.round(cur.uv_index),
      visibilityMiles: hourlyVisibility[startIdx] != null ? Math.round((hourlyVisibility[startIdx] / 1609.34) * 10) / 10 : null,
      precipNowIn: Math.round((cur.precipitation || 0) * 100) / 100,
      weatherCode: cur.weather_code,
      desc: wmoDesc(cur.weather_code),
      icon: wmoIcon(cur.weather_code, isDayNow),
      isDay: isDayNow,
      risk: heatColdRisk(feelsLikeF),
    };

    // Hourly — next 24 hours starting from current hour
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
        precipSumIn: Math.round((d.daily.precipitation_sum[i] || 0) * 100) / 100,
        snowSumIn: Math.round((d.daily.snowfall_sum[i] || 0) * 100) / 100,
        uvIndexMax: Math.round(d.daily.uv_index_max[i]),
        sunrise: fmtClock(d.daily.sunrise[i]),
        sunset: fmtClock(d.daily.sunset[i]),
        day: { icon: wmoIcon(dCode, true), desc: wmoDesc(dCode), precipProb: dPrecip, feelsF: dFeels },
        night: { icon: wmoIcon(nCode, false), desc: wmoDesc(nCode), precipProb: nPrecip, feelsF: nFeels },
      };
    });

    const moonPhaseVal = d.daily.moon_phase?.[0];
    const moon = moonPhaseVal != null ? {
      phase: moonPhaseVal,
      label: moonPhaseLabel(moonPhaseVal),
      icon: moonPhaseIcon(moonPhaseVal),
      moonrise: fmtClock(d.daily.moonrise?.[0]),
      moonset: fmtClock(d.daily.moonset?.[0]),
    } : null;

    return NextResponse.json({
      current,
      hourly,
      daily,
      alerts,
      airQuality,
      moon,
      todaySunrise: daily[0]?.sunrise,
      todaySunset: daily[0]?.sunset,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}