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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
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

/**
 * Edits the page background to a fixed hex via the "Page" knob (which sets
 * `--base-bg`). The knobs sit above the collapsed "show all colors" drawer, so
 * this is the reachable path to the same `--base-bg` edit that goes custom.
 */
function editBaseBackground(value = '#123456') {
  const picker = screen.getByLabelText('Page color');
  fireEvent.change(picker, { target: { value } });
}

/**
 * Fires a native-picker change on one of the multi-token knobs (Accent → the
 * three `*-highlight` tokens; Text → the three `*-text` tokens). The single
 * gesture must flatten EVERY constituent token, so these exercise the path a
 * single-token-only regression would silently break.
 */
function editKnobColor(word: 'Accent' | 'Text', value: string) {
  const picker = screen.getByLabelText(`${word} color`);
  fireEvent.change(picker, { target: { value } });
}

describe('ThemeEditor custom-theme panel', () => {
  it('renders the master-control card heading + copy control, no master switch', () => {
    render(<ThemeEditor />);

    // The card reuses SettingsGroup chrome; its h2 is distinct from the page
    // h1 "Your theme" so the heading is descriptive, not a duplicate (SC 2.4.6).
    expect(
      screen.getByRole('heading', { level: 2, name: /theme starting point/i }),
    ).toBeInTheDocument();
    // The master switch is gone — going custom is an edit, not a toggle.
    expect(screen.queryByRole('switch')).toBeNull();
    expect(
      screen.getByRole('group', { name: /start from a theme/i }),
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

/*
 * Multi-token engage coverage. A knob (Accent, Text) edits THREE tokens in one
 * gesture; the engage seed + the persisted palette must carry all three, not
 * just the representative `--base-*` slot. The code is already correct — these
 * lock it so a regression that wrote only the first token would turn red.
 */
describe('ThemeEditor go-custom-on-first-edit (multi-token knobs)', () => {
  it('seeds ALL THREE accent tokens into the edited (dark) map, not just --base-highlight', async () => {
    render(<ThemeEditor />);
    editKnobColor('Accent', '#123456');

    const seed = (
      mockTheme.setCustomTheme as ReturnType<typeof vi.fn>
    ).mock.calls.at(-1)?.[0];
    expect(seed.dark).toEqual(
      expect.objectContaining({
        '--base-highlight': '#123456',
        '--mount-highlight': '#123456',
        '--orbit-highlight': '#123456',
      }),
    );

    await waitFor(() =>
      expect(updateMe).toHaveBeenCalledWith(
        expect.objectContaining({
          customThemeEnabled: true,
          customTheme: expect.objectContaining({
            dark: expect.objectContaining({
              '--base-highlight': '#123456',
              '--mount-highlight': '#123456',
              '--orbit-highlight': '#123456',
            }),
          }),
        }),
      ),
    );
  });

  it('seeds ALL THREE text tokens into the edited (dark) map, not just --base-text', async () => {
    render(<ThemeEditor />);
    editKnobColor('Text', '#654321');

    const seed = (
      mockTheme.setCustomTheme as ReturnType<typeof vi.fn>
    ).mock.calls.at(-1)?.[0];
    expect(seed.dark).toEqual(
      expect.objectContaining({
        '--base-text': '#654321',
        '--mount-text': '#654321',
        '--orbit-text': '#654321',
      }),
    );
    await waitFor(() => expect(updateMe).toHaveBeenCalled());
  });
});

describe('ThemeEditor re-engage merge (multi-token knobs)', () => {
  it('merges ALL THREE accent tokens into the existing saved palette', async () => {
    // Post-revert state: a saved palette exists but custom is off.
    mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
    render(<ThemeEditor />);
    editKnobColor('Accent', '#123456');

    const expectedSeed = {
      dark: {
        '--mount-bg': '#abc',
        '--base-highlight': '#123456',
        '--mount-highlight': '#123456',
        '--orbit-highlight': '#123456',
      },
      light: {},
    };
    expect(mockTheme.setCustomTheme).toHaveBeenCalledWith(expectedSeed);
    await waitFor(() =>
      expect(updateMe).toHaveBeenCalledWith({
        customThemeEnabled: true,
        customTheme: expectedSeed,
      }),
    );
  });
});

describe('ThemeEditor engage double-fire guard', () => {
  it('fires the engage PATCH once across a picker drag burst', () => {
    // Hold the engage PATCH pending so `engagingReference` stays locked while
    // a second change arrives (simulating a native picker's drag burst).
    (updateMe as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );
    render(<ThemeEditor />);

    const picker = screen.getByLabelText('Accent color');
    fireEvent.change(picker, { target: { value: '#111111' } });
    fireEvent.change(picker, { target: { value: '#222222' } });

    // The lock collapses the two into a single engage.
    expect(updateMe).toHaveBeenCalledTimes(1);
    expect(mockTheme.setCustomThemeEnabled).toHaveBeenCalledTimes(1);
    expect(mockTheme.setCustomThemeEnabled).toHaveBeenCalledWith(true);
  });
});

describe('ThemeEditor knob edit while already custom', () => {
  it('takes the scheduled-save path, never re-engaging, and persists the flatten', async () => {
    vi.useFakeTimers();
    try {
      mockTheme.customThemeEnabled = true;
      mockTheme.customTheme = { dark: { '--base-bg': '#abc' }, light: {} };
      render(<ThemeEditor />);

      editKnobColor('Accent', '#123456');

      // No engage: the enable flag is never re-flipped, and no synchronous
      // engage PATCH fires (the auto-save is debounced, not yet sent).
      expect(mockTheme.setCustomThemeEnabled).not.toHaveBeenCalled();
      expect(updateMe).not.toHaveBeenCalled();

      // The debounced auto-save flushes the REAL flatten: every accent token
      // (via the actual `setOverride` loop) lands in the persisted palette.
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(updateMe).toHaveBeenCalledWith({
        customTheme: expect.objectContaining({
          dark: expect.objectContaining({
            '--base-highlight': '#123456',
            '--mount-highlight': '#123456',
            '--orbit-highlight': '#123456',
          }),
        }),
      });
      // Still no engage PATCH ({ customThemeEnabled: true, ... }) anywhere.
      expect(mockTheme.setCustomThemeEnabled).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
