/*
 * Tests for accountVouching, which decides whether the consent screen may
 * still print the address of the account it is granting on.
 *
 * Pinned in both directions: an allowlist that always answers "vouched"
 * ships the wrong address, and one that never does drops a line the user
 * needs to recognise the account before approving.
 */

import { accountIsVouchedFor } from './accountVouching';
import { describe, expect, it } from 'vitest';
import type { AuthorizeFailure } from './extensionAuthorizeMessages';

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
