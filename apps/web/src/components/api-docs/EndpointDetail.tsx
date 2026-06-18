import MethodBadge from './MethodBadge';
import ParameterTable from './ParameterTable';
import RequestForm from './RequestForm';
import SchemaTable from './SchemaTable';
import { endpointHeadingId } from './endpointId';
import type { NormalizedEndpoint } from '../../lib/openapi';

/**
 * The detail half of the master-detail reference: the full documentation for
 * the ONE selected endpoint, rendered as a labelled `<section>` region with
 * the mount-bundle card chrome and header shape of `SettingsGroup`. No
 * disclosure — the selected endpoint's content is always shown.
 *
 * The `<h3>` is the sole accessible-name carrier of the method (CONSTRAINT B1):
 * its sr-only text reads "GET /links" — method first — so an AT user hears the
 * method without the decorative `MethodBadge` repeating it; the visible path is
 * `aria-hidden`. The heading carries `tabIndex={-1}` so the selection effect
 * (`useApiReferenceSelection`) can move focus here after a swap, landing the
 * user on the new content and letting a screen reader announce the endpoint.
 * Its DOM id (`endpointHeadingId`) is both the region's `aria-labelledby`
 * target AND the deterministic root every "try it out" field id derives from.
 *
 * Request status is reported UP via `onStatusMessage` to a single page-level
 * live region in the container, so an in-flight announcement survives this
 * component unmounting when the user selects another endpoint.
 */

/** A decorative Font Awesome icon per HTTP method, for personality in the header. */
const METHOD_ICONS: Record<string, string> = {
  GET: 'fa-magnifying-glass',
  POST: 'fa-plus',
  PUT: 'fa-pen',
  PATCH: 'fa-pen',
  DELETE: 'fa-trash-can',
};

interface EndpointDetailProps {
  endpoint: NormalizedEndpoint;
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

export default function EndpointDetail({
  endpoint,
  serverOrigin,
  token,
  tokenLoading,
  tokenError,
  onStatusMessage,
}: EndpointDetailProps) {
  const headingId = endpointHeadingId(endpoint.method, endpoint.path);
  const accessibleMethod = endpoint.method.toUpperCase();
  const methodIcon = METHOD_ICONS[accessibleMethod] ?? 'fa-code';

  return (
    <section
      aria-labelledby={headingId}
      className="p-5 sm:p-6 bg-[var(--mount-bg)] border border-[var(--mount-border)] rounded-2xl animate-fade-in-up motion-reduce:animate-none"
    >
      <header className="mb-5">
        <div className="flex items-center gap-3">
          <i
            className={`fa-solid ${methodIcon} text-[var(--mount-alt-text)] text-sm`}
            aria-hidden="true"
          />
          <MethodBadge method={endpoint.method} />
          <h3
            id={headingId}
            tabIndex={-1}
            className="text-[var(--mount-text)] text-base font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded"
          >
            {/*
             * sr-only span carries the full "GET /links" accessible name in one
             * text node so the accessible-name algorithm can't collapse the
             * method/path boundary space (CONSTRAINT B1). The visible path is
             * aria-hidden to avoid announcing the path twice.
             */}
            <span className="sr-only">
              {accessibleMethod} {endpoint.path}
            </span>
            <span aria-hidden="true">{endpoint.path}</span>
          </h3>
        </div>
        {endpoint.summary && (
          <p className="mt-3 text-[var(--mount-text)] text-sm font-semibold">
            {endpoint.summary}
          </p>
        )}
        {endpoint.description && (
          <p className="mt-1 text-[var(--mount-alt-text)] text-sm leading-relaxed text-pretty">
            {endpoint.description}
          </p>
        )}
      </header>

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
        onStatusMessage={onStatusMessage}
      />
    </section>
  );
}
