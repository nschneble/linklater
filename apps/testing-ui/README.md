# @linklater/testing-ui

Declarative JSON-driven UI testing harness for Linklater. Authors describe
user behaviour as **actions** (atomic UI interactions) and **stories** (chained
actions), runs them against the live app, and captures a screenshot after each
successful action to build a visual library that doubles as regression coverage.

## Concepts

- **Action** — a named, reusable JSON object describing a sequence of steps
  (`navigate`, `click`, `input`, `scroll`, `intercept`, `waitFor`) that the
  harness executes against a Playwright `Page`. Each action ends with one
  screenshot.
- **Story** — a JSON object that chains actions together to model a real user
  journey. A failed action immediately fails its parent story so the harness
  never captures screenshots downstream of a broken step.
- **Hint** — the locator description on each interactive step. Carries
  visible text, ARIA role, an optional cached selector, and a position bucket.
  Today the resolver tries role + name, then text, then explicit selector. A
  future AI fallback can resolve and self-heal hints when the literal locator
  drifts.

## Why a new harness

Existing tools (Playwright, Cypress) require code per scenario. This harness
treats actions and stories as data and the visual library as a first-class
build artifact. The eventual differentiators are AI-powered fuzzy element
matching and self-healing hints, but the MVP stays locator-only and proves
the data model first.

## Quick start

```bash
# 1. Install dependencies + Playwright browsers
npm install
npm run install:browsers --workspace @linklater/testing-ui

# 2. Start Linklater dev servers in another shell
npm run dev

# 3. Seed the test user once per database
npm run seed --workspace @linklater/testing-ui

# 4. Run every story
npm run run --workspace @linklater/testing-ui

# 5. Open the report
open apps/testing-ui/report/index.html
```

## CLI

```
testing-ui run                     # run every story under stories/
testing-ui run --story <name>      # run one story by filename or story field
testing-ui run --headed            # show the browser while running
testing-ui approve                 # accept every "changed" baseline from the last run
testing-ui approve --story <name>  # accept changes for one story only
```

## Layout

```
apps/testing-ui/
├─ actions/      # JSON action definitions
├─ stories/      # JSON story definitions
├─ baselines/    # git-tracked PNGs; one per action
├─ report/       # generated HTML report (gitignored)
├─ .auth/        # cached Playwright storage state (gitignored)
└─ src/          # runner + schemas + reporter
```

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
  ]
}
```

## Authoring a story

```json
{
  "story": "As a user, I want to save a link I found.",
  "storageState": "logged-in",
  "actions": [
    { "action": "login" },
    { "action": "save-link", "parameters": { "url": "http://httpforever.com/" } }
  ]
}
```

## Status

MVP. AI fuzzy matching, self-healing hints, and CI wiring are deferred. The
HTML reporter still needs a pass from the accessibility lead before the page
ships as a long-term review surface.
