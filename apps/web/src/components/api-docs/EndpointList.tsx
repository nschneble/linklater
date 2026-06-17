import EndpointCard from './EndpointCard';
import { fetchOpenApi, resolveOpenApiUrl } from '../../lib/openapi';
import { useEffect, useState } from 'react';
import type { NormalizedApi } from '../../lib/openapi';

/**
 * Fetches the normalized OpenAPI model and renders one <EndpointCard> per
 * endpoint inside a <ul role="list">. The explicit role="list" restores list
 * semantics that Tailwind v4's preflight strips with `list-style: none`
 * (CONSTRAINT S2) — without it, Safari + VoiceOver no longer announce the
 * group as a list.
 *
 * The fetch lives here (the page is async). A single persistent polite
 * live region (sr-only `role="status"`) stays mounted across every state and
 * only its TEXT changes — loading, then a result count on ready or the error
 * on failure — so screen-reader users get a reliable completion/error cue
 * (WCAG 4.1.3). The visible UI (spinner, error text, list, empty state) is
 * aria-hidden from announcement to avoid double-blaring; the region is the
 * sole announcer. Colors are brand-locked.
 */

interface EndpointListProps {
  /**
   * `VITE_API_BASE_URL`, threaded in so the resolution stays testable. An
   * absolute base is prefixed onto `/openapi.json`; an unset base falls back
   * to the same-origin relative path.
   */
  apiBaseUrl: string | undefined;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; api: NormalizedApi };

export default function EndpointList({ apiBaseUrl }: EndpointListProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let isActive = true;
    const openapiUrl = resolveOpenApiUrl(apiBaseUrl);

    fetchOpenApi(openapiUrl)
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
      <EndpointListBody loadState={loadState} />
    </>
  );
}

/**
 * Builds the polite live-region announcement for the current load state. The
 * count is pluralized so the ready cue reads naturally to assistive tech.
 */
function describeLoadState(loadState: LoadState): string {
  if (loadState.status === 'loading') {
    return 'Loading the API documentation…';
  }

  if (loadState.status === 'error') {
    return loadState.message;
  }

  const endpointCount = loadState.api.endpoints.length;
  if (endpointCount === 0) {
    return 'No endpoints are documented yet.';
  }

  const noun = endpointCount === 1 ? 'endpoint' : 'endpoints';
  return `${endpointCount} ${noun} loaded.`;
}

interface EndpointListBodyProps {
  loadState: LoadState;
}

/**
 * The visible UI. It carries no live-region role — the persistent sr-only
 * announcer above is the sole source of AT announcements, so this content is
 * purely visual (the error/loading text is conveyed sighted only).
 */
function EndpointListBody({ loadState }: EndpointListBodyProps) {
  if (loadState.status === 'loading') {
    return (
      <p
        aria-hidden="true"
        className="flex items-center gap-3 px-4 py-6 text-dazed text-sm"
      >
        <i className="fa-solid fa-arrows-rotate fa-spin" aria-hidden="true" />
        Loading the API documentation…
      </p>
    );
  }

  if (loadState.status === 'error') {
    return (
      <p aria-hidden="true" className="px-4 py-6 text-dazed text-sm">
        {loadState.message}
      </p>
    );
  }

  if (loadState.api.endpoints.length === 0) {
    return (
      <p aria-hidden="true" className="px-4 py-6 text-dazed text-sm">
        No endpoints are documented yet.
      </p>
    );
  }

  return (
    // role="list" is NOT redundant here: Tailwind v4's preflight sets
    // `list-style: none` on every <ul>, which makes Safari + VoiceOver drop
    // the list semantics (CONSTRAINT S2). The lint rule can't see the reset,
    // so it is disabled for this one element on purpose.
    // eslint-disable-next-line jsx-a11y/no-redundant-roles
    <ul role="list" className="flex flex-col gap-4 p-4">
      {loadState.api.endpoints.map((endpoint) => (
        <EndpointCard
          key={`${endpoint.method}-${endpoint.path}`}
          endpoint={endpoint}
        />
      ))}
    </ul>
  );
}
