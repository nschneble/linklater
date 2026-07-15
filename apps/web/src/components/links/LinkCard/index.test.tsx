/*
 * Tests for LinkCard – a single saved link rendered as an interactive card.
 *
 * Focus of this file: the "Mark unread" button alignment contract. A read
 * link (`readAt` set) shows the button right-aligned regardless of whether the
 * link has a description. The description `<p>` carries `flex-1` and pushes the
 * button right when present; when it is absent the button must still hug the
 * right edge via `ml-auto`.
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

  it('right-aligns the button on a read link that HAS a description', () => {
    // With a description present the `flex-1` sibling consumes the free space;
    // `ml-auto` is inert here but harmless, so both branches stay right-aligned.
    renderWithProviders(<LinkCard link={makeLink()} onReadToggle={vi.fn()} />);

    const description = screen.getByText(/an example description/i);
    expect(description.className).toContain('flex-1');

    const button = screen.getByRole('button', { name: 'Mark unread' });
    expect(button.className).toContain('ml-auto');
  });
});
