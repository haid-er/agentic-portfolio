/**
 * Generate a Drizzle ORM (PostgreSQL) schema from the live SQLite schema, to show how the same
 * tables are declared in TypeScript. Types map SQLite affinities to sensible Postgres columns.
 */
import type { ColumnInfo, TableInfo } from './protocol'

const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())

function columnType(c: ColumnInfo, singlePk: boolean): { fn: string; code: string } {
  const t = c.type.toUpperCase()
  if (singlePk && c.pk && t.includes('INT')) return { fn: 'serial', code: `serial('${c.name}')` }
  if (t.includes('INT')) return { fn: 'integer', code: `integer('${c.name}')` }
  if (t.includes('REAL') || t.includes('NUM') || t.includes('DEC')) return { fn: 'numeric', code: `numeric('${c.name}', { precision: 10, scale: 2 })` }
  if (t.includes('DATE')) return { fn: 'date', code: `date('${c.name}')` }
  return { fn: 'text', code: `text('${c.name}')` }
}

export function drizzleSchema(tables: TableInfo[]): string {
  const used = new Set<string>(['pgTable'])
  let selfRef = false
  const blocks = tables.map((t) => {
    const pkCols = t.columns.filter((c) => c.pk > 0)
    const singlePk = pkCols.length === 1
    const lines = t.columns.map((c) => {
      const { fn, code } = columnType(c, singlePk)
      used.add(fn)
      let s = code
      if (singlePk && c.pk) s += '.primaryKey()'
      else if (c.notNull) s += '.notNull()'
      if (c.references) {
        // A self-reference needs an explicit return type to avoid a circular inference error.
        const self = c.references.table === t.name
        if (self) selfRef = true
        s += `.references(()${self ? ': AnyPgColumn' : ''} => ${camel(c.references.table)}.${camel(c.references.column)})`
      }
      return `  ${camel(c.name)}: ${s},`
    })
    let extra = ''
    if (pkCols.length > 1) {
      used.add('primaryKey')
      extra = `, (t) => [primaryKey({ columns: [${pkCols.map((c) => `t.${camel(c.name)}`).join(', ')}] })]`
    }
    return `export const ${camel(t.name)} = pgTable('${t.name}', {\n${lines.join('\n')}\n}${extra});`
  })
  const names = [...used].sort()
  if (selfRef) names.unshift('type AnyPgColumn')
  const imports = `import { ${names.join(', ')} } from 'drizzle-orm/pg-core';`
  return `${imports}\n\n${blocks.join('\n\n')}\n`
}
