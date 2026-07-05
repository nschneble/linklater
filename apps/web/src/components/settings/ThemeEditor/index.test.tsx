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
import { MOCK_GLYPHS } from './mockGlyphs';
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
      screen.getByRole('button', { name: /copy boyhood/i }),
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
 * control, mirroring the "Your links" toolbar. It IS the shared SlidingTabBar
 * (same component as the Unread/Read switcher) — a role=tablist of aria-selected
 * tabs controlling the editing panel — and stays a sibling ABOVE the preview
 * scope so going custom never drags the toolbar's paint with it.
 */
describe('ThemeEditor mode toggle in the header toolbar', () => {
  it('renders the Light/Dark palette toggle, seeded to the site mode (dark)', () => {
    render(<ThemeEditor />);
    const group = screen.getByRole('tablist', { name: /palette to edit/i });
    expect(within(group).getByRole('tab', { name: /dark/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(group).getByRole('tab', { name: /light/i })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('flips the selected palette when the other mode is chosen', () => {
    render(<ThemeEditor />);
    const group = screen.getByRole('tablist', { name: /palette to edit/i });
    fireEvent.click(within(group).getByRole('tab', { name: /light/i }));
    expect(within(group).getByRole('tab', { name: /light/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(group).getByRole('tab', { name: /dark/i })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('is no longer rendered inside the Colors region', () => {
    render(<ThemeEditor />);
    const colors = screen.getByRole('region', { name: 'Color Bundles' });
    expect(
      within(colors).queryByRole('tablist', { name: /palette to edit/i }),
    ).toBeNull();
  });

  it('leads the toolbar: mode toggle precedes Randomize, then the copy button', () => {
    render(<ThemeEditor />);
    const modeGroup = screen.getByRole('tablist', {
      name: /palette to edit/i,
    });
    const randomize = screen.getByRole('button', { name: 'Randomize' });
    const copyButton = screen.getByRole('button', {
      name: /copy boyhood/i,
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
    let node: HTMLElement | null = screen.getByRole('tablist', {
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

describe('ThemeEditor live preview highlights the selected bundle', () => {
  it('opens on base and mutes the rest, then swaps the highlight + explanation when a bundle is picked', () => {
    render(<ThemeEditor />);

    // The whole app frame renders for every bundle; only the active bundle's
    // component stays in color. On base the toolbar (its asemic "Add link"
    // stand-in) is NOT muted, and its app-themed explanation shows.
    const mock = screen.getByTestId('app-mock');
    expect(
      within(mock).getByText(MOCK_GLYPHS.addLink).closest('[data-muted]'),
    ).toBeNull();
    expect(screen.getByText(/page defaults/i)).toBeInTheDocument();

    // Picking the mount bundle moves the highlight to the link card. The inner
    // mock REMOUNTS on a bundle change (re-query the live node), the explanation
    // swaps, and the toolbar — still rendered — is now muted.
    fireEvent.click(screen.getByRole('tab', { name: 'Mount' }));
    expect(
      screen.getByText(/raised components like cards/i),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('app-mock'))
        .getByText(MOCK_GLYPHS.addLink)
        .closest('[data-muted]'),
    ).not.toBeNull();
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
      name: /copy boyhood/i,
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
    // later engage/copy announcement has somewhere to speak (a11y brief §1).
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
 * Clicks the single toolbar copy action, which overwrites the live custom
 * palette with the CURRENTLY ACTIVE film theme's colors (boyhood in the mock).
 * The button is only interactive while custom is ON; while off it is
 * aria-disabled (the editor already previews that theme, so a copy is
 * redundant), so this exercises the copy-over-while-on path.
 */
function copyActiveTheme() {
  fireEvent.click(screen.getByRole('button', { name: /copy boyhood/i }));
}

/*
 * While custom is OFF the copy button is redundant: `readBaseline` probes the
 * base film theme when custom is off, so the editor already previews exactly
 * those colors and copying them changes nothing. The button is INERT via
 * `aria-disabled` — kept focusable (NOT the native `disabled` attribute, which
 * would drop it from the tab order and announce no reason) so `aria-describedby`
 * can name WHY it is unavailable — and its click is a guarded no-op.
 */
describe('ThemeEditor copy button is inert while custom is off', () => {
  it('is aria-disabled (not natively disabled) and does nothing when never configured', () => {
    render(<ThemeEditor />);
    const copy = screen.getByRole('button', { name: /copy boyhood/i });
    expect(copy).toHaveAttribute('aria-disabled', 'true');
    // aria-disabled, NOT the native attribute — it stays in the tab order.
    expect(copy).not.toBeDisabled();

    copyActiveTheme();

    expect(mockTheme.setCustomThemeEnabled).not.toHaveBeenCalled();
    expect(mockTheme.setCustomTheme).not.toHaveBeenCalled();
    expect(updateMe).not.toHaveBeenCalled();
  });

  it('stays inert for a returning user whose custom is off but configured', () => {
    // A saved palette exists, but custom is off (the user reverted earlier). The
    // editor still previews the base theme, so copy is redundant here too.
    mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
    render(<ThemeEditor />);
    const copy = screen.getByRole('button', { name: /copy boyhood/i });
    expect(copy).toHaveAttribute('aria-disabled', 'true');

    copyActiveTheme();

    expect(mockTheme.setCustomThemeEnabled).not.toHaveBeenCalled();
    expect(updateMe).not.toHaveBeenCalled();
  });

  it('names why it is unavailable via aria-describedby', () => {
    render(<ThemeEditor />);
    const copy = screen.getByRole('button', { name: /copy boyhood/i });
    const describedBy = copy.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      "Already using Boyhood's colors. Edit a color or Randomize to start a custom theme.",
    );
  });
});

/*
 * When the ACTIVE theme is itself the custom theme ("Your Theme"), copying it
 * onto the custom palette is a no-op — so the copy button is aria-disabled even
 * though custom is ON. Its click is a guarded no-op, and its aria-describedby
 * names the "already active" reason (driven off baseThemeLabel, not a hardcoded
 * "Your Theme").
 */
describe('ThemeEditor copy button is inert when the custom theme is active', () => {
  beforeEach(() => {
    mockTheme.baseTheme = 'custom';
    mockTheme.customThemeEnabled = true;
    mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
  });

  it('is aria-disabled and does nothing when copying Your Theme onto itself', () => {
    render(<ThemeEditor />);
    const copy = screen.getByRole('button', { name: /copy your theme/i });
    expect(copy).toHaveAttribute('aria-disabled', 'true');
    // aria-disabled, NOT the native attribute — it stays in the tab order.
    expect(copy).not.toBeDisabled();

    fireEvent.click(copy);

    // The guard mirrors the disabled condition, so no save is attempted.
    expect(updateMe).not.toHaveBeenCalled();
  });

  it('names the "already active" reason via aria-describedby', () => {
    render(<ThemeEditor />);
    const copy = screen.getByRole('button', { name: /copy your theme/i });
    const describedBy = copy.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      "Your Theme is already active, so there's nothing to copy. Edit a color or Randomize to change it.",
    );
  });
});

/*
 * While custom is already ON, copy is a copy-over: it overwrites the live palette
 * with the active film theme's current-mode colors, keeps custom ON (no engage /
 * no re-enable), announces, and persists via the high-intent saveNow — the SAME
 * path as Randomize-while-on. There is no Undo affordance (removed by design).
 */
describe('ThemeEditor copy-over while custom is on', () => {
  beforeEach(() => {
    mockTheme.customThemeEnabled = true;
    mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
  });

  it('is interactive (not aria-disabled) once custom is on', () => {
    render(<ThemeEditor />);
    expect(
      screen.getByRole('button', { name: /copy boyhood/i }),
    ).not.toHaveAttribute('aria-disabled');
  });

  it('overwrites with the base theme colors and never re-engages', async () => {
    vi.useFakeTimers();
    try {
      render(<ThemeEditor />);
      copyActiveTheme();

      // No engage: the enable flag is never re-flipped (custom already on).
      expect(mockTheme.setCustomThemeEnabled).not.toHaveBeenCalled();

      // The high-intent apply persists via saveNow (not the debounce), carrying
      // the base theme's probed current-mode token.
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(updateMe).toHaveBeenCalledWith({
        customTheme: expect.objectContaining({
          dark: expect.objectContaining({ '--mount-bg': 'boyhood-dark' }),
        }),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('announces the copy-over through the polite region', async () => {
    render(<ThemeEditor />);
    copyActiveTheme();
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Boyhood palette applied and saved.',
      ),
    );
  });

  it('offers no Undo affordance after a copy-over', async () => {
    render(<ThemeEditor />);
    copyActiveTheme();
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Boyhood palette applied and saved.',
      ),
    );
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull();
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
 * in ONE PATCH and announces once; while on it copies over. The
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

  it('goes custom without any Undo affordance for a returning user', async () => {
    mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
    render(<ThemeEditor />);
    clickRandomize();

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Your theme is on. Random palette applied and saved.',
      ),
    );
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull();
  });

  it('copies over without any Undo affordance when custom is already on', async () => {
    vi.useFakeTimers();
    try {
      mockTheme.customThemeEnabled = true;
      mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
      render(<ThemeEditor />);

      clickRandomize();
      // Apply-on path never re-flips the enable flag (no engage PATCH).
      expect(mockTheme.setCustomThemeEnabled).not.toHaveBeenCalled();

      // No Undo affordance is offered.
      expect(screen.queryByRole('button', { name: /undo/i })).toBeNull();

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
      name: 'Theme colors meet minimum contrast',
    });
    // A bare <i role="img">: not a button, not in the tab order (R-A1).
    expect(icon.tagName).toBe('I');
    expect(icon).toHaveClass('fa-circle-check');
    expect(icon).not.toHaveAttribute('tabindex');
    // No auto-announce channel — the polite save region owns speech (R-A3).
    expect(icon).not.toHaveAttribute('aria-live');
  });

  it('flips to a warning triangle when a contract pair fails', async () => {
    render(<ThemeEditor />);
    // Collapse Background onto Text (1:1 ratio) so a base text/bg pair fails.
    // The first color edit triggers an async engage; wrap both edits so its
    // trailing state update settles inside act.
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Color picker for Background'), {
        target: { value: '#808080' },
      });
      fireEvent.change(screen.getByLabelText('Color picker for Text'), {
        target: { value: '#808080' },
      });
    });
    const icon = screen.getByRole('img', {
      name: "Theme colors don't meet minimum contrast",
    });
    expect(icon).toHaveClass('fa-triangle-exclamation');
    expect(icon).not.toHaveAttribute('aria-live');
  });
});

/*
 * The single copy button stays in the DOM even once custom is on — it remains
 * the way to overwrite a customized palette with the underlying film theme's
 * colors, which makes it a recovery control: it sits OUTSIDE the preview-scoped
 * `contentThemeStyle` subtree, so it survives a hostile live palette. It names
 * the base film theme in its accessible name regardless of whether custom is
 * engaged.
 */
describe('ThemeEditor copy button visibility', () => {
  it('keeps the copy button in the DOM once custom is on', () => {
    mockTheme.customThemeEnabled = true;
    mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
    render(<ThemeEditor />);
    expect(
      screen.getByRole('button', { name: /copy boyhood/i }),
    ).toBeInTheDocument();
  });
});

/*
 * With the Undo affordance removed, neither Copy nor Randomize moves focus:
 * both triggering controls stay mounted and enabled, so there is nothing to
 * land focus on after the action. The first color edit is the sole engage that
 * must NOT move focus — it stays on the picker mid-drag (R-B3).
 */
describe('ThemeEditor toolbar focus management', () => {
  it('does NOT move focus off Randomize after a copy-over (custom stays on)', async () => {
    mockTheme.customThemeEnabled = true;
    mockTheme.customTheme = { dark: { '--mount-bg': '#abc' }, light: {} };
    render(<ThemeEditor />);

    const randomize = screen.getByRole('button', { name: 'Randomize' });
    randomize.focus();
    // Randomize runs its copy-over path; wrap it so any trailing state update
    // settles inside act.
    await act(async () => {
      clickRandomize();
    });

    // No programmatic focus move — focus stays where the user left it.
    expect(randomize).toHaveFocus();
  });

  // The color-edit engage must NOT move focus, or a returning user editing a
  // swatch would have focus yanked off the picker mid-task (R-B3).
  it('does NOT steal focus off the color picker when the first edit goes custom', async () => {
    render(<ThemeEditor />);
    const picker = screen.getByLabelText('Color picker for Background');
    picker.focus();
    expect(picker).toHaveFocus();

    fireEvent.change(picker, { target: { value: '#123456' } });

    // The engage settles + announces, proving the async path ran to completion.
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Your theme is on and saved.',
      ),
    );
    // Focus never left the edited input.
    expect(picker).toHaveFocus();
  });
});
