import { MemoryRouter } from 'react-router-dom';
import StumbleEmptyView from './StumbleEmptyView';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as api from '../../lib/api';

vi.mock('../../theme/ThemeContext', () => ({
  useTheme: () => ({ baseTheme: 'scanner-darkly' }),
  useThemeStyling: () => ({ baseTheme: 'scanner-darkly', mode: 'dark' }),
}));

vi.mock('../../lib/api', () => ({
  getSuggestions: vi.fn(),
  createLink: vi.fn(),
}));

function makeSuggestion(
  overrides: Partial<api.Suggestion> = {},
): api.Suggestion {
  return {
    url: 'https://example.com/article',
    title: 'Interesting Topic',
    description: 'A fascinating subject.',
    imageUrl: null,
    siteName: 'Aeon',
    ...overrides,
  };
}

function renderView() {
  return render(
    <MemoryRouter>
      <StumbleEmptyView />
    </MemoryRouter>,
  );
}

describe('StumbleEmptyView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the ghost illustration, headline, and back button', () => {
    vi.mocked(api.getSuggestions).mockImplementation(
      () => new Promise(() => {}),
    );
    renderView();

    expect(screen.getByRole('img', { name: /ghost/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /your reading list is empty/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /back to linklater/i }),
    ).toBeInTheDocument();
  });

  it('renders the suggestion callout with the picked source name', async () => {
    vi.mocked(api.getSuggestions).mockResolvedValue({
      sourceName: 'Atlas Obscura',
      suggestions: [makeSuggestion({ title: 'Hidden hot springs' })],
    });

    renderView();

    await waitFor(() => {
      expect(
        screen.getByText('How about something from Atlas Obscura?'),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('Hidden hot springs')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add and read/i }),
    ).toBeInTheDocument();
  });

  it('renders the napping fallback when the suggestions endpoint returns an empty list', async () => {
    vi.mocked(api.getSuggestions).mockResolvedValue({
      sourceName: 'Aeon',
      suggestions: [],
    });

    renderView();

    await waitFor(() => {
      expect(screen.getByText(/suggestions are napping/i)).toBeInTheDocument();
    });
  });

  it('renders the napping fallback when the suggestions endpoint fails', async () => {
    vi.mocked(api.getSuggestions).mockRejectedValue(new Error('503'));

    renderView();

    await waitFor(() => {
      expect(screen.getByText(/suggestions are napping/i)).toBeInTheDocument();
    });
  });

  it('only requests a single suggestion (not three)', () => {
    vi.mocked(api.getSuggestions).mockImplementation(
      () => new Promise(() => {}),
    );

    renderView();

    expect(api.getSuggestions).toHaveBeenCalledWith(1);
  });
});
