import Disclosure from './Disclosure';
import MethodBadge from './MethodBadge';
import ParameterTable from './ParameterTable';
import RequestForm from './RequestForm';
import SchemaTable from './SchemaTable';
import { useRef, useState } from 'react';
import type { NormalizedEndpoint } from '../../lib/openapi';

/**
 * One API endpoint, rendered as a disclosure inside a labelled <article>
 * (CONSTRAINT S1). The <h3> is the SOLE accessible-name carrier of the method
 * (CONSTRAINT B1): its text is "GET /links" — method first, so an AT user
 * hears the method without the decorative <MethodBadge> repeating it.
 *
 * The <h3> lives inside the disclosure toggle so it becomes the toggle's
 * accessible name (CONSTRAINT E2). The <article> is labelled by the same <h3>
 * via aria-labelledby. Ids are slugged from method+path so they are unique and
 * stable across every endpoint (CONSTRAINT E4) — no useId collisions, no
 * dangling references.
 *
 * Schema regions (request body, each response) render as <SchemaTable>s with
 * their own captions rather than h4s (CONSTRAINT H3). Below them sits the
 * interactive <RequestForm> "try it out" explorer (Wave 5). The form's sr-only
 * status announcer is portaled into `statusContainerRef` — a node OUTSIDE the
 * collapsible panel (CONSTRAINT §5/§7) — so an in-flight announcement survives
 * a collapse. `onAfterCollapse` returns focus to the toggle when focus was
 * inside the panel as it hides (CONSTRAINT §7). Colors consume `--mount-*`
 * bundle tokens (brand literals when logged out, active theme when logged in).
 */

interface EndpointCardProps {
  endpoint: NormalizedEndpoint;
  /** Origin the "try it out" form targets; empty string means same-origin. */
  serverOrigin: string;
  /** Raw `ltk_` token; empty string ⇒ logged-out. Header-only, never rendered. */
  token: string;
  /** True while the token is still loading. */
  tokenLoading: boolean;
  /** Token-fetch error, or null. */
  tokenError: string | null;
}

/** Slug suitable for an id, e.g. `get-links`, `delete-links-id`. */
function toEndpointId(method: string, path: string): string {
  const slug = `${method}-${path}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `endpoint-${slug}`;
}

export default function EndpointCard({
  endpoint,
  serverOrigin,
  token,
  tokenLoading,
  tokenError,
}: EndpointCardProps) {
  const headingId = toEndpointId(endpoint.method, endpoint.path);
  const accessibleMethod = endpoint.method.toUpperCase();

  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [statusContainer, setStatusContainer] = useState<HTMLElement | null>(
    null,
  );

  // Return focus to the toggle when the panel collapses while focus is still
  // within the panel (CONSTRAINT §7) — otherwise focus would orphan onto a
  // hidden element. If focus already moved elsewhere, leave it alone.
  function handleAfterCollapse() {
    const panel = panelRef.current;
    if (panel && panel.contains(document.activeElement)) {
      toggleRef.current?.focus();
    }
  }

  return (
    <li>
      <article
        aria-labelledby={headingId}
        className="border border-[var(--mount-border)] rounded-xl"
      >
        {/*
         * The form's sr-only status announcer portals here — OUTSIDE the
         * collapsible panel — so it stays mounted (and its announcement is not
         * cut off) when the panel collapses mid-request (CONSTRAINT §5/§7).
         */}
        <div ref={setStatusContainer} />

        <Disclosure
          toggleRef={toggleRef}
          panelRef={panelRef}
          onAfterCollapse={handleAfterCollapse}
          header={
            <span className="flex items-center gap-3">
              <MethodBadge method={endpoint.method} />
              <h3
                id={headingId}
                className="text-[var(--mount-text)] text-base font-mono"
              >
                {/*
                 * sr-only span carries the full "GET /links" accessible name in
                 * one text node so the accessible-name algorithm can't collapse
                 * the method/path boundary space (CONSTRAINT B1). The visible
                 * path is aria-hidden to avoid announcing the path twice.
                 */}
                <span className="sr-only">
                  {accessibleMethod} {endpoint.path}
                </span>
                <span aria-hidden="true">{endpoint.path}</span>
              </h3>
            </span>
          }
        >
          {endpoint.summary && (
            <p className="mb-2 text-[var(--mount-text)] text-sm font-semibold">
              {endpoint.summary}
            </p>
          )}
          {endpoint.description && (
            <p className="mb-4 text-[var(--mount-alt-text)] text-sm leading-relaxed">
              {endpoint.description}
            </p>
          )}

          {endpoint.parameters.length > 0 && (
            <div className="mb-4">
              <ParameterTable
                caption="Path & query parameters"
                parameters={endpoint.parameters}
              />
            </div>
          )}

          {endpoint.requestBody && (
            <div className="mb-4">
              <SchemaTable
                caption="Request body"
                schema={endpoint.requestBody.schema}
              />
            </div>
          )}

          {endpoint.responses.map((response) => (
            <div key={response.statusCode} className="mb-4 last:mb-0">
              {response.schema ? (
                <SchemaTable
                  caption={`${response.statusCode} response body`}
                  schema={response.schema}
                />
              ) : (
                <p className="text-[var(--mount-text)] text-sm">
                  <span className="font-semibold">
                    {response.statusCode} response body:
                  </span>{' '}
                  No response body.
                </p>
              )}
            </div>
          ))}

          <RequestForm
            endpoint={endpoint}
            headingId={headingId}
            serverOrigin={serverOrigin}
            token={token}
            loading={tokenLoading}
            error={tokenError}
            statusContainer={statusContainer}
          />
        </Disclosure>
      </article>
    </li>
  );
}
