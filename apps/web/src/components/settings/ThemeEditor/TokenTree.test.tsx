/*
 * Tests for the "show all colors" drawer (TokenTree).
 *
 * Covers the mount + hidden contract (the parent toggles `hidden`, never
 * unmounts), the search landmark's accessible name, and the Escape handler's
 * stopPropagation so clearing the search can't bubble up and collapse the
 * outer disclosure.
 */

import TokenTree, { TOKEN_TREE_ID } from './TokenTree';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EDITABLE_VARS, type ThemeVariable } from './useThemeOverrides';

function buildColorValues(): Record<ThemeVariable, string> {
  return Object.fromEntries(
    EDITABLE_VARS.map((variable) => [variable, '#abcdef']),
  ) as Record<ThemeVariable, string>;
}

function renderTree(visible: boolean) {
  return render(
    <TokenTree
      colorValues={buildColorValues()}
      contrastFailures={new Map()}
      onOverride={vi.fn()}
      visible={visible}
    />,
  );
}

describe('TokenTree – mount + hidden', () => {
  it('renders its root with the shared id and stays hidden while collapsed', () => {
    renderTree(false);
    const root = document.getElementById(TOKEN_TREE_ID);
    expect(root).not.toBeNull();
    expect(root).toHaveAttribute('hidden');
    // Hidden subtree is out of the accessibility tree.
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('drops the hidden attribute when visible', () => {
    renderTree(true);
    expect(document.getElementById(TOKEN_TREE_ID)).not.toHaveAttribute(
      'hidden',
    );
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });
});

describe('TokenTree – search landmark', () => {
  it('names the search landmark "Search theme tokens"', () => {
    renderTree(true);
    expect(
      screen.getByRole('search', { name: /search theme tokens/i }),
    ).toBeInTheDocument();
  });
});

describe('TokenTree – Escape handling', () => {
  // A native listener ABOVE React's render root only fires if the event was
  // allowed to bubble past it (i.e. stopPropagation was NOT called).
  function withBubbleSpy(run: (searchbox: HTMLInputElement) => void) {
    const spy = vi.fn();
    document.body.addEventListener('keydown', spy);
    try {
      run(screen.getByRole('searchbox') as HTMLInputElement);
    } finally {
      document.body.removeEventListener('keydown', spy);
    }
    return spy;
  }

  it('stops Escape from bubbling while a query is active, and clears the query', () => {
    renderTree(true);
    const spy = withBubbleSpy((searchbox) => {
      fireEvent.change(searchbox, { target: { value: 'mount' } });
      fireEvent.keyDown(searchbox, { key: 'Escape' });
      // stopPropagation kept it from reaching the outer disclosure.
      expect(searchbox.value).toBe('');
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('lets Escape bubble when there is no query to clear', () => {
    renderTree(true);
    const spy = withBubbleSpy((searchbox) => {
      fireEvent.keyDown(searchbox, { key: 'Escape' });
    });
    expect(spy).toHaveBeenCalled();
  });
});
