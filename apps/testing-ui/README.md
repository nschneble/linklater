# @linklater/testing-ui

Declarative JSON-driven UI testing harness for Linklater. Author user
behaviours as **actions** (atomic Playwright steps) and **stories** (chained
actions with dependency-graph ordering). Each successful action ends with a
masked, pixel-diffed screenshot so the run also builds a visual library that
doubles as regression coverage.

## Concepts

- **Action** — a named, reusable JSON object describing a sequence of steps
  (`navigate`, `click`, `input`, `scroll`, `intercept`, `waitFor`). Optional
  fields: `expect.anyOf` (success criteria the harness polls before
  screenshotting), `mask` (locators blacked out before capture), `retry`
  (bounded step-level retry), `screenshot`, `diff` thresholds.
- **Story** — a JSON object that chains actions together. Stories declare
  `needs` (label prerequisites) and `produces` (labels they emit). The
  harness topo-sorts the dependency graph at load time, detects cycles, and
  runs disjoint stories in parallel up to `--workers N`.
- **Label** — an opaque string that ties producers to consumers. The first
  story that passes and produces a label persists its Playwright storage
  state to `.auth/<label>.json`; consumer stories load it automatically. The
  canonical example: a `login` story produces `logged-in`; every other
  story declares `needs: ["logged-in"]`.
- **Hint** — the locator description on each interactive step. Resolved in
  this order: `role + text`, `role`, `selector`, `text`. Interpolated
  against the action's parameters so a single hint can reference `${url}`.

## Why a new harness

Existing tools (Playwright, Cypress) need code per scenario. This harness
treats actions and stories as data and the visual library as a first-class
build artifact. AI-powered fuzzy element matching and self-healing hints
are explicit future work; the MVP stays locator-only.

## Setup once

1. Install repo dependencies + Playwright browsers.

   ```bash
   npm install
   npm run install:browsers --workspace @linklater/testing-ui
   ```

2. Bootstrap the dedicated test database. Idempotent — safe to re-run.

   ```bash
   npm run test:ui:setup
   ```

   Creates `linklater_testing_ui`, runs every Prisma migration, and seeds a
   deterministic test user.

## Run a test pass

**Interactive (recommended for local iteration).** Two shells; the dev
server stays warm between runs so you keep React/Nest hot reload.

```bash
# Shell A — dev servers pointed at the test database
npm run dev:test

# Shell B — execute the harness
npm run test:ui
```

**One-shot (CI or quick smoke).** The harness spawns its own `dev:test`,
waits for both ports to open, runs the stories, then tears everything
down. Pays a ~25s cold-start on every invocation, but the developer's
normal `npm run dev` is left untouched.

```bash
npm run test:ui -- --manage-servers
```

Either way, Shell B truncates and re-seeds the test database before
every invocation, runs all stories in dependency order across the worker
pool, captures masked screenshots, diffs them against committed
baselines, and writes the HTML report to
`apps/testing-ui/report/index.html`. With `--manage-servers`, the spawned
dev server's combined stdout/stderr is teed to
`apps/testing-ui/report/dev-servers.log` for post-mortem.

Open the report:

```bash
open apps/testing-ui/report/index.html
```

## CLI

```
testing-ui run                   # run every story
testing-ui run --story <name>    # run one story (filename or story text)
testing-ui run --headed          # show the browser
testing-ui run --workers N       # override worker pool size
testing-ui run --manage-servers  # spawn dev:test, wait, run, kill (one-shot)
testing-ui approve               # promote every "changed" actual to its baseline
testing-ui approve --story <n>   # accept changes for one story
```

Wired via root scripts: `npm run test:ui`, `npm run test:ui:approve`,
`npm run test:ui:setup`.

## Authoring an action

```json
{
  "action": "save-link",
  "parameters": ["url"],
  "steps": [
    { "kind": "navigate", "path": "/unread" },
    { "kind": "click", "hint": { "role": "button", "text": "Add link" } },
    {
      "kind": "input",
      "hint": { "role": "textbox", "text": "URL" },
      "value": "${url}"
    },
    { "kind": "click", "hint": { "role": "button", "text": "Save link" } }
  ],
  "expect": {
    "anyOf": [{ "selector": "#links-list a" }]
  },
  "mask": [{ "selector": "#suggestion-callout-title" }],
  "retry": { "attempts": 2, "backoffMs": 200 },
  "diff": { "maxDiffRatio": 0.02 }
}
```

## Authoring a story

```json
{
  "story": "As a logged-in user, I can save a link I found.",
  "needs": ["logged-in"],
  "actions": [
    {
      "action": "save-link",
      "parameters": { "url": "http://httpforever.com/" }
    }
  ]
}
```

## Layout

```
apps/testing-ui/
├─ actions/                # JSON action definitions
├─ stories/                # JSON story definitions
├─ baselines/              # git-tracked PNGs; one per action
├─ report/                 # generated HTML report (gitignored)
│  └─ traces/              # Playwright trace zips, one per failed story
├─ .auth/                  # cached Playwright storage state (gitignored)
└─ src/                    # runner + schemas + reporter + scheduler
```

## Debugging a failure

The HTML report's "failures" section links to a Playwright trace zip per
failed story. Open with:

```bash
npx playwright show-trace apps/testing-ui/report/traces/<story>.zip
```

The trace viewer gives a full timeline, DOM snapshots per step, network
log, and screenshots — enough to figure out almost any flake without
adding logs to the harness.

## Status

Hardened MVP. Stability primitives (exit conditions, retry, masks,
deterministic test DB), parallelism, dependency-graph ordering, and trace
recording all land in this revision. AI fuzzy matching and CI wiring are
still future work.
