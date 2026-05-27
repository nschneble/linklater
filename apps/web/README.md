# React + Vite Front-End

## Environment Variables

| Variable                  | Required | Description                                                            |
| ------------------------- | -------- | ---------------------------------------------------------------------- |
| `VITE_API_BASE_URL`       | Yes      | Base API URL (no trailing slash)                                       |
| `VITE_GOOGLE_SSO_ENABLED` | No       | Set to `'true'` to show the Google sign-in button and linking controls |
| `VITE_APPLE_SSO_ENABLED`  | No       | Set to `'true'` to show the Apple Sign In button and linking controls  |

> **SSO feature flags:** the Google and Apple sign-in UI is hidden unless the
> corresponding `VITE_*_SSO_ENABLED` variable equals the string `'true'`.
> The API checks its own environment variables independently — both sides must
> be configured for SSO to work end-to-end.

## Component Overview

### Pages and Views

| Component                | Path                                  | Description                                                                          |
| ------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------ |
| `App`                    | `src`                                 | Root component; sets up routing and providers                                        |
| `AppShell`               | `src`                                 | Authenticated layout shell with theme/mode controls                                  |
| `AuthForm`               | `src/components/auth`                 | Login, sign-up, and forgot-password form                                             |
| `ExtensionAuthorizePage` | `src/components/auth`                 | Browser extension PKCE authorization page                                            |
| `LandingPage`            | `src/components/LandingPage`          | Public-facing marketing page                                                         |
| `LinksView`              | `src/components/links`                | Main links page (unread and read tabs)                                               |
| `NotFoundView`           | `src/components/errors`               | Authenticated 404 (catch-all under the app shell)                                    |
| `OAuthCallbackPage`      | `src/components/auth`                 | Handles OAuth redirect from the API                                                  |
| `ResetPasswordPage`      | `src/components/auth`                 | Password reset (token from email)                                                    |
| `SettingsView`           | `src/components/settings`             | Settings page                                                                        |
| `StumblePage`            | `src/components/stumble`              | Picks a random unread link and shows an interstitial confirm panel before navigating |
| `ThemeEditor`            | `src/components/settings/ThemeEditor` | Live theme customization                                                             |
| `VerifyEmailChangePage`  | `src/components/verify`               | Confirm an email address change                                                      |
| `VerifyEmailPage`        | `src/components/verify`               | Confirm a new account's email address                                                |
| `VerifyLoginPage`        | `src/components/verify`               | Handles the magic-link login callback                                                |

### Feature Components

| Component                | Path                      | Description                                     |
| ------------------------ | ------------------------- | ----------------------------------------------- |
| `AccountSettingsForm`    | `src/components/settings` | Change email + password                         |
| `ApiDocsView`            | `src/components/api-docs` | Interactive API reference powered by Scalar; sessionStorage-scoped PAT field on top |
| `ApiTokensList`          | `src/components/settings` | Renders PAT rows with revoke confirmation       |
| `ApiTokensSection`       | `src/components/settings` | Create, list, and revoke personal access tokens |
| `TokenInput`             | `src/components/api-docs` | Controlled PAT input with paste, show/hide, and live-region announcements |
| `BookmarkletSection`     | `src/components/settings` | Generates the installable bookmarklet           |
| `CvdModeToggle`          | `src/components/settings` | Enables / disables CVD mode in Settings         |
| `DangerZone`             | `src/components/settings` | Account deletion                                |
| `ErrorBoundary`          | `src/components/errors`   | React error boundary                            |
| `Header`                 | `src/components`          | Top navigation bar                              |
| `KeyboardShortcutsModal` | `src/components/links`    | List shortcut keys                              |
| `LinkCard`               | `src/components/links`    | Link renderer                                   |
| `LinkCardLayout`         | `src/components/links`    | Link card visual structure with anchor overlay  |
| `LinkForm`               | `src/components/links`    | Add link form                                   |
| `LinksControls`          | `src/components/links`    | Desktop link action buttons                     |
| `LinksList`              | `src/components/links`    | Paginated list of cards                         |
| `LinksMobileControls`    | `src/components/links`    | Mobile icon-only action buttons                 |
| `LinksToolbar`           | `src/components/links`    | Link tabs and search                            |
| `MfaView`                | `src/components/auth`     | TOTP / recovery-code challenge after login      |
| `ReauthForm`             | `src/components/settings` | Password + OTP re-auth for sensitive operations |
| `RecoveryCodesModal`     | `src/components/settings` | One-time recovery code display + copy           |
| `IdPsSection`            | `src/components/settings` | Connect / disconnect Google and Apple accounts  |
| `StatusBadge`            | `src/components/common`   | Themed status indicator with icon + label       |
| `StumbleEmptyView`       | `src/components/stumble`  | Stumble page empty state with Wikipedia teasers |
| `StumbleSection`         | `src/components/settings` | Bookmarkable "Stumble!" link card               |
| `TokenVerificationPage`  | `src/components/verify`   | Verify token flow                               |
| `TotpSetupView`          | `src/components/settings` | TOTP QR code + manual secret + verification     |
| `TwoFactorSection`       | `src/components/settings` | TOTP setup and management                       |
| `UserMenu`               | `src/components/UserMenu` | Site nav and theme picker                       |
| `WikipediaArticleList`   | `src/components/stumble`  | Renders three random Wikipedia teaser cards     |

### UI Primitives (`src/components/common`)

| Component       | Description                                                              |
| --------------- | ------------------------------------------------------------------------ |
| `Alert`         | Inline error/success banner                                              |
| `FormInput`     | Themed text input                                                        |
| `IconButton`    | Small pill button                                                        |
| `LinkButton`    | Hyperlink-styled text button                                             |
| `PrimaryButton` | Call-to-action button                                                    |
| `StatusBadge`   | Themed status indicator with icon, label, and theme-aware variant styles |
| `TabButton`     | Single tab                                                               |
| `Toast`         | Auto-dismissing notification                                             |

### UserMenu (`src/components/UserMenu`)

| Component           | Description                                                     |
| ------------------- | --------------------------------------------------------------- |
| `UserMenu`          | Top-level dropdown / sheet wrapper (responsive)                 |
| `MobileBottomSheet` | Slide-up sheet rendered on mobile breakpoints                   |
| `MenuItem`          | Single action row inside a `role="menu"`; supports `aria-label` |
| `MenuSection`       | Headed grouping container for related menu items                |
| `NavMenuItems`      | Standard navigation entries (Unread, Read, Settings)            |
| `InlineThemeList`   | Flat list of theme options for the mobile theme subview         |
| `ThemeSubmenu`      | Desktop flyout listing themes                                   |

### Landing Page (`src/components/LandingPage`)

| Component         | Description                                                    |
| ----------------- | -------------------------------------------------------------- |
| `LandingPage`     | Top-level wrapper rendered at the public `/` route             |
| `HeroSection`     | Full-height hero with tagline and "Get started" / "Log in" CTA |
| `FeaturesSection` | Three-column grid of feature tiles (Save, Stumble!, Share)     |
| `FooterSection`   | Links to About, GitHub, and Contact                            |

## State Management

### Contexts

| Context        | File        | What it holds                               |
| -------------- | ----------- | ------------------------------------------- |
| `AuthContext`  | `src/auth`  | The authenticated user object, auth actions |
| `ThemeContext` | `src/theme` | The active theme name, mode, and CVD mode   |

### Custom Hooks

| Hook                   | File                                  | Purpose                                                            |
| ---------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| `useFocusFirstButton`  | `src/lib/hooks`                       | Focuses the first button inside a ref when activated               |
| `useFocusReturn`       | `src/lib/hooks`                       | Captures `document.activeElement` on open and restores it on close |
| `useFocusTrap`         | `src/lib/hooks`                       | Wraps Tab/Shift+Tab inside a container; optional Escape callback   |
| `useKeyboardShortcuts` | `src/lib/hooks`                       | Registers keyboard shortcuts                                       |
| `useLinks`             | `src/lib/hooks`                       | Facade composing the three hooks below                             |
| `useLinksActions`      | `src/lib/hooks`                       | Handles link CRUD mutations                                        |
| `useLinksData`         | `src/lib/hooks`                       | Fetch and paginate links                                           |
| `useLinksForm`         | `src/lib/hooks`                       | Link creation form state                                           |
| `useMenuNavigation`    | `src/components/UserMenu`             | Arrow-key navigation in the menu                                   |
| `useMetadataPolling`   | `src/lib/hooks`                       | Polls `GET /links/:id` for metadata                                |
| `usePasteDetection`    | `src/lib/hooks`                       | Listens for `paste` events                                         |
| `useRandomLink`        | `src/lib/hooks`                       | Fetch random unread links                                          |
| `useTabNavigation`     | `src/lib/hooks`                       | Arrow-key navigation between tabs                                  |
| `useThemeOverrides`    | `src/components/settings/ThemeEditor` | Applies live theme CSS overrides                                   |
| `useThemePreview`      | `src/components/UserMenu`             | Hover-preview of theme choices in the user menu                    |

## API Patterns

All API calls live in `src/lib/api/` (an index re-exports from sub-modules:
`auth.ts`, `core.ts`, `links.ts`, `tokens.ts`, `users.ts`). Consumers can
continue to import from `../../lib/api`. Key behaviors:

- Reads `VITE_API_BASE_URL` from the Vite environment.
- Caches both the **access token** (JWT) and the **refresh token** in memory
  after reading from `localStorage`. The keys are `linklater_token` and
  `linklater_refresh_token`.
- Three additional keys track CVD mode across sessions:
  - `linklater_cvd_mode` — `'on'` or `'off'`; determines the initial
    CVD state on page load.
  - `linklater_pre_cvd_theme` — the theme that was active before
    CVD mode was enabled; restored when it is disabled.
  - `linklater_cvd_updated_at` — epoch timestamp written whenever
    CVD mode is toggled; used as a race guard so a page reload
    immediately after toggling does not revert the user's choice.
- Attaches `Authorization: Bearer <token>` to every authenticated request.
- On a `401` response, automatically calls `POST /auth/refresh` with the
  stored refresh token, updates both stored tokens, and **retries the
  original request once**. If the retry also fails, both tokens are cleared.
- Throws `ApiError` (a subclass of `Error`) with the server's message and
  HTTP status on non-2xx responses.
- `logout()` calls `DELETE /auth/sessions` (best-effort) to revoke all
  server-side refresh tokens, then clears the local token cache.

### Direct Third-Party Calls

| Module                 | Purpose                                                                                                                                             | Failure mode                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `src/lib/wikipedia.ts` | Fetches a random Wikipedia article summary for `StumbleEmptyView`. Hits `https://en.wikipedia.org/api/rest_v1/page/random/summary` unauthenticated. | Returns `null`; UI degrades to its fallback message.          |
| `src/lib/gravatar.ts`  | Builds the Gravatar URL for the authenticated user's avatar.                                                                                        | Pure URL builder — no network failure possible at this layer. |

## Global Accessibility Hook

When CVD mode is active, `ThemeProvider` writes
`data-cvd="on"` to `document.documentElement`. The following global
CSS rules in `src/index.css` activate automatically:

| Selector                                          | Behavior                                                 |
| ------------------------------------------------- | -------------------------------------------------------- |
| `[data-cvd='on'] *:focus-visible`                 | Thicker focus ring (3 px outline + 5 px box-shadow halo) |
| `[data-cvd='on'] :disabled, [aria-disabled]`      | Hatched diagonal stripe replaces opacity dimming         |
| `[data-cvd='on'] a`                               | All anchors underlined (`text-underline-offset: 2px`)    |
| `[data-cvd='on'] [aria-selected], [aria-checked]` | Inset left accent bar (3 px) marks the active selection  |

These rules require no per-component changes — any element that uses the
standard `disabled`, `aria-disabled`, `aria-selected`, or `aria-checked`
attributes picks them up automatically.

## Routing

| Path                   | Access        | Component                  |
| ---------------------- | ------------- | -------------------------- |
| `/`                    | Public        | `LandingPage`              |
| `/extension/authorize` | Public        | `ExtensionAuthorizePage`   |
| `/forgot-password`     | Public        | `AuthForm` (forgot mode)   |
| `/login`               | Public        | `AuthForm` (login mode)    |
| `/logout`              | Public        | `LogoutPage`               |
| `/oauth/callback`      | Public        | `OAuthCallbackPage`        |
| `/reset-password`      | Public        | `ResetPasswordPage`        |
| `/signup`              | Public        | `AuthForm` (register mode) |
| `/verify-email`        | Public        | `VerifyEmailPage`          |
| `/verify-email-change` | Public        | `VerifyEmailChangePage`    |
| `/verify-login`        | Public        | `VerifyLoginPage`          |
| `/settings/api`        | Authenticated | `ApiDocsView`              |
| `/editor`              | Authenticated | `ThemeEditor`              |
| `/read`                | Authenticated | `LinksView` (read)         |
| `/settings`            | Authenticated | `SettingsView`             |
| `/stumble`             | Authenticated | `StumblePage`              |
| `/unread`              | Authenticated | `LinksView` (unread)       |
| `*` (catch-all)        | Authenticated | `NotFoundView`             |

> **Note:** `/` is now the public landing page. Authenticated users who
> visit `/` are not redirected automatically — they see the landing page.
> The authenticated root (`/unread`) is reached after login.

> **Note:** `/extension/authorize` renders differently depending on auth state:
> if the user is not logged in, it shows a prompt to sign in; if they are
> logged in, it shows a confirmation dialog before triggering the PKCE flow.

> **Note:** `/stumble` shows an interstitial confirm panel with "Open link"
> and "Stumble again" buttons. The page no longer auto-redirects — that
> earlier behavior triggered an unannounced context change (WCAG 3.2.5) and
> broke the browser back button.

## Local HTTPS Development

`vite-plugin-mkcert` generates a locally-trusted certificate on first run so
the dev server boots at `https://localhost:5173`. The first run prompts for
your system password to install a local certificate authority — accept it
once and subsequent runs reuse the cert silently.

The API server optionally serves HTTPS too. Drop `apps/api/certs/key.pem`
and `apps/api/certs/cert.pem` (generated with `mkcert localhost`) into the
directory and the API switches from HTTP to HTTPS automatically. When the
files are absent, the API serves plain HTTP — the web dev server's
HTTPS-to-HTTPS proxying still works because Vite handles the SSL termination.

If your browser blocks the certificate the first time, accept the warning or
run `mkcert -install` to register the local CA in the system trust store.
