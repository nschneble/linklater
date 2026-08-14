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
 * demanded again. The password is worse: it was never submitted, so no
 * password manager holds a copy. Nothing at WCAG A or AA compels the
 * offer over the swap; that loss is reason enough on its own.
 *
 * The notice is inert until the link is followed. WCAG 3.2.2 On Input
 * does not apply to it. Keying the swap to the next keystroke or to
 * submit would make it apply, and fail.
 *
 * Nothing here moves focus either, because preserving the caret where the
 * user left it is the entire point.
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
 * What the mount-time read asks, and why it is gated on this tab having
 * rendered somebody before, belongs to `standingSessionOffer.ts`, which
 * `useAuthForm` reads the same answer out of.
 *
 * The `storage` arm is filtered to the token keys. A dozen other keys are
 * written cross-tab (theme, mode, CVD, dyslexic font, shortcuts, and a
 * paired timestamp for several of them), and announcing on a sibling's
 * dark-mode toggle is a live region firing with no tie to anything the
 * user did.
 *
 * The offer never retracts, because a sibling signing out is not
 * something this tab can observe. The persisted pair goes empty, an
 * empty read is not proof the session ended, and so the token store
 * answers with the copy it already holds (`lib/api/storage.ts`). What
 * that leaves is a stale offer whose link bounces off the auth gate
 * back to this form, which is the other half of why nothing here follows
 * the link unasked.
 *
 * Raising it is therefore one-way. The one thing that can turn the check
 * over afterwards is the clock, and an offer that vanished while it was
 * being read would be a worse trade than a link that bounces; the live
 * evidence is what the announcement is gated on, not what it is held up
 * by.
 *
 * The bounce is not left to cost the form. Following the link hands the
 * typed email to `carriedEmail.ts` and the login form the auth gate lands
 * on puts it back. Nothing here claims the link failed, because from here
 * it has not yet been tried; the gate says why the form reappeared, once
 * it has watched the offer come back (`offerBounce.ts`). The password
 * cannot travel and does not.
 *
 * One string feeds both channels so they cannot drift, and only the
 * sr-only region reaches the accessibility tree at all. The painted copy
 * is hidden from it rather than merely left without a role: two copies of
 * one sentence are read back to back by a linear reader whether or not
 * the second one announces itself. The link is not hidden, since it is
 * the only route to the action.
 */

import { carryTypedEmail } from '../../auth/AuthContext/carriedEmail';
import {
  hasStandingSessionOffer,
  storedTokenHasLiveOwner,
} from './standingSessionOffer';
import { isTokenStorageEvent } from '../../lib/api';
import { primaryActionClasses } from '../common/PrimaryButton';
import { useEffect, useState } from 'react';

const ALREADY_SIGNED_IN_MESSAGE = "You're already signed in.";

/** The one destination, for the reason `useIdentityGuard` gives. */
const SESSION_DESTINATION = '/unread';

function useSignedInElsewhere(): boolean {
  const [signedInElsewhere, setSignedInElsewhere] = useState(false);

  useEffect(() => {
    if (hasStandingSessionOffer()) {
      setSignedInElsewhere(true);
    }

    const handleStorage = (event: StorageEvent) => {
      if (!isTokenStorageEvent(event)) return;
      if (!storedTokenHasLiveOwner()) return;
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
          <p aria-hidden="true">
            <i className="fa-solid fa-circle-info mr-1.5" aria-hidden="true" />
            {ALREADY_SIGNED_IN_MESSAGE}
          </p>
          <a
            className={primaryActionClasses()}
            href={SESSION_DESTINATION}
            onClick={carryTypedEmail}
          >
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
