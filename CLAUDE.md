# Currency Exchange

React 18 + Vite 5 + TypeScript 5.6 app. The spec is in README.md (keypad table, data-testid table). The visual source of truth is the Figma screenshot provided in the prompt; the Figma link cannot be opened.

## Commands

- `npm run dev` / `npm run build` / `npm run preview`
- `npm run test:ci` (single run, use this instead of `npm test`, which is watch mode)
- `npm run lint`, `npm run format:check`, `npm run format`

After every task run lint, format:check, build and test:ci, and fix everything you introduced.

## Hard rules

- Keep every `data-testid` from the README table. Currency selects stay native `<select>` elements.
- Dependency versions are pinned (no `^`). Install with `npm i -E` / `npm i -D -E`.
- tsconfig `lib` is ES2020: no `replaceAll`, `Array.prototype.at`, `Object.hasOwn`. `noUnusedLocals` and `noUnusedParameters` are on, and `tsc -b` also type-checks tests (`include: ["src"]`).
- Never edit or commit `.env`, never edit `.env.example`, never write the CANDIDATE_ID value into any file or output.
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
