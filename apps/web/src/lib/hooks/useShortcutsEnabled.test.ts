import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';

import {
  KEYBOARD_SHORTCUTS_KEY,
  setShortcutsEnabled,
  useShortcutsEnabled,
} from './useShortcutsEnabled';
import { resetShortcutsPreference } from '../../../test/shortcutsPreference';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import {
  withRefusedStorage,
  withRefusedStorageAsync,
} from '../../../test/refusedStorage';

beforeEach(resetShortcutsPreference);

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

describe('resetShortcutsPreference', () => {
  it('empties the store rather than leaving the default it just wrote', () => {
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'off');

    resetShortcutsPreference();

    expect(window.localStorage.getItem(KEYBOARD_SHORTCUTS_KEY)).toBeNull();
  });

  it('drops a refusal record while the store is still refusing writes', () => {
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'off');

    withRefusedStorage(
      'setItem',
      () => {
        setShortcutsEnabled(true);
        resetShortcutsPreference();
      },
      'localStorage',
    );

    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'off');
    const { result } = renderHook(() => useShortcutsEnabled());
    expect(result.current).toBe(false);
  });

  it('resets what it still can when the store refuses to clear', () => {
    setShortcutsEnabled(false);

    withRefusedStorage('clear', resetShortcutsPreference, 'localStorage');

    // the refused clear left 'off' stored; only the in-memory half is at issue
    window.localStorage.removeItem(KEYBOARD_SHORTCUTS_KEY);
    const { result } = renderHook(() => useShortcutsEnabled());
    expect(result.current).toBe(true);
  });
});

describe('useShortcutsEnabled', () => {
  let freshModule: typeof import('./useShortcutsEnabled') | null = null;

  afterEach(() => {
    freshModule?.stopCrossTabShortcutsSync();
    freshModule = null;
  });

  it('defaults to enabled when nothing is stored', () => {
    const { result } = renderHook(() => useShortcutsEnabled());
    expect(result.current).toBe(true);
  });

  it('reads a stored "off" preference on the first committed render, before any effect', () => {
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'off');

    // tripwire: an effect-based read renders true first, then re-renders
    const committedRenders: boolean[] = [];
    function Probe() {
      committedRenders.push(useShortcutsEnabled());
      return null;
    }

    render(createElement(Probe));

    expect(committedRenders[0]).toBe(false);
    expect(committedRenders).toHaveLength(1);
  });

  it('reflects a stored "on" preference', () => {
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'on');
    const { result } = renderHook(() => useShortcutsEnabled());
    expect(result.current).toBe(true);
  });

  it.each(['OFF', 'false', '0', '', 'o'])(
    'reads the unrecognised stored value %j as disabled',
    (stored) => {
      window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, stored);
      const { result } = renderHook(() => useShortcutsEnabled());
      expect(result.current).toBe(false);
    },
  );

  it('re-renders subscribers when the preference is turned off', () => {
    const { result } = renderHook(() => useShortcutsEnabled());
    expect(result.current).toBe(true);

    act(() => setShortcutsEnabled(false));
    expect(result.current).toBe(false);

    act(() => setShortcutsEnabled(true));
    expect(result.current).toBe(true);
  });

  it('persists the preference to localStorage', () => {
    act(() => setShortcutsEnabled(false));
    expect(window.localStorage.getItem(KEYBOARD_SHORTCUTS_KEY)).toBe('off');

    act(() => setShortcutsEnabled(true));
    expect(window.localStorage.getItem(KEYBOARD_SHORTCUTS_KEY)).toBe('on');
  });

  it('seeds enabled at module load when the store is empty', async () => {
    window.localStorage.clear();
    vi.resetModules();
    const loadedModule = await import('./useShortcutsEnabled');
    freshModule = loadedModule;

    const { result } = renderHook(() => loadedModule.useShortcutsEnabled());

    expect(result.current).toBe(true);
  });

  it('seeds its in-memory copy at module load, not on first use', async () => {
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'off');
    vi.resetModules();
    const loadedModule = await import('./useShortcutsEnabled');
    freshModule = loadedModule;
    window.localStorage.clear();

    const { result } = renderHook(() => loadedModule.useShortcutsEnabled());

    expect(result.current).toBe(false);
  });
});

describe('useShortcutsEnabled against a store that refuses writes', () => {
  it('holds the disable a refused write could not persist', () => {
    const { result } = renderHook(() => useShortcutsEnabled());

    withRefusedStorage(
      'setItem',
      () => act(() => setShortcutsEnabled(false)),
      'localStorage',
    );

    expect(result.current).toBe(false);
  });

  it('holds the disable when the refused write left an older "on" stored', () => {
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'on');
    const { result } = renderHook(() => useShortcutsEnabled());

    withRefusedStorage(
      'setItem',
      () => act(() => setShortcutsEnabled(false)),
      'localStorage',
    );

    expect(result.current).toBe(false);
  });

  it('reads a refused disable on the first committed render, before any effect', () => {
    withRefusedStorage(
      'setItem',
      () => setShortcutsEnabled(false),
      'localStorage',
    );

    const committedRenders: boolean[] = [];
    function Probe() {
      committedRenders.push(useShortcutsEnabled());
      return null;
    }

    render(createElement(Probe));

    expect(committedRenders[0]).toBe(false);
    expect(committedRenders).toHaveLength(1);
  });

  it("adopts another tab's value over the refusal it is holding", () => {
    const { result } = renderHook(() => useShortcutsEnabled());
    withRefusedStorage(
      'setItem',
      () => act(() => setShortcutsEnabled(false)),
      'localStorage',
    );
    expect(result.current).toBe(false);

    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'on');
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: KEYBOARD_SHORTCUTS_KEY,
          newValue: 'on',
        }),
      );
    });

    expect(result.current).toBe(true);

    window.localStorage.removeItem(KEYBOARD_SHORTCUTS_KEY);
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: KEYBOARD_SHORTCUTS_KEY }),
      );
    });

    expect(result.current).toBe(true);
  });
});

describe('the shortcut gate against a store that refuses reads', () => {
  let freshModule: typeof import('./useShortcutsEnabled') | null = null;

  afterEach(() => {
    freshModule?.stopCrossTabShortcutsSync();
    freshModule = null;
  });

  // the seed runs at module evaluation, so the refusal has to span the import
  async function mountGateOnAFreshModule(
    options: ReturnType<typeof makeShortcutOptions>,
  ) {
    vi.resetModules();
    const loadedModule = await import('./useShortcutsEnabled');
    freshModule = loadedModule;

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

describe('the shortcut gate against a sibling tab and a refused write', () => {
  function renderShortcutGate(options: ReturnType<typeof makeShortcutOptions>) {
    function Probe() {
      useKeyboardShortcuts({
        ...options,
        singleKeyShortcutsEnabled: useShortcutsEnabled(),
      });
      return null;
    }

    render(createElement(Probe));
  }

  function siblingWrites(value: string) {
    const stored = window.localStorage.getItem(KEYBOARD_SHORTCUTS_KEY);
    // setItem returns early on an unchanged value, firing no event
    expect(stored).not.toBe(value);
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, value);
    return { oldValue: stored, newValue: value };
  }

  function deliverStorageEvent(values: {
    oldValue: string | null;
    newValue: string;
  }) {
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: KEYBOARD_SHORTCUTS_KEY,
          ...values,
        }),
      );
    });
  }

  function pressSingleKeyShortcut() {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'q', bubbles: true }),
    );
  }

  it('takes a sibling disable that its own refusal snapshotted before the event landed', () => {
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'on');
    const options = makeShortcutOptions();
    renderShortcutGate(options);
    pressSingleKeyShortcut();
    expect(options.onSearch).toHaveBeenCalledOnce();

    withRefusedStorage(
      'setItem',
      () => act(() => setShortcutsEnabled(false)),
      'localStorage',
    );
    const siblingDisable = siblingWrites('off');
    withRefusedStorage(
      'setItem',
      () => act(() => setShortcutsEnabled(true)),
      'localStorage',
    );

    deliverStorageEvent(siblingDisable);

    options.onSearch.mockClear();
    pressSingleKeyShortcut();
    expect(options.onSearch).not.toHaveBeenCalled();
  });

  it('holds a refused local disable through a sibling that cycles back to "on"', () => {
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'on');
    const options = makeShortcutOptions();
    renderShortcutGate(options);
    pressSingleKeyShortcut();
    expect(options.onSearch).toHaveBeenCalledOnce();

    withRefusedStorage(
      'setItem',
      () => act(() => setShortcutsEnabled(false)),
      'localStorage',
    );

    deliverStorageEvent(siblingWrites('off'));
    deliverStorageEvent(siblingWrites('on'));

    options.onSearch.mockClear();
    pressSingleKeyShortcut();
    expect(options.onSearch).not.toHaveBeenCalled();
  });

  it("takes a sibling's unrecognised value as the disable every other read makes of it", () => {
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'OFF');
    const options = makeShortcutOptions();
    renderShortcutGate(options);

    withRefusedStorage(
      'setItem',
      () => act(() => setShortcutsEnabled(true)),
      'localStorage',
    );
    pressSingleKeyShortcut();
    expect(options.onSearch).toHaveBeenCalledOnce();

    deliverStorageEvent(siblingWrites('on'));
    deliverStorageEvent(siblingWrites('OFF'));

    options.onSearch.mockClear();
    pressSingleKeyShortcut();
    expect(options.onSearch).not.toHaveBeenCalled();
  });
});
