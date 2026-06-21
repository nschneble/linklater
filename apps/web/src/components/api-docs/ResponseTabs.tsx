import SchemaTable from './SchemaTable';
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
 * revealed content: a response detail is 100% read-only (a table or a static
 * paragraph, no focusable widget), so the WAI-ARIA tabs roving-tabindex model
 * cannot collide with a form the way `EndpointNav`'s `RequestForm` would. These
 * are alternate VIEWS of one section, not navigation targets (no URL/hash, not
 * bookmarkable) – textbook tabs.
 *
 * Activation is AUTOMATIC (selection follows arrow focus): the panel swap is
 * instantaneous with no network or form state to lose, so there is deliberately
 * NO focus management – the selected tab keeps focus while the shared panel's
 * `aria-labelledby` updates silently. Roving tabindex keeps the whole tablist a
 * single Tab stop (selected tab `tabIndex={0}`, the rest `-1`); the panel is
 * `tabIndex={0}` so a keyboard user can Tab in to read it.
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const panelId = `${endpointHeadingId(endpoint.method, endpoint.path)}-resp-panel`;

  // Arrow/Home/End keyboard navigation comes from the shared hook: it focuses
  // the destination tab and fires its click, so selection follows focus
  // through `onClick` below (automatic activation). The selected tab keeps
  // focus; the re-render flips the roving tabindex onto it.
  const tablistReference = useRef<HTMLDivElement>(null);
  useTabNavigation(tablistReference);

  const selectedResponse = responses[selectedIndex];

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
        aria-labelledby={responseTabId(endpoint, selectedResponse)}
        tabIndex={0}
        className={FOCUS_RING}
      >
        {selectedResponse.schema ? (
          <SchemaTable
            caption={`${selectedResponse.statusCode} response body`}
            schema={selectedResponse.schema}
          />
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
