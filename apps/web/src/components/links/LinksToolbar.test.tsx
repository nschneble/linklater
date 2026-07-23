/*
 * Tests for LinksToolbar – focused on the mobile search-input fixes:
 *   1. iOS auto-zoom is avoided by shipping a 16px font on mobile
 *      (`text-base sm:text-sm`) instead of 14px.
 *   2. The native WebKit search-cancel button is suppressed so it can't
 *      collide with the custom clear button
 *      (`[&::-webkit-search-cancel-button]:appearance-none`).
 *   3. A custom clear button appears only while there's a query, clears it,
 *      and returns focus to the input – including the stray-focus safety net
 *      where `search` is reset to '' by an outside force (filter change) while
 *      the clear button holds focus.
 */

import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import LinksToolbar from './LinksToolbar';

const baseProps = {
  filter: 'unread' as const,
  isClearingRead: false,
  links: [],
  randomLoading: false,
  search: '',
  searchInputReference: createRef<HTMLInputElement>(),
  showLinkForm: false,
  onClearRead: vi.fn(),
  onNavigateRead: vi.fn(),
  onNavigateUnread: vi.fn(),
  onRandom: vi.fn(),
  onSearch: vi.fn(),
  onToggleForm: vi.fn(),
};

describe('LinksToolbar search input', () => {
  it('omits the clear button when the search term is empty', () => {
    render(<LinksToolbar {...baseProps} search="" />);
    expect(screen.queryByRole('button', { name: /clear search/i })).toBeNull();
  });

  it('renders the clear button when the search term is non-empty', () => {
    render(<LinksToolbar {...baseProps} search="react" />);
    expect(
      screen.getByRole('button', { name: /clear search/i }),
    ).toBeInTheDocument();
  });

  it('clears the search term when the clear button is clicked', () => {
    const onSearch = vi.fn();
    render(<LinksToolbar {...baseProps} search="react" onSearch={onSearch} />);

    fireEvent.click(screen.getByRole('button', { name: /clear search/i }));

    expect(onSearch).toHaveBeenCalledWith('');
  });

  it('returns focus to the search input after clicking clear', () => {
    const searchInputReference = createRef<HTMLInputElement>();
    render(
      <LinksToolbar
        {...baseProps}
        search="react"
        searchInputReference={searchInputReference}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /clear search/i }));

    expect(document.activeElement).toBe(searchInputReference.current);
  });

  it('recovers focus to the input when search is reset while the clear button is focused', () => {
    // Simulates the stray-focus path in `useSearchDebounce`: a filter change
    // (tab switch / back-forward nav) resets `search` to '' independently of
    // the clear button's own click handler. If the button holds focus when it
    // unmounts, focus would fall to <body>; the safety-net layout effect must
    // pull it back to the input.
    const searchInputReference = createRef<HTMLInputElement>();
    const { rerender } = render(
      <LinksToolbar
        {...baseProps}
        search="react"
        searchInputReference={searchInputReference}
      />,
    );

    const clearButton = screen.getByRole('button', { name: /clear search/i });
    fireEvent.focus(clearButton);
    clearButton.focus();
    expect(document.activeElement).toBe(clearButton);

    // Search is cleared by an outside force (not the button's click handler).
    rerender(
      <LinksToolbar
        {...baseProps}
        search=""
        searchInputReference={searchInputReference}
      />,
    );

    expect(document.activeElement).toBe(searchInputReference.current);
    expect(document.body).not.toBe(document.activeElement);
  });

  it('ships a 16px mobile font and suppresses the native search-cancel button', () => {
    render(<LinksToolbar {...baseProps} search="" />);
    const input = screen.getByRole('searchbox', {
      name: /search through your links/i,
    });

    // Guards the iOS auto-zoom regression: 16px on mobile, 14px on desktop.
    expect(input).toHaveClass('text-base');
    expect(input).toHaveClass('sm:text-sm');

    // Guards against the native WebKit "x" colliding with the custom button.
    expect(input.className).toContain(
      '[&::-webkit-search-cancel-button]:appearance-none',
    );
  });
});
