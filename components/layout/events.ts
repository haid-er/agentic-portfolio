/**
 * Tiny window-event bus between shell islands (header buttons, folio bar,
 * 404 page) and the two dialogs they open. Client only.
 */
export const OPEN_INDEX = 'ghp:open-index'
export const OPEN_CONTENTS = 'ghp:open-contents'

export const openIndex = () => window.dispatchEvent(new Event(OPEN_INDEX))
export const openContents = () => window.dispatchEvent(new Event(OPEN_CONTENTS))

/** Subscribe to one of the bus events; returns the unsubscribe function. */
export function onShellEvent(name: typeof OPEN_INDEX | typeof OPEN_CONTENTS, cb: () => void) {
  window.addEventListener(name, cb)
  return () => window.removeEventListener(name, cb)
}

/** Polite live region rendered once by the Header. */
export const LIVE_REGION_ID = 'ghp-shell-live'

export function announce(message: string) {
  const el = document.getElementById(LIVE_REGION_ID)
  if (!el) return
  el.textContent = ''
  // A fresh text node after a tick makes screen readers repeat identical messages.
  window.setTimeout(() => { el.textContent = message }, 60)
}

/** True when `href` is a section anchor that exists on the current (home) page. */
export function canJump(href: string): boolean {
  return href.startsWith('/#') && window.location.pathname === '/' && Boolean(document.getElementById(href.slice(2)))
}

/**
 * Jump to a homepage section. On the homepage it scrolls and moves focus to the
 * section heading (so keyboard users land there); returns false elsewhere so
 * the caller can navigate normally.
 */
export function jumpToSection(href: string, reduced: boolean): boolean {
  if (!canJump(href)) return false
  const id = href.slice(2)
  const target = document.getElementById(id)
  if (!target) return false
  target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  history.pushState(null, '', `#${id}`)
  const heading = document.getElementById(`${id}-title`) ?? target
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
  heading.focus({ preventScroll: true })
  return true
}
