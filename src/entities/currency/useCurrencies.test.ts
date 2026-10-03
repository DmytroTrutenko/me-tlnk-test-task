import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCurrencies } from './useCurrencies'

const flushPromises = () => new Promise((r) => setTimeout(r, 0))

function mockFetchOnce(impl: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>) = vi.fn((url, init) =>
    Promise.resolve(impl(url as string, init)),
  )
}

describe('useCurrencies', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts loading and exposes the list on success', async () => {
    mockFetchOnce(
      () =>
        new Response(
          JSON.stringify({
            base: 'EUR',
            currencies: ['EUR', 'USD', 'GBP'],
            rates: { EUR: '1', USD: '1.08', GBP: '0.85' },
            updatedAt: '2026-01-01T00:00:00.000Z',
          }),
          { status: 200 },
        ),
    )

    const { result } = renderHook(() => useCurrencies())
    expect(result.current.loading).toBe(true)
    expect(result.current.list).toEqual([])

    await act(async () => {
      await flushPromises()
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.list).toEqual(['EUR', 'USD', 'GBP'])
    expect(result.current.error).toBeNull()
  })

  it('surfaces an error on a non-2xx response', async () => {
    mockFetchOnce(() => new Response('boom', { status: 500 }))

    const { result } = renderHook(() => useCurrencies())

    await act(async () => {
      await flushPromises()
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.error).toMatch(/500/)
    expect(result.current.list).toEqual([])
  })

  it('retry() triggers another fetch', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => Promise.resolve(new Response('boom', { status: 500 })))
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              base: 'EUR',
              currencies: ['EUR', 'USD'],
              rates: { EUR: '1', USD: '1' },
              updatedAt: '2026-01-01T00:00:00.000Z',
            }),
            { status: 200 },
          ),
        ),
      )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { result } = renderHook(() => useCurrencies())

    await act(async () => {
      await flushPromises()
    })

    await waitFor(() => {
      expect(result.current.error).toMatch(/500/)
    })

    await act(async () => {
      result.current.retry()
      await flushPromises()
    })

    await waitFor(() => {
      expect(result.current.list).toEqual(['EUR', 'USD'])
    })
    expect(result.current.error).toBeNull()
  })
})
