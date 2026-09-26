/**
 * Offline extractor: a small rule-based reader for plain ownership sentences.
 * It covers the phrasings used in filings summaries ("X owns 70% of Y", "Y is a wholly owned
 * subsidiary of X", "X operates Y", "X: 1,200 tCO2e"). Free-form prose goes to the AI path.
 */
import { type Control, type Group, type Link, slugId, uniqueId } from './model'

/** A capitalised run of words, allowing common lowercase legal suffixes ("plc") and "&". */
const WORD = String.raw`(?:[A-Z][\w&'’.-]*|plc|ltd|&)`
const ENT = String.raw`(${WORD}(?:\s+${WORD})*)`
const PCT = String.raw`(\d{1,3}(?:\.\d+)?)\s*(?:%|per\s?cent)`

const LEADING = /^(?:The|Also|And|In|Additionally|Finally|Meanwhile|Separately|Its|It|Then|Through|Via)\s+/

interface Draft {
  names: Map<string, string>
  links: Map<string, { owner: string; owned: string; equityPct: number | null; control: Control }>
  emissions: Map<string, number>
  parent: string | null
  order: string[]
}

function clean(raw: string): string {
  let s = raw.trim().replace(/[.,;:]+$/, '')
  while (LEADING.test(s)) s = s.replace(LEADING, '')
  return s
}

function key(d: Draft, raw: string): string {
  const name = clean(raw)
  const k = name.toLowerCase()
  if (!d.names.has(k)) { d.names.set(k, name); d.order.push(k) }
  return k
}

function link(d: Draft, ownerRaw: string, ownedRaw: string, patch: { equityPct?: number; control?: Control }) {
  const owner = key(d, ownerRaw)
  const owned = key(d, ownedRaw)
  if (owner === owned) return
  const k = `${owner}>${owned}`
  const cur = d.links.get(k) ?? { owner, owned, equityPct: null, control: 'unstated' as Control }
  if (patch.equityPct != null) cur.equityPct = patch.equityPct
  if (patch.control) cur.control = mergeControl(cur.control, patch.control)
  d.links.set(k, cur)
}

/** Later statements refine earlier ones: "joint" + "operates" = operational; "financial" + "operational" = full. */
function mergeControl(a: Control, b: Control): Control {
  if (a === 'unstated' || a === b) return b
  const set = new Set([a, b])
  if (set.has('operational') && set.has('financial')) return 'full'
  if (set.has('full')) return 'full'
  if (set.has('operational')) return 'operational'
  if (set.has('financial')) return 'financial'
  return b
}

const num = (s: string) => Number(s.replace(/,/g, ''))

const RULES: Array<{ re: RegExp; apply: (d: Draft, m: RegExpExecArray) => void }> = [
  { // X is the reporting entity / parent
    re: new RegExp(String.raw`${ENT}\s+is\s+the\s+(?:reporting\s+entity|(?:ultimate\s+)?parent(?:\s+company)?)`, 'g'),
    apply: (d, m) => { d.parent = key(d, m[1]) },
  },
  { // A and B each own 50% of C
    re: new RegExp(String.raw`${ENT}\s+and\s+${ENT}\s+each\s+(?:own|hold)s?\s+(?:a\s+)?${PCT}\s*(?:stake\s+|interest\s+|equity\s+)?(?:in|of)\s+${ENT}`, 'g'),
    apply: (d, m) => { link(d, m[1], m[4], { equityPct: num(m[3]) }); link(d, m[2], m[4], { equityPct: num(m[3]) }) },
  },
  { // A and B share joint control of C
    re: new RegExp(String.raw`${ENT}\s+and\s+${ENT}\s+(?:share|have|exercise|hold)\s+joint\s+control\s+(?:of|over)\s+${ENT}`, 'g'),
    apply: (d, m) => { link(d, m[1], m[3], { control: 'joint' }); link(d, m[2], m[3], { control: 'joint' }) },
  },
  { // A owns / holds a 70% stake in B
    re: new RegExp(String.raw`${ENT}\s+(?:directly\s+|indirectly\s+|also\s+)?(?:owns|holds|has|retains|acquired)\s+(?:a\s+|an\s+|the\s+(?:other|remaining)\s+)?${PCT}\s*(?:stake|interest|shareholding|equity(?:\s+interest)?|of\s+the\s+shares)?\s*(?:in|of)\s+${ENT}`, 'g'),
    apply: (d, m) => link(d, m[1], m[3], { equityPct: num(m[2]) }),
  },
  { // B is a wholly owned subsidiary of A
    re: new RegExp(String.raw`${ENT}\s+is\s+(?:a\s+)?(?:wholly[\s-]owned|100%[\s-]owned)(?:\s+subsidiary)?\s+(?:of|by)\s+${ENT}`, 'g'),
    apply: (d, m) => link(d, m[2], m[1], { equityPct: 100 }),
  },
  { // B is 60% owned by A
    re: new RegExp(String.raw`${ENT}\s+is\s+${PCT}[\s-]owned\s+by\s+${ENT}`, 'g'),
    apply: (d, m) => link(d, m[3], m[1], { equityPct: num(m[2]) }),
  },
  { // A has operational / financial / joint / no control of B
    re: new RegExp(String.raw`${ENT}\s+(?:has|holds|retains|exercises)\s+(operational|financial|joint|no)\s+control\s+(?:of|over)\s+${ENT}`, 'g'),
    apply: (d, m) => {
      const c = m[2] === 'no' ? 'none' : (m[2] as Control)
      link(d, m[1], m[3], { control: c })
    },
  },
  { // A owns 40% of B and has operational control of B
    re: new RegExp(String.raw`${ENT}\s+(?:owns|holds|has|retains|acquired)\s[^.;]*?\s+and\s+(?:has|holds|retains|exercises)\s+(operational|financial|joint|no)\s+control\s+(?:of|over)\s+${ENT}`, 'g'),
    apply: (d, m) => {
      const c = m[2] === 'no' ? 'none' : (m[2] as Control)
      link(d, m[1], m[3], { control: c })
    },
  },
  { // A operates B / B is operated by A
    re: new RegExp(String.raw`${ENT}\s+operates\s+${ENT}`, 'g'),
    apply: (d, m) => link(d, m[1], m[2], { control: 'operational' }),
  },
  {
    re: new RegExp(String.raw`${ENT}\s+is\s+operated\s+by\s+${ENT}`, 'g'),
    apply: (d, m) => link(d, m[2], m[1], { control: 'operational' }),
  },
  { // A: 1,200 tCO2e / A emits 1,200 tCO2e / A 1,200 tCO2e
    re: new RegExp(String.raw`${ENT}\s*(?::|,|\s(?:emits|emitted|reported|reports))?\s*(\d[\d,]*(?:\.\d+)?)\s*(k?t|tonnes)\s*CO2e?`, 'g'),
    apply: (d, m) => {
      const k = key(d, m[1])
      d.emissions.set(k, num(m[2]) * (m[3] === 'kt' ? 1000 : 1))
    },
  },
]

export interface ParseResult {
  group: Group | null
  /** How many rule matches fired: 0 means "try the AI path". */
  hits: number
}

export function parseOwnership(text: string): ParseResult {
  const d: Draft = { names: new Map(), links: new Map(), emissions: new Map(), parent: null, order: [] }
  let hits = 0
  // Sentence-ish segments stop entity runs from spilling across sentences.
  const segments = text.replace(/ /g, ' ').split(/(?<=[.;!?])\s+|\n+/)
  for (const seg of segments) {
    const s = seg.replace(/^[^:]*emissions[^:]*:\s*/i, '') // "Scope 1 and 2 emissions: A 1,200 tCO2e"
    for (const rule of RULES) {
      rule.re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = rule.re.exec(s))) { rule.apply(d, m); hits++ }
    }
  }
  const links = [...d.links.values()]
  if (!links.length) return { group: null, hits }

  // Only keep names that take part in a link (emission-only mentions of unknown names are noise).
  const used = new Set<string>(links.flatMap((l) => [l.owner, l.owned]))
  const taken = new Set<string>()
  const idOf = new Map<string, string>()
  for (const k of d.order) if (used.has(k)) idOf.set(k, uniqueId(slugId(d.names.get(k) ?? k), taken))

  const owned = new Set(links.map((l) => l.owned))
  const parentKey = d.parent && used.has(d.parent) ? d.parent : d.order.find((k) => used.has(k) && !owned.has(k)) ?? links[0].owner

  const linkTaken = new Set<string>()
  const out: Link[] = links.map((l) => ({
    id: uniqueId(`${idOf.get(l.owner)}--${idOf.get(l.owned)}`, linkTaken),
    owner: idOf.get(l.owner) as string,
    owned: idOf.get(l.owned) as string,
    equityPct: l.equityPct ?? 0,
    control: l.control,
  }))

  return {
    hits,
    group: {
      parentId: idOf.get(parentKey) as string,
      entities: [...idOf.entries()].map(([k, id]) => ({ id, name: d.names.get(k) ?? k, emissions: d.emissions.get(k) ?? null })),
      links: out,
    },
  }
}
