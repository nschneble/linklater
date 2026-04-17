# SPEC: Linklater Theme System

## Objective

Expand Linklater's current binary light/dark toggle into a 10-theme system: two generic defaults (light, dark) plus eight themes drawn from Richard Linklater movie posters. The selected theme is stored on the authenticated user's database record so it persists across sessions and devices. Unauthenticated users fall back to localStorage / system preference.

---

## Acceptance Criteria

1. **10 selectable themes** are listed in the user menu dropdown, each with a name and a colour swatch.
2. **Selecting a theme** applies it immediately (optimistic UI — no page reload).
3. **Theme persists to the database** for authenticated users via `PATCH /users/me`.
4. **On login / app load**, the theme stored in the database is applied before first paint (or as close to it as feasible given JWT auth flow).
5. **Unauthenticated state** (auth screen) respects localStorage, then system `prefers-color-scheme`.
6. **All existing UI components** use semantic CSS custom properties — no more inline `theme === 'light' ? '...' : '...'` conditionals in component JSX.
7. **New themes are visually coherent** with the poster they reference: dominant colours, accent colour, and surface treatment all echo the movie's look.

---

## Theme Definitions

### Identifiers

```
light | dark | scanner-darkly | before-sunrise | before-sunset |
before-midnight | boyhood | dazed-and-confused | hit-man | school-of-rock
```

### Semantic CSS Custom Properties (per theme on `[data-theme="X"]`)

| Property | Purpose |
|---|---|
| `--bg` | Main page background |
| `--bg-surface` | Card / panel background |
| `--bg-elevated` | Header, dropdowns, modals |
| `--bg-input` | Form input background |
| `--text` | Primary body text |
| `--text-muted` | Secondary / label text |
| `--text-subtle` | Placeholder / very faint |
| `--border` | Default border colour |
| `--accent` | Primary CTA / highlight |
| `--accent-hover` | Hover state of accent |
| `--accent-fg` | Text rendered on accent bg |

### Colour Palettes

| Theme | `--bg` | `--bg-surface` | `--text` | `--accent` | Character |
|---|---|---|---|---|---|
| `light` | `#f8fafc` | `#ffffff` | `#0f172a` | `#34d399` | Clean slate — default light |
| `dark` | `#020617` | `#0f172a` | `#f8fafc` | `#34d399` | Deep slate — default dark |
| `scanner-darkly` | `#0d0e24` | `#141628` | `#f0e6d0` | `#a3e635` | Indigo night, neon lime scanner brackets |
| `before-sunrise` | `#fdf6e3` | `#fff8ed` | `#2c1a08` | `#b45309` | Warm Viennese cream, amber-gold title |
| `before-sunset` | `#070604` | `#120e07` | `#f5e6c0` | `#d97706` | Paris black, rich golden dusk |
| `before-midnight` | `#0e2a45` | `#143350` | `#e8f4ff` | `#f59e0b` | Aegean navy sky, golden amber title |
| `boyhood` | `#0d1f0d` | `#122012` | `#f0faf0` | `#86efac` | Dark Texas grass, chalk-white text |
| `dazed-and-confused` | `#e8f5fe` | `#f0f9ff` | `#0f1a2a` | `#dc2626` | Sky blue, chunky 70s red |
| `hit-man` | `#110c00` | `#1c1400` | `#fef3c7` | `#f59e0b` | Warm near-black, split amber glow |
| `school-of-rock` | `#fafafa` | `#ffffff` | `#1a0505` | `#b91c1c` | Studio white, deep mahogany red |

Full property sets (including surface variants, borders, hover states) are defined in `apps/web/src/index.css`.

---

## Architecture

### Frontend

#### `apps/web/src/theme/ThemeContext.tsx`
- Expand `Theme` type from `'light' | 'dark'` to the union of all 10 identifiers.
- Replace `toggleTheme()` with `setTheme(theme: Theme)`.
- On `setTheme`, apply immediately to `document.documentElement.dataset.theme`, write to localStorage, and (if authenticated) call `updateMe({ theme })`.
- Expose a `THEMES` constant array with `{ id, label }` pairs for rendering the picker.
- `getInitialTheme` continues to read localStorage then system preference (for unauthenticated state).

#### `apps/web/src/auth/AuthContext.tsx`
- After a successful login or `getMe` response, call `setTheme(user.theme)` so the server-stored value takes effect on load.

#### `apps/web/src/lib/api.ts`
- Add `theme?: string` to the `updateMe` input type.
- `getMe` return type gains `theme: string`.

#### `apps/web/src/AppShell.tsx`
- Replace the single "Switch to dark / light mode" button in the user menu with a "Theme" section that lists all 10 themes as selectable items (name + colour swatch dot).
- Remove all `theme === 'light' ? '...' : '...'` Tailwind conditionals; use CSS custom property utilities instead (`bg-[var(--bg)]`, `text-[var(--text)]`, etc.), or leverage a small set of semantic Tailwind aliases defined via `@theme` in CSS.

#### All other components (`SettingsView`, `LinkCard`, `LinkForm`, `AuthForm`)
- Replace conditional theme class logic with semantic CSS variable utilities.

#### `apps/web/src/index.css`
- Define `[data-theme="X"]` blocks for all 10 themes, each setting the 11 custom properties above.
- Keep the `@import "tailwindcss"` at the top.
- Add Tailwind `@theme` aliases so utility classes like `bg-surface`, `text-muted`, `border-theme`, `bg-accent` resolve to the CSS variables.

---

### Backend

#### `apps/api/prisma/schema.prisma`
```prisma
model User {
  // ...existing fields...
  theme  String  @default("dark")
}
```

#### Migration
Run `prisma migrate dev --name add_user_theme`.

#### `apps/api/src/auth/auth.controller.ts` / `auth.service.ts`
- `GET /auth/me` response includes `theme`.

#### `apps/api/src/users/users.service.ts` / `users.controller.ts`
- `PATCH /users/me` accepts and stores `theme`.
- Validate that `theme` is one of the 10 known identifiers (pipe or manual check); reject unknown values with 400.

---

## Project Structure Changes

```
apps/
  api/
    prisma/
      schema.prisma          ← add theme field
      migrations/            ← new migration
    src/
      auth/
        auth.service.ts      ← include theme in me() response
        auth.controller.ts   ← include theme in me() response
      users/
        users.service.ts     ← accept theme in update
        users.controller.ts  ← accept theme in update DTO
  web/
    src/
      index.css              ← theme custom properties + Tailwind aliases
      theme/
        ThemeContext.tsx      ← expand type, setTheme, THEMES list
      auth/
        AuthContext.tsx       ← apply theme on login/load
      lib/
        api.ts               ← theme in updateMe + getMe types
      AppShell.tsx            ← theme picker dropdown
      components/
        SettingsView.tsx      ← remove conditional theme classes
        LinkCard.tsx          ← remove conditional theme classes (if any)
        LinkForm.tsx          ← remove conditional theme classes (if any)
        AuthForm.tsx          ← remove conditional theme classes (if any)
themes/                       ← existing poster images (reference only, not served)
```

---

## Code Style

- Tailwind v4 with `@import "tailwindcss"` and `@theme` for custom aliases.
- CSS custom properties set on `[data-theme="X"]` on `<html>` (already done for `dark` variant).
- No runtime `theme === 'x' ? '...' : '...'` branching in JSX after refactor — all variation lives in CSS.
- TypeScript: `Theme` is a string union, exported from `ThemeContext.tsx` and reused in `api.ts`.
- NestJS: use a simple `@IsIn([...VALID_THEMES])` validator or manual guard on the DTO.

---

## Testing Strategy

- **Manual smoke test**: log in, switch through all 10 themes, verify colours apply, log out and back in on a fresh tab — saved theme should restore.
- **Existing unit/e2e tests** should continue to pass; no behaviour changes to links or auth flow.
- No new automated tests required for this feature (purely presentational + a single field persisted).

---

## Boundaries

| Category | Rule |
|---|---|
| **Always do** | Apply theme optimistically before API round-trip confirms |
| **Always do** | Validate theme identifier server-side before persisting |
| **Always do** | Keep `light` and `dark` as the first two options in the picker (defaults first) |
| **Ask first** | If additional theme variants (e.g. a "light" version of each poster) are requested |
| **Never do** | Serve the poster images from the app (they are palette-reference only) |
| **Never do** | Break the existing `data-theme` attribute pattern on `<html>` |
| **Never do** | Store theme only in localStorage for authenticated users — it must hit the DB |
