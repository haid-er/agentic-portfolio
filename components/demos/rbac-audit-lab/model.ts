/**
 * Types and seed data for the RBAC + audit lab. People and organisations are generic
 * personas ("Analyst · North"), not real users. Rules follow CASL's raw-rule shape.
 */
import { z } from 'zod'

export const ACTIONS = ['manage', 'create', 'read', 'update', 'delete', 'approve'] as const
export const SUBJECTS = ['all', 'Report', 'Emission', 'AuditLog'] as const
export const OPS = ['eq', 'ne', 'in'] as const

export type Action = (typeof ACTIONS)[number]
export type Subject = (typeof SUBJECTS)[number]
export type ResourceSubject = Exclude<Subject, 'all'>
export type Op = (typeof OPS)[number]
export type Attr = string | number | boolean

export const conditionSchema = z.object({
  field: z.string().min(1).max(30),
  op: z.enum(OPS),
  value: z.string().max(80),
})
export const ruleSchema = z.object({
  id: z.string().min(1).max(40),
  action: z.enum(ACTIONS),
  subject: z.enum(SUBJECTS),
  conditions: z.array(conditionSchema).max(4),
  inverted: z.boolean(),
  reason: z.string().max(120).optional(),
})
export const roleSchema = z.object({ id: z.string(), label: z.string(), rules: z.array(ruleSchema).max(20) })
export const rolesSchema = z.array(roleSchema).min(1).max(8)

export type Condition = z.infer<typeof conditionSchema>
export type Rule = z.infer<typeof ruleSchema>
export type Role = z.infer<typeof roleSchema>

export interface User { id: string; label: string; roleId: string; orgId: string }
export interface Resource { id: string; subject: ResourceSubject; label: string; attrs: Record<string, Attr> }

/** Fields a condition can test, per subject. */
export const FIELDS: Record<Subject, string[]> = {
  all: ['orgId'],
  Report: ['orgId', 'ownerId', 'status'],
  Emission: ['orgId', 'locked'],
  AuditLog: ['orgId'],
}

/** Suggested condition values (templates are resolved against the acting user). */
export const VALUE_HINTS = ['{{user.id}}', '{{user.orgId}}', 'draft', 'submitted', 'approved', 'published', 'true', 'false']

let n = 0
export const rid = (p = 'r') => `${p}-${Date.now().toString(36)}-${(n++).toString(36)}`

const c = (field: string, op: Op, value: string): Condition => ({ field, op, value })

export const SEED_ROLES: Role[] = [
  {
    id: 'admin', label: 'Admin',
    rules: [{ id: 'a1', action: 'manage', subject: 'all', conditions: [], inverted: false }],
  },
  {
    id: 'analyst', label: 'Analyst',
    rules: [
      { id: 'n1', action: 'read', subject: 'Report', conditions: [c('orgId', 'eq', '{{user.orgId}}')], inverted: false },
      { id: 'n2', action: 'create', subject: 'Report', conditions: [c('orgId', 'eq', '{{user.orgId}}')], inverted: false },
      { id: 'n3', action: 'update', subject: 'Report', conditions: [c('ownerId', 'eq', '{{user.id}}'), c('status', 'in', 'draft,submitted')], inverted: false },
      { id: 'n4', action: 'read', subject: 'Emission', conditions: [c('orgId', 'eq', '{{user.orgId}}')], inverted: false },
      { id: 'n5', action: 'update', subject: 'Emission', conditions: [c('orgId', 'eq', '{{user.orgId}}')], inverted: false },
      { id: 'n6', action: 'update', subject: 'Emission', conditions: [c('locked', 'eq', 'true')], inverted: true, reason: 'Locked emissions belong to an approved report' },
    ],
  },
  {
    id: 'reviewer', label: 'Reviewer',
    rules: [
      { id: 'v1', action: 'read', subject: 'Report', conditions: [c('orgId', 'eq', '{{user.orgId}}')], inverted: false },
      { id: 'v2', action: 'read', subject: 'Emission', conditions: [c('orgId', 'eq', '{{user.orgId}}')], inverted: false },
      { id: 'v3', action: 'approve', subject: 'Report', conditions: [c('orgId', 'eq', '{{user.orgId}}'), c('status', 'eq', 'submitted')], inverted: false },
      { id: 'v4', action: 'update', subject: 'Report', conditions: [c('orgId', 'eq', '{{user.orgId}}'), c('status', 'ne', 'draft')], inverted: false },
      { id: 'v5', action: 'update', subject: 'Emission', conditions: [c('orgId', 'eq', '{{user.orgId}}')], inverted: false },
      { id: 'v6', action: 'approve', subject: 'Report', conditions: [c('ownerId', 'eq', '{{user.id}}')], inverted: true, reason: 'Four-eyes rule: nobody approves their own report' },
    ],
  },
  {
    id: 'auditor', label: 'Auditor',
    rules: [
      { id: 'd1', action: 'read', subject: 'all', conditions: [], inverted: false },
      { id: 'd2', action: 'delete', subject: 'AuditLog', conditions: [], inverted: true, reason: 'The audit log is append-only' },
    ],
  },
]

export const USERS: User[] = [
  { id: 'u-admin', label: 'Admin · North', roleId: 'admin', orgId: 'north' },
  { id: 'u-ana-n', label: 'Analyst · North', roleId: 'analyst', orgId: 'north' },
  { id: 'u-ana-s', label: 'Analyst · South', roleId: 'analyst', orgId: 'south' },
  { id: 'u-rev-n', label: 'Reviewer · North', roleId: 'reviewer', orgId: 'north' },
  { id: 'u-aud', label: 'Auditor · External', roleId: 'auditor', orgId: 'external' },
]

export const SEED_RESOURCES: Resource[] = [
  { id: 'rep-n', subject: 'Report', label: 'GHG report · North', attrs: { orgId: 'north', ownerId: 'u-ana-n', status: 'submitted' } },
  { id: 'rep-w', subject: 'Report', label: 'Water report · North', attrs: { orgId: 'north', ownerId: 'u-rev-n', status: 'submitted' } },
  { id: 'rep-s', subject: 'Report', label: 'GHG report · South', attrs: { orgId: 'south', ownerId: 'u-ana-s', status: 'draft' } },
  { id: 'em-n2', subject: 'Emission', label: 'Scope 2 electricity · North', attrs: { orgId: 'north', locked: false, tCO2e: 310.2 } },
  { id: 'em-n1', subject: 'Emission', label: 'Scope 1 fleet · North', attrs: { orgId: 'north', locked: false, tCO2e: 612 } },
  { id: 'em-s1', subject: 'Emission', label: 'Scope 1 boilers · South', attrs: { orgId: 'south', locked: false, tCO2e: 145.8 } },
  { id: 'log-n', subject: 'AuditLog', label: 'Audit log · North', attrs: { orgId: 'north' } },
]

export const userById = (id: string) => USERS.find((u) => u.id === id) ?? (USERS[0] as User)
