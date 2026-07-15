/*
 * Tests for LinksList – the paginated list region rendered inside LinksView.
 *
 * Focus of this file: the skeleton-flash suppression contract introduced for
 * search/filter re-fetches. The initial-load case still renders a
 * `LinkCardSkeleton`; subsequent re-fetches keep the stale list (or empty
 * state) mounted and the loading affordance is AT-only via `aria-busy` on
 * the tabpanel container (WCAG 4.1.3 Status Messages).
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LinksList, { LINKS_LIST_ID } from './LinksList';
import { ThemeProvider } from '../../theme/ThemeContext';
import type { Link } from '../../lib/api';
import type { ReactElement } from 'react';

function renderWithProviders(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

function makeLink(overrides: Partial<Link> = {}): Link {
  return {
    id: 'link-1',
    url: 'https://example.com',
    meta: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    readAt: null,
    ...overrides,
  };
}

const baseProps = {
  filter: 'unread' as const,
  hasSettledOnce: false,
  isClearingRead: false,
  links: [],
  loadingLinks: false,
  page: 1,
  pagination: null,
  search: '',
  debouncedSearch: '',
  selectedLinkIndex: null,
  onReadToggle: vi.fn(),
  onLoadMore: vi.fn(),
};

describe('LinksList initial load', () => {
  it('renders a LinkCardSkeleton on the very first fetch (hasSettledOnce=false)', () => {
    renderWithProviders(
      <LinksList {...baseProps} loadingLinks={true} hasSettledOnce={false} />,
    );

    // LinkCardSkeleton renders with role="status" aria-label="Loading link".
    // Scope to that exact element rather than the broader `.animate-pulse`
    // class (also used by un-fetched LinkCard meta states).
    expect(screen.getByRole('status', { name: /loading link/i })).toBeTruthy();
  });

  it('sets aria-busy="true" on the tabpanel container during the initial load', () => {
    renderWithProviders(
      <LinksList {...baseProps} loadingLinks={true} hasSettledOnce={false} />,
    );

    const tabpanel = document.getElementById(LINKS_LIST_ID);
    expect(tabpanel?.getAttribute('aria-busy')).toBe('true');
    expect(tabpanel?.getAttribute('role')).toBe('tabpanel');
  });
});

describe('LinksList re-fetch (post first settle)', () => {
  it('does NOT render a LinkCardSkeleton when hasSettledOnce is true and the list is non-empty', () => {
    renderWithProviders(
      <LinksList
        {...baseProps}
        loadingLinks={true}
        hasSettledOnce={true}
        links={[makeLink({ id: 'a' })]}
      />,
    );

    // The skeleton's status element must NOT be present; the stale list
    // stays mounted instead. (Note: an un-fetched LinkCard meta state also
    // uses `animate-pulse`, so we assert on the skeleton's specific role +
    // aria-label rather than the class.)
    expect(screen.queryByRole('status', { name: /loading link/i })).toBeNull();
  });

  it('sets aria-busy="true" on the tabpanel during a re-fetch (AT-only affordance)', () => {
    renderWithProviders(
      <LinksList
        {...baseProps}
        loadingLinks={true}
        hasSettledOnce={true}
        links={[makeLink({ id: 'a' })]}
      />,
    );

    const tabpanel = document.getElementById(LINKS_LIST_ID);
    expect(tabpanel?.getAttribute('aria-busy')).toBe('true');
  });

  it('renders the skeleton (not the empty message) during a re-fetch over an empty list', () => {
    // Models a mid-fetch window where a prior fetch left the list empty and a
    // new fetch is in flight. The empty-state message must NOT show while a
    // load is in flight (that is the flash bug); the skeleton is the
    // AT-correct in-load state and aria-busy stays true.
    renderWithProviders(
      <LinksList
        {...baseProps}
        loadingLinks={true}
        hasSettledOnce={true}
        links={[]}
        search="zzz"
        debouncedSearch="zzz"
      />,
    );

    expect(screen.getByRole('status', { name: /loading link/i })).toBeTruthy();
    expect(screen.queryByText(/no unread links/i)).toBeNull();
    const tabpanel = document.getElementById(LINKS_LIST_ID);
    expect(tabpanel?.getAttribute('aria-busy')).toBe('true');
  });

  it('renders the skeleton (not the empty message) on a post-settle page-1 refetch over a blanked list', () => {
    // The flash bug: hasSettledOnce is already true, the page-1 refetch has
    // blanked links to [] and set loadingLinks true. There must be NO render
    // where links.length === 0 && loadingLinks === true resolves to the
    // empty-text branch — it must resolve to the skeleton.
    renderWithProviders(
      <LinksList
        {...baseProps}
        loadingLinks={true}
        hasSettledOnce={true}
        links={[]}
        page={1}
      />,
    );

    expect(screen.getByRole('status', { name: /loading link/i })).toBeTruthy();
    expect(screen.queryByText(/no unread links/i)).toBeNull();
    const tabpanel = document.getElementById(LINKS_LIST_ID);
    expect(tabpanel?.getAttribute('aria-busy')).toBe('true');
  });
});

describe('LinksList settled non-loading states', () => {
  it('renders aria-busy="false" once the fetch has settled', () => {
    renderWithProviders(
      <LinksList
        {...baseProps}
        loadingLinks={false}
        hasSettledOnce={true}
        links={[makeLink({ id: 'a' })]}
      />,
    );

    const tabpanel = document.getElementById(LINKS_LIST_ID);
    expect(tabpanel?.getAttribute('aria-busy')).toBe('false');
  });

  it('preserves role="tabpanel" and aria-labelledby across every branch', () => {
    // Initial load
    const { rerender } = renderWithProviders(
      <LinksList {...baseProps} loadingLinks={true} hasSettledOnce={false} />,
    );
    let tabpanel = document.getElementById(LINKS_LIST_ID);
    expect(tabpanel?.getAttribute('role')).toBe('tabpanel');
    expect(tabpanel?.getAttribute('aria-labelledby')).toBe('tab-unread');

    // Empty branch
    rerender(
      <ThemeProvider>
        <LinksList
          {...baseProps}
          loadingLinks={false}
          hasSettledOnce={true}
          links={[]}
        />
      </ThemeProvider>,
    );
    tabpanel = document.getElementById(LINKS_LIST_ID);
    expect(tabpanel?.getAttribute('role')).toBe('tabpanel');

    // Populated branch
    rerender(
      <ThemeProvider>
        <LinksList
          {...baseProps}
          loadingLinks={false}
          hasSettledOnce={true}
          links={[makeLink({ id: 'a' })]}
        />
      </ThemeProvider>,
    );
    tabpanel = document.getElementById(LINKS_LIST_ID);
    expect(tabpanel?.getAttribute('role')).toBe('tabpanel');

    // Read filter swaps the aria-labelledby
    rerender(
      <ThemeProvider>
        <LinksList
          {...baseProps}
          filter="read"
          loadingLinks={false}
          hasSettledOnce={true}
          links={[]}
        />
      </ThemeProvider>,
    );
    tabpanel = document.getElementById(LINKS_LIST_ID);
    expect(tabpanel?.getAttribute('aria-labelledby')).toBe('tab-read');
  });
});
