import CodeBlock from '../common/CodeBlock';
import CurlExample from './CurlExample';
import MethodBadge from './MethodBadge';
import ParameterTable from './ParameterTable';
import ResponseTabs from './ResponseTabs';
import SchemaTable from './SchemaTable';
import SectionPanel from './SectionPanel';
import SlidingTabBar from '../common/SlidingTabBar';
import { buildExampleFromSchema } from '../../lib/apiDocs/buildExampleFromSchema';
import { endpointHeadingId } from './endpointId';
import { useState } from 'react';
import type { NormalizedEndpoint } from '../../lib/openapi';

/**
 * The detail half of the master-detail reference: the full documentation for
 * the ONE selected endpoint, rendered as a labelled `<section>` region with
 * the mount-bundle card chrome and header shape of `SettingsGroup`.
 *
 * The body is split into up to TWO top-level tab pills (`SlidingTabBar`, hosted
 * on `mount` so the bar lifts to orbit) over sibling tabpanels:
 *   - **Request**  – ALWAYS present. A read-only `ParameterTable` per non-empty
 *     location group – Query Parameters first, then Path Parameters – plus the
 *     request-body `SchemaTable` (each shown only when the endpoint has them),
 *     a static example request-body `CodeBlock` (only when there is a request
 *     body), and – DOM-last – the copy-ready `CurlExample`. The cURL example is
 *     the universal, auth-stable reference content that anchors this panel: it
 *     always renders a native Copy button, so the Request tab is never empty
 *     and always reachable, even for a param-less, body-less endpoint.
 *   - **Response** – the `ResponseTabs` status-code sub-tablist. Suppressed
 *     (tab AND panel) only when the endpoint documents no responses.
 *
 * Request is the always-present ANCHOR, so the tab set only ever grows/shrinks
 * with the endpoint's RESPONSE shape (`endpoint.responses`), never with auth.
 * After removing the live "try it out" form, NO rendered node is auth-gated –
 * that is the SC 3.2.3 guarantee: the tab set (and everything inside it) is
 * identical logged-in and logged-out. Inactive panels stay MOUNTED and
 * `hidden`, never unmounted, so the response sub-tab's selection survives a tab
 * round-trip.
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
 * target AND the stable root the section tab/panel and example-block ids derive
 * from.
 *
 * Selecting a pill is a PURE state change with no focus move (focus stays on
 * the tab). Endpoint-swap focus (to the `<h3>`) is a disjoint trigger owned by
 * the parent, which remounts this component via its `key`; that fresh mount
 * re-initializes the tab selection back to the first section for free.
 */

interface EndpointDetailProps {
  endpoint: NormalizedEndpoint;
  /** Origin the cURL example targets; empty string means same-origin. */
  serverOrigin: string;
}

type SectionKey = 'request' | 'response';

export default function EndpointDetail({
  endpoint,
  serverOrigin,
}: EndpointDetailProps) {
  const headingId = endpointHeadingId(endpoint.method, endpoint.path);
  const accessibleMethod = endpoint.method.toUpperCase();

  // empty serverOrigin means same-origin (proxy), so use current origin
  const baseUrl = serverOrigin === '' ? window.location.origin : serverOrigin;
  const fullUrl = `${baseUrl}${endpoint.path}`;
  const exampleBody = endpoint.requestBody
    ? JSON.stringify(
        buildExampleFromSchema(endpoint.requestBody.schema),
        null,
        2,
      )
    : null;

  // one captioned table per non-empty location group (query, then path)
  const queryParameters = endpoint.parameters.filter(
    (parameter) => parameter.location === 'query',
  );
  const pathParameters = endpoint.parameters.filter(
    (parameter) => parameter.location === 'path',
  );

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
  };

  // response is suppressed only when the endpoint documents no responses
  const showResponse = endpoint.responses.length > 0;

  const sections: SectionKey[] = ['request'];
  if (showResponse) sections.push('response');

  const [selectedIndex, setSelectedIndex] = useState(0);

  // defensive clamp so a stale index falls back to the last section
  const activeIndex = Math.min(selectedIndex, sections.length - 1);

  const requestActive = sections.indexOf('request') === activeIndex;
  const responseActive = sections.indexOf('response') === activeIndex;

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
             * sr-only span carries the full accessible name; the visible
             * path is aria-hidden to avoid announcing it twice
             */}
            <span className="sr-only">
              {accessibleMethod} {endpoint.path}
            </span>
            <span aria-hidden="true" className="break-all">
              {endpoint.path.substring(1)}
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
        activeIndex={activeIndex}
        className="w-fit mb-6 border-shadow text-xs"
        tabClassName="px-3 py-1.5"
        tabs={sections.map((section, index) => ({
          id: sectionMeta[section].tabId,
          ariaControls: sectionMeta[section].panelId,
          label: sectionMeta[section].label,
          onClick: () => setSelectedIndex(index),
        }))}
      />

      {/*
       * panels are siblings of the tablist, never descendants: nesting one
       * inside the bar would let the top-level useTabNavigation capture
       * the inner Response status tabs
       */}
      <SectionPanel
        id={sectionMeta.request.panelId}
        labelledById={sectionMeta.request.tabId}
        active={requestActive}
        hasFocusableContent
      >
        {queryParameters.length > 0 && (
          <div className="mb-6 last:mb-0">
            <ParameterTable
              caption="Query parameters"
              parameters={queryParameters}
            />
          </div>
        )}

        {pathParameters.length > 0 && (
          <div className="mb-6 last:mb-0">
            <ParameterTable
              caption="Path parameters"
              parameters={pathParameters}
            />
          </div>
        )}

        {endpoint.requestBody && (
          <div className="mb-6 last:mb-0">
            <SchemaTable
              caption="Request body"
              schema={endpoint.requestBody.schema}
            />
          </div>
        )}

        {exampleBody !== null && (
          <div className="mb-6 last:mb-0">
            <CodeBlock
              label="Example request body"
              code={exampleBody}
              labelId={`${headingId}-request-example`}
            />
          </div>
        )}

        {/*
         * DOM-last so tab order runs the read-only tables, then the
         * example CodeBlock, then the cURL Copy button and <pre>
         */}
        <CurlExample
          method={endpoint.method}
          url={fullUrl}
          body={exampleBody}
          labelId={`${headingId}-request-curl`}
        />
      </SectionPanel>

      {showResponse && (
        <SectionPanel
          id={sectionMeta.response.panelId}
          labelledById={sectionMeta.response.tabId}
          active={responseActive}
          hasFocusableContent
        >
          <ResponseTabs endpoint={endpoint} />
        </SectionPanel>
      )}
    </section>
  );
}
