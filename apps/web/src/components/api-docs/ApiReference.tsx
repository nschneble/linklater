import EndpointDetail from './EndpointDetail';
import EndpointNav from './EndpointNav';
import EndpointNavCompact from './EndpointNavCompact';
import WelcomePanel from './WelcomePanel';
import { endpointHeadingId } from './endpointId';
import { fetchOpenApi, resolveOpenApiUrl } from '../../lib/openapi';
import { useApiDocsToken } from './useApiDocsToken';
import {
  useApiReferenceSelection,
  WELCOME_HEADING_ID,
} from './useApiReferenceSelection';
import { useAuth } from '../../auth/AuthContext';
import { useEffect, useState } from 'react';
import type { NormalizedApi } from '../../lib/openapi';

/**
 * The master-detail API reference: an endpoint nav on the left, one swapping
 * detail region on the right (mirroring the Settings page). Owns the spec
 * fetch, the hidden-token fetch, the hash-driven selection, and the TWO
 * page-level live regions that must survive the detail swapping.
 *
 * Both `role="status"` regions live HERE, outside the swapping detail: the
 * load-state region announces spec loading/ready/error, and the request-status
 * region carries the "try it out" form's announcements UP from the detail (via
 * `onStatusMessage`) so an in-flight request announcement is not cut off when
 * the user selects another endpoint and that form unmounts. The visible UI is
 * aria-hidden from announcement — the regions are the sole announcers.
 */

interface ApiReferenceProps {
  /** `VITE_API_BASE_URL`; resolves `/openapi.json` (absolute) or same-origin. */
  apiBaseUrl: string | undefined;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; api: NormalizedApi };

export default function ApiReference({ apiBaseUrl }: ApiReferenceProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [requestStatus, setRequestStatus] = useState('');
  const { token, loading: tokenLoading, error: tokenError } = useApiDocsToken();
  const { user } = useAuth();

  useEffect(() => {
    let isActive = true;
    fetchOpenApi(resolveOpenApiUrl(apiBaseUrl))
      .then((api) => {
        if (isActive) setLoadState({ status: 'ready', api });
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        const message =
          error instanceof Error ? error.message : 'Something went wrong';
        setLoadState({ status: 'error', message });
      });
    return () => {
      isActive = false;
    };
  }, [apiBaseUrl]);

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {describeLoadState(loadState)}
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {requestStatus}
      </p>
      {loadState.status === 'ready' ? (
        <Reference
          api={loadState.api}
          loggedIn={user !== null}
          token={token}
          tokenLoading={tokenLoading}
          tokenError={tokenError}
          onStatusMessage={setRequestStatus}
        />
      ) : (
        <p
          aria-hidden="true"
          className="flex items-center gap-3 px-1 py-6 text-[var(--mount-text)] text-sm"
        >
          {loadState.status === 'loading' && (
            <i
              className="fa-solid fa-arrows-rotate fa-spin"
              aria-hidden="true"
            />
          )}
          {loadState.status === 'loading'
            ? 'Loading the API documentation…'
            : loadState.message}
        </p>
      )}
    </>
  );
}

interface ReferenceProps {
  api: NormalizedApi;
  loggedIn: boolean;
  token: string;
  tokenLoading: boolean;
  tokenError: string | null;
  onStatusMessage: (message: string) => void;
}

/** The loaded master-detail layout (only mounted once the spec is ready). */
function Reference({
  api,
  loggedIn,
  token,
  tokenLoading,
  tokenError,
  onStatusMessage,
}: ReferenceProps) {
  const { selectedSlug, selectedEndpoint, selectEndpoint } =
    useApiReferenceSelection(api.endpoints);

  if (api.endpoints.length === 0) {
    return (
      <p
        aria-hidden="true"
        className="px-1 py-6 text-[var(--mount-text)] text-sm"
      >
        No endpoints are documented yet.
      </p>
    );
  }

  const detailHeadingId = selectedEndpoint
    ? endpointHeadingId(selectedEndpoint.method, selectedEndpoint.path)
    : WELCOME_HEADING_ID;

  function handleSkipToDetails() {
    document
      .getElementById(detailHeadingId)
      ?.focus({ preventScroll: true } as FocusOptions);
  }

  return (
    <>
      {/* Bypass the endpoint nav: jump straight to the detail heading. A button
          (not an anchor) because the URL hash already encodes the selection —
          a fragment href would overwrite it. */}
      <button
        type="button"
        onClick={handleSkipToDetails}
        className="sr-only focus:not-sr-only focus:inline-flex focus:items-center focus:mb-2 focus:px-3 focus:py-1.5 focus:bg-[var(--mount-bg)] focus:text-[var(--mount-text)] focus:text-xs focus:font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:rounded-lg"
      >
        Skip to endpoint details
      </button>
      <div className="grid grid-cols-1 md:grid-cols-[14rem_minmax(0,1fr)] gap-6 md:gap-10">
        <EndpointNav
          endpoints={api.endpoints}
          selectedSlug={selectedSlug}
          onSelect={selectEndpoint}
        />
        <div className="min-w-0 space-y-4">
          <EndpointNavCompact
            endpoints={api.endpoints}
            selectedSlug={selectedSlug}
            onSelect={selectEndpoint}
          />
          {selectedEndpoint ? (
            <EndpointDetail
              key={selectedSlug}
              endpoint={selectedEndpoint}
              serverOrigin={api.serverOrigin}
              token={token}
              tokenLoading={tokenLoading}
              tokenError={tokenError}
              onStatusMessage={onStatusMessage}
            />
          ) : (
            <WelcomePanel serverOrigin={api.serverOrigin} loggedIn={loggedIn} />
          )}
        </div>
      </div>
    </>
  );
}

/** Polite-region text for the current spec load state (pluralized count). */
function describeLoadState(loadState: LoadState): string {
  if (loadState.status === 'loading') return 'Loading the API documentation…';
  if (loadState.status === 'error') return loadState.message;
  const count = loadState.api.endpoints.length;
  if (count === 0) return 'No endpoints are documented yet.';
  return `${count} ${count === 1 ? 'endpoint' : 'endpoints'} loaded.`;
}
