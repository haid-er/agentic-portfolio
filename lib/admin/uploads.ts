/**
 * Admin uploads: images and PDFs into public/uploads. Owner: admin-core. Server only.
 *
 * The type is decided by the file's magic bytes, never by its name or the
 * browser's MIME claim. SVG is refused on purpose (it can carry script and
 * would be served from this origin).
 */
import 'server-only'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { githubConfig, listDir } from './github'
import { fromError, type SaveResult } from './save'
import { blobSha, readRepoFile, saveMode, writeRepoFile } from './store'

export const UPLOAD_DIR = 'public/uploads'
/** Vercel caps request bodies at 4.5 MB; stay under it with multipart overhead. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

export type UploadKind = 'png' | 'jpg' | 'gif' | 'webp' | 'avif' | 'pdf'

export const UPLOAD_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/avif,application/pdf'

const MIME: Record<UploadKind, string> = {
  png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', pdf: 'application/pdf',
}

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to))

/** Detect the real file type from its first bytes. */
export function sniff(b: Uint8Array): UploadKind | null {
  if (b.length < 12) return null
  if (b[0] === 0x89 && ascii(b, 1, 4) === 'PNG') return 'png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (ascii(b, 0, 4) === 'GIF8') return 'gif'
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'webp'
  if (ascii(b, 4, 8) === 'ftyp' && /^avi[fs]$/.test(ascii(b, 8, 12))) return 'avif'
  if (ascii(b, 0, 5) === '%PDF-') return 'pdf'
  return null
}

/** "My Résumé (final).PDF" -> "my-resume-final". */
export function safeBaseName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '')
  return (
    base
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'upload'
  )
}

export interface UploadResult extends SaveResult {
  /** Public URL, e.g. "/uploads/resume.pdf". */
  url?: string
  name?: string
  bytes?: number
  kind?: UploadKind
  replaced?: boolean
  /** github mode: the file is served only after the redeploy finishes. */
  availableAfterDeploy?: boolean
}

export async function saveUpload(file: File, opts: { name?: string } = {}): Promise<UploadResult> {
  const mode = saveMode()
  if (!mode) return { ok: false, mode: 'disk', code: 'unconfigured', message: 'Uploads are not configured on this deployment: set GITHUB_TOKEN and GITHUB_REPO.' }
  if (file.size === 0) return { ok: false, mode, code: 'bad_request', message: 'The file is empty.' }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, mode, code: 'bad_request', message: `The file is ${(file.size / 1048576).toFixed(1)} MB; the limit is ${MAX_UPLOAD_BYTES / 1048576} MB.` }
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const kind = sniff(bytes)
  if (!kind) return { ok: false, mode, code: 'bad_request', message: 'Only PNG, JPEG, GIF, WebP, AVIF images and PDF files can be uploaded.' }

  const name = `${safeBaseName(opts.name || file.name)}.${kind}`
  const repoPath = `${UPLOAD_DIR}/${name}`
  try {
    const current = await readRepoFile(repoPath)
    const url = `/uploads/${name}`
    if (current && current.sha === blobSha(bytes)) {
      return { ok: true, mode, unchanged: true, url, name, bytes: bytes.length, kind, sha: current.sha, message: `${name} is already uploaded (identical file).` }
    }
    const verb = current ? 'replace' : 'add'
    const res = await writeRepoFile(repoPath, bytes, `uploads: ${verb} ${name}\n\nUploaded from /admin (${MIME[kind]}, ${bytes.length} bytes).`, {
      currentSha: current?.sha ?? null,
    })
    return {
      ok: true,
      mode: res.mode,
      sha: res.sha,
      commitSha: res.commitSha,
      commitUrl: res.commitUrl,
      url,
      name,
      bytes: bytes.length,
      kind,
      replaced: Boolean(current),
      availableAfterDeploy: res.mode === 'github',
      summary: `${verb} ${name}`,
      message:
        res.mode === 'github'
          ? `${name} committed. It is served at ${url} once the redeploy finishes.`
          : `${name} saved to ${repoPath}.`,
    }
  } catch (e) {
    return fromError(mode, e)
  }
}

export interface UploadEntry {
  name: string
  url: string
  bytes: number
}

/** Files in public/uploads, from the active store. */
export async function listUploads(): Promise<UploadEntry[]> {
  const cfg = githubConfig()
  const toEntry = (name: string, bytes: number) => ({ name, url: `/uploads/${name}`, bytes })
  const visible = (n: string) => !n.startsWith('.') && !n.endsWith('.tmp')
  if (cfg) return (await listDir(cfg, UPLOAD_DIR)).filter((f) => visible(f.name)).map((f) => toEntry(f.name, f.size))
  try {
    const dir = path.join(process.cwd(), 'public', 'uploads')
    const names = (await readdir(dir)).filter(visible)
    const sizes = await Promise.all(names.map((n) => stat(path.join(dir, n)).then((s) => (s.isFile() ? s.size : -1))))
    return names.map((n, i) => toEntry(n, sizes[i]!)).filter((e) => e.bytes >= 0)
  } catch {
    return []
  }
}
