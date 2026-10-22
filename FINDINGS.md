# FINDINGS

Each item lists symptom, root cause, and fix (or, where no fix was made, why).

## 1. User complaints

### "The result shows an amount for the wrong currency"

**Symptom.** Pressed `7` once with GBP selected: the amount showed `77`
(duplicate keypad listener, see section 2) and the result was about `9`
USD, which is the value for 7 GBP. Requests for 7 and 77 were in flight;
the response for 7 arrived last and overwrote the one for 77. Same shape
for any rapid change of amount or currency while a quote is in flight.

**Root cause.** `App.tsx` fired `fetch` on every change of `amount`,
`from`, `to`, or `refresh` and applied every response. No
`AbortController`, no cancellation token, no key check.

**Fix.** A request key `from|to|normalizedAmount|nonce` is built per
effect run; each request gets its own `AbortController`, aborted in
cleanup. The response is stored alongside its key and exposed only if the
stored key equals the current key and the typed amount equals the
debounced amount. Amount is debounced 300 ms.

**Test that covers it.** `ConverterPage.test.tsx` → "1. Race: amount
changes": types `7` then `77`, resolves `77` first and `7` second, asserts
result `70.84` and amount `77`. "2. Race: currency change" repeats for
`from`/`to` swaps.

### "Picking an old conversion from History gives the wrong amount"

**Symptom.** Pressed OK on `USD 1,000 → EUR 922.25`; a quote was sent for
`1` (`parseFloat('1,000') === 1`). Same on `PLN 12,500 → EUR`: `12`
(`parseFloat('12,500') === 12`).

**Root cause.** Three bugs: (a) `m` stored
`amount: formatMoney(parseAmount(amount))`, so `'1000'` became `'1,000'`
(the seed did the same); (b) `parseAmount` was a thin `parseFloat`
wrapper; (c) the OK branch read `from`/`to`/`selected` from a stale
closure (keypad effect depended on `[tab]` only).

**Fix.** `HistoryRecord.amount` and `result` are raw user-typed strings;
`parseAmount` strips thousands separators; `formatMoney` is display only;
`m` writes the buffer verbatim. Each keypad button owns its own `onClick`
(no delegation, no stale closure, no listener leak). OK sets `from`, `to`
and the raw amount in a single update.

**Test that covers it.** `ConverterPage.test.tsx` → "7. OK from History
restores the exact record": the seed `USD 1,000 → EUR` and
`PLN 12,500 → EUR` via `▼` three times. Inputs read `1000`/`12500`,
selects match, a fresh quote does not change the amount string.

## 2. Other main problems

- **Keypad listeners without cleanup; stale closures.** Handler
  registered with `table.addEventListener('click', handler)` in an effect
  with `[tab]` and no cleanup; the closure captured seven state values.
  In StrictMode the table had two listeners on mount; after three tab
  round trips one tap of `5` typed `55555555`, one tap of `m` saved
  several records. Fix: drop the effect, wire `onClick` per button.
- **Loading stuck on a fetch error.** `setLoading(true)` ran before
  `fetch` and was only cleared inside `.then`; `.catch` only logged. A
  500 left the spinner running forever. Fix: `useQuote` exposes `loading`
  and `error`; on failure the UI renders `—`, an inline message, and an
  enabled refresh button.
- **Money handled as JS numbers.** `250 * 1.084300` gave
  `271.07499999…`; `toFixed(2)` rounded to `'271.07'`. The test passed
  only because `convert` was mocked. Fix: amounts stay strings; all math
  uses `decimal.js` with `ROUND_HALF_UP`.
- **Rates response overwrote the user's selection.** The rates effect set
  `from = data.currencies[0]` and `to = data.currencies[1]`, flipping the
  intended `USD → EUR` default to `EUR → USD` and resetting the user's
  choice on any re-fetch. Fix: the current `from`/`to` is kept if it is in
  the loaded list, otherwise the defaults `USD`/`EUR` are applied; the API
  only fills the `<option>` elements.
- **`selected` index out of bounds on empty history.** After `C` cleared
  history, `selected` kept the previous index; `▼` clamped to `-1`, OK
  read `history[-1]` and did nothing. Fix: clamp inside every transition
  of the history reducer.
- **Amount input edge cases.** `'0' + '0' = '00'`; `'00' + '7' = '007'`
  (the parser returns `7` while the display shows `007`); multiple dots
  accepted. Fix: a single `reduceAmount` normalises after every edit: on
  `'0'`, `0`/`00` are dropped and a non-zero digit replaces it; backspace
  down to empty gives `'0'`; one `.`; 15 digits max.
- **Result computed from the server's echoed `amount`.** The original
  render was `formatMoney(convert(data.amount, data.rate))`; a
  server-side rounding step would silently change the result. Fix: render
  from the typed string and the quoted `rate`.
- **Empty `test:ci` script.** `package.json` had `"test:ci": ""`: CI
  exited 0 with zero tests run. Fix: `"test:ci": "vitest run"` (one run,
  non-zero exit code on failure).
- **Tests only tested their own mocks.** `convert` was mocked, so
  `formatMoney(convert(250, '1.084300')) === formatMoney(271.08)` and
  `parseAmount('42') === 42` were tautological. Fix: new `money` tests
  call the real `convert` and exercise `Decimal` rounding, comma input and
  the round-half-up rule.

## 3. Minor

- History rows keyed by array index; deleting a row re-mounted siblings.
  Fix: `key={record.id}`.
- `HistoryRow` froze its rendered label in `useState` at mount and ignored
  later `record` changes. Fix: the label is computed at render.
- Inline `style={{ fontWeight, width, height }}` in `App.tsx` and
  `Keypad.tsx`. Fix: SCSS modules, states via `aria-selected` and
  `:disabled`.
- Proxy `user=` param was not URL-encoded; a `+` in the email decodes as a
  space. Fix: `encodeURIComponent(apiUser)` in the rewrite.
- No guard for a missing `.env`: not fixed. A throw would break `build`
  and `test:ci` on a clean clone; the README says to copy `.env.example`.

## 4. API behaviour

- About one in ten valid requests returns a random `500` (also for
  `from === to`, `amount: 0` and 15-digit amounts). `429` appears only
  under bursts of back-to-back requests; at 1 s pacing the run was clean.
- Latency is high-variance: P50 ≈ 1.4 s, P90 > 2.5 s, worst ~3 s.
- `POST /api/quote` requires `Content-Type: application/json` (else 500)
  and `amount` as a JSON number (a string gives 400); currency codes are
  uppercase.
- The response carries `rate` as a string with 7+ decimal places and
  `amount` as a JSON number. `createdAt`/`expiresAt` are exactly 30 s
  apart; `expiresAt` is informational (no redeem/execute endpoint).

## 5. Decisions

- **Backspace on History is active when the history is not empty** (it is
  only dimmed while the list is empty). **`m` stays in the DOM on History as
  `disabled` and visually hidden** (the layout shows no `m` there); `m`
  appends and selects the new record on Exchange.
- **Seed and saved records store raw values** (`'1000'`, `'12500'`);
  amounts display as typed, only results are grouped. `formatMoney(0)` is
  `0`.
- **Zero amount and `from === to` go through the API like any other
  request**; the 500s are random and not tied to these inputs. The result
  for zero is 0.
- **`Number()` only at the API boundary**: amounts up to 15 digits are
  exact in a double, hence the 15-digit input limit. All other math is
  `decimal.js`. The result is rounded to 2 decimals with trailing zeros
  trimmed (`1,186.5`).
- **Debounce 300 ms on amount only**, because 429s correlate with bursts.
  No automatic retries: errors are visible and the refresh button is the
  retry.
- **Quote expiry is informational.** There is no redeem endpoint, so there
  is no auto-refresh on `expiresAt`; the UI shows the age of the last
  quote.
- **Lightweight FSD** keeps imports flowing downward and slices isolated;
  for an app this size I would simplify to `pages / widgets / shared` and
  drop `entities`.
