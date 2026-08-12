/**
 * Offers, rather than takes, the move into the app when a sibling tab
 * signs in while this one is showing the login form.
 *
 * User-initiated on purpose. Swapping the page automatically is two acts:
 * stop rendering the old user's data, and install the new user's page. On
 * a login screen there is nothing confidential to stop rendering, so the
 * only thing left is the data loss, and the typed email is destroyed and
 * demanded again (WCAG 3.3.7 Redundant Entry). The password is worse: it
 * was never submitted, so no password manager holds a copy.
 *
 * The notice is inert until the button is pressed. Keying the swap to the
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
 * The trigger is the `storage` event alone. That event never fires in the
 * tab that wrote, so this tab's own sign-out cannot trip it, which matters
 * because `logout` clears the token only after the revoke round trip
 * returns and a live token therefore outlives the form appearing.
 *
 * One string feeds both channels so they cannot drift, and only the
 * sr-only region carries live semantics; a role on the painted copy would
 * put two regions on one message and have it read twice.
 */

import { getStoredToken, readTokenClaims } from '../../lib/api';
import PrimaryButton from '../common/PrimaryButton';
import { useEffect, useState } from 'react';

const ALREADY_SIGNED_IN_MESSAGE = "You're signed in on another tab.";

/**
 * Whether a token this tab did not write has appeared in storage. The
 * subject has to be readable: a token nobody can be identified from is not
 * evidence anyone signed in.
 */
function useSignedInElsewhere(): boolean {
  const [signedInElsewhere, setSignedInElsewhere] = useState(false);

  useEffect(() => {
    const handleStorage = () => {
      const subject = readTokenClaims(getStoredToken())?.sub ?? null;
      if (subject === null) return;
      setSignedInElsewhere(true);
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
          <PrimaryButton
            type="button"
            onClick={() => window.location.assign('/unread')}
          >
            Go to my links
          </PrimaryButton>
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
