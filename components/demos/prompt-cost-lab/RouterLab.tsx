'use client'
/** Model router: ordered rules send each request to a model; compare with one model for all. */
import { useMemo, useState } from 'react'
import { Badge, Button, controlClasses, Input, Select, Table, TableWrap, Td, Th } from '@/components/ui'
import { cx } from '@/lib/utils'
import { DAYS_PER_MONTH, formatUsd } from './cost'
import type { ModelPrice } from './prices'
import { DEFAULT_RULES, route, ROUTER_PREFIX_TOKENS, SAMPLE_REQUESTS, type Rule } from './router'

const INKS = ['var(--data-1)', 'var(--data-2)', 'var(--data-3)', 'var(--data-4)', 'var(--accent)']

function price(m: ModelPrice | undefined, inTok: number, outTok: number): number {
  return m ? (inTok * m.input + outTok * m.output) / 1_000_000 : 0
}

export function RouterLab({ models }: { models: ModelPrice[] }) {
  const [rules, setRules] = useState<Rule[]>(() => DEFAULT_RULES.map((r) => ({ ...r })))
  const [single, setSingle] = useState('claude-opus-5')
  const [volume, setVolume] = useState(10000)
  const [probe, setProbe] = useState('')
  const byId = useMemo(() => new Map(models.map((m) => [m.id, m])), [models])

  const rows = useMemo(() => SAMPLE_REQUESTS.map((q) => {
    const { rule, tokens } = route(q.prompt, rules)
    const inTok = ROUTER_PREFIX_TOKENS + tokens
    return { q, rule, tokens, routed: price(byId.get(rule.model), inTok, q.outputTokens), flat: price(byId.get(single), inTok, q.outputTokens) }
  }), [byId, rules, single])

  const routedAvg = rows.reduce((s, r) => s + r.routed, 0) / (rows.length || 1)
  const flatAvg = rows.reduce((s, r) => s + r.flat, 0) / (rows.length || 1)
  const month = volume * DAYS_PER_MONTH
  const saving = flatAvg ? 1 - routedAvg / flatAvg : 0

  const mix = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rows) counts.set(r.rule.model, (counts.get(r.rule.model) ?? 0) + 1)
    return [...counts.entries()].map(([model, n], i) => ({ model, n, ink: INKS[i % INKS.length] }))
  }, [rows])

  const update = (id: string, p: Partial<Rule>) => setRules((all) => all.map((r) => (r.id === id ? { ...r, ...p } : r)))
  const move = (i: number, d: -1 | 1) => setRules((all) => {
    const j = i + d
    const a = all[i], b = all[j]
    if (!a || !b || b.kind === 'default' || a.kind === 'default') return all
    const next = [...all]
    next[i] = b; next[j] = a
    return next
  })

  const probeHit = probe.trim() ? route(probe, rules) : null
  const modelOptions = models.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 mid:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <ol className="grid gap-2 m-0 p-0 list-none" aria-label="Routing rules, first match wins">
          {rules.map((r, i) => (
            <li key={r.id} className="grid gap-2 p-3 border border-rule-soft rounded-1 bg-surface min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mono text-ink-3 nums">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-semibold text-0">{r.label}</span>
                {r.kind !== 'default' ? (
                  <span className="ml-auto flex gap-1">
                    <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move “${r.label}” up`}>Up</Button>
                    <Button size="sm" variant="ghost" disabled={rules[i + 1]?.kind === 'default'} onClick={() => move(i, 1)} aria-label={`Move “${r.label}” down`}>Down</Button>
                  </span>
                ) : null}
              </div>
              <div className="grid gap-2 xs:grid-cols-2 xs:items-end">
                {r.kind === 'keywords' ? (
                  <Input label="If the prompt contains any of" value={r.keywords} onChange={(e) => update(r.id, { keywords: e.target.value })} maxLength={200} />
                ) : r.kind === 'longer' ? (
                  <Input label="If prompt tokens exceed" type="number" min={0} max={100000} value={r.threshold} onChange={(e) => update(r.id, { threshold: Math.max(0, Number(e.target.value) || 0) })} />
                ) : (
                  <p className="m-0 mono text-ink-2 self-center">Otherwise</p>
                )}
                <Select label="Send to" value={r.model} onChange={(e) => update(r.id, { model: e.target.value })}>{modelOptions}</Select>
              </div>
            </li>
          ))}
        </ol>

        <div className="grid gap-4 content-start">
          <div className="grid gap-3 xs:grid-cols-2">
            <Select label="Compare with everything on" value={single} onChange={(e) => setSingle(e.target.value)}>{modelOptions}</Select>
            <label className="grid gap-1">
              <span className="mono text-ink-2">Requests per day</span>
              <input type="number" min={1} max={10_000_000} value={volume} onChange={(e) => setVolume(Math.min(10_000_000, Math.max(1, Number(e.target.value) || 1)))} className={cx(controlClasses, 'nums')} />
            </label>
          </div>

          <div className="grid gap-1 p-4 bg-bg-2 rounded-1" aria-live="polite">
            <span className="mono text-ink-3">Routed, per month</span>
            <span className="display text-4 nums">{formatUsd(routedAvg * month)}</span>
            <span className="text-0 text-ink-2">
              vs <span className="nums">{formatUsd(flatAvg * month)}</span> on {single}:{' '}
              {saving >= 0 ? <strong className="nums">{Math.round(saving * 100)}% less</strong> : <strong className="nums text-danger">{Math.round(-saving * 100)}% more</strong>}
            </span>
          </div>

          <figure className="m-0 grid gap-2">
            <div className="flex h-4 overflow-hidden rounded-0 bg-rule-soft" aria-hidden="true">
              {mix.map((s) => <span key={s.model} style={{ width: `${(s.n / rows.length) * 100}%`, background: s.ink }} className="border-r border-surface last:border-r-0" />)}
            </div>
            <figcaption>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 m-0 p-0 list-none">
                {mix.map((s) => (
                  <li key={s.model} className="flex items-center gap-1 mono text-ink-2">
                    <span className="inline-block size-3 rounded-0" style={{ background: s.ink }} aria-hidden="true" />
                    {s.model} · {s.n}/{rows.length}
                  </li>
                ))}
              </ul>
            </figcaption>
          </figure>

          <Input label="Try a prompt against the rules" value={probe} onChange={(e) => setProbe(e.target.value)} maxLength={2000} placeholder="e.g. Explain why our gas use rose in March" autoComplete="off" />
          {probeHit ? (
            <p className="m-0 flex flex-wrap items-center gap-2 text-0" aria-live="polite">
              <Badge tone="accent">{probeHit.rule.label}</Badge>
              <span>→ <span className="font-mono">{probeHit.rule.model}</span></span>
              <span className="mono text-ink-3 nums">≈{probeHit.tokens} tokens</span>
            </p>
          ) : null}
        </div>
      </div>

      <TableWrap label="Sample requests and where they were routed">
        <Table className="min-w-[640px]">
          <thead>
            <tr><Th>Request</Th><Th className="text-right">In</Th><Th className="text-right">Out</Th><Th>Rule → model</Th><Th className="text-right">Routed</Th><Th className="text-right">Single</Th></tr>
          </thead>
          <tbody>
            {rows.map(({ q, rule, tokens, routed, flat }) => (
              <tr key={q.id}>
                <Td className="max-w-[22rem]"><span className="line-clamp-2" title={q.prompt}>{q.prompt}</span></Td>
                <Td className="text-right">{ROUTER_PREFIX_TOKENS + tokens}</Td>
                <Td className="text-right">{q.outputTokens}</Td>
                <Td><span className="block text-0">{rule.label}</span><span className="block font-mono text-00 text-ink-2">{rule.model}</span></Td>
                <Td className="text-right whitespace-nowrap">{formatUsd(routed)}</Td>
                <Td className="text-right whitespace-nowrap text-ink-2">{formatUsd(flat)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
      <p className="m-0 text-00 text-ink-3 measure">
        Each request carries a {ROUTER_PREFIX_TOKENS}-token system prompt; prices are list rates without caching or batching. A router only saves money if the cheaper model is good enough for the traffic it gets: check quality on your own evaluation set before shipping one.
      </p>
    </div>
  )
}
