/**
 * Who the consent screen would actually grant as, and whether that is
 * still the account it is naming.
 *
 * `subject` rather than email, because `readTokenClaims` reads no email
 * and giving it one would compare a value the email-change flow rewrites
 * under a session that never moved, refusing a grant nothing is wrong
 * with. Detection only, exactly as that reader's own contract requires:
 * the payload is unverified, and because a mismatch REFUSES, a forged
 * one can only cost the forger a grant they were never getting.
 *
 * The token travels back with the verdict rather than being read again
 * where it is spent. `apiFetch` reads the store three times, once to
 * build the request and twice more around a renewal, so a grant checked
 * against one token and sent under another is not a race this page can
 * lose by accident. It is the defect.
 *
 * Nothing stored answers with an empty literal, which still pins: it is
 * falsy, so no Authorization header goes out, and it is a string, so
 * neither renewal path opens. The refusal that follows is the server's,
 * and it lands on nobody's account.
 */

import { getStoredToken, readTokenClaims } from '../../lib/api';

export interface GrantIdentity {
  /** Empty when nothing is stored; never a token this read did not see. */
  token: string;
  mismatched: boolean;
}

export function readGrantIdentity(userId: string | null): GrantIdentity {
  const token = getStoredToken();
  const subject = readTokenClaims(token)?.subject ?? null;

  return {
    token: token ?? '',
    mismatched: userId !== null && subject !== null && subject !== userId,
  };
}
