import { authErrorMessage } from './authFlashMessages';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFlashQueryParameters } from '../../lib/hooks/useFlashQueryParameters';
import { useLocation } from 'react-router';
import { useReannounce } from '../../lib/hooks/useReannounce';
import { useTransientState } from '../../lib/hooks/useTransientState';

const ERROR_PARAMETER = 'error';
const PROVIDER_PARAMETER = 'provider';

/**
 * Screen readers suppress live regions during the page-load window, and a
 * region populated on first paint is read as part of the page rather than
 * announced. Nothing on this arrival waits on the network, so there is no
 * natural delay to hide behind: hold the announcement back by hand.
 */
const ANNOUNCE_DELAY_MS = 1000;

/**
 * How long the announcement stays in the region before it is emptied.
 *
 * `AuthForm` does not remount across `/login`, `/signup` and
 * `/forgot-password`, so an announcement left in place outlives the visible
 * Alert that the mode change clears, and ends up the only copy of the
 * message on the page: unlabelled, last in the document, on a page with no
 * `main` landmark. Both in-repo mirrors clear for the same reason.
 *
 * Well above the 5000ms toast default because nothing paces this one. The
 * longest string is 17 words, about 5.7 seconds at a slow 180wpm, so this
 * leaves headroom without stretching the window a mode switch can strand.
 * Emptying is not itself an announcement: the default `aria-relevant` is
 * `additions text`.
 */
const CLEAR_DELAY_MS = 8000;

function readArrivalError(parameters: URLSearchParams): string | null {
  const code = parameters.get(ERROR_PARAMETER);
  if (!code) return null;
  return authErrorMessage(code, parameters.get(PROVIDER_PARAMETER));
}

export interface OAuthArrivalError {
  /** Text for an always-mounted sr-only region. Empty outside its window. */
  announcement: string;
  /** Whether the URL still being viewed is the one that carried the code. */
  arrived: boolean;
  /** Empties the announcement early, for a caller that supersedes it. */
  dismissAnnouncement: () => void;
  /** The message to paint, or `null` when the arrival was clean. */
  message: string | null;
}

/**
 * Turns the `?error=&provider=` breadcrumb an OAuth callback redirect leaves
 * on `/login` into a message to paint and a message to announce.
 *
 * The two are split because they need opposite timing. The message must
 * paint as soon as it can, since a sighted user is looking at the page right
 * now; the announcement must wait out the page-load window described on
 * `ANNOUNCE_DELAY_MS` or no screen reader hears it. Whoever paints the
 * message therefore has to suppress its live semantics, or the two channels
 * become two live regions racing over one message.
 *
 * `arrived` is captured during render rather than in an effect:
 * `useFlashQueryParameters` strips the parameters in its own mount effect,
 * so an effect that reads the URL later can find it already clean. Callers
 * need the answer before that, to decide whether to auto-focus.
 */
export function useOAuthArrivalError(): OAuthArrivalError {
  const location = useLocation();

  const [arrival] = useState(() => ({
    pathname: location.pathname,
    present: new URLSearchParams(location.search).has(ERROR_PARAMETER),
  }));

  // `arrived` suppresses auto-focus, so it has to release once the user
  // navigates on, or every later mode switch skips focus for the rest of
  // the session. latched in render, not consumed in an effect: StrictMode
  // double-invokes mount effects and would release during the arrival
  // itself. the pathname is the signal because stripping the parameters is
  // a replace that keeps it while changing `location.key`
  const leftArrival = useRef(false);
  if (location.pathname !== arrival.pathname) leftArrival.current = true;

  const message = useFlashQueryParameters(readArrivalError, [
    ERROR_PARAMETER,
    PROVIDER_PARAMETER,
  ]);

  // clear-then-set driver, mirroring useToastAnnouncement: the trigger bump
  // forces a real text-node change, and the empty pendingMessage settles
  // the region back to ''
  const [trigger, setTrigger] = useState(0);
  const [pendingMessage, setPendingMessage] = useState('');

  useEffect(() => {
    if (message === null) return;
    setPendingMessage(message);
    setTrigger((current) => current + 1);
  }, [message]);

  const announcement = useReannounce(
    trigger,
    pendingMessage,
    ANNOUNCE_DELAY_MS,
  );

  // stable setter is load-bearing: an inline arrow reschedules the timer
  const dismissAnnouncement = useCallback(() => {
    setPendingMessage('');
    setTrigger((current) => current + 1);
  }, []);

  useTransientState(announcement, '', dismissAnnouncement, CLEAR_DELAY_MS);

  return {
    announcement,
    arrived: arrival.present && !leftArrival.current,
    dismissAnnouncement,
    message,
  };
}
