import { describe, expect, it } from 'vitest'
import {
  createHistoryRecord,
  historyReducer,
  initialHistory,
  initialState,
  type HistoryAction,
  type HistoryState,
} from './history'

const sample = (
  overrides: Partial<{ from: string; to: string; amount: string; result: string }> = {},
) =>
  createHistoryRecord({
    from: 'USD',
    to: 'EUR',
    amount: '100',
    result: '92.25',
    ...overrides,
  })

const save = (state: HistoryState, overrides: Parameters<typeof sample>[0] = {}) => {
  const record = sample(overrides)
  return historyReducer(state, { type: 'save', record } as HistoryAction)
}

describe('initial state', () => {
  it('starts with the seed history', () => {
    expect(initialState.items).toBe(initialHistory)
    expect(initialState.selected).toBe(0)
  })

  it('keeps seven seed records with sequential ids and raw values', () => {
    expect(initialState.items).toHaveLength(7)
    const ids = initialState.items.map((r) => r.id)
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(initialState.items[0]).toMatchObject({
      from: 'USD',
      to: 'EUR',
      amount: '1000',
      result: '922.25',
    })
  })
})

describe('clear', () => {
  it('empties the list and resets the selection', () => {
    const cleared = historyReducer(initialState, { type: 'clear' })
    expect(cleared.items).toEqual([])
    expect(cleared.selected).toBe(0)
  })

  it('is a no-op on an empty list', () => {
    const empty: HistoryState = { items: [], selected: 0 }
    expect(historyReducer(empty, { type: 'clear' })).toEqual({
      items: [],
      selected: 0,
    })
  })
})

describe('save', () => {
  it('appends the record and selects the new entry', () => {
    const next = save(initialState)
    expect(next.items).toHaveLength(initialState.items.length + 1)
    expect(next.selected).toBe(initialState.items.length)
    expect(next.items[next.selected]).toEqual(next.items[next.items.length - 1])
  })

  it('saves onto an empty history with selected 0', () => {
    const empty: HistoryState = { items: [], selected: 0 }
    const next = save(empty)
    expect(next.items).toHaveLength(1)
    expect(next.selected).toBe(0)
  })

  it('stores the record exactly as given (no id reassignment)', () => {
    const record = sample({ from: 'AAA', to: 'BBB', amount: '1', result: '2' })
    const next = historyReducer(initialState, { type: 'save', record })
    expect(next.items[next.items.length - 1]).toBe(record)
  })

  it('uses the ids from createHistoryRecord, so they increase with each save', () => {
    const first = save(initialState)
    const second = save(first)
    const firstId = first.items[first.items.length - 1].id
    const secondId = second.items[second.items.length - 1].id
    expect(secondId).toBeGreaterThan(firstId)
  })
})

describe('removeSelected', () => {
  it('is safe on an empty list (selected stays 0, never -1)', () => {
    const empty: HistoryState = { items: [], selected: 0 }
    const next = historyReducer(empty, { type: 'removeSelected' })
    expect(next.items).toEqual([])
    expect(next.selected).toBe(0)
    expect(next.selected).toBeGreaterThanOrEqual(0)
  })

  it('removes the first record and keeps the selection at index 0', () => {
    const before: HistoryState = { items: [...initialState.items], selected: 0 }
    const after = historyReducer(before, { type: 'removeSelected' })
    expect(after.items).toHaveLength(before.items.length - 1)
    expect(after.items[0]).toBe(before.items[1])
    expect(after.selected).toBe(0)
  })

  it('removes a middle record and moves selection to the next record', () => {
    const before: HistoryState = { items: [...initialState.items], selected: 1 }
    const after = historyReducer(before, { type: 'removeSelected' })
    expect(after.items).toHaveLength(before.items.length - 1)
    expect(after.items[after.selected]).toBe(before.items[2])
    expect(after.selected).toBe(1)
  })

  it('removes the last record and moves selection to the previous one', () => {
    const last = initialState.items.length - 1
    const before: HistoryState = { items: [...initialState.items], selected: last }
    const lastId = before.items[before.items.length - 1].id
    const after = historyReducer(before, { type: 'removeSelected' })
    expect(after.items).toHaveLength(before.items.length - 1)
    expect(after.items[after.items.length - 1].id).not.toBe(lastId)
    expect(after.selected).toBe(after.items.length - 1)
  })
})

describe('move', () => {
  it('is safe on an empty list (selected stays 0, never -1)', () => {
    const empty: HistoryState = { items: [], selected: 0 }
    expect(historyReducer(empty, { type: 'move', direction: 'up' })).toEqual({
      items: [],
      selected: 0,
    })
    expect(historyReducer(empty, { type: 'move', direction: 'down' })).toEqual({
      items: [],
      selected: 0,
    })
  })

  it('clamps at 0 when moving up from the first item', () => {
    const before: HistoryState = { items: [...initialState.items], selected: 0 }
    const after = historyReducer(before, { type: 'move', direction: 'up' })
    expect(after.selected).toBe(0)
  })

  it('clamps at the last index when moving down from the last item', () => {
    const last = initialState.items.length - 1
    const before: HistoryState = { items: [...initialState.items], selected: last }
    const after = historyReducer(before, { type: 'move', direction: 'down' })
    expect(after.selected).toBe(last)
  })

  it('moves up by one', () => {
    const before: HistoryState = { items: [...initialState.items], selected: 3 }
    const after = historyReducer(before, { type: 'move', direction: 'up' })
    expect(after.selected).toBe(2)
  })

  it('moves down by one', () => {
    const before: HistoryState = { items: [...initialState.items], selected: 3 }
    const after = historyReducer(before, { type: 'move', direction: 'down' })
    expect(after.selected).toBe(4)
  })
})
