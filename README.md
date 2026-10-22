# Currency Exchange

A single-page web app for converting money between currencies. You pick the two currencies,
type an amount on the on-screen keypad, and the app fetches a fresh rate and shows the
converted amount — with the timestamp of the quote and a one-click way to re-request it.

The whole interface is driven by an on-screen keypad, which makes the app usable on touch
devices and keeps numeric input consistent: there is no keyboard-driven input to go out of
sync with the displayed value.

## What it does

**Exchange Rate tab**

- Native `<select>` elements for both the source and target currency.
- A keypad for typing the amount, with `⌫` (delete), `C` (reset) and `m` (save) keys.
- The result is recalculated from a fresh quote whenever the amount or either currency changes.
- A "last updated" indicator that ticks over to show the age of the current quote.
- A reload button that requests a new quote on demand.
- Explicit loading, error and empty states — a failed request never silently shows a stale
  or wrong number.

**History tab**

- Saved conversions with a record count.
- Seeded with a few example records on first run.
- Keyboard-driven selection (`▲` / `▼`), deletion of the selected record (`⌫`),
  clearing the whole list (`C`), and loading a record back into the Exchange tab (`🆗`).
- History lives in memory only — no local storage, no persistence.

## Notable implementation details

**Money is never a JavaScript number.** Amounts are kept as strings and every calculation
goes through `decimal.js` with `ROUND_HALF_UP`. History stores raw values (`"1000"`), and
formatting happens only at render time, so a value is never rounded twice or re-parsed
through a float.

**Race conditions are handled explicitly.** A quote request is keyed by
`from | to | amount | nonce`. The response is stored together with its key, and it is only
surfaced if its key still matches the current request — a slow response for an old amount
can never overwrite the result for a new one. Each request also owns its own
`AbortController`, and amount changes are debounced by 300 ms (currency changes are not,
since they are rare and should feel instant).

**State is modelled as a state machine.** The converter and the history are both `useReducer`
stores with explicit action types, so transitions like "restore a record" are atomic — the
currencies and the amount are applied in a single dispatch and can never be observed
half-updated.

## Tech stack

| Concern            | Choice                                       |
| ------------------ | -------------------------------------------- |
| UI                 | React 18 (hooks, no UI framework)            |
| Language           | TypeScript 5.6 (`strict`)                    |
| Build / dev server | Vite 5                                       |
| Styling            | SCSS modules (`*.module.scss` per component) |
| Money math         | `decimal.js`                                 |
| Fonts              | `@fontsource/inter`                          |
| Tests              | Vitest + Testing Library + jsdom             |
| Lint / format      | ESLint 9 (flat config) + Prettier 3          |

No CSS-in-JS, no component library, no global utility framework — the styles are a handful
of focused SCSS modules with global tokens in `src/app/styles/global.scss`.

## Getting started

Requires Node.js 18+.

```bash
npm install
```

### Environment

The app talks to a rates service over HTTP. In development those requests are proxied
through Vite so the browser only ever sees same-origin `/api/...` URLs.

```bash
cp .env.example .env
```

Then fill in `.env`:

| Variable   | Purpose                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `API_URL`  | Base URL of the rates service. The dev server proxies `/api` to it.                                 |
| `API_USER` | Identifier for your account. It is appended as the `user` query parameter to every proxied request. |

`.env` is git-ignored and must never be committed. `.env.example` is the template.

> The bundled `.env.example` still uses the legacy name `CANDIDATE_ID`. It is still accepted as a
> fallback for `API_USER`, so either name works.

### Run

```bash
npm run dev      # dev server with the /api proxy
npm run build    # type-check + production build
npm run preview  # serve the production build
```

| Command                | What it does                                            |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | Dev server with the `/api` proxy                        |
| `npm run build`        | Type-check and production build                         |
| `npm run preview`      | Serve the production build                              |
| `npm test`             | Tests in watch mode                                     |
| `npm run test:ci`      | Whole suite once, exits non-zero on failure             |
| `npm run lint`         | ESLint                                                  |
| `npm run format:check` | Prettier check (`npm run format` writes the formatting) |

## Project structure

Lightweight Feature-Sliced Design. Layers are `app → pages → widgets → entities → shared`;
imports only ever go downward, each slice is imported through its own `index.ts`, and the
alias `@` points at `src`.

```
src/
├── app/           app entry, global styles
├── pages/         converter page, page-level state machine
├── widgets/       exchange screen, history screen, keypad, tabs
├── entities/      currency list, quote, history record
└── shared/        money math, amount input, debounce, constants
```

Tests live next to the code they cover.

## API contract

Two endpoints are consumed, both through the `/api` proxy.

**`GET /api/rates`** → the list of available currencies.

**`POST /api/quote`** → a quote for a pair and an amount.

```json
{ "from": "USD", "to": "EUR", "amount": 100 }
```

The response carries the rate as a string and the amount as a number echo. The rate is the
only value used for calculations — the echoed amount is never trusted for math.

Both endpoints are reachable only with `Content-Type: application/json`, uppercase currency
codes, and a numeric `amount`. The service is also intermittently slow and occasionally
returns a server error, so failures are surfaced to the user with a manual retry rather than
retried automatically.

## Engineering notes

[FINDINGS.md](./FINDINGS.md) is a log of the problems found in this codebase while it was being
rebuilt — symptom, root cause and fix for each one — together with the API behaviour that
shaped the implementation.

## License

MIT — see [LICENSE](./LICENSE).
