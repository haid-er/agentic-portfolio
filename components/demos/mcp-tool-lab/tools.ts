/**
 * The MCP server's tools: JSON-schema definitions (what the model sees) plus handlers
 * (what actually runs, in your browser). Arguments are validated again with zod on the
 * server side, so an edited schema that no longer matches returns an isError result.
 */
import { z } from 'zod'
import { getCorpus, nameStopwords } from '@/components/demos/ask-malik/corpus'
import { bestSentence, buildBm25, hybridSearch, type Bm25Index } from '@/components/demos/ask-malik/search'
import { evaluate, formatNumber } from './calc'

export interface ToolOutput {
  /** Short text block for the model (MCP content[0].text). */
  text: string
  /** Machine-readable result (MCP structuredContent). */
  structured?: Record<string, unknown>
}

export interface ToolSpec {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  /** Calls a public API over the network (Open-Meteo). */
  network: boolean
  /** Arguments for the "Try it" button. */
  example: Record<string, unknown>
  args: z.ZodType
  run: (args: never, signal: AbortSignal) => Promise<ToolOutput>
}

/* ---------------- calculator ---------------- */

const CalcArgs = z.object({ expression: z.string().min(1).max(200) })

const calculator: ToolSpec = {
  name: 'calculator',
  title: 'Calculator',
  description: 'Evaluate an arithmetic expression exactly. Supports + - * / ^, %, "x% of y", parentheses, pi, e, sqrt, abs, round(x, digits), min, max, log, ln, sin, cos, tan. Use it for any arithmetic instead of computing in your head.',
  inputSchema: {
    type: 'object',
    properties: { expression: { type: 'string', description: 'e.g. "17.5% of 2340 + sqrt(1764)"' } },
    required: ['expression'],
    additionalProperties: false,
  },
  network: false,
  example: { expression: '17.5% of 2340 + sqrt(1764)' },
  args: CalcArgs,
  run: async (a: z.infer<typeof CalcArgs>) => {
    const value = evaluate(a.expression)
    return { text: `${a.expression} = ${formatNumber(value)}`, structured: { expression: a.expression, value } }
  },
}

/* ---------------- weather (Open-Meteo, keyless) ---------------- */

const WeatherArgs = z.object({
  city: z.string().min(2).max(80),
  days: z.coerce.number().int().min(1).max(7).optional(),
  units: z.enum(['celsius', 'fahrenheit']).optional(),
})

const WMO: Record<number, string> = {
  0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'rime fog',
  51: 'light drizzle', 53: 'drizzle', 55: 'dense drizzle', 56: 'freezing drizzle', 57: 'freezing drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains', 80: 'rain showers', 81: 'rain showers',
  82: 'violent rain showers', 85: 'snow showers', 86: 'snow showers', 95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail',
}

const GeoResult = z.object({
  results: z.array(z.object({ name: z.string(), country: z.string().optional(), latitude: z.number(), longitude: z.number(), timezone: z.string().optional() })).optional(),
})
const Forecast = z.object({
  current: z.object({ time: z.string(), temperature_2m: z.number(), weather_code: z.number(), wind_speed_10m: z.number() }),
  daily: z.object({
    time: z.array(z.string()),
    weather_code: z.array(z.number()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    precipitation_probability_max: z.array(z.number().nullable()),
  }),
})

const cache = new Map<string, { at: number; out: ToolOutput }>()

async function getJson(url: string, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}`)
  return res.json()
}

const weather: ToolSpec = {
  name: 'get_weather',
  title: 'Weather (Open-Meteo)',
  description: 'Current weather and a daily forecast (max/min temperature, rain chance, conditions) for a city, from the free Open-Meteo API. Use it for any weather question; never guess weather.',
  inputSchema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: 'City name, optionally with country, e.g. "Lahore" or "London, UK"' },
      days: { type: 'integer', minimum: 1, maximum: 7, description: 'Forecast days including today (default 3)' },
      units: { type: 'string', enum: ['celsius', 'fahrenheit'], description: 'Temperature unit (default celsius)' },
    },
    required: ['city'],
    additionalProperties: false,
  },
  network: true,
  example: { city: 'Lahore', days: 3 },
  args: WeatherArgs,
  run: async (a: z.infer<typeof WeatherArgs>, signal: AbortSignal) => {
    const days = a.days ?? 3
    const units = a.units ?? 'celsius'
    const key = `${a.city.toLowerCase()}|${days}|${units}`
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < 10 * 60_000) return hit.out
    const name = a.city.split(',')[0]?.trim() ?? a.city
    const geo = GeoResult.parse(await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`, signal))
    const place = geo.results?.[0]
    if (!place) throw new Error(`No place called "${a.city}" found`)
    const u = units === 'fahrenheit' ? '°F' : '°C'
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&current=temperature_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&forecast_days=${days}${units === 'fahrenheit' ? '&temperature_unit=fahrenheit' : ''}`
    const f = Forecast.parse(await getJson(url, signal))
    const daily = f.daily.time.map((date, i) => ({
      date,
      conditions: WMO[f.daily.weather_code[i] ?? -1] ?? 'unknown',
      max: f.daily.temperature_2m_max[i] ?? null,
      min: f.daily.temperature_2m_min[i] ?? null,
      rainChance: f.daily.precipitation_probability_max[i] ?? null,
    }))
    const where = [place.name, place.country].filter(Boolean).join(', ')
    const text = [
      `${where} now (${f.current.time} local): ${f.current.temperature_2m}${u}, ${WMO[f.current.weather_code] ?? 'unknown'}, wind ${f.current.wind_speed_10m} km/h.`,
      ...daily.map((d) => `${d.date}: ${d.conditions}, ${d.min}–${d.max}${u}${d.rainChance != null ? `, rain chance ${d.rainChance}%` : ''}.`),
    ].join('\n')
    const out: ToolOutput = { text, structured: { place: where, latitude: place.latitude, longitude: place.longitude, units, current: f.current, daily, source: 'open-meteo.com' } }
    cache.set(key, { at: Date.now(), out })
    return out
  },
}

/* ---------------- unit conversion ---------------- */

const UNITS: Record<string, { dim: string; f: number }> = {
  m: { dim: 'length', f: 1 }, km: { dim: 'length', f: 1000 }, cm: { dim: 'length', f: 0.01 }, mm: { dim: 'length', f: 0.001 },
  mi: { dim: 'length', f: 1609.344 }, ft: { dim: 'length', f: 0.3048 }, in: { dim: 'length', f: 0.0254 }, yd: { dim: 'length', f: 0.9144 },
  kg: { dim: 'mass', f: 1 }, g: { dim: 'mass', f: 0.001 }, lb: { dim: 'mass', f: 0.45359237 }, oz: { dim: 'mass', f: 0.028349523125 }, t: { dim: 'mass', f: 1000 },
  'km/h': { dim: 'speed', f: 1 / 3.6 }, mph: { dim: 'speed', f: 0.44704 }, 'm/s': { dim: 'speed', f: 1 }, kn: { dim: 'speed', f: 0.514444 },
  l: { dim: 'volume', f: 1 }, ml: { dim: 'volume', f: 0.001 }, gal: { dim: 'volume', f: 3.785411784 },
  kwh: { dim: 'energy', f: 3.6e6 }, mj: { dim: 'energy', f: 1e6 }, j: { dim: 'energy', f: 1 },
}
const ALIAS: Record<string, string> = {
  meter: 'm', meters: 'm', metre: 'm', metres: 'm', kilometer: 'km', kilometers: 'km', kilometres: 'km', mile: 'mi', miles: 'mi',
  foot: 'ft', feet: 'ft', inch: 'in', inches: 'in', kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg', gram: 'g', grams: 'g',
  pound: 'lb', pounds: 'lb', lbs: 'lb', ounce: 'oz', ounces: 'oz', tonne: 't', tonnes: 't', kph: 'km/h', kmh: 'km/h',
  litre: 'l', liter: 'l', litres: 'l', liters: 'l', gallon: 'gal', gallons: 'gal', knots: 'kn',
  c: 'c', '°c': 'c', celsius: 'c', f: 'f', '°f': 'f', fahrenheit: 'f', k: 'k', kelvin: 'k',
}
export const unitKey = (u: string) => { const s = u.trim().toLowerCase(); return ALIAS[s] ?? s }

function convert(value: number, from: string, to: string): number {
  const a = unitKey(from), b = unitKey(to)
  const temp = ['c', 'f', 'k']
  if (temp.includes(a) && temp.includes(b)) {
    const c = a === 'c' ? value : a === 'f' ? (value - 32) * (5 / 9) : value - 273.15
    return b === 'c' ? c : b === 'f' ? c * (9 / 5) + 32 : c + 273.15
  }
  const ua = UNITS[a], ub = UNITS[b]
  if (!ua || !ub) throw new Error(`Unknown unit "${!ua ? from : to}"`)
  if (ua.dim !== ub.dim) throw new Error(`Cannot convert ${ua.dim} (${from}) to ${ub.dim} (${to})`)
  return (value * ua.f) / ub.f
}

const ConvertArgs = z.object({ value: z.coerce.number(), from: z.string().min(1).max(20), to: z.string().min(1).max(20) })

const convertUnits: ToolSpec = {
  name: 'convert_units',
  title: 'Unit converter',
  description: 'Convert a value between units of length (m, km, mi, ft, in), mass (kg, g, lb, oz), speed (km/h, mph, m/s), volume (l, ml, gal), energy (kWh, MJ, J) or temperature (C, F, K).',
  inputSchema: {
    type: 'object',
    properties: {
      value: { type: 'number' },
      from: { type: 'string', description: 'Unit to convert from, e.g. "km" or "C"' },
      to: { type: 'string', description: 'Unit to convert to, e.g. "mi" or "F"' },
    },
    required: ['value', 'from', 'to'],
    additionalProperties: false,
  },
  network: false,
  example: { value: 42.195, from: 'km', to: 'mi' },
  args: ConvertArgs,
  run: async (a: z.infer<typeof ConvertArgs>) => {
    const result = convert(a.value, a.from, a.to)
    return { text: `${formatNumber(a.value)} ${a.from} = ${formatNumber(Number(result.toPrecision(8)))} ${a.to}`, structured: { value: a.value, from: a.from, to: a.to, result } }
  },
}

/* ---------------- site search (BM25 over this portfolio) ---------------- */

const SearchArgs = z.object({ query: z.string().min(2).max(200), limit: z.coerce.number().int().min(1).max(5).optional() })

let index: Bm25Index | null = null

const siteSearch: ToolSpec = {
  name: 'search_site',
  title: 'Site search',
  description: "Search this portfolio's own content (roles, projects, research, skills, services and playground demos) with BM25. Returns titles, links and the best-matching sentence. Use it for any question about the portfolio or its owner.",
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Keywords, e.g. "message queues demo"' },
      limit: { type: 'integer', minimum: 1, maximum: 5, description: 'Max results (default 3)' },
    },
    required: ['query'],
    additionalProperties: false,
  },
  network: false,
  example: { query: 'agents demo', limit: 3 },
  args: SearchArgs,
  run: async (a: z.infer<typeof SearchArgs>) => {
    const chunks = getCorpus()
    index ??= buildBm25(chunks, nameStopwords())
    const hits = hybridSearch({ chunks, index, query: a.query, k: a.limit ?? 3 })
    const results = hits.map((h) => ({ title: h.chunk.title, section: h.chunk.section, url: h.chunk.href, snippet: bestSentence(h.chunk.text, a.query), score: Number(h.bm25.toFixed(3)) }))
    const text = results.length
      ? results.map((r, i) => `${i + 1}. ${r.title} (${r.section}, ${r.url}): ${r.snippet}`).join('\n')
      : `No results for "${a.query}".`
    return { text, structured: { query: a.query, results } }
  },
}

export const TOOLS: readonly ToolSpec[] = [calculator, weather, convertUnits, siteSearch]
export const getTool = (name: string) => TOOLS.find((t) => t.name === name)
