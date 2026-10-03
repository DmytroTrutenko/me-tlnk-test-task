import { describe, expect, it } from 'vitest'
import { MAX_DIGITS, reduceAmount } from './amount'

describe('reduceAmount', () => {
  describe('replacing a zero start', () => {
    it('replaces 0 with a non-zero digit', () => {
      expect(reduceAmount('0', '5')).toBe('5')
      expect(reduceAmount('0', '1')).toBe('1')
      expect(reduceAmount('0', '9')).toBe('9')
    })

    it('keeps 0 when a single 0 is pressed', () => {
      expect(reduceAmount('0', '0')).toBe('0')
    })

    it('keeps 0 when 00 is pressed (no leading zeros)', () => {
      expect(reduceAmount('0', '00')).toBe('0')
    })

    it("'00' then '7' lands on '7'", () => {
      const afterDoubleZero = reduceAmount('0', '00')
      const afterSeven = reduceAmount(afterDoubleZero, '7')
      expect(afterDoubleZero).toBe('0')
      expect(afterSeven).toBe('7')
    })
  })

  describe('appending digits to a non-zero value', () => {
    it('appends a single digit', () => {
      expect(reduceAmount('5', '0')).toBe('50')
      expect(reduceAmount('5', '7')).toBe('57')
    })

    it('appends 00 as two digits', () => {
      expect(reduceAmount('5', '00')).toBe('500')
    })
  })

  describe('the dot key', () => {
    it("'.' on '0' gives '0.'", () => {
      expect(reduceAmount('0', '.')).toBe('0.')
    })

    it("'.' on '5' gives '5.'", () => {
      expect(reduceAmount('5', '.')).toBe('5.')
    })

    it('allows only one dot', () => {
      expect(reduceAmount('5.', '.')).toBe('5.')
      expect(reduceAmount('5.5', '.')).toBe('5.5')
    })

    it('appends digits after a dot', () => {
      expect(reduceAmount('5.', '0')).toBe('5.0')
      expect(reduceAmount('5.', '5')).toBe('5.5')
    })
  })

  describe('backspace', () => {
    it('removes the last digit', () => {
      expect(reduceAmount('50', 'backspace')).toBe('5')
      expect(reduceAmount('57', 'backspace')).toBe('5')
    })

    it('removes a trailing dot', () => {
      expect(reduceAmount('5.', 'backspace')).toBe('5')
    })

    it('removes a digit after the dot', () => {
      expect(reduceAmount('5.5', 'backspace')).toBe('5.')
    })

    it("down to empty gives '0'", () => {
      expect(reduceAmount('5', 'backspace')).toBe('0')
    })

    it("does not go below '0'", () => {
      expect(reduceAmount('0', 'backspace')).toBe('0')
    })

    it('keeps a well-formed fractional value after two backspaces', () => {
      expect(reduceAmount(reduceAmount('5.5', 'backspace'), 'backspace')).toBe('5')
    })
  })

  describe('clear', () => {
    it("resets any value to '0'", () => {
      expect(reduceAmount('0', 'clear')).toBe('0')
      expect(reduceAmount('5', 'clear')).toBe('0')
      expect(reduceAmount('50', 'clear')).toBe('0')
      expect(reduceAmount('5.5', 'clear')).toBe('0')
    })
  })

  describe('15-digit limit', () => {
    it('accepts the 15th digit', () => {
      const fourteen = '12345678901234'
      expect(reduceAmount(fourteen, '5')).toBe('123456789012345')
    })

    it('ignores the 16th digit', () => {
      const fifteen = '123456789012345'
      expect(reduceAmount(fifteen, '5')).toBe('123456789012345')
    })

    it('ignores 00 when it would push past 15 digits', () => {
      const fourteen = '12345678901234'
      expect(reduceAmount(fourteen, '00')).toBe('12345678901234')
    })

    it('accepts 00 when the total stays within 15 digits', () => {
      const thirteen = '1234567890123'
      expect(reduceAmount(thirteen, '00')).toBe('123456789012300')
    })

    it('counts only digits, not the dot', () => {
      const fifteenDigitsWithDot = '123.456789012345'
      expect(fifteenDigitsWithDot.length - 1).toBe(15)
      expect(reduceAmount(fifteenDigitsWithDot, '5')).toBe('123.456789012345')
    })

    it('lets the 15th digit land in the fractional part', () => {
      const fourteenWithDot = '123.45678901234'
      expect(reduceAmount(fourteenWithDot, '5')).toBe('123.456789012345')
    })

    it('exposes the limit as a constant', () => {
      expect(MAX_DIGITS).toBe(15)
    })
  })

  describe('purity', () => {
    it('does not mutate the input string', () => {
      const original = '50'
      reduceAmount(original, 'backspace')
      expect(original).toBe('50')
    })
  })
})
