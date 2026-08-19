import { useCallback, useEffect, useState } from 'react';
import { useTransientState } from '../../lib/hooks/useTransientState';
import type { MfaChallenge, Mode } from './useAuthForm';

// under a second the busy line only queues ahead of the error that ends
// the wait; the same threshold `useOAuthArrivalError` announces on
const ANNOUNCE_DELAY_MS = 1000;

// AuthForm survives mode changes, so an uncleared announcement outlives
// the submit it belongs to
const CLEAR_DELAY_MS = 8000;

/*
 * Never the submit button's own label. An identical string in both places
 * is read twice, once as the control's name and once as the region's text,
 * which is the bug `ExtensionAuthorizePage` documents.
 */
const BUSY_MESSAGE: Record<Mode, string> = {
  login: 'Signing you in.',
  register: 'Creating your account.',
  'forgot-password': 'Sending your reset link.',
};

const MFA_BUSY_MESSAGE = 'Checking your code.';

function busyMessage(mode: Mode, mfaChallenge: MfaChallenge | null): string {
  if (mfaChallenge) return MFA_BUSY_MESSAGE;
  return BUSY_MESSAGE[mode];
}

/**
 * Text for an always-mounted polite region naming the wait a submit opens.
 * Empty until the submit has been out for a full second, so a request that
 * resolves inside that window says nothing at all.
 *
 * The clear runs on a timer of its own rather than off `loading` going
 * false: a `catch`/`finally` batches into one commit with `setError`, and
 * two live regions mutating in one batch may coalesce into one
 * announcement.
 *
 * `aria-busy` is deliberately absent everywhere it could sit. It tells a
 * reader to WITHHOLD updates, and the update it would withhold is the
 * error explaining why the wait ended.
 */
export function useBusyAnnouncement(
  loading: boolean,
  mode: Mode,
  mfaChallenge: MfaChallenge | null,
): string {
  const [announcement, setAnnouncement] = useState('');
  const message = busyMessage(mode, mfaChallenge);

  useEffect(() => {
    if (!loading) return;
    // a region only announces on a change, so a retry must start empty
    setAnnouncement('');
    const timeoutId = window.setTimeout(
      () => setAnnouncement(message),
      ANNOUNCE_DELAY_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [loading, message]);

  // an inline arrow would reschedule the clear timer on every render
  const clearAnnouncement = useCallback(() => setAnnouncement(''), []);

  useTransientState(announcement, '', clearAnnouncement, CLEAR_DELAY_MS);

  return announcement;
}
