import { useCallback, useEffect, useState } from 'react';
import { useTransientState } from '../../lib/hooks/useTransientState';
import type { MfaChallenge, Mode } from './useAuthForm';

// under a second the busy line only queues ahead of the error that ends
// the wait; the same threshold `useOAuthArrivalError` announces on
const ANNOUNCE_DELAY_MS = 1000;

// backstop for a wait that never reports an outcome; 8s outlasts reading it
const CLEAR_DELAY_MS = 8000;

/*
 * Never the submit button's own label. An identical string in both places
 * is read twice, once as the control's name and once as the region's text,
 * which is the bug `ExtensionAuthorizePage` documents.
 */
const BUSY_MESSAGE: Record<Mode, string> = {
  login: 'Signing you in…',
  register: 'Creating your account…',
  'forgot-password': 'Sending your reset link…',
};

const MFA_BUSY_MESSAGE = 'Checking your code…';

function busyMessage(mode: Mode, mfaChallenge: MfaChallenge | null): string {
  if (mfaChallenge) return MFA_BUSY_MESSAGE;
  return BUSY_MESSAGE[mode];
}

/**
 * Text for an always-mounted polite region naming the wait a submit opens.
 * Empty until the submit has been out for a full second, so a request that
 * resolves inside that window says nothing at all.
 *
 * Emptied when the wait ends, so the line cannot sit beside the error that
 * ended it. Emptying is silent: `aria-relevant` defaults to `additions
 * text`, which the spec says excludes the removed text from what is
 * spoken, so the clear costs no announcement of its own. The timer behind
 * it stays as the backstop for a wait that never ends.
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
    // a region only announces on a change, so a retry must start empty
    setAnnouncement('');
    if (!loading) return;
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
