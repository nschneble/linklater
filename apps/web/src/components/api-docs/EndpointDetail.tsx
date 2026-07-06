import CurlExample from './CurlExample';
import MethodBadge from './MethodBadge';
import ParameterTable from './ParameterTable';
import RequestForm from './RequestForm';
import ResponseTabs from './ResponseTabs';
import SchemaTable from './SchemaTable';
import SlidingTabBar from '../common/SlidingTabBar';
import { buildExampleFromSchema } from '../../lib/apiDocs/buildExampleFromSchema';
import { endpointHeadingId } from './endpointId';
import { FOCUS_RING } from '../../lib/styles';
import { useState } from 'react';
import type { NormalizedEndpoint } from '../../lib/openapi';

/**
 * The detail half of the master-detail reference: the full documentation for
 * the ONE selected endpoint, rendered as a labelled `<section>` region with
 * the mount-bundle card chrome and header shape of `SettingsGroup`.
 *
 * The body is split into THREE top-level tab pills (`SlidingTabBar`, hosted on
 * `mount` so the bar lifts to orbit) over three sibling tabpanels:
 *   - **Request**  – the read-only `ParameterTable` + request-body `SchemaTable`.
 *   - **Response** – the `ResponseTabs` status-code sub-tablist.
 *   - **Try It**   – the copy-ready `CurlExample` (both auth states) plus, when
 *     logged in, the live `RequestForm`.
 * A tab (and its panel) is suppressed when the panel would be empty – no
 * Request tab without parameters or a request body, no Response tab without
 * responses – mirroring the old per-block guards. Try It is ALWAYS present
 * (the cURL example fills it in both auth states), so the tab SET never shifts
 * with auth (SC 3.2.3). Inactive panels stay MOUNTED and `hidden`, never
 * unmounted: that preserves typed "try it out" state across a tab round-trip
 * (SC 3.3.7 Redundant Entry) and the response sub-tab's selection, and keeps
 * an in-flight request alive.
 *
 * The top-level tablist is deliberately named "Endpoint sections" – sharing no
 * word with the inner "Responses" tablist – and its ids live in a `-tab-`/
 * `-panel-` namespace disjoint from `ResponseTabs`' `-resp-` ids. Each
 * `useTabNavigation` binds to its OWN container ref, so the two tablist layers
 * stay independent even though one nests inside the other's panel.
 *
 * The `<h3>` is the sole accessible-name carrier of the method (CONSTRAINT B1):
 * its sr-only text reads "GET /links" – method first – so an AT user hears the
 * method without the decorative `MethodBadge` repeating it; the visible path is
 * `aria-hidden`. The heading carries `tabIndex={-1}` so the selection effect
 * (`useApiReferenceSelection`) can move focus here after a swap, landing the
 * user on the new content and letting a screen reader announce the endpoint.
 * Its DOM id (`endpointHeadingId`) is both the region's `aria-labelledby`
 * target AND the deterministic root every "try it out" field id derives from.
 *
 * Selecting a pill is a PURE state change with no focus move (focus stays on
 * the tab). Endpoint-swap focus (to the `<h3>`) is a disjoint trigger owned by
 * the parent, which remounts this component via its `key`; that fresh mount
 * re-initializes the tab selection back to the first section for free.
 *
 * Request status is reported UP via `onStatusMessage` to a single page-level
 * live region in the container, so an in-flight announcement survives this
 * component unmounting when the user selects another endpoint.
 */

interface EndpointDetailProps {
  endpoint: NormalizedEndpoint;
  /** Whether a user is signed in – gates the live "try it out" form. */
  loggedIn: boolean;
  /** Origin the "try it out" form targets; empty string means same-origin. */
  serverOrigin: string;
  /** Raw `ltk_` token; empty string ⇒ logged-out. Header-only, never rendered. */
  token: string;
  /** True while the token is still loading. */
  tokenLoading: boolean;
  /** Token-fetch error, or null. */
  tokenError: string | null;
  /** Reports the form's request-status message to the page-level live region. */
  onStatusMessage: (message: string) => void;
}

type SectionKey = 'request' | 'response' | 'tryit';

export default function EndpointDetail({
  endpoint,
  loggedIn,
  serverOrigin,
  token,
  tokenLoading,
  tokenError,
  onStatusMessage,
}: EndpointDetailProps) {
  const headingId = endpointHeadingId(endpoint.method, endpoint.path);
  const accessibleMethod = endpoint.method.toUpperCase();

  // Full request URL for the header + cURL example. An empty serverOrigin
  // means same-origin (behind a proxy), so fall back to the current origin.
  const baseUrl = serverOrigin === '' ? window.location.origin : serverOrigin;
  const fullUrl = `${baseUrl}${endpoint.path}`;
  const exampleBody = endpoint.requestBody
    ? JSON.stringify(
        buildExampleFromSchema(endpoint.requestBody.schema),
        null,
        2,
      )
    : null;

  const sectionMeta: Record<
    SectionKey,
    { label: string; tabId: string; panelId: string }
  > = {
    request: {
      label: 'Request',
      tabId: `${headingId}-tab-request`,
      panelId: `${headingId}-panel-request`,
    },
    response: {
      label: 'Response',
      tabId: `${headingId}-tab-response`,
      panelId: `${headingId}-panel-response`,
    },
    tryit: {
      label: 'Try It',
      tabId: `${headingId}-tab-tryit`,
      panelId: `${headingId}-panel-tryit`,
    },
  };

  // A tab is suppressed when its panel would be empty, mirroring the legacy
  // per-block guards, so we never ship an empty focusable panel. Try It is
  // always present (the cURL example fills it), keeping the tab set auth-stable.
  const showRequest =
    endpoint.parameters.length > 0 || endpoint.requestBody !== undefined;
  const showResponse = endpoint.responses.length > 0;

  const sections: SectionKey[] = [];
  if (showRequest) sections.push('request');
  if (showResponse) sections.push('response');
  sections.push('tryit');

  const [selectedIndex, setSelectedIndex] = useState(0);

  const requestActive = sections.indexOf('request') === selectedIndex;
  const responseActive = sections.indexOf('response') === selectedIndex;
  const tryitActive = sections.indexOf('tryit') === selectedIndex;

  return (
    <section
      aria-labelledby={headingId}
      className="p-6 bg-[var(--mount-bg)] border border-[var(--mount-border)] rounded-2xl animate-fade-in-up motion-reduce:animate-none"
    >
      <header className="flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-3">
          <MethodBadge method={endpoint.method} />
          <h3
            className="text-[var(--mount-text)] text-base font-mono"
            id={headingId}
            tabIndex={-1}
          >
            {/*
             * sr-only span carries the full "GET /links" accessible name.
             * The visible path is aria-hidden to avoid announcing the path
             * twice.
             */}
            <span className="sr-only">
              {accessibleMethod} {endpoint.path}
            </span>
            <span aria-hidden="true" className="break-all">
              {endpoint.path}
            </span>
          </h3>
        </div>
        {endpoint.summary && (
          <p className="text-[var(--mount-alt-text)] text-xs">
            {endpoint.summary}
          </p>
        )}
        {endpoint.description && (
          <p className="text-[var(--mount-alt-text)] text-xs leading-relaxed text-pretty">
            {endpoint.description}
          </p>
        )}
      </header>

      <SlidingTabBar
        ariaLabel="Endpoint sections"
        surface="mount"
        activeIndex={selectedIndex}
        className="mb-6"
        tabs={sections.map((section, index) => ({
          id: sectionMeta[section].tabId,
          ariaControls: sectionMeta[section].panelId,
          label: sectionMeta[section].label,
          onClick: () => setSelectedIndex(index),
        }))}
      />

      {/*
       * Panels are SIBLINGS of the tablist (never descendants): nesting one
       * inside the bar would let the top-level `useTabNavigation` capture the
       * inner Response status tabs. The Request panel holds only read-only
       * tables, so it takes `tabIndex={0}` to be reachable by keyboard; the
       * Response and Try It panels omit it because they contain focusable
       * children.
       */}
      {showRequest && (
        <div
          role="tabpanel"
          id={sectionMeta.request.panelId}
          aria-labelledby={sectionMeta.request.tabId}
          hidden={!requestActive}
          tabIndex={0}
          className={FOCUS_RING}
        >
          {endpoint.parameters.length > 0 && (
            <div className="mb-4 last:mb-0">
              <ParameterTable
                caption="Parameters"
                parameters={endpoint.parameters}
              />
            </div>
          )}

          {endpoint.requestBody && (
            <div className="mb-4 last:mb-0">
              <SchemaTable
                caption="Request body"
                schema={endpoint.requestBody.schema}
              />
            </div>
          )}
        </div>
      )}

      {showResponse && (
        <div
          role="tabpanel"
          id={sectionMeta.response.panelId}
          aria-labelledby={sectionMeta.response.tabId}
          hidden={!responseActive}
        >
          <ResponseTabs endpoint={endpoint} />
        </div>
      )}

      <div
        role="tabpanel"
        id={sectionMeta.tryit.panelId}
        aria-labelledby={sectionMeta.tryit.tabId}
        hidden={!tryitActive}
      >
        <CurlExample
          method={endpoint.method}
          url={fullUrl}
          body={exampleBody}
        />

        {/*
         * Live "try it out" is logged-in only. A public visitor gets the static
         * cURL example above and no request affordance (CONSTRAINT §6).
         */}
        {loggedIn && (
          <RequestForm
            endpoint={endpoint}
            headingId={headingId}
            serverOrigin={serverOrigin}
            token={token}
            loading={tokenLoading}
            error={tokenError}
            onStatusMessage={onStatusMessage}
          />
        )}
      </div>
    </section>
  );
}
