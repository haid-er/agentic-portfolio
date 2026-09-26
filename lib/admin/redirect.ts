/**
 * Safe post-login destination: only paths inside /admin (never another origin), with
 * an optional plain query string so deep links like /admin/site?tab=seo survive the
 * sign-in. Owner: admin-core. Client + edge safe.
 */
export function safeNext(value: unknown): string {
  if (typeof value !== 'string') return '/admin'
  if (!/^\/admin(\/[A-Za-z0-9._~\-/]*)?(\?[A-Za-z0-9._~\-=&%]*)?$/.test(value)) return '/admin'
  if (value.startsWith('/admin/login') || /(^|\/)\.\.?(\/|\?|$)/.test(value)) return '/admin'
  return value
}
