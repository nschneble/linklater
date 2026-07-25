/**
 * Tests for useMultiFactor's error branches and the reauth action split.
 *
 * SettingsView.test.tsx mocks MultiFactorSection wholesale, so this hook's
 * catch branches and disable-vs-regenerate routing have no other coverage.
 * These tests exercise:
 *   - handleStartTotpSetup catch → error set, refreshUser skipped
 *   - handleVerifyTotp invalid-code catch → error set, setup preserved
 *   - handleReauth 'disable' branch (success) → disableMfa + refreshUser
 *   - handleReauth 'regenerate' branch (success) → recovery codes surfaced
 *   - handleReauth catch (either action) → error set
 *   - handleCancelTotpSetup catch → error set
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMultiFactor } from './useMultiFactor';
import type { FormEvent } from 'react';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../lib/api', () => ({
  cancelTotpSetup: vi.fn(),
  disableMfa: vi.fn(),
  regenerateRecoveryCodes: vi.fn(),
  setupTotp: vi.fn(),
  verifyTotpSetup: vi.fn(),
}));

vi.mock('../../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { useAuth } from '../../../auth/AuthContext';
import {
  cancelTotpSetup,
  disableMfa,
  regenerateRecoveryCodes,
  setupTotp,
  verifyTotpSetup,
} from '../../../lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const refreshUser = vi.fn();

function primeAuth(userOverrides: Record<string, unknown> = {}) {
  vi.mocked(useAuth).mockReturnValue({
    refreshUser,
    user: {
      multiFactorMethod: 'totp',
      multiFactorPending: false,
      ...userOverrides,
    },
  } as unknown as ReturnType<typeof useAuth>);
}

const formEvent = { preventDefault: vi.fn() } as unknown as FormEvent;

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  refreshUser.mockResolvedValue(undefined);
  primeAuth();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useMultiFactor handleStartTotpSetup', () => {
  it('surfaces the error message and skips refreshUser when setupTotp rejects', async () => {
    vi.mocked(setupTotp).mockRejectedValue(new Error('Setup unavailable'));

    const { result } = renderHook(() => useMultiFactor());

    await act(async () => {
      await result.current.handleStartTotpSetup();
    });

    expect(result.current.error).toBe('Setup unavailable');
    expect(result.current.totpSetup).toBeNull();
    expect(result.current.loading).toBe(false);
    // started never flipped true, so the post-setup refresh must not fire.
    expect(refreshUser).not.toHaveBeenCalled();
  });
});

describe('useMultiFactor handleVerifyTotp', () => {
  it('surfaces the invalid-code error and leaves any setup state intact', async () => {
    vi.mocked(verifyTotpSetup).mockRejectedValue(new Error('Invalid code'));

    const { result } = renderHook(() => useMultiFactor());

    act(() => result.current.setTotpCode('000000'));

    await act(async () => {
      await result.current.handleVerifyTotp(formEvent);
    });

    expect(formEvent.preventDefault).toHaveBeenCalled();
    expect(result.current.error).toBe('Invalid code');
    expect(result.current.recoveryCodes).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(refreshUser).not.toHaveBeenCalled();
  });
});

describe('useMultiFactor handleReauth', () => {
  it('routes the "disable" action to disableMfa and refreshes the user', async () => {
    vi.mocked(disableMfa).mockResolvedValue(undefined);

    const { result } = renderHook(() => useMultiFactor());

    act(() => {
      result.current.setReauthAction('disable');
      result.current.setReauthPassword('open-sesame');
      result.current.setReauthCode('123456');
    });

    await act(async () => {
      await result.current.handleReauth(formEvent);
    });

    expect(disableMfa).toHaveBeenCalledWith({
      currentPassword: 'open-sesame',
      code: '123456',
    });
    expect(regenerateRecoveryCodes).not.toHaveBeenCalled();
    expect(refreshUser).toHaveBeenCalledTimes(1);
    expect(result.current.reauthAction).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('routes the "regenerate" action to regenerateRecoveryCodes and surfaces the codes', async () => {
    vi.mocked(regenerateRecoveryCodes).mockResolvedValue({
      recoveryCodes: ['aaaaa-bbbbb', 'ccccc-ddddd'],
    });

    const { result } = renderHook(() => useMultiFactor());

    act(() => result.current.setReauthAction('regenerate'));

    await act(async () => {
      await result.current.handleReauth(formEvent);
    });

    expect(regenerateRecoveryCodes).toHaveBeenCalledWith({
      currentPassword: undefined,
      code: undefined,
    });
    expect(disableMfa).not.toHaveBeenCalled();
    expect(result.current.recoveryCodes).toEqual([
      'aaaaa-bbbbb',
      'ccccc-ddddd',
    ]);
    expect(result.current.reauthAction).toBeNull();
  });

  it('surfaces the error when the reauth call rejects', async () => {
    vi.mocked(disableMfa).mockRejectedValue(new Error('Wrong password'));

    const { result } = renderHook(() => useMultiFactor());

    act(() => result.current.setReauthAction('disable'));

    await act(async () => {
      await result.current.handleReauth(formEvent);
    });

    expect(result.current.error).toBe('Wrong password');
    expect(result.current.loading).toBe(false);
    // A failed disable must not clear the reauth prompt.
    expect(result.current.reauthAction).toBe('disable');
  });
});

describe('useMultiFactor handleCancelTotpSetup', () => {
  it('surfaces the error message when cancelTotpSetup rejects', async () => {
    vi.mocked(cancelTotpSetup).mockRejectedValue(new Error('Cancel failed'));

    const { result } = renderHook(() => useMultiFactor());

    await act(async () => {
      await result.current.handleCancelTotpSetup();
    });

    expect(result.current.error).toBe('Cancel failed');
    expect(result.current.loading).toBe(false);
  });
});
