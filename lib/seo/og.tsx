/**
 * Share cards in the Almanac style (DESIGN.md 2.1, 6.1). Owner: seo-theme.
 *
 * A risograph proof on cream stock: masthead strip, mono kicker, the title set
 * in Fraunces with a vermilion overprint out of register, and on the right the
 * core-sample plate (newest layer on top) or, for inner pages, a specimen slip
 * of proof chips. Every word on the card is passed in from content; this file
 * holds layout only. Colours come from the world's tokens (admin overrides
 * included) via `worldTokens()`.
 *
 * Usage in any segment's opengraph-image.tsx:
 *   return renderOgImage({ colors, edition, kicker, title, ... })
 */
import { ImageResponse } from 'next/og'
import type { ReactElement } from 'react'
import type { WorldColors } from '@/lib/theme/tokens'
import { loadOgFonts, OG_FONTS } from './og-fonts'

export const OG_IMAGE_SIZE = { width: 1200, height: 630 }

export interface OgLayer {
  /** "2025" */
  year: string
  /** "Piron Labs" */
  label: string
}

export interface OgCard {
  colors: WorldColors
  /** World label, printed as "Edition: {edition}". */
  edition: string
  location?: string
  strapline?: string
  kicker?: string[]
  title: string
  subtitle?: string
  /** Bottom-left line, e.g. "Proof: /playground". */
  footer?: string
  /** Bottom-right line, usually the host. */
  host?: string
  /** Core-sample plate, newest first. */
  layers?: OgLayer[]
  plateTitle?: string
  plateNote?: string
  /** Specimen slip (used when there are no layers). */
  chips?: string[]
  chipsTitle?: string
  /** Full-bleed image instead of the drawn card (admin `seo.ogImage`). */
  backdrop?: string
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** "#1F6B47" + .2 -> "rgba(31,107,71,0.2)". Non-hex colours pass through. */
function alpha(color: string, a: number): string {
  const m = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return color
  const hex = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1]
  const n = parseInt(hex, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/** Deterministic PRNG (mulberry32), so a card renders identically every build. */
function prng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Wavy top edge for one sediment layer. */
function bandPath(w: number, h: number, seed: number): string {
  const rnd = prng(seed * 7919 + 17)
  const f = 1 + rnd() * 1.4
  const phase = rnd() * Math.PI * 2
  const amp = 2.5 + rnd() * 3
  const pts: string[] = []
  for (let x = 0; x <= w; x += w / 24) {
    const y = 7 + Math.sin((x / w) * Math.PI * 2 * f + phase) * amp + (rnd() - 0.5) * 1.6
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return `M${pts.join(' L')} L${w},${h} L0,${h} Z`
}

function titleSize(t: string): number {
  if (t.length <= 18) return 98
  if (t.length <= 30) return 80
  if (t.length <= 48) return 64
  return 52
}

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

const MONO = { fontFamily: OG_FONTS.mono, fontWeight: 500, textTransform: 'uppercase' as const }

function Masthead({ c, card }: { c: WorldColors; card: OgCard }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 54,
        padding: '0 56px',
        borderBottom: `2px solid ${c['--rule']}`,
        color: c['--ink-2'],
        fontSize: 16,
        letterSpacing: 2,
        ...MONO,
      }}
    >
      <div style={{ display: 'flex' }}>{card.location ?? ''}</div>
      <div style={{ display: 'flex' }}>{card.strapline ?? ''}</div>
      <div style={{ display: 'flex' }}>{`Edition: ${card.edition}`}</div>
    </div>
  )
}

function Title({ c, text }: { c: WorldColors; text: string }) {
  const size = titleSize(text)
  const base = {
    fontFamily: OG_FONTS.display,
    fontWeight: 600,
    fontSize: size,
    lineHeight: 0.94,
    letterSpacing: -size * 0.025,
  }
  return (
    <div style={{ display: 'flex', position: 'relative', marginTop: 18, width: '100%' }}>
      {/* vermilion overprint, knocked out of register */}
      <div style={{ ...base, position: 'absolute', left: 5, top: 4, width: '100%', color: c['--accent-2'], opacity: 0.85, display: 'flex' }}>
        {text}
      </div>
      <div style={{ ...base, position: 'relative', color: c['--ink'], display: 'flex' }}>{text}</div>
    </div>
  )
}

function CorePlate({ c, card }: { c: WorldColors; card: OgCard }) {
  const layers = (card.layers ?? []).slice(0, 6)
  const W = 150
  const inks = [c['--accent'], c['--accent-2'], c['--accent'], c['--accent-2'], c['--ink-2'], c['--accent']]
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 430,
        background: c['--surface'],
        border: `2px solid ${c['--rule']}`,
        boxShadow: `10px 10px 0 ${c['--accent-2']}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '11px 16px 10px',
          borderBottom: `1.5px solid ${c['--rule']}`,
          fontSize: 13,
          lineHeight: 1.35,
          letterSpacing: 1.6,
          color: c['--ink'],
          ...MONO,
        }}
      >
        <div style={{ display: 'flex' }}>{card.plateTitle ?? ''}</div>
        {card.plateNote ? <div style={{ display: 'flex', color: c['--ink-3'] }}>{card.plateNote}</div> : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        {layers.map((l, i) => {
          const h = 70
          const ink = inks[i % inks.length]
          return (
            <div key={`${l.year}-${l.label}`} style={{ display: 'flex', flexGrow: 1, alignItems: 'stretch' }}>
              <svg width={W} height={h} viewBox={`0 0 ${W} ${h}`} style={{ flexShrink: 0 }}>
                <defs>
                  <pattern id={`ht${i}`} width="7" height="7" patternUnits="userSpaceOnUse">
                    <circle cx="3.5" cy="3.5" r={i % 2 ? 1.5 : 1.9} fill={ink} />
                  </pattern>
                </defs>
                <path d={bandPath(W, h + 8, i + 1)} fill={alpha(ink, 0.1)} />
                <path d={bandPath(W, h + 8, i + 1)} fill={`url(#ht${i})`} stroke={c['--ink']} strokeWidth="1.5" />
                {/* drill line running down the core */}
                <line x1={W * 0.62} y1={0} x2={W * 0.62} y2={h} stroke={c['--accent-ink']} strokeWidth="1.5" strokeDasharray="4 4" />
              </svg>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  width: 430 - 4 - W,
                  padding: '0 14px 0 16px',
                  borderLeft: `1.5px solid ${c['--rule']}`,
                  borderBottom: i < layers.length - 1 ? `1px solid ${alpha(c['--ink'], 0.22)}` : 'none',
                }}
              >
                <div style={{ display: 'flex', fontSize: 14, letterSpacing: 1.5, color: c['--accent-ink'], ...MONO }}>{l.year}</div>
                <div style={{ display: 'flex', fontSize: 16, lineHeight: 1.2, letterSpacing: 1, color: c['--ink'], marginTop: 3, ...MONO }}>{l.label}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ChipSlip({ c, card }: { c: WorldColors; card: OgCard }) {
  const chips = (card.chips ?? []).slice(0, 7)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 400,
        padding: '22px 24px',
        background: c['--surface'],
        border: `2px solid ${c['--rule']}`,
        boxShadow: `10px 10px 0 ${c['--accent-2']}`,
      }}
    >
      <div style={{ display: 'flex', fontSize: 14, letterSpacing: 1.8, color: c['--ink-3'], marginBottom: 14, ...MONO }}>
        {card.chipsTitle ?? ''}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {chips.map((chip) => (
          <div
            key={chip}
            style={{
              display: 'flex',
              padding: '8px 12px',
              background: c['--bg-2'],
              border: `1.5px solid ${c['--rule']}`,
              fontSize: 17,
              letterSpacing: 1,
              color: c['--ink'],
              ...MONO,
            }}
          >
            {chip}
          </div>
        ))}
      </div>
      {/* registration mark, printed twice and slightly out of register */}
      <div style={{ display: 'flex', marginTop: 'auto', marginBottom: 18, alignSelf: 'flex-end' }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          <g fill="none" stroke={c['--accent-2']} strokeWidth="3" opacity="0.85" transform="translate(4 3)">
            <circle cx="58" cy="58" r="34" />
            <path d="M58 6v104M6 58h104" />
          </g>
          <g fill="none" stroke={c['--ink']} strokeWidth="3">
            <circle cx="58" cy="58" r="34" />
            <circle cx="58" cy="58" r="14" />
            <path d="M58 6v104M6 58h104" />
          </g>
        </svg>
      </div>
      {card.host ? (
        <div
          style={{
            display: 'flex',
            paddingTop: 12,
            borderTop: `1px solid ${alpha(c['--ink'], 0.22)}`,
            fontSize: 13,
            letterSpacing: 1.4,
            color: c['--ink-3'],
            ...MONO,
          }}
        >
          {card.host}
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* card                                                                */
/* ------------------------------------------------------------------ */

export function OgCardView({ card }: { card: OgCard }): ReactElement {
  const c = card.colors
  if (card.backdrop) {
    return (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: c['--bg'] }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={card.backdrop} width={OG_IMAGE_SIZE.width} height={OG_IMAGE_SIZE.height} style={{ objectFit: 'cover' }} />
      </div>
    )
  }
  const hasPlate = (card.layers?.length ?? 0) > 0
  const hasSlip = !hasPlate && (card.chips?.length ?? 0) > 0
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: c['--bg'],
        backgroundImage: `radial-gradient(circle at 3px 3px, ${alpha(c['--accent'], 0.13)} 1.6px, transparent 2.3px)`,
        backgroundSize: '12px 12px',
        color: c['--ink'],
        fontFamily: OG_FONTS.body,
      }}
    >
      <Masthead c={c} card={card} />
      <div style={{ display: 'flex', flexGrow: 1, padding: '40px 56px 44px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexGrow: 1, flexBasis: 0, paddingRight: 44 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {card.kicker?.length ? (
              <div style={{ display: 'flex', fontSize: 17, letterSpacing: 2.2, color: c['--accent-ink'], ...MONO }}>
                {card.kicker.join('  /  ')}
              </div>
            ) : null}
            <Title c={c} text={card.title} />
            {card.subtitle ? (
              <div
                style={{
                  display: 'flex',
                  marginTop: 26,
                  fontSize: 32,
                  lineHeight: 1.22,
                  fontStyle: 'italic',
                  color: c['--accent'],
                  maxWidth: 640,
                }}
              >
                {card.subtitle}
              </div>
            ) : null}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 14,
              borderTop: `2px solid ${c['--rule']}`,
              fontSize: 15,
              letterSpacing: 1.4,
              ...MONO,
            }}
          >
            <div style={{ display: 'flex', color: c['--accent-ink'] }}>{card.footer ?? ''}</div>
            {hasSlip ? null : <div style={{ display: 'flex', color: c['--ink-3'] }}>{card.host ?? ''}</div>}
          </div>
        </div>
        {hasPlate ? <CorePlate c={c} card={card} /> : null}
        {hasSlip ? <ChipSlip c={c} card={card} /> : null}
      </div>
    </div>
  )
}

/** Every string on the card, for font subsetting. */
function cardText(card: OgCard): string {
  return [
    card.edition, card.location, card.strapline, ...(card.kicker ?? []), card.title, card.subtitle,
    card.footer, card.host, card.plateTitle, card.plateNote, card.chipsTitle, ...(card.chips ?? []),
    ...(card.layers ?? []).flatMap((l) => [l.year, l.label]), 'Edition:',
  ].join(' ')
}

/** The PNG response for an opengraph-image / twitter-image route. */
export async function renderOgImage(card: OgCard): Promise<ImageResponse> {
  const fonts = card.backdrop ? [] : await loadOgFonts(cardText(card))
  return new ImageResponse(<OgCardView card={card} />, {
    ...OG_IMAGE_SIZE,
    fonts: fonts.length ? fonts : undefined,
  })
}
