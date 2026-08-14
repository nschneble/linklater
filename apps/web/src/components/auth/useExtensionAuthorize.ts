/**
 * The grant itself: one request, and the three states a consent screen can
 * be in while it is out.
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
 */

import { authorizeExtension } from '../../lib/api';
import { authorizeFailureFrom } from './extensionAuthorizeMessages';
import { useState } from 'react';
import type { AuthorizeFailure } from './extensionAuthorizeMessages';

interface ExtensionAuthorize {
  authorizing: boolean;
  failure: AuthorizeFailure | null;
  handleAuthorize: () => Promise<void>;
}

export function useExtensionAuthorize(
  codeChallenge: string,
  redirectUri: string,
): ExtensionAuthorize {
  const [authorizing, setAuthorizing] = useState(false);
  const [failure, setFailure] = useState<AuthorizeFailure | null>(null);

  const handleAuthorize = async () => {
    // aria-disabled leaves the control activatable, which is the point
    if (authorizing) return;

    setFailure(null);
    setAuthorizing(true);

    try {
      const { redirectUrl } = await authorizeExtension(
        codeChallenge,
        redirectUri,
      );
      window.location.href = redirectUrl;
    } catch (caught: unknown) {
      setAuthorizing(false);
      setFailure(authorizeFailureFrom(caught));
    }
  };

  return { authorizing, failure, handleAuthorize };
}
