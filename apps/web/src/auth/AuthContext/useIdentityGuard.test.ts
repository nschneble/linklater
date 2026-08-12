/**
 * Tests for the cross-tab identity guard.
 *
 * The three-way branch is pinned one arm at a time, and the same-user arm
 * is asserted negatively in all three channels the contract names: no
 * announcement queued, no navigation, no focus moved. A guard that fired
 * on every rotation would be indistinguishable from one that fired on the
 * right ones without that arm.
 *
 * `window.location` is sealed in jsdom, so it is redefined with a spy for
 * `assign`; navigation is the observable side of a document replacement.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../../lib/api', () => ({
  getStoredToken: vi.fn(),
  readTokenClaims: vi.fn(),
}));

import * as apiModule from '../../lib/api';
import { consumePendingNotice } from '../../lib/pendingNotice';
import { createRef } from 'react';
import { noteRenderedIdentity, readRenderedIdentity } from './renderedIdentity';
import {
  reconcileColdBootIdentity,
  useIdentityGuard,
} from './useIdentityGuard';
import type { User } from './types';

const realLocation = window.location;
let assignMock: ReturnType<typeof vi.fn>;

function makeRenderedUser(userId: string): User {
  return { userId } as User;
}

function userRef(user: User | null) {
  const reference = createRef<User | null>();
  reference.current = user;
  return reference;
}

/** Points `getStoredToken` at `token` and `readTokenClaims` at `subject`. */
function storedTokenBelongsTo(token: string | null, subject: string | null) {
  vi.mocked(apiModule.getStoredToken).mockReturnValue(token);
  vi.mocked(apiModule.readTokenClaims).mockReturnValue(
    token === null ? null : { exp: null, sub: subject },
  );
}

function goVisible() {
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  assignMock = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...realLocation, assign: assignMock, pathname: '/unread' },
    writable: true,
  });
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: realLocation,
    writable: true,
  });
  vi.restoreAllMocks();
});

describe('same user rotates the token', () => {
  it('adopts silently: no announcement is queued', () => {
    storedTokenBelongsTo('rotated-jwt', 'user-1');
    const refreshUser = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useIdentityGuard(userRef(makeRenderedUser('user-1')), refreshUser),
    );
    goVisible();

    expect(consumePendingNotice()).toBeNull();
  });

  it('adopts silently: the document is never replaced', () => {
    storedTokenBelongsTo('rotated-jwt', 'user-1');
    const refreshUser = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useIdentityGuard(userRef(makeRenderedUser('user-1')), refreshUser),
    );
    goVisible();

    expect(assignMock).not.toHaveBeenCalled();
  });

  it('adopts silently: focus stays where the user left it', () => {
    storedTokenBelongsTo('rotated-jwt', 'user-1');
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();

    renderHook(() =>
      useIdentityGuard(userRef(makeRenderedUser('user-1')), vi.fn()),
    );
    goVisible();

    expect(document.activeElement).toBe(input);
    input.remove();
  });

  it('still refreshes the profile, which is the behavior it replaces', () => {
    storedTokenBelongsTo('rotated-jwt', 'user-1');
    const refreshUser = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useIdentityGuard(userRef(makeRenderedUser('user-1')), refreshUser),
    );
    goVisible();

    expect(refreshUser).toHaveBeenCalledTimes(1);
  });
});

describe('a different user owns the token', () => {
  it('queues the account-switched notice', () => {
    storedTokenBelongsTo('other-jwt', 'user-2');

    renderHook(() =>
      useIdentityGuard(userRef(makeRenderedUser('user-1')), vi.fn()),
    );
    goVisible();

    expect(consumePendingNotice()).toEqual({
      message: "You're now signed in to a different account",
      variant: 'warning',
    });
  });

  it('replaces the document rather than swapping React state', () => {
    storedTokenBelongsTo('other-jwt', 'user-2');

    renderHook(() =>
      useIdentityGuard(userRef(makeRenderedUser('user-1')), vi.fn()),
    );
    goVisible();

    expect(assignMock).toHaveBeenCalledWith('/unread');
  });

  it('records the new subject first, so the fresh document does not loop', () => {
    storedTokenBelongsTo('other-jwt', 'user-2');

    renderHook(() =>
      useIdentityGuard(userRef(makeRenderedUser('user-1')), vi.fn()),
    );
    goVisible();

    expect(readRenderedIdentity()).toBe('user-2');
  });

  it('does not refetch the profile it is about to throw away', () => {
    storedTokenBelongsTo('other-jwt', 'user-2');
    const refreshUser = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useIdentityGuard(userRef(makeRenderedUser('user-1')), refreshUser),
    );
    goVisible();

    expect(refreshUser).not.toHaveBeenCalled();
  });
});

describe('the 2s refetch throttle', () => {
  it('suppresses a second refetch inside the window', () => {
    storedTokenBelongsTo('jwt', 'user-1');
    const refreshUser = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useIdentityGuard(userRef(makeRenderedUser('user-1')), refreshUser),
    );
    goVisible();
    goVisible();

    expect(refreshUser).toHaveBeenCalledTimes(1);
  });

  it('detects a switch inside the window it would suppress a refetch in', () => {
    const rendered = userRef(makeRenderedUser('user-1'));
    const refreshUser = vi.fn().mockResolvedValue(undefined);
    storedTokenBelongsTo('jwt', 'user-1');

    renderHook(() => useIdentityGuard(rendered, refreshUser));
    goVisible();
    expect(refreshUser).toHaveBeenCalledTimes(1);

    // no clock advance: the throttle window is wide open
    storedTokenBelongsTo('other-jwt', 'user-2');
    goVisible();

    expect(assignMock).toHaveBeenCalledWith('/unread');
  });
});

describe('a tab rendering nobody', () => {
  it('is left alone, so a half-typed login form survives', () => {
    storedTokenBelongsTo('sibling-jwt', 'user-2');
    const refreshUser = vi.fn().mockResolvedValue(undefined);

    renderHook(() => useIdentityGuard(userRef(null), refreshUser));
    goVisible();

    expect(refreshUser).not.toHaveBeenCalled();
    expect(assignMock).not.toHaveBeenCalled();
    expect(consumePendingNotice()).toBeNull();
  });

  it('does not even look at whose token it is', () => {
    storedTokenBelongsTo('sibling-jwt', 'user-2');

    renderHook(() => useIdentityGuard(userRef(null), vi.fn()));
    goVisible();

    // separates guarded from threw, which the assertions above cannot
    expect(apiModule.readTokenClaims).not.toHaveBeenCalled();
  });
});

describe('inputs the guard refuses to act on', () => {
  it('does nothing while the tab is hidden', () => {
    storedTokenBelongsTo('other-jwt', 'user-2');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    const refreshUser = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useIdentityGuard(userRef(makeRenderedUser('user-1')), refreshUser),
    );
    goVisible();

    expect(refreshUser).not.toHaveBeenCalled();
    expect(assignMock).not.toHaveBeenCalled();
  });

  it('does nothing when there is no stored token', () => {
    storedTokenBelongsTo(null, null);
    const refreshUser = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useIdentityGuard(userRef(makeRenderedUser('user-1')), refreshUser),
    );
    goVisible();

    expect(refreshUser).not.toHaveBeenCalled();
    expect(assignMock).not.toHaveBeenCalled();
  });

  it('treats an unreadable subject as no evidence and refetches instead', () => {
    storedTokenBelongsTo('ltk_opaque_token', null);
    const refreshUser = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useIdentityGuard(userRef(makeRenderedUser('user-1')), refreshUser),
    );
    goVisible();

    expect(assignMock).not.toHaveBeenCalled();
    expect(refreshUser).toHaveBeenCalledTimes(1);
  });

  it('stops listening once unmounted', () => {
    storedTokenBelongsTo('other-jwt', 'user-2');

    const { unmount } = renderHook(() =>
      useIdentityGuard(userRef(makeRenderedUser('user-1')), vi.fn()),
    );
    unmount();
    goVisible();

    expect(assignMock).not.toHaveBeenCalled();
  });
});

describe('reconcileColdBootIdentity', () => {
  it('answers false when the booting token belongs to the last rendered user', () => {
    vi.mocked(apiModule.readTokenClaims).mockReturnValue({
      exp: null,
      sub: 'user-1',
    });
    noteRenderedIdentity('user-1');

    expect(reconcileColdBootIdentity('jwt')).toBe(false);
    expect(consumePendingNotice()).toBeNull();
  });

  it('answers false for a tab with no prior identity, which is an ordinary boot', () => {
    vi.mocked(apiModule.readTokenClaims).mockReturnValue({
      exp: null,
      sub: 'user-2',
    });

    expect(reconcileColdBootIdentity('jwt')).toBe(false);
    expect(consumePendingNotice()).toBeNull();
    expect(assignMock).not.toHaveBeenCalled();
  });

  it('answers false when the subject cannot be read at all', () => {
    vi.mocked(apiModule.readTokenClaims).mockReturnValue(null);
    noteRenderedIdentity('user-1');

    expect(reconcileColdBootIdentity('ltk_opaque')).toBe(false);
    expect(consumePendingNotice()).toBeNull();
  });

  it('announces in place at the destination without a second page load', () => {
    vi.mocked(apiModule.readTokenClaims).mockReturnValue({
      exp: null,
      sub: 'user-2',
    });
    noteRenderedIdentity('user-1');

    expect(reconcileColdBootIdentity('jwt')).toBe(false);
    expect(assignMock).not.toHaveBeenCalled();
    expect(consumePendingNotice()?.variant).toBe('warning');
    expect(readRenderedIdentity()).toBe('user-2');
  });

  it('sends a mismatched boot on another route to the destination', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...realLocation, assign: assignMock, pathname: '/settings' },
      writable: true,
    });
    vi.mocked(apiModule.readTokenClaims).mockReturnValue({
      exp: null,
      sub: 'user-2',
    });
    noteRenderedIdentity('user-1');

    expect(reconcileColdBootIdentity('jwt')).toBe(true);
    expect(assignMock).toHaveBeenCalledWith('/unread');
    expect(readRenderedIdentity()).toBe('user-2');
    expect(consumePendingNotice()?.message).toBe(
      "You're now signed in to a different account",
    );
  });
});
