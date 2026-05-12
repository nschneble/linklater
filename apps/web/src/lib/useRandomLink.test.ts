import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRandomLink } from './useRandomLink';
import type { Link } from './api';

vi.mock('./api', () => ({
  readLink: vi.fn(),
  getRandomLink: vi.fn(),
}));

import * as apiModule from './api';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

function makeLink(overrides: Partial<Link> = {}): Link {
  return {
    id: 'link-1',
    url: 'https://example.com',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    readAt: null,
    ...overrides,
  };
}

const defaultOptions = {
  onDecrementTotal: vi.fn(),
  onRemoveLink: vi.fn(),
};

describe('useRandomLink', () => {
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn());
  });

  it('has randomLoading false and randomError null initially', () => {
    const { result } = renderHook(() => useRandomLink(defaultOptions));
    expect(result.current.randomLoading).toBe(false);
    expect(result.current.randomError).toBeNull();
  });

  it('opens the link in a new tab, marks it as read, and removes it from the list', async () => {
    const link = makeLink();
    vi.mocked(apiModule.getRandomLink).mockResolvedValue({ link });
    vi.mocked(apiModule.readLink).mockResolvedValue({
      ...link,
      readAt: new Date().toISOString(),
    });

    const onRemoveLink = vi.fn();
    const onDecrementTotal = vi.fn();

    const { result } = renderHook(() =>
      useRandomLink({ onDecrementTotal, onRemoveLink }),
    );

    await act(() => result.current.handleRandom());

    expect(window.open).toHaveBeenCalledWith(
      link.url,
      '_blank',
      'noopener,noreferrer',
    );
    expect(apiModule.readLink).toHaveBeenCalledWith(link.id);
    expect(onRemoveLink).toHaveBeenCalledWith(link.id);
    expect(onDecrementTotal).toHaveBeenCalledOnce();
  });

  it('calls onNoLinks when no link is returned and does not set randomError', async () => {
    vi.mocked(apiModule.getRandomLink).mockResolvedValue({ link: null });

    const onNoLinks = vi.fn();
    const { result } = renderHook(() =>
      useRandomLink({ ...defaultOptions, onNoLinks }),
    );

    await act(() => result.current.handleRandom());

    expect(onNoLinks).toHaveBeenCalledOnce();
    expect(result.current.randomError).toBeNull();
  });

  it('sets randomError when the API call fails', async () => {
    vi.mocked(apiModule.getRandomLink).mockRejectedValue(
      new Error('network error'),
    );

    const { result } = renderHook(() => useRandomLink(defaultOptions));

    await act(() => result.current.handleRandom());

    expect(result.current.randomError).toBe('Failed to get a random link');
  });

  it('sets randomLoading to true during the call and false after', async () => {
    let resolveGetRandom!: (value: { link: Link }) => void;
    vi.mocked(apiModule.getRandomLink).mockReturnValue(
      new Promise((resolve) => {
        resolveGetRandom = resolve;
      }),
    );
    vi.mocked(apiModule.readLink).mockResolvedValue(makeLink());

    const { result } = renderHook(() => useRandomLink(defaultOptions));

    act(() => {
      result.current.handleRandom();
    });

    expect(result.current.randomLoading).toBe(true);

    await act(async () => {
      resolveGetRandom({ link: makeLink() });
    });

    expect(result.current.randomLoading).toBe(false);
  });
});
