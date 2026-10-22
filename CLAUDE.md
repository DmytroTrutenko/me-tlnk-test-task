# Currency Exchange

React 18 + Vite 5 + TypeScript 5.6 app. The user-facing behaviour is described in README.md.

## Commands

- `npm run dev` / `npm run build` / `npm run preview`
- `npm run test:ci` (single run, use this instead of `npm test`, which is watch mode)
- `npm run lint`, `npm run format:check`, `npm run format`

After every task run lint, format:check, build and test:ci, and fix everything you introduced.

## Hard rules

- Keep every `data-testid` from the README table. Currency selects stay native `<select>` elements.
- Dependency versions are pinned (no `^`). Install with `npm i -E` / `npm i -D -E`.
- tsconfig `lib` is ES2020: no `replaceAll`, `Array.prototype.at`, `Object.hasOwn`. `noUnusedLocals` and `noUnusedParameters` are on, and `tsc -b` also type-checks tests (`include: ["src"]`).
- Never edit or commit `.env`, never edit `.env.example`, never write the API user id into any file or output.
- No localStorage: history is in memory only.
- Do not run `git commit`, `git push`, or change git remotes. The human commits.
- Money is never handled as a JS number: amounts are strings, math goes through decimal.js. History stores raw values ('1000'), formatting happens only at render time.
- No `useEffect` without cleanup for listeners, timers and requests. No state written from an effect that depends on that same state.

## Styling

SCSS modules only: one `*.module.scss` next to each component. Global styles and CSS variables (`:root`) live in `src/app/styles/global.scss`. No inline styles, no CSS-in-JS, no UI libraries. Use `@use`, not `@import`. Style states via `aria-selected` and `:disabled`, not extra classes.

## Architecture

Lightweight Feature-Sliced Design under `src/`: `app / pages / widgets / entities / shared`. Alias `@` points to `src`.

- Imports go only downward across layers.
- Slices on the same layer never import each other.
- A slice is imported only through its `index.ts`.
- Tests live next to the code.
- Do not create empty layers or slices.

## Working style

- Small, focused changes. Do not refactor unrelated code or add libraries that were not asked for.
- Tests use explicit imports from 'vitest' (no globals) and controlled promises instead of setTimeout for async mocks.
- At the end, list changed files and anything you were unsure about.

## API facts (verified by probing)

- `POST /api/quote` requires `Content-Type: application/json` (otherwise 500), `amount` as a JSON number (a string gives 400), and uppercase currency codes.
- `rate` is a string; `amount` in the response is a JSON number echo, never use it for math.
- The API is flaky: latency typically 1-2 s (up to ~2.2 s) and about 10% random 500 on valid requests, including `amount: 0` and `from === to`. 429 appears only on bursts of back-to-back requests. Errors must be visible to the user and retried manually; no automatic retries.
- 15-digit amounts are accepted; the app limits input to 15 digits.
- Shell is Windows PowerShell: no grep/head/sed. Use Select-String, Get-Content, Get-ChildItem. Use `curl.exe`, not the `curl` alias.
