/** Zod schemas: one per request part (params, query, body), as the validation middleware expects. */
import { z } from 'zod'

const year = new Date().getUTCFullYear()

export const idParams = z.object({
  id: z.coerce.number({ error: 'id must be a number' }).int('id must be an integer').positive('id must be positive'),
})

export const listQuery = z.object({
  country: z.string().regex(/^[A-Z]{2}$/, 'country must be an ISO 3166 alpha-2 code, e.g. GB').optional(),
  scope: z.coerce.number().int().min(1).max(3, 'scope is 1, 2 or 3').optional(),
  limit: z.coerce.number().int().min(1, 'limit must be at least 1').max(50, 'limit is at most 50').default(20),
}).strict()

export const createSiteBody = z.object({
  name: z.string().trim().min(2, 'name needs at least 2 characters').max(60, 'name is at most 60 characters'),
  country: z.string().regex(/^[A-Z]{2}$/, 'country must be an ISO 3166 alpha-2 code, e.g. GB'),
  scope: z.union([z.literal(1), z.literal(2), z.literal(3)], { error: 'scope must be 1, 2 or 3' }),
  emissionsTCO2e: z.number({ error: 'emissionsTCO2e must be a number' }).min(0, 'emissionsTCO2e cannot be negative').max(10_000_000),
  reportingYear: z.number().int().min(2000).max(year + 1, `reportingYear cannot be after ${year + 1}`),
}).strict()

export const updateSiteBody = createSiteBody.partial().strict().refine((b) => Object.keys(b).length > 0, {
  message: 'send at least one field to update',
})

export type CreateSiteDto = z.infer<typeof createSiteBody>
export type UpdateSiteDto = z.infer<typeof updateSiteBody>
export type ListQueryDto = z.infer<typeof listQuery>
export type IdParamsDto = z.infer<typeof idParams>
