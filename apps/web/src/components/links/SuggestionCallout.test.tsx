/*
 * Tests for SuggestionCallout — discovery callout under the unread empty
 * state and on the Stumble empty page.
 *
 * Covers the WCAG-2.4.3-safe post-Add-and-Read refetch path:
 *   - inNewTab=true success path triggers a second `getSuggestions` call
 *     so the just-read article isn't recommended back next time.
 *   - Refetch failure leaves the prior suggestion mounted (focus on the
 *     "Add and read" button must not be lost — flipping fetchFailed would
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
  // Default: window.open is a noop spy so click handlers don't error in
  // jsdom (jsdom's window.open returns null and logs a noisy warning).
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

    // Initial fetch resolved
    expect(await screen.findByText('First Suggestion')).toBeInTheDocument();
    expect(apiModule.getSuggestions).toHaveBeenCalledTimes(1);

    // Click "Add and read"
    const button = screen.getByRole('button', {
      name: /add and read \(opens in new tab\)/i,
    });
    await act(async () => {
      button.click();
    });

    // After create+read settle, refetch fires and swaps the card text
    await waitFor(() => {
      expect(apiModule.getSuggestions).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('Second Suggestion')).toBeInTheDocument();
    // Prior suggestion is gone (swapped in place — same DOM node, new text)
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

    // Prior suggestion is still mounted. An empty refetch result must NOT
    // unmount the populated card — doing so would drop focus from the
    // "Add and read" button to <body> (WCAG 2.4.3).
    expect(screen.getByText('First Suggestion')).toBeInTheDocument();
    // "Add and read" button is still present (anchor of focus).
    expect(
      screen.getByRole('button', {
        name: /add and read \(opens in new tab\)/i,
      }),
    ).toBeInTheDocument();
  });

  it('leaves the prior suggestion mounted when the refetch fails', async () => {
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

    // Prior suggestion is still mounted. The populated card branch must
    // stay rendered to preserve focus on the "Add and read" button.
    expect(screen.getByText('First Suggestion')).toBeInTheDocument();
    // No transition to fetch-failed UI — that message would imply the card
    // got unmounted (it's gated on !loading && !fetchFailed && suggestion).
    expect(
      screen.queryByText(/couldn't load suggestions right now/i),
    ).not.toBeInTheDocument();
    // The "Add and read" button is still present (anchor of focus).
    expect(
      screen.getByRole('button', {
        name: /add and read \(opens in new tab\)/i,
      }),
    ).toBeInTheDocument();
  });

  it('does NOT refetch in same-tab mode (inNewTab=false)', async () => {
    // jsdom's window.location.assign is sealed — replace with a spy so the
    // same-tab nav path doesn't throw.
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

    // Same-tab mode: page is about to unload, no point refetching. Only
    // the mount-time fetch should fire.
    expect(apiModule.getSuggestions).toHaveBeenCalledTimes(1);
  });
});
