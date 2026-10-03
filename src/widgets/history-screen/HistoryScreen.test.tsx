import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HistoryRecord } from '@/entities/history-record'
import HistoryScreen from './HistoryScreen'

const records: HistoryRecord[] = [
  { id: 1, from: 'USD', to: 'EUR', amount: '1000', result: '922.25' },
  { id: 2, from: 'EUR', to: 'USD', amount: '500', result: '542.15' },
  { id: 3, from: 'GBP', to: 'PLN', amount: '250', result: '1271.72' },
]

describe('HistoryScreen', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders each record as an li with data-testid="history-item"', () => {
    render(<HistoryScreen history={records} selected={0} />)
    const items = screen.getAllByTestId('history-item')
    expect(items).toHaveLength(3)
  })

  it('formats records as "FROM amount → TO result" with grouped thousands', () => {
    render(<HistoryScreen history={records} selected={0} />)
    const items = screen.getAllByTestId('history-item')
    expect(items[0]!.textContent).toBe('USD 1,000 → EUR 922.25')
    expect(items[1]!.textContent).toBe('EUR 500 → USD 542.15')
    expect(items[2]!.textContent).toBe('GBP 250 → PLN 1,271.72')
  })

  it('marks the selected item with aria-selected="true" and exactly one item', () => {
    render(<HistoryScreen history={records} selected={1} />)
    const items = screen.getAllByTestId('history-item')
    const selected = items.filter((el) => el.getAttribute('aria-selected') === 'true')
    expect(selected).toHaveLength(1)
    expect(selected[0]!.textContent).toBe('EUR 500 → USD 542.15')
  })

  it('shows "1 record" for a single record and "N records" otherwise', () => {
    const { rerender } = render(<HistoryScreen history={records} selected={0} />)
    expect(screen.getByTestId('history-count').textContent).toBe('3 records')
    rerender(<HistoryScreen history={[records[0]!]} selected={0} />)
    expect(screen.getByTestId('history-count').textContent).toBe('1 record')
  })

  it('renders nothing for an empty history and shows "0 records"', () => {
    render(<HistoryScreen history={[]} selected={0} />)
    expect(screen.queryAllByTestId('history-item')).toHaveLength(0)
    expect(screen.getByTestId('history-count').textContent).toBe('0 records')
  })

  it('scrolls the selected item into view on mount and when selection changes', () => {
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    const { rerender } = render(<HistoryScreen history={records} selected={0} />)
    expect(scrollSpy).toHaveBeenCalled()
    const callsAfterMount = scrollSpy.mock.calls.length
    rerender(<HistoryScreen history={records} selected={2} />)
    expect(scrollSpy.mock.calls.length).toBeGreaterThan(callsAfterMount)
  })
})
