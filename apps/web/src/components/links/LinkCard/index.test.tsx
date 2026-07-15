/*
 * Tests for LinkCard – a single saved link rendered as an interactive card.
 *
 * Focus of this file: the "Mark unread" button alignment contract. On a read
 * link (`readAt` set) with no description, the `flex-1` sibling that would
 * otherwise push the button right is absent, so the button must carry
 * `ml-auto` to stay pinned to the right edge. That is the bug this guards.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LinkCard from './index';
import { ThemeProvider } from '../../../theme/ThemeContext';
import type { Link } from '../../../lib/api';
import type { ReactElement } from 'react';

function renderWithProviders(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

function makeLink(overrides: Partial<Link> = {}): Link {
  return {
    id: 'link-1',
    url: 'https://example.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    readAt: new Date().toISOString(),
    meta: {
      title: 'Example title',
      description: 'An example description that fills the row.',
      fetchedAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe('LinkCard mobile-overflow containment (WCAG 1.4.10 Reflow)', () => {
  // The 320px reflow guard lives on the GRID ITEM, not the card: LinksList adds
  // `min-w-0` to each map wrapper, which resets the grid track's default
  // `min-width: auto` to 0 so a long unbreakable title/URL cannot inflate it
  // past the viewport. That guard is asserted in LinksList.test.tsx. The card
  // wrapper itself must stay `overflow-visible` so its favicon badge (and the
  // un-fetched accent bar) can straddle the left accent border; clipping it
  // (`overflow-hidden`) sliced those decorations off, which is the regression
  // these tests guard against. A true scrollWidth check needs a real layout
  // engine (jsdom has none), so the live 320px measurement lives in the PR
  // notes; this asserts the non-clipping class contract as the jsdom-safe oracle.
  it('keeps the card wrapper overflow-visible on a fetched link (favicon can straddle)', () => {
    const { container } = renderWithProviders(
      <LinkCard link={makeLink()} onReadToggle={vi.fn()} />,
    );

    const card = container.firstElementChild;
    expect(card?.className).toContain('overflow-visible');
    expect(card?.className).not.toContain('overflow-hidden');
  });

  it('keeps the card wrapper overflow-visible while metadata is still loading (skeleton accent bar can straddle)', () => {
    const { container } = renderWithProviders(
      <LinkCard link={makeLink({ meta: null })} onReadToggle={vi.fn()} />,
    );

    const card = container.firstElementChild;
    expect(card?.className).toContain('overflow-visible');
    expect(card?.className).not.toContain('overflow-hidden');
  });
});

describe('LinkCard "Mark unread" alignment', () => {
  it('right-aligns the button on a read link that has NO description', () => {
    // A title with a null description yields a falsy displayDescription, so the
    // `flex-1` sibling is not rendered. The button must carry `ml-auto` to stay
    // pinned to the right edge instead of collapsing left.
    renderWithProviders(
      <LinkCard
        link={makeLink({
          meta: {
            title: 'Example title',
            description: null,
            fetchedAt: new Date().toISOString(),
          },
        })}
        onReadToggle={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: 'Mark unread' });
    expect(button.className).toContain('ml-auto');
  });
});
