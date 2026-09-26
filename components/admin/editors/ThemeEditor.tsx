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
import type { Theme } from '@/lib/content/schema'
import { isThemeKey, THEME_KEYS, type ThemeKey } from '@/lib/theme/keys'
import { DEFAULT_COLORS, isSafeTokenValue, type ColorToken } from '@/lib/theme'
import { cx } from '@/lib/utils'
import { useEditor } from '../EditorContext'
import { REVEAL_EVENT } from '../EditorShell'
import { SegmentedField } from '../fields/Choice'
import { ColorField } from '../fields/Color'
import { FieldGrid, Group } from '../fields/Group'
import { TextField } from '../fields/Text'
import { COLOR_NAMES, effective, GROUPS, PAIRS, ratioOf, themeCheck } from '../lib/themeCheck'

export { themeCheck }

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
      <ThemeLabDraft onLoad={setWorld} />
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
    const ratio = ratioOf(theme, world, p)
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

/* ------------------------------------------------------------------ */
/* Theme lab draft import (the /playground/theme-lab demo writes it)   */
/* ------------------------------------------------------------------ */

const DRAFT_KEY = 'ghp:theme-lab:draft'

interface Draft { world: ThemeKey; tokens: Partial<Record<ColorToken, string>>; savedAt: string }

function readDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as { world?: unknown; tokens?: unknown; savedAt?: unknown }
    if (!isThemeKey(d.world) || !d.tokens || typeof d.tokens !== 'object') return null
    const known = DEFAULT_COLORS[d.world]
    const tokens: Partial<Record<ColorToken, string>> = {}
    for (const [k, v] of Object.entries(d.tokens as Record<string, unknown>)) {
      if (k in known && typeof v === 'string' && isSafeTokenValue(v)) tokens[k as ColorToken] = v
    }
    if (!Object.keys(tokens).length) return null
    return { world: d.world, tokens, savedAt: typeof d.savedAt === 'string' ? d.savedAt : '' }
  } catch {
    return null
  }
}

function forgetDraft() {
  try { window.localStorage.removeItem(DRAFT_KEY) } catch { /* storage blocked */ }
}

function ThemeLabDraft({ onLoad }: { onLoad: (w: ThemeKey) => void }) {
  const ed = useEditor()
  const theme = ed.data as Theme
  const [draft, setDraft] = useState<Draft | null>(null)
  useEffect(() => { setDraft(readDraft()) }, [])
  if (!draft) return null
  const label = theme.themes[draft.world].label || draft.world
  const when = draft.savedAt && !Number.isNaN(Date.parse(draft.savedAt)) ? new Date(draft.savedAt).toLocaleString() : ''
  const n = Object.keys(draft.tokens).length
  const load = () => {
    ed.set(['themes', draft.world, 'tokens'], (prev: unknown) => ({ ...(prev as Record<string, string> | undefined), ...draft.tokens }))
    onLoad(draft.world)
    forgetDraft()
    setDraft(null)
  }
  const dismiss = () => { forgetDraft(); setDraft(null) }
  return (
    <div role="region" aria-label="Theme lab draft" className="flex flex-wrap items-center justify-between gap-s3 border border-accent bg-surface p-s4">
      <p className="m-0 text-0 min-w-0">
        A Theme lab draft for <strong>{label}</strong> ({n} colour{n === 1 ? '' : 's'}){when ? `, saved ${when}` : ''}. Loading it adds unsaved edits; the contrast check still runs before you save.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={load}>Load Theme lab draft for {label}</Button>
        <Button size="sm" variant="ghost" onClick={dismiss}>Dismiss</Button>
      </div>
    </div>
  )
}
