/**
 * Zod schemas for the /api/ai/* wire format. Owner: ai-gateway.
 * Server routes validate every body with these; they mirror the interfaces in ./types.
 * Content caps (maxInputChars, image bytes) are enforced separately in gateway/limits.ts
 * because they depend on admin settings.
 */
import { z } from 'zod'
import { DEMO_SLUGS } from '@/lib/demos/slugs'
import { AI_LIMITS } from './types'

const DATA_URL = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/

export const AiPartSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({
    type: z.literal('image'),
    dataUrl: z.string().regex(DATA_URL, 'Images must be base64 data URLs (png, jpeg, webp or gif)'),
  }),
])

export const AiMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.union([z.string(), z.array(AiPartSchema).min(1).max(12)]),
})

const JsonObject = z.record(z.string(), z.unknown())

export const AiToolDefSchema = z.object({
  name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/, 'Tool names: letters, digits, _ or -, max 64'),
  description: z.string().max(1024),
  parameters: JsonObject,
})

export const AiTextRequestSchema = z.object({
  demo: z.enum(DEMO_SLUGS, { error: 'Unknown demo slug' }),
  messages: z.array(AiMessageSchema).min(1).max(AI_LIMITS.maxMessages),
  system: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  vision: z.boolean().optional(),
  tools: z.array(AiToolDefSchema).max(AI_LIMITS.maxTools).optional(),
})

export const AiChatWireSchema = AiTextRequestSchema.extend({ stream: z.boolean().optional() })

export const AiObjectWireSchema = AiTextRequestSchema.omit({ tools: true }).extend({
  schemaName: z.string().regex(/^[A-Za-z][A-Za-z0-9_ -]{0,63}$/, 'schemaName: letters, digits, space, _ or -'),
  jsonSchema: JsonObject,
})

export type AiChatWire = z.infer<typeof AiChatWireSchema>
export type AiObjectWire = z.infer<typeof AiObjectWireSchema>

/** First few zod issues as one readable line. */
export function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
    .join('; ')
}
