/**
 * Offers, rather than takes, the move into the app when a live session
 * exists that this tab is showing the login form instead of.
 *
 * Two situations produce that, and only one of them announces itself. A
 * sibling tab signing in arrives as a `storage` event. A boot of this tab
 * that kept its token and failed the profile fetch (`useAuthState`)
 * arrives as nothing at all, so the stored token is read on mount too.
 *
 * User-initiated on purpose. Swapping the page automatically is two acts:
 * stop rendering the old user's data, and install the new user's page. On
 * a login screen there is nothing confidential to stop rendering, so the
 * only thing left is the data loss, and the typed email is destroyed and
 * demanded again (WCAG 3.3.7 Redundant Entry). The password is worse: it
 * was never submitted, so no password manager holds a copy.
 *
 * The notice is inert until the link is followed. Keying the swap to the
 * next keystroke or to submit would convert an N/A into a plain 3.2.2 On
 * Input failure, and nothing here moves focus, because preserving the
 * caret where the user left it is the entire point.
 *
 * Not a `Toast`: a toast auto-dismisses on a fixed timer with no way to
 * extend or disable it, and this message carries the only route to its
 * action (WCAG 2.2.1 Timing Adjustable). A toast is also fixed to the
 * viewport bottom, where on a short screen it can cover the very input the
 * user is typing into (WCAG 2.4.11 Focus Not Obscured).
 *
 * An anchor rather than a button (WCAG 4.1.2, 2.4.4; see
 * `primaryActionClasses`), and a plain one rather than a router `Link`,
 * since the point is a full document load under the new identity.
 *
 * The mount-time read is gated on this tab having rendered somebody
 * before, because `logout` clears the token only once the revoke round
 * trip returns, so the login form appears while a live token is still in
 * storage. `logout` forgets the rendered identity first, which is what
 * separates a deliberate sign-out (no prior identity) from a boot that
 * failed on its own (sessionStorage survived the reload). The cost is a
 * tab that has never rendered anyone, which gets no offer until a sibling
 * writes.
 *
 * The `storage` arm is filtered to the token keys. A dozen other keys are
 * written cross-tab (theme, mode, CVD, dyslexic font, shortcuts, and a
 * paired timestamp for several of them), and announcing on a sibling's
 * dark-mode toggle is a live region firing with no tie to anything the
 * user did.
 *
 * The state is recomputed from storage rather than latched on, so a
 * sibling signing out retracts the offer instead of leaving a link that
 * bounces off the auth gate back to the form.
 *
 * One string feeds both channels so they cannot drift, and only the
 * sr-only region carries live semantics; a role on the painted copy would
 * put two regions on one message and have it read twice.
 */

import {
  getStoredToken,
  isTokenStorageEvent,
  readTokenClaims,
} from '../../lib/api';
import { primaryActionClasses } from '../common/PrimaryButton';
import { readRenderedIdentity } from '../../auth/AuthContext/renderedIdentity';
import { useEffect, useState } from 'react';

const ALREADY_SIGNED_IN_MESSAGE = "You're already signed in.";

/**
 * The destination, and the reason it is the only one: the pending notice
 * rides sessionStorage and only `AuthForm` and `LinksView` consume it.
 */
const SESSION_DESTINATION = '/unread';

/**
 * Whether storage holds a token somebody is identifiable from. A token
 * nobody can be identified from is not evidence anyone signed in, which
 * is also how an opaque `ltk_` API token stays silent.
 */
function storedTokenHasOwner(): boolean {
  return readTokenClaims(getStoredToken())?.subject != null;
}

function useSignedInElsewhere(): boolean {
  const [signedInElsewhere, setSignedInElsewhere] = useState(false);

  useEffect(() => {
    if (readRenderedIdentity() !== null && storedTokenHasOwner()) {
      setSignedInElsewhere(true);
    }

    const handleStorage = (event: StorageEvent) => {
      if (!isTokenStorageEvent(event)) return;
      setSignedInElsewhere(storedTokenHasOwner());
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return signedInElsewhere;
}

export default function AlreadySignedInNotice() {
  const signedInElsewhere = useSignedInElsewhere();

  return (
    <>
      {signedInElsewhere && (
        <div className="flex flex-col items-center gap-3 w-full max-w-md mx-auto mb-4 p-4 bg-[var(--mount-bg)] border-shadow text-[var(--mount-text)] text-sm rounded-2xl select-none">
          <p>
            <i className="fa-solid fa-circle-info mr-1.5" aria-hidden="true" />
            {ALREADY_SIGNED_IN_MESSAGE}
          </p>
          <a className={primaryActionClasses()} href={SESSION_DESTINATION}>
            Go to your links
          </a>
        </div>
      )}
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="already-signed-in-announcement"
      >
        {signedInElsewhere ? ALREADY_SIGNED_IN_MESSAGE : ''}
      </span>
    </>
  );
}
