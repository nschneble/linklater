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
  customActive = true,
) {
  return render(
    <ColorEditor
      colorValues={buildColorValues()}
      contrastFailures={contrastFailures}
      baseThemeLabel="Boyhood"
      customActive={customActive}
      onOverride={vi.fn()}
      editorMode="dark"
      onEditorModeChange={vi.fn()}
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

describe('ColorEditor – Light/Dark palette tabs', () => {
  it('renders the mode selector as the card lead control and commits a change', () => {
    const onEditorModeChange = vi.fn();
    render(
      <ColorEditor
        colorValues={buildColorValues()}
        contrastFailures={new Map()}
        baseThemeLabel="Boyhood"
        customActive={true}
        onOverride={vi.fn()}
        editorMode="dark"
        onEditorModeChange={onEditorModeChange}
      />,
    );
    const group = screen.getByRole('group', { name: /palette to edit/i });
    expect(
      within(group).getByRole('button', { name: /dark colors/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(
      within(group).getByRole('button', { name: /light colors/i }),
    );
    expect(onEditorModeChange).toHaveBeenCalledWith('light');
  });
});

describe('ColorEditor – pre-custom seed disclosure (SC 3.3.2)', () => {
  it('discloses that swatches start from the theme until custom is active', () => {
    renderEditor(new Map(), false);
    const note = screen.getByRole('note');
    expect(note.textContent).toBe(
      'These start from Boyhood. Editing any color saves it as your own theme.',
    );
  });

  it('drops the seed note once the custom theme is active', () => {
    renderEditor(new Map(), true);
    expect(screen.queryByText(/these start from boyhood/i)).toBeNull();
  });
});

describe('ColorEditor – always editable (cards only render when enabled)', () => {
  it('keeps the hex input editable (not readonly) with no lock affordance', () => {
    renderEditor();
    const input = screen.getByRole('textbox', { name: /Base text/i });
    expect(input).not.toHaveAttribute('readonly');
    expect(input).not.toBeDisabled();
    // The old corner lock indicator + tooltip are gone entirely.
    expect(
      screen.queryByRole('button', { name: /editing (un)?locked/i }),
    ).toBeNull();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('points the search input only at its status region (no dangling IDREF)', () => {
    renderEditor();
    expect(getSearchbox().getAttribute('aria-describedby')).toBe(
      'theme-editor-token-search-status',
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
