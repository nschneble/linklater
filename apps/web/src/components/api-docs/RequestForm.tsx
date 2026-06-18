import RequestBodyEditor from './RequestBodyEditor';
import RequestField from './RequestField';
import ResponsePanel from './ResponsePanel';
import { Link } from 'react-router-dom';
import { paramKey, useRequestForm } from '../../lib/apiDocs/useRequestForm';
import { useEffect, useId, useRef } from 'react';
import type { NormalizedEndpoint } from '../../lib/openapi';

/**
 * Interactive "try it out" form rendered below an endpoint's read-only tables
 * (CONSTRAINT §1). A logged-in user fires a real authenticated request and sees
 * the response; a logged-out user sees the same form in an explained, inert
 * state (CONSTRAINT §6).
 *
 * Request status (Sending… / the result) reaches assistive tech through a
 * `role="status"` live region. When `onStatusMessage` is supplied (the
 * master-detail container), the form reports its status UP to a single
 * page-level region that lives OUTSIDE the swapping detail panel — so an
 * in-flight announcement is not cut off when the user selects another endpoint
 * and this form unmounts. With no callback (unit tests), the form renders its
 * own inline announcer instead. All state logic lives in `useRequestForm`;
 * this component owns only JSX, the upward status report, and the submit focus
 * move.
 */

interface RequestFormProps {
  endpoint: NormalizedEndpoint;
  /** Endpoint heading id — the deterministic root for every field id (E4). */
  headingId: string;
  /** Origin to target; empty string means same-origin. */
  serverOrigin: string;
  /** Raw `ltk_` token; empty string ⇒ logged-out/inert. Header-only, never rendered. */
  token: string;
  /** True while the token is still loading; fields inert, announce nothing. */
  loading: boolean;
  /** Token-fetch error (logged-in path), or null. */
  error: string | null;
  /**
   * Reports the request-status message UP to a persistent page-level live
   * region that survives this form unmounting on an endpoint swap (§5/§7).
   * Omit to render the announcer inline (unit tests).
   */
  onStatusMessage?: (message: string) => void;
}

export default function RequestForm({
  endpoint,
  headingId,
  serverOrigin,
  token,
  loading,
  error,
  onStatusMessage,
}: RequestFormProps) {
  const inert = loading || token === '' || error !== null;
  const lockedId = useId();
  const summaryId = useId();
  const form = useRequestForm({
    endpoint,
    headingId,
    serverOrigin,
    token,
    inert,
  });

  // Push the status upward (when hoisted) so the page-level region — not this
  // unmount-on-swap form — owns the announcement. Reading the latest callback
  // from a ref keeps a fresh inline arrow prop from re-firing the effect.
  const onStatusMessageRef = useRef(onStatusMessage);
  onStatusMessageRef.current = onStatusMessage;
  useEffect(() => {
    onStatusMessageRef.current?.(form.statusMessage);
  }, [form.statusMessage]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalidFieldId = await form.submit();
    if (invalidFieldId) {
      document.getElementById(invalidFieldId)?.focus();
    }
  }

  const groupDescribedBy =
    token === '' && !loading && error === null ? lockedId : undefined;

  return (
    // `noValidate` hands validation to our JS (CONSTRAINT §3): native
    // `required` stays as a semantic hint and keeps `aria-required`, but the
    // browser's built-in popup must not preempt our consolidated alert,
    // per-field messages, and focus-to-first-invalid flow.
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-busy={form.phase === 'sending'}
      className="mt-4"
    >
      {/*
       * Inline announcer ONLY when the status isn't hoisted. When
       * `onStatusMessage` is supplied the container owns a single persistent
       * region (so it survives this form unmounting on a swap); a second region
       * here would double-announce.
       */}
      {onStatusMessage === undefined && (
        <p aria-live="polite" role="status" className="sr-only">
          {form.statusMessage}
        </p>
      )}

      {error !== null && (
        <p
          role="alert"
          className="mb-3 flex items-center gap-2 text-[var(--alert-text)] text-sm"
        >
          <i
            className="fa-solid fa-circle-exclamation text-[var(--alert-highlight)]"
            aria-hidden="true"
          />
          Couldn&rsquo;t load your API token. Reload to try again.
        </p>
      )}

      <fieldset
        className="border-0 p-0 m-0"
        aria-describedby={groupDescribedBy}
      >
        <legend className="text-[var(--mount-text)] text-sm font-semibold">
          Try it out
        </legend>

        {token === '' && !loading && error === null && (
          <p
            id={lockedId}
            className="mt-1 mb-3 text-[var(--mount-text)] text-sm"
          >
            <Link
              to="/login"
              className="text-[var(--mount-text)] underline focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] rounded"
            >
              Log in to send live requests
            </Link>
            .
          </p>
        )}

        {endpoint.parameters.length > 0 && (
          <fieldset className="border-0 p-0 m-0 mb-3">
            <legend className="text-[var(--mount-text)] text-xs font-semibold">
              Parameters
            </legend>
            {endpoint.parameters.map((parameter) => {
              const key = paramKey(parameter.location, parameter.name);
              return (
                <RequestField
                  key={key}
                  fieldId={form.paramFieldId(
                    parameter.location,
                    parameter.name,
                  )}
                  label={parameter.name}
                  required={parameter.required}
                  description={parameter.description}
                  value={form.paramValues[key] ?? ''}
                  error={form.paramErrors[key] ?? ''}
                  inert={inert}
                  onValueChange={(value) => form.setParamValue(key, value)}
                />
              );
            })}
          </fieldset>
        )}

        {endpoint.requestBody && (
          <fieldset className="border-0 p-0 m-0 mb-3">
            <legend className="text-[var(--mount-text)] text-xs font-semibold">
              Request body
            </legend>
            <RequestBodyEditor
              fieldId={form.bodyFieldId}
              value={form.bodyValue}
              error={form.bodyError}
              inert={inert}
              onValueChange={form.setBodyValue}
            />
          </fieldset>
        )}
      </fieldset>

      {form.summaryError ? (
        <p
          id={summaryId}
          role="alert"
          className="mt-1 flex items-center gap-2 text-[var(--alert-text)] text-xs"
        >
          <i
            className="fa-solid fa-circle-exclamation text-[var(--alert-highlight)]"
            aria-hidden="true"
          />
          {form.summaryError}
        </p>
      ) : (
        <p id={summaryId} aria-hidden="true" className="sr-only" />
      )}

      <button
        type="submit"
        aria-disabled={token === '' || undefined}
        disabled={form.phase === 'sending'}
        className="mt-3 inline-flex items-center gap-2 px-4 py-2 border border-[var(--mount-border)] text-[var(--mount-text)] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] aria-disabled:opacity-60 aria-disabled:cursor-not-allowed disabled:opacity-60 disabled:cursor-not-allowed rounded-full cursor-pointer"
      >
        {form.phase === 'sending' && (
          <i
            className="fa-solid fa-arrows-rotate fa-spin text-xs"
            aria-hidden="true"
          />
        )}
        {form.phase === 'sending' ? 'Sending…' : 'Send request'}
      </button>

      {form.outcome && (
        <ResponsePanel
          ok={form.outcome.ok}
          statusLine={form.outcome.statusLine}
          body={form.outcome.body}
        />
      )}
    </form>
  );
}
