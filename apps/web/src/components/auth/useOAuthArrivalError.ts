import { authErrorMessage } from './authFlashMessages';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFlashQueryParameters } from '../../lib/hooks/useFlashQueryParameters';
import { useLocation } from 'react-router';
import { useReannounce } from '../../lib/hooks/useReannounce';
import { useTransientState } from '../../lib/hooks/useTransientState';

const ERROR_PARAMETER = 'error';
const PROVIDER_PARAMETER = 'provider';

// screen readers ignore a region populated during page load, and nothing
// here waits on the network to supply a natural delay
const ANNOUNCE_DELAY_MS = 1000;

// AuthForm survives mode changes, so an uncleared announcement outlives
// the Alert it belongs to; 8s outlasts reading the longest message
const CLEAR_DELAY_MS = 8000;

function readArrivalError(parameters: URLSearchParams): string | null {
  const code = parameters.get(ERROR_PARAMETER);
  if (!code) return null;
  return authErrorMessage(code, parameters.get(PROVIDER_PARAMETER));
}

export interface OAuthArrivalError {
  /** Text for an always-mounted sr-only region. Empty when idle. */
  announcement: string;
  /** Whether the URL on screen is the one that carried the code. */
  arrived: boolean;
  dismissAnnouncement: () => void;
  message: string | null;
}

/**
 * Turns the error breadcrumb an OAuth callback redirect leaves on the
 * login URL into a message to paint and a message to announce. The two
 * are split because they need opposite timing, so whoever paints the
 * message must suppress its live semantics or the two channels race over
 * one message. The arrival flag is captured during render because the
 * flash parameter hook strips the URL in a mount effect, leaving a later
 * reader nothing to see.
 */
export function useOAuthArrivalError(): OAuthArrivalError {
  const location = useLocation();

  const [arrival] = useState(() => ({
    pathname: location.pathname,
    present: new URLSearchParams(location.search).has(ERROR_PARAMETER),
  }));

  // latched in render because StrictMode reruns mount effects
  const leftArrival = useRef(false);
  if (location.pathname !== arrival.pathname) leftArrival.current = true;

  const message = useFlashQueryParameters(readArrivalError, [
    ERROR_PARAMETER,
    PROVIDER_PARAMETER,
  ]);

  // a live region only announces on a real text change, so bump a trigger
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

  // an inline arrow would reschedule the clear timer on every render
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
