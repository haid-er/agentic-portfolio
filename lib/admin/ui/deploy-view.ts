/** Turns the deploy snapshot into words (shared by the pill and the panel). Owner: admin-core. Pure. */
import type { Tone } from '@/components/ui/Badge'
import type { IconName } from '@/components/ui/Icon'
import { clock } from '../format'
import type { DeploySnapshot } from './deploy-store'

export interface DeployView {
  tone: Tone
  icon: IconName
  /** Short label for the pill, e.g. "Deploying 0:42". */
  short: string
  /** Headline for the panel. */
  title: string
  detail: string
  /** 0 committed, 1 building, 2 live; null when there is no track to show. */
  step: 0 | 1 | 2 | null
  busy: boolean
  failed: boolean
}

export function deployView(s: DeploySnapshot, now: number): DeployView {
  const a = s.activity
  const base = { step: null, busy: false, failed: false } as const

  if (s.savedAt && (!a || a.deploy.state === 'live' || a.deploy.state === 'untracked')) {
    const t = clock((now - s.savedAt) / 1000)
    return {
      ...base, tone: 'warn', icon: 'register', short: `Deploying ${t}`, title: 'Committed. Waiting for the build.',
      detail: 'The save is on GitHub. Vercel picks it up within seconds and reprints the site, usually in a minute or two.',
      step: 1, busy: true,
    }
  }
  if (!a) {
    return s.error
      ? { ...base, tone: 'neutral', icon: 'info', short: 'Status unavailable', title: 'Press status unavailable', detail: s.error }
      : { ...base, tone: 'neutral', icon: 'register', short: 'Checking…', title: 'Checking the press…', detail: 'Reading the latest commit.' }
  }

  const d = a.deploy
  const waited = d.headDate ? clock((now - Date.parse(d.headDate)) / 1000) : ''
  switch (d.state) {
    case 'deploying':
      return {
        ...base, tone: 'warn', icon: 'register', short: `Deploying ${waited}`, title: 'Deploying the latest save…',
        detail: `A newer commit is on ${d.branch}. Vercel is building it; this page flips to Live when the new build answers.`,
        step: 1, busy: true,
      }
    case 'stalled':
      return {
        ...base, tone: 'danger', icon: 'alert', short: 'Deploy stalled', title: 'The latest save has not gone live',
        detail: `The newest commit on ${d.branch} has waited ${waited}. The build may have failed: open the Vercel dashboard for the log. The live site still shows the previous version.`,
        step: 1, failed: true,
      }
    case 'live': {
      const fresh = s.wentLiveAt !== null && now - s.wentLiveAt < 90_000
      return {
        ...base, tone: 'ok', icon: 'check', short: fresh ? 'Live · reprinted' : 'Live', title: fresh ? 'Reprinted. The site is live.' : 'Live: the site matches the latest save',
        detail: `This deployment was built from the head of ${d.branch}.`, step: 2,
      }
    }
    default:
      if (a.mode === 'disk') {
        return {
          ...base, tone: 'neutral', icon: 'doc', short: 'Local · disk', title: 'Local mode: saves write to disk',
          detail: 'No GITHUB_TOKEN here, so saves write content/*.json in this working tree. The dev server reloads them.',
        }
      }
      if (a.mode === null) {
        return {
          ...base, tone: 'danger', icon: 'alert', short: 'Saving off', title: 'Saving is not configured',
          detail: 'This deployment has no GITHUB_TOKEN / GITHUB_REPO, so edits cannot be saved.', failed: true,
        }
      }
      return {
        ...base, tone: 'neutral', icon: 'info', short: `Commits to ${a.branch ?? 'main'}`, title: `Saves commit to ${a.branch ?? 'main'}`,
        detail: a.error
          ? `GitHub could not be read: ${a.error}`
          : `This deployment is not the ${a.branch ?? 'main'} production build, so its deploy state is not tracked here.`,
      }
  }
}
