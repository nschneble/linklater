/**
 * Tests for usePendingSaveDrain, the hook that resumes a logged-out save once
 * the user is authenticated (the cold magic-link / OAuth landing).
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../api', () => ({
  createLink: vi.fn(),
}));

vi.mock('../pendingSave', () => ({
  takePendingSave: vi.fn(),
}));

let mockUser: unknown = null;
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { createLink } from '../api';
import { takePendingSave } from '../pendingSave';
import { usePendingSaveDrain } from './usePendingSaveDrain';

const SUCCESS_MESSAGE = "Saved. It's in your reading list.";

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { userId: 'user-1' };
  vi.mocked(createLink).mockResolvedValue({
    id: 'link-1',
    url: 'https://example.com/article',
    createdAt: '',
    updatedAt: '',
    status: 'created',
  });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('with a fresh pending entry and an authenticated user', () => {
  it('saves the stashed url exactly once and shows a success toast', async () => {
    vi.mocked(takePendingSave).mockReturnValue('https://example.com/article');

    const { result } = renderHook(() => usePendingSaveDrain());

    await waitFor(() => {
      expect(createLink).toHaveBeenCalledWith({
        url: 'https://example.com/article',
      });
    });
    expect(createLink).toHaveBeenCalledTimes(1);
    expect(takePendingSave).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(result.current.toastMessage).toBe(SUCCESS_MESSAGE);
    });
  });
});

describe('with no pending entry', () => {
  it('never calls createLink and shows no toast', async () => {
    vi.mocked(takePendingSave).mockReturnValue(null);

    const { result } = renderHook(() => usePendingSaveDrain());

    await waitFor(() => {
      expect(takePendingSave).toHaveBeenCalledTimes(1);
    });
    expect(createLink).not.toHaveBeenCalled();
    expect(result.current.toastMessage).toBeNull();
  });
});

describe('when the user is not authenticated', () => {
  it('never reads or drains a pending entry', async () => {
    mockUser = null;
    vi.mocked(takePendingSave).mockReturnValue('https://example.com/article');

    renderHook(() => usePendingSaveDrain());

    await Promise.resolve();
    expect(takePendingSave).not.toHaveBeenCalled();
    expect(createLink).not.toHaveBeenCalled();
  });
});

describe('when auth re-emits a fresh user object', () => {
  it('does not re-drain on rerender', async () => {
    vi.mocked(takePendingSave).mockReturnValue('https://example.com/article');

    const { rerender } = renderHook(() => usePendingSaveDrain());

    await waitFor(() => {
      expect(createLink).toHaveBeenCalledTimes(1);
    });

    // The visibility refresh mints a brand new user object with the same id.
    mockUser = { userId: 'user-1' };
    rerender();
    rerender();

    expect(createLink).toHaveBeenCalledTimes(1);
    expect(takePendingSave).toHaveBeenCalledTimes(1);
  });
});

describe('when the resume save fails', () => {
  it('fails quietly without throwing or showing a toast', async () => {
    vi.mocked(takePendingSave).mockReturnValue('https://example.com/article');
    vi.mocked(createLink).mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => usePendingSaveDrain());

    await waitFor(() => {
      expect(createLink).toHaveBeenCalledTimes(1);
    });
    // Let the rejection settle; the hook must swallow it.
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.toastMessage).toBeNull();
  });
});
