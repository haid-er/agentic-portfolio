/** Window events shared by admin islands. Owner: admin-core. Client safe. */

/** Fired after a save or upload actually wrote something (not for "unchanged"). */
export const ADMIN_SAVED_EVENT = 'ghp:admin-saved'

export interface AdminSavedDetail {
  kind: 'content' | 'upload'
  mode: 'github' | 'disk'
  commitSha?: string
}

export function notifySaved(detail: AdminSavedDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<AdminSavedDetail>(ADMIN_SAVED_EVENT, { detail }))
}
