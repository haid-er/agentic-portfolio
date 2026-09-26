'use client'
/**
 * One collection form: state, zod validation, save, unsaved-changes guard.
 *
 *   <EditorShell name="skills" initialData={raw}> <SkillsEditor /> </EditorShell>
 *
 * - Validates on every change with the same zod schema the build uses, so what
 *   passes here passes `next build`. Errors appear once a field is touched, and
 *   for every field after a save attempt (collapsed items with problems open).
 * - Loads the latest stored copy on mount (on Vercel it can be newer than the
 *   running build) and keeps its sha, so a stale tab gets "conflict" instead of
 *   silently overwriting a newer save.
 * - Ctrl/Cmd+S saves. Leaving with unsaved edits asks first.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, Button, Icon, useToast } from '@/components/ui'
import { SCHEMAS, type CollectionName } from '@/lib/content/schema'
import { loadContent, saveContent, type ClientCode } from '@/lib/admin/client'
import { describeChange } from '@/lib/admin/diff'
import { timeAgo } from '@/lib/admin/format'
import { cx } from '@/lib/utils'
import { ConfirmDialog } from './ConfirmDialog'
import { EditorBoundary } from './EditorBoundary'
import { EditorCtx, type EditorApi, type Updater } from './EditorContext'
import { RawJson } from './RawJson'
import { getIn, pathKey, sameJson, setIn, type Path } from './lib/path'
import { useUnsavedGuard } from './useUnsavedGuard'

type Mode = 'github' | 'disk'

interface Banner {
  tone: 'warn' | 'danger' | 'info'
  title: string
  body?: ReactNode
  actions?: { label: string; onClick: () => void }[]
}

interface Issue { key: string; path: Path; message: string }

export interface ExtraIssue { path: Path; message: string }
export type ExtraCheck = (data: unknown) => ExtraIssue[]

/**
 * Duplicate `id` / `slug` values in every list of objects, at any depth
 * (`items`, `site.socials`, …). zod only checks the format, and a duplicate
 * becomes a duplicate React key and anchor on the public site.
 */
function duplicateKeys(data: unknown, path: Path = [], out: ExtraIssue[] = []): ExtraIssue[] {
  if (Array.isArray(data)) {
    for (const field of ['id', 'slug'] as const) {
      const seen = new Map<string, number>()
      data.forEach((it: unknown, i) => {
        const v = it && typeof it === 'object' ? (it as Record<string, unknown>)[field] : undefined
        if (typeof v !== 'string' || !v) return
        if (seen.has(v)) out.push({ path: [...path, i, field], message: `Duplicate ${field} “${v}” (also used by item #${seen.get(v)! + 1}).` })
        else seen.set(v, i)
      })
    }
    data.forEach((it, i) => duplicateKeys(it, [...path, i], out))
  } else if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) duplicateKeys(v, [...path, k], out)
  }
  return out
}

function issuesOf(name: CollectionName, data: unknown, extra?: ExtraCheck): Issue[] {
  const res = SCHEMAS[name].safeParse(data)
  const raw: ExtraIssue[] = res.success
    ? []
    : res.error.issues.map((i) => ({ path: i.path.filter((p): p is string | number => typeof p !== 'symbol'), message: i.message }))
  raw.push(...duplicateKeys(data))
  if (extra) raw.push(...extra(data))
  const seen = new Set<string>()
  const out: Issue[] = []
  for (const i of raw) {
    const key = pathKey(i.path)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ key, path: i.path, message: i.message })
  }
  return out
}

/** "items › 3 › name" for the problem list (1-based item numbers). */
const humanPath = (p: Path) => (p.length ? p.map((s) => (typeof s === 'number' ? `#${s + 1}` : s)).join(' › ') : 'whole file')

/** Fired before focusing a problem so tabbed editors can switch to the tab holding `detail` (a path key). */
export const REVEAL_EVENT = 'ghp:admin-reveal'

function focusFirstInvalid(key?: string) {
  if (key !== undefined) window.dispatchEvent(new CustomEvent<string>(REVEAL_EVENT, { detail: key }))
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // Let tabs switch and collapsed list items open, then the control exists.
  window.setTimeout(() => {
    let el: HTMLElement | null = null
    if (key !== undefined) {
      const parts = key.split('.')
      while (!el && parts.length) {
        el = document.querySelector<HTMLElement>(`[data-path="${CSS.escape(parts.join('.'))}"]`)
        parts.pop()
      }
    }
    el ??= document.querySelector<HTMLElement>('form [aria-invalid="true"]')
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    el.focus({ preventScroll: true })
  }, 80)
}

export interface EditorMeta { label: string; description: string; file: string }

export function EditorShell({ name, meta, initialData, check, children }: {
  name: CollectionName
  meta: EditorMeta
  initialData: unknown
  /** Extra rules beyond the schema (e.g. theme contrast). They block saving too. */
  check?: ExtraCheck
  children: ReactNode
}) {
  const toast = useToast()
  const router = useRouter()

  const [data, setData] = useState<unknown>(initialData)
  const [saved, setSaved] = useState<unknown>(initialData)
  const [baseSha, setBaseSha] = useState<string | undefined>()
  const [mode, setMode] = useState<Mode | null>(null)
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set())
  const [revealed, setRevealed] = useState(false)
  const [serverIssues, setServerIssues] = useState<Issue[]>([])
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [savedAt, setSavedAt] = useState<{ at: number; summary: string; commitUrl?: string } | null>(null)
  /** A blocked navigation: a link target, or `href: null` for the Back button. */
  const [pending, setPending] = useState<{ href: string | null } | null>(null)
  /**
   * 'ok' once the latest stored copy (and its sha) was read; until then a save
   * re-checks first, so the conflict guard is never silently off.
   */
  const [sync, setSync] = useState<'pending' | 'ok' | 'failed' | 'unconfigured'>('pending')
  /** A newer stored copy exists under unsaved edits: saving is refused until the owner chooses. */
  const [stale, setStale] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [, tick] = useState(0)
  const [shortcut, setShortcut] = useState('Ctrl+S')
  useEffect(() => { if (/Mac|iPhone|iPad/.test(navigator.userAgent)) setShortcut('⌘S') }, [])

  const dirty = !sameJson(data, saved)
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const savedRef = useRef(saved)
  savedRef.current = saved
  /** Last data the form rendered without throwing (see EditorBoundary). */
  const lastGood = useRef(data)
  const dataRef = useRef(data)
  dataRef.current = data

  /* ---------------- validation ---------------- */
  const clientIssues = useMemo(() => issuesOf(name, data, check), [name, data, check])
  const issues = useMemo(() => {
    const byKey = new Map<string, Issue>()
    for (const i of serverIssues) byKey.set(i.key, i)
    for (const i of clientIssues) if (!byKey.has(i.key)) byKey.set(i.key, i)
    return [...byKey.values()]
  }, [clientIssues, serverIssues])

  const visible = useCallback(
    (key: string) => revealed || touched.has(key) || [...touched].some((t) => t.startsWith(`${key}.`)),
    [revealed, touched],
  )

  const set = useCallback((path: Path, value: Updater) => {
    setData((prev: unknown) => setIn(prev, path, typeof value === 'function' ? (value as (p: unknown) => unknown)(getIn(prev, path)) : value))
    const key = pathKey(path)
    setTouched((t) => (t.has(key) ? t : new Set(t).add(key)))
    setServerIssues((xs) => (xs.length ? xs.filter((i) => i.key !== key && !i.key.startsWith(`${key}.`)) : xs))
  }, [])

  const api = useMemo<EditorApi>(() => ({
    data,
    initial: saved,
    set,
    busy,
    revealed,
    errorAt: (path) => {
      const key = pathKey(path)
      const hit = issues.find((i) => i.key === key)
      return hit && visible(key) ? hit.message : undefined
    },
    errorsUnder: (path) => {
      const key = pathKey(path)
      return issues.filter((i) => (key === '' || i.key === key || i.key.startsWith(`${key}.`)) && (revealed || visible(i.key) || visible(key))).length
    },
  }), [data, saved, set, busy, revealed, issues, visible])

  /* ---------------- latest stored copy ---------------- */
  /**
   * Read the stored copy and decide what to do with it. The sha is adopted only
   * together with the data it belongs to; under unsaved edits a newer copy
   * marks the form stale instead, so a save cannot overwrite it.
   */
  const syncLatest = useCallback(async (): Promise<{ status: 'ok' | 'replaced' | 'stale' | 'failed'; sha?: string }> => {
    const res = await loadContent(name)
    if (!res.ok) {
      if (res.code === 'unconfigured') {
        setSync('unconfigured')
        setBanner({ tone: 'warn', title: 'Saving is not configured here', body: 'This deployment has no content store (GITHUB_TOKEN + GITHUB_REPO). You can edit and validate, but a save will be refused.' })
      } else {
        setSync('failed')
        setBanner(res.code === 'unauthorized' ? sessionBanner() : {
          tone: 'warn',
          title: 'Could not load the latest copy',
          body: `${res.message} Saving checks again first and is refused if that also fails, so newer edits are never overwritten blindly.`,
          actions: [{ label: 'Retry', onClick: () => { setBanner(null); void syncLatest() } }],
        })
      }
      return { status: 'failed' }
    }
    setMode(res.mode)
    setSync('ok')
    const sha = res.sha ?? undefined
    const parsed = res.data == null ? null : SCHEMAS[name].safeParse(res.data)
    // Same as ours, missing, or unreadable (a save is the way to repair it): just take the sha.
    if (!parsed || !parsed.success || sameJson(parsed.data, savedRef.current) || sameJson(res.data, savedRef.current)) {
      setBaseSha(sha)
      setStale(false)
      return { status: 'ok', sha }
    }
    const adopt = () => {
      setData(parsed.data)
      setSaved(parsed.data)
      setBaseSha(sha)
      setStale(false)
      setTouched(new Set())
      setServerIssues([])
      setRevealed(false)
    }
    if (!dirtyRef.current) {
      adopt()
      setBanner({ tone: 'info', title: 'Showing the latest saved copy', body: 'It is newer than the build you are looking at; the public site catches up when the redeploy finishes.' })
      return { status: 'replaced' }
    }
    setStale(true)
    setBanner({
      tone: 'warn',
      title: 'A newer saved copy exists',
      body: 'Someone (or another tab) saved this collection after this page was built, so saving your edits is blocked. Copy your version from “Edit as JSON” if you need it, then load the newer copy and re-apply your edit.',
      actions: [{ label: 'Load it (drop my edits)', onClick: () => { adopt(); setBanner(null) } }],
    })
    return { status: 'stale' }
  }, [name])

  useEffect(() => {
    let alive = true
    // Deferred a tick so a fast unmount (route change) skips the request.
    const t = window.setTimeout(() => { if (alive) void syncLatest() }, 0)
    return () => { alive = false; window.clearTimeout(t) }
  }, [syncLatest])

  // Keep "saved 3 min ago" fresh.
  useEffect(() => {
    if (!savedAt) return
    const t = window.setInterval(() => tick((n) => n + 1), 30_000)
    return () => window.clearInterval(t)
  }, [savedAt])

  /* ---------------- save ---------------- */
  const save = useCallback(async (): Promise<boolean> => {
    if (busy) return false
    setRevealed(true)
    const parsed = SCHEMAS[name].safeParse(data)
    const n = issuesOf(name, data, check).length
    if (!parsed.success || n > 0) {
      toast(`${n} problem${n === 1 ? '' : 's'} to fix before saving. Nothing was saved.`, { tone: 'danger' })
      focusFirstInvalid(issuesOf(name, data, check)[0]?.key)
      return false
    }
    if (stale) {
      toast('A newer saved copy exists. Nothing was saved.', { tone: 'danger', ms: 7000 })
      failed('conflict', '')
      return false
    }
    setBusy(true)
    let sha = baseSha
    if (sync === 'pending' || sync === 'failed') {
      // Never save without knowing what we would overwrite.
      const latest = await syncLatest()
      if (latest.status !== 'ok') {
        setBusy(false)
        if (latest.status === 'failed') toast('Could not check for a newer saved copy, so nothing was saved. Try again.', { tone: 'danger', ms: 7000 })
        else if (latest.status === 'replaced') toast('The form now shows a newer saved copy. Nothing was saved.', { tone: 'warn', ms: 7000 })
        else toast('A newer saved copy exists. Nothing was saved.', { tone: 'danger', ms: 7000 })
        return false
      }
      sha = latest.sha
    }
    const snapshot = data
    const summary = describeChange(saved, parsed.data).text
    const res = await saveContent(name, parsed.data, { baseSha: sha })
    setBusy(false)
    if (res.ok) {
      // Keep anything typed while the commit was in flight; it simply stays "unsaved".
      setData((cur: unknown) => (cur === snapshot ? parsed.data : cur))
      setSaved(parsed.data)
      if (res.sha) setBaseSha(res.sha)
      if (res.mode) setMode(res.mode)
      setTouched(new Set())
      setServerIssues([])
      setRevealed(false)
      setBanner(null)
      setSavedAt({ at: Date.now(), summary: res.unchanged ? '' : res.summary ?? summary, commitUrl: res.commitUrl })
      toast(res.message ?? `${meta.label} saved.`, { tone: 'ok', ms: 6000 })
      return true
    }
    failed(res.code, res.message, res.issues)
    return false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, name, data, saved, baseSha, meta.label, toast, check, stale, sync, syncLatest])

  function failed(code: ClientCode, message: string, serverList?: { path: string; message: string }[]) {
    if (message) toast(message, { tone: 'danger', ms: 7000 })
    switch (code) {
      case 'invalid':
        setServerIssues((serverList ?? []).map((i) => {
          const path = i.path === '(root)' ? [] : i.path.split('.').map((s) => (/^\d+$/.test(s) ? Number(s) : s))
          return { key: pathKey(path), path, message: i.message }
        }))
        focusFirstInvalid(serverList?.[0]?.path === '(root)' ? undefined : serverList?.[0]?.path)
        break
      case 'conflict':
        setBanner({
          tone: 'danger',
          title: 'Someone saved first',
          body: 'This collection changed since you opened it. Copy your version from “Edit as JSON” if you need it, then load the latest copy and re-apply your edit.',
          actions: [{ label: 'Load latest (drop my edits)', onClick: reloadLatest }],
        })
        break
      case 'unauthorized':
        setBanner(sessionBanner())
        break
      default:
        setBanner({ tone: 'danger', title: 'Not saved', body: message })
    }
  }

  function reloadLatest() {
    loadContent(name).then((res) => {
      if (!res.ok || res.data == null) { toast(res.ok ? 'No stored copy found.' : res.message, { tone: 'danger' }); return }
      const parsed = SCHEMAS[name].safeParse(res.data)
      if (!parsed.success) { toast('The stored copy does not validate; fix it in the repository.', { tone: 'danger' }); return }
      setData(parsed.data)
      setSaved(parsed.data)
      setBaseSha(res.sha ?? undefined)
      setSync('ok')
      setStale(false)
      setTouched(new Set())
      setServerIssues([])
      setRevealed(false)
      setBanner(null)
      toast('Loaded the latest saved copy.', { tone: 'ok' })
    })
  }

  function sessionBanner(): Banner {
    const next = typeof location === 'undefined' ? '/admin' : location.pathname + location.search
    return {
      tone: 'danger',
      title: 'Your session expired',
      body: (
        <>
          Your edits are still on this page. <a className="underline text-accent-ink" href={`/admin/login?next=${encodeURIComponent(next)}`} target="_blank" rel="noopener">Sign in in a new tab</a>, then come back and save.
        </>
      ),
    }
  }

  const discard = () => {
    setData(saved)
    setTouched(new Set())
    setServerIssues([])
    setRevealed(false)
    setConfirmDiscard(false)
    toast('Changes discarded.')
    if (stale) reloadLatest() // the newer stored copy replaces the stale base
  }

  /* ---------------- keyboard + guard ---------------- */
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onBlocked = useCallback((href: string | null) => setPending({ href }), [])
  const guard = useUnsavedGuard(dirty, onBlocked)

  const go = (href: string | null) => (href === null ? guard.back() : router.push(href))

  const leave = (href: string | null) => {
    setPending(null)
    guard.allowLeave(true)
    dirtyRef.current = false
    setSaved(data) // lifts the guard for this navigation
    go(href)
  }

  const saveAndLeave = async () => {
    const href = pending?.href ?? null
    setPending(null)
    guard.allowLeave(true)
    if (await save()) go(href)
    else guard.allowLeave(false)
  }

  /* ---------------- counts for the header ---------------- */
  const items = (getIn(data, ['items']) as { enabled?: boolean; verified?: boolean }[] | undefined) ?? null
  const hidden = items?.filter((i) => i.enabled === false).length ?? 0
  const unverified = items?.filter((i) => i.verified === false).length ?? 0
  const change = dirty ? describeChange(saved, data).text : ''
  const problems = api.errorsUnder([])
  const allProblems = issues.length

  return (
    <EditorCtx.Provider value={api}>
      <div className="grid gap-s5 min-w-0">
        <header className="grid gap-2 min-w-0">
          <p className="mono m-0 text-ink-3 flex flex-wrap gap-x-2">
            <span>Editor</span><span aria-hidden="true">/</span><span className="normal-case tracking-normal">{meta.file}</span>
          </p>
          <h1 className="display m-0 text-4">{meta.label}</h1>
          <p className="m-0 text-ink-2 measure">{meta.description}</p>
          {items ? (
            <div className="flex flex-wrap gap-2" aria-label="Collection summary">
              <Badge>{items.length} item{items.length === 1 ? '' : 's'}</Badge>
              {hidden ? <Badge tone="neutral">{hidden} hidden</Badge> : null}
              {unverified ? <Badge tone="warn">{unverified} unverified</Badge> : null}
            </div>
          ) : null}
        </header>

        {banner ? <BannerView banner={banner} onClose={() => setBanner(null)} /> : null}

        {revealed && allProblems ? (
          <ProblemList issues={issues} onJump={(key) => focusFirstInvalid(key)} />
        ) : null}

        <form
          noValidate
          aria-busy={busy}
          onSubmit={(e) => { e.preventDefault(); void save() }}
          className="grid gap-s6 min-w-0"
        >
          <EditorBoundary
            resetKey={data}
            onRendered={() => { lastGood.current = dataRef.current }}
            onRevert={() => setData(lastGood.current)}
          >
            {children}
          </EditorBoundary>
          <RawJson name={name} />
          <SaveBar
            dirty={dirty}
            busy={busy}
            change={change}
            problems={problems}
            mode={mode}
            savedAt={savedAt}
            shortcut={shortcut}
            onDiscard={() => setConfirmDiscard(true)}
          />
        </form>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title="Leave with unsaved edits?"
        onClose={() => setPending(null)}
        actions={[
          { label: 'Stay', onClick: () => setPending(null), autoFocus: true },
          { label: 'Leave without saving', variant: 'danger', onClick: () => pending && leave(pending.href) },
          { label: 'Save and leave', variant: 'primary', onClick: () => void saveAndLeave() },
        ]}
      >
        <p className="m-0">{change ? `Pending: ${change}.` : 'You changed this collection.'} Nothing is saved until you press Save.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard your changes?"
        onClose={() => setConfirmDiscard(false)}
        actions={[
          { label: 'Keep editing', onClick: () => setConfirmDiscard(false), autoFocus: true },
          { label: 'Discard', variant: 'danger', onClick: discard },
        ]}
      >
        <p className="m-0">{change ? `This throws away: ${change}.` : 'This resets the form to the saved copy.'}</p>
      </ConfirmDialog>
    </EditorCtx.Provider>
  )
}

/* ------------------------------------------------------------------ */

function BannerView({ banner, onClose }: { banner: Banner; onClose: () => void }) {
  const border = banner.tone === 'danger' ? 'border-danger' : banner.tone === 'warn' ? 'border-warn' : 'border-rule'
  const tone = banner.tone === 'danger' ? 'text-danger' : banner.tone === 'warn' ? 'text-warn' : 'text-ink'
  return (
    <div role={banner.tone === 'info' ? 'status' : 'alert'} className={cx('flex gap-3 items-start p-s4 bg-surface border rounded-1', border)}>
      <Icon name={banner.tone === 'info' ? 'info' : 'alert'} size={20} className={cx('mt-[2px]', tone)} />
      <div className="grid gap-2 min-w-0 flex-1">
        <p className={cx('m-0 font-semibold', tone)}>{banner.title}</p>
        {banner.body ? <div className="text-0 text-ink-2">{banner.body}</div> : null}
        {banner.actions?.length ? (
          <div className="flex flex-wrap gap-2">
            {banner.actions.map((a) => <Button key={a.label} size="sm" variant="secondary" onClick={a.onClick}>{a.label}</Button>)}
          </div>
        ) : null}
      </div>
      <button type="button" onClick={onClose} aria-label="Dismiss message" className="grid place-items-center size-[44px] -m-2 text-ink-2 hover:text-ink">
        <Icon name="close" size={18} />
      </button>
    </div>
  )
}

function ProblemList({ issues, onJump }: { issues: Issue[]; onJump: (key: string) => void }) {
  return (
    <section aria-labelledby="problems-h" className="p-s4 bg-surface border border-danger rounded-1 grid gap-2">
      <h2 id="problems-h" className="mono m-0 text-danger flex items-center gap-2">
        <Icon name="alert" size={16} /> {issues.length} problem{issues.length === 1 ? '' : 's'} before this can be saved
      </h2>
      <ul className="m-0 p-0 list-none grid gap-1">
        {issues.slice(0, 12).map((i) => (
          <li key={i.key}>
            <button type="button" onClick={() => onJump(i.key)} className="min-h-tap text-left text-0 flex flex-wrap gap-x-2 items-baseline hover:underline">
              <span className="font-mono text-00 text-ink-3">{humanPath(i.path)}</span>
              <span>{i.message}</span>
            </button>
          </li>
        ))}
        {issues.length > 12 ? <li className="text-0 text-ink-3">…and {issues.length - 12} more.</li> : null}
      </ul>
    </section>
  )
}

function SaveBar({ dirty, busy, change, problems, mode, savedAt, shortcut, onDiscard }: {
  dirty: boolean
  busy: boolean
  change: string
  problems: number
  mode: Mode | null
  savedAt: { at: number; summary: string; commitUrl?: string } | null
  shortcut: string
  onDiscard: () => void
}) {
  const status = busy
    ? 'Saving…'
    : dirty
      ? `Unsaved: ${change || 'edited'}`
      : savedAt
        ? `Saved ${timeAgo(new Date(savedAt.at).toISOString())}${savedAt.summary ? ` · ${savedAt.summary}` : ' · nothing changed'}`
        : 'No unsaved changes'
  return (
    <div className="sticky bottom-0 z-[var(--z-header)] -mx-[var(--gutter)] md:mx-0 px-[var(--gutter)] md:px-s4 py-s3 pb-[calc(var(--s-3)+env(safe-area-inset-bottom))] bg-surface border-t md:border border-rule md:rounded-1 shadow-press">
      <div className="flex flex-wrap items-center gap-x-s4 gap-y-2">
        <div className="flex-1 min-w-[12rem] grid gap-[2px]">
          <p aria-live="polite" className="m-0 text-0 flex items-center gap-2 min-w-0">
            <span
              aria-hidden="true"
              className={cx('inline-block size-[10px] flex-none rounded-pill border border-rule', dirty ? 'bg-accent-2' : 'bg-ok', busy && 'motion-safe:animate-pulse')}
            />
            <span className="truncate">{status}</span>
          </p>
          <p className="m-0 mono text-ink-3">
            {problems ? <span className="text-danger">{problems} to fix · </span> : null}
            {mode === 'github' ? 'Commits to GitHub, then Vercel redeploys' : mode === 'disk' ? 'Writes to content/ on disk (dev)' : 'Validated with the build schema'}
            {savedAt?.commitUrl ? (
              <> · <a href={savedAt.commitUrl} target="_blank" rel="noopener noreferrer" className="underline text-accent-ink">commit</a></>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {dirty ? <Button variant="ghost" size="sm" onClick={onDiscard} disabled={busy}>Discard</Button> : null}
          <Button type="submit" variant="primary" icon={busy ? 'refresh' : 'check'} disabled={busy} aria-keyshortcuts="Control+S Meta+S">
            {busy ? 'Saving' : 'Save'} <span className="hidden md:inline text-00 opacity-80 normal-case">{shortcut}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
