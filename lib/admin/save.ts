/**
 * Save pipeline: validate -> commit via GitHub Contents API (prod) or write to disk (dev).
 * STUB — owner: admin-core.
 */
import 'server-only'
import type { CollectionName } from '@/lib/content/schema'

export interface SaveResult {
  ok: boolean
  mode: 'github' | 'disk'
  commitUrl?: string
  message?: string
}

export async function saveCollection(_name: CollectionName, _data: unknown): Promise<SaveResult> {
  return { ok: false, mode: 'disk', message: 'Save pipeline not implemented yet' }
}
