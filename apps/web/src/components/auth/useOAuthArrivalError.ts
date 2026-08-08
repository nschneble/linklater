import { authErrorMessage } from './authFlashMessages';
import { useFlashQueryParameters } from '../../lib/hooks/useFlashQueryParameters';
import { useLocation } from 'react-router';
import { useReannounce } from '../../lib/hooks/useReannounce';
import { useState } from 'react';

const ERROR_PARAMETER = 'error';
const PROVIDER_PARAMETER = 'provider';

/**
 * Screen readers suppress live regions during the page-load window, and a
 * region populated on first paint is read as part of the page rather than
 * announced. Nothing on this arrival waits on the network, so there is no
 * natural delay to hide behind: hold the announcement back by hand.
 */
const ANNOUNCE_DELAY_MS = 1000;

function readArrivalError(parameters: URLSearchParams): string | null {
  const code = parameters.get(ERROR_PARAMETER);
  if (!code) return null;
  return authErrorMessage(code, parameters.get(PROVIDER_PARAMETER));
}

export interface OAuthArrivalError {
  /** Text for an always-mounted sr-only region. Empty until the delay ends. */
  announcement: string;
  /** Whether this render's URL carried an error code. Fixed at mount. */
  arrived: boolean;
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

  const [arrived] = useState(() =>
    new URLSearchParams(location.search).has(ERROR_PARAMETER),
  );

  const message = useFlashQueryParameters(readArrivalError, [
    ERROR_PARAMETER,
    PROVIDER_PARAMETER,
  ]);

  const announcement = useReannounce(
    message === null ? 0 : 1,
    message ?? '',
    ANNOUNCE_DELAY_MS,
  );

  return { announcement, arrived, message };
}
