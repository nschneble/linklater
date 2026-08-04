import EndpointDetail from './EndpointDetail';
import { endpointHeadingId } from './endpointId';
import EndpointNav from './EndpointNav';
import EndpointNavCompact from './EndpointNavCompact';
import { fetchOpenApi, resolveOpenApiUrl } from '../../lib/openapi';
import {
  useApiReferenceSelection,
  WELCOME_HEADING_ID,
} from './useApiReferenceSelection';
import { useEffect, useState } from 'react';
import WelcomePanel from './WelcomePanel';
import type { NormalizedApi } from '../../lib/openapi';

/**
 * The master-detail API reference: an endpoint nav on the left, one swapping
 * detail region on the right (mirroring the Settings page). Owns the spec
 * fetch, the hash-driven selection, and the page-level spec-load live region.
 *
 * The single `role="status"` region lives HERE, outside the swapping detail, so
 * its announcement survives the detail swapping: it announces spec
 * loading/ready/error. The visible UI is aria-hidden from announcement - the
 * region is the sole announcer.
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
      {loadState.status === 'ready' ? (
        <Reference api={loadState.api} />
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
}

/** The loaded master-detail layout (only mounted once the spec is ready). */
function Reference({ api }: ReferenceProps) {
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
      <button
        type="button"
        onClick={handleSkipToDetails}
        className="sr-only focus:not-sr-only focus:inline-flex focus:items-center focus:mb-2 focus:px-3 focus:py-1.5 focus:bg-[var(--mount-bg)] focus:text-[var(--mount-text)] focus:text-xs focus:font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:rounded-lg"
      >
        Skip to endpoint details
      </button>
      <div className="grid grid-cols-1 md:grid-cols-[16rem_minmax(0,1fr)] gap-6 md:gap-10">
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
            />
          ) : (
            <WelcomePanel serverOrigin={api.serverOrigin} />
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
