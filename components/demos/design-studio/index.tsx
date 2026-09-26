'use client'
/**
 * Poster press: a seeded generative poster maker. Grid, type and shapes come
 * from one deterministic model, previewed as inline SVG in the current world's
 * inks and exported as PNG (canvas) or SVG.
 */
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Button, DemoGrid, DemoPanel, ErrorState, Loading, useToast } from '@/components/ui'
import { getTheme } from '@/lib/content'
import type { DemoProps } from '@/lib/demos/types'
import { useLocalStorage, useReducedMotion } from '@/lib/hooks'
import { themeLabels } from '@/lib/theme'
import { useThemeKey } from '@/lib/theme/client'
import { cx } from '@/lib/utils'
import { Controls } from './Controls'
import { approxMeasure, makePoster, randomSeed, STYLES, type PosterParams } from './engine'
import { exportPng, exportSvg, loadFaces } from './exporters'
import { DEFAULTS, fileName, fromUrl, sameParams, sanitize, shareUrl } from './params'
import { Prints } from './Prints'
import { canvasMeasure, posterSvg } from './render'
import { useInks } from './useInks'

export { notes } from './notes'

const HISTORY = 8
const KEPT = 12

export default function Demo(_props: DemoProps) {
  const toast = useToast()
  const reduced = useReducedMotion()
  const themeKey = useThemeKey()
  const labels = useMemo(() => themeLabels(getTheme()), [])

  const [stored, setStored] = useLocalStorage<PosterParams>('design-studio:params', DEFAULTS)
  const [kept, setKept] = useLocalStorage<PosterParams[]>('design-studio:kept', [])
  const params = useMemo(() => sanitize(stored), [stored])
  const [history, setHistory] = useState<PosterParams[]>([])
  const [facesReady, setFacesReady] = useState(false)
  const [busy, setBusy] = useState<null | 'png' | 'svg'>(null)
  const [error, setError] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')

  const { inks, fonts, probeRef, probeTheme } = useInks(params.inks)

  // A shared link (?seed=…) reprints that exact poster.
  useEffect(() => {
    const fromLink = fromUrl()
    if (fromLink) setStored(fromLink)
  }, [setStored])

  // Wait for the faces so headline fitting measures the real typeface.
  useEffect(() => {
    if (!fonts) return
    let live = true
    setFacesReady(false)
    const timer = window.setTimeout(() => live && setFacesReady(true), 2500)
    loadFaces(fonts).finally(() => { if (live) { window.clearTimeout(timer); setFacesReady(true) } })
    return () => { live = false; window.clearTimeout(timer) }
  }, [fonts])

  const measure = useMemo(() => (fonts && facesReady ? canvasMeasure(fonts) : approxMeasure), [fonts, facesReady])
  const poster = useMemo(() => makePoster(params, measure), [params, measure])
  const styleLabel = STYLES.find((s) => s.value === params.style)?.label ?? params.style
  const title = `Poster No. ${String(params.seed).padStart(4, '0')}, ${styleLabel}${params.headline ? `: ${params.headline}` : ''}`
  const svg = useMemo(
    () => (inks && fonts ? posterSvg(poster, inks, fonts, { grid: params.grid }) : ''),
    [poster, inks, fonts, params.grid],
  )

  const update = useCallback((patch: Partial<PosterParams>) => {
    setStored((prev) => sanitize({ ...sanitize(prev), ...patch }))
  }, [setStored])

  const remember = useCallback((p: PosterParams) => {
    setHistory((h) => [p, ...h.filter((x) => !sameParams(x, p))].slice(0, HISTORY))
  }, [])

  const pull = useCallback(() => {
    remember(params)
    const seed = randomSeed()
    update({ seed })
    setAnnounce(`Pulled print No. ${String(seed).padStart(4, '0')}.`)
  }, [params, remember, update])

  const restore = (p: PosterParams) => {
    remember(params)
    setStored(sanitize(p))
    setAnnounce(`Restored print No. ${String(p.seed).padStart(4, '0')}.`)
  }

  const keep = () => {
    if (kept.some((k) => sameParams(k, params))) { toast('Already in your drawer.'); return }
    setKept((xs) => [params, ...xs].slice(0, KEPT))
    toast('Kept in your drawer (this browser only).', { tone: 'ok' })
  }

  const doExport = async (kind: 'png' | 'svg') => {
    if (!inks || !fonts) return
    setBusy(kind)
    setError(null)
    try {
      if (kind === 'png') await exportPng(poster, inks, fonts, fileName(params))
      else exportSvg(poster, inks, fonts, fileName(params), title)
      toast(kind === 'png' ? 'PNG saved (1260 px wide).' : 'SVG saved.', { tone: 'ok' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The export failed.')
    } finally {
      setBusy(null)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(params))
      toast('Link copied: it reprints this exact poster.', { tone: 'ok' })
    } catch {
      toast('Clipboard is blocked here. Copy the address bar after pressing Share.', { tone: 'warn' })
      window.history.replaceState(null, '', shareUrl(params))
    }
  }

  const onStageKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'p' || e.key === 'P' || e.key === 'Enter') { e.preventDefault(); pull() }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      update({ seed: ((params.seed - 1 + (e.key === 'ArrowRight' ? 1 : -1) + 9999) % 9999) + 1 })
    }
  }

  const ready = Boolean(inks && fonts)

  return (
    <div className="grid gap-4">
      {/* Probe: resolves the other world's tokens without switching the page. */}
      <div ref={probeRef} data-theme={probeTheme} hidden aria-hidden="true" />
      <p className="sr-only" aria-live="polite">{announce}</p>

      <DemoGrid
        aside={
          <Controls
            params={params}
            update={update}
            onPull={pull}
            labels={{ world: labels[themeKey].label, other: labels[probeTheme].label }}
          />
        }
      >
        <DemoPanel
          title="Press bed"
          meta={<span className="nums">{poster.w} × {poster.h} · {params.format === 'square' ? '1:1' : '1:√2'}</span>}
          actions={
            <Button size="sm" icon="refresh" onClick={pull}>Pull another print</Button>
          }
        >
          <div className="grid gap-3">
            <div
              tabIndex={0}
              onKeyDown={onStageKey}
              aria-label={`${title}. Press P or Enter to pull another print, arrow keys to step the seed.`}
              className="relative mx-auto w-full max-w-[460px] bg-bg-2 p-2 xs:p-4 rounded-1 [background-image:var(--pattern)]"
            >
              {!ready ? (
                <div className="grid place-items-center aspect-[1/1.414]"><Loading label="Mixing inks" /></div>
              ) : (
                <figure className="m-0 grid gap-2">
                  <div
                    key={`${params.seed}-${params.style}-${params.format}`}
                    role="img"
                    aria-label={title}
                    className={cx(
                      'shadow-plate [&>svg]:block [&>svg]:w-full [&>svg]:h-auto',
                      !reduced && 'animate-[print-in_var(--dur-med)_var(--ease-out)]',
                    )}
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                  <figcaption className="flex flex-wrap justify-between gap-2 mono text-ink-3">
                    <span>{poster.caption}</span>
                    <span>{facesReady ? 'type set' : 'setting type…'}</span>
                  </figcaption>
                </figure>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" icon="download" onClick={() => doExport('png')} disabled={!ready || busy !== null}>
                {busy === 'png' ? 'Rendering…' : 'PNG'}
              </Button>
              <Button size="sm" variant="secondary" icon="download" onClick={() => doExport('svg')} disabled={!ready || busy !== null}>
                {busy === 'svg' ? 'Writing…' : 'SVG'}
              </Button>
              <Button size="sm" variant="secondary" icon="copy" onClick={copyLink}>Share link</Button>
              <Button size="sm" variant="ghost" icon="plus" onClick={keep}>Keep</Button>
            </div>
            {error ? (
              <ErrorState title="Export failed" action={<Button size="sm" variant="secondary" onClick={() => setError(null)}>Dismiss</Button>}>
                {error} Nothing was saved.
              </ErrorState>
            ) : null}
          </div>
        </DemoPanel>

        <Prints
          history={history}
          kept={kept}
          inks={inks ?? null}
          fonts={fonts ?? null}
          onRestore={restore}
          onRemoveKept={(i) => setKept((xs) => xs.filter((_, j) => j !== i))}
        />
      </DemoGrid>
    </div>
  )
}
