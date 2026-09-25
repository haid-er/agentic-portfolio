import 'server-only'
import type { AiErrorCode } from '../types'

/** An error the gateway turns into `{error:{code,message,retryAfterSec?}}` + status. */
export class GatewayError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
    readonly status: number,
    readonly retryAfterSec?: number,
  ) {
    super(message)
    this.name = 'GatewayError'
  }
}

export const badRequest = (message: string) => new GatewayError('bad_request', message, 400)
export const tooLarge = (message: string) => new GatewayError('input_too_large', message, 413)

/**
 * Why a single provider attempt failed. `retryable` means "try the next provider";
 * `cooldownSec` parks this provider for a while so we stop hammering it.
 */
export class ProviderError extends Error {
  constructor(
    readonly reason: ProviderFailure,
    message: string,
    readonly opts: { status?: number; cooldownSec?: number } = {},
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

export type ProviderFailure =
  | 'rate_limited' // 429 / quota
  | 'timeout'
  | 'auth' // 401/403: bad or missing key
  | 'model' // 404: model id unknown
  | 'rejected' // 400/422: provider refused the request shape
  | 'server' // 5xx
  | 'network'
  | 'empty' // 200 with no usable output
  | 'invalid_output' // JSON did not validate after repair

/** Map an HTTP status from a provider to a failure reason + cooldown. */
export function providerHttpError(status: number, detail: string, retryAfter?: string | null): ProviderError {
  const ra = retryAfter ? Math.ceil(Number(retryAfter)) : NaN
  const msg = detail.slice(0, 300)
  if (status === 429) return new ProviderError('rate_limited', msg, { status, cooldownSec: Number.isFinite(ra) ? Math.min(ra, 300) : 30 })
  if (status === 401 || status === 403) return new ProviderError('auth', msg, { status, cooldownSec: 300 })
  if (status === 404) return new ProviderError('model', msg, { status, cooldownSec: 300 })
  if (status === 402) return new ProviderError('rate_limited', msg, { status, cooldownSec: 600 }) // DeepSeek: balance
  if (status >= 500) return new ProviderError('server', msg, { status, cooldownSec: status === 503 ? 20 : 10 })
  return new ProviderError('rejected', msg, { status })
}
