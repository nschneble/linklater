/*
 * Tests for grantIdentity, the consent screen's answer to whether the
 * account it is naming is the account it would grant as.
 *
 * Both halves are pinned in both directions, because each has a forward
 * half that passes on its own while the state it leaves behind is wrong:
 * a reader that always answers "mismatched" refuses every grant, and an
 * allowlist that always answers "vouched" ships the wrong address.
 *
 * The token is asserted alongside the verdict. What the caller spends is
 * the token this read saw, so a reader that returned the right verdict
 * beside a token it re-read would leave the defect open.
 */

import { accountIsVouchedFor, readGrantIdentity } from './grantIdentity';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearStoredToken, setStoredToken } from '../../lib/api';
import type { AuthorizeFailure } from './extensionAuthorizeMessages';

function makeToken(payload: unknown): string {
  const segment = btoa(JSON.stringify(payload))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
  return `header.${segment}.signature`;
}

const ALICE = makeToken({ subject: 'user-1', exp: 4102444800 });
const BOB = makeToken({ subject: 'user-2', exp: 4102444800 });

beforeEach(() => {
  localStorage.clear();
  clearStoredToken();
});

describe('readGrantIdentity', () => {
  it('accepts the token the screen is already rendering', () => {
    setStoredToken(ALICE);
    expect(readGrantIdentity('user-1')).toEqual({
      token: ALICE,
      mismatched: false,
    });
  });

  it('refuses a token that belongs to somebody else now', () => {
    setStoredToken(BOB);
    expect(readGrantIdentity('user-1')).toEqual({
      token: BOB,
      mismatched: true,
    });
  });

  it('hands back an empty literal when nothing is stored', () => {
    expect(readGrantIdentity('user-1')).toEqual({
      token: '',
      mismatched: false,
    });
  });

  // an opaque API token has no payload, and absence is not evidence
  it('claims no mismatch from a token it cannot read', () => {
    setStoredToken('ltk_opaque_api_token');
    expect(readGrantIdentity('user-1')).toEqual({
      token: 'ltk_opaque_api_token',
      mismatched: false,
    });
  });

  it('claims no mismatch when the screen is rendering nobody', () => {
    setStoredToken(BOB);
    expect(readGrantIdentity(null).mismatched).toBe(false);
  });

  it('reads a subject the issuer spelled the standard way', () => {
    setStoredToken(makeToken({ sub: 'user-2', exp: 4102444800 }));
    expect(readGrantIdentity('user-1').mismatched).toBe(true);
  });
});

describe('accountIsVouchedFor', () => {
  it('names the account before anything has failed', () => {
    expect(accountIsVouchedFor(null, false)).toBe(true);
  });

  it.each<AuthorizeFailure>(['request-invalid', 'unavailable'])(
    'goes on naming it after a %s, which unseats nobody',
    (failure) => {
      expect(accountIsVouchedFor(failure, false)).toBe(true);
    },
  );

  it('stops naming it once the session behind it is gone', () => {
    expect(accountIsVouchedFor('session-lost', false)).toBe(false);
  });

  it('stops naming it while the token belongs to somebody else', () => {
    expect(accountIsVouchedFor(null, true)).toBe(false);
  });

  // the allowlist is the point: a verdict added later has to close it
  it('closes the line for a failure nobody has written copy for yet', () => {
    const unlisted = 'grant-revoked' as AuthorizeFailure;
    expect(accountIsVouchedFor(unlisted, false)).toBe(false);
  });
});
