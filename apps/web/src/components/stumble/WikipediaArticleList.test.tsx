import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WikipediaArticleList from './WikipediaArticleList';
import type { WikipediaArticle } from '../../lib/wikipedia';

vi.mock('../../theme/ThemeContext', () => ({
  useTheme: () => ({ baseTheme: 'scanner-darkly' }),
}));

const ARTICLES: WikipediaArticle[] = [
  {
    title: 'First Article',
    extract: 'First extract.',
    url: 'https://en.wikipedia.org/wiki/First',
  },
  {
    title: 'Second Article',
    extract: 'Second extract.',
    url: 'https://en.wikipedia.org/wiki/Second',
  },
];

describe('WikipediaArticleList', () => {
  it('renders the accessible list wrapper', () => {
    render(<WikipediaArticleList loading={false} articles={[]} />);

    expect(
      screen.getByRole('list', { name: /suggested reading from wikipedia/i }),
    ).toBeInTheDocument();
  });

  it('shows three skeletons while loading', () => {
    const { container } = render(
      <WikipediaArticleList loading={true} articles={[]} />,
    );

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(3);
  });

  it('renders article cards when not loading', () => {
    render(<WikipediaArticleList loading={false} articles={ARTICLES} />);

    expect(screen.getByText('First Article')).toBeInTheDocument();
    expect(screen.getByText('Second Article')).toBeInTheDocument();
  });

  it('shows the fallback message when articles are empty and not loading', () => {
    render(<WikipediaArticleList loading={false} articles={[]} />);

    expect(
      screen.getByText(/wikipedia seems to be napping/i),
    ).toBeInTheDocument();
  });

  it('does not show the fallback while still loading', () => {
    render(<WikipediaArticleList loading={true} articles={[]} />);

    expect(
      screen.queryByText(/wikipedia seems to be napping/i),
    ).not.toBeInTheDocument();
  });
});
