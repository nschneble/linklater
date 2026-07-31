/*
 * Tests for SuggestionCallout - discovery callout under the unread empty
 * state and on the Stumble empty page.
 *
 * Covers the WCAG-2.4.3-safe post-Add-and-Read refetch path:
 *   - inNewTab=true success path triggers a second `getSuggestions` call
 *     so the just-read article isn't recommended back next time.
 *   - Refetch failure leaves the prior suggestion mounted (focus on the
 *     "Add and read" button must not be lost - flipping fetchFailed would
 *     unmount the populated card and send focus to <body>).
 */

import SuggestionCallout from './SuggestionCallout';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../lib/api', () => ({
  getSuggestions: vi.fn(),
  createLink: vi.fn(),
  readLink: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import * as apiModule from '../../lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSuggestion(
  overrides: Partial<{ url: string; title: string }> = {},
) {
  return {
    url: 'https://example.com/first-article',
    title: 'First Suggestion',
    description: 'First description.',
    imageUrl: null,
    siteName: null,
    ...overrides,
  };
}

function makeLink(overrides: Partial<{ id: string; url: string }> = {}) {
  return {
    id: 'link-1',
    url: 'https://example.com/first-article',
    createdAt: '2026-06-12T00:00:00Z',
    updatedAt: '2026-06-12T00:00:00Z',
    readAt: '2026-06-12T00:00:00Z',
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // window.open noop spy so click handlers don't error in jsdom
  vi.spyOn(window, 'open').mockReturnValue(null);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SuggestionCallout inNewTab refetch after Add-and-Read', () => {
  it('refetches a fresh suggestion after a successful Add-and-Read in inNewTab mode', async () => {
    vi.mocked(apiModule.getSuggestions)
      .mockResolvedValueOnce({
        sourceName: 'Wikipedia',
        suggestions: [makeSuggestion({ title: 'First Suggestion' })],
      })
      .mockResolvedValueOnce({
        sourceName: 'Aeon',
        suggestions: [
          makeSuggestion({
            url: 'https://example.com/second-article',
            title: 'Second Suggestion',
          }),
        ],
      });
    vi.mocked(apiModule.createLink).mockResolvedValue(makeLink());
    vi.mocked(apiModule.readLink).mockResolvedValue(makeLink());

    await act(async () => {
      render(<SuggestionCallout inNewTab={true} />);
    });

    // initial fetch resolved
    expect(await screen.findByText('First Suggestion')).toBeInTheDocument();
    expect(apiModule.getSuggestions).toHaveBeenCalledTimes(1);

    // click "Add and read"
    const button = screen.getByRole('button', {
      name: /add and read \(opens in new tab\)/i,
    });
    await act(async () => {
      button.click();
    });

    // after create+read settle, refetch fires and swaps the card text
    await waitFor(() => {
      expect(apiModule.getSuggestions).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('Second Suggestion')).toBeInTheDocument();
    // prior suggestion is gone (swapped in place - same DOM node, new text)
    expect(screen.queryByText('First Suggestion')).not.toBeInTheDocument();
  });

  it('leaves the prior suggestion mounted when the refetch returns an empty result', async () => {
    vi.mocked(apiModule.getSuggestions)
      .mockResolvedValueOnce({
        sourceName: 'Wikipedia',
        suggestions: [makeSuggestion({ title: 'First Suggestion' })],
      })
      .mockResolvedValueOnce({
        sourceName: 'Aeon',
        suggestions: [],
      });
    vi.mocked(apiModule.createLink).mockResolvedValue(makeLink());
    vi.mocked(apiModule.readLink).mockResolvedValue(makeLink());

    await act(async () => {
      render(<SuggestionCallout inNewTab={true} />);
    });

    expect(await screen.findByText('First Suggestion')).toBeInTheDocument();

    const button = screen.getByRole('button', {
      name: /add and read \(opens in new tab\)/i,
    });
    await act(async () => {
      button.click();
    });

    await waitFor(() => {
      expect(apiModule.getSuggestions).toHaveBeenCalledTimes(2);
    });

    // empty refetch keeps the card mounted so focus survives (WCAG 2.4.3)
    expect(screen.getByText('First Suggestion')).toBeInTheDocument();
    // "Add and read" button is still present (anchor of focus).
    expect(
      screen.getByRole('button', {
        name: /add and read \(opens in new tab\)/i,
      }),
    ).toBeInTheDocument();
  });

  it('leaves the prior suggestion mounted when the refetch fails', async () => {
    // the refetch rejects on purpose; keep its warn branch out of the log
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(apiModule.getSuggestions)
      .mockResolvedValueOnce({
        sourceName: 'Wikipedia',
        suggestions: [makeSuggestion({ title: 'First Suggestion' })],
      })
      .mockRejectedValueOnce(new Error('Refetch failed'));
    vi.mocked(apiModule.createLink).mockResolvedValue(makeLink());
    vi.mocked(apiModule.readLink).mockResolvedValue(makeLink());

    await act(async () => {
      render(<SuggestionCallout inNewTab={true} />);
    });

    expect(await screen.findByText('First Suggestion')).toBeInTheDocument();

    const button = screen.getByRole('button', {
      name: /add and read \(opens in new tab\)/i,
    });
    await act(async () => {
      button.click();
    });

    await waitFor(() => {
      expect(apiModule.getSuggestions).toHaveBeenCalledTimes(2);
    });

    // populated card stays rendered to preserve focus on "Add and read"
    expect(screen.getByText('First Suggestion')).toBeInTheDocument();
    // no fetch-failed UI - showing it would imply the card unmounted
    expect(
      screen.queryByText(/couldn't load suggestions right now/i),
    ).not.toBeInTheDocument();
    // the "Add and read" button is still present (anchor of focus)
    expect(
      screen.getByRole('button', {
        name: /add and read \(opens in new tab\)/i,
      }),
    ).toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does NOT refetch in same-tab mode (inNewTab=false)', async () => {
    // window.location.assign is sealed in jsdom; spy so nav doesn't throw
    const assignMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...window.location, assign: assignMock },
    });

    vi.mocked(apiModule.getSuggestions).mockResolvedValue({
      sourceName: 'Wikipedia',
      suggestions: [makeSuggestion({ title: 'First Suggestion' })],
    });
    vi.mocked(apiModule.createLink).mockResolvedValue(makeLink());
    vi.mocked(apiModule.readLink).mockResolvedValue(makeLink());

    await act(async () => {
      render(<SuggestionCallout inNewTab={false} />);
    });

    expect(await screen.findByText('First Suggestion')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: /^add and read$/i });
    await act(async () => {
      button.click();
    });

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith(
        'https://example.com/first-article',
      );
    });

    // same-tab mode unloads the page, so only the mount-time fetch fires
    expect(apiModule.getSuggestions).toHaveBeenCalledTimes(1);
  });
});
