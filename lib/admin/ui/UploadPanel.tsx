'use client'
/**
 * Dashboard uploads: drop or pick an image/PDF, optionally fix its name,
 * upload into public/uploads, then copy its /uploads/... URL into any field.
 * Owner: admin-core.
 */
import { useEffect, useId, useRef, useState, type DragEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { cx } from '@/lib/utils'
import { listUploadsClient, uploadFile, type UploadEntry, type UploadResult } from '../client'
import { bytes } from '../format'

interface Props {
  initial: UploadEntry[]
  accept: string
  maxBytes: number
}

type Status =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done'; res: Omit<UploadResult, 'ok'> }
  | { kind: 'error'; message: string }

const safeName = (n: string) =>
  n.replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

export function UploadPanel({ initial, accept, maxBytes }: Props) {
  const toast = useToast()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState(initial)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const pick = (f: File | undefined | null) => {
    if (!f) return
    if (f.size > maxBytes) {
      setStatus({ kind: 'error', message: `${f.name} is ${bytes(f.size)}; the limit is ${bytes(maxBytes)}.` })
      return
    }
    setFile(f)
    setName(safeName(f.name))
    setStatus({ kind: 'idle' })
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    pick(e.dataTransfer.files?.[0])
  }

  const upload = async () => {
    if (!file) return
    setStatus({ kind: 'busy' })
    const res = await uploadFile(file, { name: safeName(name) || undefined })
    if (!res.ok) {
      setStatus({ kind: 'error', message: res.message })
      return
    }
    setStatus({ kind: 'done', res })
    toast(res.message ?? 'Uploaded', { tone: 'ok' })
    setFile(null)
    if (inputRef.current) inputRef.current.value = ''
    const list = await listUploadsClient()
    if (list.ok) setFiles(list.files)
  }

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast(`Copied ${url}`, { tone: 'ok' })
    } catch {
      toast('Copy failed: select the path and copy it by hand.', { tone: 'danger' })
    }
  }

  const ext = file ? (file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? '') : ''

  return (
    <div className="grid gap-s5">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx(
          'relative grid gap-s3 justify-items-start p-s5 border border-dashed rounded-1 bg-bg-2 transition-colors duration-[var(--dur-fast)]',
          dragging ? 'border-accent bg-surface' : 'border-rule',
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          className="peer sr-only"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <label
          htmlFor={inputId}
          className="inline-flex items-center gap-2 min-h-tap px-4 border border-rule rounded-pill bg-surface mono text-ink cursor-pointer hover:bg-bg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus"
        >
          <Icon name="upload" size={16} />
          Choose a file
        </label>
        <p className="m-0 text-0 text-ink-2">
          Or drop it here. PNG, JPEG, GIF, WebP, AVIF or PDF, up to {bytes(maxBytes)}. SVG is refused (it can carry script).
        </p>
      </div>

      {file ? (
        <div className="grid gap-s4 md:grid-cols-[auto_1fr] items-start">
          <div className="size-24 grid place-items-center border border-rule rounded-1 bg-surface overflow-hidden">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
              <img src={preview} alt="" className="size-full object-cover" />
            ) : (
              <Icon name="doc" size={32} className="text-ink-3" />
            )}
          </div>
          <div className="grid gap-s3 min-w-0">
            <p className="m-0 text-0 [overflow-wrap:anywhere]">
              <span className="font-semibold">{file.name}</span> <span className="mono text-ink-3">{bytes(file.size)}</span>
            </p>
            <Input
              label="Save as"
              hint={`Served at /uploads/${safeName(name) || 'upload'}.${ext}. An existing file with this name is replaced.`}
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 60))}
              maxLength={60}
              autoComplete="off"
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-s3">
              <Button onClick={upload} icon="upload" disabled={status.kind === 'busy'} aria-busy={status.kind === 'busy'}>
                {status.kind === 'busy' ? 'Uploading…' : 'Upload'}
              </Button>
              <Button variant="ghost" onClick={() => setFile(null)} disabled={status.kind === 'busy'}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div aria-live="polite" className="empty:hidden">
        {status.kind === 'error' ? (
          <p role="alert" className="m-0 flex items-center gap-2 text-0 text-danger">
            <Icon name="alert" size={16} />
            {status.message}
          </p>
        ) : null}
        {status.kind === 'done' && status.res.url ? (
          <div className="flex flex-wrap items-center gap-s3 text-0">
            <Icon name="check" size={16} className="text-ok" />
            <span>{status.res.message}</span>
            <Button variant="secondary" size="sm" icon="copy" onClick={() => copy(status.res.url!)}>
              Copy path
            </Button>
          </div>
        ) : null}
      </div>

      {files.length ? (
        <ul className="m-0 p-0 list-none grid border-t border-rule-soft" aria-label="Uploaded files">
          {files.map((f) => (
            <li key={f.name} className="flex flex-wrap items-center gap-x-s3 gap-y-1 py-s2 border-b border-rule-soft min-w-0">
              <Icon name={f.name.endsWith('.pdf') ? 'doc' : 'broadsheet'} size={16} className="text-ink-3" />
              <a href={f.url} target="_blank" rel="noopener noreferrer" className="mono text-ink underline underline-offset-4 [overflow-wrap:anywhere] min-w-0">
                {f.url}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              <span className="mono text-ink-3 nums">{bytes(f.bytes)}</span>
              <Button variant="ghost" size="sm" icon="copy" className="ml-auto" onClick={() => copy(f.url)} aria-label={`Copy ${f.url}`}>
                Copy
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-0 text-ink-3">No uploads yet.</p>
      )}
    </div>
  )
}
