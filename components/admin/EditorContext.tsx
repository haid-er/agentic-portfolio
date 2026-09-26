'use client'
/**
 * Editor state shared by every field of one collection form.
 * Fields bind by path (`['items', 2, 'name']`) and read their value and
 * validation error from here, so each editor stays a flat list of fields.
 */
import { createContext, useContext } from 'react'
import { getIn, pathKey, type Path } from './lib/path'

export type Updater = unknown | ((prev: unknown) => unknown)

export interface EditorApi {
  data: unknown
  /** Saved copy (to show per-field "changed" marks). */
  initial: unknown
  set: (path: Path, value: Updater) => void
  /** Error for exactly this path, once the field was touched or a save was attempted. */
  errorAt: (path: Path) => string | undefined
  /** Number of problems at or under this path (list items show it on their header). */
  errorsUnder: (path: Path) => number
  /** True after a save attempt: collapsed items with problems open themselves. */
  revealed: boolean
  busy: boolean
}

export const EditorCtx = createContext<EditorApi | null>(null)

export function useEditor(): EditorApi {
  const ctx = useContext(EditorCtx)
  if (!ctx) throw new Error('useEditor() must be used inside <EditorShell>')
  return ctx
}

/** Value + setter + error for one path. */
export function useField<T>(path: Path) {
  const ed = useEditor()
  const value = getIn(ed.data, path) as T
  const changed = JSON.stringify(value) !== JSON.stringify(getIn(ed.initial, path))
  return {
    value,
    changed,
    error: ed.errorAt(path),
    set: (v: T | ((prev: T) => T)) => ed.set(path, v as Updater),
    key: pathKey(path),
  }
}
