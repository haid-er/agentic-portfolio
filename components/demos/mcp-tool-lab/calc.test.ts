import { describe, expect, it } from 'vitest'
import { CalcError, evaluate } from './calc'

describe('calculator tool', () => {
  it('keeps argument commas inside functions', () => {
    expect(evaluate('min(1,200)')).toBe(1)
  })
  it('handles functions and powers', () => {
    expect(evaluate('pow(2,10)')).toBe(1024)
    expect(evaluate('2^10')).toBe(1024)
  })
  it('drops thousands separators outside parentheses', () => {
    expect(evaluate('2,340 * 2')).toBe(4680)
  })
  it('reads thousands inside single-argument functions', () => {
    expect(evaluate('sqrt(1,764)')).toBe(42)
    expect(evaluate('17.5% of 2,340 + sqrt(1,764)')).toBeCloseTo(451.5, 10)
    expect(evaluate('max(1,200, 3)')).toBe(200)
  })
  it('reads "x% of y"', () => {
    expect(evaluate('17% of 2,340')).toBeCloseTo(397.8, 10)
  })
  it('refuses input it cannot parse, without eval', () => {
    expect(() => evaluate('alert(1)')).toThrow(CalcError)
  })
})
