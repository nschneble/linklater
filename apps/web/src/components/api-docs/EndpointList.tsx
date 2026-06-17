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
 * The fetch lives here (the page is async). The pending state is a polite
 * sr-only status + a decorative spinner; a failure renders a role="alert"
 * message; an empty spec renders plain text. Colors are brand-locked.
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

  if (loadState.status === 'loading') {
    return (
      <p
        role="status"
        className="flex items-center gap-3 px-4 py-6 text-dazed text-sm"
      >
        <i className="fa-solid fa-arrows-rotate fa-spin" aria-hidden="true" />
        Loading the API documentation…
      </p>
    );
  }

  if (loadState.status === 'error') {
    return (
      <p role="alert" className="px-4 py-6 text-dazed text-sm">
        {loadState.message}
      </p>
    );
  }

  if (loadState.api.endpoints.length === 0) {
    return (
      <p className="px-4 py-6 text-dazed text-sm">
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
