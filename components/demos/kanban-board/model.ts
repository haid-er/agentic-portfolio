/**
 * Board data model, zod schemas (for decrypted data and imports) and pure board operations.
 * No browser APIs here.
 */
import { z } from 'zod'

export const TAGS = ['none', 'feature', 'bug', 'chore'] as const
export type Tag = (typeof TAGS)[number]
export const COLUMN_IDS = ['todo', 'doing', 'done'] as const
export type ColumnId = (typeof COLUMN_IDS)[number]

export const MAX_CARDS = 200
export const MAX_TITLE = 140
export const MAX_NOTE = 600

export const cardSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(MAX_TITLE),
  note: z.string().max(MAX_NOTE).default(''),
  tag: z.enum(TAGS).default('none'),
  createdAt: z.number().int().nonnegative(),
})
export type Card = z.infer<typeof cardSchema>

export const columnSchema = z.object({
  id: z.enum(COLUMN_IDS),
  title: z.string().trim().min(1).max(40),
  cards: z.array(cardSchema).max(MAX_CARDS),
})
export type Column = z.infer<typeof columnSchema>

export const boardSchema = z.object({
  v: z.literal(1),
  columns: z.array(columnSchema).length(3),
}).refine((b) => COLUMN_IDS.every((id, i) => b.columns[i]?.id === id), 'Columns must be todo, doing, done in that order.')
  .refine((b) => b.columns.reduce((n, c) => n + c.cards.length, 0) <= MAX_CARDS, `At most ${MAX_CARDS} cards.`)
export type Board = z.infer<typeof boardSchema>

/** Plain-JSON export envelope. */
export const exportSchema = z.object({
  kind: z.literal('kanban-board'),
  v: z.literal(1),
  exportedAt: z.string().optional(),
  board: boardSchema,
})

/** Encrypted vault as stored in localStorage (and in an encrypted backup file). */
export const vaultSchema = z.object({
  v: z.literal(1),
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(40),
  salt: z.string().min(8).max(64),
  iv: z.string().min(8).max(64),
  data: z.string().min(8).max(400_000),
  createdAt: z.number(),
  updatedAt: z.number(),
})
export type VaultRecord = z.infer<typeof vaultSchema>

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export const COLUMN_TITLES: Record<ColumnId, string> = { todo: 'To do', doing: 'Doing', done: 'Done' }

export function emptyBoard(): Board {
  return { v: 1, columns: COLUMN_IDS.map((id) => ({ id, title: COLUMN_TITLES[id], cards: [] })) }
}

/** Starter cards: generic demo tasks that teach the controls. */
export function sampleBoard(now = Date.now()): Board {
  const c = (title: string, tag: Tag, note = ''): Card => ({ id: newId(), title, note, tag, createdAt: now })
  const b = emptyBoard()
  b.columns[0].cards = [
    c('Drag me to Doing', 'feature', 'Use the grip, or focus it and press Space, then the arrow keys.'),
    c('Export this board as JSON', 'chore'),
    c('Lock the vault and unlock it again', 'none', 'The board only exists as ciphertext while locked.'),
  ]
  b.columns[1].cards = [c('Rename a card with Edit', 'none')]
  b.columns[2].cards = [c('Create a private vault', 'chore')]
  return b
}

export function cardCount(b: Board): number {
  return b.columns.reduce((n, col) => n + col.cards.length, 0)
}

export function locate(b: Board, cardId: string): { col: number; index: number } | null {
  for (let col = 0; col < b.columns.length; col++) {
    const index = b.columns[col].cards.findIndex((c) => c.id === cardId)
    if (index >= 0) return { col, index }
  }
  return null
}

/** Move a card to column `toCol` at `index`, where index counts cards other than the moved one. */
export function moveCard(b: Board, cardId: string, toCol: number, index: number): Board {
  const at = locate(b, cardId)
  if (!at) return b
  const card = b.columns[at.col].cards[at.index]
  const columns = b.columns.map((col) => ({ ...col, cards: col.cards.filter((c) => c.id !== cardId) }))
  const target = columns[toCol]
  if (!target) return b
  const i = Math.max(0, Math.min(index, target.cards.length))
  target.cards.splice(i, 0, card)
  return { ...b, columns }
}

export function updateCard(b: Board, cardId: string, patch: Partial<Omit<Card, 'id'>>): Board {
  return { ...b, columns: b.columns.map((col) => ({ ...col, cards: col.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)) })) }
}

export function removeCard(b: Board, cardId: string): Board {
  return { ...b, columns: b.columns.map((col) => ({ ...col, cards: col.cards.filter((c) => c.id !== cardId) })) }
}

export function addCard(b: Board, col: number, title: string, tag: Tag = 'none'): Board {
  const card: Card = { id: newId(), title: title.trim().slice(0, MAX_TITLE), note: '', tag, createdAt: Date.now() }
  return { ...b, columns: b.columns.map((c, i) => (i === col ? { ...c, cards: [...c.cards, card] } : c)) }
}

export function insertCard(b: Board, col: number, index: number, card: Card): Board {
  return {
    ...b,
    columns: b.columns.map((c, i) => {
      if (i !== col) return c
      const cards = [...c.cards]
      cards.splice(Math.min(index, cards.length), 0, card)
      return { ...c, cards }
    }),
  }
}

/** Readable zod error for import feedback. */
export function firstIssue(e: z.ZodError): string {
  const i = e.issues[0]
  if (!i) return 'Invalid file.'
  const path = i.path.length ? `${i.path.join('.')}: ` : ''
  return `${path}${i.message}`
}
