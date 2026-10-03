import { type ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

export interface PendingRequest {
  url: string
  init: RequestInit | undefined
  resolve: (response: Response) => void
  reject: (reason: unknown) => void
  body: unknown
}

export interface FetchMockHandle {
  fetchMock: ReturnType<typeof vi.fn>
  pending: PendingRequest[]
  resolveNext: (response: Response | (() => Response)) => void
  rejectNext: (reason: unknown) => void
  resolveByIndex: (index: number, response: Response | (() => Response)) => void
  resolveAll: (response: Response | (() => Response)) => void
  setRatesResolver: (resolver: (() => Response) | Response) => void
}

export function buildQuoteResponse(args: {
  from: string
  to: string
  rate: string
  amount: number
  quoteId?: string
  createdAt?: string
  expiresAt?: string
}): Response {
  const body = {
    quoteId: args.quoteId ?? 'q-' + Math.random().toString(36).slice(2, 8),
    from: args.from,
    to: args.to,
    rate: args.rate,
    amount: args.amount,
    createdAt: args.createdAt ?? new Date().toISOString(),
    expiresAt: args.expiresAt ?? new Date(Date.now() + 30000).toISOString(),
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function buildRatesResponse(currencies: string[]): Response {
  const rates: Record<string, string> = {}
  for (const c of currencies) rates[c] = '1'
  return new Response(
    JSON.stringify({
      base: 'USD',
      currencies,
      rates,
      updatedAt: new Date().toISOString(),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

export function setupFetchMock(
  initialCurrencies: string[] = ['USD', 'EUR', 'GBP', 'PLN'],
): FetchMockHandle {
  const pending: PendingRequest[] = []
  let ratesResolver: (() => Response) | Response = () => buildRatesResponse(initialCurrencies)
  let ratesSettled = false

  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const stringUrl = String(url)
    if (stringUrl.includes('/api/rates')) {
      return new Promise<Response>((resolve) => {
        if (ratesSettled) {
          const r = typeof ratesResolver === 'function' ? ratesResolver() : ratesResolver
          resolve(r)
        } else {
          ratesSettled = true
          const r = typeof ratesResolver === 'function' ? ratesResolver() : ratesResolver
          queueMicrotask(() => resolve(r))
        }
      })
    }

    return new Promise<Response>((resolve, reject) => {
      let body: unknown = undefined
      if (init?.body && typeof init.body === 'string') {
        try {
          body = JSON.parse(init.body)
        } catch {
          body = init.body
        }
      }
      pending.push({ url: stringUrl, init, resolve, reject, body })
    })
  })

  vi.stubGlobal('fetch', fetchMock)

  const resolveAt = (index: number, response: Response | (() => Response)) => {
    const item = pending[index]
    if (!item) throw new Error(`No pending request at index ${index}`)
    pending.splice(index, 1)
    const r = typeof response === 'function' ? response() : response
    item.resolve(r)
  }

  return {
    fetchMock,
    pending,
    resolveNext: (response) => {
      if (pending.length === 0) throw new Error('No pending request to resolve')
      const item = pending.shift()!
      const r = typeof response === 'function' ? response() : response
      item.resolve(r)
    },
    rejectNext: (reason) => {
      if (pending.length === 0) throw new Error('No pending request to reject')
      const item = pending.shift()!
      item.reject(reason)
    },
    resolveByIndex: resolveAt,
    resolveAll: (response) => {
      while (pending.length > 0) {
        const item = pending.shift()!
        const r = typeof response === 'function' ? response() : response
        item.resolve(r)
      }
    },
    setRatesResolver: (resolver) => {
      ratesResolver = resolver
      ratesSettled = false
    },
  }
}

export function setupRender(ui: ReactElement, options?: RenderOptions) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const result = render(ui, options)
  return { user, ...result }
}

export async function advanceDebounce() {
  await vi.advanceTimersByTimeAsync(300)
}

export async function flushMicrotasks() {
  for (let i = 0; i < 10; i += 1) {
    await vi.advanceTimersByTimeAsync(0)
  }
}
