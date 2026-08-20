# Project configuration

## Tech stack

- **Front-end**: React + [Vite](https://vite.dev) + [Tailwind](https://tailwindcss.com) + [Font Awesome](https://fontawesome.com)
- **Back-end**: [NestJS](https://nestjs.com)
- **Database**: Prisma + PostgreSQL
- **Authentication**: [Passport](https://www.passportjs.org)
- **Jobs:** [pg-boss](https://timgit.github.io/pg-boss/#/)
- **Linting**: ESLint + Prettier
- **Testing**: Vitest (front-end) + Jest (back-end)

## Architecture

```txt
linklater/
├─ apps/
│  ├─ api/          # NestJS back-end
│  │  └─ README.md  # .env, modules, auth, jobs
│  │
│  └─ web/          # React + Vite front-end
│     └─ README.md  # .env, components, state, API, routes
│
├─ package.json     # root workspace + scripts
└─ README.md
```

## Key commands

```bash
# Setup + run
npm install                                       # Install dependencies
npm run dev                                       # Start development server

# Linting + formatting
npm run format                                    # Format code using Prettier
npm run lint                                      # Lint code for consistent style (includes lint:shell)
npm run lint:migrations                           # Lint migrations using Squawk
npm run lint:shell                                # Lint every shell file in bin/ + scripts/ using ShellCheck
npm run lint --workspace @linklater/web           # Lint front-end only
npm run lint --workspace @linklater/api           # Lint back-end only
npm run typecheck                                 # Type-check back-end (front-end: use build)
npm run typecheck --workspace @linklater/api      # Type-check back-end only

# Testing
npm run test                                      # Run all tests: api, web + the root node --test lane
npm run test --workspace @linklater/web           # Test front-end only
npm run test apps/web/src/path/to/file.test.tsx   # Run a single front-end test file
npm run test --workspace @linklater/api           # Test back-end only
npm run test apps/api/src/path/to/file.spec.ts    # Run a single back-end test file
node --test 'scripts/**/*.test.mjs'               # Run the bin/ command tests on their own
npm run test:root                                 # Run the root node --test lane on its own
npm run test:cov                                  # Coverage for api + web, then the root lane uninstrumented

# Tuffgal (v2) visual regression tests
npm run dev:test                                  # Run dev server in test mode (TESTING_UI=1)
npm run tuffgal:setup                             # One-time: create test DB + seed user
npm run tuffgal                                   # Local advisory self-diff vs local git-ignored .cache (reports drift, exits 0)
npm run tuffgal:approve                           # Refresh LOCAL .cache reference only (does NOT write committed baselines)
npm run tuffgal:approve -- --desktop --new-only   # Pass Tuffgal flags after `--`

# Committed baselines (tuffgal/baselines) are re-seeded ONLY by CI when a maintainer
# comments `@tuffgal approve` on the PR. No local command writes them (macOS renders ≠ linux CI)

# Database
npm run migrate --workspace @linklater/api             # Run migrations + regenerate client
npm run migrate:reset --workspace @linklater/api       # Wipe, re-run migrations + regenerate client
npm run migrate:reset:force --workspace @linklater/api # Wipe without Prisma's confirmation prompt
npm run migrate:deploy --workspace @linklater/api      # Production: apply committed migrations + regenerate client (non-interactive)
```

> **Note:** `migrate`, `migrate:reset`, `migrate:reset:force` + `migrate:deploy` chain their Prisma command with `prisma generate`. Prisma 7 `prisma-client` generator need custom `output` path. `migrate dev` alone no auto-regenerate client.

## Third-Party Integrations

- Prefer **free and open-source** (FOSS) over paid/proprietary
  - Pick self-hostable or MIT/Apache/BSD-licensed libs when viable
  - If paid only path, propose alternate design avoiding dependency first
  - Document tradeoff when FOSS option has meaningful limits vs paid

## Tool Versions

- Check **actual installed version** before suggesting. No assume from training data.
  - Read `package.json` to confirm versions before referencing APIs, syntax, behavior
  - Example fail: assume Tailwind v3 syntax (e.g. `@layer` behaviors) when v4 installed
- When **installing new packages**, pick latest stable unless explicit reason not.

## Development Workflow

Use [Test Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html) (TDD). Three steps, repeat:

1. **RED:** Write failing test describing desired behavior
2. **GREEN:** Write minimal code to pass test
3. **REFACTOR:** Improve structure, keep tests green

### When no layer can observe the change

Some changes are correct and invisible to every harness here. Viewport
units (`svh`/`lvh`/`dvh`) collapse to one number in headless Chromium and
in Tuffgal, neither of which has browser chrome to retract. jsdom computes
no layout at all. Print styles, `forced-colors`, and anything keyed to real
device chrome are the same shape.

For these, RED is unavailable. Ship the change and state the unverified
claim plainly in the PR body, naming what would confirm it — a real device,
a specific browser.

**No manufacturing a test that can fail in place of one that can prove.** A
scan over source text asserts the code says what it says, not that it does
what it should. Completeness has no fixed point: every review turns up
another spelling it misses, so it earns review waves without converging.
That is a code-review concern wearing a test costume.

Anti-regression tripwires over source (`chrome-token-migration.test.ts`)
stay legal. They pin a finished migration against reintroduction, which is
a bounded set. The line is whether the test stands in for proof the change
works.

## Core Conventions

- Organize code into modules
  - See [Organizing Your React App Into Modules](https://dev.to/jack/organizing-your-react-app-into-modules-d6n)
- Self-explanatory folder, file, method, variable names
  - Keep React conventions like `prop` + `props`
  - No single-character variables (e.g. `e` or `i`)
  - Shortenings to avoid:

  | Avoid             | Use instead               |
  | ----------------- | ------------------------- |
  | `arg`, `args`     | `argument`, `arguments`   |
  | `arr`             | `array`                   |
  | `btn`             | `button`                  |
  | `cb`              | `callback`                |
  | `ctx`             | `context`                 |
  | `e`, `err`        | `error`                   |
  | `e`, `evt`        | `event`                   |
  | `el`, `elem`      | `element`                 |
  | `fn`              | `function`                |
  | `idx`             | `index`                   |
  | `msg`             | `message`                 |
  | `num`             | `number`                  |
  | `obj`             | `object`                  |
  | `param`, `params` | `parameter`, `parameters` |
  | `ref`             | `reference`               |
  | `req`             | `request`                 |
  | `res`             | `response`                |
  | `str`             | `string`                  |
  | `sub`             | `subject`                 |
  | `tmp`             | `temp`                    |
  | `val`             | `value`                   |

- Clarity over "perfect" optimization
  - Full `if` statements over ternary one-liners
  - Exception: in JSX, use `{condition && <Element />}` not `{condition ? <Element /> : null}`
- Stay DRY (not barren)
  - Extract common code when used 3+ times
- No god files
  - Refactor files over 100 lines of code (comments + blank lines don't count)
- Comments inside a function body are single-line, enforced by `local/no-comment-block-in-body`
  - Longer context belongs in the file or section overview, or in a well-named symbol
  - `apps/{api,web}/eslint-suppressions.json` pins pre-existing runs; prune entries as you sweep them, never add to them
- No premature optimization
  - 1-2s homepage load fine
  - Worry when load time scales exponentially with link count
- Lean DB calls
  - Avoid excess joins
  - Avoid n+1 queries
- Three response time limits:
  - 0.1s — feels instantaneous
  - 1.0s — flow uninterrupted, no feedback needed between 0.1–1.0s
  - 10s — attention limit; give progress feedback beyond
  - See [Response Time Limits](https://www.nngroup.com/articles/response-times-3-important-limits/)
- Polish UI details — see [Details That Make Interfaces Feel Better](https://jakub.kr/writing/details-that-make-interfaces-feel-better)
- Less no need more — never ask user click "Load more"/"Show more"/"Expand" affordance just to surface single remaining item. Predict when next batch would leave one trailing item, grab in same request; if total not knowable up front, auto-load trailing item once detected so user never see button labelled "1 remaining". See [Less Doesn't Need More](https://unsung.aresluna.org/less-doesnt-need-more/) — done in `useLinksData` + `LinksList`.
- Postel's Law — conservative in output, liberal in input. Normalize user input before matching/comparing so trivial variations no cause silent failures: case differences, accented characters, surrounding whitespace, smart vs straight quotes, full-width vs half-width characters, etc. Search for "montréal" must find "Montreal" + vice versa. See [Robustness Principle](https://en.wikipedia.org/wiki/Robustness_principle) + [Chrome's abnormal tab search](https://unsung.aresluna.org/chromes-abnormal-tab-search/) — done for link search via Postgres `unaccent` extension applied to both stored `searchVector` + incoming `plainto_tsquery` term.
- Embrace slow software — see [Slow Software Movement](https://codeberg.org/jaredwhite/slow-software)
- Clean up — kill listeners + temp processes when done
- Run `npm run lint` and `npm run test` when done to lint and test code changes

## Database Conventions

- Migrations must pass `npx squawk` with zero issues — no `-- squawk-ignore-file` or `-- squawk-ignore-next-statement`
  - Start every migration with `set lock_timeout = '1s';` + `set statement_timeout = '5s';`
  - Add foreign key constraints with `NOT VALID`, then immediately `VALIDATE CONSTRAINT` next line
  - See `.squawk.toml` for project-level excluded rules + reasons
- Run `npm run lint:migrations` to lint migrations

## TypeScript Conventions

- `class` for DTOs (class-validator decorators require it)
- `interface` for request/response shapes + component props
- `type` for unions + aliases
- Props interfaces end in `Props` (e.g. `FormInputProps`, `LinkCardProps`)

## Nest.JS Patterns

- Controllers delegate 100% to services — no business logic in controllers
- Services throw NestJS HTTP exceptions:
  - `BadRequestException:` invalid input
  - `ConflictException:` duplicate/constraint violation
  - `NotFoundException:` record not found (map Prisma `P2025`)
  - `UnauthorizedException:` auth failure
- Extract `userId` from `@Req() request: AuthRequest`
  - `AuthRequest` extends Express `Request`
- `@UseGuards(JwtAuthGuard)` at class level for web-session-only endpoints
- `@UseGuards(AnyAuthGuard)` when endpoint must accept both JWT sessions **and** PAT tokens (`ltk_`-prefixed bearer tokens for browser extensions + API clients) — selects strategy by prefix
- Service inputs use `Input` suffix (e.g. `CreateLinkInput`, `UpdateLinkInput`)
- Each module exposes barrel `index.ts` controlling public API

## React Patterns

- Event handlers: `handle*` (e.g. `handleDelete`, `handleSubmit`)
- Callback props: `on*` (e.g. `onCreated`, `onDelete`)
- Contexts: `createContext(undefined)` with custom hook that throws outside provider
- Form state sequence: clear error → set loading → attempt action → handle result
- Extract errors: `error instanceof Error ? error.message : 'Something went wrong'`
- Sort imports alphabetically by the **first identifier each import binds**, case-insensitively: the default binding, the namespace alias, or the first named specifier. A renamed import (`{ alpha as zulu }`) sorts under `alpha`, the name written first. The names inside the braces sort the same way, with value specifiers ahead of `type` ones, and `import {}` comes before `import type {}`.
- Enforced by `local/import-identifier-order` (autofixable). Pass `--fix` per workspace, e.g. `npm run lint --workspace @linklater/web -- --fix`; the root script chains several commands with `&&`, so a trailing `--fix` lands on npm rather than on eslint and is silently dropped. It never reorders four things: anything across a blank line or a non-import statement (group boundaries you drew), side-effect imports like `import './polyfill'` (evaluation order is observable, so they act as barriers), whole value imports against whole type imports (that partition is `local/type-imports-after-value`'s job, though inside the braces this rule owns it), and a default binding or namespace alias, which is not a named specifier. It reports without fixing rather than move a file-level directive (an `eslint-disable` block, `@ts-nocheck`, a test-environment pragma, a license header, a hashbang) or strand a comment sitting among the named specifiers.

```typescript
// Example of poor import organization
import { useState, useEffect } from 'react';
import { stumbleLink } from '../lib/api';
import StumbleEmptyView from './StumbleEmptyView';

// Example of good import organization
import StumbleEmptyView from './StumbleEmptyView';
import { stumbleLink } from '../lib/api';
import { useEffect, useState } from 'react';
```

## Testing Patterns

- Backend mock services typed as: `jest.fn() as unknown as ServiceType`
- Mock factories (e.g. `makeLink()`, `makeUser()`) return consistent data with spread overrides
- Call `jest.clearAllMocks()` in `beforeEach`
- Back-end: `*.spec.ts` co-located with source
- Front-end: `*.test.tsx` co-located with source
- When a module is extracted, its tests move down with it; the parent suite keeps only what it alone can prove (the wiring, the lifecycle, the real component tree)
- Before trimming a suite, check whether the extracted siblings have tests of their own. If they do not, the parent is sole coverage and its size is earned
- Every removed test needs a named surviving counterpart. No counterpart, no removal
- Line-count targets are a symptom, not a goal

## Accessibility

- Decorative icons: `aria-hidden="true"`
- Error messages: `role="alert"`
- Interactive elements: explicit `role`, `aria-selected`, `aria-label` where needed

## Tailwind Styling

- Order styles:
  - layouts (flex, block, relative, absolute)
  - sizes (w, max-w, h, max-h)
  - margins (mx, my)
  - paddings (px, py)
  - backgrounds (bg, bg-color)
  - borders (border, border-color)
  - text (text-color, text-size)
  - fonts (font-weight)
  - focus/outline/ring
  - rounded borders (rounded, rounded-size)
  - shadows (shadow, shadow-size)
  - transitions
  - pointers (cursor-pointer)
- Layouts first. Widths before heights. x before y. Margins before padding. Backgrounds before borders before text. Colors before sizes. Transitions last. Primary before states (border, hover:border, focus:border). Primary before sizes (mx-auto, sm:mx-0).
- **No ternaries for state-driven styling when Tailwind has variant for it.** If state already exposed on DOM (`disabled`, `aria-disabled`, `aria-checked`, `aria-selected`, `aria-current`, `aria-pressed`, `aria-expanded`, `data-state`, `:hover`, `:focus`, `:focus-visible`, `:active`, `:checked`, `[open]`, etc.), drive styling off same attribute via corresponding Tailwind variant — not JS ternary that picks class string. Locks ARIA + visual state together so cannot drift, deletes branching logic from JSX. For descendant elements, mark stateful ancestor with `group` + use `group-aria-*:` / `group-data-*:` on child. See [Hover, Focus & Other States](https://tailwindcss.com/docs/hover-focus-and-other-states). Examples:

  ```tsx
  // BAD — ternary toggling classes for a state the DOM already exposes
  <button
    aria-disabled={isDisabled}
    className={isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
  />

  // GOOD — let the aria-disabled attribute drive the style
  <button
    aria-disabled={isDisabled}
    className="cursor-pointer aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
  />

  // BAD — ternary on a child of a stateful button
  <button aria-expanded={isOpen}>
    <i className={`fa-chevron-down ${isOpen ? '-rotate-180' : ''}`} />
  </button>

  // GOOD — group + group-aria-* on the child
  <button className="group" aria-expanded={isOpen}>
    <i className="fa-chevron-down group-aria-expanded:-rotate-180" />
  </button>
  ```

  Ternaries still correct for pure JS state with no DOM representation (e.g. `mode === 'login'`, animation gates, internal hover coordination across non-nested elements) — + for setting ARIA attribute itself (e.g. `aria-current={isActive ? 'page' : undefined}`).

- **A control that is WAITING marks itself, not just `aria-disabled`.** Add `data-busy` while a request is in flight, `data-cooldown` during a pause after an action that landed, `data-copied` after a copy. `ARIA_DISABLED` in `lib/styles.ts` withholds the 60% dim on those attributes and on `:focus-visible`, so a control that is refusing dims and one that is working does not. A new in-flight control that takes `aria-disabled` alone gets the wrong paint — it reads as unavailable when it is merely busy, and its focus ring composites away with it.

## Theme System (Bundles)

- 7-bundle architecture in `apps/web/src/theme/styles/bundles.css`: `base`, `mount`, `orbit`, `alert`, `warn`, `info`, `success`. Token shape: `--{bundle}-{slot}` (e.g. `--mount-border`).
- Slots: `bg`, `border`, `text`, `alt-text`, `highlight`, `highlight-fg`, `highlight-hover`. Base adds `subtle-text`. Base+mount add `input-bg`. Orbit omits its `bg` from the synthetic fallback (per-theme only).
- Shared components consume bundles via a `surface: 'base' | 'mount' | 'orbit'` prop (`FormInput`, `SlidingTabBar`, `IconButton`, `LinkButton`, `PrimaryButton`); `TabButton` picks up its host from its parent `SlidingTabBar`'s `data-surface` attribute via `group-data-*` variants. The host bundle is the rendering parent's surface, NOT the importing module's directory.
- `chrome-token-migration.test.ts` is an anti-regression tripwire — don't reintroduce legacy flat tokens (`--bg-input`, `--text-muted`, `--bg-surface`, etc) on migrated files. Add new migrated files to `MIGRATED_FILES`.
- `.themed-asset` utility opts an `<img>` into `--asset-filter` (day-for-night in dark mode). NEVER apply to QR codes, captchas, secrets, brand logos, or color-fidelity-critical user content.
- WCAG contract enforced in `bundles.contrast.test.ts`. CVD distinguishability in `bundles.distinguishability.test.ts` (culori, delta-E 2000 ≥ 10).
- `custom` is a user-editable theme whose `{dark,light}` palette of `--{bundle}-{slot}` tokens (plus `--focus-ring`) lives in the per-user `customTheme` column and is injected at runtime — distinct from the 10 film themes (`.css` files) and the off-book `branding` theme. Canonical token key list: `theme/customThemeTokens.ts` (`EDITABLE_VARS`/`CUSTOM_TOKEN_KEYS`); not in `bundles.contrast.test.ts` (validated live in the editor).

## Gotchas

- **Testing is split in three, coverage in two**: `npm run test` runs the api suite, the web suite, then the `test:root` lane, which is `node --test` over `eslint-rules/**/*.test.mjs` + `scripts/**/*.test.mjs` and is where the `bin/` command tests live. `npm run test:cov` chains the same three, but only the two workspaces are instrumented; the root lane runs its tests without a coverage report, since nothing gates on one.
- **Root `.mjs` files are linted and formatted by nothing**: `lint` and `format` are workspace-scoped to `apps/api` + `apps/web`, so the 19 `.mjs` files under `scripts/` and `eslint-rules/` are covered by neither. Measured 2026-08-19 against a candidate root flat config: 11 ESLint errors (9 autofixable import ordering, plus one comment run in `import-statement-order.mjs` and one deliberate control-character regex in `bin-cli.test.mjs`) and 1 Prettier diff, `scripts/bump-version.mjs`. Wiring the config in needs those fixed first, as its own change.
- **Front-end type checking is split in two**: `npm run build` runs `tsc -b` over `src` (the app config excludes test files), and `npm run typecheck:test --workspace @linklater/web` covers the tests. The root `npm run typecheck` chains the back-end and that second one, so validate front-end source with `npm run build` and everything else with `npm run typecheck`.
- **ESM Jest on the backend**: API test runner uses `--experimental-vm-modules`. No mock `bcryptjs` — use real low-round hashes (`bcrypt.hash('password', 1)`) to avoid ESM interop issues.
- **Prisma `P2025` in tests**: Prisma throws typed error class, not plain object. Mock with `Object.assign(new Error('...'), { code: 'P2025' })` so `instanceof` checks work correctly.
