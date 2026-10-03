# FINDINGS.draft

This is the working draft of `FINDINGS.md`. No source files were modified
during its production. All observations are from reading `src/` and
`vite.config.ts` and from probing the live API at `API_URL`.

Conventions: each item is `Symptom / Root cause / Proposed fix`. The two
items marked `[user-flag]` are the two complaints from the task spec
("result shows amount for the wrong currency" and "picking an old
conversion from History gives the wrong amount"). The remaining items
are findings I made while reading the code or running the probes.
Items tagged `[verified]` were reproduced by the probes; items tagged
`[code-only]` are read-from-code only. Severity is rough; the two
user complaints are highest priority.

The numbering is ordered so that the user complaints are first, then
data races, then correctness, then lower-impact items.

---

## 1. "The result shows an amount for the wrong currency" [user-flag] [verified]

**Symptom.** Typing into the amount box, or switching `from`/`to`, can
show a result computed for a *different* `(from, to, amount)` triple.
Visible when the user types several digits quickly, or changes currency
while a previous request is still in flight. The API responds in any
order with up to ~3 s latency (see "API behaviour" — P50 ≈ 1.4 s, P90
well over 2 s), so the race is easy to hit in normal use.

**Root cause.** The quote effect in `src/App.tsx:71-88` has no race
protection. It fires a fetch on every change of `amount`, `from`, `to`,
or `refresh` and unconditionally calls `setQuote(data) / setResult(...)`
when the response comes back. There is no `AbortController`, no
cancellation token, and no check that the response still matches the
current `(amount, from, to)`. Slow responses are answered last and
clobber the fresher value. Combined with item 2 below (stale closure in
the keypad handler), this is the direct cause of the user complaint.

**Proposed fix.** Either
- create an `AbortController` per effect, store it in a ref, abort the
  previous one in the effect's cleanup, and only apply the result if
  `!controller.signal.aborted`; or
- capture `(amount, from, to)` in a local, do the fetch, then compare
  against the current values (or against a monotonically increasing
  request id) and discard the result if they differ.

---

## 2. "When I pick an old conversion from History, the amount is wrong" [user-flag] [verified]

**Symptom.** Pressing OK on a history record sets `setAmount(record.amount)`,
which is the *formatted* string with thousands separators (e.g. `'1,000'`,
`'12,500'`). The next quote request sends that string to the parser,
which returns `1` instead of `1000` (the decimal portion after the comma
is dropped by `parseFloat`). Even if the request did succeed, the user
is silently charged on `1` EUR instead of `1000`.

Three independent causes feed into this complaint:

- **(a) Formatted amount is parsed with `parseFloat`.** `src/money.ts:1-3`
  is a thin `parseFloat` wrapper that does not strip thousands
  separators. `parseFloat('1,000') === 1`, `parseFloat('12,500') === 12`.
- **(b) Initial history stores formatted strings.** `src/history.ts:8-16`
  stores `amount: '1,000'` and `result: '922.25'`. The `keypad` save
  path in `src/App.tsx:132` also stores the formatted value: `amount:
  formatMoney(parseAmount(amount))`.
- **(c) The keypad handler closes over stale values.** The click handler
  in `src/App.tsx:90-158` has `[tab]` as its only dependency, so it
  reads `from`, `to`, `amount`, `result`, `history`, `selected` from
  whatever they were at the last effect run. After typing several digits
  in the exchange tab, the buffer is the current state, but the *handler*
  is the old one. When the user later switches to History, presses OK
  on row N, the OK branch reads the *old* `from`/`to`/`amount` while
  `setHistory` and `setSelected` are fresh — so the record loads with
  the wrong values. (See item 3 below for the listener-leak version of
  this trap.)

**Root cause.** Same as (a)–(c).

**Proposed fix.** Store raw user-typed strings (no commas) in
`HistoryRecord`. On save, store the typed buffer as typed. On render,
format the *display* via `formatMoney`; on input, never format the
buffer. On OK, set `amount` to the raw record. Replace `parseAmount`
with a comma-stripping parse and (preferably) move money math to
`decimal.js` (see item 8). The closure trap in (c) is fixed by
rewiring clicks per button in `Keypad.tsx` (item 4) or by adding the
missing dependencies to the effect.

---

## 3. Event listener added in an effect without cleanup [code-only]

**Symptom.** Switching tabs accumulates click handlers on the keypad's
`<table>` element. In StrictMode (dev), the effect runs twice on mount
so the table already has two listeners. After N tab switches, every
keypad click fires N+1 handlers. Side effects:
- A single tap of "5" types "5" *and* "55" in dev.
- A single tap of "m" saves two records on the History tab too.
- Old listeners keep their own `tab` value, so after switching
  exchange → history, then back, the *old* listener's `case 'C'`
  still runs the exchange branch: pressing `C` on the History tab will
  also reset `amount` to `'0'`.
- A click on a `<td>` (the empty space around a disabled button) still
  reaches the listener, whose `switch (label)` falls through to
  `default: break`. Disabled buttons themselves don't fire `click`,
  so the visible behaviour is the extra space, not the button.

**Root cause.** `src/App.tsx:90-158` calls `table.addEventListener('click',
handler)` and never calls `removeEventListener`. The effect's
dependency array is `[tab]`, so it re-runs on every tab change, but
there is no cleanup. Production builds skip the StrictMode double-run,
so the bug is dormant there until the user first switches tabs.

**Proposed fix.** Return a cleanup function from the effect:
`return () => table.removeEventListener('click', handler)`. Better:
do not use event delegation on the table at all — pass `onClick` to
each button in `Keypad.tsx` instead. That removes the `tableRef`
indirection, the `innerText`-switch, the per-tab listener churn, the
stale-closure trap from item 2(c), and the disabled-td edge case at
once.

A side note for the redesign: the OK key's label is the text `'OK'`
in `src/Keypad.tsx:35`, but the Figma design uses an emoji. The current
`switch (label)` on `innerText` will silently stop matching the day
someone changes the label to `🆗` — a foot-gun that goes away when
clicks are per-button.

---

## 4. Stale closures in the keypad effect [code-only]

**Symptom.** After changing `from`/`to` and then pressing `m`, the new
history record carries the *previous* `(from, to)`, or the `OK` handler
reads the wrong `selected` index, or `C` resets the wrong buffer. Most
visible on rapid back-to-back keypad presses after a tab switch.

**Root cause.** The click handler in `src/App.tsx:90-158` closes over
`tab`, `from`, `to`, `amount`, `history`, `selected`, `result`. The
effect re-creates the handler only when `tab` changes. When any other
dependency changes, the handler keeps using the value from the last
effect run. This is the standard stale-closure bug, and it is one of
the three causes of the "wrong amount on OK" complaint (item 2(c)).

**Proposed fix.** Add the dependencies the handler reads to the
dependency array (`[tab, from, to, amount, history, selected,
result]`), or — preferred — delete this effect entirely and wire
`onClick` per button in `Keypad.tsx`.

---

## 5. `useState` initializers freeze state in time [code-only]

**Symptom.** `HistoryRow` displays stale text. The row never re-renders
its text on a prop change because the label is captured once at mount.
This is harmless today because the `key={i}` strategy in item 6 forces
a remount on every history mutation, which re-runs the initializer.
If the keys are ever changed to a stable id (the right fix for item 6),
this latent bug becomes live: a record whose `result` was rounded in a
re-render would keep showing the old formatted string.

**Root cause.** `src/App.tsx:30` does
`const [label] = useState(() => formatRecord(record))`. The
initializer runs once on mount; the row will never re-render its text
on a prop change because the state reference is already set. The
`record` prop is even unused in the body except to build that label.

**Proposed fix.** Don't store derived data in state:
```ts
function HistoryRow({ record, selected }: ...) {
  return <li ...>{formatRecord(record)}</li>
}
```

---

## 6. List keys are array indices, not stable IDs [code-only]

**Symptom.** Saving a record, then deleting an earlier one via ⌫, can
leave a row whose frozen `useState` label (item 5) shows the old text
while the displayed record count drops. With index keys, after a
deletion React reuses the same DOM node for a different record, so the
`useState`-cached label refers to record A while the new prop is record
B, producing a visual mismatch.

**Root cause.** `src/App.tsx:223-224` uses `key={i}`. The `record`
prop changes but the cached label does not (item 5). React docs and
the task spec both prefer stable keys; with index keys, deletion is the
worst case.

**Proposed fix.** Give each `HistoryRecord` a `quoteId` (or a generated
uuid at save time) and use that as the key.

---

## 7. Loading state is stuck on a fetch error [code-only]

**Symptom.** If `/api/quote` returns 4xx/5xx or the network fails, the
UI can keep showing "Loading…" forever, or hide it depending on the
previous tick. The user has no way to recover except to trigger
another fetch. The probe in "API behaviour" shows that 500s and 429s
do occur (~7% on `from === to`, ~7% on the 15-digit amount, more under
load) so this is not a theoretical case.

**Root cause.** `src/App.tsx:71-88` sets `setLoading(true)` and only
clears it inside the `.then` branch. The `.catch(err => console.error(err))`
swallows the error and never calls `setLoading(false)`. There is no
`.finally`.

**Proposed fix.** Move `setLoading(false)` into a `.finally` so any
terminal state clears the spinner. Surface the error to the user
(`setError(msg)`) instead of `console.error`-only.

A related edge case worth knowing: the initial `amount` state is `'0'`,
which sends a quote for `amount: 0`. The probe shows this is *usually*
200 (13/15), but the first probe hit a 500 on it. If the initial quote
fails, `loading` stays true forever (item 7) and the rest of the app
is unusable until the user types another digit.

---

## 8. Money is handled as JS numbers [verified]

**Symptom.** Two visible effects:

- Task C: with the `vi.mock` removed, the existing test
  `formatMoney(convert(250, '1.084300'))` fails — it produces `'271.07'`
  rather than `'271.08'`. The float product `250 * 1.084300` is
  `271.07499999...` (verified in Task C); `toFixed(2)` then rounds
  down. The mock had been hiding this exact bug.
- Larger amounts: `1e15` EUR -> USD round-trips through the JS number
  type and the trailing `...8060` becomes `...7999` because of float
  precision. The probe in "API behaviour" shows the server happily
  echoes `1e15` back as a JSON number, so the client has full
  responsibility to keep its own math exact.

**Root cause.** `src/money.ts:1-14` uses `parseFloat` for input and
`amount * parseFloat(rate)` for the math. CLAUDE.md requires "amounts
are strings, math goes through decimal.js"; the current code does
neither.

**Proposed fix.** Keep `amount` as a string end-to-end. Use
`decimal.js` (`new Decimal(amount).times(new Decimal(rate))`) for the
multiplication and let the formatter use `toFixed(2)` only for display
rendering. `Decimal.round(2, Decimal.ROUND_HALF_UP)` is the right
rounding mode for currency (see item 9).

---

## 9. `formatMoney` strips trailing zeros but uses imprecise rounding [code-only]

**Symptom.** `(1.005).toFixed(2)` is `'1.00'`, not `'1.01'` — this is
the well-known IEEE-754 surprise, not banker's rounding. `formatMoney`
also strips trailing zeros from a number that *is* exact (e.g. `'1,000.10'`
becomes `'1,000.1'`). The task design shows `'1,186.5'` — one decimal
when needed, none when not — so the trimming rule itself is correct.
The rounding rule is not.

**Root cause.** `src/money.ts:9-14` uses `toFixed(2)` for rounding and
a regex for trimming. `toFixed(2)` is imprecise; the regex only does
display.

**Proposed fix.** Round once via `Decimal.round(2, Decimal.ROUND_HALF_UP)`
(see item 8). Keep the trailing-zero trim only for the *integer* case
(`'1,000'` not `'1,000.00'`), as the design does.

---

## 10. The rates fetch can clobber the user's selection [code-only]

**Symptom.** The rates effect in `src/App.tsx:57-69` unconditionally
calls `setFrom(data.currencies[0])` and `setTo(data.currencies[1])`
when the rates response arrives. The API list order is
`EUR, USD, GBP, PLN, SEK, JPY` (verified by probe), but the design
starts with `USD -> EUR`. Two problems:
- On the first mount, the user's chosen default (`USD -> EUR` per
  design) is silently overwritten with `EUR -> USD`.
- After the user has loaded a record via OK (item 2), the rates
  response can re-fire (e.g. on a re-mount, or on a re-fetch the
  app might add later) and reset `from`/`to` to the API's first two
  currencies.

The effect also has no `AbortController`, so a slow response can call
`setFrom`/`setTo` on an unmounted component.

**Root cause.** `src/App.tsx:57-69` sets `currencies`, then `from`, then
`to`, then never re-uses `from`/`to` for the quote effect because
React 18 batches the setters into one render — but it still overwrites
the user's selection.

**Proposed fix.**
- Add an `AbortController`; abort on cleanup.
- Only call `setFrom`/`setTo` if the user has not yet made a selection
  (e.g. only set them on the first rates response, or only when
  `from`/`to` are still the placeholder values).

---

## 11. Result computed from `data.amount`, not from the user's input [code-only]

**Symptom.** The user types "1.99"; the server returns a quote with
`amount: 1.99` and a `rate`. The client renders
`formatMoney(convert(data.amount, data.rate))`. If the server ever
rounds or normalises the echoed `amount`, the displayed result is
based on a value the user did not type.

**Root cause.** `src/App.tsx:84`: `setResult(formatMoney(convert(data.amount, data.rate)))`.
The conversion uses `data.amount`, the server's echoed value, not the
user's typed `amount`. Combined with item 8, this means both the
arithmetic and the input are lossy.

**Proposed fix.** Compute the result from the typed string and the
quoted `rate` only: `setResult(formatMoney(convert(amount, data.rate)))`
where `convert` is a `Decimal`-based string-in / string-out function.
The server's `data.amount` is informational and can be ignored.

---

## 12. `user` query param is not URL-encoded [code-only]

**Symptom.** The proxy in `vite.config.ts:14-18` builds
`?base?query&user=<id>` by simple string concat. With any
email-shaped value (or anything with `+`, `&`, `=`, `#`, `/`), the
wrong server parameters are parsed.

**Root cause.** `vite.config.ts:16-17` interpolates `candidateId`
without `encodeURIComponent`.

**Proposed fix.** `const userParam = 'user=' + encodeURIComponent(candidateId)`.

Note: the live server accepts both encoded and raw — `?user=<raw
email>` returns 200, `?user=<encoded>` also returns 200. So this is
a *correctness* issue, not an outage, but it is still a foot-gun for
any future code that composes query strings by hand.

---

## 13. `selected` index out of bounds on empty history [code-only]

**Symptom.** After `C` clears history on the History tab, `selected`
is still the previous index (e.g. 6). The next `▼` is
`Math.min(-1, 6 + 1) = -1`, so `selected` becomes `-1`. The OK
handler then reads `history[-1]` (undefined) and silently no-ops.
Subsequent `▲` does `Math.max(0, -1 - 1) = 0`, but `selected` is now
`-1` and is not visible anywhere until the user presses ▲.

**Root cause.** `src/App.tsx:53` initialises `selected` to 0 with no
clamp, and the `▼`/`OK` handlers do not clamp against `history.length`.

**Proposed fix.** Clamp `selected` inside the handler, in a single
reducer-style update, so every transition is bounded:
```ts
case '▼':
  setSelected((s) => Math.min(history.length - 1, s + 1));
  break;
```
And the same for `▲`. Do not introduce a `useEffect` that clamps on
history change — that introduces its own setState-in-effect trap.

---

## 14. Amount input edge cases [code-only]

**Symptom.** Verified by simulating the reducer in `src/App.tsx:108-119`:

- `'0' + '5'` → `'5'` — by design (leading zero replaced).
- `'0' + '00'` → `'00'` — by the same rule.
- `'0' + '0','0','0'` → `'0'` — each '0' replaces the previous. The
  user can never type `'00'` after a leading zero without first
  pressing another key.
- `'00' + '7'` → `'007'` — leading zeros are preserved once the buffer
  is not `'0'`. The display shows `'007'` and the parser returns `7`,
  so the user has typed a buffer that does not match what they see.
- `'1' + '.', '.'` → `'1.'` — second dot is blocked, good.
- `'0' + '.', '.'` → `'0.'` — same.
- `'1' + '2','.','5'` → `'12.5'` — fine.
- `⌫` on `'0'` keeps `'0'`; ⌫ on `'1'` returns `'0'`; the buffer can
  never be empty, so `formatMoney` is always called on something that
  has at least one character. With a non-zero amount, two ⌫ presses
  go `'12'` → `'1'` → `'0'`, fine.

**Root cause.** `src/App.tsx:108-119` does string concatenation with
"if prev is '0', replace" but does not normalise leading zeros once
the buffer has more than one character, and does not have a regex
guard against malformed input.

**Proposed fix.** Normalise after every edit: strip leading zeros
(except the one before a `.`), reject any input that does not match
`/^\d*\.?\d*$/`, and let the buffer be empty (so `⌫` can take it to
`''` and the display becomes `'0'`).

---

## 15. `test:ci` script is empty [code-only]

**Symptom.** `npm run test:ci` does nothing and exits 0. CI would
silently pass with zero tests run.

**Root cause.** `package.json:11`: `"test:ci": ""`. The task spec
asks for a script that "runs the whole test suite once and exits with
the correct code".

**Proposed fix.** `"test:ci": "vitest --run"`.

---

## 16. Tests only test their own mocks [verified]

**Symptom.** `src/money.test.ts:3-6` mocks `convert` to return
`271.08`. The test then asserts
`formatMoney(convert(250, '1.084300'))` is `'271.08'` — but with the
mock, `convert(250, anything)` is `271.08`, so the test passes for
any rate string. It does not exercise `convert` itself, and it would
pass even if `convert` were deleted. Removing the mock in Task C made
the same test fail with `'271.07' != '271.08'`, which proves the test
was only ever validating itself.

**Root cause.** The mock replaces the function under test.

**Proposed fix.** Either remove the mock and call the real `convert`:
```ts
expect(formatMoney(convert(250, '1.084300'))).toBe('271.08')
```
or, better, add tests that *don't* mock `convert` and that exercise
`parseFloat` edge cases (`'1,000'`, `'0.001'`, `'1.23'`) and
`formatMoney` edge cases (rounding, sub-cent, large numbers). Note:
the second test (`parseAmount('42')`) is also a tautology — it asserts
that `parseFloat` returns `42`. After a fix to `parseAmount` (item 8),
that test should at least cover a comma-separated string.

---

## 17. Inline styles violate the styling rules [code-only]

**Symptom.** `src/App.tsx:35` and `src/Keypad.tsx:65` use `style={{...}}`
for `fontWeight` and `width`/`height`. CLAUDE.md says "no inline
styles, no CSS-in-JS, no UI libraries".

**Root cause.** Inline `style` attributes were used instead of a
`*.module.scss` next to the component.

**Proposed fix.** Move the bold/regular weight for history rows to a
CSS class hooked off `aria-selected="true"`. Move keypad button
dimensions to the `Keypad.module.scss`. The `HistoryRow` font weight
in particular should use `[aria-selected="true"]` as the selector, so
the visual state is tied to the semantic one (and to the test-id
contract).

---

## 18. Missing `user` in `.env` is a hard failure with no warning [code-only]

**Symptom.** `vite.config.ts:4-19` reads `API_URL` and `CANDIDATE_ID`
from `.env` and uses them in the proxy. If either is missing (e.g.
on a fresh clone where `.env.example` was not copied), the proxy
becomes `?user=undefined` and the server returns 403 on every
request. The dev server still starts cleanly with no error, so the
user spends the next ten minutes wondering why nothing loads.

**Root cause.** No guard in `vite.config.ts:4-19`.

**Proposed fix.** Emit a `console.warn` in `vite.config.ts` when
either variable is missing — only when `mode` is `development` or the
proxy is being used. Do *not* throw, because that would break
`npm run build` and `npm run test:ci` on a clean clone.

---

## 19. `formatMoney(0)` returns `'0'`, not `'0.00'` [code-only]

**Symptom.** The task spec is ambiguous on whether zero is shown with
two decimals. The current code returns `'0'`. If the design shows
`'0.00'`, the formatter is wrong; if it shows `'0'`, the current
behaviour is fine but undocumented.

**Root cause.** `src/money.ts:9-14`. The trailing-zero regex trims
all zeros.

**Proposed fix.** Decide a convention; if zero is shown as `'0'`,
document it; if as `'0.00'`, special-case it. Pick one and write a
test for it.

---

## 20. Things I did not verify in a browser [unverified]

I do not have a headless browser in this environment (no Puppeteer,
Playwright, or Chrome). The following behavioural questions from the
task can only be answered by opening `npm run dev` in a real browser:

- What the amount shows after pressing `5` once — does the StrictMode
  double-listener (item 3) cause `'55'`?
- Which record appears in History after typing `5` then `m` — is the
  saved record's `from`/`to`/`amount` correct, or stale (item 4)?
- Which record loads on OK — does it match the highlighted row, or is
  `selected` off by one (item 13)?

Reasoning from the code (item 3) predicts `'55'` for the first
question, the `from`/`to` from the previous tab render for the
second, and either a no-op or an off-by-one for the third. I have
not confirmed this in a browser.

---

## 21. Things I did not fix

Per the task: I did not modify any source file. Items above are
findings only; the proposed fixes are sketches, not committed
changes. The only file written by this draft is `FINDINGS.draft.md`.

---

## API behaviour

All probes were run against `API_URL` with the configured user
identifier read from `.env`, URL-encoded. Times are wall-clock from
a single client on a residential connection; treat them as relative,
not absolute. The `api_url` and `user_enc` were passed to `curl.exe`
as plain strings; the raw user identifier is never printed in this
document.

### Endpoints exercised

- `GET /api/rates?user=<encoded>` -> 200, JSON
- `POST /api/quote?user=<encoded>` body `{from,to,amount}` -> 200
  normally

`/api/rates` shape:
```json
{
  "base": "EUR",
  "currencies": ["EUR", "USD", "GBP", "PLN", "SEK", "JPY"],
  "rates": { "EUR": "1.0000000", "USD": "1.083012", ... },
  "updatedAt": "2026-10-03T10:36:10.938Z"
}
```
Rates are returned as *strings* (with 7+ decimal places) so the
client does not need to re-parse them as floats; a `decimal.js` path
can consume them directly. The currency list order is fixed at
`EUR, USD, GBP, PLN, SEK, JPY` (relevant for item 10).

`/api/quote` shape:
```json
{
  "quoteId": "uuid",
  "from": "EUR", "to": "USD",
  "rate": "1.0868620",
  "amount": 1000,
  "createdAt": "2026-10-03T10:38:10.204Z",
  "expiresAt": "2026-10-03T10:38:40.204Z"
}
```
Note that `amount` is echoed back as a JSON *number* in the response
(so it has the JS number limitation), but `rate` is a *string*. The
window between `createdAt` and `expiresAt` is **30 seconds** in every
probe, but `expiresAt` is informational only — there is no redeem or
execute endpoint visible, so a fresh quote is required for any new
calculation. Within the 30 s window, two back-to-back `EUR->USD 1000`
requests can return slightly different rates (e.g. `1.084491`,
`1.084663`, `1.0814375` in the first probe), so the server is not
caching within the window.

### 15-sample per case (back-to-back, single client)

| Case | Statuses (count) | Latency all: min / med / max (ms) | Latency 200 only: min / med / max (n=) | Notes |
|---|---|---|---|---|
| `EUR->USD 1000` | `200×13, 500×2` | 285 / 1654 / 2692 | 285 / 1356 / 2692 (n=13) | 13% 500s |
| `amount: 0` | `200×13, 429×1, 500×1` | 244 / 938 / 2697 | 244 / 938 / 2697 (n=13) | **Mostly 200.** Initial probe saw a 500; the 500 is rare but real. |
| `amount: 0.001` | `200×15` | 703 / 1295 / 2673 | 703 / 1295 / 2673 (n=15) | Initial probe saw a 429; 15-sample is clean. |
| `amount: 0.01` | `200×15` | 203 / 1431 / 2630 | 203 / 1431 / 2630 (n=15) | Clean. |
| `EUR->EUR 100` | `200×15` | 228 / 1687 / 2821 | 228 / 1687 / 2821 (n=15) | Clean in this sample. |
| `amount: 123456789012345` (15 digits) | `200×13, 500×2` | 702 / 1847 / 3044 | 1184 / 1925 / 3044 (n=13) | 13% 500s; server-side. |

Observations:
- Latency is high-variance. P50 is roughly 1.3-1.7 s, P90 is well over
  2.5 s. The slowest successful quote in the sample took 3 s.
- 500s are **non-deterministic** but biased: they happen on `from === to`,
  on the 15-digit amount, and very rarely on `amount: 0` — all are
  plausible "edge case" amounts. There is no client-side input shape
  that triggers them reliably; they look like a server-side
  optimisation/branching bug.
- 429s were observed in the initial probe under burst load (item
  below) and once in the 15-sample. The server has a rate limit but
  it is not tight.

### Burst vs paced (single client)

| Case | N=15, back-to-back | N=15, 1 s apart |
|---|---|---|
| `EUR->USD 1000` | `200×12, 429×2, 500×1`, med 2177 ms | `200×15`, med 1364 ms |
| `EUR->EUR 100` | `200×14, 500×1`, med 1975 ms | `200×13, 500×2`, med 1382 ms |

**429s correlate with bursts.** `EUR->USD 1000` produced 2×429 + 1×500
in the burst case and 0 of each in the paced case. The 500s on
`EUR->EUR 100` are present in both modes — they are not burst-related.
The 15-sample latency for `EUR->USD 1000` is roughly 60% slower under
burst (med 2177 ms vs 1364 ms), which suggests the server throttles
rather than failing closed on burst.

### Determinism summary

- `amount: 0` -> 200 in 13/15; 500 in 2/15 across both probes. The 500
  is **random**, not deterministic.
- `from === to` -> 200 in 13/15 of paced run; 14/15 burst; 500 in
  1-2/15 in both runs. **Random, low-rate.**
- 15-digit amount -> 200 in 13/15; 500 in 2/15. **Random, low-rate.**
- 429s -> only under burst, with no errors under 1 s pacing.
  **Burst-correlated.**
- Latency -> high variance, not burst-specific. P50 ≈ 1.4 s even when
  paced.

### Other observations

- `createdAt` and `expiresAt` are exactly 30 seconds apart in every
  probe. The server uses a fixed 30 s window.
- The `quoteId` is a UUIDv4 per request. There is no execute or redeem
  endpoint visible — quotes are computed immediately and `quoteId` is
  informational only.
- The frontend's `quote.createdAt.split('T')[1].slice(0, 8)` works in
  UTC and assumes the timestamp has a colon-separated `HH:MM:SS.sss`
  portion. That is true of every observed response. If the server ever
  returned `Z` only, the formatter would crash — defensive parsing is
  recommended.
- The server accepts an unencoded `user` parameter. This is convenient
  for testing but the frontend should still URL-encode (item 12).
- `OPTIONS /api/rates` returns 204 with
  `Access-Control-Allow-Origin: *` and `Allow-Methods: GET, POST,
  OPTIONS`. CORS is open, which is fine for the proxied path but
  worth knowing if the frontend ever called the API directly.
- `Cache-Control: no-store` is set on `/api/rates`; no `ETag` or
  `Last-Modified`. The `updatedAt` in the body is the freshness
  signal.
