import { describe, expect, it } from 'vitest'
import Decimal from 'decimal.js'
import { convert, formatMoney, isZero, parseAmount } from './money'

describe('parseAmount', () => {
  it('parses a plain numeric string', () => {
    expect(parseAmount('42').toString()).toBe('42')
  })

  it('parses a decimal string', () => {
    expect(parseAmount('0.1').toString()).toBe('0.1')
  })

  it('returns 0 for the empty string', () => {
    expect(parseAmount('').isZero()).toBe(true)
  })

  it('tolerates a trailing dot', () => {
    expect(parseAmount('5.').toString()).toBe('5')
  })

  it('tolerates commas', () => {
    expect(parseAmount('1,000').toString()).toBe('1000')
    expect(parseAmount('1,000.5').toString()).toBe('1000.5')
  })

  it('never throws on garbage input', () => {
    expect(() => parseAmount('abc')).not.toThrow()
    expect(() => parseAmount('1.2.3')).not.toThrow()
    expect(() => parseAmount(',,')).not.toThrow()
    expect(parseAmount(',').isZero()).toBe(true)
  })

  it('returns Decimal instances', () => {
    expect(parseAmount('1')).toBeInstanceOf(Decimal)
  })
})

describe('isZero', () => {
  it('is true for the empty string', () => {
    expect(isZero('')).toBe(true)
  })

  it('is true for "0"', () => {
    expect(isZero('0')).toBe(true)
  })

  it('is true for "0.0"', () => {
    expect(isZero('0.0')).toBe(true)
  })

  it('is true for "0."', () => {
    expect(isZero('0.')).toBe(true)
  })

  it('is true for "1,000" with commas (after stripping)', () => {
    expect(isZero('0,0')).toBe(true)
  })

  it('is false for "1"', () => {
    expect(isZero('1')).toBe(false)
  })

  it('is false for "0.01"', () => {
    expect(isZero('0.01')).toBe(false)
  })
})

describe('convert', () => {
  it('multiplies 250 by 1.0843 to 271.08 (rounded half-up)', () => {
    expect(convert('250', '1.084300')).toBe('271.08')
  })

  it('rounds 1.005 * 1 half-up to 1.01', () => {
    expect(convert('1.005', '1')).toBe('1.01')
  })

  it('rounds 2.675 * 1 half-up to 2.68', () => {
    expect(convert('2.675', '1')).toBe('2.68')
  })

  it('avoids the 0.1+0.2 floating-point error: 0.1 * 2 is 0.2', () => {
    expect(convert('0.1', '2')).toBe('0.2')
  })

  it('avoids the 0.1+0.2 error: 0.1 * 3 is 0.3', () => {
    expect(convert('0.1', '3')).toBe('0.3')
  })

  it('avoids the 0.1+0.2 error: 0.7 * 1 is 0.7', () => {
    expect(convert('0.7', '1')).toBe('0.7')
  })

  it('trims trailing zeros from the fractional part', () => {
    expect(convert('100', '1')).toBe('100')
    expect(convert('1', '1.5')).toBe('1.5')
    expect(convert('2', '1.50')).toBe('3')
  })

  it('returns the result without grouping', () => {
    expect(convert('1000', '1')).toBe('1000')
    expect(convert('1000', '1.234')).toBe('1234')
  })

  it('multiplies a small amount by a small rate exactly', () => {
    expect(convert('0.1', '0.1')).toBe('0.01')
  })

  it('keeps precision through chained operations', () => {
    const sum = parseAmount(convert('0.1', '2'))
      .plus(parseAmount(convert('0.2', '1')))
      .toString()
    expect(sum).toBe('0.4')
  })
})

describe('formatMoney', () => {
  it('groups thousands with commas', () => {
    expect(formatMoney('1186.5')).toBe('1,186.5')
    expect(formatMoney('1000')).toBe('1,000')
    expect(formatMoney('1000000')).toBe('1,000,000')
  })

  it('does not convert to a float (preserves the decimal part)', () => {
    expect(formatMoney('922.25')).toBe('922.25')
  })

  it('keeps an already-grouped-looking value intact (no extra commas)', () => {
    expect(formatMoney('100')).toBe('100')
  })
})
