/**
 * Edge-safe admin exports (session signing). Owner: admin-core.
 * Server modules: '@/lib/admin/save', '@/lib/admin/uploads', '@/lib/admin/server', '@/lib/admin/activity'.
 * Browser helpers for editors: '@/lib/admin/client' (saveContent, loadContent, uploadFile, …).
 */
export {
  SESSION_COOKIE,
  SESSION_TTL_SEC,
  signSession,
  verifySession,
  readSession,
  sessionSecret,
  passwordMatches,
  sessionCookieOptions,
} from './session'
export { safeNext } from './redirect'
