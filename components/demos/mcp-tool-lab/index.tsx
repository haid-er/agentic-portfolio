'use client'
/**
 * MCP tool lab: a host, an in-browser MCP server with four JSON-schema tools, and a model
 * (through the lib/ai gateway) that decides which tools to call. Every JSON-RPC message is
 * logged. With no model available, a rules router picks the tools instead (labelled).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Badge, Button, DemoGrid, DemoPanel, EmptyState, Segmented, Textarea } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { AiError, aiErrorMessage, generateText, isQuotaError, type AiMessage, type AiMeta, type AiToolDef } from '@/lib/ai'
import type { DemoProps } from '@/lib/demos/types'
import { useLocalStorage } from '@/lib/hooks'
import { cx } from '@/lib/utils'
import { LogView } from './LogView'
import { handle, listTools, PROTOCOL_VERSION, type JsonRpcRequest, type JsonRpcResponse, type LogEntry, type ToolConfig } from './mcp'
import { routeOffline } from './router'
import { ToolCard, type TryState } from './ToolCard'
import { TOOLS } from './tools'

export { notes } from './notes'

type Mode = 'model' | 'router'
const MAX_TURNS = 4
const MAX_PROMPT = 400

const PRESETS = [
  'What is 17.5% of 2,340, plus the square root of 1,764?',
  'Will it rain in Lahore tomorrow? Give the max temperature in Fahrenheit.',
  'Convert 42.195 km to miles, then find demos about message queues on this site.',
  'Compare today’s max temperature in London and Karachi, and give the difference.',
]

const SYSTEM = [
  'You are the host model in an MCP (Model Context Protocol) tool-calling demo.',
  'Call the provided tools whenever they can answer part of the request: arithmetic goes to calculator, weather to get_weather, unit changes to convert_units, and anything about this portfolio or its owner to search_site. You may call several tools at once.',
  'Never guess a tool result. When tool results arrive, answer in at most 5 short sentences and name the tool behind each fact. If a tool returned an error, say what failed.',
].join('\n')

type CallView = { id: string; name: string; arguments: unknown; why?: string }
type Step =
  | { kind: 'user'; text: string }
  | { kind: 'decision'; by: 'model' | 'router'; calls: CallView[]; text?: string; meta?: AiMeta }
  | { kind: 'result'; id: string; name: string; isError: boolean; text: string; ms: number }
  | { kind: 'final'; by: 'model' | 'router'; text: string; meta?: AiMeta }
  | { kind: 'note'; tone: 'warn' | 'danger' | 'info'; text: string }

const defaultConfig = (): Record<string, ToolConfig> =>
  Object.fromEntries(TOOLS.map((t) => [t.name, { enabled: true, description: t.description, inputSchema: t.inputSchema }]))

/** Merge stored overrides onto defaults, ignoring anything malformed. */
function normalize(saved: unknown): Record<string, ToolConfig> {
  const base = defaultConfig()
  if (!saved || typeof saved !== 'object') return base
  for (const t of TOOLS) {
    const s = (saved as Record<string, Partial<ToolConfig>>)[t.name]
    if (!s) continue
    base[t.name] = {
      enabled: typeof s.enabled === 'boolean' ? s.enabled : true,
      description: typeof s.description === 'string' && s.description.trim() ? s.description.slice(0, 600) : t.description,
      inputSchema: s.inputSchema && typeof s.inputSchema === 'object' && (s.inputSchema as { type?: unknown }).type === 'object' ? s.inputSchema : t.inputSchema,
    }
  }
  return base
}

const textOf = (r: JsonRpcResponse): { text: string; isError: boolean } => {
  if ('error' in r) return { text: `JSON-RPC error ${r.error.code}: ${r.error.message}`, isError: true }
  const content = (r.result.content as Array<{ text?: string }> | undefined) ?? []
  return { text: content.map((c) => c.text ?? '').join('\n'), isError: Boolean(r.result.isError) }
}

const fmtArgs = (a: unknown) => { try { return JSON.stringify(a) } catch { return String(a) } }

export default function Demo({ slug }: DemoProps) {
  const [saved, setSaved] = useLocalStorage<Record<string, ToolConfig> | null>('mcp-tool-lab:tools', null)
  const config = useMemo(() => normalize(saved), [saved])
  const [prompt, setPrompt] = useState(PRESETS[0] ?? '')
  const [mode, setMode] = useState<Mode>('model')
  const [steps, setSteps] = useState<Step[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [tries, setTries] = useState<Record<string, TryState>>({})

  const t0 = useRef<number | null>(null)
  const seq = useRef(0)
  const rpcSeq = useRef(0)
  const session = useRef<{ initialized: boolean; listedSig: string | null }>({ initialized: false, listedSig: null })
  const ctrl = useRef<AbortController | null>(null)
  const configRef = useRef(config)
  configRef.current = config

  const sig = JSON.stringify(listTools(config, TOOLS))
  const enabledCount = TOOLS.filter((t) => config[t.name]?.enabled).length

  useEffect(() => () => ctrl.current?.abort(), [])

  const add = useCallback((e: Omit<LogEntry, 'seq' | 't'>) => {
    const now = performance.now()
    t0.current ??= now
    const entry: LogEntry = { ...e, seq: ++seq.current, t: Math.round(now - t0.current) }
    setLog((l) => [...l.slice(-199), entry])
  }, [])

  // The server tells a connected host when its tool list changed (edits, toggles).
  const lastSig = useRef(sig)
  useEffect(() => {
    if (lastSig.current === sig) return
    lastSig.current = sig
    if (!session.current.initialized) return
    add({ from: 'server', to: 'host', kind: 'notification', method: 'notifications/tools/list_changed', summary: 'Tool list changed: the host will re-list before the next call', payload: { jsonrpc: '2.0', method: 'notifications/tools/list_changed' } })
  }, [sig, add])

  const rpc = useCallback(async (method: string, params: Record<string, unknown> | undefined, signal: AbortSignal, summary: string) => {
    const req: JsonRpcRequest = { jsonrpc: '2.0', id: ++rpcSeq.current, method, ...(params ? { params } : {}) }
    add({ from: 'host', to: 'server', kind: 'request', method, rpcId: req.id, summary, payload: req })
    const start = performance.now()
    const res = await handle(req, { config: configRef.current, specs: TOOLS, signal })
    const ms = Math.round(performance.now() - start)
    const out = textOf(res)
    add({
      from: 'server', to: 'host', kind: 'error' in res ? 'error' : 'response', method, rpcId: req.id, ms,
      summary: method === 'tools/call' ? `${out.isError ? 'isError: ' : ''}${out.text.split('\n')[0] ?? ''}` : method === 'tools/list' ? `${((res as { result?: { tools?: unknown[] } }).result?.tools ?? []).length} tools` : 'ok',
      payload: res,
    })
    return { res, ms, ...out }
  }, [add])

  const ensureSession = useCallback(async (signal: AbortSignal) => {
    const s = session.current
    if (!s.initialized) {
      await rpc('initialize', { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'tool-lab-host', version: '1.0.0' } }, signal, 'Handshake: protocol version + capabilities')
      add({ from: 'host', to: 'server', kind: 'notification', method: 'notifications/initialized', summary: 'Host is ready', payload: { jsonrpc: '2.0', method: 'notifications/initialized' } })
      s.initialized = true
    }
    const cur = JSON.stringify(listTools(configRef.current, TOOLS))
    if (s.listedSig !== cur) {
      await rpc('tools/list', {}, signal, 'Discover tools and their JSON schemas')
      s.listedSig = cur
    }
    return listTools(configRef.current, TOOLS)
  }, [add, rpc])

  const callTools = async (calls: CallView[], signal: AbortSignal) => {
    const results = await Promise.all(calls.map(async (c) => {
      const r = await rpc('tools/call', { name: c.name, arguments: c.arguments ?? {} }, signal, `${c.name}(${fmtArgs(c.arguments)})`)
      return { call: c, ...r }
    }))
    setSteps((s) => [...s, ...results.map((r): Step => ({ kind: 'result', id: r.call.id, name: r.call.name, isError: r.isError, text: r.text, ms: r.ms }))])
    return results
  }

  const runRouter = async (text: string, signal: AbortSignal) => {
    await ensureSession(signal)
    const enabled = new Set(TOOLS.filter((t) => configRef.current[t.name]?.enabled).map((t) => t.name))
    add({ from: 'host', to: 'router', kind: 'request', method: 'route', summary: 'Rules pick tools (no model)', payload: { prompt: text, tools: [...enabled] } })
    const planned = routeOffline(text, enabled)
    add({ from: 'router', to: 'host', kind: 'response', method: 'route', summary: planned.length ? planned.map((p) => p.name).join(', ') : 'no tool matched', payload: planned })
    const calls: CallView[] = planned.map((p, i) => ({ id: `r${i}`, name: p.name, arguments: p.arguments, why: p.why }))
    setSteps((s) => [...s, { kind: 'decision', by: 'router', calls }])
    if (!calls.length) {
      setSteps((s) => [...s, { kind: 'final', by: 'router', text: 'No rule matched and no model is in the loop, so no tool was called. Try one of the example prompts, or switch to “Model chooses”.' }])
      return
    }
    const results = await callTools(calls, signal)
    setSteps((s) => [...s, { kind: 'final', by: 'router', text: results.map((r) => `${r.call.name}: ${r.text}`).join('\n\n') }])
  }

  const runModel = async (text: string, signal: AbortSignal) => {
    const listed = await ensureSession(signal)
    const tools: AiToolDef[] = listed.map((t) => ({ name: t.name, description: t.description, parameters: t.inputSchema }))
    const messages: AiMessage[] = [{ role: 'user', content: text }]
    let calledAny = false
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const offer = turn < MAX_TURNS - 1 && tools.length ? tools : undefined
      add({ from: 'host', to: 'model', kind: 'request', method: 'chat', summary: `${messages.length} message${messages.length === 1 ? '' : 's'} · ${offer?.length ?? 0} tools offered`, payload: { system: SYSTEM, messages, tools: offer?.map((t) => t.name) ?? [] } })
      let res
      try {
        res = await generateText({ demo: slug, system: SYSTEM, messages, tools: offer, maxTokens: 450, temperature: 0 }, { signal })
      } catch (e) {
        const err = e instanceof AiError ? e : new AiError('upstream', String(e))
        if (err.code === 'aborted') throw err
        add({ from: 'model', to: 'host', kind: 'error', method: 'chat', summary: aiErrorMessage(err), payload: { code: err.code, message: err.message } })
        if (turn === 0 && !calledAny) {
          setSteps((s) => [...s, { kind: 'note', tone: 'warn', text: `${aiErrorMessage(err)} ${isQuotaError(err) ? 'Falling back to the offline rules router, so the MCP side still runs for real.' : 'Falling back to the offline rules router.'}` }])
          await runRouter(text, signal)
        } else {
          setSteps((s) => [...s, { kind: 'note', tone: 'danger', text: `${aiErrorMessage(err)} The tool results above are real; the model could not write the final answer.` }])
        }
        return
      }
      const calls = (res.toolCalls ?? []).map((c, i): CallView => ({ id: c.id || `c${turn}-${i}`, name: c.name, arguments: c.arguments }))
      add({
        from: 'model', to: 'host', kind: 'response', method: 'chat', ms: res.latencyMs,
        summary: calls.length ? `tool_calls: ${calls.map((c) => c.name).join(', ')}` : `answer (${res.text.length} chars) · ${res.provider}`,
        payload: { provider: res.provider, model: res.model, usage: res.usage, text: res.text, toolCalls: res.toolCalls ?? [] },
      })
      if (!calls.length) {
        setSteps((s) => [...s, { kind: 'final', by: 'model', text: res.text.trim() || '(The model returned an empty answer.)', meta: res }])
        return
      }
      calledAny = true
      setSteps((s) => [...s, { kind: 'decision', by: 'model', calls, text: res.text.trim() || undefined, meta: res }])
      const results = await callTools(calls, signal)
      messages.push({ role: 'assistant', content: `${res.text.trim() ? `${res.text.trim()}\n` : ''}Calling tools: ${calls.map((c) => `${c.name}(${fmtArgs(c.arguments)})`).join(', ')}` })
      messages.push({
        role: 'user',
        content: `Tool results (MCP tools/call):\n${results.map((r) => `- ${r.call.name}(${fmtArgs(r.call.arguments)}) ${r.isError ? 'ERROR' : 'OK'}: ${r.text.slice(0, 800)}`).join('\n')}\n\nAnswer my original request with these results, or call another tool if something is still missing.`,
      })
    }
    setSteps((s) => [...s, { kind: 'note', tone: 'info', text: `Stopped after ${MAX_TURNS} model turns (the host caps the loop).` }])
  }

  const run = async (e?: FormEvent) => {
    e?.preventDefault()
    const text = prompt.trim().slice(0, MAX_PROMPT)
    if (!text || busy) return
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    setBusy(true)
    setSteps([{ kind: 'user', text }])
    try {
      if (mode === 'router') await runRouter(text, c.signal)
      else await runModel(text, c.signal)
    } catch (err) {
      const aborted = (err instanceof AiError && err.code === 'aborted') || (err instanceof DOMException && err.name === 'AbortError')
      setSteps((s) => [...s, aborted ? { kind: 'note', tone: 'info', text: 'Stopped.' } : { kind: 'note', tone: 'danger', text: `The run failed: ${err instanceof Error ? err.message : String(err)}` }])
    } finally {
      if (ctrl.current === c) ctrl.current = null
      setBusy(false)
    }
  }

  const tryTool = async (name: string) => {
    const spec = TOOLS.find((t) => t.name === name)
    if (!spec) return
    const c = new AbortController()
    setTries((t) => ({ ...t, [name]: { busy: true } }))
    try {
      await ensureSession(c.signal)
      const r = await rpc('tools/call', { name, arguments: spec.example }, c.signal, `${name}(${fmtArgs(spec.example)}) · direct call, no model`)
      setTries((t) => ({ ...t, [name]: { busy: false, text: r.text, isError: r.isError } }))
    } catch (err) {
      setTries((t) => ({ ...t, [name]: { busy: false, text: err instanceof Error ? err.message : String(err), isError: true } }))
    }
  }

  const setTool = (name: string, next: ToolConfig) => setSaved({ ...config, [name]: next })

  const clearLog = () => {
    setLog([])
    t0.current = null
    session.current = { initialized: false, listedSig: null }
  }

  return (
    <DemoGrid
      aside={
        <DemoPanel title="MCP server · tools" meta={`${enabledCount}/${TOOLS.length} enabled`}>
          <ul className="m-0 p-0 list-none grid gap-3">
            {TOOLS.map((t) => (
              <ToolCard
                key={t.name}
                spec={t}
                config={config[t.name] as ToolConfig}
                onChange={(next) => setTool(t.name, next)}
                onTry={() => void tryTool(t.name)}
                tryState={tries[t.name]}
                disabled={busy}
              />
            ))}
          </ul>
        </DemoPanel>
      }
    >
      <DemoPanel title="Host" meta={mode === 'model' ? 'Model chooses tools' : 'Offline rules router'}>
        <form onSubmit={(e) => void run(e)} className="grid gap-3">
          <Textarea
            label="Request"
            rows={3}
            value={prompt}
            maxLength={MAX_PROMPT}
            onChange={(e) => setPrompt(e.target.value)}
            hint={`${prompt.length}/${MAX_PROMPT} characters`}
          />
          <div className="flex flex-wrap gap-2" aria-label="Example requests">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrompt(p)}
                className={cx('min-h-tap px-3 py-2 text-left text-00 border rounded-pill bg-bg-2 hover:border-accent', prompt === p ? 'border-accent text-accent-ink' : 'border-rule-soft text-ink-2')}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Segmented<Mode>
              label="Who picks the tools"
              value={mode}
              onChange={setMode}
              options={[{ value: 'model', label: 'Model chooses' }, { value: 'router', label: 'Offline router' }]}
            />
            {busy ? (
              <Button variant="secondary" icon="pause" onClick={() => ctrl.current?.abort()}>Stop</Button>
            ) : (
              <Button type="submit" arrow disabled={!prompt.trim() || enabledCount === 0}>Run</Button>
            )}
          </div>
          {enabledCount === 0 ? <p className="m-0 text-0 text-warn">Every tool is switched off. Enable at least one.</p> : null}
        </form>
      </DemoPanel>

      <DemoPanel title="Trace" meta={busy ? 'running…' : steps.length ? `${steps.filter((s) => s.kind === 'result').length} tool calls` : undefined}>
        <div aria-live="polite" aria-busy={busy}>
          {steps.length === 0 ? (
            <EmptyState title="Nothing has run yet">
              Pick an example and press Run. You will see what the model decided, each tools/call, and the answer built from the results.
            </EmptyState>
          ) : (
            <ol className="m-0 p-0 list-none grid gap-3">
              {steps.map((s, i) => <StepView key={i} step={s} />)}
              {busy ? <li className="mono text-ink-3" role="status">Working…</li> : null}
            </ol>
          )}
        </div>
      </DemoPanel>

      <DemoPanel title="Protocol log" meta={`${log.length} messages · JSON-RPC 2.0`}>
        <LogView entries={log} onClear={clearLog} />
      </DemoPanel>
    </DemoGrid>
  )
}

function StepView({ step }: { step: Step }) {
  switch (step.kind) {
    case 'user':
      return (
        <li className="flex justify-end">
          <p className="m-0 max-w-[90%] px-4 py-2 bg-ink text-bg almanac:text-on-accent rounded-2 [overflow-wrap:anywhere]"><span className="sr-only">Request: </span>{step.text}</p>
        </li>
      )
    case 'decision':
      return (
        <li className="grid gap-2 p-3 border border-rule-soft rounded-1 bg-bg-2">
          <p className="m-0 flex flex-wrap items-center gap-2 mono text-ink-2">
            <Icon name="nodes" size={16} className="text-accent-ink" />
            {step.by === 'model' ? 'Model chose' : 'Rules router chose'} {step.calls.length} tool call{step.calls.length === 1 ? '' : 's'}
            {step.by === 'router' ? <Badge tone="warn">no model</Badge> : null}
          </p>
          {step.text ? <p className="m-0 text-0 text-ink-2 italic">{step.text}</p> : null}
          <ul className="m-0 p-0 list-none grid gap-1">
            {step.calls.map((c) => (
              <li key={c.id} className="grid gap-[2px] min-w-0">
                <code className="font-mono text-0 text-ink [overflow-wrap:anywhere]"><span className="text-accent-ink">{c.name}</span>({fmtArgs(c.arguments)})</code>
                {c.why ? <span className="text-00 text-ink-3">because {c.why}</span> : null}
              </li>
            ))}
          </ul>
        </li>
      )
    case 'result':
      return (
        <li className={cx('grid gap-1 p-3 border-l-4 rounded-0 bg-surface', step.isError ? 'border-danger' : 'border-ok')}>
          <p className="m-0 flex flex-wrap items-center gap-2 font-mono text-00 uppercase tracking-[.06em] text-ink-2">
            <Icon name={step.isError ? 'alert' : 'check'} size={14} className={step.isError ? 'text-danger' : 'text-ok'} />
            {step.name} {step.isError ? 'returned an error' : 'result'} <span className="nums text-ink-3 normal-case">{step.ms} ms</span>
          </p>
          <pre className="m-0 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-00 leading-[1.5] text-ink [overflow-wrap:anywhere]">{step.text}</pre>
        </li>
      )
    case 'final':
      return (
        <li className="grid gap-2 p-4 border border-rule rounded-2 bg-surface strata:border-rule-soft">
          <p className="m-0 flex flex-wrap items-center gap-2 mono text-ink-2">
            Answer
            {step.by === 'router' ? <Badge tone="warn">tool output, no model wrote this</Badge> : null}
          </p>
          <p className="m-0 whitespace-pre-wrap text-1 [overflow-wrap:anywhere]">{step.text}</p>
          {step.meta ? <p className="m-0 font-mono text-00 text-ink-3">{step.meta.provider} · {step.meta.model} · {(step.meta.latencyMs / 1000).toFixed(1)} s</p> : null}
        </li>
      )
    case 'note':
      return (
        <li className={cx('flex items-start gap-2 text-0', step.tone === 'danger' ? 'text-danger' : 'text-ink-2')} role={step.tone === 'danger' ? 'alert' : undefined}>
          <Icon name={step.tone === 'info' ? 'info' : 'alert'} size={16} className={cx('mt-[3px] shrink-0', step.tone === 'warn' && 'text-warn')} />
          <span>{step.text}</span>
        </li>
      )
  }
}
