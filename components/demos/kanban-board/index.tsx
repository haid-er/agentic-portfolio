'use client'
/**
 * Kanban board, a homage to Task-Vault's "your tasks are private to you": every vault is a
 * separate board encrypted with its own passphrase (PBKDF2 + AES-GCM, Web Crypto) and stored
 * in localStorage. Unlocked boards live only in memory. Drag with a pointer or the keyboard,
 * export and import JSON, or back up the encrypted vault itself.
 */
import { useEffect, useRef, useState } from 'react'
import { Badge, Button, DemoPanel, DemoToolbar, ErrorState, Loading, useToast } from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { useLocalStorage } from '@/lib/hooks'
import { Board } from './Board'
import {
  cardCount, emptyBoard, exportSchema, firstIssue, insertCard, locate, newId, removeCard, sampleBoard, vaultSchema,
  type Board as BoardData, type Card, type VaultRecord,
} from './model'
import { cipherBytes, createVault, cryptoAvailable, deriveKey, PBKDF2_ITERATIONS, seal, unseal, WrongPassphrase } from './vault'
import { VaultGate } from './VaultGate'

export { notes } from './notes'

interface Session { vaultId: string; key: CryptoKey; board: BoardData }
type SaveState = { phase: 'idle' | 'saving' | 'saved' | 'error'; at: number | null }

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'vault'

export default function Demo(_props: DemoProps) {
  const toast = useToast()
  const [vaults, setVaults] = useLocalStorage<VaultRecord[]>('kanban-board:vaults', [])
  const [ready, setReady] = useState(false)
  useEffect(() => { setReady(true) }, [])
  const [supported] = useState(() => cryptoAvailable())

  const [session, setSession] = useState<Session | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [gateError, setGateError] = useState<string | null>(null)
  const [save, setSave] = useState<SaveState>({ phase: 'idle', at: null })
  const [undo, setUndo] = useState<{ card: Card; col: number; index: number } | null>(null)
  const [peek, setPeek] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const validVaults = vaults.filter((v) => vaultSchema.safeParse(v).success)
  const vault = session ? validVaults.find((v) => v.id === session.vaultId) : undefined

  /* ---------- encrypted autosave ---------- */
  const board = session?.board
  const key = session?.key
  const vaultId = session?.vaultId
  const dirty = useRef(false)
  useEffect(() => {
    if (!board || !key || !vaultId || !dirty.current) return
    setSave((s) => ({ ...s, phase: 'saving' }))
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const { iv, data } = await seal(key, board)
        if (cancelled) return
        setVaults((vs) => vs.map((v) => (v.id === vaultId ? { ...v, iv, data, updatedAt: Date.now() } : v)))
        dirty.current = false
        setSave({ phase: 'saved', at: Date.now() })
      } catch {
        if (!cancelled) setSave((s) => ({ ...s, phase: 'error' }))
      }
    }, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [board, key, vaultId, setVaults])

  const change = (next: BoardData, why: string) => {
    if (why !== 'delete') setUndo(null)
    dirty.current = true
    setSession((s) => (s ? { ...s, board: next } : s))
  }

  /* ---------- vault lifecycle ---------- */
  async function unlock(id: string, passphrase: string) {
    const rec = validVaults.find((v) => v.id === id)
    if (!rec) return
    setBusy(id)
    setGateError(null)
    try {
      const k = await deriveKey(passphrase, rec.salt)
      const b = await unseal(k, rec)
      dirty.current = false
      setSession({ vaultId: id, key: k, board: b })
      setSave({ phase: 'saved', at: rec.updatedAt })
      toast(`${rec.name} unlocked.`, { tone: 'ok' })
    } catch (e) {
      setGateError(e instanceof WrongPassphrase ? e.message : e instanceof Error ? e.message : 'Could not open the vault.')
    } finally {
      setBusy(null)
    }
  }

  async function create(name: string, passphrase: string, sample: boolean) {
    setBusy('new')
    setGateError(null)
    try {
      const b = sample ? sampleBoard() : emptyBoard()
      const { record, key: k } = await createVault(name, passphrase, b)
      setVaults((vs) => [...vs, record])
      dirty.current = false
      setSession({ vaultId: record.id, key: k, board: b })
      setSave({ phase: 'saved', at: record.updatedAt })
    } catch {
      setGateError('Could not create the vault. Web Crypto may be unavailable in this context.')
    } finally {
      setBusy(null)
    }
  }

  async function lock() {
    // Flush a pending autosave first, so locking right after an edit never loses it.
    if (session && dirty.current) {
      try {
        const { iv, data } = await seal(session.key, session.board)
        setVaults((vs) => vs.map((v) => (v.id === session.vaultId ? { ...v, iv, data, updatedAt: Date.now() } : v)))
        dirty.current = false
      } catch {
        toast('Could not seal the latest changes. The vault stays unlocked.', { tone: 'danger' })
        return
      }
    }
    setSession(null)
    setUndo(null)
    setPeek(false)
    toast('Vault locked. Only ciphertext remains.', { tone: 'neutral' })
  }

  const remove = (id: string) => {
    setVaults((vs) => vs.filter((v) => v.id !== id))
    toast('Vault deleted from this browser.', { tone: 'neutral' })
  }

  async function restore(file: File) {
    setGateError(null)
    try {
      if (file.size > 500_000) throw new Error('That file is too large to be a vault backup.')
      const parsed = vaultSchema.safeParse(JSON.parse(await file.text()))
      if (!parsed.success) throw new Error(`Not an encrypted vault backup (${firstIssue(parsed.error)}).`)
      const rec = parsed.data
      setVaults((vs) => [...vs, vs.some((v) => v.id === rec.id) ? { ...rec, id: newId(), name: `${rec.name} (restored)`.slice(0, 40) } : rec])
      toast(`Restored ${rec.name}. Unlock it with its original passphrase.`, { tone: 'ok' })
    } catch (e) {
      setGateError(e instanceof SyntaxError ? 'That file is not JSON.' : e instanceof Error ? e.message : 'Restore failed.')
    }
  }

  /* ---------- board actions ---------- */
  const deleteCard = (cardId: string) => {
    if (!session) return
    const at = locate(session.board, cardId)
    if (!at) return
    const card = session.board.columns[at.col].cards[at.index]
    change(removeCard(session.board, cardId), 'delete')
    setUndo({ card, col: at.col, index: at.index })
    toast(`Deleted "${card.title}".`, { tone: 'neutral' })
  }

  const exportPlain = () => {
    if (!session || !vault) return
    download(`kanban-${slug(vault.name)}.json`, { kind: 'kanban-board', v: 1, exportedAt: new Date().toISOString(), board: session.board })
    toast('Exported as plain JSON. That file is not encrypted.', { tone: 'warn' })
  }

  const exportSealed = () => {
    if (!vault) return
    download(`kanban-${slug(vault.name)}.vault.json`, vault)
    toast('Encrypted backup saved. It needs the passphrase to open.', { tone: 'ok' })
  }

  async function importPlain(file: File) {
    try {
      if (file.size > 500_000) throw new Error('That file is too large.')
      const parsed = exportSchema.safeParse(JSON.parse(await file.text()))
      if (!parsed.success) throw new Error(`Import refused: ${firstIssue(parsed.error)}`)
      change(parsed.data.board, 'import')
      toast(`Imported ${cardCount(parsed.data.board)} cards into this vault.`, { tone: 'ok' })
    } catch (e) {
      toast(e instanceof SyntaxError ? 'Import refused: that file is not JSON.' : e instanceof Error ? e.message : 'Import failed.', { tone: 'danger' })
    }
  }

  /* ---------- render ---------- */
  if (!supported) {
    return (
      <ErrorState title="Web Crypto is not available here">
        Vaults are encrypted with the browser&apos;s Web Crypto API, which only runs on secure (HTTPS) pages. Nothing was stored.
      </ErrorState>
    )
  }
  if (!ready) return <Loading label="Reading local vaults" />

  if (!session || !vault) {
    return (
      <VaultGate
        vaults={validVaults}
        busy={busy}
        error={gateError}
        onUnlock={(id, p) => void unlock(id, p)}
        onCreate={(n, p, s) => void create(n, p, s)}
        onDelete={remove}
        onRestore={(f) => void restore(f)}
      />
    )
  }

  const saveLabel = save.phase === 'saving' ? 'encrypting' : save.phase === 'error' ? 'save failed' : save.at ? `sealed ${new Date(save.at).toLocaleTimeString([], { hour12: false })}` : 'sealed'

  return (
    <div className="grid gap-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <h3 className="m-0 font-display text-3 [overflow-wrap:anywhere]">{vault.name}</h3>
          <Badge tone="ok">unlocked</Badge>
          <Badge tone={save.phase === 'error' ? 'danger' : save.phase === 'saving' ? 'warn' : 'neutral'}>
            <span aria-live="polite">{saveLabel}</span>
          </Badge>
        </div>
        <DemoToolbar>
          {undo ? (
            <Button size="sm" variant="secondary" onClick={() => { change(insertCard(session.board, undo.col, undo.index, undo.card), 'undo'); setUndo(null) }}>
              Undo delete
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" icon="download" onClick={exportPlain}>Export JSON</Button>
          <Button size="sm" variant="secondary" icon="upload" onClick={() => importRef.current?.click()}>Import JSON</Button>
          <Button size="sm" variant="secondary" icon="lock" onClick={exportSealed}>Encrypted backup</Button>
          <Button size="sm" icon="lock" onClick={() => void lock()}>Lock</Button>
        </DemoToolbar>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void importPlain(f); e.target.value = '' }}
        />
      </div>

      <Board board={session.board} onChange={change} onDelete={deleteCard} />

      <DemoPanel
        title="What this browser actually stores"
        actions={<Button size="sm" variant="ghost" aria-expanded={peek} onClick={() => setPeek((p) => !p)}>{peek ? 'Hide' : 'Show'}</Button>}
      >
        {peek ? (
          <dl className="m-0 grid gap-2 text-0 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-x-4">
            <dt className="mono text-ink-3">localStorage key</dt><dd className="m-0 mono [overflow-wrap:anywhere]">ghp:kanban-board:vaults</dd>
            <dt className="mono text-ink-3">vault name</dt><dd className="m-0">{vault.name} <span className="text-ink-3">(the only plain text)</span></dd>
            <dt className="mono text-ink-3">key derivation</dt><dd className="m-0 mono">PBKDF2-SHA-256 · {PBKDF2_ITERATIONS.toLocaleString()} rounds · salt {vault.salt}</dd>
            <dt className="mono text-ink-3">cipher</dt><dd className="m-0 mono">AES-GCM 256 · iv {vault.iv}</dd>
            <dt className="mono text-ink-3">ciphertext</dt>
            <dd className="m-0 mono text-ink-2 [overflow-wrap:anywhere]">{vault.data.slice(0, 120)}… ({cipherBytes(vault).toLocaleString()} bytes)</dd>
          </dl>
        ) : (
          <p className="m-0 text-0 text-ink-2">
            Your cards never touch storage in readable form. Open this to see the exact record, the same thing anyone with access to this browser would find.
          </p>
        )}
      </DemoPanel>
    </div>
  )
}
