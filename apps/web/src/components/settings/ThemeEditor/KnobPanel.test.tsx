/*
 * Tests for the five human knobs (Page, Cards, Accent, Text, Alerts).
 *
 * Covers the multi-token FLATTEN write, the no-silent-revert invalid-hex format
 * error, the divergence describedby swap (SC 3.3.2), and the both-endpoints
 * contrast flagging that lets a too-light background flag ON the knob.
 */

import KnobPanel from './KnobPanel';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenContrastFailure } from './contrastResults';
import { EDITABLE_VARS, type ThemeVariable } from './useThemeOverrides';

const PLACEHOLDER_VALUE = '#abcdef';

function buildColorValues(
  overrides: Partial<Record<ThemeVariable, string>> = {},
): Record<ThemeVariable, string> {
  return {
    ...(Object.fromEntries(
      EDITABLE_VARS.map((variable) => [variable, PLACEHOLDER_VALUE]),
    ) as Record<ThemeVariable, string>),
    ...overrides,
  };
}

function renderKnobs(
  colorValues = buildColorValues(),
  knobFailures: Map<string, TokenContrastFailure> = new Map(),
) {
  const onKnobOverride = vi.fn();
  render(
    <KnobPanel
      colorValues={colorValues}
      knobFailures={knobFailures}
      onKnobOverride={onKnobOverride}
    />,
  );
  return { onKnobOverride };
}

const ACCENT_TOKENS = [
  '--base-highlight',
  '--mount-highlight',
  '--orbit-highlight',
];

describe('KnobPanel – structure + names', () => {
  it('wraps the knobs in a named group (not a heading)', () => {
    renderKnobs();
    expect(
      screen.getByRole('group', { name: /main colors/i }),
    ).toBeInTheDocument();
    // No extra heading is introduced for the knob group.
    expect(screen.queryByRole('heading', { name: /main colors/i })).toBeNull();
  });

  it('gives every knob a picker + hex whose names lead with the visible word', () => {
    renderKnobs();
    for (const word of ['Page', 'Cards', 'Accent', 'Text', 'Alerts']) {
      expect(screen.getByLabelText(`${word} color`)).toBeInTheDocument();
      expect(
        screen.getByLabelText(`${word} color hex value`),
      ).toBeInTheDocument();
      // Each knob's picker + hex sit in a group named by the word.
      expect(screen.getByRole('group', { name: word })).toBeInTheDocument();
    }
  });
});

describe('KnobPanel – multi-token flatten write', () => {
  it('picker change flattens every accent token to the new value', () => {
    const { onKnobOverride } = renderKnobs();
    fireEvent.change(screen.getByLabelText('Accent color'), {
      target: { value: '#123456' },
    });
    expect(onKnobOverride).toHaveBeenCalledWith(ACCENT_TOKENS, '#123456');
  });

  it('hex commit flattens every accent token on blur', () => {
    const { onKnobOverride } = renderKnobs();
    const hex = screen.getByLabelText('Accent color hex value');
    fireEvent.change(hex, { target: { value: '#654321' } });
    fireEvent.blur(hex);
    expect(onKnobOverride).toHaveBeenCalledWith(ACCENT_TOKENS, '#654321');
  });

  it('shows the representative (base-*) value, single token per single knob', () => {
    const { onKnobOverride } = renderKnobs();
    fireEvent.change(screen.getByLabelText('Page color'), {
      target: { value: '#0a0a0a' },
    });
    expect(onKnobOverride).toHaveBeenCalledWith(['--base-bg'], '#0a0a0a');
  });
});

describe('KnobPanel – invalid hex (no silent revert)', () => {
  it('keeps the typed text, flags it, and shows a distinct format error', () => {
    const { onKnobOverride } = renderKnobs();
    const hex = screen.getByLabelText('Page color hex value');
    fireEvent.change(hex, { target: { value: 'nope' } });
    fireEvent.blur(hex);

    // Not reverted to the prior value.
    expect((hex as HTMLInputElement).value).toBe('nope');
    expect(hex).toHaveAttribute('aria-invalid', 'true');
    // No write was committed for the invalid value.
    expect(onKnobOverride).not.toHaveBeenCalled();

    const describedby = hex.getAttribute('aria-describedby') ?? '';
    const formatNote = document.getElementById('theme-editor-knob-page-format');
    expect(describedby).toContain('theme-editor-knob-page-format');
    expect(formatNote?.textContent).toContain(
      'Not a valid hex color — use #RRGGBB',
    );
  });
});

describe('KnobPanel – divergence disclosure (SC 3.3.2)', () => {
  it('uses the static surfaces help when the constituents agree', () => {
    renderKnobs();
    const hex = screen.getByLabelText('Accent color hex value');
    const help = document.getElementById('theme-editor-knob-accent-help');
    expect(hex.getAttribute('aria-describedby')).toContain(
      'theme-editor-knob-accent-help',
    );
    expect(help?.textContent).toBe(
      'Sets the accent on the page, cards, and menus.',
    );
    // Static help is announced but not a visible hint.
    expect(help?.className).toContain('sr-only');
  });

  it('swaps to a visible reset warning when constituents diverge', () => {
    renderKnobs(
      buildColorValues({
        '--base-highlight': '#111111',
        '--mount-highlight': '#222222',
        '--orbit-highlight': '#333333',
      }),
    );
    const hex = screen.getByLabelText('Accent color hex value');
    // Representative (base-*) value is shown, not a fake "mixed" swatch.
    expect((hex as HTMLInputElement).value).toBe('#111111');

    const help = document.getElementById('theme-editor-knob-accent-help');
    expect(help?.textContent).toBe(
      'Set separately in some areas — changing this resets them to match.',
    );
    // Now a VISIBLE hint, not sr-only.
    expect(help?.className).not.toContain('sr-only');
  });
});

describe('KnobPanel – both-endpoints contrast flagging', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const failure: TokenContrastFailure = {
    ratio: 2.8,
    threshold: 4.5,
    pairLabel: 'text / bg',
  };

  it('flags the Page knob when --base-bg fails as a background', () => {
    renderKnobs(buildColorValues(), new Map([['--base-bg', failure]]));
    const hex = screen.getByLabelText('Page color hex value');
    // aria-invalid is immediate; the note is debounced.
    expect(hex).toHaveAttribute('aria-invalid', 'true');

    act(() => {
      vi.advanceTimersByTime(400);
    });

    const describedby = hex.getAttribute('aria-describedby') ?? '';
    const note = document.getElementById('theme-editor-knob-page-failure');
    expect(describedby).toContain('theme-editor-knob-page-failure');
    expect(note?.textContent).toContain('Page fails contrast');
    expect(note?.textContent).toContain('2.8:1, needs 4.5:1');
  });

  it('names the surface for a multi-token knob (Accent on cards)', () => {
    renderKnobs(buildColorValues(), new Map([['--mount-highlight', failure]]));
    const hex = screen.getByLabelText('Accent color hex value');
    expect(hex).toHaveAttribute('aria-invalid', 'true');

    act(() => {
      vi.advanceTimersByTime(400);
    });

    const note = document.getElementById('theme-editor-knob-accent-failure');
    expect(note?.textContent).toContain('Accent on cards fails contrast');
  });
});

describe('KnobPanel – group membership', () => {
  it('keeps the Accent picker + hex inside the Accent group', () => {
    renderKnobs();
    const group = screen.getByRole('group', { name: 'Accent' });
    expect(within(group).getByLabelText('Accent color')).toBeInTheDocument();
    expect(
      within(group).getByLabelText('Accent color hex value'),
    ).toBeInTheDocument();
  });
});
