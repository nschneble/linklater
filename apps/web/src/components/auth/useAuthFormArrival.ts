import {
  consumePendingNotice,
  hasPendingNotice,
} from '../../lib/pendingNotice';
import { hasStandingSessionOffer } from './standingSessionOffer';
import { useEffect, useRef, useState } from 'react';
import type { Mode } from './useAuthForm';
import type { NoticeEntry } from '../../lib/pendingNotice';

// the catalog's shape, since a consumed entry is set here whole
type FormNotice = NoticeEntry;

interface AuthFormArrivalOptions {
  arrivedWithOAuthError: boolean;
  mode: Mode;
  resetForm: () => void;
}

/**
 * Everything arriving at an auth screen does: clear the form it is about
 * to show, take the message queued for it, and decide where focus lands.
 * Arriving covers both a mount and a move between the auth routes, which
 * reuse one form rather than remounting it.
 *
 * The two effects below run in declaration order and that order is
 * load-bearing, which is the reason they are one module and not two. The
 * store behind a queued message is one-shot, so the peek in the mode
 * effect is worth no more than its position: it asks whether a message is
 * about to be announced while the store still holds one. Hoist the
 * consume effect above it and the peek finds nothing, so focus lands in
 * an input and flips a screen reader into forms mode in the middle of the
 * announcement (`AuthForm.strictMode.test.tsx`). What the peek finds is
 * queued a commit earlier, by whichever flow sent the user here.
 *
 * The mode effect keeps its own record of the mode it last saw, because
 * the effect running is not the same event as the mode changing. React
 * double-invokes it in development, and the store the message came from
 * is one-shot, so a clear on every run takes away every announcement this
 * screen was sent. `handleModeChange` is no home for the clear either:
 * back and forward between the auth routes change the mode without
 * passing through it.
 *
 * That same conflation reaches the focus bail. Its first arm is a live
 * read of the one-shot store, which the first pass of the consume effect
 * has already emptied by the time the second pass asks, so the bail
 * answers no and moves focus into an input over the announcement. The
 * answer the mount arrived at is kept, and only a real mode change asks
 * again; keeping it for good would strand focus for every mode switch
 * left in the session. It is the whole three-arm answer that is kept,
 * because latching the first arm alone leaves the other two deciding a
 * question already settled. The OAuth arm needs none of this, being
 * latched in render where it is raised (`useOAuthArrivalError.ts`).
 *
 * The resets arrive as one callback rather than as a handful of setters,
 * so what this module asks its caller for is a concept and not a copy of
 * its state. A fresh identity on every render would re-run the effect and
 * empty the password field under whoever is typing into it, so the caller
 * hands over a memoized one.
 */
export function useAuthFormArrival({
  arrivedWithOAuthError,
  mode,
  resetForm,
}: AuthFormArrivalOptions) {
  const emailReference = useRef<HTMLInputElement>(null);
  const passwordReference = useRef<HTMLInputElement>(null);
  const mountInboundAnnouncement = useRef<boolean | null>(null);
  const previousMode = useRef<Mode | null>(null);

  const [notice, setNotice] = useState<FormNotice | null>(null);

  useEffect(() => {
    const modeChanged =
      previousMode.current !== null && previousMode.current !== mode;
    previousMode.current = mode;

    resetForm();
    // a standing one would otherwise outlive the screen it describes
    if (modeChanged) setNotice(null);

    const inboundNow =
      hasPendingNotice() || arrivedWithOAuthError || hasStandingSessionOffer();
    if (mountInboundAnnouncement.current === null) {
      mountInboundAnnouncement.current = inboundNow;
    }
    const hasInboundAnnouncement = modeChanged
      ? inboundNow
      : mountInboundAnnouncement.current;
    // auto-focus would flip a screen reader into forms mode, muting it
    if (hasInboundAnnouncement) return;

    const emailInputValue = emailReference.current?.value ?? '';
    if (mode !== 'forgot-password' && emailInputValue.length > 0) {
      passwordReference.current?.focus();
      return;
    }
    emailReference.current?.focus();
  }, [mode, arrivedWithOAuthError, resetForm]);

  useEffect(() => {
    const pending = consumePendingNotice();
    if (pending !== null) setNotice(pending);
  }, []);

  return { emailReference, notice, passwordReference, setNotice };
}
