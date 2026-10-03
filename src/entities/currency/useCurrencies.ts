import { useEffect, useState } from 'react'

interface RatesResponse {
  base: string
  currencies: string[]
  rates: Record<string, string>
  updatedAt: string
}

export interface CurrenciesState {
  list: string[]
  error: string | null
  loading: boolean
  retry: () => void
}

export function useCurrencies(): CurrenciesState {
  const [list, setList] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const res = await fetch('/api/rates', { signal: controller.signal })
        if (!res.ok) {
          if (!controller.signal.aborted) {
            setError(`Failed to load rates: ${res.status}`)
            setLoading(false)
          }
          return
        }
        const data = (await res.json()) as RatesResponse
        if (controller.signal.aborted) return
        setList(data.currencies)
        setLoading(false)
      } catch (err) {
        if (controller.signal.aborted) return
        if (err instanceof Error && err.name === 'AbortError') return
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        setLoading(false)
      }
    })()

    return () => {
      controller.abort()
    }
  }, [nonce])

  return { list, error, loading, retry: () => setNonce((n) => n + 1) }
}
