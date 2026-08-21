/*
 * What the module decides at load, before anything renders. Split from
 * `useShortcutsEnabled.test.ts`, which owns runtime toggling and cross-tab
 * sync: every case here needs a module evaluated under conditions the
 * default import never saw, and none of that scaffolding belongs there.
 */

import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { KEYBOARD_SHORTCUTS_KEY } from './useShortcutsEnabled';
import { resetShortcutsPreference } from '../../../test/shortcutsPreference';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { withRefusedStorageAsync } from '../../../test/refusedStorage';

beforeEach(resetShortcutsPreference);

let freshModule: typeof import('./useShortcutsEnabled') | null = null;

afterEach(() => {
  freshModule?.stopCrossTabShortcutsSync();
  freshModule = null;
});

async function loadFreshModule() {
  vi.resetModules();
  const loadedModule = await import('./useShortcutsEnabled');
  freshModule = loadedModule;
  return loadedModule;
}

function makeShortcutOptions() {
  return {
    isShortcutsModalOpen: false,
    onNavigateNextLink: vi.fn(),
    onNavigatePrevLink: vi.fn(),
    onOpenSelectedLink: vi.fn(),
    onSearch: vi.fn(),
    onShowRead: vi.fn(),
    onShowUnread: vi.fn(),
    onStumble: vi.fn(),
    onToggleForm: vi.fn(),
    onToggleShortcuts: vi.fn(),
  };
}

function pressSingleKeyShortcut() {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'q', bubbles: true }),
  );
}

describe('the preference a fresh module seeds itself with', () => {
  it('seeds enabled when the store is empty', async () => {
    window.localStorage.clear();
    const loadedModule = await loadFreshModule();

    const { result } = renderHook(() => loadedModule.useShortcutsEnabled());

    expect(result.current).toBe(true);
  });

  it('seeds its in-memory copy at module load, not on first use', async () => {
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'off');
    const loadedModule = await loadFreshModule();
    window.localStorage.clear();

    const { result } = renderHook(() => loadedModule.useShortcutsEnabled());

    expect(result.current).toBe(false);
  });
});

describe('the shortcut gate against a store that refuses reads', () => {
  // the seed runs at module evaluation, so the refusal has to span the import
  async function mountGateOnAFreshModule(
    options: ReturnType<typeof makeShortcutOptions>,
  ) {
    const loadedModule = await loadFreshModule();

    function Probe() {
      useKeyboardShortcuts({
        ...options,
        singleKeyShortcutsEnabled: loadedModule.useShortcutsEnabled(),
      });
      return null;
    }

    render(createElement(Probe));
    return loadedModule;
  }

  /*
   * The only case anywhere that reaches the seed's refusal arm: flipping
   * that `catch` to `'on'` reddens this and nothing else in the web suite.
   * A `renderHook` would kill the same mutant for a fraction of the setup,
   * but it would assert on a boolean rather than on the keys staying down,
   * which is the harm. Keep the tree.
   */
  it('leaves the single-key shortcuts down when the store threw at module load', async () => {
    const options = makeShortcutOptions();

    await withRefusedStorageAsync(
      'getItem',
      async () => {
        await mountGateOnAFreshModule(options);
        pressSingleKeyShortcut();
      },
      'localStorage',
    );

    expect(options.onSearch).not.toHaveBeenCalled();
  });

  it('still lets the user turn them on for the session', async () => {
    const options = makeShortcutOptions();

    await withRefusedStorageAsync(
      'getItem',
      async () => {
        const loadedModule = await mountGateOnAFreshModule(options);
        act(() => loadedModule.setShortcutsEnabled(true));
        pressSingleKeyShortcut();
      },
      'localStorage',
    );

    expect(options.onSearch).toHaveBeenCalledOnce();
  });
});
