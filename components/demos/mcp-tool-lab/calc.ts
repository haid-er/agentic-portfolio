/**
 * Safe arithmetic evaluator for the `calculator` tool: a recursive-descent parser, never eval().
 * Supports + - * / ^, postfix %, "x% of y", parentheses, pi/e and a few functions.
 */

const FUNCS: Record<string, (...a: number[]) => number> = {
  sqrt: Math.sqrt, abs: Math.abs, floor: Math.floor, ceil: Math.ceil, exp: Math.exp,
  ln: Math.log, log: Math.log10, log2: Math.log2, sin: Math.sin, cos: Math.cos, tan: Math.tan,
  min: Math.min, max: Math.max, pow: Math.pow,
  round: (x: number, d = 0) => { const f = 10 ** Math.max(0, Math.min(10, Math.trunc(d))); return Math.round(x * f) / f },
}
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E }

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string }

export class CalcError extends Error {}

function lex(src: string): Tok[] {
  const s = src
    .toLowerCase()
    .replace(/(\d),(?=\d{3}\b)/g, '$1') // 2,340 -> 2340
    .replace(/×/g, '*')
    .replace(/(?<=[\d)]\s*)x(?=\s*[\d(.])/g, '*') // 3 x 4, never the x in max()
    .replace(/÷/g, '/')
    .replace(/\*\*/g, '^')
  const out: Tok[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i] ?? ''
    if (/\s/.test(c)) { i++; continue }
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(s.slice(i))
    if (num) { out.push({ t: 'num', v: Number(num[0]) }); i += num[0].length; continue }
    const id = /^[a-z_][a-z0-9_]*/.exec(s.slice(i))
    if (id) { out.push({ t: 'id', v: id[0] }); i += id[0].length; continue }
    if ('+-*/^%(),'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue }
    throw new CalcError(`Unexpected character "${c}"`)
  }
  return out
}

/** Evaluate an expression. Throws CalcError with a readable message. */
export function evaluate(src: string): number {
  if (src.length > 200) throw new CalcError('Expression is longer than 200 characters')
  const toks = lex(src)
  let p = 0
  let depth = 0
  const peek = () => toks[p]
  const isOp = (v: string) => { const t = peek(); return t?.t === 'op' && t.v === v }
  const eat = (v: string) => { if (!isOp(v)) throw new CalcError(`Expected "${v}"`); p++ }

  const expr = (): number => {
    if (++depth > 40) throw new CalcError('Expression is nested too deeply')
    let v = term()
    while (isOp('+') || isOp('-')) { const op = (toks[p++] as Tok).v; const r = term(); v = op === '+' ? v + r : v - r }
    depth--
    return v
  }
  const term = (): number => {
    let v = unary()
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = (toks[p++] as Tok).v
        const r = unary()
        if (op === '/' && r === 0) throw new CalcError('Division by zero')
        v = op === '*' ? v * r : v / r
      } else if (peek()?.t === 'id' && (peek() as { v: string }).v === 'of') { p++; v = v * unary() } // "17% of 2340"
      else return v
    }
  }
  const unary = (): number => {
    if (isOp('-')) { p++; return -unary() }
    if (isOp('+')) { p++; return unary() }
    return power()
  }
  const power = (): number => {
    const base = postfix()
    if (isOp('^')) { p++; return base ** unary() }
    return base
  }
  const postfix = (): number => {
    let v = primary()
    while (isOp('%')) { p++; v /= 100 }
    return v
  }
  const primary = (): number => {
    const t = peek()
    if (!t) throw new CalcError('Expression ended early')
    if (t.t === 'num') { p++; return t.v }
    if (t.t === 'op' && t.v === '(') { p++; const v = expr(); eat(')'); return v }
    if (t.t === 'id') {
      p++
      if (t.v in CONSTS) return CONSTS[t.v] as number
      const fn = FUNCS[t.v]
      if (!fn) throw new CalcError(`Unknown name "${t.v}"`)
      eat('(')
      const args: number[] = [expr()]
      while (isOp(',')) { p++; args.push(expr()) }
      eat(')')
      return fn(...args)
    }
    throw new CalcError(`Unexpected "${t.v}"`)
  }

  if (!toks.length) throw new CalcError('Empty expression')
  const v = expr()
  if (p < toks.length) throw new CalcError(`Unexpected "${(toks[p] as Tok).v}"`)
  if (!Number.isFinite(v)) throw new CalcError('Result is not a finite number')
  return v
}

/** Human formatting: up to 10 significant digits, no float noise. */
export const formatNumber = (v: number) => (Number.isInteger(v) ? v.toLocaleString('en-GB') : Number(v.toPrecision(10)).toLocaleString('en-GB', { maximumFractionDigits: 8 }))
