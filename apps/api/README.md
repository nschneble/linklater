# NestJS Back-End

## Environment Variables

| Variable                   | Required | Description                                                                                                                           |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`             | Yes      | PostgreSQL connection string                                                                                                          |
| `JWT_SECRET`               | Yes      | Used to sign and verify JWTs and HMAC state tokens for OAuth linking                                                                  |
| `TOTP_ENCRYPTION_KEY`      | Yes      | 64-char hex string used to encrypt stored TOTP secrets. Generate with `openssl rand -hex 32`. The server refuses to start without it. |
| `APP_URL`                  | Yes      | Public URL of the web app (e.g. `https://linklater.app`)                                                                              |
| `SMTP_HOST`                | Yes      | SMTP server hostname                                                                                                                  |
| `SMTP_PORT`                | Yes      | SMTP server port                                                                                                                      |
| `SMTP_SECURE`              | Yes      | Set to `true` to use TLS                                                                                                              |
| `SMTP_USER`                | No       | SMTP authentication username (omit for Mailpit)                                                                                       |
| `SMTP_PASS`                | No       | SMTP authentication password (omit for Mailpit)                                                                                       |
| `SMTP_FROM`                | Yes      | `From` address for all outbound emails                                                                                                |
| `CORS_ORIGIN`              | No       | Comma-separated allowlist of origins. Required in production; omit to allow any origin (development default).                         |
| `PORT`                     | No       | HTTP port to bind. Defaults to `3000`.                                                                                                |
| `GOOGLE_CLIENT_ID`         | No       | Google OAuth app client ID — omit to disable Google sign-in                                                                           |
| `GOOGLE_CLIENT_SECRET`     | No       | Google OAuth app client secret                                                                                                        |
| `GOOGLE_CALLBACK_URL`      | No       | Absolute URL of the Google sign-in callback (e.g. `.../auth/google/callback`)                                                         |
| `GOOGLE_LINK_CALLBACK_URL` | No       | Absolute URL for the Google account-linking callback (e.g. `.../auth/google/link/callback`)                                           |
| `APPLE_CLIENT_ID`          | No       | Apple Sign In service ID — omit to disable Apple sign-in                                                                              |
| `APPLE_TEAM_ID`            | No       | Apple developer team ID                                                                                                               |
| `APPLE_KEY_ID`             | No       | Apple Sign In key ID                                                                                                                  |
| `APPLE_PRIVATE_KEY`        | No       | Apple Sign In private key (PEM string)                                                                                                |
| `APPLE_CALLBACK_URL`       | No       | Absolute URL of the Apple Sign In callback                                                                                            |
| `EXTENSION_REDIRECT_URIS`  | No       | Comma-separated allowlist of redirect URIs accepted by the extension auth flow                                                        |

> **OAuth providers are loaded conditionally.** If the required environment
> variables for a provider are absent, that Passport strategy is never
> registered. The server starts normally without them.

> **Local email testing:** `bin/dev` starts [Mailpit](https://mailpit.axllent.org/)
> automatically alongside the API and web servers. All outgoing emails are
> captured at `http://localhost:8025`. No real email is sent in development.

## Module Overview

| Module     | Path           | Responsibility                                                        |
| ---------- | -------------- | --------------------------------------------------------------------- |
| `Auth`     | `src/auth`     | All auth flows: login, registration, JWTs, email tokens, OAuth, PATs  |
| `Email`    | `src/email`    | Send transactional emails via SMTP                                    |
| `Links`    | `src/links`    | Link CRUD, search, mark as read                                       |
| `Metadata` | `src/metadata` | Fetch Open Graph metadata tags                                        |
| `Prisma`   | `src/prisma`   | Prisma client wrapper                                                 |
| `Queue`    | `src/queue`    | Enqueue and process background jobs via pg-boss                       |
| `Tokens`   | `src/tokens`   | Personal access token (PAT) lifecycle: create, list, revoke, validate |
| `Users`    | `src/users`    | Profile management, account deletion                                  |

## Authentication Strategy

Linklater supports multiple authentication paths. All protected endpoints
require an `Authorization: Bearer <token>` header.

### JWT (web app)

1. `POST /auth/register` hashes the password with bcrypt and creates the
   user, then sends an email verification link.
2. `POST /auth/login` validates credentials and issues a signed JWT access
   token **and** a refresh token. The access token expires in **1 hour**.
   The refresh token expires in **1 year** and is stored hashed in the
   database.
3. `POST /auth/refresh` exchanges a still-valid refresh token for a new
   access token and a rotated refresh token (the old one is deleted).
4. JWT validation is performed by `JwtStrategy`. The `JwtAuthGuard` is used
   on routes that require a full session; `MfaAuthGuard` is used on the OTP
   verification step.

> **GOTCHA:** The JWT TTL changed from 90 days to 1 hour when refresh tokens
> were introduced. Access tokens are now short-lived; long-lived sessions are
> maintained by refresh token rotation. Bookmarklets embed a `kind =
BOOKMARKLET` PAT (not a JWT), so they are unaffected by JWT rotation and
> never expire. The only way to invalidate a bookmarklet is to click
> **Regenerate** in Settings, which atomically replaces the token in the
> database.

### Passwordless / Magic Links

`POST /auth/request-magic-link` sends a one-time login URL to the user's
email. The token expires in **15 minutes**. `POST /auth/verify-magic-link`
validates the token and returns an access + refresh token pair.

`POST /auth/register-magic-link` creates an account (if none exists) and
sends a magic link. When the email is already registered, it silently sends
a login link — the response is always 200 to prevent user enumeration.

### Personal Access Tokens (PATs)

PATs let browser extensions and other headless clients authenticate without
the browser-based OAuth or login flow.

- Tokens are prefixed with `ltk_` (e.g. `ltk_aBcDeFgHiJkL…`).
- The full raw token is shown **once** at creation time and then never again;
  only a SHA-256 hash is stored.
- The `AnyAuthGuard` (used on `LinksController`) accepts either a JWT or a
  PAT — it detects the `ltk_` prefix and routes accordingly.
- Endpoints are at `POST /tokens`, `GET /tokens`, and `DELETE /tokens/:id`.

### Google SSO / Apple Sign In

OAuth sign-in is handled by Passport strategies registered from environment
variables. Strategies are only registered when all required credentials are
present.

- `GET /auth/google` → redirects to Google. `GET /auth/google/callback` →
  handles the callback and redirects the browser to
  `/oauth/callback#token=<jwt>&refresh=<refreshToken>`.
- Apple uses the same pattern with a `POST` callback instead of `GET`.
- `mfa_required` is passed as an error query parameter when the user has
  MFA enabled and a passwordless login flow (Google/Apple SSO or magic
  link) cannot complete the second factor in-band.

### Google Account Linking

An already-authenticated user can link their Google account from Settings.

1. `GET /auth/google/link` — redirects to Google with a signed, time-limited
   HMAC state token encoding the user's ID. The state expires in 5 minutes.
2. `GET /auth/google/link/callback` — validated by `GoogleLinkStrategy`, which
   verifies the HMAC before extracting the user ID. The controller then calls
   `AuthService.linkOAuthAccountToUser`. On success it redirects to
   `/settings?linked=google`. On email mismatch it redirects to
   `/settings?link_error=email_mismatch`. On an already-linked conflict it
   redirects to `/settings?link_error=already_linked`.

> **GOTCHA:** `GET /auth/google/link` returns JSON (`{ url }`) instead of
> redirecting. The SPA calls this endpoint with `fetch` so it can attach an
> `Authorization` header — a top-level browser navigation cannot send that
> header and would receive a 401. The SPA then does `window.location.href =
url` to hand the user off to Google.

> **GOTCHA:** Google account linking requires that the Google account's email
> match the Linklater account's email exactly. The check is enforced in
> `OAuthAccountService.linkOAuthAccountToUser`. Mismatches redirect to
> `/settings?link_error=email_mismatch`.

### Browser Extension OAuth (PKCE Flow)

Extensions cannot use a full browser redirect flow, so a PKCE-based
authorization code exchange is used instead.

1. The extension generates a `code_verifier` and derives a `code_challenge`
   (SHA-256 of the verifier, base64url-encoded).
2. `GET /auth/extension/authorize?code_challenge=<>&redirect_uri=<>` — the
   user must be authenticated (JWT). The API creates a short-lived auth code
   (hashed in the database, expires in 5 minutes) and redirects to
   `redirect_uri?code=<rawCode>`.
3. `POST /auth/extension/token` — the extension exchanges the raw code and
   the `code_verifier`. The API re-derives the challenge from the verifier and
   compares it to the stored challenge. On match, the code is deleted and an
   access + refresh token pair is returned.

The allowed `redirect_uri` values are controlled by the
`EXTENSION_REDIRECT_URIS` environment variable (comma-separated). Unlisted
URIs are rejected with `400 Bad Request`.

### Multi-Factor Authentication (TOTP)

After `POST /auth/login`, when a user has TOTP enabled, the response is
`{ mfaToken, mfaMethod: 'totp' }` instead of `{ accessToken, refreshToken }`.
The caller must present this `mfaToken` (valid for 5 minutes) plus the
6-digit TOTP code to `POST /auth/verify-otp` to receive the real token pair.
Recovery codes are also accepted at `verify-otp` as `method: 'recovery'`.

## API Endpoint Contracts

### Users (`/users/me`) — requires JWT

| Method   | Path        | Auth | Accepted fields            |
| -------- | ----------- | ---- | -------------------------- |
| `GET`    | `/users/me` | JWT  | —                          |
| `PATCH`  | `/users/me` | JWT  | `theme`, `mode`, `cvdMode` |
| `DELETE` | `/users/me` | JWT  | —                          |

All `PATCH` fields are optional. `cvdMode` is a boolean; when set to
`true` the server records the preference alongside `theme` and `mode` so
the state survives a full re-login. The front-end also manages CVD mode
locally via `localStorage`. (see `apps/web/README.md` — API Patterns)

### Links (`/links`) — accepts JWT or PAT via `AnyAuthGuard`

| Method   | Path                | Auth       | Request Body / Query                               | Response                                                                            |
| -------- | ------------------- | ---------- | -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `POST`   | `/links`            | JWT or PAT | `{ url: string }`                                  | Created `Link` (metadata fetched async via the `fetch-metadata` queue)              |
| `GET`    | `/links`            | JWT or PAT | Query: `filter=unread\|read`, `q`, `page`, `limit` | `PaginatedLinks` (`{ links, total, limit, page }`)                                  |
| `GET`    | `/links/random`     | JWT or PAT | Query: `filter=unread\|read`                       | A single random `Link` or `null`                                                    |
| `POST`   | `/links/stumble`    | JWT or PAT | —                                                  | `{ url: string \| null }` — picks a random unread link and atomically marks it read |
| `GET`    | `/links/:id`        | JWT or PAT | —                                                  | `Link`                                                                              |
| `PATCH`  | `/links/:id`        | JWT or PAT | (reserved — no fields accepted yet)                | `Link`                                                                              |
| `POST`   | `/links/:id/read`   | JWT or PAT | —                                                  | `Link` with `readAt` set                                                            |
| `POST`   | `/links/:id/unread` | JWT or PAT | —                                                  | `Link` with `readAt` cleared                                                        |
| `DELETE` | `/links/read`       | JWT or PAT | —                                                  | `{ count: number }` — bulk delete of all read links                                 |
| `DELETE` | `/links/:id`        | JWT or PAT | —                                                  | `{ success: true }`                                                                 |

> **Route ordering matters.** `/links/stumble`, `/links/random`, and
> `/links/read` are declared before the `/links/:id` routes so NestJS does
> not interpret those literal segments as link IDs.

### Tokens (`/tokens`) — requires JWT

| Method   | Path                             | Auth | Request Body       | Response                                                 |
| -------- | -------------------------------- | ---- | ------------------ | -------------------------------------------------------- |
| `POST`   | `/tokens`                        | JWT  | `{ name: string }` | Created token including one-time `rawToken`              |
| `GET`    | `/tokens`                        | JWT  | —                  | Array of token summaries (no `rawToken`)                 |
| `DELETE` | `/tokens/:id`                    | JWT  | —                  | `{ success: true }`                                      |
| `GET`    | `/tokens/bookmarklet`            | JWT  | —                  | Bookmarklet token with `rawToken`; minted on first call  |
| `POST`   | `/tokens/bookmarklet/regenerate` | JWT  | —                  | New bookmarklet token; previous token revoked atomically |

**Created token response shape:**

```json
{
  "id": "uuid",
  "name": "Chrome Extension",
  "prefix": "ltk_aBcDeFgH",
  "createdAt": "2026-05-16T00:00:00.000Z",
  "lastUsedAt": null,
  "rawToken": "ltk_aBcDeFgH..."
}
```

`rawToken` is returned **only at creation time**. The list endpoint returns
the same shape minus `rawToken`.

### Auth Endpoints (`/auth`)

#### Password / Email Flow

| Method | Path                         | Auth   | Request Body                       | Response                                                                        |
| ------ | ---------------------------- | ------ | ---------------------------------- | ------------------------------------------------------------------------------- |
| `POST` | `/auth/register`             | Public | `{ email, password }`              | Created user (without `passwordHash`); verification email sent                  |
| `POST` | `/auth/login`                | Public | `{ email, password }`              | `{ accessToken, refreshToken }` or `{ mfaToken, mfaMethod }`                    |
| `GET`  | `/auth/me`                   | JWT    | —                                  | Current user profile + connected providers + MFA state                          |
| `POST` | `/auth/verify-email`         | Public | `{ token }`                        | 200                                                                             |
| `POST` | `/auth/resend-verification`  | JWT    | —                                  | 200                                                                             |
| `POST` | `/auth/forgot-password`      | Public | `{ email }`                        | 200 (always — no enumeration)                                                   |
| `POST` | `/auth/reset-password`       | Public | `{ token, password }`              | 200                                                                             |
| `POST` | `/auth/request-email-change` | JWT    | `{ email, code? }`                 | 200 (verification sent to the new address; `code` required when MFA is enabled) |
| `POST` | `/auth/verify-email-change`  | Public | `{ token }`                        | 200                                                                             |
| `POST` | `/auth/set-password`         | JWT    | `{ password }` (min 12 characters) | `{ success: true }`                                                             |

#### Magic Link

| Method | Path                        | Auth   | Request Body | Response                                                                         |
| ------ | --------------------------- | ------ | ------------ | -------------------------------------------------------------------------------- |
| `POST` | `/auth/request-magic-link`  | Public | `{ email }`  | 200 (always, even if email not found)                                            |
| `POST` | `/auth/register-magic-link` | Public | `{ email }`  | 200 (creates account if new, sends magic link)                                   |
| `POST` | `/auth/verify-magic-link`   | Public | `{ token }`  | `{ accessToken, refreshToken }` or `{ mfaToken, mfaMethod }` when MFA is enabled |

#### Sessions / Refresh Tokens

| Method   | Path             | Auth   | Request Body       | Response                                               |
| -------- | ---------------- | ------ | ------------------ | ------------------------------------------------------ |
| `POST`   | `/auth/refresh`  | Public | `{ refreshToken }` | `{ accessToken, refreshToken }` (rotated pair, atomic) |
| `DELETE` | `/auth/sessions` | JWT    | —                  | `{ success: true }` — all refresh tokens revoked       |

#### Multi-Factor Authentication

| Method   | Path                                  | Auth      | Request Body                             | Response                                             |
| -------- | ------------------------------------- | --------- | ---------------------------------------- | ---------------------------------------------------- |
| `POST`   | `/auth/verify-otp`                    | mfa-token | `{ code, method: 'totp' \| 'recovery' }` | `{ accessToken, refreshToken }`                      |
| `POST`   | `/auth/mfa/totp/setup`                | JWT       | —                                        | `{ qrCodeDataUrl, secret }`                          |
| `POST`   | `/auth/mfa/totp/verify`               | JWT       | `{ code }`                               | `{ recoveryCodes: string[] }` (10 codes, shown once) |
| `DELETE` | `/auth/mfa/totp/setup`                | JWT       | —                                        | 204 — pending secret cleared; idempotent             |
| `DELETE` | `/auth/mfa`                           | JWT       | `{ currentPassword?, code? }`            | 200                                                  |
| `POST`   | `/auth/mfa/recovery-codes/regenerate` | JWT       | `{ currentPassword?, code? }`            | `{ recoveryCodes: string[] }`                        |

#### OAuth (Google / Apple)

| Method   | Path                         | Auth        | Request Body / Query | Response                                                                                 |
| -------- | ---------------------------- | ----------- | -------------------- | ---------------------------------------------------------------------------------------- |
| `GET`    | `/auth/google`               | Public      | —                    | 302 to Google OAuth                                                                      |
| `GET`    | `/auth/google/callback`      | google      | —                    | 302 to `/oauth/callback#token=…&refresh=…` or `?error=mfa_required`                      |
| `GET`    | `/auth/apple`                | Public      | —                    | 302 to Apple Sign In                                                                     |
| `POST`   | `/auth/apple/callback`       | apple       | —                    | 302 to `/oauth/callback#token=…&refresh=…` or `?error=mfa_required`                      |
| `GET`    | `/auth/google/link`          | JWT         | —                    | `{ url: string }` — Google authorization URL for the SPA to navigate to (see note below) |
| `GET`    | `/auth/google/link/callback` | google-link | —                    | 302 to `/settings?linked=google` or `link_error=…`                                       |
| `DELETE` | `/auth/providers/:provider`  | JWT         | —                    | `{ success: true }`                                                                      |

#### Browser Extension (PKCE)

| Method | Path                        | Auth        | Request Body / Query             | Response                             |
| ------ | --------------------------- | ----------- | -------------------------------- | ------------------------------------ |
| `GET`  | `/auth/extension/authorize` | JWT + query | `code_challenge`, `redirect_uri` | 302 to `redirect_uri?code=<rawCode>` |
| `POST` | `/auth/extension/token`     | Public      | `{ code, codeVerifier }`         | `{ accessToken, refreshToken }`      |

> **KNOWN ISSUE:** Three throttler names used in `@Throttle()` decorators on
> the controller — `auth-request-magic-link`, `auth-verify-magic-link`, and
> `auth-refresh` — are not declared in the `ThrottlerModule.forRoot` array
> in `AppModule`. NestJS falls back to the first globally declared throttler
> when a named throttler is not found, which means these three endpoints are
> effectively rate-limited by the `auth-register` config (5 req / 60s) rather
> than the intended per-route limits. To fix, add matching entries to the
> `ThrottlerModule.forRoot` array in `src/app.module.ts`.

## OpenAPI Spec (`/openapi.json`)

The API serves a machine-readable OpenAPI 3.x document at `GET /openapi.json`
with no authentication required. The schema describes shapes, not data, so
exposing it publicly is safe — every endpoint it documents still requires a
valid token to call.

The document is intentionally **scoped to `LinksModule` only** (via
`{ include: [LinksModule] }` in `SwaggerModule.createDocument`). The
rationale: personal access tokens (PATs) can only call the links endpoints,
so the public spec should describe exactly that surface and nothing else.
Session-only routes (`/auth`, `/users`, `/tokens`) are deliberately excluded.

The Linklater web app embeds this spec in the `/settings/api` page using
the `@scalar/api-reference-react` component.

## SQL Migration Linting

All SQL migrations are linted with [Squawk](https://squawkhq.com) as part of
the standard lint pipeline.

```bash
npm run lint:migrations  # runs Squawk on all migrations
```

The Squawk configuration lives in `.squawk.toml` at the repository root.
Several rules are excluded project-wide; each exclusion is annotated with the
reason in that file.

**Every migration must:**

1. Begin with `set lock_timeout = '1s';` and `set statement_timeout = '5s';`
2. Add foreign key constraints with `NOT VALID`, immediately followed by
   `VALIDATE CONSTRAINT` on the next line

Never add `-- squawk-ignore-file` or `-- squawk-ignore-next-statement`.
If a new rule fires that should be excluded, add it to `.squawk.toml` with
a clear comment explaining why.

## Background Jobs

Two pg-boss job types run in the background:

- `fetch-metadata` is enqueued immediately after a link is created
- `read-link-cleanup` runs nightly and deletes read links older than seven days
