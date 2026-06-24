/*
 * Tests for the ThemeEditor orchestrator's master-enable toggle wiring.
 *
 * Focus: handleToggleCustomTheme — the OFF→ON seed-from-current-theme flow, the
 * no-reseed guard when a palette already exists, the OFF path, and the
 * error-revert that must undo EVERY local mutation so a failed enable can't
 * leave an orphaned `custom` selection behind. The context, api, and theme
 * probe are mocked; the rest of the editor renders real.
 */

import ThemeEditor from './index';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateMe } from '../../../lib/api';
import { readThemeTokens } from './themeProbe';

vi.mock('../../../lib/api', () => ({ updateMe: vi.fn() }));
vi.mock('./themeProbe', () => ({
  readThemeTokens: vi.fn((theme: string, mode: string) => ({
    '--mount-bg': `${theme}-${mode}`,
  })),
}));

const mockTheme = makeMockTheme();

vi.mock('../../../theme/ThemeContext', async (importActual) => {
  const actual =
    await importActual<typeof import('../../../theme/ThemeContext')>();
  return { ...actual, useTheme: () => mockTheme };
});

function makeMockTheme() {
  return {
    baseTheme: 'boyhood',
    customTheme: null as { dark: object; light: object } | null,
    customThemeEnabled: false,
    mode: 'dark',
    setBaseTheme: vi.fn(),
    setCustomTheme: vi.fn(),
    setCustomThemeEnabled: vi.fn(),
    setMode: vi.fn(),
    setPreviewTheme: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mockTheme, makeMockTheme());
  (updateMe as ReturnType<typeof vi.fn>).mockResolvedValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function getSwitch() {
  return screen.getByRole('switch', { name: /use your own custom theme/i });
}

describe('ThemeEditor master-enable toggle', () => {
  it('seeds the custom palette from the current theme (both modes) on enable', async () => {
    render(<ThemeEditor />);
    fireEvent.click(getSwitch());

    expect(mockTheme.setCustomThemeEnabled).toHaveBeenCalledWith(true);
    expect(readThemeTokens).toHaveBeenCalledWith('boyhood', 'dark');
    expect(readThemeTokens).toHaveBeenCalledWith('boyhood', 'light');
    expect(mockTheme.setCustomTheme).toHaveBeenCalledWith({
      dark: { '--mount-bg': 'boyhood-dark' },
      light: { '--mount-bg': 'boyhood-light' },
    });
    expect(mockTheme.setBaseTheme).toHaveBeenCalledWith('custom');

    await waitFor(() =>
      expect(updateMe).toHaveBeenCalledWith({
        customThemeEnabled: true,
        customTheme: {
          dark: { '--mount-bg': 'boyhood-dark' },
          light: { '--mount-bg': 'boyhood-light' },
        },
      }),
    );
  });

  it('does not re-seed when a custom palette already exists', async () => {
    mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
    render(<ThemeEditor />);
    fireEvent.click(getSwitch());

    expect(mockTheme.setCustomTheme).not.toHaveBeenCalled();
    expect(mockTheme.setBaseTheme).toHaveBeenCalledWith('custom');
    await waitFor(() =>
      expect(updateMe).toHaveBeenCalledWith({ customThemeEnabled: true }),
    );
  });

  it('disabling does not seed or touch the base theme', async () => {
    // Already enabled + on custom, so the mount effect is a no-op and any
    // setBaseTheme call would come from the toggle itself.
    mockTheme.customThemeEnabled = true;
    mockTheme.baseTheme = 'custom';
    mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
    render(<ThemeEditor />);
    fireEvent.click(getSwitch());

    expect(mockTheme.setCustomThemeEnabled).toHaveBeenCalledWith(false);
    expect(mockTheme.setCustomTheme).not.toHaveBeenCalled();
    expect(mockTheme.setBaseTheme).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(updateMe).toHaveBeenCalledWith({ customThemeEnabled: false }),
    );
  });

  it('reverts every mutation when the enable PATCH fails', async () => {
    (updateMe as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('network'),
    );
    render(<ThemeEditor />);
    fireEvent.click(getSwitch());

    await waitFor(() =>
      expect(mockTheme.setCustomThemeEnabled).toHaveBeenCalledWith(false),
    );
    // Base theme switched to custom then reverted to the prior real theme.
    expect(mockTheme.setBaseTheme).toHaveBeenCalledWith('custom');
    expect(mockTheme.setBaseTheme).toHaveBeenLastCalledWith('boyhood');
    // Seeded palette rolled back to an empty (unconfigured) map.
    expect(mockTheme.setCustomTheme).toHaveBeenLastCalledWith({
      dark: {},
      light: {},
    });
    expect(
      await screen.findByText(/could not update the custom theme setting/i),
    ).toBeInTheDocument();
  });
});
