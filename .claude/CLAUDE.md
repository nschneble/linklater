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
npm run lint                                      # Lint code for consistent style
npm run lint:migrations                           # Lint migrations using Squawk
npm run lint --workspace @linklater/web           # Lint front-end only
npm run lint --workspace @linklater/api           # Lint back-end only

# Testing
npm run test                                      # Run all tests
npm run test --workspace @linklater/web           # Test front-end only
npm run test apps/web/src/path/to/file.test.tsx   # Run a single front-end test file
npm run test --workspace @linklater/api           # Test back-end only
npm run test apps/api/src/path/to/file.spec.ts    # Run a single back-end test file
npm run test:cov                                  # Run all tests with code coverage

# Tuffgal (v2) visual regression tests
npm run dev:test                                  # Run dev server in test mode (TESTING_UI=1)
npm run tuffgal:setup                             # One-time: create test DB + seed user
npm run tuffgal                                   # Local advisory self-diff vs local git-ignored .cache (reports drift, exits 0)
npm run tuffgal:approve                           # Refresh LOCAL .cache reference only (does NOT write committed baselines)
npm run tuffgal:approve -- --desktop --new-only   # Pass Tuffgal flags after `--`

# Committed baselines (tuffgal/baselines) are re-seeded ONLY by CI when a maintainer
# comments `@tuffgal approve` on the PR. No local command writes them (macOS renders ≠ linux CI)

# Database
npm run migrate --workspace @linklater/api        # Run migrations + regenerate client
npm run migrate:reset --workspace @linklater/api  # Wipe, re-run migrations + regenerate client
npm run migrate:deploy --workspace @linklater/api # Production: apply committed migrations + regenerate client (non-interactive)
```

> **Note:** `migrate`, `migrate:reset` + `migrate:deploy` chain their Prisma command with `prisma generate`. Prisma 7 `prisma-client` generator need custom `output` path — `migrate dev` alone no auto-regenerate client.

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
  - Refactor files over 100 lines
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
- Sort imports alphabetically — within individual imports + across the import list. Sort the list by module path (the specifier string, e.g. `'../lib/api'`), not by the imported name. Put `import {}` before `import type {}`.

```typescript
// Example of poor import organization
import { useState, useEffect } from 'react';
import { stumbleLink } from '../lib/api';
import StumbleEmptyView from './StumbleEmptyView';

// Example of good import organization
import { stumbleLink } from '../lib/api';
import StumbleEmptyView from './StumbleEmptyView';
import { useEffect, useState } from 'react';
```

## Testing Patterns

- Backend mock services typed as: `jest.fn() as unknown as ServiceType`
- Mock factories (e.g. `makeLink()`, `makeUser()`) return consistent data with spread overrides
- Call `jest.clearAllMocks()` in `beforeEach`
- Back-end: `*.spec.ts` co-located with source
- Front-end: `*.test.tsx` co-located with source

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

## Theme System (Bundles)

- 7-bundle architecture in `apps/web/src/theme/styles/bundles.css`: `base`, `mount`, `orbit`, `alert`, `warn`, `info`, `success`. Token shape: `--{bundle}-{slot}` (e.g. `--mount-border`).
- Slots: `bg`, `border`, `text`, `alt-text`, `highlight`, `highlight-fg`, `highlight-hover`. Base adds `subtle-text`. Base+mount add `input-bg`. Orbit omits its `bg` from the synthetic fallback (per-theme only).
- Shared components consume bundles via a `surface: 'base' | 'mount' | 'orbit'` prop (`FormInput`, `SlidingTabBar`, `IconButton`, `LinkButton`, `PrimaryButton`); `TabButton` picks up its host from its parent `SlidingTabBar`'s `data-surface` attribute via `group-data-*` variants. The host bundle is the rendering parent's surface, NOT the importing module's directory.
- `chrome-token-migration.test.ts` is an anti-regression tripwire — don't reintroduce legacy flat tokens (`--bg-input`, `--text-muted`, `--bg-surface`, etc) on migrated files. Add new migrated files to `MIGRATED_FILES`.
- `.themed-asset` utility opts an `<img>` into `--asset-filter` (day-for-night in dark mode). NEVER apply to QR codes, captchas, secrets, brand logos, or color-fidelity-critical user content.
- WCAG contract enforced in `bundles.contrast.test.ts`. CVD distinguishability in `bundles.distinguishability.test.ts` (culori, delta-E 2000 ≥ 10).
- `custom` is a user-editable theme whose `{dark,light}` palette of `--{bundle}-{slot}` tokens (plus `--focus-ring`) lives in the per-user `customTheme` column and is injected at runtime — distinct from the 10 film themes (`.css` files) and the off-book `branding` theme. Canonical token key list: `theme/customThemeTokens.ts` (`EDITABLE_VARS`/`CUSTOM_TOKEN_KEYS`); not in `bundles.contrast.test.ts` (validated live in the editor).

## Gotchas

- **TypeScript build errors on the frontend**: pre-existing `tsc` errors exist in `apps/web`. `vite build` (not `tsc`) is true correctness check — use to validate frontend code.
- **ESM Jest on the backend**: API test runner uses `--experimental-vm-modules`. No mock `bcryptjs` — use real low-round hashes (`bcrypt.hash('password', 1)`) to avoid ESM interop issues.
- **Prisma `P2025` in tests**: Prisma throws typed error class, not plain object. Mock with `Object.assign(new Error('...'), { code: 'P2025' })` so `instanceof` checks work correctly.
