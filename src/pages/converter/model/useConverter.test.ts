import { describe, expect, it } from 'vitest'
import { converterReducer, initialConverterState, pickDefault } from './useConverter'
import { createHistoryRecord } from '@/entities/history-record'

describe('pickDefault', () => {
  it('keeps the current value when it is in the list', () => {
    expect(pickDefault(['USD', 'EUR', 'GBP'], 'EUR', 'USD')).toBe('EUR')
  })

  it('uses the fallback when the current value is empty', () => {
    expect(pickDefault(['USD', 'EUR'], '', 'USD')).toBe('USD')
  })

  it('uses the fallback when the current value is missing from the list', () => {
    expect(pickDefault(['EUR', 'USD'], 'JPY', 'USD')).toBe('USD')
  })

  it('falls back to the first list entry when the fallback is also missing', () => {
    expect(pickDefault(['EUR', 'GBP'], '', 'USD')).toBe('EUR')
  })
})

describe('converterReducer', () => {
  it('starts with the expected defaults', () => {
    expect(initialConverterState).toEqual({
      tab: 'exchange',
      amount: '0',
      from: '',
      to: '',
      history: { items: expect.any(Array), selected: 0 },
    })
    expect(initialConverterState.history.items.length).toBe(7)
  })

  it('applies defaults from the currency list, but never overwrites a current value', () => {
    const next = converterReducer(
      { ...initialConverterState, from: 'GBP', to: 'JPY' },
      { type: 'currenciesLoaded', currencies: ['EUR', 'USD', 'GBP', 'JPY'] },
    )
    expect(next.from).toBe('GBP')
    expect(next.to).toBe('JPY')
  })

  it('falls back to USD and EUR when nothing was set', () => {
    const next = converterReducer(initialConverterState, {
      type: 'currenciesLoaded',
      currencies: ['EUR', 'USD', 'GBP', 'PLN'],
    })
    expect(next.from).toBe('USD')
    expect(next.to).toBe('EUR')
  })

  it('switches the tab', () => {
    const next = converterReducer(initialConverterState, { type: 'setTab', tab: 'history' })
    expect(next.tab).toBe('history')
  })

  it('routes amountKey to reduceAmount', () => {
    let state = converterReducer(initialConverterState, { type: 'amountKey', key: '5' })
    expect(state.amount).toBe('5')
    state = converterReducer(state, { type: 'amountKey', key: '0' })
    expect(state.amount).toBe('50')
    state = converterReducer(state, { type: 'amountKey', key: 'backspace' })
    expect(state.amount).toBe('5')
  })

  it('loadFromRecord sets from, to, amount, and tab in ONE update', () => {
    const record = createHistoryRecord({
      from: 'GBP',
      to: 'PLN',
      amount: '250',
      result: '1271.72',
    })
    const next = converterReducer(
      { ...initialConverterState, tab: 'history', amount: '99' },
      { type: 'loadFromRecord', record },
    )
    expect(next).toMatchObject({
      tab: 'exchange',
      from: 'GBP',
      to: 'PLN',
      amount: '250',
    })
  })

  it('saves a record and selects the new entry', () => {
    const record = createHistoryRecord({
      from: 'USD',
      to: 'EUR',
      amount: '1',
      result: '0.92',
    })
    const next = converterReducer(initialConverterState, { type: 'historySave', record })
    expect(next.history.items[next.history.items.length - 1]).toBe(record)
    expect(next.history.selected).toBe(next.history.items.length - 1)
  })
})
