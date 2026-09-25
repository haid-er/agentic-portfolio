'use client'
/**
 * Themes: rename both printed worlds, retune their tokens, preview live.
 *
 * The preview is a real subtree with `data-theme` set to the world and the
 * edited tokens applied inline, so it renders with that world's type, radii
 * and inks even while the admin itself is in the other world.
 * Contrast (WCAG 2.x) is checked live; a text pair under 4.5:1 or a UI /
 * graphic pair under 3:1 blocks the save (DESIGN.md 2).
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Badge, Button, Segmented, controlClasses } from '@/components/ui'
import { THEME_KEYS, type Theme, type ThemeKey } from '@/lib/content/schema'
import { DEFAULT_COLORS, isSafeTokenValue, type ColorToken } from '@/lib/theme'
import { cx } from '@/lib/utils'
import { useEditor } from '../EditorContext'
import { REVEAL_EVENT, type ExtraCheck, type ExtraIssue } from '../EditorShell'
import { SegmentedField } from '../fields/Choice'
import { ColorField } from '../fields/Color'
import { FieldGrid, Group } from '../fields/Group'
import { TextField } from '../fields/Text'
import { contrast } from '../lib/contrast'

const GROUPS: { title: string; tokens: { name: ColorToken; label: string }[] }[] = [
  { title: 'Paper', tokens: [{ name: '--bg', label: 'Background' }, { name: '--bg-2', label: 'Inset sheet' }, { name: '--surface', label: 'Surface (cards)' }] },
  { title: 'Ink', tokens: [{ name: '--ink', label: 'Ink' }, { name: '--ink-2', label: 'Secondary ink' }, { name: '--ink-3', label: 'Meta ink' }] },
  { title: 'Accents', tokens: [{ name: '--accent', label: 'Accent' }, { name: '--accent-2', label: 'Second accent' }, { name: '--accent-ink', label: 'Accent for small text' }, { name: '--on-accent', label: 'Text on accent' }] },
  { title: 'Rules and data', tokens: [{ name: '--rule', label: 'Rule / control border' }, { name: '--data-1', label: 'Data 1' }, { name: '--data-2', label: 'Data 2' }, { name: '--data-3', label: 'Data 3' }, { name: '--data-4', label: 'Data 4' }] },
]
const COLOR_NAMES = new Set<string>(GROUPS.flatMap((g) => g.tokens.map((t) => t.name)))

/** Pairs that must stay readable. `min` 4.5 = text, 3 = UI / graphics. */
const PAIRS: { fg: ColorToken; bg: ColorToken; min: number; use: string }[] = [
  { fg: '--ink', bg: '--bg', min: 4.5, use: 'Body text' },
  { fg: '--ink', bg: '--surface', min: 4.5, use: 'Text on cards' },
  { fg: '--ink-2', bg: '--bg', min: 4.5, use: 'Secondary text' },
  { fg: '--ink-2', bg: '--bg-2', min: 4.5, use: 'Secondary on inset' },
  { fg: '--ink-3', bg: '--bg', min: 4.5, use: 'Meta, folios' },
  { fg: '--ink-3', bg: '--bg-2', min: 4.5, use: 'Meta on inset' },
  { fg: '--ink-3', bg: '--surface', min: 4.5, use: 'Meta on cards' },
  { fg: '--accent', bg: '--bg', min: 4.5, use: 'Links, emphasis' },
  { fg: '--accent-ink', bg: '--bg', min: 4.5, use: 'Small accent text' },
  { fg: '--accent-ink', bg: '--bg-2', min: 4.5, use: 'Folios on inset' },
  { fg: '--on-accent', bg: '--accent', min: 4.5, use: 'Text on accent' },
  { fg: '--rule', bg: '--bg', min: 3, use: 'Control borders' },
  { fg: '--rule', bg: '--surface', min: 3, use: 'Borders on cards' },
  { fg: '--accent-2', bg: '--bg', min: 3, use: 'Decoration, graphics' },
  { fg: '--data-1', bg: '--surface', min: 3, use: 'Chart ink 1' },
  { fg: '--data-2', bg: '--surface', min: 3, use: 'Chart ink 2' },
  { fg: '--data-3', bg: '--surface', min: 3, use: 'Chart ink 3' },
  { fg: '--data-4', bg: '--surface', min: 3, use: 'Chart ink 4' },
]

const effective = (theme: Theme, key: ThemeKey, name: ColorToken) => theme.themes[key].tokens[name] ?? DEFAULT_COLORS[key][name]

/** Contrast failures block the save; the issue points at the token that was changed. */
export const themeCheck: ExtraCheck = (raw) => {
  const theme = raw as Theme
  const out: ExtraIssue[] = []
  if (!theme?.themes) return out
  for (const key of THEME_KEYS) {
    const tokens = theme.themes[key]?.tokens ?? {}
    for (const p of PAIRS) {
      const ratio = contrast(effective(theme, key, p.fg), effective(theme, key, p.bg))
      if (ratio === null || ratio >= p.min) continue
      const at = tokens[p.fg] !== undefined ? p.fg : tokens[p.bg] !== undefined ? p.bg : null
      if (!at) continue // the shipped defaults are checked in DESIGN.md
      out.push({ path: ['themes', key, 'tokens', at], message: `${p.use}: ${p.fg} on ${p.bg} is ${ratio.toFixed(2)}:1; needs ${p.min}:1.` })
    }
    for (const [name, value] of Object.entries(tokens)) {
      if (!isSafeTokenValue(value)) out.push({ path: ['themes', key, 'tokens', name], message: 'Not a usable CSS value.' })
    }
  }
  return out
}

export function ThemeEditor() {
  const ed = useEditor()
  const theme = ed.data as Theme
  const [world, setWorld] = useState<ThemeKey>('almanac')
  const [compare, setCompare] = useState(false)

  // Jumping to a problem in the other world switches to it.
  useEffect(() => {
    const onReveal = (e: Event) => {
      const k = (e as CustomEvent<string>).detail.split('.')[1]
      if (k === 'almanac' || k === 'strata') setWorld(k)
    }
    window.addEventListener(REVEAL_EVENT, onReveal)
    return () => window.removeEventListener(REVEAL_EVENT, onReveal)
  }, [])

  return (
    <>
      <Group title="Default world" description="What a first-time visitor sees. “Follow the device” picks by what each world reads as.">
        <SegmentedField
          path={['default']}
          label="Default"
          options={[
            { value: 'auto', label: 'Follow the device' },
            { value: 'almanac', label: theme.themes.almanac.label || 'Almanac' },
            { value: 'strata', label: theme.themes.strata.label || 'Strata' },
          ]}
        />
      </Group>

      <div className="flex flex-wrap items-end justify-between gap-s3">
        <Segmented
          label="Editing"
          value={world}
          onChange={setWorld}
          options={THEME_KEYS.map((k) => ({ value: k, label: theme.themes[k].label || k }))}
        />
        <label className="inline-flex items-center gap-2 min-h-tap text-0 cursor-pointer">
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="size-5 accent-[var(--accent)]" />
          Preview both worlds side by side
        </label>
      </div>

      <div className="grid gap-s5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] items-start">
        <WorldFields world={world} />
        <div className="grid gap-s4 lg:sticky lg:top-s4">
          {(compare ? THEME_KEYS : [world]).map((k) => <Specimen key={k} world={k} theme={theme} />)}
          <ContrastTable world={world} theme={theme} />
        </div>
      </div>
    </>
  )
}

function WorldFields({ world }: { world: ThemeKey }) {
  const ed = useEditor()
  const theme = ed.data as Theme
  const def = theme.themes[world]
  const base = ['themes', world] as const
  const overrides = Object.keys(def.tokens).length
  return (
    <div className="grid gap-s5 min-w-0">
      <Group
        title={def.label || world}
        description="The key stays fixed; the site always shows the label."
        layer={world === 'almanac' ? 2 : 1}
        aside={overrides ? (
          <Button size="sm" variant="ghost" onClick={() => ed.set([...base, 'tokens'], {})}>
            <RotateCcw aria-hidden="true" size={14} strokeWidth={1.5} /> Reset {overrides} token{overrides === 1 ? '' : 's'}
          </Button>
        ) : <Badge>Defaults</Badge>}
      >
        <FieldGrid>
          <TextField path={[...base, 'label']} label="Name" hint="Shown on the switch (“Reprint in …”) and in the masthead." />
          <TextField path={[...base, 'swapLabel']} label="Switch tag" hint="Printed while the world changes." />
          <SegmentedField path={[...base, 'reads']} label="Reads as" options={[{ value: 'light', label: 'Light paper' }, { value: 'dark', label: 'Dark ground' }]} />
        </FieldGrid>
      </Group>

      {GROUPS.map((g) => (
        <Group key={g.title} title={g.title} layer={3}>
          <div className="grid gap-s4 xs:grid-cols-2">
            {g.tokens.map((t) => (
              <ColorField key={t.name} path={[...base, 'tokens', t.name]} label={`${t.label} ${t.name}`} fallback={DEFAULT_COLORS[world][t.name]} />
            ))}
          </div>
        </Group>
      ))}

      <AdvancedTokens world={world} />
    </div>
  )
}

/** Non-colour tokens (radii, spacing, shadows…) as free key/value pairs. */
function AdvancedTokens({ world }: { world: ThemeKey }) {
  const ed = useEditor()
  const tokens = (ed.data as Theme).themes[world].tokens
  const extra = Object.entries(tokens).filter(([k]) => !COLOR_NAMES.has(k))
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const nameOk = /^--[a-z0-9-]+$/.test(name) && !(name in tokens)
  const path = (k: string) => ['themes', world, 'tokens', k]

  const add = () => {
    if (!nameOk || !isSafeTokenValue(value)) return
    ed.set(path(name), value.trim())
    setName('')
    setValue('')
  }

  return (
    <Group title="Other tokens" layer={5} description={<>Any other custom property from DESIGN.md 2, e.g. <code className="font-mono">--r-2</code> or <code className="font-mono">--shadow-card</code>. Values cannot contain <code className="font-mono">; {'{ }'} &lt; &gt;</code>.</>}>
      {extra.length ? (
        <ul className="m-0 p-0 list-none grid gap-2">
          {extra.map(([k, v]) => (
            <li key={k} className="grid gap-2 grid-cols-[minmax(0,10rem)_minmax(0,1fr)_44px] items-center">
              <code className="font-mono text-0 [overflow-wrap:anywhere]">{k}</code>
              <input
                aria-label={`Value of ${k}`}
                value={v}
                data-path={['themes', world, 'tokens', k].join('.')}
                aria-invalid={!isSafeTokenValue(v) || undefined}
                onChange={(e) => ed.set(path(k), e.target.value)}
                className={cx(controlClasses, 'font-mono text-00')}
              />
              <button type="button" onClick={() => ed.set(path(k), undefined)} aria-label={`Remove ${k}`} className="grid place-items-center size-[44px] text-ink-2 hover:text-danger">
                <Trash2 aria-hidden="true" size={16} strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid gap-2 xs:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-end">
        <label className="grid gap-1">
          <span className="mono text-ink-2">Token</span>
          <input value={name} onChange={(e) => setName(e.target.value.trim())} placeholder="--r-2" aria-invalid={(name !== '' && !nameOk) || undefined} className={cx(controlClasses, 'font-mono text-00')} />
        </label>
        <label className="grid gap-1">
          <span className="mono text-ink-2">Value</span>
          <input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} placeholder="4px" className={cx(controlClasses, 'font-mono text-00')} />
        </label>
        <Button size="sm" variant="secondary" onClick={add} disabled={!nameOk || !isSafeTokenValue(value)}>
          <Plus aria-hidden="true" size={15} strokeWidth={1.5} /> Add
        </Button>
      </div>
    </Group>
  )
}

/** A miniature printed page in the world being edited. */
function Specimen({ world, theme }: { world: ThemeKey; theme: Theme }) {
  const def = theme.themes[world]
  // Defaults first, so a token you reset previews as the default even if an older override is live in the CSS.
  const style = {
    ...DEFAULT_COLORS[world],
    ...Object.fromEntries(Object.entries(def.tokens).filter(([, v]) => isSafeTokenValue(v))),
  } as CSSProperties
  return (
    <figure className="m-0 grid gap-1">
      <figcaption className="mono text-ink-3">Live preview · {def.label || world}</figcaption>
      <div data-theme={world} style={{ ...style, colorScheme: def.reads }} className="bg-bg text-ink border border-rule rounded-2 overflow-hidden font-body">
        <div className="flex justify-between gap-2 px-s4 py-s2 border-b border-rule font-mono text-00 uppercase tracking-[.1em] text-ink-3">
          <span>Edition: {def.label || world}</span>
          <span aria-hidden="true">01</span>
        </div>
        <div className="grid gap-s3 p-s4 [background:var(--pattern)]">
          <div className="grid gap-s3 p-s4 bg-surface rounded-2 border border-rule shadow-plate">
            <p className="m-0 font-mono text-00 uppercase tracking-[.1em] text-accent-ink">02 · Working record</p>
            <p className="display m-0 text-4 text-ink">Specimen</p>
            <p className="m-0 text-1 text-ink-2 leading-[var(--lh-body)]">Secondary ink sets the lede, with <em className="text-accent">an accent word</em> and meta in the third ink.</p>
            <p className="m-0 font-mono text-00 uppercase tracking-[.1em] text-ink-3">Sep 2025 – Present · Remote</p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center min-h-[36px] px-3 bg-ink text-bg font-mono text-00 uppercase tracking-[.08em] rounded-pill">Primary</span>
              <span className="inline-flex items-center min-h-[36px] px-3 border border-rule font-mono text-00 uppercase tracking-[.08em] rounded-pill">Secondary</span>
              <span className="inline-flex items-center min-h-[36px] px-3 bg-accent text-on-accent font-mono text-00 uppercase tracking-[.08em] rounded-pill">On accent</span>
            </div>
            <span className="inline-flex self-start items-stretch border border-rule rounded-1 bg-bg-2 text-0">
              <span className="px-2 py-1 font-semibold">Skill</span>
              <span className="px-2 py-1 border-l border-rule font-mono text-00 text-accent-ink self-center">→ demo-slug</span>
            </span>
            <div className="grid gap-1" aria-hidden="true">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="flex items-center gap-2">
                  <span className="font-mono text-00 text-ink-3 w-10">data-{n}</span>
                  <span className="h-[6px] flex-1 bg-rule-soft rounded-pill overflow-hidden">
                    <span className="block h-full rounded-pill" style={{ width: `${90 - n * 15}%`, background: `var(--data-${n})` }} />
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="h-[10px] rounded-pill" style={{ background: 'var(--accent-2)' }} aria-hidden="true" />
        </div>
      </div>
    </figure>
  )
}

function ContrastTable({ world, theme }: { world: ThemeKey; theme: Theme }) {
  const rows = PAIRS.map((p) => {
    const ratio = contrast(effective(theme, world, p.fg), effective(theme, world, p.bg))
    return { ...p, ratio, ok: ratio === null ? null : ratio >= p.min }
  })
  const failing = rows.filter((r) => r.ok === false).length
  return (
    <details className="group border border-rule rounded-1 bg-surface" open={failing > 0}>
      <summary className="min-h-tap px-s3 flex items-center gap-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="mono text-ink-2">Contrast · {theme.themes[world].label || world}</span>
        <span className="ml-auto">{failing ? <Badge tone="danger">{failing} failing</Badge> : <Badge tone="ok">All pass</Badge>}</span>
      </summary>
      <ul className="m-0 p-s3 pt-0 list-none grid gap-1">
        {rows.map((r) => (
          <li key={`${r.fg}-${r.bg}`} className="flex items-center gap-2 text-00 min-h-[32px]">
            <span className="flex -space-x-1" aria-hidden="true">
              <span className="size-4 rounded-pill border border-rule" style={{ background: effective(theme, world, r.bg) }} />
              <span className="size-4 rounded-pill border border-rule" style={{ background: effective(theme, world, r.fg) }} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block">{r.use}</span>
              <span className="block font-mono text-ink-3">{r.fg} / {r.bg}</span>
            </span>
            <span className="font-mono nums">{r.ratio === null ? 'n/a' : `${r.ratio.toFixed(2)}:1`}</span>
            {r.ok === null ? <Badge>Not checkable</Badge> : r.ok ? <Badge tone="ok">≥{r.min}</Badge> : <Badge tone="danger">&lt;{r.min}</Badge>}
          </li>
        ))}
      </ul>
    </details>
  )
}
