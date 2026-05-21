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

| Component                | Path                         | Description                                         |
| ------------------------ | ---------------------------- | --------------------------------------------------- |
| `App`                    | `src`                        | Root component; sets up routing and providers       |
| `AppShell`               | `src`                        | Authenticated layout shell with theme/mode controls |
| `AuthForm`               | `src/components/auth`        | Login, sign-up, and forgot-password form            |
| `ExtensionAuthorizePage` | `src/components/auth`        | Browser extension PKCE authorization page           |
| `LandingPage`            | `src/components/LandingPage` | Public-facing marketing page                        |
| `LinksView`              | `src/components/links`       | Main links page (unread and read tabs)              |
| `OAuthCallbackPage`      | `src/components/auth`        | Handles OAuth redirect from the API                 |
| `ResetPasswordPage`      | `src/components/auth`        | Password reset (token from email)                   |
| `SettingsView`           | `src/components/settings`    | Settings page                                       |
| `ThemeEditor`            | `src/components/ThemeEditor` | Live theme customization                            |
| `VerifyEmailChangePage`  | `src/components/verify`      | Confirm an email address change                     |
| `VerifyEmailPage`        | `src/components/verify`      | Confirm a new account's email address               |
| `VerifyLoginPage`        | `src/components/auth`        | Handles the magic-link login callback               |

### Feature Components

| Component                | Path                      | Description                                     |
| ------------------------ | ------------------------- | ----------------------------------------------- |
| `AccountSettingsForm`    | `src/components/settings` | Change email + password                         |
| `ApiTokensList`          | `src/components/settings` | Renders PAT rows with revoke confirmation       |
| `ApiTokensSection`       | `src/components/settings` | Create, list, and revoke personal access tokens |
| `BookmarkletSection`     | `src/components/settings` | Generates the installable bookmarklet           |
| `DangerZone`             | `src/components/settings` | Account deletion                                |
| `ErrorBoundary`          | `src/components/common`   | React error boundary                            |
| `Header`                 | `src/components`          | Top navigation bar                              |
| `KeyboardShortcutsModal` | `src/components/links`    | List shortcut keys                              |
| `LinkCard`               | `src/components/links`    | Link renderer                                   |
| `LinkCardLayout`         | `src/components/links`    | Link card structure                             |
| `LinkForm`               | `src/components/links`    | Add link form                                   |
| `LinksControls`          | `src/components/links`    | Link actions (mobile)                           |
| `LinksList`              | `src/components/links`    | Paginated list of cards                         |
| `LinksToolbar`           | `src/components/links`    | Link tabs and search                            |
| `CvdModeToggle`          | `src/components/settings` | Enables / disables CVD mode in Settings         |
| `SocialLoginsSection`    | `src/components/settings` | Connect / disconnect Google and Apple accounts  |
| `TokenVerificationPage`  | `src/components/auth`     | Verify token flow                               |
| `TwoFactorSection`       | `src/components/settings` | TOTP setup and management                       |
| `UserMenu`               | `src/components/UserMenu` | Site nav and theme picker                       |

### UI Primitives (`src/components/common`)

| Component       | Description                  |
| --------------- | ---------------------------- |
| `Alert`         | Inline error/success banner  |
| `FormInput`     | Themed text input            |
| `IconButton`    | Small pill button            |
| `LinkButton`    | Hyperlink-styled text button |
| `PrimaryButton` | Call-to-action button        |
| `TabButton`     | Single tab                   |
| `Toast`         | Auto-dismissing notification |

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

| Hook                   | File                         | Purpose                                |
| ---------------------- | ---------------------------- | -------------------------------------- |
| `useKeyboardShortcuts` | `src/lib/hooks`              | Registers keyboard shortcuts           |
| `useLinks`             | `src/lib/hooks`              | Facade composing the three hooks below |
| `useLinksActions`      | `src/lib/hooks`              | Handles link CRUD mutations            |
| `useLinksData`         | `src/lib/hooks`              | Fetch and paginate links               |
| `useLinksForm`         | `src/lib/hooks`              | Link creation form state               |
| `useMenuNavigation`    | `src/components/UserMenu`    | Arrow-key navigation in the menu       |
| `useMetadataPolling`   | `src/lib/hooks`              | Polls `GET /links/:id` for metadata    |
| `usePasteDetection`    | `src/lib/hooks`              | Listens for `paste` events             |
| `useRandomLink`        | `src/lib/hooks`              | Fetch random unread links              |
| `useTabNavigation`     | `src/lib/hooks`              | Arrow-key navigation between tabs      |
| `useThemeOverrides`    | `src/components/ThemeEditor` | Applies live theme CSS overrides       |

## API Patterns

All API calls live in `src/lib/api.ts`. Key behaviors:

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
| `/editor`              | Authenticated | `ThemeEditor`              |
| `/read`                | Authenticated | `LinksView` (read)         |
| `/settings`            | Authenticated | `SettingsView`             |
| `/unread`              | Authenticated | `LinksView` (unread)       |

> **Note:** `/` is now the public landing page. Authenticated users who
> visit `/` are not redirected automatically — they see the landing page.
> The authenticated root (`/unread`) is reached after login.

> **Note:** `/extension/authorize` renders differently depending on auth state:
> if the user is not logged in, it shows a prompt to sign in; if they are
> logged in, it shows a confirmation dialog before triggering the PKCE flow.
