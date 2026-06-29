/*
 * Tests for the ThemeEditor orchestrator's go-custom-on-edit wiring.
 *
 * Focus: there is no master switch — the FIRST color edit seeds the palette
 * from the post-edit values, enables custom, and persists; an already-saved
 * palette merges the edit instead of re-seeding; a failed engage rolls back
 * EVERY local mutation; and every settled save / engage / copy announces
 * through the editor's single polite live region. The context, api, and theme
 * probe are mocked; the rest of the editor renders real.
 */

import ThemeEditor from './index';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
    // h1 "Theme editor" so the heading is descriptive, not a duplicate (SC 2.4.6).
    expect(
      screen.getByRole('heading', { level: 2, name: /craft your theme/i }),
    ).toBeInTheDocument();
    // The master switch is gone — going custom is an edit, not a toggle.
    expect(screen.queryByRole('switch')).toBeNull();
    expect(
      screen.getByRole('group', { name: /copy a palette/i }),
    ).toBeInTheDocument();
    // The off-ramp is gone — there is no path back to the prior theme by design.
    expect(
      screen.queryByRole('button', { name: /back to boyhood/i }),
    ).toBeNull();
  });
});

describe('ThemeEditor polite live region', () => {
  it('mounts an unconditional sr-only role=status region (survives custom off)', () => {
    render(<ThemeEditor />);
    // Custom is off in the default mock — the region must still be mounted so a
    // later revert/announce has somewhere to speak (a11y brief §1).
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('announces the engage utterance through the role=status region', async () => {
    render(<ThemeEditor />);
    editBaseBackground('#123456');

    const status = await screen.findByRole('status');
    await waitFor(() =>
      expect(status).toHaveTextContent('Your theme is on and saved.'),
    );
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

/**
 * Picks a theme from the "Start from a theme" copy menu. With the trigger
 * always operable now, this is the copy-to-go-custom path.
 */
function copyTheme(name: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: /start from a theme/i }));
  const menu = screen.getByRole('menu', { name: /start from a theme/i });
  fireEvent.click(within(menu).getByRole('menuitem', { name }));
}

/*
 * Copying a theme is a SECOND way to go custom, equal to editing a color: while
 * custom is off, picking a theme seeds the palette from that theme for BOTH
 * modes, enables, persists in one PATCH, and announces. No Undo is offered when
 * nothing was overwritten (a never-configured user) — the off-ramp covers
 * turning back off — but a returning user's saved palette IS snapshotted for
 * Undo before the copy clobbers it (a11y FLAG 1).
 */
describe('ThemeEditor go-custom-by-copying-a-theme', () => {
  const apolloSeed = {
    dark: { '--mount-bg': 'apollo-10-1-2-dark' },
    light: { '--mount-bg': 'apollo-10-1-2-light' },
  };

  it('seeds both modes from the picked theme, enables, persists, announces', async () => {
    render(<ThemeEditor />);
    copyTheme(/apollo 10½/i);

    expect(mockTheme.setCustomThemeEnabled).toHaveBeenCalledWith(true);
    expect(mockTheme.setCustomTheme).toHaveBeenCalledWith(apolloSeed);
    expect(mockTheme.setBaseTheme).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(updateMe).toHaveBeenCalledWith({
        customThemeEnabled: true,
        customTheme: apolloSeed,
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByText(
          'Your theme is on. Apollo 10½ palette applied and saved.',
        ),
      ).toBeInTheDocument(),
    );
  });

  it('offers no Undo when no saved palette was overwritten', async () => {
    render(<ThemeEditor />);
    copyTheme(/apollo 10½/i);

    await waitFor(() => expect(updateMe).toHaveBeenCalled());
    expect(
      screen.queryByRole('button', { name: /undo copy from/i }),
    ).toBeNull();
  });

  it('fires the engage PATCH exactly once (one announce, no double-bump)', async () => {
    render(<ThemeEditor />);
    copyTheme(/apollo 10½/i);

    await waitFor(() => expect(updateMe).toHaveBeenCalled());
    expect(updateMe).toHaveBeenCalledTimes(1);
  });

  it('rolls back the enable + seed when the engage PATCH fails', async () => {
    (updateMe as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('network'),
    );
    render(<ThemeEditor />);
    copyTheme(/apollo 10½/i);

    await waitFor(() =>
      expect(mockTheme.setCustomThemeEnabled).toHaveBeenLastCalledWith(false),
    );
    expect(mockTheme.setCustomTheme).toHaveBeenLastCalledWith({
      dark: {},
      light: {},
    });
    expect(
      await screen.findByText(/could not update the custom theme setting/i),
    ).toBeInTheDocument();
  });

  it('snapshots a returning user’s palette for Undo, then restores it + turns off', async () => {
    // Off, but a palette already exists (the user reverted earlier).
    mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
    render(<ThemeEditor />);
    copyTheme(/apollo 10½/i);

    // The copy overwrote the saved palette, so an Undo appears to get it back.
    const undo = await screen.findByRole('button', {
      name: /undo copy from apollo 10½/i,
    });

    fireEvent.click(undo);

    // Undo restores the prior palette and turns custom back OFF (its prior state).
    expect(mockTheme.setCustomThemeEnabled).toHaveBeenLastCalledWith(false);
    expect(mockTheme.setCustomTheme).toHaveBeenLastCalledWith({
      dark: { '--mount-bg': '#abc' },
      light: {},
    });
    await waitFor(() =>
      expect(updateMe).toHaveBeenLastCalledWith({
        customThemeEnabled: false,
        customTheme: { dark: { '--mount-bg': '#abc' }, light: {} },
      }),
    );
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
