/**
 * Offline path: an indented outline -> people. Indentation (spaces, tabs or bullets) sets the level.
 * "Name — Title (Department)", "Name - Title", "Name: Title" and "Name, Title" all work.
 * A department in brackets is inherited by everyone below until another one is given.
 */
import { type Person, sanitize } from './model'

export function parseOutline(text: string): Person[] {
  const people: Person[] = []
  const stack: Array<{ indent: number; id: string; dept: string }> = []
  for (const raw of text.replace(/\t/g, '    ').split('\n')) {
    if (!raw.trim()) continue
    const bullet = /^(\s*)((?:[-*•·>]|\d+[.)])\s+)?(.*)$/.exec(raw)
    if (!bullet) continue
    const indent = bullet[1].length + (bullet[2] ? 2 : 0)
    let body = bullet[3].trim()
    let dept = ''
    const d = /\(([^)]+)\)\s*$/.exec(body)
    if (d) { dept = d[1].trim(); body = body.slice(0, d.index).trim() }
    const parts = body.split(/\s+[—–-]\s+|:\s+|,\s+|\s+\|\s+/)
    const name = (parts[0] ?? '').trim()
    if (!name) continue
    const title = parts.slice(1).join(', ').trim()
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
    const parent = stack[stack.length - 1]
    const id = `p${people.length + 1}`
    const department = dept || parent?.dept || ''
    people.push({ id, name, title, department, managerId: parent?.id ?? null })
    stack.push({ indent, id, dept: department })
  }
  return sanitize(people)
}
