/**
 * Unit tests for standingSessionOffer.
 *
 * The token store is real and the tokens are minted the way the API signs
 * them, because what this predicate claims is a claim about what storage
 * answers. A mocked reader would certify the shape of the question rather
 * than the answer.
 *
 * The `subject` half needs a token that is well formed and carries no
 * user id, which nothing else in the tree produces: every other fixture
 * either decodes to a user or does not decode at all, and both of those
 * pass a predicate that only checks the claims object exists.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearStoredToken } from '../../lib/api';
import {
  hasStandingSessionOffer,
  storedTokenHasLiveOwner,
} from './standingSessionOffer';
import { JwtService } from '@nestjs/jwt';

const RENDERED_IDENTITY_KEY = 'linklater_rendered_identity';
const TOKEN_KEY = 'linklater_token';

const jwt = new JwtService({ secret: 'standing-offer-test-secret' });

/** A token the real reader decodes, with whatever claims are asked for. */
function mintToken(claims: Record<string, unknown>): string {
  return jwt.sign(claims);
}

function storageHolds(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

function thisTabRendered(userId: string) {
  window.sessionStorage.setItem(RENDERED_IDENTITY_KEY, userId);
}

function inSeconds(offset: number): number {
  return Math.floor(Date.now() / 1000) + offset;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  // the store keeps an in-memory copy no outside write can reach
  clearStoredToken();
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  clearStoredToken();
});

describe('a token somebody is identifiable from', () => {
  it('reads as a live owner when the id and the expiry both hold', () => {
    storageHolds(mintToken({ subject: 'user-1', exp: inSeconds(3600) }));

    expect(storedTokenHasLiveOwner()).toBe(true);
  });

  it('reads as nobody when the token carries no user id at all', () => {
    // well formed, decodes, and names no one: an `exp`-only payload
    storageHolds(mintToken({ exp: inSeconds(3600) }));

    expect(storedTokenHasLiveOwner()).toBe(false);
  });

  it('reads as nobody when the user id is not a string', () => {
    storageHolds(mintToken({ subject: 12345, exp: inSeconds(3600) }));

    expect(storedTokenHasLiveOwner()).toBe(false);
  });

  it('reads the standard `sub` too, so a later issuer needs no change', () => {
    storageHolds(mintToken({ sub: 'user-1', exp: inSeconds(3600) }));

    expect(storedTokenHasLiveOwner()).toBe(true);
  });

  it('reads as nobody when storage holds an opaque API token', () => {
    storageHolds('ltk_0f8d1c2e4a6b4f21');

    expect(storedTokenHasLiveOwner()).toBe(false);
  });

  it('reads as nobody when storage holds no token', () => {
    expect(storedTokenHasLiveOwner()).toBe(false);
  });
});

describe('what the expiry decides', () => {
  it('reads as ended when the token has already run out', () => {
    storageHolds(mintToken({ subject: 'user-1', exp: inSeconds(-60) }));

    expect(storedTokenHasLiveOwner()).toBe(false);
  });

  it('reads as live when the token carries no expiry to be dated by', () => {
    storageHolds(mintToken({ subject: 'user-1' }));

    expect(storedTokenHasLiveOwner()).toBe(true);
  });
});

describe('the offer a boot of this tab finds', () => {
  it('stands when a live owner and a prior render agree', () => {
    thisTabRendered('user-1');
    storageHolds(mintToken({ subject: 'user-1', exp: inSeconds(3600) }));

    expect(hasStandingSessionOffer()).toBe(true);
  });

  it('does not stand for a tab that rendered nobody, as a sign-out looks', () => {
    storageHolds(mintToken({ subject: 'user-1', exp: inSeconds(3600) }));

    expect(hasStandingSessionOffer()).toBe(false);
  });

  it('does not stand on a prior render alone, once the token is gone', () => {
    thisTabRendered('user-1');

    expect(hasStandingSessionOffer()).toBe(false);
  });

  it('does not stand on a token that has run out, prior render or not', () => {
    thisTabRendered('user-1');
    storageHolds(mintToken({ subject: 'user-1', exp: inSeconds(-60) }));

    expect(hasStandingSessionOffer()).toBe(false);
  });
});
