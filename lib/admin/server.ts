/**
 * Server helpers for admin pages and routes. Owner: admin-core. Server only.
 */
import 'server-only'
import { cookies } from 'next/headers'
import { githubConfig } from './github'
import { readSession, SESSION_COOKIE, sessionSecret, usingDevSecret } from './session'
import { saveMode, type SaveMode } from './store'

/** The current admin session (issued / expires), or null. Middleware already guards, this is for display + defence in depth. */
export async function getAdminSession(): Promise<{ iat: number; exp: number } | null> {
  const jar = await cookies()
  return readSession(sessionSecret(), jar.get(SESSION_COOKIE)?.value)
}

export interface AdminHealthCheck {
  id: 'password' | 'secret' | 'store'
  ok: boolean
  /** Short status, e.g. "Set" / "Missing". */
  status: string
  detail: string
}

export interface AdminHealth {
  mode: SaveMode | null
  repo?: string
  branch?: string
  checks: AdminHealthCheck[]
  /** True when a login can succeed at all. */
  canLogin: boolean
}

/** What is configured, without ever revealing a value. */
export function adminHealth(): AdminHealth {
  const hasPassword = Boolean(process.env.ADMIN_PASSWORD)
  const secret = sessionSecret()
  const dev = usingDevSecret()
  const mode = saveMode()
  const gh = githubConfig()
  const checks: AdminHealthCheck[] = [
    {
      id: 'password',
      ok: hasPassword,
      status: hasPassword ? 'Set' : 'Missing',
      detail: hasPassword ? 'ADMIN_PASSWORD is set.' : 'Set ADMIN_PASSWORD to enable sign-in.',
    },
    {
      id: 'secret',
      ok: Boolean(secret) && !dev,
      status: dev ? 'Dev fallback' : secret ? 'Set' : 'Missing',
      detail: dev
        ? 'ADMIN_SECRET is unset; next dev signs sessions with a fixed dev key. Set it before deploying.'
        : secret
          ? 'Sessions are signed with ADMIN_SECRET (HMAC-SHA256).'
          : 'Set ADMIN_SECRET (16+ characters) to sign sessions.',
    },
    {
      id: 'store',
      ok: mode !== null,
      status: mode === 'github' ? 'GitHub' : mode === 'disk' ? 'Disk' : 'Missing',
      detail:
        mode === 'github'
          ? `Saves commit to ${gh?.repo} on ${gh?.branch}; Vercel redeploys.`
          : mode === 'disk'
            ? 'No GITHUB_TOKEN: saves write content/*.json in this working tree.'
            : 'Set GITHUB_TOKEN, GITHUB_REPO and GITHUB_BRANCH so saves can commit.',
    },
  ]
  return { mode, repo: gh?.repo, branch: gh?.branch, checks, canLogin: hasPassword && Boolean(secret) }
}

/** JSON response that is never cached. */
export function noStoreJson(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('Cache-Control', 'no-store')
  return Response.json(body, { ...init, headers })
}

/** Read a JSON body with a hard size cap (bytes). */
export async function readJsonBody(req: Request, maxBytes: number): Promise<{ ok: true; value: unknown } | { ok: false; status: number; message: string }> {
  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > maxBytes) return { ok: false, status: 413, message: `Body over ${Math.round(maxBytes / 1024)} KB.` }
  const text = await req.text()
  if (text.length > maxBytes) return { ok: false, status: 413, message: `Body over ${Math.round(maxBytes / 1024)} KB.` }
  try {
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch {
    return { ok: false, status: 400, message: 'Body is not valid JSON.' }
  }
}
