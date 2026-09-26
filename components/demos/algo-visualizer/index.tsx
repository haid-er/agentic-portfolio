'use client'
/**
 * Algorithm visualiser: A*, Dijkstra and BFS on an editable grid, and four sorting algorithms,
 * each recorded as a trace you can play, step and scrub, with live counters and a side-by-side table.
 */
import { useEffect, useRef, useState } from 'react'
import { Loading, Segmented } from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { useInView, useLocalStorage, usePageVisible } from '@/lib/hooks'
import { Pathfinding } from './Pathfinding'
import { Sorting } from './Sorting'

export { notes } from './notes'

type Tab = 'path' | 'sort'
const TABS = [{ value: 'path', label: 'Pathfinding' }, { value: 'sort', label: 'Sorting' }] as const

export default function Demo(_props: DemoProps) {
  const [tab, setTab] = useLocalStorage<Tab>('algo-visualizer:tab', 'path')
  const visible = usePageVisible()
  const [viewRef, inView] = useInView<HTMLDivElement>({ rootMargin: '80px' })
  const boxRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => setWidth(Math.round(el.getBoundingClientRect().width))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const active = visible && inView

  return (
    <div ref={viewRef} className="grid gap-4 min-w-0">
      <Segmented<Tab> label="Visualise" options={TABS} value={tab === 'sort' ? 'sort' : 'path'} onChange={setTab} />
      <div ref={boxRef} className="min-w-0">
        {width === 0 ? (
          <Loading label="Laying out the board" />
        ) : tab === 'sort' ? (
          <Sorting active={active} compact={width < 480} />
        ) : (
          <Pathfinding active={active} width={width} />
        )}
      </div>
    </div>
  )
}
