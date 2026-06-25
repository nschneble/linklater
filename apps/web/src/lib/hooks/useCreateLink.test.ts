import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateLink } from './useCreateLink';
import type { Link } from '../api';

vi.mock('../api', () => ({
  createLink: vi.fn(),
}));

vi.mock('./useMetadataPolling', () => ({
  useMetadataPolling: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

function makeLink(overrides: Partial<Link> = {}): Link {
  return {
    id: '1',
    url: 'https://example.com',
    meta: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    readAt: null,
    ...overrides,
  };
}

function makeOptions(overrides: object = {}) {
  return {
    adjustTotal: vi.fn(),
    filter: 'unread' as const,
    links: [],
    onSaved: vi.fn(),
    prependLink: vi.fn(),
    updateLink: vi.fn(),
    ...overrides,
  };
}

describe('useCreateLink', () => {
  it('keeps handleCreated and handleDirectSave stable when only onSaved changes', () => {
    // The paste listener relies on handleDirectSave's identity staying stable.
    // onSaved is a fresh closure each render, so it must not be a dependency.
    // Hold every real dependency fixed and vary only onSaved to isolate it.
    const stable = makeOptions();
    const { result, rerender } = renderHook(
      (onSaved: () => void) => useCreateLink({ ...stable, onSaved }),
      { initialProps: stable.onSaved },
    );

    const firstCreated = result.current.handleCreated;
    const firstDirectSave = result.current.handleDirectSave;

    rerender(vi.fn());

    expect(result.current.handleCreated).toBe(firstCreated);
    expect(result.current.handleDirectSave).toBe(firstDirectSave);
  });

  it('invokes the latest onSaved after a successful create', () => {
    const firstOnSaved = vi.fn();
    const { result, rerender } = renderHook(
      (options: ReturnType<typeof makeOptions>) => useCreateLink(options),
      { initialProps: makeOptions({ onSaved: firstOnSaved }) },
    );

    const secondOnSaved = vi.fn();
    rerender(makeOptions({ onSaved: secondOnSaved }));

    act(() => result.current.handleCreated(makeLink()));

    expect(firstOnSaved).not.toHaveBeenCalled();
    expect(secondOnSaved).toHaveBeenCalledOnce();
  });
});
