'use client'
/**
 * Theme lab: edit this site's colour tokens live, check every pair against
 * WCAG 2.x, preview the world (optionally on the whole page and through a
 * colour-vision filter), then copy the CSS or save a draft for the admin.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, DemoGrid, DemoPanel, Loading, Segmented, Toggle } from '@/components/ui'
import { THEME_KEYS, type ThemeKey } from '@/lib/theme/keys'
import type { DemoProps } from '@/lib/demos/types'
import { useLocalStorage } from '@/lib/hooks'
import { DEFAULT_COLORS, type ColorToken } from '@/lib/theme'
import { readTokens, setTheme, useThemeKey } from '@/lib/theme/client'
import { normalize } from './color'
import { labelsFromData } from './labels'
import { ContrastBoard } from './ContrastBoard'
import { Output } from './Output'
import { Range } from './Range'
import { Specimen, VisionFilters, type Vision } from './Specimen'
import { TokenEditor } from './TokenEditor'
import { diff, failures, fixAll, rotatePalette, TOKENS, type Edits, type Palette } from './tokens'

export { notes } from './notes'

type AllEdits = Record<ThemeKey, Edits>
const NO_EDITS: AllEdits = { almanac: {}, strata: {} }

const VISIONS: { value: Vision; label: string }[] = [
  { value: 'none', label: 'Typical' },
  { value: 'protan', label: 'Protan' },
  { value: 'deutan', label: 'Deutan' },
  { value: 'tritan', label: 'Tritan' },
  { value: 'achroma', label: 'Mono' },
]

/** Keep only known tokens with parseable colours (storage is untrusted). */
function clean(e: unknown): Edits {
  const out: Edits = {}
  if (!e || typeof e !== 'object') return out
  for (const t of TOKENS) {
    const v = (e as Record<string, unknown>)[t]
    const n = typeof v === 'string' ? normalize(v) : null
    if (n) out[t] = n
  }
  return out
}

export default function Demo({ data }: DemoProps) {
  const pageTheme = useThemeKey()
  const labels = useMemo(() => labelsFromData(data), [data])
  const [world, setWorld] = useState<ThemeKey>(pageTheme)
  const [stored, setStored] = useLocalStorage<AllEdits>('theme-lab:edits', NO_EDITS)
  const [, setDraft] = useLocalStorage<unknown>('theme-lab:draft', null)
  const [live, setLive] = useState<Partial<Record<ThemeKey, Palette>>>({})
  const [vision, setVision] = useState<Vision>('none')
  const [tryOn, setTryOn] = useState(false)
  const [hue, setHue] = useState(0)
  const [hueFrom, setHueFrom] = useState<Palette | null>(null)
  const probes = useRef<Partial<Record<ThemeKey, HTMLDivElement | null>>>({})

  // Read both worlds' live tokens (shipped defaults + admin overrides) from hidden probes.
  useEffect(() => {
    const next: Partial<Record<ThemeKey, Palette>> = {}
    for (const k of THEME_KEYS) {
      const el = probes.current[k]
      if (!el) continue
      const t = readTokens(TOKENS, el)
      next[k] = Object.fromEntries(TOKENS.map((n) => [n, normalize(t[n]) ?? DEFAULT_COLORS[k][n]])) as Palette
    }
    setLive(next)
  }, [])

  const base = live[world]
  const edits = useMemo(() => clean(stored?.[world]), [stored, world])
  const palette = useMemo<Palette | null>(() => (base ? { ...base, ...edits } : null), [base, edits])
  const failing = palette ? failures(palette).length : 0

  const setEdits = useCallback((next: Edits) => {
    setStored((prev) => ({ ...NO_EDITS, ...prev, [world]: next }))
  }, [setStored, world])

  const bake = useCallback((p: Palette) => { if (base) setEdits(diff(p, base)) }, [base, setEdits])

  const changeToken = (token: ColorToken, value: string) => {
    if (!palette) return
    setHueFrom(null); setHue(0)
    bake({ ...palette, [token]: value })
  }

  const onHue = (deg: number) => {
    if (!palette) return
    const from = hueFrom ?? palette
    if (!hueFrom) setHueFrom(palette)
    setHue(deg)
    bake(rotatePalette(from, deg))
  }

  const resetTo = (target: 'live' | 'defaults') => {
    setHueFrom(null); setHue(0)
    if (target === 'live' || !base) setEdits({})
    else setEdits(diff(DEFAULT_COLORS[world], base))
  }

  // Try the edited world on the whole page (session only, reverted on exit).
  useEffect(() => {
    if (!tryOn || !palette || pageTheme !== world) return
    const root = document.documentElement
    const names = Object.keys(edits) as ColorToken[]
    for (const n of names) root.style.setProperty(n, palette[n])
    return () => { for (const n of names) root.style.removeProperty(n) }
  }, [tryOn, palette, edits, pageTheme, world])

  const sendToAdmin = () => {
    if (!palette || failing) return false
    setDraft({ world, tokens: diff(palette, DEFAULT_COLORS[world]), savedAt: new Date().toISOString() })
    return true
  }

  const label = labels[world].label

  return (
    <div className="grid gap-4">
      <VisionFilters />
      {THEME_KEYS.map((k) => (
        <div key={k} ref={(el) => { probes.current[k] = el }} data-theme={k} hidden aria-hidden="true" />
      ))}

      {!palette ? (
        <Loading label="Reading the live tokens" className="py-8" />
      ) : (
        <DemoGrid
          aside={
            <>
              <ContrastBoard palette={palette} onFix={changeToken} onFixAll={() => { setHueFrom(null); setHue(0); bake(fixAll(palette)) }} />
              <Output world={world} label={label} palette={palette} edits={edits} failing={failing} onSendToAdmin={sendToAdmin} />
            </>
          }
        >
          <DemoPanel title="Bench" meta={failing ? `${failing} contrast failure${failing === 1 ? '' : 's'}` : 'AA clean'}>
            <div className="grid gap-5">
              <div className="flex flex-wrap items-end gap-4">
                <Segmented
                  label="World"
                  value={world}
                  onChange={(k) => { setWorld(k); setHueFrom(null); setHue(0) }}
                  options={THEME_KEYS.map((k) => ({ value: k, label: labels[k].label }))}
                />
                <Segmented label="Vision" value={vision} onChange={setVision} options={VISIONS} />
              </div>
              <Range
                label="Re-ink (hue shift)"
                value={hue}
                min={-180}
                max={180}
                step={5}
                unit="°"
                onChange={onHue}
                hint="Rotates every token's hue from the palette you started with. Contrast can break: the board says where."
              />
              <div className="grid gap-2">
                <Toggle label="Try it on this page" checked={tryOn} onChange={setTryOn} />
                {tryOn && pageTheme !== world ? (
                  <p className="m-0 flex flex-wrap items-center gap-2 text-0 text-ink-2">
                    The page is printed in {labels[pageTheme].label}.
                    <Button size="sm" variant="secondary" onClick={() => setTheme(world)}>Switch the page to {label}</Button>
                  </p>
                ) : tryOn ? (
                  <p className="m-0 text-0 text-ink-2">Only this tab changes, and only until you turn it off or leave.</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon="refresh" onClick={() => resetTo('live')} disabled={!Object.keys(edits).length}>Reset to live</Button>
                <Button size="sm" variant="ghost" onClick={() => resetTo('defaults')}>Shipped defaults</Button>
              </div>
            </div>
          </DemoPanel>

          <section id="tl-preview" aria-label={`Preview of ${label}`} className="grid gap-2">
            <Specimen world={world} label={label} palette={palette} reads={labels[world].reads} vision={vision} />
            <p className="m-0 mono text-ink-3">
              Live preview · {label}{vision !== 'none' ? ` · simulated ${VISIONS.find((v) => v.value === vision)?.label.toLowerCase()} vision` : ''}
            </p>
          </section>

          <DemoPanel title="Tokens" meta={`${Object.keys(edits).length} edited`}>
            <TokenEditor palette={palette} edits={edits} onChange={changeToken} />
          </DemoPanel>
        </DemoGrid>
      )}
    </div>
  )
}
