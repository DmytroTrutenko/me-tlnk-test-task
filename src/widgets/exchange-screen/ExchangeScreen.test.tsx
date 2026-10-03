import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ExchangeScreen from './ExchangeScreen'

function noop() {
  /* default handler */
}

const baseProps = {
  from: 'USD',
  to: 'EUR',
  amount: '100',
  result: '92.23',
  resultState: 'ready' as const,
  currencies: ['USD', 'EUR', 'GBP'],
  currenciesLoading: false,
  currenciesError: null,
  onRetryCurrencies: noop,
  ageLabel: 'just now',
  onFromChange: noop,
  onToChange: noop,
  onRefresh: noop,
}

describe('ExchangeScreen', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the from and to selects with the current values', () => {
    render(<ExchangeScreen {...baseProps} />)
    const from = screen.getByTestId('from-currency') as HTMLSelectElement
    const to = screen.getByTestId('to-currency') as HTMLSelectElement
    expect(from.value).toBe('USD')
    expect(to.value).toBe('EUR')
    expect(from.querySelectorAll('option').length).toBe(3)
    expect(to.querySelectorAll('option').length).toBe(3)
  })

  it('renders the amount and result strings', () => {
    render(<ExchangeScreen {...baseProps} amount="1,234" result="1,134.56" />)
    expect(screen.getByTestId('amount').textContent).toBe('1,234')
    expect(screen.getByTestId('result').textContent).toBe('1,134.56')
  })

  it('shows "…" while resultState is loading and hides the result value', () => {
    render(<ExchangeScreen {...baseProps} result="99" resultState="loading" />)
    expect(screen.getByTestId('result').textContent).toBe('…')
  })

  it('shows "—" and an error message when resultState is error', () => {
    render(<ExchangeScreen {...baseProps} result="0" resultState="error" />)
    expect(screen.getByTestId('result').textContent).toBe('—')
    expect(screen.getByRole('status').textContent).toMatch(/couldn|try again/i)
  })

  it('shows "Updating…" in the age label while loading and the ageLabel otherwise', () => {
    const { rerender } = render(<ExchangeScreen {...baseProps} resultState="loading" />)
    expect(screen.getByTestId('updated-at').textContent).toBe('Updating…')
    rerender(<ExchangeScreen {...baseProps} resultState="ready" ageLabel="3 min ago" />)
    expect(screen.getByTestId('updated-at').textContent).toBe('Last updated 3 min ago')
    rerender(<ExchangeScreen {...baseProps} resultState="error" ageLabel="—" />)
    expect(screen.getByTestId('updated-at').textContent).toBe('Last updated —')
  })

  it('keeps the current from/to as an option even when not in the currencies list', () => {
    render(<ExchangeScreen {...baseProps} from="JPY" to="JPY" currencies={['USD', 'EUR']} />)
    const from = screen.getByTestId('from-currency') as HTMLSelectElement
    const to = screen.getByTestId('to-currency') as HTMLSelectElement
    expect(from.querySelectorAll('option').length).toBe(3)
    expect(to.querySelectorAll('option').length).toBe(3)
    expect(Array.from(from.options).map((o) => o.value)).toContain('JPY')
    expect(Array.from(to.options).map((o) => o.value)).toContain('JPY')
  })

  it('disables the selects while currencies are loading and the list is empty', () => {
    render(<ExchangeScreen {...baseProps} currencies={[]} currenciesLoading={true} from="" to="" />)
    expect((screen.getByTestId('from-currency') as HTMLSelectElement).disabled).toBe(true)
    expect((screen.getByTestId('to-currency') as HTMLSelectElement).disabled).toBe(true)
  })

  it('shows the currency error alert with a retry button when currenciesError is set', () => {
    const onRetry = vi.fn()
    render(
      <ExchangeScreen
        {...baseProps}
        currenciesError="Couldn't load currencies."
        onRetryCurrencies={onRetry}
      />,
    )
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toMatch(/couldn/i)
    expect(within(alert).getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('fires onFromChange and onToChange when selects change', async () => {
    const user = userEvent.setup()
    const onFromChange = vi.fn()
    const onToChange = vi.fn()
    render(<ExchangeScreen {...baseProps} onFromChange={onFromChange} onToChange={onToChange} />)
    await user.selectOptions(screen.getByTestId('from-currency'), 'GBP')
    expect(onFromChange).toHaveBeenCalledWith('GBP')
    await user.selectOptions(screen.getByTestId('to-currency'), 'GBP')
    expect(onToChange).toHaveBeenCalledWith('GBP')
  })

  it('fires onRefresh when the refresh button is clicked', async () => {
    const user = userEvent.setup()
    const onRefresh = vi.fn()
    render(<ExchangeScreen {...baseProps} onRefresh={onRefresh} />)
    await user.click(screen.getByTestId('refresh'))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('fires onRetryCurrencies when the currency retry button is clicked', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<ExchangeScreen {...baseProps} currenciesError="boom" onRetryCurrencies={onRetry} />)
    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
