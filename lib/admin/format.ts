/** Small formatting helpers for the admin UI. Owner: admin-core. Pure (client + server safe). */

/** "just now", "4 min ago", "3 h ago", "2 d ago", else a date. */
export function timeAgo(iso: string | undefined, now = Date.now()): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`
  if (s < 7 * 86_400) return `${Math.round(s / 86_400)} d ago`
  return new Date(t).toISOString().slice(0, 10)
}

/** 83 -> "1:23" */
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** 1536 -> "1.5 KB" */
export function bytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}
