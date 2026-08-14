/**
 * The grant itself: one request, the states a consent screen can be in
 * while it is out, and the one it can be in before it ever goes.
 *
 * `authorizing` stays true across a success. The navigation it hands the
 * browser to is what ends this page, and dropping back to idle first would
 * repaint the control as ready in the moment before the document unloads.
 *
 * The failure arm empties the pending state in the same commit that fills
 * the error, so the document never carries both at once. An utterance the
 * pending region already queued still finishes on its own; what the single
 * commit rules out is a page that reads as pending and failed together.
 *
 * Failure is kept as a kind rather than a rendered string because the two
 * differ where it matters: the same failure twice writes the same text
 * into the same node, which is not a mutation and announces nothing. The
 * clear at the start of a click is what makes the second one audible, and
 * it commits on its own because the request that follows suspends here.
 *
 * The account behind the screen is asked about twice, because the two
 * askings do different jobs. The subscription keeps the display honest
 * and the control marked, and it is filtered to the token keys so a
 * sibling's dark-mode toggle cannot fire it. The click is the gate, and
 * it stands whether or not an event ever arrived: `useIdentityGuard`
 * leaves this route alone on purpose, since re-hydrating it would spend
 * the request the extension is waiting on.
 *
 * The verdict is assigned rather than raised, so switching back in the
 * other tab clears it and an unrelated write cannot re-announce a state
 * that never changed. It lands as a boolean and never as the new
 * address, so a second switch has nothing new to say.
 */

import { authorizeExtension, isTokenStorageEvent } from '../../lib/api';
import { authorizeFailureFrom } from './extensionAuthorizeMessages';
import { readGrantIdentity } from './grantIdentity';
import { useEffect, useState } from 'react';
import type { AuthorizeFailure } from './extensionAuthorizeMessages';

interface ExtensionAuthorize {
  authorizing: boolean;
  failure: AuthorizeFailure | null;
  handleAuthorize: () => Promise<void>;
  mismatched: boolean;
}

export function useExtensionAuthorize(
  codeChallenge: string,
  redirectUri: string,
  userId: string | null,
): ExtensionAuthorize {
  const [authorizing, setAuthorizing] = useState(false);
  const [failure, setFailure] = useState<AuthorizeFailure | null>(null);
  const [mismatched, setMismatched] = useState(false);

  useEffect(() => {
    setMismatched(readGrantIdentity(userId).mismatched);

    const handleStorage = (event: StorageEvent) => {
      if (!isTokenStorageEvent(event)) return;
      setMismatched(readGrantIdentity(userId).mismatched);
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [userId]);

  const handleAuthorize = async () => {
    // aria-disabled leaves the control activatable, which is the point
    if (authorizing || mismatched) return;

    const identity = readGrantIdentity(userId);
    if (identity.mismatched) {
      setMismatched(true);
      return;
    }

    setFailure(null);
    setAuthorizing(true);

    try {
      const { redirectUrl } = await authorizeExtension(
        codeChallenge,
        redirectUri,
        identity.token,
      );
      window.location.href = redirectUrl;
    } catch (caught: unknown) {
      setAuthorizing(false);
      setFailure(authorizeFailureFrom(caught));
    }
  };

  return { authorizing, failure, handleAuthorize, mismatched };
}
