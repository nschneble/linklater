/*
 * Tests for the ThemeEditor orchestrator's go-custom-on-edit wiring.
 *
 * Focus: there is no master switch — the FIRST color edit seeds the palette
 * from the post-edit values, enables custom, and persists; an already-saved
 * palette merges the edit instead of re-seeding; the "Back to {theme}" off-ramp
 * reverts (moving focus first) and announces; and a failed engage rolls back
 * EVERY local mutation. The context, api, and theme probe are mocked; the rest
 * of the editor renders real.
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
    customTheme: null as {
      dark: Record<string, string>;
      light: Record<string, string>;
    } | null,
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

/** Edits the Base background swatch (Base is open by default) to a fixed hex. */
function editBaseBackground(value = '#123456') {
  const picker = screen.getByLabelText(/color picker for base background/i);
  fireEvent.change(picker, { target: { value } });
}

describe('ThemeEditor custom-theme panel', () => {
  it('renders the master-control card heading + copy control, no master switch', () => {
    render(<ThemeEditor />);

    // The card reuses SettingsGroup chrome; both the page h1 and the card h2
    // read "Your theme", so scope the card heading to level 2.
    expect(
      screen.getByRole('heading', { level: 2, name: /your theme/i }),
    ).toBeInTheDocument();
    // The master switch is gone — going custom is an edit, not a toggle.
    expect(screen.queryByRole('switch')).toBeNull();
    expect(
      screen.getByRole('group', { name: /copy palette from theme/i }),
    ).toBeInTheDocument();
    // The off-ramp only shows once custom is active.
    expect(
      screen.queryByRole('button', { name: /back to boyhood/i }),
    ).toBeNull();
  });
});

describe('ThemeEditor go-custom-on-first-edit', () => {
  it('seeds from the post-edit palette, enables, persists, and announces', async () => {
    render(<ThemeEditor />);
    editBaseBackground('#123456');

    expect(mockTheme.setCustomThemeEnabled).toHaveBeenCalledWith(true);
    // Other mode (light) is probed; the edited mode (dark) is the post-edit map.
    expect(readThemeTokens).toHaveBeenCalledWith('boyhood', 'light');
    const expectedSeed = {
      dark: { '--mount-bg': 'boyhood-dark', '--base-bg': '#123456' },
      light: { '--mount-bg': 'boyhood-light' },
    };
    expect(mockTheme.setCustomTheme).toHaveBeenCalledWith(expectedSeed);
    // The editor NEVER changes the global theme.
    expect(mockTheme.setBaseTheme).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(updateMe).toHaveBeenCalledWith({
        customThemeEnabled: true,
        customTheme: expectedSeed,
      }),
    );

    // The single merged engage utterance lands in the polite region.
    await waitFor(() =>
      expect(
        screen.getByText('Your theme is on and saved.'),
      ).toBeInTheDocument(),
    );
  });

  it('merges the edit into an existing saved palette instead of re-seeding', async () => {
    mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
    render(<ThemeEditor />);
    editBaseBackground('#123456');

    const expectedSeed = {
      dark: { '--mount-bg': '#abc', '--base-bg': '#123456' },
      light: {},
    };
    expect(mockTheme.setCustomTheme).toHaveBeenCalledWith(expectedSeed);
    expect(mockTheme.setBaseTheme).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(updateMe).toHaveBeenCalledWith({
        customThemeEnabled: true,
        customTheme: expectedSeed,
      }),
    );
  });

  it('rolls back the enabled flag + seeded palette when the engage PATCH fails', async () => {
    (updateMe as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('network'),
    );
    render(<ThemeEditor />);
    editBaseBackground('#123456');

    await waitFor(() =>
      expect(mockTheme.setCustomThemeEnabled).toHaveBeenLastCalledWith(false),
    );
    expect(mockTheme.setBaseTheme).not.toHaveBeenCalled();
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

describe('ThemeEditor revert off-ramp', () => {
  it('shows "Back to {theme}", reverts on click, moves focus, and announces', async () => {
    mockTheme.customThemeEnabled = true;
    mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
    render(<ThemeEditor />);

    const offRamp = screen.getByRole('button', { name: /back to boyhood/i });
    fireEvent.click(offRamp);

    // Focus moved to the page heading BEFORE the button unmounts (SC 2.4.3).
    expect(
      screen.getByRole('heading', { level: 1, name: /your theme/i }),
    ).toHaveFocus();

    expect(mockTheme.setCustomThemeEnabled).toHaveBeenCalledWith(false);
    expect(mockTheme.setCustomTheme).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(updateMe).toHaveBeenCalledWith({ customThemeEnabled: false }),
    );
    await waitFor(() =>
      expect(screen.getByText('Your theme is off.')).toBeInTheDocument(),
    );
  });

  it('re-enables custom + warns when the revert PATCH fails', async () => {
    (updateMe as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('network'),
    );
    mockTheme.customThemeEnabled = true;
    mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
    render(<ThemeEditor />);

    fireEvent.click(screen.getByRole('button', { name: /back to boyhood/i }));

    await waitFor(() =>
      expect(mockTheme.setCustomThemeEnabled).toHaveBeenLastCalledWith(true),
    );
    expect(
      await screen.findByText(/could not update the custom theme setting/i),
    ).toBeInTheDocument();
  });
});
