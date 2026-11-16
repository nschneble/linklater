import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import StumblePage from './StumblePage';

vi.mock('../../lib/api', () => ({
  getSuggestions: vi.fn().mockResolvedValue({ suggestions: [] }),
  stumbleLink: vi.fn(),
}));

import * as apiModule from '../../lib/api';

const EMPTY_HEADING = { name: 'Boo. Your reading list is empty.' };
const RETRY_BUTTON = { name: /try another link/i };

let outsideButton: HTMLButtonElement;

async function renderStumblePage() {
  await act(async () => {
    render(
      <MemoryRouter>
        <StumblePage />
      </MemoryRouter>,
    );
  });
}

async function retryAfterError(
  nextResult: () => Promise<{ url: string | null }>,
) {
  vi.mocked(apiModule.stumbleLink)
    .mockRejectedValueOnce(new Error('Server error'))
    .mockImplementationOnce(nextResult);
  await renderStumblePage();

  const retryButton = screen.getByRole('button', RETRY_BUTTON);
  expect(retryButton).toHaveFocus();

  await act(async () => {
    fireEvent.click(retryButton);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  outsideButton = document.createElement('button');
  document.body.append(outsideButton);
  outsideButton.focus();
});

afterEach(() => {
  outsideButton.remove();
});

describe('StumblePage focus on arrival', () => {
  it('leaves focus alone while loading', async () => {
    vi.mocked(apiModule.stumbleLink).mockReturnValue(new Promise(() => {}));
    expect(outsideButton).toHaveFocus();

    await renderStumblePage();

    expect(outsideButton).toHaveFocus();
    expect(screen.getByRole('main').getAttribute('tabindex')).toBeNull();
  });

  it('leaves focus alone on the empty view, inside one main landmark', async () => {
    vi.mocked(apiModule.stumbleLink).mockResolvedValue({ url: null });
    expect(outsideButton).toHaveFocus();

    await renderStumblePage();

    expect(screen.getByRole('heading', EMPTY_HEADING)).toBeInTheDocument();
    expect(outsideButton).toHaveFocus();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });
});

describe('StumblePage focus after a retry', () => {
  it('moves focus to the loading screen', async () => {
    await retryAfterError(() => new Promise(() => {}));

    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('moves focus back to the retry button when it fails again', async () => {
    await retryAfterError(() => Promise.reject(new Error('Server error')));

    expect(screen.getByRole('button', RETRY_BUTTON)).toHaveFocus();
  });

  it('moves focus to the empty view heading', async () => {
    await retryAfterError(() => Promise.resolve({ url: null }));

    expect(screen.getByRole('heading', EMPTY_HEADING)).toHaveFocus();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });
});
