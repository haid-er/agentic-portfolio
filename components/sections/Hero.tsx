/**
 * Hero + core-sample plate (DESIGN.md 4, 6.1, 9): the one signature moment of the site.
 *
 * - The name is set at --fs-hero with the world's overprint (Almanac: a vermilion copy
 *   drifting out of register; Strata: a lichen band through the bottom 38% of the letters).
 * - The plate is the career drawn as sediment, newest on top. Every layer is a real link
 *   to the playground demo that proves it. Layer data comes from content (experience,
 *   projects, education, research); a disabled source item is simply not drawn.
 * - First view per session: the plate head prints, layers arrive oldest first, a drill
 *   line runs down the core once and the live UK grid reading resolves. Hover / focus
 *   on a layer drills down to it. All of it is CSS: no client JS ships for the hero.
 * - Reduced motion: everything is shown immediately, nothing loops.
 */
import type { CSSProperties } from 'react'
import { z } from 'zod'
import { ButtonLink, Icon, Kicker } from '@/components/ui'
import {
  getEducation, getExperience, getProjects, getResearch, getSite,
  type DemoSlug, type Hero as HeroContent,
} from '@/lib/content'
import { isDemoEnabled } from '@/lib/demos'
import { cx, formatPartialDate, formatRange, seeded } from '@/lib/utils'
import type { SectionProps } from './types'

/* ------------------------------------------------------------------ */
/* plate data                                                          */
/* ------------------------------------------------------------------ */

interface PlateLayer {
  key: string
  /** Sort key (partial date). */
  when: string
  year: string
  label: string
  note: string
  range: string
  slug?: DemoSlug
  /** Thin marker bed (a publication), drawn with the overprint ink. */
  marker: boolean
}

/** The first proof slug that is visible in the playground. */
const firstVisible = (slugs: readonly (DemoSlug | undefined)[]) =>
  slugs.find((s): s is DemoSlug => !!s && isDemoEnabled(s))

const stripParens = (s: string) => s.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
const acronym = (s: string) => /\(([A-Z]{2,})\)/.exec(s)?.[1] ?? s.split(',')[0]!.trim()
const year = (d: string | undefined) => (d ?? '').slice(0, 4)

function resolveLayer(ref: string): PlateLayer | null {
  const [kind, id] = ref.split(':')
  if (kind === 'experience') {
    const x = getExperience().find((i) => i.id === id)
    if (!x) return null
    const label = stripParens(x.org)
    const note = x.metric ? `${x.metric.from} → ${x.metric.to}` : x.product && x.product !== label ? x.product : x.role
    return {
      key: ref, when: x.start, year: year(x.start), label, note, marker: false,
      range: formatRange(x.start, x.end),
      slug: firstVisible(x.highlights.map((h) => h.proofDemo)),
    }
  }
  if (kind === 'project') {
    const p = getProjects().find((i) => i.slug === id || i.id === id)
    if (!p) return null
    return {
      key: ref, when: p.start ?? '', year: year(p.start), label: p.title, marker: false,
      note: p.tags.slice(0, 2).join(' · '),
      range: !p.start ? '' : p.end ? formatRange(p.start, p.end) : p.ongoing ? formatRange(p.start, '') : formatPartialDate(p.start),
      slug: firstVisible(p.demoSlugs),
    }
  }
  if (kind === 'education') {
    const e = getEducation().find((i) => i.id === id)
    if (!e) return null
    return {
      key: ref, when: e.start, year: year(e.start), label: acronym(e.institution), marker: false,
      note: [e.degree, e.field].filter(Boolean).join(' '),
      range: formatRange(e.start, e.end),
      slug: firstVisible(e.demoSlugs ?? []),
    }
  }
  if (kind === 'research') {
    const r = getResearch().items.find((i) => i.id === id)
    if (!r) return null
    return {
      key: ref, when: r.year, year: r.year, label: r.title.split(':')[0]!.trim(), marker: true,
      note: stripParens(r.venue),
      range: r.year,
      slug: firstVisible(r.demoSlugs),
    }
  }
  return null
}

/**
 * Layer refs ("collection:id") chosen in content via `site.hero.plateLayers`. Read
 * defensively so the plate keeps working whether or not the schema carries the field.
 */
function contentRefs(hero: HeroContent): string[] {
  if (!('plateLayers' in hero) || !Array.isArray(hero.plateLayers)) return []
  return hero.plateLayers.filter((r): r is string => typeof r === 'string')
}

/**
 * With no explicit list, the plate is derived from content: every enabled experience,
 * education and research item, plus featured projects that have a start date and a demo.
 */
function derivedRefs(): string[] {
  return [
    ...getExperience().map((x) => `experience:${x.id}`),
    ...getProjects().filter((p) => p.featured && p.start && p.demoSlugs.length).map((p) => `project:${p.slug}`),
    ...getEducation().map((e) => `education:${e.id}`),
    ...getResearch().items.map((r) => `research:${r.id}`),
  ]
}

function plateLayers(hero: HeroContent): PlateLayer[] {
  const chosen = contentRefs(hero)
  const refs = [...new Set(chosen.length ? chosen : derivedRefs())]
  return refs
    .map(resolveLayer)
    .filter((l): l is PlateLayer => !!l && !!l.label)
    .sort((a, b) => b.when.localeCompare(a.when))
}

/* ------------------------------------------------------------------ */
/* live reading: UK grid carbon intensity (ISR 30 min)                 */
/* ------------------------------------------------------------------ */

const CarbonWire = z.object({
  data: z.array(z.object({
    from: z.string(),
    intensity: z.object({ forecast: z.number().nullable(), actual: z.number().nullable(), index: z.string() }),
  })).min(1),
})

interface GridReading { value: number; basis: 'actual' | 'forecast'; index: string; at: string }

async function getGridReading(): Promise<GridReading | null> {
  try {
    const res = await fetch('https://api.carbonintensity.org.uk/intensity', {
      headers: { Accept: 'application/json' },
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const parsed = CarbonWire.safeParse(await res.json())
    if (!parsed.success) return null
    const d = parsed.data.data[0]!
    const value = d.intensity.actual ?? d.intensity.forecast
    if (value === null) return null
    return { value, basis: d.intensity.actual !== null ? 'actual' : 'forecast', index: d.intensity.index, at: d.from }
  } catch {
    return null
  }
}

const utcTime = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

const INDEX_TONE: Record<string, string> = {
  'very low': 'border-ok text-ok',
  low: 'border-ok text-ok',
  moderate: 'border-warn text-warn',
  high: 'border-danger text-danger',
  'very high': 'border-danger text-danger',
}

/* ------------------------------------------------------------------ */
/* drawing helpers                                                     */
/* ------------------------------------------------------------------ */

const WAVE_H = 14 // px of the wavy contact at the top of each band

/** Seeded sine-noise contact line in a 100 x 16 box. */
function wavePath(key: string): string {
  let h = 2166136261
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  const rnd = seeded(h)
  const phase = rnd() * Math.PI * 2
  const freq = 0.09 + rnd() * 0.08
  const pts: Array<[number, number]> = []
  for (let x = 0; x <= 100; x += 5) {
    const y = 8 + Math.sin(x * freq + phase) * 3.2 + (rnd() - 0.5) * 2.4
    pts.push([x, Math.max(1.5, Math.min(14.5, y))])
  }
  let d = `M0 ${pts[0]![1].toFixed(2)}`
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1]!
    const [x, y] = pts[i]!
    d += ` Q${px.toFixed(1)} ${py.toFixed(2)} ${((px + x) / 2).toFixed(1)} ${((py + y) / 2).toFixed(2)}`
  }
  return `${d} L100 ${pts[pts.length - 1]![1].toFixed(2)}`
}

function bandStyle(wave: string, tone: number, marker: boolean): CSSProperties {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 16' preserveAspectRatio='none'><path d='${wave} L100 16 L0 16 Z'/></svg>`
  const mask = `url("data:image/svg+xml,${encodeURIComponent(svg)}") top left / 100% ${WAVE_H}px no-repeat, linear-gradient(#000 0 0) left ${WAVE_H - 1}px / 100% calc(100% - ${WAVE_H - 1}px) no-repeat`
  return {
    '--band': marker ? 'var(--accent-2)' : `var(--layer-${tone})`,
    mask,
    WebkitMask: mask,
  } as CSSProperties
}

/* ------------------------------------------------------------------ */
/* CSS (scoped to .gtp-hero; only transform/opacity/clip-path animate)  */
/* ------------------------------------------------------------------ */

function heroCss(n: number): string {
  const drillRules = Array.from({ length: n }, (_, i) =>
    `.gtp-core:has(>ol>li:nth-child(${i + 1})>a:is(:hover,:focus-visible)) .gtp-drill{transform:scaleY(${((i + 0.55) / n).toFixed(3)})}`,
  ).join('\n')
  return `
.gtp-hero{--core-w:52px;--stagger:60ms;--layer-in:print-in}
@media (min-width:480px){.gtp-hero{--core-w:112px}}
[data-theme="strata"] .gtp-hero,.gtp-hero:where([data-theme="strata"] *){--stagger:90ms;--layer-in:settle}

/* name + overprint */
.gtp-name{position:relative;isolation:isolate}
.gtp-name>.gtp-ink{position:relative;z-index:1}
.gtp-over{position:absolute;inset:0;z-index:0;pointer-events:none;user-select:none;color:var(--overprint);translate:.045em .035em;mix-blend-mode:var(--blend);animation:var(--accent-motion)}
:where([data-theme="strata"]) .gtp-over{display:none}
/* Strata: a lichen band through the bottom ~38% of the letters, line by line */
:where([data-theme="strata"]) .gtp-ink{background:linear-gradient(180deg,var(--ink) 0 55%,var(--accent-2) 55% 100%);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-box-decoration-break:clone;box-decoration-break:clone}
@media (forced-colors:active){.gtp-ink{background:none!important;color:CanvasText!important}}
html[data-hidden] .gtp-over{animation-play-state:paused}

/* lede drop cap: 3 lines, --accent-2 (large + decorative) */
.gtp-lede::first-letter{float:left;font-family:var(--font-display);font-variation-settings:var(--display-settings);font-weight:var(--display-weight);font-stretch:var(--display-stretch);color:var(--accent-2);font-size:calc(3em * var(--lh-body) - .1em);line-height:.82;margin:.07em .09em 0 0}
@supports (initial-letter:3){.gtp-lede::first-letter{float:none;font-size:inherit;line-height:inherit;initial-letter:3;margin:0 .12em 0 0}}

/* the core */
.gtp-core{position:relative}
.gtp-cell{position:relative;display:block;border-inline:1px solid var(--rule);background:var(--bg-2)}
.gtp-band,.gtp-edge{position:absolute;left:0;right:0;transition:transform var(--dur-med) var(--ease-out)}
.gtp-band{top:-${WAVE_H - 7}px;bottom:0;background-color:color-mix(in oklab,var(--band) 16%,var(--bg-2))}
li:first-child .gtp-band{top:0}
.gtp-edge{top:-${WAVE_H - 7}px;height:${WAVE_H + 2}px;width:100%;overflow:visible}
li:first-child .gtp-edge{top:0}
.gtp-edge path{fill:none;stroke:var(--rule);stroke-width:1;vector-effect:non-scaling-stroke;transition:stroke-width var(--dur-fast)}
.gtp-t1{background-image:radial-gradient(circle,var(--band) 1.15px,transparent 1.75px);background-size:6px 6px}
.gtp-t2{background-image:repeating-linear-gradient(135deg,var(--band) 0 1.2px,transparent 1.2px 6px)}
.gtp-t3{background-image:radial-gradient(circle,var(--band) .9px,transparent 1.4px),radial-gradient(circle,var(--band) .9px,transparent 1.4px);background-size:5px 5px;background-position:0 0,2.5px 2.5px}
.gtp-t4{background-image:repeating-linear-gradient(0deg,var(--band) 0 1px,transparent 1px 5px)}
.gtp-mk{background-image:repeating-linear-gradient(45deg,var(--band) 0 1.5px,transparent 1.5px 4px),repeating-linear-gradient(135deg,var(--band) 0 1.5px,transparent 1.5px 4px)}
:where([data-theme="strata"]) li:first-child .gtp-cell{border-start-start-radius:var(--r-1);border-start-end-radius:var(--r-1)}
:where([data-theme="strata"]) li:first-child .gtp-band{border-start-start-radius:var(--r-1);border-start-end-radius:var(--r-1)}
:where([data-theme="strata"]) li:last-child .gtp-cell,:where([data-theme="strata"]) li:last-child .gtp-band{border-end-start-radius:var(--r-1);border-end-end-radius:var(--r-1)}
.gtp-label{transition:transform var(--dur-med) var(--ease-out),background-color var(--dur-fast)}
.gtp-core a:is(:hover,:focus-visible) :is(.gtp-band,.gtp-edge,.gtp-label){transform:translateY(-2px)}
.gtp-core a:is(:hover,:focus-visible) .gtp-edge path{stroke:var(--accent);stroke-width:2}
.gtp-core a:is(:hover,:focus-visible) .gtp-label{background-color:var(--bg-2)}
.gtp-core a:is(:hover,:focus-visible) .gtp-go{transform:translateX(3px)}
.gtp-go{transition:transform var(--dur-fast) var(--ease-out)}

/* drill line: hover/focus drills to the layer; the intro runs the full core once */
.gtp-drill,.gtp-drill-intro{position:absolute;top:0;bottom:0;left:calc(var(--core-w) / 2 - 1px);width:2px;background:var(--accent);transform-origin:top;pointer-events:none;z-index:2}
.gtp-drill{transform:scaleY(0);transition:transform var(--dur-med) var(--ease-out)}
.gtp-drill-intro{opacity:0;transform:scaleY(1)}
${drillRules}

/* entrance: plays once per session on first view (hero is above the fold) */
@keyframes gtp-drill-run{0%{transform:scaleY(0);opacity:1}72%{transform:scaleY(1);opacity:1}100%{transform:scaleY(1);opacity:0}}
@keyframes gtp-resolve{0%,60%{opacity:1}100%{opacity:0}}
.gtp-anim .gtp-head{animation:print-in 520ms var(--ease-out) both}
.gtp-anim .gtp-layer{animation:var(--layer-in) 560ms var(--ease-out) both;animation-delay:calc(360ms + var(--rise) * var(--stagger))}
.gtp-anim .gtp-drill-intro{animation:gtp-drill-run 820ms var(--ease-press) both;animation-delay:calc(920ms + ${n} * var(--stagger))}
.gtp-anim .gtp-dots{animation:gtp-resolve 500ms linear both;animation-delay:calc(1500ms + ${n} * var(--stagger))}
.gtp-anim .gtp-value{animation:fade-in 420ms var(--ease-out) both;animation-delay:calc(1800ms + ${n} * var(--stagger))}
.gtp-dots{opacity:0}
html[data-hero-seen] .gtp-anim *{animation:none!important}
/* world switch: the shell sets html[data-settle] for ~1.4s; the drill runs the core once more */
@media (prefers-reduced-motion:no-preference){
  html[data-settle] .gtp-anim .gtp-drill-intro{animation:gtp-drill-run 820ms var(--ease-press) 160ms both!important}
}
@media (prefers-reduced-motion:reduce){
  .gtp-anim *,.gtp-over{animation:none!important}
  .gtp-band,.gtp-edge,.gtp-label,.gtp-drill,.gtp-go{transition:none!important}
}
@media print{.gtp-over{display:none}}
`
}

/** Marks the entrance as seen for this session (sessionStorage), so it plays once. */
const ONCE_SCRIPT = `(function(){try{var d=document.documentElement,k='ghp:hero-seen';if(sessionStorage.getItem(k)){d.setAttribute('data-hero-seen','')}else{sessionStorage.setItem(k,'1');setTimeout(function(){d.setAttribute('data-hero-seen','')},4000)}}catch(e){}})()`

/* ------------------------------------------------------------------ */
/* components                                                          */
/* ------------------------------------------------------------------ */

/** `*word*` -> <em>word</em> (content convention for hero.role). */
function Emphasis({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*]+\*)/g).filter(Boolean).map((part, i) =>
        part.startsWith('*') && part.endsWith('*') ? <em key={i}>{part.slice(1, -1)}</em> : <span key={i}>{part}</span>,
      )}
    </>
  )
}

function LayerRow({ layer, index, total }: { layer: PlateLayer; index: number; total: number }) {
  const tone = (index % 6) + 1
  const texture = (index % 4) + 1
  const wave = wavePath(layer.key)
  const spoken = [layer.year, layer.label, layer.note.replace(/→/g, 'to')].filter(Boolean).join(', ')
  const inner = (
    <>
      <span className="gtp-cell" aria-hidden="true">
        <span className={cx('gtp-band', layer.marker ? 'gtp-mk' : `gtp-t${texture}`)} style={bandStyle(wave, tone, layer.marker)} />
        <svg className="gtp-edge" viewBox="0 0 100 16" preserveAspectRatio="none" focusable="false">
          <path d={wave} />
        </svg>
      </span>
      <span
        className={cx(
          'gtp-label relative grid grid-cols-[3.4rem_1fr] items-center gap-x-3 gap-y-1',
          'bg-surface px-s3 border-b border-rule-soft',
          layer.marker ? 'py-2' : 'py-s3',
        )}
      >
        <span className="mono nums text-accent-ink">{layer.year}</span>
        <span className="min-w-0">
          <span className="mono block text-ink [overflow-wrap:break-word]">{layer.label}</span>
          {layer.note ? <span className="block text-0 leading-snug text-ink-2 [overflow-wrap:break-word]">{layer.note}</span> : null}
        </span>
        {layer.slug ? (
          <span className="mono col-start-2 inline-flex items-center gap-1 text-ink-3 [overflow-wrap:anywhere]">
            {layer.slug}
            <span className="gtp-go inline-flex"><Icon name="arrow" size={14} /></span>
          </span>
        ) : null}
      </span>
    </>
  )
  return (
    <li className="gtp-layer" style={{ '--rise': total - 1 - index } as CSSProperties}>
      {layer.slug ? (
        <a
          href={`/playground/${layer.slug}`}
          aria-label={`${spoken}. Proof: ${layer.slug}`}
          title={layer.range || undefined}
          className="grid grid-cols-[var(--core-w)_1fr] min-h-[52px] no-underline text-ink focus-visible:outline-offset-[-2px]"
        >
          {inner}
        </a>
      ) : (
        <div className="grid grid-cols-[var(--core-w)_1fr] min-h-[52px]">{inner}</div>
      )}
    </li>
  )
}

function GridReadingSlot({ reading }: { reading: GridReading | null }) {
  const time = reading ? utcTime(reading.at) : ''
  return (
    <div className="border-t border-rule bg-surface px-s3 py-s4 grid gap-2">
      <p className="mono m-0 text-ink-2 flex flex-wrap justify-between gap-x-3 gap-y-1">
        <span>Live reading · UK grid carbon intensity</span>
        <span className="text-ink-3">gCO₂/kWh</span>
      </p>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <p className="display text-5 nums m-0 relative leading-none">
          {reading ? (
            <>
              <span className="gtp-dots absolute inset-0 text-ink-3" aria-hidden="true">…</span>
              <span className="gtp-value inline-block">{reading.value}</span>
            </>
          ) : (
            <span aria-label="No reading">—</span>
          )}
        </p>
        {reading ? (
          <span className={cx('gtp-value mono inline-flex items-center border px-2 py-[3px] rounded-pill mb-1', INDEX_TONE[reading.index.toLowerCase()] ?? 'border-rule text-ink-2')}>
            {reading.index}
          </span>
        ) : null}
      </div>
      <p className="mono m-0 text-ink-3">
        {reading ? (
          <>
            {reading.basis === 'actual' ? 'Measured' : 'Forecast'}
            {time ? <> · as of <time dateTime={reading.at}>{time} UTC</time></> : null}
            {' · '}
            <a href="https://carbonintensity.org.uk/" target="_blank" rel="noopener noreferrer" className="underline decoration-rule-soft hover:text-ink">
              carbonintensity.org.uk
            </a>
          </>
        ) : (
          'Feed unavailable. Nothing is estimated.'
        )}
      </p>
    </div>
  )
}

function CorePlate({ hero, layers, reading }: { hero: HeroContent; layers: PlateLayer[]; reading: GridReading | null | undefined }) {
  if (!layers.length && reading === undefined) return null
  const first = layers[layers.length - 1]
  const last = layers[0]
  const span = first && last ? `${formatPartialDate(first.when)} – ${formatPartialDate(last.when)}` : ''
  return (
    <figure className="m-0 w-full min-w-[min(320px,100%)] max-w-[34rem] lg:max-w-none justify-self-center lg:justify-self-stretch border border-rule bg-surface shadow-plate strata:rounded-2 strata:border-rule-soft overflow-hidden">
      <figcaption className="gtp-head mono flex flex-wrap justify-between gap-x-3 gap-y-1 px-s3 py-s3 border-b border-rule text-ink">
        {hero.plateTitle ? <span>{hero.plateTitle}</span> : null}
        {hero.plateNote ? <span className="text-ink-3">{hero.plateNote}</span> : null}
      </figcaption>
      {layers.length ? (
        <div className="gtp-core">
          <ol className="m-0 p-0 list-none" aria-label={[hero.plateTitle, span].filter(Boolean).join(', ')}>
            {layers.map((l, i) => <LayerRow key={l.key} layer={l} index={i} total={layers.length} />)}
          </ol>
          <span className="gtp-drill" aria-hidden="true" />
          <span className="gtp-drill-intro" aria-hidden="true" />
        </div>
      ) : null}
      {reading !== undefined ? <GridReadingSlot reading={reading} /> : null}
    </figure>
  )
}

export default async function Hero({ section }: SectionProps) {
  const { hero, profile } = getSite()
  const layers = plateLayers(hero)
  // undefined = reading switched off in content; null = feed failed (said so honestly).
  const reading = hero.showGridReading ? await getGridReading() : undefined

  return (
    <section id={section.id} aria-labelledby="hero-title" className="gtp-hero gtp-anim py-s7 md:py-s8 scroll-mt-20">
      <style href="gtp-hero" precedence="default">{heroCss(layers.length)}</style>
      <script dangerouslySetInnerHTML={{ __html: ONCE_SCRIPT }} />
      <div className="wrap grid gap-s7 lg:grid-cols-12 lg:gap-s6 lg:items-start">
        <div className="grid gap-s5 lg:col-span-7 min-w-0">
          <Kicker parts={hero.kicker} />
          <h1 id="hero-title" className="gtp-name text-hero [overflow-wrap:anywhere]">
            <span className="gtp-ink">{profile.name}</span>
            <span className="gtp-over" aria-hidden="true">{profile.name}</span>
          </h1>
          {hero.role ? (
            <p className="display text-3 m-0 almanac:italic max-w-[24ch] [text-wrap:balance]">
              <Emphasis text={hero.role} />
            </p>
          ) : profile.headline ? (
            <p className="display text-3 m-0">{profile.headline}</p>
          ) : null}
          {hero.lede ? <p className="gtp-lede measure m-0 text-ink">{hero.lede}</p> : null}
          {hero.ctas.length ? (
            <div className="flex flex-wrap gap-3">
              {hero.ctas.map((c) => (
                <ButtonLink key={c.href + c.label} href={c.href} variant={c.variant}>{c.label}</ButtonLink>
              ))}
            </div>
          ) : null}
          {profile.location ? (
            <p className="mono m-0 text-ink-3 inline-flex items-center gap-2">
              <Icon name="globe" size={16} />
              {profile.location}
            </p>
          ) : null}
        </div>
        <div className="lg:col-span-5 grid min-w-0">
          <CorePlate hero={hero} layers={layers} reading={reading} />
        </div>
      </div>
    </section>
  )
}
