/**
 * Offline router: when no model is available, simple rules pick tools and arguments.
 * It is deliberately literal (regexes, no understanding) and is labelled as such in the UI.
 */
import { evaluate } from './calc'
import { unitKey } from './tools'

export interface PlannedCall { name: string; arguments: Record<string, unknown>; why: string }

const WORD_OPS: Array<[RegExp, string]> = [
  [/\bplus\b/g, '+'], [/\bminus\b/g, '-'], [/\b(times|multiplied by)\b/g, '*'], [/\bdivided by\b/g, '/'],
  [/\bsquared\b/g, '^2'], [/\bcubed\b/g, '^3'], [/\bsquare root of\b/g, 'sqrt'], [/\bpercent\b/g, '%'],
]

const MATH_RUN = /(?:\bsqrt\b|\bpi\b|\bof\b|\d[\d.,]*|\.\d+|[-+*/^%()×÷]|\bx\b)(?:\s*(?:\bsqrt\b|\bpi\b|\bof\b|\d[\d.,]*|\.\d+|[-+*/^%()×÷]|\bx\b))*/g

function mathExpression(clause: string): string | null {
  let s = clause.toLowerCase()
  for (const [re, op] of WORD_OPS) s = s.replace(re, op)
  s = s
    .replace(/\b(the|a|an|then|what|is|what's|whats|calculate|compute|equals?)\b/g, ' ')
    .replace(/,(?=\s*(?:[^\d\s]|$))/g, ' ') // commas that end a phrase, not argument separators
    .replace(/sqrt\s*(?:of\s*)?([\d.,]+)/g, 'sqrt($1)')
  let best: string | null = null
  for (const m of s.matchAll(MATH_RUN)) {
    const expr = m[0].replace(/\s+/g, ' ').trim().replace(/^(of\s+)+|(\s+of)+$/g, '')
    if (!/\d/.test(expr) || !/[-+*/^%x×÷]|\bof\b|sqrt/.test(expr)) continue
    try { evaluate(expr) } catch { continue }
    if (!best || expr.length > best.length) best = expr
  }
  return best
}

const UNIT_WORD = '(km\\/h|m\\/s|kph|mph|kwh|mj|km|cm|mm|mi|miles?|m|ft|feet|foot|inch(?:es)?|in|kg|kilos?|g|grams?|lbs?|pounds?|oz|ounces?|l|litres?|liters?|ml|gal(?:lons?)?|°?c|°?f|celsius|fahrenheit|kelvin|k)'
const CONVERT = new RegExp(`(-?[\\d.,]+)\\s*${UNIT_WORD}\\s+(?:to|in|into)\\s+${UNIT_WORD}\\b`, 'i')

function conversion(clause: string): PlannedCall | null {
  const m = CONVERT.exec(clause)
  if (!m?.[1] || !m[2] || !m[3]) return null
  const value = Number(m[1].replace(/,/g, ''))
  if (!Number.isFinite(value)) return null
  return { name: 'convert_units', arguments: { value, from: unitKey(m[2]), to: unitKey(m[3]) }, why: `"${m[0]}" looks like a unit conversion` }
}

const WEATHER = /\b(weather|forecast|temperature|rain|raining|snow|sunny|wind|umbrella|hot|cold)\b/i
const CITY = /\b(?:in|for|at)\s+([A-Z][\p{L}.'-]*(?:[\s-][A-Z][\p{L}.'-]*)*(?:,\s*[A-Z][\p{L}]*)?)/u

function weatherCall(clause: string, whole: string): PlannedCall | null {
  if (!WEATHER.test(clause)) return null
  const ok = (c: string | undefined) => (c && !/^(fahrenheit|celsius|kelvin)\b/i.test(c) ? c.replace(/[.,]+$/, '') : undefined)
  const city = ok(CITY.exec(clause)?.[1]) ?? ok(CITY.exec(whole)?.[1])
  if (!city) return null
  const days = /\bweek\b/i.test(clause) ? 7 : /\b(\d)\s*days?\b/i.exec(clause)?.[1] ? Number(/\b(\d)\s*days?\b/i.exec(clause)?.[1]) : /\btomorrow\b/i.test(clause) ? 2 : 3
  const units = /fahrenheit|°f\b/i.test(whole) ? 'fahrenheit' : 'celsius'
  return { name: 'get_weather', arguments: { city, days: Math.min(7, Math.max(1, days)), units }, why: `weather words plus a place ("${city}")` }
}

/** Split a prompt into clauses and pick at most one tool per clause (max 4 calls). */
export function routeOffline(prompt: string, enabled: Set<string>): PlannedCall[] {
  const clauses = prompt.split(/(?:\?|;|\.\s|\band then\b|\band also\b|,\s*and\b|\band\b(?=\s+(?:what|how|find|search|convert|which|will|is|give)))/i).map((c) => c.trim()).filter((c) => c.length > 2)
  const out: PlannedCall[] = []
  for (const clause of clauses.length ? clauses : [prompt]) {
    const conv = enabled.has('convert_units') ? conversion(clause) : null
    if (conv) { out.push(conv); continue }
    const w = enabled.has('get_weather') ? weatherCall(clause, prompt) : null
    if (w) {
      // A second weather clause about the same place ("...in Fahrenheit") is not a second call.
      if (!out.some((c) => c.name === 'get_weather' && c.arguments.city === w.arguments.city)) out.push(w)
      continue
    }
    const expr = enabled.has('calculator') ? mathExpression(clause) : null
    if (expr) { out.push({ name: 'calculator', arguments: { expression: expr }, why: 'digits joined by operators' }); continue }
    if (enabled.has('search_site') && /[a-z]{3,}/i.test(clause) && !/^(please|thanks?|hi|hello)\b/i.test(clause)) {
      const query = clause.replace(/^(which|what|who|where|when|how|find|search( for)?|show me|tell me about|list)\s+/i, '').replace(/[?.!]+$/, '')
      out.push({ name: 'search_site', arguments: { query, limit: 3 }, why: 'no maths, units or weather words, so search the site' })
    }
  }
  // De-duplicate identical calls and cap the fan-out.
  const seen = new Set<string>()
  return out.filter((c) => { const k = `${c.name}:${JSON.stringify(c.arguments)}`; if (seen.has(k)) return false; seen.add(k); return true }).slice(0, 4)
}
