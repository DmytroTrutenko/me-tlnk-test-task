export interface HistoryRecord {
  id: number
  from: string
  to: string
  amount: string
  result: string
}

type HistoryRecordInput = Omit<HistoryRecord, 'id'>

const SEED_DATA: HistoryRecordInput[] = [
  { from: 'USD', to: 'EUR', amount: '1000', result: '922.25' },
  { from: 'EUR', to: 'USD', amount: '500', result: '542.15' },
  { from: 'GBP', to: 'PLN', amount: '250', result: '1271.72' },
  { from: 'PLN', to: 'EUR', amount: '12500', result: '2921.18' },
  { from: 'SEK', to: 'GBP', amount: '3400', result: '254.49' },
  { from: 'EUR', to: 'JPY', amount: '75', result: '12185.25' },
  { from: 'USD', to: 'SEK', amount: '2750', result: '28503.07' },
]

function buildSeed(): HistoryRecord[] {
  return SEED_DATA.map((data, i) => ({ id: i + 1, ...data }))
}

export const initialHistory: HistoryRecord[] = buildSeed()

let nextIdValue = initialHistory.length + 1

export function nextHistoryId(): number {
  return nextIdValue++
}

export function createHistoryRecord(data: HistoryRecordInput): HistoryRecord {
  return { id: nextHistoryId(), ...data }
}

export interface HistoryState {
  items: HistoryRecord[]
  selected: number
}

export const initialState: HistoryState = { items: initialHistory, selected: 0 }

export type HistoryAction =
  | { type: 'save'; record: HistoryRecordInput }
  | { type: 'removeSelected' }
  | { type: 'clear' }
  | { type: 'move'; direction: 'up' | 'down' }

function clampSelected(items: HistoryRecord[], selected: number): number {
  if (items.length === 0) return 0
  return Math.max(0, Math.min(selected, items.length - 1))
}

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'clear':
      return { items: [], selected: 0 }
    case 'removeSelected': {
      if (state.items.length === 0) return { items: [], selected: 0 }
      const newItems = state.items.filter((_, i) => i !== state.selected)
      const newSelected = clampSelected(newItems, state.selected)
      return { items: newItems, selected: newSelected }
    }
    case 'move': {
      if (state.items.length === 0) return { items: [], selected: 0 }
      if (action.direction === 'up') {
        return {
          ...state,
          selected: Math.max(0, state.selected - 1),
        }
      }
      return {
        ...state,
        selected: Math.min(state.items.length - 1, state.selected + 1),
      }
    }
    case 'save': {
      const record = createHistoryRecord(action.record)
      return {
        items: [...state.items, record],
        selected: state.items.length,
      }
    }
  }
}
