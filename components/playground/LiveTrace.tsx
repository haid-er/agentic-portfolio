'use client'
/**
 * A poster whose trace scrolls like a seismograph drum (DESIGN.md 10). Plays
 * only while on screen, the tab is visible and motion is allowed; under reduced
 * motion it shows one still frame and a Play button (DESIGN.md 8).
 * The loop is slower than 7s, and only transform is animated.
 */
import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ui'
import type { PosterKind } from './posters'
import { useInView, usePageVisible, useReducedMotion } from '@/lib/hooks'
import { PosterSvg } from './PosterSvg'
import { W } from './posters'

const LOOP_MS = 9000

export function LiveTrace({ slug, glyph, autoplay = true, className }: {
  slug: string
  glyph: PosterKind
  /** false = start on a still frame with a Play button (homepage: only the ambient accent loops). */
  autoplay?: boolean
  className?: string
}) {
  const [box, inView] = useInView<HTMLDivElement>({ rootMargin: '80px' })
  const visible = usePageVisible()
  const reduced = useReducedMotion()
  /** null = follow the motion preference; true/false = the viewer chose. */
  const [choice, setChoice] = useState<boolean | null>(null)
  const track = useRef<SVGGElement>(null)
  const anim = useRef<Animation | null>(null)

  const wanted = choice ?? (autoplay && !reduced)
  const running = wanted && inView && visible

  useEffect(() => {
    const g = track.current
    if (!g || typeof g.animate !== 'function') return
    const a = g.animate([{ transform: 'translateX(0px)' }, { transform: `translateX(-${W}px)` }], {
      duration: LOOP_MS,
      iterations: Infinity,
    })
    a.pause()
    anim.current = a
    return () => { a.cancel(); anim.current = null }
  }, [])

  useEffect(() => {
    const a = anim.current
    if (!a) return
    if (running) a.play()
    else a.pause()
  }, [running])

  return (
    <div ref={box} className={className}>
      <PosterSvg slug={slug} glyph={glyph} trackRef={track} className="block size-full" />
      <button
        type="button"
        onClick={() => setChoice(!wanted)}
        aria-label={wanted ? 'Pause trace' : 'Play trace'}
        className="absolute right-2 bottom-2 inline-flex size-tap items-center justify-center rounded-pill border border-rule bg-surface text-ink hover:bg-bg-2"
      >
        <Icon name={wanted ? 'pause' : 'play'} size={18} />
      </button>
    </div>
  )
}
