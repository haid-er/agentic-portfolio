'use client'
/**
 * Stripe Connect flow: a fully simulated marketplace. A creator onboards as an Express
 * connected account, sets a monthly price, a fan subscribes through a destination charge
 * with an application fee, and every step emits webhook events. Deliveries fail, retry with
 * backoff and sometimes arrive twice; the handler dedupes by event id and ignores stale
 * status updates. Nothing leaves the browser, and there are no keys.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge, Button, DemoGrid, DemoPanel, DemoToolbar, Loading, Segmented, Select, Toggle, type Tone,
} from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { useInView, useLocalStorage, usePageVisible, useReducedMotion } from '@/lib/hooks'
import { cx } from '@/lib/utils'
import { Deliveries } from './Deliveries'
import {
  advanceClock, cancel, createPrice, deliverNext, initialState, money, nextDue, onboardCreator, resend,
  simTime, split, subscribe, truthLedger, type Config, type SimState,
} from './engine'
import { LedgerTable } from './LedgerTable'
import { MoneyFlow } from './MoneyFlow'

export { notes } from './notes'

const DEFAULTS: Config = { priceCents: 1200, feePercent: 10, failRate: 0.3, duplicates: true, dedupe: true, declineRenewal: false }
const PRICES = [500, 1200, 2500, 5000]
const FEES = [5, 10, 15, 20, 30]
type Health = '0' | '0.3' | '1'
const HEALTH: ReadonlyArray<{ value: Health; label: string }> = [
  { value: '0', label: 'Healthy' },
  { value: '0.3', label: 'Flaky' },
  { value: '1', label: 'Down' },
]

function safeConfig(raw: unknown): Config {
  const c = { ...DEFAULTS, ...(typeof raw === 'object' && raw ? raw : {}) } as Config
  return {
    priceCents: PRICES.includes(c.priceCents) ? c.priceCents : DEFAULTS.priceCents,
    feePercent: FEES.includes(c.feePercent) ? c.feePercent : DEFAULTS.feePercent,
    failRate: [0, 0.3, 1].includes(c.failRate) ? c.failRate : DEFAULTS.failRate,
    duplicates: Boolean(c.duplicates),
    dedupe: Boolean(c.dedupe),
    declineRenewal: Boolean(c.declineRenewal),
  }
}

type Step = { id: string; label: string; detail: string; done: boolean; ready: boolean; run: () => void; cta: string }

export default function Demo(_props: DemoProps) {
  const reduced = useReducedMotion()
  const visible = usePageVisible()
  const [viewRef, inView] = useInView<HTMLDivElement>({ rootMargin: '120px' })
  const [rawCfg, setRawCfg] = useLocalStorage<Config>('stripe-connect-flow:config', DEFAULTS)
  const cfg = useMemo(() => safeConfig(rawCfg), [rawCfg])
  const setCfg = (patch: Partial<Config>) => setRawCfg((p) => ({ ...safeConfig(p), ...patch }))

  const [sim, setSim] = useState<SimState>(() => initialState())
  const [auto, setAuto] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  /** Every API call gets a short, labelled, simulated latency so the loading state is honest. */
  const callApi = (label: string, fn: (s: SimState) => SimState) => {
    if (busy) return
    setBusy(label)
    timer.current = setTimeout(() => { setSim(fn); setBusy(null) }, 420)
  }

  // auto-deliver queued webhooks while the demo is on screen
  const due = nextDue(sim)
  const live = auto && visible && inView && !busy && Boolean(due)
  useEffect(() => {
    if (!live) return
    const t = setTimeout(() => setSim((s) => deliverNext(s, cfg)), reduced ? 300 : 650)
    return () => clearTimeout(t)
  }, [live, sim, cfg, reduced])

  const truth = useMemo(() => truthLedger(sim.events), [sim.events])
  const sp = split(cfg.priceCents, cfg.feePercent)
  const paidCount = sim.attempts.filter((a) => a.handled === 'applied' || a.handled === 'reapplied').length
  const lastCall = sim.api[sim.api.length - 1]

  const steps: Step[] = [
    {
      id: 'onboard', label: 'Onboard the creator', cta: 'Create account',
      detail: sim.accountId ? `Express account ${sim.accountId}` : 'Express account + hosted onboarding link',
      done: Boolean(sim.accountId), ready: !sim.accountId,
      run: () => callApi('POST /v1/accounts', onboardCreator),
    },
    {
      id: 'price', label: 'Set a membership price', cta: 'Create price',
      detail: sim.priceId ? `${money(cfg.priceCents)} per month, ${sim.priceId}` : 'Product + recurring monthly price',
      done: Boolean(sim.priceId), ready: Boolean(sim.accountId) && !sim.priceId,
      run: () => callApi('POST /v1/prices', (s) => createPrice(s, cfg)),
    },
    {
      id: 'subscribe', label: 'A fan subscribes', cta: 'Subscribe',
      detail: sim.subId ? `Subscription ${sim.subId}` : 'Destination charge with application_fee_percent',
      done: Boolean(sim.subId), ready: Boolean(sim.priceId) && !sim.subId,
      run: () => callApi('POST /v1/subscriptions', (s) => subscribe(s, cfg, 'first')),
    },
    {
      id: 'renew', label: sim.pendingRetry ? 'Smart Retry the failed invoice' : 'Advance the test clock', cta: sim.pendingRetry ? '+3 days' : '+1 month',
      detail: sim.canceled ? 'Subscription canceled' : sim.period > 0 ? `${sim.period} renewal${sim.period === 1 ? '' : 's'} so far` : 'Renewal invoices, optional decline and dunning',
      done: sim.canceled, ready: Boolean(sim.subId) && !sim.canceled,
      run: () => callApi('POST /v1/test_helpers/test_clocks/advance', (s) => advanceClock(s, cfg)),
    },
  ]
  const current = steps.find((s) => s.ready)
  const subStatus: { label: string; tone: Tone } =
    truth.sub === 'active' ? { label: 'active', tone: 'ok' } :
    truth.sub === 'past_due' ? { label: 'past due', tone: 'warn' } :
    truth.sub === 'canceled' ? { label: 'canceled', tone: 'neutral' } : { label: 'no subscription', tone: 'neutral' }

  return (
    <div ref={viewRef} className="grid gap-4 min-w-0">
      <p className="sr-only" aria-live="polite">{lastCall ? `${lastCall.method} ${lastCall.path}: ${lastCall.note}` : ''}</p>

      <DemoGrid
        aside={
          <>
            <DemoPanel title="Webhook endpoint" meta={<span className="nums">{simTime(sim.now)}</span>}>
              <div className="grid gap-3">
                <Segmented label="Endpoint health" options={HEALTH} value={String(cfg.failRate) as Health}
                  onChange={(v) => setCfg({ failRate: Number(v) })} />
                <Toggle label="Stripe sends duplicates" checked={cfg.duplicates} onChange={(v) => setCfg({ duplicates: v })} />
                <Toggle label="Dedupe by event.id" checked={cfg.dedupe} onChange={(v) => setCfg({ dedupe: v })} />
                <Toggle label="Card declines on renewal" checked={cfg.declineRenewal} onChange={(v) => setCfg({ declineRenewal: v })} />
                <DemoToolbar>
                  <Button size="sm" variant="secondary" icon={auto ? 'pause' : 'play'} onClick={() => setAuto((a) => !a)} aria-pressed={auto}>
                    Auto-deliver
                  </Button>
                  <Button size="sm" variant="secondary" icon="step" disabled={!due} onClick={() => setSim((s) => deliverNext(s, cfg))}>
                    Deliver next
                  </Button>
                </DemoToolbar>
                <p className="m-0 text-00 text-ink-3" aria-live="polite">
                  {due
                    ? `${sim.queue.length} queued · next at ${simTime(due.dueAt)}${due.n > 1 ? ` (attempt ${due.n})` : ''}`
                    : sim.events.length ? `Queue empty · ${paidCount} deliveries handled` : 'Queue empty'}
                </p>
              </div>
            </DemoPanel>

            <DemoPanel title="Ledger" meta={<Badge tone={subStatus.tone}>{subStatus.label}</Badge>}>
              <LedgerTable truth={truth} handler={sim.handler} inFlight={sim.queue.length} />
              {sim.subCount > 1 ? (
                <p className="m-0 mt-3 text-0 text-danger" role="status">
                  The retry without an Idempotency-Key created {sim.subCount} subscriptions. The fan was charged {sim.subCount} times.
                </p>
              ) : null}
            </DemoPanel>
          </>
        }
      >
        <DemoPanel
          title="Marketplace"
          meta="simulated · no keys"
          actions={<Button size="sm" variant="ghost" icon="refresh" onClick={() => { setSim(initialState(417 + sim.seq)); setBusy(null) }}>Reset</Button>}
        >
          <div className="grid gap-5">
            <DemoToolbar>
              <Select label="Price per month" value={cfg.priceCents} onChange={(e) => setCfg({ priceCents: Number(e.target.value) })}
                wrapperClassName="w-40" disabled={Boolean(sim.priceId)} hint={sim.priceId ? 'Prices are immutable once created' : undefined}>
                {PRICES.map((p) => <option key={p} value={p}>{money(p)}</option>)}
              </Select>
              <Select label="Platform fee" value={cfg.feePercent} onChange={(e) => setCfg({ feePercent: Number(e.target.value) })}
                wrapperClassName="w-32" hint="application_fee_percent">
                {FEES.map((f) => <option key={f} value={f}>{f}%</option>)}
              </Select>
            </DemoToolbar>

            <ol className="m-0 p-0 list-none grid gap-2" aria-label="Flow steps">
              {steps.map((st, i) => (
                <li key={st.id}
                  className={cx('flex flex-wrap items-center gap-3 p-3 border rounded-1',
                    st === current ? 'border-rule bg-bg-2' : 'border-rule-soft')}>
                  <span aria-hidden="true" className={cx('display text-2 nums w-7', st.done ? 'text-accent' : 'text-ink-3')}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="m-0 font-semibold">{st.label}{st.done ? <span className="sr-only"> (done)</span> : null}</p>
                    <p className="m-0 text-00 text-ink-2 break-all">{st.detail}</p>
                  </div>
                  {st.ready ? (
                    <Button size="sm" variant={st === current ? 'primary' : 'secondary'} onClick={st.run} disabled={Boolean(busy)} arrow>
                      {st.cta}
                    </Button>
                  ) : st.done ? <Badge tone="ok">done</Badge> : <Badge>waiting</Badge>}
                </li>
              ))}
            </ol>

            {sim.subId && !sim.canceled ? (
              <div className="grid gap-2 p-3 border border-dashed border-rule rounded-1">
                <p className="m-0 mono text-ink-3">The subscribe call timed out on the client. Retry it:</p>
                <DemoToolbar>
                  <Button size="sm" variant="secondary" disabled={Boolean(busy)}
                    onClick={() => callApi('POST /v1/subscriptions (replay)', (s) => subscribe(s, cfg, 'replay'))}>
                    Same Idempotency-Key
                  </Button>
                  <Button size="sm" variant="danger" disabled={Boolean(busy)}
                    onClick={() => callApi('POST /v1/subscriptions (no key)', (s) => subscribe(s, cfg, 'no-key'))}>
                    Without a key
                  </Button>
                  <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => callApi('DELETE /v1/subscriptions', cancel)}>
                    Cancel subscription
                  </Button>
                </DemoToolbar>
              </div>
            ) : null}

            {busy ? <Loading label={`${busy} (simulated)`} /> : null}

            <MoneyFlow sp={sp} pulse={truth.invoicesPaid} accountId={sim.accountId} />
          </div>
        </DemoPanel>

        <DemoPanel title="Webhook events" meta={`${sim.events.length} events · ${sim.attempts.length} attempts`}>
          <Deliveries state={sim} onResend={(k) => setSim((s) => resend(s, k))} />
        </DemoPanel>

        <DemoPanel title="API log" meta={`${sim.api.length} requests`}>
          {sim.api.length === 0 ? (
            <p className="m-0 text-0 text-ink-3">No requests yet.</p>
          ) : (
            <ol className="m-0 p-0 list-none grid gap-2 max-h-72 overflow-y-auto" aria-label="API requests, newest first" tabIndex={0}>
              {[...sim.api].reverse().map((c) => (
                <li key={c.id} className="grid gap-1 pb-2 border-b border-rule-soft last:border-b-0">
                  <p className="m-0 flex flex-wrap items-center gap-2">
                    <Badge tone={c.method === 'DELETE' ? 'warn' : 'neutral'}>{c.method}</Badge>
                    <code className="font-mono text-0 break-all">{c.path}</code>
                    {c.replay ? <Badge tone="accent">replayed</Badge> : <Badge tone="ok">{c.status}</Badge>}
                  </p>
                  <p className="m-0 text-00 text-ink-2 break-all">{c.note}</p>
                  {c.idemKey ? <p className="m-0 font-mono text-00 text-ink-3 break-all">Idempotency-Key: {c.idemKey}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </DemoPanel>
      </DemoGrid>
    </div>
  )
}
