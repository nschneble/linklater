/**
 * What the page paints while the theme picker is previewing.
 *
 * The preview is provider-owned: hovering moves the context's
 * `previewTheme`, and `useThemeState` alone writes the attributes and the
 * inline custom tokens. Every defect here came from a second writer.
 */

import { act, fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ user: { userId: 'user-1' } as unknown }));

vi.mock('../../auth/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../auth/AuthContext')>()),
  useOptionalAuth: () => (session.user ? { user: session.user } : undefined),
}));

import {
  CUSTOM_THEME_ENABLED_KEY,
  CUSTOM_THEME_STORAGE_KEY,
  CVD_MODE_KEY,
  MODE_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from '../../theme/storage';
import {
  restoreSystemColorScheme,
  stubSystemColorScheme,
} from '../../../test/systemColorScheme';
import { ThemeProvider, useTheme } from '../../theme/ThemeContext';
import UserMenu from './index';
import type { AppView } from '../../lib/navigation';
import type { User } from '../../auth/AuthContext';

const root = () => document.documentElement;

function makeUser(): User {
  return {
    accountDeletionPending: false,
    connectedProviders: [],
    customTheme: null,
    customThemeEnabled: true,
    cvdMode: false,
    dyslexicFont: false,
    email: 'current@example.com',
    emailVerifiedAt: '2024-01-01T00:00:00.000Z',
    hasPassword: true,
    mode: 'dark',
    multiFactorMethod: null,
    multiFactorPending: false,
    pendingEmail: null,
    theme: 'scanner-darkly',
    userId: 'user-1',
    welcomedAt: null,
  };
}

// mirrors the app, where selecting commits through the context
function Menu() {
  const { setBaseTheme } = useTheme();
  return (
    <UserMenu
      user={makeUser()}
      view={'links' as AppView}
      isOpen={true}
      onToggle={vi.fn()}
      onClose={vi.fn()}
      onLogout={vi.fn()}
      onModeToggle={vi.fn()}
      onThemeSelect={setBaseTheme}
      onViewChange={vi.fn()}
    />
  );
}

function renderMenu() {
  const tree = () => (
    <ThemeProvider>
      <Menu />
    </ThemeProvider>
  );
  const { rerender } = render(tree());
  const trigger = document.querySelector<HTMLElement>(
    '[role="menuitem"][aria-haspopup="menu"]',
  );
  fireEvent.click(trigger as HTMLElement);
  return { rerender: () => rerender(tree()) };
}

function themeOption(label: string): HTMLElement {
  const flyout = document.querySelector<HTMLElement>('[aria-label="Theme"]');
  return within(flyout as HTMLElement).getByRole('menuitemradio', {
    name: new RegExp(label),
  });
}

beforeEach(() => {
  session.user = { userId: 'user-1' };
  window.localStorage.clear();
  window.localStorage.setItem(THEME_STORAGE_KEY, 'scanner-darkly');
  window.localStorage.setItem(MODE_STORAGE_KEY, 'dark');
  window.localStorage.setItem(CUSTOM_THEME_ENABLED_KEY, 'on');
  window.localStorage.setItem(
    CUSTOM_THEME_STORAGE_KEY,
    JSON.stringify({
      dark: { '--mount-border': '#abcabc' },
      light: { '--mount-border': '#123456' },
    }),
  );
  delete root().dataset.cvd;
  delete root().dataset.theme;
  delete root().dataset.mode;
  root().removeAttribute('style');
});

afterEach(restoreSystemColorScheme);

describe('selecting a theme after a preview', () => {
  it('leaves no custom tokens behind when a film theme is chosen', () => {
    renderMenu();

    fireEvent.mouseEnter(themeOption('Your Theme'));
    expect(root().style.getPropertyValue('--mount-border')).toBe('#abcabc');

    fireEvent.click(themeOption('Boyhood'));

    expect(root().style.getPropertyValue('--mount-border')).toBe('');
  });

  it('applies the custom tokens when the custom theme is chosen', () => {
    renderMenu();

    fireEvent.mouseEnter(themeOption('Boyhood'));
    fireEvent.click(themeOption('Your Theme'));

    expect(root().style.getPropertyValue('--mount-border')).toBe('#abcabc');
  });

  it('paints the chosen theme, not the one still under the pointer', () => {
    renderMenu();

    fireEvent.mouseEnter(themeOption('Boyhood'));
    fireEvent.click(themeOption('School of Rock'));

    expect(root().dataset.theme).toBe('school-of-rock');
  });
});

describe('leaving the theme area mid-preview', () => {
  it('puts the committed theme back', () => {
    renderMenu();

    fireEvent.mouseEnter(themeOption('Boyhood'));
    expect(root().dataset.theme).toBe('boyhood');

    const themeRow = document.querySelector<HTMLElement>(
      '[aria-label="Theme"]',
    )?.parentElement;
    fireEvent.mouseOut(themeRow as HTMLElement, {
      relatedTarget: document.querySelector('[role="menu"]:not([aria-label])'),
    });

    expect(root().dataset.theme).toBe('scanner-darkly');
  });
});

describe('an OS color-mode change during a live preview', () => {
  it('keeps the previewed theme and moves only the mode', () => {
    const system = stubSystemColorScheme('dark');
    renderMenu();

    fireEvent.mouseEnter(themeOption('Boyhood'));
    expect(root().dataset.theme).toBe('boyhood');

    act(() => system.flip('light'));

    expect(root().dataset.theme).toBe('boyhood');
    expect(root().dataset.mode).toBe('light');
  });

  it('re-resolves the custom tokens for the mode it moved to', () => {
    const system = stubSystemColorScheme('dark');
    renderMenu();

    fireEvent.mouseEnter(themeOption('Your Theme'));
    expect(root().style.getPropertyValue('--mount-border')).toBe('#abcabc');

    act(() => system.flip('light'));

    expect(root().style.getPropertyValue('--mount-border')).toBe('#123456');
  });
});

describe('logging out while a preview is live', () => {
  it('paints branding, which outranks any preview', () => {
    const { rerender } = renderMenu();

    fireEvent.mouseEnter(themeOption('Boyhood'));
    expect(root().dataset.theme).toBe('boyhood');

    session.user = null;
    act(() => rerender());

    expect(root().dataset.theme).toBe('branding');
  });
});

// why the hook's cvd borrow is unreachable: nothing to preview past this
describe('the picker while cvd mode is on', () => {
  it('refuses to preview a theme the mode does not allow', () => {
    window.localStorage.setItem(CVD_MODE_KEY, 'on');
    window.localStorage.setItem(THEME_STORAGE_KEY, 'apollo-10-1-2');
    renderMenu();

    fireEvent.mouseEnter(themeOption('Boyhood'));

    expect(root().dataset.theme).toBe('apollo-10-1-2');
    expect(root().dataset.cvd).toBe('on');
  });
});
