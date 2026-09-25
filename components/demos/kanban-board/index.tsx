'use client'
/** Kanban board — STUB. Owner: see CONTRACTS.md (components/demos/kanban-board/**). */
import { EmptyState } from '@/components/ui/States'
import type { DemoProps } from '@/lib/demos/types'

export { notes } from './notes'

export default function Demo(_props: DemoProps) {
  return <EmptyState title="Kanban board">This demo is being built.</EmptyState>
}
