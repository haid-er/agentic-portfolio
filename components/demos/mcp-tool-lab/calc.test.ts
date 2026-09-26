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
  it('reads "x% of y"', () => {
    expect(evaluate('17% of 2,340')).toBeCloseTo(397.8, 10)
  })
  it('refuses input it cannot parse, without eval', () => {
    expect(() => evaluate('alert(1)')).toThrow(CalcError)
  })
})
