/**
 * /api/admin/upload. Owner: admin-core. Guarded by middleware.
 *
 * POST multipart/form-data { file, name? } -> images (PNG/JPEG/GIF/WebP/AVIF) or PDF
 *      into public/uploads (GitHub commit or disk). Type is sniffed from the bytes; max 4 MB.
 * GET  -> { ok, files: [{ name, url, bytes }] }
 */
import { clientIp, writes } from '@/lib/admin/rate-limit'
import { fromError, statusFor } from '@/lib/admin/save'
import { getAdminSession, noStoreJson } from '@/lib/admin/server'
import { saveMode } from '@/lib/admin/store'
import { listUploads, MAX_UPLOAD_BYTES, saveUpload } from '@/lib/admin/uploads'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const unauthorized = () => noStoreJson({ ok: false, code: 'unauthorized', message: 'Sign in first.' }, { status: 401 })

export async function GET(): Promise<Response> {
  if (!(await getAdminSession())) return unauthorized()
  try {
    const files = await listUploads()
    return noStoreJson({ ok: true, files: files.sort((a, b) => a.name.localeCompare(b.name)) })
  } catch (e) {
    const r = fromError(saveMode() ?? 'disk', e)
    return noStoreJson(r, { status: statusFor(r.code) })
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!(await getAdminSession())) return unauthorized()

  const limit = writes.hit(clientIp(req.headers))
  if (!limit.allowed) {
    return noStoreJson(
      { ok: false, code: 'rate_limited', message: 'Too many uploads in a minute; wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    )
  }

  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return noStoreJson({ ok: false, code: 'bad_request', message: `Files are limited to ${MAX_UPLOAD_BYTES / 1048576} MB.` }, { status: 413 })
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return noStoreJson({ ok: false, code: 'bad_request', message: 'Attach one file in the "file" field.' }, { status: 400 })
  }
  const name = form?.get('name')
  const result = await saveUpload(file, { name: typeof name === 'string' ? name.slice(0, 80) : undefined })
  return noStoreJson(result, { status: result.ok ? 200 : statusFor(result.code) })
}
