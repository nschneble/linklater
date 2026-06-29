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
 * Edits the page background to a fixed hex via the base bundle panel's
 * "Background" slot row (which sets `--base-bg`). `base` is the default active
 * bundle, so its Background picker is the reachable path to the `--base-bg`
 * edit that goes custom.
 */
function editBaseBackground(value = '#123456') {
  const picker = screen.getByLabelText('Color picker for Background');
  fireEvent.change(picker, { target: { value } });
}

describe('ThemeEditor copy control + heading outline', () => {
  it('renders the single copy button + h2 "Colors", no master switch', () => {
    render(<ThemeEditor />);

    // The SettingsGroup card wrapper is dropped (PRD point 8); the picker is now
    // a bare strip. The editing surface's region title is the "Color Bundles" h2,
    // distinct from the page h1 "Theme editor" (SC 2.4.6) — no "Craft your theme"
    // card h2.
    expect(
      screen.getByRole('heading', { level: 1, name: /theme editor/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /craft your theme/i }),
    ).toBeNull();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Color Bundles' }),
    ).toBeInTheDocument();
    // The master switch is gone — going custom is an edit, not a toggle.
    expect(screen.queryByRole('switch')).toBeNull();
    // The 10-theme copy MENU is replaced by ONE button that names its source
    // theme (R-E2). The old menu trigger is gone.
    expect(
      screen.getByRole('button', { name: /copy boyhood colors/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /start from a theme/i }),
    ).toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
    // The off-ramp is gone — there is no path back to the prior theme by design.
    expect(
      screen.queryByRole('button', { name: /back to boyhood/i }),
    ).toBeNull();
  });
});

/*
 * The Light/Dark palette toggle moved OUT of the Colors card and INTO the header
 * toolbar (Wave 1). It leads the toolbar (left), ahead of Randomize + the copy
 * control, mirroring the "Your links" toolbar. It keeps its role=group +
 * aria-pressed binary-toggle shape and stays a sibling ABOVE the preview scope,
 * so its fixed-escape-hatch colors survive a hostile custom palette.
 */
describe('ThemeEditor mode toggle in the header toolbar', () => {
  it('renders the Light/Dark palette toggle, seeded to the site mode (dark)', () => {
    render(<ThemeEditor />);
    const group = screen.getByRole('group', { name: /palette to edit/i });
    expect(
      within(group).getByRole('button', { name: /dark colors/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(group).getByRole('button', { name: /light colors/i }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('flips the pressed palette when the other mode is chosen', () => {
    render(<ThemeEditor />);
    const group = screen.getByRole('group', { name: /palette to edit/i });
    fireEvent.click(
      within(group).getByRole('button', { name: /light colors/i }),
    );
    expect(
      within(group).getByRole('button', { name: /light colors/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(group).getByRole('button', { name: /dark colors/i }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('is no longer rendered inside the Colors region', () => {
    render(<ThemeEditor />);
    const colors = screen.getByRole('region', { name: 'Color Bundles' });
    expect(
      within(colors).queryByRole('group', { name: /palette to edit/i }),
    ).toBeNull();
  });

  it('leads the toolbar: mode toggle precedes Randomize, then the copy button', () => {
    render(<ThemeEditor />);
    const modeGroup = screen.getByRole('group', { name: /palette to edit/i });
    const randomize = screen.getByRole('button', { name: 'Randomize' });
    const copyButton = screen.getByRole('button', {
      name: /copy boyhood colors/i,
    });

    expect(
      modeGroup.compareDocumentPosition(randomize) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      randomize.compareDocumentPosition(copyButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('keeps the mode toggle OUTSIDE any preview-scoped ancestor', () => {
    render(<ThemeEditor />);
    let node: HTMLElement | null = screen.getByRole('group', {
      name: /palette to edit/i,
    });
    // No ancestor carries an inline custom-property style, so a hostile prior
    // palette can never strand this recovery control (a11y brief §3/§5).
    while (node) {
      expect(node.getAttribute('style') ?? '').not.toContain('--');
      node = node.parentElement;
    }
  });
});

describe('ThemeEditor live preview reflects the selected bundle (PRD point 4)', () => {
  it('opens on base (toolbar) and swaps the mock + explanation when a bundle is picked', () => {
    render(<ThemeEditor />);

    // Default active bundle is base — the toolbar mock + its explanation show.
    const mock = screen.getByTestId('app-mock');
    expect(within(mock).getByText('Add link')).toBeInTheDocument();
    expect(screen.getByText(/used for the page itself/i)).toBeInTheDocument();

    // Picking the mount bundle swaps the preview to the link card. The inner
    // mock REMOUNTS on a bundle change (its enter animation replays — PRD point
    // 10), so re-query the live node rather than the now-detached original.
    fireEvent.click(screen.getByRole('tab', { name: 'Mount' }));
    expect(
      screen.getByText(/used for your saved-link cards/i),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('app-mock')).queryByText('Add link'),
    ).toBeNull();
  });

  it('keeps a single sr-only "Live preview" h2 and an h1 → "Color Bundles" → "Colors" → "Live preview" outline', () => {
    render(<ThemeEditor />);
    const headings = screen
      .getAllByRole('heading')
      .map((heading) => `${heading.tagName}:${heading.textContent}`);
    expect(headings).toEqual([
      'H1:Theme editor',
      'H2:Color Bundles',
      'H3:Colors',
      'H2:Live preview',
    ]);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Live preview' }),
    ).toHaveClass('sr-only');
  });

  it('paints the custom palette on the aria-hidden mock ONLY, not the Colors card', () => {
    render(<ThemeEditor />);
    const mock = screen.getByTestId('app-mock');
    // The decorative mock carries the inline custom-property scope.
    expect(mock.getAttribute('style')).toBeTruthy();
    // The left Color Bundles region (and its tablist) is NOT inside the styled
    // mock.
    const colors = screen.getByRole('region', { name: 'Color Bundles' });
    expect(mock.contains(colors)).toBe(false);
  });

  it('keeps the copy button OUTSIDE any preview-scoped ancestor', () => {
    render(<ThemeEditor />);
    const copyButton = screen.getByRole('button', {
      name: /copy boyhood colors/i,
    });
    const mock = screen.getByTestId('app-mock');
    // No ancestor of the copy button carries an inline custom-property style.
    let node: HTMLElement | null = copyButton;
    while (node) {
      const style = node.getAttribute('style') ?? '';
      expect(style).not.toContain('--');
      node = node.parentElement;
    }
    // And it is not nested inside the styled mock.
    expect(mock.contains(copyButton)).toBe(false);
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

describe('ThemeEditor re-engage merge (single slot)', () => {
  it('merges the edited slot into the existing saved palette, not re-seeding', async () => {
    // Post-revert state: a saved palette exists but custom is off.
    mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
    render(<ThemeEditor />);
    editBaseBackground('#123456');

    const expectedSeed = {
      dark: { '--mount-bg': '#abc', '--base-bg': '#123456' },
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

    const picker = screen.getByLabelText('Color picker for Background');
    fireEvent.change(picker, { target: { value: '#111111' } });
    fireEvent.change(picker, { target: { value: '#222222' } });

    // The lock collapses the two into a single engage.
    expect(updateMe).toHaveBeenCalledTimes(1);
    expect(mockTheme.setCustomThemeEnabled).toHaveBeenCalledTimes(1);
    expect(mockTheme.setCustomThemeEnabled).toHaveBeenCalledWith(true);
  });
});

/**
 * Clicks the single toolbar copy action, which copies the CURRENTLY ACTIVE film
 * theme (boyhood in the mock) into the custom palette. The button only renders
 * while custom is off, so this is the copy-to-go-custom path.
 */
function copyActiveTheme() {
  fireEvent.click(screen.getByRole('button', { name: /copy boyhood colors/i }));
}

/*
 * Copying a theme is a SECOND way to go custom, equal to editing a color: while
 * custom is off, picking a theme seeds the palette from that theme for BOTH
 * modes, enables, persists in one PATCH, and announces. No Undo is offered when
 * nothing was overwritten (a never-configured user has no prior palette to
 * restore) — but a returning user's saved palette IS snapshotted for Undo
 * before the copy clobbers it (a11y FLAG 1).
 */
describe('ThemeEditor go-custom-by-copying-a-theme', () => {
  // The single copy button copies the CURRENTLY ACTIVE film theme (boyhood).
  const boyhoodSeed = {
    dark: { '--mount-bg': 'boyhood-dark' },
    light: { '--mount-bg': 'boyhood-light' },
  };

  it('seeds both modes from the active theme, enables, persists, announces', async () => {
    render(<ThemeEditor />);
    copyActiveTheme();

    expect(mockTheme.setCustomThemeEnabled).toHaveBeenCalledWith(true);
    expect(mockTheme.setCustomTheme).toHaveBeenCalledWith(boyhoodSeed);
    expect(mockTheme.setBaseTheme).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(updateMe).toHaveBeenCalledWith({
        customThemeEnabled: true,
        customTheme: boyhoodSeed,
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByText(
          'Your theme is on. Boyhood palette applied and saved.',
        ),
      ).toBeInTheDocument(),
    );
  });

  it('offers no Undo when no saved palette was overwritten', async () => {
    render(<ThemeEditor />);
    copyActiveTheme();

    await waitFor(() => expect(updateMe).toHaveBeenCalled());
    expect(
      screen.queryByRole('button', { name: /undo copy from/i }),
    ).toBeNull();
  });

  it('fires the engage PATCH exactly once (one announce, no double-bump)', async () => {
    render(<ThemeEditor />);
    copyActiveTheme();

    await waitFor(() => expect(updateMe).toHaveBeenCalled());
    expect(updateMe).toHaveBeenCalledTimes(1);
  });

  it('rolls back the enable + seed when the engage PATCH fails', async () => {
    (updateMe as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('network'),
    );
    render(<ThemeEditor />);
    copyActiveTheme();

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
    copyActiveTheme();

    // The copy overwrote the saved palette, so an Undo appears to get it back.
    const undo = await screen.findByRole('button', {
      name: /undo copy from boyhood/i,
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

    // The undo announcement reaches the editor's own polite live region —
    // end-to-end through index's role=status, not just the PATCH (W-2).
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Reverted to previous colors.',
      ),
    );
  });
});

/** Clicks the global "Randomize" action in the Colors region strip. */
function clickRandomize() {
  fireEvent.click(screen.getByRole('button', { name: 'Randomize' }));
}

/*
 * Randomize (PRD point 11): a global Colors-region action that fills the
 * current mode's slots with a generated WCAG-AA palette. Like editing a color
 * or copying a theme, it is ALSO a way to go custom — while off it seeds + saves
 * in ONE PATCH and announces once; while on it copies over with an Undo. The
 * generator runs for real here (NOT mocked) so the wiring is exercised
 * end-to-end; `randomPalette.test.ts` is the airtight contract gate.
 */
describe('ThemeEditor randomize button', () => {
  it('renders a real, keyboard-reachable button named "Randomize"', () => {
    render(<ThemeEditor />);
    const button = screen.getByRole('button', { name: 'Randomize' });
    expect(button).toBeInTheDocument();
    // A real <button> is focusable + Enter/Space-activated for free (no custom
    // role/handler), so keyboard reachability is structural.
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('keeps the Randomize trigger OUTSIDE any preview-scoped ancestor', () => {
    render(<ThemeEditor />);
    let node: HTMLElement | null = screen.getByRole('button', {
      name: 'Randomize',
    });
    // No ancestor carries an inline custom-property style, so a hostile prior
    // palette can never strand this recovery control (a11y brief §5).
    while (node) {
      expect(node.getAttribute('style') ?? '').not.toContain('--');
      node = node.parentElement;
    }
  });

  it('goes custom when off: enables, persists in ONE PATCH, announces', async () => {
    render(<ThemeEditor />);
    clickRandomize();

    expect(mockTheme.setCustomThemeEnabled).toHaveBeenCalledWith(true);
    expect(mockTheme.setBaseTheme).not.toHaveBeenCalled();

    await waitFor(() => expect(updateMe).toHaveBeenCalledTimes(1));
    const patch = (updateMe as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(patch.customThemeEnabled).toBe(true);
    // The edited mode (dark) carries the generated palette; the other mode
    // (light) is preserved off the probe, untouched by the generator.
    expect(patch.customTheme.dark['--base-bg']).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(patch.customTheme.light).toEqual({ '--mount-bg': 'boyhood-light' });

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Your theme is on. Random palette applied and saved.',
      ),
    );
  });

  it('offers an Undo when randomize overwrote a returning user’s palette', async () => {
    mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
    render(<ThemeEditor />);
    clickRandomize();

    const undo = await screen.findByRole('button', {
      name: /undo copy from random palette/i,
    });
    expect(undo).toBeInTheDocument();
  });

  it('copies over with an Undo when custom is already on', async () => {
    vi.useFakeTimers();
    try {
      mockTheme.customThemeEnabled = true;
      mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
      render(<ThemeEditor />);

      clickRandomize();
      // Apply-on path never re-flips the enable flag (no engage PATCH).
      expect(mockTheme.setCustomThemeEnabled).not.toHaveBeenCalled();

      // The Undo for the just-applied random palette is offered immediately.
      expect(
        screen.getByRole('button', { name: /undo copy from random palette/i }),
      ).toBeInTheDocument();

      // The high-intent apply persists via saveNow (not the debounce).
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(updateMe).toHaveBeenCalledWith({
        customTheme: expect.objectContaining({
          dark: expect.objectContaining({
            '--base-bg': expect.stringMatching(/^#[0-9a-fA-F]{6}$/),
          }),
        }),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('announces the apply through the polite region when custom is on', async () => {
    mockTheme.customThemeEnabled = true;
    mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
    render(<ThemeEditor />);

    clickRandomize();

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Random palette applied and saved.',
      ),
    );
  });
});

describe('ThemeEditor slot edit while already custom', () => {
  it('takes the scheduled-save path, never re-engaging, and persists the edit', async () => {
    vi.useFakeTimers();
    try {
      mockTheme.customThemeEnabled = true;
      mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
      render(<ThemeEditor />);

      editBaseBackground('#123456');

      // No engage: the enable flag is never re-flipped, and no synchronous
      // engage PATCH fires (the auto-save is debounced, not yet sent).
      expect(mockTheme.setCustomThemeEnabled).not.toHaveBeenCalled();
      expect(updateMe).not.toHaveBeenCalled();

      // The debounced auto-save flushes the real edit (via `setOverride`).
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(updateMe).toHaveBeenCalledWith({
        customTheme: expect.objectContaining({
          dark: expect.objectContaining({ '--base-bg': '#123456' }),
        }),
      });
      // Still no engage PATCH ({ customThemeEnabled: true, ... }) anywhere.
      expect(mockTheme.setCustomThemeEnabled).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

/*
 * The title row carries a NON-interactive contrast roll-up icon (#3), right of
 * the h1 like the keyboard-shortcuts glyph on "Your links". It is keyed on the
 * live `failures` map: a check when clean, a triangle when a contract pair
 * fails. It is supplementary to the per-slot row failures (R-A2), carries NO
 * auto-announce channel (R-A3), and conveys state by distinct glyph, not color
 * alone (R-A5).
 */
describe('ThemeEditor contrast status icon (title row)', () => {
  it('shows a non-interactive check glyph when the palette is contrast-clean', () => {
    render(<ThemeEditor />);
    const icon = screen.getByRole('img', {
      name: 'Theme colors meet contrast',
    });
    // A bare <i role="img">: not a button, not in the tab order (R-A1).
    expect(icon.tagName).toBe('I');
    expect(icon).toHaveClass('fa-circle-check');
    expect(icon).not.toHaveAttribute('tabindex');
    // No auto-announce channel — the polite save region owns speech (R-A3).
    expect(icon).not.toHaveAttribute('aria-live');
  });

  it('flips to a warning triangle when a contract pair fails', () => {
    render(<ThemeEditor />);
    // Collapse Background onto Text (1:1 ratio) so a base text/bg pair fails.
    fireEvent.change(screen.getByLabelText('Color picker for Background'), {
      target: { value: '#808080' },
    });
    fireEvent.change(screen.getByLabelText('Color picker for Text'), {
      target: { value: '#808080' },
    });
    const icon = screen.getByRole('img', {
      name: 'Theme has a contrast issue to fix',
    });
    expect(icon).toHaveClass('fa-triangle-exclamation');
    expect(icon).not.toHaveAttribute('aria-live');
  });
});

/*
 * The single copy button (#5) HIDES once custom is on — there is no longer a
 * base film theme to copy from (R-B1). It hides (not disables-in-place) via the
 * shared IconButton's `hidden` prop, which seals it from the tab + AT trees.
 */
describe('ThemeEditor copy button visibility', () => {
  it('hides the copy button once custom is on', () => {
    mockTheme.customThemeEnabled = true;
    mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
    render(<ThemeEditor />);
    // A hidden IconButton is aria-hidden, so it has no computed accessible name
    // — match it by text content among the hidden buttons instead.
    const copy = screen
      .getAllByRole('button', { hidden: true })
      .find((button) => /copy boyhood colors/i.test(button.textContent ?? ''));
    expect(copy).toBeDefined();
    expect(copy).toHaveAttribute('aria-hidden', 'true');
    expect(copy).toBeDisabled();
  });
});

/*
 * Focus moves AFTER each async engage transition settles (SC 2.4.3) — the copy
 * button or Undo can unmount/mount across the await, so a synchronous focus
 * would land on <body> (a11y brief R-B2/R-B4/R-B5).
 */
describe('ThemeEditor toolbar focus management', () => {
  it('lands focus on Randomize after a copy-initiated engage with no Undo', async () => {
    render(<ThemeEditor />);
    copyActiveTheme();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Randomize' })).toHaveFocus(),
    );
  });

  it('lands focus on the Undo button after a copy that overwrote a saved palette', async () => {
    mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
    render(<ThemeEditor />);
    copyActiveTheme();
    const undo = await screen.findByRole('button', {
      name: /undo copy from boyhood/i,
    });
    await waitFor(() => expect(undo).toHaveFocus());
  });

  it('returns focus to Randomize when Undo reverts a copy-over (custom stays on)', () => {
    mockTheme.customThemeEnabled = true;
    mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
    render(<ThemeEditor />);

    clickRandomize();
    const undo = screen.getByRole('button', {
      name: /undo copy from random palette/i,
    });
    fireEvent.click(undo);

    expect(screen.getByRole('button', { name: 'Randomize' })).toHaveFocus();
  });

  it('returns focus to the reappearing copy button when an engage-Undo turns custom off', async () => {
    // A STATEFUL enabled flag so the copy button actually hides on engage and
    // reappears on undo (the return-focus effect is keyed on that transition).
    // The component's own state bumps drive the rerenders that re-read it.
    mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
    mockTheme.setCustomThemeEnabled = vi.fn((value: boolean) => {
      mockTheme.customThemeEnabled = value;
    });
    render(<ThemeEditor />);

    copyActiveTheme();
    const undo = await screen.findByRole('button', {
      name: /undo copy from boyhood/i,
    });
    fireEvent.click(undo);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /copy boyhood colors/i }),
      ).toHaveFocus(),
    );
  });
});
