import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  createHistoryRecord,
  historyReducer,
  initialState as initialHistoryState,
  type HistoryRecord,
  type HistoryState,
} from '@/entities/history-record'
import type { Quote, QuoteError } from '@/entities/quote'
import { useCurrencies } from '@/entities/currency'
import { useQuote } from '@/entities/quote'
import { MAX_DIGITS, reduceAmount, type AmountKey } from '@/shared/lib/amount'
import { convert, formatMoney, isZero } from '@/shared/lib/money'
import type { KeyId, TabId } from '@/shared/lib/constants'
import { isDigitKey } from '@/shared/lib/constants'

const DEFAULT_FROM = 'USD'
const DEFAULT_TO = 'EUR'

function pickDefault(currencies: string[], current: string, fallback: string): string {
  if (current && currencies.includes(current)) return current
  if (currencies.includes(fallback)) return fallback
  return currencies[0] ?? fallback
}

interface ConverterState {
  tab: TabId
  amount: string
  from: string
  to: string
  history: HistoryState
}

type ConverterAction =
  | { type: 'setTab'; tab: TabId }
  | { type: 'setFrom'; from: string }
  | { type: 'setTo'; to: string }
  | { type: 'amountKey'; key: AmountKey }
  | { type: 'amountSet'; amount: string }
  | { type: 'currenciesLoaded'; currencies: string[] }
  | { type: 'historyClear' }
  | { type: 'historyRemove' }
  | { type: 'historyMove'; direction: 'up' | 'down' }
  | { type: 'historySave'; record: HistoryRecord }
  | { type: 'loadFromRecord'; record: HistoryRecord }

const initialConverterState: ConverterState = {
  tab: 'exchange',
  amount: '0',
  from: '',
  to: '',
  history: initialHistoryState,
}

function converterReducer(state: ConverterState, action: ConverterAction): ConverterState {
  switch (action.type) {
    case 'setTab':
      return { ...state, tab: action.tab }
    case 'setFrom':
      return { ...state, from: action.from }
    case 'setTo':
      return { ...state, to: action.to }
    case 'amountKey':
      return { ...state, amount: reduceAmount(state.amount, action.key) }
    case 'amountSet':
      return { ...state, amount: action.amount }
    case 'currenciesLoaded':
      return {
        ...state,
        from: pickDefault(action.currencies, state.from, DEFAULT_FROM),
        to: pickDefault(action.currencies, state.to, DEFAULT_TO),
      }
    case 'historyClear':
      return { ...state, history: historyReducer(state.history, { type: 'clear' }) }
    case 'historyRemove':
      return { ...state, history: historyReducer(state.history, { type: 'removeSelected' }) }
    case 'historyMove':
      return {
        ...state,
        history: historyReducer(state.history, { type: 'move', direction: action.direction }),
      }
    case 'historySave':
      return {
        ...state,
        history: historyReducer(state.history, { type: 'save', record: action.record }),
      }
    case 'loadFromRecord':
      return {
        ...state,
        tab: 'exchange',
        from: action.record.from,
        to: action.record.to,
        amount: action.record.amount,
      }
  }
}

export interface UseConverterResult {
  tab: TabId
  amount: string
  from: string
  to: string
  history: HistoryRecord[]
  selected: number
  currencies: string[]
  currenciesLoading: boolean
  currenciesError: string | null
  retryCurrencies: () => void
  quote: Quote | null
  quoteError: QuoteError | null
  quoteLoading: boolean
  refreshQuote: () => void
  result: string
  resultState: 'loading' | 'error' | 'ready'
  updatedAt: string | null
  ageLabel: string
  canSave: boolean
  isInitialLoad: boolean
  applyKey: (id: KeyId) => void
  setTab: (tab: TabId) => void
  setFrom: (from: string) => void
  setTo: (to: string) => void
}

function buildResultLabel(now: number, lastSuccessAt: Date | null, loading: boolean): string {
  if (loading) return 'Updating…'
  if (lastSuccessAt === null) return '—'
  const minutes = Math.floor((now - lastSuccessAt.getTime()) / 60000)
  if (minutes <= 0) return 'just now'
  if (minutes === 1) return '1 min ago'
  return `${minutes} min ago`
}

export function useConverter(): UseConverterResult {
  const [state, dispatch] = useReducer(converterReducer, initialConverterState)
  const { tab, amount, from, to, history } = state
  const historyItems = history.items
  const selected = history.selected

  const {
    list: currencies,
    error: currenciesError,
    loading: currenciesLoading,
    retry: retryCurrencies,
  } = useCurrencies()

  useEffect(() => {
    if (currencies.length > 0) {
      dispatch({ type: 'currenciesLoaded', currencies })
    }
  }, [currencies])

  const {
    quote,
    error: quoteError,
    loading: quoteLoading,
    refresh: refreshQuote,
  } = useQuote(from, to, amount)

  const [lastSuccessAt, setLastSuccessAt] = useState<Date | null>(null)
  const lastQuoteIdRef = useRef<string | null>(null)
  const firstQuoteSettledRef = useRef(false)

  useEffect(() => {
    if (quote && quote.quoteId !== lastQuoteIdRef.current) {
      lastQuoteIdRef.current = quote.quoteId
      setLastSuccessAt(new Date(quote.createdAt))
    }
  }, [quote])

  useEffect(() => {
    if (!firstQuoteSettledRef.current && (quote !== null || quoteError !== null)) {
      firstQuoteSettledRef.current = true
    }
  }, [quote, quoteError])

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(id)
  }, [])

  const result = useMemo(() => {
    if (quote && quote.rate) {
      return formatMoney(convert(amount, quote.rate))
    }
    return '0'
  }, [amount, quote])

  const resultState: 'loading' | 'error' | 'ready' = quoteError
    ? 'error'
    : quoteLoading
      ? 'loading'
      : quote
        ? 'ready'
        : 'loading'

  const canSave = useMemo(
    () => !quoteLoading && quote !== null && !quoteError && !isZero(amount),
    [quoteLoading, quote, quoteError, amount],
  )

  const applyKey = useCallback(
    (id: KeyId) => {
      if (isDigitKey(id)) {
        if (tab === 'exchange') {
          const amountKey: AmountKey = id === 'dot' ? '.' : id
          dispatch({ type: 'amountKey', key: amountKey })
        }
        return
      }

      switch (id) {
        case 'backspace':
          if (tab === 'exchange') {
            dispatch({ type: 'amountKey', key: 'backspace' })
          } else {
            dispatch({ type: 'historyRemove' })
          }
          return
        case 'clear':
          if (tab === 'exchange') {
            dispatch({ type: 'amountKey', key: 'clear' })
          } else {
            dispatch({ type: 'historyClear' })
          }
          return
        case 'save':
          if (tab === 'exchange') {
            if (!canSave || !quote) return
            const rawResult = convert(amount, quote.rate)
            const record = createHistoryRecord({ from, to, amount, result: rawResult })
            dispatch({ type: 'historySave', record })
          }
          return
        case 'up':
          if (tab === 'history') dispatch({ type: 'historyMove', direction: 'up' })
          return
        case 'down':
          if (tab === 'history') dispatch({ type: 'historyMove', direction: 'down' })
          return
        case 'ok': {
          if (tab !== 'history') return
          const record = historyItems[selected]
          if (record) {
            dispatch({ type: 'loadFromRecord', record })
          }
          return
        }
        default:
          return
      }
    },
    [tab, canSave, quote, amount, from, to, historyItems, selected],
  )

  const setTab = useCallback((next: TabId) => dispatch({ type: 'setTab', tab: next }), [])
  const setFrom = useCallback((next: string) => dispatch({ type: 'setFrom', from: next }), [])
  const setTo = useCallback((next: string) => dispatch({ type: 'setTo', to: next }), [])

  const ageLabel = buildResultLabel(now, lastSuccessAt, quoteLoading)

  const isInitialLoad =
    (currenciesLoading && currencies.length === 0) ||
    (currencies.length > 0 && !currenciesError && !firstQuoteSettledRef.current)

  return {
    tab,
    amount,
    from,
    to,
    history: historyItems,
    selected,
    currencies,
    currenciesLoading,
    currenciesError,
    retryCurrencies,
    quote,
    quoteError,
    quoteLoading,
    refreshQuote,
    result,
    resultState,
    updatedAt: lastSuccessAt ? lastSuccessAt.toISOString() : null,
    ageLabel,
    canSave,
    isInitialLoad,
    applyKey,
    setTab,
    setFrom,
    setTo,
  }
}

// Exposed for tests
export { MAX_DIGITS, pickDefault, converterReducer, initialConverterState }
export type { ConverterAction, ConverterState }
