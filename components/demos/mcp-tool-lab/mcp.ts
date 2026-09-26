/**
 * A tiny in-browser MCP server (JSON-RPC 2.0) exposing the lab's tools, plus the log types.
 * Shapes follow the Model Context Protocol spec: initialize, notifications/initialized,
 * tools/list, tools/call (result.content[] + structuredContent + isError) and
 * notifications/tools/list_changed.
 */
import { CalcError } from './calc'
import { getTool, type ToolSpec } from './tools'

export const PROTOCOL_VERSION = '2025-06-18'
export const SERVER_INFO = { name: 'portfolio-tools', title: 'Portfolio tool lab', version: '1.0.0' }

export interface ToolConfig {
  enabled: boolean
  description: string
  /** JSON schema as the model sees it (editable). */
  inputSchema: Record<string, unknown>
}

export type JsonRpcRequest = { jsonrpc: '2.0'; id: number; method: string; params?: Record<string, unknown> }
export type JsonRpcNotification = { jsonrpc: '2.0'; method: string; params?: Record<string, unknown> }
export type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: number; result: Record<string, unknown> }
  | { jsonrpc: '2.0'; id: number; error: { code: number; message: string; data?: unknown } }

export type Party = 'host' | 'server' | 'model' | 'router'

export interface LogEntry {
  seq: number
  /** ms since the session log started. */
  t: number
  from: Party
  to: Party
  kind: 'request' | 'response' | 'notification' | 'error'
  /** JSON-RPC method, or a label for model traffic ("chat", "decision"). */
  method: string
  rpcId?: number
  /** One-line summary for the collapsed row. */
  summary: string
  payload: unknown
  ms?: number
}

export interface CallResult {
  content: Array<{ type: 'text'; text: string }>
  structuredContent?: Record<string, unknown>
  isError: boolean
}

/** The tool list as MCP `tools/list` returns it (enabled tools only). */
export function listTools(config: Record<string, ToolConfig>, specs: readonly ToolSpec[]) {
  return specs
    .filter((s) => config[s.name]?.enabled)
    .map((s) => ({ name: s.name, title: s.title, description: config[s.name]?.description ?? s.description, inputSchema: config[s.name]?.inputSchema ?? s.inputSchema }))
}

/**
 * Handle one JSON-RPC request. Tool failures are *results* with isError (the model can read
 * and recover); protocol problems (unknown method/tool) are JSON-RPC errors.
 */
export async function handle(
  req: JsonRpcRequest,
  ctx: { config: Record<string, ToolConfig>; specs: readonly ToolSpec[]; signal: AbortSignal },
): Promise<JsonRpcResponse> {
  const { id } = req
  switch (req.method) {
    case 'initialize':
      return { jsonrpc: '2.0', id, result: { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: true } }, serverInfo: SERVER_INFO } }
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: listTools(ctx.config, ctx.specs) } }
    case 'tools/call': {
      const name = String(req.params?.name ?? '')
      const spec = getTool(name)
      if (!spec || !ctx.config[name]?.enabled) {
        return { jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown tool: ${name || '(empty)'}` } }
      }
      const parsed = spec.args.safeParse(req.params?.arguments ?? {})
      if (!parsed.success) {
        const msg = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || 'arguments'}: ${i.message}`).join('; ')
        return { jsonrpc: '2.0', id, result: errorResult(`Invalid arguments for ${name}: ${msg}`) }
      }
      try {
        const out = await spec.run(parsed.data as never, ctx.signal)
        const result: CallResult = { content: [{ type: 'text', text: out.text }], isError: false, ...(out.structured ? { structuredContent: out.structured } : {}) }
        return { jsonrpc: '2.0', id, result: result as unknown as Record<string, unknown> }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw e
        const msg = e instanceof CalcError ? `Calculator: ${e.message}` : e instanceof Error ? e.message : String(e)
        return { jsonrpc: '2.0', id, result: errorResult(msg) }
      }
    }
    default:
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${req.method}` } }
  }
}

function errorResult(text: string): Record<string, unknown> {
  const r: CallResult = { content: [{ type: 'text', text }], isError: true }
  return r as unknown as Record<string, unknown>
}

/** Validate an edited input schema: a JSON object schema, small enough for the gateway. */
export function checkSchema(raw: string): { ok: true; schema: Record<string, unknown> } | { ok: false; error: string } {
  if (raw.length > 3000) return { ok: false, error: 'Keep the schema under 3,000 characters.' }
  let v: unknown
  try { v = JSON.parse(raw) } catch (e) { return { ok: false, error: `Not valid JSON: ${e instanceof Error ? e.message : String(e)}` } }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, error: 'The schema must be a JSON object.' }
  const o = v as Record<string, unknown>
  if (o.type !== 'object') return { ok: false, error: 'Tool input schemas must have "type": "object".' }
  if (o.properties != null && (typeof o.properties !== 'object' || Array.isArray(o.properties))) return { ok: false, error: '"properties" must be an object.' }
  if (o.required != null && !Array.isArray(o.required)) return { ok: false, error: '"required" must be an array of property names.' }
  return { ok: true, schema: o }
}
