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
 * revealed content: a response detail carries no interactive FORM widget — only
 * read-only content (a schema table, a static paragraph, and, when a schema is
 * present, a scrollable example CodeBlock whose `<pre>` is focusable-but-read-
 * only). None of these participate in the tablist's roving tabindex (which
 * lives only on the tab buttons), so the WAI-ARIA tabs model cannot collide
 * with an interactive form widget the way a tablist wrapping editable fields
 * would. These are alternate VIEWS of one section, not navigation targets (no
 * URL/hash, not bookmarkable) – textbook tabs.
 *
 * Activation is AUTOMATIC (selection follows arrow focus): the panel swap is
 * instantaneous with no network or form state to lose, so there is deliberately
 * NO focus management – the selected tab keeps focus while the shared panel's
 * `aria-labelledby` updates silently. Roving tabindex keeps the whole tablist a
 * single Tab stop (selected tab `tabIndex={0}`, the rest `-1`). The panel is
 * itself the keyboard focus stop (`tabIndex={0}`) ONLY when it holds no
 * focusable descendant; when a schema's example CodeBlock is present that
 * `<pre>` is the focus stop and the panel drops its tab stop – see the
 * `hasFocusableContent` guard below.
 *
 * Selection is color-redundant per SC 1.4.1: the status DIGITS carry the
 * meaning (no 2xx-green/4xx-red coding, following `MethodBadge` precedent), and
 * selected-vs-unselected is signalled FOUR non-color ways – `--orbit-bg` fill,
 * `--orbit-border` ring, `font-semibold`, and `--orbit-text` – all driven off
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

  // GUARD: the dynamic panel tabIndex/ring below (driven by hasFocusableContent)
  // is focus-loss-safe (SC 2.4.3) ONLY because selection is driven EXCLUSIVELY
  // by tab ACTIVATION — arrow-auto-activate, click, Enter/Space — which always
  // holds focus ON A TAB, never on the shared panel. So the panel's tabIndex
  // only ever flips while focus is upstream in the tablist, never on the panel
  // itself. Do NOT add hover-select, programmatic select, or deep-link
  // auto-select without an explicit focus move: any such path could drop the
  // panel's tab stop while focus sits on it, reintroducing the focus-loss case.
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Arrow/Home/End keyboard navigation comes from the shared hook: it focuses
  // the destination tab and fires its click, so selection follows focus
  // through `onClick` below (automatic activation). The selected tab keeps
  // focus; the re-render flips the roving tabindex onto it.
  const tablistReference = useRef<HTMLDivElement>(null);
  useTabNavigation(tablistReference);

  const selectedResponse = responses[selectedIndex];
  // SINGLE SOURCE OF TRUTH for the shared panel's focusability, used THRICE
  // below (panel tabIndex, panel ring, example CodeBlock render) so the three
  // can never drift: a present response schema means the example-response
  // CodeBlock renders its OWN focusable <pre> scroll region, so the panel drops
  // its tab stop + ring (a ring on a non-focusable element is dead paint, and a
  // second tab stop would be a duplicate); a schema-less response shows only the
  // read-only "No response body" paragraph, so the panel itself stays the
  // keyboard-reachable focus stop (tabIndex={0} + ring). ASSUMPTION: SchemaTable
  // has NO focusable descendants (true today); if it ever gains sortable or
  // expandable rows, this predicate must widen to include them.
  const hasFocusableContent = selectedResponse.schema !== undefined;

  return (
    <div className="mb-4 last:mb-0">
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
              className={`min-h-10 px-3 py-1.5 bg-transparent aria-selected:bg-[var(--orbit-bg)] border border-transparent aria-selected:border-[var(--orbit-border)] text-[var(--base-alt-text)] aria-selected:text-[var(--orbit-text)] text-sm font-medium aria-selected:font-semibold ${FOCUS_RING} rounded-lg motion-safe:[transition:background-color_150ms,color_150ms] cursor-pointer`}
            >
              <span className="sr-only">{responseTabLabel(response)}</span>
              <span aria-hidden="true" className="font-mono">
                {response.statusCode}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={panelId}
        // aria-labelledby points ONLY at the selected status tab, never at the
        // CodeBlock's own label: two properly-nested named regions (panel "200"
        // ▸ group "Example response body"), kept distinct.
        aria-labelledby={responseTabId(endpoint, selectedResponse)}
        tabIndex={hasFocusableContent ? undefined : 0}
        className={hasFocusableContent ? undefined : FOCUS_RING}
      >
        {hasFocusableContent ? (
          <>
            <SchemaTable
              caption={`${selectedResponse.statusCode} response body`}
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
          <p className="text-[var(--mount-text)] text-sm">
            <span className="font-semibold">
              {selectedResponse.statusCode} response body:
            </span>{' '}
            No response body.
          </p>
        )}
      </div>
    </div>
  );
}
