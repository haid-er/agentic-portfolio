'use client'
/**
 * One shared poller for the deploy state, used by the header pill and the
 * dashboard panel. Owner: admin-core.
 *
 * - polls /api/admin/status every 12 s while a deploy is pending, every 60 s otherwise
 * - pauses while the tab is hidden
 * - flips to "deploying" the moment an editor saves (ADMIN_SAVED_EVENT), then confirms with GitHub
 * - remembers when a pending deploy went live, so the UI can say "reprinted"
 */
import { useSyncExternalStore } from 'react'
import type { Activity } from '../activity'
import { getActivityClient } from '../client'
import { ADMIN_SAVED_EVENT, type AdminSavedDetail } from '../events'

export interface DeploySnapshot {
  activity: Activity | null
  error: string | null
  /** Epoch ms when a pending deploy was seen going live (null otherwise). */
  wentLiveAt: number | null
  /** Epoch ms of the local save that is waiting to deploy (optimistic). */
  savedAt: number | null
}

const FAST_MS = 12_000
const SLOW_MS = 60_000

let snap: DeploySnapshot = { activity: null, error: null, wentLiveAt: null, savedAt: null }
const listeners = new Set<() => void>()
let timer: number | undefined
let started = false

function set(next: Partial<DeploySnapshot>) {
  snap = { ...snap, ...next }
  listeners.forEach((l) => l())
}

const pending = (a: Activity | null) => a?.deploy.state === 'deploying' || a?.deploy.state === 'stalled'

async function refresh(fresh = false) {
  const res = await getActivityClient(fresh)
  if (!res.ok) {
    set({ error: res.code === 'unauthorized' ? 'Session expired' : res.message })
  } else {
    const was = pending(snap.activity) || snap.savedAt !== null
    const activity = res as unknown as Activity
    const optimistic = snap.savedAt !== null && Date.now() - snap.savedAt < 20_000 && activity.deploy.state === 'live'
    if (optimistic) {
      // GitHub may not list the new head for a few seconds; keep "deploying" until it does.
      set({ error: null })
    } else {
      const live = activity.deploy.state === 'live'
      set({ activity, error: null, savedAt: live || !pending(activity) ? null : snap.savedAt, wentLiveAt: was && live ? Date.now() : snap.wentLiveAt })
    }
  }
  schedule()
}

function schedule() {
  window.clearTimeout(timer)
  if (!listeners.size) return
  const ms = pending(snap.activity) || snap.savedAt !== null ? FAST_MS : SLOW_MS
  timer = window.setTimeout(() => {
    if (document.visibilityState === 'visible') void refresh()
    else schedule()
  }, ms)
}

function onSaved(e: Event) {
  const d = (e as CustomEvent<AdminSavedDetail>).detail
  if (d?.mode !== 'github') {
    void refresh(true)
    return
  }
  set({ savedAt: Date.now(), wentLiveAt: null })
  window.setTimeout(() => void refresh(true), 2500)
}

function onVisible() {
  if (document.visibilityState === 'visible') void refresh()
}

function start() {
  if (started) return
  started = true
  window.addEventListener(ADMIN_SAVED_EVENT, onSaved)
  document.addEventListener('visibilitychange', onVisible)
  if (snap.activity) schedule()
  else void refresh()
}

function stop() {
  started = false
  window.clearTimeout(timer)
  window.removeEventListener(ADMIN_SAVED_EVENT, onSaved)
  document.removeEventListener('visibilitychange', onVisible)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  start()
  return () => {
    listeners.delete(listener)
    if (!listeners.size) stop()
  }
}

/** Seed the store with server-rendered activity (only if nothing newer is known). */
function seed(initial: Activity | null | undefined) {
  if (initial && !snap.activity) snap = { ...snap, activity: initial }
}

const getSnap = () => snap
const serverSnap: DeploySnapshot = { activity: null, error: null, wentLiveAt: null, savedAt: null }
const getServerSnap = () => serverSnap

/** Subscribe to the shared deploy state. Pass the server-rendered activity to skip the first fetch. */
export function useDeploy(initial?: Activity | null): DeploySnapshot {
  if (typeof window !== 'undefined') seed(initial)
  const s = useSyncExternalStore(subscribe, getSnap, getServerSnap)
  // During SSR / hydration, show what the server rendered.
  return s.activity || !initial ? s : { ...s, activity: initial }
}

/** Force a fresh check (the "Check now" button). */
export const checkNow = () => refresh(true)
