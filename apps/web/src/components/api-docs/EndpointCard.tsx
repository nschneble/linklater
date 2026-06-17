import Disclosure from './Disclosure';
import MethodBadge from './MethodBadge';
import ParameterTable from './ParameterTable';
import SchemaTable from './SchemaTable';
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
 * their own captions rather than h4s (CONSTRAINT H3). Colors are brand-locked.
 */

interface EndpointCardProps {
  endpoint: NormalizedEndpoint;
}

/** Slug suitable for an id, e.g. `get-links`, `delete-links-id`. */
function toEndpointId(method: string, path: string): string {
  const slug = `${method}-${path}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `endpoint-${slug}`;
}

export default function EndpointCard({ endpoint }: EndpointCardProps) {
  const headingId = toEndpointId(endpoint.method, endpoint.path);
  const accessibleMethod = endpoint.method.toUpperCase();

  return (
    <li>
      <article
        aria-labelledby={headingId}
        className="border border-[#7d6ec0] rounded-xl"
      >
        <Disclosure
          header={
            <span className="flex items-center gap-3">
              <MethodBadge method={endpoint.method} />
              <h3 id={headingId} className="text-dazed text-base font-mono">
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
            <p className="mb-2 text-dazed text-sm font-semibold">
              {endpoint.summary}
            </p>
          )}
          {endpoint.description && (
            <p className="mb-4 text-dazed text-sm leading-relaxed">
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
                <p className="text-dazed text-sm">
                  <span className="font-semibold">
                    {response.statusCode} response body:
                  </span>{' '}
                  No response body.
                </p>
              )}
            </div>
          ))}
        </Disclosure>
      </article>
    </li>
  );
}
