/*
 * Tests for the ColorEditor search box.
 *
 * Covers the search filter + auto-expand contract added when the ThemeEditor
 * grew a token search input. The underlying disclosure / color-picker
 * machinery is exercised indirectly by these tests and was already shipping
 * pre-search.
 */

import ColorEditor from './ColorEditor';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenContrastFailure } from './contrastResults';
import {
  EDITABLE_VARS,
  VAR_GROUPS,
  type ThemeVariable,
} from './useThemeOverrides';

const PLACEHOLDER_VALUE = '#abcdef';

function buildColorValues(): Record<ThemeVariable, string> {
  return Object.fromEntries(
    EDITABLE_VARS.map((variable) => [variable, PLACEHOLDER_VALUE]),
  ) as Record<ThemeVariable, string>;
}

function renderEditor(
  contrastFailures: Map<string, TokenContrastFailure> = new Map(),
  editingDisabled = false,
) {
  return render(
    <ColorEditor
      colorValues={buildColorValues()}
      contrastFailures={contrastFailures}
      onOverride={vi.fn()}
      onResetBundle={vi.fn()}
      editingDisabled={editingDisabled}
    />,
  );
}

function getSearchbox() {
  return screen.getByRole('searchbox', { name: /search tokens/i });
}

describe('ColorEditor – token search', () => {
  it('shows every bundle section when no query is entered', () => {
    renderEditor();
    for (const group of VAR_GROUPS) {
      expect(
        screen.getByRole('button', { name: new RegExp(`^${group.label}`) }),
      ).toBeInTheDocument();
    }
  });

  it('filters bundle labels case-insensitively', () => {
    renderEditor();
    fireEvent.change(getSearchbox(), { target: { value: 'MOUNT' } });
    expect(screen.getByRole('button', { name: /^Mount/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Alert/ })).toBeNull();
  });

  it('filters slot labels', () => {
    renderEditor();
    fireEvent.change(getSearchbox(), {
      target: { value: 'highlight foreground' },
    });
    // Every bundle has a highlight-foreground slot, so every bundle stays.
    for (const group of VAR_GROUPS) {
      expect(
        screen.getByRole('button', { name: new RegExp(`^${group.label}`) }),
      ).toBeInTheDocument();
    }
  });

  it('filters variable names with or without leading dashes', () => {
    renderEditor();
    fireEvent.change(getSearchbox(), { target: { value: '--alert-bg' } });
    expect(screen.getByRole('button', { name: /^Alert/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Mount/ })).toBeNull();

    fireEvent.change(getSearchbox(), { target: { value: 'alert-bg' } });
    expect(screen.getByRole('button', { name: /^Alert/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Mount/ })).toBeNull();
  });

  it('auto-expands matching bundles while a query is active', () => {
    renderEditor();
    fireEvent.change(getSearchbox(), { target: { value: 'warn' } });
    const warnButton = screen.getByRole('button', { name: /^Warn/ });
    expect(warnButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('restores prior open state when the query is cleared', () => {
    renderEditor();
    const alertButton = screen.getByRole('button', { name: /^Alert/ });
    expect(alertButton).toHaveAttribute('aria-expanded', 'false');
    // Open alert manually.
    fireEvent.click(alertButton);
    expect(alertButton).toHaveAttribute('aria-expanded', 'true');

    // Search for mount – alert collapses out of the filtered list entirely.
    fireEvent.change(getSearchbox(), { target: { value: 'mount' } });
    expect(screen.queryByRole('button', { name: /^Alert/ })).toBeNull();

    // Clear the query – alert returns AND is still open.
    fireEvent.change(getSearchbox(), { target: { value: '' } });
    expect(screen.getByRole('button', { name: /^Alert/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('renders an empty-state note when no tokens match', () => {
    renderEditor();
    fireEvent.change(getSearchbox(), { target: { value: 'qqqqzz' } });
    expect(screen.getByRole('note').textContent).toBe(
      'No tokens match “qqqqzz”.',
    );
    expect(screen.queryByRole('button', { name: /^Base/ })).toBeNull();
  });

  it('announces match count via the live region', () => {
    renderEditor();
    const status = document.getElementById('theme-editor-token-search-status');
    expect(status).not.toBeNull();
    // Empty query – silent.
    expect(status?.textContent ?? '').toBe('');

    // No match.
    fireEvent.change(getSearchbox(), { target: { value: 'qqqqzz' } });
    expect(status?.textContent).toMatch(/No tokens match/);

    // One match (only Base bundle has a subtle-text slot).
    fireEvent.change(getSearchbox(), { target: { value: 'subtle' } });
    expect(status?.textContent).toMatch(/^1 token matches$/);

    // Multi-match.
    fireEvent.change(getSearchbox(), { target: { value: 'border' } });
    expect(status?.textContent).toMatch(/^\d+ tokens match$/);
  });

  it('clears the query when Escape is pressed', () => {
    renderEditor();
    const searchbox = getSearchbox();
    fireEvent.change(searchbox, { target: { value: 'mount' } });
    expect((searchbox as HTMLInputElement).value).toBe('mount');
    fireEvent.keyDown(searchbox, { key: 'Escape' });
    expect((searchbox as HTMLInputElement).value).toBe('');
  });

  it('clear button is keyboard-reachable when the query is non-empty', () => {
    renderEditor();
    // No clear button when query is empty.
    expect(screen.queryByRole('button', { name: /clear search/i })).toBeNull();

    fireEvent.change(getSearchbox(), { target: { value: 'mount' } });
    const clearButton = screen.getByRole('button', { name: /clear search/i });
    fireEvent.click(clearButton);
    expect((getSearchbox() as HTMLInputElement).value).toBe('');
  });

  it('wraps the search input in a role="search" landmark with sr-only label', () => {
    renderEditor();
    const landmark = screen.getByRole('search');
    expect(
      within(landmark).getByLabelText(/search tokens/i),
    ).toBeInTheDocument();
  });
});

describe('ColorEditor – editing locked (custom theme off)', () => {
  it('keeps search + disclosures operable while locked', () => {
    renderEditor(new Map(), true);
    // Browse stays available: search is operable, base disclosure can toggle.
    expect(getSearchbox()).not.toBeDisabled();
    const baseButton = screen.getByRole('button', { name: /^Base/ });
    expect(baseButton).not.toBeDisabled();
  });

  it('surfaces the lock state + reason through the corner indicator', () => {
    renderEditor(new Map(), true);
    const lock = screen.getByRole('button', { name: /editing locked/i });
    // The tooltip message is the search input's describedby target.
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent(
      /turn on the switch to edit your colors/i,
    );
    expect(lock).toHaveAttribute('aria-describedby', tooltip.id);
    expect(getSearchbox().getAttribute('aria-describedby')).toContain(
      tooltip.id,
    );
  });

  it('dismisses the lock tooltip on Escape, keeping the trigger focused', () => {
    renderEditor(new Map(), true);
    const lock = screen.getByRole('button', { name: /editing locked/i });
    lock.focus();
    fireEvent.keyDown(lock, { key: 'Escape' });
    expect(screen.getByRole('tooltip')).toHaveAttribute(
      'data-dismissed',
      'true',
    );
    expect(lock).toHaveFocus();
  });

  it('locks the hex input read-only (not disabled) so values stay copyable', () => {
    renderEditor(new Map(), true);
    const input = screen.getByRole('textbox', { name: /Base text/i });
    expect(input).toHaveAttribute('readonly');
    expect(input).not.toBeDisabled();
  });

  it('disables the color pickers and per-bundle resets', () => {
    renderEditor(new Map(), true);
    expect(
      screen.getByRole('button', { name: /reset base bundle/i }),
    ).toBeDisabled();
    expect(screen.getByLabelText(/color picker for base text/i)).toBeDisabled();
  });

  it('suppresses aria-invalid on a failing token while locked', () => {
    renderEditor(
      new Map([
        ['--base-text', { ratio: 2.9, threshold: 4.5, pairLabel: 'text / bg' }],
      ]),
      true,
    );
    const input = screen.getByRole('textbox', { name: /Base text/i });
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('flips the corner indicator to unlocked when editing is enabled', () => {
    renderEditor(new Map(), false);
    expect(
      screen.getByRole('button', { name: /editing unlocked/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent(/editing on/i);
    // When unlocked the search no longer points at the lock message.
    expect(getSearchbox().getAttribute('aria-describedby')).not.toContain(
      'edit-lock-tooltip',
    );
  });
});

describe('ColorEditor – per-token contrast failure (BL1)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const failure: TokenContrastFailure = {
    ratio: 2.9,
    threshold: 4.5,
    pairLabel: 'text / bg',
  };

  it('marks a failing token input aria-invalid and describes it after the debounce', () => {
    // Base bundle is open by default; --base-text is a base slot row.
    renderEditor(new Map([['--base-text', failure]]));

    const input = screen.getByRole('textbox', { name: /Base text/i });
    // aria-invalid is immediate (drives styling); the note text is debounced.
    expect(input).toHaveAttribute('aria-invalid', 'true');

    act(() => {
      vi.advanceTimersByTime(400);
    });

    const describedById = input.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();
    const note = document.getElementById(describedById as string);
    expect(note?.textContent).toContain('Fails contrast with text / bg');
    expect(note?.textContent).toContain('2.9:1, needs 4.5:1');
    // Per-row notes must NOT be live regions (no alert barrage across ~50 rows).
    expect(note?.getAttribute('role')).toBeNull();
  });

  it('leaves a passing token input valid with no note', () => {
    renderEditor();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    const input = screen.getByRole('textbox', { name: /Base text/i });
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });
});
