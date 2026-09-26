'use client'
/**
 * Dispatch board: a seeded day of field-service jobs with time windows, four technicians with
 * skills and shifts, and two dispatchers: greedy (one job at a time, earliest start) and an
 * optimiser (best insertion, relocate, swap and 2-opt local search). Routes draw on an SVG map,
 * the day shows as a Gantt, and any assigned job previews its invoice. Everything runs in the tab.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Badge, Button, DemoGrid, DemoPanel, DemoToolbar, EmptyState, Loading, Segmented, Select,
  Table, TableWrap, Td, Th, Tr, useToast,
} from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { useLocalStorage, useReducedMotion } from '@/lib/hooks'
import { cx, seeded } from '@/lib/utils'
import { inkFor } from './ink'
import { Invoice } from './Invoice'
import { MapView } from './MapView'
import {
  clock, greedy, makeDay, makeJob, optimise, whyUnassigned, type Job, type Pin, type Plan,
} from './model'
import { Timeline } from './Timeline'

export { notes } from './notes'

type Mode = 'greedy' | 'optimised'
type Count = '10' | '14' | '18'
const MODES = [{ value: 'greedy', label: 'Greedy' }, { value: 'optimised', label: 'Optimised' }] as const
const COUNTS = [{ value: '10', label: '10 jobs' }, { value: '14', label: '14' }, { value: '18', label: '18' }] as const

export default function Demo(_props: DemoProps) {
  const reduced = useReducedMotion()
  const toast = useToast()
  const [seed, setSeed] = useLocalStorage<number>('dispatch-board:seed', 3)
  const [countRaw, setCount] = useLocalStorage<Count>('dispatch-board:count', '14')
  const count: Count = ['10', '14', '18'].includes(countRaw) ? countRaw : '14'
  const [mode, setMode] = useState<Mode>('greedy')
  const [pins, setPins] = useState<Record<string, Pin>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [added, setAdded] = useState<Job[]>([])
  const [cleared, setCleared] = useState(false)

  const day = useMemo(() => makeDay(seed, Number(count)), [seed, count])
  const techs = day.techs
  const jobs = useMemo(() => (cleared ? added : [...day.jobs, ...added]), [day.jobs, added, cleared])

  const greedyPlan = useMemo(() => greedy(techs, jobs, pins), [techs, jobs, pins])
  // the optimiser runs a beat later so the switch has an honest "working" state
  const solveKey = `${seed}|${count}|${jobs.map((j) => j.id).join(',')}|${JSON.stringify(pins)}`
  const [opt, setOpt] = useState<{ key: string; plan: Plan } | null>(null)
  useEffect(() => {
    const t = setTimeout(() => setOpt({ key: solveKey, plan: optimise(techs, jobs, pins) }), reduced ? 0 : 320)
    return () => clearTimeout(t)
  }, [solveKey, techs, jobs, pins, reduced])
  const optPlan = opt?.key === solveKey ? opt.plan : null
  const plan = mode === 'optimised' ? optPlan : greedyPlan

  const newDay = () => { setSeed((s) => s + 1); setPins({}); setAdded([]); setCleared(false); setSelected(null) }
  const addJob = () => {
    const n = jobs.reduce((m, j) => Math.max(m, Number(j.id.slice(1))), 0) + 1
    setAdded((a) => [...a, makeJob(seeded(seed * 31 + n), n)])
  }
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast('Invoice copied', { tone: 'ok' }) }
    catch { toast('Copy failed: your browser blocked clipboard access', { tone: 'danger' }) }
  }

  const where = new Map<string, number>()
  plan?.routes.forEach((r, ti) => r.stops.forEach((s) => where.set(s.job.id, ti)))
  const selStop = plan?.routes.flatMap((r) => r.stops).find((s) => s.job.id === selected) ?? null
  const selTech = selStop ? plan?.routes.find((r) => r.stops.includes(selStop))?.tech ?? null : null

  if (jobs.length === 0) {
    return (
      <EmptyState title="No jobs on the board"
        action={<DemoToolbar><Button size="sm" onClick={newDay} arrow>Load a sample day</Button><Button size="sm" variant="secondary" icon="plus" onClick={() => { setCleared(true); addJob() }}>Add one job</Button></DemoToolbar>}>
        Every technician is free. Load a seeded day or add a job to start dispatching.
      </EmptyState>
    )
  }

  return (
    <div className="grid gap-4 min-w-0">
      <DemoToolbar>
        <Segmented label="Dispatcher" options={MODES} value={mode} onChange={setMode} />
        <Segmented label="Jobs today" options={COUNTS} value={count} onChange={(v) => { setCount(v); setPins({}); setAdded([]); setCleared(false); setSelected(null) }} />
        <Button size="sm" variant="secondary" icon="refresh" onClick={newDay}>New day</Button>
        <Button size="sm" variant="secondary" icon="plus" onClick={addJob}>Add job</Button>
        <Button size="sm" variant="ghost" onClick={() => { setCleared(true); setAdded([]); setPins({}); setSelected(null) }}>Clear</Button>
      </DemoToolbar>

      <DemoGrid
        aside={
          <>
            <DemoPanel title="Greedy vs optimised" meta={<span className="nums">seed {seed}</span>}>
              <Compare greedyPlan={greedyPlan} optPlan={optPlan} mode={mode} total={jobs.filter((j) => pins[j.id] !== 'hold').length} />
            </DemoPanel>
            <DemoPanel title="Invoice preview" meta={selStop?.job.id}>
              <Invoice stop={selStop} tech={selTech} onCopy={copy} />
            </DemoPanel>
          </>
        }
      >
        <DemoPanel title="Service area" meta={plan ? `${plan.assigned}/${jobs.length} assigned · ${plan.km.toFixed(1)} km` : undefined}>
          {plan ? (
            <div className="grid gap-3">
              <MapView techs={techs} jobs={jobs} plan={plan} selected={selected} onSelect={setSelected}
                animate={!reduced} drawKey={`${mode}-${solveKey}`} />
              <ul className="m-0 p-0 list-none flex flex-wrap gap-x-4 gap-y-1 text-00" aria-label="Technicians">
                {techs.map((t, i) => (
                  <li key={t.id} className="flex items-center gap-1">
                    <span aria-hidden="true" className={cx('inline-block size-3 border border-ink', inkFor(i).bg)} />
                    <span className="font-mono">{t.id} {t.name}</span>
                    <span className="text-ink-3">{t.skills.join(' + ')} · {clock(t.shiftStart)}–{clock(t.shiftEnd)}</span>
                  </li>
                ))}
                <li className="flex items-center gap-1 text-ink-3"><span aria-hidden="true" className="inline-block size-3 border border-dashed border-ink" /> unassigned</li>
                <li className="flex items-center gap-1 text-ink-3"><span aria-hidden="true" className="inline-block size-2 rounded-pill bg-danger" /> urgent</li>
              </ul>
            </div>
          ) : (
            <Loading label="Optimising routes" className="min-h-40" />
          )}
        </DemoPanel>

        <DemoPanel title="Day plan" meta="07:00–19:00">
          {plan ? <Timeline plan={plan} selected={selected} onSelect={setSelected} /> : <Loading label="Optimising routes" />}
          {plan && plan.unassigned.length > 0 ? (
            <div className="mt-3 p-3 border border-warn rounded-1" role="status">
              <p className="m-0 flex items-center gap-2 font-semibold text-warn">
                <Badge tone="warn">{plan.unassigned.length} unassigned</Badge>
                {mode === 'greedy' && optPlan && optPlan.unassigned.length < plan.unassigned.length ? <span className="text-0 font-normal text-ink-2">The optimiser fits more. Switch to Optimised.</span> : null}
              </p>
              <ul className="m-0 mt-2 pl-5 text-0 text-ink-2 grid gap-1">
                {plan.unassigned.map((j) => <li key={j.id}><span className="font-mono">{j.id}</span>: {whyUnassigned(j, techs)}</li>)}
              </ul>
            </div>
          ) : null}
        </DemoPanel>

        <DemoPanel title="Jobs" meta="pin a job to override the dispatcher">
          <TableWrap label="Jobs today">
            <Table>
              <thead><Tr><Th>Job</Th><Th>Skill</Th><Th>Window</Th><Th>Assign</Th><Th>Status</Th></Tr></thead>
              <tbody>
                {[...jobs].sort((a, b) => a.windowStart - b.windowStart || a.id.localeCompare(b.id)).map((j) => {
                  const ti = where.get(j.id)
                  const stop = plan?.routes.flatMap((r) => r.stops).find((s) => s.job.id === j.id)
                  const pin = pins[j.id] ?? 'auto'
                  return (
                    <Tr key={j.id} className={cx(selected === j.id && 'bg-bg-2')}>
                      <Td>
                        <button type="button" onClick={() => setSelected(j.id)} aria-pressed={selected === j.id}
                          className="min-h-tap text-left font-mono underline decoration-1 decoration-accent-ink underline-offset-2">
                          {j.id}{j.urgent ? <span className="text-danger"> · urgent</span> : null}
                        </button>
                        <p className="m-0 text-00 text-ink-3 max-w-[16rem] truncate">{j.task}</p>
                      </Td>
                      <Td>{j.skill}</Td>
                      <Td className="whitespace-nowrap">{clock(j.windowStart)}–{clock(j.windowEnd)}</Td>
                      <Td>
                        <Select label={`Assign ${j.id}`} hideLabel value={pin} wrapperClassName="relative min-w-[8.5rem]"
                          onChange={(e) => setPins((p) => ({ ...p, [j.id]: e.target.value }))}>
                          <option value="auto">Auto</option>
                          {techs.map((t) => <option key={t.id} value={t.id}>{t.name}{t.skills.includes(j.skill) ? '' : ' (no skill)'}</option>)}
                          <option value="hold">Hold</option>
                        </Select>
                      </Td>
                      <Td className="whitespace-nowrap">
                        {pin === 'hold' ? <Badge>on hold</Badge>
                          : stop && ti !== undefined ? (
                            <span className="flex flex-wrap items-center gap-1">
                              <span className="font-mono">{techs[ti]?.name} {clock(stop.start)}</span>
                              {stop.late > 0 ? <Badge tone="danger">late {Math.round(stop.late)}m</Badge> : null}
                              {techs[ti]?.skills.includes(j.skill) ? null : <Badge tone="danger">skill gap</Badge>}
                            </span>
                          ) : plan ? <Badge tone="warn">unassigned</Badge> : <span className="text-ink-3">…</span>}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
          </TableWrap>
        </DemoPanel>
      </DemoGrid>
    </div>
  )
}

function Compare({ greedyPlan, optPlan, mode, total }: { greedyPlan: Plan; optPlan: Plan | null; mode: Mode; total: number }) {
  const rows: Array<{ label: string; get: (p: Plan) => string; better: (a: Plan, b: Plan) => boolean }> = [
    { label: 'Assigned', get: (p) => `${p.assigned}/${total}`, better: (a, b) => a.assigned > b.assigned },
    { label: 'Drive', get: (p) => `${p.km.toFixed(1)} km`, better: (a, b) => a.km < b.km - 0.05 },
    { label: 'Waiting', get: (p) => `${Math.round(p.routes.reduce((s, r) => s + r.waitMin, 0))} min`, better: (a, b) => a.routes.reduce((s, r) => s + r.waitMin, 0) < b.routes.reduce((s, r) => s + r.waitMin, 0) - 1 },
    { label: 'On time', get: (p) => `${p.onTime}/${p.assigned}`, better: (a, b) => a.onTime / Math.max(1, a.assigned) > b.onTime / Math.max(1, b.assigned) },
    { label: 'Cost score', get: (p) => Math.round(p.cost).toString(), better: (a, b) => a.cost < b.cost - 0.5 },
  ]
  return (
    <div className="grid gap-3">
      <TableWrap label="Dispatcher comparison">
        <Table>
          <thead><Tr><Th>Metric</Th><Th className={cx(mode === 'greedy' && 'text-ink')}>Greedy</Th><Th className={cx(mode === 'optimised' && 'text-ink')}>Optimised</Th></Tr></thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.label}>
                <Td className="text-ink-2">{r.label}</Td>
                <Td>{r.get(greedyPlan)}</Td>
                <Td className={cx(optPlan && r.better(optPlan, greedyPlan) && 'font-semibold text-accent')}>
                  {optPlan ? r.get(optPlan) : '…'}
                  {optPlan && r.better(optPlan, greedyPlan) ? <span className="sr-only"> (better)</span> : null}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
      {optPlan && optPlan.history.length > 1 ? <Convergence history={optPlan.history} /> : optPlan ? <p className="m-0 text-00 text-ink-3">Greedy was already locally optimal for this day.</p> : null}
      <p className="m-0 text-00 text-ink-3">Cost = drive minutes + ¼ of waiting + heavy penalties for lateness, overtime and unassigned jobs.</p>
    </div>
  )
}

function Convergence({ history }: { history: number[] }) {
  const max = Math.max(...history)
  const min = Math.min(...history)
  const w = 200
  const h = 44
  // high cost at the top, so improvement reads downward
  const pts = history
    .map((c, i) => `${((i / Math.max(1, history.length - 1)) * w).toFixed(1)},${(4 + (1 - (c - min) / Math.max(1, max - min)) * (h - 8)).toFixed(1)}`)
    .join(' ')
  return (
    <figure className="m-0 grid gap-1">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" role="img" aria-label={`Cost fell from ${Math.round(max)} to ${Math.round(min)} over ${history.length - 1} improving moves`}>
        <line x1={0} y1={h - 0.5} x2={w} y2={h - 0.5} className="stroke-rule-soft" />
        <polyline points={pts} className="fill-none stroke-accent" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="mono text-ink-3">{history.length - 1} improving moves · {Math.round(max)} → {Math.round(min)}</figcaption>
    </figure>
  )
}
