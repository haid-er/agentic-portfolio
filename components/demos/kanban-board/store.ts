'use client'
/**
 * Vault storage. Every write is a read-modify-write against localStorage, so a tab only ever
 * changes the one record it means to and never replaces vaults another tab created. Writes
 * report success, so a full or blocked storage never shows up as "sealed". A `storage` event
 * listener keeps every open tab's vault list current.
 */
import { useCallback, useEffect, useState } from 'react'
import { vaultSchema, type VaultRecord } from './model'

export const VAULTS_KEY = 'ghp:kanban-board:vaults'

const isVault = (v: unknown): v is VaultRecord => vaultSchema.safeParse(v).success
const hasId = (v: unknown, id: string) => isVault(v) && v.id === id

/** The raw stored array, unknown entries included, so writes never drop what they do not own. */
function readRaw(): unknown[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(VAULTS_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function loadVaults(): VaultRecord[] {
  return readRaw().filter(isVault)
}

/** Apply `fn` to the freshly read array and write it back. `fn` returns null to abort. */
function mutate(fn: (list: unknown[]) => unknown[] | null): boolean {
  try {
    const next = fn(readRaw())
    if (!next) return false
    localStorage.setItem(VAULTS_KEY, JSON.stringify(next))
    return true
  } catch {
    return false
  }
}

/** Append a new vault. */
export function addVault(rec: VaultRecord): boolean {
  return mutate((list) => [...list, rec])
}

/** Change one existing vault. Fails if it is gone (deleted in another tab) or storage refuses. */
export function updateVault(id: string, patch: Partial<Omit<VaultRecord, 'id'>>): boolean {
  return mutate((list) => (list.some((v) => hasId(v, id)) ? list.map((v) => (hasId(v, id) ? { ...(v as VaultRecord), ...patch } : v)) : null))
}

export function removeVault(id: string): boolean {
  return mutate((list) => list.filter((v) => !hasId(v, id)))
}

export function vaultExists(id: string): boolean {
  return readRaw().some((v) => hasId(v, id))
}

/** The valid vaults in this browser, kept in sync with other tabs. */
export function useVaults(): { vaults: VaultRecord[]; refresh: () => void } {
  const [vaults, setVaults] = useState<VaultRecord[]>([])
  const refresh = useCallback(() => setVaults(loadVaults()), [])
  useEffect(() => {
    refresh()
    const onStorage = (e: StorageEvent) => { if (e.key === VAULTS_KEY || e.key === null) refresh() }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])
  return { vaults, refresh }
}
