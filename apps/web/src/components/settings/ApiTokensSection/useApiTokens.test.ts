/**
 * Tests for useApiTokens.
 *
 * Covers:
 *   - Token list loads on mount
 *   - Create flow: form submit → POST /tokens → token exposed once
 *   - Revoke flow: DELETE /tokens/:id → removed from list
 *   - Load error path
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormEvent } from 'react';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../lib/api', () => ({
  createApiToken: vi.fn(),
  listApiTokens: vi.fn(),
  revokeApiToken: vi.fn(),
}));

// useReanchorOnLoad is a side-effectful scroll helper - stub it out
vi.mock('../useReanchorOnLoad', () => ({
  useReanchorOnLoad: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import * as apiModule from '../../../lib/api';
import { useApiTokens } from './useApiTokens';
import type { ApiToken, CreatedApiToken } from '../../../lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeToken(overrides: Partial<ApiToken> = {}): ApiToken {
  return {
    id: 'token-1',
    name: 'My Token',
    prefix: 'ltk_abc12',
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    ...overrides,
  };
}

function makeCreatedToken(
  overrides: Partial<CreatedApiToken> = {},
): CreatedApiToken {
  return {
    ...makeToken(),
    rawToken: 'ltk_abc123def456',
    ...overrides,
  };
}

function fakeSubmitEvent(): FormEvent {
  return { preventDefault: vi.fn() } as unknown as FormEvent;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiModule.listApiTokens).mockResolvedValue([]);
  vi.mocked(apiModule.createApiToken).mockResolvedValue(makeCreatedToken());
  vi.mocked(apiModule.revokeApiToken).mockResolvedValue({ success: true });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useApiTokens initial load', () => {
  it('loads tokens on mount', async () => {
    const token = makeToken();
    vi.mocked(apiModule.listApiTokens).mockResolvedValue([token]);

    const { result } = renderHook(() => useApiTokens());

    await waitFor(() => {
      expect(result.current.tokens).toHaveLength(1);
    });

    expect(result.current.tokens[0].id).toBe('token-1');
  });

  it('sets loadError when listApiTokens rejects', async () => {
    vi.mocked(apiModule.listApiTokens).mockRejectedValue(
      new Error('Failed to fetch tokens'),
    );

    const { result } = renderHook(() => useApiTokens());

    await waitFor(() => {
      expect(result.current.loadError).toBe('Failed to fetch tokens');
    });
  });

  it('uses fallback error message for non-Error rejections', async () => {
    vi.mocked(apiModule.listApiTokens).mockRejectedValue('boom');

    const { result } = renderHook(() => useApiTokens());

    await waitFor(() => {
      expect(result.current.loadError).toBe('Failed to load tokens');
    });
  });
});

describe('useApiTokens create flow', () => {
  it('calls createApiToken with the current name and sets newToken', async () => {
    const created = makeCreatedToken({ id: 'new-1', rawToken: 'ltk_raw123' });
    vi.mocked(apiModule.createApiToken).mockResolvedValue(created);

    const { result } = renderHook(() => useApiTokens());
    await waitFor(() => expect(result.current.loadError).toBeNull());

    act(() => {
      result.current.setCreateName('My Extension');
    });

    await act(async () => {
      await result.current.handleCreate(fakeSubmitEvent());
    });

    expect(apiModule.createApiToken).toHaveBeenCalledWith('My Extension');
    expect(result.current.newToken?.rawToken).toBe('ltk_raw123');
  });

  it('clears the create form and hides it after a successful create', async () => {
    vi.mocked(apiModule.createApiToken).mockResolvedValue(makeCreatedToken());

    const { result } = renderHook(() => useApiTokens());
    await waitFor(() => expect(result.current.loadError).toBeNull());

    act(() => {
      result.current.setShowCreate(true);
      result.current.setCreateName('New Token');
    });

    await act(async () => {
      await result.current.handleCreate(fakeSubmitEvent());
    });

    expect(result.current.showCreate).toBe(false);
    expect(result.current.createName).toBe('');
  });

  it('reloads the token list after a successful create', async () => {
    const existingToken = makeToken({ id: 'existing' });
    const newToken = makeToken({ id: 'new-token' });
    vi.mocked(apiModule.listApiTokens)
      .mockResolvedValueOnce([existingToken])
      .mockResolvedValueOnce([existingToken, newToken]);

    const { result } = renderHook(() => useApiTokens());
    await waitFor(() => expect(result.current.tokens).toHaveLength(1));

    await act(async () => {
      await result.current.handleCreate(fakeSubmitEvent());
    });

    await waitFor(() => {
      expect(result.current.tokens).toHaveLength(2);
    });
  });

  it('sets createError when createApiToken rejects', async () => {
    vi.mocked(apiModule.createApiToken).mockRejectedValue(
      new Error('Name already taken'),
    );

    const { result } = renderHook(() => useApiTokens());
    await waitFor(() => expect(result.current.loadError).toBeNull());

    await act(async () => {
      await result.current.handleCreate(fakeSubmitEvent());
    });

    expect(result.current.createError).toBe('Name already taken');
  });
});

describe('useApiTokens revoke flow', () => {
  it('calls revokeApiToken with the token id', async () => {
    const token = makeToken({ id: 'revoke-me' });
    vi.mocked(apiModule.listApiTokens).mockResolvedValue([token]);

    const { result } = renderHook(() => useApiTokens());
    await waitFor(() => expect(result.current.tokens).toHaveLength(1));

    await act(async () => {
      await result.current.handleRevoke('revoke-me');
    });

    expect(apiModule.revokeApiToken).toHaveBeenCalledWith('revoke-me');
  });

  it('reloads the token list after revocation', async () => {
    const token = makeToken({ id: 'revoke-me' });
    vi.mocked(apiModule.listApiTokens)
      .mockResolvedValueOnce([token])
      .mockResolvedValueOnce([]);

    const { result } = renderHook(() => useApiTokens());
    await waitFor(() => expect(result.current.tokens).toHaveLength(1));

    await act(async () => {
      await result.current.handleRevoke('revoke-me');
    });

    await waitFor(() => {
      expect(result.current.tokens).toHaveLength(0);
    });
  });

  it('clears newToken when revoking the token that was just created', async () => {
    const created = makeCreatedToken({ id: 'new-one', rawToken: 'ltk_raw' });
    vi.mocked(apiModule.createApiToken).mockResolvedValue(created);

    const { result } = renderHook(() => useApiTokens());
    await waitFor(() => expect(result.current.loadError).toBeNull());

    // first create so newToken is set
    await act(async () => {
      await result.current.handleCreate(fakeSubmitEvent());
    });

    expect(result.current.newToken?.id).toBe('new-one');

    // now revoke that same token
    await act(async () => {
      await result.current.handleRevoke('new-one');
    });

    expect(result.current.newToken).toBeNull();
  });

  it('does not clear newToken when revoking a different token', async () => {
    const created = makeCreatedToken({ id: 'new-one', rawToken: 'ltk_raw' });
    vi.mocked(apiModule.createApiToken).mockResolvedValue(created);

    const { result } = renderHook(() => useApiTokens());
    await waitFor(() => expect(result.current.loadError).toBeNull());

    await act(async () => {
      await result.current.handleCreate(fakeSubmitEvent());
    });

    await act(async () => {
      await result.current.handleRevoke('different-token');
    });

    expect(result.current.newToken?.id).toBe('new-one');
  });
});
