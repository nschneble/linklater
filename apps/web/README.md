# React + Vite Front-End

## Environment Variables

| Variable            | Required | Description                      |
| ------------------- | -------- | -------------------------------- |
| `VITE_API_BASE_URL` | Yes      | Base API URL (no trailing slash) |

## Component Overview

### Pages and Views

| Component               | Path                         | Description          |
| ----------------------- | ---------------------------- | -------------------- |
| `App`                   | `src`                        | Root component       |
| `AppShell`              | `src`                        | Auth'd layout shell  |
| `AuthForm`              | `src/components`             | Login form           |
| `LinksView`             | `src/components`             | Main links page      |
| `ResetPasswordPage`     | `src/components`             | Password reset       |
| `SettingsView`          | `src/components`             | Settings             |
| `ThemeEditor`           | `src/components/ThemeEditor` | Theme editor         |
| `VerifyEmailChangePage` | `src/components`             | Verify email changes |
| `VerifyEmailPage`       | `src/components`             | Verify email         |

### Feature Components

| Component                | Path                      | Description             |
| ------------------------ | ------------------------- | ----------------------- |
| `AccountSettingsForm`    | `src/components`          | Change email + password |
| `BookmarkletSection`     | `src/components`          | Generates bookmarklet   |
| `DangerZone`             | `src/components`          | Account deletion        |
| `ErrorBoundary`          | `src/components`          | React error boundary    |
| `Header`                 | `src/components`          | Top navigation bar      |
| `KeyboardShortcutsModal` | `src/components`          | List shortcut keys      |
| `LinkCard`               | `src/components`          | Link renderer           |
| `LinkCardLayout`         | `src/components`          | Link card structure     |
| `LinkForm`               | `src/components`          | Add link form           |
| `LinksControls`          | `src/components`          | Link actions            |
| `LinksList`              | `src/components`          | Paginated list of cards |
| `LinksToolbar`           | `src/components`          | Link tabs, search       |
| `TokenVerificationPage`  | `src/components`          | Verify token flow       |
| `UserMenu`               | `src/components/UserMenu` | Site nav + theme picker |

### UI Primitives (`src/components/ui`)

| Component       | Description                  |
| --------------- | ---------------------------- |
| `Alert`         | Inline error/success banner  |
| `FormInput`     | Themed text input            |
| `IconButton`    | Small pill button            |
| `LinkButton`    | Hyperlink-styled text button |
| `PrimaryButton` | Call-to-action button        |
| `TabButton`     | Single tab                   |
| `Toast`         | Auto-dismissing notification |

## State Management

### Contexts

| Context        | File        | What it holds                 |
| -------------- | ----------- | ----------------------------- |
| `AuthContext`  | `src/auth`  | The authenticated user object |
| `ThemeContext` | `src/theme` | The active theme and mode     |

### Custom Hooks

| Hook                   | File                         | Purpose                |
| ---------------------- | ---------------------------- | ---------------------- |
| `useKeyboardShortcuts` | `src/lib`                    | Registers shortcuts    |
| `useLinks`             | `src/lib`                    | Facade for link data   |
| `useLinksActions`      | `src/lib`                    | Handles link CRUD      |
| `useLinksData`         | `src/lib`                    | Fetch + paginate links |
| `useLinksForm`         | `src/lib`                    | Link form              |
| `useMenuNavigation`    | `src/components/UserMenu`    | Arrow-key navigation   |
| `useMetadataPolling`   | `src/lib`                    | Polls for metadata     |
| `usePasteDetection`    | `src/lib`                    | `paste` event listener |
| `useRandomLink`        | `src/lib`                    | Fetch random links     |
| `useTabNavigation`     | `src/lib`                    | Arrow-key navigation   |
| `useThemeOverrides`    | `src/components/ThemeEditor` | Live theme overrides   |

## API Patterns

All API calls are centrally stored in a `src/lib` module.

The module:

- Reads `VITE_API_BASE_URL` from the Vite environment
- Caches the JWT in memory after reading from `localStorage`
- Attaches `Authorization: Bearer <token>` to every authenticated request
- Throws `Error` with the server's error message on non-2xx responses

## Routing

| Path                   | Access        | Component                |
| ---------------------- | ------------- | ------------------------ |
| `/`                    | Authenticated | _Redirects to_ `/unread` |
| `/editor`              | Authenticated | `ThemeEditor`            |
| `/read`                | Authenticated | `LinksView` (read)       |
| `/reset-password`      | Public        | `ResetPasswordPage`      |
| `/settings`            | Authenticated | `SettingsView`           |
| `/unread`              | Authenticated | `LinksView` (unread)     |
| `/verify-email`        | Public        | `VerifyEmailPage`        |
| `/verify-email-change` | Public        | `VerifyEmailChangePage`  |
| `*` (unauthenticated)  | Public        | `AuthForm`               |
