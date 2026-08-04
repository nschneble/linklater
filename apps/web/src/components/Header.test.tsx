/**
 * Tests for Header's document-level outside-interaction handling.
 *
 * Header owns one `isUserMenuOpen` state that drives two separate menu
 * surfaces: the desktop `UserMenu` dropdown (inside
 * `userMenuContainerReference`) and the mobile `MobileBottomSheet` (a
 * `role="dialog" aria-label="User menu"` sheet, a sibling ref). While open,
 * it attaches `mousedown` / `touchstart` / Escape listeners to `document`.
 *
 * Locks in the just-fixed mobile bug: the outside handler must treat a press
 * inside EITHER surface as "inside" and NOT close. The prior bug scoped the
 * check to the desktop container only, so a touchstart on a bottom-sheet item
 * was seen as "outside" and closed the sheet before the tap's click could
 * register — mobile menu items were unusable.
 *
 * Covers:
 *   - mousedown on a bottom-sheet item → does NOT close
 *   - touchstart on a bottom-sheet item → does NOT close (the exact regression)
 *   - [a11y] click on the sheet scrim → still closes (sole mobile close path)
 *   - mousedown outside both surfaces → closes
 *   - Escape → closes
 *   - menu closed → no listeners attached, presses do not close
 *   - sheet wrapper clips horizontally so the 200%-wide panel slider cannot
 *     pan the page (the mobile "viewport grows beyond its width" bug)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import Header from './Header';
import { ThemeProvider } from '../theme/ThemeContext';
import type { AppView } from '../lib/navigation';
import type { User } from '../auth/AuthContext';

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

function renderHeader(
  overrides: { isUserMenuOpen?: boolean; inert?: boolean } = {},
) {
  const onUserMenuClose = vi.fn();
  const props = {
    isUserMenuOpen: true,
    onLogout: vi.fn(),
    onModeToggle: vi.fn(),
    onThemeSelect: vi.fn(),
    onUserMenuClose,
    onUserMenuToggle: vi.fn(),
    onViewChange: vi.fn(),
    user: makeUser(),
    view: 'links' as AppView,
    ...overrides,
  };

  const utils = render(
    <ThemeProvider>
      <Header {...props} />
    </ThemeProvider>,
  );

  return { ...utils, onUserMenuClose };
}

function getSheetMenuItem(container: HTMLElement): HTMLElement {
  const sheet = container.querySelector(
    '[role="dialog"][aria-label="User menu"]',
  );
  const menuItem = sheet?.querySelector<HTMLElement>('[role="menuitem"]');
  if (!menuItem) {
    throw new Error('Expected a menu item inside the mobile bottom sheet');
  }
  return menuItem;
}

function getScrim(container: HTMLElement): HTMLElement {
  const scrim = container.querySelector<HTMLElement>('.scrim');
  if (!scrim) {
    throw new Error('Expected a scrim inside the mobile bottom sheet');
  }
  return scrim;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Header outside-interaction handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not close when a mousedown lands on a bottom-sheet menu item', () => {
    const { container, onUserMenuClose } = renderHeader();

    fireEvent.mouseDown(getSheetMenuItem(container));

    expect(onUserMenuClose).not.toHaveBeenCalled();
  });

  it('does not close when a touchstart lands on a bottom-sheet menu item', () => {
    const { container, onUserMenuClose } = renderHeader();

    fireEvent.touchStart(getSheetMenuItem(container));

    expect(onUserMenuClose).not.toHaveBeenCalled();
  });

  // [accessibility-review REQUIRED] scrim is the sole mobile close path
  it('closes when the sheet scrim is clicked', () => {
    const { container, onUserMenuClose } = renderHeader();

    fireEvent.click(getScrim(container));

    expect(onUserMenuClose).toHaveBeenCalledTimes(1);
  });

  it('closes when a mousedown lands outside both menu surfaces', () => {
    const { onUserMenuClose } = renderHeader();

    fireEvent.mouseDown(document.body);

    expect(onUserMenuClose).toHaveBeenCalledTimes(1);
  });

  it('closes when Escape is pressed', () => {
    const { onUserMenuClose } = renderHeader();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onUserMenuClose).toHaveBeenCalledTimes(1);
  });

  it('does not attach outside listeners while the menu is closed', () => {
    const { onUserMenuClose } = renderHeader({ isUserMenuOpen: false });

    fireEvent.mouseDown(document.body);
    fireEvent.touchStart(document.body);

    expect(onUserMenuClose).not.toHaveBeenCalled();
  });

  // 200%-wide panel slider needs overflow-x-hidden or iOS Safari pans page
  it('clips the bottom sheet horizontally so the panel slider cannot pan the page', () => {
    const { container } = renderHeader();

    const sheet = container.querySelector<HTMLElement>(
      '[role="dialog"][aria-label="User menu"]',
    );

    expect(sheet?.className).toContain('overflow-x-hidden');
  });
});

describe('Header inert while the save-link dialog traps focus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks the header element inert when inert is true', () => {
    const { container } = renderHeader({ inert: true });

    expect(container.querySelector('header')).toHaveAttribute('inert');
  });

  it('leaves the header interactive when inert is false', () => {
    const { container } = renderHeader({ inert: false });

    expect(container.querySelector('header')).not.toHaveAttribute('inert');
  });
});
