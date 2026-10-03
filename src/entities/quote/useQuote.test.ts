import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuote } from './useQuote'

const flushMicrotasks = async () => {
  for (let i = 0; i < 20; i += 1) {
    await vi.advanceTimersByTimeAsync(0)
  }
}
const advanceDebounce = async () => {
  await vi.advanceTimersByTimeAsync(300)
}

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>) = vi.fn((url, init) =>
    Promise.resolve(impl(url as string, init)),
  )
}

function mockFetchDeferred() {
  let resolveFetch: (value: Response) => void = () => {}
  const fetchMock = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        resolveFetch = resolve
      }),
  )
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return { fetchMock, resolve: (value: Response) => resolveFetch(value) }
}

describe('useQuote', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('is loading until the first request resolves', async () => {
    const { resolve: resolveFetch } = mockFetchDeferred()

    const { result } = renderHook(({ amount }) => useQuote('EUR', 'USD', amount), {
      initialProps: { amount: '100' },
    })

    expect(result.current.loading).toBe(true)
    expect(result.current.quote).toBeNull()
    expect(result.current.error).toBeNull()

    await act(async () => {
      resolveFetch(
        new Response(
          JSON.stringify({
            quoteId: 'q1',
            from: 'EUR',
            to: 'USD',
            rate: '1.083012',
            amount: 100,
            createdAt: '2026-01-01T00:00:00.000Z',
            expiresAt: '2026-01-01T00:00:30.000Z',
          }),
          { status: 200 },
        ),
      )
      await flushMicrotasks()
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.quote?.rate).toBe('1.083012')
  })

  it('treats "1", "1.0", "1." as the same request', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            quoteId: 'q',
            from: 'EUR',
            to: 'USD',
            rate: '1.0',
            amount: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            expiresAt: '2026-01-01T00:00:30.000Z',
          }),
          { status: 200 },
        ),
      ),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { rerender } = renderHook(({ amount }) => useQuote('EUR', 'USD', amount), {
      initialProps: { amount: '1' },
    })

    await act(async () => {
      await advanceDebounce()
      await flushMicrotasks()
    })

    const initialCalls = fetchMock.mock.calls.length

    rerender({ amount: '1.0' })
    await act(async () => {
      await advanceDebounce()
      await flushMicrotasks()
    })
    expect(fetchMock.mock.calls.length).toBe(initialCalls)

    rerender({ amount: '1.' })
    await act(async () => {
      await advanceDebounce()
      await flushMicrotasks()
    })
    expect(fetchMock.mock.calls.length).toBe(initialCalls)
  })

  it('exposes loading=true while the typed amount differs from the debounced amount', async () => {
    const { fetchMock, resolve: resolveFetch } = mockFetchDeferred()

    const { result, rerender } = renderHook(({ amount }) => useQuote('EUR', 'USD', amount), {
      initialProps: { amount: '1' },
    })

    expect(result.current.loading).toBe(true)

    await act(async () => {
      await advanceDebounce()
      await flushMicrotasks()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFetch(
        new Response(
          JSON.stringify({
            quoteId: 'q',
            from: 'EUR',
            to: 'USD',
            rate: '1.0',
            amount: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            expiresAt: '2026-01-01T00:00:30.000Z',
          }),
          { status: 200 },
        ),
      )
      await flushMicrotasks()
    })

    expect(result.current.loading).toBe(false)

    rerender({ amount: '12' })
    expect(result.current.loading).toBe(true)

    rerender({ amount: '123' })
    expect(result.current.loading).toBe(true)

    await act(async () => {
      await advanceDebounce()
      await flushMicrotasks()
    })

    expect(result.current.loading).toBe(true)
  })

  it('ignores an out-of-date response when the key has changed', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      const body = init?.body as string | undefined
      const parsed = body ? (JSON.parse(body) as { amount: number }) : { amount: 0 }
      const rate = parsed.amount === 1 ? '1.0' : '2.0'
      return Promise.resolve(
        new Response(
          JSON.stringify({
            quoteId: 'q',
            from: 'EUR',
            to: 'USD',
            rate,
            amount: parsed.amount,
            createdAt: '2026-01-01T00:00:00.000Z',
            expiresAt: '2026-01-01T00:00:30.000Z',
          }),
          { status: 200 },
        ),
      )
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { result, rerender } = renderHook(({ amount }) => useQuote('EUR', 'USD', amount), {
      initialProps: { amount: '1' },
    })

    await act(async () => {
      await advanceDebounce()
      await flushMicrotasks()
    })

    expect(result.current.quote?.rate).toBe('1.0')

    rerender({ amount: '2' })
    rerender({ amount: '3' })
    await act(async () => {
      await advanceDebounce()
      await flushMicrotasks()
    })

    expect(result.current.quote?.rate).toBe('2.0')
  })

  it('surfaces an error and loading=false on a non-2xx response', async () => {
    mockFetch(() => new Response('boom', { status: 500 }))

    const { result } = renderHook(() => useQuote('EUR', 'USD', '100'))

    await act(async () => {
      await advanceDebounce()
      await flushMicrotasks()
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.error?.status).toBe(500)
    expect(result.current.quote).toBeNull()
  })

  it('refresh() bumps the nonce and triggers a new request', async () => {
    mockFetch(
      () =>
        new Response(
          JSON.stringify({
            quoteId: 'q1',
            from: 'EUR',
            to: 'USD',
            rate: '1.0',
            amount: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            expiresAt: '2026-01-01T00:00:30.000Z',
          }),
          { status: 200 },
        ),
    )

    const { result } = renderHook(() => useQuote('EUR', 'USD', '1'))

    await act(async () => {
      await advanceDebounce()
      await flushMicrotasks()
    })

    expect(result.current.loading).toBe(false)

    const callsAfterFirst = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
      .length

    act(() => {
      result.current.refresh()
    })

    await act(async () => {
      await flushMicrotasks()
    })

    const callsAfterRefresh = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
      .length
    expect(callsAfterRefresh).toBe(callsAfterFirst + 1)
  })

  it('passes amount as a JSON number, not a string', async () => {
    mockFetch(
      () =>
        new Response(
          JSON.stringify({
            quoteId: 'q',
            from: 'EUR',
            to: 'USD',
            rate: '1.0',
            amount: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            expiresAt: '2026-01-01T00:00:30.000Z',
          }),
          { status: 200 },
        ),
    )
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>

    renderHook(() => useQuote('EUR', 'USD', '1'))

    await act(async () => {
      await advanceDebounce()
      await flushMicrotasks()
    })

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    const body = init?.body as string
    const parsed = JSON.parse(body) as { amount: unknown }
    expect(typeof parsed.amount).toBe('number')
  })

  it('currency changes request immediately without debounce', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            quoteId: 'q',
            from: 'EUR',
            to: 'USD',
            rate: '1.0',
            amount: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            expiresAt: '2026-01-01T00:00:30.000Z',
          }),
          { status: 200 },
        ),
      ),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { rerender } = renderHook(({ to }) => useQuote('EUR', to, '1'), {
      initialProps: { to: 'USD' },
    })

    await act(async () => {
      await advanceDebounce()
      await flushMicrotasks()
    })

    const initialCalls = fetchMock.mock.calls.length

    rerender({ to: 'GBP' })
    await act(async () => {
      await flushMicrotasks()
    })
    expect(fetchMock.mock.calls.length).toBe(initialCalls + 1)
  })
})
