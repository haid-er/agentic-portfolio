'use client'
/**
 * Canvas grid for the pathfinding tab. Draws walls, mud, the visited set (tint), the frontier (ring),
 * the cell being expanded, and the final path (a line), so state never relies on colour alone.
 * Pointer: press and drag to paint; drag S or E to move them.
 */
import { useEffect, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { MUD, WALL, xy, type Grid, type PathTrace } from './pathfinding'
import { useCanvas, useInks } from './useCanvas'

export function PathStage({ grid, trace, step, cursor, onCellDown, onCellEnter, onPointerEnd, onKeyDown, label, describedBy }: {
  grid: Grid
  trace: PathTrace
  step: number
  cursor: number
  onCellDown: (i: number) => void
  onCellEnter: (i: number) => void
  onPointerEnd: () => void
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
  label: string
  describedBy: string
}) {
  const [ref, size] = useCanvas()
  const inks = useInks()
  const [showCursor, setShowCursor] = useState(false)

  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx || !inks || size.w < 2) return
    const { cols, rows, cells } = grid
    const c = size.w / cols
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0)
    ctx.clearRect(0, 0, size.w, size.h)
    ctx.fillStyle = inks['--surface']
    ctx.fillRect(0, 0, size.w, size.h)

    const finished = step >= trace.order.length
    const current = step > 0 ? trace.order[step - 1] : -1

    for (let i = 0; i < cells.length; i++) {
      const [x, y] = xy(grid, i)
      const px = x * c, py = y * c
      const kind = cells[i]
      if (kind === WALL) {
        ctx.fillStyle = inks['--ink']
        ctx.fillRect(px, py, c, c)
        continue
      }
      if (kind === MUD) {
        ctx.globalAlpha = 0.3
        ctx.fillStyle = inks['--data-3']
        ctx.fillRect(px, py, c, c)
        ctx.globalAlpha = 1
        // Texture: three dots, so mud reads without colour.
        ctx.fillStyle = inks['--data-3']
        const r = Math.max(1, c * 0.07)
        for (const [fx, fy] of [[0.28, 0.3], [0.7, 0.45], [0.4, 0.74]] as const) {
          ctx.beginPath(); ctx.arc(px + fx * c, py + fy * c, r, 0, Math.PI * 2); ctx.fill()
        }
      }
      const v = trace.visitAt[i]
      const seen = trace.seenAt[i]
      if (v > 0 && v <= step) {
        ctx.globalAlpha = i === current ? 0.9 : 0.32
        ctx.fillStyle = inks['--data-1']
        ctx.fillRect(px + 0.5, py + 0.5, c - 1, c - 1)
        ctx.globalAlpha = 1
      } else if (seen >= 0 && seen <= step && step > 0) {
        ctx.strokeStyle = inks['--data-2']
        ctx.lineWidth = Math.max(1.5, c * 0.12)
        const inset = c * 0.22
        ctx.strokeRect(px + inset, py + inset, c - inset * 2, c - inset * 2)
      }
    }

    // Hairline grid.
    ctx.strokeStyle = inks['--rule-soft']
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 1; x < cols; x++) { ctx.moveTo(Math.round(x * c) + 0.5, 0); ctx.lineTo(Math.round(x * c) + 0.5, size.h) }
    for (let y = 1; y < rows; y++) { ctx.moveTo(0, Math.round(y * c) + 0.5); ctx.lineTo(size.w, Math.round(y * c) + 0.5) }
    ctx.stroke()

    if (finished && trace.found && trace.path.length > 1) {
      ctx.strokeStyle = inks['--accent-2']
      ctx.lineWidth = Math.max(2.5, c * 0.26)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      trace.path.forEach((p, k) => {
        const [x, y] = xy(grid, p)
        const cx = (x + 0.5) * c, cy = (y + 0.5) * c
        if (k === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy)
      })
      ctx.stroke()
    }

    const mark = (i: number, letter: string, fill: string) => {
      const [x, y] = xy(grid, i)
      const inset = c * 0.08
      ctx.fillStyle = fill
      ctx.fillRect(x * c + inset, y * c + inset, c - inset * 2, c - inset * 2)
      ctx.fillStyle = inks['--on-accent']
      ctx.font = `600 ${Math.max(9, Math.round(c * 0.55))}px ${inks['--font-mono'] || 'monospace'}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(letter, (x + 0.5) * c, (y + 0.54) * c)
    }
    mark(grid.start, 'S', inks['--accent'])
    mark(grid.end, 'E', inks['--ink'])

    if (showCursor) {
      const [x, y] = xy(grid, cursor)
      ctx.strokeStyle = inks['--focus']
      ctx.lineWidth = 2.5
      ctx.setLineDash([4, 3])
      ctx.strokeRect(x * c + 1.5, y * c + 1.5, c - 3, c - 3)
      ctx.setLineDash([])
    }
  }, [ref, size, inks, grid, trace, step, cursor, showCursor])

  const cellAt = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.floor(((e.clientX - r.left) / r.width) * grid.cols)
    const y = Math.floor(((e.clientY - r.top) / r.height) * grid.rows)
    if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) return -1
    return y * grid.cols + x
  }

  return (
    <div
      tabIndex={0}
      role="application"
      aria-roledescription="editable grid"
      aria-label={label}
      aria-describedby={describedBy}
      onKeyDown={(e) => { setShowCursor(true); onKeyDown(e) }}
      onFocus={(e) => setShowCursor(e.target === e.currentTarget && e.currentTarget.matches(':focus-visible'))}
      onBlur={() => setShowCursor(false)}
      className="relative border border-rule rounded-1 overflow-hidden bg-surface"
    >
      <canvas
        ref={ref}
        className="block w-full touch-none cursor-crosshair"
        style={{ aspectRatio: `${grid.cols} / ${grid.rows}` }}
        onPointerDown={(e) => {
          const i = cellAt(e)
          if (i < 0) return
          e.currentTarget.setPointerCapture(e.pointerId)
          onCellDown(i)
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
          const i = cellAt(e)
          if (i >= 0) onCellEnter(i)
        }}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      />
    </div>
  )
}
