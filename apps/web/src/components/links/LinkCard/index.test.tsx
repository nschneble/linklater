/*
 * Tests for LinkCard – a single saved link rendered as an interactive card.
 *
 * Focus of this file: the "Mark unread" button alignment contract. On a read
 * link (`readAt` set) with no description, the `flex-1` sibling that would
 * otherwise push the button right is absent, so the button must carry
 * `ml-auto` to stay pinned to the right edge. That is the bug this guards.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

describe('LinkCard thumbnail placeholder (local inline SVG, no third party)', () => {
  it('renders the remote OpenGraph image when meta.imageUrl is present', () => {
    const { container } = renderWithProviders(
      <LinkCard
        link={makeLink({
          meta: {
            title: 'Example title',
            imageUrl: 'https://cdn.example.com/og.png',
            fetchedAt: new Date().toISOString(),
          },
        })}
        onReadToggle={vi.fn()}
      />,
    );

    const image = container.querySelector(
      'img[src="https://cdn.example.com/og.png"]',
    );
    expect(image).not.toBeNull();
    // With a real image there is no need for the generated placeholder.
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders a locally generated inline-SVG placeholder when there is no imageUrl', () => {
    const { container } = renderWithProviders(
      <LinkCard
        link={makeLink({
          url: 'https://www.example.com/article',
          meta: {
            title: 'Example title',
            fetchedAt: new Date().toISOString(),
          },
        })}
        onReadToggle={vi.fn()}
      />,
    );

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    // Decorative: the anchor carries the accessible name, not this thumbnail.
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    // The hostname (without www.) labels the placeholder.
    expect(svg?.textContent).toContain('example.com');
  });

  it('binds the placeholder fills to the mount-highlight CSS vars so it recolors on theme AND mode without JS', () => {
    const { container } = renderWithProviders(
      <LinkCard
        link={makeLink({
          meta: {
            title: 'Example title',
            fetchedAt: new Date().toISOString(),
          },
        })}
        onReadToggle={vi.fn()}
      />,
    );

    const svg = container.querySelector('svg');
    const fill = svg?.querySelector('rect')?.getAttribute('fill');
    const textFill = svg?.querySelector('text')?.getAttribute('fill');
    expect(fill).toBe('var(--mount-highlight)');
    expect(textFill).toBe('var(--mount-highlight-fg)');
  });

  it('never references the third-party placeholder host in the rendered card', () => {
    // Host built from parts so this guard does not itself reintroduce the
    // literal into source (the placeholder is fully local now).
    const thirdPartyHost = ['placehold', 'co'].join('.');
    const { container } = renderWithProviders(
      <LinkCard
        link={makeLink({
          meta: {
            title: 'Example title',
            fetchedAt: new Date().toISOString(),
          },
        })}
        onReadToggle={vi.fn()}
      />,
    );

    expect(container.innerHTML).not.toContain(thirdPartyHost);
  });
});

describe('LinkCard thumbnail skeleton (metadata still loading)', () => {
  it('renders the decorative skeleton block while metadata has not been fetched', () => {
    const { container } = renderWithProviders(
      <LinkCard link={makeLink({ meta: null })} onReadToggle={vi.fn()} />,
    );

    const skeleton = container.querySelector(
      'div.bg-\\[var\\(--orbit-bg\\)\\]',
    );
    expect(skeleton).not.toBeNull();
    expect(skeleton?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('LinkCard unsafe-URL guard (CWE-79)', () => {
  it('renders a real, safe anchor for a normal http(s) link', () => {
    renderWithProviders(
      <LinkCard
        link={makeLink({ url: 'https://example.com/article' })}
        onReadToggle={vi.fn()}
      />,
    );

    const anchor = screen.getByRole('link', { name: /opens in new tab/ });
    expect(anchor).toHaveAttribute('href', 'https://example.com/article');
    expect(anchor).toHaveAttribute('target', '_blank');
    expect(anchor).toHaveAttribute('rel', 'noreferrer');
    expect(anchor).not.toHaveAttribute('aria-disabled');
  });

  it('never puts a legacy non-http(s) URL in href, and marks the anchor aria-disabled', () => {
    renderWithProviders(
      <LinkCard
        link={makeLink({ url: 'javascript:alert(document.cookie)' })}
        onReadToggle={vi.fn()}
      />,
    );

    const anchor = screen.getByRole('link', { name: /link unavailable/ });
    expect(anchor).toHaveAttribute('href', '#');
    expect(anchor.getAttribute('href')).not.toContain('javascript:');
    expect(anchor).toHaveAttribute('aria-disabled', 'true');
    expect(anchor).not.toHaveAttribute('target');
    expect(anchor).not.toHaveAttribute('rel');
  });

  it('shows a visible explanation and does not mark the link read when the URL is unsafe', () => {
    const onReadToggle = vi.fn();
    renderWithProviders(
      <LinkCard
        link={makeLink({
          url: 'javascript:alert(1)',
          readAt: null,
          meta: { title: 'Example title', fetchedAt: new Date().toISOString() },
        })}
        onReadToggle={onReadToggle}
      />,
    );

    expect(
      screen.getByText(
        "This link can't be opened – the saved address isn't safe to open.",
      ),
    ).toBeInTheDocument();

    const anchor = screen.getByRole('link', { name: /link unavailable/ });
    fireEvent.click(anchor);

    expect(onReadToggle).not.toHaveBeenCalled();
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

    const button = screen.getByRole('button', { name: /^Mark unread/ });
    expect(button.className).toContain('ml-auto');
  });
});

describe('LinkCard "Mark unread" accessible name (WCAG 2.5.3 Label in Name)', () => {
  it('keeps "Mark unread" as the leading substring so it matches the visible label', () => {
    renderWithProviders(<LinkCard link={makeLink()} onReadToggle={vi.fn()} />);

    const button = screen.getByRole('button', { name: /^Mark unread/ });
    // Visible text on desktop is "Mark unread"; SC 2.5.3 requires the visible
    // label to be a leading substring of the accessible name.
    expect(button.getAttribute('aria-label')).toMatch(/^Mark unread/);
  });

  it('gives two different links two distinct accessible names', () => {
    const { unmount } = renderWithProviders(
      <LinkCard
        link={makeLink({
          url: 'https://example.com',
          meta: {
            title: 'First article',
            description: null,
            fetchedAt: new Date().toISOString(),
          },
        })}
        onReadToggle={vi.fn()}
      />,
    );

    const firstLabel = screen
      .getByRole('button', { name: /^Mark unread/ })
      .getAttribute('aria-label');
    expect(firstLabel).toContain('First article');
    expect(firstLabel).toContain('example.com');

    unmount();

    renderWithProviders(
      <LinkCard
        link={makeLink({
          url: 'https://different.org',
          meta: {
            title: 'Second article',
            description: null,
            fetchedAt: new Date().toISOString(),
          },
        })}
        onReadToggle={vi.fn()}
      />,
    );

    const secondLabel = screen
      .getByRole('button', { name: /^Mark unread/ })
      .getAttribute('aria-label');
    expect(secondLabel).toContain('Second article');
    expect(secondLabel).toContain('different.org');
    expect(secondLabel).not.toBe(firstLabel);
  });

  it('falls back to both the "(No title)" placeholder and the site name so shared-fallback links still differ', () => {
    renderWithProviders(
      <LinkCard
        link={makeLink({
          url: 'https://news.example.org/story',
          meta: {
            title: undefined,
            description: null,
            fetchedAt: new Date().toISOString(),
          },
        })}
        onReadToggle={vi.fn()}
      />,
    );

    const label = screen
      .getByRole('button', { name: /^Mark unread/ })
      .getAttribute('aria-label');
    // Title is unknown, but the site name still disambiguates from another
    // "(No title)" link on a different host.
    expect(label).toContain('(No title)');
    expect(label).toContain('news.example.org');
  });
});
