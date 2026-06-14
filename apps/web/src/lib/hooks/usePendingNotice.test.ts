import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../pendingNotice', () => ({
  consumePendingNotice: vi.fn().mockReturnValue(null),
}));

import { usePendingNotice } from './usePendingNotice';
import * as pendingNoticeModule from '../pendingNotice';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePendingNotice', () => {
  it('populates notice after effects flush when consumePendingNotice returns a string', async () => {
    vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue(
      'Your account has been deleted.',
    );
    const { result } = renderHook(() => usePendingNotice());
    await waitFor(() => {
      expect(result.current.notice).toBe('Your account has been deleted.');
    });
  });

  it('stays null after effects flush when consumePendingNotice returns null', async () => {
    vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue(null);
    const { result } = renderHook(() => usePendingNotice());
    await act(async () => {});
    expect(result.current.notice).toBeNull();
  });

  it('calls consumePendingNotice exactly once across re-renders', async () => {
    vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue(
      'Your account has been deleted.',
    );
    const { rerender } = renderHook(() => usePendingNotice());
    await act(async () => {});
    rerender();
    rerender();
    expect(pendingNoticeModule.consumePendingNotice).toHaveBeenCalledTimes(1);
  });

  it('dismiss clears the notice back to null', async () => {
    vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue(
      'Your account has been deleted.',
    );
    const { result } = renderHook(() => usePendingNotice());
    await waitFor(() => {
      expect(result.current.notice).toBe('Your account has been deleted.');
    });
    act(() => result.current.dismiss());
    expect(result.current.notice).toBeNull();
  });
});
