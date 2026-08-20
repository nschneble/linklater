/**
 * Integration reproduction for the blank page a refusing store gives a
 * logged-in user.
 *
 * The direct `useThemeState` tests call the `applyServer*` syncs out of an
 * `act()` callback, which pins that they do not throw. They cannot pin
 * that the tree survives: React tears a tree down when an effect throws,
 * not when an `act()` callback does, and `App.tsx` calls all four syncs
 * from a `useEffect`. This drives that shape — a child running the syncs
 * in a mount effect under `ThemeProvider` — and asserts the child is
 * still on the page.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { CUSTOM_THEME_STORAGE_KEY } from '../storage';
import { render } from '@testing-library/react';
import { ThemeProvider, useTheme } from './index';
import { useEffect } from 'react';
import { withRefusedStorage } from '../../../test/refusedStorage';
import type { CustomTheme } from '../customTheme';

/** Mirrors the server-sync effect `App.tsx` runs once a user hydrates. */
function ServerSync({ customTheme }: { customTheme: CustomTheme | null }) {
  const {
    applyServerCustomTheme,
    applyServerCustomThemeEnabled,
    applyServerTheme,
  } = useTheme();

  useEffect(() => {
    applyServerTheme('boyhood');
    applyServerCustomTheme(customTheme);
    applyServerCustomThemeEnabled(true);
  }, [
    applyServerCustomTheme,
    applyServerCustomThemeEnabled,
    applyServerTheme,
    customTheme,
  ]);

  return <p data-testid="synced">synced</p>;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('server sync against a refusing store', () => {
  it('keeps the tree mounted when the store refuses to be written', () => {
    withRefusedStorage(
      'setItem',
      () => {
        const { getByTestId } = render(
          <ThemeProvider>
            <ServerSync customTheme={{ dark: {}, light: {} }} />
          </ThemeProvider>,
        );
        expect(getByTestId('synced')).toBeInTheDocument();
      },
      'localStorage',
    );
  });

  it('keeps the tree mounted when the store refuses a removal', () => {
    window.localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, '{"dark":{}}');

    withRefusedStorage(
      'removeItem',
      () => {
        const { getByTestId } = render(
          <ThemeProvider>
            <ServerSync customTheme={null} />
          </ThemeProvider>,
        );
        expect(getByTestId('synced')).toBeInTheDocument();
      },
      'localStorage',
    );
  });
});
