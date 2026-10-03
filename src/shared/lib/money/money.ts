import Decimal from 'decimal.js'

Decimal.set({ rounding: Decimal.ROUND_HALF_UP })

export function parseAmount(raw: string): Decimal {
  const cleaned = raw.replace(/,/g, '').replace(/\.$/, '')
  if (cleaned === '' || cleaned === '.') return new Decimal(0)
  try {
    const value = new Decimal(cleaned)
    return value.isNaN() ? new Decimal(0) : value
  } catch {
    return new Decimal(0)
  }
}

export function isZero(raw: string): boolean {
  return parseAmount(raw).isZero()
}

export function convert(amount: string, rate: string): string {
  const product = parseAmount(amount).times(new Decimal(rate))
  const fixed = product.toFixed(2)
  if (!fixed.includes('.')) return fixed
  const [intPart, fracPart] = fixed.split('.')
  const trimmed = fracPart.replace(/0+$/, '')
  return trimmed ? `${intPart}.${trimmed}` : intPart
}

export function formatMoney(raw: string): string {
  const [intPart, fracPart] = raw.split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (fracPart === undefined) return grouped
  const trimmed = fracPart.replace(/0+$/, '')
  return trimmed ? `${grouped}.${trimmed}` : grouped
}
