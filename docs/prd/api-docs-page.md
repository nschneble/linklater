# PRD: Interactive API Documentation Page

**Status:** Draft → Implementation
**Date:** 2026-05-27
**Owner:** Nick Schneble
**Implementer:** Claude (autonomous)

## 1. Problem

A Linklater user can create Personal Access Tokens (PATs) in **Settings → API Tokens**, but the app gives them no documentation of what those tokens unlock. New token holders are forced to read the source or guess endpoints. The PAT system shipped May 2026 anticipated browser-extension and third-party use; without docs, neither audience can self-serve.

## 2. Goals

- Document every PAT-callable endpoint (currently `/links/*` under `AnyAuthGuard`).
- Interactive: developer can paste their token and execute live requests against the API from the docs page.
- Discoverable from the API Tokens settings section — single click away from token creation.
- Stay in sync with code automatically (spec generated from existing `@nestjs/swagger` decorators, not hand-written).
- Accessible — keyboard, screen reader, dark mode, no flash on theme switch.

## 3. Non-Goals

- Documenting session-only endpoints (`/auth/*`, `/users/*`, `/tokens/*`). Out of scope until those are exposed to PATs.
- Multi-language SDK code samples (cURL + JS fetch are sufficient for v1).
- Public, unauthenticated marketing docs at a separate URL.
- A separate developer subdomain.
- OAuth, app registration, webhook reference (no webhooks exist yet).

## 4. Users & Stories

| User                     | Story                                                                  |
| ------------------------ | ---------------------------------------------------------------------- |
| Browser-extension author | "I just created a token. Show me how to POST a link."                  |
| Power user / scripter    | "I want to bulk-import 200 URLs from a CSV. What does the request look like?" |
| Future Linklater dev     | "I added a `/links/:id/star` endpoint. The docs page should reflect it without me touching the docs codebase." |

## 5. Design

### 5.1 Where it lives

- New authenticated route **`/settings/api`** inside the existing `AppShell`.
- Rendered as a new `AppView` value `'api-docs'` (extends `apps/web/src/lib/navigation.ts`).
- Lazy-loaded (matches the existing `ThemeEditor` pattern in `AppShell.tsx`).
- Document title: `'API documentation – Linklater'`.

### 5.2 Discovery

In `ApiTokensSection.tsx`, add a single inline link `View the API docs →` in the section header / under the "It'll only be shown once" notice. No new section, no banner clutter. Stripe's principle: docs reachable in one click from where the token was born.

### 5.3 Page layout

```
┌────────────────────────────────────────────────────────────┐
│ [back to settings]                                         │
│ # API documentation                                        │
│ One-paragraph intro: PATs unlock /links/* endpoints.       │
│                                                            │
│ ▸ Use one of your tokens                                   │
│   ┌──────────────────────────────────┐                     │
│   │ paste your `ltk_...` token here  │  [paste from clip.] │
│   └──────────────────────────────────┘                     │
│   This token is remembered for this tab only.              │
│                                                            │
│ ─── Scalar API Reference renders below ───                 │
│ /links — Save a URL                                        │
│ /links — List links                                        │
│ /links/random — …                                          │
│ /links/stumble — …                                         │
│ /links/:id — Get, Patch, Delete                            │
│ /links/:id/read, /links/:id/unread                         │
│ /links/read — Delete all read                              │
└────────────────────────────────────────────────────────────┘
```

### 5.4 Token handling (security)

PATs are **one-shot**: only visible once at creation. Therefore:

- **No dropdown** of existing tokens. The server has no way to surface raw token values — only one-way hashes.
- User pastes their token (or a freshly-created one) into a text input.
- Cache the pasted value in `sessionStorage` keyed `linklater.api-docs.pat`. Cleared on tab close.
- Provide a visible **Clear token** button.
- Token input is `type="password"` by default with a show/hide toggle.
- Never log the token. Never include it in URLs or query strings.
- The Scalar configuration receives the token via `authentication.securitySchemes.pat.token` and passes it as `Authorization: Bearer <token>`.

### 5.5 OpenAPI spec scope

- `@nestjs/swagger` already decorates every controller in the API. To keep the public spec focused on PAT-callable endpoints only, `SwaggerModule.createDocument(app, config, { include: [LinksModule] })`.
- Exposed at **`GET /openapi.json`** — no auth (the schema itself is not sensitive; the **endpoints** require auth).
- The `info` block: `title: "Linklater API"`, `description: "Personal access token endpoints."`, `version: <read from VERSION file>`.

### 5.6 Response DTOs

Today the controller has `@ApiResponse` text descriptions but no `type:` references — so the OpenAPI spec has no response body schemas. Add three thin DTO classes annotated with `@ApiProperty`:

- `LinkResponseDto` — single link shape (`id`, `url`, `title`, `description`, `imageUrl`, `metadataStatus`, `createdAt`, `readAt`).
- `PaginatedLinksResponseDto` — `{ data: LinkResponseDto[], total, page, limit }`.
- `StumbleResponseDto` — `{ url: string | null }`.
- `DeleteResultDto` — `{ success: true }`.
- `BulkDeleteResultDto` — `{ count: number }`.
- `RandomLinkResponseDto` — `{ link: LinkResponseDto | null }`.

Then add `type: <Dto>` to each `@ApiResponse`. DTOs live in `apps/api/src/links/dto/`.

These DTOs are **response shape descriptors only** — the service still returns Prisma objects. We do not add a runtime mapper.

### 5.7 Tech choices

| Concern        | Choice                                       | Why                                                                 |
| -------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| Spec generator | `@nestjs/swagger@^11` (already installed)    | Decorators already in place; no plugin needed.                      |
| Renderer       | `@scalar/api-reference-react`                | MIT licensed, modern UX, theming via CSS vars, built-in try-it.     |
| Spec format    | OpenAPI 3.0 (NestJS default)                 | Scalar accepts both 3.0 and 3.1; no upgrade required.               |
| Try-it auth    | Manual paste + sessionStorage                | PATs are one-shot; only secure path.                                |
| Theming        | Tailwind CSS vars passed via `customCss`     | Matches existing theme system (no flash on mode toggle).            |

## 6. Accessibility

(Subject to `accessibility-lead` review before merge.)

- Token input: `<label>` always rendered, `aria-describedby` for the "remembered for this tab only" helper text, `aria-required="false"`, `aria-invalid` when validation fails ("does not start with `ltk_`").
- Show/hide token toggle: real `<button>` with `aria-pressed` and `aria-label="Show token" / "Hide token"`.
- Clear token: real `<button>` with confirmation in a live region.
- Heading hierarchy: page `<h1>API documentation</h1>`, token section `<h2>Authenticate</h2>`, the Scalar reference itself is its own region.
- Scalar dark mode: drive from existing `[data-mode='dark']` attribute on `<html>` (matches the rest of Linklater).
- No focus-trap inside Scalar. Skip-link from page top to the spec body.
- All decorative icons get `aria-hidden="true"` per project convention.

## 7. Edge Cases

- **No token pasted yet** → Scalar still renders the reference; live "Try it" requests return 401, which is correctly documented.
- **Invalid prefix** → soft validation message under the input ("Personal access tokens start with `ltk_`"). Does not block.
- **Expired/revoked token** → API returns 401, Scalar shows the response body.
- **API offline** → `/openapi.json` 502 → Scalar shows its own error state. Acceptable.
- **Light/dark mode change** → Scalar re-styles via CSS vars without remount.
- **Mobile (<768px)** → Scalar's responsive layout collapses the sidebar; no extra work needed.

## 8. Telemetry / Metrics

None for v1. If we ship analytics later, count `/openapi.json` requests and `/settings/api` route hits — but no PII, no token values.

## 9. Rollout

- No feature flag. Ships behind authenticated routes only.
- No migration. No schema change. No new env vars.
- Existing PATs continue to work — docs are additive.

## 10. Open Questions (resolved)

- ~~Try-it auth: dropdown vs paste?~~ → Paste (PATs are one-shot).
- ~~Scope: all endpoints or PAT-only?~~ → PAT-only (`/links/*` via `LinksModule`).
- ~~Renderer?~~ → Scalar.
- ~~Discovery?~~ → Link from `ApiTokensSection`.

## 11. Implementation Plan

### Phase A — Backend (api)

1. `apps/api/src/links/dto/link-response.dto.ts` (new) — `LinkResponseDto`.
2. `apps/api/src/links/dto/paginated-links-response.dto.ts` (new) — `PaginatedLinksResponseDto`.
3. `apps/api/src/links/dto/stumble-response.dto.ts` (new) — `StumbleResponseDto`.
4. `apps/api/src/links/dto/random-link-response.dto.ts` (new) — `RandomLinkResponseDto`.
5. `apps/api/src/links/dto/delete-result.dto.ts` (new) — `DeleteResultDto` + `BulkDeleteResultDto`.
6. `apps/api/src/links/links.controller.ts` (edit) — add `type:` references to existing `@ApiResponse` decorators.
7. `apps/api/src/main.ts` (edit) — bootstrap `SwaggerModule`, expose `/openapi.json`. Scope to `LinksModule`.
8. `apps/api/src/main.spec.ts` or `apps/api/test/openapi.e2e-spec.ts` (new) — smoke test that `/openapi.json` returns 200 + has the expected paths.

### Phase B — Frontend (web)

1. `npm install --workspace @linklater/web @scalar/api-reference-react`.
2. `apps/web/src/lib/navigation.ts` (edit) — add `'api-docs'` to `AppView`.
3. `apps/web/src/AppShell.tsx` (edit) — extend `viewFromPath`, add lazy import, render branch, document title.
4. `apps/web/src/routes/User.tsx` (edit) — add `/settings/api` to the route list.
5. `apps/web/src/components/api-docs/ApiDocsView.tsx` (new) — page shell + token input + Scalar.
6. `apps/web/src/components/api-docs/TokenInput.tsx` (new) — labeled paste field with show/hide + clear.
7. `apps/web/src/components/settings/ApiTokensSection.tsx` (edit) — add "View the API docs" inline link.
8. `apps/web/src/components/api-docs/ApiDocsView.test.tsx` (new) — render test, token-state test.

### Phase C — Verification

1. `bin/flintest` — install, format, lint, test, build.
2. Manually verify route + Scalar bundle loads in dev server.
3. Manually verify dark mode + light mode rendering.

## 12. Estimated Bundle Cost

`@scalar/api-reference-react` is heavy (~300KB gzipped). Mitigated by lazy-loading — only paid by users who visit `/settings/api`.

## 13. Risks

| Risk                                    | Mitigation                                                    |
| --------------------------------------- | ------------------------------------------------------------- |
| Scalar styles bleed into Tailwind       | `customCss` scoped to CSS vars; verify visually               |
| ESM/Jest interop on new DTOs            | Existing `@nestjs/swagger` mock at `apps/api/src/__mocks__/@nestjs/swagger.ts` already shims decorators |
| Token leaks into logs                   | Never `console.log` token; never URL-encode it; never persist beyond sessionStorage |
| Bundle bloat                            | Lazy-load route                                               |
| Scalar incompatible with Tailwind v4    | Verified live; theme via CSS vars                             |
