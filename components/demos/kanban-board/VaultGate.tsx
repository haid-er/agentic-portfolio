'use client'
/** Locked state: list vaults, unlock one, create a new one, or restore an encrypted backup. */
import { useRef, useState, type FormEvent } from 'react'
import { Badge, Button, DemoPanel, DemoToolbar, EmptyState, Input, Loading } from '@/components/ui'
import { cipherBytes } from './vault'
import type { VaultRecord } from './model'

const date = (ts: number) => new Date(ts).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })

export function VaultGate({ vaults, busy, error, onUnlock, onCreate, onDelete, onRestore }: {
  vaults: VaultRecord[]
  busy: string | null
  error: string | null
  onUnlock: (id: string, passphrase: string) => void
  onCreate: (name: string, passphrase: string, sample: boolean) => void
  onDelete: (id: string) => void
  onRestore: (file: File) => void
}) {
  const [name, setName] = useState('')
  const [pass, setPass] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const passTooShort = pass.length > 0 && pass.length < 4

  const create = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || pass.length < 4) return
    onCreate(name, pass, false)
    setPass('')
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 items-start">
      <DemoPanel title="Vaults in this browser" meta={`${vaults.length}`}>
        {vaults.length === 0 ? (
          <EmptyState title="No vaults yet">
            Create one, or start with the sample vault. Each vault is encrypted separately with its own passphrase.
          </EmptyState>
        ) : (
          <ul className="m-0 p-0 list-none grid gap-3">
            {vaults.map((v) => <VaultRow key={v.id} vault={v} busy={busy === v.id} onUnlock={onUnlock} onDelete={onDelete} />)}
          </ul>
        )}
        {error ? <p role="alert" className="m-0 mt-3 text-0 text-danger">{error}</p> : null}
      </DemoPanel>

      <DemoPanel title="New vault">
        <form onSubmit={create} className="grid gap-3">
          <Input label="Vault name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Work, Home, Side project" autoComplete="off" />
          <Input
            label="Passphrase"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="new-password"
            hint="At least 4 characters. It never leaves this tab and cannot be recovered."
            error={passTooShort ? 'Use at least 4 characters.' : undefined}
          />
          <DemoToolbar>
            <Button type="submit" icon="lock" disabled={!name.trim() || pass.length < 4 || busy !== null}>Create vault</Button>
          </DemoToolbar>
        </form>
        <div className="mt-5 pt-4 border-t border-rule-soft grid gap-3">
          <p className="m-0 text-0 text-ink-2">
            In a hurry? The sample vault uses the passphrase <code className="mono text-ink">sample</code> and has a few cards to drag around.
          </p>
          <DemoToolbar>
            <Button size="sm" variant="secondary" onClick={() => onCreate('Sample vault', 'sample', true)} disabled={busy !== null}>Create sample vault</Button>
            <Button size="sm" variant="ghost" icon="upload" onClick={() => fileRef.current?.click()} disabled={busy !== null}>Restore encrypted backup</Button>
          </DemoToolbar>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onRestore(f); e.target.value = '' }}
          />
        </div>
        {busy === 'new' ? <Loading label="Deriving the key" className="mt-3" /> : null}
      </DemoPanel>
    </div>
  )
}

function VaultRow({ vault, busy, onUnlock, onDelete }: {
  vault: VaultRecord
  busy: boolean
  onUnlock: (id: string, passphrase: string) => void
  onDelete: (id: string) => void
}) {
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState(false)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (pass) onUnlock(vault.id, pass)
  }
  return (
    <li className="grid gap-3 p-3 border border-rule rounded-1 bg-surface strata:border-rule-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 font-semibold [overflow-wrap:anywhere]">{vault.name}</p>
        <Badge tone="neutral">locked</Badge>
      </div>
      <p className="m-0 mono text-ink-3">created {date(vault.createdAt)} · {cipherBytes(vault).toLocaleString()} bytes of ciphertext</p>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <Input
          label={`Passphrase for ${vault.name}`}
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoComplete="current-password"
          wrapperClassName="flex-1 min-w-[160px]"
        />
        <Button type="submit" size="sm" icon="lock" disabled={!pass || busy}>{busy ? 'Opening' : 'Unlock'}</Button>
      </form>
      {busy ? <Loading label="Deriving the key" /> : null}
      <div>
        {confirm ? (
          <DemoToolbar>
            <Button size="sm" variant="danger" onClick={() => onDelete(vault.id)}>Delete forever</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Keep it</Button>
          </DemoToolbar>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>Delete vault</Button>
        )}
      </div>
    </li>
  )
}
