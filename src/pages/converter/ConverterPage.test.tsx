import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/app/App'
import {
  advanceDebounce,
  buildQuoteResponse,
  buildRatesResponse,
  flushMicrotasks,
  setupFetchMock,
  setupRender,
  type FetchMockHandle,
} from './test-utils/setup'

type Harness = {
  fetch: FetchMockHandle
  user: UserEvent
}

async function bootstrap(
  initialCurrencies: string[] = ['USD', 'EUR', 'GBP', 'PLN'],
): Promise<Harness> {
  const fetch = setupFetchMock(initialCurrencies)
  const user = setupRender(<App />).user
  await waitFor(() => {
    expect(fetch.fetchMock).toHaveBeenCalled()
  })
  await flushMicrotasks()
  return { fetch, user }
}

async function waitForPending(fetch: FetchMockHandle, count = 1) {
  await waitFor(() => {
    expect(fetch.pending.length).toBeGreaterThanOrEqual(count)
  })
  return fetch.pending[count - 1]!
}

function findQuoteRequest(
  fetch: FetchMockHandle,
  predicate: (b: { amount: number; from: string; to: string }) => boolean,
) {
  return fetch.pending.find((p) => {
    const b = p.body as { amount: number; from: string; to: string } | null
    return b != null && predicate(b)
  })
}

async function clearAllPending(fetch: FetchMockHandle) {
  await waitFor(() => {
    expect(fetch.pending.length).toBeGreaterThanOrEqual(1)
  })
  while (fetch.pending.length > 0) {
    const item = fetch.pending[0]!
    const body = item.body as { from: string; to: string; amount: number }
    fetch.resolveByIndex(
      0,
      buildQuoteResponse({ from: body.from, to: body.to, rate: '0.9', amount: body.amount }),
    )
  }
  await flushMicrotasks()
}

function readAmount(): string {
  return screen.getByTestId('amount').textContent ?? ''
}

function readResult(): string {
  return screen.getByTestId('result').textContent ?? ''
}

describe('ConverterPage integration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('1. Race: amount changes (regression for complaint about wrong amount)', () => {
    it('keeps the latest amount in the result, even if the older response lands second', async () => {
      const { fetch, user } = await bootstrap()

      // an initial quote for 0 may be in flight; clear it so we have a clean baseline
      await waitFor(() => {
        expect(fetch.pending.length).toBeGreaterThanOrEqual(1)
      })
      while (fetch.pending.length > 0) {
        const item = fetch.pending[0]!
        const body = item.body as { from: string; to: string; amount: number }
        fetch.resolveByIndex(
          0,
          buildQuoteResponse({ from: body.from, to: body.to, rate: '0.9', amount: body.amount }),
        )
      }
      await flushMicrotasks()

      await user.click(screen.getByTestId('key-7'))
      await advanceDebounce()
      await flushMicrotasks()
      const reqA = await waitForPending(fetch, 1)

      await user.click(screen.getByTestId('key-7'))
      await advanceDebounce()
      await flushMicrotasks()
      const reqB = await waitForPending(fetch, 2)
      expect(reqB).not.toBe(reqA)

      const bodyA = reqA.body as { amount: number; from: string; to: string }
      const bodyB = reqB.body as { amount: number; from: string; to: string }
      expect(bodyA.amount).toBe(7)
      expect(bodyB.amount).toBe(77)

      // resolve B first (rate 0.92 → 77*0.92=70.84)
      fetch.resolveByIndex(
        1,
        buildQuoteResponse({ from: bodyB.from, to: bodyB.to, rate: '0.92', amount: 77 }),
      )
      await flushMicrotasks()
      // then resolve A (rate 1.0 → 7)
      fetch.resolveByIndex(
        0,
        buildQuoteResponse({ from: bodyA.from, to: bodyA.to, rate: '1.00', amount: 7 }),
      )
      await flushMicrotasks()

      await waitFor(() => {
        expect(readResult()).toBe('70.84')
      })
      expect(readAmount()).toBe('77')
    })
  })

  describe('2. Race: currency change', () => {
    it('shows the result only for the current currency pair; "…" while waiting', async () => {
      const { fetch, user } = await bootstrap(['USD', 'EUR', 'GBP'])

      await advanceDebounce()
      await flushMicrotasks()
      const reqA = await waitForPending(fetch, 1)
      const bodyA = reqA.body as { from: string; to: string }
      expect(bodyA.from).toBe('USD')
      expect(bodyA.to).toBe('EUR')

      // change to GBP — fires a new request immediately
      const toSelect = screen.getByTestId('to-currency') as HTMLSelectElement
      await user.selectOptions(toSelect, 'GBP')
      await flushMicrotasks()
      const reqB = await waitForPending(fetch, 2)
      const bodyB = reqB.body as { from: string; to: string }
      expect(bodyB.from).toBe('USD')
      expect(bodyB.to).toBe('GBP')

      // resolve the older pair (USD->EUR) first; this is for the previous key so it should be ignored
      fetch.resolveByIndex(
        0,
        buildQuoteResponse({ from: 'USD', to: 'EUR', rate: '0.9', amount: 0 }),
      )
      await flushMicrotasks()
      // now the current pair has no response yet — the result should show "…"
      // (or "—" before any successful quote). The exact label is "…" because the current key has no response
      expect(readResult()).toMatch(/…|—/)
      expect((screen.getByTestId('to-currency') as HTMLSelectElement).value).toBe('GBP')

      // type "5" to drive a new request
      await user.click(screen.getByTestId('key-5'))
      await advanceDebounce()
      await flushMicrotasks()
      // find the pending request whose body is for the current pair
      const target = fetch.pending.find((p) => {
        const b = p.body as { from: string; to: string; amount: number }
        return b.from === 'USD' && b.to === 'GBP' && b.amount === 5
      })
      expect(target).toBeDefined()
      // resolve all pending with the current key in mind (the older ones with stale keys)
      while (fetch.pending.length > 0) {
        const item = fetch.pending[0]!
        const body = item.body as { from: string; to: string; amount: number }
        if (body.from === 'USD' && body.to === 'GBP' && body.amount === 5) {
          fetch.resolveByIndex(
            0,
            buildQuoteResponse({ from: 'USD', to: 'GBP', rate: '0.8', amount: 5 }),
          )
        } else {
          fetch.resolveByIndex(
            0,
            buildQuoteResponse({ from: body.from, to: body.to, rate: '0.8', amount: body.amount }),
          )
        }
      }
      await flushMicrotasks()

      await waitFor(() => {
        expect(readResult()).toBe('4')
      })
      expect((screen.getByTestId('to-currency') as HTMLSelectElement).value).toBe('GBP')
    })
  })

  describe('3. Request contract', () => {
    it('sends amount as JSON number, Content-Type application/json, and dedupes by normalized amount', async () => {
      const { fetch, user } = await bootstrap()
      await clearAllPending(fetch)

      await user.click(screen.getByTestId('key-1'))
      await advanceDebounce()
      await flushMicrotasks()
      const req1 = findQuoteRequest(fetch, (b) => b.amount === 1)
      expect(req1).toBeDefined()
      const body1 = req1!.body as { amount: number }
      expect(typeof body1.amount).toBe('number')
      expect(body1.amount).toBe(1)
      const headers1 = (req1!.init as RequestInit).headers as Record<string, string>
      expect(headers1['Content-Type']).toBe('application/json')

      // resolve to clear pending
      fetch.resolveAll(buildQuoteResponse({ from: 'USD', to: 'EUR', rate: '1', amount: 1 }))
      await flushMicrotasks()

      // press "." - normalized amount is still 1
      await user.click(screen.getByTestId('key-dot'))
      await advanceDebounce()
      await flushMicrotasks()

      // no new request for the same normalized amount
      await vi.advanceTimersByTimeAsync(50)
      const callsAfterDot = fetch.fetchMock.mock.calls.length
      // 1 rates call + 1 cleared initial quote + 1 new quote for "1" = 3 calls; dot should not add more
      expect(callsAfterDot).toBe(3)
    })
  })

  describe('4. Error handling', () => {
    it('shows "—" and an inline error on 500; refresh sends exactly one new request; refresh is ignored while loading', async () => {
      const { fetch, user } = await bootstrap()
      await clearAllPending(fetch)

      await user.click(screen.getByTestId('key-1'))
      await advanceDebounce()
      await flushMicrotasks()
      const req = findQuoteRequest(fetch, (b) => b.amount === 1)
      expect(req).toBeDefined()
      fetch.resolveByIndex(fetch.pending.indexOf(req!), new Response('boom', { status: 500 }))
      await flushMicrotasks()

      await waitFor(() => {
        expect(readResult()).toBe('—')
      })
      expect(screen.getByRole('status').textContent).toMatch(/couldn|try again/i)

      const callsBefore = fetch.fetchMock.mock.calls.length

      const refreshBtn = screen.getByTestId('refresh')
      expect(refreshBtn).not.toBeDisabled()
      await user.click(refreshBtn)
      await flushMicrotasks()

      await waitFor(() => {
        expect(fetch.pending.length).toBe(1)
      })
      const callsAfter = fetch.fetchMock.mock.calls.length
      expect(callsAfter).toBe(callsBefore + 1)

      // While loading, refresh is ignored
      const callsBeforeSecond = fetch.fetchMock.mock.calls.length
      await user.click(refreshBtn)
      await flushMicrotasks()
      expect(fetch.fetchMock.mock.calls.length).toBe(callsBeforeSecond)
    })
  })

  describe('5. Currency list', () => {
    it('default pair is USD -> EUR after load', async () => {
      await bootstrap()
      await waitFor(() => {
        expect((screen.getByTestId('from-currency') as HTMLSelectElement).value).toBe('USD')
        expect((screen.getByTestId('to-currency') as HTMLSelectElement).value).toBe('EUR')
      })
    })

    it('a failed list load shows a message and retry works', async () => {
      let first = true
      const fetch = setupFetchMock([])
      fetch.setRatesResolver(() => {
        if (first) {
          first = false
          return new Response('boom', { status: 500 })
        }
        return buildRatesResponse(['USD', 'EUR', 'GBP'])
      })
      const { user } = setupRender(<App />)
      await flushMicrotasks()

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      })

      const retryBtn = within(screen.getByRole('alert')!).getByRole('button', { name: /retry/i })
      await user.click(retryBtn)
      await flushMicrotasks()

      await waitFor(() => {
        expect((screen.getByTestId('from-currency') as HTMLSelectElement).value).toBe('USD')
      })
    })
  })

  describe('6. Tab switching', () => {
    it('a single digit after switching back adds exactly one digit', async () => {
      const { user } = await bootstrap()
      expect(readAmount()).toBe('0')

      await user.click(screen.getByTestId('tab-history'))
      await user.click(screen.getByTestId('tab-exchange'))

      await user.click(screen.getByTestId('key-3'))
      expect(readAmount()).toBe('3')
    })
  })

  describe('7. Complaint 2: OK from History restores the exact record', () => {
    it('loads USD 1000 -> EUR (seed), and amount does not change after OK', async () => {
      const { fetch, user } = await bootstrap()

      await user.click(screen.getByTestId('tab-history'))
      const items = screen.getAllByTestId('history-item')
      const first = items[0]!
      expect(first.textContent).toMatch(/USD 1,000/)

      await user.click(screen.getByTestId('key-ok'))
      expect(readAmount()).toBe('1000')
      expect((screen.getByTestId('from-currency') as HTMLSelectElement).value).toBe('USD')
      expect((screen.getByTestId('to-currency') as HTMLSelectElement).value).toBe('EUR')

      // Resolve all pending with a value (none should affect the amount string)
      await advanceDebounce()
      await flushMicrotasks()
      while (fetch.pending.length > 0) {
        const item = fetch.pending[0]!
        const body = item.body as { from: string; to: string; amount: number }
        fetch.resolveByIndex(
          0,
          buildQuoteResponse({ from: body.from, to: body.to, rate: '0.9', amount: body.amount }),
        )
      }
      await flushMicrotasks()
      expect(readAmount()).toBe('1000')
    })

    it('restores the 12500 PLN -> EUR large record', async () => {
      const { user } = await bootstrap()
      await user.click(screen.getByTestId('tab-history'))

      const items = screen.getAllByTestId('history-item')
      expect(items[3]!.textContent).toMatch(/PLN 12,500/)

      await user.click(screen.getByTestId('key-down'))
      await user.click(screen.getByTestId('key-down'))
      await user.click(screen.getByTestId('key-down'))

      await user.click(screen.getByTestId('key-ok'))

      expect(readAmount()).toBe('12500')
      expect((screen.getByTestId('from-currency') as HTMLSelectElement).value).toBe('PLN')
      expect((screen.getByTestId('to-currency') as HTMLSelectElement).value).toBe('EUR')
    })
  })

  describe('8. History operations', () => {
    it('delete selected moves to neighbor; C clears all; up/down clamps; empty disables keys; aria-selected exactly one; count label; record label format', async () => {
      const { user } = await bootstrap()
      await user.click(screen.getByTestId('tab-history'))

      const selected = screen
        .getAllByTestId('history-item')
        .filter((el) => el.getAttribute('aria-selected') === 'true')
      expect(selected).toHaveLength(1)

      const first = screen.getAllByTestId('history-item')[0]!
      expect(first.textContent).toBe('USD 1,000 → EUR 922.25')

      // delete first → selection stays at 0
      await user.click(screen.getByTestId('key-backspace'))
      const items2 = screen.getAllByTestId('history-item')
      const sel2 = items2.findIndex((el) => el.getAttribute('aria-selected') === 'true')
      expect(sel2).toBe(0)
      expect(items2[0]!.textContent).toBe('EUR 500 → USD 542.15')

      // move to middle then delete
      await user.click(screen.getByTestId('key-down'))
      await user.click(screen.getByTestId('key-backspace'))
      const items3 = screen.getAllByTestId('history-item')
      const sel3Idx = items3.findIndex((el) => el.getAttribute('aria-selected') === 'true')
      expect(sel3Idx).toBeGreaterThanOrEqual(0)
      // the item at sel3Idx should not be the old middle
      expect(items3[sel3Idx]!.textContent).not.toBe('GBP 250 → PLN 1,271.72')

      // move to last
      while (true) {
        const items = screen.getAllByTestId('history-item')
        const sel = items.findIndex((el) => el.getAttribute('aria-selected') === 'true')
        if (sel < items.length - 1) {
          await user.click(screen.getByTestId('key-down'))
        } else {
          break
        }
      }
      await user.click(screen.getByTestId('key-backspace'))
      const itemsAfter = screen.getAllByTestId('history-item')
      const selAfter = itemsAfter.findIndex((el) => el.getAttribute('aria-selected') === 'true')
      expect(selAfter).toBe(itemsAfter.length - 1)

      // up at top stays at 0
      while (true) {
        const items = screen.getAllByTestId('history-item')
        const sel = items.findIndex((el) => el.getAttribute('aria-selected') === 'true')
        if (sel > 0) {
          await user.click(screen.getByTestId('key-up'))
        } else {
          break
        }
      }
      await user.click(screen.getByTestId('key-up'))
      expect(
        screen
          .getAllByTestId('history-item')
          .findIndex((el) => el.getAttribute('aria-selected') === 'true'),
      ).toBe(0)

      // C clears all
      await user.click(screen.getByTestId('key-clear'))
      expect(screen.queryAllByTestId('history-item')).toHaveLength(0)
      expect(screen.getByTestId('history-count').textContent).toBe('0 records')

      // up/down/ok/backspace/clear all disabled
      expect(screen.getByTestId('key-up')).toBeDisabled()
      expect(screen.getByTestId('key-down')).toBeDisabled()
      expect(screen.getByTestId('key-ok')).toBeDisabled()
      expect(screen.getByTestId('key-backspace')).toBeDisabled()
      expect(screen.getByTestId('key-clear')).toBeDisabled()
    })

    it('count is "1 record" for a single record', async () => {
      // The seed has 7 records, so we trim down to 1 with 6 backspaces
      const { user } = await bootstrap()
      await user.click(screen.getByTestId('tab-history'))
      // delete 6 times (skip first to keep its selection valid)
      // After first delete, selection is still index 0, so deleting again removes the new index 0
      for (let i = 0; i < 6; i++) {
        await user.click(screen.getByTestId('key-backspace'))
      }
      expect(screen.getAllByTestId('history-item')).toHaveLength(1)
      expect(screen.getByTestId('history-count').textContent).toBe('1 record')
    })
  })

  describe('9. Keypad state per tab', () => {
    it('on Exchange up/down/ok not rendered; on History digit/00/dot/m disabled', async () => {
      const { user } = await bootstrap()

      expect(screen.queryByTestId('key-up')).toBeNull()
      expect(screen.queryByTestId('key-down')).toBeNull()
      expect(screen.queryByTestId('key-ok')).toBeNull()

      // m disabled when amount is 0
      expect(screen.getByTestId('key-save')).toBeDisabled()

      await user.click(screen.getByTestId('tab-history'))

      expect(screen.getByTestId('key-0')).toBeDisabled()
      expect(screen.getByTestId('key-1')).toBeDisabled()
      expect(screen.getByTestId('key-9')).toBeDisabled()
      expect(screen.getByTestId('key-00')).toBeDisabled()
      expect(screen.getByTestId('key-dot')).toBeDisabled()
      expect(screen.getByTestId('key-save')).toBeDisabled()

      expect(screen.getByTestId('key-backspace')).not.toBeDisabled()
      expect(screen.getByTestId('key-clear')).not.toBeDisabled()
    })

    it('m is enabled when a non-zero quote is loaded; pressing m saves and selects the new record', async () => {
      const { fetch, user } = await bootstrap()
      await clearAllPending(fetch)

      await user.click(screen.getByTestId('key-1'))
      await advanceDebounce()
      await flushMicrotasks()
      const req = findQuoteRequest(fetch, (b) => b.amount === 1)
      expect(req).toBeDefined()
      const body = req!.body as { from: string; to: string; amount: number }
      fetch.resolveByIndex(
        fetch.pending.indexOf(req!),
        buildQuoteResponse({ from: body.from, to: body.to, rate: '0.9', amount: 1 }),
      )
      await flushMicrotasks()

      await waitFor(() => {
        expect(screen.getByTestId('key-save')).not.toBeDisabled()
      })

      await user.click(screen.getByTestId('key-save'))
      await user.click(screen.getByTestId('tab-history'))

      // seed has 7 records; saving one more makes 8
      const itemsAfter = screen.queryAllByTestId('history-item').length
      expect(itemsAfter).toBe(8)
      const sel = screen
        .getAllByTestId('history-item')
        .findIndex((el) => el.getAttribute('aria-selected') === 'true')
      expect(sel).toBe(itemsAfter - 1)
    })
  })

  describe('10. Amount input through the keypad', () => {
    it('"00" on zero stays 0; "." gives "0."; only one dot; backspace to empty gives 0; stops at 15 digits', async () => {
      const { user } = await bootstrap()
      expect(readAmount()).toBe('0')

      await user.click(screen.getByTestId('key-00'))
      expect(readAmount()).toBe('0')

      await user.click(screen.getByTestId('key-dot'))
      expect(readAmount()).toBe('0.')

      await user.click(screen.getByTestId('key-dot'))
      expect(readAmount()).toBe('0.')

      await user.click(screen.getByTestId('key-backspace'))
      expect(readAmount()).toBe('0')

      for (const d of '123456789012345') {
        await user.click(screen.getByTestId('key-' + d))
      }
      expect(readAmount()).toBe('123456789012345')

      await user.click(screen.getByTestId('key-6'))
      expect(readAmount()).toBe('123456789012345')

      await user.click(screen.getByTestId('key-clear'))
      expect(readAmount()).toBe('0')
    })
  })

  describe('11. "Last updated" label', () => {
    it('shows "just now", "1 min ago", "n min ago", "Updating…" while loading, "—" before first quote', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const t0 = new Date('2026-01-01T12:00:00.000Z')
      vi.setSystemTime(t0)

      const fetch = setupFetchMock(['USD', 'EUR'])
      const { user } = setupRender(<App />)
      await flushMicrotasks()
      await waitFor(() => {
        expect(fetch.fetchMock).toHaveBeenCalled()
      })

      // fail the initial quote so lastSuccessAt stays null → "—"
      await waitForPending(fetch, 1)
      fetch.resolveByIndex(0, new Response('boom', { status: 500 }))
      await flushMicrotasks()

      const updated = screen.getByTestId('updated-at')
      expect(updated.textContent).toBe('—')

      // refresh: a new quote is requested → "Updating…"
      await user.click(screen.getByTestId('refresh'))
      await flushMicrotasks()
      expect(updated.textContent).toBe('Updating…')

      const req = await waitForPending(fetch, 1)
      const body = req.body as { from: string; to: string; amount: number }
      fetch.resolveByIndex(
        0,
        buildQuoteResponse({
          from: body.from,
          to: body.to,
          rate: '1',
          amount: body.amount,
          createdAt: t0.toISOString(),
        }),
      )
      await flushMicrotasks()

      await waitFor(() => {
        expect(updated.textContent).toBe('just now')
      })

      vi.setSystemTime(new Date(t0.getTime() + 60_000))
      await vi.advanceTimersByTimeAsync(15_000)
      expect(updated.textContent).toBe('1 min ago')

      vi.setSystemTime(new Date(t0.getTime() + 6 * 60_000))
      await vi.advanceTimersByTimeAsync(15_000)
      expect(updated.textContent).toBe('6 min ago')
    })
  })

  describe('12. Smoke: every data-testid from the README is present', () => {
    it('Exchange tab has all required test ids', async () => {
      await bootstrap()

      expect(screen.getByTestId('tab-exchange')).toBeInTheDocument()
      expect(screen.getByTestId('tab-history')).toBeInTheDocument()
      expect(screen.getByTestId('from-currency')).toBeInTheDocument()
      expect(screen.getByTestId('to-currency')).toBeInTheDocument()
      expect(screen.getByTestId('amount')).toBeInTheDocument()
      expect(screen.getByTestId('result')).toBeInTheDocument()
      expect(screen.getByTestId('updated-at')).toBeInTheDocument()
      expect(screen.getByTestId('refresh')).toBeInTheDocument()
      for (let i = 0; i <= 9; i++) {
        expect(screen.getByTestId('key-' + i)).toBeInTheDocument()
      }
      expect(screen.getByTestId('key-00')).toBeInTheDocument()
      expect(screen.getByTestId('key-dot')).toBeInTheDocument()
      expect(screen.getByTestId('key-backspace')).toBeInTheDocument()
      expect(screen.getByTestId('key-clear')).toBeInTheDocument()
      expect(screen.getByTestId('key-save')).toBeInTheDocument()
      expect(screen.queryByTestId('key-up')).toBeNull()
      expect(screen.queryByTestId('key-down')).toBeNull()
      expect(screen.queryByTestId('key-ok')).toBeNull()
    })

    it('History tab has history-only test ids and history list', async () => {
      const { user } = await bootstrap()
      await user.click(screen.getByTestId('tab-history'))
      expect(screen.getByTestId('key-up')).toBeInTheDocument()
      expect(screen.getByTestId('key-down')).toBeInTheDocument()
      expect(screen.getByTestId('key-ok')).toBeInTheDocument()
      expect(screen.getAllByTestId('history-item').length).toBeGreaterThan(0)
      expect(screen.getByTestId('history-count')).toBeInTheDocument()
    })
  })
})
