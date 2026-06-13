/*
 * Tests for the ColorEditor search box.
 *
 * Covers the search filter + auto-expand contract added when the ThemeEditor
 * grew a token search input. The underlying disclosure / color-picker
 * machinery is exercised indirectly by these tests and was already shipping
 * pre-search.
 */

import ColorEditor from './ColorEditor';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

function renderEditor() {
  return render(
    <ColorEditor
      colorValues={buildColorValues()}
      onOverride={vi.fn()}
      onResetBundle={vi.fn()}
    />,
  );
}

function getSearchbox() {
  return screen.getByRole('searchbox', { name: /search tokens/i });
}

describe('ColorEditor — token search', () => {
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

    // Search for mount — alert collapses out of the filtered list entirely.
    fireEvent.change(getSearchbox(), { target: { value: 'mount' } });
    expect(screen.queryByRole('button', { name: /^Alert/ })).toBeNull();

    // Clear the query — alert returns AND is still open.
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
    // Empty query — silent.
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
