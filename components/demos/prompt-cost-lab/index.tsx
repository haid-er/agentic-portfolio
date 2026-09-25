'use client'
/**
 * Prompt cost lab: estimate tokens offline, price a workload on every model, see what
 * prompt caching and the batch tier save, and design a first-match model router.
 * An optional calibration call through the lib/ai gateway returns a real input-token count.
 */
import { useMemo, useState } from 'react'
import { Button, DemoGrid, DemoPanel, ErrorState, Segmented, Textarea } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { aiErrorMessage, generateText, type AiTextResult } from '@/lib/ai'
import type { DemoProps } from '@/lib/demos/types'
import { useLocalStorage } from '@/lib/hooks'
import { cx } from '@/lib/utils'
import { formatUsd, type Workload } from './cost'
import { CostTable, Savings } from './CostViews'
import { PRESETS } from './presets'
import { applyOverrides, MODELS, PROVIDERS, type PriceOverrides, type ProviderId } from './prices'
import { PriceSheet } from './PriceSheet'
import { RouterLab } from './RouterLab'
import { estimateTokens } from './tokens'
import { TokenView } from './TokenView'

export { notes } from './notes'

const MAX_CHARS = 20000
/** The gateway's own input cap (content/ai.json maxInputChars default). */
const CALIBRATE_MAX_CHARS = 12000
type ProviderFilter = ProviderId | 'all'
type Calib = { state: 'idle' } | { state: 'busy' } | { state: 'done'; res: AiTextResult; estimate: number } | { state: 'error'; message: string }

export default function Demo({ slug }: DemoProps) {
  const first = PRESETS[0]
  const [presetId, setPresetId] = useState(first.id)
  const [system, setSystem] = useState(first.system)
  const [user, setUser] = useState(first.user)
  const [outputTokens, setOutputTokens] = useState(first.outputTokens)
  const [requestsPerDay, setRequestsPerDay] = useState(first.requestsPerDay)
  const [cacheHit, setCacheHit] = useState(first.cacheHitRate)
  const [batchShare, setBatchShare] = useState(first.batchShare)
  const [provider, setProvider] = useState<ProviderFilter>('all')
  const [selected, setSelected] = useState('claude-haiku-4-5')
  const [showPieces, setShowPieces] = useState(false)
  const [overrides, setOverrides] = useLocalStorage<PriceOverrides>('prompt-cost-lab:prices', {})
  const [calib, setCalib] = useState<Calib>({ state: 'idle' })

  const prefixTokens = useMemo(() => estimateTokens(system), [system])
  const inputTokens = useMemo(() => estimateTokens(user), [user])
  const models = useMemo(() => applyOverrides(MODELS, overrides), [overrides])
  const shown = provider === 'all' ? models : models.filter((m) => m.provider === provider)
  const selectedModel = models.find((m) => m.id === selected) ?? models[0]

  const workload: Workload = { prefixTokens, inputTokens, outputTokens, requestsPerDay, cacheHitRate: cacheHit, batchShare }

  const loadPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)
    if (!p) return
    setPresetId(id); setSystem(p.system); setUser(p.user); setOutputTokens(p.outputTokens)
    setRequestsPerDay(p.requestsPerDay); setCacheHit(p.cacheHitRate); setBatchShare(p.batchShare); setCalib({ state: 'idle' })
  }

  const tooLongToCalibrate = system.length + user.length > CALIBRATE_MAX_CHARS
  const calibrate = async () => {
    setCalib({ state: 'busy' })
    try {
      const res = await generateText({ demo: slug, system, messages: [{ role: 'user', content: user || '.' }], maxTokens: 8, temperature: 0 })
      setCalib({ state: 'done', res, estimate: prefixTokens + inputTokens })
    } catch (e) {
      setCalib({ state: 'error', message: aiErrorMessage(e) })
    }
  }

  const cheapestList = shown.length ? Math.min(...shown.map((m) => ((prefixTokens + inputTokens) * m.input + outputTokens * m.output) / 1e6)) : 0

  return (
    <div className="grid gap-4">
      <DemoGrid
        aside={
          <>
            <DemoPanel title="Workload" meta="per request">
              <div className="grid gap-4">
                <NumberField label="Output tokens" value={outputTokens} min={0} max={100000} onChange={setOutputTokens} />
                <NumberField label="Requests per day" value={requestsPerDay} min={1} max={10_000_000} onChange={setRequestsPerDay} />
                <Slider label="Prompt-cache hit rate" hint="Share of requests whose static prefix is already cached" value={cacheHit} onChange={setCacheHit} />
                <Slider label="Batch share" hint="Share of requests that can wait up to 24h for the batch tier" value={batchShare} onChange={setBatchShare} />
              </div>
            </DemoPanel>

            <DemoPanel title="Where the savings come from" meta={selectedModel?.id}>
              {selectedModel ? <Savings model={selectedModel} workload={workload} /> : null}
            </DemoPanel>
          </>
        }
      >
        <DemoPanel title="Prompt" meta="token estimate · offline">
          <div className="grid gap-4">
            <Segmented label="Start from" value={presetId} onChange={loadPreset} options={PRESETS.map((p) => ({ value: p.id, label: p.label }))} />
            <Textarea
              label="Static prefix · system prompt, instructions, examples"
              value={system}
              rows={7}
              maxLength={MAX_CHARS}
              onChange={(e) => { setSystem(e.target.value); setCalib({ state: 'idle' }) }}
              hint="Sent unchanged with every request, so it is what prompt caching can reuse."
              className="font-mono text-00"
            />
            <Textarea
              label="Variable input · per request"
              value={user}
              rows={3}
              maxLength={MAX_CHARS}
              onChange={(e) => { setUser(e.target.value); setCalib({ state: 'idle' }) }}
              className="font-mono text-00"
            />

            <dl className="grid grid-cols-3 gap-2 m-0">
              <Stat label="Prefix" value={prefixTokens} />
              <Stat label="Input" value={inputTokens} />
              <Stat label="Output" value={outputTokens} />
            </dl>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" icon={showPieces ? 'minus' : 'plus'} onClick={() => setShowPieces((v) => !v)} aria-expanded={showPieces}>
                {showPieces ? 'Hide token pieces' : 'Show token pieces'}
              </Button>
              <Button size="sm" variant="secondary" icon="pulse" onClick={() => void calibrate()} disabled={calib.state === 'busy' || tooLongToCalibrate || !system.trim()}>
                {calib.state === 'busy' ? 'Counting…' : 'Check with a real model'}
              </Button>
            </div>
            {showPieces ? <TokenView text={`${system}\n\n${user}`} label="Prompt split into estimated token pieces" /> : null}
            <Calibration calib={calib} tooLong={tooLongToCalibrate} />
          </div>
        </DemoPanel>

        <DemoPanel title="Cost per model" meta={`${requestsPerDay.toLocaleString('en-US')} requests/day · 30-day month`}>
          <div className="grid gap-3">
            <Segmented<ProviderFilter>
              label="Providers"
              value={provider}
              onChange={setProvider}
              options={[{ value: 'all', label: 'All' }, ...(Object.keys(PROVIDERS) as ProviderId[]).map((p) => ({ value: p, label: PROVIDERS[p].label }))]}
            />
            <CostTable models={shown} workload={workload} selected={selected} onSelect={setSelected} />
            <p className="m-0 text-00 text-ink-3">
              Cheapest list price here: <span className="nums">{formatUsd(cheapestList)}</span> per request. Tap a model to see its savings breakdown.
            </p>
          </div>
        </DemoPanel>
      </DemoGrid>

      <DemoPanel title="Model router" meta="first match wins">
        <RouterLab models={models} />
      </DemoPanel>

      <DemoPanel title="Price sheet" meta="editable">
        <PriceSheet models={models} overrides={overrides} onChange={setOverrides} />
      </DemoPanel>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid gap-1 p-3 bg-bg-2 rounded-1 min-w-0">
      <dt className="mono text-ink-3">{label}</dt>
      <dd className="m-0 display text-3 nums">≈{value.toLocaleString('en-US')}</dd>
    </div>
  )
}

function Calibration({ calib, tooLong }: { calib: Calib; tooLong: boolean }) {
  if (tooLong) return <p className="m-0 text-00 text-ink-3">The live check accepts up to {CALIBRATE_MAX_CHARS.toLocaleString('en-US')} characters; the offline estimate still works.</p>
  if (calib.state === 'error') {
    return <ErrorState title="The live count did not run">{calib.message} The offline estimate above still stands; nothing is guessed.</ErrorState>
  }
  if (calib.state !== 'done') {
    return (
      <p className="m-0 text-00 text-ink-3">
        The live check sends this prompt through the site&apos;s AI gateway (free providers, rate limited), asks for at most 8 tokens back, and reads the provider&apos;s own input-token count.
      </p>
    )
  }
  const real = calib.res.usage.inputTokens
  const diff = real ? (calib.estimate - real) / real : 0
  return (
    <div className="grid gap-1 p-3 border border-rule-soft rounded-1" role="status">
      <p className="m-0 flex flex-wrap items-center gap-2 text-0">
        <Icon name="check" size={16} className="text-ok" />
        <span><strong className="nums">{real.toLocaleString('en-US')}</strong> input tokens counted by {calib.res.provider} · <span className="font-mono">{calib.res.model}</span></span>
      </p>
      <p className={cx('m-0 text-00 nums', Math.abs(diff) > 0.2 ? 'text-warn' : 'text-ink-2')}>
        Offline estimate {calib.estimate.toLocaleString('en-US')} ({diff >= 0 ? '+' : ''}{Math.round(diff * 100)}%). The real count includes the chat template&apos;s few extra tokens, and each provider tokenizes differently.
      </p>
    </div>
  )
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="grid gap-1">
      <span className="mono text-ink-2">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Math.round(Number(e.target.value) || 0))))}
        className="w-full min-h-tap px-3 py-2 bg-surface text-ink border border-rule rounded-0 nums font-mono"
      />
    </label>
  )
}

function Slider({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="grid gap-1">
      <span className="flex justify-between gap-2 mono text-ink-2"><span>{label}</span><span className="nums text-ink">{Math.round(value * 100)}%</span></span>
      <input type="range" min={0} max={100} step={5} value={Math.round(value * 100)} onChange={(e) => onChange(Number(e.target.value) / 100)} className="w-full min-h-tap accent-[var(--accent)]" />
      <span className="text-00 text-ink-3">{hint}</span>
    </label>
  )
}
