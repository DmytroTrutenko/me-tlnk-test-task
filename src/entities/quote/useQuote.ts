import { useCallback, useEffect, useRef, useState } from 'react'
import { parseAmount } from '@/shared/lib/money'
import { useDebouncedValue } from '@/shared/lib/debounce'

export interface Quote {
  quoteId: string
  from: string
  to: string
  rate: string
  amount: number
  createdAt: string
  expiresAt: string
}

export type QuoteError = { status: number; message: string }

interface QuoteResponse {
  key: string
  quote?: Quote
  error?: QuoteError
}

export type RequestKey = string

function buildKey(from: string, to: string, normalizedAmount: string, nonce: number): RequestKey {
  return `${from}|${to}|${normalizedAmount}|${nonce}`
}

export function normalizeAmount(amount: string): string {
  return parseAmount(amount).toString()
}

export interface UseQuoteResult {
  quote: Quote | null
  error: QuoteError | null
  loading: boolean
  refresh: () => void
}

export function useQuote(from: string, to: string, amount: string): UseQuoteResult {
  const [response, setResponse] = useState<QuoteResponse | null>(null)
  const [nonce, setNonce] = useState(0)
  const debouncedAmount = useDebouncedValue(amount, 300)
  const loadingRef = useRef(false)
  const lastFetchedKeyRef = useRef<RequestKey | null>(null)

  const normalizedDebounced = normalizeAmount(debouncedAmount)
  const currentKey = buildKey(from, to, normalizedDebounced, nonce)

  const isTyping = amount !== debouncedAmount

  useEffect(() => {
    if (isTyping) return
    if (from === '' || to === '') return
    if (lastFetchedKeyRef.current === currentKey) return

    const controller = new AbortController()
    const requestKey = currentKey
    lastFetchedKeyRef.current = requestKey
    loadingRef.current = true

    void (async () => {
      try {
        const res = await fetch('/api/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from, to, amount: Number(normalizedDebounced) }),
          signal: controller.signal,
        })
        if (!res.ok) {
          const message = `Quote request failed: ${res.status}`
          if (!controller.signal.aborted) {
            setResponse({ key: requestKey, error: { status: res.status, message } })
          }
          return
        }
        const data = (await res.json()) as Quote
        if (controller.signal.aborted) return
        setResponse({ key: requestKey, quote: data })
      } catch (err) {
        if (controller.signal.aborted) return
        if (err instanceof Error && err.name === 'AbortError') return
        const message = err instanceof Error ? err.message : 'Unknown error'
        setResponse({ key: requestKey, error: { status: 0, message } })
      } finally {
        if (!controller.signal.aborted) {
          loadingRef.current = false
        }
      }
    })()

    return () => {
      controller.abort()
    }
  }, [from, to, normalizedDebounced, nonce, isTyping, currentKey])

  const refresh = useCallback(() => {
    if (loadingRef.current) return
    setNonce((n) => n + 1)
  }, [])

  const isCurrent = response !== null && response.key === currentKey
  const quote = isCurrent && response && response.quote ? response.quote : null
  const error = isCurrent && response && response.error ? response.error : null
  const loading = isTyping || !isCurrent || response === null

  return { quote, error, loading, refresh }
}
