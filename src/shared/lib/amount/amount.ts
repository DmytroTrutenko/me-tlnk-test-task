export type AmountKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '00'
  | '.'
  | 'backspace'
  | 'clear'

export const MAX_DIGITS = 15

function countDigits(s: string): number {
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c >= 48 && c <= 57) n++
  }
  return n
}

export function reduceAmount(amount: string, key: AmountKey): string {
  if (key === 'clear') return '0'

  if (key === 'backspace') {
    if (amount.length <= 1) return '0'
    return amount.slice(0, -1)
  }

  if (key === '.') {
    if (amount.includes('.')) return amount
    return amount + '.'
  }

  if (amount === '0') {
    if (key === '0' || key === '00') return '0'
    return key
  }

  if (countDigits(amount) + key.length > MAX_DIGITS) return amount

  return amount + key
}
