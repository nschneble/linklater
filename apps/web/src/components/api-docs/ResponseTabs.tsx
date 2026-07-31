import CodeBlock from '../common/CodeBlock';
import SchemaTable from './SchemaTable';
import { buildExampleFromSchema } from '../../lib/apiDocs/buildExampleFromSchema';
import { endpointHeadingId } from './endpointId';
import { FOCUS_RING } from '../../lib/styles';
import { useRef, useState } from 'react';
import { useTabNavigation } from '../../lib/hooks/useTabNavigation';
import type { NormalizedEndpoint, NormalizedResponse } from '../../lib/openapi';

/**
 * Master-detail view of an endpoint's HTTP responses: a horizontal row of
 * status-code tabs over a SINGLE reusable detail pane showing only the
 * selected response's body (its `SchemaTable`) or a "No response body"
 * fallback. The first response is selected on render, so the pane is never
 * empty when responses exist.
 *
 * This is a TRUE tablist (`role="tablist"`/`tab`/`tabpanel`), unlike the
 * sibling `EndpointNav` which stays plain buttons. The deciding factor is the
 * revealed content: a response detail carries no interactive FORM widget - only
 * read-only content (a schema table, a static paragraph, and, when a schema is
 * present, a scrollable example CodeBlock whose `<pre>` is focusable-but-read-
 * only). None of these participate in the tablist's roving tabindex (which
 * lives only on the tab buttons), so the WAI-ARIA tabs model cannot collide
 * with an interactive form widget the way a tablist wrapping editable fields
 * would. These are alternate VIEWS of one section, not navigation targets (no
 * URL/hash, not bookmarkable) - textbook tabs.
 *
 * Activation is AUTOMATIC (selection follows arrow focus): the panel swap is
 * instantaneous with no network or form state to lose, so there is deliberately
 * NO focus management - the selected tab keeps focus while the shared panel's
 * `aria-labelledby` updates silently. Roving tabindex keeps the whole tablist a
 * single Tab stop (selected tab `tabIndex={0}`, the rest `-1`). The panel is
 * itself the keyboard focus stop (`tabIndex={0}`) ONLY when it holds no
 * focusable descendant; when a schema's example CodeBlock is present that
 * `<pre>` is the focus stop and the panel drops its tab stop - see the
 * `hasFocusableContent` guard below.
 *
 * Selection is color-redundant per SC 1.4.1: the status DIGITS carry the
 * meaning (no 2xx-green/4xx-red coding, following `MethodBadge` precedent), and
 * selected-vs-unselected is signalled FOUR non-color ways - `--orbit-bg` fill,
 * `--orbit-border` ring, `font-semibold`, and `--orbit-text` - all driven off
 * `aria-selected` via Tailwind variants so the visual and ARIA state can never
 * drift. The orbit accent risks vanishing against the `--mount-bg` card it sits
 * on (accent ≈ card surface in dark themes); the `--orbit-border` vs
 * `--mount-bg` pair is mechanized at 3:1 in `bundles.contrast.test.ts`.
 */

interface ResponseTabsProps {
  endpoint: NormalizedEndpoint;
}

/** Stable, collision-free DOM id for one response's tab. */
function responseTabId(
  endpoint: NormalizedEndpoint,
  response: NormalizedResponse,
): string {
  const root = endpointHeadingId(endpoint.method, endpoint.path);
  return `${root}-resp-tab-${response.statusCode}`;
}

/** Accessible name for a tab: "401 Unauthorized", or "Response 401" if bare. */
function responseTabLabel(response: NormalizedResponse): string {
  if (response.description) {
    return `${response.statusCode} ${response.description}`;
  }
  return `Response ${response.statusCode}`;
}

export default function ResponseTabs({ endpoint }: ResponseTabsProps) {
  const { responses } = endpoint;
  const root = endpointHeadingId(endpoint.method, endpoint.path);
  const panelId = `${root}-resp-panel`;

  // panel tabIndex is focus-loss-safe only because select follows tab activation; don't add hover/deep-link select
  const [selectedIndex, setSelectedIndex] = useState(0);

  // shared hook drives arrow/Home/End nav: focuses + clicks the target tab
  const tablistReference = useRef<HTMLDivElement>(null);
  useTabNavigation(tablistReference);

  const selectedResponse = responses[selectedIndex];
  // single source for panel focusability; assumes SchemaTable has no focusable rows, widen if that ever changes
  const hasFocusableContent = selectedResponse.schema !== undefined;

  const REASON_PHRASES: Record<string, string> = {
    '200': 'OK',
    '201': 'Created',
    '400': 'Bad Request',
    '401': 'Unauthorized',
    '404': 'Not Found',
  };

  return (
    <div className="mb-6 last:mb-0">
      <p className="pb-2 text-[var(--mount-text)] text-sm font-semibold text-left text-nowrap">
        HTTP statuses
      </p>
      <div
        ref={tablistReference}
        role="tablist"
        aria-label="Responses"
        aria-orientation="horizontal"
        className="flex flex-wrap gap-2 mb-3"
      >
        {responses.map((response, index) => {
          const isSelected = index === selectedIndex;
          const tabId = responseTabId(endpoint, response);
          return (
            <button
              key={response.statusCode}
              type="button"
              role="tab"
              id={tabId}
              aria-selected={isSelected}
              aria-controls={panelId}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setSelectedIndex(index)}
              className={`min-h-10 px-3 py-1.5 bg-transparent aria-selected:bg-[var(--orbit-bg)] border border-transparent aria-selected:border-[var(--orbit-border)] text-[var(--base-alt-text)] hover:text-[var(--orbit-text)] aria-selected:text-[var(--orbit-text)] text-sm font-medium aria-selected:font-semibold ${FOCUS_RING} rounded-lg motion-safe:[transition:background-color_150ms,color_150ms] cursor-pointer`}
            >
              <span className="sr-only">{responseTabLabel(response)}</span>
              <span aria-hidden="true" className="font-mono">
                {response.statusCode} {REASON_PHRASES[response.statusCode]}
              </span>
            </button>
          );
        })}
      </div>

      <p className="my-6 text-[var(--mount-alt-text)] text-sm">
        {selectedResponse.description}
      </p>

      <div
        role="tabpanel"
        id={panelId}
        // labelledby points only at the selected tab, not the CodeBlock label
        aria-labelledby={responseTabId(endpoint, selectedResponse)}
        tabIndex={hasFocusableContent ? undefined : 0}
        className={hasFocusableContent ? undefined : FOCUS_RING}
      >
        {hasFocusableContent ? (
          <>
            <SchemaTable
              caption="Response body"
              schema={selectedResponse.schema}
            />
            <div className="mt-4">
              <CodeBlock
                label="Example response body"
                code={JSON.stringify(
                  buildExampleFromSchema(selectedResponse.schema),
                  null,
                  2,
                )}
                labelId={`${root}-response-example`}
              />
            </div>
          </>
        ) : (
          <div className="text-[var(--mount-text)] text-sm">
            <p className="pb-2 font-semibold">Response body</p>
            <p className="px-3 py-2.5 italic">None</p>
          </div>
        )}
      </div>
    </div>
  );
}
