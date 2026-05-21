import { render, screen } from '@testing-library/react';
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
  it('renders with role="link"', () => {
    render(
      <LinkCardLayout
        link={makeLink()}
        onCardClick={vi.fn()}
        onUnreadClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('has aria-busy="false" when metadata has been fetched', () => {
    render(
      <LinkCardLayout
        link={makeLink()}
        onCardClick={vi.fn()}
        onUnreadClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('link')).toHaveAttribute('aria-busy', 'false');
  });

  it('has aria-busy="true" when metadata has not yet been fetched', () => {
    render(
      <LinkCardLayout
        link={makeLinkWithoutMeta()}
        onCardClick={vi.fn()}
        onUnreadClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('link')).toHaveAttribute('aria-busy', 'true');
  });

  it('applies dashed border class when loading (no fetchedAt)', () => {
    render(
      <LinkCardLayout
        link={makeLinkWithoutMeta()}
        onCardClick={vi.fn()}
        onUnreadClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('link')).toHaveClass('border-dashed');
  });

  it('does not apply dashed border when metadata is loaded', () => {
    render(
      <LinkCardLayout
        link={makeLink()}
        onCardClick={vi.fn()}
        onUnreadClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('link')).not.toHaveClass('border-dashed');
  });
});
