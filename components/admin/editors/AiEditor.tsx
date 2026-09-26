'use client'
/**
 * AI providers + limits. The router order is fixed (groq -> gemini -> deepseek
 * -> in-browser fallback); this editor only switches providers and tunes caps.
 * The live status comes from /api/ai/status, which says whether each key is
 * configured on this deployment (keys themselves never reach the browser).
 */
import { useEffect, useState } from 'react'
import { ArrowRight, CircleDollarSign } from 'lucide-react'
import { Badge, type Tone } from '@/components/ui'
import { getAiStatus, type AiStatus } from '@/lib/ai'
import { PROVIDER_IDS, type Ai, type ProviderId } from '@/lib/content/schema'
import { cx } from '@/lib/utils'
import { useEditor } from '../EditorContext'
import { ToggleField } from '../fields/Choice'
import { FieldGrid, Group } from '../fields/Group'
import { NumberField, TextField } from '../fields/Text'

const NAMES: Record<ProviderId, { label: string; note: string }> = {
  groq: { label: 'Groq', note: 'Free tier. First in line.' },
  gemini: { label: 'Gemini', note: 'Free tier. Used when Groq is rate-limited or down.' },
  deepseek: { label: 'DeepSeek', note: 'Paid. Hard max_tokens and a per-instance token budget.' },
}

const STATE: Record<string, { label: string; tone: Tone }> = {
  ready: { label: 'Ready', tone: 'ok' },
  off: { label: 'Off', tone: 'neutral' },
  'no-key': { label: 'No key', tone: 'warn' },
  cooling: { label: 'Cooling down', tone: 'warn' },
  budget: { label: 'Budget spent', tone: 'danger' },
}

export function AiEditor() {
  const ed = useEditor()
  const data = ed.data as Ai
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [statusError, setStatusError] = useState(false)

  useEffect(() => {
    let alive = true
    getAiStatus().then((s) => alive && setStatus(s)).catch(() => alive && setStatusError(true))
    return () => { alive = false }
  }, [])

  const live = (id: ProviderId) => status?.providers.find((p) => p.id === id)

  return (
    <>
      <Group title="Router" description="Requests try each enabled provider in this order, then fall back to an in-browser model or a polite “demo quota reached”.">
        <ol className="m-0 p-0 list-none flex flex-wrap items-center gap-2" aria-label="Provider order">
          {PROVIDER_IDS.map((id, i) => (
            <li key={id} className="flex items-center gap-2">
              <span className={cx('inline-flex items-center gap-2 min-h-tap px-3 border rounded-pill text-0', data.providers[id].enabled ? 'border-rule bg-surface' : 'border-rule-soft bg-bg-2 text-ink-3 line-through')}>
                <span className="mono text-ink-3 no-underline">{i + 1}</span>{NAMES[id].label}
              </span>
              <ArrowRight aria-hidden="true" size={16} strokeWidth={1.5} className="text-ink-3" />
            </li>
          ))}
          <li className={cx('inline-flex items-center min-h-tap px-3 border border-dashed rounded-pill text-0', data.browserFallback ? 'border-rule' : 'border-rule-soft text-ink-3 line-through')}>In-browser</li>
        </ol>
        {statusError ? <p className="m-0 text-00 text-ink-3">Live status unavailable (the AI gateway did not answer). Settings still save.</p> : null}
      </Group>

      {PROVIDER_IDS.map((id, i) => {
        const p = live(id)
        const state = p?.state ? STATE[p.state] : undefined
        return (
          <Group
            key={id}
            title={`${i + 1}. ${NAMES[id].label}`}
            description={NAMES[id].note}
            layer={((i % 3) + 1) as 1 | 2 | 3}
            aside={
              <div className="flex flex-wrap gap-1">
                {id === 'deepseek' ? <Badge tone="warn"><CircleDollarSign aria-hidden="true" size={13} strokeWidth={1.5} />Paid</Badge> : null}
                {p ? <Badge tone={p.configured ? 'ok' : 'warn'}>{p.configured ? 'Key set' : 'No key'}</Badge> : null}
                {state ? <Badge tone={state.tone}>Live: {state.label}{p?.retryInSec ? ` (${p.retryInSec}s)` : ''}</Badge> : null}
              </div>
            }
          >
            <ToggleField
              path={['providers', id, 'enabled']}
              label={`Use ${NAMES[id].label}`}
              hint={id === 'deepseek' && data.providers.deepseek.enabled ? 'DeepSeek costs money per token. Keep the budget below low.' : undefined}
            />
            <FieldGrid>
              <TextField path={['providers', id, 'model']} label="Text model" mono hint="Comma-separate alternates; the router tries them in order (e.g. “gemini-3.8-flash, gemini-3.5-flash-lite”)." />
              <TextField path={['providers', id, 'visionModel']} label="Vision model" optional mono hint="Comma-separate alternates; the router tries them in order (e.g. “gemini-3.8-flash, gemini-3.5-flash-lite”). Empty = no image input on this provider." />
            </FieldGrid>
          </Group>
        )
      })}

      <Group title="Limits" description="Enforced on the server for every AI demo." layer={4}>
        <FieldGrid>
          <NumberField path={['maxTokens']} label="Max output tokens per request" min={16} max={4096} step={16} slider unit="tok" />
          <NumberField path={['perIpPerMinute']} label="Requests per IP per minute" min={1} max={120} slider />
          <NumberField path={['maxInputChars']} label="Max input characters" min={100} max={60000} step={100} slider unit="chars" />
          <NumberField path={['deepseekBudgetTokens']} label="DeepSeek budget per instance" min={0} step={1000} unit="tok"
            hint="Input + output tokens; DeepSeek switches off for the instance once spent." />
        </FieldGrid>
        <ToggleField path={['browserFallback']} label="Allow in-browser fallback" hint="When every provider is out, demos may run a small model in the visitor’s browser instead." />
      </Group>
    </>
  )
}
