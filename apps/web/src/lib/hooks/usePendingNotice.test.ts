import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../pendingNotice', () => ({
  consumePendingNotice: vi.fn().mockReturnValue(null),
}));

import * as pendingNoticeModule from '../pendingNotice';
import { usePendingNotice } from './usePendingNotice';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePendingNotice', () => {
  it('populates notice + variant after effects flush when consumePendingNotice returns a success entry', async () => {
    vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue({
      message: 'Your account has been deleted.',
      variant: 'success',
    });
    const { result } = renderHook(() => usePendingNotice());
    await waitFor(() => {
      expect(result.current.notice).toBe('Your account has been deleted.');
      expect(result.current.variant).toBe('success');
    });
  });

  it('populates notice + variant after effects flush when consumePendingNotice returns an error entry', async () => {
    vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue({
      message: 'Verification link expired. Sign in and request a new one.',
      variant: 'error',
    });
    const { result } = renderHook(() => usePendingNotice());
    await waitFor(() => {
      expect(result.current.notice).toBe(
        'Verification link expired. Sign in and request a new one.',
      );
      expect(result.current.variant).toBe('error');
    });
  });

  it('stays null after effects flush when consumePendingNotice returns null', async () => {
    vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue(null);
    const { result } = renderHook(() => usePendingNotice());
    await act(async () => {});
    expect(result.current.notice).toBeNull();
    // while notice is null `'success'` is inert: default sr-only shape
    expect(result.current.variant).toBe('success');
  });

  it('carries the standing flag through to the surfacing UI', async () => {
    vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue({
      message: "We couldn't get you back into that session",
      variant: 'warning',
      standing: true,
    });
    const { result } = renderHook(() => usePendingNotice());
    await waitFor(() => {
      expect(result.current.standing).toBe(true);
    });
  });

  it('reads an entry that omits the flag as not standing', async () => {
    vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue({
      message: 'Your account has been deleted.',
      variant: 'success',
    });
    const { result } = renderHook(() => usePendingNotice());
    await waitFor(() => {
      expect(result.current.notice).not.toBeNull();
    });
    expect(result.current.standing).toBe(false);
  });

  it('calls consumePendingNotice exactly once across re-renders', async () => {
    vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue({
      message: 'Your account has been deleted.',
      variant: 'success',
    });
    const { rerender } = renderHook(() => usePendingNotice());
    await act(async () => {});
    rerender();
    rerender();
    expect(pendingNoticeModule.consumePendingNotice).toHaveBeenCalledTimes(1);
  });

  it('dismiss clears the notice back to null', async () => {
    vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue({
      message: 'Your account has been deleted.',
      variant: 'success',
    });
    const { result } = renderHook(() => usePendingNotice());
    await waitFor(() => {
      expect(result.current.notice).toBe('Your account has been deleted.');
    });
    act(() => result.current.dismiss());
    expect(result.current.notice).toBeNull();
  });
});
