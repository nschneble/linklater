import { endpointHeadingId, endpointSlug } from './endpointId';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { NormalizedEndpoint } from '../../lib/openapi';

/**
 * DOM id of the welcome/overview panel heading. The selection effect focuses
 * this when the user returns to the overview (empty hash), the same way it
 * focuses an endpoint's heading on selection.
 */
export const WELCOME_HEADING_ID = 'api-docs-overview-heading';

interface UseApiReferenceSelectionResult {
  /** The selected endpoint's bare slug, or `''` for the welcome panel. */
  selectedSlug: string;
  /** The selected endpoint, or `null` when the welcome panel is showing. */
  selectedEndpoint: NormalizedEndpoint | null;
  /** Select an endpoint by slug; pass `''` to return to the welcome panel. */
  selectEndpoint: (slug: string) => void;
}

/**
 * Owns which endpoint the master-detail reference is showing, driven by the
 * URL hash (`/api-docs#get-links`) so a selection is bookmarkable, shareable,
 * and survives a refresh. An empty or unrecognized hash resolves to the
 * welcome panel.
 *
 * The hash is the single source of truth – `selectedEndpoint` is derived from
 * `location.hash` against the loaded endpoints, so there is no second copy of
 * "what's selected" to drift. `selectEndpoint` just writes the hash.
 *
 * Focus management (per the accessibility brief): when the user DELIBERATELY
 * selects (`selectEndpoint`), focus moves to the newly shown panel's heading
 * after it renders, which both lands the user on the swapped content and lets
 * a screen reader announce the new endpoint. Focus is NOT stolen on initial
 * load, on async spec arrival, or on browser Back/Forward – only an explicit
 * `selectEndpoint` arms the focus move (`pendingFocusRef`), so a deep-linked
 * page load leaves focus at the document start where the skip links live.
 */
export function useApiReferenceSelection(
  endpoints: NormalizedEndpoint[],
): UseApiReferenceSelectionResult {
  const location = useLocation();
  const navigate = useNavigate();

  const rawHash = location.hash.replace(/^#/, '');
  const matched =
    endpoints.find(
      (endpoint) => endpointSlug(endpoint.method, endpoint.path) === rawHash,
    ) ?? null;
  const selectedSlug = matched
    ? endpointSlug(matched.method, matched.path)
    : '';

  // Armed only by an explicit selectEndpoint call so data-driven or
  // history-driven slug changes never steal focus (see the WHY block).
  const pendingFocusRef = useRef(false);

  function selectEndpoint(slug: string) {
    pendingFocusRef.current = true;
    navigate({ hash: slug === '' ? '' : `#${slug}` });
  }

  useEffect(() => {
    if (!pendingFocusRef.current) return;
    pendingFocusRef.current = false;
    const headingId = matched
      ? endpointHeadingId(matched.method, matched.path)
      : WELCOME_HEADING_ID;
    document
      .getElementById(headingId)
      ?.focus({ preventScroll: true } as FocusOptions);
    // Re-run when the resolved selection changes; `matched` is recomputed each
    // render from the same hash, so keying on the slug is sufficient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlug]);

  return { selectedSlug, selectedEndpoint: matched, selectEndpoint };
}
