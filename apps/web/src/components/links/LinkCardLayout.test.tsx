import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LinkCardLayout from './LinkCardLayout';
import type { Link } from '../../lib/api';

vi.mock('../../theme/ThemeContext', () => ({
  useTheme: () => ({ baseTheme: 'scanner-darkly' }),
}));

const makeLink = (overrides: Partial<Link> = {}): Link => ({
  createdAt: '2026-01-01T00:00:00.000Z',
  id: 'link-1',
  updatedAt: '2026-01-01T00:00:00.000Z',
  url: 'https://example.com/article',
  readAt: null,
  meta: {
    fetchedAt: '2026-01-01T00:01:00.000Z',
    title: 'Example Article',
    faviconUrl: null,
    description: null,
    imageUrl: null,
    siteName: null,
  },
  ...overrides,
});

const makeLinkWithoutMeta = (overrides: Partial<Link> = {}): Link => ({
  createdAt: '2026-01-01T00:00:00.000Z',
  id: 'link-1',
  updatedAt: '2026-01-01T00:00:00.000Z',
  url: 'https://example.com/article',
  readAt: null,
  meta: null,
  ...overrides,
});

describe('LinkCardLayout', () => {
  it('renders the card as a native anchor pointing at the link URL', () => {
    render(
      <LinkCardLayout
        link={makeLink()}
        onCardActivate={vi.fn()}
        onUnreadClick={vi.fn()}
      />,
    );
    const anchor = screen.getByRole('link');
    expect(anchor.tagName).toBe('A');
    expect(anchor).toHaveAttribute('href', 'https://example.com/article');
    expect(anchor).toHaveAttribute('target', '_blank');
    expect(anchor).toHaveAttribute('rel', 'noreferrer');
  });

  it('exposes the title and "opens in new tab" hint through the anchor aria-label', () => {
    render(
      <LinkCardLayout
        link={makeLink()}
        onCardActivate={vi.fn()}
        onUnreadClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('link')).toHaveAccessibleName(
      /Example Article.*opens in new tab/i,
    );
  });

  it('has aria-busy="false" on the anchor when metadata has been fetched', () => {
    render(
      <LinkCardLayout
        link={makeLink()}
        onCardActivate={vi.fn()}
        onUnreadClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('link')).toHaveAttribute('aria-busy', 'false');
  });

  it('has aria-busy="true" on the anchor when metadata has not yet been fetched', () => {
    render(
      <LinkCardLayout
        link={makeLinkWithoutMeta()}
        onCardActivate={vi.fn()}
        onUnreadClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('link')).toHaveAttribute('aria-busy', 'true');
  });

  it('applies dashed border class to the wrapper when loading (no fetchedAt)', () => {
    const { container } = render(
      <LinkCardLayout
        link={makeLinkWithoutMeta()}
        onCardActivate={vi.fn()}
        onUnreadClick={vi.fn()}
      />,
    );
    expect(container.firstChild).toHaveClass('border-dashed');
  });

  it('does not apply dashed border to the wrapper when metadata is loaded', () => {
    const { container } = render(
      <LinkCardLayout
        link={makeLink()}
        onCardActivate={vi.fn()}
        onUnreadClick={vi.fn()}
      />,
    );
    expect(container.firstChild).not.toHaveClass('border-dashed');
  });

  it('calls onCardActivate when the anchor is clicked', () => {
    const onCardActivate = vi.fn();
    render(
      <LinkCardLayout
        link={makeLink()}
        onCardActivate={onCardActivate}
        onUnreadClick={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('link'));
    expect(onCardActivate).toHaveBeenCalledTimes(1);
  });

  it('renders Mark unread button as a sibling so its click does not reach the anchor', () => {
    const onCardActivate = vi.fn();
    const onUnreadClick = vi.fn();
    render(
      <LinkCardLayout
        link={makeLink({ readAt: '2026-01-02T00:00:00.000Z' })}
        onCardActivate={onCardActivate}
        onUnreadClick={onUnreadClick}
      />,
    );
    // "Mark unread" is in a sibling container, NOT inside the anchor — clicking
    // it must not trigger anchor activation.
    const button = screen.getByRole('button', { name: /mark unread/i });
    const anchor = screen.getByRole('link');
    expect(anchor.contains(button)).toBe(false);

    fireEvent.click(button);
    expect(onUnreadClick).toHaveBeenCalledTimes(1);
    expect(onCardActivate).not.toHaveBeenCalled();
  });
});
