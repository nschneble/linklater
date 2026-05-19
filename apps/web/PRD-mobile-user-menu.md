# PRD: Mobile User Menu

**Status:** Ready for implementation
**Author:** Nick Schneble
**Date:** 2026-05-18

---

## Overview

The existing `UserMenu` is a polished desktop dropdown anchored to the avatar button in the top-right corner of `Header`. On mobile viewports (< 768px / Tailwind `md` breakpoint), the experience breaks in two ways:

1. The absolute-positioned `w-64` dropdown can overflow the viewport on narrow screens.
2. `ThemeSubmenu` opens as a horizontal flyout (absolute-positioned left or right of the trigger row) — a pattern that is unusable on touch.

This feature adds a mobile-specific layout: a full-width panel that slides in below the header row, with an inline stacked theme picker instead of the flyout. Desktop behavior is untouched.

---

## Goals

1. On mobile (< 768px), tapping the avatar opens a full-width panel that renders below the header row, pushing page content down.
2. The mobile panel contains the same sections and items as the desktop dropdown.
3. Theme selection works on mobile via an inline stacked list (tap to select, no hover preview).
4. The panel closes when the user taps the avatar again, taps outside the header area, or presses Escape.
5. Opening and closing animations are smooth (150ms).
6. Desktop behavior is completely unchanged — no visual or behavioral regressions.
7. `bin/flintest` passes (format, lint, test, build).

---

## Non-Goals

- Changing desktop dropdown behavior, layout, or keyboard navigation.
- Changing `AppShell`, auth flow, or routing.
- Adding hover-preview animations to the mobile theme picker (desktop-only feature).
- Backend or API changes.
- Changing the avatar button's visual appearance.

---

## Design

### Mobile UX (< 768px)

**Header row:** Logo button on the left, avatar button on the right — identical to desktop. The avatar button's `aria-expanded` attribute already reflects open state and continues to do so.

**Panel:** When the avatar is tapped, a full-width panel appears immediately below the header row. It:
- Spans the full width of the page (not constrained by the `max-w-4xl` inner container).
- Uses the same `bg-[var(--bg-elevated)]` and `border-b border-[var(--border)]` background/border as the header.
- Animates in with a combined `opacity` (0 → 1) and `translateY` (-8px → 0) transition over 150ms ease-out. Animates out at 100ms ease-in.
- Pushes page content down rather than overlaying it (it is in document flow, not `position: absolute`).
- Contains the same sections in the same order as the desktop dropdown:
  1. "Logged in as" section with the user's email.
  2. Navigation items: Your links, Settings, Switch mode, Theme editor.
  3. Theme picker (inline list — see below).
  4. Log out.
- Item rows use larger touch targets (`py-3` instead of `py-2`) for comfortable tapping.

**Inline theme picker:** Replaces the flyout. Renders a "Theme" section header followed by each theme as a tappable row:
- Layout: `[color dot] [label] [checkmark if active]`
- Tapping a theme commits the selection immediately (calls `onThemeSelect`) — no hover preview.
- The active theme shows a checkmark icon (`fa-check`) in `var(--accent)`.
- No `ThemeSubmenu` expand/collapse toggle; the list is always expanded within the panel.

**Closing behavior:**
- Tap avatar button again (toggle).
- Tap or touch anywhere outside the header element (the `<header>` root element, which wraps both the flex row and the mobile panel).
- Press Escape.

**Focus management:**
- Panel does not trap focus on mobile. The user can swipe away or scroll naturally.
- Escape returns focus to the avatar button.
- When the panel opens, focus moves to the panel container so Escape/arrow keys are immediately available.

### Desktop UX (>= 768px)

Zero changes. The existing dropdown, ThemeSubmenu flyout, hover preview, and all keyboard navigation continue to work exactly as they do today.

---

## Architecture

### State ownership after refactor

| State | Owner | Notes |
|---|---|---|
| `showUserMenu` | `Header` | Lifted up so `MobileMenuPanel` can be a sibling of the `UserMenu` flex row. |
| `showThemeSubmenu` | `UserMenu` | Desktop-only flyout state — stays internal. |
| `previewTheme` | `UserMenu` | Desktop-only hover preview — stays internal. |
| `themeSubmenuOnLeft` | `UserMenu` | Desktop-only viewport calculation — stays internal. |
| `isThemeAreaPointerOver` | `UserMenu` | Desktop-only hover tracking — stays internal. |

`Header` passes `isOpen` and `onToggle` down to `UserMenu`. `UserMenu` stops owning `showUserMenu` but otherwise owns all theme-submenu state.

`MobileMenuPanel` receives all props it needs directly from `Header`: `user`, `view`, `isOpen`, `baseTheme`, `mode`, and the action callbacks (`onLogout`, `onModeToggle`, `onThemeSelect`, `onViewChange`, `onClose`). No shared hook is needed.

### Component breakdown

#### `Header.tsx` (modified)

- Adds `showUserMenu` state (boolean, default false).
- Adds `handleUserMenuToggle` and `handleUserMenuClose` handlers.
- Wraps current `<header>` content so it can render `MobileMenuPanel` as a sibling div inside `<header>`, beneath the flex row.
- Passes `isOpen={showUserMenu}` and `onToggle={handleUserMenuToggle}` to `UserMenu`.
- Passes all required props to `MobileMenuPanel` (see props table below).
- Adds a `touchstart` / `mousedown` listener on `document` (active only when `showUserMenu` is true) that closes the panel when the touch/click target is outside the `<header>` element. Use a `headerReference` ref (`useRef<HTMLElement | null>(null)`) attached to the `<header>` tag.
- Adds a `keydown` listener on `document` for Escape (active only when `showUserMenu` is true) that closes the panel and returns focus to the avatar button. Use a `avatarReference` ref passed via a `onAvatarRefReady` callback from `UserMenu`, OR expose focus via a forwarded ref from `UserMenu`.

**Revised `HeaderProps` interface:**

```typescript
interface HeaderProps {
  user: User;
  view: AppView;
  onLogout: () => void;
  onModeToggle: () => void;
  onThemeSelect: (theme: BaseTheme) => void;
  onViewChange: (view: AppView) => void;
}
```

No new props on `HeaderProps` — `Header` now owns `showUserMenu` internally.

**`Header` render structure:**

```tsx
<header ref={headerReference} className="bg-[var(--bg-elevated)] border-b border-[var(--border)]">
  <div className="flex items-center justify-between max-w-4xl mx-auto px-4 py-3">
    {/* logo button — unchanged */}
    <div className="flex items-center gap-3">
      <UserMenu
        user={user}
        view={view}
        isOpen={showUserMenu}
        onToggle={handleUserMenuToggle}
        onLogout={onLogout}
        onModeToggle={onModeToggle}
        onThemeSelect={onThemeSelect}
        onViewChange={onViewChange}
      />
    </div>
  </div>

  {/* Mobile panel — only rendered in DOM on mobile, hidden on md+ */}
  <MobileMenuPanel
    user={user}
    view={view}
    isOpen={showUserMenu}
    baseTheme={baseTheme}
    mode={mode}
    onClose={handleUserMenuClose}
    onLogout={onLogout}
    onModeToggle={onModeToggle}
    onThemeSelect={onThemeSelect}
    onViewChange={onViewChange}
  />
</header>
```

`baseTheme` and `mode` are read from `useTheme()` inside `Header`. `Header` does not currently call `useTheme()` — this will be a new addition.

#### `UserMenu/index.tsx` (modified)

**New props added to `UserMenuProps`:**

```typescript
interface UserMenuProps {
  user: User;
  view: AppView;
  /** Whether the menu is open. Controlled by Header. */
  isOpen: boolean;
  /** Called when the avatar button is clicked. */
  onToggle: () => void;
  onLogout: () => void;
  onModeToggle: () => void;
  onThemeSelect: (theme: BaseTheme) => void;
  onViewChange: (view: AppView) => void;
}
```

**Removed internal state:** `showUserMenu` and its setter. Replace all internal references to `showUserMenu` with the `isOpen` prop and all `setShowUserMenu` calls with `onToggle()` (for the avatar button click) or a new `onClose` prop pattern.

Since the component needs to imperatively close the menu (e.g. after selecting a nav item, after `handleThemeSelect`), `Header` should also pass an `onClose` callback:

```typescript
interface UserMenuProps {
  // ...existing...
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}
```

All existing `setShowUserMenu(false)` calls inside `UserMenu` become `onClose()`. The avatar button's `onClick` calls `onToggle()`.

All effects that currently depend on `showUserMenu` are updated to use `isOpen`.

The outside-click `mousedown` listener and the Escape `keydown` listener that currently live in `UserMenu` are **removed** from `UserMenu` and moved to `Header` (where they can cover both the desktop dropdown and the mobile panel in a single place).

Everything else — `showThemeSubmenu`, `previewTheme`, `themeSubmenuOnLeft`, `isThemeAreaPointerOver`, the `useMenuNavigation` hooks, `resetPreview`, `handlePreviewChange`, `handleThemeRowEnter`, `flyoutReference`, `menuReference`, `themeRowReference` — stays exactly as it is.

#### `UserMenu/MobileMenuPanel.tsx` (new file)

A new component rendered inside `<header>` below the flex row.

**Props interface:**

```typescript
interface MobileMenuPanelProps {
  user: User;
  view: AppView;
  /** Whether the panel is visible. */
  isOpen: boolean;
  /** The currently active base theme. Used by InlineThemeList. */
  baseTheme: BaseTheme;
  /** The current color mode. Used to render the mode toggle label. */
  mode: Mode;
  /** Called to close the panel (e.g. after selecting a nav item). */
  onClose: () => void;
  onLogout: () => void;
  onModeToggle: () => void;
  onThemeSelect: (theme: BaseTheme) => void;
  onViewChange: (view: AppView) => void;
}
```

**Render structure:**

```tsx
<div
  className="md:hidden overflow-hidden"
  aria-hidden={!isOpen}
  style={{
    transition: `opacity ${isOpen ? '150ms ease-out' : '100ms ease-in'}, transform ${isOpen ? '150ms ease-out' : '100ms ease-in'}`,
    opacity: isOpen ? 1 : 0,
    transform: isOpen ? 'translateY(0)' : 'translateY(-8px)',
    pointerEvents: isOpen ? 'auto' : 'none',
  }}
>
  <div role="menu" tabIndex={-1} ref={panelReference} className="pb-2">
    {/* Logged in as section */}
    {/* Nav items (Your links, Settings, Mode toggle, Theme editor) */}
    {/* InlineThemeList */}
    {/* Log out */}
  </div>
</div>
```

The outer `div` uses `md:hidden` so it is entirely absent from the layout on desktop. `aria-hidden` is toggled to hide the closed panel from assistive technology. The inner `div` has `role="menu"`.

Nav items in the mobile panel use `<button>` elements with `role="menuitem"` and `py-3` for comfortable touch targets. The `onClick` of each nav item calls the relevant callback and then `onClose()`.

The panel does not use `useMenuNavigation` — keyboard navigation on mobile is not required beyond Escape (which is handled at `Header` level). Arrow key navigation is a desktop concern.

When `isOpen` transitions to true, focus should move to `panelReference.current` via a `useEffect` so Escape is capturable.

#### `UserMenu/InlineThemeList.tsx` (new file)

Renders the full theme list as stacked rows for mobile.

**Props interface:**

```typescript
interface InlineThemeListProps {
  /** The currently active base theme. */
  baseTheme: BaseTheme;
  /** Called when the user taps a theme row. */
  onSelect: (theme: BaseTheme) => void;
}
```

**Render structure:** A `div` with a section label "Theme" followed by a `button` per theme in `THEMES`:

```tsx
<div>
  <p className="px-4 pt-3 pb-1 text-[var(--text-subtle)] text-[0.65rem] uppercase tracking-tight font-semibold">
    Theme
  </p>
  {THEMES.map((theme) => (
    <button
      key={theme.id}
      type="button"
      role="menuitem"
      className="flex items-center gap-3 w-full px-4 py-3 text-[var(--text)] text-sm text-left cursor-pointer active:bg-[var(--bg-surface)]"
      onClick={() => onSelect(theme.id)}
    >
      <span
        className="shrink-0 inline-block w-3 h-3 rounded-full"
        style={{ backgroundColor: theme.accent }}
      />
      <span className="flex-1">{theme.label}</span>
      {baseTheme === theme.id && (
        <i
          className="fa-solid fa-check text-[var(--accent)] text-[0.6rem]"
          aria-hidden="true"
        />
      )}
    </button>
  ))}
</div>
```

No hover preview logic. Tap commits immediately.

---

## Implementation Plan

Work in this exact order. Each step should have its tests written before implementation (TDD).

### Step 1 — Create `InlineThemeList.tsx` with tests

**File:** `apps/web/src/components/UserMenu/InlineThemeList.tsx`
**Test file:** `apps/web/src/components/UserMenu/InlineThemeList.test.tsx`

Tests to write first (RED):
- Renders a button for each theme in `THEMES`.
- Clicking a theme button calls `onSelect` with the correct theme id.
- The active theme (matching `baseTheme`) shows a checkmark element.
- Non-active themes do not show a checkmark element.

Then implement to green.

No refactor needed — file is small.

### Step 2 — Create `MobileMenuPanel.tsx` with tests

**File:** `apps/web/src/components/UserMenu/MobileMenuPanel.tsx`
**Test file:** `apps/web/src/components/UserMenu/MobileMenuPanel.test.tsx`

Tests to write first (RED):
- When `isOpen` is false, panel has `aria-hidden="true"` and `pointerEvents: none`.
- When `isOpen` is true, panel has `aria-hidden="false"` and `pointerEvents: auto`.
- The user's email is rendered.
- "Your links" button calls `onViewChange('links')` and then `onClose()`.
- "Settings" button calls `onViewChange('settings')` and then `onClose()`.
- "Theme editor" button calls `onViewChange('theme-editor')` and then `onClose()`.
- Mode toggle button calls `onModeToggle()`.
- Log out button calls `onLogout()` and then `onClose()`.
- Selecting a theme from `InlineThemeList` calls `onThemeSelect` with the correct theme id and then `onClose()`.

Then implement to green. Import `InlineThemeList`, `MenuItem`, `MenuSection`, `useTheme` (not needed — `baseTheme` and `mode` are passed as props). Use test utilities from `@testing-library/react`; wrap in a `ThemeProvider` for `InlineThemeList` if needed, or mock `useTheme` — but since `InlineThemeList` receives `baseTheme` as a prop, no context is needed.

### Step 3 — Modify `UserMenu/index.tsx`

Add `isOpen`, `onToggle`, and `onClose` to `UserMenuProps`. Remove `showUserMenu` state. Remove the outside-click `mousedown` listener and Escape `keydown` listener (they move to `Header`). Replace all `setShowUserMenu` calls:
- Avatar button `onClick` → `onToggle()`.
- All `setShowUserMenu(false)` calls (inside nav item clicks, `handleThemeSelect`, etc.) → `onClose()`.
- The `useEffect` that depends on `showUserMenu` → depends on `isOpen`.
- All JSX references to `showUserMenu` → `isOpen`.

Update the existing `UserMenu` tests (in `UserMenu.test.tsx` if it covers state) to pass `isOpen`, `onToggle`, and `onClose` as props. The test file currently only tests `useMenuNavigation` — confirm before modifying.

### Step 4 — Modify `Header.tsx`

Add imports: `MobileMenuPanel`, `useRef`, `useState`, `useEffect`, `useTheme`.

Add state and refs:
```typescript
const [showUserMenu, setShowUserMenu] = useState(false);
const headerReference = useRef<HTMLElement | null>(null);
const avatarButtonReference = useRef<HTMLButtonElement | null>(null);
```

Add handlers:
```typescript
function handleUserMenuToggle() {
  setShowUserMenu((open) => !open);
}

function handleUserMenuClose() {
  setShowUserMenu(false);
}
```

Add outside-click effect (covers both desktop dropdown and mobile panel):
```typescript
useEffect(() => {
  if (!showUserMenu) return;

  function handleOutsideInteraction(event: MouseEvent | TouchEvent) {
    const target = event.target as Node;
    if (headerReference.current && !headerReference.current.contains(target)) {
      setShowUserMenu(false);
    }
  }

  document.addEventListener('mousedown', handleOutsideInteraction);
  document.addEventListener('touchstart', handleOutsideInteraction);
  return () => {
    document.removeEventListener('mousedown', handleOutsideInteraction);
    document.removeEventListener('touchstart', handleOutsideInteraction);
  };
}, [showUserMenu]);
```

Add Escape effect:
```typescript
useEffect(() => {
  if (!showUserMenu) return;

  function handleEscapeKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      setShowUserMenu(false);
      // Return focus to avatar — see note on ref forwarding below
    }
  }

  document.addEventListener('keydown', handleEscapeKey);
  return () => document.removeEventListener('keydown', handleEscapeKey);
}, [showUserMenu]);
```

Read `baseTheme` and `mode` from `useTheme()` for passing to `MobileMenuPanel`.

Attach `ref={headerReference}` to the `<header>` element.

Pass `isOpen={showUserMenu}`, `onToggle={handleUserMenuToggle}`, `onClose={handleUserMenuClose}` to `UserMenu`.

Render `<MobileMenuPanel>` as the last child inside `<header>` (after the flex row div).

**Note on avatar focus after Escape:** `UserMenu`'s avatar button ref is internal. Two options:
- Option A: Expose a `onAvatarRefReady(reference: RefObject<HTMLButtonElement>)` callback prop from `UserMenu`, called in a `useEffect` inside `UserMenu` after mount.
- Option B: Forward a ref from `UserMenu` using `forwardRef` pointing at the avatar button.

**Use Option B** — `forwardRef` is the standard React pattern for this. `UserMenu` wraps its implementation in `forwardRef<HTMLButtonElement, UserMenuProps>` and attaches the forwarded ref to the avatar button. `Header` holds `avatarButtonReference` and passes it as `ref` to `UserMenu`. The Escape handler in `Header` then calls `avatarButtonReference.current?.focus()`.

Add a `Header.test.tsx` file at `apps/web/src/components/Header.test.tsx` with tests:
- Renders without error.
- Clicking the logo button calls `onViewChange('links')`.
- Clicking the avatar button shows the desktop dropdown (on desktop viewport).

These tests should be written before the implementation changes (RED), then made green.

### Step 5 — Verify existing tests still pass

Run `npm run test --workspace @linklater/web`. Fix any broken tests caused by the prop changes to `UserMenu`.

### Step 6 — Run `bin/flintest`

Full format, lint, test, build verification.

---

## File Summary

| Action | Path |
|---|---|
| Create | `apps/web/src/components/UserMenu/InlineThemeList.tsx` |
| Create | `apps/web/src/components/UserMenu/InlineThemeList.test.tsx` |
| Create | `apps/web/src/components/UserMenu/MobileMenuPanel.tsx` |
| Create | `apps/web/src/components/UserMenu/MobileMenuPanel.test.tsx` |
| Create | `apps/web/src/components/Header.test.tsx` |
| Modify | `apps/web/src/components/UserMenu/index.tsx` |
| Modify | `apps/web/src/components/Header.tsx` |

---

## Prop Shapes (Summary)

### `UserMenuProps` (after refactor)

```typescript
interface UserMenuProps {
  user: User;
  view: AppView;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onLogout: () => void;
  onModeToggle: () => void;
  onThemeSelect: (theme: BaseTheme) => void;
  onViewChange: (view: AppView) => void;
}
```

### `MobileMenuPanelProps`

```typescript
interface MobileMenuPanelProps {
  user: User;
  view: AppView;
  isOpen: boolean;
  baseTheme: BaseTheme;
  mode: Mode;
  onClose: () => void;
  onLogout: () => void;
  onModeToggle: () => void;
  onThemeSelect: (theme: BaseTheme) => void;
  onViewChange: (view: AppView) => void;
}
```

### `InlineThemeListProps`

```typescript
interface InlineThemeListProps {
  baseTheme: BaseTheme;
  onSelect: (theme: BaseTheme) => void;
}
```

---

## Acceptance Criteria

1. On a viewport < 768px wide, tapping the avatar button opens a full-width panel below the header row.
2. The panel contains: "Logged in as" + email, Your links, Settings, mode toggle, Theme editor, inline theme list (all themes), Log out.
3. Tapping a theme in the inline list commits the selection and closes the panel.
4. Tapping the avatar button again closes the panel.
5. Tapping or touching anywhere outside the `<header>` element closes the panel.
6. Pressing Escape closes the panel and returns focus to the avatar button.
7. The panel animates in (150ms ease-out) and out (100ms ease-in) via opacity + translateY.
8. On a viewport >= 768px, the desktop dropdown opens and closes exactly as before, with no visual or behavioral change.
9. The desktop ThemeSubmenu flyout works unchanged on desktop.
10. `aria-expanded` on the avatar button reflects open/closed state on both mobile and desktop.
11. The mobile panel has `aria-hidden="true"` when closed, `aria-hidden="false"` when open.
12. `bin/flintest` passes with zero errors.

---

## Testing Plan

### `InlineThemeList.test.tsx`

- **Renders all themes**: Query by role "button"; assert count equals `THEMES.length`.
- **Calls onSelect with correct id**: Click the second theme button; assert `onSelect` was called with `THEMES[1].id`.
- **Active theme shows checkmark**: Render with `baseTheme={THEMES[0].id}`; assert a checkmark element is present in the first row.
- **Inactive themes do not show checkmark**: Assert no checkmark in rows where `theme.id !== baseTheme`.

### `MobileMenuPanel.test.tsx`

Mock `user` with `{ email: 'test@example.com' }`. Provide `ThemeProvider` wrapper if needed (or pass `baseTheme` and `mode` directly as props — they are props, so no context needed for `MobileMenuPanel` itself).

- **Hidden when closed**: Render with `isOpen={false}`; assert outer div has `aria-hidden="true"`.
- **Visible when open**: Render with `isOpen={true}`; assert outer div has `aria-hidden="false"`.
- **Shows user email**: Assert `test@example.com` is in the document.
- **Your links navigates and closes**: Click "Your links"; assert `onViewChange` called with `'links'` and `onClose` called.
- **Settings navigates and closes**: Click "Settings"; assert `onViewChange` called with `'settings'` and `onClose` called.
- **Theme editor navigates and closes**: Click "Theme editor"; assert `onViewChange` called with `'theme-editor'` and `onClose` called.
- **Mode toggle calls onModeToggle**: Click mode toggle button; assert `onModeToggle` called.
- **Log out calls onLogout and onClose**: Click "Log out"; assert both called.
- **Theme selection calls onThemeSelect and onClose**: Click any theme row; assert `onThemeSelect` called with that theme id and `onClose` called.

### `Header.test.tsx`

Wrap with `ThemeProvider`. Provide minimal `user`, `view`, callbacks.

- **Renders without error**: Smoke test.
- **Logo click calls onViewChange links**: Click logo; assert `onViewChange('links')`.
- **Avatar click opens mobile panel**: Set viewport or test that `showUserMenu` state changes — best tested by asserting `aria-expanded` on the avatar button changes from `false` to `true` after click.
- **Clicking outside header closes panel**: Open panel; fire `mousedown` on `document.body`; assert `aria-expanded` returns to `false`.
- **Escape key closes panel**: Open panel; fire `keydown` with `key: 'Escape'` on `document`; assert `aria-expanded` returns to `false`.

### Existing tests

- `UserMenu.test.tsx` (currently only tests `useMenuNavigation` via a fake menu) — should need no changes.
- `ThemeSubmenu.test.tsx` — should need no changes.
- `MenuItem.test.tsx` — should need no changes.

---

## Open Questions

1. **forwardRef vs callback ref for avatar focus**: The PRD specifies `forwardRef` (Option B). If that creates complexity (e.g. ESLint display-name rules), Option A (callback prop `onAvatarRefReady`) is an acceptable alternative — document the choice in a comment.

2. **MobileMenuPanel height animation**: The PRD specifies `translateY(-8px → 0)` + opacity. If `max-height` animation (from `0` to `auto`) looks better in practice, the developer may substitute it — but `max-height` transitions on `auto` require a fixed max value. `translateY` is preferred.

3. **Panel visibility technique**: The PRD uses `pointerEvents: none` + `opacity: 0` (same pattern as the desktop dropdown) with `md:hidden` to fully remove it from layout on desktop. An alternative is conditional rendering (`{isOpen && <MobileMenuPanel />}`) on mobile. The `pointerEvents` + `aria-hidden` approach is preferred because it allows the enter animation to play — if conditionally rendered, the element must be in the DOM before the transition starts (requires a two-frame trick). The developer should use the opacity/pointerEvents approach unless they encounter issues.
