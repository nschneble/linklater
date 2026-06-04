# Authoring actions + stories

Quick reference for how to write reliable testing-ui content. Read once
before authoring your first dozen actions. The framework will only catch
real regressions if its inputs are precise.

## The mental model

- **Action** — one named, reusable unit of user behaviour. Atomic. Ends
  with at most one screenshot. Lives in `actions/`. Composed of `steps`
  + optional `expect`, `mask`, `retry`, `diff`.
- **Story** — an ordered chain of actions that models a user journey.
  Lives in `stories/`. Declares `needs` (label prerequisites) and
  `produces` (labels it emits if it passes) for the dependency graph.

Authoring rule of thumb: **actions describe HOW; stories describe WHY.**
A `save-link` action says "navigate, click Add link, type a URL, submit."
A `user-saves-link` story says "as a logged-in user, I save a link."

## Hint resolution

Every interactive step (`click`, `input`, `waitFor`) takes a `hint` —
the locator description. Resolved in this precedence order:

1. `{ role, text }` — strongest contract. Uses Playwright's
   `getByRole(role, { name: text })`.
2. `{ role }` — when the screen only has one of that role.
3. `{ selector }` — explicit CSS / Playwright selector engine.
4. `{ text }` — last resort. Loose `getByText(text)`.

Prefer the highest you can. A `role + text` hint survives style refactors
and CSS rewrites; a raw CSS selector breaks the moment a class name
changes. Use `selector` only when role-based selection cannot
disambiguate.

`text` interpolates `${name}` placeholders against the action's
parameters. `selector` does too.

## When to use which feature

### `expect.anyOf` (success criteria)

Use on every action whose final step kicks off async work. Examples:
clicking `Save link` (HTTP POST + DOM update), submitting a login form,
clicking a navigation link.

The harness polls every candidate concurrently and waits until one
resolves. Screenshot capture only happens after success. Without
`expect`, the screenshot snaps mid-render and visual diffs become
noise.

```json
"expect": {
  "anyOf": [
    { "selector": "#links-list a" },
    { "role": "status", "text": "Saved" }
  ],
  "timeoutMs": 10000
}
```

Use multiple candidates when the success state has several valid
renderings — list item OR toast OR status banner. The harness wins on
the first to appear.

### `mask` (volatile regions)

Use when an element on the captured screen *should* render but its
content is non-deterministic. Examples: relative timestamps, random
suggestion callouts, animated counters, anything driven by external
data.

```json
"mask": [
  { "selector": "#suggestion-callout-title" },
  { "selector": "[data-time-relative]" }
]
```

Masks black out the matching elements before screenshot, so the
underlying rectangles stay stable across runs. Tune the rectangle by
masking a tighter wrapper if you can — masking the entire content area
hides real regressions too.

### `retry` (transient flakes)

Use when a step is provably racing with hydration or animation. Bounded
retry on `LocatorNotFoundError` only — every other error still fails
immediately.

```json
"retry": { "attempts": 2, "backoffMs": 200 }
```

Don't reach for retry as the first fix when a step misses. First check
whether `expect` on the *preceding* action would solve the race. Retry
papers over flakiness; `expect` removes its source.

### `intercept` (simulated backend states)

Use to force an error path — a 500, a 404, a malformed body — that the
real backend never produces in dev. Set `method` to scope the route to
one verb so the page can still load its data via GET while a POST
fails.

```json
{ "kind": "intercept", "pattern": "**/links", "method": "POST",
  "respond": { "status": 500, "body": { "message": "..." } } }
```

The route stays active for the rest of the story. Compose with later
actions to assert the error UI.

### `diff` thresholds (per-action tolerance)

Use when a screen has unavoidable minor drift (anti-aliased icons,
random gradient noise, sub-pixel layout shifts). Bump
`maxDiffRatio` to accept more pixel drift before flagging `changed`.

```json
"diff": { "maxDiffRatio": 0.02, "pixelThreshold": 0.1 }
```

Defaults: `pixelThreshold: 0.1` (perceptual similarity per pixel),
`maxDiffRatio: 0.005` (0.5% of pixels may drift). Tighten or loosen
deliberately — don't sprinkle it on every action.

## Fixtures (preloaded DB state)

Stories that need preloaded rows in the test DB declare named fixtures
that run before the browser context launches.

```json
{
  "story": "User reviews their reading history",
  "needs": ["logged-in"],
  "fixtures": ["user-with-read-history"],
  "actions": [{ "action": "visit-read" }]
}
```

Fixtures live under `src/runner/fixtures/`. Each is a deterministic
`(client: pg.Client) => Promise<void>` registered in
`src/runner/fixtures/index.ts`. Add a new fixture by writing the file,
registering its name in the registry, and listing it in the story.

Fixtures apply against the same shared test database. Two stories that
mutate overlapping rows in parallel will race — use `needs`/`produces`
to serialise them.

`npm run test:ui:setup` MUST have been run at least once before any
fixture executes; fixtures throw if the deterministic test user is
missing.

## Avoiding cross-story races

The test database is shared. Fixtures run before each story's browser
launches. Stories that mutate the *same* user row (or the same view's
content) in parallel will produce non-deterministic visual diffs.

Rules of thumb:

- A story whose action's screenshot depends on observable user state
  (e.g. screenshots `/unread` after fixtures populate it) should pin
  that state via a `fixture`. The fixture's `ON CONFLICT DO NOTHING`
  makes it idempotent and the topo-sort ensures the producer's storage
  state is ready first.
- A story that mutates a column another story screenshots must
  serialise via `produces` + `needs`. Example: if `user-saves-link`
  adds a row to `Link` and `user-views-unread-links` screenshots
  `/unread`, the latter must `needs` a label `produces`d by the
  former. Otherwise the screenshot grows by one card whenever
  ordering reshuffles.
- Settings-mutation stories (`change-password`, `change-email`,
  `toggle-cvd-mode`) all attach to the same user row. They are safe
  in parallel only when each screenshots its own success state and
  none of the downstream stories observe the mutated column. If you
  add a story that *reads* `cvdMode`, declare `needs:
  ["cvd-mode-toggled"]` on it.

When in doubt, run with `--workers 1` once. If a story flickers
between runs with workers=1, the bug is in the action itself, not the
schedule.

## Storage state + dependency graph

Stories declare needs and produces. Labels are opaque strings; the
harness validates uniqueness and topo-sorts at load time.

```json
{ "needs": ["logged-in"], "produces": ["account-with-3-links"] }
```

The first story that passes and `produces` a label persists its
Playwright storage state to `.auth/<label>.json`. Every story that
`needs` that label inherits the file as its initial context state —
no replay of the producer's actions.

Common patterns:

- A `login` story `produces: ["logged-in"]`.
- Stories that don't care about auth pass over `needs`.
- Don't create cycles. Don't produce the same label from two stories.

## Authoring checklist

For every new action:

- [ ] Does the final step kick off async work? Add `expect.anyOf`.
- [ ] Does the screen render anything random or time-based? Add `mask`.
- [ ] Does the screen genuinely drift between runs? Tune `diff.maxDiffRatio`.
- [ ] Are hint values stable against refactors? Prefer role-based.
- [ ] Are parameters explicit in `parameters: [...]`?

For every new story:

- [ ] Does it produce something other stories should reuse? Add `produces`.
- [ ] Does it depend on a state? Add `needs`.
- [ ] Could it run in parallel with siblings? (Usually yes — be explicit
      only when not.)

## Debugging a failed story

1. Open `report/index.html`. Read the failure section at the bottom.
2. Open the trace zip listed under the failure:
   `npx playwright show-trace report/traces/<story>.zip`. Walk the
   timeline, inspect DOM snapshots, watch network calls.
3. Compare baseline / actual / diff images in the report's screenshot
   panel — pixelmatch flagged something; check whether it's a real
   regression or new drift to absorb (`mask` or `maxDiffRatio`).
4. If the locator missed, re-read the hint precedence list above and
   make it tighter.

## Things this framework will not do

- It will not fix bad selectors silently. AI fuzzy matching is future
  work; today, a broken hint fails loudly.
- It will not retry network calls, async navigation, or page transitions
  beyond what `expect` covers.
- It will not de-flake suite design. Per-run DB reset + label-based
  storage state get you most of the way; the rest is on the author.

If you're tempted to disable an action because "it's flaky," the right
move is almost always to tighten `expect`, add a `mask`, or split the
action into two narrower ones.
