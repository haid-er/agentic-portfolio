'use client'
/**
 * Upload field for images and PDFs (public/uploads via /api/admin/upload).
 * Drop a file, pick one, choose an earlier upload, or type a URL. On GitHub
 * mode the file is served after the redeploy, so the preview uses a local copy.
 */
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { FileText, ImageIcon, Trash2 } from 'lucide-react'
import { Button, Loading, controlClasses, useToast } from '@/components/ui'
import { listUploadsClient, uploadFile, type UploadEntry } from '@/lib/admin/client'
import { bytes } from '@/lib/admin/format'
import { cx } from '@/lib/utils'
import { useField } from '../EditorContext'
import type { Path } from '../lib/path'
import { FieldFrame } from './Frame'

const ACCEPT = {
  image: 'image/png,image/jpeg,image/gif,image/webp,image/avif',
  pdf: 'application/pdf',
} as const

export function ImageField({ path, label, hint, kind = 'image', uploadName, optional = true }: {
  path: Path
  label: string
  hint?: ReactNode
  kind?: keyof typeof ACCEPT
  /** Fixed file name, e.g. "resume" -> /uploads/resume.pdf (replaces the old file). */
  uploadName?: string
  /** Empty value removes the key. */
  optional?: boolean
}) {
  const f = useField<string | undefined>(path)
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [localPreview, setLocalPreview] = useState<{ url: string; for: string } | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [library, setLibrary] = useState<UploadEntry[] | null>(null)
  const [libOpen, setLibOpen] = useState(false)

  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview.url) }, [localPreview])

  const value = f.value ?? ''
  const preview = localPreview && localPreview.for === value ? localPreview.url : value
  const isPdf = kind === 'pdf' || /\.pdf($|\?)/i.test(value)

  const upload = async (file: File) => {
    if (!ACCEPT[kind].split(',').includes(file.type)) {
      toast(kind === 'pdf' ? 'Choose a PDF file.' : 'Choose a PNG, JPEG, GIF, WebP or AVIF image (SVG is refused for safety).', { tone: 'danger' })
      return
    }
    setBusy(true)
    setNote(null)
    const res = await uploadFile(file, { name: uploadName })
    setBusy(false)
    if (!res.ok || !res.url) {
      toast(res.message ?? 'Upload failed; nothing was stored.', { tone: 'danger', ms: 7000 })
      return
    }
    setLocalPreview({ url: URL.createObjectURL(file), for: res.url })
    f.set(res.url)
    setLibrary(null)
    setNote(res.availableAfterDeploy ? `${res.name} committed; it is served at ${res.url} after the redeploy. Save the form to use it.` : `${res.name} uploaded${res.bytes ? ` (${bytes(res.bytes)})` : ''}. Save the form to use it.`)
    toast(res.message ?? `${res.name ?? 'File'} uploaded.`, { tone: 'ok' })
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const file = e.dataTransfer.files[0]
    if (file) void upload(file)
  }

  const openLibrary = async () => {
    setLibOpen((o) => !o)
    if (library) return
    const res = await listUploadsClient()
    const ext = kind === 'pdf' ? /\.pdf$/i : /\.(png|jpe?g|gif|webp|avif)$/i
    setLibrary(res.ok ? res.files.filter((x) => ext.test(x.name)) : [])
  }

  return (
    <FieldFrame label={label} error={f.error} changed={f.changed} hint={hint ?? (kind === 'pdf' ? 'PDF, up to 4 MB.' : 'PNG, JPEG, GIF, WebP or AVIF, up to 4 MB.')}>
      {({ id, describedBy, invalid }) => (
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={cx('grid gap-3 p-3 border border-dashed rounded-1 bg-bg', over ? 'border-accent bg-bg-2' : 'border-rule')}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="grid place-items-center flex-none size-[72px] border border-rule rounded-0 bg-surface overflow-hidden">
              {preview && !isPdf ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="size-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
              ) : isPdf && preview ? (
                <FileText aria-hidden="true" size={28} strokeWidth={1.5} className="text-ink-2" />
              ) : (
                <ImageIcon aria-hidden="true" size={28} strokeWidth={1.5} className="text-ink-3" />
              )}
            </div>
            <div className="grid gap-2 flex-1 min-w-0">
              <input
                id={id}
                data-path={f.key}
                value={value}
                placeholder={kind === 'pdf' ? '/uploads/resume.pdf' : '/uploads/photo.webp'}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                onChange={(e) => f.set(optional && e.target.value === '' ? undefined : e.target.value)}
                className={cx(controlClasses, 'font-mono text-00')}
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon="upload" onClick={() => input.current?.click()} disabled={busy}>
                  {value ? 'Replace' : 'Upload'}
                </Button>
                <Button size="sm" variant="ghost" onClick={openLibrary} aria-expanded={libOpen}>Uploads</Button>
                {value ? (
                  <Button size="sm" variant="ghost" onClick={() => f.set(optional ? undefined : '')} aria-label={`Clear ${label}`}>
                    <Trash2 aria-hidden="true" size={15} strokeWidth={1.5} /> Clear
                  </Button>
                ) : null}
                {isPdf && value ? (
                  <a href={preview} target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-tap px-2 text-0 underline text-accent-ink">Open</a>
                ) : null}
              </div>
            </div>
          </div>
          <input ref={input} type="file" accept={ACCEPT[kind]} className="sr-only" tabIndex={-1} aria-hidden="true"
            onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void upload(file) }} />
          {busy ? <Loading label="Uploading" /> : null}
          {note ? <p className="m-0 text-00 text-ink-2" role="status">{note}</p> : null}
          <p className="m-0 text-00 text-ink-3 hidden md:block">Or drop a file here.</p>
          {libOpen ? (
            <div className="grid gap-1">
              {library === null ? <Loading label="Listing uploads" /> : library.length === 0 ? (
                <p className="m-0 text-0 text-ink-3">No matching uploads yet.</p>
              ) : (
                <ul className="m-0 p-0 list-none grid gap-1 max-h-[14rem] overflow-y-auto">
                  {library.map((x) => (
                    <li key={x.url}>
                      <button type="button" onClick={() => { f.set(x.url); setLibOpen(false) }}
                        className={cx('w-full min-h-tap px-2 text-left flex items-center justify-between gap-2 rounded-1 hover:bg-bg-2', x.url === value && 'bg-bg-2')}>
                        <span className="font-mono text-00 [overflow-wrap:anywhere]">{x.name}</span>
                        <span className="text-00 text-ink-3 nums flex-none">{bytes(x.bytes)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      )}
    </FieldFrame>
  )
}
