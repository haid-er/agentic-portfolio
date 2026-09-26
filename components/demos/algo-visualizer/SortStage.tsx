'use client'
/**
 * Bars for the sorting tab. Compared bars get a marker triangle, written/swapped bars an
 * outline cap, sorted bars a solid fill and the pivot a dashed line, so no state is colour-only.
 */
import { useEffect } from 'react'
import type { SortFrame } from './sorting'
import { useCanvas, useInks } from './useCanvas'

export function SortStage({ frame, max, label }: { frame: SortFrame; max: number; label: string }) {
  const [ref, size] = useCanvas()
  const inks = useInks()

  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx || !inks || size.w < 2) return
    const { values, sorted, last, pivot } = frame
    const n = values.length
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0)
    ctx.clearRect(0, 0, size.w, size.h)
    ctx.fillStyle = inks['--surface']
    ctx.fillRect(0, 0, size.w, size.h)

    const top = 16
    const base = size.h - 4
    const slot = size.w / n
    const gap = slot > 8 ? Math.max(1, slot * 0.18) : 0.5
    const bw = Math.max(1, slot - gap)

    const compared = last?.t === 'cmp' ? [last.i, last.j] : []
    const written = last?.t === 'swap' ? [last.i, last.j] : last?.t === 'set' ? [last.i] : []

    // Baseline rule.
    ctx.fillStyle = inks['--rule']
    ctx.fillRect(0, base, size.w, 1)

    for (let i = 0; i < n; i++) {
      const h = Math.max(2, ((base - top) * values[i]) / max)
      const x = i * slot + gap / 2
      const y = base - h
      const isCmp = compared.includes(i)
      const isWrite = written.includes(i)
      ctx.fillStyle = isWrite ? inks['--data-3'] : isCmp ? inks['--data-2'] : sorted[i] ? inks['--data-1'] : inks['--ink-3']
      ctx.globalAlpha = sorted[i] || isCmp || isWrite ? 1 : 0.55
      ctx.fillRect(x, y, bw, h)
      ctx.globalAlpha = 1
      if (isWrite) {
        ctx.fillStyle = inks['--ink']
        ctx.fillRect(x, y - 3, bw, 3)
      }
      if (isCmp) {
        ctx.fillStyle = inks['--ink']
        const cx = x + bw / 2
        const s = Math.min(6, Math.max(3, bw / 2))
        ctx.beginPath()
        ctx.moveTo(cx - s, 2); ctx.lineTo(cx + s, 2); ctx.lineTo(cx, 2 + s * 1.3); ctx.closePath()
        ctx.fill()
      }
    }

    if (pivot >= 0 && pivot < n) {
      const py = base - Math.max(2, ((base - top) * values[pivot]) / max)
      ctx.strokeStyle = inks['--accent-2']
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 4])
      ctx.beginPath(); ctx.moveTo(0, py + 0.5); ctx.lineTo(size.w, py + 0.5); ctx.stroke()
      ctx.setLineDash([])
    }
  }, [ref, size, inks, frame, max])

  return (
    <div className="border border-rule rounded-1 overflow-hidden bg-surface">
      <canvas ref={ref} role="img" aria-label={label} className="block w-full h-[220px] md:h-[280px]" />
    </div>
  )
}
