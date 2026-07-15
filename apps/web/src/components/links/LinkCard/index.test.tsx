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
  // The card is a grid item in LinksList's `grid grid-cols-1`. A grid item's
  // default `min-width: auto` lets a long unbreakable title/URL inflate the
  // track past the viewport, producing horizontal scroll on mobile. Clipping
  // the card wrapper (`overflow-hidden`) resets that automatic minimum to 0 so
  // the card can never grow wider than its track, and also contains the
  // decorative favicon/skeleton bleed. This guards against a regression back to
  // `overflow-visible`. A true scrollWidth check needs a real layout engine
  // (jsdom has none), so this asserts the clipping class as the jsdom-safe
  // structural oracle; the live 320px measurement lives in the PR notes.
  it('clips the card wrapper on a fetched link', () => {
    const { container } = renderWithProviders(
      <LinkCard link={makeLink()} onReadToggle={vi.fn()} />,
    );

    const card = container.firstElementChild;
    expect(card?.className).toContain('overflow-hidden');
    expect(card?.className).not.toContain('overflow-visible');
  });

  it('clips the card wrapper while metadata is still loading (skeleton state)', () => {
    const { container } = renderWithProviders(
      <LinkCard link={makeLink({ meta: null })} onReadToggle={vi.fn()} />,
    );

    const card = container.firstElementChild;
    expect(card?.className).toContain('overflow-hidden');
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
