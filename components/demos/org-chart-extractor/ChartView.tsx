'use client'
/** SVG org chart (boxes + elbow connectors). Also used to print the sample chart the vision model reads. */
import { forwardRef, type KeyboardEvent } from 'react'
import { layout, type Person } from './model'

const W = 156
const H = 54
const GX = 14
const GY = 44
const PAD = 12

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export const ChartView = forwardRef<SVGSVGElement, {
  people: Person[]
  label: string
  selected?: string | null
  onSelect?: (id: string) => void
  /** Plain printed look (for the sample document): no focus/selection affordances. */
  printed?: boolean
}>(function ChartView({ people, label, selected, onSelect, printed }, ref) {
  const { nodes, cols, depth } = layout(people)
  const vbW = PAD * 2 + cols * W + (cols - 1) * GX
  const vbH = PAD * 2 + depth * H + Math.max(0, depth - 1) * GY
  const at = new Map(nodes.map((n) => [n.person.id, { x: PAD + n.x * (W + GX), y: PAD + n.depth * (H + GY) }]))

  const key = (id: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(id) }
  }

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${vbW} ${vbH}`}
      width={printed ? vbW : '100%'}
      height={printed ? vbH : undefined}
      role={printed ? 'img' : 'group'}
      aria-label={label}
      style={{ display: 'block', minWidth: printed ? undefined : Math.min(vbW, 560), maxWidth: printed ? '100%' : vbW, margin: '0 auto', height: printed ? 'auto' : undefined, fontFamily: 'var(--ff-body, sans-serif)' }}
    >
      <rect width={vbW} height={vbH} style={{ fill: printed ? 'var(--surface)' : 'transparent' }} />
      {nodes.map(({ person }) => {
        if (!person.managerId) return null
        const a = at.get(person.managerId)
        const b = at.get(person.id)
        if (!a || !b) return null
        const x1 = a.x + W / 2
        const x2 = b.x + W / 2
        const midY = b.y - GY / 2
        return <path key={`e-${person.id}`} d={`M${x1} ${a.y + H} V${midY} H${x2} V${b.y}`} fill="none" style={{ stroke: 'var(--ink-2)', strokeWidth: 1.25 }} />
      })}
      {nodes.map(({ person }) => {
        const p = at.get(person.id)
        if (!p) return null
        const on = selected === person.id
        const interactive = !printed && onSelect
        return (
          <g
            key={person.id}
            transform={`translate(${p.x} ${p.y})`}
            {...(interactive ? {
              role: 'button',
              tabIndex: 0,
              'aria-pressed': on,
              'aria-label': `${person.name}${person.title ? `, ${person.title}` : ''}`,
              onClick: () => onSelect?.(person.id),
              onKeyDown: key(person.id),
              className: 'cursor-pointer outline-none [&:focus-visible>rect]:[stroke:var(--focus)] [&:focus-visible>rect]:[stroke-width:3]',
            } : {})}
          >
            <rect
              width={W}
              height={H}
              rx={printed ? 2 : 4}
              style={{ fill: 'var(--surface)', stroke: on ? 'var(--accent)' : 'var(--ink)', strokeWidth: on ? 2.5 : 1.25 }}
            />
            <text x={W / 2} y={22} textAnchor="middle" fontSize={12.5} fontWeight={700} style={{ fill: 'var(--ink)' }}>{clip(person.name, 22)}</text>
            <text x={W / 2} y={39} textAnchor="middle" fontSize={10.5} style={{ fill: 'var(--ink-2)' }}>{clip(person.title, 26)}</text>
          </g>
        )
      })}
    </svg>
  )
})

/** Serialise a rendered chart to a PNG data URL, resolving CSS custom properties to the current world's inks. */
export async function svgToPngDataUrl(svg: SVGSVGElement, scale = 2): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const css = getComputedStyle(document.documentElement)
  const resolve = (s: string) => s.replace(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g, (_m, name: string, fb?: string) => css.getPropertyValue(name).trim() || fb || 'black')
  clone.querySelectorAll<SVGElement>('[style]').forEach((el) => el.setAttribute('style', resolve(el.getAttribute('style') ?? '')))
  // Images cannot load web fonts: print the document in a system sans.
  clone.setAttribute('style', 'font-family: Arial, Helvetica, sans-serif')
  const vb = svg.viewBox.baseVal
  clone.setAttribute('width', String(vb.width))
  clone.setAttribute('height', String(vb.height))
  const xml = new XMLSerializer().serializeToString(clone)
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(vb.width * scale)
  canvas.height = Math.round(vb.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0, vb.width, vb.height)
  return canvas.toDataURL('image/png')
}
