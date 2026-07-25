/**
 * Focus-management contract for the theme picker flyout submenu.
 *
 * Mirrors the main-menu Tab-close fix proven at the hook level in
 * `useMenuNavigation.test.tsx`: closing the menu on Tab must NOT snap focus
 * back to the trigger, because that would fight the browser's native
 * next-element Tab target (WCAG SC 2.4.3). Escape and Arrow-left, by contrast,
 * SHOULD return focus to the Theme trigger row.
 *
 * These three tests form a single round-trip proof of the wiring in
 * `index.tsx`:
 *   - Tab  → `closeFlyoutOnTab` (cleanup only, no `.focus()`)  → trigger NOT refocused
 *   - Esc  → `closeFlyout`      (cleanup + refocus trigger)    → trigger refocused
 *   - ←    → `closeFlyout`      (same)                          → trigger refocused
 */

import UserMenu from './index';
import { ThemeProvider } from '../../theme/ThemeContext';
import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppView } from '../../lib/navigation';
import type { User } from '../../auth/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    accountDeletionPending: false,
    connectedProviders: [],
    customTheme: null,
    customThemeEnabled: false,
    cvdMode: false,
    dyslexicFont: false,
    email: 'current@example.com',
    emailVerifiedAt: '2024-01-01T00:00:00.000Z',
    hasPassword: true,
    mode: 'light',
    multiFactorMethod: null,
    multiFactorPending: false,
    pendingEmail: null,
    theme: 'scanner-darkly',
    userId: 'user-1',
    welcomedAt: null,
    ...overrides,
  };
}

function renderMenu() {
  render(
    <ThemeProvider>
      <UserMenu
        user={makeUser()}
        view={'links' as AppView}
        isOpen={true}
        onToggle={vi.fn()}
        onClose={vi.fn()}
        onLogout={vi.fn()}
        onModeToggle={vi.fn()}
        onThemeSelect={vi.fn()}
        onViewChange={vi.fn()}
      />
    </ThemeProvider>,
  );
}

// The Theme row trigger is the only `role="menuitem"` inside the menu that
// opens a nested `menu` (the avatar button shares `aria-haspopup="menu"` but
// carries no `role` and lives outside the menu container).
function getThemeTrigger(): HTMLElement {
  const trigger = document.querySelector<HTMLElement>(
    '[role="menuitem"][aria-haspopup="menu"]',
  );
  if (!trigger) {
    throw new Error('Expected the Theme trigger row');
  }
  return trigger;
}

// Opens the flyout via keyboard (ArrowRight on the trigger), which sets the
// keyboard-open flag so the submenu auto-focuses its first option. Returns that
// now-focused first flyout item.
function openFlyoutAndGetFirstItem(): HTMLElement {
  const trigger = getThemeTrigger();
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowRight' });

  const firstItem = document.querySelector<HTMLElement>('[data-submenu-item]');
  if (!firstItem) {
    throw new Error('Expected a flyout submenu item after opening the flyout');
  }
  return firstItem;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UserMenu theme flyout focus management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT refocus the Theme trigger when Tab closes the flyout (SC 2.4.3)', () => {
    renderMenu();
    const firstItem = openFlyoutAndGetFirstItem();

    fireEvent.keyDown(firstItem, { key: 'Tab' });

    // Tab routes through `closeFlyoutOnTab`, which does state cleanup only and
    // never calls `.focus()`. Focus is left where it was for the browser's
    // native Tab advance, not snapped back to the trigger.
    expect(document.activeElement).not.toBe(getThemeTrigger());
  });

  it('DOES refocus the Theme trigger when Escape closes the flyout', () => {
    renderMenu();
    const firstItem = openFlyoutAndGetFirstItem();

    fireEvent.keyDown(firstItem, { key: 'Escape' });

    // Escape routes through `closeFlyout`, which returns focus to the trigger.
    expect(document.activeElement).toBe(getThemeTrigger());
  });

  it('DOES refocus the Theme trigger when Arrow-left closes the flyout', () => {
    renderMenu();
    const firstItem = openFlyoutAndGetFirstItem();

    fireEvent.keyDown(firstItem, { key: 'ArrowLeft' });

    // Arrow-left routes through `closeFlyout` (via `onArrowLeft`), which returns
    // focus to the trigger.
    expect(document.activeElement).toBe(getThemeTrigger());
  });
});
