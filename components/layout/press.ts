/**
 * "Pull a new proof" (DESIGN.md 3): the signature world switch. Client only.
 *
 * Three paths, picked at call time:
 *  1. Reduced motion: flip instantly, then a 150ms cross-fade of header + main.
 *  2. View Transitions: flip inside the transition; the REAL new page is revealed
 *     band by band (clip-path on ::view-transition-new(root)) behind seven brayer
 *     lips that have their own view-transition-names, so the snapshot never hides them.
 *  3. Fallback overlay: seven bands in the next world's --bg roll in (45ms stagger),
 *     the theme flips under full cover (~600ms), then the bands roll away right.
 *
 * Only transform, clip-path and opacity are animated. The overlay elements carry
 * data-theme={next}, so every var() inside them resolves to the next world's tokens
 * (including admin overrides) without a single hard-coded colour.
 */
import type { ThemeKey } from '@/lib/content/schema'
import { setTheme } from '@/lib/theme/client'
import { announce } from './events'
import type { ThemeLabels } from './types'

const BANDS = 7
const STAGGER = 45
/* overlay path */
const ROLL = 300
const FLIP_AT = 600
const LIFT_AT = 640
/* view-transition path */
const SWEEP = 620
const LIP = 14

let busy = false

/** Mount inside an open modal dialog (top layer) so the press covers it too. */
const mountPoint = (): HTMLElement => document.querySelector<HTMLElement>('dialog[open]') ?? document.body

const REGISTER_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="6.5"/><path d="M12 1.5v21M1.5 12h21"/></svg>'

function el(tag: string, className: string, theme: ThemeKey): HTMLElement {
  const n = document.createElement(tag)
  n.className = className
  n.dataset.theme = theme
  return n
}

function makeTag(next: ThemeKey, labels: ThemeLabels): HTMLElement {
  const tag = el('div', 'press-tag', next)
  tag.innerHTML = REGISTER_SVG
  const text = document.createElement('span')
  const { swapLabel, label } = labels[next]
  text.textContent = swapLabel ? `${swapLabel} · ${label}` : label
  tag.append(text)
  return tag
}

/** Mark the new world for one "settle" play (hero accents may key off html[data-settle]). */
function settle(next: ThemeKey) {
  const d = document.documentElement
  d.dataset.settle = next
  window.setTimeout(() => { if (d.dataset.settle === next) delete d.dataset.settle }, 1400)
}

function flip(next: ThemeKey, labels: ThemeLabels) {
  setTheme(next)
  settle(next)
  announce(`${labels[next].label} theme on.`)
}

/** easeInOutCubic, close to --ease-press. */
const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

function reducedFade(next: ThemeKey, labels: ThemeLabels) {
  flip(next, labels)
  for (const n of document.querySelectorAll<HTMLElement>('#main, [data-shell-header]')) {
    n.animate?.([{ opacity: 0.4 }, { opacity: 1 }], { duration: 150, easing: 'linear' })
  }
}

async function viewTransitionPress(next: ThemeKey, labels: ThemeLabels) {
  const html = document.documentElement
  const w = window.innerWidth
  const h = window.innerHeight
  const bandH = Math.ceil(h / BANDS)
  const layer = el('div', 'press-vt', next)
  layer.setAttribute('aria-hidden', 'true')
  for (let i = 0; i < BANDS; i++) {
    const lip = el('div', 'press-lip', next)
    lip.style.top = `${Math.round((i * h) / BANDS)}px`
    lip.style.height = `${bandH}px`
    lip.style.viewTransitionName = `press-lip-${i}`
    layer.append(lip)
  }
  const tag = makeTag(next, labels)
  tag.style.viewTransitionName = 'press-tag'
  layer.append(tag)
  mountPoint().append(layer)
  html.dataset.press = 'vt'

  try {
    const vt = document.startViewTransition(() => flip(next, labels))
    await vt.ready

    // Staircase polygon: band i is revealed up to its lip's trailing edge.
    const total = SWEEP + (BANDS - 1) * STAGGER
    const frames: Keyframe[] = []
    const steps = 36
    for (let f = 0; f <= steps; f++) {
      const t = (f / steps) * total
      const pts: string[] = []
      for (let i = 0; i < BANDS; i++) {
        const p = ease(clamp01((t - i * STAGGER) / SWEEP))
        const x = Math.max(0, -LIP + p * (w + LIP))
        const top = (i * 100) / BANDS
        const bottom = ((i + 1) * 100) / BANDS
        pts.push(`${x}px ${top}%`, `${x}px ${bottom}%`)
      }
      frames.push({ clipPath: `polygon(0 0, ${pts.join(', ')}, 0 100%)` })
    }
    html.animate(frames, { duration: total, easing: 'linear', fill: 'both', pseudoElement: '::view-transition-new(root)' })

    // A group's transform also carries its position, so the band's y offset is kept here.
    for (let i = 0; i < BANDS; i++) {
      const y = Math.round((i * h) / BANDS)
      html.animate(
        [{ transform: `translate(${-LIP}px, ${y}px)` }, { transform: `translate(${w}px, ${y}px)` }],
        { duration: SWEEP, delay: i * STAGGER, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both', pseudoElement: `::view-transition-group(press-lip-${i})` },
      )
    }
    html.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.78 }, { opacity: 0 }],
      { duration: total, fill: 'both', pseudoElement: '::view-transition-group(press-tag)' },
    )
    await vt.finished
  } finally {
    layer.remove()
    delete html.dataset.press
  }
}

function overlayPress(next: ThemeKey, labels: ThemeLabels): Promise<void> {
  return new Promise((resolve) => {
    const root = el('div', 'press', next)
    root.setAttribute('aria-hidden', 'true')
    const inks: HTMLElement[] = []
    for (let i = 0; i < BANDS; i++) {
      const band = el('div', 'press-band', next)
      const ink = el('div', 'press-ink', next)
      band.append(ink)
      root.append(band)
      inks.push(ink)
    }
    const tag = makeTag(next, labels)
    root.append(tag)
    mountPoint().append(root)

    const easing = 'cubic-bezier(.7,0,.3,1)'
    inks.forEach((ink, i) => {
      ink.animate([{ transform: 'translateX(-101%)' }, { transform: 'translateX(0)' }], { duration: ROLL, delay: i * STAGGER, easing, fill: 'both' })
      // No backwards fill: during its delay the ink-on pose above stays in effect.
      ink.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(101%)' }], { duration: ROLL, delay: LIFT_AT + i * STAGGER, easing, fill: 'forwards' })
    })
    const total = LIFT_AT + (BANDS - 1) * STAGGER + ROLL
    tag.animate(
      [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none', offset: 0.1 }, { opacity: 1, transform: 'none', offset: 0.8 }, { opacity: 0 }],
      { duration: total, fill: 'both' },
    )

    window.setTimeout(() => flip(next, labels), FLIP_AT)
    window.setTimeout(() => { root.remove(); resolve() }, total + 40)
  })
}

/**
 * Switch to `next` with the press transition. Resolves when the page is fully
 * revealed. Calls while a press is running are ignored.
 */
export async function pullNewProof(next: ThemeKey, labels: ThemeLabels): Promise<void> {
  if (busy) return
  busy = true
  try {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) { reducedFade(next, labels); return }
    const canVT = typeof document.startViewTransition === 'function' && typeof Element.prototype.animate === 'function'
    if (canVT) {
      try { await viewTransitionPress(next, labels); return } catch {
        // Fall through: the theme may already have flipped; make sure it did.
        if (document.documentElement.dataset.theme !== next) flip(next, labels)
        return
      }
    }
    if (typeof Element.prototype.animate === 'function') { await overlayPress(next, labels); return }
    flip(next, labels)
  } finally {
    busy = false
  }
}
